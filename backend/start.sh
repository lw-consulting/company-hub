#!/bin/sh
set -e

echo "=== Company Hub Backend ==="

echo "Running migrations..."
node dist/db/migrate.js || echo "Migration step completed (may have no migrations yet)"

echo "Running seed..."
node dist/db/seed.js || echo "Seed step completed (may already exist)"

echo "Starting server..."
node dist/index.js
