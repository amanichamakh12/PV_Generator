@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-client.ps1" -Production
set "EXITCODE=%ERRORLEVEL%"

if not "%EXITCODE%"=="0" (
  echo.
  echo Production startup failed with exit code %EXITCODE%.
  pause
)

exit /b %EXITCODE%