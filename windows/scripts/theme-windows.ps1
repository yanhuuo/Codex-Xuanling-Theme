if (-not (Get-Command Read-DreamSkinUtf8File -ErrorAction SilentlyContinue)) {
  . (Join-Path $PSScriptRoot 'config-utf8.ps1')
}

$script:DreamSkinMaxImageBytes = 16 * 1024 * 1024

function Assert-DreamSkinNoReparseComponents {
  param([Parameter(Mandatory = $true)][string]$Path)
  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $root = [System.IO.Path]::GetPathRoot($fullPath)
  $current = $fullPath
  while ($true) {
    if (Test-Path -LiteralPath $current) {
      $item = Get-Item -LiteralPath $current -Force -ErrorAction Stop
      if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Managed Dream Skin path contains a junction or symbolic link: $current"
      }
    }
    $currentNormalized = $current.TrimEnd('\')
    $rootNormalized = $root.TrimEnd('\')
    if ($currentNormalized.Equals($rootNormalized, [System.StringComparison]::OrdinalIgnoreCase)) { break }
    $parent = [System.IO.Path]::GetDirectoryName($current)
    if (-not $parent -or $parent.Equals($current, [System.StringComparison]::OrdinalIgnoreCase)) { break }
    $current = $parent
  }
}

function Ensure-DreamSkinManagedDirectory {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Root
  )
  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $fullRoot = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
  if (-not ($fullPath.Equals($fullRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
      $fullPath.StartsWith($fullRoot + '\', [System.StringComparison]::OrdinalIgnoreCase))) {
    throw "Managed Dream Skin path escaped its state root: $fullPath"
  }
  Assert-DreamSkinNoReparseComponents -Path $fullPath
  if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
    throw "Managed Dream Skin path is a file, not a directory: $fullPath"
  }
  New-Item -ItemType Directory -Force -Path $fullPath | Out-Null
  Assert-DreamSkinNoReparseComponents -Path $fullPath
  if (-not (Test-Path -LiteralPath $fullPath -PathType Container)) {
    throw "Managed Dream Skin directory could not be created: $fullPath"
  }
}

function Get-DreamSkinValidatedImageMetadata {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Get-Command Get-DreamSkinNodeRuntime -ErrorAction SilentlyContinue)) {
    throw 'Node.js runtime validation is unavailable for image metadata checks.'
  }
  $node = Get-DreamSkinNodeRuntime
  $metadataScript = Join-Path $PSScriptRoot 'image-metadata.mjs'
  $output = @(& $node.Path $metadataScript '--check' ([System.IO.Path]::GetFullPath($Path)) 2>&1)
  if ($LASTEXITCODE -ne 0) {
    throw "Image metadata is invalid or exceeds the 16384px / 50MP safety limit: $Path"
  }
  try { $metadata = ($output -join "`n") | ConvertFrom-Json -ErrorAction Stop } catch {
    throw "Image metadata helper returned invalid output: $Path"
  }
  if ($null -eq $metadata -or $null -eq $metadata.width -or $null -eq $metadata.height) {
    throw "Image metadata is invalid or exceeds the 16384px / 50MP safety limit: $Path"
  }
}

function Assert-DreamSkinImageFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [switch]$SkipImageMetadata
  )
  $fullPath = [System.IO.Path]::GetFullPath($Path)
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
    throw "Image does not exist: $fullPath"
  }
  $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
  if ($extension -notin @('.png', '.jpg', '.jpeg', '.webp')) {
    throw "Unsupported image format: $extension"
  }
  $length = (Get-Item -LiteralPath $fullPath -Force).Length
  if ($length -lt 1) { throw 'Theme image cannot be empty.' }
  if ($length -gt $script:DreamSkinMaxImageBytes) {
    throw 'Theme image exceeds the 16 MB limit.'
  }
  if (-not $SkipImageMetadata) {
    Get-DreamSkinValidatedImageMetadata -Path $fullPath
  }
}

