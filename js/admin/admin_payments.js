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

function buildStudentLedgerUrl(row) {
    const studentId = Number(row?.student_id || 0);
    if (studentId > 0) {
        return `admin_student_ledger.html?student_id=${encodeURIComponent(String(studentId))}`;
    }

    const studentKey = String(row?.email || `${row?.first_name || ''} ${row?.last_name || ''}`.trim() || '').trim();
    if (!studentKey) return '';
    return `admin_student_ledger.html?student_key=${encodeURIComponent(studentKey)}`;
}

function parseDateInput(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function isWithinDateRange(value, from, to) {
    if (!from && !to) return true;
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return false;
    const time = date.getTime();
    if (from && time < from.getTime()) return false;
    if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        if (time > end.getTime()) return false;
    }
    return true;
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
    return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${paymentBadgeClass(type || label)}">${escapeHtml(label || '—')}</span>`;
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
            collection_rate: collectionRate,
            created_at: row.created_at || row.enrolled_at || row.enrollment_date || row.payment_date || null
        };
    });
}

function filterEnrollmentRows(rows, filters) {
    const search = String(filters.search || '').trim().toLowerCase();
    const from = parseDateInput(filters.dateFrom);
    const to = parseDateInput(filters.dateTo);
    return rows.filter(row => {
        if (filters.branchId > 0 && Number(row.branch_id || 0) !== filters.branchId) return false;
        if (filters.balanceMode === 'with_balance' && Number(row.balance_amount || 0) <= 0) return false;
        if (filters.balanceMode === 'paid' && Number(row.balance_amount || 0) > 0) return false;
        if (!isWithinDateRange(row.created_at, from, to)) return false;
        if (search) {
            const haystack = [
                row.first_name,
                row.last_name,
                row.email,
                row.branch_name,
                row.package_name,
                row.payment_type,
                row.student_id
            ].join(' ').toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });
}

function filterRegistrationRows(rows, filters) {
    const search = String(filters.search || '').trim().toLowerCase();
    const from = parseDateInput(filters.dateFrom);
    const to = parseDateInput(filters.dateTo);
    return rows.filter(row => {
        if (filters.branchId > 0 && Number(row.branch_id || 0) !== filters.branchId) return false;
        if (filters.balanceMode === 'with_balance' && Number(row.registration_balance || 0) <= 0) return false;
        if (filters.balanceMode === 'paid' && Number(row.registration_balance || 0) > 0) return false;
        if (!isWithinDateRange(row.created_at, from, to)) return false;
        if (search) {
            const haystack = [
                row.first_name,
                row.last_name,
                row.email,
                row.branch_name,
                row.registration_source,
                row.registration_status,
                row.student_id
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
    const totalCharges = totalCollected + totalOutstanding;
    const accountsWithBalance =
        filteredRegistrations.filter(item => Number(item.registration_balance || 0) > 0).length +
        filteredEnrollments.filter(item => Number(item.balance_amount || 0) > 0).length;

    setText('statCollected', formatCurrencyPHP(totalCollected));
    setText('statOutstanding', formatCurrencyPHP(totalOutstanding));
    setText('statTotalCharges', formatCurrencyPHP(totalCharges));
    setText('statBalanceAccounts', String(accountsWithBalance));
    setText('paymentCollectionRate', totalCharges > 0 ? `${Math.round((totalCollected / totalCharges) * 100)}%` : '0%');
    setText('paymentCollectedAmount', formatCurrencyPHP(totalCollected));
    setText('paymentOutstandingAmount', formatCurrencyPHP(totalOutstanding));
    const bar = document.getElementById('paymentCollectionBar');
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, totalCharges > 0 ? (totalCollected / totalCharges) * 100 : 0)).toFixed(1)}%`;
}

function renderBranchBoard() {}

function renderCollectionHealth() {}

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
        return;
    }

    list.innerHTML = rows.map(item => {
        const studentName = `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Student';
        return `
            <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <div class="truncate text-sm font-bold text-slate-900">${escapeHtml(studentName)}</div>
                        <div class="truncate text-xs text-slate-500 mt-0.5">${escapeHtml(item.branch_name || '—')} • ${escapeHtml(item.package_name || 'Package')}</div>
                    </div>
                    ${renderPill(item.payment_type || '—', item.payment_type || '—')}
                </div>
                <div class="mt-2 flex items-center justify-between gap-3">
                    <div class="text-xs text-slate-500">Paid ${formatCurrencyPHP(item.paid_amount || 0)} of ${formatCurrencyPHP(item.total_amount || 0)}</div>
                    <div class="text-base font-black text-amber-700">${formatCurrencyPHP(item.balance_amount || 0)}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderEnrollmentTable(enrollments) {
    const body    = document.getElementById('enrollmentPaymentsTable');
    const summary = document.getElementById('enrollmentTableSummary');
    if (!body) return;
    const page        = getPaginatedRows(enrollments, 'enrollmentTable');
    const visibleRows = page.rows;

    if (!enrollments.length) {
        body.innerHTML = `
            <tr>
                <td colspan="7" class="px-5 py-10 text-center text-slate-400 text-sm">
                    <i class="fas fa-wallet text-xl mb-2 text-slate-200"></i>
                    <p>No enrollment payment records match the current filters.</p>
                </td>
            </tr>`;
        if (summary) summary.textContent = '0 records';
        renderPaymentPagination('enrollmentTablePagination', 'enrollmentTable', page);
        return;
    }

    if (summary) summary.textContent = `${enrollments.length} record${enrollments.length === 1 ? '' : 's'}`;

    body.innerHTML = visibleRows.map(row => {
        const studentName  = `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Student';
        const stuId        = row.student_id ? `STU-${String(row.student_id).padStart(4,'0')}` : '';
        const enrollDate   = row.enrollment_date || row.created_at || '';
        let   subLine      = stuId;
        if (enrollDate) {
            const d = new Date(enrollDate);
            if (!Number.isNaN(d.getTime())) {
                subLine += (subLine ? ' \u00B7 ' : '') + 'Enrolled ' + d.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' });
            }
        }

        const balance      = Number(row.balance_amount  || 0);
        const paid         = Number(row.paid_amount     || 0);
        const totalCharges = Number(row.total_charges   || row.charge_amount || (paid + balance) || 0);
        const branchName   = row.branch_name || '\u2014';

        const statusLabel  = balance <= 0 ? 'Paid' : (paid > 0 ? 'Partial' : 'Unpaid');
        const statusCls    = statusLabel === 'Paid'
            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
            : statusLabel === 'Partial'
                ? 'border border-amber-200 bg-amber-50 text-amber-700'
                : 'border border-red-200 bg-red-50 text-red-700';

        const balanceDisplay = balance <= 0
            ? `<span class="text-sm font-medium text-slate-900">${formatCurrencyPHP(0)}</span>`
            : `<span class="text-sm font-medium text-slate-900">${formatCurrencyPHP(balance)}</span>`;

        const ledgerUrl = buildStudentLedgerUrl(row);

        return `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-5 py-4 table-name-cell">
                <div class="text-sm font-semibold text-slate-900 leading-tight truncate-text" title="${escapeHtml(studentName)}">${escapeHtml(studentName)}</div>
                ${subLine ? `<div class="text-xs text-slate-400 mt-0.5 truncate-text" title="${escapeHtml(subLine)}">${escapeHtml(subLine)}</div>` : ''}
            </td>
            <td class="px-5 py-4 text-sm text-slate-600 table-text-cell truncate-text" title="${escapeHtml(branchName)}">${escapeHtml(branchName)}</td>
            <td class="px-5 py-4 text-right text-sm text-slate-700 table-money-cell">${formatCurrencyPHP(totalCharges)}</td>
            <td class="px-5 py-4 text-right text-sm font-medium text-emerald-600 table-money-cell">${formatCurrencyPHP(paid)}</td>
            <td class="px-5 py-4 text-right table-money-cell">${balanceDisplay}</td>
            <td class="px-5 py-4 text-center table-status-cell">
                <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCls}">${statusLabel}</span>
            </td>
            <td class="px-5 py-4 text-right table-actions-cell">
                ${ledgerUrl
                    ? `<a href="${ledgerUrl}" class="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition">
                           <i class="fas fa-eye text-slate-400 text-[10px]"></i> View Ledger
                       </a>`
                    : ''}
            </td>
        </tr>`;
    }).join('');

    renderPaymentPagination('enrollmentTablePagination', 'enrollmentTable', page);
}

