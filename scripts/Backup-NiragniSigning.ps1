#requires -Version 5.1
<#
  Backup-NiragniSigning.ps1 — portable, passphrase-encrypted backup/restore of
  the Niragni Android RELEASE signing material.

  WHY: the real signing key lives at %USERPROFILE%\.niragni\signing\
  (niragni-release.jks) and its store password is encrypted with Windows DPAPI
  (CurrentUser). DPAPI is bound to THIS Windows account on THIS machine, so a
  plain copy of the .dpapi file is NOT a cross-machine/recoverable backup. This
  helper produces a PORTABLE encrypted backup that can be restored on another
  machine/account, protected by a HUMAN passphrase you supply interactively.

  CRYPTO (standard primitives only, no custom algorithm):
    - Key derivation: PBKDF2 (Rfc2898DeriveBytes, SHA-256, >=300k iterations),
      random 16-byte salt. Derives a 32-byte AES key + a 32-byte HMAC key.
    - Confidentiality: AES-256-CBC, random 16-byte IV.
    - Integrity/authenticity: HMAC-SHA256 over (magic||version||salt||iter||IV||
      ciphertext) — encrypt-then-MAC. Restore verifies the MAC (constant-time)
      BEFORE decrypting; a wrong passphrase or any tampering fails closed.
    (AES-GCM would be preferred but is unavailable on .NET Framework 4.8 / PS 5.1;
     encrypt-then-MAC with AES-CBC + HMAC-SHA256 is a standard authenticated
     composition.)

  SECURITY RULES (enforced here):
    - The passphrase is read ONLY via Read-Host -AsSecureString. It is NEVER a
      parameter, never printed, never written to disk/logs, and is zeroed from
      unmanaged memory after use.
    - The decrypted store password and raw key bytes are handled in-memory only,
      cleared in finally. Nothing secret is written except the single encrypted
      backup blob at the destination YOU choose.
    - This script does NOT upload anywhere, does NOT touch git, and refuses to
      write the backup inside the repository tree.
    - -DryRun uses a DISPOSABLE dummy key in a temp dir and never reads the real
      key — use it to prove the round-trip + passphrase flow safely.

  MODES:
    -Mode Backup   : encrypt the real signing material -> -OutFile (passphrase prompted twice)
    -Mode Restore  : decrypt -BackupFile -> -RestoreDir (passphrase prompted once)
    -Mode DryRun   : full encrypt+restore round-trip on a throwaway dummy key, verify match
    -Mode Verify   : print the public release cert SHA-256 fingerprint of the
                     current keystore (safe, non-secret) for identity confirmation
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Backup', 'Restore', 'DryRun', 'Verify')]
  [string]$Mode,
  [string]$SigningDir = (Join-Path $env:USERPROFILE '.niragni\signing'),
  [string]$KeyAlias = 'niragni',
  [string]$OutFile,       # Backup: destination .niragnibak (must be OUTSIDE the repo)
  [string]$BackupFile,    # Restore: source .niragnibak
  [string]$RestoreDir,    # Restore: where to write restored files (must be empty/new)
  [int]$Iterations = 300000
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security | Out-Null

