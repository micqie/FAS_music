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

    function getTopNav() {
        return document.querySelector('body > nav');
    }

    function instructorProfileHtml() {
        return `
            <a href="instructor_profile.html" aria-label="View instructor profile" class="instructor-sidebar-profile flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-left transition hover:border-gold-500/30 hover:bg-white/10">
                <span class="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-gold-500/40 bg-[#1a1d23] text-gold-400 shadow-lg shadow-black/20" aria-hidden="true">
                    <i class="fas fa-user-circle text-4xl"></i>
                </span>
                <div class="min-w-0 flex-1">
                    <p class="instructor-shell-name whitespace-normal break-words text-sm font-bold leading-tight text-white">Instructor</p>
                    <p class="instructor-shell-email mt-0.5 truncate text-xs text-slate-400">—</p>
                    <p class="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-gold-400">Instructor</p>
                </div>
            </a>`;
    }

    function mountSidebarProfiles() {
        const sidebar = document.querySelector('body > aside');
        const sidebarContent = sidebar?.querySelector(':scope > div:not(.fas-sidebar-brand)');
        if (sidebar && sidebarContent && !sidebar.querySelector('[data-instructor-shell-profile]')) {
            sidebar.classList.add('instructor-sidebar');
            const oldTitle = Array.from(sidebarContent.children).find(child =>
                /Instructor Panel/i.test(child.textContent || '')
            );
            oldTitle?.remove();
            const mount = document.createElement('div');
            mount.setAttribute('data-instructor-shell-profile', 'desktop');
            mount.innerHTML = instructorProfileHtml();
            sidebarContent.prepend(mount);
        }

        const mobilePanel = document.querySelector('#instructorMobileMenu > div:last-child');
        if (mobilePanel && !mobilePanel.querySelector('[data-instructor-shell-profile]')) {
            const oldTitle = Array.from(mobilePanel.children).find(child =>
                /Instructor Panel/i.test(child.textContent || '')
            );
            oldTitle?.remove();
            const mount = document.createElement('div');
            mount.className = 'instructor-mobile-profile';
            mount.setAttribute('data-instructor-shell-profile', 'mobile');
            mount.innerHTML = instructorProfileHtml();
            mobilePanel.classList.add('instructor-mobile-panel');
            mobilePanel.prepend(mount);
        }
    }

    function mountDesktopSidebarToggle() {
        const sidebar = document.querySelector('body > aside.instructor-sidebar');
        const content = sidebar?.querySelector(':scope > div:not(.fas-sidebar-brand)');
        if (!content || content.querySelector('.instructor-sidebar-toggle')) return;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'instructor-sidebar-toggle';
        button.setAttribute('aria-controls', 'instructorSidebarLinks');
        button.innerHTML = '<i class="fas fa-bars" aria-hidden="true"></i>';
        const header = document.createElement('div');
        header.className = 'instructor-sidebar-header';
        header.appendChild(button);
        const heading = document.createElement('div');
        heading.className = 'instructor-sidebar-heading';
        heading.innerHTML = '<span>Teaching Portal</span><span class="instructor-sidebar-gold-line" aria-hidden="true"></span>';
        header.appendChild(heading);
        content.prepend(header);
        const profile = content.querySelector('[data-instructor-shell-profile="desktop"]');
        if (profile) header.insertAdjacentElement('afterend', profile);

        const nav = content.querySelector('nav');
        if (nav) {
            nav.id = 'instructorSidebarLinks';
            nav.querySelector('a[href="instructor_profile.html"]')?.remove();
            nav.querySelectorAll('a').forEach(link => {
                link.title = link.textContent.trim();
            });
        }
        const mobilePanelProfileLink = document.querySelector('#instructorMobileMenu nav a[href="instructor_profile.html"]');
        mobilePanelProfileLink?.remove();

        let collapsed = false;
        try { collapsed = localStorage.getItem('fasInstructorSidebarCollapsed') === 'true'; } catch (_) {}
        const setCollapsed = value => {
            collapsed = value;
            document.body.classList.toggle('instructor-sidebar-collapsed', collapsed);
            button.setAttribute('aria-expanded', String(!collapsed));
            button.setAttribute('aria-label', collapsed ? 'Expand instructor sidebar' : 'Collapse instructor sidebar');
            button.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
            try { localStorage.setItem('fasInstructorSidebarCollapsed', String(collapsed)); } catch (_) {}
        };
        button.addEventListener('click', () => setCollapsed(!collapsed));
        setCollapsed(collapsed);
    }

    function getMobileMenu() {
        return document.getElementById('instructorMobileMenu');
    }

    function getMenuIcon() {
        return document.getElementById('instructorMenuIcon');
    }

    function setMobileMenuState(open) {
        const menu = getMobileMenu();
        const icon = getMenuIcon();
        const button = icon?.closest('button');
        if (!menu || !icon) return;

        menu.classList.toggle('hidden', !open);
        icon.classList.toggle('fa-bars', !open);
        icon.classList.toggle('fa-times', open);
        button?.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.classList.toggle('instructor-menu-open', open);
        document.body.style.overflow = open ? 'hidden' : '';
    }

    function syncTopNavLayout() {
        const nav = getTopNav();
        if (!nav) return;

        const isMobile = window.innerWidth < 1024;
        nav.style.padding = isMobile ? '0.65rem 1rem' : '';
        nav.style.gap = isMobile ? '0.75rem' : '';
        nav.style.minHeight = isMobile ? '4.5rem' : '';

        const leftGroup = nav.firstElementChild;
        const rightGroup = nav.lastElementChild;
        leftGroup?.classList.add('min-w-0');
        rightGroup?.classList.add('min-w-0');

        const logo = nav.querySelector('img');
        if (logo) logo.classList.add('shrink-0');

        const profileMount = document.getElementById('instructorProfileIconMount');
        if (profileMount) profileMount.classList.add('shrink-0');
    }

    function closeMobileMenu() {
        setMobileMenuState(false);
    }

    function toggleMobileMenu() {
        const menu = getMobileMenu();
        if (!menu) return;
        const shouldOpen = menu.classList.contains('hidden');
        setMobileMenuState(shouldOpen);
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
                <div class="absolute right-0 mt-3 w-60 rounded-2xl border border-white/10 bg-[#0f1115] backdrop-blur-md shadow-2xl overflow-hidden
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

        const nameLength = Array.from(String(name).trim()).length;
        const nameFontSize = nameLength > 38 ? '11px' : nameLength > 27 ? '12px' : nameLength > 18 ? '13px' : '14px';
        document.querySelectorAll('.instructor-shell-name').forEach(node => {
            node.textContent = name;
            node.style.fontSize = nameFontSize;
            node.title = name;
        });
        document.querySelectorAll('.instructor-shell-email').forEach(node => { node.textContent = user?.email || user?.username || '—'; });
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
            await Swal.fire({ icon: 'success', title: 'Password Updated', text: 'Sign in again with your new password.', confirmButtonColor: '#b8860b' });
            Auth.clearStoredUser();
            Auth.redirectToLogin();
        } catch (err) {
            console.error('Instructor password change error:', err);
            Swal.fire({ icon: 'error', title: 'Error', text: 'An unexpected error occurred.', confirmButtonColor: '#b8860b' });
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        syncTopNavLayout();
        window.toggleInstructorMenu = toggleMobileMenu;
        mountSidebarProfiles();
        mountDesktopSidebarToggle();
        mountDropdown();
        syncNav();

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeMobileMenu();
        });

        window.addEventListener('resize', function () {
            if (window.innerWidth >= 1024) closeMobileMenu();
            syncTopNavLayout();
        });

        document.querySelectorAll('#instructorMobileMenu a').forEach(function (link) {
            link.addEventListener('click', function () {
                if (window.innerWidth < 1024) closeMobileMenu();
            });
        });

        const overlay = document.querySelector('#instructorMobileMenu > div.absolute.inset-0');
        overlay?.addEventListener('click', closeMobileMenu);
    });
})();
