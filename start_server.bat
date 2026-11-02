@echo off
title AI Exam Proctor - Web Server
echo ========================================================
echo   AI Exam Proctor - Secure Assessment Portal (v3.2)
echo ========================================================
echo.

:: 1. Check if port 5000 is occupied and choose available port
set PORT=5000
netstat -ano | findstr :5000 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Port 5000 is already in use, switching to port 5050...
    set PORT=5050
)

set URL=http://localhost:%PORT%/?t=%RANDOM%
echo Starting local web server at http://localhost:%PORT% ...
echo Launching AI Exam Proctor in a fresh, isolated window...

:: 2. Force browser to open in a brand new window (not reuse old tab)
where chrome >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    start chrome --new-window "%URL%"
) else (
    where msedge >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        start msedge --new-window "%URL%"
    ) else (
        start "" "%URL%"
    )
)

echo.
echo ========================================================
echo Server is running at http://localhost:%PORT% !
echo Press Ctrl+C in this window anytime to stop the server.
echo ========================================================
python -m http.server %PORT%
