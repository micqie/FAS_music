from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
VERSION = '20260919-3'
assets = {'./', './index.html', './featured.html', './offline.html', './manifest.webmanifest'}

for path in (ROOT / 'pages').rglob('*.html'):
    assets.add('./' + path.relative_to(ROOT).as_posix())

for folder in ('css', 'js', 'logo', 'assets'):
    base = ROOT / folder
    for path in base.rglob('*'):
        if not path.is_file() or 'assets/videos/' in path.relative_to(ROOT).as_posix():
            continue
        if path.suffix.lower() in {'.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.json'}:
            assets.add('./' + path.relative_to(ROOT).as_posix())

template = r'''const CACHE_VERSION = '__VERSION__';
const STATIC_CACHE = `fas-static-${CACHE_VERSION}`;
const PAGE_CACHE = `fas-pages-${CACHE_VERSION}`;
const OFFLINE_PAGE = './offline.html';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('fas-') && ![STATIC_CACHE, PAGE_CACHE].includes(key)).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});

function isApi(url) {
  return url.pathname.includes('/api/');
}

function isStaticAsset(url) {
  return /\.(?:css|js|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|json)$/i.test(url.pathname);
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isApi(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(PAGE_CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(async () => (await caches.match(request, { ignoreSearch: true })) || (await caches.match(OFFLINE_PAGE))));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(caches.match(request, { ignoreSearch: true }).then(cached => cached || fetch(request).then(response => {
      if (response.ok && response.type === 'basic') caches.open(STATIC_CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    })));
  }
});
'''

output = template.replace('__VERSION__', VERSION).replace('__PRECACHE__', json.dumps(sorted(assets), indent=2))
(ROOT / 'service-worker.js').write_text(output, encoding='utf-8')
print(f'Wrote service-worker.js with {len(assets)} local shell assets')
