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
  $cssEntry = if ($theme.entrypoints -and $theme.entrypoints.css) { "$($theme.entrypoints.css)" } else { 'theme.css' }
  $rendererEntry = if ($theme.entrypoints -and $theme.entrypoints.renderer) { "$($theme.entrypoints.renderer)" } else { 'theme.js' }
  if ([System.IO.Path]::IsPathRooted($cssEntry) -or [System.IO.Path]::GetExtension($cssEntry) -cne '.css') {
    throw 'Theme CSS entrypoint must be a relative .css path.'
  }
  if ([System.IO.Path]::IsPathRooted($rendererEntry) -or [System.IO.Path]::GetExtension($rendererEntry) -cne '.js') {
    throw 'Theme renderer entrypoint must be a relative .js path.'
  }
  $cssPath = [System.IO.Path]::GetFullPath((Join-Path $directory $cssEntry))
  $rendererPath = [System.IO.Path]::GetFullPath((Join-Path $directory $rendererEntry))
  foreach ($codePath in @($cssPath, $rendererPath)) {
    if (-not (Test-DreamSkinThemePathWithin -Path $codePath -Root $directory) -or
      -not (Test-Path -LiteralPath $codePath -PathType Leaf)) {
      throw 'Theme code entrypoints must remain inside the theme directory and exist.'
    }
  }
  return [pscustomobject]@{
    Directory = $directory
    ThemePath = $themePath
    ImagePath = $imagePath
    CssPath = $cssPath
    RendererPath = $rendererPath
    Theme = $theme
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

function Copy-DreamSkinThemeBundleFiles {
  param(
    [Parameter(Mandatory = $true)][string]$SourceDirectory,
    [Parameter(Mandatory = $true)][string]$DestinationDirectory,
    [Parameter(Mandatory = $true)][string]$ManagedRoot
  )
  Ensure-DreamSkinManagedDirectory -Path $DestinationDirectory -Root $ManagedRoot
  foreach ($name in @('theme.json', 'theme.css', 'theme.js', 'background.jpg')) {
    $source = Join-Path $SourceDirectory $name
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Bundled theme file is missing: $source" }
    $destination = Join-Path $DestinationDirectory $name
    Assert-DreamSkinNoReparseComponents -Path $destination
    Copy-Item -LiteralPath $source -Destination $destination -Force
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
  if (Test-Path -LiteralPath $destinationPets) {
    if (-not (Test-DreamSkinThemePathWithin -Path $destinationPets -Root $ManagedRoot)) { throw 'Theme pet destination escaped the managed theme store.' }
    Remove-Item -LiteralPath $destinationPets -Recurse -Force
  }
  if (-not $sourceTheme.pet) { return }
  $petId = "$($sourceTheme.pet.id)"
  $relativeDirectory = "$($sourceTheme.pet.directory)"
  if ($petId -notmatch '^[A-Za-z0-9._-]{1,80}$' -or [System.IO.Path]::IsPathRooted($relativeDirectory)) {
    throw 'Bundled theme pet metadata is invalid.'
  }
  $sourcePet = [System.IO.Path]::GetFullPath((Join-Path $SourceDirectory $relativeDirectory))
  if (-not (Test-DreamSkinThemePathWithin -Path $sourcePet -Root $SourceDirectory)) { throw 'Bundled theme pet escaped its theme directory.' }
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
  $destinationPet = Join-Path $destinationPets $petId
  Ensure-DreamSkinManagedDirectory -Path $destinationPet -Root $ManagedRoot
  $destinationSheet = Join-Path $destinationPet $spritesheetName
  New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($destinationSheet)) | Out-Null
  Copy-Item -LiteralPath $spritesheetPath -Destination $destinationSheet -Force
  Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $destinationPet 'pet.json') -Force
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
  if ($changed) { Write-DreamSkinTheme -ThemeDirectory $ThemeDirectory -Theme $theme }
}

function Initialize-DreamSkinThemeStore {
  param(
    [Parameter(Mandatory = $true)][string]$SkillRoot,
    [string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'),
    [switch]$ManagerOnly
  )
  $paths = Get-DreamSkinThemePaths -StateRoot $StateRoot
  foreach ($directory in @($paths.Root, $paths.Active, $paths.Saved, $paths.Images)) {
    Ensure-DreamSkinManagedDirectory -Path $directory -Root $paths.Root
  }
  $assetRoot = Join-Path $SkillRoot 'themes\yangyang-xuanling-official-v2'
  $assetImage = Join-Path $assetRoot 'background.jpg'
  Assert-DreamSkinImageFile -Path $assetImage
  $activeTheme = Join-Path $paths.Active 'theme.json'
  Assert-DreamSkinNoReparseComponents -Path $activeTheme
  if (-not (Test-Path -LiteralPath $activeTheme -PathType Leaf)) {
    Copy-DreamSkinThemeBundleFiles -SourceDirectory $assetRoot -DestinationDirectory $paths.Active -ManagedRoot $paths.Root
    $activeImage = Join-Path $paths.Active 'background.jpg'
    Assert-DreamSkinNoReparseComponents -Path $activeImage
    Assert-DreamSkinImageFile -Path $activeImage
    $imageArchive = Join-Path $paths.Images 'background.jpg'
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
    $presetDirectory = Join-Path $paths.Saved 'preset-xuanling-azure-plume'
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
  if ($active.Theme.pet) {
    Copy-DreamSkinThemePetBundle -SourceDirectory $paths.Active -DestinationDirectory $destination -ManagedRoot $paths.Root
  }
  Assert-DreamSkinNoReparseComponents -Path $destinationImage
  Assert-DreamSkinImageFile -Path $destinationImage
  $theme = $active.Theme | ConvertTo-Json -Depth 8 | ConvertFrom-Json
  $theme.id = $id
  $theme.name = $trimmed
  $theme.image = $imageName
  $theme | Add-Member -NotePropertyName schemaVersion -NotePropertyValue 2 -Force
  $theme | Add-Member -NotePropertyName entrypoints -NotePropertyValue `
    ([pscustomobject]@{ css = 'theme.css'; renderer = 'theme.js' }) -Force
  Write-DreamSkinTheme -ThemeDirectory $destination -Theme $theme
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
  Copy-DreamSkinThemePetBundle -SourceDirectory $directory -DestinationDirectory $paths.Active -ManagedRoot $paths.Root
  $theme | Add-Member -NotePropertyName schemaVersion -NotePropertyValue 2 -Force
  $theme | Add-Member -NotePropertyName entrypoints -NotePropertyValue `
    ([pscustomobject]@{ css = 'theme.css'; renderer = 'theme.js' }) -Force
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
