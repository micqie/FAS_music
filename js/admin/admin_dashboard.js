function formatPeso(value) {
    const num = Number(value) || 0;
    return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
    const date = parseDate(value);
    if (!date) return 'No timestamp';
    return date.toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function getNextScheduledSession(enrollment) {
    const now = new Date();
    const sessions = Array.isArray(enrollment?.sessions_list) ? enrollment.sessions_list : [];
    return sessions
        .filter(session => {
            if (!session?.session_date) return false;
            const status = String(session.status || '').toLowerCase();
            if (['completed', 'present', 'late', 'absent', 'cancelled', 'cancelled_by_teacher', 'rescheduled'].includes(status)) return false;
            const sessionDateTime = parseDate(`${session.session_date}T${session.start_time || '00:00:00'}`);
            return sessionDateTime && sessionDateTime >= now;
        })
        .sort((a, b) => {
            const left = parseDate(`${a.session_date}T${a.start_time || '00:00:00'}`)?.getTime() || 0;
            const right = parseDate(`${b.session_date}T${b.start_time || '00:00:00'}`)?.getTime() || 0;
            return left - right;
        })[0] || null;
}

function formatNextSessionLabel(enrollment) {
    const nextSession = getNextScheduledSession(enrollment);
    if (!nextSession) return 'No upcoming sessions';
    const dateText = parseDate(nextSession.session_date)?.toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }) || '—';
    const timeText = nextSession.start_time ? `${formatTime12Hour(nextSession.start_time)} - ${formatTime12Hour(nextSession.end_time)}` : '';
    return timeText ? `${dateText} • ${timeText}` : dateText;
}

