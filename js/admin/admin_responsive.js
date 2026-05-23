document.addEventListener('DOMContentLoaded', () => {
    const nav = document.querySelector('body > nav');
    const sidebar = document.querySelector('body > aside');

    if (!nav || !sidebar) return;

    document.body.classList.add('admin-responsive-ready');
    sidebar.setAttribute('data-admin-sidebar', 'true');

    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'admin-sidebar-backdrop lg:hidden';
    backdrop.setAttribute('aria-label', 'Close admin navigation');
    document.body.insertBefore(backdrop, sidebar);

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
    };

    const openSidebar = () => {
        document.body.classList.add('admin-sidebar-open');
        menuButton.setAttribute('aria-expanded', 'true');
    };

    menuButton.addEventListener('click', () => {
        if (document.body.classList.contains('admin-sidebar-open')) {
            closeSidebar();
            return;
        }

        openSidebar();
    });

    backdrop.addEventListener('click', closeSidebar);

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
