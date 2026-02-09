// Base API URL
const baseApiUrl = sessionStorage.getItem("baseAPIUrl") || "http://localhost/FAS_music/api";

let currentStudentId = null;
let currentRegistration = null;

// Authentication Utility (integrated)
const Auth = {
    // Get current user from sessionStorage
    getUser() {
        const userStr = sessionStorage.getItem('user');
        if (!userStr) return null;
        try {
            return JSON.parse(userStr);
        } catch (e) {
            return null;
        }
    },

    // Set user in sessionStorage
    setUser(user) {
        sessionStorage.setItem('user', JSON.stringify(user));
    },

    // Remove user from sessionStorage
    logout() {
        sessionStorage.removeItem('user');
        window.location.href = '../index.html';
    },

    // Check if user is authenticated
    isAuthenticated() {
        return this.getUser() !== null;
    },

    // Check if user has specific role
    hasRole(role) {
        const user = this.getUser();
        if (!user) return false;
        return user.role_name === role || user.role_name === 'SuperAdmin';
    }
};

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

// ========== INDEX.HTML FUNCTIONS ==========

// Toggle Login Modal
function toggleLoginModal(show) {
    const modal = document.getElementById('loginModal');
    if (!modal) return;

    if (show) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    } else {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        // Reset form
        const form = document.getElementById('loginForm');
        if (form) form.reset();
        const msg = document.getElementById('loginMessage');
        if (msg) msg.classList.add('hidden');
    }
}

// Toggle Register Modal
function toggleRegisterModal(show) {
    const modal = document.getElementById('registerModal');
    if (!modal) return;

    if (show) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    } else {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        // Reset form
        const form = document.getElementById('registerForm');
        if (form) form.reset();
        const msg = document.getElementById('registerMessage');
        if (msg) msg.classList.add('hidden');
    }
}

// Toggle Password Visibility
function togglePassword(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);

    if (!input || !icon) return;

    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// Validate Password Policy
function validatePassword() {
    const password = document.getElementById('registerPassword')?.value || '';
    const requirements = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[!@#$%^&*]/.test(password)
    };

    // Update requirement indicators
    updateRequirement('req-length', requirements.length);
    updateRequirement('req-uppercase', requirements.uppercase);
    updateRequirement('req-lowercase', requirements.lowercase);
    updateRequirement('req-number', requirements.number);
    updateRequirement('req-special', requirements.special);

    // Validate password match if confirm field has value
    if (document.getElementById('registerPasswordConfirm')?.value) {
        validatePasswordMatch();
    }

    return Object.values(requirements).every(req => req === true);
}

// Update requirement indicator
function updateRequirement(id, met) {
    const element = document.getElementById(id);
    if (!element) return;
    
    const icon = element.querySelector('i');
    if (met) {
        icon.classList.remove('fa-circle', 'text-zinc-600');
        icon.classList.add('fa-check-circle', 'text-green-500');
    } else {
        icon.classList.remove('fa-check-circle', 'text-green-500');
        icon.classList.add('fa-circle', 'text-zinc-600');
    }
}

// Validate Password Match
function validatePasswordMatch() {
    const password = document.getElementById('registerPassword')?.value || '';
    const confirm = document.getElementById('registerPasswordConfirm')?.value || '';
    const matchDiv = document.getElementById('passwordMatch');

    if (!matchDiv) return;

    if (confirm.length === 0) {
        matchDiv.textContent = '';
        matchDiv.className = 'mt-2 text-xs';
        return;
    }

    if (password === confirm) {
        matchDiv.textContent = '✓ Passwords match';
        matchDiv.className = 'mt-2 text-xs text-green-500';
        return true;
    } else {
        matchDiv.textContent = '✗ Passwords do not match';
        matchDiv.className = 'mt-2 text-xs text-red-500';
        return false;
    }
}

// Mobile Menu Toggle
function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    const menuIcon = document.getElementById('menu-icon');

    if (!mobileMenu || !menuIcon) return;

    if (mobileMenu.classList.contains('hidden')) {
        mobileMenu.classList.remove('hidden');
        menuIcon.classList.remove('fa-bars');
        menuIcon.classList.add('fa-times');
    } else {
        mobileMenu.classList.add('hidden');
        menuIcon.classList.remove('fa-times');
        menuIcon.classList.add('fa-bars');
    }
}

