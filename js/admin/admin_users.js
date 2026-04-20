
        const adminUsersTableState = {
            rows: [],
            filtered: [],
            page: 1,
            pageSize: 10
        };

        function showInlineMessage(el, type, text) {
            if (!el) return;
            if ((type === 'success' || type === 'error') && typeof Swal !== 'undefined') {
                el.textContent = '';
                el.classList.add('hidden');
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: type === 'error' ? 'error' : 'success',
                    title: text || (type === 'error' ? 'Error' : 'Success'),
                    showConfirmButton: false,
                    timer: 2500,
                    timerProgressBar: true
                });
                return;
            }
            el.textContent = text;
            el.classList.remove('hidden');
            el.classList.remove('bg-red-50', 'text-red-700', 'border-red-200', 'bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
            if (type === 'error') {
                el.classList.add('bg-red-50', 'text-red-700', 'border', 'border-red-200');
            } else if (type === 'success') {
                el.classList.add('bg-emerald-50', 'text-emerald-700', 'border', 'border-emerald-200');
            } else {
                el.classList.add('bg-slate-50', 'text-slate-700', 'border', 'border-slate-200');
            }
        }

        function getAdminUserById(userId) {
            const id = Number(userId) || 0;
            return (adminUsersTableState.rows || []).find(u => Number(u.user_id) === id) || null;
        }

        function escapeJsString(value) {
            return String(value || '')
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/\r?\n/g, ' ');
        }

        function closeAdminUserPasswordModal() {
            const modal = document.getElementById('adminUserPasswordModal');
            if (modal) modal.classList.add('hidden');
        }

        function openAdminUserPasswordModal(userId, displayName) {
            const modal = document.getElementById('adminUserPasswordModal');
            const idInput = document.getElementById('adminUserPasswordUserId');
            const subtitle = document.getElementById('adminUserPasswordModalSubtitle');
            const pwdNew = document.getElementById('adminUserPasswordNew');
            const pwdConfirm = document.getElementById('adminUserPasswordConfirm');
            const msgEl = document.getElementById('adminUserPasswordMessage');
            const user = getAdminUserById(userId);
            const name = displayName || (user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '');

            if (!modal || !idInput) return;
            idInput.value = userId || '';
            if (subtitle) {
                subtitle.textContent = name ? `Editing password for ${name}` : '';
            }
            if (pwdNew) pwdNew.value = '';
            if (pwdConfirm) pwdConfirm.value = '';
            if (msgEl) {
                msgEl.textContent = '';
                msgEl.classList.add('hidden');
            }
            modal.classList.remove('hidden');
        }

        function closeAdminUserEditModal() {
            const modal = document.getElementById('adminUserEditModal');
            if (modal) modal.classList.add('hidden');
        }

        async function openAdminUserEditModal(userId) {
            const user = getAdminUserById(userId);
            if (!user) return;

            const modal = document.getElementById('adminUserEditModal');
            const idInput = document.getElementById('adminUserEditUserId');
            const firstName = document.getElementById('adminUserEditFirstName');
            const lastName = document.getElementById('adminUserEditLastName');
            const email = document.getElementById('adminUserEditEmail');
            const phone = document.getElementById('adminUserEditPhone');
            const role = document.getElementById('adminUserEditRole');
            const status = document.getElementById('adminUserEditStatus');
            const subtitle = document.getElementById('adminUserEditModalSubtitle');
            const branchWrap = document.getElementById('adminUserEditBranchWrap');
            const msgEl = document.getElementById('adminUserEditMessage');

            if (!modal || !idInput || !firstName || !lastName || !email) return;

            idInput.value = user.user_id || '';
            firstName.value = user.first_name || '';
            lastName.value = user.last_name || '';
            email.value = user.email || '';
            if (phone) phone.value = user.phone || '';
            if (role) role.value = user.role_name || '';
            if (status) status.value = user.status || 'Inactive';
            if (subtitle) {
                const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
                subtitle.textContent = name ? `Editing ${name}` : 'Update user details';
            }
            if (msgEl) {
                msgEl.textContent = '';
                msgEl.classList.add('hidden');
            }

            const roleName = (user.role_name || '').toLowerCase();
            const showBranch = roleName === 'staff' || roleName === 'branch manager' || roleName === 'manager';
            if (branchWrap) branchWrap.classList.toggle('hidden', !showBranch);
            if (showBranch) {
                await loadAdminUserBranchesInto('adminUserEditBranch', user.branch_id || '');
            }

            modal.classList.remove('hidden');
        }

        async function loadAdminUserBranches() {
            const wrapper = document.getElementById('adminCreateUserBranchWrapper');
            const select = document.getElementById('adminCreateUserBranch');
            if (!select) return;
            try {
                const response = await axios.get(`${baseApiUrl}/branch.php?action=get-branches`);
                const data = response.data;
                if (data.success && Array.isArray(data.branches)) {
                    select.innerHTML = '<option value=\"\">Select branch</option>' + data.branches.map(b => `<option value=\"${b.branch_id}\">${b.branch_name}</option>`).join('');
                }
            } catch (e) {
                console.error('Failed to load branches for users page', e);
            }
        }

        function bindAdminUsersPage() {
            const roleFilter = document.getElementById('adminUsersRoleFilter');
            const searchInput = document.getElementById('adminUsersSearch');
            const pageSizeEl = document.getElementById('adminUsersPageSize');
            const prevBtn = document.getElementById('adminUsersPrevBtn');
            const nextBtn = document.getElementById('adminUsersNextBtn');
            const openStaffBtn = document.getElementById('openAddStaffModalBtn');
            const openManagerBtn = document.getElementById('openAddManagerModalBtn');

            if (openStaffBtn) {
                openStaffBtn.addEventListener('click', () => {
                    openModal('adminAddStaffModal');
                    loadAdminUserBranchesInto('adminAddStaffBranch');
                });
            }
            if (openManagerBtn) {
                openManagerBtn.addEventListener('click', () => {
                    openModal('adminAddManagerModal');
                    loadAdminUserBranchesInto('adminAddManagerBranch');
                });
            }
            document.querySelectorAll('[data-close-modal]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const target = btn.getAttribute('data-close-modal');
                    closeModal(target);
                });
            });

            if (roleFilter || searchInput) {
                const triggerFilter = () => {
                    filterAdminUsers();
                    renderAdminUsersTable();
                };
                if (roleFilter) roleFilter.addEventListener('change', triggerFilter);
                if (searchInput) searchInput.addEventListener('input', triggerFilter);
            }

            if (pageSizeEl) {
                pageSizeEl.addEventListener('change', () => {
                    const size = parseInt(pageSizeEl.value, 10);
                    adminUsersTableState.pageSize = Number.isFinite(size) && size > 0 ? size : 10;
                    adminUsersTableState.page = 1;
                    renderAdminUsersTable();
                });
            }

            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    adminUsersTableState.page = Math.max(1, adminUsersTableState.page - 1);
                    renderAdminUsersTable();
                });
            }
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    const totalPages = Math.max(1, Math.ceil(adminUsersTableState.filtered.length / adminUsersTableState.pageSize));
                    adminUsersTableState.page = Math.min(totalPages, adminUsersTableState.page + 1);
                    renderAdminUsersTable();
                });
            }

            // Change password form
            const pwdForm = document.getElementById('adminUserPasswordForm');
            const pwdNew = document.getElementById('adminUserPasswordNew');
            const pwdConfirm = document.getElementById('adminUserPasswordConfirm');
            const pwdMatch = document.getElementById('adminUserPasswordMatch');

            function updatePwdMatch() {
                if (!pwdNew || !pwdConfirm || !pwdMatch) return;
                const a = pwdNew.value || '';
                const b = pwdConfirm.value || '';
                if (!a && !b) {
                    pwdMatch.textContent = '';
                    pwdMatch.className = 'text-[11px] mt-1';
                    return;
                }
                if (a === b) {
                    pwdMatch.textContent = 'Passwords match.';
                    pwdMatch.className = 'text-[11px] mt-1 text-emerald-600';
                } else {
                    pwdMatch.textContent = 'Passwords do not match.';
                    pwdMatch.className = 'text-[11px] mt-1 text-red-600';
                }
            }
            if (pwdNew) pwdNew.addEventListener('input', updatePwdMatch);
            if (pwdConfirm) pwdConfirm.addEventListener('input', updatePwdMatch);

            if (pwdForm) {
                pwdForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const userId = document.getElementById('adminUserPasswordUserId')?.value;
                    const msgEl = document.getElementById('adminUserPasswordMessage');
                    const btn = document.getElementById('adminUserPasswordSubmit');
                    const btnText = document.getElementById('adminUserPasswordSubmitText');
                    const btnIcon = document.getElementById('adminUserPasswordSubmitIcon');

                    if (!userId) {
                        showInlineMessage(msgEl, 'error', 'User ID missing.');
                        return;
                    }
                    if (!pwdNew || !pwdConfirm || pwdNew.value !== pwdConfirm.value) {
                        showInlineMessage(msgEl, 'error', 'Passwords do not match.');
                        return;
                    }

                    try {
                        if (btn && btnText && btnIcon) {
                            btn.disabled = true;
                            btnText.textContent = 'Saving...';
                            btnIcon.classList.remove('fa-key');
                            btnIcon.classList.add('fa-spinner', 'fa-spin');
                        }

                        // Reuse existing change-password API, but mark as admin override.
                        const payload = {
                            user_id: userId,
                            old_password: '__ADMIN_OVERRIDE__',
                            new_password: pwdNew.value,
                            is_admin_override: true
                        };
                        const res = await axios.post(`${baseApiUrl}/users.php?action=change-password`, payload);
                        const data = res.data;
                        if (!data || !data.success) {
                            showInlineMessage(msgEl, 'error', (data && data.error) || 'Failed to change password.');
                            return;
                        }
                        showInlineMessage(msgEl, 'success', data.message || 'Password updated.');
                        setTimeout(() => {
                            closeAdminUserPasswordModal();
                        }, 900);
                    } catch (error) {
                        console.error('Admin change password failed', error);
                        const text = error.response && error.response.data && error.response.data.error
                            ? error.response.data.error
                            : (error.message || 'Request failed.');
                        showInlineMessage(msgEl, 'error', text);
                    } finally {
                        if (btn && btnText && btnIcon) {
                            btn.disabled = false;
                            btnText.textContent = 'Save Password';
                            btnIcon.classList.add('fa-key');
                            btnIcon.classList.remove('fa-spinner', 'fa-spin');
                        }
                    }
                });
            }

            // Edit user profile form
            const editForm = document.getElementById('adminUserEditForm');
            if (editForm) {
                editForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const userId = document.getElementById('adminUserEditUserId')?.value;
                    const firstName = document.getElementById('adminUserEditFirstName');
                    const lastName = document.getElementById('adminUserEditLastName');
                    const email = document.getElementById('adminUserEditEmail');
                    const phone = document.getElementById('adminUserEditPhone');
                    const branchWrap = document.getElementById('adminUserEditBranchWrap');
                    const branchSelect = document.getElementById('adminUserEditBranch');
                    const msgEl = document.getElementById('adminUserEditMessage');
                    const btn = document.getElementById('adminUserEditSubmit');
                    const btnText = document.getElementById('adminUserEditSubmitText');
                    const btnIcon = document.getElementById('adminUserEditSubmitIcon');

                    if (!userId || !firstName || !lastName || !email) {
                        showInlineMessage(msgEl, 'error', 'Missing required fields.');
                        return;
                    }

                    const payload = {
                        user_id: userId,
                        first_name: firstName.value.trim(),
                        last_name: lastName.value.trim(),
                        email: email.value.trim(),
                        phone: phone ? phone.value.trim() : ''
                    };

                    if (branchWrap && !branchWrap.classList.contains('hidden') && branchSelect) {
                        payload.branch_id = branchSelect.value || '';
                    } else {
                        payload.branch_id = '';
                    }

                    try {
                        if (btn && btnText && btnIcon) {
                            btn.disabled = true;
                            btnText.textContent = 'Saving...';
                            btnIcon.classList.remove('fa-pen');
                            btnIcon.classList.add('fa-spinner', 'fa-spin');
                        }

                        const res = await axios.post(`${baseApiUrl}/admin.php?action=update-user`, payload);
                        const data = res.data;
                        if (!data || !data.success) {
                            showInlineMessage(msgEl, 'error', (data && data.error) || 'Failed to update user.');
                            return;
                        }

                        showInlineMessage(msgEl, 'success', data.message || 'User updated.');
                        if (typeof loadAdminUsers === 'function') {
                            await loadAdminUsers();
                        }
                        setTimeout(() => {
                            closeAdminUserEditModal();
                        }, 800);
                    } catch (error) {
                        console.error('Update user failed', error);
                        const text = error.response && error.response.data && error.response.data.error
                            ? error.response.data.error
                            : (error.message || 'Request failed.');
                        showInlineMessage(msgEl, 'error', text);
                    } finally {
                        if (btn && btnText && btnIcon) {
                            btn.disabled = false;
                            btnText.textContent = 'Save Changes';
                            btnIcon.classList.add('fa-pen');
                            btnIcon.classList.remove('fa-spinner', 'fa-spin');
                        }
                    }
                });
            }

        }

        function openModal(id) {
            const modal = document.getElementById(id);
            if (modal) modal.classList.remove('hidden');
        }
        function closeModal(id) {
            const modal = document.getElementById(id);
            if (modal) modal.classList.add('hidden');
        }

        async function loadAdminUserBranchesInto(selectId, selectedValue = '') {
            const select = document.getElementById(selectId);
            if (!select) return;
            const setOptions = (branches) => {
                select.innerHTML = '<option value=\"\">Select branch</option>' + branches.map(b => `<option value=\"${b.branch_id}\">${b.branch_name}</option>`).join('');
                if (selectedValue !== undefined && selectedValue !== null && selectedValue !== '') {
                    select.value = String(selectedValue);
                }
            };

            if (!window.__adminBranchesCache) {
                window.__adminBranchesCache = [];
            }
            if (window.__adminBranchesCache.length > 0) {
                setOptions(window.__adminBranchesCache);
                return;
            }

            let lastError = null;

            try {
                const response = await axios.get(`${baseApiUrl}/branch.php?action=get-branches`);
                const data = response.data;
                if (data && data.success && Array.isArray(data.branches)) {
                    if (data.branches.length === 0) {
                        lastError = new Error('No active branches returned.');
                    } else {
                        window.__adminBranchesCache = data.branches;
                        setOptions(data.branches);
                        return;
                    }
                } else {
                    lastError = new Error((data && data.error) || 'Invalid branch response.');
                }
            } catch (e) {
                lastError = e;
                console.warn('Primary branch fetch failed, trying fallback', e);
            }

            try {
                const fallbackBase = (window.appBaseUrl || '').replace(/\/$/, '');
                const fallbackUrl = fallbackBase
                    ? `${fallbackBase}/api/branch.php?action=get-branches-all`
                    : '../../api/branch.php?action=get-branches-all';
                const response = await axios.get(fallbackUrl);
                const data = response.data;
                if (data && data.success && Array.isArray(data.branches)) {
                    if (data.branches.length === 0) {
                        lastError = new Error('No branches returned from fallback.');
                    } else {
                        window.__adminBranchesCache = data.branches;
                        setOptions(data.branches);
                        return;
                    }
                } else {
                    lastError = new Error((data && data.error) || 'Invalid fallback response.');
                }
            } catch (e) {
                lastError = e;
                console.error('Failed to load branches for users page', e);
            }

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Branches not loading',
                    text: lastError ? (lastError.message || 'Unknown error') : 'Unknown error'
                });
            }
        }

        async function confirmAdminUserStatus(userId, nextStatus) {
            const user = getAdminUserById(userId);
            if (!user) return;

            const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || (user.email || 'this user');
            const actionLabel = nextStatus === 'Active' ? 'activate' : 'deactivate';
            const confirmText = nextStatus === 'Active'
                ? 'They will be able to sign in again.'
                : 'They will be unable to sign in.';

            let confirmed = false;
            if (typeof Swal !== 'undefined') {
                const result = await Swal.fire({
                    title: `${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)} account?`,
                    text: `${name}: ${confirmText}`,
                    icon: nextStatus === 'Active' ? 'question' : 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, proceed',
                    cancelButtonText: 'Cancel'
                });
                confirmed = result.isConfirmed;
            } else {
                confirmed = window.confirm(`Are you sure you want to ${actionLabel} ${name}?`);
            }

            if (!confirmed) return;

            try {
                const res = await axios.post(`${baseApiUrl}/admin.php?action=set-user-status`, {
                    user_id: userId,
                    status: nextStatus
                });
                const data = res.data;
                if (!data || !data.success) {
                    const errText = (data && data.error) || 'Failed to update status.';
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({ icon: 'error', title: 'Error', text: errText });
                    } else {
                        alert(errText);
                    }
                    return;
                }
                if (typeof loadAdminUsers === 'function') {
                    await loadAdminUsers();
                }
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: data.message || 'Status updated.',
                        showConfirmButton: false,
                        timer: 2000
                    });
                }
            } catch (error) {
                console.error('Status update failed', error);
                const text = error.response && error.response.data && error.response.data.error
                    ? error.response.data.error
                    : (error.message || 'Request failed.');
                if (typeof Swal !== 'undefined') {
                    Swal.fire({ icon: 'error', title: 'Error', text });
                }
            }
        }

        function setAdminUsersRows(rows) {
            adminUsersTableState.rows = Array.isArray(rows) ? rows : [];
            filterAdminUsers();
            renderAdminUsersTable();
        }

        function filterAdminUsers() {
            const roleFilter = document.getElementById('adminUsersRoleFilter');
            const searchInput = document.getElementById('adminUsersSearch');
            const roleValue = roleFilter ? (roleFilter.value || '').trim() : '';
            const searchValue = searchInput ? (searchInput.value || '').trim().toLowerCase() : '';

            let rows = adminUsersTableState.rows.slice();
            if (roleValue) {
                rows = rows.filter(r => (r.role_name || '').toLowerCase() === roleValue.toLowerCase());
            }
            if (searchValue) {
                rows = rows.filter(r => {
                    const name = `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase();
                    const email = (r.email || '').toLowerCase();
                    const branch = (r.branch_name || '').toLowerCase();
                    return name.includes(searchValue) || email.includes(searchValue) || branch.includes(searchValue);
                });
            }
            adminUsersTableState.filtered = rows;
            adminUsersTableState.page = 1;
        }

        function renderAdminUsersTable() {
            const tbody = document.getElementById('adminUsersTable');
            const infoEl = document.getElementById('adminUsersPaginationInfo');
            const prevBtn = document.getElementById('adminUsersPrevBtn');
            const nextBtn = document.getElementById('adminUsersNextBtn');

            if (!tbody) return;

            const rows = adminUsersTableState.filtered || [];
            const total = rows.length;
            const totalPages = Math.max(1, Math.ceil(total / adminUsersTableState.pageSize));
            if (adminUsersTableState.page > totalPages) adminUsersTableState.page = totalPages;

            const start = (adminUsersTableState.page - 1) * adminUsersTableState.pageSize;
            const end = Math.min(total, start + adminUsersTableState.pageSize);
            const pageRows = rows.slice(start, end);

            if (infoEl) {
                infoEl.textContent = total === 0
                    ? 'No users'
                    : `Page ${adminUsersTableState.page} of ${totalPages} • ${start + 1}-${end} of ${total}`;
            }
            if (prevBtn) prevBtn.disabled = adminUsersTableState.page <= 1 || total === 0;
            if (nextBtn) nextBtn.disabled = adminUsersTableState.page >= totalPages || total === 0;

            if (total === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="px-6 py-8 text-center text-slate-500">
                            <i class="fas fa-inbox text-2xl mb-2 text-gold-500/60"></i>
                            <p>No users found</p>
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = pageRows.map(user => {
                const statusClass = (user.status || '').toLowerCase() === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-amber-50 text-amber-700 border-amber-100';
                const isActive = (user.status || '').toLowerCase() === 'active';
                const toggleLabel = isActive ? 'Deactivate' : 'Activate';
                const toggleClass = isActive ? 'text-amber-700 border-amber-200 hover:bg-amber-50' : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50';
                const toggleIcon = isActive ? 'fa-user-slash' : 'fa-user-check';
                const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || (user.username || 'User');
                const role = user.role_name || '—';
                const branchName = (user.branch_name || '').trim();
                let branch = branchName || '—';
                if (!branchName && ['staff', 'branch manager', 'manager'].includes(role.toLowerCase())) {
                    branch = 'Not assigned';
                }
                const statusLabel = user.status || 'Inactive';

                return `
                    <tr class="hover:bg-slate-50/80 transition">
                        <td class="px-6 py-4">
                            <div class="font-semibold text-slate-900">${escapeHtml(name)}</div>
                            <div class="text-xs text-slate-500">${escapeHtml(user.email || '')}</div>
                        </td>
                        <td class="px-6 py-4 text-slate-700">${escapeHtml(role)}</td>
                        <td class="px-6 py-4 text-slate-700">${escapeHtml(branch)}</td>
                        <td class="px-6 py-4">
                            <span class="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold border ${statusClass}">
                                ${escapeHtml(statusLabel)}
                            </span>
                        </td>
                        <td class="px-6 py-4 space-x-2">
                            <button class="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-slate-200 text-[11px] text-slate-700 hover:bg-slate-100"
                                onclick="openAdminUserEditModal(${Number(user.user_id) || 0})">
                                <i class="fas fa-pen"></i>
                                <span>Edit</span>
                            </button>
                            <button class="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-slate-200 text-[11px] text-slate-700 hover:bg-slate-100"
                                onclick="openAdminUserPasswordModal(${Number(user.user_id) || 0}, '${escapeJsString(name)}')">
                                <i class="fas fa-key"></i>
                                <span>Password</span>
                            </button>
                            <button class="inline-flex items-center gap-1 px-3 py-1 rounded-lg border text-[11px] ${toggleClass}"
                                onclick="confirmAdminUserStatus(${Number(user.user_id) || 0}, '${isActive ? 'Inactive' : 'Active'}')">
                                <i class="fas ${toggleIcon}"></i>
                                <span>${toggleLabel}</span>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        async function submitAdminUserForm(formId, messageId, buttonId, buttonTextId, buttonIconId) {
            const form = document.getElementById(formId);
            if (!form) return;
            const msgEl = document.getElementById(messageId);
            const btn = document.getElementById(buttonId);
            const btnText = document.getElementById(buttonTextId);
            const btnIcon = document.getElementById(buttonIconId);

            const formData = new FormData(form);
            const password = formData.get('password') || '';
            const confirm = formData.get('password_confirm') || '';
            if (password !== confirm) {
                showInlineMessage(msgEl, 'error', 'Passwords do not match.');
                return;
            }

            const payload = {};
            formData.forEach((v, k) => { payload[k] = v; });

            try {
                if (btn && btnText && btnIcon) {
                    btn.disabled = true;
                    btnText.textContent = 'Saving...';
                    btnIcon.classList.remove('fa-user-plus', 'fa-user-tie');
                    btnIcon.classList.add('fa-spinner', 'fa-spin');
                }

                const res = await axios.post(`${baseApiUrl}/admin.php?action=create-user`, payload);
                const data = res.data;
                if (!data || !data.success) {
                    showInlineMessage(msgEl, 'error', (data && data.error) || 'Failed to create user.');
                    return;
                }
                showInlineMessage(msgEl, 'success', data.message || 'User created successfully.');
                form.reset();
                if (typeof loadAdminUsers === 'function') {
                    await loadAdminUsers();
                }
            } catch (error) {
                console.error('Create user failed', error);
                const text = error.response && error.response.data && error.response.data.error
                    ? error.response.data.error
                    : (error.message || 'Request failed.');
                showInlineMessage(msgEl, 'error', text);
            } finally {
                if (btn && btnText && btnIcon) {
                    btn.disabled = false;
                    btnText.textContent = formId === 'adminAddStaffForm' ? 'Create Staff' : 'Create Manager';
                    btnIcon.classList.remove('fa-spinner', 'fa-spin');
                    btnIcon.classList.add(formId === 'adminAddStaffForm' ? 'fa-user-plus' : 'fa-user-tie');
                }
            }
        }

        function bindAdminUsersCreationForms() {
            const staffForm = document.getElementById('adminAddStaffForm');
            if (staffForm) {
                staffForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    submitAdminUserForm('adminAddStaffForm', 'adminAddStaffMessage', 'adminAddStaffSubmit', 'adminAddStaffSubmitText', 'adminAddStaffSubmitIcon');
                });

                const p1 = document.getElementById('adminAddStaffPassword');
                const p2 = document.getElementById('adminAddStaffPasswordConfirm');
                const lbl = document.getElementById('adminAddStaffPasswordMatch');
                const update = () => {
                    if (!p1 || !p2 || !lbl) return;
                    if (!p1.value && !p2.value) {
                        lbl.textContent = '';
                        lbl.className = 'text-[11px] mt-1';
                    } else if (p1.value === p2.value) {
                        lbl.textContent = 'Passwords match.';
                        lbl.className = 'text-[11px] mt-1 text-emerald-600';
                    } else {
                        lbl.textContent = 'Passwords do not match.';
                        lbl.className = 'text-[11px] mt-1 text-red-600';
                    }
                };
                if (p1) p1.addEventListener('input', update);
                if (p2) p2.addEventListener('input', update);
            }

            const managerForm = document.getElementById('adminAddManagerForm');
            if (managerForm) {
                managerForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    submitAdminUserForm('adminAddManagerForm', 'adminAddManagerMessage', 'adminAddManagerSubmit', 'adminAddManagerSubmitText', 'adminAddManagerSubmitIcon');
                });

                const p1 = document.getElementById('adminAddManagerPassword');
                const p2 = document.getElementById('adminAddManagerPasswordConfirm');
                const lbl = document.getElementById('adminAddManagerPasswordMatch');
                const update = () => {
                    if (!p1 || !p2 || !lbl) return;
                    if (!p1.value && !p2.value) {
                        lbl.textContent = '';
                        lbl.className = 'text-[11px] mt-1';
                    } else if (p1.value === p2.value) {
                        lbl.textContent = 'Passwords match.';
                        lbl.className = 'text-[11px] mt-1 text-emerald-600';
                    } else {
                        lbl.textContent = 'Passwords do not match.';
                        lbl.className = 'text-[11px] mt-1 text-red-600';
                    }
                };
                if (p1) p1.addEventListener('input', update);
                if (p2) p2.addEventListener('input', update);
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            bindAdminUsersPage();
            bindAdminUsersCreationForms();
            if (typeof loadAdminUsers === 'function') {
                loadAdminUsers();
            }
        });
