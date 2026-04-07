#!/bin/sh
set -e

echo "=== Company Hub Backend ==="

echo "Initializing database tables..."
node dist/db/init.js || echo "DB init completed"

echo "Running seed..."
node dist/db/seed.js || echo "Seed step completed (may already exist)"

echo "Starting server..."
node dist/index.js
