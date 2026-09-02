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

## Prerequisites

- Docker and Docker Compose

## Running locally

```bash
cp .env.example .env
docker-compose up --build
```

This starts:

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000 (health check at `/health`) |
| Keycloak | http://localhost:8080 (admin console at `/admin`, login with `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` from `.env`) |
| Mailpit (catches registration/reset emails) | http://localhost:8025 |

The `keycloak-config-cli` service imports the `worktime` realm on every startup (idempotent — safe to restart).
The `backend` service runs pending TypeORM migrations before starting.

### First run walkthrough

1. Open http://localhost:5173 — you'll be redirected to Keycloak's login page.
2. Click **Register** and create an account (check http://localhost:8025 for the verification/reset emails Keycloak
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

## Deploying to Azure

`azure/deploy.sh` deploys the whole stack to Azure Container Apps (Postgres becomes a managed Azure
Database for PostgreSQL Flexible Server; Keycloak, the backend, and the frontend run as container apps on
Azure's `*.azurecontainerapps.io` domain, with HTTPS out of the box). It builds images in the cloud via
`az acr build`, so a local Docker daemon isn't required.

```bash
az login
./azure/deploy.sh
```

Creates a new resource group `rg-worktime-prod` in `westeurope` (edit the variables at the top of the
script to change either). Safe to re-run — existing resources are reused rather than recreated. Postgres
admin and Keycloak admin passwords are generated on first run and saved to `azure/.secrets.env`
(gitignored, not stored anywhere else — keep it if you'll re-run the script later).

Rough cost: ~$25-35/month, dominated by the always-on Postgres Flexible Server (`az postgres flexible-server
stop` between sessions cuts this). Keycloak runs with `min-replicas 1` (its JVM cold start is too slow for
Container Apps' startup probe when scaling from zero); the backend and frontend scale to zero when idle.

After deploying, Google/Microsoft sign-in (if enabled) need their redirect URIs updated in the Google Cloud
Console / Azure AD app registration to point at the new Keycloak URL the script prints — that's an external
console this script can't reach on your behalf.

## Repository layout

```
backend/    NestJS API (TypeORM entities, migrations, REST controllers)
frontend/   React app (Vite, Mantine, TanStack Query, OIDC via react-oidc-context)
keycloak/   Realm configuration applied via keycloak-config-cli
postgres/   Database init scripts (creates the auth/app schemas)
```

## Local development without Docker

Both apps can also run outside Docker against the Dockerized Postgres/Keycloak (or your own):

```bash
cd backend && npm install && npm run migration:run && npm run start:dev
cd frontend && npm install && npm run dev
```

Copy `backend/.env.example` / point env vars at wherever Postgres and Keycloak are reachable in that case.