function renderRegistrationTable(registrations) {
    const body = document.getElementById('registrationPaymentsTable');
    const summary = document.getElementById('registrationTableSummary');
    if (!body) return;
    const grouped = Object.values(registrations.reduce((acc, row) => {
        const branchName = row.branch_name || 'Unassigned Branch';
        if (!acc[branchName]) {
            acc[branchName] = {
                branch_name: branchName,
                registration_paid: 0,
                registration_balance: 0,
                student_count: 0
            };
        }
        acc[branchName].registration_paid += Number(row.registration_paid || 0);
        acc[branchName].registration_balance += Number(row.registration_balance || 0);
        acc[branchName].student_count += 1;
        return acc;
    }, {})).sort((a, b) => Number(b.registration_paid || 0) - Number(a.registration_paid || 0));

    const page = getPaginatedRows(grouped, 'registrationTable');
    const visibleRows = page.rows;

    if (!grouped.length) {
        body.innerHTML = `
            <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">No registration fee records match the current filters.</div>
        `;
        if (summary) summary.textContent = '0 branches in view';
        renderPaymentPagination('registrationTablePagination', 'registrationTable', page);
        return;
    }

    if (summary) summary.textContent = `${grouped.length} branch${grouped.length === 1 ? '' : 'es'} in current view`;
    body.innerHTML = visibleRows.map(row => `
        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div class="flex items-center justify-between gap-4">
                <div>
                    <div class="text-base font-semibold text-slate-900">${escapeHtml(row.branch_name || 'Branch')}</div>
                    <div class="text-xs text-slate-500 mt-1">${row.student_count} student${row.student_count === 1 ? '' : 's'} in view</div>
                </div>
                <div class="text-right">
                    <div class="text-lg font-black text-slate-900">${formatCurrencyPHP(row.registration_paid || 0)}</div>
                    <div class="text-xs text-slate-500">Fees collected</div>
                </div>
            </div>
        </div>
    `).join('');
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
        dateFrom: document.getElementById('paymentDateFrom')?.value || '',
        dateTo: document.getElementById('paymentDateTo')?.value || '',
        sortMode: 'highest_balance'
    };
}

