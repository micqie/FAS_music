(() => {
    const shellRole = String(document.body?.dataset?.shellRole || 'manager').toLowerCase();
    const displayRoleName = shellRole === 'desk'
        ? 'Desk Staff'
        : 'Branch Manager';

    const PROFILE_HTML = `
        <div class="manager-sidebar-profile flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-left">
            <span class="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-gold-500/40 bg-[#1a1d23] text-gold-400 shadow-lg shadow-black/20" aria-hidden="true">
                <i class="fas fa-user-circle text-4xl"></i>
            </span>
            <div class="min-w-0 flex-1">
                <p class="manager-shell-name whitespace-normal break-words text-sm font-bold leading-tight text-white">${displayRoleName}</p>
                <p class="manager-shell-email mt-0.5 truncate text-xs text-slate-400">email@example.com</p>
                <p class="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-gold-400">${displayRoleName}</p>
            </div>
        </div>
    `;

    function setText(target, value) {
        if (!target) return;
        target.textContent = value;
    }

    function updateBranchLabels(branchName) {
        const value = branchName || '—';
        document.querySelectorAll(
            '.manager-shell-branch, [data-manager-shell-branch], #managerBranchName, #managerBranchNameSidebar, #managerBranchNamePill, #managerBranchNotice, #profileMenuBranch'
        ).forEach((node) => setText(node, value));
    }

    function updateUserLabels(displayName) {
        const value = displayName || displayRoleName;
        document.querySelectorAll(
            '#managerNameNav, #userNameNav, #profileMenuName, .manager-shell-name'
        ).forEach((node) => setText(node, value));
        const length = Array.from(String(value).trim()).length;
        const fontSize = length > 38 ? '11px' : length > 27 ? '12px' : length > 18 ? '13px' : '14px';
        document.querySelectorAll('.manager-shell-name').forEach(node => {
            node.style.fontSize = fontSize;
            node.title = value;
        });
    }

    function updateEmailLabel(email) {
        const value = email || '';
        document.querySelectorAll('.manager-shell-email').forEach((node) => setText(node, value));
    }

    function mountProfileBlock() {
        document.querySelectorAll('[data-manager-shell-profile]').forEach((node) => {
            node.innerHTML = PROFILE_HTML;
        });
    }

    function mountFrozenAccountsLink() {
        const sidebar = document.querySelector('body > aside');
        const managementNav = sidebar?.querySelector('nav');
        if (!managementNav || managementNav.querySelector('a[href*="manager_frozen_accounts.html"]')) return;
        const link = document.createElement('a');
        link.href = 'manager_frozen_accounts.html';
        link.className = 'flex items-center px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all group';
        link.innerHTML = '<i class="fas fa-snowflake mr-3 text-slate-500 group-hover:text-gold-400 transition-colors"></i> Frozen Accounts';
        const sessionsLink = managementNav.querySelector('a[href*="manager_sessions.html"]');
        if (sessionsLink) sessionsLink.insertAdjacentElement('afterend', link);
        else managementNav.appendChild(link);
    }

    function mountManagerNavigation() {
        const sidebar = document.querySelector('body > aside');
        const topbar = document.querySelector('body > nav');
        const content = sidebar?.querySelector(':scope > div:not(.fas-sidebar-brand)');
        if (!sidebar || !topbar || !content || sidebar.classList.contains('manager-sidebar')) return;
        sidebar.classList.add('manager-sidebar');
        sidebar.id = sidebar.id || 'managerSidebar';

        const header = document.createElement('div');
        header.className = 'manager-sidebar-header';
        const desktopToggle = document.createElement('button');
        desktopToggle.type = 'button';
        desktopToggle.className = 'manager-sidebar-toggle';
        desktopToggle.setAttribute('aria-controls', 'managerSidebarLinks');
        desktopToggle.innerHTML = '<i class="fas fa-bars" aria-hidden="true"></i>';
        header.appendChild(desktopToggle);
        const heading = document.createElement('div');
        heading.className = 'manager-sidebar-heading';
        heading.innerHTML = '<span>Manager Portal</span><span class="manager-sidebar-gold-line" aria-hidden="true"></span>';
        header.appendChild(heading);
        content.prepend(header);

        const links = content.querySelector('nav');
        if (links) {
            links.id = 'managerSidebarLinks';
            links.querySelectorAll('a').forEach(link => { link.title = link.textContent.trim(); });
        }

        let collapsed = false;
        try { collapsed = localStorage.getItem('fasManagerSidebarCollapsed') === 'true'; } catch (_) {}
        const setCollapsed = value => {
            collapsed = value;
            document.body.classList.toggle('manager-sidebar-collapsed', collapsed);
            desktopToggle.setAttribute('aria-expanded', String(!collapsed));
            desktopToggle.setAttribute('aria-label', collapsed ? 'Expand manager sidebar' : 'Collapse manager sidebar');
            desktopToggle.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
            try { localStorage.setItem('fasManagerSidebarCollapsed', String(collapsed)); } catch (_) {}
        };
        desktopToggle.addEventListener('click', () => {
            if (window.innerWidth < 1024) {
                closeMobile();
                return;
            }
            setCollapsed(!collapsed);
        });
        setCollapsed(collapsed);

        const backdrop = document.createElement('button');
        backdrop.type = 'button';
        backdrop.className = 'manager-sidebar-backdrop';
        backdrop.setAttribute('aria-label', 'Close manager navigation');
        document.body.appendChild(backdrop);

        const mobileToggle = document.createElement('button');
        mobileToggle.type = 'button';
        mobileToggle.className = 'manager-mobile-menu-toggle';
        mobileToggle.setAttribute('aria-controls', sidebar.id);
        mobileToggle.setAttribute('aria-expanded', 'false');
        mobileToggle.setAttribute('aria-label', 'Open manager navigation');
        mobileToggle.innerHTML = '<i class="fas fa-bars" aria-hidden="true"></i>';
        const topbarLeft = topbar.firstElementChild;
        if (topbarLeft) topbarLeft.prepend(mobileToggle);

        const closeMobile = () => {
            document.body.classList.remove('manager-menu-open');
            mobileToggle.setAttribute('aria-expanded', 'false');
            mobileToggle.setAttribute('aria-label', 'Open manager navigation');
            mobileToggle.querySelector('i')?.classList.replace('fa-xmark', 'fa-bars');
            desktopToggle.setAttribute('aria-label', collapsed ? 'Expand manager sidebar' : 'Collapse manager sidebar');
            desktopToggle.querySelector('i')?.classList.replace('fa-xmark', 'fa-bars');
        };
        mobileToggle.addEventListener('click', () => {
            const open = !document.body.classList.contains('manager-menu-open');
            document.body.classList.toggle('manager-menu-open', open);
            mobileToggle.setAttribute('aria-expanded', String(open));
            mobileToggle.setAttribute('aria-label', open ? 'Close manager navigation' : 'Open manager navigation');
            mobileToggle.querySelector('i')?.classList.toggle('fa-bars', !open);
            mobileToggle.querySelector('i')?.classList.toggle('fa-xmark', open);
            desktopToggle.setAttribute('aria-label', open ? 'Close manager navigation' : (collapsed ? 'Expand manager sidebar' : 'Collapse manager sidebar'));
            desktopToggle.querySelector('i')?.classList.toggle('fa-bars', !open);
            desktopToggle.querySelector('i')?.classList.toggle('fa-xmark', open);
        });
        backdrop.addEventListener('click', closeMobile);
        sidebar.addEventListener('click', event => {
            if (event.target.closest('a[href]')) closeMobile();
        });
        document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMobile(); });
        window.addEventListener('resize', () => { if (window.innerWidth >= 1024) closeMobile(); });
    }

    window.syncManagerShell = function syncManagerShell(displayName, branchName, email) {
        if (typeof displayName !== 'undefined') {
            updateUserLabels(displayName);
        }
        if (typeof branchName !== 'undefined') {
            updateBranchLabels(branchName);
        }
        if (typeof email !== 'undefined') {
            updateEmailLabel(email);
        }
    };

    window.syncManagerBranchLabels = updateBranchLabels;
    window.syncManagerUserLabels = updateUserLabels;

    const bootstrap = () => {
        mountProfileBlock();
        mountFrozenAccountsLink();
        mountManagerNavigation();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
    } else {
        bootstrap();
    }
})();