// Show Message Helper
function showLoginMessage(message, type = 'error') {
    const messageDiv = document.getElementById('loginMessage');
    if (!messageDiv) return;

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

function showRegisterMessage(message, type = 'error') {
    const messageDiv = document.getElementById('registerMessage');
    if (!messageDiv) return;

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

// Login Form Handler
function initLoginForm() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('loginUsername')?.value.trim();
        const password = document.getElementById('loginPassword')?.value;
        const loginBtn = document.getElementById('loginBtn');
        const loginBtnText = document.getElementById('loginBtnText');
        const loginBtnIcon = document.getElementById('loginBtnIcon');

        if (!username || !password) {
            showLoginMessage('Please enter both username and password', 'error');
            return;
        }

        // Disable button
        if (loginBtn) loginBtn.disabled = true;
        if (loginBtnText) loginBtnText.textContent = 'Signing in...';
        if (loginBtnIcon) {
            loginBtnIcon.classList.add('fa-spinner', 'fa-spin');
            loginBtnIcon.classList.remove('fa-sign-in-alt');
        }

        try {
            const response = await fetch(`${baseApiUrl}/users.php?action=login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success && data.user) {
                // Store user in sessionStorage
                Auth.setUser(data.user);

                // Show success message with SweetAlert
                Swal.fire({
                    icon: 'success',
                    title: 'Login Successful!',
                    text: 'Redirecting to dashboard...',
                    timer: 1500,
                    showConfirmButton: false,
                    timerProgressBar: true
                });

                // Redirect based on role
                setTimeout(() => {
                    if (data.user.role_name === 'Admin' || data.user.role_name === 'SuperAdmin') {
                        window.location.href = 'pages/admin/admin_dashboard.html';
                    } else {
                        window.location.href = 'index.html';
                    }
                }, 1500);
            } else {
                // Show error message with SweetAlert
                Swal.fire({
                    icon: 'error',
                    title: 'Login Failed',
                    text: data.error || 'Invalid username or password. Please check your credentials.',
                    confirmButtonColor: '#b8860b'
                });

                if (loginBtn) loginBtn.disabled = false;
                if (loginBtnText) loginBtnText.textContent = 'Sign In';
                if (loginBtnIcon) {
                    loginBtnIcon.classList.remove('fa-spinner', 'fa-spin');
                    loginBtnIcon.classList.add('fa-sign-in-alt');
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            // Show error message with SweetAlert
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'An error occurred. Please try again.',
                confirmButtonColor: '#b8860b'
            });
            if (loginBtn) loginBtn.disabled = false;
            if (loginBtnText) loginBtnText.textContent = 'Sign In';
            if (loginBtnIcon) {
                loginBtnIcon.classList.remove('fa-spinner', 'fa-spin');
                loginBtnIcon.classList.add('fa-sign-in-alt');
            }
        }
    });
}

// Register Form Handler
function initRegisterForm() {
    const registerForm = document.getElementById('registerForm');
    if (!registerForm) return;

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validate password policy
        if (!validatePassword()) {
            showRegisterMessage('Please ensure your password meets all requirements.', 'error');
            return;
        }

        // Validate password match
        if (!validatePasswordMatch()) {
            showRegisterMessage('Passwords do not match. Please try again.', 'error');
            return;
        }

        // Validate email
        const emailInput = document.getElementById('student_email');
        if (emailInput && !validateEmail(emailInput)) {
            showRegisterMessage('Please enter a valid email address.', 'error');
            emailInput.focus();
            return;
        }

        const formData = new FormData(registerForm);
        const data = {};

        // Convert FormData to object
        for (let [key, value] of formData.entries()) {
            // Skip password_confirm field
            if (key === 'password_confirm') continue;
            data[key] = value;
        }

        // Ensure age is calculated if date of birth is provided
        const dateOfBirth = data['student_date_of_birth'];
        if (dateOfBirth && !data['student_age']) {
            calculateAge(dateOfBirth);
            data['student_age'] = document.getElementById('student_age').value;
        }

        // Set default registration fee amount (can be updated by admin later)
        if (!data['registration_fee_amount']) {
            data['registration_fee_amount'] = 0;
        }

        // Use email as username if not provided
        if (!data['username']) {
            data['username'] = data['student_email'];
        }

        const registerBtn = document.getElementById('registerSubmitBtn');
        const registerBtnText = document.getElementById('registerSubmitBtnText');
        const registerBtnIcon = document.getElementById('registerSubmitBtnIcon');

        // Disable button
        if (registerBtn) registerBtn.disabled = true;
        if (registerBtnText) registerBtnText.textContent = 'Submitting...';
        if (registerBtnIcon) {
            registerBtnIcon.classList.add('fa-spinner', 'fa-spin');
            registerBtnIcon.classList.remove('fa-paper-plane');
        }

        try {
            const response = await fetch(`${baseApiUrl}/users.php?action=register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                showRegisterMessage(result.message || 'Registration submitted successfully! Your account is pending admin approval.', 'success');
                registerForm.reset();
                
                // Reset password validation indicators
                if (document.getElementById('passwordRequirements')) {
                    ['req-length', 'req-uppercase', 'req-lowercase', 'req-number', 'req-special'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) {
                            const icon = el.querySelector('i');
                            if (icon) {
                                icon.classList.remove('fa-check-circle', 'text-green-500');
                                icon.classList.add('fa-circle', 'text-zinc-600');
                            }
                        }
                    });
                }
                if (document.getElementById('passwordMatch')) {
                    document.getElementById('passwordMatch').textContent = '';
                    document.getElementById('passwordMatch').className = 'mt-2 text-xs';
                }

                // Show success message with SweetAlert
                Swal.fire({
                    icon: 'success',
                    title: 'Registration Submitted!',
                    html: `Your registration has been submitted successfully.<br><br>
                           <strong>Status:</strong> Pending Admin Approval<br>
                           <strong>Username:</strong> ${result.username || data['student_email']}<br><br>
                           Your account will be activated once the admin confirms your registration and payment.`,
                    confirmButtonColor: '#b8860b'
                });
            } else {
                showRegisterMessage(result.error || 'Registration failed. Please try again.', 'error');
                if (registerBtn) registerBtn.disabled = false;
                if (registerBtnText) registerBtnText.textContent = 'Submit Registration';
                if (registerBtnIcon) {
                    registerBtnIcon.classList.remove('fa-spinner', 'fa-spin');
                    registerBtnIcon.classList.add('fa-paper-plane');
                }
            }
        } catch (error) {
            console.error('Registration error:', error);
            showRegisterMessage('An error occurred. Please try again.', 'error');
            if (registerBtn) registerBtn.disabled = false;
            if (registerBtnText) registerBtnText.textContent = 'Submit Registration';
            if (registerBtnIcon) {
                registerBtnIcon.classList.remove('fa-spinner', 'fa-spin');
                registerBtnIcon.classList.add('fa-paper-plane');
            }
        }
    });
}

