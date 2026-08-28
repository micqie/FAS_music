  let deskBranchId = 0;
        let deskBranchName = '';
        let attendanceRows = [];
        let attendanceByStudentId = {};
        let attendanceCalendarEvents = [];
        let attendanceSelectedDate = '';
        let attendanceCalendarMonth = '';
        let attendanceRoomTrackerModalOpen = false;
        let deskGuardianAbsenceRequests = [];

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

        function buildTeacherPackageSummary(student) {
            const sessions = Array.isArray(student?.sessions_list) ? student.sessions_list : [];
            const teacherMap = new Map();

            sessions.forEach((slot) => {
                const teacherName = `${String(slot?.teacher_first_name || '').trim()} ${String(slot?.teacher_last_name || '').trim()}`.trim();
                if (!teacherName) return;
                if (!teacherMap.has(teacherName)) {
                    teacherMap.set(teacherName, true);
                }
            });

            if (!teacherMap.size) {
                const teacherName = `${String(student?.teacher_first_name || '').trim()} ${String(student?.teacher_last_name || '').trim()}`.trim();
                if (teacherName) {
                    teacherMap.set(teacherName, true);
                }
            }

            const rows = Array.from(teacherMap.keys()).map(teacherName => ({ teacherName }));

            if (!rows.length) {
                return [];
            }

            return rows.map((row) => ({
                teacherName: row.teacherName,
                packageText: String(student?.package_name || '—').trim()
            }));
        }

        function renderTeacherPackageSummary(student) {
            const summaryRows = buildTeacherPackageSummary(student);
            if (!summaryRows.length) {
                return '<div class="text-sm text-slate-500">No teacher assigned yet.</div>';
            }

            return summaryRows.map((row) => `
                <div class="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <div class="text-sm font-semibold text-slate-900">${escapeHtml(row.teacherName)}</div>
                    <div class="mt-1 text-xs text-slate-500">${escapeHtml(row.packageText)}</div>
                </div>
            `).join('');
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
                            roomId: Number(slot.room_id || 0),
                            roomName: String(slot.room_name || '').trim(),
                            instrumentName: String(slot.instrument_name || '').trim(),
                            branchId: Number(student.branch_id || deskBranchId || 0),
                            teacherName: getTeacherLabel(slot, student),
                            packageName: String(student.package_name || '—'),
                            studentName,
                            email: String(student.email || ''),
                            state,
                            status: String(slot.status || 'Scheduled'),
                            completedCount,
                            remainingCount,
                            absences,
                            totalSessions: Number(student.sessions || 0),
                            scheduleStatus: String(student.schedule_status || 'Active'),
                            freezePaymentStatus: String(student.freeze_payment_status || 'None'),
                            usedAbsences: Number(student.used_absences || 0),
                            scheduleFreezeRequired: Number(student.schedule_freeze_required || 0)
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

        function getFrozenEventsForDate(dateKey) {
            return getEventsForDate(dateKey).filter(event => isEnrollmentFrozen(event));
        }

        function getActiveEventsForDate(dateKey) {
            return getEventsForDate(dateKey).filter(event => !isEnrollmentFrozen(event));
        }

        function getStateClasses(state) {
            const normalized = String(state || '').toLowerCase();
            if (normalized === 'completed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
            if (normalized === 'cancelled') return 'border-rose-200 bg-rose-50 text-rose-700';
            if (normalized === 'absent') return 'border-red-200 bg-red-50 text-red-700';
            if (normalized === 'excused') return 'border-slate-200 bg-slate-100 text-slate-700';
            return 'border-sky-200 bg-sky-50 text-sky-700';
        }

        function getSessionRoomDisplayLabel(event) {
            if (!event) return '';
            const roomId = Number(event.roomId || 0);
            const roomName = String(event.roomName || '').trim();
            if (roomName) return roomName;
            if (roomId > 0) return `Room #${roomId}`;
            return '';
        }

        function getSessionRoomInstrumentLabel(event) {
            if (!event) return '';
            const roomLabel = getSessionRoomDisplayLabel(event);
            const instrumentName = String(event.instrumentName || '').trim();
            if (roomLabel && instrumentName) {
                return `${roomLabel} • ${instrumentName}`;
            }
            return roomLabel || instrumentName || '';
        }

        async function fetchBranchInstruments(branchId) {
            const response = await axios.get(`${baseApiUrl}/instruments.php?action=get-instruments&branch_id=${encodeURIComponent(branchId)}`);
            const data = response?.data || {};
            if (!data.success) {
                throw new Error(data.error || 'Failed to load instruments.');
            }
            return data;
        }

        function renderSessionRoomControl(event) {
            if (!event || Number(event.sessionId || 0) < 1) {
                return '';
            }

            if (isEnrollmentFrozen(event)) {
                return '';
            }

            const roomLabel = getSessionRoomInstrumentLabel(event);
            if (roomLabel) {
                return `
                    <span class="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800">
                        <i class="fas fa-door-closed"></i>
                        ${escapeHtml(roomLabel)}
                    </span>
                `;
            }

            return `
                <button type="button" class="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-200 transition" onclick="openAttendanceRoomAssignment(${Number(event.sessionId)})">
                    <i class="fas fa-door-open"></i>
                    Assign Room
                </button>
            `;
        }

        async function fetchSessionAvailableRooms(sessionId) {
            const response = await axios.get(`${baseApiUrl}/attendance.php?action=get-session-available-rooms&session_id=${encodeURIComponent(sessionId)}`);
            const data = response?.data || {};
            if (!data.success) {
                throw new Error(data.error || 'Failed to load available rooms.');
            }
            return data;
        }

        async function openAttendanceRoomAssignment(sessionId) {
            const event = attendanceCalendarEvents.find(item => Number(item.sessionId || 0) === Number(sessionId));
            if (!event) {
                showMessage('Scheduled session not found.', 'error');
                return;
            }
            if (isEnrollmentFrozen(event)) {
                showMessage('Frozen accounts cannot be assigned a room until the freeze is cleared.', 'error');
                return;
            }

            try {
                const [roomData, instrumentData] = await Promise.all([
                    fetchSessionAvailableRooms(sessionId),
                    fetchBranchInstruments(Number(event.branchId || deskBranchId || 0))
                ]);
                const rooms = Array.isArray(roomData.rooms) ? roomData.rooms : [];
                const branchInstruments = Array.isArray(instrumentData.instruments) ? instrumentData.instruments : [];
                const allowedInstrumentTypes = Array.isArray(roomData.session?.allowed_instrument_types)
                    ? roomData.session.allowed_instrument_types
                    : [];
                const allowedInstrumentTypeIds = new Set(
                    allowedInstrumentTypes.map(type => Number(type.type_id || 0)).filter(typeId => typeId > 0)
                );
                const instruments = allowedInstrumentTypeIds.size
                    ? branchInstruments.filter(item => allowedInstrumentTypeIds.has(Number(item.type_id || 0)))
                    : branchInstruments;
                const unavailableRooms = Array.isArray(roomData.unavailable_rooms) ? roomData.unavailable_rooms : [];
                if (!rooms.length) {
                    const message = unavailableRooms.length
                        ? 'All rooms are already booked for this date and time.'
                        : 'No available rooms found for this branch.';
                    showMessage(message, 'error');
                    return;
                }
                if (!instruments.length) {
                    const selectedTypes = allowedInstrumentTypes.map(type => type.type_name).filter(Boolean).join(', ');
                    showMessage(selectedTypes
                        ? `No ${selectedTypes} instruments are available in this branch.`
                        : 'No available instruments found for this branch.', 'error');
                    return;
                }

                const scheduleDate = event.dateKey ? formatDateShort(event.dateKey) : '';
                const scheduleTime = event.startTime
                    ? `${formatTime12Hour(event.startTime)} - ${formatTime12Hour(event.endTime)}`
                    : 'Time pending';
                const scheduleLabel = scheduleDate ? `${scheduleDate} • ${scheduleTime}` : scheduleTime;

                const roomOptionsHtml = rooms.map(room => `
                    <option value="${escapeHtml(String(room.room_id || ''))}">${escapeHtml(room.room_name || `Room #${room.room_id}`)}</option>
                `).join('');
                const instrumentsByType = instruments.reduce((groups, item) => {
                    const typeName = String(item.type_name || 'Other').trim() || 'Other';
                    if (!groups[typeName]) groups[typeName] = [];
                    groups[typeName].push(item);
                    return groups;
                }, {});
                const instrumentOptionsHtml = Object.entries(instrumentsByType).map(([typeName, items]) => `
                    <optgroup label="${escapeHtml(typeName)}">
                        ${items.map(item => `<option value="${escapeHtml(String(item.instrument_id || ''))}">${escapeHtml(item.instrument_name || 'Instrument')}</option>`).join('')}
                    </optgroup>
                `).join('');
                const allowedTypesLabel = allowedInstrumentTypes.map(type => type.type_name).filter(Boolean).join(', ');

                const result = await Swal.fire({
                    title: 'Assign Room & Instrument',
                    html: `
                        <div class="text-left space-y-4">
                            <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                                <div class="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Session</div>
                                <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(event.studentName)}</div>
                                <div class="mt-1 text-xs text-slate-500">${escapeHtml(scheduleLabel)}</div>
                            </div>
                            <div>
                                <label class="mb-1 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Room</label>
                                <select id="attendanceRoomSelect" class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20">
                                    <option value="">Choose a room</option>
                                    ${roomOptionsHtml}
                                </select>
                            </div>
                            <div>
                                <label class="mb-1 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Instrument</label>
                                <select id="attendanceInstrumentSelect" class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20">
                                    <option value="">Choose an instrument</option>
                                    ${instrumentOptionsHtml}
                                </select>
                                <p class="mt-1 text-xs text-slate-500">Showing ${escapeHtml(allowedTypesLabel || 'the student\'s selected instrument types')} only.</p>
                            </div>
                            <div id="attendanceRoomAssignPreview" class="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                                Select a room and instrument to continue.
                            </div>
                        </div>
                    `,
                    showCancelButton: true,
                    confirmButtonText: 'Assign Room & Instrument',
                    confirmButtonColor: '#16a34a',
                    focusConfirm: false,
                    preConfirm: () => {
                        const popup = Swal.getPopup();
                        const selectedRoomId = Number(popup?.querySelector('#attendanceRoomSelect')?.value || 0);
                        const selectedInstrumentId = Number(popup?.querySelector('#attendanceInstrumentSelect')?.value || instruments[0]?.instrument_id || 0);
                        if (!selectedRoomId) {
                            Swal.showValidationMessage('Please choose a room.');
                            return false;
                        }
                        if (!selectedInstrumentId) {
                            Swal.showValidationMessage('No instrument is available for this branch.');
                            return false;
                        }
                        return { roomId: selectedRoomId, instrumentId: selectedInstrumentId };
                    },
                    didOpen: () => {
                        const popup = Swal.getPopup();
                        if (!popup) return;
                        const roomSelect = popup.querySelector('#attendanceRoomSelect');
                        const instrumentSelect = popup.querySelector('#attendanceInstrumentSelect');
                        const preview = popup.querySelector('#attendanceRoomAssignPreview');
                        if (roomSelect && !roomSelect.value && roomSelect.options.length > 1) {
                            roomSelect.value = roomSelect.options[1].value;
                        }
                        if (instrumentSelect && !instrumentSelect.value && instrumentSelect.options.length > 1) {
                            instrumentSelect.value = instrumentSelect.options[1].value;
                        }
                        const updatePreview = () => {
                            const roomLabel = roomSelect?.selectedOptions?.[0]?.textContent?.trim() || '';
                            const instrumentLabel = instrumentSelect?.selectedOptions?.[0]?.textContent?.trim() || '';
                            if (preview) {
                                preview.textContent = roomLabel && instrumentLabel
                                    ? `${roomLabel} • ${instrumentLabel}`
                                    : 'Select a room and instrument to continue.';
                            }
                        };
                        roomSelect?.addEventListener('change', updatePreview);
                        instrumentSelect?.addEventListener('change', updatePreview);
                        updatePreview();
                    }
                });
                if (!result.isConfirmed) return;

                const response = await axios.post(`${baseApiUrl}/attendance.php?action=assign-session-room`, {
                    session_id: Number(sessionId),
                    room_id: Number(result.value?.roomId || 0),
                    instrument_id: Number(result.value?.instrumentId || 0),
                    branch_id: Number(event.branchId || deskBranchId || 0)
                });
                const data = response.data || {};
                if (!data.success) {
                    showMessage(data.error || 'Failed to assign room.', 'error');
                    return;
                }

                const assignedRoomName = String(data.room_name || '').trim()
                    || (rooms.find(room => Number(room.room_id) === Number(result.value?.roomId))?.room_name || '')
                    || `Room #${Number(result.value?.roomId)}`;
                const assignedInstrumentName = String(data.instrument_name || '').trim()
                    || (instruments.find(item => Number(item.instrument_id) === Number(result.value?.instrumentId))?.instrument_name || '')
                    || 'Instrument';
                event.roomId = Number(data.room_id || result.value?.roomId || 0);
                event.roomName = assignedRoomName;
                event.instrumentId = Number(data.instrument_id || result.value?.instrumentId || 0);
                event.instrumentName = assignedInstrumentName;
                renderSelectedDateSchedule();
                renderAttendanceCalendar();

                showMessage(data.message || 'Room assigned successfully.', 'success');
                await loadAttendanceRows(true);
            } catch (error) {
                showMessage(error?.response?.data?.error || 'Failed to assign room.', 'error');
            }
        }

        function openAttendanceRoomTrackerModal() {
            const modal = document.getElementById('attendanceRoomTrackerModal');
            if (!modal) return;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            document.body.classList.add('overflow-hidden');
            attendanceRoomTrackerModalOpen = true;
            if (typeof loadBranchRoomOccupancy === 'function') {
                loadBranchRoomOccupancy();
            }
        }

        function closeAttendanceRoomTrackerModal() {
            const modal = document.getElementById('attendanceRoomTrackerModal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            document.body.classList.remove('overflow-hidden');
            attendanceRoomTrackerModalOpen = false;
        }

        async function fetchDeskGuardianAbsenceRequests(status = 'Pending') {
            const url = `${baseApiUrl}/attendance.php?action=desk-guardian-absence-list&branch_id=${encodeURIComponent(deskBranchId || '')}&status=${encodeURIComponent(status)}`;
            const response = await axios.get(url);
            return response.data;
        }

        async function updateDeskGuardianAbsenceRequestStatus(requestId, status, reviewedNotes = '') {
            const payload = {
                request_id: requestId,
                status,
                reviewed_by_user_id: Number(Auth.getUser()?.user_id || 0),
                reviewed_notes: reviewedNotes
            };
            const response = await axios.post(`${baseApiUrl}/attendance.php?action=guardian-absence-update-status`, payload);
            return response.data;
        }

        function renderDeskGuardianAbsenceStatus(status) {
            const value = String(status || 'Pending');
            const normalized = value.toLowerCase();
            const cls = normalized === 'approved'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : normalized === 'declined'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : normalized === 'reviewed'
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700';
            return `<span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${cls}">${escapeHtml(value)}</span>`;
        }

        function renderDeskGuardianAbsenceRequestsList(items) {
            const rows = Array.isArray(items) ? items : [];
            if (!rows.length) {
                return `
                    <div class="rounded-3xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                        No pending guardian absence requests for this branch.
                    </div>
                `;
            }

            return rows.map((row) => `
                <div class="rounded-3xl border border-slate-200 bg-white p-5">
                    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div class="text-xs uppercase tracking-[0.2em] text-slate-400 font-bold">Student</div>
                            <div class="mt-2 text-lg font-black text-slate-900">${escapeHtml(row.student_name || 'Student')}</div>
                            <div class="mt-1 text-sm text-slate-500">${escapeHtml(row.guardian_name || 'Guardian')} • ${escapeHtml(row.branch_name || deskBranchName || 'Branch')}</div>
                        </div>
                        ${renderDeskGuardianAbsenceStatus(row.status)}
                    </div>
                    <div class="mt-4 grid gap-3 md:grid-cols-3 text-sm">
                        <div class="rounded-2xl bg-slate-50 p-4">
                            <div class="text-xs uppercase tracking-[0.16em] text-slate-400 font-bold">Session Date</div>
                            <div class="mt-2 font-semibold text-slate-900">${escapeHtml(formatDateLong(row.session_date || ''))}</div>
                        </div>
                        <div class="rounded-2xl bg-slate-50 p-4">
                            <div class="text-xs uppercase tracking-[0.16em] text-slate-400 font-bold">Reason</div>
                            <div class="mt-2 font-semibold text-slate-900">${escapeHtml(row.reason || '—')}</div>
                        </div>
                        <div class="rounded-2xl bg-slate-50 p-4">
                            <div class="text-xs uppercase tracking-[0.16em] text-slate-400 font-bold">Submitted</div>
                            <div class="mt-2 font-semibold text-slate-900">${escapeHtml(row.created_at ? new Date(row.created_at).toLocaleString() : '—')}</div>
                        </div>
                    </div>
                    <div class="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                        ${escapeHtml(row.notes || 'No additional notes from guardian.')}
                    </div>
                    <div class="mt-4 flex flex-wrap items-center gap-2">
                        <button type="button" class="guardian-absence-action inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition" data-request-id="${Number(row.request_id || 0)}" data-status="Reviewed">
                            <i class="fas fa-eye"></i>
                            Mark Reviewed
                        </button>
                        <button type="button" class="guardian-absence-action inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition" data-request-id="${Number(row.request_id || 0)}" data-status="Approved">
                            <i class="fas fa-check"></i>
                            Approve
                        </button>
                        <button type="button" class="guardian-absence-action inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition" data-request-id="${Number(row.request_id || 0)}" data-status="Declined">
                            <i class="fas fa-xmark"></i>
                            Decline
                        </button>
                    </div>
                </div>
            `).join('');
        }

        async function refreshDeskGuardianAbsenceCount() {
            try {
                const data = await fetchDeskGuardianAbsenceRequests('Pending');
                deskGuardianAbsenceRequests = Array.isArray(data?.requests) ? data.requests : [];
                const countEl = document.getElementById('attendanceGuardianAbsenceCount');
                if (countEl) countEl.textContent = String(deskGuardianAbsenceRequests.length);
            } catch (error) {
                const countEl = document.getElementById('attendanceGuardianAbsenceCount');
                if (countEl) countEl.textContent = '0';
            }
        }

        async function openDeskGuardianAbsenceModal() {
            try {
                const data = await fetchDeskGuardianAbsenceRequests('Pending');
                deskGuardianAbsenceRequests = Array.isArray(data?.requests) ? data.requests : [];

                await Swal.fire({
                    width: 980,
                    confirmButtonText: 'Close',
                    confirmButtonColor: '#b8860b',
                    title: 'Guardian Absence Notices',
                    html: `
                        <div class="text-left">
                            <div class="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                Desk staff can review excuses here before following the branch absence policy.
                            </div>
                            <div id="deskGuardianAbsenceRequestsList" class="space-y-4">${renderDeskGuardianAbsenceRequestsList(deskGuardianAbsenceRequests)}</div>
                        </div>
                    `,
                    didOpen: () => {
                        const container = Swal.getHtmlContainer();
                        if (!container) return;
                        if (container.dataset.guardianAbsenceBound === 'true') return;
                        container.dataset.guardianAbsenceBound = 'true';
                        container.addEventListener('click', async (event) => {
                            const button = event.target.closest('.guardian-absence-action');
                            if (!button) return;

                            const requestId = Number(button.getAttribute('data-request-id') || 0);
                            const status = String(button.getAttribute('data-status') || 'Reviewed');
                            try {
                                const notePrompt = await Swal.fire({
                                    title: `${status} absence request`,
                                    input: 'text',
                                    inputLabel: 'Desk notes',
                                    inputPlaceholder: 'Optional notes for the guardian record',
                                    showCancelButton: true,
                                    confirmButtonColor: '#b8860b'
                                });
                                if (!notePrompt.isConfirmed) return;

                                const result = await updateDeskGuardianAbsenceRequestStatus(requestId, status, notePrompt.value || '');
                                if (result?.success) {
                                    deskGuardianAbsenceRequests = deskGuardianAbsenceRequests.filter((row) => Number(row.request_id || 0) !== requestId);
                                    const listEl = document.getElementById('deskGuardianAbsenceRequestsList');
                                    if (listEl) {
                                        listEl.innerHTML = renderDeskGuardianAbsenceRequestsList(deskGuardianAbsenceRequests);
                                    }
                                    await refreshDeskGuardianAbsenceCount();
                                    showMessage(result.message || 'Absence request updated.', 'success');
                                } else {
                                    showMessage(result?.error || 'Failed to update absence request.', 'error');
                                }
                            } catch (error) {
                                showMessage(error?.response?.data?.error || 'Failed to update absence request.', 'error');
                            }
                        });
                    }
                });
            } catch (error) {
                showMessage(error?.response?.data?.error || 'Failed to load guardian absence notices.', 'error');
            }
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
                .filter(event => event.dateKey >= todayKey && !['Completed', 'Cancelled', 'Absent'].includes(event.state) && !isEnrollmentFrozen(event))
                .slice(0, 6);

            if (!upcoming.length) {
                listEl.innerHTML = `
                    <div class="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-300">
                        No upcoming sessions are scheduled for this branch yet.
                    </div>
                `;
                return;
            }

            listEl.innerHTML = upcoming.map(event => {
                const frozen = isEnrollmentFrozen(event);
                return `
                <button type="button" class="w-full rounded-2xl border ${frozen ? 'border-rose-400/40 bg-rose-900/20' : 'border-white/10 bg-white/5'} px-4 py-4 text-left hover:bg-white/10 transition" onclick="selectAttendanceCalendarDate('${escapeHtml(event.dateKey)}')">
                    <div class="flex items-center justify-between gap-3">
                        <div class="min-w-0">
                            <div class="text-sm font-semibold text-white">${escapeHtml(event.studentName)}</div>
                            <div class="mt-1 text-xs text-slate-400">${escapeHtml(event.packageName)} • ${escapeHtml(event.teacherName)}</div>
                            ${frozen ? `<div class="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-rose-300"><i class="fas fa-snowflake"></i> Frozen</div>` : ''}
                        </div>
                        <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStateClasses(event.state)}">${escapeHtml(event.state)}</span>
                    </div>
                    <div class="mt-3 text-sm text-slate-200">${escapeHtml(formatDateShort(event.dateKey))} • ${escapeHtml(event.startTime ? `${formatTime12Hour(event.startTime)} - ${formatTime12Hour(event.endTime)}` : 'Time pending')}</div>
                </button>
            `}).join('');
        }

        function openUpcomingSessionsModal() {
            const todayKey = getTodayDateKey();
            const upcoming = attendanceCalendarEvents
                .filter(event => event.dateKey >= todayKey && !['Completed', 'Cancelled', 'Absent'].includes(event.state) && !isEnrollmentFrozen(event))
                .slice(0, 12);

            const content = upcoming.length
                ? upcoming.map(event => {
                    const frozen = isEnrollmentFrozen(event);
                    return `
                    <button
                        type="button"
                        class="w-full rounded-2xl border ${frozen ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'} px-4 py-4 text-left hover:bg-slate-100 transition"
                        onclick="window.selectAttendanceCalendarDate('${escapeHtml(event.dateKey)}'); Swal.close();"
                    >
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <div class="text-sm font-bold text-slate-900">${escapeHtml(event.studentName)}</div>
                                <div class="mt-1 text-xs text-slate-500">${escapeHtml(event.packageName)} • ${escapeHtml(event.teacherName)}</div>
                                ${frozen ? `<div class="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-rose-600"><i class="fas fa-snowflake"></i> Frozen — ₱100 fee required</div>` : ''}
                            </div>
                            <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStateClasses(event.state)}">${escapeHtml(event.state)}</span>
                        </div>
                        <div class="mt-3 text-sm text-slate-700">${escapeHtml(formatDateShort(event.dateKey))} • ${escapeHtml(event.startTime ? `${formatTime12Hour(event.startTime)} - ${formatTime12Hour(event.endTime)}` : 'Time pending')}</div>
                    </button>
                `}).join('')
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

            const selectedEvents = getActiveEventsForDate(attendanceSelectedDate);
            const frozenEvents = getFrozenEventsForDate(attendanceSelectedDate);
            setCalendarText('attendanceSelectedDateLabel', formatDateShort(attendanceSelectedDate));
            titleEl.textContent = formatDateLong(attendanceSelectedDate);
            metaEl.textContent = selectedEvents.length
                ? `${selectedEvents.length} active session${selectedEvents.length === 1 ? '' : 's'} scheduled for this branch`
                : frozenEvents.length
                    ? 'No active sessions scheduled for this date. Frozen sessions are listed in the Frozen Accounts tab.'
                    : 'No sessions scheduled for this date.';

            if (!selectedEvents.length) {
                listEl.innerHTML = `
                    <div class="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                        ${frozenEvents.length
                            ? `No active student sessions were scheduled for ${formatDateLong(attendanceSelectedDate)}.`
                            : `No student sessions were scheduled for ${formatDateLong(attendanceSelectedDate)}.`}
                    </div>
                `;
                return;
            }

            listEl.innerHTML = selectedEvents.map(event => {
                const frozen = isEnrollmentFrozen(event);
                const frozenBanner = frozen
                    ? `<div class="mt-2 flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700">
                            <i class="fas fa-snowflake text-rose-400"></i>
                            Account Frozen — ₱100 reservation fee required to check in
                       </div>`
                    : '';
                return `
                <article class="rounded-xl border ${frozen ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-slate-50/70'} p-3 shadow-sm">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                        <div class="min-w-0">
                            <div class="text-base font-bold text-slate-900">${escapeHtml(event.studentName)}</div>
                            <div class="text-xs text-slate-500">${escapeHtml(event.email || 'No email on file')}</div>
                            ${frozenBanner}
                        </div>
                        <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStateClasses(event.state)}">${escapeHtml(event.state)}</span>
                    </div>
                    <div class="mt-2 grid gap-2 md:grid-cols-2">
                        <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <div class="text-[10px] uppercase tracking-[0.16em] text-slate-400 font-bold">Session</div>
                            <div class="mt-1 text-sm font-semibold text-slate-900">${event.startTime ? `${formatTime12Hour(event.startTime)} - ${formatTime12Hour(event.endTime)}` : 'Time pending'}</div>
                            <div class="mt-1 text-xs text-slate-500">Session ${event.sessionNumber || '—'} • ${escapeHtml(getSessionRoomDisplayLabel(event) || 'Room pending')}</div>
                        </div>
                        <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <div class="text-[10px] uppercase tracking-[0.16em] text-slate-400 font-bold">Teacher & Package</div>
                            <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(event.teacherName)}</div>
                            <div class="mt-1 text-xs text-slate-500">${escapeHtml(event.packageName)}</div>
                        </div>
                    </div>
                    <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div class="flex flex-wrap gap-2 text-xs">
                            <span class="rounded-full bg-white px-3 py-1 font-semibold text-slate-600 border border-slate-200">Completed ${event.completedCount}/${event.totalSessions || '—'}</span>
                            <span class="rounded-full bg-white px-3 py-1 font-semibold text-rose-600 border border-rose-100">Absences ${event.absences}</span>
                            <span class="rounded-full bg-white px-3 py-1 font-semibold text-amber-600 border border-amber-100">Remaining ${event.remainingCount}</span>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                            ${frozen
                                ? `<button type="button" class="inline-flex items-center gap-2 rounded-xl bg-rose-100 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-200 transition" onclick="showFrozenAttendanceAlert(${JSON.stringify({ usedAbsences: event.usedAbsences })})">
                                        <i class="fas fa-snowflake"></i>
                                        Account Frozen
                                   </button>`
                                : `<button type="button" class="inline-flex items-center gap-2 rounded-xl bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-200 transition" onclick="openAttendanceDetails(${Number(event.enrollmentId)})">
                                        <i class="fas fa-up-right-from-square"></i>
                                        View Attendance
                                   </button>`
                            }
                            ${renderSessionRoomControl(event)}
                        </div>
                    </div>
                </article>
            `}).join('') + '<div aria-hidden="true" class="h-2"></div>';
        }

        function getDayScheduleModalMarkup(dateKey) {
            const selectedEvents = getActiveEventsForDate(dateKey);
            const frozenEvents = getFrozenEventsForDate(dateKey);

            if (!selectedEvents.length) {
                return `
                    <div class="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                        ${frozenEvents.length
                            ? `No active students are scheduled for ${escapeHtml(formatDateLong(dateKey))}.`
                            : `No students are scheduled for ${escapeHtml(formatDateLong(dateKey))}.`}
                    </div>
                `;
            }

            return selectedEvents.map(event => {
                const frozen = isEnrollmentFrozen(event);
                const frozenBanner = frozen
                    ? `<div class="mt-2 flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700">
                            <i class="fas fa-snowflake text-rose-400"></i>
                            Account Frozen — ₱100 reservation fee required to check in
                       </div>`
                    : '';
                return `
                <article class="rounded-3xl border ${frozen ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-slate-50/80'} p-4 shadow-sm">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0">
                            <div class="text-base font-bold text-slate-900">${escapeHtml(event.studentName)}</div>
                            <div class="mt-1 text-xs text-slate-500">${escapeHtml(event.email || 'No email on file')}</div>
                            ${frozenBanner}
                        </div>
                        <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStateClasses(event.state)}">${escapeHtml(event.state)}</span>
                    </div>
                    <div class="mt-3 grid gap-3 md:grid-cols-2">
                        <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div class="text-[11px] uppercase tracking-[0.2em] text-slate-400 font-bold">Schedule</div>
                            <div class="mt-2 text-sm font-semibold text-slate-900">${event.startTime ? `${formatTime12Hour(event.startTime)} - ${formatTime12Hour(event.endTime)}` : 'Time pending'}</div>
                            <div class="mt-1 text-xs text-slate-500">${escapeHtml(getSessionRoomDisplayLabel(event) || 'Room pending')} • Session ${event.sessionNumber || '—'}</div>
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
                        <div class="flex flex-wrap items-center gap-2">
                            ${frozen
                                ? `<button type="button" class="inline-flex items-center gap-2 rounded-xl bg-rose-100 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-200 transition" onclick="showFrozenAttendanceAlert(${JSON.stringify({ usedAbsences: event.usedAbsences })})">
                                        <i class="fas fa-snowflake"></i>
                                        Account Frozen
                                   </button>`
                                : `<button type="button" class="inline-flex items-center gap-2 rounded-xl bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-200 transition" onclick="openAttendanceDetails(${Number(event.enrollmentId)})">
                                        <i class="fas fa-up-right-from-square"></i>
                                        View Attendance
                                   </button>`
                            }
                            ${renderSessionRoomControl(event)}
                        </div>
                    </div>
                </article>
            `}).join('');
        }

        function openAttendanceDayModal(dateKey) {
            attendanceSelectedDate = dateKey;
            if (getMonthKeyFromDate(dateKey) !== attendanceCalendarMonth) {
                attendanceCalendarMonth = getMonthKeyFromDate(dateKey);
            }
            renderAttendanceCalendar();
            renderSelectedDateSchedule();

            const selectedEvents = getActiveEventsForDate(dateKey);
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
                    <button type="button" onclick="selectAttendanceCalendarDate('${escapeHtml(dateKey)}')" aria-label="View schedule for ${escapeHtml(formatDateLong(dateKey))}" aria-pressed="${isSelected ? 'true' : 'false'}" class="attendance-calendar-cell rounded-lg border px-2 py-1.5 text-left transition ${isSelected ? 'border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-200' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'} ${!isCurrentMonth ? 'opacity-45' : ''}">
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-sm font-bold ${isToday ? 'text-blue-700' : 'text-slate-800'}">${current.getDate()}</span>
                            ${isToday ? '<span class="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">Today</span>' : ''}
                        </div>
                        <div class="attendance-event-preview mt-1 space-y-1">
                            ${dayEvents.slice(0, 2).map(event => `
                                <div class="truncate rounded-lg px-2 py-1 text-[10px] font-semibold ${getStateClasses(event.state)}">
                                    ${escapeHtml(event.startTime ? formatTime12Hour(event.startTime) : 'Time')} • ${escapeHtml(event.studentName)}
                                </div>
                            `).join('')}
                            ${dayEvents.length > 2 ? `<div class="text-[10px] font-semibold text-slate-500">+${dayEvents.length - 2} more</div>` : ''}
                            ${!dayEvents.length ? '<div class="text-[10px] text-slate-400">No sessions</div>' : ''}
                        </div>
                        <div class="attendance-event-count mt-1 hidden text-[10px] font-semibold ${dayEvents.length ? 'text-blue-700' : 'text-slate-400'}">
                            ${dayEvents.length ? `${dayEvents.length} session${dayEvents.length === 1 ? '' : 's'}` : 'No sessions'}
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
            renderFrozenAccountsPanel();
            renderUpcomingSessions();
        }

        function selectAttendanceCalendarDate(dateKey) {
            attendanceSelectedDate = dateKey;
            if (getMonthKeyFromDate(dateKey) !== attendanceCalendarMonth) {
                attendanceCalendarMonth = getMonthKeyFromDate(dateKey);
            }
            renderAttendanceCalendar();
            renderSelectedDateSchedule();
            renderFrozenAccountsPanel();
        }

        function isEnrollmentFrozen(event) {
            const status = String(event.scheduleStatus || '').toLowerCase();
            const freezePaymentStatus = String(event.freezePaymentStatus || 'None').toLowerCase();
            return status === 'frozen' && freezePaymentStatus !== 'paid';
        }

        function showFrozenAttendanceAlert(event) {
            Swal.fire({
                title: 'Attendance Not Allowed Today',
                text: `Attendance is locked because this schedule is frozen after ${event.usedAbsences} recorded absence${event.usedAbsences === 1 ? '' : 's'}. Please pay ₱100 to reserve the slot before checking in.`,
                icon: 'warning',
                confirmButtonText: 'OK',
                confirmButtonColor: '#b8860b'
            });
        }

        async function deskWalkinFreezePayment(enrollmentId, studentId) {
            const student = attendanceRows.find(row => Number(row.enrollment_id || 0) === Number(enrollmentId))
                || attendanceRows.find(row => Number(row.student_id || 0) === Number(studentId));
            if (!student) {
                showMessage('Frozen account not found.', 'error');
                return;
            }

            const studentName = `${String(student.first_name || '').trim()} ${String(student.last_name || '').trim()}`.trim() || 'Student';
            const amount = Number(student.reservation_fee_amount || 100) || 100;
            const usedAbsences = Number(student.used_absences || 0);
            const status = String(student.freeze_payment_status || 'None').trim();

            if (status.toLowerCase() === 'paid') {
                showMessage('This frozen account has already been paid.', 'success');
                return;
            }

            const result = await Swal.fire({
                title: 'Walk-In Freeze Payment',
                width: 620,
                showCancelButton: true,
                confirmButtonText: 'Confirm Payment',
                confirmButtonColor: '#16a34a',
                cancelButtonText: 'Cancel',
                html: `
                    <div class="text-left space-y-4">
                        <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                            <div class="text-xs font-bold uppercase tracking-[0.2em] text-rose-600">Frozen Account</div>
                            <div class="mt-1 text-base font-bold text-slate-900">${escapeHtml(studentName)}</div>
                            <div class="mt-1 text-sm text-slate-600">${escapeHtml(student.package_name || '—')}</div>
                            <div class="mt-2 text-sm font-semibold text-rose-700">${usedAbsences} absence${usedAbsences === 1 ? '' : 's'} recorded</div>
                        </div>
                        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Payment</div>
                            <div class="mt-1 text-sm text-slate-700">This will record a walk-in payment of <span class="font-bold text-slate-900">₱${amount.toFixed(2)}</span> and immediately unfreeze the account.</div>
                        </div>
                        <div>
                            <label class="mb-1 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Payment Method</label>
                            <select id="freezeWalkinPaymentMethod" class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20">
                                <option value="Cash" selected>Cash</option>
                                <option value="GCash">GCash</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div class="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                            Tip: this is for desk-confirmed, in-person payment only.
                        </div>
                    </div>
                `,
                preConfirm: async () => {
                    const popup = Swal.getPopup();
                    const paymentMethod = String(popup?.querySelector('#freezeWalkinPaymentMethod')?.value || 'Cash').trim() || 'Cash';
                    try {
                        const payload = new FormData();
                        payload.append('enrollment_id', String(enrollmentId));
                        payload.append('student_id', String(studentId));
                        payload.append('payment_method', paymentMethod);
                        payload.append('reference_number', '');
                        payload.append('source', 'walkin');
                        payload.append('notes', 'Desk walk-in freeze payment');
                        const response = await axios.post(`${baseApiUrl}/students.php?action=submit-freeze-payment`, payload);
                        const data = response.data || {};
                        if (!data.success) {
                            Swal.showValidationMessage(data.error || 'Payment could not be recorded.');
                            return false;
                        }
                        return data;
                    } catch (error) {
                        Swal.showValidationMessage(error?.response?.data?.error || 'Failed to record walk-in payment.');
                        return false;
                    }
                }
            });

            if (!result.isConfirmed || !result.value) {
                return;
            }

            showMessage(result.value.message || 'Payment confirmed. Account has been unfrozen.', 'success');
            await loadAttendanceRows(true);
        }

        let activeDayScheduleTab = 'scheduled';

        function switchDayScheduleTab(tab) {
            activeDayScheduleTab = tab;
            const scheduledList = document.getElementById('attendanceSelectedDateList');
            const frozenList    = document.getElementById('frozenAccountsDayList');
            const tabScheduled  = document.getElementById('dayScheduleTabScheduled');
            const tabFrozen     = document.getElementById('dayScheduleTabFrozen');

            const activeScheduledCls = 'day-schedule-tab inline-flex items-center gap-1.5 rounded-full border border-slate-900 bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white transition';
            const inactiveScheduledCls = 'day-schedule-tab inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition';
            const activeFrozenCls    = 'day-schedule-tab inline-flex items-center gap-1.5 rounded-full border border-rose-500 bg-rose-500 px-3.5 py-1.5 text-xs font-bold text-white transition';
            const inactiveFrozenCls  = 'day-schedule-tab inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition';

            if (tab === 'scheduled') {
                if (scheduledList) scheduledList.classList.remove('hidden');
                if (frozenList)    frozenList.classList.add('hidden');
                if (tabScheduled)  tabScheduled.className = activeScheduledCls;
                if (tabFrozen)     tabFrozen.className    = inactiveFrozenCls;
            } else {
                if (scheduledList) scheduledList.classList.add('hidden');
                if (frozenList)    frozenList.classList.remove('hidden');
                if (tabScheduled)  tabScheduled.className = inactiveScheduledCls;
                if (tabFrozen)     tabFrozen.className    = activeFrozenCls;
                renderFrozenAccountsDayList();
            }
        }

        function renderFrozenAccountsDayList() {
            const listEl      = document.getElementById('frozenAccountsDayList');
            const countBadge  = document.getElementById('dayScheduleFrozenCount');
            if (!listEl) return;

            const todayKey = getTodayDateKey();
            // Get events scheduled for the currently selected date that belong to frozen students
            const frozenTodayEvents = getEventsForDate(attendanceSelectedDate).filter(event => isEnrollmentFrozen(event));

            // Update count badge on tab
            if (countBadge) {
                if (frozenTodayEvents.length) {
                    countBadge.textContent = String(frozenTodayEvents.length);
                    countBadge.classList.remove('hidden');
                } else {
                    countBadge.classList.add('hidden');
                }
            }

            if (!frozenTodayEvents.length) {
                listEl.innerHTML = `
                    <div class="rounded-2xl border border-dashed border-rose-200 px-4 py-10 text-center text-sm text-rose-400">
                        <i class="fas fa-snowflake text-2xl text-rose-200 block mb-3"></i>
                        No frozen accounts are scheduled for ${escapeHtml(formatDateLong(attendanceSelectedDate))}.
                    </div>`;
                return;
            }

            // Render using the same card style as the scheduled list — frozen card variant
            listEl.innerHTML = frozenTodayEvents.map(event => `
                <article class="rounded-3xl border border-rose-200 bg-rose-50/40 p-3.5 shadow-sm">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0">
                            <div class="text-lg font-bold text-slate-900">${escapeHtml(event.studentName)}</div>
                            <div class="mt-1 text-sm text-slate-500">${escapeHtml(event.email || 'No email on file')}</div>
                            <div class="mt-2 flex items-center gap-1.5 rounded-xl bg-rose-100 border border-rose-200 px-3 py-1.5 w-fit text-xs font-semibold text-rose-700">
                                <i class="fas fa-snowflake text-rose-400"></i>
                                Account Frozen — ₱100 reservation fee required
                            </div>
                        </div>
                        <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStateClasses(event.state)}">${escapeHtml(event.state)}</span>
                    </div>
                    <div class="mt-3 grid gap-3 md:grid-cols-2">
                        <div class="rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
                            <div class="text-[11px] uppercase tracking-[0.2em] text-slate-400 font-bold">Session</div>
                            <div class="mt-2 text-sm font-semibold text-slate-900">${event.startTime ? `${formatTime12Hour(event.startTime)} - ${formatTime12Hour(event.endTime)}` : 'Time pending'}</div>
                            <div class="mt-1 text-xs text-slate-500">Session ${event.sessionNumber || '—'} • ${escapeHtml(getSessionRoomDisplayLabel(event) || 'Room pending')}</div>
                        </div>
                        <div class="rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
                            <div class="text-[11px] uppercase tracking-[0.2em] text-slate-400 font-bold">Teacher & Package</div>
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
                        <div class="flex flex-wrap items-center gap-2">
                            <button type="button"
                                class="inline-flex items-center gap-2 rounded-xl bg-rose-100 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-200 transition"
                                onclick="showFrozenAttendanceAlert(${JSON.stringify({ usedAbsences: event.usedAbsences })})">
                                <i class="fas fa-snowflake"></i> Account Frozen
                            </button>
                            <button type="button"
                                class="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-200 transition"
                                onclick="deskWalkinFreezePayment(${event.enrollmentId}, ${event.studentId})">
                                <i class="fas fa-money-bill text-sm"></i> Walk-In Pay ₱100
                            </button>
                            ${renderSessionRoomControl(event)}
                        </div>
                    </div>
                </article>
            `).join('') + '<div aria-hidden="true" class="h-2"></div>';
        }

        function renderFrozenAccountsPanel() {
            // Update the frozen tab count badge whenever data reloads
            const todayFrozen = getEventsForDate(attendanceSelectedDate).filter(event => isEnrollmentFrozen(event));
            const countBadge  = document.getElementById('dayScheduleFrozenCount');
            if (countBadge) {
                if (todayFrozen.length) {
                    countBadge.textContent = String(todayFrozen.length);
                    countBadge.classList.remove('hidden');
                } else {
                    countBadge.classList.add('hidden');
                }
            }
            // If currently on the frozen tab, re-render it
            if (activeDayScheduleTab === 'frozen') {
                renderFrozenAccountsDayList();
            }
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
                    const instrumentText = slot.instrument_name ? escapeHtml(slot.instrument_name) : '';
                    const scheduleMeta = [
                        roomText,
                        instrumentText ? `<span class="mx-1 text-slate-300">•</span> ${instrumentText}` : ''
                    ].join('');
                    return `
                        <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <div class="text-sm font-semibold text-slate-900">${escapeHtml(dateText)}</div>
                            <div class="mt-1 text-xs text-slate-600">${escapeHtml(timeText)} <span class="mx-1 text-slate-300">•</span> ${scheduleMeta}</div>
                        </div>
                    `;
                }).join('')
                : '<div class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">No upcoming sessions scheduled yet.</div>';

            Swal.fire({
                title: `${studentName} Sessions`,
                width: 600,
                confirmButtonText: 'Close',
                html: `
                    <div class="text-left px-1 pb-1">
                        <div class="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                            <div class="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Package</div>
                            <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(student.package_name || '—')}</div>
                        </div>
                        <div class="mb-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                            <div class="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Teachers</div>
                            <div class="mt-2 space-y-2">${renderTeacherPackageSummary(student)}</div>
                        </div>
                        <div class="space-y-2 max-h-[46vh] overflow-y-auto pr-1">${content}</div>
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

            const isFrozen = String(student.schedule_status || '').toLowerCase() === 'frozen'
                && String(student.freeze_payment_status || 'None').toLowerCase() !== 'paid';
            const usedAbsences = Number(student.used_absences || 0);

            // If frozen, show the blocked alert instead of the details modal
            if (isFrozen) {
                showFrozenAttendanceAlert({ usedAbsences });
                return;
            }

            const sessionsList = Array.isArray(student.sessions_list) ? student.sessions_list : [];
            const totalSessions = Number(student.sessions || 0);
            const absenceCount = getAbsenceCount(student);
            const nextSessionLabel = getNextSessionLabel(student);
            const rows = [];
            const teacherRows = buildTeacherPackageSummary(student);
            const teacherSummaryHtml = teacherRows.length
                ? teacherRows.map(row => `<span class="inline-flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"><i class="fas fa-user-tie text-gold-500"></i><strong class="truncate text-slate-800">${escapeHtml(row.teacherName)}</strong><span class="hidden text-slate-400 sm:inline">${escapeHtml(row.packageText)}</span></span>`).join('')
                : '<span class="text-xs text-slate-500">No instructor assigned yet.</span>';

            for (let sessionNumber = 1; sessionNumber <= totalSessions; sessionNumber += 1) {
                const slots = sessionsList.filter(slot => Number(slot.session_number) === sessionNumber);
                const slotHtml = slots.length
                    ? slots.map(slot => {
                        const dateText = slot.session_date ? formatDateShort(slot.session_date) : 'Unscheduled';
                        const timeText = slot.start_time ? `${formatTime12Hour(slot.start_time)} - ${formatTime12Hour(slot.end_time)}` : '—';
                        const roomText = slot.room_name ? escapeHtml(slot.room_name) : 'Room pending';
                        const instrumentText = slot.instrument_name ? escapeHtml(slot.instrument_name) : '';
                        const scheduleMeta = [
                            roomText,
                            instrumentText ? `<span class="mx-1 text-slate-300">•</span> ${instrumentText}` : ''
                        ].join('');
                        return `
                            <div class="min-w-0">
                                <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600"><span class="font-semibold text-slate-800">${escapeHtml(dateText)}</span><span>${escapeHtml(timeText)}</span>${getStatusBadge(slot.status)}</div>
                                <div class="mt-1 truncate text-[11px] text-slate-500">${scheduleMeta}</div>
                            </div>
                        `;
                    }).join('')
                    : '<div class="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-400">No date scheduled yet</div>';

                rows.push(`
                    <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <div class="mb-1.5 flex items-center justify-between gap-3">
                            <div class="text-xs font-black uppercase tracking-wide text-slate-700">Session ${sessionNumber}</div>
                            ${slots.length > 1 ? `<div class="text-[10px] text-slate-400">${slots.length} schedules</div>` : ''}
                        </div>
                        <div class="space-y-1.5">${slotHtml}</div>
                    </div>
                `);
            }

            Swal.fire({
                title: `${escapeHtml(student.first_name || '')} ${escapeHtml(student.last_name || '')}`.trim() || 'Attendance Details',
                width: 680,
                confirmButtonText: 'Close',
                customClass: { popup: 'attendance-details-compact' },
                html: `
                    <div class="text-left">
                        <div class="mb-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <div class="flex items-center gap-2">${getStatusBadge(student.status || 'Active')}<span class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Active Enrollment</span></div>
                                <div class="text-xs text-slate-500">Next: <strong class="text-slate-700">${escapeHtml(nextSessionLabel)}</strong></div>
                            </div>
                            <div class="mt-1.5 text-sm text-slate-600">
                                Package: <span class="font-semibold text-slate-900">${escapeHtml(student.package_name || '—')}</span>
                            </div>
                        </div>
                        <div class="mb-2.5 grid grid-cols-3 gap-2 text-sm">
                            <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
                                <div class="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Completed</div>
                                <div class="text-base font-black text-slate-900">${getCompletedCount(student)}<span class="text-xs font-semibold text-slate-400">/${Number(student.sessions || 0)}</span></div>
                            </div>
                            <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
                                <div class="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Remaining</div>
                                <div class="text-base font-black text-slate-900">${getRemainingCount(student)}</div>
                            </div>
                            <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
                                <div class="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Absences</div>
                                <div class="text-base font-black ${absenceCount > 0 ? 'text-rose-600' : 'text-slate-900'}">${absenceCount}</div>
                            </div>
                        </div>
                        <div class="mb-2.5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <span class="mr-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Instructors</span>${teacherSummaryHtml}
                        </div>
                        <div class="grid max-h-[46vh] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">${rows.join('')}</div>
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

        async function loadAttendanceRows(preserveSelection = false) {
            const previousDate = attendanceSelectedDate;
            const previousMonth = attendanceCalendarMonth;
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
                if (preserveSelection && previousDate) {
                    attendanceSelectedDate = previousDate;
                    attendanceCalendarMonth = previousMonth || getMonthKeyFromDate(previousDate);
                } else {
                    attendanceSelectedDate = getTodayDateKey();
                    attendanceCalendarMonth = getMonthKeyFromDate(attendanceSelectedDate);
                }
                updateAttendanceSummary(attendanceRows);
                renderFrozenAccountsPanel();
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
            if (typeof syncDeskNavUser === 'function') syncDeskNavUser();
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
            document.getElementById('attendanceOpenGuardianAbsenceBtn')?.addEventListener('click', openDeskGuardianAbsenceModal);
            document.getElementById('attendanceOpenRoomTrackerBtn')?.addEventListener('click', openAttendanceRoomTrackerModal);
            document.getElementById('attendanceCloseRoomTrackerBtn')?.addEventListener('click', closeAttendanceRoomTrackerModal);
            document.getElementById('attendanceRoomTrackerModal')?.addEventListener('click', (event) => {
                if (event.target?.id === 'attendanceRoomTrackerModal') {
                    closeAttendanceRoomTrackerModal();
                }
            });
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && attendanceRoomTrackerModalOpen) {
                    closeAttendanceRoomTrackerModal();
                }
            });

            await refreshDeskGuardianAbsenceCount();
            await loadAttendanceRows();
        });

        window.openAttendanceDetails = openAttendanceDetails;
        window.openAttendanceDayModal = openAttendanceDayModal;
        window.showFrozenAttendanceAlert = showFrozenAttendanceAlert;
        window.deskWalkinFreezePayment = deskWalkinFreezePayment;
        window.openFrozenAccountsModal = openFrozenAccountsModal;
        window.switchDayScheduleTab = switchDayScheduleTab;
        window.openUpcomingSessionsModal = openUpcomingSessionsModal;
        window.openMakeupSummaryModal = openMakeupSummaryModal;
        window.openSessionDatesModal = openSessionDatesModal;
        window.selectAttendanceCalendarDate = selectAttendanceCalendarDate;
        window.openAttendanceRoomAssignment = openAttendanceRoomAssignment;
