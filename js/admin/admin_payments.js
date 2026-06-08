function showPaymentsMessage(message, type = 'info') {
    const box = document.getElementById('paymentsMessage');
    if (!box) return;
    const styles = {
        error: 'border-red-200 bg-red-50 text-red-700',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        info: 'border-slate-200 bg-slate-50 text-slate-700'
    };
    box.className = `mt-4 rounded-2xl border px-4 py-3 text-sm ${styles[type] || styles.info}`;
    box.textContent = message;
    box.classList.remove('hidden');
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function getWalkInRegistrationDisplayStatus(row) {
    const status = String(row?.registration_status || 'Pending').trim() || 'Pending';
    return status;
}

const paymentPaginationState = {
    largestBalances: 1,
    enrollmentTable: 1,
    registrationTable: 1
};

const paymentPageSizes = {
    largestBalances: 5,
    enrollmentTable: 5,
    registrationTable: 5
};

let paymentCenterDataCache = null;
let activePaymentModalId = null;

function resetPaymentPagination() {
    paymentPaginationState.largestBalances = 1;
    paymentPaginationState.enrollmentTable = 1;
    paymentPaginationState.registrationTable = 1;
}

function getPaginatedRows(rows, key) {
    const size = Number(paymentPageSizes[key] || 5);
    const totalItems = Array.isArray(rows) ? rows.length : 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / size));
    const currentPage = Math.min(Math.max(1, Number(paymentPaginationState[key] || 1)), totalPages);
    paymentPaginationState[key] = currentPage;
    const start = (currentPage - 1) * size;
    return {
        rows: (rows || []).slice(start, start + size),
        currentPage,
        totalPages,
        totalItems,
        startIndex: totalItems ? start + 1 : 0,
        endIndex: Math.min(start + size, totalItems)
    };
}

function renderPaymentPagination(targetId, key, meta) {
    const el = document.getElementById(targetId);
    if (!el) return;

    if (!meta || meta.totalItems <= 0) {
        el.innerHTML = '';
        return;
    }

    el.innerHTML = `
        <div class="flex items-center justify-between gap-3 flex-wrap">
            <div class="text-xs font-semibold text-slate-500">
                Showing ${meta.startIndex}-${meta.endIndex} of ${meta.totalItems}
            </div>
            <div class="flex items-center gap-2">
                <button type="button" data-page-target="${key}" data-page-action="prev" class="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed" ${meta.currentPage <= 1 ? 'disabled' : ''}>
                    Previous
                </button>
                <div class="px-3 py-2 text-sm font-semibold text-slate-600">
                    Page ${meta.currentPage} of ${meta.totalPages}
                </div>
                <button type="button" data-page-target="${key}" data-page-action="next" class="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed" ${meta.currentPage >= meta.totalPages ? 'disabled' : ''}>
                    Next
                </button>
            </div>
        </div>
    `;

    el.querySelectorAll('button[data-page-target]').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.getAttribute('data-page-action');
            const pageKey = btn.getAttribute('data-page-target');
            if (!pageKey) return;
            if (action === 'prev') paymentPaginationState[pageKey] = Math.max(1, Number(paymentPaginationState[pageKey] || 1) - 1);
            if (action === 'next') paymentPaginationState[pageKey] = Number(paymentPaginationState[pageKey] || 1) + 1;
            if (paymentCenterDataCache) renderPaymentCenter(paymentCenterDataCache);
        });
    });
}

function paymentBadgeClass(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'approved' || normalized === 'paid') return 'bg-emerald-100 text-emerald-700';
    if (normalized === 'fee paid') return 'bg-sky-100 text-sky-700';
    if (normalized === 'pending') return 'bg-amber-100 text-amber-700';
    if (normalized === 'full payment') return 'bg-emerald-100 text-emerald-700';
    if (normalized === 'installment') return 'bg-violet-100 text-violet-700';
    if (normalized === 'partial payment') return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-600';
}

function renderPill(label, type) {
    return `<span class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${paymentBadgeClass(type || label)}">${escapeHtml(label || '—')}</span>`;
}

function formatPercent(value) {
    const num = Number(value) || 0;
    return `${num.toFixed(num >= 10 ? 0 : 1)}%`;
}

