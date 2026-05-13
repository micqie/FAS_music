let scanner = null;
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
    const colors = { info: 'text-slate-200', success: 'text-emerald-300', warn: 'text-amber-300', error: 'text-red-300' };
    el.className = colors[type] || colors.info;
    el.textContent = message;
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
        const badgeClass = status === 'Late' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
        return `
            <div class="user-card flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3">
                <div class="flex items-center gap-3">
                    <div class="h-9 w-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><i class="fas fa-check"></i></div>
                    <div>
                        <div class="font-semibold text-slate-900">${name}</div>
                        <div class="text-xs text-slate-500">${time}</div>
                    </div>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-semibold ${badgeClass}">${escapeHtml(status)}</span>
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
        const statusErrorCodes = ['EARLY', 'MISSED', 'NO_SESSION'];
        if (!statusErrorCodes.includes(String(data.error_code || '').toUpperCase())) {
            invalidScanCount += 1;
        }
        let html = `<p class="text-left text-slate-600 mb-2">${escapeHtml(data.error || 'Invalid')}</p>`;
        if (!isManual && payload) html += `<div class="text-left text-xs bg-slate-50 p-3 rounded-lg mt-2 font-mono text-slate-600 break-all">QR: ${escapeHtml(payload)}</div>`;
        if (data.student_branch_name) html += `<p class="text-left text-sm mt-2">Student branch: <strong>${escapeHtml(data.student_branch_name)}</strong></p>`;
        if (data.desk_branch_name) html += `<p class="text-left text-sm">Desk branch: <strong>${escapeHtml(data.desk_branch_name)}</strong></p>`;
        setStatus(data.error || 'Invalid', 'warn');
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
        setStatus(`${name} already checked in today.`, 'warn');
        showScanAlert('Already Checked In', html + '<p class="text-amber-600 font-semibold mt-2">This student was already checked in today.</p>', 'info');
    } else {
        setStatus(`${name} checked in successfully.`, 'success');
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

    setStatus('Processing...', 'info');
    const data = await postRecordByEmail(email.trim());
    handleApiResponse(data, null, null, true);
}

function initScanner() {
    const preview = document.getElementById('preview');
    if (!preview || typeof Instascan === 'undefined') {
        setStatus('Instascan library not available.', 'error');
        return;
    }

    scanner = new Instascan.Scanner({ video: preview });

    Instascan.Camera.getCameras().then(cameras => {
        if (cameras.length === 0) {
            setStatus('No camera found. Use manual entry by email.', 'warn');
            return;
        }
        const back = cameras.find(c => (c.name || '').toLowerCase().includes('back'));
        const cam = back || cameras[0];
        scanner.start(cam).then(() => {
            setStatus('Scanner is live. Point at QR code or type email below.', 'info');
        }).catch(e => {
            setStatus('Camera access denied or failed. Use manual entry.', 'warn');
            console.warn('Scanner start:', e);
        });
    }).catch(e => {
        setStatus('Camera access denied. Use manual entry by email.', 'warn');
        console.warn('Camera error:', e);
    });

    scanner.addListener('scan', content => {
        if (content && content.trim()) handleScan(content.trim());
    });

    scanner.addListener('scan-error', () => {});
}

function initManualEntry() {
    const input = document.getElementById('user_email');
    if (!input) return;
    input.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const email = input.value.trim();
        if (email) {
            handleManualEntry(email);
            input.value = '';
        }
    });
}

function initDeskScanner() {
    const user = getDeskUser();
    const role = String(user?.role_name || '').toLowerCase();
    const allowed = ['staff', 'desk', 'front desk'];
    if (!user || !allowed.includes(role)) {
        setStatus('Access denied. Please log in as desk staff.', 'error');
        showScanAlert('Access Denied', 'You must be logged in as desk staff to use the scanner.', 'warning');
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
    const branchId = getDeskBranchId();
    if (!branchId) {
        setStatus('No desk branch assigned. Please contact the administrator.', 'error');
        showScanAlert('Branch Required', 'Your staff account has no branch assigned. Attendance scanning is disabled.', 'error');
        return;
    }
    fetchDeskSummary();
    fetchRecentScans();
    initScanner();
    initManualEntry();
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && scanner) {
        Instascan.Camera.getCameras().then(cameras => {
            if (cameras.length > 0) {
                const back = cameras.find(c => (c.name || '').toLowerCase().includes('back'));
                const cam = back || cameras[0];
                scanner.start(cam).catch(() => {});
            }
        }).catch(() => {});
    }
});

document.addEventListener('DOMContentLoaded', initDeskScanner);
