import os, sys, subprocess, pathlib, json, xml.etree.ElementTree as ET, re
ADB = str(pathlib.Path(os.environ['LOCALAPPDATA']) / 'Android/Sdk/platform-tools/adb.exe')
SERIAL = '192.168.18.10:35745'
ROOT = pathlib.Path(__file__).parent
def adb(*args):
    p = subprocess.run([ADB, '-s', SERIAL, *args], capture_output=True, timeout=45)
    if p.returncode: raise RuntimeError(p.stderr.decode(errors='replace'))
    return p.stdout
action = sys.argv[1]
if action in ('snap','tree'):
    name = sys.argv[2]
    adb('shell','uiautomator','dump','/sdcard/niragni-qa.xml')
    adb('pull','/sdcard/niragni-qa.xml',str(ROOT / (name+'.xml')))
    if action == 'snap':
        adb('shell','screencap','-d','4627039422300187648','-p','/sdcard/niragni-qa.png')
        adb('pull','/sdcard/niragni-qa.png',str(ROOT / (name+'.png')))
    tree = ET.parse(ROOT/(name+'.xml'))
    nodes=[]
    for n in tree.iter('node'):
        a=n.attrib
        if a.get('text') or a.get('content-desc'):
            label = a.get('content-desc') or a.get('text')
            if len(label)==1 and ord(label[0])>0xe000: continue
            nodes.append([label, a.get('bounds'), 'disabled' if a.get('enabled')=='false' else ''])
    print(json.dumps(nodes,ensure_ascii=True))
elif action == 'tap': print(adb('shell','input','-d','0','tap',*sys.argv[2:]).decode())
elif action == 'text': print(adb('shell','input','-d','0','text',sys.argv[2]).decode())
elif action == 'replace':
    adb('shell','input','-d','0','keycombination','113','29')
    print(adb('shell','input','-d','0','text',sys.argv[2]).decode())
elif action == 'back': print(adb('shell','input','-d','0','keyevent','4').decode())
elif action == 'swipe': print(adb('shell','input','-d','0','swipe',*sys.argv[2:]).decode())
elif action == 'launch': print(adb('shell','am','start','-n','com.niragni.bara/.MainActivity').decode())
elif action == 'stop': print(adb('shell','am','force-stop','com.niragni.bara').decode())
