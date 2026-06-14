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

function getInstrumentIcon(name) {
    const key = String(name || '').toLowerCase();
    if (key.includes('piano') || key.includes('keyboard')) return 'fa-keyboard';
    if (key.includes('guitar') || key.includes('ukulele') || key.includes('bass')) return 'fa-guitar';
    if (key.includes('violin') || key.includes('cello') || key.includes('viola')) return 'fa-music';
    if (key.includes('drum') || key.includes('percussion')) return 'fa-drum';
    if (key.includes('voice') || key.includes('vocal') || key.includes('singing')) return 'fa-microphone';
    return 'fa-music';
}

function countEnrollmentsByField(rows, field, fallback = 'Unassigned') {
    return rows.reduce((acc, item) => {
        const key = String(item[field] || '').trim() || fallback;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
}

function buildRankedInstrumentList(counts, limit = 8) {
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, limit);
}

function renderInstrumentRankColumn(title, subtitle, ranked, emptyMessage) {
    if (!ranked.length) {
        return `
            <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center text-sm text-slate-500 h-full">
                <i class="fas fa-music text-3xl text-slate-300 mb-3"></i>
                <p class="font-semibold text-slate-700">${escapeHtml(title)}</p>
                <p class="mt-1">${escapeHtml(emptyMessage)}</p>
            </div>
        `;
    }

    const topCount = Number(ranked[0][1] || 1);
    const barColors = [
        'from-gold-400 to-gold-600',
        'from-indigo-400 to-indigo-600',
        'from-sky-400 to-sky-600',
        'from-emerald-400 to-emerald-600',
        'from-violet-400 to-violet-600',
        'from-rose-400 to-rose-600',
        'from-amber-400 to-amber-600',
        'from-slate-400 to-slate-600'
    ];

    return `
        <div class="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 h-full">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <h4 class="text-sm font-bold text-slate-900">${escapeHtml(title)}</h4>
                    <p class="text-xs text-slate-500 mt-1">${escapeHtml(subtitle)}</p>
                </div>
                <span class="rounded-full bg-gold-500/10 px-2.5 py-1 text-[11px] font-bold text-gold-700">${ranked.length} shown</span>
            </div>
            <div class="mt-5 space-y-4">
                ${ranked.map(([name, count], index) => {
                    const width = Math.max(8, Math.round((Number(count) / topCount) * 100));
                    const barColor = barColors[index % barColors.length];
                    return `
                        <div>
                            <div class="flex items-center justify-between gap-3 mb-2">
                                <div class="flex items-center gap-3 min-w-0">
                                    <span class="text-xs font-bold text-slate-400 w-5">${index + 1}</span>
                                    <i class="fas ${getInstrumentIcon(name)} text-gold-500"></i>
                                    <span class="text-sm font-semibold text-slate-800 truncate">${escapeHtml(name)}</span>
                                </div>
                                <span class="text-sm font-bold text-slate-700 shrink-0">${Number(count).toLocaleString('en-PH')}</span>
                            </div>
                            <div class="h-2 rounded-full bg-slate-100 overflow-hidden">
                                <div class="h-full rounded-full bg-gradient-to-r ${barColor}" style="width: ${width}%"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function renderPopularInstruments(enrollments) {
    const widget = document.getElementById('popularInstrumentsWidget');
    if (!widget) return;

    const rows = Array.isArray(enrollments) ? enrollments : [];
    const categoryRanked = buildRankedInstrumentList(countEnrollmentsByField(rows, 'type_name', 'Other'));
    const brandRanked = buildRankedInstrumentList(countEnrollmentsByField(rows, 'instrument_name', 'Unassigned Instrument'));

    if (!categoryRanked.length && !brandRanked.length) {
        widget.innerHTML = `
            <div class="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                <i class="fas fa-music text-3xl text-slate-300 mb-3"></i>
                <p>No active enrollments yet.</p>
            </div>
        `;
        return;
    }

    widget.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            ${renderInstrumentRankColumn(
                'Instrument Categories',
                'Grouped by instrument type across all branches.',
                categoryRanked,
                'No category data available yet.'
            )}
            ${renderInstrumentRankColumn(
                'Specific Brands',
                'Individual instrument models and brands in use.',
                brandRanked,
                'No brand data available yet.'
            )}
        </div>
    `;
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
        renderPopularInstruments(enrollments);
    } catch (error) {
        console.error('Failed to load dashboard stats:', error);
        const board = document.getElementById('branchMovementBoard');
        if (board) {
            board.innerHTML = '<div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-600">Failed to load branch movement.</div>';
        }
        const popularInstruments = document.getElementById('popularInstrumentsWidget');
        if (popularInstruments) {
            popularInstruments.innerHTML = '<div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-600">Failed to load popular instruments.</div>';
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
