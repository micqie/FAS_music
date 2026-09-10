     let allTeachers = [];
        let filteredTeachers = [];
        let allBranches = [];
        let allSpecializations = [];
        let adminUserId = 0;
        const adminAvailabilityDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const adminAvailabilityState = { teacherId: 0, rows: [] };

        function esc(v) {
            return (window.TeacherFormUI && TeacherFormUI.esc) ? TeacherFormUI.esc(v) : String(v ?? '');
        }

        function showMessage(message, type = 'error') {
            Swal.fire({
                icon: type === 'success' ? 'success' : 'error',
                title: type === 'success' ? 'Success' : 'Error',
                text: message,
                confirmButtonColor: '#b8860b'
            });
        }

        function statusBadge(status) {
            if (status === 'Active') return 'bg-green-100 text-green-700 border-green-200';
            return 'bg-slate-100 text-slate-700 border-slate-200';
        }

        function refreshSpecializationChips(selectedIds = []) {
            const grid = document.getElementById('specializationChipGrid');
            if (!grid || !window.TeacherFormUI) return;
            TeacherFormUI.renderSpecializationChips(grid, allSpecializations, selectedIds);
        }

        function getSelectedSpecializationIds() {
            const grid = document.getElementById('specializationChipGrid');
            return window.TeacherFormUI
                ? TeacherFormUI.getSelectedSpecializationIdsFromChips(grid)
                : [];
        }

        function setSelectedSpecializationIds(ids) {
            refreshSpecializationChips(ids);
        }

        function updateAccountModeCards() {
            const realCard = document.getElementById('accountModeRealCard');
            const systemCard = document.getElementById('accountModeSystemCard');
            const isReal = document.getElementById('accountModeReal')?.checked;
            if (realCard) realCard.classList.toggle('is-selected', !!isReal);
            if (systemCard) systemCard.classList.toggle('is-selected', !isReal);
        }

        function bindAccountModeCardClicks() {
            document.getElementById('accountModeRealCard')?.addEventListener('click', () => {
                const input = document.getElementById('accountModeReal');
                if (input) input.checked = true;
                TeacherFormUI.setAccountMode('real_email', false);
                updateAccountModeCards();
            });
            document.getElementById('accountModeSystemCard')?.addEventListener('click', () => {
                const input = document.getElementById('accountModeSystem');
                if (input) input.checked = true;
                TeacherFormUI.setAccountMode('system_account', false);
                updateAccountModeCards();
                TeacherFormUI.previewSystemLogin();
            });
            document.getElementById('accountModeReal')?.addEventListener('change', updateAccountModeCards);
            document.getElementById('accountModeSystem')?.addEventListener('change', updateAccountModeCards);
        }

        async function loadBranches() {
            const res = await axios.get(`${baseApiUrl}/branch.php?action=get-branches-all`);
            const data = res.data;
            allBranches = (data.success && Array.isArray(data.branches)) ? data.branches : [];
            const filter = document.getElementById('branchFilter');
            const formSel = document.getElementById('branchId');
            if (filter) {
                filter.innerHTML = '<option value="">All Branches</option>' + allBranches.map(b => `<option value="${Number(b.branch_id)}">${esc(b.branch_name)}</option>`).join('');
            }
            if (formSel) {
                formSel.innerHTML = '<option value="">Select branch</option>' + allBranches.map(b => `<option value="${Number(b.branch_id)}">${esc(b.branch_name)}</option>`).join('');
            }
        }

        async function loadSpecializations(selectedIds = []) {
            const res = await axios.get(`${baseApiUrl}/teachers.php?action=get-specializations`);
            const data = res.data;
            allSpecializations = (data.success && Array.isArray(data.specializations)) ? data.specializations : [];
            refreshSpecializationChips(selectedIds);
        }

        async function loadTeachers() {
            const res = await axios.get(`${baseApiUrl}/teachers.php?action=get-teachers`);
            const data = res.data;
            allTeachers = (data.success && Array.isArray(data.teachers)) ? data.teachers : [];
            applyFilters();
        }

        function applyFilters() {
            const branchId = String(document.getElementById('branchFilter')?.value || '');
            const status = String(document.getElementById('statusFilter')?.value || '');
            const q = String(document.getElementById('searchInput')?.value || '').toLowerCase().trim();
            filteredTeachers = allTeachers.filter(t => {
                if (branchId && String(t.branch_id) !== branchId) return false;
                if (status && String(t.status) !== status) return false;
                if (q) {
                    const hay = `${t.first_name || ''} ${t.last_name || ''} ${t.specialization || ''} ${t.email || ''}`.toLowerCase();
                    if (!hay.includes(q)) return false;
                }
                return true;
            });
            renderTeachers();
        }

        function renderTeachers() {
            const tbody = document.getElementById('teachersTable');
            const count = document.getElementById('teacherCount');
            const totalCount = allTeachers.length;
            const activeCount = allTeachers.filter(t => t.status === 'Active').length;
            const inactiveCount = allTeachers.filter(t => t.status === 'Inactive').length;
            const totalEl = document.getElementById('totalTeachersCount');
            const activeEl = document.getElementById('activeTeachersCount');
            const inactiveEl = document.getElementById('inactiveTeachersCount');
            if (totalEl) totalEl.textContent = totalCount;
            if (activeEl) activeEl.textContent = activeCount;
            if (inactiveEl) inactiveEl.textContent = inactiveCount;
            if (!tbody) return;
            if (count) count.textContent = `${filteredTeachers.length} of ${totalCount} teachers shown`;
            if (!filteredTeachers.length) {
                tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center"><div class="flex flex-col items-center justify-center"><div class="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-3"><i class="fas fa-inbox text-2xl text-slate-400"></i></div><p class="text-slate-600 font-medium">No teachers found</p><p class="text-sm text-slate-400 mt-1">Try adjusting your filters</p></div></td></tr>';
                return;
            }
            tbody.innerHTML = filteredTeachers.map(t => {
                const fullName = `${t.first_name || ''} ${t.last_name || ''}`.trim();
                const email = t.email || '';
                const phone = t.phone || '';
                const initials = `${(t.first_name || '').charAt(0)}${(t.last_name || '').charAt(0)}`.toUpperCase();
                const statusColor = t.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200';
                const statusIcon = t.status === 'Active' ? '<i class="fas fa-check-circle mr-1"></i>' : '<i class="fas fa-pause-circle mr-1"></i>';
                return `
                <tr class="hover:bg-slate-50 transition-colors group">
                    <td class="teacher-identity-cell px-6 py-4"><div class="flex items-center gap-3"><div class="h-10 w-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center flex-shrink-0 shadow-sm"><span class="text-white text-sm font-bold">${esc(initials)}</span></div><div class="min-w-0"><div class="teacher-name font-semibold text-slate-900">${esc(fullName || 'N/A')}</div><div class="teacher-contact text-xs text-slate-500">${esc(email || 'No email')}${phone ? ' • ' + esc(phone) : ''}</div></div></div></td>
                    <td class="px-6 py-4"><div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200"><i class="fas fa-music text-[10px]"></i><span>${esc(t.specialization || 'General')}</span></div></td>
                    <td class="px-6 py-4"><div class="inline-flex items-center gap-2 text-sm text-slate-700"><i class="fas fa-location-dot text-slate-400"></i>${esc(t.branch_name || 'N/A')}</div></td>
                    <td class="px-6 py-4"><span class="text-sm text-slate-700">${esc(t.employment_type || 'Full-time')}</span></td>
                    <td class="px-6 py-4"><span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColor}">${statusIcon}${esc(t.status || 'Inactive')}</span></td>
                    <td class="teacher-actions-cell px-6 py-4"><div class="teacher-actions">
                        <button onclick="openEditTeacher(${Number(t.teacher_id)})" class="teacher-action-btn bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors" title="Edit teacher" aria-label="Edit ${esc(fullName || 'teacher')}"><i class="fas fa-edit" aria-hidden="true"></i></button>
                        <button onclick="openAdminTeacherAvailability(${Number(t.teacher_id)})" class="teacher-action-btn bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors" title="Manage availability" aria-label="Manage availability for ${esc(fullName || 'teacher')}"><i class="fas fa-calendar-alt" aria-hidden="true"></i></button>
                        <button onclick="openAdminTeacherCalendar(${Number(t.teacher_id)})" class="teacher-action-btn bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors" title="View schedule" aria-label="View schedule for ${esc(fullName || 'teacher')}"><i class="fas fa-calendar-days" aria-hidden="true"></i></button>
                        <button onclick="toggleTeacherStatus(${Number(t.teacher_id)}, '${t.status === 'Active' ? 'Inactive' : 'Active'}')" class="teacher-action-btn ${t.status === 'Active' ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'} transition-colors" title="${t.status === 'Active' ? 'Deactivate' : 'Activate'} teacher" aria-label="${t.status === 'Active' ? 'Deactivate' : 'Activate'} ${esc(fullName || 'teacher')}"><i class="fas fa-${t.status === 'Active' ? 'times-circle' : 'check-circle'}" aria-hidden="true"></i></button>
                    </div></td>
                </tr>`;
            }).join('');
        }

        function updateTeacherPasswordMatch() {
            const password = String(document.getElementById('teacherNewPassword')?.value || '');
            const confirmation = String(document.getElementById('teacherConfirmPassword')?.value || '');
            const feedback = document.getElementById('teacherPasswordMatch');
            if (!feedback) return;

            if (!password && !confirmation) {
                feedback.textContent = 'Enter the password again to confirm it.';
                feedback.className = 'mt-2 text-xs text-slate-500';
            } else if (password && password === confirmation) {
                feedback.textContent = 'Passwords match.';
                feedback.className = 'mt-2 text-xs font-semibold text-emerald-600';
            } else {
                feedback.textContent = 'Passwords do not match.';
                feedback.className = 'mt-2 text-xs font-semibold text-rose-600';
            }
        }

        function resetTeacherPasswordFields() {
            const password = document.getElementById('teacherNewPassword');
            const confirmation = document.getElementById('teacherConfirmPassword');
            if (password) {
                password.value = '';
                password.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (confirmation) confirmation.value = '';
            updateTeacherPasswordMatch();
        }

        function setTeacherEmailLocked(locked) {
            const emailInput = document.getElementById('email');
            const hint = document.getElementById('teacherEmailHint');
            if (!emailInput) return;
            emailInput.readOnly = locked;
            emailInput.setAttribute('aria-readonly', locked ? 'true' : 'false');
            emailInput.classList.toggle('bg-slate-100', locked);
            emailInput.classList.toggle('text-slate-500', locked);
            emailInput.classList.toggle('cursor-not-allowed', locked);
            emailInput.classList.toggle('bg-white', !locked);
            if (hint) {
                hint.innerHTML = locked
                    ? '<i class="fas fa-lock mr-1"></i>Email is fixed after account creation to keep linked records consistent.'
                    : 'Used as the instructor\'s contact and login email.';
            }
        }

        function openTeacherModal() {
            const modal = document.getElementById('teacherModal');
            const form = document.getElementById('teacherForm');
            const title = document.getElementById('teacherModalTitle');
            const subtitle = document.getElementById('teacherModalSubtitle');
            if (form) form.reset();
            document.getElementById('teacherId').value = '';
            setSelectedSpecializationIds([]);
            if (title) title.textContent = 'Add Teacher';
            if (subtitle) subtitle.textContent = 'Set profile details, specializations, and portal login.';
            // Hide status field — new teachers are always Active
            const statusWrapper = document.getElementById('statusFieldWrapper');
            const statusHidden  = document.getElementById('statusHidden');
            const emailWrapper = document.getElementById('teacherEmailFieldWrapper');
            const realAccountCard = document.getElementById('accountModeRealCard');
            const credentialsSection = document.getElementById('teacherCredentialsSection');
            if (statusWrapper) statusWrapper.classList.add('hidden');
            if (statusHidden)  statusHidden.value = 'Active';
            if (emailWrapper) emailWrapper.classList.add('hidden');
            if (realAccountCard) realAccountCard.classList.add('hidden');
            if (credentialsSection) credentialsSection.classList.add('hidden');
            resetTeacherPasswordFields();
            const emailInput = document.getElementById('email');
            if (emailInput) emailInput.value = '';
            setTeacherEmailLocked(false);
            if (window.TeacherFormUI) {
                TeacherFormUI.setAccountMode('system_account', false);
                TeacherFormUI.previewSystemLogin();
                updateAccountModeCards();
            }
            if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
        }

        function closeTeacherModal() {
            const modal = document.getElementById('teacherModal');
            if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
        }

        function openEditTeacher(teacherId) {
            const t = allTeachers.find(x => Number(x.teacher_id) === Number(teacherId));
            if (!t) return;
            document.getElementById('teacherId').value = String(t.teacher_id || '');
            document.getElementById('firstName').value = t.first_name || '';
            document.getElementById('lastName').value = t.last_name || '';
            document.getElementById('branchId').value = String(t.branch_id || '');
            document.getElementById('employmentType').value = t.employment_type || 'Full-time';
            const ids = Array.isArray(t.specialization_ids)
                ? t.specialization_ids
                : String(t.specialization_ids_csv || '').split(',').map(v => Number(v || 0)).filter(v => v > 0);
            setSelectedSpecializationIds(ids);
            document.getElementById('email').value = t.email || '';
            setTeacherEmailLocked(true);
            document.getElementById('phone').value = t.phone || '';
            document.getElementById('status').value = t.status || 'Active';
            document.getElementById('teacherModalTitle').textContent = 'Edit Teacher';
            document.getElementById('teacherModalSubtitle').textContent = 'Update instructor profile, specializations, and credentials.';
            // Show status field in edit mode
            const statusWrapper = document.getElementById('statusFieldWrapper');
            const emailWrapper = document.getElementById('teacherEmailFieldWrapper');
            const realAccountCard = document.getElementById('accountModeRealCard');
            const credentialsSection = document.getElementById('teacherCredentialsSection');
            if (statusWrapper) statusWrapper.classList.remove('hidden');
            if (emailWrapper) emailWrapper.classList.remove('hidden');
            if (realAccountCard) realAccountCard.classList.remove('hidden');
            if (credentialsSection) credentialsSection.classList.remove('hidden');
            resetTeacherPasswordFields();
            if (window.TeacherFormUI) {
                TeacherFormUI.setAccountMode('real_email', true);
            }
            const modal = document.getElementById('teacherModal');
            if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
        }

        function validateTeacherForm(isEdit) {
            const specializationIds = getSelectedSpecializationIds();
            if (!specializationIds.length) {
                showMessage('Please select at least one specialization.', 'error');
                return false;
            }
            if (!isEdit && window.TeacherFormUI) {
                const mode = document.getElementById('accountModeReal')?.checked ? 'real_email' : 'system_account';
                const email = String(document.getElementById('email')?.value || '').trim();
                if (mode === 'real_email' && !email) {
                    showMessage('Please enter the instructor email for a real email account.', 'error');
                    return false;
                }
            }
            if (isEdit) {
                const password = String(document.getElementById('teacherNewPassword')?.value || '');
                const confirmation = String(document.getElementById('teacherConfirmPassword')?.value || '');
                if (password || confirmation) {
                    if (!password || !confirmation) {
                        showMessage('Please complete both password fields.', 'error');
                        return false;
                    }
                    if (password !== confirmation) {
                        showMessage('The new passwords do not match.', 'error');
                        return false;
                    }
                    if (
                        password.length < 8 ||
                        !/[A-Z]/.test(password) ||
                        !/[a-z]/.test(password) ||
                        !/[0-9]/.test(password) ||
                        !/[!@#$%^&*]/.test(password)
                    ) {
                        showMessage('Use a strong password with at least 8 characters, uppercase, lowercase, a number, and a special character.', 'error');
                        return false;
                    }
                }
            }
            return true;
        }

        function showTeacherCreatedDialog(data) {
            const username = data.username || data.login_identifier || '';
            const tempPassword = data.temp_password || '';
            const accountMode = data.account_mode || '';
            const emailSent = !!data.email_sent;

            if (accountMode === 'real_email') {
                Swal.fire({
                    icon: emailSent ? 'success' : 'warning',
                    title: emailSent ? 'Instructor Created' : 'Instructor Created (Email Not Sent)',
                    html: emailSent
                        ? `Login details were emailed to <strong>${esc(username)}</strong>.<br><br>Temporary password: <span class="font-mono">${esc(tempPassword)}</span>`
                        : `Account created for <strong>${esc(username)}</strong>, but the email could not be sent.<br><br>Share these credentials manually:<br><strong>Username:</strong> ${esc(username)}<br><strong>Temporary password:</strong> <span class="font-mono">${esc(tempPassword)}</span>${data.email_error ? `<br><br><span class="text-xs text-slate-500">${esc(data.email_error)}</span>` : ''}`,
                    confirmButtonColor: '#b8860b'
                });
                return;
            }

            if (username && tempPassword) {
                Swal.fire({
                    icon: 'success',
                    title: 'Instructor Account Created',
                    html: `<div class="text-left text-sm space-y-2">
                        <p><strong>Login:</strong> <span class="font-mono">${esc(username)}</span></p>
                        <p><strong>Temporary password:</strong> <span class="font-mono">${esc(tempPassword)}</span></p>
                        <p class="text-xs text-slate-500">Share these with the teacher. They must change the password on first login.</p>
                    </div>`,
                    confirmButtonColor: '#b8860b'
                });
                return;
            }

            showMessage('Instructor saved successfully', 'success');
        }

        async function saveTeacher(event) {
            event.preventDefault();
            const teacherId = Number(document.getElementById('teacherId').value || 0);
            const isEdit = teacherId > 0;
            if (!validateTeacherForm(isEdit)) return;

            const payload = {
                action: isEdit ? 'update-teacher' : 'add-teacher',
                teacher_id: teacherId,
                first_name: document.getElementById('firstName').value.trim(),
                last_name: document.getElementById('lastName').value.trim(),
                branch_id: Number(document.getElementById('branchId').value || 0),
                employment_type: document.getElementById('employmentType').value,
                specialization_ids: getSelectedSpecializationIds(),
                ...(!isEdit ? { email: document.getElementById('email').value.trim() } : {}),
                phone: document.getElementById('phone').value.trim(),
                status: isEdit
                    ? document.getElementById('status').value
                    : (document.getElementById('statusHidden')?.value || 'Active'),
                new_password: isEdit ? String(document.getElementById('teacherNewPassword')?.value || '') : '',
                ...(window.TeacherFormUI ? TeacherFormUI.getAccountModePayload(isEdit) : {})
            };
            const endpoint = isEdit ? 'update-teacher' : 'add-teacher';
            const res = await axios.post(`${baseApiUrl}/teachers.php?action=${endpoint}`, payload);
            const data = res.data;
            if (!data.success) {
                showMessage(data.error || 'Failed to save teacher', 'error');
                return;
            }
            closeTeacherModal();
            if (!isEdit && (data.username || data.login_identifier)) {
                showTeacherCreatedDialog(data);
            } else {
                showMessage(isEdit && payload.new_password
                    ? 'Instructor details and password updated successfully.'
                    : 'Instructor saved successfully', 'success');
            }
            await loadTeachers();
        }

        async function toggleTeacherStatus(teacherId, nextStatus) {
            const res = await axios.post(`${baseApiUrl}/teachers.php?action=set-teacher-status`, {
                action: 'set-teacher-status',
                teacher_id: Number(teacherId),
                status: nextStatus
            });
            const data = res.data;
            if (!data.success) {
                showMessage(data.error || 'Failed to update status', 'error');
                return;
            }
            await loadTeachers();
        }

        function openAdminTeacherCalendar(teacherId) {
            const teacher = allTeachers.find(item => Number(item.teacher_id) === Number(teacherId));
            if (!teacher || typeof window.openTeacherOccupiedCalendar !== 'function') return;
            const name = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || 'Instructor';
            window.openTeacherOccupiedCalendar(teacher.teacher_id, name, teacher.branch_id, teacher.branch_name || '');
        }

        function setAdminAvailabilityStatus(message, type = 'error') {
            const box = document.getElementById('adminAvailabilityStatus');
            if (!box) return;
            box.textContent = message;
            box.className = `mb-4 rounded-xl border px-4 py-3 text-sm ${type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'}`;
        }

        function clearAdminAvailabilityStatus() {
            const box = document.getElementById('adminAvailabilityStatus');
            if (!box) return;
            box.textContent = '';
            box.className = 'hidden mb-4 rounded-xl border px-4 py-3 text-sm';
        }

        function renderAdminAvailabilityGrid(entries = []) {
            const grid = document.getElementById('adminAvailabilityGrid');
            const template = document.getElementById('adminAvailabilityCardTemplate');
            if (!grid || !template) return;

            const byDay = new Map(entries.map(item => [String(item.day_of_week || ''), item]));
            grid.innerHTML = '';
            adminAvailabilityDays.forEach(day => {
                const row = byDay.get(day) || {};
                const card = template.content.firstElementChild.cloneNode(true);
                card.dataset.day = day;

                const enabled = card.querySelector('.admin-availability-enabled');
                const start = card.querySelector('.admin-availability-start');
                const end = card.querySelector('.admin-availability-end');
                card.querySelector('.admin-availability-day').textContent = day;
                enabled.checked = !!String(row.start_time || '').trim();
                start.value = String(row.start_time || '09:00').slice(0, 5);
                end.value = String(row.end_time || '17:00').slice(0, 5);

                const syncEnabledState = () => {
                    const disabled = !enabled.checked;
                    start.disabled = disabled;
                    end.disabled = disabled;
                    card.classList.toggle('opacity-60', disabled);
                    card.classList.toggle('border-gold-300', !disabled);
                };
                enabled.addEventListener('change', syncEnabledState);
                syncEnabledState();
                grid.appendChild(card);
            });
        }

        async function loadAdminTeacherAvailability(teacherId) {
            try {
                const res = await axios.get(`${baseApiUrl}/teachers.php?action=get-teacher-availability&teacher_id=${encodeURIComponent(teacherId)}&user_id=${encodeURIComponent(adminUserId)}`);
                const data = res.data || {};
                if (!data.success) throw new Error(data.error || 'Failed to load availability.');
                adminAvailabilityState.rows = Array.isArray(data.availability) ? data.availability : [];
                renderAdminAvailabilityGrid(adminAvailabilityState.rows);
                clearAdminAvailabilityStatus();
            } catch (error) {
                console.error('Failed to load instructor availability:', error);
                adminAvailabilityState.rows = [];
                renderAdminAvailabilityGrid([]);
                setAdminAvailabilityStatus(error.response?.data?.error || error.message || 'Failed to load instructor availability.');
            }
        }

        async function openAdminTeacherAvailability(teacherId) {
            const teacher = allTeachers.find(item => Number(item.teacher_id) === Number(teacherId));
            if (!teacher) {
                showMessage('Instructor not found.', 'error');
                return;
            }
            if (!adminUserId) {
                showMessage('Admin session not found. Please log in again.', 'error');
                return;
            }

            adminAvailabilityState.teacherId = Number(teacher.teacher_id || 0);
            adminAvailabilityState.rows = [];
            const fullName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || 'Instructor';
            const title = document.getElementById('adminAvailabilityTitle');
            const meta = document.getElementById('adminAvailabilityMeta');
            if (title) title.textContent = `${fullName} Availability`;
            if (meta) meta.textContent = `${teacher.branch_name || 'No branch'} • ${teacher.specialization || 'General'}`;

            clearAdminAvailabilityStatus();
            renderAdminAvailabilityGrid([]);
            const modal = document.getElementById('adminTeacherAvailabilityModal');
            modal?.classList.remove('hidden');
            modal?.classList.add('flex');
            await loadAdminTeacherAvailability(adminAvailabilityState.teacherId);
        }

        function closeAdminTeacherAvailability() {
            const modal = document.getElementById('adminTeacherAvailabilityModal');
            modal?.classList.add('hidden');
            modal?.classList.remove('flex');
            adminAvailabilityState.teacherId = 0;
            adminAvailabilityState.rows = [];
            clearAdminAvailabilityStatus();
        }

        function collectAdminAvailability() {
            return Array.from(document.querySelectorAll('#adminAvailabilityGrid .admin-availability-card')).map(card => ({
                day_of_week: card.dataset.day || '',
                enabled: !!card.querySelector('.admin-availability-enabled')?.checked,
                start_time: card.querySelector('.admin-availability-start')?.value || '',
                end_time: card.querySelector('.admin-availability-end')?.value || ''
            }));
        }

        async function saveAdminTeacherAvailability() {
            if (!adminUserId || !adminAvailabilityState.teacherId) {
                setAdminAvailabilityStatus('Admin session or instructor selection is missing.');
                return;
            }

            const availability = collectAdminAvailability();
            for (const row of availability) {
                if (!row.enabled) continue;
                if (!row.start_time || !row.end_time) {
                    setAdminAvailabilityStatus(`Please complete the time range for ${row.day_of_week}.`);
                    return;
                }
                if (row.end_time <= row.start_time) {
                    setAdminAvailabilityStatus(`End time must be later than start time for ${row.day_of_week}.`);
                    return;
                }
            }

            const button = document.getElementById('saveAdminAvailabilityBtn');
            const buttonText = document.getElementById('saveAdminAvailabilityText');
            if (button) button.disabled = true;
            if (buttonText) buttonText.textContent = 'Saving...';
            clearAdminAvailabilityStatus();

            try {
                const res = await axios.post(`${baseApiUrl}/teachers.php?action=save-teacher-availability`, {
                    action: 'save-teacher-availability',
                    user_id: adminUserId,
                    teacher_id: adminAvailabilityState.teacherId,
                    availability
                });
                const data = res.data || {};
                if (!data.success) throw new Error(data.error || 'Failed to save availability.');
                await Swal.fire({
                    icon: 'success',
                    title: 'Availability Saved',
                    text: data.message || 'Instructor availability updated successfully.',
                    confirmButtonColor: '#b8860b'
                });
                await loadAdminTeacherAvailability(adminAvailabilityState.teacherId);
            } catch (error) {
                setAdminAvailabilityStatus(error.response?.data?.error || error.message || 'Failed to save instructor availability.');
            } finally {
                if (button) button.disabled = false;
                if (buttonText) buttonText.textContent = 'Save Availability';
            }
        }

        document.addEventListener('DOMContentLoaded', async function() {
            if (typeof Auth !== 'undefined' && Auth.getUser) {
                const user = Auth.getUser();
                adminUserId = Number(user?.user_id || 0);
                const userNameNav = document.getElementById('userNameNav');
                    const profileMenuName = document.getElementById('profileMenuName');
                const displayName = user.username || user.email || 'Admin';
                if (userNameNav) userNameNav.textContent = displayName;
                if (profileMenuName) profileMenuName.textContent = displayName;
            }
            if (window.TeacherFormUI) {
                TeacherFormUI.bindAccountModeControls();
                TeacherFormUI.bindSystemLoginPreview();
                bindAccountModeCardClicks();
            }
            await loadBranches();
            await loadSpecializations();
            await loadTeachers();
            document.getElementById('openTeacherModalBtn')?.addEventListener('click', openTeacherModal);
            document.getElementById('closeTeacherModalBtn')?.addEventListener('click', closeTeacherModal);
            document.getElementById('cancelTeacherBtn')?.addEventListener('click', closeTeacherModal);
            document.getElementById('teacherForm')?.addEventListener('submit', saveTeacher);
            document.getElementById('branchFilter')?.addEventListener('change', applyFilters);
            document.getElementById('statusFilter')?.addEventListener('change', applyFilters);
            document.getElementById('searchInput')?.addEventListener('input', applyFilters);
            document.getElementById('teacherNewPassword')?.addEventListener('input', updateTeacherPasswordMatch);
            document.getElementById('teacherConfirmPassword')?.addEventListener('input', updateTeacherPasswordMatch);
            document.getElementById('closeAdminAvailabilityBtn')?.addEventListener('click', closeAdminTeacherAvailability);
            document.getElementById('cancelAdminAvailabilityBtn')?.addEventListener('click', closeAdminTeacherAvailability);
            document.getElementById('saveAdminAvailabilityBtn')?.addEventListener('click', saveAdminTeacherAvailability);
        });
