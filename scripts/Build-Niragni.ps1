#requires -Version 5.1
<#
  Build-Niragni.ps1 — compile-only Android release build for the Niragni app.

  Release signing (fail-closed): by default this produces a RELEASE APK signed
  with the local release keystore under %USERPROFILE%\.niragni\signing. The
  store/key password is read from a DPAPI (CurrentUser) encrypted file at build
  time and passed to Gradle ONLY via injected signing properties sourced from a
  process-scoped environment variable (never on the command line / argv, never
  logged, cleared afterward). If the keystore or its DPAPI password is missing
  or cannot be decrypted, the build FAILS CLOSED — it does NOT silently fall
  back to debug signing while claiming a release artifact.

  Pass -AllowDebugSigning only for an explicit, clearly-labeled debug-signed
  build; it must never be used to pass off a debug APK as a release.

  Does not install/uninstall, run tests, or contact devices.
#>
[CmdletBinding()]
param(
  [string]$AndroidSdk = "$env:LOCALAPPDATA\Android\Sdk",
  [string]$JavaHome = 'C:\Program Files\Android\Android Studio\jbr',
  [string]$SigningDir = (Join-Path $env:USERPROFILE '.niragni\signing'),
  [string]$KeyAlias = 'niragni',
  [switch]$AllowDebugSigning,
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

# --- Resolve release signing material up front and FAIL CLOSED if missing. ---
$keystorePath = Join-Path $SigningDir "$KeyAlias-release.jks"
$dpapiPath = Join-Path $SigningDir "$KeyAlias-release.store.dpapi"
$releaseSigning = $false
$signingPassword = $null
if (-not $AllowDebugSigning) {
  if (-not (Test-Path -LiteralPath $keystorePath)) {
    throw "Release signing material missing: keystore not found at '$keystorePath'. Refusing to debug-sign a release. (Use -AllowDebugSigning only for an explicit debug build.)"
  }
  if (-not (Test-Path -LiteralPath $dpapiPath)) {
    throw "Release signing material missing: DPAPI password file not found at '$dpapiPath'. Refusing to debug-sign a release."
  }
  try {
    Add-Type -AssemblyName System.Security
    $enc = [IO.File]::ReadAllBytes($dpapiPath)
    $plain = [System.Security.Cryptography.ProtectedData]::Unprotect($enc, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    $signingPassword = [System.Text.Encoding]::UTF8.GetString($plain)
    [Array]::Clear($plain, 0, $plain.Length)
  } catch {
    throw "Release signing failed closed: could not decrypt the DPAPI store password (it is tied to THIS Windows user profile). Build aborted rather than producing an unsigned/debug release. Detail: $($_.Exception.Message)"
  }
  if ([string]::IsNullOrEmpty($signingPassword)) {
    throw "Release signing failed closed: decrypted store password was empty."
  }
  $releaseSigning = $true
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
    if ($releaseSigning) {
      # Pass signing material to Gradle via ORG_GRADLE_PROJECT_* environment
      # project properties (Gradle maps ORG_GRADLE_PROJECT_<name> -> project
      # property <name>). The property names contain dots, which are set on the
      # PROCESS environment via the .NET API. Nothing (especially the password)
      # is placed on the command line; env is cleared in finally. --no-daemon
      # ensures no background daemon retains the secret.
      # Ref: https://docs.gradle.org/current/userguide/project_properties.html
      [Environment]::SetEnvironmentVariable('ORG_GRADLE_PROJECT_android.injected.signing.store.file', $keystorePath, 'Process')
      [Environment]::SetEnvironmentVariable('ORG_GRADLE_PROJECT_android.injected.signing.store.password', $signingPassword, 'Process')
      [Environment]::SetEnvironmentVariable('ORG_GRADLE_PROJECT_android.injected.signing.key.alias', $KeyAlias, 'Process')
      [Environment]::SetEnvironmentVariable('ORG_GRADLE_PROJECT_android.injected.signing.key.password', $signingPassword, 'Process')
      try {
        & .\gradlew.bat ':app:assembleRelease' '--max-workers=2' '--no-daemon'
        if ($LASTEXITCODE -ne 0) { throw 'Gradle assembleRelease (release-signed) failed' }
      } finally {
        foreach ($n in @(
          'ORG_GRADLE_PROJECT_android.injected.signing.store.file',
          'ORG_GRADLE_PROJECT_android.injected.signing.store.password',
          'ORG_GRADLE_PROJECT_android.injected.signing.key.alias',
          'ORG_GRADLE_PROJECT_android.injected.signing.key.password'
        )) { [Environment]::SetEnvironmentVariable($n, $null, 'Process') }
      }
    } else {
      Write-Warning 'Building with DEBUG signing (-AllowDebugSigning). This APK is NOT a release artifact.'
      & .\gradlew.bat ':app:assembleRelease' '--max-workers=2' '--no-daemon'
      if ($LASTEXITCODE -ne 0) { throw 'Gradle assembleRelease (debug-signed) failed' }
    }
  } finally { Pop-Location }

  $apkSource = Join-Path $appRoot 'android\app\build\outputs\apk\release\app-release.apk'
  if (-not (Test-Path -LiteralPath $apkSource)) { throw 'Build completed without expected APK' }
  $artifactDirectory = Join-Path $projectRoot 'artifacts'
  New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
  $apkTarget = Join-Path $artifactDirectory 'niragni-android.apk'
  Copy-Item -LiteralPath $apkSource -Destination $apkTarget -Force
  $digest = (Get-FileHash -LiteralPath $apkTarget -Algorithm SHA256).Hash
  [IO.File]::WriteAllText("$apkTarget.sha256", "$digest  niragni-android.apk`n")
  Write-Output "APK: $apkTarget"
  Write-Output "SHA256: $digest"
  Write-Output ("Signing: " + $(if ($releaseSigning) { "RELEASE (keystore $keystorePath, alias $KeyAlias)" } else { "DEBUG (explicit -AllowDebugSigning)" }))
} finally {
  Pop-Location
  $signingPassword = $null
  [GC]::Collect()
}
