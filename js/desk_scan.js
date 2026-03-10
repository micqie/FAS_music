let deskScanner = null;
let deskCameras = [];
let activeCamera = null;
let invalidScanCount = 0;

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

function setStatus(message, type = 'info') {
    const el = document.getElementById('scannerStatus');
    if (!el) return;
    const colors = {
        info: 'text-slate-200',
        success: 'text-emerald-300',
        warn: 'text-amber-300',
        error: 'text-red-300'
    };
    el.className = colors[type] || colors.info;
    el.textContent = message;
}

async function fetchDeskSummary() {
    try {
        const res = await axios.get(`${baseApiUrl}/attendance.php?action=desk-summary`);
        const data = res.data;
        if (!data.success || !data.summary) return;
        setText('summaryTotal', data.summary.total ?? 0);
        setText('summaryOnTime', data.summary.present ?? 0);
        setText('summaryLate', data.summary.late ?? 0);
        setText('summaryInvalid', invalidScanCount);
    } catch (err) {
        // Keep UI quiet on summary fetch errors
    }
}

function renderRecentScans(rows) {
    const list = document.getElementById('recentScansList');
    if (!list) return;
    if (!Array.isArray(rows) || rows.length === 0) {
        list.innerHTML = '<div class="text-sm text-slate-400">No scans yet.</div>';
        return;
    }
    list.innerHTML = rows.map(r => {
        const name = `${escapeHtml(r.first_name || '')} ${escapeHtml(r.last_name || '')}`.trim() || 'Student';
        const status = String(r.status || 'Present');
        const time = formatTime(r.attended_at);
        const badgeClass = status === 'Late'
            ? 'bg-amber-100 text-amber-700'
            : 'bg-emerald-100 text-emerald-700';
        return `
            <div class="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3">
                <div class="flex items-center gap-3">
                    <div class="h-9 w-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <i class="fas fa-check"></i>
                    </div>
                    <div>
                        <div class="font-semibold text-slate-900">${name}</div>
                        <div class="text-xs text-slate-500">${time}</div>
                    </div>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-semibold ${badgeClass}">${escapeHtml(status)}</span>
            </div>
        `;
    }).join('');
}

async function fetchRecentScans() {
    try {
        const res = await axios.get(`${baseApiUrl}/attendance.php?action=desk-recent&limit=8`);
        const data = res.data;
        if (data.success) renderRecentScans(data.scans || []);
    } catch (err) {
        // Silent failure for recent list
    }
}

async function postScanPayload(payload) {
    try {
        const res = await axios.post(`${baseApiUrl}/attendance.php?action=scan-qr`, { payload });
        return res.data;
    } catch (err) {
        return { success: false, error: 'Network error' };
    }
}

async function handleScan(payload) {
    if (!payload) return;
    setStatus('Processing scan...', 'info');
    const data = await postScanPayload(payload);
    if (!data.success) {
        invalidScanCount += 1;
        setStatus(data.error || 'Invalid scan', 'error');
        fetchDeskSummary();
        return;
    }

    const student = data.student || {};
    const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
    if (data.already_checked_in) {
        setStatus(`${name} already checked in today.`, 'warn');
    } else {
        setStatus(`${name} checked in successfully.`, 'success');
    }
    fetchDeskSummary();
    fetchRecentScans();
}

async function initScanner() {
    const video = document.getElementById('scannerPreview');
    const cameraSelect = document.getElementById('cameraSelect');
    if (!video || typeof Instascan === 'undefined') {
        setStatus('Camera library not available.', 'error');
        return;
    }

    video.setAttribute('playsinline', 'true');
    video.setAttribute('autoplay', 'true');
    video.setAttribute('muted', 'true');

    deskScanner = new Instascan.Scanner({ video, mirror: false, scanPeriod: 5 });
    video.style.transform = 'none';
    deskScanner.addListener('scan', handleScan);

    try {
        deskCameras = await Instascan.Camera.getCameras();
        if (!deskCameras.length) {
            setStatus('No camera found on this device.', 'error');
            return;
        }

        if (cameraSelect) {
            cameraSelect.innerHTML = deskCameras.map((c, idx) =>
                `<option value="${idx}">${escapeHtml(c.name || `Camera ${idx + 1}`)}</option>`
            ).join('');
            cameraSelect.addEventListener('change', (e) => {
                const idx = Number(e.target.value || 0);
                const cam = deskCameras[idx];
                if (cam) {
                    activeCamera = cam;
                    deskScanner.start(cam);
                }
            });
        }

        const preferred = deskCameras.find(c => /back|rear|environment/i.test(c.name || '')) || deskCameras[0];
        await deskScanner.start(preferred);
        activeCamera = preferred;
        if (cameraSelect) {
            const idx = deskCameras.indexOf(preferred);
            if (idx >= 0) cameraSelect.value = String(idx);
        }
        setStatus('Scanner is live. Ready to check-in.', 'info');
    } catch (err) {
        setStatus('Camera access was blocked.', 'error');
    }
}

function initSimulateButton() {
    const btn = document.getElementById('simulateScanBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const payload = window.prompt('Paste a student QR payload:', 'FAS_ATTENDANCE|STUDENT|1|student@email.com');
        if (payload) handleScan(payload.trim());
    });
}

function initManualCheckin() {
    const btn = document.getElementById('manualCheckinBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const payload = window.prompt('Paste a student QR payload for manual check-in:');
        if (payload) handleScan(payload.trim());
    });
}

function initRefresh() {
    document.getElementById('refreshRecentBtn')?.addEventListener('click', () => {
        fetchRecentScans();
        fetchDeskSummary();
    });
}

function initDeskScanner() {
    fetchDeskSummary();
    fetchRecentScans();
    initScanner();
    initSimulateButton();
    initManualCheckin();
    initRefresh();
}

document.addEventListener('DOMContentLoaded', initDeskScanner);

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && deskScanner && activeCamera) {
        deskScanner.start(activeCamera).catch(() => {
            setStatus('Camera needs permission to resume.', 'warn');
        });
    }
});
