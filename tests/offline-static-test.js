const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const failures = [];
const htmlFiles = [path.join(root, 'index.html'), path.join(root, 'featured.html')];

function walk(dir, suffix) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, suffix);
    else if (!suffix || full.endsWith(suffix)) htmlFiles.push(full);
  }
}
walk(path.join(root, 'pages'), '.html');

for (const file of htmlFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);
  if (!source.includes('manifest.webmanifest')) failures.push(`${relative}: missing manifest`);
  if (!source.includes('js/offline.js')) failures.push(`${relative}: missing offline client`);
  if (/cdn\.tailwindcss|cdnjs\.cloudflare|cdn\.jsdelivr|fonts\.googleapis|unpkg\.com/.test(source)) failures.push(`${relative}: external UI dependency remains`);
  for (const match of source.matchAll(/<(?:script|link|img|source)\b[^>]*(?:src|href)=["']([^"']+)["']/gi)) {
    const value = match[1].split('?')[0].split('#')[0];
    if (!value || /^(?:https?:|data:|#|\/)/i.test(value)) continue;
    const target = path.resolve(path.dirname(file), value);
    if (!fs.existsSync(target)) failures.push(`${relative}: missing ${value}`);
  }
}

const offlineClient = fs.readFileSync(path.join(root, 'js/offline.js'), 'utf8');
for (const required of ['timeout = config.timeout || TIMEOUT_MS', 'client_transaction_id', 'synchronization_status', 'retry_count', 'lastSuccessfulSync', 'X-Idempotency-Key']) {
  if (!offlineClient.includes(required)) failures.push(`offline.js: missing ${required}`);
}
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
for (const page of htmlFiles) {
  const cachePath = './' + path.relative(root, page).replaceAll('\\', '/');
  if (!worker.includes(cachePath)) failures.push(`service worker does not precache ${cachePath}`);
}
if (!worker.includes("url.pathname.includes('/api/')")) failures.push('service worker does not exclude APIs');
if (!worker.includes('fas-static-') || !worker.includes('fas-pages-')) failures.push('service worker caches are not versioned');
if (!worker.includes('caches.delete')) failures.push('service worker does not delete obsolete caches');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Offline static checks passed for ${htmlFiles.length} HTML pages.`);
