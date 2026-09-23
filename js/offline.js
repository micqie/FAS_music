(function (global) {
    'use strict';

    const DB_NAME = 'fas-offline-v1';
    const DB_VERSION = 1;
    const TIMEOUT_MS = 8000;
    const QUEUE_STORE = 'syncQueue';
    const CACHE_STORE = 'responseCache';
    const META_STORE = 'meta';
    const scriptUrl = document.currentScript && document.currentScript.src;
    const appRoot = scriptUrl ? new URL('../', scriptUrl) : new URL('./', location.href);
    let dbPromise;
    let statusTimer;
    let activeSync = null;

    function openDb() {
        if (!('indexedDB' in global)) return Promise.reject(new Error('IndexedDB unavailable'));
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(QUEUE_STORE)) {
                    const queue = db.createObjectStore(QUEUE_STORE, { keyPath: 'client_transaction_id' });
                    queue.createIndex('status', 'synchronization_status');
                    queue.createIndex('created', 'local_creation_timestamp');
                }
                if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE, { keyPath: 'cache_key' });
                if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return dbPromise;
    }

    async function storePut(storeName, value) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const request = db.transaction(storeName, 'readwrite').objectStore(storeName).put(value);
            request.onsuccess = () => resolve(value);
            request.onerror = () => reject(request.error);
        });
    }

    async function storeGet(storeName, key) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const request = db.transaction(storeName).objectStore(storeName).get(key);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async function storeAll(storeName) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const request = db.transaction(storeName).objectStore(storeName).getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async function storeDelete(storeName, key) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const request = db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    function uuid() {
        return global.crypto && crypto.randomUUID ? crypto.randomUUID() : 'fas-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    }

    function currentUser() {
        try {
            if (global.Auth && global.Auth.getUser) return global.Auth.getUser() || {};
            const stored = JSON.parse(localStorage.getItem('fas_user') || 'null');
            return stored && Number(stored.user_id) ? stored : {};
        } catch (_) { return {}; }
    }

    function recordsForCurrentUser(records) {
        const userId = Number(currentUser().user_id || 0);
        if (!userId) return [];
        return records.filter(record => Number(record.user_id || 0) === userId);
    }

    function actionFor(config) {
        try {
            const url = new URL(config.url || '', location.href);
            return String(url.searchParams.get('action') || (config.data && !(config.data instanceof FormData) && config.data.action) || '').toLowerCase();
        } catch (_) { return ''; }
    }

    function queueKind(config) {
        const url = String(config.url || '').toLowerCase();
        const action = actionFor(config);
        if (url.includes('/attendance.php') && ['mark-attendance-by-instructor', 'mark-present-by-instructor'].includes(action)) return 'attendance';
        if (url.includes('/teachers.php') && ['save-session-grade', 'save-learning-progress'].includes(action)) return 'progress';
        return '';
    }

    function requiresOnline(config) {
        const method = String(config.method || 'get').toLowerCase();
        if (!['post', 'put', 'patch', 'delete'].includes(method)) return false;
        const action = actionFor(config);
        return /(payment|enroll|approv|schedule|reschedule)/.test(action);
    }

    function cacheableGet(config) {
        if (String(config.method || 'get').toLowerCase() !== 'get') return false;
        const url = String(config.url || '').toLowerCase();
        const action = actionFor(config);
        return url.includes('/attendance.php') || (url.includes('/teachers.php') && ['get-teacher-session-grades', 'get-learning-progress'].includes(action));
    }

    function cacheKey(config) {
        const user = currentUser();
        return [config.url || '', user.user_id || 'guest', user.branch_id || 0].join('|');
    }

    function toPlainPayload(data) {
        if (!data) return {};
        if (typeof data === 'string') { try { return JSON.parse(data); } catch (_) { return {}; } }
        if (data instanceof FormData) return null;
        return JSON.parse(JSON.stringify(data));
    }

    async function enqueue(config) {
        const payload = toPlainPayload(config.data);
        if (!payload) throw new Error('This record requires a live connection.');
        const user = currentUser();
        const tx = payload.client_transaction_id || config.__fasTransactionId || uuid();
        payload.client_transaction_id = tx;
        await storePut(QUEUE_STORE, {
            client_transaction_id: tx,
            user_id: Number(payload.user_id || user.user_id || 0),
            branch_id: Number(payload.branch_id || user.branch_id || 0),
            local_creation_timestamp: new Date().toISOString(),
            payload,
            synchronization_status: 'pending',
            retry_count: 0,
            request_url: config.url,
            request_method: String(config.method || 'post').toLowerCase(),
            record_type: queueKind(config)
        });
        await refreshIndicator('offline');
        return tx;
    }

    function formatTime(value) {
        if (!value) return 'Never';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'Never' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    }

    function ensureIndicator() {
        let element = document.getElementById('fasConnectionStatus');
        if (element) return element;
        element = document.createElement('div');
        element.id = 'fasConnectionStatus';
        element.setAttribute('role', 'status');
        element.setAttribute('aria-live', 'polite');
        element.innerHTML = '<span class="fas-net-dot"></span><span><strong class="fas-net-message"></strong><small class="fas-net-meta"></small></span>';
        const style = document.createElement('style');
        style.textContent = '#fasConnectionStatus{position:fixed;left:14px;bottom:14px;z-index:2147483000;display:none;align-items:center;gap:9px;max-width:min(360px,calc(100vw - 28px));padding:9px 12px;border:1px solid rgba(255,255,255,.18);border-radius:12px;background:rgba(15,17,21,.94);box-shadow:0 8px 28px rgba(0,0,0,.24);color:#fff;font:500 12px/1.3 Inter,system-ui,sans-serif;backdrop-filter:blur(10px)}#fasConnectionStatus strong,#fasConnectionStatus small{display:block}#fasConnectionStatus strong{font-size:12px}#fasConnectionStatus small{margin-top:2px;color:#cbd5e1;font-size:10px}.fas-net-dot{width:9px;height:9px;flex:0 0 auto;border-radius:50%;background:#f59e0b}#fasConnectionStatus[data-state="online"] .fas-net-dot{background:#22c55e}#fasConnectionStatus[data-state="weak"] .fas-net-dot{background:#f59e0b}#fasConnectionStatus[data-state="offline"] .fas-net-dot{background:#ef4444}@media(max-width:640px){#fasConnectionStatus{left:10px;bottom:76px;padding:8px 10px}}';
        document.head.appendChild(style);
        document.body.appendChild(element);
        return element;
    }

    async function refreshIndicator(forcedState) {
        if (!document.body) return;
        const indicator = ensureIndicator();
        const queue = recordsForCurrentUser(await storeAll(QUEUE_STORE).catch(() => []));
        const last = await storeGet(META_STORE, 'lastSuccessfulSync').catch(() => null);
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const weak = connection && (['slow-2g', '2g'].includes(connection.effectiveType) || (connection.downlink && connection.downlink < 0.8));
        const state = forcedState || (!navigator.onLine ? 'offline' : weak ? 'weak' : 'online');
        const messages = {
            offline: 'Offline — changes will sync when connected',
            weak: 'Weak connection — displaying saved data',
            online: 'Back online — synchronizing changes'
        };
        indicator.dataset.state = state;
        indicator.querySelector('.fas-net-message').textContent = messages[state];
        indicator.querySelector('.fas-net-meta').textContent = `Pending sync: ${queue.length} · Last sync: ${formatTime(last && last.value)}`;
        indicator.style.display = state === 'online' && queue.length === 0 ? 'none' : 'flex';
        clearTimeout(statusTimer);
        if (state === 'online' && queue.length === 0) statusTimer = setTimeout(() => { indicator.style.display = 'none'; }, 3500);
    }

    function syncQueue() {
        if (activeSync) return activeSync;
        activeSync = (async () => {
            if (!navigator.onLine || !global.axios) return;
            const records = recordsForCurrentUser(await storeAll(QUEUE_STORE)).sort((a, b) => a.local_creation_timestamp.localeCompare(b.local_creation_timestamp));
            if (!records.length) { await refreshIndicator(); return; }
            await refreshIndicator('online');
            for (const record of records) {
                record.synchronization_status = 'syncing';
                await storePut(QUEUE_STORE, record);
                try {
                    const response = await axios({
                        url: record.request_url,
                        method: record.request_method,
                        data: record.payload,
                        timeout: TIMEOUT_MS,
                        headers: { 'X-Idempotency-Key': record.client_transaction_id },
                        __fasSyncReplay: true
                    });
                    if (!response.data || response.data.success !== true) throw new Error(response.data && response.data.error || 'Server did not confirm synchronization.');
                    await storeDelete(QUEUE_STORE, record.client_transaction_id);
                    await storePut(META_STORE, { key: 'lastSuccessfulSync', value: new Date().toISOString() });
                } catch (error) {
                    record.synchronization_status = 'pending';
                    record.retry_count = Number(record.retry_count || 0) + 1;
                    record.last_error = String(error && error.message || 'Synchronization failed').slice(0, 300);
                    await storePut(QUEUE_STORE, record);
                    if (!navigator.onLine || !error.response) break;
                }
            }
            await refreshIndicator();
        })().finally(() => { activeSync = null; });
        return activeSync;
    }

    function installAxiosHandling() {
        if (!global.axios || axios.__fasOfflineInstalled) return;
        axios.__fasOfflineInstalled = true;
        axios.defaults.timeout = TIMEOUT_MS;
        axios.interceptors.request.use(async config => {
            config.timeout = config.timeout || TIMEOUT_MS;
            if (requiresOnline(config) && !navigator.onLine) {
                const error = new Error('A live connection is required to complete payments, enrollment approvals, or schedule approvals.');
                error.code = 'FAS_ONLINE_REQUIRED';
                error.config = config;
                await refreshIndicator('offline');
                return Promise.reject(error);
            }
            if (queueKind(config) && !config.__fasSyncReplay) {
                const payload = toPlainPayload(config.data);
                if (payload) {
                    config.__fasTransactionId = payload.client_transaction_id || uuid();
                    payload.client_transaction_id = config.__fasTransactionId;
                    config.data = payload;
                    config.headers = config.headers || {};
                    config.headers['X-Idempotency-Key'] = config.__fasTransactionId;
                }
            }
            return config;
        });
        axios.interceptors.response.use(async response => {
            if (cacheableGet(response.config) && response.data) {
                await storePut(CACHE_STORE, { cache_key: cacheKey(response.config), saved_at: new Date().toISOString(), data: response.data }).catch(() => {});
            }
            return response;
        }, async error => {
            const config = error.config || {};
            if (error.code === 'FAS_ONLINE_REQUIRED') return Promise.reject(error);
            const unavailable = !navigator.onLine || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK';
            if (unavailable && queueKind(config) && !config.__fasSyncReplay) {
                const tx = await enqueue(config);
                return { data: { success: true, queued: true, offline: true, client_transaction_id: tx, message: 'Saved on this device. It will sync when connected.' }, status: 202, config };
            }
            if (unavailable && cacheableGet(config)) {
                const cached = await storeGet(CACHE_STORE, cacheKey(config)).catch(() => null);
                if (cached) {
                    await refreshIndicator(navigator.onLine ? 'weak' : 'offline');
                    return { data: cached.data, status: 200, config, fasCached: true };
                }
            }
            if (unavailable) await refreshIndicator(navigator.onLine ? 'weak' : 'offline');
            return Promise.reject(error);
        });
    }

    function installFetchTimeout() {
        if (!global.fetch || global.fetch.__fasOfflineInstalled) return;
        const nativeFetch = global.fetch.bind(global);
        const wrapped = async function (input, init) {
            init = Object.assign({}, init || {});
            const url = String(input && input.url || input || '');
            const method = String(init.method || (input && input.method) || 'GET').toUpperCase();
            if (!navigator.onLine && /\/api\//i.test(url) && method !== 'GET' && /(payment|enroll|approve|schedule)/i.test(url + ' ' + String(init.body || ''))) {
                throw new Error('A live connection is required for this operation.');
            }
            if (!/\/api\//i.test(url) || init.signal) return nativeFetch(input, init);
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
            init.signal = controller.signal;
            try { return await nativeFetch(input, init); }
            finally { clearTimeout(timer); }
        };
        wrapped.__fasOfflineInstalled = true;
        global.fetch = wrapped;
    }

    function init() {
        if ('serviceWorker' in navigator) navigator.serviceWorker.register(new URL('service-worker.js', appRoot)).catch(() => {});
        installAxiosHandling();
        installFetchTimeout();
        refreshIndicator();
        if (navigator.onLine) syncQueue();
        global.addEventListener('offline', () => refreshIndicator('offline'));
        global.addEventListener('online', () => { refreshIndicator('online'); syncQueue(); });
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection && connection.addEventListener) connection.addEventListener('change', () => refreshIndicator());
    }

    global.FASOffline = { syncQueue, getPendingRecords: async () => recordsForCurrentUser(await storeAll(QUEUE_STORE)), timeout: TIMEOUT_MS };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})(window);
