// Base API URL (same-origin, deployment-path safe)
let baseApiUrl;
let appBaseUrl;
(function initApiBaseUrl() {
    // Derive app base from where this script is served (works even if folder is renamed).
    const defaultAppBaseUrl = (() => {
        try {
            const scriptSrc = document.currentScript && document.currentScript.src ? document.currentScript.src : '';
            const scriptUrl = new URL(scriptSrc, window.location.href);
            // Expected: {origin}/{app}/js/index.js
            const basePath = scriptUrl.pathname.replace(/\/js\/index\.js$/i, '');
            return `${scriptUrl.origin}${basePath}`.replace(/\/$/, '');
        } catch (e) {
            // Last-resort fallback for legacy deployments
            return `${window.location.origin}/FAS_music`;
        }
    })();

    appBaseUrl = defaultAppBaseUrl;
    const defaultApiUrl = `${defaultAppBaseUrl}/api`;
    let storedApiUrl = '';

    try {
        storedApiUrl = sessionStorage.getItem("baseAPIUrl") || '';
    } catch (e) {
        storedApiUrl = '';
    }

    // Prefer stored URL only when it's same-origin or relative
    if (storedApiUrl) {
        try {
            const resolved = new URL(storedApiUrl, window.location.origin);
            if (resolved.origin === window.location.origin) {
                baseApiUrl = resolved.href.replace(/\/$/, '');
            } else {
                baseApiUrl = defaultApiUrl;
            }
        } catch (e) {
            baseApiUrl = defaultApiUrl;
        }
    } else {
        baseApiUrl = defaultApiUrl;
    }

    // Keep global access explicit for inline page scripts
    window.baseApiUrl = baseApiUrl;
    window.appBaseUrl = appBaseUrl;

    // Wire axios if available
    if (typeof axios !== 'undefined') {
        axios.defaults.baseURL = baseApiUrl;
        axios.defaults.withCredentials = true;
        axios.defaults.headers.common['Content-Type'] = 'application/json';
        axios.defaults.validateStatus = () => true;

        // Minimal debug help for endpoint/method mismatches (e.g., 405 "Method not allowed")
        try {
            if (!window.__fasAxiosInterceptorInstalled) {
                window.__fasAxiosInterceptorInstalled = true;
                axios.interceptors.response.use(
                    (response) => {
                        if (response && typeof response.status === 'number' && response.status >= 400) {
                            const method = (response.config?.method || '').toUpperCase();
                            const url = response.config?.url || '';
                            const serverError = response.data?.error || response.data?.message || '';
                            console.warn(`[API ${response.status}] ${method} ${url}${serverError ? ` -> ${serverError}` : ''}`);
                        }
                        return response;
                    },
                    (error) => {
                        const method = (error?.config?.method || '').toUpperCase();
                        const url = error?.config?.url || '';
                        console.warn(`[API ERROR] ${method} ${url}`, error);
                        return Promise.reject(error);
                    }
                );
            }
        } catch (e) {
            // Ignore interceptor failures
        }
    }
})();

let currentStudentId = null;
let currentPaymentRedirectUrl = '';
let currentPaymentSource = '';
let currentRegistration = null;
let pendingRequestsById = {};

// Authentication Utility (integrated) - with storage access protection
const Auth = {
    // Get current user from sessionStorage
    getUser() {
        try {
            const userStr = sessionStorage.getItem('user');
            if (!userStr) return null;
            return JSON.parse(userStr);
        } catch (e) {
            // Storage access blocked or parse error
            return null;
        }
    },

    // Set user in sessionStorage
    setUser(user) {
        try {
            sessionStorage.setItem('user', JSON.stringify(user));
        } catch (e) {
            // Storage access blocked - log warning but continue
            console.warn('Unable to save user to sessionStorage. Browser tracking prevention may be enabled.');
        }
    },

    // Remove user from sessionStorage
    logout() {
        try {
            sessionStorage.removeItem('user');
        } catch (e) {
            // Storage access blocked - continue anyway
        }
        // Redirect to app root index from any nested page
        const appBase = (typeof appBaseUrl === 'string' && appBaseUrl)
            ? appBaseUrl
            : ((typeof baseApiUrl === 'string' && baseApiUrl.endsWith('/api'))
                ? baseApiUrl.slice(0, -4)
                : `${window.location.origin}/FAS_music`);
        window.location.href = `${appBase}/index.html`;
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

// Show Message Helper (SweetAlert)
function showLoginMessage(message, type = 'error') {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: type === 'success' ? 'success' : 'error',
            title: type === 'success' ? 'Success' : 'Error',
            text: message,
            confirmButtonColor: '#b8860b'
        });
    } else {
        alert(message);
    }
}