function formatDateLabel(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function toBranchIdMap(branches) {
    const map = new Map();
    (branches || []).forEach(branch => {
        map.set(Number(branch.branch_id || 0), branch);
    });
    return map;
}

function normalizeRegistrations(registrations, branchMap) {
    return (registrations || []).map(row => {
        const branchId = Number(row.branch_id || 0);
        const branch = branchMap.get(branchId);
        const registrationTotal = Number(row.registration_fee_amount || 1000);
        const registrationPaid = Number(row.registration_fee_paid || 0);
        const registrationSource = String(row.registration_source || 'online').toLowerCase();
        const registrationStatus = String(row.registration_status || 'Pending').trim() || 'Pending';
        const registrationBalance = registrationSource === 'walkin' && ['Approved', 'Fee Paid', 'Active'].includes(registrationStatus)
            ? 0
            : Math.max(0, registrationTotal - registrationPaid);
        return {
            ...row,
            branch_id: branchId,
            branch_name: row.branch_name || branch?.branch_name || 'Unassigned Branch',
            registration_source: registrationSource,
            registration_total: registrationTotal,
            registration_paid: registrationPaid,
            registration_balance: registrationBalance
        };
    });
}

function normalizeEnrollments(enrollments, branchMap) {
    return (enrollments || []).map(row => {
        const branchId = Number(row.branch_id || 0);
        const branch = branchMap.get(branchId);
        const total = Number(row.total_amount || 0);
        const paid = Number(row.paid_amount || 0);
        const balance = Math.max(0, total - paid);
        const collectionRate = total > 0 ? (paid / total) * 100 : 0;
        return {
            ...row,
            branch_id: branchId,
            branch_name: row.branch_name || branch?.branch_name || 'Unassigned Branch',
            total_amount: total,
            paid_amount: paid,
            balance_amount: balance,
            collection_rate: collectionRate
        };
    });
}

function filterEnrollmentRows(rows, filters) {
    const search = String(filters.search || '').trim().toLowerCase();
    return rows.filter(row => {
        if (filters.branchId > 0 && Number(row.branch_id || 0) !== filters.branchId) return false;
        if (filters.balanceMode === 'with_balance' && Number(row.balance_amount || 0) <= 0) return false;
        if (filters.balanceMode === 'paid' && Number(row.balance_amount || 0) > 0) return false;
        if (search) {
            const haystack = [
                row.first_name,
                row.last_name,
                row.email,
                row.branch_name,
                row.package_name,
                row.payment_type
            ].join(' ').toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });
}

function filterRegistrationRows(rows, filters) {
    const search = String(filters.search || '').trim().toLowerCase();
    return rows.filter(row => {
        if (filters.branchId > 0 && Number(row.branch_id || 0) !== filters.branchId) return false;
        if (filters.balanceMode === 'with_balance' && Number(row.registration_balance || 0) <= 0) return false;
        if (filters.balanceMode === 'paid' && Number(row.registration_balance || 0) > 0) return false;
        if (search) {
            const haystack = [
                row.first_name,
                row.last_name,
                row.email,
                row.branch_name,
                row.registration_source,
                row.registration_status
            ].join(' ').toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });
}

function sortEnrollmentRows(rows, sortMode) {
    const items = [...rows];
    items.sort((a, b) => {
        if (sortMode === 'highest_paid') return Number(b.paid_amount || 0) - Number(a.paid_amount || 0);
        if (sortMode === 'student_name') {
            const left = `${a.last_name || ''} ${a.first_name || ''}`.trim();
            const right = `${b.last_name || ''} ${b.first_name || ''}`.trim();
            return left.localeCompare(right);
        }
        if (sortMode === 'branch_name') {
            return String(a.branch_name || '').localeCompare(String(b.branch_name || ''))
                || (Number(b.balance_amount || 0) - Number(a.balance_amount || 0));
        }
        return Number(b.balance_amount || 0) - Number(a.balance_amount || 0);
    });
    return items;
}

function computeBranchMetrics(branches, registrations, enrollments) {
    return (branches || []).map(branch => {
        const branchId = Number(branch.branch_id || 0);
        const registrationRows = registrations.filter(item => Number(item.branch_id || 0) === branchId);
        const enrollmentRows = enrollments.filter(item => Number(item.branch_id || 0) === branchId);
        const registrationRevenue = registrationRows.reduce((sum, item) => sum + Number(item.registration_paid || 0), 0);
        const registrationOutstanding = registrationRows.reduce((sum, item) => sum + Number(item.registration_balance || 0), 0);
        const enrollmentRevenue = enrollmentRows.reduce((sum, item) => sum + Number(item.paid_amount || 0), 0);
        const enrollmentOutstanding = enrollmentRows.reduce((sum, item) => sum + Number(item.balance_amount || 0), 0);
        const totalCollected = registrationRevenue + enrollmentRevenue;
        const totalOutstanding = registrationOutstanding + enrollmentOutstanding;
        const pendingRegistrations = registrationRows.filter(item => String(item.registration_status || '').toLowerCase() === 'pending').length;
        const activeBalances = enrollmentRows.filter(item => Number(item.balance_amount || 0) > 0).length;
        const collectionBase = totalCollected + totalOutstanding;
        const collectionRate = collectionBase > 0 ? (totalCollected / collectionBase) * 100 : 0;

        return {
            ...branch,
            registrationRevenue,
            registrationOutstanding,
            enrollmentRevenue,
            enrollmentOutstanding,
            totalCollected,
            totalOutstanding,
            pendingRegistrations,
            activeBalances,
            collectionRate
        };
    }).filter(item => item.totalCollected > 0 || item.totalOutstanding > 0 || item.pendingRegistrations > 0 || item.activeBalances > 0);
}

function renderOverview(filteredRegistrations, filteredEnrollments) {
    const registrationRevenue = filteredRegistrations.reduce((sum, item) => sum + Number(item.registration_paid || 0), 0);
    const registrationOutstanding = filteredRegistrations.reduce((sum, item) => sum + Number(item.registration_balance || 0), 0);
    const enrollmentRevenue = filteredEnrollments.reduce((sum, item) => sum + Number(item.paid_amount || 0), 0);
    const enrollmentOutstanding = filteredEnrollments.reduce((sum, item) => sum + Number(item.balance_amount || 0), 0);
    const totalCollected = registrationRevenue + enrollmentRevenue;
    const totalOutstanding = registrationOutstanding + enrollmentOutstanding;
    const accountsWithBalance =
        filteredRegistrations.filter(item => Number(item.registration_balance || 0) > 0).length +
        filteredEnrollments.filter(item => Number(item.balance_amount || 0) > 0).length;

    setText('heroOutstanding', formatCurrencyPHP(totalOutstanding));
    setText('heroOutstandingHint', `${accountsWithBalance} account${accountsWithBalance === 1 ? '' : 's'} still carrying balances`);
    setText('heroCollected', formatCurrencyPHP(totalCollected));
    setText('heroCollectedHint', `${filteredRegistrations.length} registration record${filteredRegistrations.length === 1 ? '' : 's'} and ${filteredEnrollments.length} enrollment record${filteredEnrollments.length === 1 ? '' : 's'} in view`);

    setText('statCollected', formatCurrencyPHP(totalCollected));
    setText('statOutstanding', formatCurrencyPHP(totalOutstanding));
    setText('statRegistrationRevenue', formatCurrencyPHP(registrationRevenue));
    setText('statEnrollmentRevenue', formatCurrencyPHP(enrollmentRevenue));
    setText('statBalanceAccounts', String(accountsWithBalance));
}

function renderBranchBoard(branchMetrics) {
    const board = document.getElementById('branchRevenueBoard');
    const summary = document.getElementById('branchBoardSummary');
    if (!board) return;

    if (!branchMetrics.length) {
        board.innerHTML = '<div class="lg:col-span-2 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">No branch payment activity matches the current filters.</div>';
        if (summary) summary.textContent = 'No branches in current view';
        return;
    }

    const sorted = [...branchMetrics].sort((a, b) => Number(b.totalOutstanding || 0) - Number(a.totalOutstanding || 0));
    if (summary) summary.textContent = `${branchMetrics.length} branch${branchMetrics.length === 1 ? '' : 'es'} in current payment view`;

    board.innerHTML = sorted.map(branch => `
        <article class="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <div class="text-lg font-black text-slate-900">${escapeHtml(branch.branch_name || 'Branch')}</div>
                    <div class="mt-1 text-xs text-slate-500">${escapeHtml(branch.address || 'Branch payment summary')}</div>
                </div>
                <div class="rounded-2xl bg-slate-900 px-3 py-2 text-right text-white">
                    <div class="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold">Collection</div>
                    <div class="text-lg font-black">${formatPercent(branch.collectionRate)}</div>
                </div>
            </div>
            <div class="mt-4 grid grid-cols-2 gap-3">
                <div class="rounded-2xl bg-emerald-50 border border-emerald-100 px-3 py-3">
                    <div class="text-[10px] uppercase tracking-[0.18em] text-emerald-700 font-bold">Collected</div>
                    <div class="mt-2 text-xl font-black text-emerald-900">${formatCurrencyPHP(branch.totalCollected)}</div>
                </div>
                <div class="rounded-2xl bg-amber-50 border border-amber-100 px-3 py-3">
                    <div class="text-[10px] uppercase tracking-[0.18em] text-amber-700 font-bold">Outstanding</div>
                    <div class="mt-2 text-xl font-black text-amber-900">${formatCurrencyPHP(branch.totalOutstanding)}</div>
                </div>
            </div>
            <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div class="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <div class="text-xs text-slate-500">Registration Fees</div>
                    <div class="mt-1 font-bold text-slate-900">${formatCurrencyPHP(branch.registrationRevenue)}</div>
                    <div class="text-xs text-slate-400 mt-1">${branch.pendingRegistrations} pending confirmation</div>
                </div>
                <div class="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <div class="text-xs text-slate-500">Enrollment Revenue</div>
                    <div class="mt-1 font-bold text-slate-900">${formatCurrencyPHP(branch.enrollmentRevenue)}</div>
                    <div class="text-xs text-slate-400 mt-1">${branch.activeBalances} account${branch.activeBalances === 1 ? '' : 's'} with balance</div>
                </div>
            </div>
        </article>
    `).join('');
}

function renderCollectionHealth(registrations, enrollments) {
    const box = document.getElementById('collectionHealth');
    if (!box) return;

    const partialCount = enrollments.filter(item => String(item.payment_type || '').toLowerCase() === 'partial payment').length;
    const fullCount = enrollments.filter(item => String(item.payment_type || '').toLowerCase() === 'full payment').length;
    const installmentCount = enrollments.filter(item => String(item.payment_type || '').toLowerCase() === 'installment').length;
    const pendingRegistrationCount = registrations.filter(item => String(item.registration_status || '').toLowerCase() === 'pending').length;
    const approvedRegistrationCount = registrations.filter(item => ['approved', 'fee paid'].includes(String(item.registration_status || '').toLowerCase())).length;
    const fullyPaidEnrollments = enrollments.filter(item => Number(item.balance_amount || 0) <= 0).length;

    box.innerHTML = `
        <div class="grid grid-cols-2 gap-3">
            <div class="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-4">
                <div class="text-[10px] uppercase tracking-[0.18em] text-amber-700 font-bold">Partial</div>
                <div class="mt-2 text-2xl font-black text-amber-900">${partialCount}</div>
            </div>
            <div class="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-4">
                <div class="text-[10px] uppercase tracking-[0.18em] text-emerald-700 font-bold">Full</div>
                <div class="mt-2 text-2xl font-black text-emerald-900">${fullCount}</div>
            </div>
            <div class="rounded-2xl bg-violet-50 border border-violet-100 px-4 py-4">
                <div class="text-[10px] uppercase tracking-[0.18em] text-violet-700 font-bold">Installment</div>
                <div class="mt-2 text-2xl font-black text-violet-900">${installmentCount}</div>
            </div>
            <div class="rounded-2xl bg-slate-100 border border-slate-200 px-4 py-4">
                <div class="text-[10px] uppercase tracking-[0.18em] text-slate-600 font-bold">Fully Paid</div>
                <div class="mt-2 text-2xl font-black text-slate-900">${fullyPaidEnrollments}</div>
            </div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div class="flex items-center justify-between gap-3">
                <div>
                    <div class="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold">Registration Queue</div>
                    <div class="mt-1 text-sm text-slate-600">Pending fee confirmations versus already accepted fees.</div>
                </div>
                <div class="text-right">
                    <div class="text-lg font-black text-slate-900">${pendingRegistrationCount}</div>
                    <div class="text-[11px] text-slate-500">pending</div>
                </div>
            </div>
            <div class="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden">
                <div class="h-full rounded-full bg-gold-500" style="width:${pendingRegistrationCount + approvedRegistrationCount > 0 ? ((approvedRegistrationCount / (pendingRegistrationCount + approvedRegistrationCount)) * 100).toFixed(1) : 0}%"></div>
            </div>
            <div class="mt-2 text-xs text-slate-500">${approvedRegistrationCount} fee-confirmed registration${approvedRegistrationCount === 1 ? '' : 's'} in current view.</div>
        </div>
    `;
}

function setPaymentModalVisibility(modalId, shouldOpen) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
    document.body.classList.toggle('overflow-hidden', shouldOpen);
    activePaymentModalId = shouldOpen ? modalId : (activePaymentModalId === modalId ? null : activePaymentModalId);
}

function attachPaymentModals() {
    document.querySelectorAll('[data-open-payment-modal]').forEach(button => {
        button.addEventListener('click', () => {
            const modalId = button.getAttribute('data-open-payment-modal');
            if (!modalId) return;
            setPaymentModalVisibility(modalId, true);
        });
    });

    document.querySelectorAll('.payment-modal').forEach(modal => {
        modal.querySelectorAll('[data-close-payment-modal]').forEach(button => {
            button.addEventListener('click', () => {
                setPaymentModalVisibility(modal.id, false);
            });
        });
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && activePaymentModalId) {
            setPaymentModalVisibility(activePaymentModalId, false);
        }
    });
}

function renderLargestBalances(enrollments) {
    const list = document.getElementById('largestBalancesList');
    const summary = document.getElementById('largestBalancesSummary');
    if (!list) return;

    const sortedRows = [...enrollments]
        .filter(item => Number(item.balance_amount || 0) > 0)
        .sort((a, b) => Number(b.balance_amount || 0) - Number(a.balance_amount || 0));
    const page = getPaginatedRows(sortedRows, 'largestBalances');
    const rows = page.rows;

    if (summary) {
        summary.textContent = `${sortedRows.length} student${sortedRows.length === 1 ? '' : 's'} with remaining balance`;
    }

    if (!rows.length) {
        list.innerHTML = '<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">No remaining balances for the current filter.</div>';
        renderPaymentPagination('largestBalancesPagination', 'largestBalances', page);
        return;
    }

    list.innerHTML = rows.map(item => {
        const studentName = `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Student';
        return `
            <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <div class="truncate text-sm font-bold text-slate-900">${escapeHtml(studentName)}</div>
                        <div class="truncate text-xs text-slate-500 mt-1">${escapeHtml(item.branch_name || '—')} • ${escapeHtml(item.package_name || 'Package')}</div>
                    </div>
                    ${renderPill(item.payment_type || '—', item.payment_type || '—')}
                </div>
                <div class="mt-3 flex items-center justify-between gap-3">
                    <div class="text-xs text-slate-500">Paid ${formatCurrencyPHP(item.paid_amount || 0)} of ${formatCurrencyPHP(item.total_amount || 0)}</div>
                    <div class="text-lg font-black text-amber-700">${formatCurrencyPHP(item.balance_amount || 0)}</div>
                </div>
            </div>
        `;
    }).join('');
    renderPaymentPagination('largestBalancesPagination', 'largestBalances', page);
}

function renderEnrollmentTable(enrollments) {
    const body = document.getElementById('enrollmentPaymentsTable');
    const summary = document.getElementById('enrollmentTableSummary');
    if (!body) return;
    const page = getPaginatedRows(enrollments, 'enrollmentTable');
    const visibleRows = page.rows;

    if (!enrollments.length) {
        body.innerHTML = `
            <tr>
                <td colspan="8" class="px-6 py-10 text-center text-slate-500">
                    <i class="fas fa-wallet text-2xl mb-3 text-slate-300"></i>
                    <p>No enrollment payment records match the current filters.</p>
                </td>
            </tr>
        `;
        if (summary) summary.textContent = '0 enrollment rows';
        renderPaymentPagination('enrollmentTablePagination', 'enrollmentTable', page);
        return;
    }

    if (summary) summary.textContent = `${enrollments.length} enrollment record${enrollments.length === 1 ? '' : 's'}`;
    body.innerHTML = visibleRows.map(row => {
        const studentName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Student';
        return `
            <tr class="hover:bg-slate-50/80 transition">
                <td class="px-6 py-4">
                    <div class="font-semibold text-slate-900">${escapeHtml(studentName)}</div>
                    <div class="text-sm text-slate-500">${escapeHtml(row.email || '')}</div>
                </td>
                <td class="px-6 py-4 text-sm text-slate-700">${escapeHtml(row.branch_name || '—')}</td>
                <td class="px-6 py-4">
                    <div class="text-sm font-semibold text-slate-900">${escapeHtml(row.package_name || 'Package')}</div>
                    <div class="text-xs text-slate-500 mt-1">${escapeHtml(row.instrument_name || 'Instrument')}</div>
                </td>
                <td class="px-6 py-4 text-sm">${renderPill(row.payment_type || '—', row.payment_type || '—')}</td>
                <td class="px-6 py-4 text-sm font-semibold text-slate-900">${formatCurrencyPHP(row.total_amount || 0)}</td>
                <td class="px-6 py-4 text-sm text-emerald-700 font-semibold">${formatCurrencyPHP(row.paid_amount || 0)}</td>
                <td class="px-6 py-4 text-sm font-bold ${Number(row.balance_amount || 0) > 0 ? 'text-amber-700' : 'text-slate-700'}">${formatCurrencyPHP(row.balance_amount || 0)}</td>
                <td class="px-6 py-4">
                    <div class="text-sm font-semibold text-slate-900">${formatPercent(row.collection_rate || 0)}</div>
                    <div class="mt-2 h-2 w-28 rounded-full bg-slate-200 overflow-hidden">
                        <div class="h-full rounded-full bg-emerald-500" style="width:${Math.max(0, Math.min(100, Number(row.collection_rate || 0))).toFixed(1)}%"></div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    renderPaymentPagination('enrollmentTablePagination', 'enrollmentTable', page);
}

function renderRegistrationTable(registrations) {
    const body = document.getElementById('registrationPaymentsTable');
    const summary = document.getElementById('registrationTableSummary');
    if (!body) return;
    const page = getPaginatedRows(registrations, 'registrationTable');
    const visibleRows = page.rows;

    if (!registrations.length) {
        body.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-10 text-center text-slate-500">
                    <i class="fas fa-receipt text-2xl mb-3 text-slate-300"></i>
                    <p>No registration fee records match the current filters.</p>
                </td>
            </tr>
        `;
        if (summary) summary.textContent = '0 registration rows';
        renderPaymentPagination('registrationTablePagination', 'registrationTable', page);
        return;
    }

    if (summary) summary.textContent = `${registrations.length} registration record${registrations.length === 1 ? '' : 's'}`;
    body.innerHTML = visibleRows.map(row => {
        const studentName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Student';
        const sourceLabel = String(row.registration_source || 'online').toLowerCase() === 'walkin' ? 'Walk-In' : 'Online';
        const displayStatus = getWalkInRegistrationDisplayStatus(row);
        return `
            <tr class="hover:bg-slate-50/80 transition">
                <td class="px-6 py-4">
                    <div class="font-semibold text-slate-900">${escapeHtml(studentName)}</div>
                    <div class="text-sm text-slate-500">${escapeHtml(row.email || '')}</div>
                </td>
                <td class="px-6 py-4 text-sm text-slate-700">${escapeHtml(row.branch_name || '—')}</td>
                <td class="px-6 py-4 text-sm text-slate-700">${renderPill(sourceLabel, sourceLabel)}</td>
                <td class="px-6 py-4 text-sm font-semibold text-emerald-700">${formatCurrencyPHP(row.registration_paid || 0)}</td>
                <td class="px-6 py-4 text-sm">${renderPill(displayStatus, displayStatus)}</td>
                <td class="px-6 py-4 text-sm text-slate-600">${formatDateLabel(row.created_at)}</td>
            </tr>
        `;
    }).join('');
    renderPaymentPagination('registrationTablePagination', 'registrationTable', page);
}

function populateBranchFilter(branches) {
    const select = document.getElementById('paymentBranchFilter');
    if (!select) return;
    const currentValue = select.value;
    const options = (branches || [])
        .filter(branch => String(branch.status || 'Active').toLowerCase() === 'active')
        .map(branch => `<option value="${Number(branch.branch_id || 0)}">${escapeHtml(branch.branch_name || 'Branch')}</option>`)
        .join('');
    select.innerHTML = '<option value="">All Branches</option>' + options;
    select.value = currentValue;
}

function getFilters() {
    return {
        search: document.getElementById('paymentSearch')?.value || '',
        branchId: Number(document.getElementById('paymentBranchFilter')?.value || 0),
        balanceMode: document.getElementById('paymentBalanceFilter')?.value || 'all',
        sortMode: document.getElementById('paymentSort')?.value || 'highest_balance'
    };
}

function attachPaymentFilters(refresh) {
    ['paymentSearch', 'paymentBranchFilter', 'paymentBalanceFilter', 'paymentSort'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const eventName = id === 'paymentSearch' ? 'input' : 'change';
        el.addEventListener(eventName, () => {
            resetPaymentPagination();
            refresh();
        });
    });
}

async function loadPaymentCenter() {
    const [branchesResult, registrationsResult, enrollmentsResult] = await Promise.allSettled([
        axios.get(`${baseApiUrl}/branch.php?action=get-branches-all`),
        axios.get(`${baseApiUrl}/admin.php?action=get-all-registrations`),
        axios.get(`${baseApiUrl}/students.php?action=get-active-enrollments`)
    ]);

    const branchesData = branchesResult.status === 'fulfilled' ? branchesResult.value.data : null;
    const registrationsData = registrationsResult.status === 'fulfilled' ? registrationsResult.value.data : null;
    const enrollmentsData = enrollmentsResult.status === 'fulfilled' ? enrollmentsResult.value.data : null;

    const branches = branchesData?.success && Array.isArray(branchesData.branches) ? branchesData.branches : [];
    const branchMap = toBranchIdMap(branches);
    const registrations = normalizeRegistrations(
        registrationsData?.success && Array.isArray(registrationsData.registrations) ? registrationsData.registrations : [],
        branchMap
    );
    const enrollments = normalizeEnrollments(
        enrollmentsData?.success && Array.isArray(enrollmentsData.enrollments) ? enrollmentsData.enrollments : [],
        branchMap
    );

    populateBranchFilter(branches);

    return { branches, registrations, enrollments };
}

function renderPaymentCenter(data) {
    paymentCenterDataCache = data;
    const filters = getFilters();
    const filteredRegistrations = filterRegistrationRows(data.registrations, filters);
    const filteredEnrollments = sortEnrollmentRows(filterEnrollmentRows(data.enrollments, filters), filters.sortMode);
    const branchMetrics = computeBranchMetrics(data.branches, filteredRegistrations, filteredEnrollments);

    renderOverview(filteredRegistrations, filteredEnrollments);
    renderBranchBoard(branchMetrics);
    renderCollectionHealth(filteredRegistrations, filteredEnrollments);
    renderLargestBalances(filteredEnrollments);
    renderEnrollmentTable(filteredEnrollments);
    renderRegistrationTable(filteredRegistrations);
}

document.addEventListener('DOMContentLoaded', async function() {
    if (typeof checkAuth === 'function') {
        checkAuth();
    }

    if (typeof Auth !== 'undefined' && Auth.getUser) {
        const user = Auth.getUser();
        if (user) {
            const displayName = user.username || user.email || 'Admin';
            setText('userNameNav', displayName);
            setText('profileMenuName', displayName);
        }
    }

    try {
        const data = await loadPaymentCenter();
        const refresh = () => renderPaymentCenter(data);
        attachPaymentModals();
        attachPaymentFilters(refresh);
        refresh();
    } catch (error) {
        console.error('Failed to load admin payment center:', error);
        showPaymentsMessage('Failed to load payment data. Please refresh and try again.', 'error');
        renderBranchBoard([]);
        renderCollectionHealth([], []);
        renderLargestBalances([]);
        renderEnrollmentTable([]);
        renderRegistrationTable([]);
    }
});
