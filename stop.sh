#!/bin/bash

echo "=========================================================="
echo "Stopping ABI Desk Dev Stack (macOS / Linux)"
echo "=========================================================="


echo "[1/2] Stopping Docker containers..."
docker compose down

echo ""
echo "[2/2] Stopping local Node processes..."

for port in 9999 5555; do
    if command -v lsof >/dev/null 2>&1; then
        pids=$(lsof -t -i :$port)
        if [ -n "$pids" ]; then
            echo "Stopping process on port $port..."
            echo "$pids" | xargs kill -9 2>/dev/null
        fi
    elif command -v fuser >/dev/null 2>&1; then
        echo "Stopping process on port $port..."
        fuser -k -n tcp $port >/dev/null 2>&1
    fi
done

echo ""
echo "All services stopped successfully!"
exit 0

