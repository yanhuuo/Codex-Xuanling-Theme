@echo off
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-xuanling.ps1"
set "dream_skin_exit=%ERRORLEVEL%"
if not "%dream_skin_exit%"=="0" (
  echo.
  echo 安装未完成。请确认 Codex 已完全关闭，然后重试。
  pause
)
exit /b %dream_skin_exit%
