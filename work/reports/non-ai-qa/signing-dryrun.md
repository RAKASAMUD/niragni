# Signing-helper DryRun evidence (refactor: shared Restore path)

Dijalankan: 2026-10-29 12:41:27
Perintah: Backup-NiragniSigning.ps1 -Mode DryRun (dummy key sekali pakai; kunci asli TIDAK disentuh)

Perbaikan per review koordinator:
- Restore kini lewat fungsi bersama Write-RestoredSecrets (dipakai Mode Restore DAN dummy-test) -> tes menangkap regresi jalur produksi, bukan duplikasi logika.
- ACL-check membuktikan HANYA SID {current user, SYSTEM, Administrators} (bukan sekadar AreAccessRulesProtected).
- writeFailRollback: kegagalan tulis file kedua me-rollback HANYA file yang dibuat operasi ini; file preexisting TIDAK dihapus.

```nDryRun results: roundtrip=True wrongPass=True tamper=True truncated=True badIterHeader=True noOverwrite=True aclFailClosed=True restoreSharedPath=True restoreAclOnlyAllowedSids=True writeFailRollback=True ; blob=2751B
DryRun PASSED (disposable dummy key only; real key never touched).
DryRun cleanup OK: temp tree dihapus.
```