$MAGIC = [System.Text.Encoding]::ASCII.GetBytes('NIRAGNIBAK')
$VERSION = [byte]1
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Read-Passphrase {
  param([string]$Prompt, [switch]$Confirm, [int]$MinLength = 10)
  $s1 = Read-Host -Prompt $Prompt -AsSecureString
  if ($s1.Length -lt $MinLength) { throw "Passphrase terlalu pendek (minimal $MinLength karakter)." }
  if ($Confirm) {
    $s2 = Read-Host -Prompt 'Ketik ulang passphrase untuk konfirmasi' -AsSecureString
    $b1 = [Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($s1)
    $b2 = [Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($s2)
    try {
      $p1 = [Runtime.InteropServices.Marshal]::PtrToStringUni($b1)
      $p2 = [Runtime.InteropServices.Marshal]::PtrToStringUni($b2)
      if ($p1 -ne $p2) { throw 'Passphrase tidak cocok. Dibatalkan.' }
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeGlobalAllocUnicode($b1)
      [Runtime.InteropServices.Marshal]::ZeroFreeGlobalAllocUnicode($b2)
    }
  }
  return $s1
}

function Get-PassphraseBytes {
  param([System.Security.SecureString]$Secure)
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($Secure)
  try {
    $str = [Runtime.InteropServices.Marshal]::PtrToStringUni($ptr)
    return [System.Text.Encoding]::UTF8.GetBytes($str)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeGlobalAllocUnicode($ptr)
  }
}

function Protect-Bundle {
  # Input: byte[] plaintext (a TAR-like length-prefixed concat), SecureString passphrase.
  # Output: byte[] portable encrypted blob (magic|ver|iter|salt|iv|ct|mac).
  param([byte[]]$Plaintext, [System.Security.SecureString]$Passphrase)
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $salt = New-Object byte[] 16; $rng.GetBytes($salt)
  $iv = New-Object byte[] 16; $rng.GetBytes($iv)
  $ppBytes = Get-PassphraseBytes $Passphrase
  try {
    $kdf = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($ppBytes, $salt, $Iterations, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
    try {
      $encKey = $kdf.GetBytes(32); $macKey = $kdf.GetBytes(32)
      $aes = [System.Security.Cryptography.Aes]::Create()
      $aes.KeySize = 256; $aes.Mode = 'CBC'; $aes.Padding = 'PKCS7'; $aes.Key = $encKey; $aes.IV = $iv
      $enc = $aes.CreateEncryptor()
      $ct = $enc.TransformFinalBlock($Plaintext, 0, $Plaintext.Length)
      $iterBytes = [BitConverter]::GetBytes([int]$Iterations)
      $authData = $MAGIC + @($VERSION) + $iterBytes + $salt + $iv + $ct
      $hmac = New-Object System.Security.Cryptography.HMACSHA256(, $macKey)
      $mac = $hmac.ComputeHash($authData)
      [Array]::Clear($encKey,0,32); [Array]::Clear($macKey,0,32)
      return $authData + $mac
    } finally { $kdf.Dispose() }
  } finally { [Array]::Clear($ppBytes,0,$ppBytes.Length) }
}

function Unprotect-Bundle {
  param([byte[]]$Blob, [System.Security.SecureString]$Passphrase)
  $mlen = $MAGIC.Length
  $minLen = $mlen + 1 + 4 + 16 + 16 + 32  # magic+ver+iter+salt+iv+mac, zero-length ct still needs these
  if ($Blob.Length -lt ($minLen + 1)) { throw 'Backup rusak/terpotong (terlalu pendek).' }
  $off = 0
  $magic = $Blob[0..($mlen-1)]; $off = $mlen
  if ((-join ($magic | ForEach-Object { [char]$_ })) -ne 'NIRAGNIBAK') { throw 'Format backup tidak dikenal.' }
  $ver = $Blob[$off]; $off += 1
  if ($ver -ne $VERSION) { throw "Versi backup tidak didukung: $ver" }
  $iter = [BitConverter]::ToInt32($Blob, $off); $off += 4
  # Bound the iteration count read from the UNTRUSTED header to prevent a DoS
  # (absurdly large value) or a weak-KDF downgrade.
  if ($iter -lt 100000 -or $iter -gt 5000000) { throw "Jumlah iterasi KDF di header di luar rentang aman: $iter" }
  $salt = $Blob[$off..($off+15)]; $off += 16
  $iv = $Blob[$off..($off+15)]; $off += 16
  $macLen = 32
  $ctLen = $Blob.Length - $off - $macLen
  if ($ctLen -le 0) { throw 'Backup rusak (panjang tidak valid).' }
  $ct = $Blob[$off..($off+$ctLen-1)]; $off += $ctLen
  $mac = $Blob[$off..($off+$macLen-1)]
  $ppBytes = Get-PassphraseBytes $Passphrase
  try {
    $kdf = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($ppBytes, $salt, $iter, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
    try {
      $encKey = $kdf.GetBytes(32); $macKey = $kdf.GetBytes(32)
      $authData = $Blob[0..($Blob.Length-$macLen-1)]
      $hmac = New-Object System.Security.Cryptography.HMACSHA256(, $macKey)
      $calc = $hmac.ComputeHash($authData)
      # constant-time compare
      $diff = 0; for ($i=0; $i -lt $macLen; $i++) { $diff = $diff -bor ($calc[$i] -bxor $mac[$i]) }
      if ($diff -ne 0) { throw 'Verifikasi MAC gagal: passphrase salah atau backup diubah. Dibatalkan sebelum dekripsi.' }
      $aes = [System.Security.Cryptography.Aes]::Create()
      $aes.KeySize = 256; $aes.Mode = 'CBC'; $aes.Padding = 'PKCS7'; $aes.Key = $encKey; $aes.IV = $iv
      $dec = $aes.CreateDecryptor()
      $pt = $dec.TransformFinalBlock($ct, 0, $ct.Length)
      [Array]::Clear($encKey,0,32); [Array]::Clear($macKey,0,32)
      return $pt
    } finally { $kdf.Dispose() }
  } finally { [Array]::Clear($ppBytes,0,$ppBytes.Length) }
}

# Simple length-prefixed container: [int nameLen][name][int dataLen][data] * N
function Pack-Files {
  param([hashtable]$Files)  # name -> byte[]
  $ms = New-Object System.IO.MemoryStream
  $bw = New-Object System.IO.BinaryWriter($ms)
  $bw.Write([int]$Files.Count)
  foreach ($k in $Files.Keys) {
    $nameB = [System.Text.Encoding]::UTF8.GetBytes($k)
    $bw.Write([int]$nameB.Length); $bw.Write($nameB)
    $bw.Write([int]$Files[$k].Length); $bw.Write($Files[$k])
  }
  $bw.Flush(); $out = $ms.ToArray(); $bw.Dispose(); $ms.Dispose(); return $out
}
function Unpack-Files {
  param([byte[]]$Data)
  $ms = New-Object System.IO.MemoryStream(,$Data)
  $br = New-Object System.IO.BinaryReader($ms)
  $n = $br.ReadInt32(); $res = @{}
  for ($i=0; $i -lt $n; $i++) {
    $nl = $br.ReadInt32(); $name = [System.Text.Encoding]::UTF8.GetString($br.ReadBytes($nl))
    $dl = $br.ReadInt32(); $res[$name] = $br.ReadBytes($dl)
  }
  $br.Dispose(); $ms.Dispose(); return $res
}

function Assert-OutsideRepo {
  param([string]$Path)
  $full = [IO.Path]::GetFullPath($Path)
  if ($full.StartsWith($repoRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Menolak menulis backup di dalam repo ('$full'). Pilih tujuan di luar repositori (mis. drive terenkripsi)."
  }
}

function New-FileNoOverwrite {
  # Atomically create a new file (fails if it already exists) and write bytes.
  # CreateNew avoids a TOCTOU race vs. Test-Path then write.
  param([string]$Path, [byte[]]$Bytes)
  $fs = $null
  try {
    $fs = [System.IO.File]::Open($Path, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    $fs.Write($Bytes, 0, $Bytes.Length)
  } catch [System.IO.IOException] {
    throw "Menolak menimpa berkas yang sudah ada: '$Path'. Pilih nama/tujuan lain."
  } finally {
    if ($fs) { $fs.Dispose() }
  }
}

function Set-PrivateAcl {
  # FAIL-CLOSED: tighten the ACL so only the current user + SYSTEM have access,
  # and THROW if that cannot be achieved. Returning on failure (the previous
  # fail-OPEN behaviour that only warned) would let the caller write the
  # keystore + store password into a directory with inherited/broad permissions,
  # exposing the secret. Callers (Restore) must invoke this BEFORE writing any
  # secret and must not proceed if it throws.
  param([string]$Path)
  try {
    $acl = Get-Acl $Path
    $acl.SetAccessRuleProtection($true, $false)   # disable inheritance, drop inherited ACEs
    # Remove any explicit ACEs that may already be present so only our allowlist remains.
    foreach ($existing in @($acl.Access)) {
      if (-not $existing.IsInherited) { [void]$acl.RemoveAccessRule($existing) }
    }
    $me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $isDir = (Get-Item $Path) -is [System.IO.DirectoryInfo]
    $inherit = if ($isDir) { 'ContainerInherit,ObjectInherit' } else { 'None' }
    foreach ($id in @($me, 'NT AUTHORITY\SYSTEM')) {
      $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($id, 'FullControl', $inherit, 'None', 'Allow')
      $acl.AddAccessRule($rule)
    }
    Set-Acl -Path $Path -AclObject $acl

    # Verify the applied ACL is actually locked down: inheritance protected and
    # no identity outside {current user, SYSTEM, Administrators} has access.
    $check = Get-Acl $Path
    if (-not $check.AreAccessRulesProtected) {
      throw "ACL inheritance masih aktif pada '$Path' setelah pengetatan."
    }
    $allowed = @($me.ToLowerInvariant(), 'nt authority\system', 'builtin\administrators')
    foreach ($ace in $check.Access) {
      $who = ("$($ace.IdentityReference)").ToLowerInvariant()
      if ($allowed -notcontains $who) {
        throw "Identitas tak terduga masih punya akses ke '$Path': $who"
      }
    }
  } catch {
    # Fail closed: do NOT continue to write secrets into a dir we could not secure.
    throw "Gagal memperketat ACL pada '$Path' (dibatalkan sebelum menulis rahasia): $($_.Exception.Message)"
  }
}

function Write-RestoredSecrets {
  # Shared production path for materializing restored secrets. Used by BOTH
  # `Mode Restore` and the DryRun test, so the test exercises the real code (not
  # a copy). Given already-decrypted bytes, it: creates the dir, hardens the ACL
  # (fail-closed), then writes keystore + DPAPI password with no-overwrite.
  # On ANY failure after creation it removes ONLY the files/dir THIS call
  # created — never a preexisting file — then rethrows.
  param(
    [string]$RestoreDir,
    [string]$KsPath,
    [string]$DpPath,
    [byte[]]$JksBytes,
    [byte[]]$ReEncPw
  )
  $dirCreated = $false
  $ksWritten = $false
  $dpWritten = $false
  try {
    if (-not (Test-Path $RestoreDir)) {
      New-Item -ItemType Directory -Force -Path $RestoreDir | Out-Null
      $dirCreated = $true
    }
    Set-PrivateAcl -Path $RestoreDir          # fail-closed: throws if it cannot secure
    New-FileNoOverwrite -Path $KsPath -Bytes $JksBytes; $ksWritten = $true
    New-FileNoOverwrite -Path $DpPath -Bytes $ReEncPw; $dpWritten = $true
  } catch {
    # Roll back only what THIS operation created (keystore first/second file,
    # and the dir if we made it). Never touch preexisting content.
    if ($dpWritten) { Remove-Item -LiteralPath $DpPath -Force -ErrorAction SilentlyContinue }
    if ($ksWritten) { Remove-Item -LiteralPath $KsPath -Force -ErrorAction SilentlyContinue }
    if ($dirCreated) { Remove-Item -LiteralPath $RestoreDir -Recurse -Force -ErrorAction SilentlyContinue }
    throw
  }
}

function Get-CertFingerprint {
  param([string]$Keystore, [System.Security.SecureString]$StorePw)
  $keytool = 'C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe'
  $pwBytes = Get-PassphraseBytes $StorePw
  [Environment]::SetEnvironmentVariable('NRG_VERIFY_PW', [System.Text.Encoding]::UTF8.GetString($pwBytes), 'Process')
  [Array]::Clear($pwBytes,0,$pwBytes.Length)
  try {
    $prevEAP = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    $out = & $keytool -list -v -alias $KeyAlias -keystore $Keystore -storetype PKCS12 '-storepass:env' NRG_VERIFY_PW 2>&1 | Out-String
    $ErrorActionPreference = $prevEAP
    ($out -split "`n") | Where-Object { $_ -match 'SHA256:' } | ForEach-Object { $_.Trim() }
  } finally { [Environment]::SetEnvironmentVariable('NRG_VERIFY_PW', $null, 'Process') }
}

switch ($Mode) {
  'Backup' {
    if (-not $OutFile) { throw 'Backup memerlukan -OutFile (di luar repo).' }
    Assert-OutsideRepo $OutFile
    $ks = Join-Path $SigningDir "$KeyAlias-release.jks"
    $dp = Join-Path $SigningDir "$KeyAlias-release.store.dpapi"
    if (-not (Test-Path $ks)) { throw "Keystore tidak ditemukan: $ks" }
    if (-not (Test-Path $dp)) { throw "Berkas sandi DPAPI tidak ditemukan: $dp" }
    # Decrypt the DPAPI store password to embed the PLAINTEXT password inside the
    # passphrase-encrypted portable blob (so restore on another machine works).
    $enc = [IO.File]::ReadAllBytes($dp)
    $plainPw = [System.Security.Cryptography.ProtectedData]::Unprotect($enc, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    try {
      $files = @{ 'niragni-release.jks' = [IO.File]::ReadAllBytes($ks); 'store-password.bin' = $plainPw }
      $packed = Pack-Files $files
      $pp = Read-Passphrase -Prompt 'Masukkan passphrase backup (DIINGAT BAIK - tidak bisa dipulihkan jika lupa)' -Confirm
      $blob = Protect-Bundle -Plaintext $packed -Passphrase $pp
      New-FileNoOverwrite -Path $OutFile -Bytes $blob   # fails closed if file exists (no silent overwrite)
      [Array]::Clear($packed,0,$packed.Length)
      Write-Output "Backup terenkripsi ditulis: $OutFile ($($blob.Length) bytes)."
      Write-Output 'Simpan passphrase di pengelola kata sandi Anda dan letakkan backup di media terenkripsi milik Anda. JANGAN unggah ke cloud/GitHub.'
    } finally { [Array]::Clear($plainPw,0,$plainPw.Length) }
  }
  'Restore' {
    if (-not $BackupFile) { throw 'Restore memerlukan -BackupFile.' }
    if (-not $RestoreDir) { throw 'Restore memerlukan -RestoreDir (folder kosong/baru).' }
    if (-not (Test-Path $BackupFile)) { throw "BackupFile tidak ditemukan: $BackupFile" }
    Assert-OutsideRepo $RestoreDir
    $ksPath = Join-Path $RestoreDir "$KeyAlias-release.jks"
    $dpPath = Join-Path $RestoreDir "$KeyAlias-release.store.dpapi"
    if ((Test-Path $ksPath) -or (Test-Path $dpPath)) { throw 'RestoreDir sudah berisi keystore/sandi; menolak menimpa. Pilih folder baru/kosong.' }
    $blob = [IO.File]::ReadAllBytes($BackupFile)
    $pp = Read-Passphrase -Prompt 'Masukkan passphrase backup'
    # FAIL-CLOSED: fully decrypt + MAC-verify + unpack + re-encrypt the password
    # with DPAPI BEFORE writing any secret to disk. Any failure throws here,
    # leaving nothing partial behind.
    $packed = Unprotect-Bundle -Blob $blob -Passphrase $pp  # throws on wrong pass / tamper / truncation
    $jksBytes = $null; $reEnc = $null; $pwBytes = $null
    try {
      $files = Unpack-Files $packed
      if (-not $files.ContainsKey('niragni-release.jks') -or -not $files.ContainsKey('store-password.bin')) {
        throw 'Backup tidak lengkap (keystore atau sandi hilang).'
      }
      $jksBytes = $files['niragni-release.jks']
      $pwBytes = $files['store-password.bin']
      $reEnc = [System.Security.Cryptography.ProtectedData]::Protect($pwBytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
      # All secret material prepared; write via the shared production path
      # (dir + fail-closed ACL + no-overwrite, with rollback of only this call's
      # files on failure).
      Write-RestoredSecrets -RestoreDir $RestoreDir -KsPath $ksPath -DpPath $dpPath -JksBytes $jksBytes -ReEncPw $reEnc
      Write-Output "Restore selesai ke: $RestoreDir (keystore + sandi DPAPI untuk akun Windows ini, ACL diperketat)."
      Write-Output 'Sandi DPAPI yang dipulihkan terikat ke akun Windows INI; backup portabel asli tetap satu-satunya pemulihan lintas-mesin.'
    } finally {
      if ($pwBytes) { [Array]::Clear($pwBytes,0,$pwBytes.Length) }
      [Array]::Clear($packed,0,$packed.Length)
    }
  }
  'DryRun' {
    # Prove the full round-trip + auth/negative cases on a DISPOSABLE dummy key;
    # never reads the real key. Cleanup is restricted to a strict temp prefix.
    $tmpPrefix = Join-Path $env:TEMP 'niragni-bak-dryrun-'
    $tmp = $tmpPrefix + [guid]::NewGuid().ToString('N')
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    try {
      $dummyKs = Join-Path $tmp 'niragni-release.jks'
      $keytool = 'C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe'
      [Environment]::SetEnvironmentVariable('NRG_DUMMY_PW', 'dryrun-disposable-pass', 'Process')
      try {
        $prevEAP = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
        & $keytool -genkeypair -alias $KeyAlias -keyalg RSA -keysize 2048 -validity 1 -keystore $dummyKs -storetype PKCS12 -dname 'CN=NiragniDryRunDummy' '-storepass:env' NRG_DUMMY_PW '-keypass:env' NRG_DUMMY_PW 2>&1 | Out-Null
        $ktExit = $LASTEXITCODE
        $ErrorActionPreference = $prevEAP
      } finally { [Environment]::SetEnvironmentVariable('NRG_DUMMY_PW', $null, 'Process') }
      if ($ktExit -ne 0 -or -not (Test-Path $dummyKs)) { throw "DryRun: gagal membuat keystore dummy (keytool exit $ktExit)." }

      $origKs = [IO.File]::ReadAllBytes($dummyKs)
      $files = @{ 'niragni-release.jks' = $origKs; 'store-password.bin' = [System.Text.Encoding]::UTF8.GetBytes('dryrun-disposable-pass') }
      $packed = Pack-Files $files
      $good = ConvertTo-SecureString 'dryrun-passphrase-not-a-real-secret' -AsPlainText -Force
      $blob = Protect-Bundle -Plaintext $packed -Passphrase $good

      # 1) happy-path round-trip
      $round = Unpack-Files (Unprotect-Bundle -Blob $blob -Passphrase $good)
      $tRoundtrip = (@(Compare-Object $origKs $round['niragni-release.jks'] -SyncWindow 0).Count -eq 0)

      # 2) wrong passphrase -> fail closed
      $tWrong = $false
      try { Unprotect-Bundle -Blob $blob -Passphrase (ConvertTo-SecureString 'dryrun-WRONG-passphrase' -AsPlainText -Force) | Out-Null } catch { $tWrong = $true }

      # 3) tamper one ciphertext byte -> MAC rejects
      $tamper = $blob.Clone(); $mid = [int]($tamper.Length/2); $tamper[$mid] = $tamper[$mid] -bxor 0xFF
      $tTamper = $false
      try { Unprotect-Bundle -Blob $tamper -Passphrase $good | Out-Null } catch { $tTamper = $true }

      # 4) truncated blob -> rejected
      $trunc = $blob[0..([int]($blob.Length/2))]
      $tTrunc = $false
      try { Unprotect-Bundle -Blob $trunc -Passphrase $good | Out-Null } catch { $tTrunc = $true }

      # 5) out-of-range iteration header -> rejected (craft header off the real blob)
      $badIter = $blob.Clone(); $ib = [BitConverter]::GetBytes([int]99); [Array]::Copy($ib,0,$badIter,($MAGIC.Length+1),4)
      $tIter = $false
      try { Unprotect-Bundle -Blob $badIter -Passphrase $good | Out-Null } catch { $tIter = $true }

      # 6) no-overwrite: New-FileNoOverwrite refuses an existing path
      $existing = Join-Path $tmp 'exists.bin'; [IO.File]::WriteAllBytes($existing, @(1,2,3))
      $tNoOverwrite = $false
      try { New-FileNoOverwrite -Path $existing -Bytes @(9,9,9) } catch { $tNoOverwrite = $true }

      # 7) Set-PrivateAcl is FAIL-CLOSED: it throws (does not warn-and-continue)
      #    when it cannot secure the target. A non-existent path makes Get-Acl
      #    fail, which must surface as a thrown error so a caller never proceeds
      #    to write secrets into an unsecured location.
      $tAclFailClosed = $false
      try { Set-PrivateAcl -Path (Join-Path $tmp ('nonexistent-' + [guid]::NewGuid().ToString('N'))) }
      catch { $tAclFailClosed = $true }

      # 8) Full Restore via the SHARED production path (Write-RestoredSecrets):
      #    proves decrypt+DPAPI+dir+ACL+write end-to-end on the dummy blob, that
      #    both files land, and that the dir ACL is protected afterwards. This
      #    calls the exact function Mode Restore uses (no duplicated logic).
      $restoreDir = Join-Path $tmp 'restore'
      $ksR = Join-Path $restoreDir 'niragni-release.jks'
      $dpR = Join-Path $restoreDir 'niragni-release.store.dpapi'
      $bakFile = Join-Path $tmp 'dummy.niragnibak'
      [IO.File]::WriteAllBytes($bakFile, $blob)
      $tRestore = $false; $tRestoreAcl = $false
      try {
        $rPacked = Unprotect-Bundle -Blob ([IO.File]::ReadAllBytes($bakFile)) -Passphrase $good
        $rFiles = Unpack-Files $rPacked
        $rReEnc = [System.Security.Cryptography.ProtectedData]::Protect($rFiles['store-password.bin'], $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
        Write-RestoredSecrets -RestoreDir $restoreDir -KsPath $ksR -DpPath $dpR -JksBytes $rFiles['niragni-release.jks'] -ReEncPw $rReEnc
        [Array]::Clear($rPacked,0,$rPacked.Length)
        $tRestore = (Test-Path $ksR) -and (Test-Path $dpR)
        $chk = Get-Acl $restoreDir
        $allowedSids = @(([System.Security.Principal.WindowsIdentity]::GetCurrent().Name).ToLowerInvariant(),'nt authority\system','builtin\administrators')
        $onlyAllowed = $true
        foreach($ace in $chk.Access){ if($allowedSids -notcontains ("$($ace.IdentityReference)").ToLowerInvariant()){ $onlyAllowed=$false } }
        $tRestoreAcl = $chk.AreAccessRulesProtected -and $onlyAllowed
      } catch { $tRestore = $false }

      # 9) Write-failure rollback: pre-create the SECOND target (dpapi) with a
      #    preexisting marker so New-FileNoOverwrite throws on it; prove the
      #    keystore this op wrote is rolled back AND the preexisting file is kept.
      $failDir = Join-Path $tmp 'restore-fail'
      New-Item -ItemType Directory -Force -Path $failDir | Out-Null
      $ksF = Join-Path $failDir 'niragni-release.jks'
      $dpF = Join-Path $failDir 'niragni-release.store.dpapi'
      $preexistMarker = [System.Text.Encoding]::UTF8.GetBytes('PREEXISTING-NOT-OURS')
      [IO.File]::WriteAllBytes($dpF, $preexistMarker)   # second write will collide -> fail
      $tWriteFailCleanup = $false
      try {
        Write-RestoredSecrets -RestoreDir $failDir -KsPath $ksF -DpPath $dpF -JksBytes $origKs -ReEncPw @(5,5,5)
      } catch {
        # keystore (our file) must be rolled back; preexisting dpapi must remain intact
        $ksGone = -not (Test-Path $ksF)
        $preexistKept = (Test-Path $dpF) -and (@(Compare-Object ([IO.File]::ReadAllBytes($dpF)) $preexistMarker -SyncWindow 0).Count -eq 0)
        $tWriteFailCleanup = $ksGone -and $preexistKept
      }

      [Array]::Clear($packed,0,$packed.Length)
      $all = $tRoundtrip -and $tWrong -and $tTamper -and $tTrunc -and $tIter -and $tNoOverwrite -and $tAclFailClosed -and $tRestore -and $tRestoreAcl -and $tWriteFailCleanup
      Write-Output ("DryRun results: roundtrip=$tRoundtrip wrongPass=$tWrong tamper=$tTamper truncated=$tTrunc badIterHeader=$tIter noOverwrite=$tNoOverwrite aclFailClosed=$tAclFailClosed restoreSharedPath=$tRestore restoreAclOnlyAllowedSids=$tRestoreAcl writeFailRollback=$tWriteFailCleanup ; blob=$($blob.Length)B")
      if (-not $all) { throw 'DryRun FAILED: one or more auth/negative/restore checks did not behave as expected.' }
      Write-Output 'DryRun PASSED (disposable dummy key only; real key never touched).'
    } finally {
      # Strict cleanup: only remove under the exact dry-run temp prefix.
      $resolved = [IO.Path]::GetFullPath($tmp)
      if ($resolved.StartsWith([IO.Path]::GetFullPath($tmpPrefix), [StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -Recurse -Force $resolved -ErrorAction SilentlyContinue
      }
      # Prove cleanup actually removed the temp tree (evidence for the QA report).
      if (Test-Path $resolved) {
        Write-Warning "DryRun cleanup incomplete: '$resolved' masih ada."
      } else {
        Write-Output "DryRun cleanup OK: temp tree dihapus."
      }
    }
  }
  'Verify' {
    $ks = Join-Path $SigningDir "$KeyAlias-release.jks"
    if (-not (Test-Path $ks)) { throw "Keystore tidak ditemukan: $ks" }
    Add-Type -AssemblyName System.Security | Out-Null
    $dp = Join-Path $SigningDir "$KeyAlias-release.store.dpapi"
    $enc = [IO.File]::ReadAllBytes($dp)
    $plain = [System.Security.Cryptography.ProtectedData]::Unprotect($enc, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    $sec = New-Object System.Security.SecureString
    foreach ($ch in [System.Text.Encoding]::UTF8.GetString($plain).ToCharArray()) { $sec.AppendChar($ch) }
    [Array]::Clear($plain,0,$plain.Length)
    Write-Output 'Public release certificate fingerprint (safe, non-secret):'
    Get-CertFingerprint -Keystore $ks -StorePw $sec
  }
}
