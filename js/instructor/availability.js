const availabilityDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const availabilityState = {
    rows: [],
    calendarOffset: 0
};

function toggleInstructorMenu() {
    const menu = document.getElementById('instructorMobileMenu');
    const icon = document.getElementById('instructorMenuIcon');
    if (!menu || !icon) return;
    const isHidden = menu.classList.contains('hidden');
    menu.classList.toggle('hidden');
    icon.classList.toggle('fa-bars', !isHidden);
    icon.classList.toggle('fa-times', isHidden);
}

function showAvailabilityStatus(message, type = 'success') {
    const box = document.getElementById('availabilityStatus');
    if (!box) return;
    box.textContent = message;
    box.className = `mt-4 rounded-2xl border px-4 py-3 text-sm ${type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`;
    box.classList.remove('hidden');
}

function parseTimeToMinutes(timeValue) {
    const raw = String(timeValue || '').trim();
    if (!raw) return null;
    const [hourText, minuteText] = raw.split(':');
    const hours = Number(hourText);
    const minutes = Number(minuteText);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return hours * 60 + minutes;
}

function formatTime12Hour(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const parts = raw.split(':');
    let hours = Number(parts[0]);
    const minutes = Number(parts[1] || 0);
    if (!Number.isFinite(hours)) return raw;
    const suffix = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function getAvailableWeekdays(rows = []) {
    return new Set(
        rows
            .filter(row => String(row.start_time || '').trim() && String(row.end_time || '').trim())
            .map(row => String(row.day_of_week || '').trim())
            .filter(Boolean)
    );
}

function renderWeeklySchedule(rows = []) {
    const grid = document.getElementById('availabilityGrid');
    const hoursEl = document.getElementById('availabilitySummaryHours');
    const daysEl = document.getElementById('availabilitySummaryDays');
    if (!grid) return;

    const byDay = new Map(rows.map(item => [item.day_of_week, item]));
    let totalMinutes = 0;
    let totalDays = 0;

    grid.innerHTML = availabilityDays.map(day => {
        const row = byDay.get(day) || {};
        const start = String(row.start_time || '').slice(0, 5);
        const end = String(row.end_time || '').slice(0, 5);
        const enabled = !!start && !!end;
        const startMinutes = parseTimeToMinutes(start);
        const endMinutes = parseTimeToMinutes(end);
        if (enabled && startMinutes !== null && endMinutes !== null && endMinutes > startMinutes) {
            totalMinutes += (endMinutes - startMinutes);
            totalDays++;
        }

        const timeLabel = enabled
            ? `${formatTime12Hour(start)} - ${formatTime12Hour(end)}`
            : 'Not available';
        const rowTone = enabled
            ? 'bg-white text-slate-900'
            : 'bg-slate-50 text-slate-400';
        const badgeTone = enabled
            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
            : 'bg-slate-100 text-slate-500 border-slate-200';
        const dotTone = enabled ? 'bg-emerald-400' : 'bg-slate-300';

        return `
            <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 px-5 py-4 border-b border-slate-200 last:border-b-0 ${rowTone}">
                <div class="min-w-[7rem] flex items-center gap-3">
                    <span class="h-2.5 w-2.5 rounded-full ${dotTone}"></span>
                    <span class="font-semibold text-slate-900">${day}</span>
                </div>
                <div class="flex-1">
                    <span class="inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-semibold ${badgeTone}">
                        ${timeLabel}
                    </span>
                </div>
                <div class="text-sm text-slate-500">${enabled ? (row.note || '') : (row.reason || 'Managed by branch manager')}</div>
            </div>
        `;
    }).join('');

    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    if (hoursEl) hoursEl.textContent = `${totalHours % 1 === 0 ? totalHours.toFixed(0) : totalHours} hrs`;
    if (daysEl) daysEl.textContent = `across ${totalDays} teaching day${totalDays === 1 ? '' : 's'}`;
}

function renderCalendar() {
    const calendarEl = document.getElementById('availabilityCalendar');
    const titleEl = document.getElementById('availabilityCalendarTitle');
    if (!calendarEl || !titleEl) return;

    const baseDate = new Date();
    baseDate.setDate(1);
    baseDate.setMonth(baseDate.getMonth() + availabilityState.calendarOffset);

    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const monthName = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(baseDate);
    titleEl.textContent = monthName;

    const firstDayIndex = (baseDate.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const availableWeekdays = getAvailableWeekdays(availabilityState.rows);

    const cells = [];
    for (let i = 0; i < firstDayIndex; i++) {
        cells.push('<div class="h-11 rounded-xl bg-transparent"></div>');
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const weekdayName = availabilityDays[(date.getDay() + 6) % 7];
        const isAvailable = availableWeekdays.has(weekdayName);
        const isToday =
            date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate();
        const cellClass = isToday
            ? 'border-gold-300 bg-gold-50 text-slate-900'
            : 'border-slate-200 bg-white text-slate-700';
        const dot = isAvailable
            ? '<span class="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500"></span>'
            : '<span class="mt-1 h-1.5 w-1.5 rounded-full bg-transparent"></span>';

        cells.push(`
            <button type="button" class="h-11 rounded-xl border ${cellClass} flex flex-col items-center justify-center text-sm font-semibold transition hover:bg-slate-50">
                <span>${day}</span>
                ${dot}
            </button>
        `);
    }

    calendarEl.innerHTML = cells.join('');
}

async function loadAvailability() {
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
    if (!user?.user_id) {
        renderWeeklySchedule([]);
        renderCalendar();
        return;
    }

    try {
        const response = await axios.get(`${baseApiUrl}/teachers.php?action=get-teacher-availability&user_id=${encodeURIComponent(user.user_id)}`);
        const rows = response.data?.success && Array.isArray(response.data.availability) ? response.data.availability : [];
        availabilityState.rows = rows;
        renderWeeklySchedule(rows);
        renderCalendar();
    } catch (error) {
        console.error('Failed to load availability:', error);
        availabilityState.rows = [];
        renderWeeklySchedule([]);
        renderCalendar();
        showAvailabilityStatus('Failed to load saved availability.', 'error');
    }
}

function bindCalendarControls() {
    document.getElementById('calendarPrevBtn')?.addEventListener('click', () => {
        availabilityState.calendarOffset -= 1;
        renderCalendar();
    });
    document.getElementById('calendarNextBtn')?.addEventListener('click', () => {
        availabilityState.calendarOffset += 1;
        renderCalendar();
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof Auth !== 'undefined' && Auth.getUser) {
        const user = Auth.getUser() || {};
        const displayName = user.username || user.email || 'Instructor';
        const nameEl = document.getElementById('instructorNameNav');
        if (nameEl) nameEl.textContent = displayName;
    }
    bindCalendarControls();
    await loadAvailability();
});
