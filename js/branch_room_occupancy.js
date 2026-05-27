let roomOccupancyRefreshTimer = null;

function formatOccupancyTime12Hour(timeString) {
    if (!timeString) return '—';
    const [rawHour, rawMinute] = String(timeString).split(':');
    const hour = Number(rawHour);
    const minute = Number(rawMinute);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return String(timeString);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${normalizedHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function getOccupancyBranchUser() {
    if (typeof Auth === 'undefined' || !Auth.getUser) return null;
    return Auth.getUser();
}

function getOccupancyBranchId() {
    const user = getOccupancyBranchUser();
    return Number(user?.branch_id || 0);
}

function getOccupancyBranchName() {
    const user = getOccupancyBranchUser();
    return String(user?.branch_name || '').trim() || 'Assigned branch';
}

function escapeOccupancyHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function getOccupancyMinutesRemaining(endTime) {
    if (!endTime) return null;
    const now = new Date();
    const [hour, minute, second] = String(endTime).split(':').map(Number);
    if (![hour, minute].every(Number.isFinite)) return null;
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute || 0, Number.isFinite(second) ? second : 0);
    const diffMs = end.getTime() - now.getTime();
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / 60000);
}

function renderRoomOccupancy(data) {
    const summaryEl = document.getElementById('roomOccupancySummary');
    const gridEl = document.getElementById('roomOccupancyGrid');
    const updatedAtEl = document.getElementById('roomOccupancyUpdatedAt');
    if (!summaryEl || !gridEl || !updatedAtEl) return;

    const summary = data?.summary || {};
    const rooms = Array.isArray(data?.rooms) ? data.rooms : [];
    const branchName = getOccupancyBranchName();

    summaryEl.innerHTML = `
        <div class="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3">
            <div class="text-[11px] font-bold uppercase tracking-[0.24em] text-rose-500">Occupied</div>
            <div class="mt-1 text-2xl font-black text-rose-700">${Number(summary.occupied_rooms || 0)}</div>
        </div>
        <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <div class="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-500">Available</div>
            <div class="mt-1 text-2xl font-black text-emerald-700">${Number(summary.available_rooms || 0)}</div>
        </div>
        <div class="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
            <div class="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-500">Maintenance</div>
            <div class="mt-1 text-2xl font-black text-amber-700">${Number(summary.maintenance_rooms || 0)}</div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div class="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Branch</div>
            <div class="mt-1 text-sm font-bold text-slate-900">${escapeOccupancyHtml(branchName)}</div>
        </div>
    `;

    if (!rooms.length) {
        gridEl.innerHTML = `
            <div class="col-span-full rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                No active rooms were found for this branch.
            </div>
        `;
        updatedAtEl.textContent = 'No room data available yet.';
        return;
    }

    gridEl.innerHTML = rooms.map(room => {
        const state = String(room.occupancy_state || 'available').toLowerCase();
        const active = room.active_session || null;
        const upcoming = room.upcoming_session || null;
        const remaining = active ? getOccupancyMinutesRemaining(active.end_time) : null;

        let cardClass = 'border-emerald-200 bg-emerald-50 text-emerald-900';
        let badgeClass = 'bg-emerald-600 text-white';
        let badgeText = 'Available';
        let accentClass = '';

        if (state === 'occupied') {
            cardClass = 'border-rose-200 bg-rose-50 text-rose-900 shadow-lg shadow-rose-100';
            badgeClass = 'bg-rose-600 text-white animate-pulse';
            badgeText = 'Occupied';
            accentClass = 'ring-2 ring-rose-200';
        } else if (state === 'maintenance') {
            cardClass = 'border-amber-200 bg-amber-50 text-amber-900';
            badgeClass = 'bg-amber-500 text-white';
            badgeText = 'Maintenance';
        }

        const meta = active
            ? `
                <div class="mt-4 space-y-2 text-sm">
                    <div class="font-bold text-slate-900">${escapeOccupancyHtml(active.student_name || 'Student in session')}</div>
                    <div class="text-slate-600">${escapeOccupancyHtml(active.package_name || 'Package pending')} • ${escapeOccupancyHtml(active.teacher_name || 'Instructor pending')}</div>
                    <div class="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 border border-white">
                        ${escapeOccupancyHtml(formatOccupancyTime12Hour(active.start_time))} - ${escapeOccupancyHtml(formatOccupancyTime12Hour(active.end_time))}
                    </div>
                    <div class="text-xs font-semibold text-rose-700">
                        ${remaining === null ? 'Currently in progress' : `${remaining} minute${remaining === 1 ? '' : 's'} remaining`}
                    </div>
                </div>
            `
            : (state === 'maintenance'
                ? `<div class="mt-4 text-sm text-amber-800">This room is currently marked under maintenance.</div>`
                : `
                    <div class="mt-4 space-y-2 text-sm text-slate-600">
                        <div>No session is active in this room right now.</div>
                        <div class="text-xs font-semibold text-emerald-700">
                            ${upcoming ? `Next: ${escapeOccupancyHtml(formatOccupancyTime12Hour(upcoming.start_time))} - ${escapeOccupancyHtml(formatOccupancyTime12Hour(upcoming.end_time))}` : 'No more sessions scheduled today.'}
                        </div>
                    </div>
                `);

        return `
            <div class="rounded-[1.75rem] border p-4 transition ${cardClass} ${accentClass}">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <div class="text-lg font-black text-slate-900">${escapeOccupancyHtml(room.room_name || 'Room')}</div>
                        <div class="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">${escapeOccupancyHtml(room.room_type || 'Room')} • Cap ${Number(room.capacity || 0)}</div>
                    </div>
                    <span class="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold ${badgeClass}">
                        ${escapeOccupancyHtml(badgeText)}
                    </span>
                </div>
                ${meta}
            </div>
        `;
    }).join('');

    updatedAtEl.textContent = `Auto-refreshing every 30 seconds • Updated ${new Date().toLocaleTimeString()}`;
}

