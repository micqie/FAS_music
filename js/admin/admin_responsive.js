(() => {
    const pathname = String(window.location.pathname || '').replace(/\\/g, '/').toLowerCase();
    if (!pathname.includes('/pages/admin/') || !document.body) return;

    document.body.classList.add('admin-sidebar-no-transition');
    try {
        document.body.classList.toggle(
            'admin-sidebar-collapsed',
            window.localStorage.getItem('fasAdminSidebarCollapsed') === 'true'
        );
    } catch (_) {
        // Use the expanded desktop default when storage is unavailable.
    }

    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => document.body.classList.remove('admin-sidebar-no-transition'));
    });
})();

document.addEventListener('DOMContentLoaded', () => {
    const pathname = String(window.location.pathname || '').replace(/\\/g, '/').toLowerCase();
    if (!pathname.includes('/pages/admin/')) return;

    const nav = document.querySelector('body > nav');
    const sidebar = document.querySelector('body > aside');

    if (!nav || !sidebar) return;

    const SIDEBAR_STATE_KEY = 'fasAdminSidebarCollapsed';
    const SIDEBAR_SCROLL_KEY = 'fasAdminSidebarScrollTop';
    const isDesktop = () => window.innerWidth >= 1024;
    let savedDesktopState = false;
    try {
        savedDesktopState = window.localStorage.getItem(SIDEBAR_STATE_KEY) === 'true';
    } catch (_) {
        // Storage can be unavailable in private or restricted browser contexts.
    }

    document.body.classList.toggle('admin-sidebar-collapsed', savedDesktopState);

    if (sidebar.dataset.mobileMenuEnhanced === '1' || document.querySelector('.admin-mobile-menu-toggle')) {
        return;
    }

    sidebar.dataset.mobileMenuEnhanced = '1';
    document.body.classList.add('admin-responsive-ready');
    sidebar.setAttribute('data-admin-sidebar', 'true');
    nav.classList.remove('inset-x-0', 'left-0', 'right-0', 'w-full');
    nav.classList.add('top-0');

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
        backdrop.className = 'admin-sidebar-backdrop';
        backdrop.setAttribute('aria-label', 'Close admin navigation');
        document.body.insertBefore(backdrop, sidebar);
    } else {
        backdrop.classList.add('admin-sidebar-backdrop');
        backdrop.classList.remove('lg:hidden');
        if (backdrop.tagName !== 'BUTTON') {
            backdrop.setAttribute('role', 'button');
            backdrop.setAttribute('tabindex', '0');
            backdrop.setAttribute('aria-label', 'Close admin navigation');
        }
    }

    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'admin-mobile-menu-toggle';
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-controls', 'admin-sidebar');
    menuButton.setAttribute('aria-label', 'Open admin navigation');
    menuButton.innerHTML = '<i class="fas fa-bars text-sm"></i>';

    if (!sidebar.id) {
        sidebar.id = 'admin-sidebar';
    }
    sidebar.setAttribute('role', 'navigation');
    sidebar.removeAttribute('aria-modal');
    sidebar.setAttribute('aria-label', 'Admin navigation');
    sidebar.setAttribute('aria-hidden', isDesktop() ? 'false' : 'true');

    let closeButton = sidebar.querySelector('.admin-sidebar-close');
    if (!closeButton) {
        closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'admin-sidebar-close';
        closeButton.setAttribute('aria-label', 'Close admin navigation');
        closeButton.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
        sidebar.prepend(closeButton);
    }

    const firstElement = nav.firstElementChild;
    if (firstElement && firstElement.tagName === 'DIV') {
        firstElement.classList.remove('gap-8', 'lg:gap-8');
        firstElement.classList.add('min-w-0', 'gap-3');
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

    // Keep the brand in the top bar beside the hamburger. Some older Admin
    // templates placed a second logo inside the sidebar; remove that duplicate.
    let topNavBrand = nav.querySelector('img[src*="fas-logo"]')?.closest('a') || null;
    const sidebarBrandImages = Array.from(sidebar.querySelectorAll('img[src*="fas-logo"]'));
    if (!topNavBrand && sidebarBrandImages.length) {
        topNavBrand = sidebarBrandImages[0].closest('a');
        if (topNavBrand) {
            menuButton.insertAdjacentElement('afterend', topNavBrand);
        }
    }
    sidebarBrandImages.forEach((image) => {
        const brandLink = image.closest('a');
        if (brandLink && brandLink !== topNavBrand) brandLink.remove();
        else if (!brandLink) image.remove();
    });
    if (topNavBrand) {
        topNavBrand.classList.add('admin-topnav-brand');
        topNavBrand.classList.remove('fas-topbar-brand');
        topNavBrand.setAttribute('aria-label', 'Admin dashboard');
        menuButton.insertAdjacentElement('afterend', topNavBrand);
        const logo = topNavBrand.querySelector('img');
        if (logo) logo.alt = 'Father & Sons Music';
    }

    const topNavToggleHost = menuButton.parentElement;
    const placeMenuButton = () => {
        if (isDesktop()) {
            if (menuButton.parentElement !== sidebar) {
                sidebar.insertBefore(menuButton, sidebar.firstChild);
            }
            return;
        }

        if (menuButton.parentElement !== topNavToggleHost) {
            if (topNavBrand?.parentElement === topNavToggleHost) {
                topNavToggleHost.insertBefore(menuButton, topNavBrand);
            } else {
                topNavToggleHost.insertBefore(menuButton, topNavToggleHost.firstChild);
            }
        }
    };

    const enhanceSidebarLabels = () => {
        sidebar.querySelectorAll('nav a').forEach((link) => {
            if (link.querySelector('.admin-sidebar-label')) return;

            const textNodes = Array.from(link.childNodes).filter(
                (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim()
            );
            if (!textNodes.length) return;

            const label = document.createElement('span');
            label.className = 'admin-sidebar-label';
            label.textContent = textNodes.map((node) => node.textContent.trim()).join(' ');
            textNodes[0].replaceWith(label);
            textNodes.slice(1).forEach((node) => node.remove());
            link.dataset.sidebarLabel = label.textContent;
        });
    };

    const updateCollapsedTooltips = () => {
        const showTooltips = isDesktop() && document.body.classList.contains('admin-sidebar-collapsed');
        sidebar.querySelectorAll('nav a[data-sidebar-label]').forEach((link) => {
            if (showTooltips) link.title = link.dataset.sidebarLabel;
            else link.removeAttribute('title');
        });
    };

    const saveSidebarScroll = () => {
        try {
            window.sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(Math.round(sidebar.scrollTop)));
        } catch (_) {
            // Scroll restoration is an enhancement; navigation still works without it.
        }
    };

    const restoreSidebarScroll = () => {
        try {
            const savedScroll = Number(window.sessionStorage.getItem(SIDEBAR_SCROLL_KEY));
            if (Number.isFinite(savedScroll) && savedScroll > 0) {
                sidebar.scrollTop = savedScroll;
            }
        } catch (_) {
            // Ignore storage restrictions and use the browser's default position.
        }
    };

    const updateToggleState = () => {
        if (isDesktop()) {
            const collapsed = document.body.classList.contains('admin-sidebar-collapsed');
            menuButton.setAttribute('aria-expanded', String(!collapsed));
            menuButton.setAttribute('aria-label', collapsed ? 'Expand admin navigation' : 'Collapse admin navigation');
            sidebar.setAttribute('aria-hidden', 'false');
        } else {
            const open = document.body.classList.contains('admin-sidebar-open');
            menuButton.setAttribute('aria-expanded', String(open));
            menuButton.setAttribute('aria-label', open ? 'Close admin navigation' : 'Open admin navigation');
            sidebar.setAttribute('aria-hidden', String(!open));
        }
        updateCollapsedTooltips();
    };

    const setDesktopCollapsed = (collapsed) => {
        document.body.classList.toggle('admin-sidebar-collapsed', collapsed);
        try {
            window.localStorage.setItem(SIDEBAR_STATE_KEY, String(collapsed));
        } catch (_) {
            // The UI still works for this page when storage is unavailable.
        }
        updateToggleState();
    };

    const closeMobileSidebar = () => {
        document.body.classList.remove('admin-sidebar-open');
        updateToggleState();
    };

    const openMobileSidebar = () => {
        document.body.classList.add('admin-sidebar-open');
        updateToggleState();
        closeButton.focus();
    };

    menuButton.addEventListener('click', () => {
        if (isDesktop()) {
            setDesktopCollapsed(!document.body.classList.contains('admin-sidebar-collapsed'));
            return;
        }

        if (document.body.classList.contains('admin-sidebar-open')) {
            closeMobileSidebar();
            return;
        }

        openMobileSidebar();
    });

    backdrop.addEventListener('click', closeMobileSidebar);
    closeButton.addEventListener('click', () => {
        closeMobileSidebar();
        menuButton.focus();
    });
    backdrop.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            closeMobileSidebar();
        }
    });

    enhanceSidebarLabels();
    placeMenuButton();
    restoreSidebarScroll();
    updateToggleState();

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

    const nativePaginationBodies = new Set([
        'registrationsTable',
        'adminUsersTable',
        'auditLogsTbody',
        'enrollmentPaymentsTable',
        'registrationPaymentsTable'
    ]);

    const enhanceAdminTables = () => {
        document.querySelectorAll('main table').forEach((table, tableIndex) => {
            if (table.dataset.responsiveEnhanced === '1') return;

            const columnCount = table.querySelectorAll('thead tr:first-child th').length ||
                table.querySelectorAll('tbody tr:first-child td').length || 1;
            const isCompactTable = columnCount <= 4;
            const minimumWidth = isCompactTable
                ? '100%'
                : columnCount === 5
                    ? '42rem'
                    : columnCount === 6
                        ? '50rem'
                        : columnCount === 7
                            ? '58rem'
                            : '68rem';
            table.classList.add('admin-data-table');
            table.style.setProperty('--admin-table-min-width', minimumWidth);
            table.dataset.tableLayout = isCompactTable ? 'compact' : 'scroll';
            table.dataset.responsiveEnhanced = '1';

            let scrollRegion = table.parentElement;
            if (!scrollRegion || (!scrollRegion.classList.contains('overflow-x-auto') && !scrollRegion.classList.contains('table-container'))) {
                scrollRegion = document.createElement('div');
                table.parentNode.insertBefore(scrollRegion, table);
                scrollRegion.appendChild(table);
            }
            scrollRegion.classList.add('admin-table-scroll');
            scrollRegion.dataset.tableLayout = isCompactTable ? 'compact' : 'scroll';
            if (!scrollRegion.hasAttribute('tabindex')) scrollRegion.tabIndex = 0;
            if (!scrollRegion.hasAttribute('role')) scrollRegion.setAttribute('role', 'region');
            if (!scrollRegion.hasAttribute('aria-label')) {
                const heading = table.closest('section, article, div')?.querySelector('h2, h3');
                const tableName = heading?.textContent?.trim() || `Data table ${tableIndex + 1}`;
                scrollRegion.setAttribute(
                    'aria-label',
                    isCompactTable ? tableName : `${tableName} — scroll horizontally to view all columns`
                );
            }

            const tbody = table.tBodies[0];
            if (!tbody || nativePaginationBodies.has(tbody.id) || table.dataset.noPagination === 'true') return;

            const pager = document.createElement('div');
            pager.className = 'admin-table-pagination';
            pager.setAttribute('aria-label', 'Table pagination');
            pager.innerHTML = `
                <span class="admin-table-pagination-info" aria-live="polite"></span>
                <div class="admin-table-pagination-controls">
                    <label>Rows <select aria-label="Rows per page"><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label>
                    <button type="button" data-page-action="previous" aria-label="Previous page">Prev</button>
                    <button type="button" data-page-action="next" aria-label="Next page">Next</button>
                </div>`;
            scrollRegion.insertAdjacentElement('afterend', pager);

            const state = { page: 1, pageSize: 10 };
            const info = pager.querySelector('.admin-table-pagination-info');
            const pageSize = pager.querySelector('select');
            const previous = pager.querySelector('[data-page-action="previous"]');
            const next = pager.querySelector('[data-page-action="next"]');

            const renderPage = (resetPage = false) => {
                const rows = Array.from(tbody.rows);
                const isMessageRow = rows.length === 1 && rows[0].cells.length === 1 &&
                    Number(rows[0].cells[0].colSpan || 1) > 1;
                const total = isMessageRow ? 0 : rows.length;
                const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
                if (resetPage) state.page = 1;
                state.page = Math.min(Math.max(1, state.page), totalPages);
                const start = (state.page - 1) * state.pageSize;
                const end = Math.min(total, start + state.pageSize);

                rows.forEach((row, index) => {
                    row.hidden = !isMessageRow && (index < start || index >= end);
                });
                pager.hidden = total <= state.pageSize;
                info.textContent = total === 0 ? 'No records' : `Page ${state.page} of ${totalPages} • ${start + 1}-${end} of ${total}`;
                previous.disabled = state.page <= 1;
                next.disabled = state.page >= totalPages;
            };

            pageSize.addEventListener('change', () => {
                state.pageSize = Number(pageSize.value) || 10;
                renderPage(true);
            });
            previous.addEventListener('click', () => {
                state.page -= 1;
                renderPage();
                scrollRegion.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
            next.addEventListener('click', () => {
                state.page += 1;
                renderPage();
                scrollRegion.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });

            let renderQueued = false;
            new MutationObserver(() => {
                if (renderQueued) return;
                renderQueued = true;
                window.requestAnimationFrame(() => {
                    renderQueued = false;
                    renderPage(true);
                });
            }).observe(tbody, { childList: true });

            renderPage();
        });
    };

    const compactAdminTableFilters = () => {
        const pageName = pathname.split('/').pop();
        const configurations = {
            'admin_teachers.html': {
                sourceId: 'searchInput', sourceClosest: '.mb-6',
                controlIds: ['searchInput', 'branchFilter', 'statusFilter'], tableBodyId: 'teachersTable'
            },
            'admin_students.html': {
                sourceId: 'studentSearchInput', sourceClosest: '.mb-4',
                controlIds: ['studentSearchInput', 'branchFilter', 'studentCount'], tableBodyId: 'studentsTable'
            },
            'admin_sessions.html': {
                sourceId: 'branchFilter', sourceClosest: '.mb-4',
                controlIds: ['branchFilter'], tableBodyId: 'sessionsList'
            },
            'admin_instruments.html': {
                sourceId: 'branchFilter', sourceClosest: '.mb-6',
                controlIds: ['branchFilter', 'typeFilter'], tableBodyId: 'instrumentsTable'
            },
            'admin_maintenance.html': {
                sourceId: 'branchFilter', sourceClosest: '.mb-6',
                controlIds: ['branchFilter', 'statusFilter', 'searchInput'], tableBodyId: 'maintenanceTable'
            },
            'admin_audit_logs.html': {
                sourceId: 'auditSearch', sourceClosest: '.soft-shadow',
                controlIds: ['auditSearch', 'auditFilterModule', 'auditFilterSeverity', 'auditDateFrom', 'auditDateTo', 'auditClearFilters'],
                tableBodyId: 'auditLogsTbody'
            },
            'admin_payments.html': {
                sourceId: 'paymentSearch', sourceClosest: 'section',
                controlIds: ['paymentSearch', 'paymentBranchFilter', 'paymentBalanceFilter', 'paymentDateFrom', 'paymentDateTo', 'paymentBalanceModeBtn'],
                messageIds: ['paymentsMessage'], tableBodyId: 'enrollmentPaymentsTable'
            },
            'admin_package.html': {
                sourceId: 'packageBranchFilter', sourceClosest: '.px-6.py-4',
                controlIds: ['packageBranchFilter', 'clearPackageBranchFilterBtn'], tableBodyId: 'packagesTable'
            },
            'admin_learning_materials.html': {
                sourceId: 'materialSearch', sourceClosest: '.soft-shadow',
                controlIds: ['materialSearch'], tableBodyId: 'materialsBody'
            }
        };
        const config = configurations[pageName];
        if (!config) return;

        const sourceControl = document.getElementById(config.sourceId);
        const tableBody = document.getElementById(config.tableBodyId);
        const table = tableBody?.closest('table');
        const source = sourceControl?.closest(config.sourceClosest);
        if (!sourceControl || !table || !source) return;

        let tableCard = table.parentElement;
        let tableHeader = null;
        while (tableCard && tableCard !== document.body) {
            tableHeader = Array.from(tableCard.children).find((child) =>
                child !== table && !child.contains(table) && child.querySelector?.('h2, h3')
            ) || null;
            if (tableHeader) break;
            tableCard = tableCard.parentElement;
        }
        if (!tableHeader || !tableCard) return;

        tableHeader.classList.add('admin-table-heading-row');
        let toolbar = tableHeader.querySelector(':scope > .admin-table-filter-toolbar');
        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.className = 'admin-table-filter-toolbar';
            toolbar.setAttribute('role', 'search');
            toolbar.setAttribute('aria-label', 'Table filters');
            tableHeader.appendChild(toolbar);
        }

        config.controlIds.forEach((id) => {
            const control = document.getElementById(id);
            if (!control) return;

            const associatedLabel = source.querySelector(`label[for="${id}"]`) ||
                control.closest('div')?.querySelector('label');
            if (!control.getAttribute('aria-label') && associatedLabel?.textContent.trim()) {
                control.setAttribute('aria-label', associatedLabel.textContent.trim());
            }

            let movable = control;
            if (
                control.matches('input') &&
                control.parentElement?.classList.contains('relative') &&
                control.parentElement.querySelector('i')
            ) {
                movable = control.parentElement;
            }
            movable.classList.add('admin-table-filter-control');
            toolbar.appendChild(movable);
        });

        (config.messageIds || []).forEach((id) => {
            const message = document.getElementById(id);
            if (!message) return;
            message.classList.add('admin-table-filter-message');
            tableHeader.insertAdjacentElement('afterend', message);
        });

        source.remove();
    };

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !isDesktop()) {
            closeMobileSidebar();
        }
    });

    window.addEventListener('resize', () => {
        if (isDesktop()) {
            document.body.classList.remove('admin-sidebar-open');
        }
        placeMenuButton();
        updateToggleState();
        syncCompactLayout();
    });

    let sidebarScrollFrame = 0;
    sidebar.addEventListener('scroll', () => {
        if (sidebarScrollFrame) return;
        sidebarScrollFrame = window.requestAnimationFrame(() => {
            sidebarScrollFrame = 0;
            saveSidebarScroll();
        });
    }, { passive: true });
    window.addEventListener('pagehide', saveSidebarScroll);

    const sidebarLinks = Array.from(sidebar.querySelectorAll('a[href]'));
    sidebarLinks.forEach((link) => {
        link.addEventListener('click', (event) => {
            saveSidebarScroll();
            if (
                event.button === 0 &&
                !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey &&
                link.target !== '_blank'
            ) {
                link.classList.add('admin-navigation-pending');
                link.setAttribute('aria-current', 'page');
            }
            if (window.innerWidth < 1024) {
                closeMobileSidebar();
            }
        });
    });

    // Warm the browser cache for same-origin Admin destinations. This runs at
    // low priority and avoids re-downloading/parsing a page only after click.
    const prefetchedAdminPages = new Set();
    const prefetchAdminPage = (link) => {
        try {
            const target = new URL(link.href, window.location.href);
            if (target.origin !== window.location.origin || !/\/pages\/admin\/[^/]+\.html$/i.test(target.pathname)) return;
            if (target.href === window.location.href || prefetchedAdminPages.has(target.href)) return;

            prefetchedAdminPages.add(target.href);
            const preload = document.createElement('link');
            preload.rel = 'prefetch';
            preload.href = target.href;
            preload.as = 'document';
            preload.fetchPriority = 'low';
            document.head.appendChild(preload);
        } catch (_) {
            // A malformed or non-page link should continue with normal navigation.
        }
    };

    sidebarLinks.forEach((link) => {
        link.addEventListener('pointerenter', () => prefetchAdminPage(link), { once: true });
        link.addEventListener('focus', () => prefetchAdminPage(link), { once: true });
        link.addEventListener('touchstart', () => prefetchAdminPage(link), { once: true, passive: true });
    });

    // Gradually warm remaining destinations only after the current page is idle.
    // One document at a time keeps this from competing with page data requests.
    let idlePrefetchIndex = 0;
    const prefetchNextAdminPage = () => {
        if (idlePrefetchIndex >= sidebarLinks.length) return;
        prefetchAdminPage(sidebarLinks[idlePrefetchIndex]);
        idlePrefetchIndex += 1;
        window.setTimeout(prefetchNextAdminPage, 140);
    };
    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(prefetchNextAdminPage, { timeout: 1800 });
    } else {
        window.setTimeout(prefetchNextAdminPage, 900);
    }

    compactAdminTableFilters();
    syncCompactLayout();
    enhanceAdminTables();
});
