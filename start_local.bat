@echo off
chcp 65001 >nul
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8000/
  py -m http.server 8000
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8000/
  python -m http.server 8000
  goto :eof
)

echo Pythonが見つかりません。
echo GitHub Pagesへアップロードして公開URLから開くか、Pythonをインストールしてください。
pause
