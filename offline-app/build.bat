@echo off
setlocal
title Accounting and Inventory ERP - Builder
echo =======================================================
echo  Compiling Offline Accounting ERP into Windows .exe
echo =======================================================
echo.

where go >nul 2>nul
if %errorlevel% neq 0 (
    set "PATH=C:\Program Files\Go\bin;%PATH%"
)

where rsrc >nul 2>nul
if %errorlevel% neq 0 (
    set "PATH=%USERPROFILE%\go\bin;%PATH%"
)

if not exist database.sqlite (
    echo [0/3] database.sqlite template missing, auto-generating with demo data...
    python build\create_db.py
)

echo [1/3] Generating Windows Resource (App Icon and DPI Manifest)...
rsrc -manifest build\app.manifest -ico assets\icon.ico -o rsrc.syso

echo [2/3] Compiling Single Standalone Binary with Go...
if not exist bin mkdir bin
go build -mod=mod -ldflags="-H windowsgui -s -w" -o bin\AccountingERP.exe .

if %errorlevel% equ 0 (
    copy /Y bin\AccountingERP.exe bin\offline-app.exe >nul
    if exist rsrc.syso move /Y rsrc.syso build\ >nul
    echo [3/3] Created bin\offline-app.exe duplicate
    echo.
    echo =======================================================
    echo  [SUCCESS] Standalone .exe compiled successfully!
    echo  Executables: 
    echo    - bin\AccountingERP.exe
    echo    - bin\offline-app.exe
    echo  Default Port: 8759
    echo =======================================================
) else (
    if exist rsrc.syso move /Y rsrc.syso build\ >nul
    echo.
    echo [ERROR] Build failed! Check errors above.
)

echo.
pause
