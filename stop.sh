#!/bin/bash

echo "=========================================================="
echo "Stopping ABI Desk Dev Stack (macOS / Linux)"
echo "=========================================================="


echo "[1/2] Stopping Docker containers..."
docker compose down

echo ""
echo "[2/2] Stopping local Node processes..."

# Surgically terminate abi-desk console and prisma studio processes
pkill -9 -f "abi-desk/apps/console" >/dev/null 2>&1
pkill -9 -f "abi-desk.*studio" >/dev/null 2>&1

for port in 9999 5555; do
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

