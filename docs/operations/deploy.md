# Deploy Runbook

## Railway services

- `company-hub-backend`
- `company-hub-frontend`

## Local CLI workflow

1. `railway login --browserless` or `railway login`
2. `railway link -p scintillating-adventure -s company-hub-backend`
3. Deploy backend from repo root:
   `railway up -c -m "Deploy backend changes"`
4. Deploy frontend from repo root:
   `railway up -s company-hub-frontend -c -m "Deploy frontend changes"`

## Important notes

- The backend service expects the repository root as build context and uses `backend/Dockerfile`.
- The frontend service expects the repository root as build context and uses `frontend/Dockerfile`.
- Schema changes must be committed as Drizzle migrations before deploying the backend.
