[CmdletBinding()]
param(
  [int]$Port = 9335,
  [switch]$NoShortcuts,
  [switch]$NoAutoHeal
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$scripts = Join-Path $root 'windows\scripts'
$installer = Join-Path $scripts 'install-dream-skin.ps1'
$launcher = Join-Path $scripts 'start-dream-skin.ps1'

Write-Host '正在安装 Codex 主题管理页...'
Write-Host '请先关闭所有 Codex 窗口；安装脚本不会修改 WindowsApps 或 app.asar。'

& $installer -Port $Port -NoShortcuts:$NoShortcuts -NoAutoHeal:$NoAutoHeal -ManagerOnly
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '主题管理页已安装。请在「设置 → 主题」中安装并启用玄翎主题。'
& $launcher -Port $Port -PreservePause
exit $LASTEXITCODE
