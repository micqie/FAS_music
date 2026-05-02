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

function updateRevenueStat(revenueData, registrations) {
    const revenueEl = document.getElementById('statFeePaid');
    if (!revenueEl) return;

    if (revenueData && revenueData.success) {
        revenueEl.textContent = formatPeso(revenueData.total_revenue);
        return;
    }

    const fallbackRevenue = Array.isArray(registrations)
        ? registrations.reduce((sum, reg) => sum + (parseFloat(reg.registration_fee_paid) || 0), 0)
        : 0;
    revenueEl.textContent = formatPeso(fallbackRevenue);
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
                <div class="mt-4 rounded-2xl border border-red-200 bg-red-50/70 p-4">
                    <div class="mb-3 flex items-center justify-between gap-3">
                        <div>
                            <div class="text-[11px] uppercase tracking-[0.2em] text-red-700 font-bold">Branch Red List</div>
                            <div class="mt-1 text-sm font-semibold text-red-950">${branchAbsenceRows.length} student${branchAbsenceRows.length === 1 ? '' : 's'} with absences</div>
                        </div>
                        <div class="h-10 w-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
                            <i class="fas fa-triangle-exclamation"></i>
                        </div>
                    </div>
                    <div class="space-y-3">
                        ${branchRedListHtml}
                    </div>
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
        .map(item => {
            const usedAbsences = Number(item.used_absences || 0);
            const consecutiveAbsences = Number(item.consecutive_absences || 0);
            const allowedAbsences = Number(item.allowed_absences || 0);
            return {
                ...item,
                usedAbsences,
                consecutiveAbsences,
                allowedAbsences
            };
        })
        .filter(item => item.usedAbsences > 0)
        .sort((a, b) =>
            b.usedAbsences - a.usedAbsences ||
            b.consecutiveAbsences - a.consecutiveAbsences ||
            `${a.first_name || ''} ${a.last_name || ''}`.localeCompare(`${b.first_name || ''} ${b.last_name || ''}`)
        );

    if (!absenceRows.length) {
        list.innerHTML = `
            <div class="xl:col-span-2 rounded-2xl border border-dashed border-red-200 bg-red-50/40 px-4 py-8 text-center text-sm text-red-700">
                No active students with recorded absences.
            </div>
        `;
        return;
    }

    list.innerHTML = absenceRows.map(item => {
        const studentName = `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Student';
        const branchName = item.branch_name || 'No branch';
        const instrumentName = item.instrument_name || 'No instrument';
        const teacherName = `${item.teacher_first_name || ''} ${item.teacher_last_name || ''}`.trim() || 'No teacher assigned';
        const sessionsText = item.allowedAbsences > 0
            ? `${item.usedAbsences}/${item.allowedAbsences} absences used`
            : `${item.usedAbsences} absence${item.usedAbsences === 1 ? '' : 's'} recorded`;
        const consecutiveText = item.consecutiveAbsences > 0
            ? `${item.consecutiveAbsences} consecutive`
            : 'No consecutive streak';

        return `
            <div class="rounded-3xl border border-red-200 bg-gradient-to-br from-red-50 to-white p-5 shadow-sm">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <div class="text-lg font-bold text-red-950">${escapeHtml(studentName)}</div>
                        <div class="mt-1 text-xs text-red-700">${escapeHtml(branchName)} • ${escapeHtml(instrumentName)}</div>
                    </div>
                    <div class="rounded-2xl bg-red-100 px-3 py-2 text-right">
                        <div class="text-[11px] uppercase tracking-[0.18em] text-red-700 font-bold">Absences</div>
                        <div class="text-2xl font-black text-red-900">${item.usedAbsences}</div>
                    </div>
                </div>
                <div class="mt-4 grid grid-cols-2 gap-3">
                    <div class="rounded-2xl border border-red-100 bg-white px-3 py-3">
                        <div class="text-[11px] uppercase tracking-[0.18em] text-red-600 font-bold">Allowance</div>
                        <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(sessionsText)}</div>
                    </div>
                    <div class="rounded-2xl border border-red-100 bg-white px-3 py-3">
                        <div class="text-[11px] uppercase tracking-[0.18em] text-red-600 font-bold">Consecutive</div>
                        <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(consecutiveText)}</div>
                    </div>
                </div>
                <div class="mt-4 flex items-center justify-between rounded-2xl bg-red-900 px-4 py-3 text-white">
                    <div class="min-w-0 pr-3">
                        <div class="text-[11px] uppercase tracking-[0.2em] text-red-200 font-bold">Teacher</div>
                        <div class="mt-1 truncate text-sm font-semibold">${escapeHtml(teacherName)}</div>
                    </div>
                    <a href="admin_students.html" class="text-xs font-bold text-red-100 hover:text-white">Open Students</a>
                </div>
            </div>
        `;
    }).join('');
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

        updateStats(registrations);
        updateRevenueStat(revenueData, registrations);
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
