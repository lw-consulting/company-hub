# Environment Matrix

## Backend

Source: root `.env` or Railway service variables

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `ACCESS_TOKEN_EXPIRY`
- `REFRESH_TOKEN_EXPIRY`
- `ENCRYPTION_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `PORT`
- `CORS_ORIGINS`
- `NODE_ENV`
- `UPLOAD_DIR`
- `MAX_FILE_SIZE`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `RUN_DB_SEED`

## Frontend

Source: `frontend/.env` or Railway build variables

- `VITE_API_URL`

## Mobile

Source: `mobile/.env` or EAS/Expo environment

- `EXPO_PUBLIC_API_URL`

## Recommended defaults

- Local backend: `http://localhost:3000/api`
- Local frontend: `http://localhost:5173`
- Production frontend should point to the backend `/api` origin explicitly via `VITE_API_URL`
- Production mobile builds should always set `EXPO_PUBLIC_API_URL`
