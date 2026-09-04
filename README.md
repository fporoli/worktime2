# Worktime

A working-time tracking solution for companies and standalone users: Keycloak for authentication, Postgres for
storage (separate `auth` and `app` schemas), a NestJS REST API, and a React frontend.

## Architecture

- **Keycloak** handles authentication only (registration, login, password reset, optional Google and Microsoft/Azure
  AD sign-in). Its own tables live in the Postgres `auth` schema.
- **Postgres `app` schema**, owned by the NestJS backend via TypeORM, holds all authorization and business data:
  companies, memberships/roles, projects, assignments, and time entries.
- **Backend** (NestJS) validates JWTs against Keycloak's public JWKS endpoint, resolves the caller's app-side
  identity and roles from Postgres on every request, and exposes the REST API.
- **Frontend** (React + Vite + Mantine) authenticates via OIDC (Keycloak) and talks to the backend API.

See `code.md` for the original product spec.

## The four environments

Each environment gets its own dedicated port block (backend `300N` / frontend `800N` / Keycloak `808N` /
Postgres `543N`), so more than one can be up on the same machine at once without colliding. For environments 3
and 4, which are reached through a real hostname rather than `localhost`, these numbers become each container's
internal listen port instead of a literal URL port — Caddy (env 3) and Azure's own ingress (env 4) still front
everything on the standard HTTPS port.

| # | Environment | Backend | Frontend | Keycloak | Postgres | Runs via |
|---|---|---|---|---|---|---|
| 1 | Local dev (native) | 3001 | 8001 | 8081 | 5431 | `npm run dev` (repo root) |
| 2 | Dev (full Docker + Caddy) | 3002 | 8002 | 8082 | 5432 | `docker compose up` |
| 3 | Test (full Docker + Caddy) | 3003 | 8003 | 8083 | 5433 | GitHub Action → Coolify (VPS) |
| 4 | Production (Azure) | 3000 | 8000 | 8080 | 5430 | GitHub Action + `azure/deploy.sh` |

## 1. Local dev (native, via npm)

Backend and frontend run directly on your machine (fast rebuilds, real debugger); Postgres and Keycloak run in
Docker.

**Prerequisites**: Node.js, Docker.

```bash
npm install                # root scripts (concurrently) - once
npm run dev:infra           # starts Postgres + Keycloak + Mailpit in Docker (docker-compose.native-dev.yml)
npm run migrate              # applies TypeORM migrations to the Dockerized Postgres
npm run dev                  # starts backend + frontend natively, side by side
```

| Service | URL |
|---|---|
| Frontend | http://localhost:8001 |
| Backend API | http://localhost:3001 (health check at `/health`) |
| Keycloak | http://localhost:8081 (admin console at `/admin`, login with `KEYCLOAK_ADMIN`/`KEYCLOAK_ADMIN_PASSWORD` from root `.env`) |
| Mailpit | http://localhost:8026 |
| Postgres | `localhost:5431` |

`backend/.env` and `frontend/.env` already point at these ports. Stop the Docker infra with `npm run dev:infra:down`.

## 2. Dev (full Docker stack + Caddy, HTTPS)

Everything — Postgres, Keycloak, backend, frontend — runs in Docker behind a `caddy` reverse proxy that
terminates TLS with a locally-trusted certificate.

