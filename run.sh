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

echo "[1/2] Starting Docker containers (including BACKEND API,Worker,DB,etc...)"
docker compose up -d --build

echo ""
echo "[2/2] Launching local dev tools..."

# Launch Console and Prisma Studio in the background
nohup pnpm --filter @abi-desk/console dev > /dev/null 2>&1 &
nohup pnpm db:studio --browser none > /dev/null 2>&1 &


echo ""
echo "All services started! Console and Prisma Studio are running in the background."
exit 0

