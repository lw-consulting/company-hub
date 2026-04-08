#!/bin/sh
set -eu

echo "=== Company Hub Backend ==="

echo "Running database migrations..."
node dist/db/migrate.js

if [ "${RUN_DB_SEED:-false}" = "true" ]; then
  echo "RUN_DB_SEED=true, running seed..."
  node dist/db/seed.js || echo "Seed step completed (may already exist)"
else
  echo "RUN_DB_SEED is not enabled, skipping seed."
fi

echo "Starting server..."
node dist/index.js
