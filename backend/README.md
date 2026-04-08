# Backend migration workflow

The backend now uses Drizzle migrations as the source of truth for Railway and local deployments.

## Commands

- `npm run db:generate -w backend`
  Builds the backend schema into `dist/` and generates a new migration in `backend/src/db/migrations`.
- `npm run db:migrate -w backend`
  Applies all migrations from `backend/src/db/migrations`.
- `npm run db:seed -w backend`
  Seeds the default organization and admin user if the database is still empty.

## Deployment behavior

`backend/start.sh` runs migrations first, then the seed, then starts the API server. The Docker image copies the SQL migration files and Drizzle metadata into `dist/db/migrations` so the production runtime can execute them directly.

## Notes

- `0000_initial_schema.sql` is an idempotent baseline migration for existing Railway databases and fresh environments.
- Future schema changes should go through `db:generate` and be committed together with the updated files in `backend/src/db/migrations/meta`.
