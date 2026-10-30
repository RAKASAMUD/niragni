# Loopback-only server for the redesigned-UI web review (dist-ui-review) on 8083.
# Separate from the user's dist-web preview (8082) so it is never disturbed.
$ErrorActionPreference = "Stop"
$env:PATH = "C:\Belajar\Sem5\Niragni\.tools\node-v22.21.1-win-x64;" + $env:PATH
Set-Location "C:\Belajar\Sem5\Niragni\apps\qvac-spike"
& node scripts/serve-ui-review.mjs 8083
