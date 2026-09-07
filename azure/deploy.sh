#!/usr/bin/env bash
# Deploys worktime2 to Azure Container Apps. Safe to re-run: existing resources are
# left alone (Bicep resources are idempotent; container apps/jobs are skipped with a
# warning if they already exist rather than being recreated).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RESOURCE_GROUP="rg-worktime-prod"
LOCATION="westeurope"
CAE_NAME="cae-worktime-prod"
SECRETS_FILE="$SCRIPT_DIR/.secrets.env"

log() { echo "==> $*"; }

# 'az containerapp job create --registry-identity system' auto-creates a managed identity,
# assigns it AcrPull, and validates the image pull all in one synchronous call - RBAC role
# propagation isn't instant, so that validation can lose the race on a fresh identity and
# silently fall back to a placeholder image with no registry configured at all. Re-assert
# both explicitly afterward so the job ends up in the correct state regardless.
ensure_job_registry_and_image() {
  local job_name="$1" image="$2"
  az containerapp job registry set -n "$job_name" -g "$RESOURCE_GROUP" \
    --server "$ACR_LOGIN_SERVER" --identity system -o none
  az containerapp job update -n "$job_name" -g "$RESOURCE_GROUP" --image "$image" -o none
}

# 'containerapp create' no-ops when the app already exists, so a redeploy that only rebuilds
# the image (backend/frontend, tagged ':latest') would otherwise leave the running app on
# whatever image it last pulled. 'containerapp update --image' with an unchanged tag string
# doesn't reliably create a new revision either (observed directly), so force one explicitly
# with a unique suffix every run - that also guarantees a fresh pull from the registry.
ensure_containerapp_image() {
  local app_name="$1" image="$2"
  az containerapp update -n "$app_name" -g "$RESOURCE_GROUP" \
    --image "$image" --revision-suffix "deploy-$(date +%Y%m%d%H%M%S)" -o none
}

# --- 0. preconditions ---
if ! az account show >/dev/null 2>&1; then
  echo "Not logged in to Azure. Run 'az login' first, then re-run this script." >&2
  exit 1
fi
log "Logged in as: $(az account show --query user.name -o tsv) (subscription: $(az account show --query name -o tsv))"

# shellcheck disable=SC1091
set -a
source "$REPO_ROOT/.env"
set +a

# --- generate/persist prod-only secrets (kept out of git, distinct from local dev creds) ---
if [ -f "$SECRETS_FILE" ]; then
  log "Reusing existing generated secrets from $SECRETS_FILE"
  # shellcheck disable=SC1090
  source "$SECRETS_FILE"
else
  log "Generating fresh Postgres admin + Keycloak admin passwords for this deployment"
  POSTGRES_ADMIN_USERNAME="worktimeadmin"
  POSTGRES_ADMIN_PASSWORD="$(openssl rand -hex 16)"
  KEYCLOAK_ADMIN_USER="admin"
  KEYCLOAK_ADMIN_PASSWORD="$(openssl rand -hex 16)"
  cat > "$SECRETS_FILE" <<EOF
POSTGRES_ADMIN_USERNAME=$POSTGRES_ADMIN_USERNAME
POSTGRES_ADMIN_PASSWORD=$POSTGRES_ADMIN_PASSWORD
KEYCLOAK_ADMIN_USER=$KEYCLOAK_ADMIN_USER
KEYCLOAK_ADMIN_PASSWORD=$KEYCLOAK_ADMIN_PASSWORD
EOF
  log "Saved generated secrets to $SECRETS_FILE (gitignored) - keep this safe, it's not stored anywhere else."
fi

# --- 1. resource group + platform resources via Bicep ---
log "Creating resource group $RESOURCE_GROUP in $LOCATION"
az group create -n "$RESOURCE_GROUP" -l "$LOCATION" -o none

log "Deploying platform resources (this can take a few minutes)"
DEPLOY_OUTPUT=$(az deployment group create \
  -g "$RESOURCE_GROUP" \
  -f "$SCRIPT_DIR/main.bicep" \
  --query properties.outputs -o json)

