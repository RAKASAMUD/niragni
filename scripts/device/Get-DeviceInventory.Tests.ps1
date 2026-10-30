#requires -Version 5.1
<#
.SYNOPSIS
    Fake-adb tests for Get-DeviceInventory.ps1. No real device is ever accessed.

.DESCRIPTION
    Drives the real inventory script against scripts/device/fake-adb.cmd, which
    echoes canned adb output controlled by env vars. Covers:
      1. unauthorized  -> fail closed (state != device)
      2. offline       -> fail closed (state != device)
      3. substring     -> fail closed (serial is only a substring, not exact)
      4. success       -> JSON report with kernel-usable RAM + swap separated
      5. error         -> required shell command fails -> throw, no error string
                          recorded as an OS value

    Self-contained: no Pester required. Prints PASS/FAIL per case and exits 1 if
    any case fails.
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$here      = Split-Path -Parent $MyInvocation.MyCommand.Path
$script    = Join-Path $here 'Get-DeviceInventory.ps1'
$fakeAdb   = Join-Path $here 'fake-adb.cmd'
$targetSerial = 'ABCD1234'

if (-not (Test-Path $script))  { throw "Missing $script" }
if (-not (Test-Path $fakeAdb)) { throw "Missing $fakeAdb" }

$results = New-Object System.Collections.Generic.List[object]

function Invoke-Case {
    param(
        [string]$Name,
        [string]$DevicesOut,       # canned `adb devices` body (one entry line)
        [string]$FailCmd,          # shell token forced to fail, or ''
        [string]$Serial,           # serial passed to the script
        [ValidateSet('throw', 'ok')] [string]$Expect,
        [scriptblock]$Assert       # optional extra assertion on $stdout (ok case)
    )
    $env:FAKE_ADB_DEVICES_OUT  = $DevicesOut
    if ($FailCmd) { $env:FAKE_ADB_SHELL_FAILCMD = $FailCmd } else { Remove-Item Env:FAKE_ADB_SHELL_FAILCMD -ErrorAction SilentlyContinue }

    $threw  = $false
    $errMsg = $null
    $stdout = $null
    try {
        $stdout = & $script -AdbPath $fakeAdb -Serial $Serial 2>&1 | Out-String
    }
    catch {
        $threw  = $true
        $errMsg = $_.Exception.Message
    }
    finally {
        Remove-Item Env:FAKE_ADB_DEVICES_OUT    -ErrorAction SilentlyContinue
        Remove-Item Env:FAKE_ADB_SHELL_FAILCMD  -ErrorAction SilentlyContinue
    }

    $pass = $false
    $detail = ''
    if ($Expect -eq 'throw') {
        # The script uses $ErrorActionPreference='Stop'; a thrown terminating
        # error may surface either as a caught exception or as an error record
        # in the merged stream. Accept either, as long as no JSON was produced.
        $errText = if ($threw) { $errMsg } else { $stdout }
        $producedJson = ($stdout -and ($stdout -match '"collectedAtUtc"'))
        $pass = (-not $producedJson) -and ($threw -or ($stdout -match 'error|not found|state|refusing|failed'))
        $detail = if ($threw) { "threw: $errMsg" } else { "no-throw stream: $([regex]::Replace(($stdout.Trim()),'\s+',' '))" }
    }
    else {
        if ($threw) {
            $pass = $false
            $detail = "unexpected throw: $errMsg"
        }
        else {
            $pass = $true
            if ($Assert) {
                try { & $Assert $stdout } catch { $pass = $false; $detail = "assert failed: $($_.Exception.Message)" }
            }
            if ($pass) { $detail = 'report produced + assertions ok' }
        }
    }

    $status = if ($pass) { 'PASS' } else { 'FAIL' }
    Write-Host ("[{0}] {1} - {2}" -f $status, $Name, $detail)
    $results.Add([pscustomobject]@{ Name = $Name; Pass = $pass; Detail = $detail })
}

# 1. unauthorized device -> fail closed
Invoke-Case -Name 'unauthorized' -DevicesOut "$targetSerial`tunauthorized" -FailCmd '' -Serial $targetSerial -Expect 'throw'

# 2. offline device -> fail closed
Invoke-Case -Name 'offline' -DevicesOut "$targetSerial`toffline" -FailCmd '' -Serial $targetSerial -Expect 'throw'

# 3. substring serial mismatch: device present is a SUPERSTRING of the target,
#    so a substring match would wrongly succeed; exact match must reject it.
Invoke-Case -Name 'substring-mismatch' -DevicesOut "${targetSerial}EXTRA`tdevice" -FailCmd '' -Serial $targetSerial -Expect 'throw'

# 4. successful collection -> JSON with kernel-usable RAM and separated swap
Invoke-Case -Name 'success' -DevicesOut "$targetSerial`tdevice" -FailCmd '' -Serial $targetSerial -Expect 'ok' -Assert {
    param($out)
    if ($out -notmatch '"kernelUsableRamMiB"')         { throw 'missing kernelUsableRamMiB' }
    if ($out -notmatch '"swapTotalMiB"')               { throw 'missing swapTotalMiB' }
    if ($out -notmatch '"androidRelease":\s*"14"')     { throw 'androidRelease not 14' }
    if ($out -notmatch '"primaryAbi":\s*"arm64-v8a"')  { throw 'primaryAbi not arm64-v8a' }
    # 11923456 KiB / 1024 = 11644 MiB ; 6291456 / 1024 = 6144 MiB
    if ($out -notmatch '"kernelUsableRamMiB":\s*11644'){ throw 'RAM math wrong (expected 11644 MiB)' }
    if ($out -notmatch '"swapTotalMiB":\s*6144')       { throw 'swap math wrong (expected 6144 MiB)' }
    # swap must NOT be folded into RAM
    if ($out -match '"kernelUsableRamMiB":\s*17788')   { throw 'swap wrongly added to RAM' }
}

# 5. required command fails -> throw; no adb error string becomes an OS value
Invoke-Case -Name 'required-cmd-error' -DevicesOut "$targetSerial`tdevice" -FailCmd 'ro.build.version.release' -Serial $targetSerial -Expect 'throw' -Assert {
    param($out)
    if ($out -match '"androidRelease":\s*"ERROR') { throw 'error string leaked into androidRelease' }
}

$failed = @($results | Where-Object { -not $_.Pass })
Write-Host ''
Write-Host ("Total: {0}  Passed: {1}  Failed: {2}" -f $results.Count, ($results.Count - $failed.Count), $failed.Count)
if ($failed.Count -gt 0) {
    exit 1
}
exit 0
