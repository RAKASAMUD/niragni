#requires -Version 5.1
<#
.SYNOPSIS
    Read-only Android device inventory for the Bara / QVAC spike feasibility gate.

.DESCRIPTION
    Collects OS/HyperOS/build/ABI, kernel-usable RAM (from /proc/meminfo
    MemTotal), swap (shown separately), free app-private storage, and a
    thermal/battery baseline from an attached Android device over adb.

    This script is READ-ONLY by design. It never pushes, installs, uninstalls,
    reboots, writes files to the device, changes settings, or collects personal
    data (no IMEI/serial-as-identity, no accounts, no contacts, no location,
    no photos, no clipboard). Every adb invocation is `adb ... shell <getter>`
    using only query commands (getprop, cat /proc/*, dumpsys <service>, df).

    Fail-closed: the target serial must appear in `adb devices` with state
    exactly `device` (not `unauthorized` / `offline` / `no permissions`), matched
    as a WHOLE token (no substring match). Required collection commands throw on
    non-zero adb exit so an adb error string is never recorded as a valid OS,
    RAM, or storage value.

    It does NOT prove QVAC compatibility or inference success. Mali-G615 (Xiaomi
    14T) is NOT an Adreno 700+ part, so the QVAC OpenCL path does not apply; the
    Vulkan path must be proven by actual on-device testing, never inferred here.

.PARAMETER AdbPath
    Explicit path to the adb executable (e.g. C:\platform-tools\adb.exe).
    Required so the script never guesses a toolchain location.

.PARAMETER Serial
    Explicit device serial (as shown by `adb devices`). Matched as a whole token
    with state `device`. Required so the script targets exactly one authorized
    device and never acts on an unintended one.

.PARAMETER OutFile
    Optional path to write the sanitized report as JSON. If omitted, output is
    written to the console only.

.EXAMPLE
    .\Get-DeviceInventory.ps1 -AdbPath 'C:\platform-tools\adb.exe' -Serial ABCD1234

.EXAMPLE
    .\Get-DeviceInventory.ps1 -AdbPath 'C:\platform-tools\adb.exe' -Serial ABCD1234 -OutFile .\device-evidence\inventory.json

.NOTES
    Syntax and the serial/state guards are verified without a real device by the
    fake-adb tests in scripts/device/Get-DeviceInventory.Tests.ps1. See
    work/reports/kiro-audit.md for the recorded test evidence.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$AdbPath,

    [Parameter(Mandatory = $true)]
    [string]$Serial,

    [Parameter(Mandatory = $false)]
    [string]$OutFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-AdbAvailable {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "adb not found at '$Path'. Pass -AdbPath to the real platform-tools adb.exe."
    }
}

function Assert-DeviceReady {
    <#
        Parse `adb devices` and require the EXACT serial as a whole token with
        state `device`. Fail closed on unauthorized/offline/missing. Returns
        nothing; throws with a precise reason on any non-ready state.

        `adb devices` lines look like:
            List of devices attached
            ABCD1234        device
            EF567890        unauthorized
            0A1B2C3D        offline
    #>
    param(
        [Parameter(Mandatory = $true)][string]$AdbExe,
        [Parameter(Mandatory = $true)][string]$TargetSerial
    )
    $out = & $AdbExe 'devices' 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "``adb devices`` failed (exit $LASTEXITCODE): $(($out -join "`n"))"
    }
    $lines = ($out -join "`n") -split "`n"
    $state = $null
    foreach ($line in $lines) {
        $t = $line.Trim()
        if ($t -eq '' -or $t -match '^List of devices') { continue }
        # Split on whitespace: column 0 = serial (whole token), column 1 = state.
        $cols = $t -split '\s+'
        if ($cols.Count -lt 2) { continue }
        if ($cols[0] -ceq $TargetSerial) {
            $state = $cols[1]
            break
        }
    }
    if ($null -eq $state) {
        throw "Serial '$TargetSerial' not found as a connected device in ``adb devices``. Connect the exact device."
    }
    if ($state -ne 'device') {
        throw "Serial '$TargetSerial' is present but state is '$state' (expected 'device'). Authorize/reconnect the device; refusing to collect."
    }
}

function Invoke-AdbShell {
    <#
        Runs a single read-only `adb -s <serial> shell <command>`.
        Arguments are passed as an array (no string interpolation into a shell
        line) to avoid command injection.

        -Required : throw on non-zero adb exit (used for fields that must not be
                    populated with an error string, e.g. OS/RAM/storage).
        default   : return a sanitized "ERROR(...)" marker on failure (used for
                    optional/diagnostic fields only).
    #>
    param(
        [Parameter(Mandatory = $true)][string[]]$ShellArgs,
        [switch]$Required
    )
    $argList = @('-s', $Serial, 'shell') + $ShellArgs
    $raw = & $AdbPath @argList 2>&1
    if ($LASTEXITCODE -ne 0) {
        $msg = "adb shell '$($ShellArgs -join ' ')' failed (exit $LASTEXITCODE): $(($raw -join "`n"))"
        if ($Required) { throw $msg }
        return "ERROR: $msg"
    }
    return ($raw -join "`n").Trim()
}

function Get-Prop {
    param(
        [string]$Key,
        [switch]$Required
    )
    return (Invoke-AdbShell -ShellArgs @('getprop', $Key) -Required:$Required)
}

function ConvertTo-KiB {
    # Parse a "/proc/meminfo"-style "<label>: <num> kB" value into an integer KiB.
    param([string]$Line)
    if ($Line -match '(\d+)\s*kB') { return [int64]$Matches[1] }
    return $null
}

Test-AdbAvailable -Path $AdbPath

# Fail closed unless the exact serial is connected AND authorized (state=device).
Assert-DeviceReady -AdbExe $AdbPath -TargetSerial $Serial

# ---- OS / HyperOS / build / ABI (getprop is read-only) -------------------
# Core identity is Required: an adb error must abort, not masquerade as an OS value.
$osRelease     = Get-Prop 'ro.build.version.release' -Required
$sdkInt        = Get-Prop 'ro.build.version.sdk'     -Required
$securityPatch = Get-Prop 'ro.build.version.security_patch'
$buildId       = Get-Prop 'ro.build.id'
$buildFinger   = Get-Prop 'ro.build.fingerprint'
$model         = Get-Prop 'ro.product.model' -Required
$brand         = Get-Prop 'ro.product.brand'
$abiList       = Get-Prop 'ro.product.cpu.abilist'
$primaryAbi    = Get-Prop 'ro.product.cpu.abi' -Required
# HyperOS / MIUI version markers (Xiaomi). Any may be empty on non-Xiaomi.
$hyperOsVer    = Get-Prop 'ro.mi.os.version.name'
$hyperOsCode   = Get-Prop 'ro.mi.os.version.code'
$miuiVer       = Get-Prop 'ro.miui.ui.version.name'

# ---- Kernel-usable RAM from /proc/meminfo (MemTotal); swap shown separately
$memInfo = Invoke-AdbShell -ShellArgs @('cat', '/proc/meminfo') -Required
$memTotalKiB  = $null
$swapTotalKiB = $null
foreach ($l in ($memInfo -split "`n")) {
    if ($l -match '^MemTotal')  { $memTotalKiB  = ConvertTo-KiB $l }
    if ($l -match '^SwapTotal') { $swapTotalKiB = ConvertTo-KiB $l }
}
if ($null -eq $memTotalKiB) {
    throw "Could not parse MemTotal from /proc/meminfo; refusing to report RAM."
}
# MemTotal is the kernel's view of usable RAM after firmware/carveout
# reservations. It is NOT the exact marketed physical capacity (e.g. a
# "12 GB" device typically reports less). SwapTotal is reported separately:
# on Xiaomi this often includes zram and the "memory extension" feature, but
# this script does NOT assume ALL swap is memory extension. Neither swap nor
# memory extension counts toward the inference RAM budget.
$kernelUsableRamMiB = [math]::Round($memTotalKiB / 1024, 0)
$swapTotalMiB       = if ($null -ne $swapTotalKiB) { [math]::Round($swapTotalKiB / 1024, 0) } else { $null }

# ---- Free app-private storage --------------------------------------------
# /data is the app-private partition. `df` is read-only and Required.
$dfData = Invoke-AdbShell -ShellArgs @('df', '-h', '/data') -Required

# ---- Thermal / battery baseline (diagnostic; not fatal if unavailable) ----
$battery = Invoke-AdbShell -ShellArgs @('dumpsys', 'battery')
$batteryLevel = $null
$batteryTempC = $null
foreach ($l in ($battery -split "`n")) {
    if ($l -match 'level:\s*(\d+)')       { $batteryLevel = [int]$Matches[1] }
    if ($l -match 'temperature:\s*(\d+)') { $batteryTempC = [math]::Round(([int]$Matches[1]) / 10.0, 1) }
}
$thermal = Invoke-AdbShell -ShellArgs @('dumpsys', 'thermalservice')

# ---- Assemble sanitized report -------------------------------------------
$report = [ordered]@{
    collectedAtUtc   = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    adbPath          = $AdbPath
    note             = 'Read-only inventory. No identifiers/personal data. Not proof of QVAC compatibility.'
    os = [ordered]@{
        androidRelease   = $osRelease
        sdkInt           = $sdkInt
        securityPatch    = $securityPatch
        buildId          = $buildId
        buildFingerprint = $buildFinger
        hyperOsName      = $hyperOsVer
        hyperOsCode      = $hyperOsCode
        miuiVersion      = $miuiVer
    }
    hardware = [ordered]@{
        brand        = $brand
        model        = $model
        primaryAbi   = $primaryAbi
        abiList      = $abiList
    }
    memory = [ordered]@{
        kernelUsableRamMiB = $kernelUsableRamMiB
        kernelUsableRamNote = 'MemTotal from /proc/meminfo: kernel-usable RAM after carveouts; NOT exact marketed physical capacity.'
        swapTotalMiB       = $swapTotalMiB
        swapNote           = 'SwapTotal may include zram and Xiaomi memory extension; not assumed to be entirely memory extension; excluded from inference RAM budget.'
        rawMemInfo         = ($memInfo -split "`n" | Where-Object { $_ -match '^MemTotal|^SwapTotal' }) -join '; '
    }
    storage = [ordered]@{
        dataPartitionDf = $dfData
    }
    power = [ordered]@{
        batteryLevelPct   = $batteryLevel
        batteryTempC      = $batteryTempC
        thermalServiceRaw = $thermal
    }
}

$json = $report | ConvertTo-Json -Depth 6

if ($OutFile) {
    $outDir = Split-Path -Parent $OutFile
    if ($outDir -and -not (Test-Path -LiteralPath $outDir)) {
        New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    }
    $json | Out-File -LiteralPath $OutFile -Encoding utf8
    Write-Host "Wrote sanitized inventory to $OutFile"
}
else {
    Write-Output $json
}