// Calculate Age from Date of Birth
function calculateAge(dateOfBirth) {
    if (!dateOfBirth) {
        document.getElementById('calculatedAge').textContent = 'Enter date of birth to calculate age';
        document.getElementById('calculatedAge').className = 'text-zinc-400 italic';
        document.getElementById('student_age').value = '';
        return;
    }

    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    if (age < 0) {
        document.getElementById('calculatedAge').textContent = 'Invalid date - future date selected';
        document.getElementById('calculatedAge').className = 'text-red-400';
        document.getElementById('student_age').value = '';
        return;
    }

    document.getElementById('calculatedAge').textContent = `${age} years old`;
    document.getElementById('calculatedAge').className = 'text-gold-400 font-semibold';
    document.getElementById('student_age').value = age;
}

// Validate Email with Strict Pattern
function validateEmail(input) {
    const email = input.value.trim();
    const emailValidation = document.getElementById('emailValidation');
    
    if (!emailValidation) return;

    if (email.length === 0) {
        emailValidation.textContent = '';
        emailValidation.className = 'mt-1 text-xs';
        return false;
    }

    // Strict email validation pattern
    const emailPattern = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;
    
    if (!emailPattern.test(email)) {
        emailValidation.textContent = '✗ Please enter a valid email address (e.g., name@domain.com)';
        emailValidation.className = 'mt-1 text-xs text-red-500';
        input.classList.add('border-red-500');
        input.classList.remove('border-zinc-700', 'border-gold-400');
        return false;
    }

    // Additional checks
    if (email.length > 254) {
        emailValidation.textContent = '✗ Email address is too long (max 254 characters)';
        emailValidation.className = 'mt-1 text-xs text-red-500';
        input.classList.add('border-red-500');
        input.classList.remove('border-zinc-700', 'border-gold-400');
        return false;
    }

    const [localPart, domain] = email.split('@');
    if (localPart.length > 64) {
        emailValidation.textContent = '✗ Email local part is too long (max 64 characters)';
        emailValidation.className = 'mt-1 text-xs text-red-500';
        input.classList.add('border-red-500');
        input.classList.remove('border-zinc-700', 'border-gold-400');
        return false;
    }

    if (domain && domain.length > 253) {
        emailValidation.textContent = '✗ Email domain is too long';
        emailValidation.className = 'mt-1 text-xs text-red-500';
        input.classList.add('border-red-500');
        input.classList.remove('border-zinc-700', 'border-gold-400');
        return false;
    }

    emailValidation.textContent = '✓ Valid email address';
    emailValidation.className = 'mt-1 text-xs text-green-500';
    input.classList.remove('border-red-500');
    input.classList.add('border-green-500');
    return true;
}