ACR_NAME=$(echo "$DEPLOY_OUTPUT" | python3 -c "import json,sys;print(json.load(sys.stdin)['acrName']['value'])")
ACR_LOGIN_SERVER=$(echo "$DEPLOY_OUTPUT" | python3 -c "import json,sys;print(json.load(sys.stdin)['acrLoginServer']['value'])")
POSTGRES_DATA_STORAGE_NAME=$(echo "$DEPLOY_OUTPUT" | python3 -c "import json,sys;print(json.load(sys.stdin)['postgresDataStorageName']['value'])")

log "ACR: $ACR_LOGIN_SERVER"

CAE_ID=$(az containerapp env show -g "$RESOURCE_GROUP" -n "$CAE_NAME" --query id -o tsv)

# --- 2. postgres container app (self-hosted image, not a managed server) ---
# Runs as a single-replica container app with its data directory on the "postgres-data"
# Azure Files share (see main.bicep) so it survives restarts/redeploys instead of
# resetting every time (Container Apps are otherwise ephemeral). Internal-only TCP
# ingress: reachable by other apps in this environment at the bare app name "postgres"
# (confirmed directly with a throwaway diagnostic container - the "<app>.internal.<env
# domain>" FQDN shown in "az containerapp create"'s human-readable output does NOT work
# for TCP service-to-service traffic, only the bare name does), never from the public
# internet.
POSTGRES_DB="worktime"
POSTGRES_HOST="postgres"

if az containerapp show -g "$RESOURCE_GROUP" -n postgres >/dev/null 2>&1; then
  log "Container app 'postgres' already exists - skipping create (use 'az containerapp update' to change it)"
else
  log "Creating postgres container app"
  # 'az containerapp create --yaml' has a bug in this CLI version: any 'ingress:' block
  # in the yaml produces a generic "JSON value could not be converted to System.Boolean"
  # 400 error, regardless of its contents (reproduced directly, isolated to just the
  # presence of the ingress key). So ingress/scale/resources/secrets/env are set the
  # normal way via flags, and the Azure Files volume mount (which flags don't support at
  # all) is layered on afterward via 'update --yaml' instead.
  az containerapp create -n postgres -g "$RESOURCE_GROUP" \
    --environment "$CAE_NAME" \
    --image postgres:16-alpine \
    --ingress internal --transport tcp --target-port 5430 \
    --min-replicas 1 --max-replicas 1 --cpu 0.5 --memory 1.0Gi \
    --secrets pg-user="$POSTGRES_ADMIN_USERNAME" pg-pass="$POSTGRES_ADMIN_PASSWORD" \
    --env-vars \
      POSTGRES_USER=secretref:pg-user \
      POSTGRES_PASSWORD=secretref:pg-pass \
      POSTGRES_DB="$POSTGRES_DB" \
      PGDATA=/var/lib/postgresql/data/pgdata \
      PGPORT=5430 \
    -o none

  # 'update --yaml' replaces whatever top-level sections it includes wholesale (verified:
  # it is NOT a merge) - the full container spec (env included, not just volumeMounts) is
  # restated here so the env vars set above aren't wiped, and 'configuration' is omitted
  # entirely so the ingress/secrets set above are left untouched.
  POSTGRES_VOLUME_YAML="$(mktemp)"
  cat > "$POSTGRES_VOLUME_YAML" <<EOF
properties:
  template:
    containers:
      - image: postgres:16-alpine
        name: postgres
        resources:
          cpu: 0.5
          memory: 1.0Gi
        env:
          - name: POSTGRES_USER
            secretRef: pg-user
          - name: POSTGRES_PASSWORD
            secretRef: pg-pass
          - name: POSTGRES_DB
            value: "$POSTGRES_DB"
          - name: PGDATA
            value: /var/lib/postgresql/data/pgdata
          - name: PGPORT
            value: "5430"
        volumeMounts:
          - volumeName: postgres-data
            mountPath: /var/lib/postgresql/data
    volumes:
      - name: postgres-data
        storageType: AzureFile
        storageName: $POSTGRES_DATA_STORAGE_NAME
    scale:
      minReplicas: 1
      maxReplicas: 1
