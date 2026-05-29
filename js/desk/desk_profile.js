(function () {
    function getDeskUser() {
        return (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
    }

    function getDisplayName(user) {
        const fullName = `${String(user?.first_name || '').trim()} ${String(user?.last_name || '').trim()}`.trim();
        if (fullName) return fullName;
        return user?.username || user?.email || 'Desk Staff';
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value || '—';
    }

    function fillProfileForm(user) {
        const form = document.getElementById('deskProfileForm');
        if (!form || !user) return;

        form.querySelector('[name="user_id"]').value = user.user_id || '';
        form.querySelector('[name="first_name"]').value = user.first_name || '';
        form.querySelector('[name="last_name"]').value = user.last_name || '';
        form.querySelector('[name="phone"]').value = user.phone || '';
        form.querySelector('[name="email"]').value = user.email || user.username || '';

        setText('deskProfileName', getDisplayName(user));
        setText('deskProfileEmail', user.email || user.username || '—');
        setText('deskProfileRole', user.role_name || 'Desk Staff');
        setText('deskProfileBranch', user.branch_name || '—');
        setText('deskProfileStatus', user.status || 'Active');
        setText('deskProfileUsername', user.username || user.email || '—');
        setText('managerBranchName', user.branch_name || '—');
        setText('managerBranchNamePill', user.branch_name || '—');

        const statusEl = document.getElementById('deskProfileStatusBadge');
        if (statusEl) {
            const isActive = String(user.status || '').toLowerCase() === 'active';
            statusEl.textContent = user.status || 'Active';
            statusEl.className = isActive
                ? 'mt-4 inline-flex px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold'
                : 'mt-4 inline-flex px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-xs font-bold';
        }
    }

    async function saveDeskProfile(event) {
        event.preventDefault();
        const form = document.getElementById('deskProfileForm');
        const messageEl = document.getElementById('deskProfileMessage');
        if (!form) return;

        const userId = Number(form.querySelector('[name="user_id"]')?.value || 0);
        const firstName = String(form.querySelector('[name="first_name"]')?.value || '').trim();
        const lastName = String(form.querySelector('[name="last_name"]')?.value || '').trim();
        const phone = String(form.querySelector('[name="phone"]')?.value || '').trim();

        if (!userId || !firstName || !lastName) {
            if (messageEl) {
                messageEl.className = 'mb-4 p-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200';
                messageEl.textContent = 'First name and last name are required.';
                messageEl.classList.remove('hidden');
            }
            return;
        }

        const submitBtn = document.getElementById('deskProfileSaveBtn');
        if (submitBtn) submitBtn.disabled = true;

        try {
            const response = await axios.post(`${baseApiUrl}/users.php?action=update-self-profile`, {
                user_id: userId,
                first_name: firstName,
                last_name: lastName,
                phone
            });
            const data = response.data;

            if (!data.success) {
                throw new Error(data.error || 'Failed to update profile.');
            }

            const currentUser = getDeskUser() || {};
            const updatedUser = { ...currentUser, ...(data.user || {}) };
            if (typeof Auth !== 'undefined' && Auth.setUser) {
                Auth.setUser(updatedUser);
            }

            fillProfileForm(updatedUser);
            if (typeof syncDeskNavUser === 'function') {
                syncDeskNavUser();
            }

            if (messageEl) {
                messageEl.className = 'mb-4 p-3 rounded-xl text-sm bg-emerald-50 text-emerald-800 border border-emerald-200';
                messageEl.textContent = data.message || 'Profile saved successfully.';
                messageEl.classList.remove('hidden');
            }

            Swal.fire({
                icon: 'success',
                title: 'Profile Saved',
                text: 'Your account details were updated.',
                confirmButtonColor: '#b8860b',
                timer: 1800,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Failed to save desk profile:', error);
            const errMsg = error?.response?.data?.error || error.message || 'Failed to update profile.';
            if (messageEl) {
                messageEl.className = 'mb-4 p-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200';
                messageEl.textContent = errMsg;
                messageEl.classList.remove('hidden');
            }
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (typeof checkBranchScopedAuth === 'function' && !checkBranchScopedAuth()) {
            return;
        }

        const user = getDeskUser();
        if (!user) return;

        fillProfileForm(user);
        document.getElementById('deskProfileForm')?.addEventListener('submit', saveDeskProfile);
        document.getElementById('deskProfileChangePasswordBtn')?.addEventListener('click', function () {
            if (typeof promptDeskPasswordChange === 'function') {
                promptDeskPasswordChange();
            }
        });

        if (typeof syncDeskNavUser === 'function') {
            syncDeskNavUser();
        }
    });
})();
