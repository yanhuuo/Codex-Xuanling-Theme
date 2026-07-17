[CmdletBinding()]
param(
  [int]$Port = 9335,
  [ValidateRange(5, 300)][int]$PollSeconds = 12
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common-windows.ps1')

Assert-DreamSkinPort -Port $Port
$stateRoot = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
$statePath = Join-Path $stateRoot 'state.json'
$enabledPath = Join-Path $stateRoot 'guard.enabled'
$logPath = Join-Path $stateRoot 'guard.log'
$startScript = Join-Path $PSScriptRoot 'start-dream-skin.ps1'
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$mutex = [System.Threading.Mutex]::new($false, "Local\CodexDreamSkin.$sid.Guard")
$ownsMutex = $false

function Write-GuardLog {
  param([Parameter(Mandatory = $true)][string]$Message)
  $line = "[$((Get-Date).ToUniversalTime().ToString('o'))] $Message`r`n"
  [System.IO.File]::AppendAllText($logPath, $line, [System.Text.UTF8Encoding]::new($false))
}

function Test-RecordedInjectorHealthy {
  param(
    [AllowNull()][object]$State,
    [Parameter(Mandatory = $true)][object]$Codex,
    [AllowNull()][object]$Identity
  )
  if ($null -eq $State -or $null -eq $Identity -or -not $State.injectorPid -or
    "$($State.codexVersion)" -ne "$($Codex.Version)" -or
    "$($State.browserId)" -cne "$($Identity.BrowserId)") { return $false }
  $processId = [int]$State.injectorPid
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
  if ($null -eq $process) { return $false }
  $processPath = Get-DreamSkinProcessExecutablePath -ProcessInfo $process
  $commandLine = "$($process.CommandLine)"
  if (-not $processPath -or [System.IO.Path]::GetFileName($processPath) -ine 'node.exe' -or
    -not $State.injectorPath -or
    -not (Test-DreamSkinCommandLineToken -CommandLine $commandLine -Token "$($State.injectorPath)") -or
    -not (Test-DreamSkinCommandLineToken -CommandLine $commandLine -Token '--watch')) { return $false }
  return $true
}

try {
  try { $ownsMutex = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $ownsMutex = $true }
  if (-not $ownsMutex) { exit 0 }
  New-Item -ItemType Directory -Force -Path $stateRoot | Out-Null
  $lastAttempt = [datetime]::MinValue
  $lastError = ''
  $lastErrorAt = [datetime]::MinValue
  Write-GuardLog 'Auto-heal guard started.'

  while (Test-Path -LiteralPath $enabledPath -PathType Leaf) {
    try {
      $codex = Get-DreamSkinCodexInstall
      $running = @(Get-DreamSkinCodexProcesses -Codex $codex)
      if ($running.Count -gt 0) {
        $state = Read-DreamSkinState -Path $statePath
        $identity = Get-DreamSkinVerifiedCdpIdentity -Port $Port -Codex $codex
        if (-not (Test-RecordedInjectorHealthy -State $state -Codex $codex -Identity $identity)) {
          $now = Get-Date
          if (($now - $lastAttempt).TotalSeconds -ge 90) {
            $lastAttempt = $now
            Write-GuardLog "Repairing Codex $($codex.Version): CDP or injector state is missing/stale."
            & $startScript -Port $Port -RestartExisting -PreservePause *> $null
            if ($LASTEXITCODE -ne 0) { throw "start-dream-skin.ps1 returned exit code $LASTEXITCODE" }
            Write-GuardLog "Repair completed for Codex $($codex.Version)."
          }
        }
      }
      $lastError = ''
    } catch {
      $message = $_.Exception.Message
      $now = Get-Date
      if ($message -ne $lastError -or ($now - $lastErrorAt).TotalMinutes -ge 5) {
        Write-GuardLog "Repair deferred: $message"
        $lastError = $message
        $lastErrorAt = $now
      }
    }
    Start-Sleep -Seconds $PollSeconds
  }
  Write-GuardLog 'Auto-heal guard stopped because guard.enabled was removed.'
} finally {
  if ($ownsMutex) { try { $mutex.ReleaseMutex() } catch {} }
  $mutex.Dispose()
}