// Initialize Date Picker
function initDatePicker() {
    const dateInput = document.getElementById('student_date_of_birth');
    if (!dateInput) return;

    flatpickr(dateInput, {
        dateFormat: "Y-m-d",
        maxDate: "today",
        defaultDate: null,
        allowInput: false,
        clickOpens: true,
        theme: "dark",
        onChange: function(selectedDates, dateStr, instance) {
            // Update the hidden input for form submission
            dateInput.value = dateStr;
            // Calculate age
            calculateAge(dateStr);
        },
        onReady: function(selectedDates, dateStr, instance) {
            // Style the calendar to match the dark theme
            instance.calendarContainer.classList.add('bg-zinc-900', 'border-gold-500');
        }
    });
}

// Initialize index.html functions
function initIndexPage() {
    initLoginForm();
    initRegisterForm();
    initDatePicker();
}

// ========== ADMIN PAGE FUNCTIONS ==========

// Check authentication
function checkAuth() {
    const user = Auth.getUser();
    if (!user || (user.role_name !== 'Admin' && user.role_name !== 'SuperAdmin')) {
        Swal.fire({
            icon: 'warning',
            title: 'Access Denied',
            text: 'You must be logged in as an Admin to access this page.',
            confirmButtonColor: '#b8860b',
            confirmButtonText: 'Go to Login'
        }).then(() => {
            window.location.href = '../index.html';
        });
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
    const stats = {
        pending: 0,
        feePaid: 0,
        approved: 0,
        total: registrations.length
    };

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

        if (data.success) {
            const { student, guardians, payments, user_account } = data;

            const detailsHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 class="text-lg font-bold text-gold-400 mb-4">Student Information</h4>
                        <div class="space-y-2 text-sm">
                            <p><span class="text-zinc-400">Name:</span> <span class="text-white">${student.first_name} ${student.middle_name || ''} ${student.last_name}</span></p>
                            <p><span class="text-zinc-400">Email:</span> <span class="text-white">${student.email || 'N/A'}</span></p>
                            <p><span class="text-zinc-400">Phone:</span> <span class="text-white">${student.phone || 'N/A'}</span></p>
                            <p><span class="text-zinc-400">Date of Birth:</span> <span class="text-white">${student.date_of_birth || 'N/A'}</span></p>
                            <p><span class="text-zinc-400">School:</span> <span class="text-white">${student.school || 'N/A'}</span></p>
                            <p><span class="text-zinc-400">Branch:</span> <span class="text-white">${student.branch_name || 'N/A'}</span></p>
                        </div>
                    </div>
                    <div>
                        <h4 class="text-lg font-bold text-gold-400 mb-4">Registration Status</h4>
                        <div class="space-y-2 text-sm">
                            <p><span class="text-zinc-400">Status:</span> <span class="text-white">${student.registration_status}</span></p>
                            <p><span class="text-zinc-400">Fee Amount:</span> <span class="text-white">₱${parseFloat(student.registration_fee_amount || 0).toFixed(2)}</span></p>
                            <p><span class="text-zinc-400">Paid Amount:</span> <span class="text-white">₱${parseFloat(student.registration_fee_paid || 0).toFixed(2)}</span></p>
                            <p><span class="text-zinc-400">Remaining:</span> <span class="text-white">₱${(parseFloat(student.registration_fee_amount || 0) - parseFloat(student.registration_fee_paid || 0)).toFixed(2)}</span></p>
                        </div>
                    </div>
                </div>
                ${guardians && guardians.length > 0 ? `
                    <div>
                        <h4 class="text-lg font-bold text-gold-400 mb-4">Guardian Information</h4>
                        ${guardians.map(g => `
                            <div class="bg-zinc-900/50 p-4 rounded mb-2">
                                <p class="text-white font-medium">${g.first_name} ${g.last_name}</p>
                                <p class="text-zinc-400 text-sm">${g.relationship_type} | ${g.phone || 'N/A'}</p>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                ${user_account ? `
                    <div>
                        <h4 class="text-lg font-bold text-gold-400 mb-4">User Account</h4>
                        <div class="space-y-2 text-sm">
                            <p><span class="text-zinc-400">Username:</span> <span class="text-white">${user_account.username}</span></p>
                            <p><span class="text-zinc-400">Email:</span> <span class="text-white">${user_account.email || 'N/A'}</span></p>
                            <p><span class="text-zinc-400">Status:</span> <span class="text-white">${user_account.status}</span></p>
                        </div>
                    </div>
                ` : ''}
                ${payments && payments.length > 0 ? `
                    <div>
                        <h4 class="text-lg font-bold text-gold-400 mb-4">Payment History</h4>
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
                                    ${payments.map(p => `
                                        <tr class="border-t border-zinc-800">
                                            <td class="px-4 py-2">${new Date(p.payment_date).toLocaleDateString()}</td>
                                            <td class="px-4 py-2">₱${parseFloat(p.amount).toFixed(2)}</td>
                                            <td class="px-4 py-2">${p.payment_method}</td>
                                            <td class="px-4 py-2">${p.receipt_number || 'N/A'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ` : ''}
            `;

            document.getElementById('detailsContent').innerHTML = detailsHTML;
            document.getElementById('detailsModal').classList.remove('hidden');
            document.getElementById('detailsModal').classList.add('flex');
        }
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
        if (data.success) {
            const student = data.student;
            const remaining = parseFloat(student.registration_fee_amount || 0) - parseFloat(student.registration_fee_paid || 0);

            document.getElementById('paymentStudentInfo').textContent =
                `Student: ${student.first_name} ${student.last_name} | Remaining: ₱${remaining.toFixed(2)}`;
            document.getElementById('paymentAmount').value = remaining > 0 ? remaining : student.registration_fee_amount;

            const modal = document.getElementById('paymentModal');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
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

// Confirm Payment Handler
function initPaymentForm() {
    const paymentForm = document.getElementById('paymentForm');
    if (!paymentForm) return;

    paymentForm.addEventListener('submit', async (e) => {
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
}

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
    // Check if we're on index.html or admin page
    const loginForm = document.getElementById('loginForm');
    const adminTable = document.getElementById('registrationsTable');

    if (loginForm) {
        // We're on index.html
        initIndexPage();
    } else if (adminTable) {
        // We're on admin page
        checkAuth();
        initPaymentForm();
        loadPendingRegistrations();
    }
});
