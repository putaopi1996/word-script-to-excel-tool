@echo off
setlocal

cd /d "%~dp0"

set "CHECK_ONLY=0"
set "PY_CMD="
if /i "%~1"=="--check" set "CHECK_ONLY=1"

echo [1/4] Checking Python...
python -V >nul 2>nul
if not errorlevel 1 set "PY_CMD=python"
if not defined PY_CMD (
    py -V >nul 2>nul
    if not errorlevel 1 set "PY_CMD=py"
)
if not defined PY_CMD (
    for /f "delims=" %%I in ('dir /b /ad "%LocalAppData%\Programs\Python\Python*" 2^>nul') do (
        if exist "%LocalAppData%\Programs\Python\%%I\python.exe" (
            set "PY_CMD=%LocalAppData%\Programs\Python\%%I\python.exe"
        )
    )
)
if not defined PY_CMD (
    echo Python was not found. Please install Python 3.11+ and add it to PATH.
    pause
    exit /b 1
)

echo [2/4] Checking dependencies...
"%PY_CMD%" -c "import flask, docx, openpyxl" >nul 2>nul
if errorlevel 1 (
    echo Missing dependencies. Installing from requirements.txt ...
    "%PY_CMD%" -m pip install -r requirements.txt
    if errorlevel 1 (
        echo Dependency installation failed.
        pause
        exit /b 1
    )
)

if "%CHECK_ONLY%"=="1" (
    echo Startup script check passed.
    exit /b 0
)

echo [3/4] Opening browser...
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:5000"

echo [4/4] Starting WebUI server...
"%PY_CMD%" app.py

if errorlevel 1 (
    echo Server stopped or failed to start.
    pause
)