**Prerequisites**: Docker and Docker Compose, [mkcert](https://github.com/FiloSottile/mkcert)
(`brew install mkcert nss`, or see mkcert's own README for other platforms) — only needed once per machine.

```bash
cp .env.example .env
mkcert -install                                       # once per machine - installs a local CA so browsers trust the cert below
mkdir -p certs
mkcert -cert-file certs/localhost.pem -key-file certs/localhost-key.pem localhost 127.0.0.1 ::1
docker-compose up --build
```

| Service | URL |
|---|---|
| Frontend | https://localhost:8002 |
| Backend API | https://localhost:3002 (health check at `/health`) |
| Keycloak | https://localhost:8082 (admin console at `/admin`, login with `KEYCLOAK_ADMIN`/`KEYCLOAK_ADMIN_PASSWORD` from `.env`) |
| Mailpit (catches registration/reset emails) | http://localhost:8025 |
| Postgres | `localhost:5432` (connect with `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` from `.env`) |

Ports are configurable via `KEYCLOAK_PORT`/`POSTGRES_PORT`/`BACKEND_PORT`/`FRONTEND_PORT` in `.env` if you want
something other than the defaults above.

If browsers still show a certificate warning after `mkcert -install`, restart the browser (some, like Firefox,
cache the trust store at launch) — `mkcert -install` itself needs `sudo`, so it has to be run interactively in a
real terminal, not from a script.

The `keycloak-config-cli` service imports the `worktime` realm on every startup (idempotent — safe to restart).
The `backend` service runs pending TypeORM migrations before starting.

### First run walkthrough (either environment 1 or 2)

1. Open the frontend URL — you'll be redirected to Keycloak's login page.
2. Click **Register** and create an account (check the Mailpit URL for the verification/reset emails Keycloak
   sends, since no real SMTP is configured).
3. After logging in, choose **Create a company** during onboarding — you become that company's admin.
4. As admin, go to **Projects** and create a company project, a subproject under it, and an activity (e.g.
   "Vacation").
5. Register a second account in a private/incognito window, log in once so the backend creates their user record,
   then in **Employees** (first account) add them by email and assign them to the project.
6. Log in as the second user and log some 5-minute-rounded time segments on **My time**.

### Optional: Google sign-in

By default only email/password login is enabled. To add Google sign-in, see
`keycloak/realm-config/google-idp.yaml.example`.

### Optional: Microsoft / Azure AD sign-in

To add "Sign in with Microsoft" against a specific Azure AD tenant, see
`keycloak/realm-config/azure-idp.yaml.example`. `AZURE_CLIENT_ID` and `AZURE_TENANT_ID` are already filled in
`.env`; you just need to generate a client secret in the Azure Portal (App registrations > your app >
Certificates & secrets) and set `AZURE_CLIENT_SECRET`, add the redirect URI documented in that file to the app's
Authentication settings, then rename the file to `azure-idp.yaml` and restart the stack.

## 3. Test (Coolify, HTTPS via real domain)

Same shape as environment 2, but built from the production Dockerfiles (no bind mounts, no dev servers) and
reachable at `test.turbotapir.com` / `api.test.turbotapir.com` / `auth.test.turbotapir.com`, with Caddy obtaining
real Let's Encrypt certificates for each automatically.

**One-time manual setup (Coolify has no API access from this repo, so this can't be scripted):**
1. In Coolify, create a "Docker Compose" resource pointed at this git repo, using `docker-compose.test.yml`.
2. Set its environment variables from `.env.test.example` (real values — that file itself has none).
3. Point `test.turbotapir.com`, `api.test.turbotapir.com`, and `auth.test.turbotapir.com`'s DNS at the VPS.
4. Create a deploy webhook for the resource in Coolify, and add its URL (and token, if any) as the
   `COOLIFY_TEST_WEBHOOK_URL` / `COOLIFY_TEST_TOKEN` GitHub Actions secrets on this repo.

After that, `.github/workflows/deploy-test.yml` redeploys automatically on every push to a `test` branch (or via
"Run workflow" in the Actions tab) — it just pings the Coolify webhook; Coolify itself pulls the new commit and
rebuilds.

## 4. Production (Azure)

`azure/deploy.sh` deploys the whole stack to Azure Container Apps. Postgres runs as a plain `postgres:16-alpine`
container app (not a managed Azure Database for PostgreSQL server) with its data directory on a persistent Azure
Files share so it survives restarts/redeploys, reachable only from other apps in the same environment (internal
TCP ingress, never the public internet). Keycloak, the backend, and the frontend run as container apps on Azure's
`*.azurecontainerapps.io` domain, with HTTPS out of the box. It builds images in the cloud via `az acr build`, so
a local Docker daemon isn't required.

**Manual deploy** (unchanged from before):

```bash
az login
./azure/deploy.sh
```

**Automated deploy**: `.github/workflows/deploy-production.yml` runs the same script on every push to `main` (or
via "Run workflow"). It needs an `AZURE_CREDENTIALS` service-principal secret plus the Postgres/Keycloak admin
credentials and Google/Azure AD sign-in credentials as repo secrets — see the comment at the top of that workflow
file for the exact list and where each value comes from.

Creates a new resource group `rg-worktime-prod` in `westeurope` (edit the variables at the top of the
script to change either). Safe to re-run — existing resources are reused rather than recreated. Postgres
admin and Keycloak admin passwords are generated on first run and saved to `azure/.secrets.env`
(gitignored, not stored anywhere else — keep it if you'll re-run the script later, and copy its values into the
GitHub secrets above so the automated deploy stays in sync with the manual one).

Rough cost: ~$10-15/month (no managed database — just Container Apps, an Azure Container Registry, and a small
Storage Account for the Postgres data share). Keycloak and Postgres both run with `min-replicas 1` (Keycloak's JVM
cold start is too slow for Container Apps' startup probe when scaling from zero; Postgres needs to stay up for
both Keycloak and the backend); the backend and frontend scale to zero when idle.

After deploying, Google/Microsoft sign-in (if enabled) need their redirect URIs updated in the Google Cloud
Console / Azure AD app registration to point at the new Keycloak URL the script prints — that's an external
console this script can't reach on your behalf.

## Repository layout

```
backend/                       NestJS API (TypeORM entities, migrations, REST controllers)
frontend/                      React app (Vite, Mantine, TanStack Query, OIDC via react-oidc-context)
keycloak/                      Realm configuration applied via keycloak-config-cli
postgres/                      Database init scripts (creates the auth/app schemas)
caddy/                         Caddyfile (env 2, local HTTPS) and Caddyfile.test (env 3, Let's Encrypt)
azure/                         Bicep + deploy.sh for environment 4
.github/workflows/             GitHub Actions for environments 3 and 4
docker-compose.yml              Environment 2
docker-compose.native-dev.yml   Postgres + Keycloak for environment 1
docker-compose.test.yml         Environment 3
```
