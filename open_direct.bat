@echo off
title Open AI Exam Proctor
echo Opening AI Exam Proctor in a brand new browser window...

set FILE_PATH=%~dp0index.html

where chrome >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    start chrome --new-window "file:///%FILE_PATH%"
) else (
    where msedge >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        start msedge --new-window "file:///%FILE_PATH%"
    ) else (
        start "" "%FILE_PATH%"
    )
)
