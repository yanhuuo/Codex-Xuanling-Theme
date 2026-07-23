[CmdletBinding()]
param([int]$Port = 9335)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName Microsoft.VisualBasic
. (Join-Path $PSScriptRoot 'common-windows.ps1')
. (Join-Path $PSScriptRoot 'theme-windows.ps1')

Assert-DreamSkinPort -Port $Port
$SkillRoot = Split-Path -Parent $PSScriptRoot
$StateRoot = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
$paths = Initialize-DreamSkinThemeStore -SkillRoot $SkillRoot -StateRoot $StateRoot
$powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
$startScript = Join-Path $PSScriptRoot 'start-dream-skin.ps1'
$restoreScript = Join-Path $PSScriptRoot 'restore-dream-skin.ps1'
$guardLogPath = Join-Path $StateRoot 'guard.log'
$injectorLogPath = Join-Path $StateRoot 'injector.log'
$injectorErrorLogPath = Join-Path $StateRoot 'injector-error.log'

$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$mutex = [System.Threading.Mutex]::new($false, "Local\CodexDreamSkin.$sid.Tray")
$acquired = $false
try {
  try { $acquired = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $acquired = $true }
  if (-not $acquired) { exit 0 }

  $notify = [System.Windows.Forms.NotifyIcon]::new()
  $notify.Icon = [System.Drawing.SystemIcons]::Application
  $notify.Text = 'Codex Dream Skin'
  $notify.Visible = $true
  $menu = [System.Windows.Forms.ContextMenuStrip]::new()
  $notify.ContextMenuStrip = $menu

  function Show-DreamSkinTrayError {
    param([string]$Message)
    [void][System.Windows.Forms.MessageBox]::Show(
      $Message,
      'Codex Dream Skin',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    )
  }

  function Start-DreamSkinPowerShell {
    param([Parameter(Mandatory = $true)][string]$Script, [string[]]$Arguments = @())
    $scriptToken = ConvertTo-DreamSkinProcessArgument -Value $Script
    $argumentLine = '-NoProfile -ExecutionPolicy Bypass -File ' + $scriptToken
    if ($Arguments.Count -gt 0) { $argumentLine += ' ' + ($Arguments -join ' ') }
    Start-Process -FilePath $powershell -ArgumentList $argumentLine | Out-Null
  }

  function Add-DreamSkinTrayItem {
    param(
      [Parameter(Mandatory = $true)][System.Windows.Forms.ToolStripItemCollection]$Items,
      [Parameter(Mandatory = $true)][string]$Text,
      [AllowNull()][scriptblock]$Action,
      [bool]$Enabled = $true
    )
    $item = [System.Windows.Forms.ToolStripMenuItem]::new($Text)
    $item.Enabled = $Enabled
    if ($null -ne $Action) {
      $item.add_Click({
        try { & $Action } catch { Show-DreamSkinTrayError -Message $_.Exception.Message }
      }.GetNewClosure())
    }
    [void]$Items.Add($item)
    return $item
  }

  function Get-DreamSkinTrayLogLines {
    param(
      [Parameter(Mandatory = $true)][string]$Path,
      [ValidateRange(1, 20)][int]$Count = 5
    )
    try {
      if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return @() }
      return @(Get-Content -LiteralPath $Path -Encoding UTF8 -Tail $Count -ErrorAction Stop)
    } catch {
      return @("日志读取失败：$($_.Exception.Message)")
    }
  }

  function Get-DreamSkinTrayStatus {
    $paused = Test-DreamSkinPaused -StateRoot $StateRoot
    $state = $null
    try { $state = Read-DreamSkinState -Path $paths.State } catch {}
    $codex = $null
    $identity = $null
    try {
      $codex = Get-DreamSkinCodexInstall
      $identity = Get-DreamSkinVerifiedCdpIdentity -Port $Port -Codex $codex
    } catch {}
    $injectorHealthy = $false
    if ($null -ne $state -and $state.injectorPid) {
      try {
        $process = Get-Process -Id ([int]$state.injectorPid) -ErrorAction Stop
        $injectorHealthy = -not $process.HasExited
      } catch {}
    }
    $active = $null
    try { $active = Read-DreamSkinTheme -ThemeDirectory $paths.Active -SkipImageMetadata } catch {}
    $themeName = if ($null -ne $active -and $null -ne $active.Theme -and $active.Theme.name) { "$($active.Theme.name)" } else { '未选择主题' }
    $statusText = if ($paused) {
      '已暂停'
    } elseif ($null -eq $identity) {
      '等待 Codex 调试端口'
    } elseif ($injectorHealthy) {
      '注入器运行中'
    } elseif ($state) {
      '注入器需修复'
    } else {
      '未运行'
    }
    return [pscustomobject]@{
      Paused = $paused
      State = $state
      Codex = $codex
      Identity = $identity
      InjectorHealthy = $injectorHealthy
      ThemeName = $themeName
      StatusText = $statusText
    }
  }

  function Update-DreamSkinNotifyText {
    $snapshot = Get-DreamSkinTrayStatus
    $text = "Dream Skin：$($snapshot.StatusText)"
    if ($snapshot.ThemeName -and $snapshot.ThemeName -ne '未选择主题') {
      $text += " · $($snapshot.ThemeName)"
    }
    if ($text.Length -gt 63) { $text = $text.Substring(0, 60) + '...' }
    $notify.Text = $text
  }

  function Add-DreamSkinLogMenu {
    param(
      [Parameter(Mandatory = $true)][System.Windows.Forms.ToolStripItemCollection]$Items,
      [Parameter(Mandatory = $true)][string]$Title,
      [Parameter(Mandatory = $true)][string]$Path
    )
    $logMenu = [System.Windows.Forms.ToolStripMenuItem]::new($Title)
    $lines = @(Get-DreamSkinTrayLogLines -Path $Path -Count 6)
    if ($lines.Count -eq 0) {
      $empty = [System.Windows.Forms.ToolStripMenuItem]::new('暂无日志')
      $empty.Enabled = $false
      [void]$logMenu.DropDownItems.Add($empty)
    } else {
      foreach ($line in $lines) {
        $text = "$line"
        if ($text.Length -gt 96) { $text = $text.Substring(0, 93) + '...' }
        $item = [System.Windows.Forms.ToolStripMenuItem]::new($text)
        $item.Enabled = $false
        [void]$logMenu.DropDownItems.Add($item)
      }
    }
    [void]$Items.Add($logMenu)
  }

  function Rebuild-DreamSkinTrayMenu {
    $menu.Items.Clear()
    $snapshot = Get-DreamSkinTrayStatus
    $paused = $snapshot.Paused
    $state = $snapshot.State
    $status = "状态：$($snapshot.StatusText) · $($snapshot.ThemeName)"
    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text $status -Action $null -Enabled $false
    $portStatus = if ($null -ne $snapshot.Identity) { "端口：127.0.0.1:$Port 已连接" } else { "端口：127.0.0.1:$Port 未连接" }
    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text $portStatus -Action $null -Enabled $false
    $injectorStatus = if ($snapshot.InjectorHealthy) { "注入器：PID $($state.injectorPid)" } elseif ($state -and $state.injectorPid) { "注入器：PID $($state.injectorPid) 已失效" } else { '注入器：未记录' }
    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text $injectorStatus -Action $null -Enabled $false
    Add-DreamSkinLogMenu -Items $menu.Items -Title '最近 Guard 日志' -Path $guardLogPath
    Add-DreamSkinLogMenu -Items $menu.Items -Title '最近注入日志' -Path $injectorLogPath
    Add-DreamSkinLogMenu -Items $menu.Items -Title '最近错误日志' -Path $injectorErrorLogPath
    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text '打开日志文件夹' -Action {
      Start-Process -FilePath explorer.exe -ArgumentList @($StateRoot) | Out-Null
    }
    [void]$menu.Items.Add([System.Windows.Forms.ToolStripSeparator]::new())

    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text '应用或重新应用' -Action {
      Set-DreamSkinPaused -Paused $false -StateRoot $StateRoot | Out-Null
      Start-DreamSkinPowerShell -Script $startScript -Arguments @('-Port', "$Port", '-PromptRestart')
    }
    $pauseText = if ($paused) { '继续显示皮肤' } else { '暂停皮肤' }
    $nextPaused = -not $paused
    $pauseAction = {
      Set-DreamSkinPaused -Paused $nextPaused -StateRoot $StateRoot | Out-Null
    }.GetNewClosure()
    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text $pauseText -Action $pauseAction
    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text '更换背景图' -Action {
      $dialog = [System.Windows.Forms.OpenFileDialog]::new()
      $dialog.Title = '选择 Codex Dream Skin 背景图'
      $dialog.Filter = 'Image files|*.png;*.jpg;*.jpeg;*.webp;*.gif|All files|*.*'
      $dialog.Multiselect = $false
      try {
        if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
          $null = Set-DreamSkinActiveTheme -ImagePath $dialog.FileName -Theme $null -StateRoot $StateRoot
          Set-DreamSkinPaused -Paused $false -StateRoot $StateRoot | Out-Null
          $notify.ShowBalloonTip(1800, 'Codex Dream Skin', '背景图已更新。', [System.Windows.Forms.ToolTipIcon]::Info)
        }
      } finally {
        $dialog.Dispose()
      }
    }
    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text '保存当前主题' -Action {
      $name = [Microsoft.VisualBasic.Interaction]::InputBox('输入主题名称：', '保存 Codex Dream Skin 主题', '')
      if ($name.Trim()) {
        $saved = Save-DreamSkinCurrentTheme -Name $name -StateRoot $StateRoot
        $notify.ShowBalloonTip(1800, 'Codex Dream Skin', "已保存：$($saved.Theme.name)", [System.Windows.Forms.ToolTipIcon]::Info)
      }
    }

    $savedMenu = [System.Windows.Forms.ToolStripMenuItem]::new('已保存主题')
    $savedThemes = @(Get-DreamSkinSavedThemes -StateRoot $StateRoot -SkipImageMetadata)
    if ($savedThemes.Count -eq 0) {
      $empty = [System.Windows.Forms.ToolStripMenuItem]::new('暂无已保存主题')
      $empty.Enabled = $false
      [void]$savedMenu.DropDownItems.Add($empty)
    } else {
      foreach ($saved in $savedThemes) {
        $savedPath = $saved.Path
        $savedName = $saved.Name
        $savedAction = {
          $null = Use-DreamSkinSavedTheme -ThemeDirectory $savedPath -StateRoot $StateRoot
          Set-DreamSkinPaused -Paused $false -StateRoot $StateRoot | Out-Null
          $notify.ShowBalloonTip(1800, 'Codex Dream Skin', "已应用：$savedName", [System.Windows.Forms.ToolTipIcon]::Info)
        }.GetNewClosure()
        $null = Add-DreamSkinTrayItem -Items $savedMenu.DropDownItems -Text $savedName -Action $savedAction
      }
    }
    [void]$menu.Items.Add($savedMenu)

    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text '打开图片文件夹' -Action {
      Start-Process -FilePath explorer.exe -ArgumentList @($paths.Images) | Out-Null
    }
    [void]$menu.Items.Add([System.Windows.Forms.ToolStripSeparator]::new())
    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text '完全恢复 Codex' -Action {
      Start-DreamSkinPowerShell -Script $restoreScript -Arguments @(
        '-Port', "$Port", '-RestoreBaseTheme', '-PromptRestart'
      )
      $notify.Visible = $false
      [System.Windows.Forms.Application]::Exit()
    }
    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text '退出托盘' -Action {
      $notify.Visible = $false
      [System.Windows.Forms.Application]::Exit()
    }
  }

  $menu.add_Opening({ Rebuild-DreamSkinTrayMenu })
  $timer = [System.Windows.Forms.Timer]::new()
  $timer.Interval = 10000
  $timer.add_Tick({ try { Update-DreamSkinNotifyText } catch {} })
  $timer.Start()
  Update-DreamSkinNotifyText
  $notify.add_DoubleClick({
    try {
      Set-DreamSkinPaused -Paused $false -StateRoot $StateRoot | Out-Null
      Start-DreamSkinPowerShell -Script $startScript -Arguments @('-Port', "$Port", '-PromptRestart')
    } catch {
      Show-DreamSkinTrayError -Message $_.Exception.Message
    }
  })
  [System.Windows.Forms.Application]::Run()
} finally {
  if ($null -ne $timer) { $timer.Stop(); $timer.Dispose() }
  if ($null -ne $notify) { $notify.Dispose() }
  if ($acquired) { try { $mutex.ReleaseMutex() } catch {} }
  $mutex.Dispose()
}
