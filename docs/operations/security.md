# Security Notes

## Secrets

- Never commit `.env`, `.env.local`, service tokens, or exported credentials.
- Treat `RAILWAY_TOKEN`, JWT secrets, encryption keys, SMTP credentials, and database URLs as rotation-managed secrets.
- Keep secrets in Railway variables, GitHub Actions secrets, or your local environment manager.

## Rotation process

1. Generate the new secret.
2. Update the secret in Railway and any CI secret stores.
3. Redeploy affected services.
4. Confirm authentication, encryption, and external integrations still work.
5. Revoke the previous secret after verification.

## Production policy

- Database schema changes only go through committed Drizzle migrations.
- Ad-hoc repair endpoints and production init scripts should not be exposed.
- Seeding is opt-in and should only be enabled for bootstrap scenarios.
