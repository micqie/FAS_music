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
                <div class="min-h-16 py-3 flex items-center justify-between gap-3">

                    <!-- Left: hamburger + logo -->
                    <div class="flex items-center gap-3 shrink-0">
                        <button id="deskMenuToggle" aria-label="Open navigation menu"
                            class="h-10 w-10 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 active:scale-95 transition shrink-0">
                            <i class="fas fa-bars text-base"></i>
                        </button>
                        <a href="desk_scanner.html" class="h-9 flex items-center shrink-0" aria-label="Father & Sons Music home">
                            <img src="../../assets/fas-logo.png" alt="FAS Music" class="h-full w-auto brightness-200 object-contain">
                        </a>
                    </div>

                    <!-- Right: branch pill + user block + profile dropdown -->
                    <div class="flex items-center gap-2 sm:gap-3 shrink-0">

                        <!-- Branch pill — styled exactly like screenshot -->
                        <div id="deskTopNavBranch"
                            class="flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2.5 shrink-0">
                            <i class="fas fa-location-dot text-gold-400 text-sm"></i>
                            <span id="deskTopNavBranchName" class="text-sm font-semibold text-white whitespace-nowrap">—</span>
                        </div>

                        <!-- User block + dropdown trigger -->
                        <details class="relative group/desk-profile shrink-0">
                            <summary class="list-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60" aria-label="Account menu">
                                <div class="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 pl-2 pr-3 py-1.5 hover:bg-white/10 transition">
                                    <!-- Circle avatar -->
                                    <div class="h-8 w-8 rounded-full bg-[#2a1f00] border border-gold-500/50 flex items-center justify-center shrink-0">
                                        <i class="fas fa-user text-gold-400 text-xs"></i>
                                    </div>
                                    <!-- Name + role -->
                                    <div class="hidden sm:flex flex-col leading-tight text-left">
                                        <span id="userNameNav" class="text-sm font-bold text-white truncate max-w-[9rem]">Desk Staff</span>
                                        <span class="text-[10px] uppercase tracking-widest text-gold-400 font-bold">Desk Staff</span>
                                    </div>
                                    <!-- Chevron -->
                                    <i class="fas fa-chevron-down text-slate-400 text-[10px] hidden sm:block transition-transform group-open/desk-profile:rotate-180"></i>
                                </div>
                            </summary>

                            <!-- Dropdown menu -->
                            <div class="absolute right-0 mt-2.5 w-64 rounded-2xl border border-white/10 bg-[#0f1115]/98 backdrop-blur-md shadow-2xl overflow-hidden
                                        opacity-0 pointer-events-none group-open/desk-profile:opacity-100 group-open/desk-profile:pointer-events-auto
                                        transition-all duration-150 z-50">
                                <!-- User info header -->
                                <div class="flex items-center gap-3 px-4 py-3.5 border-b border-white/10">
                                    <div class="h-9 w-9 rounded-full bg-[#2a1f00] border border-gold-500/40 flex items-center justify-center shrink-0">
                                        <i class="fas fa-user text-gold-400 text-sm"></i>
                                    </div>
                                    <div class="min-w-0">
                                        <p id="profileMenuName" class="text-sm font-bold text-white truncate">Desk Staff</p>
                                        <p id="deskProfileMenuEmail" class="text-xs text-slate-400 truncate">—</p>
                                    </div>
                                </div>
                                <a href="desk_profile.html" class="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/5 transition">
                                    <i class="fas fa-user-pen text-gold-400 w-4 text-center"></i>
                                    Edit Profile
                                </a>
                                <button type="button" id="deskChangePasswordBtn"
                                    class="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/5 transition text-left">
                                    <i class="fas fa-key text-gold-400 w-4 text-center"></i>
                                    Change Password
                                </button>
                                <button type="button" onclick="logout()"
                                    class="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-300 hover:text-red-200 hover:bg-red-400/10 transition text-left border-t border-white/10">
                                    <i class="fas fa-sign-out-alt w-4 text-center"></i>
                                    Sign Out
                                </button>
                            </div>
                        </details>
                    </div>

                </div>
            </header>

            <!-- ── Slide-out drawer overlay ── -->
            <div id="deskDrawerOverlay"
                class="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm hidden"
                aria-hidden="true"></div>

            <!-- ── Slide-out drawer ── -->
            <div id="deskDrawer"
                class="fixed inset-y-0 left-0 z-[60] w-72 flex flex-col
                       bg-gradient-to-b from-[#0b0f18] via-[#101827] to-[#0d1320]
                       border-r border-gold-500/15 shadow-2xl
                       translate-x-[-100%] transition-transform duration-300 ease-in-out"
                role="dialog" aria-modal="true" aria-label="Navigation menu">

                <!-- Drawer header — logo only, no "Father & Sons" text, no branch -->
                <div class="flex items-center justify-between px-5 py-4 border-b border-white/8">
                    <div class="flex items-center gap-3">
                        <img src="../../assets/fas-logo.png" alt="FAS" class="h-8 w-auto brightness-200 object-contain">
                        <span class="text-[10px] uppercase tracking-widest text-gold-400 font-bold">Desk Staff</span>
                    </div>
                    <button id="deskDrawerClose" aria-label="Close menu"
                        class="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition">
                        <i class="fas fa-times text-base"></i>
                    </button>
                </div>

                <!-- Nav links — NO branch pill here -->
                <nav class="flex-1 overflow-y-auto px-4 py-4 space-y-1" id="deskDrawerNav">
                    <a href="desk_attendance.html"    data-page="attendance"   class="desk-drawer-link flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-300 hover:bg-white/8 hover:text-white transition">
                        <i class="fas fa-clipboard-check w-5 text-center text-slate-400"></i> Attendance
                    </a>
                    <a href="desk_makeup.html"        data-page="makeup"       class="desk-drawer-link flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-300 hover:bg-white/8 hover:text-white transition">
                        <i class="fas fa-triangle-exclamation w-5 text-center text-slate-400"></i> Make-Up List
                    </a>
                    <a href="desk_scanner.html"       data-page="scanner"      class="desk-drawer-link flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-300 hover:bg-white/8 hover:text-white transition">
                        <i class="fas fa-qrcode w-5 text-center text-slate-400"></i> Scanner
                    </a>
                    <a href="desk_enrollment.html?view=active" data-page="enrollment" class="desk-drawer-link flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-300 hover:bg-white/8 hover:text-white transition">
                        <i class="fas fa-user-graduate w-5 text-center text-slate-400"></i> Enrollments
                    </a>
                    <a href="desk_sessions.html?page=sessions" data-page="sessions" class="desk-drawer-link flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-300 hover:bg-white/8 hover:text-white transition">
                        <i class="fas fa-calendar-check w-5 text-center text-slate-400"></i> Sessions
                    </a>
                    <a href="desk_registration.html"  data-page="registration" class="desk-drawer-link flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-300 hover:bg-white/8 hover:text-white transition">
                        <i class="fas fa-id-card w-5 text-center text-slate-400"></i> Registrations
                    </a>
                    <a href="desk_freezeaccounts.html" data-page="freezeaccounts" class="desk-drawer-link flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-300 hover:bg-white/8 hover:text-white transition">
                        <i class="fas fa-snowflake w-5 text-center text-slate-400"></i> Frozen Accounts
                    </a>
                    <a href="desk_featured_posts.html" data-page="featured"    class="desk-drawer-link flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-300 hover:bg-white/8 hover:text-white transition">
                        <i class="fas fa-photo-film w-5 text-center text-slate-400"></i> Featured Posts
                    </a>
                </nav>

            
            </div>
        `;

        document.getElementById('deskChangePasswordBtn')?.addEventListener('click', promptDeskPasswordChange);

        // ── Drawer toggle logic ──
        const toggle  = document.getElementById('deskMenuToggle');
        const drawer  = document.getElementById('deskDrawer');
        const overlay = document.getElementById('deskDrawerOverlay');
        const closeBtn = document.getElementById('deskDrawerClose');

        function openDrawer() {
            drawer.classList.remove('translate-x-[-100%]');
            overlay.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
        function closeDrawer() {
            drawer.classList.add('translate-x-[-100%]');
            overlay.classList.add('hidden');
            document.body.style.overflow = '';
        }

        toggle?.addEventListener('click', openDrawer);
        closeBtn?.addEventListener('click', closeDrawer);
        overlay?.addEventListener('click', closeDrawer);
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

        // Highlight the current page link
        const page = window.location.pathname.split('/').pop().replace('.html','').replace('desk_','');
        document.querySelectorAll('.desk-drawer-link').forEach(a => {
            const linkPage = a.dataset.page || '';
            if (page && linkPage && page.includes(linkPage)) {
                a.classList.remove('text-slate-300');
                a.classList.add('bg-white/10', 'text-white', 'font-semibold', 'border', 'border-gold-500/25');
                a.querySelector('i')?.classList.replace('text-slate-400', 'text-gold-400');
            }
        });
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
        // Keep the branch badge always visible — don't hide it
        if (branchWrap) branchWrap.classList.remove('hidden');

        // Also sync drawer user info (no branch in drawer — it's in the top nav only)
        const drawerName  = document.getElementById('deskDrawerUserName');
        const drawerEmail = document.getElementById('deskDrawerUserEmail');
        if (drawerName)  drawerName.textContent  = displayName;
        if (drawerEmail) drawerEmail.textContent = user?.email || user?.username || '—';
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
