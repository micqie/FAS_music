let reportCharts = {
    funnel: null,
    revenue: null,
    branch: null,
    paymentMix: null
};

function setReportText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function showReportsMessage(message, type = 'info') {
    const box = document.getElementById('reportsMessage');
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

function reportCurrency(value) {
    return formatCurrencyPHP(Number(value || 0));
}

function reportPercent(value) {
    const num = Number(value) || 0;
    return `${num.toFixed(num >= 10 ? 0 : 1)}%`;
}

function makeChart(ctx, current, config) {
    if (current) current.destroy();
    return new Chart(ctx, config);
}

function mapBranches(branches) {
    const map = new Map();
    (branches || []).forEach(branch => {
        map.set(Number(branch.branch_id || 0), branch);
    });
    return map;
}

function normalizeRegistrationRows(rows, branchMap) {
    return (rows || []).map(row => {
        const branchId = Number(row.branch_id || 0);
        const total = Number(row.registration_fee_amount || 1000);
        const paid = Number(row.registration_fee_paid || 0);
        return {
            ...row,
            branch_id: branchId,
            branch_name: row.branch_name || branchMap.get(branchId)?.branch_name || 'Unassigned Branch',
            registration_total: total,
            registration_paid: paid,
            registration_balance: Math.max(0, total - paid)
        };
    });
}

function normalizeEnrollmentRows(rows, branchMap) {
    return (rows || []).map(row => {
        const branchId = Number(row.branch_id || 0);
        const total = Number(row.total_amount || 0);
        const paid = Number(row.paid_amount || 0);
        return {
            ...row,
            branch_id: branchId,
            branch_name: row.branch_name || branchMap.get(branchId)?.branch_name || 'Unassigned Branch',
            total_amount: total,
            paid_amount: paid,
            balance_amount: Math.max(0, total - paid)
        };
    });
}

function getReportFilters() {
    return {
        branchId: Number(document.getElementById('reportBranchFilter')?.value || 0),
        scope: document.getElementById('reportScopeFilter')?.value || 'all',
        sortMode: document.getElementById('reportSortFilter')?.value || 'revenue'
    };
}

function populateReportBranchFilter(branches) {
    const select = document.getElementById('reportBranchFilter');
    if (!select) return;
    const currentValue = select.value;
    const options = (branches || [])
        .filter(branch => String(branch.status || 'Active').toLowerCase() === 'active')
        .map(branch => `<option value="${Number(branch.branch_id || 0)}">${escapeHtml(branch.branch_name || 'Branch')}</option>`)
        .join('');
    select.innerHTML = '<option value="">All Branches</option>' + options;
    select.value = currentValue;
}

function filterRows(rows, branchId) {
    if (branchId < 1) return rows;
    return rows.filter(row => Number(row.branch_id || 0) === branchId);
}

function applyScopeToRows(registrations, enrollments, scope) {
    if (scope === 'registrations') {
        return {
            registrations: registrations,
            enrollments: []
        };
    }
    if (scope === 'enrollments') {
        return {
            registrations: [],
            enrollments: enrollments
        };
    }
    if (scope === 'payments') {
        return {
            registrations: registrations.filter(item => Number(item.registration_paid || 0) > 0 || Number(item.registration_balance || 0) > 0),
            enrollments: enrollments.filter(item => Number(item.paid_amount || 0) > 0 || Number(item.balance_amount || 0) > 0)
        };
    }
    return {
        registrations,
        enrollments
    };
}

function computeBranchMetrics(branches, registrations, enrollments) {
    return (branches || []).map(branch => {
        const branchId = Number(branch.branch_id || 0);
        const branchRegistrations = registrations.filter(item => Number(item.branch_id || 0) === branchId);
        const branchEnrollments = enrollments.filter(item => Number(item.branch_id || 0) === branchId);
        const registrationRevenue = branchRegistrations.reduce((sum, item) => sum + Number(item.registration_paid || 0), 0);
        const enrollmentRevenue = branchEnrollments.reduce((sum, item) => sum + Number(item.paid_amount || 0), 0);
        const outstanding = branchRegistrations.reduce((sum, item) => sum + Number(item.registration_balance || 0), 0)
            + branchEnrollments.reduce((sum, item) => sum + Number(item.balance_amount || 0), 0);
        const activeStudents = new Set(branchEnrollments.map(item => Number(item.student_id || 0)).filter(Boolean)).size;
        const approvedFees = branchRegistrations.filter(item => ['approved', 'fee paid'].includes(String(item.registration_status || '').toLowerCase())).length;
        const pendingFees = branchRegistrations.filter(item => String(item.registration_status || '').toLowerCase() === 'pending').length;
        const totalRevenue = registrationRevenue + enrollmentRevenue;
        const collectionBase = totalRevenue + outstanding;
        return {
            ...branch,
            totalRevenue,
            registrationRevenue,
            enrollmentRevenue,
            outstanding,
            activeStudents,
            approvedFees,
            pendingFees,
            collectionRate: collectionBase > 0 ? (totalRevenue / collectionBase) * 100 : 0
        };
    }).filter(item =>
        item.totalRevenue > 0 ||
        item.outstanding > 0 ||
        item.activeStudents > 0 ||
        item.approvedFees > 0 ||
        item.pendingFees > 0
    );
}

function buildSummary(registrations, enrollments, branchMetrics) {
    const totalRegistrations = registrations.length;
    const pendingRegistrations = registrations.filter(item => String(item.registration_status || '').toLowerCase() === 'pending').length;
    const approvedFees = registrations.filter(item => ['approved', 'fee paid'].includes(String(item.registration_status || '').toLowerCase())).length;
    const activeEnrollments = enrollments.length;
    const registrationRevenue = registrations.reduce((sum, item) => sum + Number(item.registration_paid || 0), 0);
    const enrollmentRevenue = enrollments.reduce((sum, item) => sum + Number(item.paid_amount || 0), 0);
    const outstanding = registrations.reduce((sum, item) => sum + Number(item.registration_balance || 0), 0)
        + enrollments.reduce((sum, item) => sum + Number(item.balance_amount || 0), 0);
    const fullPayments = enrollments.filter(item => String(item.payment_type || '').toLowerCase() === 'full payment').length;
    const partialPayments = enrollments.filter(item => String(item.payment_type || '').toLowerCase() === 'partial payment').length;
    const installmentPayments = enrollments.filter(item => String(item.payment_type || '').toLowerCase() === 'installment').length;
    const processRate = totalRegistrations > 0 ? (activeEnrollments / totalRegistrations) * 100 : 0;
    const revenue = registrationRevenue + enrollmentRevenue;
    const collectionRate = revenue + outstanding > 0 ? (revenue / (revenue + outstanding)) * 100 : 0;
    const topBranch = [...branchMetrics].sort((a, b) => Number(b.totalRevenue || 0) - Number(a.totalRevenue || 0))[0] || null;

    return {
        totalRegistrations,
        pendingRegistrations,
        approvedFees,
        activeEnrollments,
        registrationRevenue,
        enrollmentRevenue,
        outstanding,
        revenue,
        processRate,
        collectionRate,
        fullPayments,
        partialPayments,
        installmentPayments,
        topBranch
    };
}

function updateHeroAndStats(summary) {
    setReportText('heroProcessRate', reportPercent(summary.processRate));
    setReportText('heroProcessHint', `${summary.activeEnrollments} active enrollment${summary.activeEnrollments === 1 ? '' : 's'} from ${summary.totalRegistrations} tracked registration${summary.totalRegistrations === 1 ? '' : 's'}`);
    setReportText('heroCollectionRate', reportPercent(summary.collectionRate));
    setReportText('heroCollectionHint', `${reportCurrency(summary.revenue)} collected with ${reportCurrency(summary.outstanding)} still outstanding`);

    setReportText('reportStatRegistrations', String(summary.totalRegistrations));
    setReportText('reportStatApprovedFees', String(summary.approvedFees));
    setReportText('reportStatEnrollments', String(summary.activeEnrollments));
    setReportText('reportStatRevenue', reportCurrency(summary.revenue));
    setReportText('reportStatOutstanding', reportCurrency(summary.outstanding));
}

function renderFunnelChart(summary) {
    const canvas = document.getElementById('processFunnelChart');
    if (!canvas) return;
    reportCharts.funnel = makeChart(canvas, reportCharts.funnel, {
        type: 'bar',
        data: {
            labels: ['Tracked Registrations', 'Approved Fees', 'Active Enrollments'],
            datasets: [{
                label: 'Students / Records',
                data: [summary.totalRegistrations, summary.approvedFees, summary.activeEnrollments],
                backgroundColor: ['#cbd5e1', '#d4af37', '#0f766e'],
                borderRadius: 14,
                borderSkipped: false
            }]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderRevenueChart(summary) {
    const canvas = document.getElementById('revenueMixChart');
    if (!canvas) return;
    reportCharts.revenue = makeChart(canvas, reportCharts.revenue, {
        type: 'doughnut',
        data: {
            labels: ['Registration Revenue', 'Enrollment Revenue', 'Outstanding Balance'],
            datasets: [{
                data: [summary.registrationRevenue, summary.enrollmentRevenue, summary.outstanding],
                backgroundColor: ['#d4af37', '#0f766e', '#f59e0b'],
                borderWidth: 0
            }]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function renderBranchChart(branchMetrics) {
    const canvas = document.getElementById('branchPerformanceChart');
    if (!canvas) return;
    const topBranches = [...branchMetrics]
        .sort((a, b) => Number(b.totalRevenue || 0) - Number(a.totalRevenue || 0))
        .slice(0, 6);

    reportCharts.branch = makeChart(canvas, reportCharts.branch, {
        type: 'bar',
        data: {
            labels: topBranches.map(item => item.branch_name || 'Branch'),
            datasets: [
                {
                    label: 'Collected',
                    data: topBranches.map(item => Number(item.totalRevenue || 0)),
                    backgroundColor: '#0f766e',
                    borderRadius: 10,
                    borderSkipped: false
                },
                {
                    label: 'Outstanding',
                    data: topBranches.map(item => Number(item.outstanding || 0)),
                    backgroundColor: '#f59e0b',
                    borderRadius: 10,
                    borderSkipped: false
                }
            ]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            },
            scales: {
                y: { beginAtZero: true },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderPaymentMixChart(summary) {
    const canvas = document.getElementById('paymentMixChart');
    if (!canvas) return;
    reportCharts.paymentMix = makeChart(canvas, reportCharts.paymentMix, {
        type: 'pie',
        data: {
            labels: ['Full Payment', 'Partial Payment', 'Installment'],
            datasets: [{
                data: [summary.fullPayments, summary.partialPayments, summary.installmentPayments],
                backgroundColor: ['#0f766e', '#d4af37', '#7c3aed'],
                borderWidth: 0
            }]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function renderBranchRanking(branchMetrics, sortMode, scope) {
    const board = document.getElementById('branchRankingBoard');
    const summary = document.getElementById('branchRankingSummary');
    if (!board) return;

    if (!branchMetrics.length) {
        board.innerHTML = '<div class="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">No matching branch records were returned from the current database filter.</div>';
        if (summary) summary.textContent = '0 ranked branches from live data';
        return;
    }

    const rows = [...branchMetrics].sort((a, b) => {
        if (sortMode === 'collection') return Number(b.collectionRate || 0) - Number(a.collectionRate || 0);
        if (sortMode === 'outstanding') return Number(b.outstanding || 0) - Number(a.outstanding || 0);
        if (sortMode === 'students') return Number(b.activeStudents || 0) - Number(a.activeStudents || 0);
        return Number(b.totalRevenue || 0) - Number(a.totalRevenue || 0);
    });

    if (summary) summary.textContent = `${rows.length} ranked branch${rows.length === 1 ? '' : 'es'} • ${scope === 'all' ? 'overall flow' : scope}`;

    board.innerHTML = rows.map((item, index) => `
        <article class="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5">
            <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                    <div class="flex items-center gap-3">
                        <div class="grid h-10 w-10 place-items-center rounded-2xl ${index === 0 ? 'bg-gold-500 text-black' : 'bg-slate-100 text-slate-700'} font-black">${index + 1}</div>
                        <div>
                            <div class="truncate text-lg font-black text-slate-900">${escapeHtml(item.branch_name || 'Branch')}</div>
                            <div class="text-xs text-slate-500 mt-1">${escapeHtml(item.address || 'Branch performance snapshot')}</div>
                        </div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-bold">Collection</div>
                    <div class="mt-1 text-lg font-black text-slate-900">${reportPercent(item.collectionRate)}</div>
                </div>
            </div>
            <div class="mt-4 grid grid-cols-2 gap-3">
                <div class="rounded-2xl bg-emerald-50 border border-emerald-100 px-3 py-3">
                    <div class="text-[10px] uppercase tracking-[0.18em] text-emerald-700 font-bold">Revenue</div>
                    <div class="mt-2 text-lg font-black text-emerald-900">${reportCurrency(item.totalRevenue)}</div>
                </div>
                <div class="rounded-2xl bg-amber-50 border border-amber-100 px-3 py-3">
                    <div class="text-[10px] uppercase tracking-[0.18em] text-amber-700 font-bold">Outstanding</div>
                    <div class="mt-2 text-lg font-black text-amber-900">${reportCurrency(item.outstanding)}</div>
                </div>
            </div>
            <div class="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div class="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <div class="text-xs text-slate-500">Students</div>
                    <div class="mt-1 font-bold text-slate-900">${item.activeStudents}</div>
                </div>
                <div class="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <div class="text-xs text-slate-500">Fee Approved</div>
                    <div class="mt-1 font-bold text-slate-900">${item.approvedFees}</div>
                </div>
                <div class="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <div class="text-xs text-slate-500">Fee Pending</div>
                    <div class="mt-1 font-bold text-slate-900">${item.pendingFees}</div>
                </div>
            </div>
        </article>
    `).join('');
}

function renderInsights(summary, branchMetrics, filters) {
    const box = document.getElementById('reportInsights');
    if (!box) return;

    const topBranch = summary.topBranch;
    const weakestCollection = [...branchMetrics].sort((a, b) => Number(a.collectionRate || 0) - Number(b.collectionRate || 0))[0] || null;
    const mostOutstanding = [...branchMetrics].sort((a, b) => Number(b.outstanding || 0) - Number(a.outstanding || 0))[0] || null;

    const items = [
        `The current process completion rate is ${reportPercent(summary.processRate)}, based on ${summary.activeEnrollments} active enrollments from ${summary.totalRegistrations} tracked registrations.`,
        `Total revenue in this report view is ${reportCurrency(summary.revenue)}, while remaining outstanding balances are ${reportCurrency(summary.outstanding)}.`,
        topBranch ? `${escapeHtml(topBranch.branch_name)} is currently the top revenue branch at ${reportCurrency(topBranch.totalRevenue)}.` : 'No branch revenue records were returned for the current filter.',
        mostOutstanding ? `${escapeHtml(mostOutstanding.branch_name)} carries the largest outstanding balance at ${reportCurrency(mostOutstanding.outstanding)}.` : 'No outstanding balances were returned for the current filter.',
        weakestCollection ? `${escapeHtml(weakestCollection.branch_name)} has the weakest collection rate at ${reportPercent(weakestCollection.collectionRate)}, which may need follow-up on unpaid balances.` : 'No collection gaps were returned for the current filter.',
        filters.scope === 'payments'
            ? `Payment mix is ${summary.fullPayments} full, ${summary.partialPayments} partial, and ${summary.installmentPayments} installment enrollments.`
            : `Registration fee approvals currently stand at ${summary.approvedFees}, with ${summary.pendingRegistrations} still pending confirmation.`
    ];

    box.innerHTML = items.map(text => `
        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            ${text}
        </div>
    `).join('');
}

function renderReports(data) {
    const filters = getReportFilters();
    const filteredRegistrations = filterRows(data.registrations, filters.branchId);
    const filteredEnrollments = filterRows(data.enrollments, filters.branchId);
    const scopedRows = applyScopeToRows(filteredRegistrations, filteredEnrollments, filters.scope);
    const registrations = scopedRows.registrations;
    const enrollments = scopedRows.enrollments;
    const branches = filters.branchId > 0
        ? data.branches.filter(branch => Number(branch.branch_id || 0) === filters.branchId)
        : data.branches;
    const branchMetrics = computeBranchMetrics(branches, registrations, enrollments);
    const summary = buildSummary(registrations, enrollments, branchMetrics);

    updateHeroAndStats(summary);
    renderFunnelChart(summary);
    renderRevenueChart(summary);
    renderBranchChart(branchMetrics);
    renderPaymentMixChart(summary);
    renderBranchRanking(branchMetrics, filters.sortMode, filters.scope);
    renderInsights(summary, branchMetrics, filters);
}

async function loadReportsData() {
    const [branchesResult, registrationsResult, enrollmentsResult] = await Promise.allSettled([
        axios.get(`${baseApiUrl}/branch.php?action=get-branches-all`),
        axios.get(`${baseApiUrl}/admin.php?action=get-all-registrations`),
        axios.get(`${baseApiUrl}/students.php?action=get-active-enrollments`)
    ]);

    const branchesData = branchesResult.status === 'fulfilled' ? branchesResult.value.data : null;
    const registrationsData = registrationsResult.status === 'fulfilled' ? registrationsResult.value.data : null;
    const enrollmentsData = enrollmentsResult.status === 'fulfilled' ? enrollmentsResult.value.data : null;

    const branches = branchesData?.success && Array.isArray(branchesData.branches) ? branchesData.branches : [];
    const branchMap = mapBranches(branches);
    const registrations = normalizeRegistrationRows(
        registrationsData?.success && Array.isArray(registrationsData.registrations) ? registrationsData.registrations : [],
        branchMap
    );
    const enrollments = normalizeEnrollmentRows(
        enrollmentsData?.success && Array.isArray(enrollmentsData.enrollments) ? enrollmentsData.enrollments : [],
        branchMap
    );

    if (!branches.length && !registrations.length && !enrollments.length) {
        showReportsMessage('No live report records were returned from the database yet.', 'info');
    }

    populateReportBranchFilter(branches);
    return { branches, registrations, enrollments };
}

function attachReportFilters(refresh) {
    ['reportBranchFilter', 'reportScopeFilter', 'reportSortFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', refresh);
    });
}

document.addEventListener('DOMContentLoaded', async function() {
    if (typeof checkAuth === 'function') {
        checkAuth();
    }

    if (typeof Auth !== 'undefined' && Auth.getUser) {
        const user = Auth.getUser();
        if (user) {
            const displayName = user.username || user.email || 'Admin';
            setReportText('userNameNav', displayName);
            setReportText('profileMenuName', displayName);
        }
    }

    try {
        const data = await loadReportsData();
        const refresh = () => renderReports(data);
        attachReportFilters(refresh);
        refresh();
    } catch (error) {
        console.error('Failed to load admin reports:', error);
        showReportsMessage('Failed to load report data. Please refresh and try again.', 'error');
    }
});
