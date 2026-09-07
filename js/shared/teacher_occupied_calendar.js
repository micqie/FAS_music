(function () {
    'use strict';

    const state = {
        teacherId: 0,
        teacherName: '',
        branchId: 0,
        branchName: '',
        month: '',
        slots: [],
        reserved: [],
        occupied: [],
        selectedDate: '',
        token: 0
    };

    function esc(value) {
        const node = document.createElement('div');
        node.textContent = String(value ?? '');
        return node.innerHTML;
    }

    function localDateKey(date = new Date()) {
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    }

    function monthLabel(monthKey) {
        const [year, month] = String(monthKey || '').split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        return Number.isNaN(date.getTime()) ? monthKey : date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }

    function timeLabel(value) {
        const raw = String(value || '').slice(0, 5);
        const [hours, minutes] = raw.split(':').map(Number);
        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return raw || '—';
        const suffix = hours >= 12 ? 'PM' : 'AM';
        return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`;
    }

    function ensureModal() {
        if (document.getElementById('teacherOccupiedCalendarModal')) return;
        document.body.insertAdjacentHTML('beforeend', `
            <div id="teacherOccupiedCalendarModal" class="fixed inset-0 z-[80] hidden items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm" aria-hidden="true">
                <div class="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                    <div class="flex items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-slate-700 px-5 py-4 text-white sm:px-6">
                        <div class="min-w-0">
                            <div class="text-[10px] font-bold uppercase tracking-[.2em] text-amber-300">Teaching calendar</div>
                            <h3 id="teacherOccupiedCalendarTitle" class="mt-1 truncate text-xl font-black">Instructor Calendar</h3>
                            <p id="teacherOccupiedCalendarMeta" class="mt-1 truncate text-xs text-slate-300"></p>
                        </div>
                        <button type="button" data-close-teacher-calendar class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 hover:bg-white/20" aria-label="Close calendar"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="min-h-0 overflow-y-auto p-4 sm:p-6">
                        <div class="flex items-center justify-between gap-3">
                            <button type="button" id="teacherOccupiedCalendarPrev" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><i class="fas fa-chevron-left mr-2"></i>Prev</button>
                            <div id="teacherOccupiedCalendarMonth" class="text-base font-black text-slate-900"></div>
                            <button type="button" id="teacherOccupiedCalendarNext" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Next<i class="fas fa-chevron-right ml-2"></i></button>
                        </div>
                        <div class="mt-5 grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400"><div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div></div>
                        <div id="teacherOccupiedCalendarGrid" class="mt-2 grid grid-cols-7 gap-1.5"></div>
                        <div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">Green: available · Yellow: pending reservation · Red: occupied by a scheduled session · Gray: unavailable.</div>
                        <div id="teacherOccupiedCalendarDetails" class="mt-4"></div>
                        <div id="teacherOccupiedCalendarStatus" class="mt-4 text-sm text-slate-500" aria-live="polite"></div>
                    </div>
                </div>
            </div>
        `);

        const modal = document.getElementById('teacherOccupiedCalendarModal');
        modal.querySelector('[data-close-teacher-calendar]')?.addEventListener('click', closeTeacherOccupiedCalendar);
        modal.addEventListener('click', event => { if (event.target === modal) closeTeacherOccupiedCalendar(); });
        document.getElementById('teacherOccupiedCalendarPrev')?.addEventListener('click', () => shiftMonth(-1));
        document.getElementById('teacherOccupiedCalendarNext')?.addEventListener('click', () => shiftMonth(1));
        document.getElementById('teacherOccupiedCalendarGrid')?.addEventListener('click', event => {
            const button = event.target.closest('[data-teacher-calendar-date]');
            if (!button) return;
            state.selectedDate = button.dataset.teacherCalendarDate || '';
            renderCalendar();
        });
    }

    function shiftMonth(delta) {
        const [year, month] = state.month.split('-').map(Number);
        const date = new Date(year, month - 1 + delta, 1);
        state.month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        state.selectedDate = '';
        loadMonth();
    }

    function groupByDate(rows) {
        return rows.reduce((result, row) => {
            const date = String(row.session_date || '');
            if (!date) return result;
            if (!result[date]) result[date] = [];
            result[date].push(row);
            return result;
        }, {});
    }

    function renderDetails(available, reserved, occupied) {
        const container = document.getElementById('teacherOccupiedCalendarDetails');
        if (!container) return;
        if (!state.selectedDate) {
            container.innerHTML = '<div class="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500">Select a date to view its time slots.</div>';
            return;
        }
        const cards = [
            ...occupied.map(slot => ({ slot, label: 'Occupied session', classes: 'border-red-300 bg-red-50 text-red-800' })),
            ...reserved.map(slot => ({ slot, label: 'Pending reservation', classes: 'border-amber-300 bg-amber-50 text-amber-800' })),
            ...available.map(slot => ({ slot, label: 'Available', classes: 'border-emerald-300 bg-emerald-50 text-emerald-800' }))
        ].sort((a, b) => String(a.slot.start_time || '').localeCompare(String(b.slot.start_time || '')));
        container.innerHTML = `<div class="mb-2 text-sm font-black text-slate-900">${esc(new Date(`${state.selectedDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))}</div><div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">${cards.map(item => `<div class="rounded-xl border px-4 py-3 ${item.classes}"><div class="font-black">${esc(`${timeLabel(item.slot.start_time)} – ${timeLabel(item.slot.end_time)}`)}</div><div class="mt-1 text-xs font-bold">${item.label}</div></div>`).join('') || '<div class="text-sm text-slate-500">No teaching hours or sessions on this date.</div>'}</div>`;
    }

    function renderCalendar() {
        const grid = document.getElementById('teacherOccupiedCalendarGrid');
        const label = document.getElementById('teacherOccupiedCalendarMonth');
        if (!grid || !label) return;
        label.textContent = monthLabel(state.month);
        const [year, month] = state.month.split('-').map(Number);
        const first = new Date(year, month - 1, 1);
        const days = new Date(year, month, 0).getDate();
        const available = groupByDate(state.slots);
        const reserved = groupByDate(state.reserved);
        const occupied = groupByDate(state.occupied);
        let html = Array.from({ length: first.getDay() }, () => '<div class="h-16"></div>').join('');
        for (let day = 1; day <= days; day += 1) {
            const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const openCount = (available[date] || []).length;
            const reservedCount = (reserved[date] || []).length;
            const occupiedCount = (occupied[date] || []).length;
            const hasInfo = openCount || reservedCount || occupiedCount;
            const selected = state.selectedDate === date;
            const color = occupiedCount ? 'border-red-300 bg-red-100 text-red-900' : reservedCount ? 'border-amber-300 bg-amber-100 text-amber-900' : openCount ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-slate-100 text-slate-400';
            const status = occupiedCount ? `${occupiedCount} occupied` : reservedCount ? `${reservedCount} reserved` : openCount ? `${openCount} available` : 'Unavailable';
            html += `<button type="button" data-teacher-calendar-date="${date}" class="h-16 rounded-xl border p-2 text-left transition ${color} ${hasInfo ? 'hover:brightness-95' : ''} ${selected ? 'ring-2 ring-slate-900/30' : ''}"><div class="flex items-start justify-between"><span class="font-black">${day}</span>${occupiedCount ? `<span class="rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">${occupiedCount}</span>` : reservedCount ? `<span class="rounded-full bg-amber-600 px-1.5 py-0.5 text-[9px] font-bold text-white">${reservedCount}</span>` : openCount ? `<span class="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">${openCount}</span>` : ''}</div><div class="mt-1 text-[9px] font-bold">${status}</div></button>`;
        }
        grid.innerHTML = html;
        renderDetails(available[state.selectedDate] || [], reserved[state.selectedDate] || [], occupied[state.selectedDate] || []);
    }

    async function loadMonth() {
        const status = document.getElementById('teacherOccupiedCalendarStatus');
        const [year, month] = state.month.split('-').map(Number);
        const start = `${year}-${String(month).padStart(2, '0')}-01`;
        const end = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
        const token = ++state.token;
        state.slots = [];
        state.reserved = [];
        state.occupied = [];
        renderCalendar();
        if (status) status.innerHTML = '<i class="fas fa-spinner fa-spin mr-2 text-amber-600"></i>Loading instructor calendar...';
        try {
            const params = new URLSearchParams({ action: 'get-teacher-available-slots', teacher_id: String(state.teacherId), branch_id: String(state.branchId || 0), student_id: '0', start_date: start, end_date: end });
            const response = await axios.get(`${baseApiUrl}/students.php?${params.toString()}`, { timeout: 20000 });
            if (token !== state.token) return;
            const data = response.data || {};
            if (!data.success) throw new Error(data.error || 'Unable to load instructor calendar.');
            state.slots = Array.isArray(data.slots) ? data.slots : [];
            state.reserved = Array.isArray(data.reserved_slots) ? data.reserved_slots : [];
            state.occupied = Array.isArray(data.occupied_slots) ? data.occupied_slots : [];
            renderCalendar();
            if (status) status.textContent = `${state.occupied.length} occupied session slot${state.occupied.length === 1 ? '' : 's'} in ${monthLabel(state.month)}.`;
        } catch (error) {
            if (token !== state.token) return;
            if (status) status.textContent = error?.response?.data?.error || error.message || 'Unable to load instructor calendar.';
        }
    }

    function openTeacherOccupiedCalendar(teacherId, teacherName, branchId, branchName) {
        ensureModal();
        state.teacherId = Number(teacherId || 0);
        state.teacherName = String(teacherName || 'Instructor');
        state.branchId = Number(branchId || 0);
        state.branchName = String(branchName || '');
        state.month = localDateKey().slice(0, 7);
        state.selectedDate = '';
        document.getElementById('teacherOccupiedCalendarTitle').textContent = `${state.teacherName} Calendar`;
        document.getElementById('teacherOccupiedCalendarMeta').textContent = `${state.branchName || 'All branches'} • Availability and occupied sessions`;
        const modal = document.getElementById('teacherOccupiedCalendarModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        modal.setAttribute('aria-hidden', 'false');
        loadMonth();
    }

    function closeTeacherOccupiedCalendar() {
        state.token += 1;
        const modal = document.getElementById('teacherOccupiedCalendarModal');
        modal?.classList.add('hidden');
        modal?.classList.remove('flex');
        modal?.setAttribute('aria-hidden', 'true');
    }

    window.openTeacherOccupiedCalendar = openTeacherOccupiedCalendar;
    window.closeTeacherOccupiedCalendar = closeTeacherOccupiedCalendar;
})();
