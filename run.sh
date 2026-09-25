#!/bin/bash

echo "=========================================================="
echo "Starting ABI Desk Dev Stack (macOS / Linux)"
echo "=========================================================="


# Setup .env if it doesn't exist
if [ ! -f .env ]; then
    echo "[.env file not found. Copying from .env.example...]"
    cp .env.example .env
    echo ""
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d node_modules ]; then
    echo "[node_modules not found. Running pnpm install...]"
    pnpm install
    echo ""
fi

echo "[1/3] Building all workspace packages and production frontend bundle..."
pnpm db:generate
pnpm --filter @abi-desk/rbac build
pnpm --filter @abi-desk/db build
pnpm --filter @abi-desk/widget build
pnpm --filter @abi-desk/console build
echo ""

echo "[2/3] Starting Docker containers (including BACKEND API, Worker, DB, etc...)"
docker compose up -d --build

echo ""
echo "[3/3] Launching production frontend and local tools..."

# Launch compiled production Console and Prisma Studio in the background
nohup pnpm --filter @abi-desk/console start > /dev/null 2>&1 &
nohup pnpm db:studio --browser none > /dev/null 2>&1 &

echo ""
echo "All services started! Production Console (dist) and Prisma Studio are running in the background."
exit 0

