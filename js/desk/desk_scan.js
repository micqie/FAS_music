let cameraStream = null;
let scanAnimationFrame = 0;
let scanCanvas = null;
let scanContext = null;
let barcodeDetector = null;
let frameDecodeBusy = false;
let scannerStarting = false;
let invalidScanCount = 0;
let lastScannedPayload = '';
let lastScanTime = 0;
let lastManualEmail = '';
let lastManualTime = 0;
const SCAN_DEBOUNCE_MS = 2000;

function getDeskUser() {
    if (typeof Auth !== 'undefined' && Auth.getUser) return Auth.getUser();
    return null;
}

function getDeskBranchId() {
    const user = getDeskUser();
    const id = Number(user?.branch_id || 0);
    return Number.isFinite(id) ? id : 0;
}

function getDeskBranchName() {
    const user = getDeskUser();
    const name = (user?.branch_name || user?.branch || '').toString().trim();
    return name;
}

function parseQrPayload(payload) {
    if (!payload || typeof payload !== 'string') return null;
    const parts = payload.trim().split('|');
    if (parts.length < 4) return null;
    return { raw: payload.trim(), student_id: parts[2] || '', email: parts[3] || '', branch_id: parts[4] || '' };
}

function showScanAlert(title, html, icon = 'info') {
    if (typeof Swal !== 'undefined') Swal.fire({ title, html, icon, confirmButtonColor: '#b8860b' });
}

