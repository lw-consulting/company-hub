#!/bin/bash
set -e

echo "Running migrations..."
node dist/db/migrate.js

echo "Running seed..."
node dist/db/seed.js || true

echo "Starting server..."
node dist/index.js
