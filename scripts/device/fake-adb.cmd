@echo off
REM Fake adb for testing Get-DeviceInventory.ps1 WITHOUT a real device.
REM Behavior is driven by env vars set by the test harness:
REM   FAKE_ADB_DEVICES_OUT  - verbatim text printed for `adb devices`
REM   FAKE_ADB_SHELL_FAILCMD - a getprop key / shell token that should fail (exit 1)
REM This script never touches any real device; it only echoes canned output.
setlocal enabledelayedexpansion

if "%~1"=="devices" (
    REM Print the canned device list (may be multi-line via the ^& separators).
    if defined FAKE_ADB_DEVICES_OUT (
        echo List of devices attached
        echo %FAKE_ADB_DEVICES_OUT%
    ) else (
        echo List of devices attached
    )
    exit /b 0
)

REM Expected shape for shell calls: -s <serial> shell <cmd> [args...]
REM %1=-s %2=<serial> %3=shell %4=<cmd> %5=<arg1> ...
if /i "%~3"=="shell" (
    set "CMD=%~4"
    set "ARG1=%~5"

    REM Optional forced failure for the "required command fails" scenario.
    if defined FAKE_ADB_SHELL_FAILCMD (
        if /i "!ARG1!"=="%FAKE_ADB_SHELL_FAILCMD%" (
            echo error: device offline 1>&2
            exit /b 1
        )
        if /i "!CMD!"=="%FAKE_ADB_SHELL_FAILCMD%" (
            echo error: device offline 1>&2
            exit /b 1
        )
    )

    if /i "!CMD!"=="getprop" (
        if "!ARG1!"=="ro.build.version.release" ( echo 14 & exit /b 0 )
        if "!ARG1!"=="ro.build.version.sdk" ( echo 34 & exit /b 0 )
        if "!ARG1!"=="ro.build.version.security_patch" ( echo 2026-09-01 & exit /b 0 )
        if "!ARG1!"=="ro.build.id" ( echo UP1A.231005.007 & exit /b 0 )
        if "!ARG1!"=="ro.build.fingerprint" ( echo Xiaomi/aristotle_id/aristotle:14/UP1A/test:user/release-keys & exit /b 0 )
        if "!ARG1!"=="ro.product.model" ( echo 23127PN0CG & exit /b 0 )
        if "!ARG1!"=="ro.product.brand" ( echo Xiaomi & exit /b 0 )
        if "!ARG1!"=="ro.product.cpu.abilist" ( echo arm64-v8a,armeabi-v7a,armeabi & exit /b 0 )
        if "!ARG1!"=="ro.product.cpu.abi" ( echo arm64-v8a & exit /b 0 )
        if "!ARG1!"=="ro.mi.os.version.name" ( echo OS2.0.3.0 & exit /b 0 )
        if "!ARG1!"=="ro.mi.os.version.code" ( echo 2.0.3.0 & exit /b 0 )
        if "!ARG1!"=="ro.miui.ui.version.name" ( echo V816 & exit /b 0 )
        REM Unknown prop: empty, success (matches real adb getprop).
        exit /b 0
    )

    if /i "!CMD!"=="cat" (
        echo MemTotal:       11923456 kB
        echo MemFree:         1048576 kB
        echo SwapTotal:       6291456 kB
        echo SwapFree:        6000000 kB
        exit /b 0
    )

    if /i "!CMD!"=="df" (
        echo Filesystem      Size  Used Avail Use%% Mounted on
        echo /dev/block/dm-0 220G   40G  180G  19%% /data
        exit /b 0
    )

    if /i "!CMD!"=="dumpsys" (
        if "!ARG1!"=="battery" (
            echo Current Battery Service state:
            echo   level: 87
            echo   temperature: 298
            exit /b 0
        )
        if "!ARG1!"=="thermalservice" (
            echo Thermal Status: 0
            exit /b 0
        )
        exit /b 0
    )

    exit /b 0
)

REM Any other invocation: succeed quietly.
exit /b 0
