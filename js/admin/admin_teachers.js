     let allTeachers = [];
        let filteredTeachers = [];
        let allBranches = [];
        let allSpecializations = [];

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
            if (!tbody) return;
            if (count) count.textContent = `${filteredTeachers.length} teacher(s)`;
            if (!filteredTeachers.length) {
                tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-500"><i class="fas fa-inbox text-2xl mb-2 text-gold-500/50"></i><p>No teachers found.</p></td></tr>';
                return;
            }
            tbody.innerHTML = filteredTeachers.map(t => {
                const fullName = `${t.first_name || ''} ${t.last_name || ''}`.trim();
                return `
                <tr class="hover:bg-slate-50/80 transition">
                    <td class="px-6 py-4">
                        <div class="font-medium text-slate-900">${esc(fullName || 'N/A')}</div>
                        <div class="text-sm text-slate-500">${esc(t.email || '')}${t.phone ? ' • ' + esc(t.phone) : ''}</div>
                    </td>
                    <td class="px-6 py-4 text-slate-700">${esc(t.specialization || 'General')}</td>
                    <td class="px-6 py-4 text-slate-700">${esc(t.branch_name || 'N/A')}</td>
                    <td class="px-6 py-4 text-slate-700">${esc(t.employment_type || 'Full-time')}</td>
                    <td class="px-6 py-4"><span class="px-2 py-1 rounded text-xs font-semibold border ${statusBadge(t.status)}">${esc(t.status || 'Inactive')}</span></td>
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-2">
                            <button onclick="openEditTeacher(${Number(t.teacher_id)})" class="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-bold">Edit</button>
                            <button onclick="openTeacherPasswordModal(${Number(t.teacher_id)})" class="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 text-xs font-bold">Change Password</button>
                            <button onclick="toggleTeacherStatus(${Number(t.teacher_id)}, '${t.status === 'Active' ? 'Inactive' : 'Active'}')" class="px-3 py-1.5 rounded-lg ${t.status === 'Active' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'} text-xs font-bold">${t.status === 'Active' ? 'Deactivate' : 'Activate'}</button>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        }

        async function openTeacherPasswordModal(teacherId) {
            const teacher = allTeachers.find(x => Number(x.teacher_id) === Number(teacherId));
            if (!teacher) {
                showMessage('Teacher not found.', 'error');
                return;
            }

            const fullName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || 'Teacher';
            const result = await Swal.fire({
                title: 'Change Teacher Password',
                width: 560,
                confirmButtonText: 'Update Password',
                confirmButtonColor: '#b8860b',
                showCancelButton: true,
                cancelButtonText: 'Cancel',
                html: `
                    <div class="text-left text-sm text-slate-600 mb-4">
                        Set a new password for <span class="font-semibold text-slate-900">${esc(fullName)}</span>.
                    </div>
                    <input id="swal-teacher-password" class="swal2-input" type="password" placeholder="New password">
                    <input id="swal-teacher-password-confirm" class="swal2-input" type="password" placeholder="Confirm new password">
                    <div class="text-left text-xs text-slate-500 mt-2 px-1">
                        Password must be at least 8 characters and include uppercase, lowercase, number, and special character.
                    </div>
                `,
                focusConfirm: false,
                preConfirm: () => {
                    const newPassword = String(document.getElementById('swal-teacher-password')?.value || '');
                    const confirmPassword = String(document.getElementById('swal-teacher-password-confirm')?.value || '');

                    if (!newPassword || !confirmPassword) {
                        Swal.showValidationMessage('Please fill in both password fields.');
                        return false;
                    }
                    if (newPassword !== confirmPassword) {
                        Swal.showValidationMessage('Passwords do not match.');
                        return false;
                    }
                    if (newPassword.length < 8) {
                        Swal.showValidationMessage('Password must be at least 8 characters long.');
                        return false;
                    }
                    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[!@#$%^&*]/.test(newPassword)) {
                        Swal.showValidationMessage('Password must include uppercase, lowercase, number, and special character.');
                        return false;
                    }

                    return { teacherId: Number(teacher.teacher_id || 0), newPassword };
                }
            });

            if (!result.isConfirmed || !result.value) return;

            try {
                const response = await axios.post(`${baseApiUrl}/teachers.php?action=reset-teacher-password`, {
                    teacher_id: result.value.teacherId,
                    new_password: result.value.newPassword
                });
                const data = response.data || {};
                if (!data.success) {
                    showMessage(data.error || 'Failed to update password.', 'error');
                    return;
                }
                Swal.fire({
                    icon: 'success',
                    title: 'Password Updated',
                    text: data.account_created
                        ? `${fullName}'s login account was created and the password was set successfully.`
                        : `${fullName}'s password has been changed successfully.`,
                    confirmButtonColor: '#b8860b'
                });
                await loadTeachers();
            } catch (error) {
                const message = error?.response?.data?.error || 'Failed to update password.';
                showMessage(message, 'error');
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
            if (window.TeacherFormUI) {
                TeacherFormUI.setAccountMode('real_email', false);
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
            document.getElementById('email').value = (t.email || '').includes('@fas.com') ? '' : (t.email || '');
            document.getElementById('phone').value = t.phone || '';
            document.getElementById('status').value = t.status || 'Active';
            document.getElementById('teacherModalTitle').textContent = 'Edit Teacher';
            document.getElementById('teacherModalSubtitle').textContent = 'Update teacher profile and specializations.';
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
                    showMessage('Please enter the teacher email for a real email account.', 'error');
                    return false;
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
                    title: emailSent ? 'Teacher Created' : 'Teacher Created (Email Not Sent)',
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
                    title: 'Teacher Account Created',
                    html: `<div class="text-left text-sm space-y-2">
                        <p><strong>Login:</strong> <span class="font-mono">${esc(username)}</span></p>
                        <p><strong>Temporary password:</strong> <span class="font-mono">${esc(tempPassword)}</span></p>
                        <p class="text-xs text-slate-500">Share these with the teacher. They must change the password on first login.</p>
                    </div>`,
                    confirmButtonColor: '#b8860b'
                });
                return;
            }

            showMessage('Teacher saved successfully', 'success');
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
                email: document.getElementById('email').value.trim(),
                phone: document.getElementById('phone').value.trim(),
                status: document.getElementById('status').value,
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
                showMessage('Teacher saved successfully', 'success');
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

        document.addEventListener('DOMContentLoaded', async function() {
            if (typeof Auth !== 'undefined' && Auth.getUser) {
                const user = Auth.getUser();
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
        });
