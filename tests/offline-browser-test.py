import base64
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.parse

import requests
import websocket

ROOT = Path(__file__).resolve().parents[1]
CHROME = Path(r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe')
PORT = 9300 + (os.getpid() % 500)
BASE = 'http://localhost/FAS_music/'
PROFILE = ROOT / 'artifacts' / f'offline-browser-{int(time.time())}'
PROFILE.mkdir(parents=True, exist_ok=True)

process = subprocess.Popen([
    str(CHROME), '--headless=new', '--disable-gpu', '--disable-extensions', '--no-first-run',
    '--remote-allow-origins=*', f'--remote-debugging-port={PORT}',
    f'--user-data-dir={PROFILE}', 'about:blank'
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
   creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))

try:
    ready = False
    for _ in range(60):
        try:
            requests.get(f'http://127.0.0.1:{PORT}/json/version', timeout=.5).raise_for_status()
            ready = True
            break
        except Exception:
            time.sleep(.25)
    if not ready:
        raise RuntimeError('Browser DevTools endpoint did not start')
    target = requests.put(f'http://127.0.0.1:{PORT}/json/new?{urllib.parse.quote(BASE + "index.html", safe="")}', timeout=5).json()
    ws = websocket.create_connection(target['webSocketDebuggerUrl'], timeout=15)
    sequence = 0

    def command(method, params=None, timeout=20):
        nonlocal_sequence = None
        global sequence
        sequence += 1
        request_id = sequence
        ws.send(json.dumps({'id': request_id, 'method': method, 'params': params or {}}))
        deadline = time.time() + timeout
        while time.time() < deadline:
            message = json.loads(ws.recv())
            if message.get('id') == request_id:
                if 'error' in message:
                    raise RuntimeError(message['error'])
                return message.get('result', {})
        raise TimeoutError(method)

    def evaluate(expression, await_promise=False):
        result = command('Runtime.evaluate', {
            'expression': expression,
            'awaitPromise': await_promise,
            'returnByValue': True
        }, 30)
        value = result.get('result', {})
        if value.get('subtype') == 'error':
            raise RuntimeError(value.get('description'))
        return value.get('value')

    command('Page.enable')
    command('Network.enable')
    command('Page.navigate', {'url': BASE + 'index.html'})
    time.sleep(4)
    evaluate('navigator.serviceWorker.ready.then(() => true)', True)
    command('Page.reload', {'ignoreCache': False})
    time.sleep(3)

    online = evaluate(r'''(async()=>{
      await document.fonts.ready;
      const uiExternal=performance.getEntriesByType('resource').map(x=>x.name).filter(x=>/cdn\.tailwindcss|cdnjs\.cloudflare|cdn\.jsdelivr|fonts\.googleapis|fonts\.gstatic|unpkg\.com|images\.unsplash/.test(x));
      return {title:document.title,controlled:!!navigator.serviceWorker.controller,fonts:document.fonts.status,styles:[...document.styleSheets].length,brokenImages:[...document.images].filter(x=>!x.complete||!x.naturalWidth).map(x=>x.src),uiExternal,timeout:axios.defaults.timeout};
    })()''', True)
    assert online['controlled'], online
    assert online['fonts'] == 'loaded', online
    assert not online['brokenImages'], online
    assert not online['uiExternal'], online
    assert online['timeout'] == 8000, online

    command('Fetch.enable', {'patterns': [{'urlPattern': '*timeout-probe*', 'requestStage': 'Request'}]})
    timeout_probe = evaluate('''(async()=>{const started=Date.now();try{await axios.get(baseApiUrl+'/timeout-probe')}catch(e){return{elapsed:Date.now()-started,code:e.code||'',message:e.message}}return{elapsed:Date.now()-started,code:'none'}})()''', True)
    command('Fetch.disable')
    assert 7500 <= timeout_probe['elapsed'] <= 10000, timeout_probe
    assert timeout_probe['code'] == 'ECONNABORTED', timeout_probe

    shot = command('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False})
    (ROOT / 'artifacts' / 'offline-first-online.png').write_bytes(base64.b64decode(shot['data']))

    command('Network.emulateNetworkConditions', {'offline': True, 'latency': 0, 'downloadThroughput': 0, 'uploadThroughput': 0})
    command('Page.reload', {'ignoreCache': False})
    time.sleep(3)
    offline = evaluate('''(async()=>{
      localStorage.setItem('fas_user',JSON.stringify({user_id:987654,branch_id:0,role_name:'Instructor'}));
      const saved=await axios.post(baseApiUrl+'/attendance.php?action=mark-attendance-by-instructor',{session_id:987654,user_id:987654,attendance_status:'absent'});
      const progress=await axios.post(baseApiUrl+'/teachers.php?action=save-learning-progress',{user_id:987654,student_id:987654,instrument_id:1,level_name:'Offline test'});
      let blocked='';try{await axios.post(baseApiUrl+'/students.php?action=submit-enrollment-balance-payment',{amount:1})}catch(e){blocked=e.message}
      const cacheUrl=baseApiUrl+'/teachers.php?action=get-learning-progress&user_id=987654';
      const db=await new Promise((ok,no)=>{const r=indexedDB.open('fas-offline-v1');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
      await new Promise((ok,no)=>{const r=db.transaction('responseCache','readwrite').objectStore('responseCache').put({cache_key:cacheUrl+'|987654|0',saved_at:new Date().toISOString(),data:{success:true,learning_progress:[{level_name:'Saved data'}]}});r.onsuccess=ok;r.onerror=()=>no(r.error)});
      const cached=await axios.get(cacheUrl);
      const queue=await FASOffline.getPendingRecords();
      const logo=document.querySelector('header img,nav img,img[alt*="Father"]');
      return {title:document.title,styles:[...document.styleSheets].length,indicator:document.querySelector('#fasConnectionStatus .fas-net-message')?.textContent,queued:saved.data.queued&&progress.data.queued,cached:cached.fasCached===true&&cached.data.learning_progress[0].level_name==='Saved data',queue,blocked,scrollX,brokenImages:[...document.images].filter(x=>!x.complete||!x.naturalWidth).map(x=>x.src),logo:logo?{src:logo.src,complete:logo.complete,width:logo.naturalWidth,rect:logo.getBoundingClientRect().toJSON()}:null};
    })()''', True)
    assert offline['title'] == online['title'], offline
    assert offline['styles'] > 0, offline
    assert not offline['brokenImages'], offline
    assert offline['scrollX'] == 0, offline
    assert offline['queued'] and len(offline['queue']) == 2, offline
    assert offline['cached'], offline
    assert offline['indicator'].startswith('Offline'), offline
    assert 'live connection' in offline['blocked'].lower(), offline
    shot = command('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False})
    (ROOT / 'artifacts' / 'offline-first-offline.png').write_bytes(base64.b64decode(shot['data']))

    # Point the synthetic queued test record at a harmless success endpoint.
    evaluate('''(async()=>{const db=await new Promise((ok,no)=>{const r=indexedDB.open('fas-offline-v1');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});const rows=await new Promise((ok,no)=>{const r=db.transaction('syncQueue').objectStore('syncQueue').getAll();r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});await Promise.all(rows.map(row=>{row.request_url=baseApiUrl+'/server_time.php';row.request_method='get';return new Promise((ok,no)=>{const r=db.transaction('syncQueue','readwrite').objectStore('syncQueue').put(row);r.onsuccess=ok;r.onerror=()=>no(r.error)})}));return true})()''', True)
    command('Network.emulateNetworkConditions', {'offline': False, 'latency': 20, 'downloadThroughput': 5000000, 'uploadThroughput': 1000000})
    time.sleep(3)
    synced = evaluate('''(async()=>{const before=performance.getEntriesByName(baseApiUrl+'/server_time.php').length;await FASOffline.syncQueue();const after=performance.getEntriesByName(baseApiUrl+'/server_time.php').length;const q=await FASOffline.getPendingRecords();return{before,after,pending:q.length,meta:document.querySelector('#fasConnectionStatus .fas-net-meta')?.textContent}})()''', True)
    assert synced['pending'] == 0, synced
    assert synced['after'] == synced['before'], synced  # reconnect already synchronized exactly once
    assert 'Pending sync: 0' in synced['meta'], synced

    print(json.dumps({'online': online, 'timeout_probe': timeout_probe, 'offline': {k: v for k, v in offline.items() if k != 'queue'}, 'synced': synced}, indent=2))
finally:
    try: command('Browser.close', timeout=3)
    except Exception: pass
    try: ws.close()
    except Exception: pass
    process.terminate()
    try: process.wait(timeout=5)
    except subprocess.TimeoutExpired: process.kill()