async function loadBranchRoomOccupancy() {
    const gridEl = document.getElementById('roomOccupancyGrid');
    const branchId = getOccupancyBranchId();
    if (!gridEl || branchId < 1 || typeof axios === 'undefined') return;

    try {
        gridEl.innerHTML = `
            <div class="col-span-full rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                Loading live room occupancy...
            </div>
        `;

        const response = await axios.get(`${baseApiUrl}/rooms.php?action=get-occupancy&branch_id=${encodeURIComponent(branchId)}`);
        const data = response.data || {};
        if (!data.success) {
            throw new Error(data.error || 'Failed to load room occupancy.');
        }
        renderRoomOccupancy(data);
    } catch (error) {
        const updatedAtEl = document.getElementById('roomOccupancyUpdatedAt');
        gridEl.innerHTML = `
            <div class="col-span-full rounded-2xl border border-dashed border-red-200 bg-red-50 px-4 py-10 text-center text-sm text-red-600">
                Failed to load room occupancy.
            </div>
        `;
        if (updatedAtEl) {
            updatedAtEl.textContent = error?.message || 'Could not refresh room occupancy.';
        }
    }
}

function initBranchRoomOccupancyTracker() {
    const tracker = document.getElementById('roomOccupancyTracker');
    if (!tracker) return;

    document.getElementById('roomOccupancyRefreshBtn')?.addEventListener('click', loadBranchRoomOccupancy);
    loadBranchRoomOccupancy();

    if (roomOccupancyRefreshTimer) {
        window.clearInterval(roomOccupancyRefreshTimer);
    }
    roomOccupancyRefreshTimer = window.setInterval(loadBranchRoomOccupancy, 30000);
}

document.addEventListener('DOMContentLoaded', initBranchRoomOccupancyTracker);
