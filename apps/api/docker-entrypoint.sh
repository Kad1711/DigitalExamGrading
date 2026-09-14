#!/bin/sh
set -e

echo "[DOCKER-ENTRYPOINT] Applying Prisma database migrations..."
npx prisma migrate deploy

echo "[DOCKER-ENTRYPOINT] Migrations completed. Starting API server..."
exec "$@"