function Get-DreamSkinThemePaths {
  param([string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'))
  $fullRoot = [System.IO.Path]::GetFullPath($StateRoot)
  return [pscustomobject]@{
    Root = $fullRoot
    Active = Join-Path $fullRoot 'active-theme'
    Saved = Join-Path $fullRoot 'themes'
    Pets = Join-Path $fullRoot 'pets'
    Images = Join-Path $fullRoot 'images'
    PauseFile = Join-Path $fullRoot 'paused'
    State = Join-Path $fullRoot 'state.json'
  }
}

function Test-DreamSkinThemePathWithin {
  param([string]$Path, [string]$Root)
  if (-not $Path -or -not $Root) { return $false }
  try {
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $fullRoot = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
    $inside = $fullPath.Equals($fullRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
      $fullPath.StartsWith($fullRoot + '\', [System.StringComparison]::OrdinalIgnoreCase)
    if (-not $inside) { return $false }

    $current = $fullPath.TrimEnd('\')
    while ($true) {
      if (-not (Test-Path -LiteralPath $current)) { return $false }
      $item = Get-Item -LiteralPath $current -Force -ErrorAction Stop
      if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        return $false
      }
      if ($current.Equals($fullRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $true
      }
      $parent = [System.IO.Path]::GetDirectoryName($current)
      if (-not $parent -or $parent.Equals($current, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $false
      }
      $current = $parent.TrimEnd('\')
    }
  } catch {
    return $false
  }
}

function Read-DreamSkinTheme {
  param(
    [Parameter(Mandatory = $true)][string]$ThemeDirectory,
    [switch]$SkipImageMetadata
  )
  $directory = [System.IO.Path]::GetFullPath($ThemeDirectory)
  Assert-DreamSkinNoReparseComponents -Path $directory
  $themePath = Join-Path $directory 'theme.json'
  Assert-DreamSkinNoReparseComponents -Path $themePath
  if (-not (Test-Path -LiteralPath $themePath -PathType Leaf)) {
    throw "Theme metadata is missing: $themePath"
  }
  try {
    $theme = (Read-DreamSkinUtf8File -Path $themePath) | ConvertFrom-Json -ErrorAction Stop
  } catch {
    throw "Theme metadata is invalid JSON: $themePath"
  }
  if ($null -eq $theme -or $theme -is [string] -or $theme -is [array] -or -not $theme.image) {
    throw "Theme metadata must be an object with a relative image path: $themePath"
  }
  $image = "$($theme.image)"
  if ([System.IO.Path]::IsPathRooted($image)) { throw 'Theme image path must be relative.' }
  $imagePath = [System.IO.Path]::GetFullPath((Join-Path $directory $image))
  if (-not (Test-DreamSkinThemePathWithin -Path $imagePath -Root $directory) -or
    -not (Test-Path -LiteralPath $imagePath -PathType Leaf)) {
    throw 'Theme image must remain inside its theme directory and exist.'
  }
  Assert-DreamSkinImageFile -Path $imagePath -SkipImageMetadata:$SkipImageMetadata
  $usesSharedFramework = $theme.framework -and
    "$($theme.framework.id)" -ceq 'dream-skin' -and
    [int]$theme.framework.version -eq 1
  if ($theme.framework -and -not $usesSharedFramework) {
    throw 'Theme framework must be dream-skin version 1.'
  }
  $cssEntry = if ($theme.entrypoints -and $theme.entrypoints.css) { "$($theme.entrypoints.css)" } else { 'theme.css' }
  $rendererEntry = if ($usesSharedFramework) { $null } elseif ($theme.entrypoints -and $theme.entrypoints.renderer) { "$($theme.entrypoints.renderer)" } else { 'theme.js' }
  $iconsEntry = if ($theme.entrypoints -and $theme.entrypoints.icons) { "$($theme.entrypoints.icons)" } else { $null }
  if ([System.IO.Path]::IsPathRooted($cssEntry) -or [System.IO.Path]::GetExtension($cssEntry) -cne '.css') {
    throw 'Theme CSS entrypoint must be a relative .css path.'
  }
  if ($rendererEntry -and ([System.IO.Path]::IsPathRooted($rendererEntry) -or [System.IO.Path]::GetExtension($rendererEntry) -cne '.js')) {
    throw 'Theme renderer entrypoint must be a relative .js path.'
  }
  $cssPath = [System.IO.Path]::GetFullPath((Join-Path $directory $cssEntry))
  $frameworkRoot = [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $PSScriptRoot) 'engine'))
  $frameworkCssPath = if ($usesSharedFramework) { Join-Path $frameworkRoot 'theme-base.css' } else { $null }
  $rendererPath = if ($usesSharedFramework) {
    Join-Path $frameworkRoot 'theme-runtime.js'
  } else {
    [System.IO.Path]::GetFullPath((Join-Path $directory $rendererEntry))
  }
  $iconsPath = if ($iconsEntry) {
    if ([System.IO.Path]::IsPathRooted($iconsEntry) -or [System.IO.Path]::GetExtension($iconsEntry) -cne '.json') {
      throw 'Theme icons entrypoint must be a relative .json path.'
    }
    [System.IO.Path]::GetFullPath((Join-Path $directory $iconsEntry))
  } else { $null }
  foreach ($codePath in @($cssPath, $iconsPath)) {
    if (-not $codePath) { continue }
    if (-not (Test-DreamSkinThemePathWithin -Path $codePath -Root $directory) -or
      -not (Test-Path -LiteralPath $codePath -PathType Leaf)) {
      throw 'Theme code entrypoints must remain inside the theme directory and exist.'
    }
  }
  foreach ($frameworkPath in @($frameworkCssPath, $(if ($usesSharedFramework) { $rendererPath } else { $null }))) {
    if ($frameworkPath -and
      (-not (Test-DreamSkinThemePathWithin -Path $frameworkPath -Root $frameworkRoot) -or
       -not (Test-Path -LiteralPath $frameworkPath -PathType Leaf))) {
      throw 'Shared theme framework files are missing or escaped the engine directory.'
    }
  }
  if (-not $usesSharedFramework -and -not (Test-Path -LiteralPath $rendererPath -PathType Leaf)) {
    throw 'Theme renderer entrypoint is missing.'
  }
  return [pscustomobject]@{
    Directory = $directory
    ThemePath = $themePath
    ImagePath = $imagePath
    CssPath = $cssPath
    RendererPath = $rendererPath
    FrameworkCssPath = $frameworkCssPath
    IconsPath = $iconsPath
    Theme = $theme
  }
}

function Read-DreamSkinThemeInstallManifest {
  param([Parameter(Mandatory = $true)][string]$ThemeDirectory)
  $directory = [System.IO.Path]::GetFullPath($ThemeDirectory)
  $installPath = Join-Path $directory 'install.json'
  if (-not (Test-Path -LiteralPath $installPath -PathType Leaf)) {
    $theme = Read-DreamSkinTheme -ThemeDirectory $directory -SkipImageMetadata
    $files = @('theme.json', [System.IO.Path]::GetFileName($theme.CssPath),
      [System.IO.Path]::GetFileName($theme.RendererPath), [System.IO.Path]::GetFileName($theme.ImagePath))
    if ($theme.IconsPath) { $files += [System.IO.Path]::GetFileName($theme.IconsPath) }
    return [pscustomobject]@{ SchemaVersion = 0; Default = $false; Files = $files; Pets = @(); Path = $null }
  }
  Assert-DreamSkinNoReparseComponents -Path $installPath
  try { $install = (Read-DreamSkinUtf8File -Path $installPath) | ConvertFrom-Json -ErrorAction Stop } catch {
    throw "Theme install manifest is invalid JSON: $installPath"
  }
  if ($null -eq $install -or [int]$install.schemaVersion -ne 1 -or "$($install.manifest)" -cne 'theme.json' -or
    $null -eq $install.files -or $install.files -is [string]) {
    throw 'Theme install manifest must use schemaVersion 1, manifest theme.json, and a files array.'
  }
  $files = @()
  foreach ($relative in @($install.files)) {
    $name = "$relative"
    if (-not $name -or [System.IO.Path]::IsPathRooted($name)) { throw 'Theme install files must be relative paths.' }
    $source = [System.IO.Path]::GetFullPath((Join-Path $directory $name))
    if (-not (Test-DreamSkinThemePathWithin -Path $source -Root $directory) -or
      -not (Test-Path -LiteralPath $source -PathType Leaf)) {
      throw "Theme install file escaped the package or is missing: $name"
    }
    $files += $name
  }
  if (@($files | Where-Object { $_ -ceq 'theme.json' }).Count -ne 1) {
    throw 'Theme install manifest must include theme.json exactly once.'
  }
  return [pscustomobject]@{
    SchemaVersion = 1
    Default = [bool]$install.default
    Files = @($files | Select-Object -Unique)
    Pets = @($install.pets)
    Path = $installPath
  }
}

function Write-DreamSkinTheme {
  param(
    [Parameter(Mandatory = $true)][string]$ThemeDirectory,
    [Parameter(Mandatory = $true)][object]$Theme
  )
  Assert-DreamSkinNoReparseComponents -Path $ThemeDirectory
  New-Item -ItemType Directory -Force -Path $ThemeDirectory | Out-Null
  Assert-DreamSkinNoReparseComponents -Path $ThemeDirectory
  $json = $Theme | ConvertTo-Json -Depth 8
  $themePath = Join-Path $ThemeDirectory 'theme.json'
  Assert-DreamSkinNoReparseComponents -Path $themePath
  Write-DreamSkinUtf8FileAtomically -Path $themePath -Content ($json + "`r`n")
}

function Write-DreamSkinThemeInstallManifest {
  param([Parameter(Mandatory = $true)][string]$ThemeDirectory)
  $loaded = Read-DreamSkinTheme -ThemeDirectory $ThemeDirectory -SkipImageMetadata
  $files = @(
    'theme.json',
    "$($loaded.Theme.entrypoints.css)",
    "$($loaded.Theme.entrypoints.renderer)"
  )
  if ($loaded.Theme.entrypoints.icons) { $files += "$($loaded.Theme.entrypoints.icons)" }
  $files += "$($loaded.Theme.image)"
  $install = [ordered]@{
    schemaVersion = 1
    default = $false
    manifest = 'theme.json'
    files = @($files | Select-Object -Unique)
    pets = $(if ($loaded.Theme.pet) { @("$($loaded.Theme.pet.id)") } else { @() })
  }
  Write-DreamSkinUtf8FileAtomically -Path (Join-Path $ThemeDirectory 'install.json') `
    -Content (($install | ConvertTo-Json -Depth 8) + "`r`n")
}

function Copy-DreamSkinThemeBundleFiles {
  param(
    [Parameter(Mandatory = $true)][string]$SourceDirectory,
    [Parameter(Mandatory = $true)][string]$DestinationDirectory,
    [Parameter(Mandatory = $true)][string]$ManagedRoot
  )
  Ensure-DreamSkinManagedDirectory -Path $DestinationDirectory -Root $ManagedRoot
  $sourceTheme = Read-DreamSkinTheme -ThemeDirectory $SourceDirectory -SkipImageMetadata
  $package = Read-DreamSkinThemeInstallManifest -ThemeDirectory $SourceDirectory
  foreach ($name in @($package.Files)) {
    $source = Join-Path $SourceDirectory $name
    $destination = Join-Path $DestinationDirectory $name
    Ensure-DreamSkinManagedDirectory -Path ([System.IO.Path]::GetDirectoryName($destination)) -Root $ManagedRoot
    Assert-DreamSkinNoReparseComponents -Path $destination
    Copy-Item -LiteralPath $source -Destination $destination -Force
  }
  if ($package.Path) {
    Copy-Item -LiteralPath $package.Path -Destination (Join-Path $DestinationDirectory 'install.json') -Force
  }
  if ($sourceTheme.FrameworkCssPath) {
    $themeCssPath = Join-Path $DestinationDirectory 'theme.css'
    $combinedCss = (Read-DreamSkinUtf8File -Path $sourceTheme.FrameworkCssPath).TrimEnd() +
      "`r`n`r`n" + (Read-DreamSkinUtf8File -Path $themeCssPath).Trim() + "`r`n"
    Write-DreamSkinUtf8FileAtomically -Path $themeCssPath -Content $combinedCss
    Copy-Item -LiteralPath $sourceTheme.RendererPath -Destination (Join-Path $DestinationDirectory 'theme.js') -Force
    $materializedTheme = (Read-DreamSkinUtf8File -Path (Join-Path $DestinationDirectory 'theme.json')) |
      ConvertFrom-Json -ErrorAction Stop
    $materializedTheme.PSObject.Properties.Remove('framework')
    $entrypoints = [ordered]@{ css = 'theme.css'; renderer = 'theme.js' }
    if ($materializedTheme.entrypoints.icons) { $entrypoints.icons = "$($materializedTheme.entrypoints.icons)" }
    $materializedTheme | Add-Member -NotePropertyName entrypoints -NotePropertyValue ([pscustomobject]$entrypoints) -Force
    Write-DreamSkinTheme -ThemeDirectory $DestinationDirectory -Theme $materializedTheme
    Write-DreamSkinThemeInstallManifest -ThemeDirectory $DestinationDirectory
  }
  Copy-DreamSkinThemePetBundle -SourceDirectory $SourceDirectory -DestinationDirectory $DestinationDirectory -ManagedRoot $ManagedRoot
  $legacyImage = Join-Path $DestinationDirectory 'dream-reference.jpg'
  if (Test-Path -LiteralPath $legacyImage -PathType Leaf) {
    Assert-DreamSkinNoReparseComponents -Path $legacyImage
    Remove-Item -LiteralPath $legacyImage -Force
  }
}

function Copy-DreamSkinThemePetBundle {
  param(
    [Parameter(Mandatory = $true)][string]$SourceDirectory,
    [Parameter(Mandatory = $true)][string]$DestinationDirectory,
    [Parameter(Mandatory = $true)][string]$ManagedRoot
  )
  $sourceTheme = (Read-DreamSkinUtf8File -Path (Join-Path $SourceDirectory 'theme.json')) | ConvertFrom-Json -ErrorAction Stop
  $destinationPets = Join-Path $DestinationDirectory 'pets'
  if (-not $sourceTheme.pet) { return }
  $petId = "$($sourceTheme.pet.id)"
  if ($petId -notmatch '^[A-Za-z0-9._-]{1,80}$') {
    throw 'Bundled theme pet metadata is invalid.'
  }
  $petCandidates = @()
  if ($sourceTheme.pet.directory) {
    $relativeDirectory = "$($sourceTheme.pet.directory)"
    if ([System.IO.Path]::IsPathRooted($relativeDirectory)) { throw 'Bundled theme pet metadata is invalid.' }
    $petCandidates += [System.IO.Path]::GetFullPath((Join-Path $SourceDirectory $relativeDirectory))
  }
  $cursor = [System.IO.Path]::GetFullPath($SourceDirectory)
  while ($true) {
    $petCandidates += [System.IO.Path]::GetFullPath((Join-Path $cursor (Join-Path 'pets' $petId)))
    $parent = [System.IO.Path]::GetDirectoryName($cursor)
    if (-not $parent -or $parent.Equals($cursor, [System.StringComparison]::OrdinalIgnoreCase)) { break }
    $cursor = $parent
  }
  $sourcePet = $null
  foreach ($candidate in @($petCandidates | Select-Object -Unique)) {
    if (Test-Path -LiteralPath (Join-Path $candidate 'pet.json') -PathType Leaf) {
      $sourcePet = $candidate
      break
    }
  }
  if (-not $sourcePet) { throw "Bundled theme pet package was not found: $petId" }
  $manifestPath = Join-Path $sourcePet 'pet.json'
  $manifest = (Read-DreamSkinUtf8File -Path $manifestPath) | ConvertFrom-Json -ErrorAction Stop
  if ("$($manifest.id)" -cne $petId -or [int]$manifest.spriteVersionNumber -ne 2) { throw 'Bundled pet must be a matching Codex v2 package.' }
  $spritesheetName = "$($manifest.spritesheetPath)"
  if (-not $spritesheetName -or [System.IO.Path]::IsPathRooted($spritesheetName) -or [System.IO.Path]::GetExtension($spritesheetName) -ine '.webp') {
    throw 'Bundled pet spritesheetPath must be a relative WebP path.'
  }
  $spritesheetPath = [System.IO.Path]::GetFullPath((Join-Path $sourcePet $spritesheetName))
  if (-not (Test-DreamSkinThemePathWithin -Path $spritesheetPath -Root $sourcePet)) { throw 'Bundled pet spritesheet escaped its package.' }
  Assert-DreamSkinImageFile -Path $spritesheetPath
  $stateRoot = [System.IO.Path]::GetFullPath($ManagedRoot)
  if ([System.IO.Path]::GetFileName($stateRoot) -ieq 'themes') {
    $stateRoot = [System.IO.Path]::GetDirectoryName($stateRoot)
  }
  $destinationPet = Join-Path (Join-Path $stateRoot 'pets') $petId
  Ensure-DreamSkinManagedDirectory -Path $destinationPet -Root $stateRoot
  $destinationSheet = Join-Path $destinationPet $spritesheetName
  New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($destinationSheet)) | Out-Null
  if ([System.IO.Path]::GetFullPath($spritesheetPath) -ine [System.IO.Path]::GetFullPath($destinationSheet)) {
    Copy-Item -LiteralPath $spritesheetPath -Destination $destinationSheet -Force
  }
  $destinationManifest = Join-Path $destinationPet 'pet.json'
  if ([System.IO.Path]::GetFullPath($manifestPath) -ine [System.IO.Path]::GetFullPath($destinationManifest)) {
    Copy-Item -LiteralPath $manifestPath -Destination $destinationManifest -Force
  }
  if (Test-Path -LiteralPath $destinationPets) {
    if (-not (Test-DreamSkinThemePathWithin -Path $destinationPets -Root $ManagedRoot)) { throw 'Theme pet destination escaped the managed theme store.' }
    $fullDestinationPets = [System.IO.Path]::GetFullPath($destinationPets)
    $fullStorePets = [System.IO.Path]::GetFullPath((Join-Path $stateRoot 'pets'))
    if (-not $fullDestinationPets.Equals($fullStorePets, [System.StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -LiteralPath $destinationPets -Recurse -Force
    }
  }
}

function Upgrade-DreamSkinLegacyThemeBundle {
  param(
    [Parameter(Mandatory = $true)][string]$ThemeDirectory,
    [Parameter(Mandatory = $true)][string]$BundledThemeDirectory
  )
  $themePath = Join-Path $ThemeDirectory 'theme.json'
  if (-not (Test-Path -LiteralPath $themePath -PathType Leaf)) { return }
  $theme = (Read-DreamSkinUtf8File -Path $themePath) | ConvertFrom-Json -ErrorAction Stop
  $bundledTheme = (Read-DreamSkinUtf8File -Path (Join-Path $BundledThemeDirectory 'theme.json')) | ConvertFrom-Json -ErrorAction Stop
  $changed = $false
  foreach ($entry in @(
    @{ Name = 'theme.css'; Source = (Join-Path $BundledThemeDirectory 'theme.css') },
    @{ Name = 'theme.js'; Source = (Join-Path $BundledThemeDirectory 'theme.js') }
  )) {
    $destination = Join-Path $ThemeDirectory $entry.Name
    if (-not (Test-Path -LiteralPath $destination -PathType Leaf)) {
      Assert-DreamSkinNoReparseComponents -Path $destination
      Copy-Item -LiteralPath $entry.Source -Destination $destination -Force
      $changed = $true
    }
  }
  if (-not $theme.entrypoints) {
    $theme | Add-Member -NotePropertyName entrypoints -NotePropertyValue `
      ([pscustomobject]@{ css = 'theme.css'; renderer = 'theme.js' }) -Force
    $changed = $true
  }
  if (-not $theme.schemaVersion -or [int]$theme.schemaVersion -lt 2) {
    $theme | Add-Member -NotePropertyName schemaVersion -NotePropertyValue 2 -Force
    $changed = $true
  }
  foreach ($propertyName in @('description', 'author', 'version')) {
    if (-not $theme.$propertyName -and $bundledTheme.$propertyName) {
      $theme | Add-Member -NotePropertyName $propertyName -NotePropertyValue $bundledTheme.$propertyName -Force
      $changed = $true
    }
  }
  if ($bundledTheme.pet -and -not $theme.pet) {
    Copy-DreamSkinThemePetBundle -SourceDirectory $BundledThemeDirectory -DestinationDirectory $ThemeDirectory -ManagedRoot ([System.IO.Path]::GetDirectoryName($ThemeDirectory))
    $theme | Add-Member -NotePropertyName pet -NotePropertyValue $bundledTheme.pet -Force
    $changed = $true
  }
  if ($theme.pet -and $theme.pet.directory) {
    Copy-DreamSkinThemePetBundle -SourceDirectory $ThemeDirectory -DestinationDirectory $ThemeDirectory -ManagedRoot ([System.IO.Path]::GetDirectoryName($ThemeDirectory))
    $theme.pet = [pscustomobject]@{ id = "$($theme.pet.id)" }
    $changed = $true
  }
  if ($changed) { Write-DreamSkinTheme -ThemeDirectory $ThemeDirectory -Theme $theme }
}

function Initialize-DreamSkinThemeStore {
  param(
    [Parameter(Mandatory = $true)][string]$SkillRoot,
    [string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'),
    [switch]$ManagerOnly
  )
  $paths = Get-DreamSkinThemePaths -StateRoot $StateRoot
  foreach ($directory in @($paths.Root, $paths.Active, $paths.Saved, $paths.Pets, $paths.Images)) {
    Ensure-DreamSkinManagedDirectory -Path $directory -Root $paths.Root
  }
  $bundledRoot = Join-Path $SkillRoot 'themes'
  $bundledPackages = @()
  foreach ($directory in Get-ChildItem -LiteralPath $bundledRoot -Directory -ErrorAction Stop) {
    try {
      $package = Read-DreamSkinThemeInstallManifest -ThemeDirectory $directory.FullName
      $bundledPackages += [pscustomobject]@{ Directory = $directory.FullName; Package = $package }
    } catch {}
  }
  $defaultPackages = @($bundledPackages | Where-Object { $_.Package.Default })
  if ($defaultPackages.Count -ne 1) { throw 'Exactly one bundled theme install.json must set default to true.' }
  $assetRoot = $defaultPackages[0].Directory
  $assetTheme = Read-DreamSkinTheme -ThemeDirectory $assetRoot
  $assetImage = $assetTheme.ImagePath
  Assert-DreamSkinImageFile -Path $assetImage
  $activeTheme = Join-Path $paths.Active 'theme.json'
  Assert-DreamSkinNoReparseComponents -Path $activeTheme
  if (-not (Test-Path -LiteralPath $activeTheme -PathType Leaf)) {
    Copy-DreamSkinThemeBundleFiles -SourceDirectory $assetRoot -DestinationDirectory $paths.Active -ManagedRoot $paths.Root
    $activeBundle = Read-DreamSkinTheme -ThemeDirectory $paths.Active
    $activeImage = $activeBundle.ImagePath
    Assert-DreamSkinNoReparseComponents -Path $activeImage
    Assert-DreamSkinImageFile -Path $activeImage
    $imageArchive = Join-Path $paths.Images ([System.IO.Path]::GetFileName($activeImage))
    Assert-DreamSkinNoReparseComponents -Path $imageArchive
    Copy-Item -LiteralPath $assetImage `
      -Destination $imageArchive -Force
    Assert-DreamSkinNoReparseComponents -Path $imageArchive
    Assert-DreamSkinImageFile -Path $imageArchive
  } else {
    Upgrade-DreamSkinLegacyThemeBundle -ThemeDirectory $paths.Active -BundledThemeDirectory $assetRoot
  }
  foreach ($savedDirectory in Get-ChildItem -LiteralPath $paths.Saved -Directory -ErrorAction SilentlyContinue) {
    Upgrade-DreamSkinLegacyThemeBundle -ThemeDirectory $savedDirectory.FullName -BundledThemeDirectory $assetRoot
  }
  if (-not $ManagerOnly) {
    $presetId = ("$($assetTheme.Theme.id)" -replace '[^A-Za-z0-9._-]+', '-').Trim('-')
    if (-not $presetId) { $presetId = 'default' }
    $presetDirectory = Join-Path $paths.Saved ("preset-$presetId")
    $presetTheme = Join-Path $presetDirectory 'theme.json'
    Assert-DreamSkinNoReparseComponents -Path $presetDirectory
    Assert-DreamSkinNoReparseComponents -Path $presetTheme
    Copy-DreamSkinThemeBundleFiles -SourceDirectory $assetRoot -DestinationDirectory $presetDirectory -ManagedRoot $paths.Root
  }
  $null = Read-DreamSkinTheme -ThemeDirectory $paths.Active
  return $paths
}

function New-DreamSkinThemeImageName {
  param([Parameter(Mandatory = $true)][string]$Extension)
  return 'art-' + (Get-Date).ToString('yyyyMMdd-HHmmss-fff') + '-' +
    [guid]::NewGuid().ToString('N').Substring(0, 8) + $Extension.ToLowerInvariant()
}

function Set-DreamSkinActiveTheme {
  param(
    [Parameter(Mandatory = $true)][string]$ImagePath,
    [AllowNull()][object]$Theme,
    [string]$Name,
    [string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin')
  )
  $paths = Get-DreamSkinThemePaths -StateRoot $StateRoot
  Ensure-DreamSkinManagedDirectory -Path $paths.Root -Root $paths.Root
  Ensure-DreamSkinManagedDirectory -Path $paths.Active -Root $paths.Root
  Ensure-DreamSkinManagedDirectory -Path $paths.Images -Root $paths.Root
  $source = [System.IO.Path]::GetFullPath($ImagePath)
  Assert-DreamSkinImageFile -Path $source
  $extension = [System.IO.Path]::GetExtension($source).ToLowerInvariant()
  $oldImage = $null
  try { $oldImage = (Read-DreamSkinTheme -ThemeDirectory $paths.Active).ImagePath } catch {}
  if ($null -eq $Theme) {
    $Theme = [pscustomobject]@{
      id = 'custom'
      name = '自定义主题'
      appearance = 'auto'
      art = [pscustomobject]@{ focusX = $null; focusY = $null; safeArea = 'auto'; taskMode = 'auto' }
      palette = [pscustomobject]@{}
    }
  }
  $imageName = New-DreamSkinThemeImageName -Extension $extension
  $target = Join-Path $paths.Active $imageName
  $temporary = Join-Path $paths.Active ('.dream-tmp-' + [guid]::NewGuid().ToString('N') + $extension)
  try {
    Assert-DreamSkinNoReparseComponents -Path $target
    Assert-DreamSkinNoReparseComponents -Path $temporary
    Copy-Item -LiteralPath $source -Destination $temporary -Force
    Assert-DreamSkinNoReparseComponents -Path $temporary
    Assert-DreamSkinImageFile -Path $temporary
    Move-Item -LiteralPath $temporary -Destination $target -Force
    Assert-DreamSkinNoReparseComponents -Path $target
    Assert-DreamSkinImageFile -Path $target
    $Theme | Add-Member -NotePropertyName image -NotePropertyValue $imageName -Force
    if ($Name) { $Theme | Add-Member -NotePropertyName name -NotePropertyValue $Name -Force }
    if (-not $Theme.id) { $Theme | Add-Member -NotePropertyName id -NotePropertyValue 'custom' -Force }
    if (-not $Theme.appearance) { $Theme | Add-Member -NotePropertyName appearance -NotePropertyValue 'auto' -Force }
    if (-not $Theme.art) {
      $Theme | Add-Member -NotePropertyName art -NotePropertyValue `
        ([pscustomobject]@{ focusX = $null; focusY = $null; safeArea = 'auto'; taskMode = 'auto' }) -Force
    }
    if (-not $Theme.palette) {
      $Theme | Add-Member -NotePropertyName palette -NotePropertyValue ([pscustomobject]@{}) -Force
    }
    $Theme | Add-Member -NotePropertyName schemaVersion -NotePropertyValue 2 -Force
    $Theme | Add-Member -NotePropertyName entrypoints -NotePropertyValue `
      ([pscustomobject]@{ css = 'theme.css'; renderer = 'theme.js' }) -Force
    Write-DreamSkinTheme -ThemeDirectory $paths.Active -Theme $Theme
    Write-DreamSkinThemeInstallManifest -ThemeDirectory $paths.Active
  } finally {
    Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue
  }
  $sameImage = $oldImage -and ([System.IO.Path]::GetFullPath($oldImage) -ieq [System.IO.Path]::GetFullPath($target))
  if ($oldImage -and -not $sameImage -and
    (Test-DreamSkinThemePathWithin -Path $oldImage -Root $paths.Active)) {
    Remove-Item -LiteralPath $oldImage -Force -ErrorAction SilentlyContinue
  }
  $imageArchive = Join-Path $paths.Images $imageName
  Assert-DreamSkinNoReparseComponents -Path $imageArchive
  Copy-Item -LiteralPath $target -Destination $imageArchive -Force
  Assert-DreamSkinNoReparseComponents -Path $imageArchive
  Assert-DreamSkinImageFile -Path $imageArchive
  return Read-DreamSkinTheme -ThemeDirectory $paths.Active
}

function Save-DreamSkinCurrentTheme {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin')
  )
  $trimmed = $Name.Trim()
  if (-not $trimmed -or $trimmed.Length -gt 80 -or $trimmed -match '[\u0000-\u001f]') {
    throw 'Theme name must be between 1 and 80 visible characters.'
  }
  $paths = Get-DreamSkinThemePaths -StateRoot $StateRoot
  Ensure-DreamSkinManagedDirectory -Path $paths.Root -Root $paths.Root
  Ensure-DreamSkinManagedDirectory -Path $paths.Saved -Root $paths.Root
  $active = Read-DreamSkinTheme -ThemeDirectory $paths.Active
  $id = (Get-Date).ToString('yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
  $destination = Join-Path $paths.Saved $id
  Ensure-DreamSkinManagedDirectory -Path $destination -Root $paths.Root
  $extension = [System.IO.Path]::GetExtension($active.ImagePath).ToLowerInvariant()
  $imageName = 'art' + $extension
  $destinationImage = Join-Path $destination $imageName
  Assert-DreamSkinNoReparseComponents -Path $destinationImage
  Copy-Item -LiteralPath $active.ImagePath -Destination $destinationImage -Force
  Copy-Item -LiteralPath $active.CssPath -Destination (Join-Path $destination 'theme.css') -Force
  Copy-Item -LiteralPath $active.RendererPath -Destination (Join-Path $destination 'theme.js') -Force
  if ($active.IconsPath) {
    Copy-Item -LiteralPath $active.IconsPath -Destination (Join-Path $destination 'icons.json') -Force
  }
  if ($active.Theme.pet) {
    Copy-DreamSkinThemePetBundle -SourceDirectory $paths.Active -DestinationDirectory $destination -ManagedRoot $paths.Root
  }
  Assert-DreamSkinNoReparseComponents -Path $destinationImage
  Assert-DreamSkinImageFile -Path $destinationImage
  $theme = $active.Theme | ConvertTo-Json -Depth 8 | ConvertFrom-Json
  $theme.id = $id
  $theme.name = $trimmed
  $theme.image = $imageName
  $schemaVersion = if ($active.IconsPath) { 3 } else { 2 }
  $entrypoints = [ordered]@{ css = 'theme.css'; renderer = 'theme.js' }
  if ($active.IconsPath) { $entrypoints.icons = 'icons.json' }
  $theme | Add-Member -NotePropertyName schemaVersion -NotePropertyValue $schemaVersion -Force
  $theme | Add-Member -NotePropertyName entrypoints -NotePropertyValue ([pscustomobject]$entrypoints) -Force
  Write-DreamSkinTheme -ThemeDirectory $destination -Theme $theme
  $install = [ordered]@{
    schemaVersion = 1
    default = $false
    manifest = 'theme.json'
    files = @('theme.json', 'theme.css', 'theme.js') + $(if ($active.IconsPath) { @('icons.json') } else { @() }) + @($imageName)
    pets = $(if ($theme.pet) { @("$($theme.pet.id)") } else { @() })
  }
  Write-DreamSkinUtf8FileAtomically -Path (Join-Path $destination 'install.json') `
    -Content (($install | ConvertTo-Json -Depth 8) + "`r`n")
  return Read-DreamSkinTheme -ThemeDirectory $destination
}

function Get-DreamSkinSavedThemes {
  param(
    [string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'),
    [switch]$SkipImageMetadata
  )
  $paths = Get-DreamSkinThemePaths -StateRoot $StateRoot
  Ensure-DreamSkinManagedDirectory -Path $paths.Root -Root $paths.Root
  Ensure-DreamSkinManagedDirectory -Path $paths.Saved -Root $paths.Root
  if (-not (Test-Path -LiteralPath $paths.Saved -PathType Container)) { return @() }
  $themes = @()
  foreach ($directory in Get-ChildItem -LiteralPath $paths.Saved -Directory -ErrorAction SilentlyContinue) {
    try {
      $loaded = Read-DreamSkinTheme -ThemeDirectory $directory.FullName -SkipImageMetadata:$SkipImageMetadata
      $themes += [pscustomobject]@{
        Id = "$($loaded.Theme.id)"
        Name = if ($loaded.Theme.name) { "$($loaded.Theme.name)" } else { $directory.Name }
        Path = $directory.FullName
      }
    } catch {}
  }
  return @($themes | Sort-Object Name)
}

function Use-DreamSkinSavedTheme {
  param(
    [Parameter(Mandatory = $true)][string]$ThemeDirectory,
    [string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin')
  )
  $paths = Get-DreamSkinThemePaths -StateRoot $StateRoot
  Ensure-DreamSkinManagedDirectory -Path $paths.Root -Root $paths.Root
  Ensure-DreamSkinManagedDirectory -Path $paths.Saved -Root $paths.Root
  $directory = [System.IO.Path]::GetFullPath($ThemeDirectory)
  if (-not (Test-DreamSkinThemePathWithin -Path $directory -Root $paths.Saved)) {
    throw 'Saved theme must remain inside the Dream Skin themes folder.'
  }
  $saved = Read-DreamSkinTheme -ThemeDirectory $directory
  $theme = $saved.Theme | ConvertTo-Json -Depth 8 | ConvertFrom-Json
  Copy-Item -LiteralPath $saved.CssPath -Destination (Join-Path $paths.Active 'theme.css') -Force
  Copy-Item -LiteralPath $saved.RendererPath -Destination (Join-Path $paths.Active 'theme.js') -Force
  if ($saved.IconsPath) {
    Copy-Item -LiteralPath $saved.IconsPath -Destination (Join-Path $paths.Active 'icons.json') -Force
  } else {
    Remove-Item -LiteralPath (Join-Path $paths.Active 'icons.json') -Force -ErrorAction SilentlyContinue
  }
  Copy-DreamSkinThemePetBundle -SourceDirectory $directory -DestinationDirectory $paths.Active -ManagedRoot $paths.Root
  $schemaVersion = if ($saved.IconsPath) { 3 } else { 2 }
  $entrypoints = [ordered]@{ css = 'theme.css'; renderer = 'theme.js' }
  if ($saved.IconsPath) { $entrypoints.icons = 'icons.json' }
  $theme | Add-Member -NotePropertyName schemaVersion -NotePropertyValue $schemaVersion -Force
  $theme | Add-Member -NotePropertyName entrypoints -NotePropertyValue ([pscustomobject]$entrypoints) -Force
  return Set-DreamSkinActiveTheme -ImagePath $saved.ImagePath -Theme $theme -StateRoot $StateRoot
}

function Set-DreamSkinPaused {
  param(
    [Parameter(Mandatory = $true)][bool]$Paused,
    [string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin')
  )
  $paths = Get-DreamSkinThemePaths -StateRoot $StateRoot
  Ensure-DreamSkinManagedDirectory -Path $paths.Root -Root $paths.Root
  if ($Paused) {
    Assert-DreamSkinNoReparseComponents -Path $paths.PauseFile
    Write-DreamSkinUtf8FileAtomically -Path $paths.PauseFile -Content "paused`r`n"
  } else {
    if (Test-Path -LiteralPath $paths.PauseFile) { Assert-DreamSkinNoReparseComponents -Path $paths.PauseFile }
    Remove-Item -LiteralPath $paths.PauseFile -Force -ErrorAction SilentlyContinue
  }
  return $Paused
}

function Test-DreamSkinPaused {
  param([string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'))
  return (Test-Path -LiteralPath (Get-DreamSkinThemePaths -StateRoot $StateRoot).PauseFile -PathType Leaf)
}