EOF
  az containerapp update -n postgres -g "$RESOURCE_GROUP" --yaml "$POSTGRES_VOLUME_YAML" -o none
  rm -f "$POSTGRES_VOLUME_YAML"
fi

# --- one-shot schema creation (Bicep can't run arbitrary SQL, and there's no managed-server
# control-plane API here) - waits for Postgres to accept connections, then creates the
# auth/app schemas. Idempotent (CREATE SCHEMA IF NOT EXISTS), so safe to rerun every deploy.
# Jobs' '--yaml' create doesn't hit the ingress bug above (jobs have no ingress concept),
# and flag-based '--args "-c" "..."' hits a *different* CLI bug in this version (fails
# even on the exact example from 'az containerapp job create --help' - any arg starting
# with '-' breaks argparse) - so --yaml is the reliable path here, not a fallback.
if az containerapp job show -g "$RESOURCE_GROUP" -n postgres-init >/dev/null 2>&1; then
  log "Job 'postgres-init' already exists - skipping create"
else
  log "Creating postgres-init job"
  POSTGRES_INIT_YAML="$(mktemp)"
  cat > "$POSTGRES_INIT_YAML" <<EOF
location: $LOCATION
properties:
  environmentId: $CAE_ID
  configuration:
    triggerType: Manual
    replicaTimeout: 300
    replicaRetryLimit: 1
    manualTriggerConfig:
      parallelism: 1
      replicaCompletionCount: 1
    secrets:
      - name: pg-user
        value: "$POSTGRES_ADMIN_USERNAME"
      - name: pg-pass
        value: "$POSTGRES_ADMIN_PASSWORD"
  template:
    containers:
      - image: postgres:16-alpine
        name: postgres-init
        command:
          - sh
          - -c
          - |
            until pg_isready -h $POSTGRES_HOST -p 5430 -U "\$POSTGRES_USER"; do sleep 3; done
            psql "postgresql://\$POSTGRES_USER:\$POSTGRES_PASSWORD@$POSTGRES_HOST:5430/$POSTGRES_DB" -c "CREATE SCHEMA IF NOT EXISTS auth; CREATE SCHEMA IF NOT EXISTS app;"
        env:
          - name: POSTGRES_USER
            secretRef: pg-user
          - name: POSTGRES_PASSWORD
            secretRef: pg-pass
        resources:
          cpu: 0.25
          memory: 0.5Gi
EOF
  az containerapp job create -n postgres-init -g "$RESOURCE_GROUP" --yaml "$POSTGRES_INIT_YAML" -o none
  rm -f "$POSTGRES_INIT_YAML"
fi

log "Running postgres schema init job"
az containerapp job start -n postgres-init -g "$RESOURCE_GROUP" -o none

log "Waiting for postgres schema init job to finish..."
for _ in $(seq 1 30); do
  STATUS=$(az containerapp job execution list -n postgres-init -g "$RESOURCE_GROUP" \
    --query "[0].properties.status" -o tsv 2>/dev/null || echo "")
  if [ "$STATUS" = "Succeeded" ]; then
    log "Postgres schemas ready"
    break
  fi
  if [ "$STATUS" = "Failed" ]; then
    echo "Postgres schema init job failed. Check logs with:" >&2
    echo "  az containerapp job logs show -n postgres-init -g $RESOURCE_GROUP" >&2
    exit 1
  fi
  sleep 10
done

# --- 3. compute FQDNs up front ---
DEFAULT_DOMAIN=$(az containerapp env show -g "$RESOURCE_GROUP" -n "$CAE_NAME" \
  --query properties.defaultDomain -o tsv)
KEYCLOAK_FQDN="keycloak.$DEFAULT_DOMAIN"
BACKEND_FQDN="backend.$DEFAULT_DOMAIN"
FRONTEND_FQDN="frontend.$DEFAULT_DOMAIN"
log "Computed FQDNs: keycloak=$KEYCLOAK_FQDN backend=$BACKEND_FQDN frontend=$FRONTEND_FQDN"

# --- 4. build all custom images in one pass (cloud-side build, no local Docker needed) ---
log "Building backend image"
az acr build -r "$ACR_NAME" -g "$RESOURCE_GROUP" -t worktime-backend:latest \
  -f "$REPO_ROOT/backend/Dockerfile" "$REPO_ROOT/backend" --only-show-errors -o none