function showRegisterMessage(message, type = 'error') {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: type === 'success' ? 'success' : 'error',
            title: type === 'success' ? 'Success' : 'Error',
            text: message,
            confirmButtonColor: '#b8860b'
        });
    } else {
        alert(message);
    }
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
            const response = await axios.post(
                `${baseApiUrl}/users.php?action=login`,
                { username, password },
                { validateStatus: () => true }
            );
            const data = response.data || {};

            if (response.status === 200 && data.success && data.user) {
                // If student is using default password, force change on first login
                if (data.must_change_password) {
                    await Swal.fire({
                        icon: 'info',
                        title: 'Change Your Password',
                        text: 'You are using the default password. You must change it now to continue.',
                        confirmButtonColor: '#b8860b'
                    });

                    await promptPasswordChange(data.user, password);

                    // Ask user to log in again after password change
                    Swal.fire({
                        icon: 'success',
                        title: 'Please Login Again',
                        text: 'Use your new password to login.',
                        confirmButtonColor: '#b8860b'
                    });

                    if (loginBtn) loginBtn.disabled = false;
                    if (loginBtnText) loginBtnText.textContent = 'Sign In';
                    if (loginBtnIcon) {
                        loginBtnIcon.classList.remove('fa-spinner', 'fa-spin');
                        loginBtnIcon.classList.add('fa-sign-in-alt');
                    }
                    return;
                }

                // Store user in sessionStorage
                Auth.setUser(data.user);

                // Show success message with SweetAlert
                Swal.fire({
                    icon: 'success',
                    title: 'Login Successful!',
                    text: 'Redirecting to dashboard...',
                    customClass: {
                        popup: 'login-success-popup',
                        title: 'login-success-title',
                        htmlContainer: 'login-success-text'
                    },
                    timer: 1500,
                    showConfirmButton: false,
                    timerProgressBar: true
                });

                // Redirect based on role
                setTimeout(() => {
                    const role = String(data.user.role_name || '').trim();
                    const roleLower = role.toLowerCase();
                    if (role === 'Admin' || role === 'SuperAdmin') {
                        window.location.href = 'pages/admin/admin_dashboard.html';
                    } else if (role === 'Manager' || role === 'Branch Manager') {
                        window.location.href = 'pages/manager/manager_dashboard.html';
                    } else if (role === 'Staff') {
                        window.location.href = 'pages/desk/desk_scanner.html';
                    } else if (roleLower === 'instructor' || roleLower === 'teacher' || roleLower === 'instructors' || roleLower === 'teachers') {
                        window.location.href = 'pages/instructor/instructor_dashboard.html';
                    } else if (role === 'Student') {
                        window.location.href = 'pages/student/student_dashboard.html';
                    } else if (data.user.role_name === 'Guardians') {
                        window.location.href = 'pages/guardian/guardian_students.html';
                    } else {
                        window.location.href = 'index.html';
                    }
                }, 1500);
            } else {
                const apiMessage = data && typeof data === 'object' ? data.error : '';
                const status = response.status;
                const message = apiMessage
                    ? apiMessage
                    : status === 401
                        ? 'Invalid username or password.'
                        : status === 403
                            ? 'Your account was deactivated. Please contact the administrator.'
                            : 'An error occurred. Please try again.';

                const isPending = status === 403 || /pending|deactivated/i.test(message);
                const title = isPending ? '' : status === 401 ? 'Login Failed' : 'Error';
                const icon = isPending ? 'info' : 'error';

                // Show error message with SweetAlert
                Swal.fire({
                    icon,
                    title,
                    text: message,
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
            const status = error?.response?.status;
            const apiMessage = error?.response?.data?.error;
            const message = apiMessage
                ? apiMessage
                : status === 401
                    ? 'Invalid username or password.'
                    : status === 403
                        ? 'Your account was deactivated. Please contact the administrator.'
                        : 'An error occurred. Please try again.';
            console.error('Login error:', error);
            const isPending = status === 403 || /pending|deactivated/i.test(message);
            const title = isPending ? '' : status === 401 ? 'Login Failed' : 'Error';
            const icon = isPending ? 'info' : 'error';
            Swal.fire({
                icon,
                title,
                text: message,
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

    if (registerForm.dataset.mode === 'basic') {
        const passwordInput = document.getElementById('registerPassword');
        const passwordConfirmInput = document.getElementById('registerPasswordConfirm');
        const emailInput = document.getElementById('student_email');

        if (passwordInput) {
            passwordInput.addEventListener('input', function() {
                validatePassword();
            });
        }

        if (passwordConfirmInput) {
            passwordConfirmInput.addEventListener('input', function() {
                validatePasswordMatch();
            });
        }

        if (emailInput) {
            emailInput.addEventListener('input', function() {
                validateEmail(this);
            });
        }

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (registerForm.dataset.submitting === '1') return;
            registerForm.dataset.submitting = '1';

            if (!validatePassword()) {
                showRegisterMessage('Please ensure your password meets all requirements.', 'error');
                registerForm.dataset.submitting = '0';
                return;
            }

            if (!validatePasswordMatch()) {
                showRegisterMessage('Passwords do not match. Please try again.', 'error');
                registerForm.dataset.submitting = '0';
                return;
            }

            const emailInputEl = document.getElementById('student_email');
            if (emailInputEl && !validateEmail(emailInputEl)) {
                showRegisterMessage('Please enter a valid email address.', 'error');
                registerForm.dataset.submitting = '0';
                return;
            }

            const payload = {
                student_first_name: registerForm.student_first_name?.value.trim() || '',
                student_last_name: registerForm.student_last_name?.value.trim() || '',
                student_email: registerForm.student_email?.value.trim() || '',
                student_phone: registerForm.student_phone?.value.trim() || '',
                branch_id: registerForm.branch_id?.value || '',
                password: registerForm.password?.value || ''
            };

            const registerBtn = document.getElementById('registerSubmitBtn');
            const registerBtnText = document.getElementById('registerSubmitBtnText');
            const registerBtnIcon = document.getElementById('registerSubmitBtnIcon');
            if (registerBtn) registerBtn.disabled = true;
            if (registerBtnText) registerBtnText.textContent = 'Creating account...';
            if (registerBtnIcon) {
                registerBtnIcon.classList.add('fa-spinner', 'fa-spin');
                registerBtnIcon.classList.remove('fa-arrow-right');
            }

            try {
                const response = await axios.post(`${baseApiUrl}/users.php?action=register-basic`, payload);
                const data = response.data || {};

                if (response.status === 200 && data.success) {
                    showRegisterMessage('Account created! Please log in to finish your registration steps.', 'success');
                    registerForm.reset();
                    setTimeout(() => toggleRegisterModal(false), 1200);
                } else {
                    showRegisterMessage(data.error || 'Registration failed. Please try again.', 'error');
                }
            } catch (error) {
                console.error('Basic registration error:', error);
                showRegisterMessage('Network error. Please try again.', 'error');
            } finally {
                registerForm.dataset.submitting = '0';
                if (registerBtn) registerBtn.disabled = false;
                if (registerBtnText) registerBtnText.textContent = 'Create Account';
                if (registerBtnIcon) {
                    registerBtnIcon.classList.remove('fa-spinner', 'fa-spin');
                    registerBtnIcon.classList.add('fa-arrow-right');
                }
            }
        });
        return;
    }

    // Registration now collects only student + guardian + account details.
    // Package/instrument availing is done later in the student dashboard.

    // Add event listeners for password validation
    const passwordInput = document.getElementById('registerPassword');
    const passwordConfirmInput = document.getElementById('registerPasswordConfirm');
    const emailInput = document.getElementById('student_email');

    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            validatePassword();
        });
    }

    if (passwordConfirmInput) {
        passwordConfirmInput.addEventListener('input', function() {
            validatePasswordMatch();
        });
    }

    if (emailInput) {
        emailInput.addEventListener('input', function() {
            validateEmail(this);
        });
    }

    const dobInput = document.getElementById('student_date_of_birth');
    if (dobInput) {
        dobInput.addEventListener('change', updatePublicGuardianRequiredState);
        dobInput.addEventListener('input', updatePublicGuardianRequiredState);
        updatePublicGuardianRequiredState();
    }

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Prevent double submit
        if (registerForm.dataset.submitting === '1') return;
        registerForm.dataset.submitting = '1';

        // Validate password policy
        if (!validatePassword()) {
            showRegisterMessage('Please ensure your password meets all requirements.', 'error');
            registerForm.dataset.submitting = '0';
            return;
        }

        // Validate password match
        if (!validatePasswordMatch()) {
            showRegisterMessage('Passwords do not match. Please try again.', 'error');
            registerForm.dataset.submitting = '0';
            return;
        }

        // Validate email
        const emailInput = document.getElementById('student_email');
        if (emailInput && !validateEmail(emailInput)) {
            showRegisterMessage('Please enter a valid email address.', 'error');
            emailInput.focus();
            registerForm.dataset.submitting = '0';
            return;
        }

        const formData = new FormData(registerForm);

        // Skip confirmation field; backend only needs the actual password.
        formData.delete('password_confirm');

        // Ensure age is calculated if date of birth is provided.
        const dateOfBirth = formData.get('student_date_of_birth');
        const currentAge = formData.get('student_age');
        if (dateOfBirth && !currentAge) {
            calculateAge(dateOfBirth);
            const ageEl = document.getElementById('student_age');
            if (ageEl?.value) {
                formData.set('student_age', ageEl.value);
            }
        }

        // Initial registration fee is fixed.
        formData.set('registration_source', 'public');
        formData.set('registration_fee_amount', '1000');

        // Use email as username if not provided.
        const usernameVal = String(formData.get('username') || '').trim();
        const studentEmailVal = String(formData.get('student_email') || '').trim();
        if (!usernameVal && studentEmailVal) {
            formData.set('username', studentEmailVal);
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
            const response = await axios.post(`${baseApiUrl}/users.php?action=register`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
            let result;
            try {
                result = typeof response.data === 'string' ? JSON.parse(responseText) : response.data;
            } catch (parseErr) {
                console.error('Registration 400 - Response was not JSON:', responseText);
                showRegisterMessage('Registration failed. The server returned an invalid response. Check the browser console (F12) for details.', 'error');
                registerForm.dataset.submitting = '0';
                return;
            }

            if (result.success) {
                registerForm.dataset.submitting = '0';
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
                           <strong>Registration Fee:</strong> ₱1,000.00<br>
                           <strong>Username:</strong> ${result.username || studentEmailVal}<br><br>
                           Once approved, you can log in and choose your package/instruments from your dashboard.`,
                    confirmButtonColor: '#b8860b'
                });
            } else {
                const errMsg = result.error || 'Registration failed. Please try again.';
                console.error('Registration failed (400):', errMsg, result);
                showRegisterMessage(errMsg, 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            showRegisterMessage('An error occurred. Please try again.', 'error');
        } finally {
            registerForm.dataset.submitting = '0';
            if (registerBtn) registerBtn.disabled = false;
            if (registerBtnText) registerBtnText.textContent = 'Submit Registration';
            if (registerBtnIcon) {
                registerBtnIcon.classList.remove('fa-spinner', 'fa-spin');
                registerBtnIcon.classList.add('fa-paper-plane');
            }
        }
    });
}

// Load Session Packages
let sessionPackages = [];
async function loadSessionPackages() {
    const select = document.getElementById('sessionPackage');
    if (!select) return;

    try {
        const response = await axios.get(`${baseApiUrl}/sessions.php?action=get-packages`);
        const data = response.data;

        if (data.success && data.packages) {
            sessionPackages = data.packages;
            select.innerHTML = '<option value="">Select Package</option>';
            data.packages.forEach(pkg => {
                const option = document.createElement('option');
                option.value = pkg.package_id;
                option.textContent = `${pkg.package_name} (${pkg.sessions} sessions, ${pkg.max_instruments} instrument${pkg.max_instruments > 1 ? 's' : ''})`;
                option.setAttribute('data-sessions', pkg.sessions);
                option.setAttribute('data-max-instruments', pkg.max_instruments);
                option.setAttribute('data-price', (pkg.price != null && !isNaN(pkg.price)) ? String(pkg.price) : '0');
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load session packages:', error);
        // Fallback to default packages
        sessionPackages = [
            { package_id: 1, sessions: 12, max_instruments: 1, price: 7450 },
            { package_id: 2, sessions: 20, max_instruments: 2, price: 11800 }
        ];
        select.innerHTML = `
            <option value="">Select Package</option>
            <option value="1" data-sessions="12" data-max-instruments="1" data-price="7450">Basic (12 Sessions, 1 instrument)</option>
            <option value="2" data-sessions="20" data-max-instruments="2" data-price="11800">Standard (20 Sessions, 2 instruments)</option>
        `;
    }
}

// Load Instruments for Registration
let availableInstruments = [];
async function loadInstrumentsForRegistration(branchId) {
    if (!branchId) {
        const container = document.getElementById('instrumentsContainer');
        if (container) container.innerHTML = '<p class="text-sm text-zinc-500">Select a branch first</p>';
        return;
    }

    try {
        const response = await axios.get(`${baseApiUrl}/instruments.php?action=get-instruments&branch_id=${branchId}`);
        const data = response.data;

        if (data.success && data.instruments) {
            availableInstruments = data.instruments;
            updateInstrumentSelection();
        } else {
            const container = document.getElementById('instrumentsContainer');
            if (container) container.innerHTML = '<p class="text-sm text-red-400">No instruments available for this branch</p>';
        }
    } catch (error) {
        console.error('Failed to load instruments:', error);
        const container = document.getElementById('instrumentsContainer');
        if (container) container.innerHTML = '<p class="text-sm text-red-400">Failed to load instruments</p>';
    }
}

// Get unique instrument types from available instruments (for branch)
function getAvailableTypes() {
    const seen = new Set();
    const types = [];
    availableInstruments.forEach(inst => {
        const id = inst.type_id;
        const name = inst.type_name || 'Other';
        if (id != null && !seen.has(id)) {
            seen.add(id);
            types.push({ type_id: id, type_name: name });
        }
    });
    return types.sort((a, b) => (a.type_name || '').localeCompare(b.type_name || ''));
}

// Get instruments filtered by type_id
function getInstrumentsByType(typeId) {
    if (!typeId) return [];
    return availableInstruments.filter(inst => inst.type_id == typeId);
}

// Update Instrument Selection UI: Type dropdown first, then Instrument dropdown (filtered by type)
function updateInstrumentSelection() {
    const container = document.getElementById('instrumentsContainer');
    if (!container) return;

    const sessionPackageSelect = document.getElementById('sessionPackage');
    if (!sessionPackageSelect || !sessionPackageSelect.value) {
        container.innerHTML = '<p class="text-sm text-zinc-500">Select a session package first</p>';
        return;
    }

    const selectedOption = sessionPackageSelect.options[sessionPackageSelect.selectedIndex];
    const maxInstruments = parseInt(selectedOption.getAttribute('data-max-instruments') || '1');

    if (availableInstruments.length === 0) {
        container.innerHTML = '<p class="text-sm text-zinc-500">Select a branch to see available instruments</p>';
        return;
    }

    const types = getAvailableTypes();
    const typeOptionsHtml = types.map(t =>
        `<option value="${t.type_id}">${escapeHtml(t.type_name)}</option>`
    ).join('');

    let html = '';
    for (let i = 1; i <= maxInstruments; i++) {
        const slotLabel = maxInstruments === 1 ? 'Instrument' : `Instrument ${i}`;
        html += `
            <div class="p-3 bg-zinc-900/50 rounded-lg border border-zinc-700 space-y-2">
                <label class="block text-sm font-medium text-zinc-300">${slotLabel} *</label>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs text-zinc-500 mb-1">Type</label>
                        <select class="instrument-type-select w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-gold-400" data-slot="${i}" onchange="onInstrumentTypeChange(${i})">
                            <option value="">Select type...</option>
                            ${typeOptionsHtml}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs text-zinc-500 mb-1">Instrument</label>
                        <select name="instruments[]" class="instrument-select w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-gold-400" data-slot="${i}" onchange="onInstrumentDropdownChange()">
                            <option value="">Select instrument...</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function onInstrumentTypeChange(slot) {
    const typeSelect = document.querySelector(`select.instrument-type-select[data-slot="${slot}"]`);
    const instrumentSelect = document.querySelector(`select.instrument-select[data-slot="${slot}"]`);
    if (!typeSelect || !instrumentSelect) return;

    const typeId = typeSelect.value;
    instrumentSelect.innerHTML = '<option value="">Select instrument...</option>';
    instrumentSelect.value = '';

    if (typeId) {
        const instruments = getInstrumentsByType(typeId);
        instruments.forEach(inst => {
            const opt = document.createElement('option');
            opt.value = inst.instrument_id;
            opt.textContent = inst.instrument_name || 'Instrument';
            instrumentSelect.appendChild(opt);
        });
    }
    onInstrumentDropdownChange();
}

function onInstrumentDropdownChange() {
    const selects = document.querySelectorAll('select.instrument-select');
    const used = new Set();
    selects.forEach(select => {
        const val = select.value;
        if (val) used.add(val);
    });
    selects.forEach(select => {
        const currentVal = select.value;
        Array.from(select.options).forEach(opt => {
            if (opt.value === '') return;
            const othersUsed = used.has(opt.value) && opt.value !== currentVal;
            opt.disabled = othersUsed;
        });
    });
    calculateTotalFee();
}

// Validate Instrument Selection (dropdowns) - ensure at least one selected, no duplicates
function validateInstrumentSelection() {
    calculateTotalFee();
}

// Calculate Total Fee
function calculateTotalFee() {
    const registrationFee = 1000;
    const sessionPackageSelect = document.getElementById('sessionPackage');
    const paymentTypeSelect = document.getElementById('paymentType');

    if (!sessionPackageSelect || !sessionPackageSelect.value || !paymentTypeSelect || !paymentTypeSelect.value) {
        const sessionFeeEl = document.getElementById('sessionFeeDisplay');
        const totalEl = document.getElementById('totalAmountDisplay');
        const feeInput = document.getElementById('registration_fee_amount');
        if (sessionFeeEl) sessionFeeEl.textContent = '₱0.00';
        if (totalEl) totalEl.textContent = `₱${registrationFee.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        if (feeInput) feeInput.value = registrationFee;
        return registrationFee;
    }

    const selectedOption = sessionPackageSelect.options[sessionPackageSelect.selectedIndex];
    const sessions = parseInt(selectedOption.getAttribute('data-sessions') || '0');
    const paymentType = paymentTypeSelect.value;
    const basePrice = parseFloat(selectedOption.getAttribute('data-price') || '0');

    // Check if saxophone is selected (from dropdowns)
    const selectedInstruments = Array.from(document.querySelectorAll('select[name="instruments[]"]'))
        .map(sel => sel.value ? parseInt(sel.value, 10) : 0)
        .filter(id => id > 0);
    const hasSaxophone = selectedInstruments.some(id => {
        const instrument = availableInstruments.find(inst => inst.instrument_id === id);
        return instrument && (instrument.instrument_name.toLowerCase().includes('saxophone') ||
                             instrument.type_name?.toLowerCase().includes('saxophone'));
    });

    let sessionFee = 0;
    // Use database price when available (tbl_session_packages.price)
    if (basePrice > 0) {
        if (paymentType === 'downpayment') {
            // Ratios from original: 12 sessions 3000/7450, 20 sessions 5000/11800
            const downpaymentRatio = sessions === 12 ? (3000 / 7450) : (sessions === 20 ? (5000 / 11800) : 0.42);
            sessionFee = Math.round(basePrice * downpaymentRatio);
        } else if (paymentType === 'fullpayment') {
            if (hasSaxophone) {
                // Saxophone premium: 12 sessions 8100/7450, 20 sessions 13000/11800
                const saxophoneMultiplier = sessions === 12 ? (8100 / 7450) : (sessions === 20 ? (13000 / 11800) : 1.09);
                sessionFee = Math.round(basePrice * saxophoneMultiplier);
            } else {
                sessionFee = basePrice;
            }
        }
    } else {
        // Fallback when price not in DB (legacy)
        if (paymentType === 'downpayment') {
            if (sessions === 12) sessionFee = 3000;
            else if (sessions === 20) sessionFee = 5000;
        } else if (paymentType === 'fullpayment') {
            if (hasSaxophone) {
                if (sessions === 12) sessionFee = 8100;
                else if (sessions === 20) sessionFee = 13000;
            } else {
                if (sessions === 12) sessionFee = 7450;
                else if (sessions === 20) sessionFee = 11800;
            }
        }
    }

    const total = registrationFee + sessionFee;

    const sessionFeeEl = document.getElementById('sessionFeeDisplay');
    const totalEl = document.getElementById('totalAmountDisplay');
    const feeInput = document.getElementById('registration_fee_amount');

    if (sessionFeeEl) sessionFeeEl.textContent = `₱${sessionFee.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    if (totalEl) totalEl.textContent = `₱${total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    if (feeInput) feeInput.value = total;

    return total;
}

// Escape HTML helper
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
    const datePickerBtn = document.getElementById('datePickerBtn');
    if (!dateInput) return;

    if (typeof flatpickr === 'undefined') {
        console.error('Flatpickr is not loaded');
        return;
    }

    const currentTheme = (localStorage.getItem('theme') || 'light').toLowerCase();
    const isDark = currentTheme === 'dark';

    const flatpickrInstance = flatpickr(dateInput, {
        dateFormat: "Y-m-d",
        maxDate: "today",
        minDate: "1900-01-01", // reasonable birth year limit
        defaultDate: null,

        allowInput: false,
        clickOpens: true,

        /* 🔥 KEY SETTINGS FOR EASY BIRTHDATE PICKING */
        monthSelectorType: "dropdown", // enables year dropdown
        yearSelectorType: "dropdown",  // explicit year dropdown
        shorthandCurrentMonth: false,

        animate: true,
        theme: isDark ? "dark" : "light",

        appendTo: document.body,

        onChange: function (selectedDates, dateStr) {
            if (dateStr) {
                dateInput.value = dateStr;
                calculateAge(dateStr);
            }
        },

        onReady: function (_, __, instance) {
            if (instance.calendarContainer) {
                instance.calendarContainer.style.zIndex = '10001';
                instance.calendarContainer.classList.add('border', 'border-gold-500');
                if (isDark) {
                    instance.calendarContainer.classList.add('bg-zinc-900');
                } else {
                    instance.calendarContainer.classList.add('bg-white');
                }
            }
        },

        onOpen: function (_, __, instance) {
            if (instance.calendarContainer) {
                instance.calendarContainer.style.zIndex = '10001';
            }
        }
    });

    /* Calendar icon button */
    if (datePickerBtn) {
        datePickerBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            flatpickrInstance.open();
        });
    }

    /* Input open behavior */
    ['click', 'focus'].forEach(event => {
        dateInput.addEventListener(event, function (e) {
            e.preventDefault();
            flatpickrInstance.open();
        });
    });
}
// Load Branches for Registration Form
async function loadBranches() {
    const branchSelect = document.getElementById('branch_id');
    if (!branchSelect) return;

    try {
        const response = await axios.get(`${baseApiUrl}/branch.php?action=get-branches`);
        const data = response.data;

        if (data.success && data.branches) {
            // Clear existing options
            branchSelect.innerHTML = '<option value="">Select Branch</option>';

            // Add branches to dropdown
            data.branches.forEach(branch => {
                const option = document.createElement('option');
                option.value = branch.branch_id;
                option.textContent = branch.branch_name;
                branchSelect.appendChild(option);
            });
        } else {
            branchSelect.innerHTML = '<option value="">No branches available</option>';
            console.error('Failed to load branches:', data.error);
        }
    } catch (error) {
        console.error('Error loading branches:', error);
        branchSelect.innerHTML = '<option value="">Error loading branches</option>';
    }
}

async function populateBranchSelect(selectEl, selectedId = null) {
    if (!selectEl) return;
    try {
        const response = await axios.get(`${baseApiUrl}/branch.php?action=get-branches`);
        const data = response.data;
        if (data.success && data.branches) {
            selectEl.innerHTML = '<option value="">Select Branch</option>';
            data.branches.forEach(branch => {
                const option = document.createElement('option');
                option.value = branch.branch_id;
                option.textContent = branch.branch_name;
                if (selectedId && String(branch.branch_id) === String(selectedId)) {
                    option.selected = true;
                }
                selectEl.appendChild(option);
            });
        } else {
            selectEl.innerHTML = '<option value="">No branches available</option>';
        }
    } catch (error) {
        console.error('Error loading branches:', error);
        selectEl.innerHTML = '<option value="">Error loading branches</option>';
    }
}

// Load pending package/enrollment requests (used by admin enrollments/sessions views)
async function loadPendingRequests() {
    const tableBody = document.getElementById('pendingRequestsTable');
    const countEl = document.getElementById('pendingRequestCount');
    if (!tableBody) return;

    try {
        const branchFilter = document.getElementById('branchFilter');
        let url = `${baseApiUrl}/students.php?action=get-pending-package-requests`;
        if (branchFilter && branchFilter.value) {
            url += `&branch_id=${branchFilter.value}`;
        }

        const response = await axios.get(url);
        const data = response.data;
        const requests = data.success && Array.isArray(data.requests) ? data.requests : [];

        if (countEl) countEl.textContent = `${requests.length} pending`;

        if (!requests.length) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-8 text-center text-slate-500">
                        <i class="fas fa-inbox text-2xl mb-2 text-gold-500/60"></i>
                        <p>No pending student requests.</p>
                    </td>
                </tr>`;
            return;
        }

        pendingRequestsById = {};
        const isAdminEnrollmentsPage = /admin_enrollments\.html$/i.test(window.location.pathname || '');
        const adminEnrollmentsAllowActions = !!window.adminEnrollmentsAllowActions;

        tableBody.innerHTML = requests.map(r => {
            pendingRequestsById[String(r.request_id)] = r;
            const studentName = `${escapeHtml(r.first_name || '')} ${escapeHtml(r.last_name || '')}`.trim();
            const pkg = escapeHtml(r.package_name || '—');
            const instruments = Array.isArray(r.instruments) && r.instruments.length
                ? r.instruments.map(i => escapeHtml(i.instrument_name || 'Instrument')).join(', ')
                : '—';
            const schedule = r.preferred_day_of_week
                ? `${escapeHtml(r.preferred_day_of_week)}`
                : '—';
            const prefDate = r.preferred_date ? new Date(r.preferred_date).toLocaleDateString() : '—';
            const paymentType = escapeHtml(r.payment_type || 'Partial Payment');
            const paymentMethod = escapeHtml(r.payment_method || '—');
            const payableNow = Number(r.payable_now || 0);
            const paymentProofHtml = r.payment_proof_path
                ? `<a href="${escapeHtml(buildPublicFileUrl(r.payment_proof_path))}" target="_blank" rel="noopener" class="text-xs text-blue-600 underline">View payment proof</a>`
                : '<span class="text-xs text-slate-500">No payment proof</span>';
            const paymentCellHtml = isAdminEnrollmentsPage
                ? `<div class="font-semibold text-slate-800">${paymentType}</div>`
                : `
                        <div class="font-semibold text-slate-800">${paymentType}</div>
                        <div class="text-xs text-slate-500 mt-1">Method: ${paymentMethod}</div>
                        <div class="text-xs text-slate-500 mt-1">Pay now: ${formatCurrencyPHP(payableNow)}</div>
                        <div class="mt-1">${paymentProofHtml}</div>
                    `;
            return `
                <tr class="hover:bg-slate-50/80 transition">
                    <td class="px-6 py-4">
                        <div class="font-medium text-slate-900">${studentName || 'Student'}</div>
                        <div class="text-sm text-slate-500">${escapeHtml(r.email || '')}</div>
                        <div class="text-xs text-slate-400">${escapeHtml(r.branch_name || '')}</div>
                    </td>
                    <td class="px-6 py-4 text-sm text-slate-700">${pkg}</td>
                    <td class="px-6 py-4 text-sm text-slate-700">${instruments}</td>
                    <td class="px-6 py-4 text-sm text-slate-700">
                        <div>${schedule}</div>
                        <div class="text-xs text-slate-500 mt-1">Date: ${prefDate}</div>
                    </td>
                    <td class="px-6 py-4 text-sm text-slate-700">${paymentCellHtml}</td>
                    <td class="px-6 py-4 text-sm font-semibold text-gold-600">${formatCurrencyPHP(payableNow)}</td>
                    <td class="px-6 py-4">
                        ${isAdminEnrollmentsPage && !adminEnrollmentsAllowActions
                            ? `<button onclick="openPendingRequestViewModal(${Number(r.request_id)})" class="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold">
                                View
                            </button>`
                            : `<div class="flex items-center gap-2">
                                <button onclick="openPendingRequestViewModal(${Number(r.request_id)})" class="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold">
                                    View
                                </button>
                                <button onclick="(window.onPendingRequestAssignClick || openAssignRequestModal)(${Number(r.request_id)})" class="px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 text-xs font-bold">
                                    ${window.pendingRequestActionLabel || 'Assign & Approve'}
                                </button>
                                <button onclick="rejectStudentRequest(${Number(r.request_id)})" class="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 text-xs font-bold">
                                    Reject
                                </button>
                            </div>`}
                    </td>
                </tr>`;
        }).join('');
    } catch (error) {
        console.error('Failed to load pending package requests:', error);
        if (countEl) countEl.textContent = 'Error';
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-8 text-center text-red-500">
                    <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                    <p>Failed to load pending requests.</p>
                </td>
            </tr>`;
    }
}

function openPendingRequestViewModal(requestId) {
    const req = pendingRequestsById[String(requestId)];
    if (!req) {
        showMessage('Request not found.', 'error');
        return;
    }

    const studentName = `${escapeHtml(req.first_name || '')} ${escapeHtml(req.last_name || '')}`.trim() || 'Student';
    const instruments = Array.isArray(req.instruments) && req.instruments.length
        ? req.instruments.map(i => {
            const instrumentName = escapeHtml(i.instrument_name || 'Instrument');
            const typeName = escapeHtml(i.type_name || '');
            return typeName ? `${instrumentName} (${typeName})` : instrumentName;
        }).join(', ')
        : '—';
    const preferredDay = escapeHtml(req.preferred_day_of_week || '—');
    const preferredDate = req.preferred_date ? new Date(req.preferred_date).toLocaleDateString() : '—';
    const paymentType = escapeHtml(req.payment_type || 'Partial Payment');
    const paymentMethod = escapeHtml(req.payment_method || '—');
    const payableNow = Number(req.payable_now || 0);
    const packageAmount = Number(req.requested_amount || req.package_price || 0);
    const proofHtml = req.payment_proof_path
        ? `<a href="${escapeHtml(buildPublicFileUrl(req.payment_proof_path))}" target="_blank" rel="noopener" class="text-sm text-blue-600 underline">View payment proof</a>`
        : '<span class="text-sm text-slate-500">No payment proof</span>';

    Swal.fire({
        title: 'Enrollment Request',
        width: 760,
        confirmButtonText: 'Close',
        html: `
            <div class="text-left space-y-4 text-sm text-slate-700">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><span class="font-semibold text-slate-900">Student:</span> ${studentName}</div>
                    <div><span class="font-semibold text-slate-900">Branch:</span> ${escapeHtml(req.branch_name || '—')}</div>
                    <div><span class="font-semibold text-slate-900">Package:</span> ${escapeHtml(req.package_name || '—')}</div>
                    <div><span class="font-semibold text-slate-900">Selected Instrument:</span> ${instruments}</div>
                    <div><span class="font-semibold text-slate-900">Preferred Day:</span> ${preferredDay}</div>
                    <div><span class="font-semibold text-slate-900">Preferred Date:</span> ${preferredDate}</div>
                    <div><span class="font-semibold text-slate-900">Payment Type:</span> ${paymentType}</div>
                    <div><span class="font-semibold text-slate-900">Payment Method:</span> ${paymentMethod}</div>
                    <div><span class="font-semibold text-slate-900">Amount Paid:</span> ${formatCurrencyPHP(payableNow)}</div>
                    <div><span class="font-semibold text-slate-900">Package Amount:</span> ${formatCurrencyPHP(packageAmount)}</div>
                </div>
                <div><span class="font-semibold text-slate-900">Proof of Payment:</span> ${proofHtml}</div>
            </div>
        `
    });
}

async function rejectStudentRequest(requestId) {
    if (!requestId) return;
    const input = await Swal.fire({
        icon: 'warning',
        title: 'Reject request?',
        text: 'You can add an optional reason for the student.',
        input: 'text',
        inputPlaceholder: 'Reason (optional)',
        showCancelButton: true,
        confirmButtonText: 'Reject',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc2626'
    });
    if (!input.isConfirmed) return;

    try {
        const response = await axios.post(`${baseApiUrl}/students.php`, {
            action: 'reject-package-request',
            request_id: Number(requestId),
            admin_notes: input.value || ''
        });
        const data = response.data;
        if (data.success) {
            showMessage(data.message || 'Request rejected.', 'success');
            loadPendingRequests();
        } else {
            showMessage(data.error || 'Failed to reject request.', 'error');
        }
    } catch (error) {
        showMessage('Network error while rejecting request.', 'error');
    }
}

// Initialize index.html functions
function initIndexPage() {
    initLoginForm();
    initRegisterForm();
    initDatePicker();
    loadBranches();
    initScrollAnimations();
}

// Initialize scroll animations for About section
function initScrollAnimations() {
    const animateElements = document.querySelectorAll('.scroll-animate');

    if (animateElements.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Add staggered animation for multiple elements
                const elements = Array.from(entry.target.parentElement?.querySelectorAll('.scroll-animate') || [entry.target]);
                elements.forEach((el, index) => {
                    setTimeout(() => {
                        el.classList.add('visible');
                    }, index * 150); // 150ms delay between each element
                });

                // Stop observing once animated
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.3, // Trigger when 30% of element is visible
        rootMargin: '0px 0px -50px 0px' // Trigger slightly before element comes into full view
    });

    animateElements.forEach(el => observer.observe(el));
}

// Prompt user to change password on first login (when using a default/temporary password)
async function promptPasswordChange(user, currentPassword) {
    try {
        const { value: formValues } = await Swal.fire({
            title: 'Change Your Password',
            html:
                '<div class="text-left text-sm mb-3">' +
                    '<p class="mb-1">For security, please change your temporary password now.</p>' +
                    '<ul class="list-disc list-inside text-xs text-zinc-300">' +
                        '<li>At least 8 characters</li>' +
                        '<li>Include uppercase, lowercase, number and special character (!@#$%^&*)</li>' +
                    '</ul>' +
                '</div>' +
                '<input id="swal-new-password" class="swal2-input" type="password" placeholder="New password">' +
                '<input id="swal-confirm-password" class="swal2-input" type="password" placeholder="Confirm new password">',
            focusConfirm: false,
            allowOutsideClick: false,
            preConfirm: () => {
                const newPass = document.getElementById('swal-new-password').value || '';
                const confirmPass = document.getElementById('swal-confirm-password').value || '';

                if (!newPass || !confirmPass) {
                    Swal.showValidationMessage('Please fill in both password fields');
                    return false;
                }
                if (newPass !== confirmPass) {
                    Swal.showValidationMessage('Passwords do not match');
                    return false;
                }
                if (newPass.length < 8 ||
                    !/[A-Z]/.test(newPass) ||
                    !/[a-z]/.test(newPass) ||
                    !/[0-9]/.test(newPass) ||
                    !/[!@#$%^&*]/.test(newPass)) {
                    Swal.showValidationMessage('Password must meet all complexity requirements.');
                    return false;
                }

                return { newPassword: newPass };
            }
        });

        if (!formValues) {
            return;
        }

        const response = await axios.post(`${baseApiUrl}/users.php?action=change-password`, {
            user_id: user.user_id,
            old_password: currentPassword,
            new_password: formValues.newPassword
        });

        const result = response.data;

        if (!result.success) {
            await Swal.fire({
                icon: 'error',
                title: 'Password Change Failed',
                text: result.error || 'Unable to change password. Please try again.',
                confirmButtonColor: '#b8860b'
            });
            return;
        }

        await Swal.fire({
            icon: 'success',
            title: 'Password Updated',
            text: 'Your password has been changed successfully.',
            confirmButtonColor: '#b8860b'
        });
    } catch (err) {
        console.error('Error changing password:', err);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'An unexpected error occurred. Please try again.',
            confirmButtonColor: '#b8860b'
        });
    }
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
            const appBase = (typeof appBaseUrl === 'string' && appBaseUrl)
                ? appBaseUrl
                : ((typeof baseApiUrl === 'string' && baseApiUrl.endsWith('/api'))
                    ? baseApiUrl.slice(0, -4)
                    : `${window.location.origin}/FAS_music`);
            window.location.href = `${appBase}/index.html`;
        });
    }
}

// ========== STUDENT PAGE FUNCTIONS ==========

function checkStudentAuth() {
    const user = Auth.getUser();
    if (!user || user.role_name !== 'Student') {
        Swal.fire({
            icon: 'warning',
            title: 'Access Denied',
            text: 'You must be logged in as a Student to access this page.',
            confirmButtonColor: '#b8860b',
            confirmButtonText: 'Go to Login'
        }).then(() => {
            const appBase = (typeof appBaseUrl === 'string' && appBaseUrl)
                ? appBaseUrl
                : ((typeof baseApiUrl === 'string' && baseApiUrl.endsWith('/api'))
                    ? baseApiUrl.slice(0, -4)
                    : `${window.location.origin}/FAS_music`);
            window.location.href = `${appBase}/index.html`;
        });
        return false;
    }
    return true;
}

function checkGuardianAuth() {
    const user = Auth.getUser();
    if (!user || user.role_name !== 'Guardians') {
        Swal.fire({
            icon: 'warning',
            title: 'Access Denied',
            text: 'You must be logged in as a Guardian to access this page.',
            confirmButtonColor: '#b8860b',
            confirmButtonText: 'Go to Login'
        }).then(() => {
            const appBase = (typeof baseApiUrl === 'string' && baseApiUrl.endsWith('/api'))
                ? baseApiUrl.slice(0, -4)
                : `${window.location.origin}/FAS_music`;
            window.location.href = `${appBase}/index.html`;
        });
        return false;
    }
    return true;
}

async function fetchStudentPortalDataByEmail(email) {
    const url = `${baseApiUrl}/students.php?action=get-student-portal&email=${encodeURIComponent(email)}`;
    const res = await axios.get(url);
    return res.data;
}

async function fetchGuardianPortalDataByEmail(email) {
    const url = `${baseApiUrl}/students.php?action=get-guardian-portal&email=${encodeURIComponent(email)}`;
    const res = await axios.get(url);
    return res.data;
}

async function fetchAttendanceSummary(studentId) {
    const url = `${baseApiUrl}/attendance.php?action=get-summary&student_id=${encodeURIComponent(studentId)}`;
    const res = await axios.get(url);
    return res.data;
}

async function fetchAttendanceList(studentId, limit = 50) {
    const url = `${baseApiUrl}/attendance.php?action=get-student-attendance&student_id=${encodeURIComponent(studentId)}&limit=${encodeURIComponent(limit)}`;
    const res = await axios.get(url);
    return res.data;
}

function formatCurrencyPHP(amount) {
    const n = Number(amount || 0);
    return `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? '';
}

function setHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

function isRegistrationProfileComplete(student) {
    if (!student) return false;
    const required = ['first_name', 'last_name', 'email', 'phone', 'branch_id', 'date_of_birth', 'address'];
    return required.every((field) => {
        const val = student[field];
        return val !== null && val !== undefined && String(val).trim() !== '';
    });
}

function computeAgeFromDob(dob) {
    if (!dob) return null;
    const birth = new Date(dob);
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : null;
}

async function fetchGuardianByEmail(email) {
    const url = `${baseApiUrl}/students.php?action=find-guardian&email=${encodeURIComponent(email)}`;
    const res = await axios.get(url);
    return res.data;
}

async function setGuardianMode(studentId, guardianMode, guardianEmail = '', guardianDetails = {}) {
    const res = await axios.post(`${baseApiUrl}/students.php?action=set-guardian-mode`, {
        student_id: Number(studentId),
        guardian_mode: guardianMode,
        guardian_email: guardianEmail,
        guardian_first_name: guardianDetails.first_name || '',
        guardian_last_name: guardianDetails.last_name || '',
        guardian_phone: guardianDetails.phone || '',
        guardian_relationship: guardianDetails.relationship || ''
    });
    return res.data;
}

function badgeClassForRegistrationStatus(status) {
    switch (String(status || '')) {
        case 'Approved': return 'bg-blue-500/15 text-blue-400 border border-blue-500/25';
        case 'Fee Paid': return 'bg-green-500/15 text-green-400 border border-green-500/25';
        case 'Pending': return 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25';
        case 'Rejected': return 'bg-red-500/15 text-red-400 border border-red-500/25';
        default: return 'bg-zinc-500/15 text-zinc-300 border border-zinc-500/25';
    }
}

function renderInstrumentChips(instruments) {
    if (!Array.isArray(instruments) || instruments.length === 0) {
        return `<div class="text-sm text-zinc-400 italic">No instruments assigned yet.</div>`;
    }
    return instruments.map(inst => {
        const name = escapeHtml(inst.instrument_name || 'Instrument');
        const type = escapeHtml(inst.type_name || '');
        const meta = type ? `<span class="text-[10px] text-zinc-400 ml-2">(${type})</span>` : '';
        return `<div class="inline-flex items-center px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white">
            <i class="fas fa-music mr-2 text-gold-400"></i>${name}${meta}
        </div>`;
    }).join('');
}

function buildStudentQrPayload(student) {
    // Payload format: FAS_ATTENDANCE|STUDENT|student_id|email|branch_id
    // branch_id ensures uptown=uptown, downtown=downtown validation at scan
    const sid = student?.student_id ?? '';
    const email = student?.email ?? '';
    const bid = student?.branch_id ?? '';
    return `FAS_ATTENDANCE|STUDENT|${sid}|${email}|${bid}`;
}

async function fetchStudentQrStatus(studentId, email = '') {
    const params = studentId > 0
        ? `student_id=${encodeURIComponent(studentId)}`
        : `email=${encodeURIComponent(email)}`;
    const url = `${baseApiUrl}/attendance.php?action=qr-status&${params}`;
    const res = await axios.get(url);
    return res.data;
}

function renderStudentQrStatus(status) {
    const code = String(status?.code || 'no_session');
    const titleMap = {
        valid_today: 'QR Ready For Today',
        early: 'Not Yet Available',
        missed: 'Session Missed',
        completed: 'Session Completed',
        no_session: 'No Session Today'
    };
    const banner = document.getElementById('qrStatusBanner');
    const titleEl = document.getElementById('studentQrStatusTitle');
    const messageEl = document.getElementById('studentQrStatusMessage');
    const styles = {
        valid_today: 'block border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
        early: 'block border-amber-500/30 bg-amber-500/10 text-amber-200',
        missed: 'block border-rose-500/30 bg-rose-500/10 text-rose-200',
        completed: 'block border-sky-500/30 bg-sky-500/10 text-sky-200',
        no_session: 'block border-zinc-500/30 bg-zinc-500/10 text-zinc-200'
    };

    if (titleEl) titleEl.textContent = titleMap[code] || 'QR Status';
    if (messageEl) messageEl.textContent = status?.message || 'Please check back later.';
    if (banner) {
        banner.className = `w-full mb-4 rounded-2xl border px-4 py-3 text-sm font-medium ${styles[code] || styles.no_session}`;
        banner.textContent = status?.message || 'Please check back later.';
    }
}

function renderQrCode(targetElId, payload) {
    const target = document.getElementById(targetElId);
    if (!target) return;
    target.innerHTML = '';
    if (!payload) {
        target.innerHTML = '<div class="text-sm text-zinc-400">QR data unavailable.</div>';
        return;
    }
    if (typeof QRCode === 'undefined') {
        target.innerHTML = '<div class="text-sm text-zinc-400">QR library not loaded.</div>';
        return;
    }
    // Ensure high-contrast QR for camera scanning
    target.style.background = '#ffffff';
    target.style.padding = '10px';
    target.style.borderRadius = '12px';
    target.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)';
    // QRCode.js expects a DOM element
    // eslint-disable-next-line no-new
    new QRCode(target, {
        text: payload,
        width: 220,
        height: 220,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });
}

function renderAvailablePackagesAndInstruments(packages, instruments) {
    const pkgRows = Array.isArray(packages) && packages.length
        ? packages.map(p => {
            const sessions = Number(p.sessions || p.total_sessions || 0);
            const maxInst = Number(p.max_instruments || 0);
            const price = Number(p.price || 0);
            return `<div class="rounded-xl border border-white/10 bg-white/5 p-3">
                <div class="font-semibold text-white">${escapeHtml(p.package_name || 'Package')}</div>
                <div class="text-xs text-zinc-400 mt-1">${sessions} sessions • up to ${maxInst || 1} instrument(s)</div>
                <div class="text-xs text-gold-400 mt-1">${formatCurrencyPHP(price)}</div>
            </div>`;
        }).join('')
        : '<div class="text-zinc-500">No session packages available yet.</div>';

    const typeSet = new Set();
    (Array.isArray(instruments) ? instruments : []).forEach(i => {
        const t = (i.type_name || '').trim();
        if (t) typeSet.add(t);
    });
    const types = Array.from(typeSet);
    const instHtml = types.length
        ? `<div class="flex flex-wrap gap-2 mt-3">${types.map(t => `<span class="px-2 py-1 rounded-lg border border-gold-500/30 bg-gold-500/10 text-gold-300 text-xs font-semibold">${escapeHtml(t)}</span>`).join('')}</div>`
        : '<div class="text-zinc-500 mt-3">No instrument types available for your branch yet.</div>';

    return `${pkgRows}${instHtml}`;
}

function buildPublicFileUrl(filePath) {
    if (!filePath) return '';
    const raw = String(filePath || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    const appBase = String(baseApiUrl || '').replace(/\/api\/?$/, '');
    const cleanPath = raw.replace(/^\/+/, '');
    return `${appBase}/${cleanPath}`;
}

function formatTime12Hour(timeString) {
    if (!timeString) return '—';
    const parts = String(timeString).split(':');
    if (parts.length < 2) return timeString;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return timeString;
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(m).padStart(2, '0')} ${suffix}`;
}

function formatDateLong(dateString) {
    if (!dateString) return '';
    const raw = String(dateString).trim();
    if (!raw) return '';

    let dt;
    const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
        dt = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    } else {
        dt = new Date(raw);
    }
    if (Number.isNaN(dt.getTime())) return raw;

    return dt.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function getDayOfWeekFromDate(dateString) {
    if (!dateString) return '';
    const raw = String(dateString).trim();
    const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    let dt;
    if (ymd) {
        dt = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    } else {
        dt = new Date(raw);
    }
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString('en-US', { weekday: 'long' });
}

function computeStudentRequestPayableNow(basePrice, sessions, paymentRaw) {
    const price = Number(basePrice || 0);
    const s = Number(sessions || 0);
    const v = String(paymentRaw || '').toLowerCase();
    if (price <= 0) return 0;
    const ratio = s === 12 ? (3000 / 7450) : (s === 20 ? (5000 / 11800) : 0.42);
    const partial = Math.round(price * ratio);
    if (v === 'full' || v === 'full payment' || v === 'fullpayment') return price;
    if (v === 'partial payment' || v === 'partial' || v === 'downpayment') return partial;
    if (v === 'installment') {
        return Math.max(1, Math.round(price / Math.max(1, s || 1)));
    }
    return partial;
}

function renderStudentRequestStatus(latestRequest) {
    if (!latestRequest) {
        return '<div class="text-sm text-zinc-500">No request submitted yet.</div>';
    }
    const status = String(latestRequest.status || 'Pending');
    const badgeClass = status === 'Approved'
        ? 'bg-green-500/15 text-green-300 border border-green-500/30'
        : status === 'Rejected'
            ? 'bg-red-500/15 text-red-300 border border-red-500/30'
            : 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30';
    const createdAt = latestRequest.created_at ? new Date(latestRequest.created_at).toLocaleString() : '—';
    const packageName = escapeHtml(latestRequest.package_name || 'Package');
    const amount = formatCurrencyPHP(latestRequest.requested_amount || 0);
    const paymentTypeRaw = String(latestRequest.payment_type || '').toLowerCase();
    const paymentModeLabel = paymentTypeRaw.includes('full')
        ? 'Full Payment'
        : (paymentTypeRaw.includes('install') ? 'Installment' : 'Partial Payment');
    const notes = latestRequest.admin_notes ? `<div class="text-xs text-zinc-400 mt-1">Admin note: ${escapeHtml(latestRequest.admin_notes)}</div>` : '';
    const assignedTeacherName = `${latestRequest.assigned_teacher_first_name || ''} ${latestRequest.assigned_teacher_last_name || ''}`.trim();
    const assignedDate = latestRequest.assigned_date ? formatDateLong(latestRequest.assigned_date) : '';
    const assignedDay = latestRequest.assigned_day_of_week || '';
    const assignedStart = latestRequest.assigned_start_time ? formatTime12Hour(latestRequest.assigned_start_time) : '';
    const assignedEnd = latestRequest.assigned_end_time ? formatTime12Hour(latestRequest.assigned_end_time) : '';
    const assignedRoom = latestRequest.assigned_room || '';
    const whenText = assignedDate || [assignedDay].filter(Boolean).join(' • ');
    const assignmentInfo = status === 'Approved' && (assignedTeacherName || assignedDate || assignedDay || assignedStart || assignedEnd || assignedRoom)
        ? `<div class="mt-2 text-xs text-green-300 bg-green-500/10 border border-green-500/20 rounded-lg p-2">
            <div><span class="text-green-200 font-semibold">Assigned Teacher:</span> ${escapeHtml(assignedTeacherName || '—')}</div>
            <div><span class="text-green-200 font-semibold">Sessions start:</span> ${escapeHtml(whenText || 'Not set')}</div>
            <div><span class="text-green-200 font-semibold">Time:</span> ${escapeHtml((assignedStart && assignedEnd) ? `${assignedStart} - ${assignedEnd}` : 'Not set')}</div>
            <div><span class="text-green-200 font-semibold">Where:</span> ${escapeHtml(assignedRoom || 'Not set')}</div>
        </div>`
        : '';

    return `
        <div class="rounded-xl border border-white/10 bg-white/5 p-3">
            <div class="flex items-center gap-2">
                <span class="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold ${badgeClass}">${escapeHtml(status)}</span>
                <span class="text-xs text-zinc-400">${createdAt}</span>
            </div>
            <div class="mt-2 text-sm text-zinc-200">${packageName} • ${amount}</div>
            <div class="mt-1 text-xs text-zinc-400">Payment mode: <span class="text-zinc-200 font-semibold">${escapeHtml(paymentModeLabel)}</span></div>
            ${assignmentInfo}
            ${notes}
        </div>
    `;
}

function renderStudentAvailabilityCalendar(availabilities) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const grouped = {};
    days.forEach(d => { grouped[d] = []; });

    (Array.isArray(availabilities) ? availabilities : []).forEach(a => {
        const day = String(a.day_of_week || '');
        if (grouped[day]) grouped[day].push(a);
    });

    return days.map(day => {
        const slots = grouped[day];
        if (!slots.length) {
            return `<div class="rounded-xl border border-white/10 bg-black/20 p-3">
                <div class="text-xs font-bold uppercase tracking-wider text-zinc-400">${day}</div>
                <div class="text-xs text-zinc-500 mt-2">No active slots</div>
            </div>`;
        }
        return `<div class="rounded-xl border border-white/10 bg-black/20 p-3">
            <div class="text-xs font-bold uppercase tracking-wider text-zinc-300">${day}</div>
            <div class="mt-2 space-y-2">
                ${slots.map(s => {
                    const teacher = `${s.teacher_first_name || ''} ${s.teacher_last_name || ''}`.trim();
                    return `<div class="rounded-lg border border-gold-500/20 bg-gold-500/10 px-2 py-1">
                        ${teacher ? `<div class="text-xs font-semibold text-gold-200">${escapeHtml(teacher)}</div>` : ''}
                        <div class="text-[11px] text-zinc-300">${formatTime12Hour(s.start_time)} - ${formatTime12Hour(s.end_time)}</div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }).join('');
}

function enrollmentStatusBadgeClass(status) {
    const s = String(status || '');
    if (s === 'Ongoing') return 'bg-green-500/15 text-green-300 border border-green-500/30';
    if (s === 'Completed') return 'bg-blue-500/15 text-blue-300 border border-blue-500/30';
    if (s === 'Pending Payment') return 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30';
    if (s === 'Dropped' || s === 'Cancelled') return 'bg-red-500/15 text-red-300 border border-red-500/30';
    return 'bg-zinc-500/15 text-zinc-300 border border-zinc-500/30';
}

function renderCurrentEnrollmentSummary(enrollment, student, instruments) {
    if (!enrollment) {
        return '<div class="text-sm text-zinc-500">No enrollment record yet.</div>';
    }
    const teacherName = `${enrollment.teacher_first_name || ''} ${enrollment.teacher_last_name || ''}`.trim();
    const startDate = formatDateLong(enrollment.first_session_date || enrollment.start_date || '');
    const startTime = enrollment.first_start_time ? formatTime12Hour(enrollment.first_start_time) : '';
    const endTime = enrollment.first_end_time ? formatTime12Hour(enrollment.first_end_time) : '';
    const timeLabel = (startTime && endTime) ? `${startTime} - ${endTime}` : 'Not set';
    const room = enrollment.first_room || 'Not set';
    const branchName = student?.branch_name || 'Branch not set';
    const instrumentNames = (Array.isArray(instruments) ? instruments : [])
        .map(i => String(i.instrument_name || '').trim())
        .filter(Boolean);
    const instrumentsLabel = instrumentNames.length ? instrumentNames.join(', ') : 'Not set';
    const totalAmount = Number(enrollment.total_amount || 0);
    const paidAmount = Number(enrollment.paid_amount || 0);
    const balance = Math.max(0, totalAmount - paidAmount);
    const paymentState = totalAmount > 0 && paidAmount >= totalAmount ? 'Paid' : (paidAmount > 0 ? 'Partial' : 'Unpaid');
    const status = enrollment.status || '—';
    return `
        <div class="rounded-xl border border-white/10 bg-black/20 p-4">
            <div class="flex items-center justify-between gap-2">
                <div class="text-base font-bold text-white">ENROLLED: ${escapeHtml(enrollment.package_name || 'Package')}</div>
                <span class="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold ${enrollmentStatusBadgeClass(status)}">${escapeHtml(status)}</span>
            </div>
            <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div><span class="text-zinc-400">Instruments to learn:</span> <span class="text-zinc-100 font-semibold">${escapeHtml(instrumentsLabel)}</span></div>
                <div><span class="text-zinc-400">Payment:</span> <span class="text-zinc-100 font-semibold">${escapeHtml(paymentState)} (${escapeHtml(enrollment.payment_type || 'Partial Payment')})</span></div>
                <div><span class="text-zinc-400">Current Balance:</span> <span class="text-zinc-100 font-semibold">${formatCurrencyPHP(balance)}</span></div>
                <div><span class="text-zinc-400">Where:</span> <span class="text-zinc-100 font-semibold">${escapeHtml(`${room} (${branchName})`)}</span></div>
                <div><span class="text-zinc-400">Start Date:</span> <span class="text-zinc-100 font-semibold">${escapeHtml(startDate || 'Not set')}</span></div>
                <div><span class="text-zinc-400">Start Time:</span> <span class="text-zinc-100 font-semibold">${escapeHtml(timeLabel)}</span></div>
                <div><span class="text-zinc-400">Teacher:</span> <span class="text-zinc-100 font-semibold">${escapeHtml(teacherName || 'Not set')}</span></div>
                <div><span class="text-zinc-400">Amount:</span> <span class="text-zinc-100 font-semibold">${formatCurrencyPHP(enrollment.total_amount || 0)}</span></div>
            </div>
        </div>
    `;
}

function renderEnrollmentHistoryList(history) {
    if (!Array.isArray(history) || history.length === 0) {
        return '<div class="text-sm text-zinc-500">No previous enrollments yet.</div>';
    }
    return history.map(row => {
        const startDate = formatDateLong(row.first_session_date || row.start_date || row.enrollment_date || '');
        return `<div class="rounded-xl border border-white/10 bg-black/20 p-3">
            <div class="flex items-center justify-between gap-2">
                <div class="text-sm font-semibold text-white">${escapeHtml(row.package_name || 'Package')}</div>
                <span class="inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-bold ${enrollmentStatusBadgeClass(row.status)}">${escapeHtml(row.status || '—')}</span>
            </div>
            <div class="mt-1 text-xs text-zinc-400">Started: ${escapeHtml(startDate || 'Not set')} • ${escapeHtml(row.payment_type || 'Partial Payment')}</div>
        </div>`;
    }).join('');
}

function getStudentEnrollmentPaymentState(enrollment) {
    const totalAmount = Number(enrollment?.total_amount || 0);
    const paidAmount = Number(enrollment?.paid_amount || 0);
    if (totalAmount > 0 && paidAmount >= totalAmount) return 'Paid';
    if (paidAmount > 0) return 'Partial';
    return 'Unpaid';
}

function renderStudentProfileEnrollmentMeta(enrollment, instruments, branchName) {
    if (!enrollment) {
        return `
            <div class="text-zinc-500 dark:text-zinc-400">No approved or pending enrollment yet.</div>
            <div class="text-zinc-500 dark:text-zinc-400">Open Sessions if you need to request a package.</div>
        `;
    }

    const teacherName = `${enrollment.teacher_first_name || ''} ${enrollment.teacher_last_name || ''}`.trim() || 'Not assigned yet';
    const scheduleDate = formatDateLong(enrollment.first_session_date || enrollment.start_date || '');
    const scheduleStart = enrollment.first_start_time ? formatTime12Hour(enrollment.first_start_time) : '';
    const scheduleEnd = enrollment.first_end_time ? formatTime12Hour(enrollment.first_end_time) : '';
    const scheduleTime = scheduleStart && scheduleEnd ? `${scheduleStart} - ${scheduleEnd}` : 'Not scheduled yet';
    const roomName = enrollment.first_room || 'To be announced';
    const paymentState = getStudentEnrollmentPaymentState(enrollment);
    const balance = Math.max(0, Number(enrollment.total_amount || 0) - Number(enrollment.paid_amount || 0));
    const instrumentNames = (Array.isArray(instruments) ? instruments : [])
        .map(inst => String(inst.instrument_name || inst.type_name || '').trim())
        .filter(Boolean);
    const instrumentsLabel = instrumentNames.length ? instrumentNames.join(', ') : 'Not assigned yet';

    return `
        <div><span class="text-zinc-500 dark:text-zinc-400">Status:</span> <span class="font-semibold text-zinc-900 dark:text-white">${escapeHtml(enrollment.status || 'Pending')}</span></div>
        <div><span class="text-zinc-500 dark:text-zinc-400">Teacher:</span> <span class="font-semibold text-zinc-900 dark:text-white">${escapeHtml(teacherName)}</span></div>
        <div><span class="text-zinc-500 dark:text-zinc-400">First class:</span> <span class="font-semibold text-zinc-900 dark:text-white">${escapeHtml(scheduleDate || 'Not scheduled yet')}</span></div>
        <div><span class="text-zinc-500 dark:text-zinc-400">Time:</span> <span class="font-semibold text-zinc-900 dark:text-white">${escapeHtml(scheduleTime)}</span></div>
        <div><span class="text-zinc-500 dark:text-zinc-400">Room:</span> <span class="font-semibold text-zinc-900 dark:text-white">${escapeHtml(roomName)}</span></div>
        <div><span class="text-zinc-500 dark:text-zinc-400">Instruments:</span> <span class="font-semibold text-zinc-900 dark:text-white">${escapeHtml(instrumentsLabel)}</span></div>
        <div><span class="text-zinc-500 dark:text-zinc-400">Payment:</span> <span class="font-semibold text-zinc-900 dark:text-white">${escapeHtml(`${paymentState} (${enrollment.payment_type || 'Partial Payment'})`)}</span></div>
        <div><span class="text-zinc-500 dark:text-zinc-400">Balance:</span> <span class="font-semibold text-zinc-900 dark:text-white">${formatCurrencyPHP(balance)}</span></div>
        <div><span class="text-zinc-500 dark:text-zinc-400">Branch:</span> <span class="font-semibold text-zinc-900 dark:text-white">${escapeHtml(branchName || '—')}</span></div>
    `;
}

let guardianPortalStudents = [];
let guardianActiveStudentIndex = null;

function getGuardianInstrumentLabel(item) {
    const instruments = Array.isArray(item?.instruments) ? item.instruments : [];
    if (instruments.length > 0) {
        const names = instruments
            .map(inst => String(inst.instrument_name || '').trim())
            .filter(Boolean);
        if (names.length > 0) return names.join(', ');
    }

    const enrollmentNames = String(item?.current_enrollment?.instrument_names || '').trim();
    if (enrollmentNames) return enrollmentNames;

    const studentNames = String(item?.student?.instrument_names || '').trim();
    if (studentNames) return studentNames;

    return 'Not set';
}

function renderGuardianStudentCard(item, index) {
    const s = item?.student || {};
    const enrollment = item?.current_enrollment || null;
    const studentId = s.student_id ?? `g-${index}`;
    const studentName = `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Student';
    const branch = s.branch_name || '—';
    const regStatus = s.registration_status || 'Pending';
    const regPaid = Number(s.registration_fee_paid || 0);
    const regTotal = Number(s.registration_fee_amount || 0);
    const regRemaining = Math.max(0, regTotal - regPaid);

    const pkgName = enrollment?.package_name || s.package_name || 'Not assigned yet';
    const pkgSessions = enrollment?.package_sessions || s.package_sessions || 0;
    const pkgTotal = Number(enrollment?.total_amount || s.package_price || 0);
    const pkgPaid = Number(enrollment?.paid_amount || 0);
    const pkgBalance = Math.max(0, pkgTotal - pkgPaid);
    const attendanceTotal = Number(enrollment?.package_sessions || s.package_sessions || 0);

    return `
        <div class="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 sm:p-6 shadow-xl dark:shadow-black/40">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div class="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400 font-bold">Student</div>
                    <div class="text-xl font-extrabold mt-2 text-zinc-900 dark:text-white">${escapeHtml(studentName)}</div>
                    <div class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Branch: <span class="text-zinc-700 dark:text-zinc-200 font-semibold">${escapeHtml(branch)}</span></div>
                </div>
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${badgeClassForRegistrationStatus(regStatus)}">${escapeHtml(regStatus)}</span>
            </div>

            <div class="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-4">
                    <div class="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold">Package</div>
                    <div class="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">${escapeHtml(pkgName)}</div>
                    <div class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">${pkgSessions ? `${pkgSessions} sessions` : 'No package yet'}</div>
                </div>
                <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-4">
                    <div class="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold">Package Balance</div>
                    <div class="mt-2 text-lg font-black text-zinc-900 dark:text-white">${formatCurrencyPHP(pkgBalance)}</div>
                </div>
                <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-4">
                    <div class="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold">Progress</div>
                    <div class="mt-2 text-sm text-zinc-900 dark:text-white font-semibold">
                        <span id="guardianProgressAttended-${studentId}">—</span>
                        <span class="text-zinc-500 dark:text-zinc-400 font-medium"> / ${attendanceTotal || '—'} attended</span>
                    </div>
                    <div class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Remaining: <span id="guardianProgressRemaining-${studentId}" class="font-semibold text-zinc-700 dark:text-zinc-200">—</span></div>
                </div>
            </div>

            <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div id="guardianProgressLast-${studentId}" class="text-xs text-zinc-500 dark:text-zinc-400">Last attendance: —</div>
                <button type="button" onclick="openGuardianStudentModal(${index})" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-black text-sm font-bold transition">
                    <i class="fas fa-eye"></i> View Details
                </button>
            </div>
        </div>
    `;
}

function renderGuardianStudentModal(item, index) {
    const s = item?.student || {};
    const enrollment = item?.current_enrollment || null;
    const history = item?.enrollment_history || item?.history || [];
    const studentId = s.student_id ?? `g-${index}`;
    const studentName = `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Student';
    const branch = s.branch_name || '—';
    const regStatus = s.registration_status || 'Pending';
    const regPaid = Number(s.registration_fee_paid || 0);
    const regTotal = Number(s.registration_fee_amount || 0);
    const regRemaining = Math.max(0, regTotal - regPaid);
    const pkgName = enrollment?.package_name || s.package_name || 'Not assigned yet';
    const pkgSessions = enrollment?.package_sessions || s.package_sessions || 0;
    const pkgTotal = Number(enrollment?.total_amount || s.package_price || 0);
    const pkgPaid = Number(enrollment?.paid_amount || 0);
    const pkgBalance = Math.max(0, pkgTotal - pkgPaid);
    const teacherName = `${enrollment?.teacher_first_name || ''} ${enrollment?.teacher_last_name || ''}`.trim() || 'Not set';
    const scheduleDate = formatDateLong(enrollment?.first_session_date || enrollment?.start_date || '');
    const scheduleStart = enrollment?.first_start_time ? formatTime12Hour(enrollment.first_start_time) : '';
    const scheduleEnd = enrollment?.first_end_time ? formatTime12Hour(enrollment.first_end_time) : '';
    const scheduleTime = scheduleStart && scheduleEnd ? `${scheduleStart} - ${scheduleEnd}` : 'Not set';
    const scheduleRoom = enrollment?.first_room || 'Not set';
    const paymentState = enrollment?.payment_status || s.registration_status || 'Pending';
    const instrumentsLabel = getGuardianInstrumentLabel(item);

    return `
        <div class="space-y-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div class="text-sm text-zinc-500 dark:text-zinc-400">Branch: <span class="font-semibold text-zinc-700 dark:text-zinc-200">${escapeHtml(branch)}</span></div>
                    <div class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Student ID: <span class="font-semibold text-zinc-700 dark:text-zinc-200">${escapeHtml(String(studentId))}</span></div>
                </div>
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${badgeClassForRegistrationStatus(regStatus)}">${escapeHtml(regStatus)}</span>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-4">
                    <div class="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold">Registration</div>
                    <div class="mt-3 text-sm text-zinc-600 dark:text-zinc-300">Paid: <span class="text-zinc-900 dark:text-white font-semibold">${formatCurrencyPHP(regPaid)}</span></div>
                    <div class="text-sm text-zinc-600 dark:text-zinc-300">Total: <span class="text-zinc-900 dark:text-white font-semibold">${formatCurrencyPHP(regTotal)}</span></div>
                    <div class="text-sm text-zinc-600 dark:text-zinc-300">Remaining: <span class="text-gold-500 font-semibold">${formatCurrencyPHP(regRemaining)}</span></div>
                </div>
                <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-4">
                    <div class="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold">Package & Payments</div>
                    <div class="mt-3 text-sm text-zinc-600 dark:text-zinc-300">Package: <span class="text-zinc-900 dark:text-white font-semibold">${escapeHtml(pkgName)}</span></div>
                    <div class="text-sm text-zinc-600 dark:text-zinc-300">Sessions: <span class="text-zinc-900 dark:text-white font-semibold">${pkgSessions ? `${pkgSessions} sessions` : '—'}</span></div>
                    <div class="text-sm text-zinc-600 dark:text-zinc-300">Paid: <span class="text-zinc-900 dark:text-white font-semibold">${formatCurrencyPHP(pkgPaid)}</span></div>
                    <div class="text-sm text-zinc-600 dark:text-zinc-300">Balance: <span class="text-gold-500 font-semibold">${formatCurrencyPHP(pkgBalance)}</span></div>
                </div>
                <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-4">
                    <div class="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold">Attendance</div>
                    <div class="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div class="rounded-xl bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 p-2">
                            <div class="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Attended</div>
                            <div id="guardianModalProgressAttended-${studentId}" class="text-lg font-black text-zinc-900 dark:text-white mt-1">—</div>
                        </div>
                        <div class="rounded-xl bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 p-2">
                            <div class="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Remaining</div>
                            <div id="guardianModalProgressRemaining-${studentId}" class="text-lg font-black text-zinc-900 dark:text-white mt-1">—</div>
                        </div>
                        <div class="rounded-xl bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 p-2">
                            <div class="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Last</div>
                            <div id="guardianModalProgressLast-${studentId}" class="text-xs font-semibold text-zinc-700 dark:text-zinc-200 mt-2">—</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-5">
                <div class="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold">Current Schedule</div>
                <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div><span class="text-zinc-500 dark:text-zinc-400">Teacher:</span> <span class="text-zinc-900 dark:text-white font-semibold">${escapeHtml(teacherName)}</span></div>
                    <div><span class="text-zinc-500 dark:text-zinc-400">Payment:</span> <span class="text-zinc-900 dark:text-white font-semibold">${escapeHtml(paymentState)}</span></div>
                    <div><span class="text-zinc-500 dark:text-zinc-400">Date:</span> <span class="text-zinc-900 dark:text-white font-semibold">${escapeHtml(scheduleDate || 'Not set')}</span></div>
                    <div><span class="text-zinc-500 dark:text-zinc-400">Time:</span> <span class="text-zinc-900 dark:text-white font-semibold">${escapeHtml(scheduleTime)}</span></div>
                    <div><span class="text-zinc-500 dark:text-zinc-400">Room:</span> <span class="text-zinc-900 dark:text-white font-semibold">${escapeHtml(scheduleRoom)}</span></div>
                    <div><span class="text-zinc-500 dark:text-zinc-400">Instruments:</span> <span class="text-zinc-900 dark:text-white font-semibold">${escapeHtml(instrumentsLabel)}</span></div>
                </div>
            </div>

            <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-5">
                <div class="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold">Enrollment History</div>
                <div class="mt-3 space-y-3">
                    ${renderEnrollmentHistoryList(history)}
                </div>
            </div>
        </div>
    `;
}

function renderGuardianStudentsList(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return `
            <div class="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-10 text-center text-zinc-500 dark:text-zinc-400">
                <i class="fas fa-user-slash text-3xl mb-3"></i>
                <div class="font-semibold">No linked students found.</div>
                <div class="text-xs text-zinc-500 mt-2">Ask the admin to link your guardian account to a student profile.</div>
            </div>
        `;
    }
    return items.map((item, index) => renderGuardianStudentCard(item, index)).join('');
}

function updateGuardianTotals(items) {
    const rows = Array.isArray(items) ? items : [];
    let totalBalance = 0;
    let totalPaid = 0;

    rows.forEach(item => {
        const s = item?.student || {};
        const enrollment = item?.current_enrollment || null;
        const regPaid = Number(s.registration_fee_paid || 0);
        const regTotal = Number(s.registration_fee_amount || 0);
        const regRemaining = Math.max(0, regTotal - regPaid);
        const pkgTotal = Number(enrollment?.total_amount || s.package_price || 0);
        const pkgPaid = Number(enrollment?.paid_amount || 0);
        const pkgRemaining = Math.max(0, pkgTotal - pkgPaid);

        totalBalance += regRemaining + pkgRemaining;
        totalPaid += regPaid + pkgPaid;
    });

    setText('guardianStudentCount', String(rows.length));
    setText('guardianTotalBalance', formatCurrencyPHP(totalBalance));
    setText('guardianTotalPaid', formatCurrencyPHP(totalPaid));
}

async function hydrateGuardianAttendance(items) {
    const rows = Array.isArray(items) ? items : [];
    await Promise.all(rows.map(async (item) => {
        const student = item?.student || {};
        const studentId = student.student_id;
        if (!studentId) return;

        try {
            const summaryRes = await fetchAttendanceSummary(studentId);
            const attended = summaryRes?.success
                ? Number(summaryRes.summary?.present_count ?? 0) + Number(summaryRes.summary?.late_count ?? 0)
                : 0;
            const total = Number(item?.current_enrollment?.package_sessions || student.package_sessions || 0);
            const remaining = total > 0 ? Math.max(0, total - attended) : 0;
            const lastAttended = summaryRes?.success && summaryRes.summary?.last_attended_at
                ? new Date(summaryRes.summary.last_attended_at).toLocaleString()
                : '—';

            setText(`guardianProgressAttended-${studentId}`, String(attended));
            setText(`guardianProgressRemaining-${studentId}`, total > 0 ? String(remaining) : '—');
            setText(`guardianProgressLast-${studentId}`, `Last attendance: ${lastAttended}`);
            setText(`guardianModalProgressAttended-${studentId}`, String(attended));
            setText(`guardianModalProgressRemaining-${studentId}`, total > 0 ? String(remaining) : '—');
            setText(`guardianModalProgressLast-${studentId}`, lastAttended);
        } catch (e) {
            setText(`guardianProgressAttended-${studentId}`, '—');
            setText(`guardianProgressRemaining-${studentId}`, '—');
            setText(`guardianProgressLast-${studentId}`, 'Last attendance: —');
            setText(`guardianModalProgressAttended-${studentId}`, '—');
            setText(`guardianModalProgressRemaining-${studentId}`, '—');
            setText(`guardianModalProgressLast-${studentId}`, '—');
        }
    }));
}

function openGuardianStudentModal(index) {
    const item = guardianPortalStudents[index];
    const modal = document.getElementById('guardianStudentModal');
    const body = document.getElementById('guardianStudentModalBody');
    const title = document.getElementById('guardianStudentModalTitle');
    if (!item || !modal || !body || !title) return;

    guardianActiveStudentIndex = index;
    const student = item?.student || {};
    const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
    title.textContent = studentName;
    body.innerHTML = renderGuardianStudentModal(item, index);
    const studentId = student.student_id;
    if (studentId) {
        const attendedText = document.getElementById(`guardianProgressAttended-${studentId}`)?.textContent || '—';
        const remainingText = document.getElementById(`guardianProgressRemaining-${studentId}`)?.textContent || '—';
        const lastText = (document.getElementById(`guardianProgressLast-${studentId}`)?.textContent || 'Last attendance: —').replace(/^Last attendance:\s*/, '');
        setText(`guardianModalProgressAttended-${studentId}`, attendedText);
        setText(`guardianModalProgressRemaining-${studentId}`, remainingText);
        setText(`guardianModalProgressLast-${studentId}`, lastText);
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('overflow-hidden');
}

function closeGuardianStudentModal() {
    const modal = document.getElementById('guardianStudentModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.classList.remove('overflow-hidden');
    guardianActiveStudentIndex = null;
}

async function initGuardianStudentsPage() {
    if (!checkGuardianAuth()) return;

    const user = Auth.getUser();
    setText('guardianNavName', user?.username || user?.email || 'Guardian');

    const portal = await fetchGuardianPortalDataByEmail(user?.email || '');
    if (!portal?.success) {
        showMessage(portal?.error || 'Failed to load guardian portal.', 'error');
        return;
    }

    const guardians = Array.isArray(portal.guardians) ? portal.guardians : [];
    const primaryGuardian = guardians[0] || {};
    setText('guardianName', `${primaryGuardian.first_name || ''} ${primaryGuardian.last_name || ''}`.trim() || (user?.username || 'Guardian'));
    setText('guardianEmail', primaryGuardian.email || user?.email || '—');
    setText('guardianPhone', primaryGuardian.phone || '—');

    const students = Array.isArray(portal.students) ? portal.students : [];
    guardianPortalStudents = students;
    updateGuardianTotals(students);
    setHtml('guardianStudentsList', renderGuardianStudentsList(students));
    await hydrateGuardianAttendance(students);

    const modal = document.getElementById('guardianStudentModal');
    if (modal && !modal.dataset.bound) {
        modal.dataset.bound = 'true';
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeGuardianStudentModal();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeGuardianStudentModal();
        });
    }
}

let studentRequestAvailableInstruments = [];

function getStudentRequestAvailableTypes() {
    const seen = new Set();
    const types = [];
    studentRequestAvailableInstruments.forEach(inst => {
        const id = inst.type_id;
        const name = inst.type_name || 'Other';
        if (id != null && !seen.has(id)) {
            seen.add(id);
            types.push({ type_id: id, type_name: name });
        }
    });
    return types.sort((a, b) => (a.type_name || '').localeCompare(b.type_name || ''));
}

function getStudentRequestInstrumentsByType(typeId) {
    if (!typeId) return [];
    return studentRequestAvailableInstruments.filter(inst => String(inst.type_id) === String(typeId));
}

function renderStudentRequestInstrumentSelectors(maxInstruments, instruments) {
    const maxCount = Math.max(1, Number(maxInstruments || 1));
    studentRequestAvailableInstruments = Array.isArray(instruments) ? instruments : [];
    const types = getStudentRequestAvailableTypes();
    const typeOptionsHtml = types.map(t =>
        `<option value="${t.type_id}">${escapeHtml(t.type_name)}</option>`
    ).join('');

    let html = '';
    for (let i = 1; i <= maxCount; i++) {
        const slotLabel = maxCount === 1 ? 'Instrument' : `Instrument ${i}`;
        html += `
            <div class="p-3 bg-zinc-900/60 rounded-lg border border-zinc-700 space-y-2">
                <label class="block text-sm font-medium text-zinc-200">${slotLabel} *</label>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs text-zinc-400 mb-1">Type</label>
                        <select class="student-request-instrument-type w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-gold-400" data-slot="${i}" onchange="onStudentRequestInstrumentTypeChange(${i})">
                            <option value="">Select type...</option>
                            ${typeOptionsHtml}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs text-zinc-400 mb-1">Instrument</label>
                        <select class="student-request-instrument w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-gold-400" data-slot="${i}" onchange="onStudentRequestInstrumentDropdownChange()">
                            <option value="">Select instrument...</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }
    return html;
}

function onStudentRequestInstrumentTypeChange(slot) {
    const typeSelect = document.querySelector(`select.student-request-instrument-type[data-slot="${slot}"]`);
    const instrumentSelect = document.querySelector(`select.student-request-instrument[data-slot="${slot}"]`);
    if (!typeSelect || !instrumentSelect) return;

    const typeId = typeSelect.value;
    instrumentSelect.innerHTML = '<option value="">Select instrument...</option>';
    instrumentSelect.value = '';

    if (typeId) {
        const items = getStudentRequestInstrumentsByType(typeId);
        items.forEach(inst => {
            const opt = document.createElement('option');
            opt.value = inst.instrument_id;
            opt.textContent = inst.instrument_name || 'Instrument';
            instrumentSelect.appendChild(opt);
        });
    }
    onStudentRequestInstrumentDropdownChange();
}

function onStudentRequestInstrumentDropdownChange() {
    const selects = document.querySelectorAll('select.student-request-instrument');
    const used = new Set();
    selects.forEach(select => {
        const val = select.value;
        if (val) used.add(val);
    });
    selects.forEach(select => {
        const currentVal = select.value;
        Array.from(select.options).forEach(opt => {
            if (opt.value === '') return;
            opt.disabled = used.has(opt.value) && opt.value !== currentVal;
        });
    });
}

async function fetchStudentRequestMetaByEmail(email) {
    const url = `${baseApiUrl}/students.php?action=get-student-request-meta&email=${encodeURIComponent(email)}`;
    const res = await axios.get(url);
    return res.data;
}

async function postStudentPackageRequest(payload) {
    const isFormData = (typeof FormData !== 'undefined') && (payload instanceof FormData);
    const res = await axios.post(
        `${baseApiUrl}/students.php`,
        isFormData ? payload : payload,
        isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
    );
    return res.data;
}

function initStudentAdditionalSessionAction(student, portal, requestMeta, attendanceSummary) {
    const statusEl = document.getElementById('studentAdditionalSessionStatus');
    const addBtn = document.getElementById('studentAddAnotherSessionBtn');
    if (!statusEl || !addBtn) return;

    const latest = requestMeta?.latest_request || null;
    const hasPendingRequest = latest && String(latest.status || '') === 'Pending';
    const currentEnrollment = portal?.current_enrollment || null;
    const totalSessions = Number(currentEnrollment?.package_sessions || student?.package_sessions || 0);
    const attendedSessions = Number(attendanceSummary?.summary?.present_count || 0) + Number(attendanceSummary?.summary?.late_count || 0);
    const remainingSessions = totalSessions > 0 ? Math.max(0, totalSessions - attendedSessions) : 0;

    if (hasPendingRequest) {
        statusEl.innerHTML = '<span class="text-yellow-300 font-semibold">You already have a pending session request.</span> Please wait for desk/admin to review it first.';
    } else if (totalSessions > 0) {
        statusEl.innerHTML = `Current progress: <span class="text-white font-semibold">${attendedSessions}</span> attended out of <span class="text-white font-semibold">${totalSessions}</span> session(s). Remaining: <span class="text-gold-400 font-semibold">${remainingSessions}</span>.`;
    } else {
        statusEl.innerHTML = 'No active session package was found. You can check if you are already allowed to add another session package.';
    }

    addBtn.onclick = () => {
        if (hasPendingRequest) {
            showMessage('You already have a pending request. Please wait for desk/admin approval first.', 'error');
            return;
        }

        if (remainingSessions > 0) {
            showMessage(`Cannot continue yet because you still have ${remainingSessions} remaining session(s) to finish.`, 'error');
            return;
        }

        showMessage('You can finally add another session. Please contact desk/admin to process your next session package.', 'success');
    };
}

function initStudentRequestSection(student, requestMeta) {
    const statusEl = document.getElementById('studentRequestStatus');
    const packageSelect = document.getElementById('studentRequestPackage');
    const amountEl = document.getElementById('studentRequestAmount');
    const instrumentsContainer = document.getElementById('studentRequestInstrumentContainer');
    const paymentModeEl = document.getElementById('studentRequestPaymentMode');
    const paymentMethodEl = document.getElementById('studentRequestPaymentMethod');
    const availabilityCalendar = document.getElementById('studentAvailabilityCalendar');
    const form = document.getElementById('studentPackageRequestForm');
    const submitBtn = document.getElementById('studentSubmitRequestBtn');
    const preferredDateEl = document.getElementById('studentRequestPreferredDate');
    const paymentProofEl = document.getElementById('studentRequestPaymentProof');
    const autoDayEl = document.getElementById('studentRequestAutoDay');

    if (!statusEl || !packageSelect || !amountEl || !instrumentsContainer || !paymentModeEl || !paymentMethodEl || !availabilityCalendar || !form || !submitBtn || !preferredDateEl) {
        return;
    }

    const packages = Array.isArray(requestMeta?.packages) ? requestMeta.packages : [];
    const instruments = Array.isArray(requestMeta?.instruments) ? requestMeta.instruments : [];
    const availabilities = Array.isArray(requestMeta?.availabilities) ? requestMeta.availabilities : [];
    const latest = requestMeta?.latest_request || null;
    const hasPendingRequest = latest && String(latest.status || '') === 'Pending';

    statusEl.innerHTML = renderStudentRequestStatus(latest);
    availabilityCalendar.innerHTML = '';

    packageSelect.innerHTML = '<option value="">Select package...</option>' + packages.map(pkg => {
        const sessions = Number(pkg.sessions || 0);
        const maxInst = Number(pkg.max_instruments || 1);
        const price = formatCurrencyPHP(pkg.price || 0);
        const branchLabel = String(pkg.branch_name || requestMeta?.student?.branch_name || '').trim();
        const branchText = branchLabel ? ` • ${escapeHtml(branchLabel)}` : '';
        return `<option value="${pkg.package_id}" data-max-instruments="${maxInst}" data-sessions="${sessions}" data-price="${pkg.price || 0}">${escapeHtml(pkg.package_name || 'Package')} (${sessions} sessions, up to ${maxInst} instrument${maxInst > 1 ? 's' : ''})${branchText} - ${price}</option>`;
    }).join('');
    if (packages.length === 0) {
        statusEl.innerHTML += '<div class="text-xs text-yellow-300 mt-2">No session package is available for enrollment request right now. Please contact desk/admin.</div>';
    }

    const updateRequestPackageUI = () => {
        const selected = packageSelect.options[packageSelect.selectedIndex];
        const maxInst = Number(selected?.getAttribute('data-max-instruments') || 0);
        const price = Number(selected?.getAttribute('data-price') || 0);
        const sessions = Number(selected?.getAttribute('data-sessions') || 0);
        const paymentType = String(paymentModeEl.value || 'Partial Payment');
        const partialAmount = computeStudentRequestPayableNow(price, sessions, 'Partial Payment');
        const fullAmount = computeStudentRequestPayableNow(price, sessions, 'Full Payment');
        const installmentAmount = computeStudentRequestPayableNow(price, sessions, 'Installment');
        const payableNow = computeStudentRequestPayableNow(price, sessions, paymentType);
        const selectedLabel = paymentType === 'Full Payment'
            ? 'Full Payment'
            : (paymentType === 'Installment' ? 'Installment (est. per session)' : 'Partial Payment');
        amountEl.innerHTML = `
            <div class="text-xs uppercase tracking-[0.2em] text-gold-700 dark:text-gold-300 font-bold">Payment Summary</div>
            <div class="mt-3 grid grid-cols-2 gap-3">
                <div class="rounded-xl bg-white/80 dark:bg-white/5 border border-zinc-200 dark:border-white/10 px-3 py-3">
                    <div class="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Total</div>
                    <div class="mt-1 text-base font-bold text-zinc-900 dark:text-white">${formatCurrencyPHP(price)}</div>
                </div>
                <div class="rounded-xl bg-white/80 dark:bg-white/5 border border-zinc-200 dark:border-white/10 px-3 py-3">
                    <div class="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Pay Now</div>
                    <div class="mt-1 text-base font-bold text-gold-700 dark:text-gold-300">${formatCurrencyPHP(payableNow)}</div>
                </div>
            </div>
            <div class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Mode: <span class="font-semibold text-zinc-700 dark:text-zinc-200">${escapeHtml(selectedLabel)}</span>
            </div>
        `;
        instrumentsContainer.innerHTML = maxInst > 0
            ? renderStudentRequestInstrumentSelectors(maxInst, instruments)
            : '<div class="text-sm text-zinc-500">Select a package first.</div>';
    };

    packageSelect.onchange = updateRequestPackageUI;
    paymentModeEl.onchange = updateRequestPackageUI;
    updateRequestPackageUI();

    const today = new Date();
    preferredDateEl.min = today.toISOString().split('T')[0];
    const updateAutoDay = () => {
        const day = getDayOfWeekFromDate(preferredDateEl.value || '');
        if (autoDayEl) {
            autoDayEl.textContent = day ? `Selected day: ${day}` : 'Day will appear here after you choose a date.';
        }
    };
    preferredDateEl.addEventListener('change', updateAutoDay);
    preferredDateEl.addEventListener('input', updateAutoDay);
    updateAutoDay();

    const regStatus = String(student.registration_status || 'Pending');
    const profileComplete = isRegistrationProfileComplete(student);

    if (String(student.status || '') !== 'Active') {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-60', 'cursor-not-allowed');
        statusEl.innerHTML += '<div class="text-xs text-yellow-300 mt-2">Your student account is not active yet. Please contact desk/admin.</div>';
    } else if (!profileComplete) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-60', 'cursor-not-allowed');
        statusEl.innerHTML += '<div class="text-xs text-yellow-300 mt-2">Complete your registration details before requesting enrollment.</div>';
    } else if (!['Approved', 'Fee Paid'].includes(regStatus)) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-60', 'cursor-not-allowed');
        statusEl.innerHTML += '<div class="text-xs text-yellow-300 mt-2">Registration payment must be completed before enrollment.</div>';
    } else if (packages.length === 0) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-60', 'cursor-not-allowed');
    } else if (hasPendingRequest) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-60', 'cursor-not-allowed');
        statusEl.innerHTML += '<div class="text-xs text-yellow-300 mt-2">You already have a pending request. Wait for desk/admin decision.</div>';
    }

    form.onsubmit = async (e) => {
        e.preventDefault();
        if (submitBtn.disabled) return;

        const packageId = parseInt(packageSelect.value, 10);
        const preferredDate = preferredDateEl.value || '';
        const preferredDay = getDayOfWeekFromDate(preferredDate);
        const paymentType = String(paymentModeEl.value || '').trim();
        const paymentMethod = String(paymentMethodEl.value || '').trim();
        const instrumentIds = Array.from(document.querySelectorAll('.student-request-instrument'))
            .map(el => parseInt(el.value, 10))
            .filter(v => !Number.isNaN(v) && v > 0);
        const uniqueInstrumentIds = Array.from(new Set(instrumentIds));

        if (!packageId || !preferredDate || !preferredDay || !paymentType || !paymentMethod || uniqueInstrumentIds.length < 1) {
            showMessage('Please complete package, instruments, preferred date, payment mode, and payment method.', 'error');
            return;
        }
        if (!['Full Payment', 'Partial Payment', 'Installment'].includes(paymentType)) {
            showMessage('Invalid payment mode selected.', 'error');
            return;
        }
        const paymentProofFile = paymentProofEl && paymentProofEl.files && paymentProofEl.files[0] ? paymentProofEl.files[0] : null;
        if (paymentMethod !== 'Cash' && !paymentProofFile) {
            showMessage('Upload proof of payment for non-cash enrollment payments.', 'error');
            return;
        }

        const selectedOption = packageSelect.options[packageSelect.selectedIndex];
        const maxInst = Number(selectedOption?.getAttribute('data-max-instruments') || 1);
        if (uniqueInstrumentIds.length > maxInst) {
            showMessage(`You can select up to ${maxInst} instrument(s) for this package.`, 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
        let keepDisabled = false;

        try {
            const requestFormData = new FormData();
            requestFormData.append('action', 'submit-package-request');
            requestFormData.append('student_id', String(Number(student.student_id)));
            requestFormData.append('package_id', String(packageId));
            requestFormData.append('payment_type', paymentType);
            requestFormData.append('payment_method', paymentMethod);
            requestFormData.append('preferred_date', preferredDate);
            requestFormData.append('preferred_day_of_week', preferredDay);
            requestFormData.append('instrument_ids_json', JSON.stringify(uniqueInstrumentIds));
            if (paymentProofFile) {
                requestFormData.append('package_payment_proof_file', paymentProofFile);
            }

            const response = await postStudentPackageRequest(requestFormData);
            if (response.success) {
                showMessage(response.message || 'Request submitted successfully.', 'success');
                const user = Auth.getUser();
                if (user?.email) {
                    const refreshedMeta = await fetchStudentRequestMetaByEmail(user.email);
                    if (refreshedMeta?.success) {
                        keepDisabled = true;
                        initStudentRequestSection(student, refreshedMeta);
                    }
                }
            } else {
                showMessage(response.error || 'Failed to submit request.', 'error');
            }
        } catch (error) {
            showMessage('Network error. Please try again.', 'error');
        } finally {
            if (!keepDisabled) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Request';
            }
        }
    };
}

function renderOnboardingStatusBadge(label, tone = 'zinc') {
    const tones = {
        green: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
        blue: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
        amber: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
        red: 'bg-red-500/15 text-red-400 border border-red-500/25',
        zinc: 'bg-zinc-500/15 text-zinc-300 border border-zinc-500/25'
    };
    const cls = tones[tone] || tones.zinc;
    return `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${cls}">${escapeHtml(label)}</span>`;
}

function renderStudentOnboardingSteps(student, meta, portal) {
    const container = document.getElementById('studentOnboardingSteps');
    if (!container) return;

    const profileComplete = isRegistrationProfileComplete(student);
    const regStatus = String(student?.registration_status || 'Pending');
    const regPaid = ['Approved', 'Fee Paid'].includes(regStatus);
    const latestReq = meta?.latest_request || null;
    const hasPendingReq = latestReq && String(latestReq.status || '') === 'Pending';
    const enrollmentApproved = portal?.current_enrollment && String(portal.current_enrollment.status || '') === 'Active';
    const registrationLocked = !profileComplete || !regPaid;
    const registrationBadge = profileComplete
        ? renderOnboardingStatusBadge('Completed', 'green')
        : renderOnboardingStatusBadge('Required', 'amber');
    const paymentBadge = regPaid
        ? renderOnboardingStatusBadge('Paid', 'green')
        : renderOnboardingStatusBadge('Unpaid', 'amber');
    const enrollmentBadge = enrollmentApproved
        ? renderOnboardingStatusBadge('Approved', 'green')
        : (hasPendingReq ? renderOnboardingStatusBadge('Pending', 'blue') : renderOnboardingStatusBadge('Not Started', 'zinc'));
    const scheduleBadge = enrollmentApproved
        ? renderOnboardingStatusBadge('Available', 'green')
        : renderOnboardingStatusBadge('Coming Soon', 'zinc');

    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-5">
                <div class="flex items-center justify-between gap-2">
                    <div>
                        <div class="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 font-bold">Registration</div>
                        <div class="text-lg font-extrabold mt-2">School Registration</div>
                    </div>
                    ${registrationBadge}
                </div>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-2">Keep your personal details complete in your profile so admin can process your school registration smoothly.</p>
                <div class="mt-4 flex flex-wrap gap-3">
                    <a href="student_profile.html" class="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white/10 text-white text-sm font-semibold">Open Profile</a>
                    <span class="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-white/5 text-xs text-zinc-600 dark:text-zinc-300">Payment: ${paymentBadge}</span>
                </div>
            </div>

            <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-5">
                <div class="flex items-center justify-between gap-2">
                    <div>
                        <div class="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 font-bold">Enrollment</div>
                        <div class="text-lg font-extrabold mt-2">Lesson Package Request</div>
                    </div>
                    ${enrollmentBadge}
                </div>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-2">Choose your package, instruments, and preferred class day below once registration is approved.</p>
                <div class="mt-4 flex flex-wrap gap-3">
                    ${registrationLocked
                        ? `<span class="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-white/5 text-zinc-600 dark:text-zinc-300 text-sm font-bold cursor-not-allowed">Go to Enrollment (Locked)</span>`
                        : `<a href="#studentPackageRequestForm" class="px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-black text-sm font-bold">Go to Enrollment</a>`}
                    <a href="student_sessions.html" class="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-200 text-sm font-semibold">Open Sessions</a>
                </div>
                ${latestReq ? `<div class="mt-4">${renderStudentRequestStatus(latestReq)}</div>` : ''}
            </div>

            <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-5">
                <div class="flex items-center justify-between gap-2">
                    <div>
                        <div class="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 font-bold">Class Access</div>
                        <div class="text-lg font-extrabold mt-2">Schedule & QR</div>
                    </div>
                    ${scheduleBadge}
                </div>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                    ${enrollmentApproved
                        ? 'Your current module is ready. You can now view your class schedule and attendance QR.'
                        : 'Your current module right now is registration and enrollment review. Schedule and QR will appear here once your class setup is ready.'}
                </p>
                ${enrollmentApproved
                    ? `<div class="mt-4 flex flex-wrap gap-3">
                        <a href="student_qr.html" class="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white/10 text-white text-sm font-semibold">Open QR</a>
                        <a href="student_sessions.html" class="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-200 text-sm font-semibold">View Schedule</a>
                    </div>`
                    : `<div class="mt-4 inline-flex items-center px-3 py-2 rounded-xl bg-zinc-100 dark:bg-white/5 text-sm text-zinc-600 dark:text-zinc-300">
                        Current module available: Registration and Enrollment
                    </div>`}
            </div>
        </div>

        ${registrationLocked ? `
            <div id="studentRegistrationBlock" class="mt-6 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 shadow-xl dark:shadow-black/40">
                <div class="flex items-center justify-between gap-4">
                    <div>
                        <div class="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400 font-bold">Registration Form</div>
                        <div class="text-lg font-extrabold mt-2">Complete student + guardian details, then submit payment</div>
                        <div class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">After admin confirms your registration payment, enrollment will unlock.</div>
                    </div>
                    <div class="h-12 w-12 rounded-2xl bg-gold-500/15 border border-gold-500/25 grid place-items-center">
                        <i class="fas fa-clipboard-check text-gold-500"></i>
                    </div>
                </div>

                <div class="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-5">
                    <div class="xl:col-span-12 max-w-4xl mx-auto w-full space-y-5">
                    <!-- Guardian -->
                    <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-5">
                        <div class="text-xs uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400 font-bold mb-4">1. Guardian</div>
                        <div class="space-y-3">
                            <label class="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-200 font-semibold">
                                <input type="radio" id="guardianModeWith" name="guardian_mode" value="With Guardian" class="accent-gold-500">
                                With Guardian (Recommended for minors)
                            </label>
                            <label class="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-200 font-semibold">
                                <input type="radio" id="guardianModeWithout" name="guardian_mode" value="Without Guardian" class="accent-gold-500">
                                Without Guardian
                            </label>
                        </div>

                        <div id="guardianInputs" class="mt-4 space-y-3 hidden">
                            <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200">Guardian Email *</label>
                            <div class="flex gap-2">
                                <input id="guardianEmailInput" type="email" class="flex-1 px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:border-gold-500" placeholder="guardian@email.com">
                                <button type="button" id="guardianFindBtn" class="px-4 py-3 rounded-xl bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 text-sm font-bold text-zinc-700 dark:text-zinc-200 whitespace-nowrap">
                                    Find
                                </button>
                            </div>
                            <div id="guardianInfoBox" class="hidden text-xs text-zinc-500 dark:text-zinc-300"></div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200 mb-2">First Name *</label>
                                    <input id="guardianFirstNameInput" class="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:border-gold-500" />
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200 mb-2">Last Name *</label>
                                    <input id="guardianLastNameInput" class="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:border-gold-500" />
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200 mb-2">Phone *</label>
                                    <input id="guardianPhoneInput" class="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:border-gold-500" />
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200 mb-2">Relationship *</label>
                                    <input id="guardianRelationshipInput" class="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:border-gold-500" placeholder="e.g., Mother, Father, Guardian" />
                                </div>
                            </div>
                        </div>
                        <div class="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                            If you already have a guardian account, use the email above to link it. If no guardian account exists yet, the system will create one using the guardian email with temporary password <span class="font-semibold text-zinc-700 dark:text-zinc-200">fasmusic@2020</span>.
                        </div>
                    </div>

                    <!-- Student details -->
                    <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-5">
                        <div class="text-xs uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400 font-bold mb-4">2. Student Details</div>
                        <form id="registrationDetailsForm" class="space-y-3">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200 mb-2">First Name *</label>
                                    <input id="regFirstName" class="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:border-gold-500" />
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200 mb-2">Last Name *</label>
                                    <input id="regLastName" class="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:border-gold-500" />
                                </div>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200 mb-2">Email *</label>
                                    <input id="regEmail" type="email" readonly class="w-full px-4 py-3 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-600 dark:text-zinc-300 cursor-not-allowed" />
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200 mb-2">Phone *</label>
                                    <input id="regPhone" class="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:border-gold-500" />
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200 mb-2">Date of Birth *</label>
                                    <input id="regDob" type="date" class="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:border-gold-500" />
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200 mb-2">Age</label>
                                    <input id="regAge" readonly class="w-full px-4 py-3 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-600 dark:text-zinc-300 cursor-not-allowed" />
                                </div>
                            </div>

                            <div>
                                <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200 mb-2">Address *</label>
                                <textarea id="regAddress" rows="3" class="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:border-gold-500"></textarea>
                            </div>

                            <div>
                                <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200 mb-2">Branch *</label>
                                <select id="regBranch" class="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:border-gold-500">
                                    <option value="">Choose branch...</option>
                                </select>
                            </div>
                        </form>
                    </div>

                    <!-- Payment -->
                    <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-5">
                        <div class="text-xs uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400 font-bold mb-4">3. Registration Payment</div>
                        <form id="registrationPaymentForm" class="space-y-3">
                            <div class="rounded-xl border border-amber-300/70 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                                <div class="font-bold">Required before enrollment</div>
                                <div class="mt-1">Father &amp; Sons Music requires a <strong>₱1,000 registration fee</strong> before a student can be enrolled.</div>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200 mb-2">Registration Fee</label>
                                <div class="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white font-bold">
                                    ₱1,000.00
                                </div>
                                <div class="text-xs text-amber-700 dark:text-amber-300 mt-2">This amount is fixed. You only need to choose the payment method and upload your proof of payment.</div>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200 mb-2">Payment Method *</label>
                                <select id="regPayMethod" class="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:border-gold-500">
                                    <option value="GCash">GCash</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200 mb-2">Proof of Payment *</label>
                                <input type="file" id="regPayProof" accept=".jpg,.jpeg,.png,.webp,.pdf" class="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-700 dark:text-zinc-200 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gold-500/20 file:text-gold-600 file:font-semibold" />
                                <div class="text-xs text-zinc-500 dark:text-zinc-400 mt-2">Upload JPG/PNG/WEBP/PDF for admin verification.</div>
                            </div>
                            <div id="regPayStatus" class="text-xs text-zinc-500 dark:text-zinc-300"></div>
                        </form>
                    </div>
                    </div>
                </div>

                <div class="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div id="submitRegistrationStatus" class="text-sm text-zinc-500 dark:text-zinc-400"></div>
                    <button type="button" id="submitRegistrationRequestBtn" class="px-6 py-3 rounded-2xl bg-gold-500 hover:bg-gold-400 text-black text-sm font-extrabold transition">
                        Submit Registration Request
                    </button>
                </div>
            </div>
        ` : ''}
    `;
}

function wireStudentOnboardingActions(student, meta, portal) {
    const guardianModeWith = document.getElementById('guardianModeWith');
    const guardianModeWithout = document.getElementById('guardianModeWithout');
    const guardianInputs = document.getElementById('guardianInputs');
    const guardianFirstNameInput = document.getElementById('guardianFirstNameInput');
    const guardianLastNameInput = document.getElementById('guardianLastNameInput');
    const guardianPhoneInput = document.getElementById('guardianPhoneInput');
    const guardianRelationshipInput = document.getElementById('guardianRelationshipInput');
    const guardianEmailInput = document.getElementById('guardianEmailInput');
    const guardianFindBtn = document.getElementById('guardianFindBtn');
    const guardianInfoBox = document.getElementById('guardianInfoBox');
    const regForm = document.getElementById('registrationDetailsForm');
    const regBranch = document.getElementById('regBranch');
    const paymentForm = document.getElementById('registrationPaymentForm');
    const regPayStatus = document.getElementById('regPayStatus');
    const regPayProof = document.getElementById('regPayProof');
    const submitAllBtn = document.getElementById('submitRegistrationRequestBtn');
    const submitAllStatus = document.getElementById('submitRegistrationStatus');

    const hasGuardian = Array.isArray(portal?.guardians) && portal.guardians.length > 0;
    const toggleGuardianInputs = () => {
        const withGuardian = guardianModeWith?.checked;
        if (guardianInputs) guardianInputs.classList.toggle('hidden', !withGuardian);
        if (guardianInfoBox) guardianInfoBox.classList.toggle('hidden', !withGuardian);
        if (!withGuardian) {
            if (guardianEmailInput) guardianEmailInput.value = '';
            if (guardianFirstNameInput) guardianFirstNameInput.value = '';
            if (guardianLastNameInput) guardianLastNameInput.value = '';
            if (guardianPhoneInput) guardianPhoneInput.value = '';
            if (guardianRelationshipInput) guardianRelationshipInput.value = '';
            if (guardianInfoBox) guardianInfoBox.textContent = '';
        }
    };

    if (guardianModeWith && guardianModeWithout) {
        if (hasGuardian) {
            guardianModeWith.checked = true;
        } else {
            guardianModeWithout.checked = true;
        }
        toggleGuardianInputs();
        guardianModeWith.addEventListener('change', toggleGuardianInputs);
        guardianModeWithout.addEventListener('change', toggleGuardianInputs);
    }
    if (guardianEmailInput && portal?.guardians?.[0]?.email) {
        const g = portal.guardians[0];
        guardianEmailInput.value = g.email || '';
        if (guardianFirstNameInput) guardianFirstNameInput.value = g.first_name || '';
        if (guardianLastNameInput) guardianLastNameInput.value = g.last_name || '';
        if (guardianPhoneInput) guardianPhoneInput.value = g.phone || '';
        if (guardianRelationshipInput) guardianRelationshipInput.value = g.relationship_type || '';
    }

    if (guardianFindBtn && guardianEmailInput && guardianInfoBox) {
        guardianFindBtn.onclick = async () => {
            const email = guardianEmailInput.value.trim();
            if (!email) {
                guardianInfoBox.textContent = 'Enter a guardian email to search.';
                return;
            }
            guardianInfoBox.textContent = 'Searching guardian...';
            const res = await fetchGuardianByEmail(email);
            if (res.success && res.guardian) {
                const g = res.guardian;
                guardianInfoBox.innerHTML = `Found: <span class="font-semibold">${escapeHtml(g.first_name || '')} ${escapeHtml(g.last_name || '')}</span> • ${escapeHtml(g.relationship_type || '')} • ${escapeHtml(g.phone || '')}`;
                if (guardianFirstNameInput) guardianFirstNameInput.value = g.first_name || '';
                if (guardianLastNameInput) guardianLastNameInput.value = g.last_name || '';
                if (guardianPhoneInput) guardianPhoneInput.value = g.phone || '';
                if (guardianRelationshipInput) guardianRelationshipInput.value = g.relationship_type || '';
            } else {
                guardianInfoBox.textContent = res.error || 'Guardian not found.';
            }
        };
    }

    if (regBranch) {
        populateBranchSelect(regBranch, student?.branch_id || '');
    }

    // Prefill registration fields from current student record
    const regFirstName = document.getElementById('regFirstName');
    const regLastName = document.getElementById('regLastName');
    const regEmail = document.getElementById('regEmail');
    const regPhone = document.getElementById('regPhone');
    const regDob = document.getElementById('regDob');
    const regAddress = document.getElementById('regAddress');
    if (regFirstName && !regFirstName.value) regFirstName.value = student?.first_name || '';
    if (regLastName && !regLastName.value) regLastName.value = student?.last_name || '';
    if (regEmail && !regEmail.value) regEmail.value = student?.email || '';
    if (regPhone && !regPhone.value) regPhone.value = student?.phone || '';
    if (regDob && !regDob.value) regDob.value = student?.date_of_birth || '';
    if (regAddress && !regAddress.value) regAddress.value = student?.address || '';

    if (regForm) {
        regForm.onsubmit = (e) => e.preventDefault();
    }

    const regAge = document.getElementById('regAge');
    if (regDob && regAge) {
        const updateAge = () => {
            const age = computeAgeFromDob(regDob.value || '');
            regAge.value = age === null ? '' : String(age);
        };
        regDob.addEventListener('change', updateAge);
        regDob.addEventListener('input', updateAge);
        updateAge();
    }

    if (paymentForm) {
        paymentForm.onsubmit = (e) => e.preventDefault();
    }

    if (submitAllBtn) {
        submitAllBtn.onclick = async () => {
            const mode = guardianModeWith?.checked ? 'With Guardian' : (guardianModeWithout?.checked ? 'Without Guardian' : '');
            if (!mode) {
                showMessage('Please choose a guardian option.', 'error');
                return;
            }

            if (mode === 'With Guardian') {
                if (!guardianEmailInput?.value?.trim()) {
                    showMessage('Guardian email is required.', 'error');
                    return;
                }
                if (!guardianFirstNameInput?.value?.trim() || !guardianLastNameInput?.value?.trim() || !guardianPhoneInput?.value?.trim() || !guardianRelationshipInput?.value?.trim()) {
                    showMessage('Guardian name, phone, and relationship are required.', 'error');
                    return;
                }
            }

            const payload = {
                action: 'update-student',
                student_id: Number(student.student_id),
                first_name: document.getElementById('regFirstName')?.value?.trim() || '',
                last_name: document.getElementById('regLastName')?.value?.trim() || '',
                email: document.getElementById('regEmail')?.value?.trim() || '',
                phone: document.getElementById('regPhone')?.value?.trim() || '',
                address: document.getElementById('regAddress')?.value?.trim() || '',
                date_of_birth: document.getElementById('regDob')?.value || null,
                branch_id: Number(document.getElementById('regBranch')?.value || 0)
            };
            payload.age = computeAgeFromDob(payload.date_of_birth);

            const amount = 1000;
            const method = document.getElementById('regPayMethod')?.value || 'Other';
            const proofFile = regPayProof?.files && regPayProof.files[0] ? regPayProof.files[0] : null;

            if (!isRegistrationProfileComplete(payload)) {
                showMessage('Please complete all required registration details.', 'error');
                return;
            }
            if (!proofFile) {
                showMessage('Upload proof of payment for admin approval.', 'error');
                return;
            }

            submitAllBtn.disabled = true;
            submitAllBtn.textContent = 'Submitting...';
            if (submitAllStatus) submitAllStatus.textContent = 'Submitting registration request...';
            if (regPayStatus) regPayStatus.textContent = '';

            try {
                const details = {
                    first_name: guardianFirstNameInput?.value?.trim() || '',
                    last_name: guardianLastNameInput?.value?.trim() || '',
                    phone: guardianPhoneInput?.value?.trim() || '',
                    relationship: guardianRelationshipInput?.value?.trim() || ''
                };

                const resGuardian = await setGuardianMode(student.student_id, mode, guardianEmailInput?.value?.trim() || '', details);
                if (!resGuardian?.success) {
                    throw new Error(resGuardian?.error || 'Failed to save guardian details.');
                }

                const resReg = await axios.post(`${baseApiUrl}/students.php`, payload);
                if (!(resReg.data && resReg.data.success)) {
                    throw new Error(resReg.data?.error || 'Failed to save registration details.');
                }

                const formData = new FormData();
                formData.append('student_id', String(Number(student.student_id)));
                formData.append('amount', String(amount));
                formData.append('payment_method', String(method));
                formData.append('registration_proof_file', proofFile);

                const resPay = await axios.post(`${baseApiUrl}/users.php?action=pay-registration-fee`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (!(resPay.data && resPay.data.success)) {
                    throw new Error(resPay.data?.error || 'Payment submission failed.');
                }

                const msg = resPay.data?.message || 'Registration request submitted.';
                if (submitAllStatus) submitAllStatus.textContent = msg;
                showMessage(msg, 'success');
                initStudentDashboardPage();
            } catch (err) {
                const msg = err?.message || 'Failed to submit registration request.';
                if (submitAllStatus) submitAllStatus.textContent = msg;
                showMessage(msg, 'error');
            } finally {
                submitAllBtn.disabled = false;
                submitAllBtn.textContent = 'Submit Registration Request';
            }
        };
    }
}

async function initStudentDashboardPage() {
    if (!checkStudentAuth()) return;
    const user = Auth.getUser();
    if (!user?.email) {
        showMessage('Your account email is missing. Please contact admin.', 'error');
        return;
    }

    setText('studentNavName', user.username || user.email || 'Student');
    setText('studentMobileMenuName', user.username || user.email || 'Signed in');

    const portal = await fetchStudentPortalDataByEmail(user.email);
    if (!portal.success) {
        showMessage(portal.error || 'Failed to load your profile.', 'error');
        return;
    }

    const s = portal.student;
    setText('studentName', `${s.first_name || ''} ${s.last_name || ''}`.trim());
    setText('studentBranch', s.branch_name || '—');
    setHtml('studentStatusBadge', `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${badgeClassForRegistrationStatus(s.registration_status)}">${escapeHtml(s.registration_status || '—')}</span>`);

    const profileComplete = isRegistrationProfileComplete(s);
    const regPaid = ['Approved', 'Fee Paid'].includes(String(s.registration_status || 'Pending'));
    const isNewStudent = !profileComplete || !regPaid;
    const enrollmentApproved = portal.current_enrollment && String(portal.current_enrollment.status || '') === 'Active';
    const isEnrolledStudent = Boolean(enrollmentApproved);
    const overviewGrid = document.getElementById('studentOverviewGrid');
    const overviewCard = document.getElementById('studentEnrollmentOverviewCard');
    const requestShortcutCard = document.getElementById('studentRequestShortcutCard');
    const requestFormCard = document.getElementById('studentRequestFormCard');
    if (overviewGrid) {
        overviewGrid.classList.toggle('hidden', isNewStudent);
    }
    const welcomeNote = document.getElementById('studentWelcomeNote');
    if (welcomeNote) {
        if (isEnrolledStudent) {
            welcomeNote.textContent = 'View your upcoming class, open your QR code, and keep your profile updated.';
        } else if (isNewStudent) {
            welcomeNote.textContent = 'Check your registration status here, then continue to enrollment once admin approval is complete.';
        } else {
            welcomeNote.textContent = 'Quick view of your account and QR. For full details, open Sessions or Profile.';
        }
    }
    if (overviewCard) overviewCard.classList.toggle('hidden', isEnrolledStudent);
    if (requestShortcutCard) requestShortcutCard.classList.toggle('hidden', isEnrolledStudent);
    if (requestFormCard) requestFormCard.style.display = isEnrolledStudent ? 'none' : '';

    // Package
    setText('packageName', s.package_name || 'Not assigned yet');
    setText('packageSessions', s.package_sessions ? `${s.package_sessions} sessions` : '—');
    setText('packageMaxInstruments', s.package_max_instruments ? `${s.package_max_instruments} instrument(s)` : '—');

    const upcomingDate = formatDateLong(portal.current_enrollment?.first_session_date || portal.current_enrollment?.start_date || '');
    const upcomingStart = portal.current_enrollment?.first_start_time ? formatTime12Hour(portal.current_enrollment.first_start_time) : '';
    const upcomingEnd = portal.current_enrollment?.first_end_time ? formatTime12Hour(portal.current_enrollment.first_end_time) : '';
    const upcomingTime = upcomingStart && upcomingEnd ? `${upcomingStart} - ${upcomingEnd}` : 'To be announced';
    const upcomingRoom = portal.current_enrollment?.first_room || 'To be announced';
    const upcomingTeacher = `${portal.current_enrollment?.teacher_first_name || ''} ${portal.current_enrollment?.teacher_last_name || ''}`.trim() || 'Not assigned yet';
    setText('studentUpcomingDate', upcomingDate || (isEnrolledStudent ? 'Schedule confirmed soon' : 'Waiting for schedule'));
    setText('studentUpcomingTime', upcomingTime);
    setText('studentUpcomingRoom', upcomingRoom);
    setText('studentUpcomingTeacher', upcomingTeacher);
    setText('studentUpcomingNote', isEnrolledStudent
        ? 'This is the next schedule attached to your active enrollment.'
        : 'Your next approved class will appear here.');

    // Enrollment focus cards
    setHtml('currentEnrollmentSummary', renderCurrentEnrollmentSummary(portal.current_enrollment || null, portal.student || {}, portal.instruments || []));
    setHtml('enrollmentHistoryList', renderEnrollmentHistoryList(portal.enrollment_history || []));

    // Attendance summary (optional)
    const summaryRes = await fetchAttendanceSummary(s.student_id);
    if (summaryRes.success) {
        const attended = Number(summaryRes.summary?.present_count ?? 0) + Number(summaryRes.summary?.late_count ?? 0);
        setText('sessionsAttended', String(attended));
        const total = Number(s.package_sessions || 0);
        const remaining = total > 0 ? Math.max(0, total - attended) : 0;
        setText('sessionsRemaining', total > 0 ? String(remaining) : '—');
        setText('lastAttended', summaryRes.summary?.last_attended_at ? new Date(summaryRes.summary.last_attended_at).toLocaleString() : '—');
    } else {
        setText('sessionsAttended', '0');
        setText('sessionsRemaining', '—');
        setText('lastAttended', '—');
    }

    let meta = null;
    try {
        const resMeta = await fetchStudentRequestMetaByEmail(user.email);
        if (resMeta?.success) {
            meta = resMeta;
            if (!isEnrolledStudent) {
                initStudentRequestSection(s, meta);
            }
        }
    } catch (e) {
        setHtml('studentAvailabilityCalendar', '<div class="text-zinc-500">Unable to load teacher availability right now.</div>');
    }

    if (!isEnrolledStudent) {
        renderStudentOnboardingSteps(s, meta, portal);
        wireStudentOnboardingActions(s, meta, portal);
    } else {
        setHtml('studentOnboardingSteps', '');
    }

    const qrCard = document.getElementById('studentQrCard');
    if (!enrollmentApproved) {
        if (qrCard) qrCard.classList.add('opacity-70');
        setHtml('qrCodeBox', '<div class="text-sm text-zinc-500 text-center">QR locked until admin approves your enrollment.</div>');
        setText('qrPayloadText', 'Locked — approval required');
    } else {
        // QR code
        const payload = buildStudentQrPayload(s);
        setText('qrPayloadText', payload);
        renderQrCode('qrCodeBox', payload);
    }
}

async function initStudentQrPage() {
    if (!checkStudentAuth()) return;
    const user = Auth.getUser();
    setText('studentNavName', user.username || user.email || 'Student');

    const portal = await fetchStudentPortalDataByEmail(user.email);
    if (!portal.success) {
        showMessage(portal.error || 'Failed to load your QR code.', 'error');
        return;
    }
    const s = portal.student;
    setText('studentName', `${s.first_name || ''} ${s.last_name || ''}`.trim());
    setText('studentEmail', s.email || '—');

    const enrollmentApproved = portal.current_enrollment && String(portal.current_enrollment.status || '') === 'Active';
    if (!enrollmentApproved) {
        renderStudentQrStatus({ code: 'no_session', message: 'QR locked until admin approves your enrollment.' });
        setHtml('qrCodeBox', '<div class="text-sm text-zinc-400 text-center">QR locked until admin approves your enrollment.</div>');
        setText('qrPayloadText', 'Locked — approval required');
        return;
    }

    try {
        const qrStatusRes = await fetchStudentQrStatus(Number(s.student_id || 0), s.email || '');
        const qrStatus = qrStatusRes?.qr_status || { code: 'no_session', message: 'You do not have a session today.' };
        renderStudentQrStatus(qrStatus);

        if (qrStatus.code === 'valid_today') {
            const payload = buildStudentQrPayload(s);
            setText('qrPayloadText', payload);
            renderQrCode('qrCodeBox', payload);
        } else {
            setText('qrPayloadText', qrStatus.message || 'QR unavailable');
            setHtml('qrCodeBox', `<div class="text-sm text-zinc-300 text-center">${escapeHtml(qrStatus.message || 'QR unavailable for today.')}</div>`);
        }
    } catch (error) {
        renderStudentQrStatus({ code: 'no_session', message: 'Unable to verify your QR status right now.' });
        setText('qrPayloadText', 'QR status unavailable');
        setHtml('qrCodeBox', '<div class="text-sm text-zinc-300 text-center">Unable to verify your QR status right now.</div>');
    }

    if (!window.__studentQrRefreshTimer) {
        window.__studentQrRefreshTimer = window.setInterval(() => {
            if (document.visibilityState === 'visible') initStudentQrPage();
        }, 60000);
    }
}

async function initStudentSessionsPage() {
    if (!checkStudentAuth()) return;
    const user = Auth.getUser();
    setText('studentNavName', user.username || user.email || 'Student');

    const portal = await fetchStudentPortalDataByEmail(user.email);
    if (!portal.success) {
        showMessage(portal.error || 'Failed to load sessions.', 'error');
        return;
    }
    const s = portal.student;
    setText('packageName', s.package_name || 'Not assigned yet');
    setText('packageSessions', s.package_sessions ? `${s.package_sessions} sessions included` : '—');

    const enrollmentApproved = portal.current_enrollment && String(portal.current_enrollment.status || '') === 'Active';
    let summaryRes = null;
    if (!enrollmentApproved) {
        setHtml('attendanceTableBody', `
            <tr>
                <td colspan="4" class="px-6 py-10 text-center text-zinc-400">
                    <i class="fas fa-lock text-2xl mb-2"></i>
                    <div class="font-semibold">Attendance is locked</div>
                    <div class="text-xs text-zinc-500 mt-1">Your sessions will appear here after admin approves your enrollment.</div>
                </td>
            </tr>
        `);
    } else {
        const listRes = await fetchAttendanceList(s.student_id, 100);
        if (!listRes.success) {
            setHtml('attendanceTableBody', `
                <tr>
                    <td colspan="4" class="px-6 py-8 text-center text-zinc-400">Failed to load attendance records.</td>
                </tr>
            `);
        } else {
            const rows = Array.isArray(listRes.attendance) ? listRes.attendance : [];
            if (rows.length === 0) {
                setHtml('attendanceTableBody', `
                    <tr>
                        <td colspan="4" class="px-6 py-10 text-center text-zinc-400">
                            <i class="fas fa-calendar-minus text-2xl mb-2"></i>
                            <div class="font-semibold">No attendance records yet</div>
                            <div class="text-xs text-zinc-500 mt-1">Your sessions will appear here once admin enrolls you and attendance is recorded.</div>
                        </td>
                    </tr>
                `);
            } else {
                setHtml('attendanceTableBody', rows.map(r => {
                    const dt = r.attended_at ? new Date(r.attended_at).toLocaleString() : '—';
                    const status = escapeHtml(r.status || 'Present');
                    const source = escapeHtml(r.source || '—');
                    const notes = escapeHtml(r.notes || '');
                    return `
                        <tr class="border-t border-white/10 hover:bg-white/5 transition">
                            <td class="px-6 py-4 text-sm text-white">${dt}</td>
                            <td class="px-6 py-4 text-sm text-zinc-200">${status}</td>
                            <td class="px-6 py-4 text-sm text-zinc-300">${source}</td>
                            <td class="px-6 py-4 text-sm text-zinc-400">${notes}</td>
                        </tr>
                    `;
                }).join(''));
            }
        }
    }

    // Next session action
    try {
        const meta = await fetchStudentRequestMetaByEmail(user.email);
        if (enrollmentApproved) {
            summaryRes = await fetchAttendanceSummary(s.student_id);
        }
        initStudentAdditionalSessionAction(s, portal, meta?.success ? meta : null, summaryRes?.success ? summaryRes : null);
    } catch (e) {
        const statusEl = document.getElementById('studentAdditionalSessionStatus');
        if (statusEl) statusEl.textContent = 'Unable to check session eligibility right now.';
    }
}

function renderAttendanceStatusBadge(status) {
    const value = String(status || '—');
    const cls = value === 'Present'
        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
        : value === 'Late'
            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
            : value === 'Absent'
                ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                : 'bg-zinc-500/15 text-zinc-300 border border-zinc-500/25';
    return `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${cls}">${escapeHtml(value)}</span>`;
}

async function initStudentAttendancePage() {
    if (!checkStudentAuth()) return;
    const user = Auth.getUser();
    setText('studentNavName', user.username || user.email || 'Student');
    setText('studentMobileMenuName', user.username || user.email || 'Signed in');

    const portal = await fetchStudentPortalDataByEmail(user.email);
    if (!portal.success) {
        showMessage(portal.error || 'Failed to load attendance.', 'error');
        return;
    }

    const s = portal.student || {};
    const enrollmentApproved = portal.current_enrollment && String(portal.current_enrollment.status || '') === 'Active';
    const totalSessions = Number(portal.current_enrollment?.package_sessions || s.package_sessions || 0);

    if (!enrollmentApproved) {
        setText('attendanceCompletedCount', '0');
        setText('attendanceRemainingCount', totalSessions > 0 ? String(totalSessions) : '—');
        setText('attendancePackageTotal', totalSessions > 0 ? String(totalSessions) : '—');
        setText('attendanceLastDate', 'Locked until enrollment approval');
        setHtml('studentAttendanceTableBody', `
            <tr>
                <td colspan="5" class="px-6 py-10 text-center text-zinc-400">
                    <i class="fas fa-lock text-2xl mb-2"></i>
                    <div class="font-semibold">Attendance is locked</div>
                    <div class="text-xs text-zinc-500 mt-1">Your attendance records will appear here after admin approves your enrollment.</div>
                </td>
            </tr>
        `);
        return;
    }

    const [summaryRes, listRes] = await Promise.all([
        fetchAttendanceSummary(s.student_id),
        fetchAttendanceList(s.student_id, 200)
    ]);

    const completedCount = Number(summaryRes?.summary?.present_count || 0) + Number(summaryRes?.summary?.late_count || 0);
    const remainingCount = totalSessions > 0 ? Math.max(0, totalSessions - completedCount) : 0;
    const lastAttendedAt = summaryRes?.summary?.last_attended_at
        ? new Date(summaryRes.summary.last_attended_at).toLocaleString()
        : '—';

    setText('attendanceCompletedCount', String(completedCount));
    setText('attendanceRemainingCount', totalSessions > 0 ? String(remainingCount) : '—');
    setText('attendancePackageTotal', totalSessions > 0 ? String(totalSessions) : '—');
    setText('attendanceLastDate', lastAttendedAt);

    if (!listRes.success) {
        setHtml('studentAttendanceTableBody', `
            <tr>
                <td colspan="5" class="px-6 py-10 text-center text-zinc-400">Failed to load attendance records.</td>
            </tr>
        `);
        return;
    }

    const rows = Array.isArray(listRes.attendance) ? listRes.attendance : [];
    if (rows.length === 0) {
        setHtml('studentAttendanceTableBody', `
            <tr>
                <td colspan="5" class="px-6 py-10 text-center text-zinc-400">
                    <i class="fas fa-calendar-minus text-2xl mb-2"></i>
                    <div class="font-semibold">No attendance records yet</div>
                    <div class="text-xs text-zinc-500 mt-1">Your attendance history will appear here once sessions are recorded.</div>
                </td>
            </tr>
        `);
        return;
    }

    setHtml('studentAttendanceTableBody', rows.map(r => {
        const dateLabel = r.session_date ? formatDateLong(r.session_date) : (r.attended_at ? new Date(r.attended_at).toLocaleDateString() : '—');
        const start = r.start_time ? formatTime12Hour(r.start_time) : '';
        const end = r.end_time ? formatTime12Hour(r.end_time) : '';
        const timeLabel = start && end ? `${start} - ${end}` : (start || (r.attended_at ? new Date(r.attended_at).toLocaleTimeString() : '—'));
        const roomLabel = r.room_name || '—';
        const notes = escapeHtml(r.notes || '—');
        return `
            <tr class="border-t border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5 transition">
                <td class="px-6 py-4 text-sm text-zinc-900 dark:text-white">${escapeHtml(dateLabel)}</td>
                <td class="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-200">${escapeHtml(timeLabel)}</td>
                <td class="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-200">${escapeHtml(roomLabel)}</td>
                <td class="px-6 py-4 text-sm">${renderAttendanceStatusBadge(r.status)}</td>
                <td class="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">${notes}</td>
            </tr>
        `;
    }).join(''));
}

async function initStudentProfilePage() {
    if (!checkStudentAuth()) return;
    const user = Auth.getUser();
    setText('studentNavName', user.username || user.email || 'Student');
    setText('studentMobileMenuName', user.username || user.email || 'Signed in');

    const portal = await fetchStudentPortalDataByEmail(user.email);
    if (!portal.success) {
        showMessage(portal.error || 'Failed to load profile.', 'error');
        return;
    }

    const s = portal.student;
    setText('profileStudentName', `${s.first_name || ''} ${s.last_name || ''}`.trim());
    setText('profileBranch', s.branch_name || '—');
    setHtml('profileStatusBadge', `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${badgeClassForRegistrationStatus(s.registration_status)}">${escapeHtml(s.registration_status || '—')}</span>`);

    const enrollment = portal.current_enrollment || null;
    const enrollmentStatus = enrollment?.status || '';
    const teacherName = `${enrollment?.teacher_first_name || ''} ${enrollment?.teacher_last_name || ''}`.trim() || 'Teacher not assigned yet';
    const sessionDate = formatDateLong(enrollment?.first_session_date || enrollment?.start_date || '');
    const sessionStart = enrollment?.first_start_time ? formatTime12Hour(enrollment.first_start_time) : '';
    const sessionEnd = enrollment?.first_end_time ? formatTime12Hour(enrollment.first_end_time) : '';
    const sessionTime = sessionStart && sessionEnd ? `${sessionStart} - ${sessionEnd}` : '';
    const roomName = enrollment?.first_room || 'Room to be announced';
    const isActiveEnrollment = enrollmentStatus === 'Active';
    const isPendingEnrollment = enrollmentStatus === 'Pending';

    let quickSummary = 'Keep your phone number and address updated for school records.';
    if (isActiveEnrollment) {
        quickSummary = `You are currently enrolled in ${enrollment.package_name || 'your package'}. Check your schedule below for the next class details.`;
    } else if (isPendingEnrollment) {
        quickSummary = `Your ${enrollment.package_name || 'package'} enrollment is pending approval. Schedule details will appear here once finalized.`;
    } else if (s.registration_status === 'Approved') {
        quickSummary = 'Your registration is approved. You can open Sessions when you are ready to request or review enrollment.';
    }
    setText('profileQuickSummary', quickSummary);

    if (isActiveEnrollment && (sessionDate || sessionTime)) {
        setText('profileScheduleTitle', sessionDate || 'Schedule confirmed');
        setText('profileScheduleMeta', `${teacherName} • ${sessionTime || 'Time to be announced'} • ${roomName}`);
    } else if (isPendingEnrollment) {
        setText('profileScheduleTitle', 'Schedule being finalized');
        setText('profileScheduleMeta', 'Admin is still confirming your teacher, date, and room.');
    } else {
        setText('profileScheduleTitle', 'No approved class schedule yet');
        setText('profileScheduleMeta', 'Your next approved class will appear here once enrollment is active.');
    }

    setText('profileEnrollmentTitle', enrollment?.package_name || 'No active package yet');
    setHtml('profileEnrollmentMeta', renderStudentProfileEnrollmentMeta(enrollment, portal.instruments || [], s.branch_name || '—'));

    const enrollmentHint = document.getElementById('profileEnrollmentHint');
    if (enrollmentHint) {
        if (isActiveEnrollment) {
            enrollmentHint.textContent = 'You are already enrolled. This page is mainly for viewing your details and making simple profile updates.';
        } else if (isPendingEnrollment) {
            enrollmentHint.textContent = 'Your enrollment is pending. Watch the schedule section above for the approved class details.';
        } else {
            enrollmentHint.textContent = 'Your approved enrollment details will appear here once admin finalizes them.';
        }
    }

    const form = document.getElementById('profileForm');
    if (!form) return;

    // Fill fields
    form.student_id.value = s.student_id || '';
    form.first_name.value = s.first_name || '';
    form.last_name.value = s.last_name || '';
    form.middle_name.value = s.middle_name || '';
    form.email.value = s.email || '';
    form.phone.value = s.phone || '';
    form.address.value = s.address || '';
    form.grade_year.value = s.grade_year || '';
    form.branch_id.value = s.branch_id || '';

    // Primary guardian (read-only display)
    const g = portal.primary_guardian;
    if (g) {
        setText('guardianName', `${g.first_name || ''} ${g.last_name || ''}`.trim());
        setText('guardianPhone', g.phone || '—');
        setText('guardianRelationship', g.relationship_type || '—');
    } else {
        setText('guardianName', '—');
        setText('guardianPhone', '—');
        setText('guardianRelationship', '—');
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            action: 'update-student',
            student_id: parseInt(form.student_id.value, 10),
            first_name: form.first_name.value.trim(),
            last_name: form.last_name.value.trim(),
            middle_name: form.middle_name.value.trim(),
            email: form.email.value.trim(),
            phone: form.phone.value.trim(),
            address: form.address.value.trim(),
            grade_year: form.grade_year.value.trim(),
            branch_id: parseInt(form.branch_id.value, 10)
        };

        try {
            const res = await axios.post(`${baseApiUrl}/students.php`, payload);
            const data = res.data;
            if (data.success) {
                showMessage('Profile updated successfully.', 'success');
            } else {
                showMessage(data.error || 'Failed to update profile.', 'error');
            }
        } catch (err) {
            console.error('Profile update error:', err);
            showMessage('Network error. Please try again.', 'error');
        }
    });
}

