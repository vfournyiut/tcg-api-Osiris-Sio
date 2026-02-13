@echo off
npx --no -- commitlint --edit %1 --no-color >&2
if %errorlevel% neq 0 exit /b %errorlevel%