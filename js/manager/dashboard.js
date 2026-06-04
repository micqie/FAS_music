        const dashboardState = {
            branchId: 0,
            branchName: '—',
            registrations: [],
            enrollments: [],
        };

        function showToast(message, icon = 'info') {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon,
                title: message,
                showConfirmButton: false,
                timer: 2400,
                timerProgressBar: true
            });
        }

        function setText(id, value) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text == null ? '' : String(text);
            return div.innerHTML;
        }

        function formatPeso(value) {
            const num = Number(value || 0);
            return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        function startOfToday() {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            return d;
        }

        function endOfDay(date) {
            const d = new Date(date);
            d.setHours(23, 59, 59, 999);
            return d;
        }

        function parseDate(value) {
            if (!value) return null;
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? null : date;
        }

        function formatDateShort(value) {
            const date = parseDate(value);
            return date ? date.toLocaleDateString() : '—';
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
            const dateText = formatDateShort(nextSession.session_date);
            const timeText = nextSession.start_time ? `${formatTime12Hour(nextSession.start_time)} - ${formatTime12Hour(nextSession.end_time)}` : '';
            return timeText ? `${dateText} • ${timeText}` : dateText;
        }

        function isToday(dateValue) {
            const date = parseDate(dateValue);
            if (!date) return false;
            const today = startOfToday();
            return date >= today && date <= endOfDay(today);
        }

        function isThisWeek(dateValue) {
            const date = parseDate(dateValue);
            if (!date) return false;
            const today = startOfToday();
            const dayIndex = today.getDay();
            const mondayOffset = dayIndex === 0 ? -6 : 1 - dayIndex;
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() + mondayOffset);
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            return date >= weekStart && date <= weekEnd;
        }

        function isFutureScheduled(session) {
            const status = String(session?.status || '').toLowerCase();
            if (status !== 'scheduled') return false;
            const date = parseDate(session?.session_date);
            if (!date) return false;
            return date >= startOfToday();
        }

        function buildRecentActivityRows() {
            const registrationRows = dashboardState.registrations.map(reg => ({
                kind: 'Registration',
                title: `${reg.first_name || ''} ${reg.last_name || ''}`.trim() || 'Student',
                meta: `${reg.registration_status || 'Pending'} registration`,
                when: reg.created_at || '',
                color: 'amber'
            }));

            const enrollmentRows = dashboardState.enrollments.map(enrollment => ({
                kind: 'Enrollment',
                title: `${enrollment.first_name || ''} ${enrollment.last_name || ''}`.trim() || 'Student',
                meta: `${enrollment.package_name || 'Package'} • ${enrollment.status || 'Active'}`,
                when: enrollment.created_at || '',
                color: 'emerald'
            }));

            return registrationRows
                .concat(enrollmentRows)
                .filter(item => item.when)
                .sort((a, b) => new Date(b.when) - new Date(a.when))
                .slice(0, 7);
        }

        function collectAllSessions() {
            return dashboardState.enrollments.flatMap(enrollment => Array.isArray(enrollment.sessions_list) ? enrollment.sessions_list : []);
        }

        function computeSummary() {
            const registrations = dashboardState.registrations;
            const enrollments = dashboardState.enrollments;

            const activeStudents = new Set(enrollments.map(item => Number(item.student_id || 0)).filter(Boolean)).size;
            const registrationRevenue = registrations.reduce((sum, item) => sum + Number(item.registration_fee_paid || 0), 0);
            const enrollmentRevenue = enrollments.reduce((sum, item) => sum + Number(item.paid_amount || 0), 0);
            const enrollmentOutstanding = enrollments.reduce((sum, item) => {
                const total = Number(item.total_amount || 0);
                const paid = Number(item.paid_amount || 0);
                return sum + Math.max(0, total - paid);
            }, 0);

            return {
                activeStudents,
                registrationRevenue,
                enrollmentRevenue,
                enrollmentOutstanding,
                activeEnrollments: enrollments.length
            };
        }

        function renderMakeupSummary(summary) {
            setText('makeupQueueCount', String(summary.cancelledSessions.length));

            const earliestSession = [...summary.cancelledSessions]
                .sort((a, b) => {
                    const aTime = parseDate(`${a.session_date || ''}T${a.start_time || '00:00:00'}`)?.getTime() || 0;
                    const bTime = parseDate(`${b.session_date || ''}T${b.start_time || '00:00:00'}`)?.getTime() || 0;
                    return aTime - bTime;
                })[0] || null;

            const packageCounts = summary.cancelledSessions.reduce((acc, session) => {
                const key = String(session.package_name || '').trim() || 'Unassigned Package';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});
            const topPackageEntry = Object.entries(packageCounts)
                .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || null;

            setText(
                'makeupQueueMeta',
                summary.cancelledSessions.length
                    ? `${summary.cancelledSessions.length} class${summary.cancelledSessions.length === 1 ? '' : 'es'} still need makeup scheduling.`
                    : 'No teacher-cancelled sessions are waiting for makeup.'
            );
            setText('makeupEarliestDate', earliestSession ? formatDateShort(earliestSession.session_date) : '—');
            setText('makeupTopPackage', topPackageEntry ? topPackageEntry[0] : '—');
            setText(
                'makeupTopPackageMeta',
                topPackageEntry
                    ? `${topPackageEntry[1]} pending makeup ${topPackageEntry[1] === 1 ? 'class' : 'classes'} in this package.`
                    : 'No package is currently waiting for makeup.'
            );

            const listEl = document.getElementById('makeupSummaryList');
            if (!listEl) return;

            if (!summary.cancelledSessions.length) {
                listEl.innerHTML = '<div class="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-5 text-sm text-slate-500">No makeup sessions are waiting right now.</div>';
                return;
            }

            const visibleSessions = [...summary.cancelledSessions]
                .sort((a, b) => {
                    const aTime = parseDate(`${a.session_date || ''}T${a.start_time || '00:00:00'}`)?.getTime() || 0;
                    const bTime = parseDate(`${b.session_date || ''}T${b.start_time || '00:00:00'}`)?.getTime() || 0;
                    return aTime - bTime;
                })
                .slice(0, 6);

            listEl.innerHTML = visibleSessions.map(session => {
                const studentName = `${session.student_first_name || ''} ${session.student_last_name || ''}`.trim() || 'Student';
                const teacherName = `${session.teacher_first_name || ''} ${session.teacher_last_name || ''}`.trim() || 'Teacher';
                return `
                    <div class="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <div class="text-sm font-bold text-slate-900">${escapeHtml(studentName)}</div>
                                <div class="mt-1 text-xs text-slate-500">${escapeHtml(session.package_name || 'Package')} • ${escapeHtml(teacherName)}</div>
                            </div>
                            <div class="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 border border-amber-200">Needs Makeup</div>
                        </div>
                        <div class="mt-3 text-sm text-slate-700">
                            ${escapeHtml(formatDateShort(session.session_date))} • ${escapeHtml(formatTime12Hour(session.start_time))} - ${escapeHtml(formatTime12Hour(session.end_time))}
                        </div>
                        <div class="mt-2 text-xs text-slate-500">${escapeHtml(session.cancellation_reason || 'Teacher-cancelled session waiting for manager reschedule.')}</div>
                    </div>
                `;
            }).join('');
        }

        function renderBranchRedList(summary) {
            const table = document.getElementById('managerRedListTable');
            const countEl = document.getElementById('managerRedListCount');
            if (!table || !countEl) return;

            const rows = summary.riskStudents
                .filter(item => Number(item.used_absences || 0) > 0)
                .sort((a, b) =>
                    Number(b.used_absences || 0) - Number(a.used_absences || 0) ||
                    Number(b.consecutive_absences || 0) - Number(a.consecutive_absences || 0) ||
                    `${a.first_name || ''} ${a.last_name || ''}`.localeCompare(`${b.first_name || ''} ${b.last_name || ''}`)
                );

            countEl.textContent = rows.length
                ? `${rows.length} student${rows.length === 1 ? '' : 's'} currently need make-up follow-up`
                : 'No students currently on the red list';

            if (!rows.length) {
                table.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-5 py-8 text-center text-slate-500">
                            <i class="fas fa-shield-heart text-2xl mb-2 text-emerald-500/70"></i>
                            <p>No students are currently on this branch red list.</p>
                        </td>
                    </tr>
                `;
                return;
            }

            table.innerHTML = rows.map(student => {
                const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
                const allowed = Number(student.allowed_absences || 0);
                const used = Number(student.used_absences || 0);
                const consecutive = Number(student.consecutive_absences || 0);
                return `
                    <tr class="hover:bg-rose-50/50 transition">
                        <td class="px-5 py-4">
                            <div class="font-medium text-slate-900">${escapeHtml(studentName)}</div>
                            <div class="text-sm text-slate-500">${escapeHtml(student.email || '')}</div>
                        </td>
                        <td class="px-5 py-4 text-slate-700">${escapeHtml(student.package_name || '—')}</td>
                        <td class="px-5 py-4 font-semibold text-rose-600">${used}</td>
                        <td class="px-5 py-4 text-slate-700">${allowed > 0 ? `${used}/${allowed}` : `${used}`}</td>
                        <td class="px-5 py-4 text-slate-700">${consecutive > 0 ? `${consecutive} consecutive` : '—'}</td>
                        <td class="px-5 py-4 text-sm text-slate-600">${escapeHtml(formatNextSessionLabel(student))}</td>
                    </tr>
                `;
            }).join('');
        }

        function renderDashboard() {
            const summary = computeSummary();
            const activeEnrollments = summary.activeEnrollments;

            setText('heroSummary', `${summary.activeStudents} active enrollee${summary.activeStudents === 1 ? '' : 's'}, ${formatPeso(summary.enrollmentOutstanding)} outstanding balance, and ${formatPeso(summary.registrationRevenue + summary.enrollmentRevenue)} total branch revenue.`);
            setText('branchTotalRevenue', formatPeso(summary.registrationRevenue + summary.enrollmentRevenue));
            setText('statActiveStudents', String(summary.activeStudents));
            setText('statActiveStudentsMeta', `${activeEnrollments} active enrollment${activeEnrollments === 1 ? '' : 's'} across ${summary.activeStudents} student${summary.activeStudents === 1 ? '' : 's'}`);
            setText('reportOutstandingBalance', formatPeso(summary.enrollmentOutstanding));

            const briefLines = [
                `${dashboardState.branchName} branch currently has ${summary.activeStudents} active enrollee${summary.activeStudents === 1 ? '' : 's'}.`,
                `Outstanding active-enrollment balance is ${formatPeso(summary.enrollmentOutstanding)}.`,
                `Total branch revenue collected is ${formatPeso(summary.registrationRevenue + summary.enrollmentRevenue)}.`
            ];
            setText('managerReportText', briefLines.join('\n'));
        }

        async function loadDashboardData() {
            const branchId = Number(dashboardState.branchId || 0);
            const branchQuery = branchId > 0 ? `&branch_id=${encodeURIComponent(branchId)}` : '';

            const [allRegistrationsRes, activeEnrollmentsRes] = await Promise.allSettled([
                axios.get(`${baseApiUrl}/admin.php?action=get-all-registrations${branchQuery}`),
                axios.get(`${baseApiUrl}/students.php?action=get-active-enrollments${branchQuery}`),
            ]);

            dashboardState.registrations = allRegistrationsRes.status === 'fulfilled' && allRegistrationsRes.value.data?.success
                ? (allRegistrationsRes.value.data.registrations || [])
                : [];
            dashboardState.enrollments = activeEnrollmentsRes.status === 'fulfilled' && activeEnrollmentsRes.value.data?.success
                ? (activeEnrollmentsRes.value.data.enrollments || [])
                : [];
        }

        async function initManagerDashboard() {
            if (typeof checkBranchScopedAuth === 'function' && !checkBranchScopedAuth()) {
                return;
            }
            if (typeof Auth === 'undefined' || !Auth.getUser) {
                showToast('Unable to load manager account context.', 'error');
                return;
            }

            const user = Auth.getUser();
            const role = String(user?.role_name || '').toLowerCase();
            if (!['manager', 'branch manager'].includes(role)) {
                window.location.href = '../../index.html';
                return;
            }

            const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || user.email || 'Manager';
            dashboardState.branchId = Number(user.branch_id || 0);
            dashboardState.branchName = user.branch_name || '—';

            setText('managerNameNav', displayName);
            setText('profileMenuName', displayName);
            setText('managerBranchName', dashboardState.branchName);
            setText('heroBranchLabel', `${dashboardState.branchName} Branch`);
            if (window.syncManagerShell) {
                window.syncManagerShell(displayName, dashboardState.branchName, user.email);
            }

            try {
                await loadDashboardData();
                renderDashboard();
            } catch (error) {
                console.error('Failed to load manager dashboard:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Dashboard Error',
                    text: 'Unable to load branch dashboard data right now.'
                });
            }
        }

        document.getElementById('copyReportBtn')?.addEventListener('click', async () => {
            const reportText = document.getElementById('managerReportText')?.textContent || '';
            if (!reportText.trim()) {
                showToast('No report text is ready yet.', 'warning');
                return;
            }
            try {
                await navigator.clipboard.writeText(reportText);
                showToast('Manager report copied.', 'success');
            } catch (error) {
                showToast('Unable to copy the report.', 'error');
            }
        });

        document.addEventListener('DOMContentLoaded', initManagerDashboard);
