/**
 * Shared instructor navbar profile dropdown
 * Handles: profile link, change password, sign out
 */
(function () {
    function getInstructorUser() {
        if (typeof Auth !== 'undefined' && Auth.getUser) return Auth.getUser();
        return null;
    }

    function getDisplayName(user) {
        if (!user) return 'Instructor';
        const full = `${String(user.first_name || '').trim()} ${String(user.last_name || '').trim()}`.trim();
        return full || user.username || user.email || 'Instructor';
    }

    /** Inject the dropdown HTML in place of the static icon */
    function mountDropdown() {
        const anchor = document.getElementById('instructorProfileIconMount');
        if (!anchor || anchor.dataset.ready === '1') return;
        anchor.dataset.ready = '1';

        anchor.outerHTML = `
            <details id="instructorProfileDetails" class="relative group/instr-profile">
                <summary class="list-none cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60" aria-label="Account menu">
                    <div class="h-10 w-10 rounded-full border-2 border-gold-500/30 p-0.5 hover:border-gold-400 transition-colors">
                        <div class="w-full h-full rounded-full bg-[#1a1d23] flex items-center justify-center">
                            <i class="fas fa-guitar text-gold-400 text-sm"></i>
                        </div>
                    </div>
                </summary>
                <div class="absolute right-0 mt-3 w-60 rounded-2xl border border-white/10 bg-[#0f1115]/98 backdrop-blur-md shadow-2xl overflow-hidden
                            opacity-0 pointer-events-none
                            group-open/instr-profile:opacity-100 group-open/instr-profile:pointer-events-auto
                            transition-all duration-150 z-50">
                    <!-- User info -->
                    <div class="px-4 py-3 border-b border-white/10">
                        <p id="instrProfileMenuName" class="text-sm font-semibold text-white truncate">Instructor</p>
                        <p id="instrProfileMenuEmail" class="mt-0.5 text-xs text-slate-400 truncate">—</p>
                    </div>
                    <!-- Profile -->
                    <a href="instructor_profile.html" class="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/5 transition">
                        <i class="fas fa-user-pen text-gold-400 w-4 text-center"></i>
                        View Profile
                    </a>
                    <!-- Change password -->
                    <button type="button" id="instrChangePasswordBtn"
                        class="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/5 transition text-left">
                        <i class="fas fa-key text-gold-400 w-4 text-center"></i>
                        Change Password
                    </button>
                    <!-- Sign out -->
                    <button type="button" onclick="logout()"
                        class="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-red-300 hover:text-red-200 hover:bg-red-400/10 transition text-left border-t border-white/10">
                        <i class="fas fa-sign-out-alt w-4 text-center"></i>
                        Sign Out
                    </button>
                </div>
            </details>
        `;

        // Close dropdown when clicking outside
        document.addEventListener('click', function (e) {
            const details = document.getElementById('instructorProfileDetails');
            if (details && !details.contains(e.target)) details.removeAttribute('open');
        });

        document.getElementById('instrChangePasswordBtn')?.addEventListener('click', promptInstructorPasswordChange);
    }

    /** Populate name/email once Auth is ready */
    function syncNav() {
        const user = getInstructorUser();
        const name = getDisplayName(user);

        // Top nav name (existing span on each page)
        const nameNav = document.getElementById('instructorNameNav');
        if (nameNav) nameNav.textContent = name;

        // Dropdown name + email
        const menuName  = document.getElementById('instrProfileMenuName');
        const menuEmail = document.getElementById('instrProfileMenuEmail');
        if (menuName)  menuName.textContent  = name;
        if (menuEmail) menuEmail.textContent = user?.email || user?.username || '—';
    }

    async function promptInstructorPasswordChange() {
        // Close the dropdown first
        document.getElementById('instructorProfileDetails')?.removeAttribute('open');

        const user = getInstructorUser();
        if (!user?.user_id) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'warning', title: 'Not signed in', text: 'Please log in again.', confirmButtonColor: '#b8860b' });
            }
            return;
        }

        if (typeof Swal === 'undefined') {
            alert('SweetAlert2 is not loaded. Please refresh and try again.');
            return;
        }

        const result = await Swal.fire({
            title: 'Change Password',
            html:
                '<input id="instr-old-pw" class="swal2-input" type="password" placeholder="Current password">' +
                '<input id="instr-new-pw" class="swal2-input" type="password" placeholder="New password">' +
                '<input id="instr-confirm-pw" class="swal2-input" type="password" placeholder="Confirm new password">',
            focusConfirm: false,
            confirmButtonText: 'Update Password',
            confirmButtonColor: '#b8860b',
            preConfirm: () => {
                const oldPw     = document.getElementById('instr-old-pw')?.value || '';
                const newPw     = document.getElementById('instr-new-pw')?.value || '';
                const confirmPw = document.getElementById('instr-confirm-pw')?.value || '';
                if (!oldPw || !newPw || !confirmPw) {
                    Swal.showValidationMessage('Please fill in all fields.');
                    return false;
                }
                if (newPw !== confirmPw) {
                    Swal.showValidationMessage('New passwords do not match.');
                    return false;
                }
                if (newPw.length < 8 ||
                    !/[A-Z]/.test(newPw) || !/[a-z]/.test(newPw) ||
                    !/[0-9]/.test(newPw) || !/[!@#$%^&*]/.test(newPw)) {
                    Swal.showValidationMessage('Password must be 8+ chars with upper, lower, number and special character (!@#$%^&*).');
                    return false;
                }
                return { oldPw, newPw };
            }
        });

        if (!result.value) return;

        try {
            const response = await axios.post(`${baseApiUrl}/users.php?action=change-password`, {
                user_id:      user.user_id,
                old_password: result.value.oldPw,
                new_password: result.value.newPw
            });
            const data = response.data;
            if (!data.success) {
                Swal.fire({ icon: 'error', title: 'Failed', text: data.error || 'Unable to change password.', confirmButtonColor: '#b8860b' });
                return;
            }
            Swal.fire({ icon: 'success', title: 'Password Updated', text: 'Your password has been changed.', confirmButtonColor: '#b8860b' });
        } catch (err) {
            console.error('Instructor password change error:', err);
            Swal.fire({ icon: 'error', title: 'Error', text: 'An unexpected error occurred.', confirmButtonColor: '#b8860b' });
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        mountDropdown();
        syncNav();
    });
})();
