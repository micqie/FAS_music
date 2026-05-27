  let deskBranchId = 0;
        let deskBranchName = '';
        let attendanceRows = [];
        let attendanceByStudentId = {};
        let attendanceCalendarEvents = [];
        let attendanceSelectedDate = '';
        let attendanceCalendarMonth = '';

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

        function padDatePart(value) {
            return String(value).padStart(2, '0');
        }

        function buildLocalDateKey(year, monthIndex, day) {
            return `${year}-${padDatePart(monthIndex + 1)}-${padDatePart(day)}`;
        }

        function parseCalendarDate(value) {
            if (!value) return null;
            if (value instanceof Date) {
                return Number.isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate());
            }

            const raw = String(value).trim();
            const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (match) {
                return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
            }

            const parsed = new Date(raw);
            if (Number.isNaN(parsed.getTime())) return null;
            return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
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
            const date = parseCalendarDate(dateString);
            if (Number.isNaN(date.getTime())) return String(dateString);
            return date.toLocaleDateString();
        }

        function formatDateLong(dateString) {
            if (!dateString) return '—';
            const date = parseCalendarDate(dateString);
            if (Number.isNaN(date.getTime())) return String(dateString);
            return date.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
        }

        function normalizeDateKey(dateString) {
            if (!dateString) return '';
            const date = parseCalendarDate(dateString);
            if (!date) return String(dateString).slice(0, 10);
            return buildLocalDateKey(date.getFullYear(), date.getMonth(), date.getDate());
        }

        function getTodayDateKey() {
            const now = new Date();
            return buildLocalDateKey(now.getFullYear(), now.getMonth(), now.getDate());
        }

        function getMonthKeyFromDate(dateString) {
            const date = parseCalendarDate(dateString);
            if (!date) return getTodayDateKey().slice(0, 7);
            return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}`;
        }

        function getDateFromMonthKey(monthKey) {
            const [year, month] = String(monthKey || '').split('-').map(Number);
            if (!year || !month) {
                const now = new Date();
                return new Date(now.getFullYear(), now.getMonth(), 1);
            }
            return new Date(year, month - 1, 1);
        }

        function shiftMonthKey(monthKey, delta) {
            const base = getDateFromMonthKey(monthKey);
            const shifted = new Date(base.getFullYear(), base.getMonth() + delta, 1);
            return `${shifted.getFullYear()}-${padDatePart(shifted.getMonth() + 1)}`;
        }

        function getAttendanceContext(student) {
            const studentId = Number(student?.student_id || 0);
            return attendanceByStudentId[studentId] || { rows: [], attendedKeys: new Set(), excusedKeys: new Set() };
        }

        function getTeacherLabel(slot, student) {
            const slotTeacher = `${String(slot?.teacher_first_name || '').trim()} ${String(slot?.teacher_last_name || '').trim()}`.trim();
            if (slotTeacher) return slotTeacher;
            const fixedTeacher = `${String(student?.teacher_first_name || '').trim()} ${String(student?.teacher_last_name || '').trim()}`.trim();
            return fixedTeacher || 'Instructor pending';
        }

        function buildAttendanceCalendarEvents(rows) {
            return rows.flatMap(student => {
                const sessionsList = Array.isArray(student.sessions_list) ? student.sessions_list : [];
                const studentName = `${String(student.first_name || '').trim()} ${String(student.last_name || '').trim()}`.trim() || 'Student';
                return sessionsList
                    .filter(slot => slot && slot.session_date)
                    .map(slot => {
                        const dateKey = normalizeDateKey(slot.session_date);
                        const status = String(slot.status || '').toLowerCase();
                        const attendanceContext = getAttendanceContext(student);
                        const attended = dateKey && attendanceContext.attendedKeys.has(dateKey);
                        const excused = dateKey && attendanceContext.excusedKeys.has(dateKey);
                        const absences = getAbsenceCount(student);
                        const completedCount = getCompletedCount(student);
                        const remainingCount = getRemainingCount(student);
                        let state = 'Scheduled';
                        if (excused) state = 'Excused';
                        else if (attended || ['completed', 'present', 'late'].includes(status)) state = 'Completed';
                        else if (status === 'cancelled_by_teacher') state = 'Cancelled';
                        else if (['absent', 'no show'].includes(status)) state = 'Absent';

                        return {
                            enrollmentId: Number(student.enrollment_id || 0),
                            studentId: Number(student.student_id || 0),
                            sessionId: Number(slot.session_id || 0),
                            sessionNumber: Number(slot.session_number || 0),
                            dateKey,
                            startTime: String(slot.start_time || ''),
                            endTime: String(slot.end_time || ''),
                            roomName: String(slot.room_name || student.assigned_room || ''),
                            teacherName: getTeacherLabel(slot, student),
                            packageName: String(student.package_name || '—'),
                            studentName,
                            email: String(student.email || ''),
                            state,
                            status: String(slot.status || 'Scheduled'),
                            completedCount,
                            remainingCount,
                            absences,
                            totalSessions: Number(student.sessions || 0)
                        };
                    });
            }).sort((a, b) => {
                const aTime = `${a.dateKey}T${a.startTime || '00:00:00'}`;
                const bTime = `${b.dateKey}T${b.startTime || '00:00:00'}`;
                return new Date(aTime) - new Date(bTime);
            });
        }

        function getEventsForDate(dateKey) {
            return attendanceCalendarEvents.filter(event => event.dateKey === dateKey);
        }

        function getStateClasses(state) {
            const normalized = String(state || '').toLowerCase();
            if (normalized === 'completed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
            if (normalized === 'cancelled') return 'border-rose-200 bg-rose-50 text-rose-700';
            if (normalized === 'absent') return 'border-red-200 bg-red-50 text-red-700';
            if (normalized === 'excused') return 'border-slate-200 bg-slate-100 text-slate-700';
            return 'border-sky-200 bg-sky-50 text-sky-700';
        }

        function setCalendarText(id, value) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        }

        function populateAttendanceBranchFilter() {
            const select = document.getElementById('attendanceBranchFilter');
            if (!select) return;

            const branchLabel = deskBranchName || 'Assigned branch';
            select.innerHTML = `<option value="${escapeHtml(String(deskBranchId || ''))}">${escapeHtml(branchLabel)}</option>`;
            select.value = String(deskBranchId || '');
            select.disabled = true;
            select.title = 'Desk attendance is scoped to the assigned branch.';
        }

        function renderUpcomingSessions() {
            const listEl = document.getElementById('attendanceUpcomingList');
            if (!listEl) return;

            const todayKey = getTodayDateKey();
            const upcoming = attendanceCalendarEvents
                .filter(event => event.dateKey >= todayKey && !['Completed', 'Cancelled', 'Absent'].includes(event.state))
                .slice(0, 6);

            if (!upcoming.length) {
                listEl.innerHTML = `
                    <div class="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-300">
                        No upcoming sessions are scheduled for this branch yet.
                    </div>
                `;
                return;
            }

            listEl.innerHTML = upcoming.map(event => `
                <button type="button" class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left hover:bg-white/10 transition" onclick="selectAttendanceCalendarDate('${escapeHtml(event.dateKey)}')">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <div class="text-sm font-semibold text-white">${escapeHtml(event.studentName)}</div>
                            <div class="mt-1 text-xs text-slate-400">${escapeHtml(event.packageName)} • ${escapeHtml(event.teacherName)}</div>
                        </div>
                        <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStateClasses(event.state)}">${escapeHtml(event.state)}</span>
                    </div>
                    <div class="mt-3 text-sm text-slate-200">${escapeHtml(formatDateShort(event.dateKey))} • ${escapeHtml(event.startTime ? `${formatTime12Hour(event.startTime)} - ${formatTime12Hour(event.endTime)}` : 'Time pending')}</div>
                </button>
            `).join('');
        }

        function openUpcomingSessionsModal() {
            const todayKey = getTodayDateKey();
            const upcoming = attendanceCalendarEvents
                .filter(event => event.dateKey >= todayKey && !['Completed', 'Cancelled', 'Absent'].includes(event.state))
                .slice(0, 12);

            const content = upcoming.length
                ? upcoming.map(event => `
                    <button
                        type="button"
                        class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left hover:bg-slate-100 transition"
                        onclick="window.selectAttendanceCalendarDate('${escapeHtml(event.dateKey)}'); Swal.close();"
                    >
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <div class="text-sm font-bold text-slate-900">${escapeHtml(event.studentName)}</div>
                                <div class="mt-1 text-xs text-slate-500">${escapeHtml(event.packageName)} • ${escapeHtml(event.teacherName)}</div>
                            </div>
                            <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStateClasses(event.state)}">${escapeHtml(event.state)}</span>
                        </div>
                        <div class="mt-3 text-sm text-slate-700">${escapeHtml(formatDateShort(event.dateKey))} • ${escapeHtml(event.startTime ? `${formatTime12Hour(event.startTime)} - ${formatTime12Hour(event.endTime)}` : 'Time pending')}</div>
                    </button>
                `).join('')
                : '<div class="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">No upcoming sessions are scheduled for this branch yet.</div>';

            Swal.fire({
                title: 'Upcoming Branch Sessions',
                width: 820,
                confirmButtonText: 'Close',
                html: `<div class="space-y-3 max-h-[65vh] overflow-y-auto pr-1 text-left">${content}</div>`
            });
        }

        function renderSelectedDateSchedule() {
            const titleEl = document.getElementById('attendanceSelectedDateTitle');
            const metaEl = document.getElementById('attendanceSelectedDateMeta');
            const listEl = document.getElementById('attendanceSelectedDateList');
            if (!titleEl || !metaEl || !listEl) return;

            const selectedEvents = getEventsForDate(attendanceSelectedDate);
            setCalendarText('attendanceSelectedDateLabel', formatDateShort(attendanceSelectedDate));
            titleEl.textContent = formatDateLong(attendanceSelectedDate);
            metaEl.textContent = selectedEvents.length
                ? `${selectedEvents.length} session${selectedEvents.length === 1 ? '' : 's'} scheduled for this branch`
                : 'No sessions scheduled for this date.';

            if (!selectedEvents.length) {
                listEl.innerHTML = `
                    <div class="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                        No student sessions were scheduled for ${formatDateLong(attendanceSelectedDate)}.
                    </div>
                `;
                return;
            }

            listEl.innerHTML = selectedEvents.map(event => `
                <article class="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div class="text-lg font-bold text-slate-900">${escapeHtml(event.studentName)}</div>
                            <div class="mt-1 text-sm text-slate-500">${escapeHtml(event.email || 'No email on file')}</div>
                        </div>
                        <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStateClasses(event.state)}">${escapeHtml(event.state)}</span>
                    </div>
                    <div class="mt-4 grid gap-3 md:grid-cols-2">
                        <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div class="text-[11px] uppercase tracking-[0.2em] text-slate-400 font-bold">Session</div>
                            <div class="mt-2 text-sm font-semibold text-slate-900">${event.startTime ? `${formatTime12Hour(event.startTime)} - ${formatTime12Hour(event.endTime)}` : 'Time pending'}</div>
                            <div class="mt-1 text-xs text-slate-500">Session ${event.sessionNumber || '—'} • ${escapeHtml(event.roomName || 'Room pending')}</div>
                        </div>
                        <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div class="text-[11px] uppercase tracking-[0.2em] text-slate-400 font-bold">Teacher & Package</div>
                            <div class="mt-2 text-sm font-semibold text-slate-900">${escapeHtml(event.teacherName)}</div>
                            <div class="mt-1 text-xs text-slate-500">${escapeHtml(event.packageName)}</div>
                        </div>
                    </div>
                    <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div class="flex flex-wrap gap-2 text-xs">
                            <span class="rounded-full bg-white px-3 py-1 font-semibold text-slate-600 border border-slate-200">Completed ${event.completedCount}/${event.totalSessions || '—'}</span>
                            <span class="rounded-full bg-white px-3 py-1 font-semibold text-rose-600 border border-rose-100">Absences ${event.absences}</span>
                            <span class="rounded-full bg-white px-3 py-1 font-semibold text-amber-600 border border-amber-100">Remaining ${event.remainingCount}</span>
                        </div>
                        <button type="button" class="inline-flex items-center gap-2 rounded-xl bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-200 transition" onclick="openAttendanceDetails(${Number(event.enrollmentId)})">
                            <i class="fas fa-up-right-from-square"></i>
                            View Attendance
                        </button>
                    </div>
                </article>
            `).join('');
        }

        function getDayScheduleModalMarkup(dateKey) {
            const selectedEvents = getEventsForDate(dateKey);

            if (!selectedEvents.length) {
                return `
                    <div class="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                        No students are scheduled for ${escapeHtml(formatDateLong(dateKey))}.
                    </div>
                `;
            }

            return selectedEvents.map(event => `
                <article class="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div class="text-base font-bold text-slate-900">${escapeHtml(event.studentName)}</div>
                            <div class="mt-1 text-xs text-slate-500">${escapeHtml(event.email || 'No email on file')}</div>
                        </div>
                        <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStateClasses(event.state)}">${escapeHtml(event.state)}</span>
                    </div>
                    <div class="mt-3 grid gap-3 md:grid-cols-2">
                        <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div class="text-[11px] uppercase tracking-[0.2em] text-slate-400 font-bold">Schedule</div>
                            <div class="mt-2 text-sm font-semibold text-slate-900">${event.startTime ? `${formatTime12Hour(event.startTime)} - ${formatTime12Hour(event.endTime)}` : 'Time pending'}</div>
                            <div class="mt-1 text-xs text-slate-500">${escapeHtml(event.roomName || 'Room pending')} • Session ${event.sessionNumber || '—'}</div>
                        </div>
                        <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div class="text-[11px] uppercase tracking-[0.2em] text-slate-400 font-bold">Instructor & Package</div>
                            <div class="mt-2 text-sm font-semibold text-slate-900">${escapeHtml(event.teacherName)}</div>
                            <div class="mt-1 text-xs text-slate-500">${escapeHtml(event.packageName)}</div>
                        </div>
                    </div>
                    <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <div class="flex flex-wrap gap-2 text-xs">
                            <span class="rounded-full bg-white px-3 py-1 font-semibold text-slate-600 border border-slate-200">Completed ${event.completedCount}/${event.totalSessions || '—'}</span>
                            <span class="rounded-full bg-white px-3 py-1 font-semibold text-rose-600 border border-rose-100">Absences ${event.absences}</span>
                            <span class="rounded-full bg-white px-3 py-1 font-semibold text-amber-600 border border-amber-100">Remaining ${event.remainingCount}</span>
                        </div>
                        <button type="button" class="inline-flex items-center gap-2 rounded-xl bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-200 transition" onclick="openAttendanceDetails(${Number(event.enrollmentId)})">
                            <i class="fas fa-up-right-from-square"></i>
                            View Attendance
                        </button>
                    </div>
                </article>
            `).join('');
        }

        function openAttendanceDayModal(dateKey) {
            attendanceSelectedDate = dateKey;
            if (getMonthKeyFromDate(dateKey) !== attendanceCalendarMonth) {
                attendanceCalendarMonth = getMonthKeyFromDate(dateKey);
            }
            renderAttendanceCalendar();
            renderSelectedDateSchedule();

            const selectedEvents = getEventsForDate(dateKey);
            const title = dateKey === getTodayDateKey() ? "Who's Expected Today" : `Who's Expected on ${formatDateShort(dateKey)}`;

            Swal.fire({
                title,
                width: 920,
                confirmButtonText: 'Close',
                html: `
                    <div class="text-left">
                        <div class="mb-4 flex flex-wrap items-center gap-2 text-xs">
                            <span class="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700">Branch: ${escapeHtml(deskBranchName || 'Assigned branch')}</span>
                            <span class="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">${selectedEvents.length} student${selectedEvents.length === 1 ? '' : 's'} scheduled</span>
                        </div>
                        <div class="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
                            ${getDayScheduleModalMarkup(dateKey)}
                        </div>
                    </div>
                `
            });
        }

        function renderAttendanceCalendar() {
            const gridEl = document.getElementById('attendanceCalendarGrid');
            const monthLabelEl = document.getElementById('attendanceCalendarMonthLabel');
            if (!gridEl || !monthLabelEl) return;

            const monthStart = getDateFromMonthKey(attendanceCalendarMonth);
            const year = monthStart.getFullYear();
            const month = monthStart.getMonth();
            monthLabelEl.textContent = monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

            const firstGridDate = new Date(year, month, 1 - monthStart.getDay());
            const todayKey = getTodayDateKey();
            const cells = [];

            for (let index = 0; index < 42; index += 1) {
                const current = new Date(firstGridDate);
                current.setDate(firstGridDate.getDate() + index);
                const dateKey = normalizeDateKey(current);
                const dayEvents = getEventsForDate(dateKey);
                const isCurrentMonth = current.getMonth() === month;
                const isToday = dateKey === todayKey;
                const isSelected = dateKey === attendanceSelectedDate;

                cells.push(`
                    <button type="button" onclick="openAttendanceDayModal('${escapeHtml(dateKey)}')" class="min-h-[5.8rem] rounded-2xl border px-2 py-2 text-left transition ${isSelected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'} ${!isCurrentMonth ? 'opacity-45' : ''}">
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-sm font-bold ${isToday ? 'text-blue-700' : 'text-slate-800'}">${current.getDate()}</span>
                            ${isToday ? '<span class="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">Today</span>' : ''}
                        </div>
                        <div class="mt-2 space-y-1">
                            ${dayEvents.slice(0, 2).map(event => `
                                <div class="truncate rounded-lg px-2 py-1 text-[10px] font-semibold ${getStateClasses(event.state)}">
                                    ${escapeHtml(event.startTime ? formatTime12Hour(event.startTime) : 'Time')} • ${escapeHtml(event.studentName)}
                                </div>
                            `).join('')}
                            ${dayEvents.length > 2 ? `<div class="text-[10px] font-semibold text-slate-500">+${dayEvents.length - 2} more</div>` : ''}
                            ${!dayEvents.length ? '<div class="text-[10px] text-slate-400">No sessions</div>' : ''}
                        </div>
                    </button>
                `);
            }

            gridEl.innerHTML = cells.join('');
        }

        function syncAttendanceCalendarView() {
            if (!attendanceSelectedDate) {
                attendanceSelectedDate = getTodayDateKey();
            }
            attendanceCalendarMonth = getMonthKeyFromDate(attendanceSelectedDate);
            renderAttendanceCalendar();
            renderSelectedDateSchedule();
            renderUpcomingSessions();
        }

        function selectAttendanceCalendarDate(dateKey) {
            attendanceSelectedDate = dateKey;
            if (getMonthKeyFromDate(dateKey) !== attendanceCalendarMonth) {
                attendanceCalendarMonth = getMonthKeyFromDate(dateKey);
            }
            renderAttendanceCalendar();
            renderSelectedDateSchedule();
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

        function getUpcomingSessionSummary(student) {
            const upcoming = getUpcomingScheduledSessions(student);
            if (!upcoming.length) {
                return {
                    label: 'No upcoming sessions',
                    meta: 'Branch needs to add a future session date.',
                    count: 0
                };
            }

            const nextSession = upcoming[0];
            const dateText = formatDateShort(nextSession.session_date);
            return {
                label: `${upcoming.length} upcoming session${upcoming.length === 1 ? '' : 's'}`,
                meta: `Next: ${dateText}`,
                count: upcoming.length
            };
        }

        function openSessionDatesModal(enrollmentId) {
            const student = attendanceRows.find(row => Number(row.enrollment_id) === Number(enrollmentId));
            if (!student) {
                showMessage('Session dates not found.', 'error');
                return;
            }

            const upcoming = getUpcomingScheduledSessions(student);
            const studentName = `${escapeHtml(student.first_name || '')} ${escapeHtml(student.last_name || '')}`.trim() || 'Student';
            const content = upcoming.length
                ? upcoming.map(slot => {
                    const dateText = formatDateShort(slot.session_date);
                    const timeText = slot.start_time ? `${formatTime12Hour(slot.start_time)} - ${formatTime12Hour(slot.end_time)}` : 'Time pending';
                    const roomText = slot.room_name ? escapeHtml(slot.room_name) : 'Room pending';
                    return `
                        <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div class="text-sm font-semibold text-slate-900">${escapeHtml(dateText)}</div>
                            <div class="mt-1 text-sm text-slate-600">${escapeHtml(timeText)}</div>
                            <div class="mt-1 text-xs text-slate-500">${roomText}</div>
                        </div>
                    `;
                }).join('')
                : '<div class="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">No upcoming sessions scheduled yet.</div>';

            Swal.fire({
                title: `${studentName} Sessions`,
                width: 720,
                confirmButtonText: 'Close',
                html: `
                    <div class="text-left">
                        <div class="mb-4 text-sm text-slate-600">
                            Package: <span class="font-semibold text-slate-900">${escapeHtml(student.package_name || '—')}</span>
                        </div>
                        <div class="space-y-3 max-h-[55vh] overflow-y-auto pr-1">${content}</div>
                    </div>
                `
            });
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

        function openMakeupSummaryModal() {
            const flaggedStudents = attendanceRows
                .filter(isMakeupRequired)
                .sort((a, b) => getAbsenceCount(b) - getAbsenceCount(a));

            const content = flaggedStudents.length
                ? flaggedStudents.map(student => {
                    const studentName = `${String(student.first_name || '').trim()} ${String(student.last_name || '').trim()}`.trim() || 'Student';
                    const nextSession = getUpcomingSessionSummary(student);
                    return `
                        <div class="rounded-2xl border border-rose-100 bg-rose-50/70 px-4 py-4">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <div class="text-sm font-bold text-slate-900">${escapeHtml(studentName)}</div>
                                    <div class="mt-1 text-xs text-slate-500">${escapeHtml(student.package_name || '—')}</div>
                                </div>
                                <span class="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-rose-600 border border-rose-200">
                                    ${getAbsenceCount(student)} absence${getAbsenceCount(student) === 1 ? '' : 's'}
                                </span>
                            </div>
                            <div class="mt-3 flex flex-wrap gap-2 text-xs">
                                <span class="rounded-full bg-white px-3 py-1 font-semibold text-slate-600 border border-slate-200">Threshold ${getMakeupThreshold(student)}</span>
                                <span class="rounded-full bg-white px-3 py-1 font-semibold text-amber-600 border border-amber-100">Remaining ${getRemainingCount(student)}</span>
                            </div>
                            <div class="mt-3 text-xs text-slate-500">${escapeHtml(nextSession.meta)}</div>
                        </div>
                    `;
                }).join('')
                : '<div class="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">No students currently need make-up monitoring.</div>';

            Swal.fire({
                title: 'Make-Up Monitoring',
                width: 760,
                showCancelButton: true,
                confirmButtonText: 'Open Make-Up Page',
                cancelButtonText: 'Close',
                html: `
                    <div class="mb-4 text-left text-sm text-slate-600">
                        Review who has reached the make-up threshold without keeping a large card on the page.
                    </div>
                    <div class="space-y-3 max-h-[60vh] overflow-y-auto pr-1 text-left">${content}</div>
                `
            }).then(result => {
                if (result.isConfirmed) {
                    window.location.href = 'desk_makeup.html';
                }
            });
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
                attendanceCalendarEvents = buildAttendanceCalendarEvents(attendanceRows);
                attendanceSelectedDate = getTodayDateKey();
                attendanceCalendarMonth = getMonthKeyFromDate(attendanceSelectedDate);
                updateAttendanceSummary(attendanceRows);
                syncAttendanceCalendarView();
            } catch (error) {
                const gridEl = document.getElementById('attendanceCalendarGrid');
                const listEl = document.getElementById('attendanceSelectedDateList');
                const upcomingEl = document.getElementById('attendanceUpcomingList');
                if (gridEl) {
                    gridEl.innerHTML = '<div class="col-span-7 rounded-2xl border border-dashed border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-600">Failed to load attendance calendar.</div>';
                }
                if (listEl) {
                    listEl.innerHTML = '<div class="rounded-2xl border border-dashed border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-600">Failed to load branch session schedule.</div>';
                }
                if (upcomingEl) {
                    upcomingEl.innerHTML = '<div class="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-rose-200">Failed to load upcoming sessions.</div>';
                }
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
            deskBranchName = user.branch_name || '—';
            const sidebarBranch = document.getElementById('deskBranchNameSidebar');
            const pillBranch = document.getElementById('deskBranchNamePill');
            if (sidebarBranch) sidebarBranch.textContent = deskBranchName;
            if (pillBranch) pillBranch.textContent = deskBranchName;
            populateAttendanceBranchFilter();

            document.getElementById('attendancePrevMonthBtn')?.addEventListener('click', () => {
                attendanceCalendarMonth = shiftMonthKey(attendanceCalendarMonth, -1);
                renderAttendanceCalendar();
            });
            document.getElementById('attendanceNextMonthBtn')?.addEventListener('click', () => {
                attendanceCalendarMonth = shiftMonthKey(attendanceCalendarMonth, 1);
                renderAttendanceCalendar();
            });
            document.getElementById('attendanceTodayBtn')?.addEventListener('click', () => {
                selectAttendanceCalendarDate(getTodayDateKey());
            });
            document.getElementById('attendanceOpenUpcomingBtn')?.addEventListener('click', openUpcomingSessionsModal);
            document.getElementById('attendanceOpenTodayBtn')?.addEventListener('click', () => {
                openAttendanceDayModal(getTodayDateKey());
            });
            document.getElementById('attendanceOpenMakeupBtn')?.addEventListener('click', openMakeupSummaryModal);

            await loadAttendanceRows();
        });

        window.openAttendanceDetails = openAttendanceDetails;
        window.openAttendanceDayModal = openAttendanceDayModal;
        window.openUpcomingSessionsModal = openUpcomingSessionsModal;
        window.openMakeupSummaryModal = openMakeupSummaryModal;
        window.openSessionDatesModal = openSessionDatesModal;
        window.selectAttendanceCalendarDate = selectAttendanceCalendarDate;
