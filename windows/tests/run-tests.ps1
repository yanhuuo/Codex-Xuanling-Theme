[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
. (Join-Path $Root 'scripts\common-windows.ps1')
. (Join-Path $Root 'scripts\theme-windows.ps1')

$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) "codex-dream-skin-tests-$PID-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $temporaryRoot | Out-Null

try {
  $configPath = Join-Path $temporaryRoot 'config.toml'
  $backupPath = Join-Path $temporaryRoot 'config.before-dream-skin.toml'
  $projectName = -join @([char]0x4EE3, [char]0x7801, [char]0x9879, [char]0x76EE, [char]0x7532)
  $laterValue = -join @([char]0x4FDD, [char]0x7559)
  $sample = "model = `"gpt-5`"`r`n`r`n[other]`r`nappearanceTheme = `"keep-other`"`r`n`r`n[projects.'C:\$projectName']`r`ntrust_level = `"trusted`"`r`n`r`n[desktop]`r`nappearanceTheme = `"system`"`r`nappearanceLightCodeThemeId = `"theme-`$special`"`r`n"
  $utf8NoBom = [System.Text.UTF8Encoding]::new($false, $true)
  [System.IO.File]::WriteAllText($configPath, $sample, $utf8NoBom)
  $originalBytes = [System.IO.File]::ReadAllBytes($configPath)

  Install-DreamSkinBaseTheme -ConfigPath $configPath -BackupPath $backupPath
  $installed = Read-DreamSkinUtf8File -Path $configPath
  if (-not $installed.Contains($projectName) -or $installed -notmatch 'appearanceTheme = "system"' -or
    $installed -notmatch 'appearanceLightCodeThemeId = "github"') {
    throw 'Install changed a non-ASCII project name or failed to preserve the native appearance.'
  }
  if (-not (Test-Path -LiteralPath (Get-DreamSkinAppearanceMarkerPath -BackupPath $backupPath))) {
    throw 'Install did not record the appearance-preservation marker.'
  }
  $backupBytes = [System.IO.File]::ReadAllBytes($backupPath)
  if ([Convert]::ToBase64String($backupBytes) -cne [Convert]::ToBase64String($originalBytes)) {
    throw 'Install did not preserve an exact pre-change config backup.'
  }

  $written = [System.IO.File]::ReadAllBytes($configPath)
  if ($written.Length -ge 3 -and $written[0] -eq 0xEF -and $written[1] -eq 0xBB -and $written[2] -eq 0xBF) {
    throw 'Config writer added an unexpected UTF-8 BOM.'
  }

  $petConfigPath = Join-Path $temporaryRoot 'pet-selection.toml'
  [System.IO.File]::WriteAllText($petConfigPath, "model = `"gpt-5`"`r`n`r`n[desktop]`r`nappearanceTheme = `"system`"`r`n", $utf8NoBom)
  Set-DreamSkinSelectedPet -ConfigPath $petConfigPath -PetId 'iuno'
  Set-DreamSkinSelectedPet -ConfigPath $petConfigPath -PetId 'song-yu'
  $petConfig = Read-DreamSkinUtf8File -Path $petConfigPath
  if ($petConfig -notmatch 'selected-avatar-id = "custom:song-yu"' -or
    ([regex]::Matches($petConfig, '(?m)^selected-avatar-id\s*=')).Count -ne 1 -or
    $petConfig -notmatch 'appearanceTheme = "system"') {
    throw 'Theme pet selection did not update exactly one desktop key while preserving unrelated config.'
  }
  $nestedPetConfigPath = Join-Path $temporaryRoot 'nested-pet.toml'
  $nestedPetOriginal = "[desktop]`r`nselected-avatar-id = `"custom:old`"`r`n`r`n[desktop.appearanceLightChromeTheme]`r`naccent = `"#fff`"`r`n"
  [System.IO.File]::WriteAllText($nestedPetConfigPath, $nestedPetOriginal, $utf8NoBom)
  & (Join-Path $Root 'scripts\select-pet.ps1') -PetId 'nested-safe' -ConfigPath $nestedPetConfigPath
  $nestedPetConfig = Read-DreamSkinUtf8File -Path $nestedPetConfigPath
  if ($nestedPetConfig -notmatch 'selected-avatar-id = "custom:nested-safe"' -or
    $nestedPetConfig -notmatch '\[desktop\.appearanceLightChromeTheme\]' -or
    $nestedPetConfig -notmatch 'accent = "#fff"') {
    throw 'Theme pet selection did not preserve valid nested desktop appearance tables.'
  }
  $managerConfigPath = Join-Path $temporaryRoot 'manager-base.toml'
  $managerStateRoot = Join-Path $temporaryRoot 'manager-base-state'
  $managerOriginal = "model = `"gpt-5`"`r`n`r`n[desktop]`r`nappearanceTheme = `"system`"`r`n"
  [System.IO.File]::WriteAllText($managerConfigPath, $managerOriginal, $utf8NoBom)
  & (Join-Path $Root 'scripts\set-theme-base.ps1') -Mode enable -StateRoot $managerStateRoot -ConfigPath $managerConfigPath
  if ((Read-DreamSkinUtf8File -Path $managerConfigPath) -notmatch 'appearanceLightCodeThemeId = "github"') {
    throw 'Theme-page activation did not apply the managed base appearance.'
  }
  & (Join-Path $Root 'scripts\set-theme-base.ps1') -Mode disable -StateRoot $managerStateRoot -ConfigPath $managerConfigPath
  $managerRestored = Read-DreamSkinUtf8File -Path $managerConfigPath
  if ($managerRestored -notmatch 'appearanceTheme = "system"' -or
    $managerRestored -match 'appearanceLightCodeThemeId = "github"' -or
    $managerRestored -match 'appearanceLightChromeTheme') {
    throw 'Theme-page official restore did not recover the pre-theme base appearance.'
  }

  $installed += "afterInstall = `"$laterValue`"`r`n"
  $installed = $installed -replace 'appearanceTheme = "system"', 'appearanceTheme = "dark"'
  Write-DreamSkinUtf8FileAtomically -Path $configPath -Content $installed
  Restore-DreamSkinBaseTheme -ConfigPath $configPath -BackupPath $backupPath
  $restored = Read-DreamSkinUtf8File -Path $configPath
  if (-not $restored.Contains($projectName) -or -not $restored.Contains($laterValue)) {
    throw 'Restore changed a project name or unrelated post-install setting.'
  }
  if ($restored -notmatch 'appearanceTheme = "dark"' -or -not $restored.Contains('appearanceLightCodeThemeId = "theme-$special"')) {
    throw 'Restore overwrote the user appearance or failed to restore the light code theme.'
  }
  if ($restored -notmatch '(?ms)^\[other\].*?appearanceTheme = "keep-other"') {
    throw 'Restore changed an appearance key outside the desktop section.'
  }

  $legacyConfigPath = Join-Path $temporaryRoot 'legacy-light.toml'
  $legacyBackupPath = Join-Path $temporaryRoot 'legacy-light.before.toml'
  $legacyCurrent = "[desktop]`r`n$($script:DreamSkinLegacyAppearanceTheme)`r`n$($script:DreamSkinManagedLightCodeTheme)`r`n$($script:DreamSkinManagedLightChromeTheme)`r`n"
  $legacyOriginal = "[desktop]`r`nappearanceTheme = `"system`"`r`nappearanceLightCodeThemeId = `"theme-original`"`r`nappearanceLightChromeTheme = { surface = `"original`" }`r`n"
  [System.IO.File]::WriteAllText($legacyConfigPath, $legacyCurrent, $utf8NoBom)
  [System.IO.File]::WriteAllText($legacyBackupPath, $legacyOriginal, $utf8NoBom)
  Install-DreamSkinBaseTheme -ConfigPath $legacyConfigPath -BackupPath $legacyBackupPath
  $legacyMigrated = Read-DreamSkinUtf8File -Path $legacyConfigPath
  if ($legacyMigrated -notmatch 'appearanceTheme = "system"' -or
    $legacyMigrated -notmatch 'appearanceLightCodeThemeId = "github"') {
    throw 'Exact legacy managed light trio was not migrated to the saved native appearance.'
  }
  $legacyMigrated = $legacyMigrated -replace 'appearanceTheme = "system"', 'appearanceTheme = "dark"'
  Write-DreamSkinUtf8FileAtomically -Path $legacyConfigPath -Content $legacyMigrated
  Restore-DreamSkinBaseTheme -ConfigPath $legacyConfigPath -BackupPath $legacyBackupPath
  if ((Read-DreamSkinUtf8File -Path $legacyConfigPath) -notmatch 'appearanceTheme = "dark"') {
    throw 'A current install restore overwrote the user appearance after legacy migration.'
  }

  $lfConfigPath = Join-Path $temporaryRoot 'config-lf.toml'
  $lfBackupPath = Join-Path $temporaryRoot 'config-lf.before.toml'
  $lfOriginal = "model = `"gpt-5`"`n[projects.'C:\$projectName']`ntrust_level = `"trusted`"`n"
  [System.IO.File]::WriteAllText($lfConfigPath, $lfOriginal, $utf8NoBom)
  Install-DreamSkinBaseTheme -ConfigPath $lfConfigPath -BackupPath $lfBackupPath
  $lfInstalled = Read-DreamSkinUtf8File -Path $lfConfigPath
  if ($lfInstalled.Contains("`r") -or $lfInstalled -notmatch '(?m)^\[desktop\]$') {
    throw 'Install did not preserve LF line endings or create the desktop section.'
  }
  Restore-DreamSkinBaseTheme -ConfigPath $lfConfigPath -BackupPath $lfBackupPath
  $lfRestored = Read-DreamSkinUtf8File -Path $lfConfigPath
  if ($lfRestored.Contains("`r") -or $lfRestored -match '(?m)^\[desktop\]$' -or -not $lfRestored.Contains($projectName)) {
    throw 'Restore did not preserve LF content or remove the generated empty desktop section.'
  }

  $quotedConfigPath = Join-Path $temporaryRoot 'config-quoted.toml'
  $quotedBackupPath = Join-Path $temporaryRoot 'config-quoted.before.toml'
  $quotedOriginal = "[`"desktop`"] # retained comment`r`n`"appearanceTheme`" = `"system`"`r`n'appearanceLightCodeThemeId' = `"theme-`$special`"`r`n"
  [System.IO.File]::WriteAllText($quotedConfigPath, $quotedOriginal, $utf8NoBom)
  Install-DreamSkinBaseTheme -ConfigPath $quotedConfigPath -BackupPath $quotedBackupPath
  $quotedInstalled = Read-DreamSkinUtf8File -Path $quotedConfigPath
  if ([regex]::Matches($quotedInstalled, '(?m)^\s*\[(?:"desktop"|desktop)\]').Count -ne 1) {
    throw 'A commented or quoted desktop table was duplicated during install.'
  }
  Restore-DreamSkinBaseTheme -ConfigPath $quotedConfigPath -BackupPath $quotedBackupPath
  if ((Read-DreamSkinUtf8File -Path $quotedConfigPath) -cne $quotedOriginal) {
    throw 'Quoted desktop keys or a table-header comment were not restored exactly.'
  }

  $singleLineArrayPath = Join-Path $temporaryRoot 'config-single-line-array.toml'
  $singleLineArrayBackup = Join-Path $temporaryRoot 'config-single-line-array.before.toml'
  $singleLineArray = "labels = [`"name[1]`", `"#tag]`"]`r`n"
  [System.IO.File]::WriteAllText($singleLineArrayPath, $singleLineArray, $utf8NoBom)
  Install-DreamSkinBaseTheme -ConfigPath $singleLineArrayPath -BackupPath $singleLineArrayBackup
  if (-not (Read-DreamSkinUtf8File -Path $singleLineArrayPath).Contains($singleLineArray.TrimEnd())) {
    throw 'A safe single-line array containing bracket text was changed or rejected.'
  }

  foreach ($unsupported in @(
    'desktop.appearanceTheme = "system"',
    'desktop = { appearanceTheme = "system" }',
    '[[desktop]]',
    '[desktop.appearanceTheme]',
    '["desktop".layout]',
    '["desk\u0074op".layout]',
    '["desk\u0074op"]',
    "note = `"`"`"fake`r`n[desktop]`r`nappearanceTheme = `"dark`"`r`n`"`"`"",
    "[desktop]`r`nappearanceTheme = [`r`n  `"light`"`r`n]",
    "[desktop]`r`nlayout = [`r`n  [1, 2],`r`n  [3, 4],`r`n]`r`nappearanceTheme = `"dark`"",
    "[desktop]`r`nlayout = [`"]`",`r`n  [`"[`", `"]`"],`r`n]`r`nappearanceTheme = `"dark`""
  )) {
    $unsupportedPath = Join-Path $temporaryRoot ("unsupported-$([guid]::NewGuid().ToString('N')).toml")
    $unsupportedBackup = "$unsupportedPath.before"
    [System.IO.File]::WriteAllText($unsupportedPath, $unsupported, $utf8NoBom)
    $unsupportedRejected = $false
    try { Install-DreamSkinBaseTheme -ConfigPath $unsupportedPath -BackupPath $unsupportedBackup } catch { $unsupportedRejected = $true }
    if (-not $unsupportedRejected -or (Test-Path -LiteralPath $unsupportedBackup)) {
      throw "Unsupported TOML desktop representation was not rejected safely: $unsupported"
    }
  }

  $recoveryPath = Join-Path $temporaryRoot 'config.before-recovery.toml'
  Write-DreamSkinUtf8FileAtomically -Path $configPath -Content 'intentionally changed'
  Restore-DreamSkinConfigBackup -ConfigPath $configPath -BackupPath $backupPath -RecoveryBackupPath $recoveryPath
  $recoveredBytes = [System.IO.File]::ReadAllBytes($configPath)
  if ([Convert]::ToBase64String($recoveredBytes) -cne [Convert]::ToBase64String($originalBytes)) {
    throw 'Exact config recovery did not restore the original bytes.'
  }
  if ((Read-DreamSkinUtf8File -Path $recoveryPath) -cne 'intentionally changed') {
    throw 'Exact config recovery did not preserve the replaced current config.'
  }
  $archivePath = Join-Path $temporaryRoot 'config.restored.toml'
  Archive-DreamSkinConfigBackup -BackupPath $backupPath -ArchivePath $archivePath
  if ((Test-Path -LiteralPath $backupPath) -or -not (Test-Path -LiteralPath $archivePath)) {
    throw 'Completed config backup was not archived for a safe future reinstall.'
  }
  $secondBaseline = "[desktop]`r`nappearanceTheme = `"dark`"`r`n"
  [System.IO.File]::WriteAllText($configPath, $secondBaseline, $utf8NoBom)
  $secondBaselineBytes = [System.IO.File]::ReadAllBytes($configPath)
  Install-DreamSkinBaseTheme -ConfigPath $configPath -BackupPath $backupPath
  if (-not (Test-DreamSkinBytesEqual -Left $secondBaselineBytes -Right ([System.IO.File]::ReadAllBytes($backupPath)))) {
    throw 'Reinstall did not capture a fresh config baseline after completed restore.'
  }

  $invalidPath = Join-Path $temporaryRoot 'invalid.toml'
  $invalidBackupPath = Join-Path $temporaryRoot 'invalid.before.toml'
  [System.IO.File]::WriteAllBytes($invalidPath, [byte[]](0x66, 0x6f, 0x80))
  $rejected = $false
  try { Install-DreamSkinBaseTheme -ConfigPath $invalidPath -BackupPath $invalidBackupPath } catch { $rejected = $true }
  if (-not $rejected -or (Test-Path -LiteralPath $invalidBackupPath)) {
    throw 'Invalid UTF-8 input was not rejected before backup creation.'
  }
  $utf16Path = Join-Path $temporaryRoot 'utf16.toml'
  $utf16BackupPath = Join-Path $temporaryRoot 'utf16.before.toml'
  [System.IO.File]::WriteAllText($utf16Path, 'model = "gpt-5"', [System.Text.Encoding]::Unicode)
  $utf16Rejected = $false
  try { Install-DreamSkinBaseTheme -ConfigPath $utf16Path -BackupPath $utf16BackupPath } catch { $utf16Rejected = $true }
  if (-not $utf16Rejected -or (Test-Path -LiteralPath $utf16BackupPath)) {
    throw 'A UTF-16 config was silently transcoded instead of being rejected.'
  }
  $utf16NoBomPath = Join-Path $temporaryRoot 'utf16-no-bom.toml'
  $utf16NoBomBackupPath = Join-Path $temporaryRoot 'utf16-no-bom.before.toml'
  [System.IO.File]::WriteAllBytes($utf16NoBomPath, [System.Text.Encoding]::Unicode.GetBytes('model = "gpt-5"'))
  $utf16NoBomRejected = $false
  try { Install-DreamSkinBaseTheme -ConfigPath $utf16NoBomPath -BackupPath $utf16NoBomBackupPath } catch { $utf16NoBomRejected = $true }
  if (-not $utf16NoBomRejected -or (Test-Path -LiteralPath $utf16NoBomBackupPath)) {
    throw 'A BOM-less UTF-16 config was silently treated as UTF-8 instead of being rejected.'
  }
  $racePath = Join-Path $temporaryRoot 'race.toml'
  [System.IO.File]::WriteAllText($racePath, 'before', $utf8NoBom)
  $raceExpected = [System.IO.File]::ReadAllBytes($racePath)
  [System.IO.File]::WriteAllText($racePath, 'after', $utf8NoBom)
  $raceRejected = $false
  try { Assert-DreamSkinFileUnchanged -Path $racePath -ExpectedBytes $raceExpected } catch { $raceRejected = $true }
  if (-not $raceRejected) { throw 'Concurrent config modification was not detected.' }
  $conditionalWriteRejected = $false
  try {
    Write-DreamSkinUtf8FileAtomically -Path $racePath -Content 'replacement' -ExpectedBytes $raceExpected
  } catch {
    $conditionalWriteRejected = $true
  }
  if (-not $conditionalWriteRejected -or (Read-DreamSkinUtf8File -Path $racePath) -cne 'after') {
    throw 'Conditional atomic write replaced newer config content.'
  }

  if (-not (Test-DreamSkinWebSocketUrl -Value 'ws://127.0.0.1:9335/devtools/page/test' -Port 9335)) {
    throw 'PowerShell loopback WebSocket validation rejected a safe target.'
  }
  foreach ($unsafe in @(
    'ws://example.com:9335/devtools/page/test',
    'ws://127.0.0.1:9336/devtools/page/test',
    'wss://127.0.0.1:9335/devtools/page/test',
    'ws://user@127.0.0.1:9335/devtools/page/test',
    'ws://127.0.0.1:9335/unexpected/test',
    'ws://127.0.0.1:9335/devtools/page/test?query=1'
  )) {
    if (Test-DreamSkinWebSocketUrl -Value $unsafe -Port 9335) { throw "Accepted unsafe CDP target: $unsafe" }
  }
  $safePageTarget = [pscustomobject]@{
    id = 'page-123'
    type = 'page'
    url = 'app://codex/'
    webSocketDebuggerUrl = 'ws://127.0.0.1:9335/devtools/page/page-123'
  }
  if (-not (Test-DreamSkinCdpPageTarget -Target $safePageTarget -Port 9335)) {
    throw 'A valid same-ID CDP page target was rejected.'
  }
  foreach ($unsafePageTarget in @(
    [pscustomobject]@{ id = 'page-123'; type = 'page'; url = 'app://codex/'; webSocketDebuggerUrl = 'ws://127.0.0.1:9335/devtools/browser/page-123' },
    [pscustomobject]@{ id = 'other-page'; type = 'page'; url = 'app://codex/'; webSocketDebuggerUrl = 'ws://127.0.0.1:9335/devtools/page/page-123' },
    [pscustomobject]@{ id = 123; type = 'page'; url = 'app://codex/'; webSocketDebuggerUrl = 'ws://127.0.0.1:9335/devtools/page/123' },
    [pscustomobject]@{ id = 'page-123'; type = 'other'; url = 'app://codex/'; webSocketDebuggerUrl = 'ws://127.0.0.1:9335/devtools/page/page-123' }
  )) {
    if (Test-DreamSkinCdpPageTarget -Target $unsafePageTarget -Port 9335) {
      throw 'Accepted an inconsistent CDP page target.'
    }
  }
  $watchCommand = '"C:\Program Files\nodejs\node.exe" "C:\Dream Skin\injector.mjs" --watch --port 9335 --browser-id browser-123'
  if (-not (Test-DreamSkinCommandLineToken -CommandLine $watchCommand -Token 'C:\Dream Skin\injector.mjs') -or
    (Test-DreamSkinCommandLineToken -CommandLine $watchCommand -Token 'Dream Skin\injector.mjs')) {
    throw 'Injector command-line token validation is not boundary-safe.'
  }
  if (-not (Test-DreamSkinBrowserId -Value 'browser-123') -or
    (Test-DreamSkinBrowserId -Value 'browser 123')) {
    throw 'CDP browser ID validation is not boundary-safe.'
  }
  $quotedProfile = ConvertTo-DreamSkinProcessArgument -Value '--user-data-dir=C:\Dream Skin\Profile\'
  if ($quotedProfile -cne '"--user-data-dir=C:\Dream Skin\Profile\\"') {
    throw 'Process argument quoting did not protect spaces and a trailing backslash.'
  }

  $statePath = Join-Path $temporaryRoot 'state.json'
  $state = [pscustomobject]@{
    schemaVersion = 3
    platform = 'windows'
    port = 9335
    injectorPid = 1234
    injectorStartedAt = '2026-01-01T00:00:00.0000000Z'
    injectorPath = 'C:\Dream Skin\injector.mjs'
    nodePath = 'C:\Program Files\nodejs\node.exe'
    codexExe = 'C:\Program Files\WindowsApps\OpenAI.Codex\app\ChatGPT.exe'
    codexPackageRoot = 'C:\Program Files\WindowsApps\OpenAI.Codex'
    codexPackageFullName = 'OpenAI.Codex_1.2.3.4_x64__test'
    codexPackageFamilyName = 'OpenAI.Codex_test'
    browserId = 'browser-123'
  }
  Write-DreamSkinState -Path $statePath -State $state
  $loadedState = Read-DreamSkinState -Path $statePath
  if ($loadedState.schemaVersion -ne 3 -or $loadedState.port -ne 9335 -or
    $loadedState.browserId -cne 'browser-123') { throw 'State round-trip failed.' }
  $missingIdentityState = [pscustomobject]@{ schemaVersion = 3; platform = 'windows'; port = 9335 }
  Write-DreamSkinState -Path $statePath -State $missingIdentityState
  $missingIdentityRejected = $false
  try { $null = Read-DreamSkinState -Path $statePath } catch { $missingIdentityRejected = $true }
  if (-not $missingIdentityRejected) { throw 'Schema 3 accepted a state missing process and package identity.' }
  $legacyState = [pscustomobject]@{ schemaVersion = 2; platform = 'windows'; port = 9335; injectorPid = 1234 }
  Write-DreamSkinState -Path $statePath -State $legacyState
  if ((Read-DreamSkinState -Path $statePath).schemaVersion -ne 2) {
    throw 'A supported schema 2 state was rejected.'
  }

  $fakePackageRoot = Join-Path $temporaryRoot 'OpenAI.Codex_1.2.3.4_x64__test'
  $fakeExecutable = Join-Path $fakePackageRoot 'app\ChatGPT.exe'
  New-Item -ItemType Directory -Path (Split-Path -Parent $fakeExecutable) -Force | Out-Null
  [System.IO.File]::WriteAllBytes($fakeExecutable, [byte[]]@())
  $fakePackage = [pscustomobject]@{
    Name = 'OpenAI.Codex'
    InstallLocation = $fakePackageRoot
    PackageFullName = 'OpenAI.Codex_1.2.3.4_x64__test'
    PackageFamilyName = 'OpenAI.Codex_test'
    SignatureKind = 'Store'
    IsDevelopmentMode = $false
    Version = [version]'1.2.3.4'
  }
  $fakeInstall = ConvertTo-DreamSkinCodexInstall -Package $fakePackage
  if ($null -eq $fakeInstall -or $fakeInstall.PackageFullName -cne $fakePackage.PackageFullName -or
    -not (Test-DreamSkinPathEqual -Left $fakeInstall.Executable -Right $fakeExecutable)) {
    throw 'Registered Appx package identity conversion failed.'
  }
  $fakePackage.SignatureKind = 'Developer'
  if ($null -ne (ConvertTo-DreamSkinCodexInstall -Package $fakePackage)) {
    throw 'A non-Store Appx package was accepted as official Codex.'
  }
  $fakePackage.SignatureKind = 'Store'
  $pathOnlyState = [pscustomobject]@{
    codexExe = $fakeExecutable
    codexPackageRoot = $fakePackageRoot
    codexVersion = '1.2.3.4'
  }
  if ($null -eq (Get-DreamSkinCodexStatePathCandidate -State $pathOnlyState)) {
    throw 'A structurally valid legacy Codex path was not recognized for read-only activity checks.'
  }
  if ($null -eq (Resolve-DreamSkinCodexInstallFromState -State $pathOnlyState `
    -RegisteredInstalls @($fakeInstall))) {
    throw 'A legacy state path was not revalidated against a registered Store package.'
  }
  $verifiedPackageState = [pscustomobject]@{
    codexExe = $fakeExecutable
    codexPackageRoot = $fakePackageRoot
    codexVersion = '1.2.3.4'
    codexPackageFullName = $fakePackage.PackageFullName
    codexPackageFamilyName = $fakePackage.PackageFamilyName
  }
  $resolvedInstall = Resolve-DreamSkinCodexInstallFromState -State $verifiedPackageState `
    -RegisteredInstalls @($fakeInstall)
  if ($null -eq $resolvedInstall -or -not $resolvedInstall.RegisteredPackageVerified) {
    throw 'State package identity did not resolve against the registered Appx package.'
  }
  $verifiedPackageState.codexPackageFamilyName = 'OpenAI.Codex_wrong'
  if ($null -ne (Resolve-DreamSkinCodexInstallFromState -State $verifiedPackageState `
    -RegisteredInstalls @($fakeInstall))) {
    throw 'A mismatched Appx package family was accepted from state.'
  }
  Write-DreamSkinUtf8FileAtomically -Path $statePath -Content '[]'
  $badStateRejected = $false
  try { $null = Read-DreamSkinState -Path $statePath } catch { $badStateRejected = $true }
  if (-not $badStateRejected) { throw 'A non-object state file was accepted.' }
  $staleStatePath = Archive-DreamSkinStateFile -Path $statePath
  if ((Test-Path -LiteralPath $statePath) -or -not (Test-Path -LiteralPath $staleStatePath)) {
    throw 'Stale state was not preserved under an archive name.'
  }

  $themeStateRoot = Join-Path $temporaryRoot 'theme-state'
  $bundledTheme = Join-Path $Root 'themes\鸣潮 秧秧·玄翎'
  $themePaths = Initialize-DreamSkinThemeStore -SkillRoot $Root -StateRoot $themeStateRoot
  $initialTheme = Read-DreamSkinTheme -ThemeDirectory $themePaths.Active
  if ($initialTheme.Theme.id -cne 'yangyang-xuanling-azure-plume' -or
    $initialTheme.Theme.name -cne '秧秧·玄翎｜苍羽夜' -or
    [int]$initialTheme.Theme.schemaVersion -ne 4 -or
    -not (Test-Path -LiteralPath $initialTheme.CssPath) -or
    -not (Test-Path -LiteralPath $initialTheme.RendererPath) -or
    @($initialTheme.Theme.icons.PSObject.Properties).Count -lt 1 -or
    (Test-Path -LiteralPath (Join-Path $themePaths.Active 'install.json')) -or
    (Test-Path -LiteralPath (Join-Path $themePaths.Active 'icons.json')) -or
    $initialTheme.Theme.appearance -cne 'dark' -or
    $initialTheme.Theme.art.safeArea -cne 'left' -or
    $initialTheme.Theme.art.taskMode -cne 'ambient' -or
    [System.IO.Path]::GetExtension($initialTheme.ImagePath) -cne '.jpg') {
    throw 'Default Windows theme did not seed the Yangyang Xuanling wallpaper contract.'
  }
  $preseededThemes = @(Get-DreamSkinSavedThemes -StateRoot $themeStateRoot)
  if ($preseededThemes.Count -ne 1 -or
    $preseededThemes[0].Id -cne 'yangyang-xuanling-azure-plume' -or
    $preseededThemes[0].Name -cne '秧秧·玄翎｜苍羽夜') {
    throw 'Yangyang Xuanling was not preseeded in the Windows saved-theme menu.'
  }
  $managerOnlyStateRoot = Join-Path $temporaryRoot 'manager-only-state'
  $managerOnlyPaths = Initialize-DreamSkinThemeStore -SkillRoot $Root -StateRoot $managerOnlyStateRoot -ManagerOnly
  if (-not (Test-Path -LiteralPath (Join-Path $managerOnlyPaths.Active 'theme.json') -PathType Leaf) -or
    @(Get-DreamSkinSavedThemes -StateRoot $managerOnlyStateRoot).Count -ne 0) {
    throw 'Manager-only installation exposed a bundled theme as already installed.'
  }
  $updatedTheme = Set-DreamSkinActiveTheme -ImagePath (Join-Path $bundledTheme 'background.jpg') `
    -Theme $null -Name '测试主题' -StateRoot $themeStateRoot
  if ($updatedTheme.Theme.name -cne '测试主题' -or
    $updatedTheme.Theme.id -cne 'custom' -or
    $updatedTheme.Theme.art.safeArea -cne 'auto' -or
    $updatedTheme.Theme.art.taskMode -cne 'auto' -or
    -not (Test-DreamSkinThemePathWithin -Path $updatedTheme.ImagePath -Root $themePaths.Active)) {
    throw 'Imported image did not reset to the generic adaptive contract inside the managed directory.'
  }
  $null = Initialize-DreamSkinThemeStore -SkillRoot $Root -StateRoot $themeStateRoot
  $idempotentTheme = Read-DreamSkinTheme -ThemeDirectory $themePaths.Active
  if ($idempotentTheme.Theme.id -cne 'custom' -or
    @(Get-DreamSkinSavedThemes -StateRoot $themeStateRoot).Count -ne 1) {
    throw 'Theme-store initialization overwrote the active custom theme or duplicated its bundled preset.'
  }
  $officialUpgradeStateRoot = Join-Path $temporaryRoot 'official-upgrade-state'
  $officialUpgradePaths = Initialize-DreamSkinThemeStore -SkillRoot $Root -StateRoot $officialUpgradeStateRoot
  $officialThemePath = Join-Path $officialUpgradePaths.Active 'theme.json'
  $staleOfficialTheme = (Read-DreamSkinUtf8File -Path $officialThemePath) | ConvertFrom-Json -ErrorAction Stop
  $staleOfficialTheme.PSObject.Properties.Remove('icons')
  $staleOfficialTheme | Add-Member -NotePropertyName brandIcon -NotePropertyValue '' -Force
  Write-DreamSkinTheme -ThemeDirectory $officialUpgradePaths.Active -Theme $staleOfficialTheme
  $null = Initialize-DreamSkinThemeStore -SkillRoot $Root -StateRoot $officialUpgradeStateRoot
  $upgradedOfficialTheme = Read-DreamSkinTheme -ThemeDirectory $officialUpgradePaths.Active
  if ($upgradedOfficialTheme.Theme.brandIcon -cne 'bird' -or
    @($upgradedOfficialTheme.Theme.icons.PSObject.Properties).Count -lt 1) {
    throw 'Bundled theme framework upgrade did not restore official icon metadata.'
  }
  $savedTheme = Save-DreamSkinCurrentTheme -Name '已保存主题' -StateRoot $themeStateRoot
  if ($savedTheme.Theme.name -cne '已保存主题' -or @(Get-DreamSkinSavedThemes -StateRoot $themeStateRoot).Count -ne 2) {
    throw 'Saved theme creation or discovery failed.'
  }
  $bundleMarker = "/* independent-bundle-$([guid]::NewGuid().ToString('N')) */"
  [System.IO.File]::AppendAllText($savedTheme.CssPath, $bundleMarker, $utf8NoBom)
  $null = Use-DreamSkinSavedTheme -ThemeDirectory $savedTheme.Directory -StateRoot $themeStateRoot
  $switchedBundle = Read-DreamSkinTheme -ThemeDirectory $themePaths.Active
  if (-not (Read-DreamSkinUtf8File -Path $switchedBundle.CssPath).Contains($bundleMarker) -or
    [System.IO.Path]::GetFileName($switchedBundle.RendererPath) -cne 'theme.js') {
    throw 'Theme switching copied only metadata/image instead of the complete theme code bundle.'
  }

  $outsideTheme = Join-Path $temporaryRoot 'outside-theme'
  New-Item -ItemType Directory -Path $outsideTheme | Out-Null
  Copy-Item -LiteralPath (Join-Path $bundledTheme 'background.jpg') `
    -Destination (Join-Path $outsideTheme 'background.jpg')
  Copy-Item -LiteralPath (Join-Path $bundledTheme 'theme.json') `
    -Destination (Join-Path $outsideTheme 'theme.json')
  $junctionTheme = Join-Path $themePaths.Saved 'junction-escape'
  $null = New-Item -ItemType Junction -Path $junctionTheme -Target $outsideTheme
  $junctionRejected = $false
  try {
    $null = Use-DreamSkinSavedTheme -ThemeDirectory $junctionTheme -StateRoot $themeStateRoot
  } catch { $junctionRejected = $true }
  if (-not $junctionRejected) { throw 'Saved-theme junction escaped the managed theme directory.' }
  [System.IO.Directory]::Delete($junctionTheme)

  Set-DreamSkinPaused -Paused $true -StateRoot $themeStateRoot | Out-Null
  if (-not (Test-DreamSkinPaused -StateRoot $themeStateRoot)) { throw 'Pause marker was not created.' }
  Set-DreamSkinPaused -Paused $false -StateRoot $themeStateRoot | Out-Null
  if (Test-DreamSkinPaused -StateRoot $themeStateRoot) { throw 'Pause marker was not removed.' }

  $oversizedTheme = Join-Path $temporaryRoot 'oversized-theme'
  New-Item -ItemType Directory -Path $oversizedTheme | Out-Null
  $oversizedImage = Join-Path $oversizedTheme 'oversized.jpg'
  $oversizedStream = [System.IO.File]::Open($oversizedImage, [System.IO.FileMode]::CreateNew)
  try { $oversizedStream.SetLength((16 * 1024 * 1024) + 1) } finally { $oversizedStream.Dispose() }
  Write-DreamSkinUtf8FileAtomically -Path (Join-Path $oversizedTheme 'theme.json') `
    -Content "{`"image`":`"oversized.jpg`"}`r`n"
  $oversizedReadRejected = $false
  try { $null = Read-DreamSkinTheme -ThemeDirectory $oversizedTheme } catch { $oversizedReadRejected = $true }
  $oversizedSetRejected = $false
  try {
    $null = Set-DreamSkinActiveTheme -ImagePath $oversizedImage -Theme $null -StateRoot $themeStateRoot
  } catch { $oversizedSetRejected = $true }
  if (-not $oversizedReadRejected -or -not $oversizedSetRejected) {
    throw 'The 16 MB image limit was not enforced before theme copy or payload construction.'
  }

  $oversizedDimensionImage = Join-Path $temporaryRoot 'oversized-dimension.png'
  $pngHeader = New-Object byte[] 24
  [byte[]](0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) | ForEach-Object -Begin { $i = 0 } -Process { $pngHeader[$i++] = $_ }
  $pngHeader[8] = 0; $pngHeader[9] = 0; $pngHeader[10] = 0; $pngHeader[11] = 13
  [byte[]](0x49, 0x48, 0x44, 0x52) | ForEach-Object -Begin { $i = 12 } -Process { $pngHeader[$i++] = $_ }
  $pngHeader[16] = 0; $pngHeader[17] = 0; $pngHeader[18] = 0x27; $pngHeader[19] = 0x10
  $pngHeader[20] = 0; $pngHeader[21] = 0; $pngHeader[22] = 0x17; $pngHeader[23] = 0x70
  [System.IO.File]::WriteAllBytes($oversizedDimensionImage, $pngHeader)
  $oversizedDimensionRejected = $false
  try { $null = Set-DreamSkinActiveTheme -ImagePath $oversizedDimensionImage -Theme $null -StateRoot $themeStateRoot } catch { $oversizedDimensionRejected = $true }
  if (-not $oversizedDimensionRejected) { throw 'A 16384px/50MP-invalid import was copied into the active theme.' }

  $reparseStateRoot = Join-Path $temporaryRoot 'reparse-state'
  New-Item -ItemType Directory -Path $reparseStateRoot | Out-Null
  $outsideActive = Join-Path $temporaryRoot 'outside-active'
  New-Item -ItemType Directory -Path $outsideActive | Out-Null
  $reparseActive = Join-Path $reparseStateRoot 'active-theme'
  $null = New-Item -ItemType Junction -Path $reparseActive -Target $outsideActive
  $reparseInitRejected = $false
  try { $null = Initialize-DreamSkinThemeStore -SkillRoot $Root -StateRoot $reparseStateRoot } catch { $reparseInitRejected = $true }
  if (-not $reparseInitRejected) { throw 'Theme-store initialization followed an active-theme junction.' }
  [System.IO.Directory]::Delete($reparseActive)

  $bundledThemeDirectories = @(Get-ChildItem -LiteralPath (Join-Path $Root 'themes') -Directory)
  $sharedRendererPath = Join-Path $Root 'engine\theme-runtime.js'
  $sharedCssPath = Join-Path $Root 'engine\theme-base.css'
  $themeRenderer = Read-DreamSkinUtf8File -Path $sharedRendererPath
  $defaultPackageCount = 0
  foreach ($themeDirectory in $bundledThemeDirectories) {
    $themePath = Join-Path $themeDirectory.FullName 'theme.json'
    if (-not (Test-Path -LiteralPath $themePath -PathType Leaf) -or
      (Test-Path -LiteralPath (Join-Path $themeDirectory.FullName 'install.json')) -or
      (Test-Path -LiteralPath (Join-Path $themeDirectory.FullName 'icons.json'))) {
      throw "Bundled theme package must use a single theme.json manifest: $($themeDirectory.Name)"
    }
    $manifest = (Read-DreamSkinUtf8File -Path $themePath) | ConvertFrom-Json
    if ($manifest.install.default) { $defaultPackageCount += 1 }
    if ([int]$manifest.schemaVersion -ne 4 -or $manifest.entrypoints.icons -or
      "$($manifest.framework.id)" -cne 'dream-skin' -or [int]$manifest.framework.version -ne 1 -or
      $manifest.entrypoints.renderer -or @($manifest.install.files) -contains 'theme.js' -or
      @($manifest.icons.PSObject.Properties).Count -lt 1 -or
      -not $themeRenderer.Contains('__DREAM_ICONS_JSON__') -or
      $themeRenderer -match ':\s*(?:xuanSvg|remielSvg)\s*\(') {
      throw "Bundled theme did not use the shared framework and inline icon configuration: $($themeDirectory.Name)"
    }
  }
  if ($defaultPackageCount -ne 1) { throw 'Bundled theme packages must declare exactly one default theme in theme.json.' }
  if (Test-Path -LiteralPath (Join-Path $Root 'pets')) {
    throw 'Repository pet packages must live at the project root, not under windows/.'
  }

  $css = Read-DreamSkinUtf8File -Path $sharedCssPath
  foreach ($requiredCss in @(
    'background-image: var(--dream-art)',
    'main.main-surface > header.app-header-tint',
    '.app-shell-main-content-top-fade',
    '.thread-scroll-container .bg-gradient-to-t.from-token-main-surface-primary',
    '--dream-immersive-composer',
    '--dream-art-fit: cover',
    'background-size: var(--dream-art-fit)',
    'background-position: var(--dream-art-position)',
    '.dream-home > .dream-home-content',
    '--dream-home-copy-shadow',
    '.group\/home-suggestion-list-item',
    '.dream-home-utility',
    '.dream-home-utility button:enabled:hover',
    '.dream-home-utility-present .dream-home .composer-surface-chrome',
    '.dream-route-task:is(.dream-task-ambient, .dream-task-banner)',
    '.composer-surface-chrome .dream-theme-icon',
    'html.codex-dream-skin.dream-route-settings body',
    'div.main-surface',
    'position: fixed !important',
    '.dream-permission-menu .dream-permission-item .dream-theme-icon-brand',
    'html.codex-dream-skin.dream-window-dragging *',
    'animation-play-state: paused !important'
  )) {
    if (-not $css.Contains($requiredCss)) { throw "Windows immersive CSS is missing: $requiredCss" }
  }
  if ($css -notmatch '(?s)\.dream-home-utility\s*\{[^}]*box-shadow:\s*none\s*!important' -or
    $css -notmatch '(?s)\.dream-home-utility-present[^}]*composer-surface-chrome\s*\{[^}]*border-radius:\s*18px\s*!important') {
    throw 'The shared home utility still creates an opaque shadow seam or removes the composer top corners.'
  }

  $remielCss = Read-DreamSkinUtf8File -Path (Join-Path $Root 'themes\绝区零 蕾米埃尔\theme.css')
  if (-not $remielCss.Contains('--dream-art-fit: cover')) {
    throw 'Remiel must fill the Codex viewport without aspect-ratio gutters.'
  }
  if ($css.Contains('.dream-home > div:first-child')) {
    throw 'Shared home layout still depends on the first child and can hide the composer after a Codex DOM upgrade.'
  }
  if ($css.Contains(':has(main.main-surface')) {
    throw 'Window-wide route styling still uses a costly relational selector instead of renderer route classes.'
  }
  if ($css.Contains('body:has(')) {
    throw 'Settings route styling should use renderer route classes instead of body:has().'
  }
  $traySource = Read-DreamSkinUtf8File -Path (Join-Path $Root 'scripts\tray-dream-skin.ps1')
  foreach ($requiredTrayAction in @('System.Windows.Forms.NotifyIcon', '暂停皮肤', '更换背景图', '已保存主题', '完全恢复 Codex')) {
    if (-not $traySource.Contains($requiredTrayAction)) { throw "Tray action is missing: $requiredTrayAction" }
  }
  if (-not $traySource.Contains('$nextPaused') -or -not $traySource.Contains('[System.Windows.Forms.Application]::Exit()')) {
    throw 'Tray pause/restore closures do not terminate cleanly.'
  }
  if (-not $traySource.Contains('Read-DreamSkinTheme -ThemeDirectory $paths.Active -SkipImageMetadata') -or
    -not $traySource.Contains('Get-DreamSkinSavedThemes -StateRoot $StateRoot -SkipImageMetadata')) {
    throw 'Tray menu metadata enumeration still performs full image parsing on every open.'
  }
  $restoreSource = Read-DreamSkinUtf8File -Path (Join-Path $Root 'scripts\restore-dream-skin.ps1')
  if (-not $restoreSource.Contains('Stop-DreamSkinTrayProcess')) {
    throw 'Complete restore does not stop a separately launched tray process.'
  }
  $startSource = Read-DreamSkinUtf8File -Path (Join-Path $Root 'scripts\start-dream-skin.ps1')
  $stateReadIndex = $startSource.IndexOf('$previousState = Read-DreamSkinState', [System.StringComparison]::Ordinal)
  $restartPromptIndex = $startSource.IndexOf('$restartAuthorized = Confirm-DreamSkinRestart', [System.StringComparison]::Ordinal)
  $recordedStopIndex = $startSource.IndexOf('$recordedInjectorStopped = Stop-DreamSkinRecordedInjector', [System.StringComparison]::Ordinal)
  $cancelIndex = $startSource.IndexOf("Write-Host 'Dream Skin launch was cancelled", [System.StringComparison]::Ordinal)
  $pauseClearIndex = $startSource.IndexOf('Set-DreamSkinPaused -Paused $false', [System.StringComparison]::Ordinal)
  if ($stateReadIndex -lt 0 -or $pauseClearIndex -le $stateReadIndex -or
    ($restartPromptIndex -ge 0 -and $pauseClearIndex -le $restartPromptIndex) -or
    ($recordedStopIndex -ge 0 -and $pauseClearIndex -le $recordedStopIndex) -or
    ($cancelIndex -ge 0 -and $cancelIndex -ge $pauseClearIndex)) {
    throw 'Start clears the pause marker before state validation or restart consent, or before its cancellation branch.'
  }
  if (-not $startSource.Contains('$pauseWasSet = Test-DreamSkinPaused') -or
    -not $startSource.Contains('$pauseCleared = $true') -or
    -not $startSource.Contains('Set-DreamSkinPaused -Paused $true -StateRoot $StateRoot')) {
    throw 'Start does not preserve an existing pause marker when startup rolls back.'
  }

  $rendererSource = Read-DreamSkinUtf8File -Path $sharedRendererPath
  foreach ($requiredRendererBehavior in @('dream-home-utility', 'artMetadata', 'detectShellAppearance')) {
    if (-not $rendererSource.Contains($requiredRendererBehavior)) {
      throw "Renderer adaptive behavior is missing: $requiredRendererBehavior"
    }
  }
  $injectorSource = Read-DreamSkinUtf8File -Path (Join-Path $Root 'scripts\injector.mjs')
  $themePackageSource = Read-DreamSkinUtf8File -Path (Join-Path $Root 'scripts\theme-package.mjs')
  foreach ($requiredInjectorBehavior in @(
    'createHash', 'STRONG_THEME_AUDIT_MS',
    'Page.addScriptToEvaluateOnNewDocument', 'Page.removeScriptToEvaluateOnNewDocument', 'earlyPayloadFor',
    'watchFiles(options.themeDir', 'theme hot reload', 'palette: payload.palette', 'getThemePreview',
    'selectPet', 'installBundledTheme'
  )) {
    if (-not $injectorSource.Contains($requiredInjectorBehavior)) {
      throw "Injector theme safety is missing: $requiredInjectorBehavior"
    }
  }
  foreach ($requiredPackageBehavior in @(
    'MAX_ART_BYTES', 'readImageMetadata', '50MP safety limit', 'resolveGitHubRepository',
    'listInstalledPets', 'installAndSelectBundledPet', 'selected-avatar-id', 'MAX_PET_SPRITESHEET_BYTES',
    'listBundledThemes', 'setBaseThemeEnabled', 'createLocalThemePackage', 'pruneDuplicateInstalledThemeDirectories',
    'installedThemePreviewDataUrl', 'bundledThemePreviewDataUrl',
    'petPreviewDataUrl', 'installedPetPreviewDataUrl', 'themePetSummary', 'processingIcon', 'spinnerIcon'
  )) {
    if (-not $themePackageSource.Contains($requiredPackageBehavior)) {
      throw "Theme package module safety is missing: $requiredPackageBehavior"
    }
  }
  $themeSource = Read-DreamSkinUtf8File -Path (Join-Path $Root 'scripts\theme-windows.ps1')
  foreach ($requiredThemeSafety in @(
    '[System.IO.FileAttributes]::ReparsePoint',
    'Ensure-DreamSkinManagedDirectory',
    'Get-DreamSkinValidatedImageMetadata',
    '16384px / 50MP safety limit',
    'Assert-DreamSkinImageFile -Path $temporary',
    'Assert-DreamSkinImageFile -Path $imageArchive',
    'Update-DreamSkinMaterializedThemeFramework'
  )) {
    if (-not $themeSource.Contains($requiredThemeSafety)) {
      throw "PowerShell theme-store safety is missing: $requiredThemeSafety"
    }
  }
  $commonSource = Read-DreamSkinUtf8File -Path (Join-Path $Root 'scripts\common-windows.ps1')
  if (-not $commonSource.Contains('State was preserved.')) {
    throw 'Mismatched live injector identity does not fail closed with preserved state.'
  }
  foreach ($requiredPerformanceBehavior in @(
    'sidebarDirty', 'spinnerDirty', 'dream-route-home', 'SPINNER_SELECTOR', '}, 48);',
    'dream-composer-processing', 'button.size-token-button-composer', 'attributeFilter: ["aria-label", "disabled"]',
    'scheduleSidebarEnsure', 'appliedProfileSignature', '}, 30000);',
    'permissionIconFor', 'permissionFull', 'permissionMenuChanged', 'permissionMenuListener', 'permissionButtons',
    'windowDragStart', 'windowDragEnd', 'dream-window-dragging',
    'installThemeIcon(nativeIcons[nativeIcons.length - 1], brandIcon)', 'sendIcon', 'processingIcon', 'spinnerIcon',
    'dream-theme-icon-processing', 'installComposerActionIcon', 'data-dream-composer-action-icon',
    'dreamComposerActionIcon', 'Stop generating', 'Cancel'
  )) {
    if (-not $rendererSource.Contains($requiredPerformanceBehavior)) {
      throw "Renderer route-performance behavior is missing: $requiredPerformanceBehavior"
    }
  }
  if ($rendererSource.Contains("querySelectorAll('svg:has(path[opacity=""0.3""])')")) {
    throw 'Renderer restored the expensive full-page SVG spinner fallback scan.'
  }
  $managerSource = Read-DreamSkinUtf8File -Path (Join-Path $Root 'engine\theme-manager.js')
  foreach ($requiredManagerBehavior in @(
    'codex-dream-theme-manager-trigger', 'aria-expanded', '还原官方外观',
    '主题宠物', 'selectPet', '已绑定', '热重载已开启', 'data-manager-close',
    'installBundledTheme', '安装主题', 'dtm-preview', 'data-dtm-theme-preview-key',
    'dtm-tabs', 'data-manager-tab="themes"', 'data-manager-tab="pets"',
    'installedThemeIds', '!installedThemeIds.has(theme.id)', 'dtm-card-line', 'dtm-card-main',
    'createLocalTheme', 'data-local-theme-open', 'data-local-theme-create', '仅本地',
    'data-local-theme-image-file', 'data-local-icon-file', 'data-local-theme-icons-file',
    'dtm-icon-form', 'dtm-icon-field', 'dtm-icon-preview', 'localJsonIcons',
    'imageBase64', 'iconsJsonText', 'iconOverrides', 'data-local-theme-accent', 'processingBase', '--dtm-surface',
    'dtm-swatches', 'data-local-color-preset', 'data-local-color-picker', 'transparent',
    'defaultIconLibrary', 'data-local-icon-library', 'data-local-new-icon-key', 'data-local-new-icon-file', 'image/gif',
    'dtm-pet-sprite', 'dtm-bound-pet', 'petName',
    'getThemePreview', 'themePreviewCache', 'applyThemePreviewImages',
    'getPetPreview', 'petPreviewCache', 'data-dtm-pet-preview-pet',
    'dtm-loading-card', 'showSequence', 'dtm-file-actions', 'dtm-close-hit', 'onPanelKeydown',
    'closeButton', 'data-dtm-close', 'inset:0', 'showing ? hide() : show()',
    '执行中动图', '加载转圈',
    'data-theme-pet-edit', 'data-theme-pet-pick', 'updateThemePet'
  )) {
    if (-not $managerSource.Contains($requiredManagerBehavior)) {
      throw "Independent theme manager behavior is missing: $requiredManagerBehavior"
    }
  }
  if ($managerSource.Contains('宠物：')) {
    throw 'Theme cards must show the bound pet image directly instead of a pet-name text chip.'
  }
  foreach ($removedCloseWorkaround in @('closeButtonFromPoint', 'onPanelPointerMove', 'onPanelPointerLeave', 'dtm-close-hover')) {
    if ($managerSource.Contains($removedCloseWorkaround)) {
      throw "Theme manager restored fragile close-button pointer workaround: $removedCloseWorkaround"
    }
  }
  foreach ($removedSettingsEntry in @('appearance.cloneNode', 'button.dataset.settingsPanelSlug = NAV_SLUG', 'insertAdjacentElement("afterend", button)')) {
    if ($managerSource.Contains($removedSettingsEntry)) {
      throw "Theme manager restored the settings-page navigation entry: $removedSettingsEntry"
    }
  }
  foreach ($removedManagerBehavior in @('addLibrary', 'addRepository', 'getCatalog', 'installLibraryTheme', 'data-library-add', 'data-repository-add', 'GitHub 仓库安装')) {
    if ($managerSource.Contains($removedManagerBehavior)) {
      throw "Removed theme library UI behavior is still present: $removedManagerBehavior"
    }
  }
  $guardSource = Read-DreamSkinUtf8File -Path (Join-Path $Root 'scripts\guard-dream-skin.ps1')
  foreach ($requiredGuardBehavior in @(
    'Get-DreamSkinCodexInstall', 'Test-RecordedInjectorHealthy', '-PreservePause',
    'MaxConsecutiveFailures', 'guard.failed.json', 'RestartCooldownSeconds',
    '-RestartExisting', '-NoRestartExisting', 'guard.enabled'
  )) {
    if (-not $guardSource.Contains($requiredGuardBehavior)) {
      throw "Update auto-heal behavior is missing: $requiredGuardBehavior"
    }
  }
  $traySource = Read-DreamSkinUtf8File -Path (Join-Path $Root 'scripts\tray-dream-skin.ps1')
  foreach ($requiredTrayBehavior in @(
    'Get-DreamSkinTrayStatus', 'Get-DreamSkinTrayLogLines', '最近 Guard 日志',
    '最近注入日志', '最近错误日志', '打开日志文件夹', 'Update-DreamSkinNotifyText'
  )) {
    if (-not $traySource.Contains($requiredTrayBehavior)) {
      throw "Tray status/log behavior is missing: $requiredTrayBehavior"
    }
  }
  $injectorSource = Read-DreamSkinUtf8File -Path (Join-Path $Root 'scripts\injector.mjs')
  foreach ($requiredRuntimeBehavior in @(
    'RUNTIME_PROTOCOL_VERSION', '__CODEX_DREAM_SKIN_RUNTIME__',
    'result.protocolVersion === result.expectedProtocolVersion'
  )) {
    if (-not $injectorSource.Contains($requiredRuntimeBehavior)) {
      throw "Framework-owned runtime verification is missing: $requiredRuntimeBehavior"
    }
  }
  if ($injectorSource.Contains('result.version === result.expectedVersion')) {
    throw 'Runtime verification must not couple a theme renderer version to the injector version.'
  }
  foreach ($requiredFloatingCss in @(
    'bg-token-dropdown-background',
    'data-pip-obstacle="thread-summary-panel"',
    'data-slot="thread-summary-panel-item-button"',
    'data-slot="thread-summary-panel-item-group"',
    'bg-token-main-surface-tertiary',
    'data-app-shell-focus-area="right-panel"',
    'bg-token-bg-fog',
    'hover:bg-token-list-hover-background',
    'Final right-panel pass',
    '@layer utilities',
    'rounded-full'
  )) {
    if (-not $css.Contains($requiredFloatingCss)) {
      throw "Shared floating/review surface theme CSS is missing: $requiredFloatingCss"
    }
  }
  if (-not $css.Contains('dream-theme-orbit') -or
    -not $css.Contains('width: 28px') -or
    -not $css.Contains('overflow: visible !important') -or
    -not $css.Contains('top: 1px') -or
    -not $css.Contains('.dream-theme-spinner-source:not(.dream-theme-spinner)') -or
    -not $css.Contains('.dream-theme-spinner-source.dream-theme-spinner > :not(.dream-theme-spinner-mark)') -or
    -not $rendererSource.Contains('document.querySelectorAll(SPINNER_SELECTOR)') -or
    -not $rendererSource.Contains('aside.app-shell-left-panel svg')) {
    throw 'The shared global theme orbit spinner is missing or still scoped to the sidebar.'
  }
  $remielCss = Read-DreamSkinUtf8File -Path (Join-Path $Root 'themes\绝区零 蕾米埃尔\theme.css')
  if (-not $remielCss.Contains('--dream-brand-suffix: " · 蕾米埃尔"') -or
    $remielCss.Contains('.dream-remiel-spinner') -or
    $remielCss.Contains('body:has(nav[aria-label="设置"], nav[aria-label="Settings"])')) {
    throw 'The Remiel package must contain only its palette/brand overrides, not copied framework behavior.'
  }
  $bundledPet = Join-Path (Split-Path -Parent $Root) 'pets\yangyang-xuanling-official-drum-r3'
  $bundledPetManifestPath = Join-Path $bundledPet 'pet.json'
  if (-not (Test-Path -LiteralPath $bundledPetManifestPath -PathType Leaf)) {
    throw 'The Xuanling package no longer carries its selected v2 pet package in the independent pets folder.'
  }
  $bundledThemeManifest = Get-Content -LiteralPath (Join-Path $bundledTheme 'theme.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($bundledThemeManifest.pet.id -ne 'yangyang-xuanling-official-drum-r3' -or $bundledThemeManifest.pet.directory) {
    throw 'The Xuanling theme must bind pets by id without nesting a pet directory inside themes.'
  }
  $bundledPetManifest = Get-Content -LiteralPath $bundledPetManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($bundledPetManifest.id -ne 'yangyang-xuanling-official-drum-r3' -or
    $bundledPetManifest.spriteVersionNumber -ne 2 -or
    -not (Test-Path -LiteralPath (Join-Path $bundledPet $bundledPetManifest.spritesheetPath) -PathType Leaf)) {
    throw 'The Xuanling theme bundled pet is not the approved official-drum continuous R3 v2 package.'
  }

  $packageRoot = Split-Path -Parent $Root
  $oneClickInstallerPath = Join-Path $packageRoot '安装主题工具.ps1'
  $oneClickLauncherPath = Join-Path $packageRoot '安装主题工具.cmd'
  $oneClickInstaller = Read-DreamSkinUtf8File -Path $oneClickInstallerPath
  foreach ($requiredInstallerBehavior in @(
    "Join-Path `$stateRoot 'runtime'",
    'Stop-PreviousThemeHelpers',
    "Join-Path `$sourceWindows '*'",
    'Remove-Item -LiteralPath $fullRuntimeWindows -Recurse -Force',
    "Join-Path `$packageRoot 'pets'",
    "Join-Path `$runtimeRoot 'pets'",
    'Remove-Item -LiteralPath $fullRuntimePets -Recurse -Force',
    "Join-Path `$runtimeWindows 'pets'",
    'Remove-Item -LiteralPath $fullLegacyPets -Recurse -Force',
    "'Codex 主题.lnk'",
    '现在重启并继续安装',
    '& $installer -Port $Port -ManagerOnly',
    '& $launcher -Port $Port -PreservePause'
  )) {
    if (-not $oneClickInstaller.Contains($requiredInstallerBehavior)) {
      throw "One-click theme-tool installer behavior is missing: $requiredInstallerBehavior"
    }
  }
  if ($oneClickInstaller.Contains('Copy-Item -LiteralPath $sourceWindows -Destination $runtimeRoot')) {
    throw 'One-click reinstall can still create a nested windows directory.'
  }
  $managerInstaller = Read-DreamSkinUtf8File -Path (Join-Path $Root 'scripts\install-dream-skin.ps1')
  foreach ($requiredManagerInstallBehavior in @('$hadThemeState', '$ManagerOnly -and -not $hadThemeState')) {
    if (-not $managerInstaller.Contains($requiredManagerInstallBehavior)) {
      throw "Manager-only install/upgrade behavior is missing: $requiredManagerInstallBehavior"
    }
  }
  foreach ($configScriptName in @('select-pet.ps1', 'set-theme-base.ps1')) {
    $configScript = Read-DreamSkinUtf8File -Path (Join-Path $Root "scripts\$configScriptName")
    if ($configScript.Contains('(Join-Path (if ')) {
      throw "$configScriptName uses an inline if expression that Windows PowerShell 5 cannot evaluate as a command argument."
    }
  }
  $oneClickLauncher = Read-DreamSkinUtf8File -Path $oneClickLauncherPath
  if (-not $oneClickLauncher.Contains('安装主题工具.ps1') -or
    -not $oneClickLauncher.Contains('exit /b %install_exit%')) {
    throw 'The double-click installer does not invoke or propagate the one-click PowerShell installer result.'
  }

  $node = Get-DreamSkinNodeRuntime
  & $node.Path (Join-Path $Root 'scripts\injector.mjs') --self-test *> $null
  if ($LASTEXITCODE -ne 0) { throw 'Injector CDP self-test failed.' }
  & $node.Path (Join-Path $Root 'scripts\injector.mjs') --check-payload *> $null
  if ($LASTEXITCODE -ne 0) { throw 'Injector self-test failed.' }
  & $node.Path (Join-Path $Root 'scripts\injector.mjs') --check-payload --theme-dir $themePaths.Active *> $null
  if ($LASTEXITCODE -ne 0) { throw 'Managed theme payload validation failed.' }
  $savedErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & $node.Path (Join-Path $Root 'scripts\injector.mjs') --check-payload --theme-dir $oversizedTheme *> $null
  $oversizedExitCode = $LASTEXITCODE
  $ErrorActionPreference = $savedErrorPreference
  if ($oversizedExitCode -eq 0) { throw 'Node injector accepted an image over the 16 MB limit.' }
  & $node.Path (Join-Path $PSScriptRoot 'renderer-inject.test.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Renderer auxiliary-window regression test failed.' }
  & $node.Path (Join-Path $PSScriptRoot 'injector-bootstrap.test.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Injector early-bootstrap regression test failed.' }
  & $node.Path (Join-Path $PSScriptRoot 'injector-one-shot.test.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Injector one-shot Browser ID regression test failed.' }
  & $node.Path (Join-Path $PSScriptRoot 'image-metadata.test.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Image metadata regression test failed.' }
  & $node.Path (Join-Path $PSScriptRoot 'local-theme.test.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Local-only theme regression test failed.' }

  Write-Host 'PASS: config transactions, theme manager, update auto-heal, state safety, and loopback CDP validation.'
} finally {
  Remove-Item -LiteralPath $temporaryRoot -Recurse -Force -ErrorAction SilentlyContinue
}
