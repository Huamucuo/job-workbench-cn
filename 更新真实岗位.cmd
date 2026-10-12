@echo off
cd /d "%~dp0"
node --use-env-proxy scripts/update-jobs.mjs --research
if errorlevel 1 (echo Update failed. Previous verified data has been preserved.) else (echo Updated. Refresh the browser to load the new snapshot.)
pause
