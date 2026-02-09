// Base API URL
const baseApiUrl = sessionStorage.getItem("baseAPIUrl") || "http://localhost/FAS_music/api";

let currentStudentId = null;
let currentRegistration = null;

// Helper functions for API requests
async function apiGet(endpoint) {
    const res = await fetch(`${baseApiUrl}/${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    });
    return res.json();
}

async function apiPost(endpoint, data) {
    const res = await fetch(`${baseApiUrl}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
    });
    return res.json();
}

// Check authentication
function checkAuth() {
    const user = Auth.getUser();
    if (!user || (user.role_name !== 'Admin' && user.role_name !== 'SuperAdmin')) {
        window.location.href = '../index.html';
    }
}

// Logout
function logout() {
    Auth.logout();
}

// Show message
function showMessage(message, type = 'error') {
    const messageDiv = document.getElementById('message');
    messageDiv.className = `mb-4 p-3 rounded text-sm ${
        type === 'error' ? 'bg-red-900/50 border border-red-500 text-red-200' :
        'bg-green-900/50 border border-green-500 text-green-200'
    }`;
    messageDiv.textContent = message;
    messageDiv.classList.remove('hidden');

    setTimeout(() => {
        messageDiv.classList.add('hidden');
    }, 5000);
}

// Load Pending Registrations
async function loadPendingRegistrations() {
    document.getElementById('tableTitle').textContent = 'Pending Registrations';

    try {
        const data = await apiGet('admin.php?action=get-pending-registrations');
        if (data.success) {
            displayRegistrations(data.registrations);
            updateStats(data.registrations);
        }
    } catch (error) {
        showMessage('Failed to load registrations: ' + (error.message || error), 'error');
    }
}

// Load All Registrations
async function loadAllRegistrations() {
    document.getElementById('tableTitle').textContent = 'All Registrations';

    try {
        const data = await apiGet('admin.php?action=get-all-registrations');
        if (data.success) {
            displayRegistrations(data.registrations);
            updateStats(data.registrations);
        }
    } catch (error) {
        showMessage('Failed to load registrations: ' + (error.message || error), 'error');
    }
}

