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

echo [1/2] Starting Docker containers (including BACKEND API,Worker,DB,etc)...
docker compose up -d --build

echo.
echo [2/2] Launching local dev tools...
:: Launching Console and Prisma Studio in minimized cmd windows (using cmd /c so they close automatically when stopped)
start /min "ABI Desk - Console" cmd /c "pnpm --filter @abi-desk/console dev"
start /min "ABI Desk - Prisma Studio" cmd /c "pnpm db:studio --browser none"


echo.
echo All services started! Console and Prisma Studio are running minimized in the background.
exit /b 0
