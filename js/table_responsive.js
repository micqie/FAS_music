/**
 * Shared responsive table and client-side pagination support for Desk and
 * Manager pages. Admin pages use the equivalent integration in
 * admin/admin_responsive.js because that file also owns the admin shell.
 */
document.addEventListener('DOMContentLoaded', () => {
    const pathname = String(window.location.pathname || '').replace(/\\/g, '/').toLowerCase();
    if (!pathname.includes('/pages/desk/') && !pathname.includes('/pages/manager/')) return;

    document.body.classList.add('table-responsive-ready');

    // These tables already paginate their source data in js/index.js.
    const nativePaginationBodies = new Set(['registrationsTable']);

    document.querySelectorAll('main table').forEach((table, tableIndex) => {
        if (table.dataset.responsiveEnhanced === '1') return;

        const columnCount = table.querySelectorAll('thead tr:first-child th').length ||
            table.querySelectorAll('tbody tr:first-child td').length || 1;
        const minimumWidth = columnCount <= 3 ? 30 : columnCount <= 5 ? 40 : columnCount <= 7 ? 52 : 62;
        table.classList.add('admin-data-table');
        table.style.setProperty('--admin-table-min-width', `${minimumWidth}rem`);
        table.dataset.responsiveEnhanced = '1';

        let scrollRegion = table.parentElement;
        if (!scrollRegion || (!scrollRegion.classList.contains('overflow-x-auto') && !scrollRegion.classList.contains('table-container'))) {
            scrollRegion = document.createElement('div');
            table.parentNode.insertBefore(scrollRegion, table);
            scrollRegion.appendChild(table);
        }
        scrollRegion.classList.add('admin-table-scroll');
        if (!scrollRegion.hasAttribute('tabindex')) scrollRegion.tabIndex = 0;
        if (!scrollRegion.hasAttribute('role')) scrollRegion.setAttribute('role', 'region');
        if (!scrollRegion.hasAttribute('aria-label')) {
            const card = scrollRegion.parentElement;
            const heading = card?.querySelector('h2, h3');
            scrollRegion.setAttribute('aria-label', `${heading?.textContent?.trim() || `Data table ${tableIndex + 1}`} — scroll horizontally to view all columns`);
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
});
