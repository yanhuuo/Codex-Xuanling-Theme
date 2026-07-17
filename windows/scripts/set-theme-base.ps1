[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidateSet('enable', 'disable')][string]$Mode,
  [string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'),
  [string]$ConfigPath = (Join-Path (if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }) 'config.toml')
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'config-utf8.ps1')
$backupPath = Join-Path $StateRoot 'config.before-dream-skin.toml'
if ($Mode -eq 'enable') {
  Install-DreamSkinBaseTheme -ConfigPath $ConfigPath -BackupPath $backupPath
} elseif (Test-Path -LiteralPath $backupPath -PathType Leaf) {
  Restore-DreamSkinBaseTheme -ConfigPath $ConfigPath -BackupPath $backupPath
}