log "Building frontend image"
az acr build -r "$ACR_NAME" -g "$RESOURCE_GROUP" -t worktime-frontend:latest \
  -f "$REPO_ROOT/frontend/Dockerfile" \
  --build-arg VITE_API_BASE_URL="https://$BACKEND_FQDN" \
  --build-arg VITE_KEYCLOAK_URL="https://$KEYCLOAK_FQDN" \
  --build-arg VITE_KEYCLOAK_REALM=worktime \
  --build-arg VITE_KEYCLOAK_CLIENT_ID=worktime-frontend \
  "$REPO_ROOT/frontend" --only-show-errors -o none

log "Building keycloak-config-cli image (realm YAMLs baked in)"
az acr build -r "$ACR_NAME" -g "$RESOURCE_GROUP" -t worktime-keycloak-config-cli:latest \
  -f "$REPO_ROOT/keycloak/Dockerfile" "$REPO_ROOT/keycloak" --only-show-errors -o none

# --- 5. keycloak container app ---
# min-replicas=1, not 0: Keycloak's JVM cold start (20-40s+) loses the race against
# Container Apps' startup probe when scaling from zero, causing a genuine crash-restart
# loop (not just a slow first request) - observed directly during deployment. Keeping
# one replica warm costs a little more (~$5-10/mo) but this is the auth layer, so
# reliability wins over the scale-to-zero savings here.
if az containerapp show -g "$RESOURCE_GROUP" -n keycloak >/dev/null 2>&1; then
  log "Container app 'keycloak' already exists - skipping create (use 'az containerapp update' to change it)"
else
  log "Creating keycloak container app"
  az containerapp create -n keycloak -g "$RESOURCE_GROUP" \
    --environment "$CAE_NAME" \
    --image quay.io/keycloak/keycloak:26.0 \
    --target-port 8080 --ingress external \
    --min-replicas 1 --max-replicas 1 --cpu 0.5 --memory 1.0Gi \
    --args "start" \
    --secrets pg-user="$POSTGRES_ADMIN_USERNAME" pg-pass="$POSTGRES_ADMIN_PASSWORD" \
             kc-admin="$KEYCLOAK_ADMIN_USER" kc-admin-pass="$KEYCLOAK_ADMIN_PASSWORD" \
    --env-vars \
      KC_DB=postgres \
      KC_DB_URL="jdbc:postgresql://$POSTGRES_HOST:5430/$POSTGRES_DB?currentSchema=auth" \
      KC_DB_SCHEMA=auth \
      KC_DB_USERNAME=secretref:pg-user \
      KC_DB_PASSWORD=secretref:pg-pass \
      KC_HOSTNAME="$KEYCLOAK_FQDN" \
      KC_HOSTNAME_STRICT=true \
      KC_HTTP_ENABLED=true \
      KC_HEALTH_ENABLED=true \
      KC_PROXY_HEADERS=xforwarded \
      KEYCLOAK_ADMIN=secretref:kc-admin \
      KEYCLOAK_ADMIN_PASSWORD=secretref:kc-admin-pass \
    -o none
fi

log "Waiting for Keycloak to be ready (this can take a minute)..."
for _ in $(seq 1 40); do
  if curl -sf "https://$KEYCLOAK_FQDN/realms/master/.well-known/openid-configuration" >/dev/null 2>&1; then
    log "Keycloak is ready"
    break
  fi
  sleep 5
done

