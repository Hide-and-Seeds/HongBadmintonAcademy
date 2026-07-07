@echo off
setlocal
cd /d "%~dp0"
title HBA Worker - Clean Uninstall

echo ==================================================
echo   HBA Worker - clean slate (to run setup again)
echo ==================================================
echo.
echo Stops the worker + tunnel and DELETES generated files:
echo   deps (node_modules), portable Node (.node), cloudflared.exe,
echo   .env (secret/config), logs, and the puppeteer Chrome cache.
echo.
echo KEEPS: your code files, the WhatsApp link (.wwebjs_auth) so you do
echo NOT re-scan the QR, and the saved secret (wa-secret.txt) so setup
echo does NOT ask for it again. To also unlink WhatsApp, delete the
echo .wwebjs_auth folder by hand after this.
echo.
pause

echo.
echo [1/4] Stopping worker / tunnel / cloudflared / Chrome...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'node.exe' -and ($_.CommandLine -like '*server.mjs*' -or $_.CommandLine -like '*tunnel.mjs*')) -or $_.Name -eq 'cloudflared.exe' -or $_.Name -eq 'chrome-headless-shell.exe' -or ($_.Name -eq 'chrome.exe' -and $_.CommandLine -like '*wwebjs_auth*') } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }"
taskkill /f /fi "WINDOWTITLE eq HBA WhatsApp Worker*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq HBA WA Tunnel*" >nul 2>&1

echo [2/4] Removing autostart shortcut...
powershell -NoProfile -Command "$l = Join-Path ([Environment]::GetFolderPath('Startup')) 'HBA-WA-Worker.lnk'; if (Test-Path $l) { Remove-Item $l -Force }"

echo [3/4] Deleting generated files (keeping .wwebjs_auth)...
rmdir /s /q ".wwebjs_cache" 2>nul
rmdir /s /q "node_modules" 2>nul
rmdir /s /q ".node" 2>nul
del /f /q ".env" 2>nul
del /f /q "cloudflared.exe" 2>nul
del /f /q "node.zip" 2>nul
del /f /q "worker.log" 2>nul
del /f /q "tunnel.log" 2>nul
del /f /q "qr.png" 2>nul

echo [4/4] Clearing puppeteer Chrome cache...
rmdir /s /q "%USERPROFILE%\.cache\puppeteer" 2>nul

echo.
echo ==================================================
echo   CLEAN. Now double-click setup-client.bat to
echo   set it up fresh.
echo ==================================================
echo.
pause
