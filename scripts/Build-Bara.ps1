#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$AndroidSdk = "$env:LOCALAPPDATA\Android\Sdk",
  [string]$JavaHome = 'C:\Program Files\Android\Android Studio\jbr',
  [switch]$SkipPrebuild
)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$appRoot = Join-Path $projectRoot 'apps\qvac-spike'
$portableNode = Join-Path $projectRoot '.tools\node-v22.21.1-win-x64'
$ndkRoot = Join-Path $projectRoot '.tools\android-ndk-r29'
foreach ($requiredPath in @("$portableNode\node.exe", "$JavaHome\bin\java.exe", "$AndroidSdk\platform-tools\adb.exe", "$ndkRoot\source.properties")) {
  if (-not (Test-Path -LiteralPath $requiredPath)) { throw "Build prerequisite missing: $requiredPath" }
}
$env:PATH = "$portableNode;$JavaHome\bin;$env:PATH"
$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = $AndroidSdk
$env:ANDROID_SDK_ROOT = $AndroidSdk
$env:NODE_ENV = 'production'
$env:EXPO_NO_TELEMETRY = '1'
Push-Location $appRoot
try {
  if (-not $SkipPrebuild) {
    $nativeAndroidRoot = [IO.Path]::GetFullPath((Join-Path $appRoot 'android'))
    if ([IO.Path]::GetDirectoryName($nativeAndroidRoot) -ne [IO.Path]::GetFullPath($appRoot)) {
      throw 'Refusing prebuild: Android target is outside the app directory'
    }
    # Regenerate only this app's native Android project, preserving product TS source.
    & npx.cmd expo prebuild --platform android --no-install --clean
    if ($LASTEXITCODE -ne 0) { throw 'Expo Android prebuild failed' }
  }
  $sdkProperty = $AndroidSdk.Replace('\','/').Replace(':','\:')
  $ndkProperty = $ndkRoot.Replace('\','/').Replace(':','\:')
  [IO.File]::WriteAllText((Join-Path $appRoot 'android\local.properties'), "sdk.dir=$sdkProperty`nndk.dir=$ndkProperty`n", (New-Object Text.UTF8Encoding($false)))
  Push-Location (Join-Path $appRoot 'android')
  try {
    & .\gradlew.bat :app:assembleRelease --max-workers=2
    if ($LASTEXITCODE -ne 0) { throw 'Gradle assembleRelease failed' }
  } finally { Pop-Location }
  $apkSource = Join-Path $appRoot 'android\app\build\outputs\apk\release\app-release.apk'
  if (-not (Test-Path -LiteralPath $apkSource)) { throw 'Build completed without expected APK' }
  $artifactDirectory = Join-Path $projectRoot 'artifacts'
  New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
  $apkTarget = Join-Path $artifactDirectory 'bara-android.apk'
  Copy-Item -LiteralPath $apkSource -Destination $apkTarget -Force
  $digest = (Get-FileHash -LiteralPath $apkTarget -Algorithm SHA256).Hash
  [IO.File]::WriteAllText("$apkTarget.sha256", "$digest  bara-android.apk`n")
  Write-Output "APK: $apkTarget"
  Write-Output "SHA256: $digest"
} finally { Pop-Location }
