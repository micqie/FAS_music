  let deskBranchId = 0;
        let attendanceRows = [];
        let attendanceByStudentId = {};

        function showMessage(message, type = 'error') {
            Swal.fire({
                icon: type === 'success' ? 'success' : 'error',
                title: type === 'success' ? 'Success' : 'Error',
                text: message,
                confirmButtonColor: '#b8860b'
            });
        }

        function escapeHtml(text) {
            if (text == null) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
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

        function formatDateShort(dateString) {
            if (!dateString) return '—';
            const date = new Date(dateString);
            if (Number.isNaN(date.getTime())) return String(dateString);
            return date.toLocaleDateString();
        }

        function normalizeDateKey(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            if (Number.isNaN(date.getTime())) return String(dateString).slice(0, 10);
            return date.toISOString().slice(0, 10);
        }

        function getAttendanceContext(student) {
            const studentId = Number(student?.student_id || 0);
            return attendanceByStudentId[studentId] || { rows: [], attendedKeys: new Set(), excusedKeys: new Set() };
        }

        function getCompletedCount(student) {
            const sessionsList = Array.isArray(student.sessions_list) ? student.sessions_list : [];
            const attendanceContext = getAttendanceContext(student);

            return sessionsList.filter(slot => {
                const status = String(slot.status || '').toLowerCase();
                if (['completed', 'late', 'present'].includes(status)) return true;
                const sessionKey = normalizeDateKey(slot.session_date);
                return sessionKey && attendanceContext.attendedKeys.has(sessionKey);
            }).length;
        }

        function getAbsenceCount(student) {
            const sessionsList = Array.isArray(student.sessions_list) ? student.sessions_list : [];
            const attendanceContext = getAttendanceContext(student);
            const now = new Date();

            return sessionsList.filter(slot => {
                if (!slot || !slot.session_date) return false;

                const status = String(slot.status || '').toLowerCase();
                if (['completed', 'present', 'late', 'cancelled_by_teacher', 'rescheduled'].includes(status)) return false;

                const sessionDateTime = new Date(`${slot.session_date}T${slot.end_time || slot.start_time || '23:59:59'}`);
                if (Number.isNaN(sessionDateTime.getTime()) || sessionDateTime > now) return false;

                const sessionKey = normalizeDateKey(slot.session_date);
                if (sessionKey && attendanceContext.attendedKeys.has(sessionKey)) return false;
                if (sessionKey && attendanceContext.excusedKeys.has(sessionKey)) return false;

                return ['absent', 'no show', 'scheduled', 'cancelled'].includes(status) || !status;
            }).length;
        }

        function getMakeupThreshold(student) {
            const totalSessions = Number(student?.sessions || 0);
            return totalSessions >= 20 ? 3 : 2;
        }

        function isMakeupRequired(student) {
            return getAbsenceCount(student) >= getMakeupThreshold(student);
        }

        function getRemainingCount(student) {
            const totalSessions = Number(student.sessions || 0);
            const completedCount = getCompletedCount(student);
            if (totalSessions < 1) return 0;
            return Math.max(0, totalSessions - completedCount);
        }

        function getUpcomingScheduledSessions(student) {
            const sessionsList = Array.isArray(student.sessions_list) ? student.sessions_list : [];
            const now = new Date();
            return sessionsList
                .filter(slot => {
                    if (!slot || !slot.session_date) return false;
                    const status = String(slot.status || '').toLowerCase();
                    if (['completed', 'present', 'late', 'cancelled_by_teacher', 'cancelled', 'absent', 'no show'].includes(status)) {
                        return false;
                    }
                    const sessionDateTime = new Date(`${slot.session_date}T${slot.start_time || '00:00:00'}`);
                    if (Number.isNaN(sessionDateTime.getTime())) return false;
                    return sessionDateTime >= now;
                })
                .sort((a, b) => new Date(`${a.session_date}T${a.start_time || '00:00:00'}`) - new Date(`${b.session_date}T${b.start_time || '00:00:00'}`));
        }

        function getNextSessionLabel(student) {
            const nextSession = getUpcomingScheduledSessions(student)[0];
            if (!nextSession) return 'No upcoming sessions';
            const dateText = formatDateShort(nextSession.session_date);
            const timeText = nextSession.start_time ? `${formatTime12Hour(nextSession.start_time)} - ${formatTime12Hour(nextSession.end_time)}` : '';
            return timeText ? `${dateText} • ${timeText}` : dateText;
        }

        function getSessionDatesPreview(student) {
            const upcoming = getUpcomingScheduledSessions(student);

            if (!upcoming.length) return 'No upcoming sessions';

            return upcoming.slice(0, 3).map(slot => {
                const dateText = formatDateShort(slot.session_date);
                const timeText = slot.start_time ? `${formatTime12Hour(slot.start_time)} - ${formatTime12Hour(slot.end_time)}` : '';
                return timeText ? `${dateText} • ${timeText}` : dateText;
            }).join('<br>');
        }

        function updateAttendanceSummary(rows) {
            const studentCountEl = document.getElementById('attendanceStudentCount');
            const makeupCountEl = document.getElementById('attendanceMakeupCount');
            const tableCountEl = document.getElementById('attendanceTableCount');
            const makeupLabelEl = document.getElementById('attendanceMakeupLabel');

            const totalStudents = rows.length;
            const totalMakeupRequired = rows.filter(isMakeupRequired).length;

            if (studentCountEl) studentCountEl.textContent = String(totalStudents);
            if (makeupCountEl) makeupCountEl.textContent = String(totalMakeupRequired);
            if (tableCountEl) tableCountEl.textContent = `${totalStudents} enrolled student${totalStudents === 1 ? '' : 's'}`;
            if (makeupLabelEl) makeupLabelEl.textContent = totalMakeupRequired
                ? `${totalMakeupRequired} student${totalMakeupRequired === 1 ? '' : 's'} currently need make-up monitoring`
                : 'No students currently on the make-up list';
        }

        function renderAttendanceTable() {
            const tbody = document.getElementById('attendanceTableBody');
            if (!tbody) return;

            if (!attendanceRows.length) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-8 text-center text-slate-500">
                            <i class="fas fa-inbox text-2xl mb-2 text-gold-500/60"></i>
                            <p>No active enrolled students found for this branch.</p>
                        </td>
                    </tr>
                `;
                updateAttendanceSummary([]);
                return;
            }

            tbody.innerHTML = attendanceRows.map(student => {
                const packageName = escapeHtml(student.package_name || '—');
                const studentName = `${escapeHtml(student.first_name || '')} ${escapeHtml(student.last_name || '')}`.trim();
                const completedCount = getCompletedCount(student);
                const totalSessions = Number(student.sessions || 0);
                const absenceCount = getAbsenceCount(student);
                const remainingCount = getRemainingCount(student);

                return `
                    <tr class="hover:bg-slate-50/80 transition">
                        <td class="px-6 py-4">
                            <div class="font-medium text-slate-900">${studentName || 'Student'}</div>
                            <div class="text-sm text-slate-500">${escapeHtml(student.email || '')}</div>
                        </td>
                        <td class="px-6 py-4 text-slate-700">${packageName}</td>
                        <td class="px-6 py-4 text-sm text-slate-600 leading-6">${getSessionDatesPreview(student)}</td>
                        <td class="px-6 py-4 text-slate-700 font-medium">${completedCount} / ${totalSessions || '—'}</td>
                        <td class="px-6 py-4 font-medium ${absenceCount > 0 ? 'text-rose-600' : 'text-slate-500'}">${absenceCount}</td>
                        <td class="px-6 py-4 font-medium ${remainingCount > 0 ? 'text-amber-600' : 'text-emerald-600'}">${remainingCount}</td>
                        <td class="px-6 py-4">
                            <button type="button" class="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-bold" onclick="openAttendanceDetails(${Number(student.enrollment_id)})">
                                View Details
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            updateAttendanceSummary(attendanceRows);
        }

        function getStatusBadge(status) {
            const normalized = String(status || '').toLowerCase();
            if (normalized === 'completed' || normalized === 'present') {
                return '<span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">Completed</span>';
            }
            if (normalized === 'late') {
                return '<span class="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">Late</span>';
            }
            if (normalized === 'scheduled') {
                return '<span class="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-bold text-sky-700">Scheduled</span>';
            }
            if (normalized === 'cancelled_by_teacher') {
                return '<span class="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700">Cancelled</span>';
            }
            return `<span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">${escapeHtml(status || 'Unscheduled')}</span>`;
        }

        function openAttendanceDetails(enrollmentId) {
            const student = attendanceRows.find(row => Number(row.enrollment_id) === Number(enrollmentId));
            if (!student) {
                showMessage('Attendance details not found.', 'error');
                return;
            }

            const sessionsList = Array.isArray(student.sessions_list) ? student.sessions_list : [];
            const totalSessions = Number(student.sessions || 0);
            const absenceCount = getAbsenceCount(student);
            const nextSessionLabel = getNextSessionLabel(student);
            const rows = [];

            for (let sessionNumber = 1; sessionNumber <= totalSessions; sessionNumber += 1) {
                const slots = sessionsList.filter(slot => Number(slot.session_number) === sessionNumber);
                const slotHtml = slots.length
                    ? slots.map(slot => {
                        const dateText = slot.session_date ? formatDateShort(slot.session_date) : 'Unscheduled';
                        const timeText = slot.start_time ? `${formatTime12Hour(slot.start_time)} - ${formatTime12Hour(slot.end_time)}` : '—';
                        const roomText = slot.room_name ? ` • ${escapeHtml(slot.room_name)}` : '';
                        return `
                            <div class="rounded-lg border border-slate-200 bg-white px-3 py-3">
                                <div class="flex flex-wrap items-center gap-2 mb-2">${getStatusBadge(slot.status)}</div>
                                <div class="text-sm text-slate-700">${escapeHtml(dateText)} • ${escapeHtml(timeText)}${roomText}</div>
                            </div>
                        `;
                    }).join('')
                    : '<div class="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-400">No date scheduled yet</div>';

                rows.push(`
                    <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div class="text-sm font-semibold text-slate-800 mb-3">Session ${sessionNumber}</div>
                        <div class="space-y-2">${slotHtml}</div>
                    </div>
                `);
            }

            Swal.fire({
                title: `${escapeHtml(student.first_name || '')} ${escapeHtml(student.last_name || '')}`.trim() || 'Attendance Details',
                width: 900,
                confirmButtonText: 'Close',
                html: `
                    <div class="text-left">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5 text-sm text-slate-700">
                            <div><span class="font-semibold text-slate-900">Package:</span> ${escapeHtml(student.package_name || '—')}</div>
                            <div><span class="font-semibold text-slate-900">Completed:</span> ${getCompletedCount(student)} / ${Number(student.sessions || 0)}</div>
                            <div><span class="font-semibold text-slate-900">Remaining:</span> ${getRemainingCount(student)}</div>
                            <div><span class="font-semibold text-slate-900">Absences:</span> <span class="${absenceCount > 0 ? 'text-rose-600 font-semibold' : ''}">${absenceCount}</span></div>
                            <div><span class="font-semibold text-slate-900">Make-Up Threshold:</span> ${getMakeupThreshold(student)}</div>
                            <div><span class="font-semibold text-slate-900">Next Session:</span> ${escapeHtml(nextSessionLabel)}</div>
                        </div>
                        <div class="space-y-3 max-h-[58vh] overflow-y-auto pr-1">${rows.join('')}</div>
                    </div>
                `
            });
        }

        async function loadAttendanceHistory(studentId) {
            const response = await axios.get(`${baseApiUrl}/attendance.php?action=get-student-attendance&student_id=${encodeURIComponent(studentId)}&limit=200`);
            const rows = response?.data?.success && Array.isArray(response.data.attendance) ? response.data.attendance : [];
            const attendedKeys = new Set();
            const excusedKeys = new Set();

            rows.forEach(row => {
                const status = String(row?.status || '').toLowerCase();
                const dateKey = normalizeDateKey(row?.session_date || row?.attended_at);
                if (!dateKey) return;
                if (status === 'present' || status === 'late') attendedKeys.add(dateKey);
                if (status === 'excused') excusedKeys.add(dateKey);
            });

            return { rows, attendedKeys, excusedKeys };
        }

        async function loadAttendanceRows() {
            const tbody = document.getElementById('attendanceTableBody');
            if (!tbody) return;

            try {
                let url = `${baseApiUrl}/students.php?action=get-active-enrollments`;
                if (deskBranchId > 0) {
                    url += `&branch_id=${encodeURIComponent(deskBranchId)}`;
                }
                const response = await axios.get(url);
                const data = response.data || {};
                attendanceRows = data.success && Array.isArray(data.enrollments) ? data.enrollments : [];
                const historyEntries = await Promise.all(attendanceRows.map(async student => {
                    const studentId = Number(student.student_id || 0);
                    if (studentId < 1) return [studentId, { rows: [], attendedKeys: new Set(), excusedKeys: new Set() }];
                    try {
                        return [studentId, await loadAttendanceHistory(studentId)];
                    } catch (_) {
                        return [studentId, { rows: [], attendedKeys: new Set(), excusedKeys: new Set() }];
                    }
                }));
                attendanceByStudentId = Object.fromEntries(historyEntries);
                renderAttendanceTable();
            } catch (error) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-8 text-center text-red-500">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <p>Failed to load attendance data. Please try again.</p>
                        </td>
                    </tr>
                `;
            }
        }

        document.addEventListener('DOMContentLoaded', async () => {
            const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
            const role = String(user?.role_name || '').toLowerCase();
            const isDeskRole = ['staff', 'desk', 'front desk'].includes(role);

            if (!user || !isDeskRole) {
                showMessage('Access denied. Desk only.', 'error');
                setTimeout(() => {
                    window.location.href = '../../index.html';
                }, 900);
                return;
            }

            deskBranchId = Number(user.branch_id || 0);
            const branchName = user.branch_name || '—';
            const sidebarBranch = document.getElementById('deskBranchNameSidebar');
            const pillBranch = document.getElementById('deskBranchNamePill');
            if (sidebarBranch) sidebarBranch.textContent = branchName;
            if (pillBranch) pillBranch.textContent = branchName;

            await loadAttendanceRows();
        });

        window.openAttendanceDetails = openAttendanceDetails;
