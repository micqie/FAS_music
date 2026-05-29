(function () {
    function getDeskUser() {
        if (typeof Auth !== 'undefined' && Auth.getUser) {
            return Auth.getUser();
        }
        return null;
    }

    function getDeskDisplayName(user) {
        if (!user) return 'Desk Staff';
        const fullName = `${String(user.first_name || '').trim()} ${String(user.last_name || '').trim()}`.trim();
        if (fullName) return fullName;
        return user.username || user.email || 'Desk Staff';
    }

    function renderDeskTopNav() {
        const mount = document.getElementById('deskTopNavMount');
        if (!mount || mount.dataset.ready === '1') return;
        mount.dataset.ready = '1';

        mount.outerHTML = `
            <header id="deskTopNav" class="desk-topnav sticky top-0 z-40 shrink-0 border-b border-white/10 px-4 sm:px-6 lg:px-8">
                <div class="min-h-16 py-3 flex items-center justify-between gap-4">
                    <div class="flex items-center gap-3 min-w-0">
                        <a href="desk_scanner.html" class="lg:hidden h-9 flex items-center shrink-0" aria-label="Desk home">
                            <img src="../../assets/fas-logo.png" alt="FAS Music" class="h-full w-auto brightness-200">
                        </a>
                        <div class="min-w-0 flex flex-col gap-1.5">

                            <div id="deskTopNavBranch" class="desk-topnav-branch inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 w-fit">Branch:
                                <i class="fas fa-location-dot text-gold-400"></i>
                                <span id="deskTopNavBranchName">—</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 sm:gap-4 shrink-0">
                        <div class="hidden md:flex flex-col text-right">
                            <span id="userNameNav" class="text-sm font-semibold text-white truncate max-w-[12rem]">Desk Staff</span>
                            <span class="text-[10px] uppercase tracking-widest text-gold-400 font-bold">Desk Staff</span>
                        </div>
                        <details class="relative group/desk-profile">
                            <summary class="list-none cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60" aria-label="Account menu">
                                <div class="h-10 w-10 rounded-full border-2 border-gold-500/35 p-0.5">
                                    <div class="w-full h-full rounded-full bg-[#1a1d23] flex items-center justify-center">
                                        <i class="fas fa-user text-gold-400"></i>
                                    </div>
                                </div>
                            </summary>
                            <div class="absolute right-0 mt-3 w-60 rounded-2xl border border-white/10 bg-[#0f1115]/98 backdrop-blur-md shadow-2xl overflow-hidden opacity-0 pointer-events-none group-open/desk-profile:opacity-100 group-open/desk-profile:pointer-events-auto transition-all">
                                <div class="px-4 py-3 border-b border-white/10">
                                    <p id="profileMenuName" class="text-sm font-semibold text-white truncate">Desk Staff</p>
                                    <p id="deskProfileMenuEmail" class="mt-1 text-xs text-slate-400 truncate">—</p>
                                </div>
                                <a href="desk_profile.html" class="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/5 transition">
                                    <i class="fas fa-user-pen text-gold-400 w-4 text-center"></i>
                                    Edit Profile
                                </a>
                                <button type="button" id="deskChangePasswordBtn" class="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/5 transition text-left">
                                    <i class="fas fa-key text-gold-400 w-4 text-center"></i>
                                    Change Password
                                </button>
                                <button type="button" onclick="logout()" class="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-red-300 hover:text-red-200 hover:bg-red-400/10 transition text-left border-t border-white/10">
                                    <i class="fas fa-sign-out-alt w-4 text-center"></i>
                                    Sign Out
                                </button>
                            </div>
                        </details>
                    </div>
                </div>
            </header>
        `;

        document.getElementById('deskChangePasswordBtn')?.addEventListener('click', promptDeskPasswordChange);
    }

    function syncDeskNavUser() {
        const user = getDeskUser();
        const displayName = getDeskDisplayName(user);
        const userNameNav = document.getElementById('userNameNav');
        const profileMenuName = document.getElementById('profileMenuName');
        const profileMenuEmail = document.getElementById('deskProfileMenuEmail');
        const branchNameEl = document.getElementById('deskTopNavBranchName');
        const branchWrap = document.getElementById('deskTopNavBranch');

        if (userNameNav) userNameNav.textContent = displayName;
        if (profileMenuName) profileMenuName.textContent = displayName;
        if (profileMenuEmail) profileMenuEmail.textContent = user?.email || user?.username || '—';

        const branchName = user?.branch_name || '';
        if (branchNameEl) branchNameEl.textContent = branchName || '—';
        if (branchWrap) branchWrap.classList.toggle('hidden', !branchName);
    }

    async function promptDeskPasswordChange() {
        const user = getDeskUser();
        if (!user?.user_id) {
            Swal.fire({ icon: 'warning', title: 'Not signed in', text: 'Please log in again.', confirmButtonColor: '#b8860b' });
            return;
        }

        const stepOne = await Swal.fire({
            title: 'Change Password',
            html:
                '<input id="desk-old-password" class="swal2-input" type="password" placeholder="Current password">' +
                '<input id="desk-new-password" class="swal2-input" type="password" placeholder="New password">' +
                '<input id="desk-confirm-password" class="swal2-input" type="password" placeholder="Confirm new password">',
            focusConfirm: false,
            confirmButtonText: 'Update Password',
            confirmButtonColor: '#b8860b',
            preConfirm: () => {
                const oldPassword = document.getElementById('desk-old-password')?.value || '';
                const newPassword = document.getElementById('desk-new-password')?.value || '';
                const confirmPassword = document.getElementById('desk-confirm-password')?.value || '';

                if (!oldPassword || !newPassword || !confirmPassword) {
                    Swal.showValidationMessage('Please fill in all password fields.');
                    return false;
                }
                if (newPassword !== confirmPassword) {
                    Swal.showValidationMessage('New passwords do not match.');
                    return false;
                }
                if (newPassword.length < 8 ||
                    !/[A-Z]/.test(newPassword) ||
                    !/[a-z]/.test(newPassword) ||
                    !/[0-9]/.test(newPassword) ||
                    !/[!@#$%^&*]/.test(newPassword)) {
                    Swal.showValidationMessage('Password must meet all complexity requirements.');
                    return false;
                }
                return { oldPassword, newPassword };
            }
        });

        if (!stepOne.value) return;

        try {
            const response = await axios.post(`${baseApiUrl}/users.php?action=change-password`, {
                user_id: user.user_id,
                old_password: stepOne.value.oldPassword,
                new_password: stepOne.value.newPassword
            });
            const result = response.data;
            if (!result.success) {
                Swal.fire({
                    icon: 'error',
                    title: 'Password Change Failed',
                    text: result.error || 'Unable to change password.',
                    confirmButtonColor: '#b8860b'
                });
                return;
            }
            Swal.fire({
                icon: 'success',
                title: 'Password Updated',
                text: 'Your password has been changed successfully.',
                confirmButtonColor: '#b8860b'
            });
        } catch (error) {
            console.error('Desk password change failed:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'An unexpected error occurred. Please try again.',
                confirmButtonColor: '#b8860b'
            });
        }
    }

    window.syncDeskNavUser = syncDeskNavUser;
    window.promptDeskPasswordChange = promptDeskPasswordChange;

    document.addEventListener('DOMContentLoaded', function () {
        if (!document.body.classList.contains('desk-app')) return;
        renderDeskTopNav();
        syncDeskNavUser();
    });
})();