function attachPaymentFilters(refresh) {
    ['paymentSearch', 'paymentBranchFilter', 'paymentBalanceFilter', 'paymentDateFrom', 'paymentDateTo'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const eventName = id === 'paymentSearch' ? 'input' : 'change';
        el.addEventListener(eventName, () => {
            resetPaymentPagination();
            refresh();
        });
    });

    document.getElementById('paymentSort')?.addEventListener('click', () => {
        resetPaymentPagination();
        ['paymentSearch', 'paymentBranchFilter', 'paymentBalanceFilter', 'paymentDateFrom', 'paymentDateTo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        refresh();
    });

    document.getElementById('paymentBalanceModeBtn')?.addEventListener('click', () => {
        resetPaymentPagination();
        ['paymentSearch', 'paymentBranchFilter', 'paymentBalanceFilter', 'paymentDateFrom', 'paymentDateTo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        refresh();
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

    renderOverview(filteredRegistrations, filteredEnrollments);
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
        document.getElementById('paymentPrintBtn')?.addEventListener('click', () => window.print());
        document.getElementById('paymentExportBtn')?.addEventListener('click', async () => {
            try {
                const params = new URLSearchParams({
                    action: 'get-active-enrollments',
                    ...Object.fromEntries(Object.entries(getFilters()).filter(([, v]) => v !== ''))
                });
                const res = await axios.get(`${baseApiUrl}/students.php?action=get-active-enrollments`);
                const rows = res.data?.enrollments || [];
                if (!rows.length) {
                    showPaymentsMessage('No payment data to export.', 'info');
                    return;
                }
                const headers = ['Student', 'Email', 'Branch', 'Package', 'Total', 'Paid', 'Balance', 'Status'];
                const csvRows = rows.map(row => {
                    const studentName = `${row.first_name || ''} ${row.last_name || ''}`.trim();
                    const status = Number(row.balance_amount || 0) > 0 ? 'Partial' : 'Paid';
                    return [
                        studentName,
                        row.email || '',
                        row.branch_name || '',
                        row.package_name || '',
                        row.total_amount || 0,
                        row.paid_amount || 0,
                        row.balance_amount || 0,
                        status
                    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
                });
                const csv = [headers.join(','), ...csvRows].join('\\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `payment_center_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            } catch (error) {
                showPaymentsMessage('Failed to export CSV.', 'error');
            }
        });
    } catch (error) {
        console.error('Failed to load admin payment center:', error);
        showPaymentsMessage('Failed to load payment data. Please refresh and try again.', 'error');
        renderLargestBalances([]);
        renderEnrollmentTable([]);
        renderRegistrationTable([]);
    }
});

// ══ Record Payment Modal ════════════════════════════════════════════

const rpState = {
    enrollments: [],   // full list loaded once
    filtered:    [],   // filtered by branch
    adminBranchId: 0,  // 0 = super admin (all branches), >0 = scoped
};

function rpShowMessage(text, type = 'error') {
    const el = document.getElementById('rpMessage');
    if (!el) return;
    const cls = type === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-red-200 bg-red-50 text-red-700';
    el.className = `rounded-xl border px-3 py-2.5 text-sm ${cls}`;
    el.textContent = text;
    el.classList.remove('hidden');
}

function rpHideMessage() {
    document.getElementById('rpMessage')?.classList.add('hidden');
}

function rpPopulateStudents(enrollments) {
    const sel = document.getElementById('rpStudentSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select a student…</option>' +
        enrollments.map(e => {
            const name = `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Student';
            const branch = e.branch_name || '';
            const balance = Math.max(0, Number(e.total_amount || 0) - Number(e.paid_amount || 0));
            return `<option value="${e.enrollment_id}" data-balance="${balance}" data-branch="${escapeHtml(branch)}">
                ${escapeHtml(name)} — ${escapeHtml(branch)}
            </option>`;
        }).join('');

    // Reset balance hint
    document.getElementById('rpBalanceHint')?.classList.add('hidden');
}

function rpFilterByBranch(branchId) {
    rpState.filtered = branchId > 0
        ? rpState.enrollments.filter(e => Number(e.branch_id || 0) === branchId)
        : rpState.enrollments;
    rpPopulateStudents(rpState.filtered);
}

function openRecordPaymentModal() {
    const modal = document.getElementById('recordPaymentModal');
    if (!modal) return;

    // Determine if admin is branch-scoped
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
    const role = String(user?.role_name || '').toLowerCase();
    rpState.adminBranchId = ['staff','desk','front desk','manager','branch manager'].includes(role)
        ? Number(user?.branch_id || 0)
        : 0;

    // Set today's date
    const dateInput = document.getElementById('rpDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    // Reset form
    document.getElementById('recordPaymentForm')?.reset();
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    rpHideMessage();
    document.getElementById('rpBalanceHint')?.classList.add('hidden');

    // Show or hide branch filter
    const branchRow = document.getElementById('rpBranchRow');
    const branchSel = document.getElementById('rpBranchSelect');
    if (rpState.adminBranchId > 0) {
        // Scoped: hide branch filter, filter directly
        branchRow?.classList.add('hidden');
        rpFilterByBranch(rpState.adminBranchId);
    } else {
        // Super admin: show branch filter
        branchRow?.classList.remove('hidden');
        // Populate branch dropdown from cached data
        if (paymentCenterDataCache?.branches?.length && branchSel) {
            branchSel.innerHTML = '<option value="">All branches</option>' +
                paymentCenterDataCache.branches
                    .filter(b => String(b.status || 'Active').toLowerCase() === 'active')
                    .map(b => `<option value="${b.branch_id}">${escapeHtml(b.branch_name || 'Branch')}</option>`)
                    .join('');
        }
        rpFilterByBranch(0);
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeRecordPaymentModal() {
    const modal = document.getElementById('recordPaymentModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function initRecordPaymentModal() {
    // Use enrollments already loaded by the payment center
    // Refresh whenever modal opens via paymentCenterDataCache
    document.getElementById('openRecordPaymentModalBtn')?.addEventListener('click', () => {
        if (paymentCenterDataCache?.enrollments) {
            rpState.enrollments = paymentCenterDataCache.enrollments;
        }
        openRecordPaymentModal();
    });

    document.getElementById('closeRecordPaymentModal')?.addEventListener('click', closeRecordPaymentModal);
    document.getElementById('rpCancelBtn')?.addEventListener('click', closeRecordPaymentModal);

    // Close on backdrop click
    document.getElementById('recordPaymentModal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) closeRecordPaymentModal();
    });

    // Branch filter change (super admin only)
    document.getElementById('rpBranchSelect')?.addEventListener('change', function () {
        rpFilterByBranch(Number(this.value) || 0);
        document.getElementById('rpBalanceHint')?.classList.add('hidden');
    });

    // Student change → show balance
    document.getElementById('rpStudentSelect')?.addEventListener('change', function () {
        const opt = this.options[this.selectedIndex];
        const balance = parseFloat(opt?.dataset?.balance || '0');
        const hint   = document.getElementById('rpBalanceHint');
        const amt    = document.getElementById('rpBalanceAmount');
        if (this.value && hint && amt) {
            amt.textContent = `₱${balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
            hint.classList.remove('hidden');
            // Pre-fill amount with full balance
            const amtInput = document.getElementById('rpAmount');
            if (amtInput && balance > 0) amtInput.value = balance.toFixed(2);
        } else {
            hint?.classList.add('hidden');
        }
        rpHideMessage();
    });

    // Form submit
    document.getElementById('recordPaymentForm')?.addEventListener('submit', async function (e) {
        e.preventDefault();
        rpHideMessage();

        const enrollmentId = Number(document.getElementById('rpStudentSelect')?.value || 0);
        const amount       = parseFloat(document.getElementById('rpAmount')?.value   || '0');
        const date         = document.getElementById('rpDate')?.value    || '';
        const method       = document.getElementById('rpMethod')?.value  || 'Cash';
        const receipt      = document.getElementById('rpReceipt')?.value || '';
        const notes        = document.getElementById('rpNote')?.value    || '';

        if (!enrollmentId) { rpShowMessage('Please select a student.'); return; }
        if (!(amount > 0))  { rpShowMessage('Enter a valid amount greater than 0.'); return; }

        const btn      = document.getElementById('rpSubmitBtn');
        const btnText  = document.getElementById('rpSubmitText');
        btn.disabled   = true;
        btnText.textContent = 'Saving…';

        try {
            const res  = await axios.post(`${baseApiUrl}/students.php?action=record-enrollment-payment`, {
                enrollment_id:  enrollmentId,
                amount,
                payment_date:   date,
                payment_method: method,
                receipt_number: receipt,
                notes
            });
            const data = res.data || {};
            if (!data.success) {
                rpShowMessage(data.error || 'Failed to record payment.'); return;
            }

            rpShowMessage(data.message || 'Payment saved.', 'success');

            // Refresh the payment center data in background
            try {
                const fresh = await loadPaymentCenter();
                Object.assign(paymentCenterDataCache, fresh);
                rpState.enrollments = fresh.enrollments || [];
                renderPaymentCenter(paymentCenterDataCache);
            } catch (_) { /* non-fatal */ }

            setTimeout(closeRecordPaymentModal, 1400);
        } catch (err) {
            rpShowMessage(err?.response?.data?.error || err.message || 'Network error.');
        } finally {
            btn.disabled = false;
            btnText.textContent = 'Save Payment';
        }
    });
}

// Initialise after DOMContentLoaded is already wired above — piggyback safely
document.addEventListener('DOMContentLoaded', initRecordPaymentModal);