# --- 6. realm import job ---
JOB_ENV_VARS=(
  KEYCLOAK_URL="https://$KEYCLOAK_FQDN"
  KEYCLOAK_USER=secretref:kc-admin
  KEYCLOAK_PASSWORD=secretref:kc-admin-pass
  KEYCLOAK_AVAILABILITYCHECK_ENABLED=true
  KEYCLOAK_AVAILABILITYCHECK_TIMEOUT=120s
  IMPORT_FILES_LOCATIONS=/config/*.yaml
  IMPORT_VAR_SUBSTITUTION_ENABLED=true
  FRONTEND_ORIGIN="https://$FRONTEND_FQDN"
)
JOB_SECRETS=(kc-admin="$KEYCLOAK_ADMIN_USER" kc-admin-pass="$KEYCLOAK_ADMIN_PASSWORD")

if [ -n "${GOOGLE_CLIENT_ID:-}" ]; then
  JOB_SECRETS+=(google-client-id="$GOOGLE_CLIENT_ID" google-client-secret="$GOOGLE_CLIENT_SECRET")
  JOB_ENV_VARS+=(GOOGLE_CLIENT_ID=secretref:google-client-id GOOGLE_CLIENT_SECRET=secretref:google-client-secret)
fi
if [ -n "${AZURE_CLIENT_ID:-}" ]; then
  JOB_SECRETS+=(azure-client-id="$AZURE_CLIENT_ID" azure-client-secret="$AZURE_CLIENT_SECRET" azure-tenant-id="$AZURE_TENANT_ID")
  JOB_ENV_VARS+=(AZURE_CLIENT_ID=secretref:azure-client-id AZURE_CLIENT_SECRET=secretref:azure-client-secret AZURE_TENANT_ID=secretref:azure-tenant-id)
fi

if az containerapp job show -g "$RESOURCE_GROUP" -n keycloak-config-cli >/dev/null 2>&1; then
  log "Job 'keycloak-config-cli' already exists - skipping create"
else
  log "Creating keycloak-config-cli job"
  az containerapp job create -n keycloak-config-cli -g "$RESOURCE_GROUP" \
    --environment "$CAE_NAME" \
    --trigger-type Manual --replica-timeout 300 --replica-retry-limit 1 \
    --image "$ACR_LOGIN_SERVER/worktime-keycloak-config-cli:latest" \
    --registry-server "$ACR_LOGIN_SERVER" --registry-identity system \
    --cpu 0.5 --memory 1.0Gi \
    --secrets "${JOB_SECRETS[@]}" \
    --env-vars "${JOB_ENV_VARS[@]}" \
    -o none
fi
ensure_job_registry_and_image keycloak-config-cli "$ACR_LOGIN_SERVER/worktime-keycloak-config-cli:latest"

log "Running realm import job"
az containerapp job start -n keycloak-config-cli -g "$RESOURCE_GROUP" -o none

log "Waiting for realm import job to finish..."
for _ in $(seq 1 30); do
  STATUS=$(az containerapp job execution list -n keycloak-config-cli -g "$RESOURCE_GROUP" \
    --query "[0].properties.status" -o tsv 2>/dev/null || echo "")
  if [ "$STATUS" = "Succeeded" ]; then
    log "Realm import succeeded"
    break
  fi
  if [ "$STATUS" = "Failed" ]; then
    echo "Realm import job failed. Check logs with:" >&2
    echo "  az containerapp job logs show -n keycloak-config-cli -g $RESOURCE_GROUP" >&2
    exit 1
  fi
  sleep 10
done

# --- 7. backend migrations (one-shot job, NOT part of the app's own startup command) ---
# Running 'npm run migration:run' inside the app container's CMD would pay ts-node's
# multi-second startup cost on every single cold start (min-replicas=0 means this
# happens often), which loses the race against Container Apps' startup probe and
# causes an unhealthy-replica restart loop. Run it once here instead; the app image's
# own CMD is just 'node dist/src/main.js' (fast).
DB_URL="postgres://$POSTGRES_ADMIN_USERNAME:$POSTGRES_ADMIN_PASSWORD@$POSTGRES_HOST:5430/$POSTGRES_DB"

if az containerapp job show -g "$RESOURCE_GROUP" -n backend-migrate >/dev/null 2>&1; then
  log "Job 'backend-migrate' already exists - skipping create"
else
  log "Creating backend-migrate job"
  az containerapp job create -n backend-migrate -g "$RESOURCE_GROUP" \
    --environment "$CAE_NAME" \
    --trigger-type Manual --replica-timeout 300 --replica-retry-limit 1 \
    --image "$ACR_LOGIN_SERVER/worktime-backend:latest" \
    --registry-server "$ACR_LOGIN_SERVER" --registry-identity system \
    --cpu 0.5 --memory 1.0Gi \
    --secrets db-url="$DB_URL" \
    --env-vars DATABASE_URL=secretref:db-url DATABASE_SCHEMA=app \
    -o none \
    --command "npm" \
    --args "run" "migration:run"
fi
ensure_job_registry_and_image backend-migrate "$ACR_LOGIN_SERVER/worktime-backend:latest"

log "Running database migrations"
az containerapp job start -n backend-migrate -g "$RESOURCE_GROUP" -o none

log "Waiting for migration job to finish..."
for _ in $(seq 1 20); do
  STATUS=$(az containerapp job execution list -n backend-migrate -g "$RESOURCE_GROUP" \
    --query "[0].properties.status" -o tsv 2>/dev/null || echo "")
  if [ "$STATUS" = "Succeeded" ]; then
    log "Migrations applied"
    break
  fi
  if [ "$STATUS" = "Failed" ]; then
    echo "Migration job failed. Check logs with:" >&2
    echo "  az containerapp job logs show -n backend-migrate -g $RESOURCE_GROUP" >&2
    exit 1
  fi
  sleep 10
done

# --- 8. backend ---
if az containerapp show -g "$RESOURCE_GROUP" -n backend >/dev/null 2>&1; then
  log "Container app 'backend' already exists - skipping create (use 'az containerapp update' to change it)"
else
  log "Creating backend container app"
  az containerapp create -n backend -g "$RESOURCE_GROUP" \
    --environment "$CAE_NAME" \
    --image "$ACR_LOGIN_SERVER/worktime-backend:latest" \
    --registry-server "$ACR_LOGIN_SERVER" --registry-identity system \
    --target-port 3000 --ingress external \
    --min-replicas 0 --max-replicas 2 --cpu 0.5 --memory 1.0Gi \
    --secrets db-url="$DB_URL" \
    --env-vars \
      NODE_ENV=production PORT=3000 \
      DATABASE_URL=secretref:db-url \
      DATABASE_SCHEMA=app \
      KEYCLOAK_ISSUER_URL="https://$KEYCLOAK_FQDN/realms/worktime" \
      KEYCLOAK_INTERNAL_ISSUER_URL="https://$KEYCLOAK_FQDN/realms/worktime" \
      FRONTEND_ORIGIN="https://$FRONTEND_FQDN" \
    -o none
fi
ensure_containerapp_image backend "$ACR_LOGIN_SERVER/worktime-backend:latest"

# --- 9. frontend ---
if az containerapp show -g "$RESOURCE_GROUP" -n frontend >/dev/null 2>&1; then
  log "Container app 'frontend' already exists - skipping create (use 'az containerapp update' to change it)"
else
  log "Creating frontend container app"
  az containerapp create -n frontend -g "$RESOURCE_GROUP" \
    --environment "$CAE_NAME" \
    --image "$ACR_LOGIN_SERVER/worktime-frontend:latest" \
    --registry-server "$ACR_LOGIN_SERVER" --registry-identity system \
    --target-port 8000 --ingress external \
    --min-replicas 0 --max-replicas 2 --cpu 0.25 --memory 0.5Gi \
    --env-vars FRONTEND_PORT=8000 \
    -o none
fi
ensure_containerapp_image frontend "$ACR_LOGIN_SERVER/worktime-frontend:latest"

echo
echo "=========================================================="
echo " Deployed."
echo "   Frontend: https://$FRONTEND_FQDN"
echo "   Backend:  https://$BACKEND_FQDN  (health: https://$BACKEND_FQDN/health)"
echo "   Keycloak: https://$KEYCLOAK_FQDN"
echo
echo " Manual step still required for Google/Microsoft sign-in to work here:"
echo "   Update the redirect URI in the Google Cloud Console OAuth client and/or"
echo "   the Azure AD app registration's Authentication settings to:"
echo "     https://$KEYCLOAK_FQDN/realms/worktime/broker/google/endpoint"
echo "     https://$KEYCLOAK_FQDN/realms/worktime/broker/azure/endpoint"
echo "   (currently they only allow the localhost:8080 redirect URI)."
echo "=========================================================="
