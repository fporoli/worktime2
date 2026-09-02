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
POSTGRES_SERVER_NAME_HINT="psql-worktime-prod"
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

# --- 0. preconditions ---
if ! az account show >/dev/null 2>&1; then
  echo "Not logged in to Azure. Run 'az login' first, then re-run this script." >&2
  exit 1
fi
log "Logged in as: $(az account show --query user.name -o tsv) (subscription: $(az account show --query name -o tsv))"

az extension add --name rdbms-connect -y --only-show-errors 2>/dev/null \
  || az extension update --name rdbms-connect -y --only-show-errors >/dev/null 2>&1 \
  || true

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

log "Deploying platform resources (this can take 5-10 minutes, mostly Postgres)"
DEPLOY_OUTPUT=$(az deployment group create \
  -g "$RESOURCE_GROUP" \
  -f "$SCRIPT_DIR/main.bicep" \
  --parameters postgresAdminUsername="$POSTGRES_ADMIN_USERNAME" postgresAdminPassword="$POSTGRES_ADMIN_PASSWORD" \
  --query properties.outputs -o json)

ACR_NAME=$(echo "$DEPLOY_OUTPUT" | python3 -c "import json,sys;print(json.load(sys.stdin)['acrName']['value'])")
ACR_LOGIN_SERVER=$(echo "$DEPLOY_OUTPUT" | python3 -c "import json,sys;print(json.load(sys.stdin)['acrLoginServer']['value'])")
POSTGRES_SERVER_NAME=$(echo "$DEPLOY_OUTPUT" | python3 -c "import json,sys;print(json.load(sys.stdin)['postgresServerName']['value'])")
POSTGRES_FQDN=$(echo "$DEPLOY_OUTPUT" | python3 -c "import json,sys;print(json.load(sys.stdin)['postgresFqdn']['value'])")
POSTGRES_DB=$(echo "$DEPLOY_OUTPUT" | python3 -c "import json,sys;print(json.load(sys.stdin)['postgresDatabaseName']['value'])")

log "ACR: $ACR_LOGIN_SERVER"
log "Postgres: $POSTGRES_FQDN"

# --- 2. schema creation (Bicep can't run arbitrary SQL) ---
# 'az postgres flexible-server execute' connects directly from this machine, not from
# inside Azure, so the "AllowAzureServices" rule alone doesn't cover it - temporarily
# whitelist this machine's public IP for the duration of the schema-creation call.
log "Creating auth/app schemas on Postgres"
DEPLOY_MACHINE_IP=$(curl -s https://api.ipify.org)
az postgres flexible-server firewall-rule create \
  -g "$RESOURCE_GROUP" -s "$POSTGRES_SERVER_NAME" \
  --name AllowDeployMachine \
  --start-ip-address "$DEPLOY_MACHINE_IP" --end-ip-address "$DEPLOY_MACHINE_IP" \
  --only-show-errors -o none

az postgres flexible-server execute \
  -n "$POSTGRES_SERVER_NAME" -d "$POSTGRES_DB" \
  -u "$POSTGRES_ADMIN_USERNAME" -p "$POSTGRES_ADMIN_PASSWORD" \
  -q "CREATE SCHEMA IF NOT EXISTS auth; CREATE SCHEMA IF NOT EXISTS app;" \
  --only-show-errors -o none

az postgres flexible-server firewall-rule delete \
  -g "$RESOURCE_GROUP" -s "$POSTGRES_SERVER_NAME" \
  --name AllowDeployMachine --yes \
  --only-show-errors -o none

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
      KC_DB_URL="jdbc:postgresql://$POSTGRES_FQDN:5432/$POSTGRES_DB?currentSchema=auth&sslmode=require" \
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
DB_URL="postgres://$POSTGRES_ADMIN_USERNAME:$POSTGRES_ADMIN_PASSWORD@$POSTGRES_FQDN:5432/$POSTGRES_DB"

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
    --env-vars DATABASE_URL=secretref:db-url DATABASE_SCHEMA=app DATABASE_SSL=true \
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
      DATABASE_SSL=true \
      KEYCLOAK_ISSUER_URL="https://$KEYCLOAK_FQDN/realms/worktime" \
      KEYCLOAK_INTERNAL_ISSUER_URL="https://$KEYCLOAK_FQDN/realms/worktime" \
      FRONTEND_ORIGIN="https://$FRONTEND_FQDN" \
    -o none
fi

# --- 9. frontend ---
if az containerapp show -g "$RESOURCE_GROUP" -n frontend >/dev/null 2>&1; then
  log "Container app 'frontend' already exists - skipping create (use 'az containerapp update' to change it)"
else
  log "Creating frontend container app"
  az containerapp create -n frontend -g "$RESOURCE_GROUP" \
    --environment "$CAE_NAME" \
    --image "$ACR_LOGIN_SERVER/worktime-frontend:latest" \
    --registry-server "$ACR_LOGIN_SERVER" --registry-identity system \
    --target-port 80 --ingress external \
    --min-replicas 0 --max-replicas 2 --cpu 0.25 --memory 0.5Gi \
    -o none
fi

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