// Display Registrations
function displayRegistrations(registrations) {
    const tbody = document.getElementById('registrationsTable');

    if (!registrations || registrations.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-8 text-center text-zinc-400">
                    <i class="fas fa-inbox text-2xl mb-2"></i>
                    <p>No registrations found</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = registrations.map(reg => {
        const statusColors = {
            'Pending': 'text-yellow-400 bg-yellow-400/10',
            'Fee Paid': 'text-green-400 bg-green-400/10',
            'Approved': 'text-blue-400 bg-blue-400/10',
            'Rejected': 'text-red-400 bg-red-400/10'
        };
        const statusClass = statusColors[reg.registration_status] || 'text-zinc-400 bg-zinc-400/10';
        const remaining = parseFloat(reg.registration_fee_amount) - parseFloat(reg.registration_fee_paid || 0);

        return `
            <tr class="hover:bg-gold-500/5 transition">
                <td class="px-6 py-4">
                    <div class="font-medium text-white">${reg.first_name} ${reg.last_name}</div>
                    <div class="text-sm text-zinc-400">${reg.email || ''}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-white">${reg.guardian_first_name || ''} ${reg.guardian_last_name || ''}</div>
                    <div class="text-sm text-zinc-400">${reg.guardian_phone || ''}</div>
                </td>
                <td class="px-6 py-4 text-zinc-300">${reg.branch_name || ''}</td>
                <td class="px-6 py-4">
                    <div class="text-white">₱${parseFloat(reg.registration_fee_amount || 0).toFixed(2)}</div>
                    ${remaining > 0 ? `<div class="text-sm text-red-400">Remaining: ₱${remaining.toFixed(2)}</div>` : ''}
                </td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded text-xs font-semibold ${statusClass}">
                        ${reg.registration_status}
                    </span>
                </td>
                <td class="px-6 py-4 text-zinc-400 text-sm">
                    ${new Date(reg.created_at).toLocaleDateString()}
                </td>
                <td class="px-6 py-4">
                    <div class="flex gap-2">
                        <button onclick="viewDetails(${reg.student_id})"
                            class="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded text-sm transition">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${reg.registration_status === 'Pending' ? `
                            <button onclick="openPaymentModal(${reg.student_id})"
                                class="px-3 py-1 bg-gold-500/20 hover:bg-gold-500/30 text-gold-400 rounded text-sm transition">
                                <i class="fas fa-money-bill-wave"></i>
                            </button>
                            <button onclick="rejectRegistration(${reg.student_id})"
                                class="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm transition">
                                <i class="fas fa-times"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Update Stats
function updateStats(registrations) {
    const stats = { pending: 0, feePaid: 0, approved: 0, total: registrations.length };
    registrations.forEach(reg => {
        if (reg.registration_status === 'Pending') stats.pending++;
        if (reg.registration_status === 'Fee Paid') stats.feePaid++;
        if (reg.registration_status === 'Approved') stats.approved++;
    });

    document.getElementById('statPending').textContent = stats.pending;
    document.getElementById('statFeePaid').textContent = stats.feePaid;
    document.getElementById('statApproved').textContent = stats.approved;
    document.getElementById('statTotal').textContent = stats.total;
}

// View Details
async function viewDetails(studentId) {
    try {
        const data = await apiGet(`admin.php?action=get-registration-details&student_id=${studentId}`);
        if (!data.success) return;

        const { student, guardians, payments, user_account } = data;
        const detailsHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h4 class="text-lg font-bold text-gold-400 mb-4">Student Information</h4>
                    <div class="space-y-2 text-sm">
                        <p><span class="text-zinc-400">Name:</span> <span class="text-white">${student.first_name} ${student.middle_name || ''} ${student.last_name}</span></p>
                        <p><span class="text-zinc-400">Email:</span> <span class="text-white">${student.email || 'N/A'}</span></p>
                        <p><span class="text-zinc-400">Phone:</span> <span class="text-white">${student.phone || 'N/A'}</span></p>
                        <p><span class="text-zinc-400">DOB:</span> <span class="text-white">${student.date_of_birth || 'N/A'}</span></p>
                        <p><span class="text-zinc-400">School:</span> <span class="text-white">${student.school || 'N/A'}</span></p>
                        <p><span class="text-zinc-400">Branch:</span> <span class="text-white">${student.branch_name || 'N/A'}</span></p>
                    </div>
                </div>
                <div>
                    <h4 class="text-lg font-bold text-gold-400 mb-4">Registration Status</h4>
                    <div class="space-y-2 text-sm">
                        <p><span class="text-zinc-400">Status:</span> <span class="text-white">${student.registration_status}</span></p>
                        <p><span class="text-zinc-400">Fee:</span> <span class="text-white">₱${parseFloat(student.registration_fee_amount || 0).toFixed(2)}</span></p>
                        <p><span class="text-zinc-400">Paid:</span> <span class="text-white">₱${parseFloat(student.registration_fee_paid || 0).toFixed(2)}</span></p>
                        <p><span class="text-zinc-400">Remaining:</span> <span class="text-white">₱${(parseFloat(student.registration_fee_amount || 0) - parseFloat(student.registration_fee_paid || 0)).toFixed(2)}</span></p>
                    </div>
                </div>
            </div>
            ${guardians?.length ? `<div>
                <h4 class="text-lg font-bold text-gold-400 mb-4">Guardians</h4>
                ${guardians.map(g => `<div class="bg-zinc-900/50 p-4 rounded mb-2">
                    <p class="text-white font-medium">${g.first_name} ${g.last_name}</p>
                    <p class="text-zinc-400 text-sm">${g.relationship_type} | ${g.phone || 'N/A'}</p>
                </div>`).join('')}
            </div>` : ''}
            ${user_account ? `<div>
                <h4 class="text-lg font-bold text-gold-400 mb-4">User Account</h4>
                <div class="space-y-2 text-sm">
                    <p><span class="text-zinc-400">Username:</span> <span class="text-white">${user_account.username}</span></p>
                    <p><span class="text-zinc-400">Email:</span> <span class="text-white">${user_account.email || 'N/A'}</span></p>
                    <p><span class="text-zinc-400">Status:</span> <span class="text-white">${user_account.status}</span></p>
                </div>
            </div>` : ''}
            ${payments?.length ? `<div>
                <h4 class="text-lg font-bold text-gold-400 mb-4">Payments</h4>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="bg-zinc-900/50">
                            <tr>
                                <th class="px-4 py-2 text-left">Date</th>
                                <th class="px-4 py-2 text-left">Amount</th>
                                <th class="px-4 py-2 text-left">Method</th>
                                <th class="px-4 py-2 text-left">Receipt</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${payments.map(p => `<tr class="border-t border-zinc-800">
                                <td class="px-4 py-2">${new Date(p.payment_date).toLocaleDateString()}</td>
                                <td class="px-4 py-2">₱${parseFloat(p.amount).toFixed(2)}</td>
                                <td class="px-4 py-2">${p.payment_method}</td>
                                <td class="px-4 py-2">${p.receipt_number || 'N/A'}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>` : ''}
        `;

        const modal = document.getElementById('detailsModal');
        document.getElementById('detailsContent').innerHTML = detailsHTML;
        modal.classList.remove('hidden');
        modal.classList.add('flex');

    } catch (error) {
        showMessage('Failed to load details: ' + (error.message || error), 'error');
    }
}

// Close Details Modal
function closeDetailsModal() {
    const modal = document.getElementById('detailsModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// Open Payment Modal
async function openPaymentModal(studentId) {
    currentStudentId = studentId;

    try {
        const data = await apiGet(`admin.php?action=get-registration-details&student_id=${studentId}`);
        if (!data.success) return;

        const student = data.student;
        const remaining = parseFloat(student.registration_fee_amount || 0) - parseFloat(student.registration_fee_paid || 0);

        document.getElementById('paymentStudentInfo').textContent =
            `Student: ${student.first_name} ${student.last_name} | Remaining: ₱${remaining.toFixed(2)}`;
        document.getElementById('paymentAmount').value = remaining > 0 ? remaining : student.registration_fee_amount;

        const modal = document.getElementById('paymentModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    } catch (error) {
        showMessage('Failed to load student info: ' + (error.message || error), 'error');
    }
}

// Close Payment Modal
function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.getElementById('paymentForm').reset();
    currentStudentId = null;
}

// Confirm Payment
document.getElementById('paymentForm').addEventListener('submit', async e => {
    e.preventDefault();

    const btn = document.getElementById('confirmPaymentBtn');
    const btnText = document.getElementById('confirmPaymentBtnText');

    btn.disabled = true;
    btnText.textContent = 'Processing...';

    const paymentData = {
        student_id: currentStudentId,
        amount: parseFloat(document.getElementById('paymentAmount').value),
        payment_method: document.getElementById('paymentMethod').value,
        receipt_number: document.getElementById('receiptNumber').value || null,
        notes: document.getElementById('paymentNotes').value || null
    };

    try {
        const data = await apiPost('admin.php?action=confirm-payment', paymentData);
        if (data.success) {
            showMessage(data.message, 'success');
            closePaymentModal();
            loadPendingRegistrations();
        }
    } catch (error) {
        showMessage('Failed to confirm payment: ' + (error.message || error), 'error');
    } finally {
        btn.disabled = false;
        btnText.textContent = 'Confirm Payment';
    }
});

// Reject Registration
async function rejectRegistration(studentId) {
    if (!confirm('Are you sure you want to reject this registration?')) return;

    try {
        const data = await apiPost('admin.php?action=reject-registration', { student_id: studentId });
        if (data.success) {
            showMessage(data.message, 'success');
            loadPendingRegistrations();
        }
    } catch (error) {
        showMessage('Failed to reject registration: ' + (error.message || error), 'error');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadPendingRegistrations();
});
