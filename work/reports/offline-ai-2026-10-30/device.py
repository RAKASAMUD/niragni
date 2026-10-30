"""Explicit on-device QA helper. No screenshot or persisted tree of private pickers."""
import json, os, pathlib, re, subprocess, sys, xml.etree.ElementTree as ET
ADB = r'C:\Users\hp5cd\AppData\Local\Android\Sdk\platform-tools\adb.exe'
SERIAL = os.environ.get('NIRAGNI_QA_SERIAL', '858PQWINIRGMYXKR')
ROOT = pathlib.Path(__file__).parent
def adb(*args, timeout=60):
    p = subprocess.run([ADB, '-s', SERIAL, *args], capture_output=True, timeout=timeout)
    if p.returncode: raise RuntimeError(p.stderr.decode(errors='replace'))
    return p.stdout
action = sys.argv[1]
if action in ('snap', 'tree'):
    name = sys.argv[2]
    adb('shell', 'uiautomator', 'dump', '/data/local/tmp/niragni-offline-ui.xml')
    raw = adb('exec-out', 'cat', '/data/local/tmp/niragni-offline-ui.xml')
    tree = ET.fromstring(raw)
    app = any(n.attrib.get('package') == 'com.niragni.bara' for n in tree.iter('node'))
    if app:
        (ROOT / (name + '.xml')).write_bytes(raw)
    if action == 'snap' and app:
        display = adb('shell', 'dumpsys', 'SurfaceFlinger', '--display-id').decode()
        display_id = re.search(r'Display (\d+) .*HWC display 0', display).group(1)
        (ROOT / (name + '.png')).write_bytes(adb('exec-out', 'screencap', '-d', display_id, '-p'))
    nodes=[]
    for n in tree.iter('node'):
        a=n.attrib
        label=a.get('content-desc') or a.get('text')
        if not label or (len(label)==1 and ord(label[0])>0xe000): continue
        if not app and not re.search(r'SmolVLM2|mmproj|Downloads|Search|Back|Clear|List view|Done|Cancel|Allow|permission|Don.t allow',label,re.I): continue
        nodes.append([label,a.get('bounds'),'disabled' if a.get('enabled')=='false' else ''])
    print(json.dumps(nodes,ensure_ascii=True))
elif action == 'tap': adb('shell','input','-d','0','tap',*sys.argv[2:])
elif action == 'swipe': adb('shell','input','-d','0','swipe',*sys.argv[2:])
elif action == 'text': adb('shell','input','-d','0','text',sys.argv[2])
elif action == 'replace':
    adb('shell','input','-d','0','keycombination','113','29')
    adb('shell','input','-d','0','text',sys.argv[2])
elif action == 'back': adb('shell','input','-d','0','keyevent','4')
elif action == 'launch': print(adb('shell','am','start','-n','com.niragni.bara/.MainActivity').decode())
elif action == 'stop': adb('shell','am','force-stop','com.niragni.bara')
