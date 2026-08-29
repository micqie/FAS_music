document.addEventListener('DOMContentLoaded', () => {
    const pathname = String(window.location.pathname || '').replace(/\\/g, '/').toLowerCase();
    if (!pathname.includes('/pages/admin/')) return;

    const nav = document.querySelector('body > nav');
    const sidebar = document.querySelector('body > aside');

    if (!nav || !sidebar) return;

    if (sidebar.dataset.mobileMenuEnhanced === '1' || document.querySelector('.admin-mobile-menu-toggle')) {
        return;
    }

    sidebar.dataset.mobileMenuEnhanced = '1';
    document.body.classList.add('admin-responsive-ready');
    sidebar.setAttribute('data-admin-sidebar', 'true');
    nav.classList.add('inset-x-0', 'top-0', 'left-0', 'right-0');
    nav.style.left = '0';
    nav.style.right = '0';
    nav.style.top = '0';
    nav.style.width = 'auto';

    // Keep the Admin-owned frozen account page available from every Admin screen.
    if (!sidebar.querySelector('a[href*="admin_frozen_accounts.html"]')) {
        const managementNav = sidebar.querySelector('nav');
        if (managementNav) {
            const frozenLink = document.createElement('a');
            frozenLink.href = 'admin_frozen_accounts.html';
            frozenLink.className = 'flex items-center px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all group';
            frozenLink.innerHTML = '<i class="fas fa-snowflake mr-3 text-slate-500 group-hover:text-gold-400 transition-colors"></i> Frozen Accounts';
            const sessionsLink = managementNav.querySelector('a[href*="admin_sessions.html"]');
            if (sessionsLink) sessionsLink.insertAdjacentElement('afterend', frozenLink);
            else managementNav.appendChild(frozenLink);
        }
    }
    if (!sidebar.querySelector('a[href*="admin_learning_materials.html"]')) {
        const academyNavs = sidebar.querySelectorAll('nav');
        const academyNav = academyNavs.length ? academyNavs[academyNavs.length - 1] : null;
        if (academyNav) {
            const link = document.createElement('a');
            link.href = 'admin_learning_materials.html';
            link.className = 'flex items-center px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all group';
            link.innerHTML = '<i class="fas fa-book-open mr-3 text-slate-500 group-hover:text-gold-400 transition-colors"></i> Learning Materials';
            academyNav.appendChild(link);
        }
    }

    let backdrop = document.getElementById('adminSidebarBackdrop') || document.querySelector('.admin-sidebar-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('button');
        backdrop.type = 'button';
        backdrop.className = 'admin-sidebar-backdrop lg:hidden';
        backdrop.setAttribute('aria-label', 'Close admin navigation');
        document.body.insertBefore(backdrop, sidebar);
    } else {
        backdrop.classList.add('admin-sidebar-backdrop', 'lg:hidden');
        if (backdrop.tagName !== 'BUTTON') {
            backdrop.setAttribute('role', 'button');
            backdrop.setAttribute('tabindex', '0');
            backdrop.setAttribute('aria-label', 'Close admin navigation');
        }
    }

    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'admin-mobile-menu-toggle lg:hidden';
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-controls', 'admin-sidebar');
    menuButton.setAttribute('aria-label', 'Open admin navigation');
    menuButton.innerHTML = '<i class="fas fa-bars text-sm"></i>';

    if (!sidebar.id) {
        sidebar.id = 'admin-sidebar';
    }

    const firstElement = nav.firstElementChild;
    if (firstElement && firstElement.tagName === 'DIV') {
        firstElement.classList.add('min-w-0');
        firstElement.insertBefore(menuButton, firstElement.firstChild);
    } else if (firstElement) {
        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-center gap-3 min-w-0';
        nav.insertBefore(wrapper, firstElement);
        wrapper.appendChild(menuButton);
        wrapper.appendChild(firstElement);
    } else {
        nav.appendChild(menuButton);
    }

    const closeSidebar = () => {
        document.body.classList.remove('admin-sidebar-open');
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.innerHTML = '<i class="fas fa-bars text-sm"></i>';
        document.body.style.overflow = '';
    };

    const openSidebar = () => {
        document.body.classList.add('admin-sidebar-open');
        menuButton.setAttribute('aria-expanded', 'true');
        menuButton.innerHTML = '<i class="fas fa-times text-sm"></i>';
        document.body.style.overflow = 'hidden';
    };

    menuButton.addEventListener('click', () => {
        if (document.body.classList.contains('admin-sidebar-open')) {
            closeSidebar();
            return;
        }

        openSidebar();
    });

    backdrop.addEventListener('click', closeSidebar);
    backdrop.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            closeSidebar();
        }
    });

    const syncCompactLayout = () => {
        const isMobile = window.innerWidth < 1024;
        const headerRows = document.querySelectorAll(
            'main .flex.items-center.justify-between, main .flex.justify-between.items-center'
        );

        headerRows.forEach((row) => {
            row.style.flexWrap = isMobile ? 'wrap' : '';
            row.style.alignItems = isMobile ? 'flex-start' : '';
            row.style.gap = isMobile ? '0.75rem' : '';
        });
    };

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeSidebar();
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024) {
            closeSidebar();
        }

        syncCompactLayout();
    });

    sidebar.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 1024) {
                closeSidebar();
            }
        });
    });

    syncCompactLayout();
});
