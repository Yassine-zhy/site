@echo off
rem Double-cliquez sur ce fichier pour installer puis lancer le bot (Windows).
chcp 65001 >nul
cd /d "%~dp0"
set "PY=python"
where py >nul 2>nul && set "PY=py -3"
%PY% installer.py
if errorlevel 1 (
  echo.
  echo Installation impossible : lisez le message ci-dessus.
  echo Python est-il installe ? https://www.python.org/downloads
  pause
  exit /b 1
)
echo.
echo Le bot demarre. Pour l'arreter : Ctrl+C, ou fermez cette fenetre.
echo.
".venv\Scripts\python.exe" bot.py
pause
