#!/bin/bash

echo "=========================================================="
echo "Stopping ABI Desk Dev Stack (macOS / Linux)"
echo "=========================================================="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[1/2] Stopping Docker containers..."
docker compose down

echo ""
echo "[2/2] Stopping local Node processes..."

# Terminate all processes running from this workspace directory
pkill -9 -f "${ROOT_DIR}" >/dev/null 2>&1
pkill -9 -if "ABI_DESK.*(console|prisma|studio|vite|esbuild)" >/dev/null 2>&1
pkill -9 -if "abi-desk.*(console|prisma|studio|vite|esbuild)" >/dev/null 2>&1

# Clean up default and shifted ports
for port in 9999 5555 10000 10001 10002 5556 5557 5558; do
    if command -v fuser >/dev/null 2>&1; then
        fuser -k -n tcp $port >/dev/null 2>&1
    fi
    if command -v lsof >/dev/null 2>&1; then
        pids=$(lsof -t -i :$port 2>/dev/null)
        if [ -n "$pids" ]; then
            echo "$pids" | xargs kill -9 2>/dev/null
        fi
    fi
done

echo ""
echo "All services stopped successfully!"
exit 0

