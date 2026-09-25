@echo off
echo ==========================================================
echo Starting ABI Desk Dev Stack (Windows)
echo ==========================================================

:: Setup .env if it doesn't exist
if not exist .env (
    echo [.env file not found. Copying from .env.example...]
    copy .env.example .env
    echo.
)

:: Install dependencies if node_modules doesn't exist
if not exist node_modules (
    echo [node_modules not found. Running pnpm install...]
    call pnpm install
    echo.
)

echo [1/3] Building all workspace packages and production frontend bundle...
call pnpm db:generate
call pnpm --filter @abi-desk/rbac build
call pnpm --filter @abi-desk/db build
call pnpm --filter @abi-desk/widget build
call pnpm --filter @abi-desk/console build
echo.

echo [2/3] Starting Docker containers (including BACKEND API,Worker,DB,etc)...
docker compose up -d --build

echo.
echo [3/3] Launching production frontend and local tools...
:: Launching Production Console and Prisma Studio in minimized cmd windows
start /min "ABI Desk - Production Console" cmd /c "pnpm --filter @abi-desk/console start"
start /min "ABI Desk - Prisma Studio" cmd /c "pnpm db:studio --browser none"

echo.
echo All services started! Production Console (dist) and Prisma Studio are running minimized in the background.
exit /b 0
