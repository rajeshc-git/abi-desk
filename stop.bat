@echo off
echo ==========================================================
echo Stopping ABI Desk Dev Stack
echo ==========================================================

echo [1/2] Stopping Docker containers...
docker compose down

echo.
echo [2/2] Stopping local Node processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /c:":9999 " ^| findstr LISTENING') do taskkill /f /t /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /c:":5555 " ^| findstr LISTENING') do taskkill /f /t /pid %%a >nul 2>&1


echo.
echo All services stopped successfully!
exit /b 0
