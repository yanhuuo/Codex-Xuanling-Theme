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

Write-Host '正在安装「秧秧·玄翎｜苍羽夜」Codex Dream Skin...'
Write-Host '请先关闭所有 Codex 窗口；安装脚本不会修改 WindowsApps 或 app.asar。'

& $installer -Port $Port -NoShortcuts:$NoShortcuts -NoAutoHeal:$NoAutoHeal
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '主题已安装，正在启动 Codex Dream Skin...'
& $launcher -Port $Port
exit $LASTEXITCODE
