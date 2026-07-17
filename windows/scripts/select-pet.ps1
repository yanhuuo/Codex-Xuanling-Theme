[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[A-Za-z0-9._-]{1,80}$')]
  [string]$PetId,

  [string]$ConfigPath = ''
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
  $codexConfigRoot = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
  $ConfigPath = Join-Path $codexConfigRoot 'config.toml'
}
. (Join-Path $PSScriptRoot 'config-utf8.ps1')
Set-DreamSkinSelectedPet -ConfigPath $ConfigPath -PetId $PetId