function isValidQrPayload(payload) {
    if (!payload || typeof payload !== 'string') return false;
    const trimmed = payload.trim();
    if (!trimmed) return false;
    const parts = trimmed.split('|');
    if (parts.length < 4) return false;
    if (parts[0] !== 'FAS_ATTENDANCE' || parts[1] !== 'STUDENT') return false;
    const sid = parseInt(parts[2], 10);
    const email = (parts[3] || '').trim();
    return sid > 0 && email.length > 0;
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
function setStatus(message, type = 'info') {
    const el = document.getElementById('scannerStatus');
    if (!el) return;
    const colors = {
        info: 'bg-white text-slate-700',
        success: 'bg-emerald-50 text-emerald-700',
        warn: 'bg-amber-50 text-amber-700',
        error: 'bg-rose-50 text-rose-700'
    };
    el.className = `scanner-status-pill absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1.5 text-center text-[11px] font-semibold ${colors[type] || colors.info}`;
    el.textContent = message;
}

function isLocalScannerHost() {
    const host = String(window.location.hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function showScannerNetworkHelp(message) {
    const el = document.getElementById('scannerNetworkHelp');
    if (!el) return;
    el.classList.remove('hidden');
    el.innerHTML = message;
}

function scannerSecureContextAvailable() {
    return window.isSecureContext || isLocalScannerHost();
}

function getScannerMixedContentError() {
    if (window.location.protocol !== 'https:') return '';
    try {
        const apiUrl = new URL(String(window.baseApiUrl || baseApiUrl || ''), window.location.href);
        if (apiUrl.protocol === 'http:') {
            return 'This HTTPS scanner is configured to call an HTTP API. The browser will block that mixed-content request. Use the same-origin /api URL or enable HTTPS for the API.';
        }
    } catch (_) {}
    return '';
}

// Clock
function updateClock() {
    const now = new Date();
    let h = now.getHours();
    const m = now.getMinutes().toString().padStart(2, '0');
    const s = now.getSeconds().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    setText('clock', `${h}:${m}:${s} ${ampm}`);
    setText('date', now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
}

async function fetchDeskSummary() {
    try {
        const branchId = getDeskBranchId();
        const url = branchId
            ? `${baseApiUrl}/attendance.php?action=desk-summary&branch_id=${encodeURIComponent(branchId)}`
            : `${baseApiUrl}/attendance.php?action=desk-summary`;
        const res = await axios.get(url);
        const data = res.data;
        if (!data.success || !data.summary) return;
        setText('summaryTotal', data.summary.total ?? 0);
        setText('summaryOnTime', data.summary.present ?? 0);
        setText('summaryInvalid', invalidScanCount);
    } catch (_) {}
}

function renderRecentScans(rows) {
    const list = document.getElementById('activeUsers');
    if (!list) return;
    if (!Array.isArray(rows) || rows.length === 0) {
        list.innerHTML = '<div class="text-sm text-slate-400">No check-ins yet.</div>';
        return;
    }
    list.innerHTML = rows.map(r => {
        const name = `${escapeHtml(r.first_name || '')} ${escapeHtml(r.last_name || '')}`.trim() || 'Student';
        const status = String(r.status || 'Present');
        const time = formatTime(r.attended_at);
        const badgeClass = status === 'Late' ? 'text-amber-700' : 'text-sky-700';
        const initials = `${String(r.first_name || '').charAt(0)}${String(r.last_name || '').charAt(0)}`.toUpperCase() || 'ST';
        return `
            <div class="user-card flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
                <div class="flex min-w-0 items-center gap-2.5">
                    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-700">${escapeHtml(initials)}</div>
                    <div class="min-w-0">
                        <div class="truncate text-xs font-semibold text-slate-800">${name}</div>
                        <div class="text-[10px] text-slate-400">Student check-in</div>
                    </div>
                </div>
                <div class="shrink-0 text-right"><div class="text-[10px] font-semibold ${badgeClass}">${escapeHtml(status)}</div><div class="text-[9px] text-slate-400">${time}</div></div>
            </div>`;
    }).join('');
}

async function fetchRecentScans() {
    try {
        const branchId = getDeskBranchId();
        const url = branchId
            ? `${baseApiUrl}/attendance.php?action=desk-recent&limit=8&branch_id=${encodeURIComponent(branchId)}`
            : `${baseApiUrl}/attendance.php?action=desk-recent&limit=8`;
        const res = await axios.get(url);
        const data = res.data;
        if (data.success) renderRecentScans(data.scans || []);
    } catch (_) {}
}

async function postScanPayload(payload) {
    try {
        const mixedContentError = getScannerMixedContentError();
        if (mixedContentError) return { success: false, error: mixedContentError };
        const branchId = getDeskBranchId();
        const res = await axios.post(`${baseApiUrl}/attendance.php?action=scan-qr`, {
            payload,
            desk_branch_id: branchId || undefined
        });
        return res.data;
    } catch (err) {
        return err?.response?.data || { success: false, error: 'Network error' };
    }
}

async function postRecordByEmail(email) {
    try {
        const mixedContentError = getScannerMixedContentError();
        if (mixedContentError) return { success: false, error: mixedContentError };
        const branchId = getDeskBranchId();
        const res = await axios.post(`${baseApiUrl}/attendance.php?action=record-by-email`, {
            email: email.trim(),
            desk_branch_id: branchId || undefined
        });
        return res.data;
    } catch (err) {
        return err?.response?.data || { success: false, error: 'Network error' };
    }
}

function handleApiResponse(data, parsed, payload, isManual) {
    if (!data.success) {
        const statusErrorCodes = ['EARLY', 'MISSED', 'NO_SESSION', 'SCHEDULE_FROZEN', 'ROOM_REQUIRED'];
        if (!statusErrorCodes.includes(String(data.error_code || '').toUpperCase())) {
            invalidScanCount += 1;
        }
        let html = `<p class="text-left text-slate-600 mb-2">${escapeHtml(data.error || 'Invalid')}</p>`;
        if (!isManual && payload) html += `<div class="text-left text-xs bg-slate-50 p-3 rounded-lg mt-2 font-mono text-slate-600 break-all">QR: ${escapeHtml(payload)}</div>`;
        if (data.student_branch_name) html += `<p class="text-left text-sm mt-2">Student branch: <strong>${escapeHtml(data.student_branch_name)}</strong></p>`;
        if (data.desk_branch_name) html += `<p class="text-left text-sm">Desk branch: <strong>${escapeHtml(data.desk_branch_name)}</strong></p>`;
        if (!isManual) setStatus(data.error || 'Invalid', 'warn');
        showScanAlert(statusErrorCodes.includes(String(data.error_code || '').toUpperCase()) ? 'Attendance Not Allowed Today' : 'Check-in Failed', html, 'warning');
        fetchDeskSummary();
        return;
    }

    const student = data.student || {};
    const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
    const branchName = student.branch_name || '—';
    const checkinStamp = data.attendance && data.attendance.attended_at
        ? formatDateTime(data.attendance.attended_at)
        : formatDateTime(new Date());
    let html = `
        <div class="text-left space-y-2">
            <p><strong>${escapeHtml(name)}</strong></p>
            <p class="text-sm">Email: ${escapeHtml(student.email || (parsed && parsed.email) || '')}</p>
            <p class="text-sm">Branch: ${escapeHtml(branchName)}</p>
            <p class="text-sm">Checked in: ${escapeHtml(checkinStamp)}</p>
        </div>`;
    if (data.already_checked_in) {
        if (!isManual) setStatus(`${name} already checked in today.`, 'warn');
        showScanAlert('Already Checked In', html + '<p class="text-amber-600 font-semibold mt-2">This student was already checked in today.</p>', 'info');
    } else {
        if (!isManual) setStatus(`${name} checked in successfully.`, 'success');
        showScanAlert('Check-in Success', html + '<p class="text-emerald-600 font-semibold mt-2">Attendance recorded.</p>', 'success');
    }
    fetchDeskSummary();
    fetchRecentScans();
}

async function handleScan(payload) {
    if (!payload) return;
    const now = Date.now();
    if (payload === lastScannedPayload && (now - lastScanTime) < SCAN_DEBOUNCE_MS) return;
    lastScannedPayload = payload;
    lastScanTime = now;

    if (!isValidQrPayload(payload)) {
        invalidScanCount += 1;
        setStatus('Invalid QR format.', 'error');
        const parsed = parseQrPayload(payload);
        showScanAlert('Invalid QR Code', `
            <p class="text-left text-slate-600 mb-3">Expected format: <code class="text-xs bg-slate-100 px-2 py-1 rounded">FAS_ATTENDANCE|STUDENT|id|email|branch_id</code></p>
            <div class="text-left text-sm bg-slate-50 p-3 rounded-lg font-mono text-slate-700 break-all">${escapeHtml(payload || '(empty)')}</div>
        `, 'error');
        fetchDeskSummary();
        return;
    }

    setStatus('Processing scan...', 'info');
    const data = await postScanPayload(payload);
    handleApiResponse(data, parseQrPayload(payload), payload, false);
}

async function handleManualEntry(email) {
    if (!email || !email.trim()) return;
    const now = Date.now();
    const key = email.trim().toLowerCase();
    if (key === lastManualEmail && (now - lastManualTime) < SCAN_DEBOUNCE_MS) return;
    lastManualEmail = key;
    lastManualTime = now;

    const data = await postRecordByEmail(email.trim());
    handleApiResponse(data, null, null, true);
}

function stopScanner() {
    if (scanAnimationFrame) {
        cancelAnimationFrame(scanAnimationFrame);
        scanAnimationFrame = 0;
    }
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    const preview = document.getElementById('preview');
    if (preview) preview.srcObject = null;
    frameDecodeBusy = false;
}

async function prepareBarcodeDetector() {
    if (typeof window.BarcodeDetector !== 'function') return null;
    try {
        if (typeof window.BarcodeDetector.getSupportedFormats === 'function') {
            const formats = await window.BarcodeDetector.getSupportedFormats();
            if (!formats.includes('qr_code')) return null;
        }
        return new window.BarcodeDetector({ formats: ['qr_code'] });
    } catch (_) {
        return null;
    }
}

async function decodeLiveFrame(preview) {
    if (frameDecodeBusy || preview.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) return;
    frameDecodeBusy = true;
    try {
        let payload = '';
        if (barcodeDetector) {
            const codes = await barcodeDetector.detect(preview);
            payload = String(codes?.[0]?.rawValue || '').trim();
        } else if (typeof jsQR === 'function') {
            const sourceWidth = preview.videoWidth || 0;
            const sourceHeight = preview.videoHeight || 0;
            if (!sourceWidth || !sourceHeight) return;
            const maxSide = 960;
            const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
            const width = Math.max(1, Math.round(sourceWidth * scale));
            const height = Math.max(1, Math.round(sourceHeight * scale));
            if (!scanCanvas) scanCanvas = document.createElement('canvas');
            scanCanvas.width = width;
            scanCanvas.height = height;
            scanContext = scanCanvas.getContext('2d', { willReadFrequently: true });
            if (!scanContext) return;
            scanContext.drawImage(preview, 0, 0, width, height);
            const pixels = scanContext.getImageData(0, 0, width, height);
            const result = jsQR(pixels.data, width, height, { inversionAttempts: 'attemptBoth' });
            payload = String(result?.data || '').trim();
        }
        if (payload) await handleScan(payload);
    } catch (error) {
        // A single undecodable video frame is normal; keep scanning.
        if (error?.name !== 'NotFoundError') console.debug('QR frame decode:', error);
    } finally {
        frameDecodeBusy = false;
    }
}

function scanVideoLoop(preview) {
    let lastFrameAt = 0;
    const tick = timestamp => {
        if (!cameraStream || document.visibilityState === 'hidden') {
            scanAnimationFrame = 0;
            return;
        }
        if (timestamp - lastFrameAt >= 120) {
            lastFrameAt = timestamp;
            decodeLiveFrame(preview);
        }
        scanAnimationFrame = requestAnimationFrame(tick);
    };
    scanAnimationFrame = requestAnimationFrame(tick);
}

async function initScanner() {
    const preview = document.getElementById('preview');
    if (!scannerSecureContextAvailable()) {
        setStatus('Live camera is blocked because this network page uses insecure HTTP. Use the photo fallback or reopen it with trusted HTTPS.', 'warn');
        showScannerNetworkHelp('<strong>Insecure page:</strong> Camera access requires a secure context. Open this page with <code>https://</code> using the trusted local certificate. The photo upload/capture fallback remains available below.');
        return;
    }
    if (!preview || !navigator.mediaDevices?.getUserMedia) {
        setStatus('Camera access is not supported by this browser. Use a QR photo or manual email entry.', 'error');
        return;
    }
    if (scannerStarting || cameraStream) return;
    scannerStarting = true;
    try {
        const mixedContentError = getScannerMixedContentError();
        if (mixedContentError) showScannerNetworkHelp(`<strong>API configuration error:</strong> ${escapeHtml(mixedContentError)}`);
        barcodeDetector = await prepareBarcodeDetector();
        if (!barcodeDetector && typeof jsQR !== 'function') {
            setStatus('QR decoder failed to load. Refresh with an internet connection or use manual email entry.', 'error');
            return;
        }
        cameraStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        preview.srcObject = cameraStream;
        await preview.play();
        setStatus('Scanner is live. Point the camera at a student QR code.', 'success');
        scanVideoLoop(preview);
    } catch (error) {
        stopScanner();
        const denied = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError';
        const missing = error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError';
        const busy = error?.name === 'NotReadableError' || error?.name === 'TrackStartError' || error?.name === 'AbortError';
        setStatus(denied
            ? 'Camera permission was denied. Allow camera access in the address bar and reload.'
            : (missing
                ? 'No camera is available on this device. Use a QR photo or manual email entry.'
                : (busy
                    ? 'The camera is already being used by another app or browser tab. Close it there, then retry.'
                    : 'Camera could not start. Use a QR photo or manual email entry.')), 'warn');
        showScannerNetworkHelp(denied
            ? '<strong>Camera permission denied.</strong> Open this site\'s permissions from the lock icon, allow Camera, then reload the page.'
            : (missing
                ? '<strong>No camera available.</strong> Connect or enable a camera, or use the photo upload/capture fallback.'
                : (busy
                    ? '<strong>Camera in use.</strong> Close other camera apps and browser tabs, then reload the page.'
                    : `<strong>Camera error:</strong> ${escapeHtml(error?.message || 'Unable to start the camera.')}`)));
        console.warn('Camera start:', error);
    } finally {
        scannerStarting = false;
    }
}

async function decodeQrImageFile(file) {
    if (!file) return;
    if (typeof jsQR !== 'function') {
        setStatus('QR image reader failed to load. Check the internet connection or use manual email entry.', 'error');
        return;
    }

    setStatus('Reading QR image...', 'info');
    try {
        let bitmap;
        let objectUrl = '';
        if (typeof createImageBitmap === 'function') {
            bitmap = await createImageBitmap(file);
        } else {
            objectUrl = URL.createObjectURL(file);
            bitmap = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('The selected image could not be loaded'));
                img.src = objectUrl;
            });
        }
        const maxSide = 1600;
        const sourceWidth = bitmap.width || bitmap.naturalWidth;
        const sourceHeight = bitmap.height || bitmap.naturalHeight;
        const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
        const width = Math.max(1, Math.round(sourceWidth * scale));
        const height = Math.max(1, Math.round(sourceHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Canvas is unavailable');
        context.drawImage(bitmap, 0, 0, width, height);
        if (typeof bitmap.close === 'function') bitmap.close();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        const imageData = context.getImageData(0, 0, width, height);
        const result = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' });
        if (!result?.data) {
            setStatus('No QR code found in that image. Retake the photo closer and in good lighting.', 'warn');
            return;
        }
        await handleScan(String(result.data).trim());
    } catch (error) {
        console.warn('QR image decode:', error);
        setStatus('Unable to read that image. Retake it or use manual email entry.', 'error');
    }
}

function initImageScanner() {
    const input = document.getElementById('qr_image_file');
    if (!input) return;
    input.addEventListener('change', async () => {
        const file = input.files?.[0] || null;
        input.value = '';
        if (file) await decodeQrImageFile(file);
    });
}

function initManualEntry() {
    const input = document.getElementById('user_email');
    if (!input) return;
    const submit = () => {
        const email = input.value.trim();
        if (!email) return;
        handleManualEntry(email);
        input.value = '';
    };
    input.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        submit();
    });
    document.getElementById('manualCheckinBtn')?.addEventListener('click', submit);
}

function initDeskScanner() {
    const user = getDeskUser();
    const role = String(user?.role_name || '').toLowerCase();
    const allowed = ['staff', 'desk', 'front desk'];
    if (!user || !allowed.includes(role)) {
        setStatus('Access denied. Please log in as desk staff.', 'error');
        const ipLoginNote = !isLocalScannerHost()
            ? '<br><br><strong>Network address note:</strong> Login from this same IP-address URL first. A localhost login cannot be shared with an IP-address URL.'
            : '';
        showScanAlert('Access Denied', `You must be logged in as desk staff to use the scanner.${ipLoginNote}`, 'warning');
        try {
            const appBase = (typeof window.appBaseUrl === 'string' && window.appBaseUrl)
                ? window.appBaseUrl
                : ((typeof window.baseApiUrl === 'string' && window.baseApiUrl.endsWith('/api'))
                    ? window.baseApiUrl.slice(0, -4)
                    : `${window.location.origin}/FAS_music`);
            window.location.href = `${appBase}/index.html`;
        } catch (_) {}
        return;
    }

    updateClock();
    setInterval(updateClock, 1000);
    const branchName = getDeskBranchName();
    if (branchName) setText('deskBranchName', branchName);
    if (typeof syncDeskNavUser === 'function') syncDeskNavUser();
    const branchId = getDeskBranchId();
    if (!branchId) {
        setStatus('No desk branch assigned. Please contact the administrator.', 'error');
        showScanAlert('Branch Required', 'Your staff account has no branch assigned. Attendance scanning is disabled.', 'error');
        return;
    }
    fetchDeskSummary();
    fetchRecentScans();
    initScanner();
    initImageScanner();
    initManualEntry();
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') stopScanner();
    else if (getDeskBranchId()) initScanner();
});

window.addEventListener('pagehide', stopScanner);

document.addEventListener('DOMContentLoaded', initDeskScanner);
