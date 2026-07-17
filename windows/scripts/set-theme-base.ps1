[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidateSet('enable', 'disable')][string]$Mode,
  [string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'),
  [string]$ConfigPath = ''
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
  $codexConfigRoot = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
  $ConfigPath = Join-Path $codexConfigRoot 'config.toml'
}
. (Join-Path $PSScriptRoot 'config-utf8.ps1')
$backupPath = Join-Path $StateRoot 'config.before-dream-skin.toml'
try {
  if ($Mode -eq 'enable') {
    Install-DreamSkinBaseTheme -ConfigPath $ConfigPath -BackupPath $backupPath
  } elseif (Test-Path -LiteralPath $backupPath -PathType Leaf) {
    Restore-DreamSkinBaseTheme -ConfigPath $ConfigPath -BackupPath $backupPath
  }
} catch {
  if ($_.Exception.Message -like 'Refusing to rewrite nested desktop tables*') {
    Write-Warning 'Codex uses nested appearance tables; those settings were preserved and the independent renderer will still apply the theme.'
  } else {
    throw
  }
}
