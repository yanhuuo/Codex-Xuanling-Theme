@echo off
chcp 65001 >nul
title Codex 主题工具安装
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0安装主题工具.ps1"
set "install_exit=%errorlevel%"
if not "%install_exit%"=="0" (
  echo.
  echo 安装失败，请保留此窗口中的错误信息。
  pause
)
exit /b %install_exit%
