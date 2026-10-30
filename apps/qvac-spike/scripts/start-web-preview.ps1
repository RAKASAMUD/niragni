# Loopback-only Niragni WEB PREVIEW launcher (DEMO / UI PREVIEW).
# Serves the exported static web build (dist-web) via an owned Node HTTP server
# bound EXPLICITLY to 127.0.0.1 (IPv4 loopback) — no LAN, no tunnel, no cloud.
# Used for coordinator browser review. Stop with Ctrl+C.
$ErrorActionPreference = "Stop"
$env:PATH = "C:\Belajar\Sem5\Niragni\.tools\node-v22.21.1-win-x64;" + $env:PATH
Set-Location "C:\Belajar\Sem5\Niragni\apps\qvac-spike"
& node scripts/serve-web-preview.mjs 8082
