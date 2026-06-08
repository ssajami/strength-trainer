@echo off
cd /d "%~dp0"
echo.
echo  ==========================================
echo   Strength Program Generator
echo   http://localhost:8080
echo   Press Ctrl+C to stop the server
echo  ==========================================
echo.

REM Open browser (won't fail if it takes a moment for server to start)
start "" "http://localhost:8080"

REM Start server
python -m http.server 8080 2>nul
if %errorlevel% neq 0 (
    python3 -m http.server 8080 2>nul
    if %errorlevel% neq 0 (
        echo.
        echo  ERROR: Python not found. Install Python from https://python.org
        echo  and make sure to check "Add to PATH" during installation.
        echo.
        pause
    )
)
