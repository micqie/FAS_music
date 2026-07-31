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

function buildLedgerRows(student, payments) {
    const branchName  = student?.branch_name || '\u2014';
    const feeAmount   = Number(student?.registration_fee_amount || 1000);
    const paymentRows = [...(payments || [])].reverse();
    const rows = [];
    let balance = feeAmount;

    rows.push({
        date:        student?.created_at || paymentRows[0]?.payment_date || null,
        branch:      branchName,
        description: 'Enrollment Fee',
        receipt:     null,
        charge:      feeAmount,
        payment:     null,
        balance
    });

    // Also add package charge if available
    const packageName = student?.package_name || student?.session_package_name || '';
    const packageFee  = Number(student?.package_fee || student?.total_fee || 0);
    if (packageName && packageFee > 0) {
        balance += packageFee;
        rows.push({
            date:        student?.created_at || null,
            branch:      branchName,
            description: packageName,
            receipt:     null,
            charge:      packageFee,
            payment:     null,
            balance
        });
    }

    paymentRows.forEach(payment => {
        const amount = Number(payment.amount || 0);
        balance = Math.max(0, balance - amount);
        rows.push({
            date:        payment.payment_date,
            branch:      branchName,
            description: payment.payment_method ? `${payment.payment_method} Payment` : 'Payment',
            receipt:     payment.receipt_number || null,
            charge:      null,
            payment:     amount,
            balance
        });
    });

    return rows;
}

function renderLedgerStudent(student, resolvedStudentId) {
    const studentName = [student?.first_name, student?.middle_name, student?.last_name]
        .map(p => String(p || '').trim()).filter(Boolean).join(' ') || 'Student';

    const totalCharges = Number(student?.registration_fee_amount || 0);
    const totalPaid    = Number(student?.registration_fee_paid   || 0);
    const remaining    = Math.max(0, totalCharges - totalPaid);
    const status       = remaining <= 0 ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Unpaid');

    // Header
    document.getElementById('ledgerStudentName').textContent = studentName;
    document.getElementById('ledgerSubtitle').textContent =
        `${student?.student_id ? `STU-${String(student.student_id).padStart(4,'0')}` : resolvedStudentId || 'Ledger'} \u00B7 ${student?.branch_name || 'Unknown Branch'}`;

    // Info fields — label + value pairs, compact
    const infoFields = [
        ['Student Name',     studentName],
        ['Student ID',       student?.student_id ? `STU-${String(student.student_id).padStart(4,'0')}` : 'N/A'],
        ['Branch',           student?.branch_name           || 'N/A'],
        ['Package',          student?.package_name          || student?.session_package_name || 'Registration Ledger'],
        ['Instructor',       student?.teacher_name          || 'N/A'],
        ['Enrollment Date',  ledgerDate(student?.created_at || null)],
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
    const payments = Array.isArray(data.payments) ? data.payments : [];
    const summary  = renderLedgerStudent(
        student,
        data.resolved_student_id || getLedgerParams().studentId || getLedgerParams().studentKey
    );
    const rows = buildLedgerRows(student, payments);
    renderLedgerTransactions(student, rows);
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