// Logout
function logout() {
    Auth.logout();
}

// Load branches for walk-in admin form
async function loadWalkinBranches() {
    const branchSelect = document.getElementById('walkin_branch_id');
    if (!branchSelect) return;

    try {
        const response = await axios.get(`${baseApiUrl}/branch.php?action=get-branches`);
        const data = response.data;

        if (data.success && data.branches) {
            branchSelect.innerHTML = '<option value=\"\">Select Branch</option>';
            data.branches.forEach(branch => {
                const option = document.createElement('option');
                option.value = branch.branch_id;
                option.textContent = branch.branch_name;
                branchSelect.appendChild(option);
            });
        } else {
            branchSelect.innerHTML = '<option value=\"\">No branches available</option>';
        }
    } catch (error) {
        console.error('Error loading branches for walk-in:', error);
        branchSelect.innerHTML = '<option value=\"\">Error loading branches</option>';
    }
}

// ===== Walk-in (Admin) registration – rich form mirroring public registration =====

let walkinSessionPackages = [];
let walkinAvailableInstruments = [];

// Load session packages into admin walk-in form
async function loadWalkinSessionPackages() {
    const select = document.getElementById('walkin_sessionPackage');
    if (!select) return;

    try {
        const response = await axios.get(`${baseApiUrl}/sessions.php?action=get-packages`);
        const data = response.data;

        if (data.success && data.packages) {
            walkinSessionPackages = data.packages;
            select.innerHTML = '<option value="">Select Package</option>';
            data.packages.forEach(pkg => {
                const option = document.createElement('option');
                option.value = pkg.package_id;
                option.textContent = `${pkg.package_name} (${pkg.sessions} sessions, ${pkg.max_instruments} instrument${pkg.max_instruments > 1 ? 's' : ''})`;
                option.setAttribute('data-sessions', pkg.sessions);
                option.setAttribute('data-max-instruments', pkg.max_instruments);
                option.setAttribute('data-price', (pkg.price != null && !isNaN(pkg.price)) ? String(pkg.price) : '0');
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load walk-in session packages:', error);
        // Fallback to same defaults as public registration
        walkinSessionPackages = [
            { package_id: 1, sessions: 12, max_instruments: 1, price: 7450 },
            { package_id: 2, sessions: 20, max_instruments: 2, price: 11800 }
        ];
        select.innerHTML = `
            <option value="">Select Package</option>
            <option value="1" data-sessions="12" data-max-instruments="1" data-price="7450">Basic (12 Sessions, 1 instrument)</option>
            <option value="2" data-sessions="20" data-max-instruments="2" data-price="11800">Standard (20 Sessions, 2 instruments)</option>
        `;
    }
}

// Load instruments for walk-in registration (per-branch)
async function loadWalkinInstruments(branchId) {
    const container = document.getElementById('walkin_instrumentsContainer');
    if (!branchId) {
        if (container) {
            container.textContent = 'Select a branch and session package first';
        }
        walkinAvailableInstruments = [];
        return;
    }

    try {
        const response = await axios.get(`${baseApiUrl}/instruments.php?action=get-instruments&branch_id=${branchId}`);
        const data = response.data;

        if (data.success && data.instruments) {
            walkinAvailableInstruments = data.instruments;
            updateWalkinInstrumentSelection();
        } else if (container) {
            container.innerHTML = '<p class="text-sm text-red-400">No instruments available for this branch</p>';
        }
    } catch (error) {
        console.error('Failed to load walk-in instruments:', error);
        if (container) {
            container.innerHTML = '<p class="text-sm text-red-400">Failed to load instruments</p>';
        }
    }
}

// Helpers for walk-in instrument UI
function walkinGetAvailableTypes() {
    const seen = new Set();
    const types = [];
    walkinAvailableInstruments.forEach(inst => {
        const id = inst.type_id;
        const name = inst.type_name || 'Other';
        if (id != null && !seen.has(id)) {
            seen.add(id);
            types.push({ type_id: id, type_name: name });
        }
    });
    return types.sort((a, b) => (a.type_name || '').localeCompare(b.type_name || ''));
}

function walkinGetInstrumentsByType(typeId) {
    if (!typeId) return [];
    return walkinAvailableInstruments.filter(inst => inst.type_id == typeId);
}

// Build instrument selectors for walk-in form
function updateWalkinInstrumentSelection() {
    const container = document.getElementById('walkin_instrumentsContainer');
    if (!container) return;

    const sessionPackageSelect = document.getElementById('walkinSessionPackageId');
    if (!sessionPackageSelect || !sessionPackageSelect.value) {
        container.textContent = 'Select a branch and session package first';
        return;
    }

    if (walkinAvailableInstruments.length === 0) {
        container.textContent = 'Select a branch to see available instruments';
        return;
    }

    const selectedOption = sessionPackageSelect.options[sessionPackageSelect.selectedIndex];
    const maxInstruments = parseInt(selectedOption.getAttribute('data-max-instruments') || '1', 10);

    const types = walkinGetAvailableTypes();
    const typeOptionsHtml = types.map(t =>
        `<option value="${t.type_id}">${escapeHtml(t.type_name)}</option>`
    ).join('');

    let html = '';
    for (let i = 1; i <= maxInstruments; i++) {
        const slotLabel = maxInstruments === 1 ? 'Instrument' : `Instrument ${i}`;
        html += `
            <div class="p-3 bg-zinc-900/60 rounded-lg border border-zinc-700 space-y-2">
                <label class="block text-sm font-medium text-zinc-200">${slotLabel} *</label>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs text-zinc-400 mb-1">Type</label>
                        <select class="walkin-instrument-type-select w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-gold-400" data-slot="${i}" onchange="onWalkinInstrumentTypeChange(${i})">
                            <option value="">Select type...</option>
                            ${typeOptionsHtml}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs text-zinc-400 mb-1">Instrument</label>
                        <select name="instruments[]" class="walkin-instrument-select w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-gold-400" data-slot="${i}" onchange="onWalkinInstrumentDropdownChange()">
                            <option value="">Select instrument...</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// Global handlers for instrument dropdowns (used in HTML onchange attributes)
function onWalkinInstrumentTypeChange(slot) {
    const typeSelect = document.querySelector(`select.walkin-instrument-type-select[data-slot="${slot}"]`);
    const instrumentSelect = document.querySelector(`select.walkin-instrument-select[data-slot="${slot}"]`);
    if (!typeSelect || !instrumentSelect) return;

    const typeId = typeSelect.value;
    instrumentSelect.innerHTML = '<option value="">Select instrument...</option>';
    instrumentSelect.value = '';

    if (typeId) {
        const instruments = walkinGetInstrumentsByType(typeId);
        instruments.forEach(inst => {
            const opt = document.createElement('option');
            opt.value = inst.instrument_id;
            opt.textContent = inst.instrument_name || 'Instrument';
            instrumentSelect.appendChild(opt);
        });
    }
    onWalkinInstrumentDropdownChange();
}

function onWalkinInstrumentDropdownChange() {
    const selects = document.querySelectorAll('select.walkin-instrument-select');
    const used = new Set();
    selects.forEach(select => {
        const val = select.value;
        if (val) used.add(val);
    });
    selects.forEach(select => {
        const currentVal = select.value;
        Array.from(select.options).forEach(opt => {
            if (opt.value === '') return;
            const othersUsed = used.has(opt.value) && opt.value !== currentVal;
            opt.disabled = othersUsed;
        });
    });
    calculateWalkinTotalFee();
}

// Calculate total fee for walk-in admin registration (mirrors public logic)
function calculateWalkinTotalFee() {
    const registrationFee = 1000;
    const sessionPackageSelect = document.getElementById('walkinSessionPackageId');
    const paymentTypeSelect = document.getElementById('walkin_paymentType');

    const sessionFeeEl = document.getElementById('walkin_sessionFeeDisplay');
    const totalEl = document.getElementById('walkin_totalAmountDisplay');
    const feeInput = document.getElementById('walkin_registration_fee_amount');

    if (!sessionPackageSelect || !sessionPackageSelect.value || !paymentTypeSelect || !paymentTypeSelect.value) {
        if (sessionFeeEl) sessionFeeEl.textContent = '₱0.00';
        if (totalEl) totalEl.textContent = `₱${registrationFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (feeInput) feeInput.value = registrationFee;
        return registrationFee;
    }

    const selectedOption = sessionPackageSelect.options[sessionPackageSelect.selectedIndex];
    const sessions = parseInt(selectedOption.getAttribute('data-sessions') || '0', 10);
    const paymentType = paymentTypeSelect.value;
    const basePrice = parseFloat(selectedOption.getAttribute('data-price') || '0');

    // Check if saxophone selected
    const selectedInstruments = Array.from(document.querySelectorAll('#walkin_instrumentsContainer select[name="instruments[]"]'))
        .map(sel => sel.value ? parseInt(sel.value, 10) : 0)
        .filter(id => id > 0);
    const hasSaxophone = selectedInstruments.some(id => {
        const instrument = walkinAvailableInstruments.find(inst => inst.instrument_id === id);
        return instrument && (instrument.instrument_name.toLowerCase().includes('saxophone') ||
                             instrument.type_name?.toLowerCase().includes('saxophone'));
    });

    let sessionFee = 0;
    if (basePrice > 0) {
        if (paymentType === 'Partial Payment') {
            const downpaymentRatio = sessions === 12 ? (3000 / 7450) : (sessions === 20 ? (5000 / 11800) : 0.42);
            sessionFee = Math.round(basePrice * downpaymentRatio);
        } else if (paymentType === 'Full Payment') {
            if (hasSaxophone) {
                const saxophoneMultiplier = sessions === 12 ? (8100 / 7450) : (sessions === 20 ? (13000 / 11800) : 1.09);
                sessionFee = Math.round(basePrice * saxophoneMultiplier);
            } else {
                sessionFee = basePrice;
            }
        } else if (paymentType === 'Installment') {
            const installmentRatio = sessions === 12 ? (3000 / 7450) : (sessions === 20 ? (5000 / 11800) : 0.42);
            sessionFee = Math.round(basePrice * installmentRatio);
        }
    } else {
        if (paymentType === 'Partial Payment' || paymentType === 'Installment') {
            if (sessions === 12) sessionFee = 3000;
            else if (sessions === 20) sessionFee = 5000;
        } else if (paymentType === 'Full Payment') {
            if (hasSaxophone) {
                if (sessions === 12) sessionFee = 8100;
                else if (sessions === 20) sessionFee = 13000;
            } else {
                if (sessions === 12) sessionFee = 7450;
                else if (sessions === 20) sessionFee = 11800;
            }
        }
    }

    const total = registrationFee + sessionFee;

    if (sessionFeeEl) sessionFeeEl.textContent = `₱${sessionFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (totalEl) totalEl.textContent = `₱${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (feeInput) feeInput.value = total;

    return total;
}

// Calculate age from date string (YYYY-MM-DD)
function calculateAgeFromBirthdate(dateStr) {
    if (!dateStr) return null;
    const dob = new Date(dateStr);
    if (isNaN(dob.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    return age;
}

function updatePublicGuardianRequiredState() {
    const dobInput = document.getElementById('student_date_of_birth');
    const guardianFields = document.querySelectorAll('.guardian-field-public');
    const guardianLabels = document.querySelectorAll('.guardian-label-public');
    const badge = document.getElementById('guardian_required_badge_public');
    if (!dobInput) return;

    const age = calculateAgeFromBirthdate(dobInput.value);
    const isMinorOr18Below = age !== null && age <= 18;

    if (badge) badge.classList.toggle('hidden', !isMinorOr18Below);

    guardianFields.forEach(el => {
        if (isMinorOr18Below) el.setAttribute('required', 'required');
        else el.removeAttribute('required');
    });

    guardianLabels.forEach(el => {
        const text = el.textContent.replace(/\s*\*\s*$/, '').trim();
        el.textContent = text + (isMinorOr18Below ? ' *' : '');
    });
}

// Update age display and guardian required state for walk-in form
function updateWalkinAgeAndGuardianRequired() {
    const dobInput = document.getElementById('walkin_student_dob');
    const ageDisplay = document.getElementById('walkin_student_age_display');
    const guardianFields = document.querySelectorAll('.guardian-field');
    const guardianLabels = document.querySelectorAll('.guardian-label');
    const badge = document.getElementById('guardian_required_badge');

    if (!dobInput || !ageDisplay) return;

    const age = calculateAgeFromBirthdate(dobInput.value);
    const isMinor = age !== null && age <= 18;

    if (age !== null) {
        ageDisplay.textContent = age + ' years old';
    } else {
        ageDisplay.textContent = '— Select date of birth —';
    }

    if (badge) badge.classList.toggle('hidden', !isMinor);

    guardianFields.forEach(el => {
        if (isMinor) {
            el.setAttribute('required', 'required');
        } else {
            el.removeAttribute('required');
        }
    });

    guardianLabels.forEach(el => {
        const text = el.textContent.replace(/\s*\*\s*$/, '').trim();
        el.textContent = text + (isMinor ? ' *' : '');
    });
}

let walkinPackages = [];

async function loadWalkinPackages(branchId = 0) {
    const select = document.getElementById('walkinSessionPackageId');
    if (!select) return;

    try {
        let url = `${baseApiUrl}/sessions.php?action=get-packages`;
        if (branchId) {
            url += `&branch_id=${branchId}`;
        }
        const response = await axios.get(url);
        const data = response.data;
        const packages = data.success && Array.isArray(data.packages) ? data.packages : [];
        walkinPackages = packages;

        select.innerHTML = '<option value="">Select package</option>' + packages.map(pkg => {
            const maxInstruments = Number(pkg.max_instruments || 1);
            const price = Number(pkg.price || 0);
            return `<option value="${pkg.package_id}" data-sessions="${Number(pkg.sessions || 0)}" data-max-instruments="${maxInstruments}" data-price="${price}">${pkg.package_name} (${pkg.sessions} sessions)</option>`;
        }).join('');
    } catch (error) {
        console.error('Failed to load packages for walk-in registration:', error);
        if (select) {
            select.innerHTML = '<option value="">Unable to load packages</option>';
        }
    }
}

function updateWalkinPackageDetails() {
    const select = document.getElementById('walkinSessionPackageId');
    const details = document.getElementById('walkinPackageDetails');
    if (!select || !details) return;

    const pkgId = select.value;
    const pkg = walkinPackages.find(p => String(p.package_id) === String(pkgId));
    if (!pkg) {
        details.textContent = 'Select a package to view details.';
        return;
    }

    details.innerHTML = `
        <div class="text-sm font-semibold text-white">${pkg.package_name}</div>
        <div class="mt-1 text-xs text-zinc-300">${pkg.sessions} sessions</div>
        <div class="mt-1 text-xs text-zinc-300">${pkg.description ? pkg.description : ''}</div>
        <div class="mt-2 text-xs text-gold-200">Amount: ₱${Number(pkg.price || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
    `;
}

function updateWalkinPreferredDay() {
    const dateEl = document.getElementById('walkinPreferredDate');
    const dayEl = document.getElementById('walkinPreferredDay');
    if (!dateEl || !dayEl) return;

    const dateValue = dateEl.value || '';
    if (!dateValue) {
        dayEl.value = '';
        return;
    }

    const selectedDate = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(selectedDate.getTime())) {
        dayEl.value = '';
        return;
    }

    dayEl.value = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
}

function getWalkinSelectedInstrumentIds() {
    return Array.from(document.querySelectorAll('#walkin_instrumentsContainer select[name="instruments[]"]'))
        .map(select => parseInt(select.value, 10))
        .filter(value => !Number.isNaN(value) && value > 0)
        .filter((value, index, source) => source.indexOf(value) === index);
}

function getWalkinEnrollmentPayload() {
    const packageSelect = document.getElementById('walkinSessionPackageId');
    const paymentTypeEl = document.getElementById('walkin_paymentType');
    const preferredDateEl = document.getElementById('walkinPreferredDate');
    const preferredDayEl = document.getElementById('walkinPreferredDay');
    const paymentProofEl = document.getElementById('walkinPackagePaymentProof');

    if (!packageSelect || !paymentTypeEl || !preferredDateEl || !preferredDayEl) {
        return null;
    }

    const packageId = parseInt(packageSelect.value, 10);
    const paymentType = String(paymentTypeEl.value || '').trim();
    const preferredDate = preferredDateEl.value || '';
    const preferredDay = preferredDayEl.value || '';
    const instrumentIds = getWalkinSelectedInstrumentIds();
    const selectedOption = packageSelect.options[packageSelect.selectedIndex];
    const maxInstruments = Number(selectedOption?.getAttribute('data-max-instruments') || 1);

    if (!packageId || !paymentType || !preferredDate || !preferredDay || instrumentIds.length < 1) {
        return { error: 'Please complete package, payment type, instruments, preferred date, and preferred day.' };
    }

    if (!['Full Payment', 'Partial Payment', 'Installment'].includes(paymentType)) {
        return { error: 'Invalid package payment type selected.' };
    }

    if (instrumentIds.length > maxInstruments) {
        return { error: `You can select up to ${maxInstruments} instrument(s) for this package.` };
    }

    return {
        packageId,
        paymentType,
        preferredDate,
        preferredDay,
        instrumentIds,
        paymentProofFile: paymentProofEl && paymentProofEl.files && paymentProofEl.files[0] ? paymentProofEl.files[0] : null
    };
}

async function submitWalkinEnrollmentRequest(studentId) {
    const enrollment = getWalkinEnrollmentPayload();
    if (!enrollment || enrollment.error) {
        return { success: false, error: enrollment?.error || 'Walk-in enrollment details are incomplete.' };
    }

    const requestFormData = new FormData();
    requestFormData.append('action', 'submit-package-request');
    requestFormData.append('student_id', String(Number(studentId)));
    requestFormData.append('package_id', String(enrollment.packageId));
    requestFormData.append('payment_type', enrollment.paymentType);
    requestFormData.append('preferred_date', enrollment.preferredDate);
    requestFormData.append('preferred_day_of_week', enrollment.preferredDay);
    requestFormData.append('instrument_ids_json', JSON.stringify(enrollment.instrumentIds));
    if (enrollment.paymentProofFile) {
        requestFormData.append('package_payment_proof_file', enrollment.paymentProofFile);
    }

    return await postStudentPackageRequest(requestFormData);
}

function setupWalkinEnrollmentForm() {
    const branchSelect = document.getElementById('walkin_branch_id');
    const packageSelect = document.getElementById('walkinSessionPackageId');
    const paymentTypeEl = document.getElementById('walkin_paymentType');
    const preferredDateEl = document.getElementById('walkinPreferredDate');

    if (branchSelect && !branchSelect.dataset.walkinEnrollmentBound) {
        branchSelect.addEventListener('change', async function () {
            const branchId = Number(this.value || 0);
            await loadWalkinPackages(branchId);
            await loadWalkinInstruments(branchId);
            updateWalkinPackageDetails();
            calculateWalkinTotalFee();
        });
        branchSelect.dataset.walkinEnrollmentBound = '1';
    }

    if (packageSelect && !packageSelect.dataset.walkinEnrollmentBound) {
        packageSelect.addEventListener('change', function () {
            updateWalkinPackageDetails();
            updateWalkinInstrumentSelection();
            calculateWalkinTotalFee();
        });
        packageSelect.dataset.walkinEnrollmentBound = '1';
    }

    if (paymentTypeEl && !paymentTypeEl.dataset.walkinEnrollmentBound) {
        paymentTypeEl.addEventListener('change', calculateWalkinTotalFee);
        paymentTypeEl.dataset.walkinEnrollmentBound = '1';
    }

    if (preferredDateEl && !preferredDateEl.dataset.walkinEnrollmentBound) {
        preferredDateEl.addEventListener('change', updateWalkinPreferredDay);
        preferredDateEl.dataset.walkinEnrollmentBound = '1';
    }

    const activeBranchId = Number(branchSelect?.value || 0);
    if (activeBranchId > 0) {
        loadWalkinPackages(activeBranchId);
        loadWalkinInstruments(activeBranchId);
    } else {
        loadWalkinPackages();
    }
    updateWalkinPackageDetails();
    updateWalkinPreferredDay();
    calculateWalkinTotalFee();
}

// Initialize walk-in admin page (used on admin_registration.html)
function initWalkinPage() {
    const form = document.getElementById('walkinForm');
    if (!form) return;

    // Seed dropdowns
    loadWalkinBranches();

    const branchSelect = document.getElementById('walkin_branch_id');
    const dobInput = document.getElementById('walkin_student_dob');

    if (dobInput) {
        dobInput.addEventListener('change', updateWalkinAgeAndGuardianRequired);
        dobInput.addEventListener('input', updateWalkinAgeAndGuardianRequired);
        // Initial state (e.g. if form is pre-filled)
        updateWalkinAgeAndGuardianRequired();
    }

    if (branchSelect) {
        branchSelect.addEventListener('change', function () {
            // Branch still matters for profile and assignment later.
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = document.getElementById('walkinSubmitBtn');
        const btnText = document.getElementById('walkinSubmitBtnText');

        // Prevent double submit (first request can succeed, second gets "email already registered")
        if (form.dataset.submitting === '1') {
            return;
        }
        form.dataset.submitting = '1';
        if (btn) btn.disabled = true;
        if (btnText) btnText.textContent = 'Creating...';

        const formData = new FormData(form);
        const data = {};
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }
        data['registration_fee_amount'] = 1000;

        // Mark as walk-in and attach role-scoped branch context.
        data['is_walkin'] = true;
        try {
            const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
            const role = String(user?.role_name || '').toLowerCase();
            if (['staff', 'desk', 'front desk'].includes(role)) {
                data['registration_source'] = 'staff';
                const deskBranchId = Number(user?.branch_id || 0);
                if (deskBranchId > 0) data['desk_branch_id'] = deskBranchId;
            } else if (['manager', 'branch manager'].includes(role)) {
                data['registration_source'] = 'manager';
                const managerBranchId = Number(user?.branch_id || 0);
                if (managerBranchId > 0) data['manager_branch_id'] = managerBranchId;
            } else {
                data['registration_source'] = 'admin';
            }
        } catch (_) {
            data['registration_source'] = 'admin';
        }

        try {
            const response = await axios.post(`${baseApiUrl}/users.php?action=register`, data);

            const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
            let result;
            try {
                result = typeof response.data === 'string' ? JSON.parse(responseText) : response.data;
            } catch (parseErr) {
                console.error('Walk-in registration 400 - Response was not JSON:', responseText);
                showMessage('Registration failed. The server returned an invalid response. Check the browser console (F12) for details.', 'error');
                return;
            }

            if (result.success) {
                const guardianLabel = result.guardian_username
                    ? `<strong>Guardian Username:</strong> ${escapeHtml(result.guardian_username)}<br><strong>Guardian Temporary Password:</strong> fasmusic@2020<br>`
                    : '';

                // Reset form and hide modal if present
                form.reset();
                const modal = document.getElementById('registerStudentModal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Student Registered',
                    html: `Student account was created successfully.<br><br>
                           <strong>Username:</strong> ${result.username || data['student_email']}<br>
                           <strong>Student Temporary Password:</strong> fas@123<br>
                           ${guardianLabel}<br>
                           Next step: confirm the walk-in registration payment method.`,
                    confirmButtonColor: '#b8860b'
                }).then(() => {
                    const redirectTemplate = String(form.dataset.paymentRedirectTemplate || '').trim();
                    const redirectUrl = redirectTemplate
                        ? redirectTemplate.replace('{student_id}', encodeURIComponent(String(result.student_id)))
                        : String(form.dataset.paymentRedirectUrl || '').trim();
                    openPaymentModal(result.student_id, { forceSource: 'walkin', redirectUrl });
                });
            } else {
                const errMsg = result.error || 'Registration failed. Please check all required fields and try again.';
                console.error('Walk-in registration failed (400):', errMsg, result);
                showMessage(errMsg, 'error');
            }
        } catch (error) {
            console.error('Walk-in create error:', error);
            showMessage(error.message || 'An error occurred. Please try again.', 'error');
        } finally {
            form.dataset.submitting = '0';
            if (btn) btn.disabled = false;
            if (btnText) btnText.textContent = 'Proceed Payment';
        }
    });
}

// Load and display all students for admin_students page
async function loadStudentsForAdmin() {
    const tableBody = document.getElementById('studentsTable');
    if (!tableBody) return;

    try {
        const res = await axios.get(`${baseApiUrl}/students.php?action=get-all-students`);
        const data = res.data;
        const students = data.success ? data.students : [];

        if (!students || students.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-8 text-center text-zinc-400">
                        <i class="fas fa-inbox text-2xl mb-2"></i>
                        <p>No students found</p>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = students.map(s => {
            const statusColors = {
                'Pending': 'text-yellow-400 bg-yellow-400/10',
                'Fee Paid': 'text-green-400 bg-green-400/10',
                'Approved': 'text-blue-400 bg-blue-400/10',
                'Rejected': 'text-red-400 bg-red-400/10'
            };
            const statusClass = statusColors[s.registration_status] || 'text-zinc-400 bg-zinc-400/10';

            const activeBadge = s.status === 'Active'
                ? '<span class="px-2 py-1 rounded text-xs font-semibold bg-green-400/10 text-green-400">Active</span>'
                : '<span class="px-2 py-1 rounded text-xs font-semibold bg-zinc-400/10 text-zinc-300">Inactive</span>';

            return `
                <tr class="hover:bg-gold-500/5 transition">
                    <td class="px-6 py-4">
                        <div class="font-medium text-white">${s.first_name} ${s.last_name}</div>
                    </td>
                    <td class="px-6 py-4 text-sm text-zinc-300">
                        <div>${s.email || ''}</div>
                        <div class="text-zinc-500">${s.phone || ''}</div>
                    </td>
                    <td class="px-6 py-4 text-zinc-300">
                        ${s.branch_name || ''}
                    </td>
                    <td class="px-6 py-4 text-sm text-zinc-300">
                        <div>Fee: ₱${parseFloat(s.registration_fee_amount || 0).toFixed(2)}</div>
                        <div>Paid: ₱${parseFloat(s.registration_fee_paid || 0).toFixed(2)}</div>
                    </td>
                    <td class="px-6 py-4 text-sm">
                        <div class="mb-1">
                            <span class="px-2 py-1 rounded text-xs font-semibold ${statusClass}">
                                ${s.registration_status}
                            </span>
                        </div>
                        ${activeBadge}
                    </td>
                    <td class="px-6 py-4 text-sm text-zinc-400">
                        ${new Date(s.created_at).toLocaleDateString()}
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Failed to load students:', error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-red-400">
                    Failed to load students.
                </td>
            </tr>
        `;
    }
}

// Show message (SweetAlert)
function showMessage(message, type = 'error') {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: type === 'success' ? 'success' : 'error',
            title: type === 'success' ? 'Success' : 'Error',
            text: message,
            confirmButtonColor: '#b8860b'
        });
    } else {
        alert(message);
    }
}

// Load Pending Registrations
async function loadPendingRegistrations() {
    const tableTitle = document.getElementById('tableTitle');
    if (tableTitle) {
        tableTitle.textContent = 'Pending Registrations';
    }

    try {
        const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
        const role = String(user?.role_name || '').toLowerCase();
        const branchScopedRole = user && ['staff', 'desk', 'front desk', 'manager', 'branch manager'].includes(role);
        const staffBranchId = branchScopedRole ? Number(user.branch_id || 0) : 0;
        let url = `${baseApiUrl}/admin.php?action=get-pending-registrations`;
        if (staffBranchId > 0) url += `&branch_id=${encodeURIComponent(staffBranchId)}`;

        const res = await axios.get(url);
        const data = res.data;

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
    const tableTitle = document.getElementById('tableTitle');
    if (tableTitle) {
        tableTitle.textContent = 'All Registrations';
    }

    try {
        const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
        const role = String(user?.role_name || '').toLowerCase();
        const branchScopedRole = user && ['staff', 'desk', 'front desk', 'manager', 'branch manager'].includes(role);
        const staffBranchId = branchScopedRole ? Number(user.branch_id || 0) : 0;
        let url = `${baseApiUrl}/admin.php?action=get-all-registrations`;
        if (staffBranchId > 0) url += `&branch_id=${encodeURIComponent(staffBranchId)}`;

        const res = await axios.get(url);
        const data = res.data;

        if (data.success) {
            displayRegistrations(data.registrations);
            updateStats(data.registrations);
        }
    } catch (error) {
        showMessage('Failed to load registrations: ' + (error.message || error), 'error');
    }
}

const registrationsTableState = {
    rows: [],
    page: 1,
    pageSize: 10
};

function getRegistrationsModeFromHash() {
    const hash = (window.location.hash || '').replace('#', '').toLowerCase();
    return hash === 'pending' ? 'pending' : 'all';
}

function reloadRegistrationsByActiveMode() {
    if (getRegistrationsModeFromHash() === 'pending') {
        loadPendingRegistrations();
    } else {
        loadAllRegistrations();
    }
}

function initRegistrationsPaginationControls() {
    const pageSizeEl = document.getElementById('registrationsPageSize');
    const prevBtn = document.getElementById('registrationsPrevBtn');
    const nextBtn = document.getElementById('registrationsNextBtn');

    if (pageSizeEl && pageSizeEl.dataset.bound !== '1') {
        pageSizeEl.addEventListener('change', () => {
            const nextSize = parseInt(pageSizeEl.value, 10);
            registrationsTableState.pageSize = Number.isFinite(nextSize) && nextSize > 0 ? nextSize : 10;
            registrationsTableState.page = 1;
            renderRegistrationsTable();
        });
        pageSizeEl.dataset.bound = '1';
    }

    if (prevBtn && prevBtn.dataset.bound !== '1') {
        prevBtn.addEventListener('click', () => {
            registrationsTableState.page = Math.max(1, registrationsTableState.page - 1);
            renderRegistrationsTable();
        });
        prevBtn.dataset.bound = '1';
    }

    if (nextBtn && nextBtn.dataset.bound !== '1') {
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.max(1, Math.ceil(registrationsTableState.rows.length / registrationsTableState.pageSize));
            registrationsTableState.page = Math.min(totalPages, registrationsTableState.page + 1);
            renderRegistrationsTable();
        });
        nextBtn.dataset.bound = '1';
    }
}

function renderRegistrationsTable() {
    const tbody = document.getElementById('registrationsTable');
    if (!tbody) return;

    const infoEl = document.getElementById('registrationsPaginationInfo');
    const prevBtn = document.getElementById('registrationsPrevBtn');
    const nextBtn = document.getElementById('registrationsNextBtn');
    const pageSizeEl = document.getElementById('registrationsPageSize');

    if (pageSizeEl) {
        pageSizeEl.value = String(registrationsTableState.pageSize);
    }

    const rows = Array.isArray(registrationsTableState.rows) ? registrationsTableState.rows : [];
    const totalRows = rows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / registrationsTableState.pageSize));
    if (registrationsTableState.page > totalPages) registrationsTableState.page = totalPages;
    if (registrationsTableState.page < 1) registrationsTableState.page = 1;

    const startIndex = (registrationsTableState.page - 1) * registrationsTableState.pageSize;
    const endIndex = Math.min(totalRows, startIndex + registrationsTableState.pageSize);
    const pageRows = rows.slice(startIndex, endIndex);

    if (infoEl) {
        infoEl.textContent = totalRows === 0
            ? 'No records'
            : `Page ${registrationsTableState.page} of ${totalPages} • ${startIndex + 1}-${endIndex} of ${totalRows}`;
    }
    if (prevBtn) prevBtn.disabled = registrationsTableState.page <= 1;
    if (nextBtn) nextBtn.disabled = registrationsTableState.page >= totalPages || totalRows === 0;

    if (totalRows === 0) {
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

    tbody.innerHTML = pageRows.map(reg => {
        const statusColors = {
            'Pending': 'text-amber-700 bg-amber-100',
            'Fee Paid': 'text-emerald-700 bg-emerald-100',
            'Approved': 'text-blue-700 bg-blue-100',
            'Rejected': 'text-red-700 bg-red-100'
        };

        const statusClass = statusColors[reg.registration_status] || 'text-slate-700 bg-slate-100';
        const remaining = parseFloat(reg.registration_fee_amount) - parseFloat(reg.registration_fee_paid || 0);
        const registrationSource = String(reg.registration_source || 'online').toLowerCase() === 'walkin' ? 'walkin' : 'online';
        const sourceBadgeClass = registrationSource === 'walkin'
            ? 'bg-purple-100 text-purple-700'
            : 'bg-sky-100 text-sky-700';
        const sourceLabel = registrationSource === 'walkin' ? 'Walk-In' : 'Online';
        const registrationProofLink = reg.registration_proof_path
            ? `<a href="${buildPublicFileUrl(reg.registration_proof_path)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800 underline mt-1"><i class="fas fa-file-alt"></i>Proof</a>`
            : (registrationSource === 'walkin'
                ? '<div class="text-xs text-slate-500 mt-1">Walk-in payment handled at the branch</div>'
                : '<div class="text-xs text-slate-500 mt-1">No proof uploaded</div>');

        return `
            <tr class="hover:bg-gold-500/5 transition">
                <td class="px-6 py-4">
                    <div class="font-medium text-slate-900" style="color:#0f172a;">${reg.first_name} ${reg.last_name}</div>
                    <div class="text-sm text-slate-500" style="color:#64748b;">${reg.email || ''}</div>
                    <div class="mt-2"><span class="inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold ${sourceBadgeClass}">${sourceLabel}</span></div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-slate-900" style="color:#0f172a;">${reg.guardian_first_name || ''} ${reg.guardian_last_name || ''}</div>
                    <div class="text-sm text-slate-500" style="color:#64748b;">${reg.guardian_phone || ''}</div>
                </td>
                <td class="px-6 py-4 text-slate-700" style="color:#334155;">${reg.branch_name || ''}</td>
                <td class="px-6 py-4">
                    <div class="text-slate-900 font-medium" style="color:#0f172a;">₱${parseFloat(reg.registration_fee_amount || 0).toFixed(2)}</div>
                    ${remaining > 0 ? `<div class="text-sm text-red-600">Remaining: ₱${remaining.toFixed(2)}</div>` : ''}
                    ${registrationProofLink}
                </td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded text-xs font-semibold ${statusClass}">
                        ${reg.registration_status}
                    </span>
                </td>
                <td class="px-6 py-4 text-slate-600 text-sm" style="color:#475569;">
                    ${new Date(reg.created_at).toLocaleDateString()}
                </td>
                <td class="px-6 py-4">
                    <div class="flex gap-2">
                        <button onclick="viewDetails(${reg.student_id})"
                            class="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm transition">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${reg.registration_status === 'Pending' ? `
                            <button onclick="openPaymentModal(${reg.student_id})"
                                class="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded text-sm transition">
                                <i class="fas fa-money-bill-wave"></i>
                            </button>
                            <button onclick="rejectRegistration(${reg.student_id})"
                                class="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm transition">
                                <i class="fas fa-times"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Display Registrations
function displayRegistrations(registrations) {
    if (!document.getElementById('registrationsTable')) {
        return;
    }
    registrationsTableState.rows = Array.isArray(registrations) ? registrations : [];
    registrationsTableState.page = 1;
    initRegistrationsPaginationControls();
    renderRegistrationsTable();
}

// Update Stats
function updateStats(registrations) {
    const stats = {
        pending: 0,
        feePaid: 0,
        approved: 0,
        total: registrations ? registrations.length : 0
    };

    if (registrations) {
        registrations.forEach(reg => {
            if (reg.registration_status === 'Pending') stats.pending++;
            if (reg.registration_status === 'Fee Paid') stats.feePaid++;
            if (reg.registration_status === 'Approved') stats.approved++;
        });
    }

    const statPending = document.getElementById('statPending');
    const statFeePaid = document.getElementById('statFeePaid');
    const statApproved = document.getElementById('statApproved');
    const statTotal = document.getElementById('statTotal');

    if (statPending) statPending.textContent = stats.pending;
    if (statFeePaid) statFeePaid.textContent = stats.feePaid;
    if (statApproved) statApproved.textContent = stats.approved;
    if (statTotal) statTotal.textContent = stats.total;
}

// View Details
async function viewDetails(studentId) {
    try {
        const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
        const role = String(user?.role_name || '').toLowerCase();
        const branchScopedRole = user && ['staff', 'desk', 'front desk', 'manager', 'branch manager'].includes(role);
        const staffBranchId = branchScopedRole ? Number(user.branch_id || 0) : 0;
        let url = `${baseApiUrl}/admin.php?action=get-registration-details&student_id=${studentId}`;
        if (staffBranchId > 0) url += `&branch_id=${encodeURIComponent(staffBranchId)}`;

        const res = await axios.get(url);
        const data = res.data;

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
                            <p><span class="text-zinc-400">Branch:</span> <span class="text-white">${student.branch_name || 'N/A'}</span></p>
                            <p><span class="text-zinc-400">Source:</span> <span class="text-white">${String(student.registration_source || 'online').toLowerCase() === 'walkin' ? 'Walk-In' : 'Online'}</span></p>
                        </div>
                    </div>
                    <div>
                        <h4 class="text-lg font-bold text-gold-400 mb-4">Registration Status</h4>
                        <div class="space-y-2 text-sm">
                            <p><span class="text-zinc-400">Status:</span> <span class="text-white">${student.registration_status}</span></p>
                            <p><span class="text-zinc-400">Fee Amount:</span> <span class="text-white">₱${parseFloat(student.registration_fee_amount || 0).toFixed(2)}</span></p>
                            <p><span class="text-zinc-400">Paid Amount:</span> <span class="text-white">₱${parseFloat(student.registration_fee_paid || 0).toFixed(2)}</span></p>
                            <p><span class="text-zinc-400">Remaining:</span> <span class="text-white">₱${(parseFloat(student.registration_fee_amount || 0) - parseFloat(student.registration_fee_paid || 0)).toFixed(2)}</span></p>
                            <p><span class="text-zinc-400">Payment Proof:</span> <span class="text-white">${student.registration_proof_path ? `<a class="text-gold-300 underline" target="_blank" rel="noopener" href="${buildPublicFileUrl(student.registration_proof_path)}">View file</a>` : (String(student.registration_source || 'online').toLowerCase() === 'walkin' ? 'Not required for walk-in' : 'N/A')}</span></p>
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
                            <table class="w-full text-sm text-white">
                                <thead class="bg-zinc-900/50">
                                    <tr>
                                        <th class="px-4 py-2 text-left text-zinc-200">Date</th>
                                        <th class="px-4 py-2 text-left text-zinc-200">Amount</th>
                                        <th class="px-4 py-2 text-left text-zinc-200">Method</th>
                                        <th class="px-4 py-2 text-left text-zinc-200">Receipt</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${payments.map(p => `
                                        <tr class="border-t border-zinc-800">
                                            <td class="px-4 py-2 text-white">${new Date(p.payment_date).toLocaleDateString()}</td>
                                            <td class="px-4 py-2 text-white">₱${parseFloat(p.amount).toFixed(2)}</td>
                                            <td class="px-4 py-2 text-white">${p.payment_method}</td>
                                            <td class="px-4 py-2 text-white">${p.receipt_number || 'N/A'}</td>
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
async function openPaymentModal(studentId, options = {}) {
    currentStudentId = studentId;
    currentPaymentRedirectUrl = String(options.redirectUrl || '');

    try {
        const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
        const role = String(user?.role_name || '').toLowerCase();
        const branchScopedRole = user && ['staff', 'desk', 'front desk', 'manager', 'branch manager'].includes(role);
        const staffBranchId = branchScopedRole ? Number(user.branch_id || 0) : 0;
        let url = `${baseApiUrl}/admin.php?action=get-registration-details&student_id=${studentId}`;
        if (staffBranchId > 0) url += `&branch_id=${encodeURIComponent(staffBranchId)}`;

        const res = await axios.get(url);
        const data = res.data;
        if (data.success) {
            const student = data.student;
            const registrationSource = String(options.forceSource || student.registration_source || '').toLowerCase() === 'walkin' ? 'walkin' : 'online';
            currentPaymentSource = registrationSource;
            const remaining = parseFloat(student.registration_fee_amount || 0) - parseFloat(student.registration_fee_paid || 0);
            const payments = Array.isArray(data.payments) ? data.payments : [];
            const receiptPayment = payments.find(payment => String(payment.status || '').toLowerCase() === 'pending')
                || payments.find(payment => Number(payment.amount || 0) > 0)
                || null;
            const selectedMethod = (receiptPayment?.payment_method || '').trim();
            const selectedAmount = Number(receiptPayment?.amount || 0);
            const paymentStudentInfoEl = document.getElementById('paymentStudentInfo');
            const paymentAmountEl = document.getElementById('paymentAmount');
            const paymentAmountDisplayEl = document.getElementById('paymentAmountDisplay');
            const paymentAmountHintEl = document.getElementById('paymentAmountHint');
            const paymentMethodEl = document.getElementById('paymentMethod');
            const paymentMethodDisplayEl = document.getElementById('paymentMethodDisplay');
            const paymentMethodSelectEl = document.getElementById('paymentMethodSelect');
            const paymentMethodReadonlyWrap = document.getElementById('paymentMethodReadonlyWrap');
            const paymentMethodSelectWrap = document.getElementById('paymentMethodSelectWrap');
            const paymentMethodReadonlyHint = document.getElementById('paymentMethodReadonlyHint');
            const modal = document.getElementById('paymentModal');

            if (!paymentStudentInfoEl || !paymentAmountEl || !paymentMethodEl || !modal) {
                throw new Error('Payment modal is missing required fields. Please refresh the page and try again.');
            }

            paymentStudentInfoEl.textContent =
                `Student: ${student.first_name} ${student.last_name} | Remaining: ₱${remaining.toFixed(2)}`;
            const receiptAmount = selectedAmount > 0
                ? selectedAmount
                : (remaining > 0 ? remaining : student.registration_fee_amount);
            paymentAmountEl.value = receiptAmount;
            if (paymentAmountDisplayEl) {
                paymentAmountDisplayEl.textContent =
                    `₱${Number(receiptAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
            if (paymentAmountHintEl) {
                paymentAmountHintEl.textContent = registrationSource === 'walkin'
                    ? 'This is the required ₱1,000.00 registration fee for the walk-in student.'
                    : 'This amount comes from the student\'s submitted registration payment request.';
            }
            paymentMethodEl.value = selectedMethod;
            if (paymentMethodDisplayEl) {
                paymentMethodDisplayEl.textContent = selectedMethod || (registrationSource === 'walkin' ? 'Choose below' : 'No method submitted');
            }
            if (paymentMethodReadonlyWrap && paymentMethodSelectWrap) {
                paymentMethodReadonlyWrap.classList.toggle('hidden', registrationSource === 'walkin');
                paymentMethodSelectWrap.classList.toggle('hidden', registrationSource !== 'walkin');
            }
            if (paymentMethodSelectEl) {
                paymentMethodSelectEl.value = registrationSource === 'walkin' ? selectedMethod : '';
            }
            if (paymentMethodReadonlyHint) {
                paymentMethodReadonlyHint.textContent = registrationSource === 'walkin'
                    ? ''
                    : 'This method was already selected by the student during registration.';
            }

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
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    const paymentForm = document.getElementById('paymentForm');
    const paymentAmountEl = document.getElementById('paymentAmount');
    const paymentAmountDisplayEl = document.getElementById('paymentAmountDisplay');
    const paymentAmountHintEl = document.getElementById('paymentAmountHint');
    const paymentMethodEl = document.getElementById('paymentMethod');
    const paymentMethodDisplayEl = document.getElementById('paymentMethodDisplay');
    const paymentMethodSelectEl = document.getElementById('paymentMethodSelect');
    const paymentMethodReadonlyWrap = document.getElementById('paymentMethodReadonlyWrap');
    const paymentMethodSelectWrap = document.getElementById('paymentMethodSelectWrap');

    if (paymentForm) paymentForm.reset();
    if (paymentAmountEl) paymentAmountEl.value = '';
    if (paymentAmountDisplayEl) paymentAmountDisplayEl.textContent = '₱0.00';
    if (paymentAmountHintEl) paymentAmountHintEl.textContent = 'This amount comes from the student\'s submitted registration payment request.';
    if (paymentMethodEl) paymentMethodEl.value = '';
    if (paymentMethodDisplayEl) paymentMethodDisplayEl.textContent = 'Not available';
    if (paymentMethodSelectEl) paymentMethodSelectEl.value = '';
    if (paymentMethodReadonlyWrap) paymentMethodReadonlyWrap.classList.remove('hidden');
    if (paymentMethodSelectWrap) paymentMethodSelectWrap.classList.add('hidden');
    currentStudentId = null;
    currentPaymentRedirectUrl = '';
    currentPaymentSource = '';
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

        const selectedMethod = currentPaymentSource === 'walkin'
            ? (document.getElementById('paymentMethodSelect')?.value || '').trim()
            : (document.getElementById('paymentMethod').value || '').trim();
        if (!selectedMethod) {
            showMessage(currentPaymentSource === 'walkin'
                ? 'Please select the registration payment method.'
                : 'No payment method was submitted by the student for this registration.', 'error');
            btn.disabled = false;
            btnText.textContent = 'Confirm Payment';
            return;
        }

        const lockedAmount = parseFloat(document.getElementById('paymentAmount').value || '0');
        if (!(lockedAmount > 0)) {
            showMessage('No submitted payment amount was found for this registration.', 'error');
            btn.disabled = false;
            btnText.textContent = 'Confirm Payment';
            return;
        }

        const paymentData = {
            student_id: currentStudentId,
            amount: lockedAmount,
            payment_method: selectedMethod
        };

        try {
            const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
            const role = String(user?.role_name || '').toLowerCase();
            const branchScopedRole = user && ['staff', 'desk', 'front desk', 'manager', 'branch manager'].includes(role);
            const staffBranchId = branchScopedRole ? Number(user.branch_id || 0) : 0;
            if (staffBranchId > 0) paymentData.branch_id = staffBranchId;

            const res = await axios.post(`${baseApiUrl}/admin.php?action=confirm-payment`, paymentData);
            const data = res.data;
            if (data.success) {
                const redirectUrl = currentPaymentRedirectUrl;
                showMessage(data.message, 'success');
                closePaymentModal();
                reloadRegistrationsByActiveMode();
                if (redirectUrl) {
                    window.location.href = redirectUrl;
                }
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
        const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
        const role = String(user?.role_name || '').toLowerCase();
        const branchScopedRole = user && ['staff', 'desk', 'front desk', 'manager', 'branch manager'].includes(role);
        const staffBranchId = branchScopedRole ? Number(user.branch_id || 0) : 0;
        const payload = { student_id: studentId };
        if (staffBranchId > 0) payload.branch_id = staffBranchId;

        const res = await axios.post(`${baseApiUrl}/admin.php?action=reject-registration`, payload);
        const data = res.data;
        if (data.success) {
            showMessage(data.message, 'success');
            reloadRegistrationsByActiveMode();
        }
    } catch (error) {
        showMessage('Failed to reject registration: ' + (error.message || error), 'error');
    }
}

// Admin Users - load all users into admin_users.html table
async function loadAdminUsers() {
    try {
        const res = await axios.get(`${baseApiUrl}/admin.php?action=get-users`);
        const data = res.data;
        if (data && data.success && Array.isArray(data.users)) {
            if (typeof setAdminUsersRows === 'function') {
                setAdminUsersRows(data.users);
            }
        }
    } catch (error) {
        console.error('Failed to load admin users', error);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on index.html or admin page
    const loginForm = document.getElementById('loginForm');
    const adminTable = document.getElementById('registrationsTable');
    const walkinForm = document.getElementById('walkinForm');
    const studentDashboard = document.getElementById('studentDashboardRoot');
    const studentProfile = document.getElementById('studentProfileRoot');
    const studentSessions = document.getElementById('studentSessionsRoot');
    const studentAttendance = document.getElementById('studentAttendanceRoot');
    const studentQr = document.getElementById('studentQrRoot');
    const guardianStudentsRoot = document.getElementById('guardianStudentsRoot');

    if (loginForm) {
        initIndexPage();
    } else if (walkinForm) {
        const user = Auth.getUser();
        const role = String(user?.role_name || '').toLowerCase();
        const isAdminRole = ['admin', 'superadmin'].includes(role);
        const isBranchScopedRole = ['staff', 'desk', 'front desk', 'manager', 'branch manager'].includes(role);

        if (isAdminRole) {
            checkAuth();
        } else if (!isBranchScopedRole) {
            checkAuth();
            return;
        }

        initWalkinPage();
    } else if (adminTable) {
        const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
        const role = String(user?.role_name || '').toLowerCase();
        const isAdminRole = ['admin', 'superadmin'].includes(role);
        const isBranchScopedRole = ['staff', 'desk', 'front desk', 'manager', 'branch manager'].includes(role);

        if (isAdminRole) {
            checkAuth();
        } else if (!isBranchScopedRole) {
            checkAuth();
            return;
        }

        initPaymentForm();
        if (document.body?.dataset?.customRegistrationMode !== '1') {
            reloadRegistrationsByActiveMode();
        }
    } else if (studentDashboard) {
        initStudentDashboardPage();
    } else if (studentProfile) {
        initStudentProfilePage();
    } else if (studentSessions) {
        initStudentSessionsPage();
    } else if (studentAttendance) {
        initStudentAttendancePage();
    } else if (studentQr) {
        initStudentQrPage();
    } else if (guardianStudentsRoot) {
        initGuardianStudentsPage();
    }
});

