 let registrationScheduleRows = [];
        let registrationScheduleRoomsByBranch = {};

        function getManagerBranchId() {
            try {
                const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
                return Number(user?.branch_id || 0);
            } catch (_) {
                return 0;
            }
        }

        function formatDateShort(dateString) {
            if (!dateString) return '—';
            const date = new Date(dateString);
            if (Number.isNaN(date.getTime())) return String(dateString);
            return date.toLocaleDateString();
        }

        function getTodayInputDate() {
            const now = new Date();
            const offsetMs = now.getTimezoneOffset() * 60000;
            return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
        }

        function getSessionStatusBadge(status) {
            const normalized = String(status || '').toLowerCase();
            if (normalized === 'completed') return '<span class="inline-flex items-center px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold">Completed</span>';
            if (normalized === 'cancelled') return '<span class="inline-flex items-center px-2 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-semibold">Cancelled</span>';
            if (normalized === 'rescheduled') return '<span class="inline-flex items-center px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-semibold">Rescheduled</span>';
            if (normalized === 'scheduled') return '<span class="inline-flex items-center px-2 py-1 rounded-full bg-sky-100 text-sky-700 text-[11px] font-semibold">Scheduled</span>';
            return `<span class="inline-flex items-center px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">${escapeHtml(status || 'Unknown')}</span>`;
        }

        async function fetchRegistrationScheduleRows(forceRefresh = false) {
            if (!forceRefresh && registrationScheduleRows.length) return registrationScheduleRows;
            const branchId = getManagerBranchId();
            let url = `${baseApiUrl}/students.php?action=get-active-enrollments`;
            if (branchId > 0) url += `&branch_id=${encodeURIComponent(branchId)}`;
            const response = await axios.get(url);
            const data = response.data || {};
            registrationScheduleRows = data.success && Array.isArray(data.enrollments) ? data.enrollments : [];
            return registrationScheduleRows;
        }

        async function fetchRegistrationRoomsForBranch(branchId) {
            const key = Number(branchId || 0);
            if (key > 0 && Array.isArray(registrationScheduleRoomsByBranch[key])) {
                return registrationScheduleRoomsByBranch[key];
            }
            try {
                let url = `${baseApiUrl}/students.php?action=get-available-rooms`;
                if (key > 0) url += `&branch_id=${key}`;
                const response = await axios.get(url);
                const data = response.data || {};
                const rooms = data.success && Array.isArray(data.rooms) ? data.rooms : [];
                registrationScheduleRoomsByBranch[key] = rooms;
                return rooms;
            } catch (error) {
                console.error('Failed to load rooms:', error);
                return [];
            }
        }

        async function populateRegistrationScheduleRoomDropdown() {
            return;
        }

        async function openRegistrationScheduleModal(studentId, options = {}) {
            const rows = await fetchRegistrationScheduleRows();
            const row = rows.find(item => Number(item.student_id) === Number(studentId));
            if (!row) {
                showMessage('No active enrollment found for this student yet.', 'error');
                return;
            }
            openSessionScheduleModal(Number(row.enrollment_id), options);
        }

        function openSessionScheduleModal(enrollmentId, options = {}) {
            const modal = document.getElementById('scheduleModal');
            const body = document.getElementById('scheduleModalBody');
            const meta = document.getElementById('scheduleModalMeta');
            const hint = document.getElementById('nextSessionHint');
            const toggleBtn = document.getElementById('toggleAddScheduleBtn');
            const form = document.getElementById('addScheduleForm');
            const enrollmentInput = document.getElementById('scheduleEnrollmentId');
            const editExistingInput = document.getElementById('scheduleEditExisting');
            const sessionInput = document.getElementById('scheduleSessionNumber');
            const teacherInput = document.getElementById('scheduleTeacher');
            const teacherLabel = document.getElementById('scheduleTeacherLabel');
            if (!modal || !body || !meta) return;

            const row = registrationScheduleRows.find(r => Number(r.enrollment_id) === Number(enrollmentId));
            if (!row) {
                showMessage('Enrollment not found.', 'error');
                return;
            }

            const studentName = `${escapeHtml(row.first_name || '')} ${escapeHtml(row.last_name || '')}`.trim() || 'Student';
            meta.textContent = `${studentName} • ${escapeHtml(row.package_name || 'Package')} • ${Number(row.sessions || 0)} sessions`;

            const sessionsList = Array.isArray(row.sessions_list) ? row.sessions_list : [];
            const sessionsTotal = Number(row.sessions || 0);
            const rowsHtml = [];
            let nextUnscheduled = 0;
            const todayMs = new Date().setHours(0, 0, 0, 0);
            const roomText = row.assigned_room ? ` • ${escapeHtml(row.assigned_room)}` : '';
            if (sessionsTotal > 0) {
                for (let i = 1; i <= sessionsTotal; i += 1) {
                    const slotHistory = sessionsList.filter(s => Number(s.session_number) === i);
                    if (!slotHistory.length && nextUnscheduled === 0) nextUnscheduled = i;
                    const slotHtml = slotHistory.length
                        ? slotHistory.map(slot => {
                            const dateText = slot?.session_date ? formatDateShort(slot.session_date) : 'Unscheduled';
                            const slotTeacherName = slot?.teacher_first_name || slot?.teacher_last_name
                                ? `${escapeHtml(slot.teacher_first_name || '')} ${escapeHtml(slot.teacher_last_name || '')}`.trim()
                                : '';
                            const teacherText = slotTeacherName ? ` • ${slotTeacherName}` : '';
                            const normalizedStatus = String(slot?.status || '').toLowerCase();
                            const slotDateMs = slot?.session_date ? new Date(`${slot.session_date}T00:00:00`).setHours(0, 0, 0, 0) : NaN;
                            const editableThisSlot = normalizedStatus === 'scheduled' && !Number.isNaN(slotDateMs) && slotDateMs >= todayMs;
                            const editBtn = editableThisSlot
                                ? `<button type="button" class="edit-schedule-btn ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold shadow-sm transition" data-session-number="${i}" data-session-date="${escapeHtml(slot?.session_date || '')}" data-start-time="${escapeHtml(slot?.start_time || '09:00:00')}" data-end-time="${escapeHtml(slot?.end_time || '10:00:00')}"><i class="fas fa-pen"></i><span>Edit Schedule</span></button>`
                                : '';
                            const reasonText = slot?.cancellation_reason
                                ? `<div class="text-[11px] text-slate-500 mt-1">Reason: ${escapeHtml(slot.cancellation_reason)}</div>`
                                : '';
                            return `
                                <div class="rounded-lg border border-white/70 bg-white px-3 py-2">
                                    <div class="flex flex-wrap items-center gap-2">
                                        ${getSessionStatusBadge(slot.status)}
                                        <div>${escapeHtml(dateText)}${roomText}${teacherText}</div>
                                        ${editBtn}
                                    </div>
                                    ${reasonText}
                                </div>
                            `;
                        }).join('')
                        : '<div class="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-slate-400">Unscheduled</div>';
                    rowsHtml.push(`
                        <div class="rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                            <div class="font-semibold text-slate-700 mb-2">Session ${i}</div>
                            <div class="space-y-2">${slotHtml}</div>
                        </div>
                    `);
                }
            } else {
                rowsHtml.push('<div class="text-sm text-slate-500">No session count found for this package.</div>');
            }

            body.innerHTML = rowsHtml.join('');
            if (form) form.classList.add('hidden');
            if (enrollmentInput) enrollmentInput.value = String(enrollmentId);
            if (editExistingInput) editExistingInput.value = '0';
            if (sessionInput) sessionInput.value = String(nextUnscheduled || 1);
            const dateInput = document.getElementById('scheduleDate');
            const startInput = document.getElementById('scheduleStart');
            const endInput = document.getElementById('scheduleEnd');
            const saveBtn = document.getElementById('saveScheduleBtn');
            if (dateInput) dateInput.value = '';
            if (dateInput) dateInput.min = getTodayInputDate();
            if (startInput) startInput.value = '09:00';
            if (endInput) endInput.value = '10:00';
            if (saveBtn) saveBtn.textContent = 'Save Session';
            if (hint) {
                hint.textContent = nextUnscheduled
                    ? `Session ${nextUnscheduled} is the next open slot for this enrollment. Future scheduled sessions can also be edited here.`
                    : 'All session slots already have saved schedules. You can still edit future scheduled sessions here.';
            }
            if (toggleBtn) {
                toggleBtn.textContent = nextUnscheduled ? `Schedule Session ${nextUnscheduled}` : 'All Sessions Scheduled';
                toggleBtn.disabled = !nextUnscheduled;
                toggleBtn.classList.toggle('opacity-50', !nextUnscheduled);
                toggleBtn.classList.toggle('cursor-not-allowed', !nextUnscheduled);
            }

            const assignedTeacherName = `${escapeHtml(row.teacher_first_name || '')} ${escapeHtml(row.teacher_last_name || '')}`.trim() || 'No fixed teacher assigned';
            if (teacherInput) teacherInput.value = String(Number(row.assigned_teacher_id || 0));
            if (teacherLabel) teacherLabel.value = assignedTeacherName;

            const editButtons = Array.from(body.querySelectorAll('.edit-schedule-btn'));
            editButtons.forEach((btn) => {
                btn.addEventListener('click', async () => {
                    if (!form || !dateInput || !startInput || !endInput) return;
                    if (sessionInput) sessionInput.value = String(btn.dataset.sessionNumber || '');
                    if (editExistingInput) editExistingInput.value = '1';
                    dateInput.value = btn.dataset.sessionDate || '';
                    dateInput.min = getTodayInputDate();
                    startInput.value = (btn.dataset.startTime || '09:00:00').slice(0, 5);
                    endInput.value = (btn.dataset.endTime || '10:00:00').slice(0, 5);
                    if (saveBtn) saveBtn.textContent = `Update Session ${btn.dataset.sessionNumber || ''}`;
                    form.classList.remove('hidden');
                    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                });
            });

            modal.classList.remove('hidden');
            modal.classList.add('flex');

            if (options?.autoEditFirst) {
                const firstEditBtn = editButtons[0];
                if (firstEditBtn) {
                    firstEditBtn.click();
                } else if (nextUnscheduled && toggleBtn && !toggleBtn.disabled) {
                    toggleAddScheduleForm();
                } else {
                    showMessage('No editable future scheduled session was found for this student.', 'error');
                }
            }
        }

        async function openStudentReschedulePicker(sessionId, enrollmentId) {
            try {
                const response = await axios.get(`${baseApiUrl}/students.php?action=get-reschedule-slots&session_id=${encodeURIComponent(sessionId)}`);
                const data = response.data || {};
                const slots = Array.isArray(data.slots) ? data.slots : [];
                if (!data.success) {
                    showMessage(data.error || 'Failed to load available slots.', 'error');
                    return;
                }
                if (!slots.length) {
                    showMessage('No available slots found for this teacher right now.', 'error');
                    return;
                }
                const inputOptions = {};
                slots.forEach((slot, index) => {
                    inputOptions[String(index)] = `${formatDateShort(slot.session_date)} • ${slot.day_of_week} • ${formatTime12Hour(slot.start_time)} - ${formatTime12Hour(slot.end_time)}`;
                });
                const result = await Swal.fire({
                    icon: 'info',
                    title: 'Reschedule Student Session',
                    text: 'Use this when a student needs to move the class because of an emergency.',
                    input: 'select',
                    inputOptions,
                    inputPlaceholder: 'Select an available slot',
                    inputValue: '',
                    showCancelButton: true,
                    confirmButtonText: 'Reschedule',
                    cancelButtonText: 'Close',
                    confirmButtonColor: '#0ea5e9',
                    inputValidator: value => value === '' || value == null ? 'Please select a slot.' : null
                });
                if (!result.isConfirmed) return;
                const chosen = slots[Number(result.value)];
                if (!chosen) {
                    showMessage('Selected slot is invalid.', 'error');
                    return;
                }
                const saveRes = await axios.post(`${baseApiUrl}/students.php?action=reschedule-session`, {
                    session_id: sessionId,
                    session_date: chosen.session_date,
                    start_time: chosen.start_time,
                    end_time: chosen.end_time,
                    reason: 'Student emergency reschedule'
                });
                const saveData = saveRes.data || {};
                if (saveData.success) {
                    showMessage(saveData.message || 'Session rescheduled.', 'success');
                    await fetchRegistrationScheduleRows(true);
                    openSessionScheduleModal(Number(enrollmentId));
                } else {
                    showMessage(saveData.error || 'Failed to reschedule session.', 'error');
                }
            } catch (error) {
                showMessage('Network error while rescheduling session.', 'error');
            }
        }

        function closeScheduleModal() {
            const modal = document.getElementById('scheduleModal');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        }

        function toggleAddScheduleForm() {
            const form = document.getElementById('addScheduleForm');
            const toggleBtn = document.getElementById('toggleAddScheduleBtn');
            const editExistingInput = document.getElementById('scheduleEditExisting');
            const saveBtn = document.getElementById('saveScheduleBtn');
            if (!form || !toggleBtn || toggleBtn.disabled) return;
            if (editExistingInput) editExistingInput.value = '0';
            if (saveBtn) saveBtn.textContent = 'Save Session';
            form.classList.toggle('hidden');
        }

        async function submitAddScheduleForm(e) {
            e.preventDefault();
            const enrollmentId = Number(document.getElementById('scheduleEnrollmentId')?.value || 0);
            const sessionNumber = Number(document.getElementById('scheduleSessionNumber')?.value || 0);
            const sessionDate = document.getElementById('scheduleDate')?.value || '';
            const startTime = document.getElementById('scheduleStart')?.value || '';
            const endTime = document.getElementById('scheduleEnd')?.value || '';
            const teacherId = Number(document.getElementById('scheduleTeacher')?.value || 0);
            const editExisting = document.getElementById('scheduleEditExisting')?.value === '1';
            const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
            const editorRole = String(user?.role_name || '');

            if (!enrollmentId || !sessionNumber || !sessionDate) {
                showMessage('Please select a date before saving.', 'error');
                return;
            }

            try {
                const response = await axios.post(`${baseApiUrl}/students.php?action=schedule-session`, {
                    enrollment_id: enrollmentId,
                    session_number: sessionNumber,
                    session_date: sessionDate,
                    start_time: startTime,
                    end_time: endTime,
                    teacher_id: teacherId,
                    edit_existing: editExisting,
                    branch_id: getManagerBranchId() || undefined,
                    editor_role: editorRole || undefined
                });
                const data = response.data || {};
                if (data.success) {
                    showMessage(data.message || 'Session scheduled.', 'success');
                    await fetchRegistrationScheduleRows(true);
                    openSessionScheduleModal(enrollmentId);
                } else {
                    showMessage(data.error || 'Failed to schedule session.', 'error');
                }
            } catch (error) {
                const backendMessage = error?.response?.data?.error || error?.response?.data?.message || error?.message;
                showMessage(backendMessage || 'Network error. Please try again.', 'error');
            }
        }

        window.openRegistrationScheduleModal = openRegistrationScheduleModal;
        window.openRegistrationScheduleEditor = (studentId) => openRegistrationScheduleModal(studentId, { autoEditFirst: true });
        window.openSessionScheduleModal = openSessionScheduleModal;
        window.closeScheduleModal = closeScheduleModal;

        async function loadManagerPendingRegistrations() {
            const branchId = getManagerBranchId();
            let url = `${baseApiUrl}/admin.php?action=get-pending-registrations`;
            if (branchId > 0) url += `&branch_id=${encodeURIComponent(branchId)}`;
            const res = await axios.get(url);
            const data = res.data || {};
            const rows = Array.isArray(data.registrations)
                ? data.registrations.filter(reg => String(reg.registration_source || 'online').toLowerCase() !== 'walkin')
                : [];
            displayRegistrations(rows);
            updateStats(rows);
        }

        async function loadManagerActiveRegistrations() {
            const branchId = getManagerBranchId();
            let url = `${baseApiUrl}/admin.php?action=get-all-registrations`;
            if (branchId > 0) url += `&branch_id=${encodeURIComponent(branchId)}`;
            const res = await axios.get(url);
            const data = res.data || {};
            const rows = Array.isArray(data.registrations)
                ? data.registrations.filter(reg => {
                    const status = String(reg.registration_status || '').toLowerCase();
                    return status !== 'pending';
                })
                : [];
            displayRegistrations(rows);
            updateStats(rows);
        }

        function setActiveMode(mode) {
            const title = document.getElementById('tableTitle');
            const subtitle = document.getElementById('tableSubtitle');
            const btnPending = document.getElementById('btnPending');
            const btnActive = document.getElementById('btnActive');

            const activeBtnClass = 'px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-bold text-sm shadow-sm transition';
            const normalBtnClass = 'px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold text-sm transition';

            if (mode === 'active') {
                if (title) title.textContent = 'Active Registrations';
                if (btnActive) btnActive.className = activeBtnClass;
                if (btnPending) btnPending.className = normalBtnClass;
                loadManagerActiveRegistrations().catch(error => {
                    showMessage('Failed to load registrations: ' + (error.message || error), 'error');
                });
            } else {
                if (title) title.textContent = 'Pending Online Registrations';
                if (btnPending) btnPending.className = activeBtnClass;
                if (btnActive) btnActive.className = normalBtnClass;
                loadManagerPendingRegistrations().catch(error => {
                    showMessage('Failed to load registrations: ' + (error.message || error), 'error');
                });
            }
        }

        document.addEventListener('DOMContentLoaded', function() {
            const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
            const role = String(user?.role_name || '').toLowerCase();
            const deskRoles = ['staff', 'desk', 'front desk'];
            const managerRoles = ['manager', 'branch manager'];
            const isDeskRole = deskRoles.includes(role);
            const isManagerRole = managerRoles.includes(role);

            if (!user || (!isDeskRole && !isManagerRole)) {
                showMessage('Access denied. Desk/Manager only.', 'error');
                setTimeout(() => {
                    window.location.href = '../../index.html';
                }, 900);
                return;
            }

            const displayName = user.username || user.email || (isDeskRole ? 'Front Desk' : 'Manager');
            const branchName = user.branch_name || '—';
            const userNameNav = document.getElementById('userNameNav');
            const profileMenuName = document.getElementById('profileMenuName');
            const branchNameEl = document.getElementById('managerBranchName');
            const branchPill = document.getElementById('managerBranchNamePill');
            const sideTitle = document.getElementById('registrationSidePanelTitle');
            const logoLink = document.getElementById('deskOrManagerLogoLink');
            const dashLink = document.getElementById('navDashboardLink');

            if (userNameNav) userNameNav.textContent = displayName;
            if (profileMenuName) profileMenuName.textContent = displayName;
            if (branchNameEl) branchNameEl.textContent = branchName;
            if (branchPill) branchPill.textContent = branchName;
            if (sideTitle) sideTitle.textContent = isDeskRole ? 'Desk Panel' : 'Manager Panel';
            if (logoLink) logoLink.href = isDeskRole ? '../desk/desk_scanner.html' : 'manager_dashboard.html';
            if (dashLink) dashLink.href = isDeskRole ? '../desk/desk_scanner.html' : 'manager_dashboard.html';

            if (typeof initPaymentForm === 'function') {
                initPaymentForm();
            }

            const registerModal = document.getElementById('registerStudentModal');
            const openRegisterBtn = document.getElementById('openRegisterStudentModalBtn');
            const closeRegisterBtn = document.getElementById('closeRegisterStudentModalBtn');
            const cancelRegisterBtn = document.getElementById('cancelRegisterStudentBtn');
            const walkinForm = document.getElementById('walkinForm');

            const lockManagerBranch = () => {
                const branchSelect = document.getElementById('walkin_branch_id');
                const branchId = getManagerBranchId();
                if (!branchSelect || branchId < 1) return;
                branchSelect.value = String(branchId);
                branchSelect.disabled = false;
                branchSelect.style.pointerEvents = 'none';
                branchSelect.style.opacity = '0.85';
                branchSelect.dispatchEvent(new Event('change'));
            };

            const openRegisterModal = () => {
                registerModal.classList.remove('hidden');
                registerModal.classList.add('flex');
                if (walkinForm) {
                    walkinForm.dataset.paymentRedirectUrl = 'desk_registration.html#active';
                }
                if (typeof loadWalkinBranches === 'function') {
                    Promise.resolve(loadWalkinBranches()).then(lockManagerBranch).catch(lockManagerBranch);
                } else {
                    lockManagerBranch();
                }
                if (typeof updateWalkinAgeAndGuardianRequired === 'function') updateWalkinAgeAndGuardianRequired();
            };

            const closeRegisterModal = () => {
                registerModal.classList.add('hidden');
                registerModal.classList.remove('flex');
                if (walkinForm) {
                    walkinForm.reset();
                    if (typeof updateWalkinAgeAndGuardianRequired === 'function') updateWalkinAgeAndGuardianRequired();
                }
                const msgDiv = document.getElementById('walkinMessage');
                if (msgDiv) msgDiv.classList.add('hidden');
            };

            if (openRegisterBtn) openRegisterBtn.addEventListener('click', openRegisterModal);
            if (closeRegisterBtn) closeRegisterBtn.addEventListener('click', closeRegisterModal);
            if (cancelRegisterBtn) cancelRegisterBtn.addEventListener('click', closeRegisterModal);

            if (walkinForm && typeof initWalkinPage === 'function') {
                walkinForm.dataset.paymentRedirectUrl = 'desk_registration.html#active';
                initWalkinPage();
                lockManagerBranch();
            }

            document.getElementById('closeScheduleModalBtn')?.addEventListener('click', closeScheduleModal);
            document.getElementById('toggleAddScheduleBtn')?.addEventListener('click', toggleAddScheduleForm);
            document.getElementById('cancelAddScheduleBtn')?.addEventListener('click', toggleAddScheduleForm);
            document.getElementById('addScheduleForm')?.addEventListener('submit', submitAddScheduleForm);
            document.getElementById('scheduleModal')?.addEventListener('click', (event) => {
                if (event.target?.id === 'scheduleModal') closeScheduleModal();
            });

            const hash = (window.location.hash || '').replace('#', '').toLowerCase();
            setActiveMode(hash === 'active' ? 'active' : 'pending');

            window.addEventListener('hashchange', () => {
                const h = (window.location.hash || '').replace('#', '').toLowerCase();
                setActiveMode(h === 'active' ? 'active' : 'pending');
            });
        });
