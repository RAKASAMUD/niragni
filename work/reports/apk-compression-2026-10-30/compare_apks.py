"""Compare local APK archive entries; never operates a phone or rewrites APKs."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[3]
OLD = ROOT / 'artifacts/niragni-android-uncompressed-2026-10-29.apk'
NEW = ROOT / 'artifacts/niragni-android.apk'

def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest().upper()

def inspect(path):
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        native = {entry.filename: {
            'bytes': entry.file_size,
            'packed_bytes': entry.compress_size,
            'method': entry.compress_type,
            'sha256': hashlib.sha256(archive.read(entry)).hexdigest(),
        } for entry in entries if entry.filename.startswith('lib/') and entry.filename.endswith('.so')}
        bundle = archive.getinfo('assets/index.android.bundle')
        return {
            'name': path.name, 'bytes': path.stat().st_size, 'sha256': digest(path),
            'native_count': len(native), 'native_packed_bytes': sum(x['packed_bytes'] for x in native.values()),
            'native_raw_bytes': sum(x['bytes'] for x in native.values()),
            'bundle': {'bytes': bundle.file_size, 'packed_bytes': bundle.compress_size, 'method': bundle.compress_type},
            'native': native,
        }

old, new = inspect(OLD), inspect(NEW)
before, after = old['native'], new['native']
result = {
    'baseline': old, 'compressed': new,
    'saved_bytes': old['bytes'] - new['bytes'],
    'saved_percent': round(100 * (1 - new['bytes'] / old['bytes']), 2),
    'native_removed': sorted(before.keys() - after.keys()),
    'native_added': sorted(after.keys() - before.keys()),
    'native_content_changed': sorted(name for name in before.keys() & after.keys() if before[name]['sha256'] != after[name]['sha256']),
    'limitations': 'Baseline is 29 October source; new APK also includes four 30 October bug fixes. Installed size, startup, RAM, inference and real SAF behavior are not measured.',
}
output = Path(__file__).with_name('comparison.json')
output.write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps({k: v for k, v in result.items() if k not in ('baseline', 'compressed')}, indent=2))
for label, entry in [('baseline', old), ('compressed', new)]:
    print(label, json.dumps({k: v for k, v in entry.items() if k != 'native'}))
