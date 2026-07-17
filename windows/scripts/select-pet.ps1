[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[A-Za-z0-9._-]{1,80}$')]
  [string]$PetId,

  [string]$ConfigPath = (Join-Path (if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }) 'config.toml')
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'config-utf8.ps1')
Set-DreamSkinSelectedPet -ConfigPath $ConfigPath -PetId $PetId
