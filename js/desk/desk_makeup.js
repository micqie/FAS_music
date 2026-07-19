     let deskBranchId = 0;
        let makeupRows = [];
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
                const status     = String(slot.status || '').toLowerCase();
                const attStatus  = String(slot.attendance_status || '').toLowerCase();

                // Skip sessions that were completed/attended
                if (['completed', 'present', 'late'].includes(status)) return false;
                if (['present', 'late'].includes(attStatus)) return false;
                if (status === 'cancelled_by_teacher' || status === 'rescheduled') return false;

                // Only count past sessions
                const sessionDateTime = new Date(`${slot.session_date}T${slot.end_time || slot.start_time || '23:59:59'}`);
                if (Number.isNaN(sessionDateTime.getTime()) || sessionDateTime > now) return false;

                const sessionKey = normalizeDateKey(slot.session_date);
                if (sessionKey && attendanceContext.attendedKeys.has(sessionKey)) return false;
                if (sessionKey && attendanceContext.excusedKeys.has(sessionKey)) return false;
                if (attStatus === 'excused') return false;

                // Count if explicitly absent, or past + no show
                if (['absent', 'no show', 'ci'].includes(attStatus)) return true;
                if (['absent', 'no show'].includes(status)) return true;

                // Past session with no attendance recorded = count as absence
                if (sessionDateTime <= now && (!attStatus || attStatus === 'pending')) return true;

                return false;
            }).length;
        }

        function getMakeupThreshold(student) {
            const totalSessions = Number(student?.sessions || 0);
            if (totalSessions <= 12) return 2;
            if (totalSessions <= 20) return 3;
            return 5; // 50-session package
        }

        function getPendingMakeupSessions(student) {
            const sessionsList = Array.isArray(student.sessions_list) ? student.sessions_list : [];
            return sessionsList.filter(slot => {
                if (!slot) return false;
                const makeupRequired = Number(slot.makeup_required || 0) === 1;
                const replacementScheduled = Number(slot.rescheduled_to_session_id || 0) > 0;
                return makeupRequired && !replacementScheduled;
            });
        }

        // Show student if:
        // 1. Any session has makeup_required=1 (DB-confirmed), OR
        // 2. Absence count meets or exceeds their package threshold
        //    (catches students whose DB flag hasn't been synced yet)
        function isMakeupRequired(student) {
            if (getPendingMakeupSessions(student).length > 0) return true;
            const absences = getAbsenceCount(student);
            const threshold = getMakeupThreshold(student);
            return absences >= threshold;
        }

        function getRemainingCount(student) {
            const totalSessions = Number(student.sessions || 0);
            return Math.max(0, totalSessions - getCompletedCount(student));
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

        function getNextSessionSummary(student) {
            const upcoming = getUpcomingScheduledSessions(student);
            if (!upcoming.length) {
                return {
                    label: 'No upcoming sessions',
                    meta: 'Needs branch scheduling follow-up.'
                };
            }

            return {
                label: `${upcoming.length} upcoming session${upcoming.length === 1 ? '' : 's'}`,
                meta: `Next: ${formatDateShort(upcoming[0].session_date)}`
            };
        }

        function openUpcomingSessionsModal(enrollmentId) {
            const student = makeupRows.find(row => Number(row.enrollment_id) === Number(enrollmentId));
            if (!student) {
                showMessage('Upcoming sessions not found.', 'error');
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
                title: `${studentName} Upcoming Sessions`,
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

        function updateSummary(rows) {
            const studentCountEl = document.getElementById('makeupStudentCount');
            const redCountEl = document.getElementById('makeupRedCount');
            const tableCountEl = document.getElementById('makeupTableCount');
            if (studentCountEl) studentCountEl.textContent = String(rows.length);
            if (redCountEl) redCountEl.textContent = String(rows.length);
            if (tableCountEl) tableCountEl.textContent = rows.length
                ? `${rows.length} student${rows.length === 1 ? '' : 's'} currently need make-up follow-up`
                : 'No students currently on the red list';
        }

        function getStatusBadge(student) {
            const pendingMakeups = getPendingMakeupSessions(student).length;
            const absences = getAbsenceCount(student);
            const threshold = getMakeupThreshold(student);
            if (pendingMakeups > 1 || absences >= threshold + 1) {
                return '<span class="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700">Urgent Follow-Up</span>';
            }
            return '<span class="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">Make-Up Required</span>';
        }

        function openMakeupDetails(enrollmentId) {
            const student = makeupRows.find(row => Number(row.enrollment_id) === Number(enrollmentId));
            if (!student) {
                showMessage('Make-up details not found.', 'error');
                return;
            }

            const sessionsList = Array.isArray(student.sessions_list) ? student.sessions_list : [];
            const now = new Date();
            const rows = sessionsList.map(slot => {
                const status = String(slot.status || '').toLowerCase();
                const sessionDateTime = slot.session_date ? new Date(`${slot.session_date}T${slot.end_time || slot.start_time || '23:59:59'}`) : null;
                const sessionKey = normalizeDateKey(slot.session_date);
                const attendanceContext = getAttendanceContext(student);
                const attended = sessionKey && attendanceContext.attendedKeys.has(sessionKey);
                const excused = sessionKey && attendanceContext.excusedKeys.has(sessionKey);
                const makeupRequired = Number(slot.makeup_required || 0) === 1;
                const replacementScheduled = Number(slot.rescheduled_to_session_id || 0) > 0;
                let state = 'Upcoming';
                let badge = '<span class="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-bold text-sky-700">Upcoming</span>';

                if (makeupRequired && !replacementScheduled) {
                    state = 'Needs Make-Up';
                    badge = '<span class="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">Needs Make-Up</span>';
                } else if (replacementScheduled) {
                    state = 'Make-Up Scheduled';
                    badge = '<span class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700">Make-Up Scheduled</span>';
                } else if (excused) {
                    state = 'Excused';
                    badge = '<span class="inline-flex items-center rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700">Excused</span>';
                } else if (attended || ['completed', 'late', 'present'].includes(status)) {
                    state = 'Attended';
                    badge = '<span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">Attended</span>';
                } else if (sessionDateTime && !Number.isNaN(sessionDateTime.getTime()) && sessionDateTime < now) {
                    state = 'Missed';
                    badge = '<span class="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700">Missed</span>';
                }

                const dateText = slot.session_date ? formatDateShort(slot.session_date) : 'Unscheduled';
                const timeText = slot.start_time ? `${formatTime12Hour(slot.start_time)} - ${formatTime12Hour(slot.end_time)}` : '—';
                const roomText = slot.room_name ? escapeHtml(slot.room_name) : '—';
                return `
                    <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div class="flex items-center justify-between gap-3 mb-2">
                            <div class="text-sm font-semibold text-slate-800">Session ${Number(slot.session_number || 0) || '—'}</div>
                            ${badge}
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm text-slate-700">
                            <div><span class="font-semibold text-slate-900">Date:</span> ${escapeHtml(dateText)}</div>
                            <div><span class="font-semibold text-slate-900">Time:</span> ${escapeHtml(timeText)}</div>
                            <div><span class="font-semibold text-slate-900">Room:</span> ${roomText}</div>
                            <div><span class="font-semibold text-slate-900">State:</span> ${state}</div>
                        </div>
                    </div>
                `;
            }).join('');

            Swal.fire({
                title: `${escapeHtml(student.first_name || '')} ${escapeHtml(student.last_name || '')}`.trim() || 'Make-Up Details',
                width: 980,
                confirmButtonText: 'Close',
                html: `
                    <div class="text-left">
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5 text-sm text-slate-700">
                            <div><span class="font-semibold text-slate-900">Package:</span> ${escapeHtml(student.package_name || '—')}</div>
                            <div><span class="font-semibold text-slate-900">Completed:</span> ${getCompletedCount(student)} / ${Number(student.sessions || 0)}</div>
                            <div><span class="font-semibold text-slate-900">Absences:</span> <span class="text-rose-600 font-semibold">${getAbsenceCount(student)}</span></div>
                            <div><span class="font-semibold text-slate-900">Pending Make-Ups:</span> ${getPendingMakeupSessions(student).length}</div>
                        </div>
                        <div class="space-y-3 max-h-[58vh] overflow-y-auto pr-1">${rows || '<div class="text-sm text-slate-500">No scheduled sessions found.</div>'}</div>
                    </div>
                `
            });
        }

        function openMakeupReschedulePicker(sessionId, enrollmentId) {
            const student = makeupRows.find(row => Number(row.enrollment_id) === Number(enrollmentId));
            const studentName = student
                ? `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student'
                : 'Student';

            Swal.fire({
                title: `Reschedule Make-Up`,
                text: `Loading available slots for ${studentName}…`,
                didOpen: async () => {
                    Swal.showLoading();
                    try {
                        const response = await axios.get(`${baseApiUrl}/students.php?action=get-reschedule-slots&session_id=${encodeURIComponent(sessionId)}`);
                        const data = response.data || {};
                        const slots = Array.isArray(data.slots) ? data.slots : [];

                        if (!data.success) {
                            Swal.fire({ icon: 'error', title: 'Cannot Reschedule', text: data.error || 'Unable to load available slots.', confirmButtonColor: '#b8860b' });
                            return;
                        }
                        if (!slots.length) {
                            Swal.fire({ icon: 'info', title: 'No Slots Available', text: 'No available slots found for this teacher right now. Check teacher availability.', confirmButtonColor: '#b8860b' });
                            return;
                        }

                        const inputOptions = {};
                        slots.forEach((slot, index) => {
                            const date = formatDateShort(slot.session_date);
                            const time = slot.start_time ? `${formatTime12Hour(slot.start_time)} – ${formatTime12Hour(slot.end_time)}` : '—';
                            inputOptions[String(index)] = `${date} · ${slot.day_of_week || ''} · ${time}`;
                        });

                        Swal.fire({
                            icon: 'info',
                            title: `Reschedule Make-Up — ${escapeHtml(studentName)}`,
                            text: 'Choose a new slot for this make-up session.',
                            input: 'select',
                            inputOptions,
                            inputPlaceholder: 'Select an available slot',
                            inputValue: '',
                            showCancelButton: true,
                            confirmButtonText: 'Confirm Reschedule',
                            cancelButtonText: 'Cancel',
                            confirmButtonColor: '#b8860b',
                            inputValidator: value => (!value && value !== 0) ? 'Please select a slot.' : null
                        }).then(async result => {
                            if (!result.isConfirmed) return;
                            const chosen = slots[Number(result.value)];
                            if (!chosen) { showMessage('Selected slot is invalid.', 'error'); return; }

                            try {
                                const saveRes = await axios.post(`${baseApiUrl}/students.php?action=reschedule-session`, {
                                    session_id: sessionId,
                                    session_date: chosen.session_date,
                                    start_time: chosen.start_time,
                                    end_time: chosen.end_time,
                                    reason: 'Make-up session rescheduled by desk'
                                });
                                const saveData = saveRes.data || {};
                                if (saveData.success) {
                                    Swal.fire({ icon: 'success', title: 'Rescheduled', text: saveData.message || 'Make-up session rescheduled successfully.', confirmButtonColor: '#b8860b' });
                                    await loadMakeupRows();
                                } else {
                                    showMessage(saveData.error || 'Failed to reschedule. Please try again.', 'error');
                                }
                            } catch (e) {
                                showMessage('Network error while rescheduling. Please try again.', 'error');
                            }
                        });
                    } catch (e) {
                        Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load reschedule options.', confirmButtonColor: '#b8860b' });
                    }
                }
            });
        }

        async function openMakeupRescheduleFlow(enrollmentId) {
            const student = makeupRows.find(row => Number(row.enrollment_id) === Number(enrollmentId));
            if (!student) { showMessage('Student not found.', 'error'); return; }

            const pending = getPendingMakeupSessions(student);
            const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';

            // ── Case 1: DB-flagged makeup_required sessions exist ──
            if (pending.length === 1) {
                openMakeupReschedulePicker(Number(pending[0].session_id), enrollmentId);
                return;
            }
            if (pending.length > 1) {
                const opts = {};
                pending.forEach((slot, i) => {
                    const date = slot.session_date ? formatDateShort(slot.session_date) : 'Unscheduled';
                    const time = slot.start_time ? `${formatTime12Hour(slot.start_time)} – ${formatTime12Hour(slot.end_time)}` : '—';
                    opts[String(i)] = `Session ${slot.session_number || '—'} · ${date} · ${time}`;
                });
                const r = await Swal.fire({
                    icon: 'question',
                    title: `Schedule Make-Up — ${escapeHtml(studentName)}`,
                    text: `${pending.length} sessions need a make-up. Which one would you like to schedule?`,
                    input: 'select', inputOptions: opts,
                    inputPlaceholder: 'Select a session',
                    showCancelButton: true,
                    confirmButtonText: 'Pick a Slot', cancelButtonText: 'Cancel',
                    confirmButtonColor: '#b8860b',
                    inputValidator: v => (!v && v !== 0) ? 'Please select a session.' : null
                });
                if (!r.isConfirmed) return;
                const s = pending[Number(r.value)];
                if (s) openMakeupReschedulePicker(Number(s.session_id), enrollmentId);
                return;
            }

            // ── Case 2: No makeup_required flag — find absent/missed sessions ──
            const sessionsList = Array.isArray(student.sessions_list) ? student.sessions_list : [];
            const now = new Date();
            const absentSessions = sessionsList.filter(slot => {
                if (!slot || !slot.session_date) return false;
                const att    = String(slot.attendance_status || '').toLowerCase();
                const status = String(slot.status || '').toLowerCase();
                const dt     = new Date(`${slot.session_date}T${slot.end_time || '23:59:59'}`);
                if (isNaN(dt.getTime()) || dt > now) return false;
                if (['present','late','excused'].includes(att)) return false;
                if (['cancelled_by_teacher','rescheduled','completed','present','late'].includes(status)) return false;
                if (Number(slot.rescheduled_to_session_id || 0) > 0) return false;
                return true;
            });

            if (!absentSessions.length) {
                showMessage('No missed sessions found to schedule a make-up for this student.', 'error');
                return;
            }

            if (absentSessions.length === 1) {
                openMakeupReschedulePicker(Number(absentSessions[0].session_id), enrollmentId);
                return;
            }

            // Multiple absent sessions — let desk pick which one
            const absentOpts = {};
            absentSessions.forEach((slot, i) => {
                const date = slot.session_date ? formatDateShort(slot.session_date) : 'Unscheduled';
                const time = slot.start_time ? `${formatTime12Hour(slot.start_time)} – ${formatTime12Hour(slot.end_time)}` : '—';
                const att  = slot.attendance_status ? ` · ${slot.attendance_status}` : '';
                absentOpts[String(i)] = `Session ${slot.session_number || '—'} · ${date} · ${time}${att}`;
            });

            const result = await Swal.fire({
                icon: 'info',
                title: `Schedule Make-Up — ${escapeHtml(studentName)}`,
                text: `${absentSessions.length} missed session${absentSessions.length > 1 ? 's' : ''} found. Choose one to schedule a make-up for.`,
                input: 'select', inputOptions: absentOpts,
                inputPlaceholder: 'Select a missed session',
                showCancelButton: true,
                confirmButtonText: 'Pick a Slot', cancelButtonText: 'Cancel',
                confirmButtonColor: '#b8860b',
                inputValidator: v => (!v && v !== 0) ? 'Please select a session.' : null
            });

            if (!result.isConfirmed) return;
            const chosenSlot = absentSessions[Number(result.value)];
            if (chosenSlot) openMakeupReschedulePicker(Number(chosenSlot.session_id), enrollmentId);
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

        function renderTable() {
            const tbody = document.getElementById('makeupTableBody');
            if (!tbody) return;

            if (!makeupRows.length) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="px-6 py-8 text-center text-slate-500">
                            <i class="fas fa-shield-heart text-2xl mb-2 text-emerald-500/70"></i>
                            <p>No students are currently on the make-up red list for this branch.</p>
                        </td>
                    </tr>
                `;
                updateSummary([]);
                return;
            }

            tbody.innerHTML = makeupRows.map(student => {
                const studentName = `${escapeHtml(student.first_name || '')} ${escapeHtml(student.last_name || '')}`.trim() || 'Student';
                const sessionSummary = getNextSessionSummary(student);
                const pendingCount = getPendingMakeupSessions(student).length;
                return `
                    <tr class="hover:bg-rose-50/40 transition">
                        <td class="px-6 py-4">
                            <button type="button"
                                onclick="openMakeupRescheduleFlow(${Number(student.enrollment_id)})"
                                class="text-left group">
                                <div class="font-semibold text-slate-900 group-hover:text-blue-700 transition">${studentName}</div>
                                <div class="text-sm text-slate-500">${escapeHtml(student.email || '')}</div>
                                ${pendingCount > 0 ? `<div class="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700"><i class="fas fa-calendar-plus text-[9px]"></i> ${pendingCount} make-up${pendingCount === 1 ? '' : 's'} pending</div>` : ''}
                            </button>
                        </td>
                        <td class="px-6 py-4 text-slate-700">${escapeHtml(student.package_name || '—')}</td>
                        <td class="px-6 py-4 text-slate-700 font-medium">${getCompletedCount(student)} / ${Number(student.sessions || 0)}</td>
                        <td class="px-6 py-4 font-semibold text-rose-600">${getAbsenceCount(student)}</td>
                        <td class="px-6 py-4 font-medium text-amber-600">${getRemainingCount(student)}</td>
                        <td class="px-6 py-4 text-slate-600">${getMakeupThreshold(student)} absence${getMakeupThreshold(student) === 1 ? '' : 's'}</td>
                        <td class="px-6 py-4">
                            <button type="button" class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100 transition" onclick="openUpcomingSessionsModal(${Number(student.enrollment_id)})">
                                <i class="fas fa-calendar-days text-blue-600"></i>
                                <span>
                                    <span class="block text-sm font-semibold text-slate-800">${escapeHtml(sessionSummary.label)}</span>
                                    <span class="block text-xs text-slate-500">${escapeHtml(sessionSummary.meta)}</span>
                                </span>
                            </button>
                        </td>
                        <td class="px-6 py-4">
                            <div class="flex items-center gap-2 flex-wrap">
                                ${getStatusBadge(student)}
                                <button type="button"
                                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 text-xs font-bold transition"
                                    onclick="openMakeupRescheduleFlow(${Number(student.enrollment_id)})">
                                    <i class="fas fa-calendar-plus text-[11px]"></i>
                                    Schedule Make-Up
                                </button>
                                <button type="button"
                                    class="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold transition"
                                    onclick="openMakeupDetails(${Number(student.enrollment_id)})">
                                    View Details
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            updateSummary(makeupRows);
        }

        async function loadMakeupRows() {
            const tbody = document.getElementById('makeupTableBody');
            if (!tbody) return;

            try {
                let url = `${baseApiUrl}/students.php?action=get-active-enrollments`;
                if (deskBranchId > 0) url += `&branch_id=${encodeURIComponent(deskBranchId)}`;
                const response = await axios.get(url);
                const data = response.data || {};
                const rows = data.success && Array.isArray(data.enrollments) ? data.enrollments : [];

                const historyEntries = await Promise.all(rows.map(async student => {
                    const studentId = Number(student.student_id || 0);
                    if (studentId < 1) return [studentId, { rows: [], attendedKeys: new Set(), excusedKeys: new Set() }];
                    try {
                        return [studentId, await loadAttendanceHistory(studentId)];
                    } catch (_) {
                        return [studentId, { rows: [], attendedKeys: new Set(), excusedKeys: new Set() }];
                    }
                }));
                attendanceByStudentId = Object.fromEntries(historyEntries);

                makeupRows = rows
                    .filter(isMakeupRequired)
                    .sort((a, b) => getAbsenceCount(b) - getAbsenceCount(a));

                renderTable();
            } catch (error) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="px-6 py-8 text-center text-red-500">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <p>Failed to load make-up data. Please try again.</p>
                        </td>
                    </tr>
                `;
            }
        }

        window.openMakeupDetails = openMakeupDetails;
        window.openUpcomingSessionsModal = openUpcomingSessionsModal;
        window.openMakeupRescheduleFlow = openMakeupRescheduleFlow;
        window.openMakeupReschedulePicker = openMakeupReschedulePicker;

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
            if (typeof syncDeskNavUser === 'function') syncDeskNavUser();

            await loadMakeupRows();
        });