function formatTime12Hour(timeString) {
    if (!timeString) return '—';
    const parts = String(timeString).split(':');
    if (parts.length < 2) return timeString;
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return timeString;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${normalizedHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function monthKeyFromDate(value) {
    const date = parseDate(value);
    if (!date) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function percentDelta(current, previous) {
    const now = Number(current || 0);
    const before = Number(previous || 0);
    if (before <= 0) return now > 0 ? 100 : 0;
    return ((now - before) / before) * 100;
}

function renderExecutiveStats(branches, registrations, revenueData, enrollments) {
    const activeStudentsEl = document.getElementById('statActiveStudents');
    const activeStudentsMetaEl = document.getElementById('statActiveStudentsMeta');
    const revenueEl = document.getElementById('statRevenue');
    const revenueMetaEl = document.getElementById('statRevenueMeta');
    const activeBranchesEl = document.getElementById('statActiveBranches');
    const activeBranchesMetaEl = document.getElementById('statActiveBranchesMeta');
    const classesTodayEl = document.getElementById('statClassesToday');
    const classesTodayMetaEl = document.getElementById('statClassesTodayMeta');

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthKey = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const activeEnrollments = Array.isArray(enrollments) ? enrollments : [];
    const activeStudentIds = new Set(activeEnrollments.map(item => Number(item.student_id || 0)).filter(Boolean));
    const newThisMonthIds = new Set(
        activeEnrollments
            .filter(item => monthKeyFromDate(item.created_at || item.start_date) === currentMonthKey)
            .map(item => Number(item.student_id || 0))
            .filter(Boolean)
    );

    let totalRevenue = 0;
    if (revenueData && revenueData.success) {
        totalRevenue = Number(revenueData.total_revenue || 0);
    } else {
        const registrationRevenue = (registrations || []).reduce((sum, reg) => sum + Number(reg.registration_fee_paid || 0), 0);
        const enrollmentRevenue = activeEnrollments.reduce((sum, item) => sum + Number(item.paid_amount || 0), 0);
        totalRevenue = registrationRevenue + enrollmentRevenue;
    }

    const currentMonthRevenue =
        (registrations || [])
            .filter(item => monthKeyFromDate(item.created_at) === currentMonthKey)
            .reduce((sum, item) => sum + Number(item.registration_fee_paid || 0), 0) +
        activeEnrollments
            .filter(item => monthKeyFromDate(item.created_at || item.start_date) === currentMonthKey)
            .reduce((sum, item) => sum + Number(item.paid_amount || 0), 0);

    const previousMonthRevenue =
        (registrations || [])
            .filter(item => monthKeyFromDate(item.created_at) === previousMonthKey)
            .reduce((sum, item) => sum + Number(item.registration_fee_paid || 0), 0) +
        activeEnrollments
            .filter(item => monthKeyFromDate(item.created_at || item.start_date) === previousMonthKey)
            .reduce((sum, item) => sum + Number(item.paid_amount || 0), 0);

    const activeBranches = (branches || []).filter(item => String(item.status || '').toLowerCase() === 'active').length;
    const totalBranches = Array.isArray(branches) ? branches.length : 0;

    const todaySessions = activeEnrollments.flatMap(item => Array.isArray(item.sessions_list) ? item.sessions_list : [])
        .filter(session => String(session.session_date || '') === todayKey)
        .filter(session => !['cancelled_by_teacher', 'rescheduled', 'cancelled'].includes(String(session.status || '').toLowerCase()));

    const ongoingNow = todaySessions.filter(session => {
        const start = parseDate(`${session.session_date}T${session.start_time || '00:00:00'}`);
        const end = parseDate(`${session.session_date}T${session.end_time || session.start_time || '23:59:59'}`);
        return start && end && start <= now && end >= now;
    }).length;

    if (activeStudentsEl) activeStudentsEl.textContent = Number(activeStudentIds.size || 0).toLocaleString('en-PH');
    if (activeStudentsMetaEl) activeStudentsMetaEl.textContent = `+${Number(newThisMonthIds.size || 0).toLocaleString('en-PH')} new this month`;
    if (revenueEl) revenueEl.textContent = formatPeso(totalRevenue);
    if (revenueMetaEl) {
        const delta = percentDelta(currentMonthRevenue, previousMonthRevenue);
        const arrow = delta >= 0 ? '↑' : '↓';
        revenueMetaEl.textContent = `${arrow} ${Math.abs(delta).toFixed(1)}%`;
    }
    if (activeBranchesEl) activeBranchesEl.textContent = `${activeBranches} / ${totalBranches}`;
    if (activeBranchesMetaEl) activeBranchesMetaEl.textContent = 'Operational today';
    if (classesTodayEl) classesTodayEl.textContent = Number(todaySessions.length || 0).toLocaleString('en-PH');
    if (classesTodayMetaEl) classesTodayMetaEl.textContent = `${ongoingNow} ongoing now`;
}

function displayRecentActivity(registrations) {
    const recentDiv = document.getElementById('recentActivity');
    if (!recentDiv) return;

    if (!registrations || registrations.length === 0) {
        recentDiv.innerHTML = `
            <div class="text-center py-8 text-black">
                <i class="fas fa-inbox text-4xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No registrations yet</p>
            </div>
        `;
        return;
    }

    const sorted = [...registrations].sort((a, b) => {
        const left = parseDate(b.created_at)?.getTime() || 0;
        const right = parseDate(a.created_at)?.getTime() || 0;
        return left - right;
    });

    const recent = sorted.slice(0, 5);
    recentDiv.innerHTML = recent.map(reg => {
        const statusColors = {
            'Pending': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
            'Fee Paid': 'bg-green-500/10 text-green-600 border-green-500/20',
            'Approved': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
            'Rejected': 'bg-red-500/10 text-red-600 border-red-500/20'
        };
        const statusClass = statusColors[reg.registration_status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';

        return `
            <div class="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition mb-2">
                <div class="flex items-center gap-3">
                    <div class="h-10 w-10 rounded-full bg-gold-500/10 flex items-center justify-center">
                        <i class="fas fa-user text-gold-500"></i>
                    </div>
                    <div>
                        <p class="font-medium text-black">${escapeHtml(`${reg.first_name || ''} ${reg.last_name || ''}`.trim() || 'Student')}</p>
                        <p class="text-xs text-gray-500">${escapeHtml(reg.branch_name || 'No branch')} • ${formatDateTime(reg.created_at)}</p>
                    </div>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-semibold border ${statusClass}">
                    ${escapeHtml(reg.registration_status || 'Unknown')}
                </span>
            </div>
        `;
    }).join('');
}

function renderBranches(branches) {
    const branchesDiv = document.getElementById('branchesList');
    if (!branchesDiv) return;

    if (!branches || branches.length === 0) {
        branchesDiv.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-building text-4xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No branches found</p>
            </div>
        `;
        return;
    }

    branchesDiv.innerHTML = branches.map(branch => `
        <div class="flex items-start gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
            <div class="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <i class="fas fa-building text-blue-500"></i>
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-semibold text-gray-900 truncate">${escapeHtml(branch.branch_name)}</p>
                ${branch.address ? `<p class="text-xs text-gray-500 truncate mt-1">${escapeHtml(branch.address)}</p>` : ''}
                ${branch.phone ? `<p class="text-xs text-gray-500 mt-1"><i class="fas fa-phone mr-1"></i>${escapeHtml(branch.phone)}</p>` : ''}
            </div>
        </div>
    `).join('');
}

function renderBranchMovements(branches, registrations, enrollments, teachers) {
    const board = document.getElementById('branchMovementBoard');
    if (!board) return;

    if (!branches || branches.length === 0) {
        board.innerHTML = '<div class="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">No branches available.</div>';
        return;
    }

    const cards = branches.map(branch => {
        const branchId = Number(branch.branch_id || 0);
        const branchRegistrations = registrations.filter(item => Number(item.branch_id || 0) === branchId);
        const branchEnrollments = enrollments.filter(item => Number(item.branch_id || 0) === branchId);
        const branchTeachers = teachers.filter(item => Number(item.branch_id || 0) === branchId);

        const instrumentCounts = branchEnrollments.reduce((acc, item) => {
            const instrumentName = String(item.instrument_name || '').trim() || 'Unassigned Instrument';
            acc[instrumentName] = (acc[instrumentName] || 0) + 1;
            return acc;
        }, {});
        const topInstrumentEntry = Object.entries(instrumentCounts)
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || null;
        const topInstrumentName = topInstrumentEntry ? topInstrumentEntry[0] : 'No enrollments yet';
        const topInstrumentCount = topInstrumentEntry ? Number(topInstrumentEntry[1] || 0) : 0;

        const latestRegistration = [...branchRegistrations].sort((a, b) => (parseDate(b.created_at)?.getTime() || 0) - (parseDate(a.created_at)?.getTime() || 0))[0] || null;
        const latestEnrollment = [...branchEnrollments].sort((a, b) => (parseDate(b.created_at)?.getTime() || 0) - (parseDate(a.created_at)?.getTime() || 0))[0] || null;
        const latestActivityTimestamp = [latestRegistration?.created_at, latestEnrollment?.created_at]
            .filter(Boolean)
            .sort((a, b) => (parseDate(b)?.getTime() || 0) - (parseDate(a)?.getTime() || 0))[0] || null;

        const pendingCount = branchRegistrations.filter(item => item.registration_status === 'Pending').length;
        const feePaidCount = branchRegistrations.filter(item => item.registration_status === 'Fee Paid').length;
        const activeStudents = new Set(branchEnrollments.map(item => Number(item.student_id || 0)).filter(Boolean)).size;
        const activeTeachers = branchTeachers.filter(item => String(item.status || '').toLowerCase() === 'active').length;
        const outstandingBalance = branchEnrollments.reduce((sum, item) => {
            const total = Number(item.total_amount || 0);
            const paid = Number(item.paid_amount || 0);
            return sum + Math.max(0, total - paid);
        }, 0);
        const branchAbsenceRows = branchEnrollments
            .map(item => ({
                ...item,
                usedAbsences: Number(item.used_absences || 0),
                consecutiveAbsences: Number(item.consecutive_absences || 0),
                allowedAbsences: Number(item.allowed_absences || 0)
            }))
            .filter(item => item.usedAbsences > 0)
            .sort((a, b) =>
                b.usedAbsences - a.usedAbsences ||
                b.consecutiveAbsences - a.consecutiveAbsences ||
                `${a.first_name || ''} ${a.last_name || ''}`.localeCompare(`${b.first_name || ''} ${b.last_name || ''}`)
            );
        const branchAbsencePreview = branchAbsenceRows.slice(0, 3);
        const branchRedListHtml = branchAbsencePreview.length
            ? branchAbsencePreview.map(item => {
                const studentName = `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Student';
                const teacherName = `${item.teacher_first_name || ''} ${item.teacher_last_name || ''}`.trim() || 'No teacher assigned';
                const allowanceText = item.allowedAbsences > 0
                    ? `${item.usedAbsences}/${item.allowedAbsences}`
                    : `${item.usedAbsences}`;
                return `
                    <div class="flex items-center justify-between gap-3 rounded-2xl border border-red-100 bg-white px-3 py-3">
                        <div class="min-w-0">
                            <div class="truncate text-sm font-semibold text-slate-900">${escapeHtml(studentName)}</div>
                            <div class="truncate text-xs text-red-700">${escapeHtml(teacherName)}</div>
                        </div>
                        <div class="shrink-0 text-right">
                            <div class="text-sm font-black text-red-900">${allowanceText}</div>
                            <div class="text-[11px] uppercase tracking-[0.16em] text-red-500 font-bold">Absences</div>
                        </div>
                    </div>
                `;
            }).join('')
            : '<div class="rounded-2xl border border-dashed border-red-200 bg-white px-3 py-4 text-sm text-red-700">No students on this branch red list.</div>';

        return `
            <div class="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <div class="text-lg font-bold text-slate-900">${escapeHtml(branch.branch_name || 'Branch')}</div>
                        <div class="text-xs text-slate-500 mt-1">${escapeHtml(branch.address || 'Active branch')}</div>
                    </div>
                    <div class="h-11 w-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <i class="fas fa-landmark"></i>
                    </div>
                </div>
                <div class="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <div class="flex items-center justify-between gap-3">
                        <div class="text-[11px] uppercase tracking-[0.22em] text-slate-500 font-bold">Most Enrolled Instrument</div>
                        <span class="px-2.5 py-1 rounded-full border text-[11px] font-bold bg-indigo-50 text-indigo-700 border-indigo-200">
                            ${topInstrumentCount} enrolled
                        </span>
                    </div>
                    <div class="mt-3 text-sm font-semibold text-slate-900">${escapeHtml(topInstrumentName)}</div>
                    <div class="mt-1 text-sm text-slate-600">${topInstrumentCount > 0 ? `Top active instrument in this branch right now.` : 'No active enrollments recorded for this branch yet.'}</div>
                    <div class="mt-2 text-xs text-slate-400">${escapeHtml(latestActivityTimestamp ? `Latest branch activity: ${formatDateTime(latestActivityTimestamp)}` : 'No branch activity timestamp yet')}</div>
                </div>
                <div class="mt-4 grid grid-cols-2 xl:grid-cols-4 gap-3">
                    <div class="rounded-2xl bg-amber-50 border border-amber-100 px-3 py-3">
                        <div class="text-[11px] uppercase tracking-[0.18em] text-amber-700 font-bold">Pending</div>
                        <div class="mt-2 text-2xl font-black text-amber-900">${pendingCount}</div>
                    </div>
                    <div class="rounded-2xl bg-green-50 border border-green-100 px-3 py-3">
                        <div class="text-[11px] uppercase tracking-[0.18em] text-green-700 font-bold">Fee Paid</div>
                        <div class="mt-2 text-2xl font-black text-green-900">${feePaidCount}</div>
                    </div>
                    <div class="rounded-2xl bg-blue-50 border border-blue-100 px-3 py-3">
                        <div class="text-[11px] uppercase tracking-[0.18em] text-blue-700 font-bold">Students</div>
                        <div class="mt-2 text-2xl font-black text-blue-900">${activeStudents}</div>
                    </div>
                    <div class="rounded-2xl bg-slate-100 border border-slate-200 px-3 py-3">
                        <div class="text-[11px] uppercase tracking-[0.18em] text-slate-600 font-bold">Teachers</div>
                        <div class="mt-2 text-2xl font-black text-slate-900">${activeTeachers}</div>
                    </div>
                </div>
                <div class="mt-4 flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white">
                    <div>
                        <div class="text-[11px] uppercase tracking-[0.2em] text-slate-400 font-bold">Outstanding Balance</div>
                        <div class="mt-1 text-lg font-bold">${formatPeso(outstandingBalance)}</div>
                    </div>
                    <a href="admin_students.html?branch_id=${encodeURIComponent(String(branchId))}" class="text-xs font-bold text-gold-400 hover:text-gold-300">Open Branch</a>
                </div>
               
            </div>
        `;
    });

    board.innerHTML = cards.join('');
}

function renderAbsenceRedList(enrollments) {
    const list = document.getElementById('absenceRedList');
    if (!list) return;

    const absenceRows = (Array.isArray(enrollments) ? enrollments : [])
        .map(item => ({
            ...item,
            usedAbsences: Number(item.used_absences || 0),
            consecutiveAbsences: Number(item.consecutive_absences || 0),
            allowedAbsences: Number(item.allowed_absences || 0)
        }))
        .filter(item => item.usedAbsences > 0)
        .sort((a, b) =>
            b.usedAbsences - a.usedAbsences ||
            b.consecutiveAbsences - a.consecutiveAbsences
        );

    window.absenceStudents = absenceRows;

    if (!absenceRows.length) {
        list.innerHTML = `
            <div class="xl:col-span-2 rounded-2xl border border-dashed border-red-200 bg-red-50/40 px-4 py-8 text-center text-sm text-red-700">
                No active students with recorded absences.
            </div>
        `;
        return;
    }

    list.innerHTML = absenceRows.map((item, index) => {

        const studentName =
            `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Student';

        return `
            <button
                onclick="openAbsenceModal(${index})"
                class="w-full text-left flex items-center justify-between rounded-2xl border border-red-200 bg-white hover:bg-red-50 hover:border-red-400 transition-all duration-200 px-5 py-4">

                <div>
                    <div class="font-semibold text-slate-900">
                        ${escapeHtml(studentName)}
                    </div>

                    <div class="text-xs text-slate-500 mt-1">
                        ${escapeHtml(item.branch_name || 'No Branch')}
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    <span class="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                        ${item.usedAbsences} Absence${item.usedAbsences > 1 ? 's' : ''}
                    </span>

                    <i class="fas fa-chevron-right text-red-400"></i>
                </div>

            </button>
        `;
    }).join('');
}
function openAbsenceModal(index) {

    const s = window.absenceStudents[index];

    const studentName =
        `${s.first_name || ''} ${s.last_name || ''}`.trim();

    const teacherName =
        `${s.teacher_first_name || ''} ${s.teacher_last_name || ''}`.trim()
        || 'No teacher assigned';

    document.getElementById('absenceModal').classList.remove('hidden');
    document.getElementById('absenceModal').classList.add('flex');

    document.getElementById('absenceModalContent').innerHTML = `
        <div class="space-y-5">

            <div>
                <h2 class="text-2xl font-bold text-slate-900">
                    ${escapeHtml(studentName)}
                </h2>

                <p class="text-sm text-slate-500">
                    ${escapeHtml(s.branch_name || 'No Branch')}
                </p>
            </div>

            <div class="grid grid-cols-2 gap-4">

                <div class="rounded-2xl bg-red-50 p-4">
                    <div class="text-xs text-red-600 font-semibold">
                        TOTAL ABSENCES
                    </div>

                    <div class="text-3xl font-black text-red-900 mt-1">
                        ${s.usedAbsences}
                    </div>
                </div>

                <div class="rounded-2xl bg-orange-50 p-4">
                    <div class="text-xs text-orange-600 font-semibold">
                        CONSECUTIVE
                    </div>

                    <div class="text-3xl font-black text-orange-900 mt-1">
                        ${s.consecutiveAbsences}
                    </div>
                </div>

            </div>

            <div class="rounded-2xl border border-slate-200 p-4">

                <div class="grid gap-3">

                    <div>
                        <div class="text-xs text-slate-500">
                            Instrument
                        </div>

                        <div class="font-semibold">
                            ${escapeHtml(s.instrument_name || '-')}
                        </div>
                    </div>

                    <div>
                        <div class="text-xs text-slate-500">
                            Teacher
                        </div>

                        <div class="font-semibold">
                            ${escapeHtml(teacherName)}
                        </div>
                    </div>

                    <div>
                        <div class="text-xs text-slate-500">
                            Allowed Absences
                        </div>

                        <div class="font-semibold">
                            ${s.allowedAbsences}
                        </div>
                    </div>

                </div>

            </div>

            ${
                s.usedAbsences >= s.allowedAbsences && s.allowedAbsences > 0
                ? `
                    <div class="rounded-2xl border border-red-200 bg-red-50 p-4">
                        <div class="font-bold text-red-800">
                            Schedule Freeze Recommended
                        </div>

                        <div class="text-sm text-red-700 mt-1">
                            This student has exceeded the allowed absence limit.
                        </div>
                    </div>
                `
                : ''
            }

        </div>
    `;
}

function closeAbsenceModal() {
    document.getElementById('absenceModal').classList.add('hidden');
    document.getElementById('absenceModal').classList.remove('flex');
}

async function loadDashboardData() {
    try {
        const [branchesResult, registrationsResult, revenueResult, enrollmentsResult, teachersResult] = await Promise.allSettled([
            axios.get(`${baseApiUrl}/branch.php?action=get-branches-all`),
            axios.get(`${baseApiUrl}/admin.php?action=get-all-registrations`),
            axios.get(`${baseApiUrl}/admin.php?action=get-revenue-summary`),
            axios.get(`${baseApiUrl}/students.php?action=get-active-enrollments`),
            axios.get(`${baseApiUrl}/teachers.php?action=get-teachers&status=Active`)
        ]);

        const branchesData = branchesResult.status === 'fulfilled' ? branchesResult.value.data : null;
        const registrationsData = registrationsResult.status === 'fulfilled' ? registrationsResult.value.data : null;
        const revenueData = revenueResult.status === 'fulfilled' ? revenueResult.value.data : null;
        const enrollmentsData = enrollmentsResult.status === 'fulfilled' ? enrollmentsResult.value.data : null;
        const teachersData = teachersResult.status === 'fulfilled' ? teachersResult.value.data : null;

        const branches = branchesData?.success && Array.isArray(branchesData.branches) ? branchesData.branches : [];
        const registrations = registrationsData?.success && Array.isArray(registrationsData.registrations) ? registrationsData.registrations : [];
        const enrollments = enrollmentsData?.success && Array.isArray(enrollmentsData.enrollments) ? enrollmentsData.enrollments : [];
        const teachers = teachersData?.success && Array.isArray(teachersData.teachers) ? teachersData.teachers : [];

        renderExecutiveStats(branches, registrations, revenueData, enrollments);
        displayRecentActivity(registrations);
        renderBranches(branches);
        renderBranchMovements(branches, registrations, enrollments, teachers);
        renderAbsenceRedList(enrollments);
    } catch (error) {
        console.error('Failed to load dashboard stats:', error);
        const board = document.getElementById('branchMovementBoard');
        if (board) {
            board.innerHTML = '<div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-600">Failed to load branch movement.</div>';
        }
        const absenceList = document.getElementById('absenceRedList');
        if (absenceList) {
            absenceList.innerHTML = '<div class="xl:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-600">Failed to load absence list.</div>';
        }
        showMessage('Failed to load dashboard statistics', 'error');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    if (typeof checkAuth === 'function') {
        checkAuth();
    }

    if (typeof Auth !== 'undefined' && Auth.getUser) {
        const user = Auth.getUser();
        if (user) {
            const userNameNav = document.getElementById('userNameNav');
            const profileMenuName = document.getElementById('profileMenuName');
            const userRoleNav = document.getElementById('userRoleNav');
            const displayName = user.username || user.email || 'Admin';
            if (userNameNav) userNameNav.textContent = displayName;
            if (profileMenuName) profileMenuName.textContent = displayName;
            if (userRoleNav) userRoleNav.textContent = user.role_name || 'Admin';
        }
    }

    loadDashboardData();
});
