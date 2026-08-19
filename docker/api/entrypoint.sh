#!/bin/sh
# ---------------------------------------------------------------------------
# API/worker container entrypoint.
#
# Exactly one service in the stack (the API) runs migrations, guarded by
# RUN_MIGRATIONS. Letting both the API and the worker migrate concurrently is a
# classic way to deadlock a deploy, so the worker starts with it disabled and
# simply waits for the schema the API applied.
# ---------------------------------------------------------------------------
set -e

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "[entrypoint] applying database migrations (prisma migrate deploy)"
  pnpm --filter @abi-desk/db exec prisma migrate deploy
  echo "[entrypoint] seeding system metadata (roles, permissions, workflows)"
  pnpm --filter @abi-desk/db run seed:metadata
  echo "[entrypoint] migrations up to date"
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "[entrypoint] seeding demo data"
  pnpm --filter @abi-desk/db run seed
fi

echo "[entrypoint] starting role=${PROCESS_ROLE:-api}"
exec "$@"
