function ledgerEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function ledgerMoney(value) {
    const amount = Number(value || 0);
    return `\u20B1${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ledgerDate(value) {
    if (!value) return '\u2014';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '\u2014';
    return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getLedgerParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        studentId:  params.get('student_id')  || '',
        studentKey: params.get('student_key') || params.get('student') || params.get('email') || ''
    };
}

function getLedgerRequestUrl() {
    const { studentId, studentKey } = getLedgerParams();
    const identifier = studentId || studentKey;
    return identifier
        ? `${baseApiUrl}/admin.php?action=get-registration-details&student_id=${encodeURIComponent(identifier)}`
        : '';
}

function buildLedgerRows(student, registrationPayments, enrollments, enrollmentPayments, freezePayments) {
    const branchName = student?.branch_name || '\u2014';
    const entries = [];
    const toCents = value => Math.round(Number(value || 0) * 100);
    const day = value => String(value || '').slice(0, 10);
    const addCharge = (date, description, amount, order, category) => {
        if (toCents(amount) > 0) entries.push({ date, branch: branchName, description, receipt: null, charge: Number(amount), payment: null, order, category });
    };
    const addPayment = (date, description, payment, type, order = 1) => {
        if (String(payment.status || 'Paid').toLowerCase() !== 'paid') return;
        const amount = Number(payment.amount || 0);
        if (toCents(amount) <= 0) return;
        entries.push({
            date, branch: branchName, description,
            receipt: payment.receipt_number || payment.reference_number || null,
            charge: null, payment: amount, order, category: type
        });
    };

    const registrationFee = Number(student?.registration_fee_amount ?? 1000);
    const paidRegistrationRows = (registrationPayments || []).filter(payment =>
        String(payment.status || '').toLowerCase() === 'paid' && toCents(payment.amount) > 0);
    const sameDaySettledRegistration = paidRegistrationRows.length === 1
        && toCents(paidRegistrationRows[0].amount) === toCents(registrationFee)
        && day(paidRegistrationRows[0].payment_date) === day(student?.created_at);
    if (sameDaySettledRegistration) {
        const payment = paidRegistrationRows[0];
        entries.push({
            date: payment.payment_date, branch: branchName,
            description: `Registration Fee · Paid by ${payment.payment_method || 'Payment'}`,
            receipt: payment.receipt_number || payment.reference_number || null,
            charge: registrationFee, payment: Number(payment.amount), order: 0, category: 'registration'
        });
    } else {
        addCharge(student?.created_at, 'Registration Fee', registrationFee, 0, 'registration');
        paidRegistrationRows.forEach(payment => {
            addPayment(payment.payment_date || payment.created_at,
                `${payment.payment_method || 'Registration'} Payment · Registration Fee`, payment, 'registration', 1);
        });
    }

    const enrollmentOrder = new Map((enrollments || []).map((item, index) => [Number(item.enrollment_id), index]));
    const combinedInitialPayments = new Set();
    (enrollments || []).forEach((enrollment, index) => {
        const enrollmentDate = enrollment.created_at || enrollment.enrollment_date;
        const initialPayment = (enrollmentPayments || [])
            .filter(payment => Number(payment.enrollment_id) === Number(enrollment.enrollment_id)
                && String(payment.status || 'Paid').toLowerCase() === 'paid'
                && toCents(payment.amount) > 0
                && day(payment.payment_date || payment.created_at) === day(enrollmentDate))
            .sort((a, b) => Number(a.payment_id || 0) - Number(b.payment_id || 0))[0];
        if (initialPayment) {
            combinedInitialPayments.add(initialPayment);
            const amount = Number(initialPayment.amount);
            const paymentState = toCents(amount) >= toCents(enrollment.package_fee) ? 'Paid in full' : 'Partial payment';
            entries.push({
                date: enrollmentDate, branch: branchName,
                description: `${enrollment.package_name || 'Package'} Enrollment · ${paymentState} (${initialPayment.payment_method || 'Payment'})`,
                receipt: initialPayment.receipt_number || initialPayment.reference_number || null,
                charge: Number(enrollment.package_fee || 0), payment: amount,
                order: 2 + index * 2, category: 'package'
            });
        } else {
            addCharge(enrollmentDate, `${enrollment.package_name || 'Package'} Enrollment Charge`,
                enrollment.package_fee, 2 + index * 2, 'package');
        }
    });
    (enrollmentPayments || []).forEach(payment => {
        if (combinedInitialPayments.has(payment)) return;
        const enrollment = (enrollments || []).find(item => Number(item.enrollment_id) === Number(payment.enrollment_id));
        const enrollmentIndex = enrollmentOrder.get(Number(payment.enrollment_id)) ?? (enrollments || []).length;
        let paymentKind = '';
        try { paymentKind = JSON.parse(payment.notes || '{}').kind || ''; } catch (_) { /* historical plain notes */ }
        addPayment(payment.payment_date || payment.created_at,
            paymentKind === 'balance_online' || paymentKind === 'balance_desk'
                ? `${payment.payment_method || 'Payment'} · Remaining Balance`
                : `${payment.payment_method || 'Package'} Payment · ${enrollment?.package_name || 'Package'}`,
            payment, 'package', 3 + enrollmentIndex * 2);
    });
    let closeFreezeRepeats = 0;
    const previousFreezePayments = new Map();
    (freezePayments || []).forEach((payment, index) => {
        const date = payment.payment_date || payment.created_at;
        const key = `${payment.enrollment_id}:${payment.amount}:${payment.payment_method}:${payment.source}`;
        const recordedAt = Date.parse(String(payment.created_at || '').replace(' ', 'T'));
        const previousAt = previousFreezePayments.get(key);
        const closeRepeat = Number.isFinite(recordedAt) && Number.isFinite(previousAt)
            && recordedAt - previousAt >= 0 && recordedAt - previousAt <= 60000;
        if (closeRepeat) closeFreezeRepeats++;
        if (Number.isFinite(recordedAt)) previousFreezePayments.set(key, recordedAt);
        const amount = Number(payment.amount || 0);
        if (toCents(amount) <= 0) return;
        entries.push({
            date, branch: branchName,
            description: `Freeze Account Fee · ${payment.payment_method || 'Payment'}${closeRepeat ? ' (close repeat — verify)' : ''}`,
            receipt: payment.receipt_number || payment.reference_number || null,
            charge: amount, payment: amount, order: 2 + (enrollments || []).length * 2 + index,
            category: 'freeze'
        });
    });

    const dateTime = value => Date.parse(day(value)) || 0;
    entries.sort((a, b) => dateTime(a.date) - dateTime(b.date) || a.order - b.order);
    let balanceCents = 0;
    let totalChargesCents = 0;
    let totalPaidCents = 0;
    const chargeCentsByType = { registration: 0, package: 0, freeze: 0 };
    const paidCentsByType = { registration: 0, package: 0, freeze: 0 };
    const rows = entries.map(entry => {
        const chargeCents = toCents(entry.charge);
        const paymentCents = toCents(entry.payment);
        totalChargesCents += chargeCents;
        totalPaidCents += paymentCents;
        chargeCentsByType[entry.category] += chargeCents;
        paidCentsByType[entry.category] += paymentCents;
        balanceCents += chargeCents - paymentCents;
        return { ...entry, balance: balanceCents / 100 };
    });
    const byType = cents => Object.fromEntries(Object.entries(cents).map(([key, value]) => [key, value / 100]));
    return {
        rows, totalCharges: totalChargesCents / 100, totalPaid: totalPaidCents / 100,
        remaining: Math.max(0, (totalChargesCents - totalPaidCents) / 100),
        chargesByType: byType(chargeCentsByType), paidByType: byType(paidCentsByType),
        registrationRecordMissing: String(student?.status || '').toLowerCase() === 'active' && paidCentsByType.registration === 0,
        closeFreezeRepeats
    };
}

function renderLedgerStudent(student, resolvedStudentId, ledger, enrollments) {
    const studentName = [student?.first_name, student?.middle_name, student?.last_name]
        .map(p => String(p || '').trim()).filter(Boolean).join(' ') || 'Student';

    const { totalCharges, totalPaid, remaining, chargesByType, paidByType,
        registrationRecordMissing, closeFreezeRepeats } = ledger;
    const registrationBalance = Math.max(0, chargesByType.registration - paidByType.registration);
    const enrollmentBalance = Math.max(0, chargesByType.package - paidByType.package);
    const status       = remaining <= 0 ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Unpaid');

    // Header
    document.getElementById('ledgerStudentName').textContent = studentName;
    document.getElementById('ledgerSubtitle').textContent =
        `${student?.student_id ? `STU-${String(student.student_id).padStart(4,'0')}` : resolvedStudentId || 'Ledger'} \u00B7 ${student?.branch_name || 'Unknown Branch'}`;

    const activeEnrollments = (enrollments || []).filter(item => String(item.status || '').toLowerCase() === 'active');
    const displayEnrollments = activeEnrollments.length
        ? activeEnrollments
        : [...(enrollments || [])].sort((a, b) => Number(b.enrollment_id || 0) - Number(a.enrollment_id || 0)).slice(0, 1);
    const packageNames = [...new Set(displayEnrollments.map(item => item.package_name).filter(Boolean))];
    const instructorNames = [...new Set(displayEnrollments.map(item => item.instructor_name).filter(Boolean))];
    const latestEnrollment = [...displayEnrollments].sort((a, b) => Number(b.enrollment_id || 0) - Number(a.enrollment_id || 0))[0];
    // Info fields — label + value pairs, compact
    const infoFields = [
        ['Student Name',     studentName],
        ['Student ID',       student?.student_id ? `STU-${String(student.student_id).padStart(4,'0')}` : 'N/A'],
        ['Branch',           student?.branch_name           || 'N/A'],
        [activeEnrollments.length ? 'Active Package' : 'Latest Package', packageNames.join(', ') || 'No package enrollment'],
        [activeEnrollments.length ? 'Assigned Instructor' : 'Last Assigned Instructor', instructorNames.join(', ') || 'Not assigned'],
        ['Enrollment Date',  ledgerDate(latestEnrollment?.enrollment_date || latestEnrollment?.created_at || null)],
    ];

    document.getElementById('ledgerStudentInfo').innerHTML = infoFields.map(([label, value]) => `
        <div>
            <div class="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold mb-0.5">${ledgerEscapeHtml(label)}</div>
            <div class="text-sm font-medium text-slate-800">${ledgerEscapeHtml(value)}</div>
        </div>
    `).join('');

    // Status badge
    const badgeCls = status === 'Paid'
        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
        : status === 'Partial'
            ? 'border border-amber-200 bg-amber-50 text-amber-700'
            : 'border border-red-200 bg-red-50 text-red-700';

    // Account summary — row style like screenshot
    document.getElementById('ledgerAccountSummary').innerHTML = `
        <div class="flex items-center justify-between py-1.5">
            <span class="text-sm text-slate-600">Total Charges</span>
            <span class="text-sm font-medium text-slate-900">${ledgerMoney(totalCharges)}</span>
        </div>
        <div class="flex items-center justify-between py-1.5">
            <span class="text-sm text-slate-600">Total Paid</span>
            <span class="text-sm font-medium text-emerald-600">${ledgerMoney(totalPaid)}</span>
        </div>
        <div class="pl-3 text-xs text-slate-500 space-y-1">
            <div class="flex justify-between"><span>Registration</span><span>${ledgerMoney(paidByType.registration)}</span></div>
            <div class="flex justify-between"><span>Packages</span><span>${ledgerMoney(paidByType.package)}</span></div>
            <div class="flex justify-between"><span>Freeze account</span><span>${ledgerMoney(paidByType.freeze)}</span></div>
        </div>
        <div class="flex items-center justify-between py-1.5 text-sm text-slate-600">
            <span>Registration Balance</span><span>${ledgerMoney(registrationBalance)}</span>
        </div>
        <div class="flex items-center justify-between py-1.5 text-sm text-slate-600">
            <span>Enrollment Balance</span><span>${ledgerMoney(enrollmentBalance)}</span>
        </div>
        ${registrationRecordMissing ? '<p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">No paid registration transaction is recorded for this active student. Verify the payment record before adjusting the balance.</p>' : ''}
        ${closeFreezeRepeats ? `<p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">${closeFreezeRepeats} freeze payment${closeFreezeRepeats === 1 ? '' : 's'} recorded within a minute of another matching payment. Verify the receipts before correcting the account. All recorded payments are included in the totals.</p>` : ''}
        <div class="border-t border-slate-100 pt-3 mt-1 flex items-center justify-between">
            <span class="text-sm font-medium text-slate-800">Remaining Balance</span>
            <span class="text-base font-bold text-slate-900">${ledgerMoney(remaining)}</span>
        </div>
        <div class="flex items-center justify-between py-1.5">
            <span class="text-sm text-slate-600">Payment Status</span>
            <span class="inline-flex items-center rounded-full px-3 py-0.5 text-xs font-medium ${badgeCls}">${ledgerEscapeHtml(status)}</span>
        </div>
    `;

    return { studentName, totalCharges, totalPaid, remaining, status };
}

function renderLedgerTransactions(student, rows) {
    const tbody = document.getElementById('ledgerTransactions');
    if (!tbody) return;

    if (!rows.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-5 py-10 text-center text-slate-400 text-sm">
                    <i class="fas fa-receipt mb-2 text-slate-300 text-lg"></i>
                    <p>No transaction history found for this student.</p>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = rows.map(row => {
        const chargeCell   = row.charge   != null
            ? `<span class="text-sm text-slate-800">${ledgerMoney(row.charge)}</span>`
            : `<span class="text-slate-300">\u2014</span>`;
        const paymentCell  = row.payment  != null
            ? `<span class="text-sm font-medium text-emerald-600">${ledgerMoney(row.payment)}</span>`
            : `<span class="text-slate-300">\u2014</span>`;
        const receiptCell  = row.receipt
            ? `<span class="text-sm text-slate-700">${ledgerEscapeHtml(row.receipt)}</span>`
            : `<span class="text-slate-300">\u2014</span>`;

        return `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-5 py-3 text-sm text-slate-600 whitespace-nowrap">${ledgerEscapeHtml(ledgerDate(row.date))}</td>
            <td class="px-5 py-3 text-sm text-slate-600 whitespace-nowrap">${ledgerEscapeHtml(row.branch || '\u2014')}</td>
            <td class="px-5 py-3 text-sm text-slate-800">${ledgerEscapeHtml(row.description || '\u2014')}</td>
            <td class="px-5 py-3 text-sm text-slate-600">${receiptCell}</td>
            <td class="px-5 py-3 text-right">${chargeCell}</td>
            <td class="px-5 py-3 text-right">${paymentCell}</td>
            <td class="px-5 py-3 text-right text-sm font-medium text-slate-900">${ledgerMoney(row.balance)}</td>
        </tr>`;
    }).join('');
}

async function loadStudentLedger() {
    const url = getLedgerRequestUrl();
    if (!url) {
        document.getElementById('ledgerStudentName').textContent = 'Student Ledger';
        document.getElementById('ledgerSubtitle').textContent    = 'Missing student lookup key.';
        document.getElementById('ledgerTransactions').innerHTML  = `
            <tr><td colspan="7" class="px-5 py-10 text-center text-red-400 text-sm">
                Missing student_id or student_key in the URL.
            </td></tr>`;
        return;
    }

    const res  = await axios.get(url);
    const data = res.data || {};
    if (!data.success || !data.student) {
        throw new Error(data.error || 'Student not found');
    }

    const student  = data.student;
    const ledger = buildLedgerRows(
        student,
        Array.isArray(data.payments) ? data.payments : [],
        Array.isArray(data.enrollments) ? data.enrollments : [],
        Array.isArray(data.enrollment_payments) ? data.enrollment_payments : [],
        Array.isArray(data.freeze_payments) ? data.freeze_payments : []
    );
    const summary  = renderLedgerStudent(
        student,
        data.resolved_student_id || getLedgerParams().studentId || getLedgerParams().studentKey,
        ledger,
        Array.isArray(data.enrollments) ? data.enrollments : []
    );
    renderLedgerTransactions(student, ledger.rows);
    return summary;
}

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof Auth !== 'undefined' && Auth.getUser) {
        const user = Auth.getUser();
        if (user) {
            const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Administrator';
            const nameEl = document.getElementById('userNameNav');
            const menuEl = document.getElementById('profileMenuName');
            if (nameEl) nameEl.textContent = displayName;
            if (menuEl) menuEl.textContent = displayName;
        }
    }

    try {
        await loadStudentLedger();

        document.getElementById('ledgerPrintBtn')?.addEventListener('click', () => window.print());

        document.getElementById('ledgerExportBtn')?.addEventListener('click', () => {
            const studentName = document.getElementById('ledgerStudentName')?.textContent || 'Student';
            const rows = Array.from(document.querySelectorAll('#ledgerTransactions tr')).map(tr =>
                Array.from(tr.querySelectorAll('td')).map(td => `"${td.textContent.trim().replace(/"/g,'""')}"`).join(',')
            ).filter(r => r.replace(/,/g,'').replace(/"/g,'').trim());
            if (!rows.length) return;
            const csv  = ['Date,Branch,Description,Receipt No.,Charge,Payment,Balance', ...rows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `${studentName.replace(/\s+/g,'_').toLowerCase()}_ledger.csv`;
            a.click();
            URL.revokeObjectURL(url);
        });

    } catch (error) {
        console.error('Failed to load student ledger:', error);
        document.getElementById('ledgerStudentName').textContent = 'Student Ledger';
        document.getElementById('ledgerSubtitle').textContent    = 'Unable to load ledger.';
        document.getElementById('ledgerTransactions').innerHTML  = `
            <tr><td colspan="7" class="px-5 py-10 text-center text-red-400 text-sm">
                Failed to load ledger: ${ledgerEscapeHtml(error.message || error)}
            </td></tr>`;
    }
});
