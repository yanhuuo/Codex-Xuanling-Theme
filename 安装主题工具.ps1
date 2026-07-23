[CmdletBinding()]
param(
  [int]$Port = 9335,
  [switch]$RestartExisting,
  [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'
$packageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceWindows = Join-Path $packageRoot 'windows'
$sourceCommon = Join-Path $sourceWindows 'scripts\common-windows.ps1'
if (-not (Test-Path -LiteralPath $sourceCommon -PathType Leaf)) {
  throw '安装包不完整：缺少 windows\scripts\common-windows.ps1'
}
. $sourceCommon

Assert-DreamSkinPort -Port $Port
$codex = Get-DreamSkinCodexInstall
$running = @(Get-DreamSkinCodexProcesses -Codex $codex)
if ($running.Count -gt 0 -and -not $RestartExisting) {
  Write-Host ''
  Write-Host '安装主题工具需要重启一次 Codex。未发送的输入可能丢失。' -ForegroundColor Yellow
  $answer = (Read-Host '现在重启并继续安装？输入 Y 确认').Trim()
  if ($answer -notmatch '^(?i:y|yes)$') {
    Write-Host '已取消，Codex 和现有主题没有改变。'
    exit 0
  }
}

$stateRoot = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
$runtimeRoot = Join-Path $stateRoot 'runtime'
$statePath = Join-Path $stateRoot 'state.json'
$guardMarker = Join-Path $stateRoot 'guard.enabled'
$guardWasEnabled = Test-Path -LiteralPath $guardMarker -PathType Leaf
$codexWasRunning = $running.Count -gt 0

function Stop-PreviousThemeHelpers {
  param([AllowNull()][object]$State)

  # Disable the old guard before stopping the injector, otherwise it may
  # immediately recreate the process while the stable runtime is upgrading.
  Remove-Item -LiteralPath $guardMarker -Force -ErrorAction SilentlyContinue
  if ($null -eq $State -or -not $State.injectorPath) { return }

  $oldScripts = Split-Path -Parent "$($State.injectorPath)"
  $trustedScripts = @(
    (Join-Path $oldScripts 'guard-dream-skin.ps1'),
    (Join-Path $oldScripts 'tray-dream-skin.ps1')
  )
  foreach ($process in @(Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue)) {
    $commandLine = "$($process.CommandLine)"
    $matchesTrustedScript = $false
    foreach ($scriptPath in $trustedScripts) {
      if (Test-DreamSkinCommandLineToken -CommandLine $commandLine -Token $scriptPath) {
        $matchesTrustedScript = $true
        break
      }
    }
    if ($matchesTrustedScript) {
      Stop-Process -Id ([int]$process.ProcessId) -Force -ErrorAction Stop
    }
  }
}

try {
  New-Item -ItemType Directory -Force -Path $stateRoot | Out-Null
  $existingState = Read-DreamSkinState -Path $statePath
  Stop-PreviousThemeHelpers -State $existingState
  if ($null -ne $existingState) { $null = Stop-DreamSkinRecordedInjector -State $existingState }
  if ($codexWasRunning) { Stop-DreamSkinCodex -Codex $codex -AllowForce }

  New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
  Copy-Item -LiteralPath (Join-Path $packageRoot 'README.md') -Destination $runtimeRoot -Force
  Copy-Item -LiteralPath (Join-Path $packageRoot '使用说明.md') -Destination $runtimeRoot -Force
  Copy-Item -LiteralPath (Join-Path $packageRoot 'install-xuanling.ps1') -Destination $runtimeRoot -Force
  $runtimeWindows = Join-Path $runtimeRoot 'windows'
  if (Test-Path -LiteralPath $runtimeWindows -PathType Container) {
    $fullRuntimeWindows = [System.IO.Path]::GetFullPath($runtimeWindows)
    $fullRuntimeRoot = [System.IO.Path]::GetFullPath($runtimeRoot).TrimEnd('\')
    if (-not $fullRuntimeWindows.StartsWith($fullRuntimeRoot + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
      throw '稳定运行目录越界，已拒绝更新。'
    }
    Remove-Item -LiteralPath $fullRuntimeWindows -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $runtimeWindows | Out-Null
  Copy-Item -Path (Join-Path $sourceWindows '*') -Destination $runtimeWindows -Recurse -Force
  $sourcePets = Join-Path $packageRoot 'pets'
  $runtimePets = Join-Path $runtimeRoot 'pets'
  if (-not (Test-Path -LiteralPath $sourcePets -PathType Container)) {
    throw '安装包不完整：缺少项目根目录 pets'
  }
  if (Test-Path -LiteralPath $runtimePets -PathType Container) {
    $fullRuntimePets = [System.IO.Path]::GetFullPath($runtimePets)
    $fullRuntimeRoot = [System.IO.Path]::GetFullPath($runtimeRoot).TrimEnd('\')
    if (-not $fullRuntimePets.StartsWith($fullRuntimeRoot + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
      throw '稳定宠物目录越界，已拒绝更新。'
    }
    Remove-Item -LiteralPath $fullRuntimePets -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $runtimePets | Out-Null
  Copy-Item -Path (Join-Path $sourcePets '*') -Destination $runtimePets -Recurse -Force
  $legacyRuntimePets = Join-Path $runtimeWindows 'pets'
  if (Test-Path -LiteralPath $legacyRuntimePets -PathType Container) {
    $fullLegacyPets = [System.IO.Path]::GetFullPath($legacyRuntimePets)
    $fullRuntimeWindows = [System.IO.Path]::GetFullPath($runtimeWindows).TrimEnd('\')
    if (-not $fullLegacyPets.StartsWith($fullRuntimeWindows + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
      throw '旧宠物目录超出稳定运行目录，已拒绝迁移。'
    }
    Remove-Item -LiteralPath $fullLegacyPets -Recurse -Force
  }

  $runtimeScripts = Join-Path $runtimeRoot 'windows\scripts'
  $installer = Join-Path $runtimeScripts 'install-dream-skin.ps1'
  $launcher = Join-Path $runtimeScripts 'start-dream-skin.ps1'
  $global:LASTEXITCODE = 0
  & $installer -Port $Port -ManagerOnly
  if ($LASTEXITCODE -ne 0) { throw "主题工具安装脚本返回了错误代码：$LASTEXITCODE" }

  $shell = New-Object -ComObject WScript.Shell
  $desktop = [Environment]::GetFolderPath('Desktop')
  $startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
  foreach ($folder in @($desktop, $startMenu)) {
    $shortcut = $shell.CreateShortcut((Join-Path $folder 'Codex 主题.lnk'))
    $shortcut.TargetPath = (Get-Command powershell.exe -ErrorAction Stop).Source
    $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcher`" -Port $Port -PromptRestart"
    $shortcut.WorkingDirectory = $runtimeRoot
    $shortcut.Description = '启动 Codex 并启用主题管理页'
    $shortcut.Save()
  }

  if (-not $NoLaunch) {
    $global:LASTEXITCODE = 0
    & $launcher -Port $Port -PreservePause
    if ($LASTEXITCODE -ne 0) { throw "主题工具启动脚本返回了错误代码：$LASTEXITCODE" }
  }

  Write-Host ''
  Write-Host 'Codex 主题工具安装完成。' -ForegroundColor Cyan
  Write-Host "稳定安装目录：$runtimeRoot"
  Write-Host '入口：Codex 设置 → 主题'
} catch {
  if ($guardWasEnabled -and -not (Test-Path -LiteralPath $guardMarker)) {
    try {
      Write-DreamSkinUtf8FileAtomically -Path $guardMarker -Content "enabled`r`n"
      if ($null -ne $existingState -and $existingState.injectorPath) {
        $oldGuard = Join-Path (Split-Path -Parent "$($existingState.injectorPath)") 'guard-dream-skin.ps1'
        if (Test-Path -LiteralPath $oldGuard -PathType Leaf) {
          $powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
          Start-Process -FilePath $powershell -ArgumentList `
            "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$oldGuard`" -Port $Port" `
            -WindowStyle Hidden | Out-Null
        }
      }
    } catch {}
  }
  if ($codexWasRunning -and (Get-DreamSkinCodexProcesses -Codex $codex).Count -eq 0) {
    try { Start-Process -FilePath $codex.Executable | Out-Null } catch {}
  }
  throw
}
