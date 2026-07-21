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
let studentDashboardPortalState = null;
let studentDashboardMetaState = null;
let studentRegistrationRestartNotice = false;
let _studentPerformanceRadarChartInstance = null;

function normalizeRoleName(role) {
    return String(role || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getRoleCategory(role) {
    const normalizedRole = normalizeRoleName(role);
    if (['admin', 'superadmin', 'super admin', 'administrator'].includes(normalizedRole)) {
        return 'admin';
    }
    if (['manager', 'branch manager'].includes(normalizedRole)) {
        return 'manager';
    }
    if (['staff', 'desk', 'front desk'].includes(normalizedRole)) {
        return 'staff';
    }
    if (['instructor', 'instructors', 'teacher', 'teachers'].includes(normalizedRole)) {
        return 'instructor';
    }
    if (normalizedRole === 'student') {
        return 'student';
    }
    if (['guardian', 'guardians'].includes(normalizedRole)) {
        return 'guardian';
    }
    return normalizedRole;
}

// Authentication Utility (integrated) - with storage access protection
const Auth = {
    readStoredUser() {
        const storages = [];
        try {
            storages.push(sessionStorage);
        } catch (e) {
            // Ignore blocked sessionStorage
        }
        try {
            storages.push(localStorage);
        } catch (e) {
            // Ignore blocked localStorage
        }

        for (const storage of storages) {
            try {
                const userStr = storage.getItem('user');
                if (!userStr) continue;
                const parsedUser = JSON.parse(userStr);
                if (parsedUser && typeof parsedUser === 'object') {
                    return parsedUser;
                }
            } catch (e) {
                // Ignore invalid data and keep checking other storage
            }
        }

        return null;
    },

    // Get current user from sessionStorage
    getUser() {
        const user = this.readStoredUser();
        if (!user) {
            return null;
        }

        // Rehydrate the session store when possible so current-tab reads stay fast.
        try {
            sessionStorage.setItem('user', JSON.stringify(user));
        } catch (e) {
            // Ignore storage sync failures
        }
        return user;
    },

    // Set user in browser storage
    setUser(user) {
        let saved = false;
        try {
            sessionStorage.setItem('user', JSON.stringify(user));
            saved = true;
        } catch (e) {
            // Ignore and try localStorage
        }
        try {
            localStorage.setItem('user', JSON.stringify(user));
            saved = true;
        } catch (e) {
            // Ignore and fall back to whatever store worked
        }
        if (!saved) {
            console.warn('Unable to save user to browser storage. Storage access may be blocked.');
        }
    },

    // Remove user from browser storage
    logout() {
        try {
            sessionStorage.removeItem('user');
        } catch (e) {
            // Ignore
        }
        try {
            localStorage.removeItem('user');
        } catch (e) {
            // Ignore
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
        const actualRole = getRoleCategory(user.role_name);
        const targetRole = getRoleCategory(role);
        return actualRole === targetRole || actualRole === 'admin';
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

function escapeAuthHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getPremiumAuthVisual(type) {
    const normalized = ['success', 'error', 'info'].includes(type) ? type : 'error';
    const visuals = {
        success: {
            label: 'Success',
            color: '#059669'
        },
        error: {
            label: 'Action needed',
            color: '#e11d48'
        },
        info: {
            label: 'Notice',
            color: '#b8860b'
        }
    };
    return visuals[normalized];
}

function hexToLottieColor(hex) {
    const normalized = String(hex || '#b8860b').replace('#', '');
    const full = normalized.length === 3
        ? normalized.split('').map((char) => char + char).join('')
        : normalized.padEnd(6, '0').slice(0, 6);
    return [0, 2, 4].map((start) => parseInt(full.slice(start, start + 2), 16) / 255).concat(1);
}

function buildAuthLottieSrc(type) {
    const visual = getPremiumAuthVisual(type);
    const color = hexToLottieColor(visual.color);
    const mutedColor = type === 'error' ? hexToLottieColor('#ffe4e6') : (type === 'success' ? hexToLottieColor('#d1fae5') : hexToLottieColor('#fef3c7'));
    const animation = {
        v: '5.7.4',
        fr: 30,
        ip: 0,
        op: 90,
        w: 140,
        h: 140,
        nm: 'Auth music status',
        ddd: 0,
        assets: [],
        layers: [
            {
                ddd: 0,
                ind: 1,
                ty: 4,
                nm: 'Soft ring',
                sr: 1,
                ks: {
                    o: { a: 0, k: 100 },
                    r: { a: 0, k: 0 },
                    p: { a: 0, k: [70, 70, 0] },
                    a: { a: 0, k: [0, 0, 0] },
                    s: { a: 0, k: [100, 100, 100] }
                },
                shapes: [{
                    ty: 'gr',
                    it: [
                        { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [90, 90] } },
                        { ty: 'st', c: { a: 0, k: mutedColor }, o: { a: 0, k: 100 }, w: { a: 0, k: 8 }, lc: 2, lj: 2 },
                        { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }
                    ]
                }],
                ip: 0,
                op: 90,
                st: 0,
                bm: 0
            },
            {
                ddd: 0,
                ind: 2,
                ty: 4,
                nm: 'Loading ring',
                sr: 1,
                ks: {
                    o: { a: 0, k: 100 },
                    r: { a: 1, k: [{ t: 0, s: [0] }, { t: 90, s: [720] }] },
                    p: { a: 0, k: [70, 70, 0] },
                    a: { a: 0, k: [0, 0, 0] },
                    s: { a: 0, k: [100, 100, 100] }
                },
                shapes: [{
                    ty: 'gr',
                    it: [
                        { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [90, 90] } },
                        { ty: 'st', c: { a: 0, k: color }, o: { a: 0, k: 100 }, w: { a: 0, k: 8 }, lc: 2, lj: 2 },
                        { ty: 'tm', s: { a: 0, k: 8 }, e: { a: 0, k: 66 }, o: { a: 0, k: 0 } },
                        { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }
                    ]
                }],
                ip: 0,
                op: 90,
                st: 0,
                bm: 0
            },
            {
                ddd: 0,
                ind: 3,
                ty: 4,
                nm: 'Music note',
                sr: 1,
                ks: {
                    o: { a: 0, k: 100 },
                    r: { a: 0, k: -8 },
                    p: { a: 0, k: [70, 66, 0] },
                    a: { a: 0, k: [0, 0, 0] },
                    s: { a: 1, k: [{ t: 0, s: [72, 72, 100] }, { t: 14, s: [112, 112, 100] }, { t: 26, s: [100, 100, 100] }, { t: 90, s: [100, 100, 100] }] }
                },
                shapes: [{
                    ty: 'gr',
                    it: [
                        { ty: 'el', p: { a: 0, k: [-14, 23] }, s: { a: 0, k: [28, 22] } },
                        { ty: 'fl', c: { a: 0, k: color }, o: { a: 0, k: 100 }, r: 1 },
                        { ty: 'rc', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [8, 58] }, r: { a: 0, k: 4 } },
                        { ty: 'fl', c: { a: 0, k: color }, o: { a: 0, k: 100 }, r: 1 },
                        {
                            ty: 'sh',
                            ks: {
                                a: 0,
                                k: {
                                    i: [[0, 0], [0, 0], [0, 0], [0, 0]],
                                    o: [[0, 0], [0, 0], [0, 0], [0, 0]],
                                    v: [[4, -28], [34, -18], [34, -5], [4, -14]],
                                    c: true
                                }
                            }
                        },
                        { ty: 'fl', c: { a: 0, k: color }, o: { a: 0, k: 100 }, r: 1 },
                        { ty: 'tr', p: { a: 0, k: [8, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }
                    ]
                }],
                ip: 0,
                op: 90,
                st: 0,
                bm: 0
            }
        ]
    };

    return `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(animation))}`;
}

function buildPremiumAuthHtml({ type = 'error', title = '', message = '', context = 'login' }) {
    const lottieSrc = buildAuthLottieSrc(type);
    const safeTitle = escapeAuthHtml(title || (type === 'success' ? 'Success' : type === 'info' ? 'Notice' : 'Something went wrong'));
    const safeMessage = escapeAuthHtml(message);

    return `
        <div class="auth-premium-card">
            <div class="auth-premium-lottie-wrap auth-premium-lottie-${type}">
                <lottie-player class="auth-premium-lottie" src="${lottieSrc}" background="transparent" speed="1" loop autoplay></lottie-player>
                <span class="auth-premium-note" aria-hidden="true">
                    <i class="fas fa-music"></i>
                </span>
            </div>
            <h2 class="auth-premium-title">${safeTitle}</h2>
            <p class="auth-premium-message">${safeMessage}</p>
        </div>
    `;
}

function showPremiumAuthMessage(options = {}) {
    const type = ['success', 'error', 'info'].includes(options.type) ? options.type : 'error';
    if (typeof Swal !== 'undefined') {
        const hasTimerOption = Object.prototype.hasOwnProperty.call(options, 'timer');
        return Swal.fire({
            html: buildPremiumAuthHtml({ ...options, type }),
            width: 'auto',
            padding: 0,
            background: 'transparent',
            icon: undefined,
            showConfirmButton: options.showConfirmButton ?? type !== 'success',
            confirmButtonText: options.confirmButtonText || 'Got it',
            timer: hasTimerOption ? options.timer : (type === 'success' ? 1600 : undefined),
            timerProgressBar: options.timerProgressBar ?? type === 'success',
            buttonsStyling: false,
            showClass: {
                popup: 'auth-premium-show'
            },
            hideClass: {
                popup: 'auth-premium-hide'
            },
            customClass: {
                popup: `auth-premium-popup auth-premium-${type}`,
                htmlContainer: 'auth-premium-html',
                confirmButton: 'auth-premium-confirm',
                timerProgressBar: 'auth-premium-progress'
            }
        });
    }

    alert(options.message || options.title || 'Authentication message');
    return Promise.resolve();
}

// Show Message Helper (SweetAlert)
function showLoginMessage(message, type = 'error', title = '') {
    return showPremiumAuthMessage({
        type,
        context: 'login',
        title: title || (type === 'success' ? 'Login Successful' : type === 'info' ? 'Account Notice' : 'Login Failed'),
        message,
        detail: type === 'success' ? 'Preparing your dashboard.' : 'Please review your credentials and try again.'
    });
}

function showRegisterMessage(message, type = 'error', title = '') {
    return showPremiumAuthMessage({
        type,
        context: 'register',
        title: title || (type === 'success' ? 'Account Created' : type === 'info' ? 'Registration Notice' : 'Registration Failed'),
        message,
        detail: type === 'success' ? 'Check your email verification step next.' : 'Please review the highlighted registration details.',
        showConfirmButton: type === 'success' ? true : undefined,
        timer: type === 'success' ? null : undefined,
        timerProgressBar: type === 'success' ? false : undefined,
        confirmButtonText: type === 'success' ? 'Continue' : undefined
    });
}

async function promptEmailVerification(email, initialCode = '') {
    const verificationEmail = String(email || '').trim();
    let currentCode = String(initialCode || '').trim();
    if (!verificationEmail) {
        showRegisterMessage('Email address is required for verification.', 'error');
        return false;
    }

    if (typeof Swal === 'undefined') {
        showRegisterMessage('Verification code prompt is unavailable.', 'error');
        return false;
    }

    // ── Helper: build and show the 6-box OTP dialog ───────────────
    function showOtpDialog(prefill = '') {
        const digits = (prefill + '      ').slice(0, 6).split('');
        return Swal.fire({
            title: 'Verify Your Email',
            html: `
                <p class="swal2-html-container" style="margin:0 0 20px;font-size:0.95rem;color:#6b7280;">
                    We sent a 6-digit code to<br>
                    <strong style="color:#0f172a">${verificationEmail}</strong>
                </p>
                <div id="otpBoxes" style="display:flex;justify-content:center;gap:10px;margin:0 auto 6px;">
                    ${[0,1,2,3,4,5].map(i => `
                    <input id="otp${i}" type="text" inputmode="numeric" maxlength="1"
                        value="${digits[i].trim()}"
                        style="width:48px;height:56px;border:2px solid #e2e8f0;border-radius:12px;
                               text-align:center;font-size:1.5rem;font-weight:700;color:#0f172a;
                               outline:none;transition:border-color .15s,box-shadow .15s;
                               background:#f8fafc;"
                        oninput="
                            this.value=this.value.replace(/[^0-9]/g,'').slice(-1);
                            if(this.value){
                                var n=document.getElementById('otp${i < 5 ? i+1 : i}');
                                if(n){n.focus();n.select();}
                            }
                        "
                        onkeydown="
                            if(event.key==='Backspace'&&!this.value){
                                var p=document.getElementById('otp${i > 0 ? i-1 : 0}');
                                if(p){p.focus();p.select();}
                            }
                            if(event.key==='ArrowLeft'){
                                var p=document.getElementById('otp${i > 0 ? i-1 : 0}');
                                if(p){p.focus();p.select();}
                            }
                            if(event.key==='ArrowRight'){
                                var n=document.getElementById('otp${i < 5 ? i+1 : 5}');
                                if(n){n.focus();n.select();}
                            }
                        "
                        onfocus="this.style.borderColor='#d4af37';this.style.boxShadow='0 0 0 3px rgba(212,175,55,0.2)';"
                        onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none';"
                        onpaste="
                            event.preventDefault();
                            var p=event.clipboardData.getData('text').replace(/[^0-9]/g,'').slice(0,6);
                            for(var k=0;k<6;k++){
                                var b=document.getElementById('otp'+k);
                                if(b) b.value=p[k]||'';
                            }
                            var last=document.getElementById('otp'+(Math.min(p.length,5)));
                            if(last){last.focus();last.select();}
                        "
                    >
                    `).join('')}
                </div>
                <p style="font-size:0.75rem;color:#94a3b8;text-align:center;margin-top:4px;">
                    Check your spam folder if you don't see it.
                </p>
            `,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: '<i class="fas fa-check" style="margin-right:6px"></i>Verify',
            denyButtonText: '<i class="fas fa-rotate-right" style="margin-right:6px"></i>Resend',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#b8860b',
            denyButtonColor: '#475569',
            cancelButtonColor: '#6b7280',
            allowOutsideClick: false,
            focusConfirm: false,
            didOpen: () => {
                // Focus first empty box, or first box if prefilled
                const first = document.getElementById('otp0');
                if (first) {
                    first.focus();
                    if (first.value) first.select();
                }
            },
            preConfirm: () => {
                const code = [0,1,2,3,4,5]
                    .map(i => (document.getElementById('otp'+i)?.value || '').trim())
                    .join('');
                if (code.length !== 6 || !/^\d{6}$/.test(code)) {
                    Swal.showValidationMessage('Please enter all 6 digits.');
                    return false;
                }
                return code;
            }
        });
    }

    // ── Main loop ──────────────────────────────────────────────────
    while (true) {
        const result = await showOtpDialog(currentCode);

        if (result.isDismissed) {
            return false;
        }

        if (result.isDenied) {
            try {
                const resendResponse = await axios.post(
                    `${baseApiUrl}/users.php?action=resend-email-verification`,
                    { email: verificationEmail },
                    { validateStatus: () => true }
                );
                const resendData = resendResponse.data || {};
                if (resendResponse.status === 200 && resendData.success) {
                    if (!resendData.verification_email_sent) {
                        throw new Error(resendData.mail_error || resendData.message || 'Unable to send verification email.');
                    }
                    await Swal.fire({
                        icon: 'success',
                        title: 'Code Resent',
                        text: resendData.message || 'A new verification code has been sent to your email.',
                        confirmButtonColor: '#b8860b'
                    });
                } else {
                    throw new Error(resendData.error || 'Unable to resend verification code.');
                }
            } catch (error) {
                const message = error?.response?.data?.error || error?.message || 'Unable to resend verification code.';
                await Swal.fire({
                    icon: 'error',
                    title: 'Resend Failed',
                    text: message,
                    confirmButtonColor: '#b8860b'
                });
            }
            currentCode = '';
            continue;
        }

        const code = String(result.value || '').trim();
        if (!code) { currentCode = ''; continue; }

        try {
            const verifyResponse = await axios.post(
                `${baseApiUrl}/users.php?action=verify-email`,
                { email: verificationEmail, code },
                { validateStatus: () => true }
            );
            const verifyData = verifyResponse.data || {};

            if (verifyResponse.status === 200 && verifyData.success) {
                await Swal.fire({
                    icon: 'success',
                    title: 'Email Verified',
                    text: verifyData.message || 'Your email has been verified successfully.',
                    confirmButtonColor: '#b8860b'
                });
                return true;
            }

            const message = verifyData.error || verifyData.message || 'Verification failed. Please try again.';
            await Swal.fire({
                icon: 'error',
                title: 'Incorrect Code',
                text: message,
                confirmButtonColor: '#b8860b'
            });
            currentCode = '';

            if (verifyData.resend_required) { continue; }
        } catch (error) {
            const message = error?.response?.data?.error || error?.message || 'Verification failed. Please try again.';
            await Swal.fire({
                icon: 'error',
                title: 'Verification Failed',
                text: message,
                confirmButtonColor: '#b8860b'
            });
            currentCode = '';
        }
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

                showLoginMessage('Welcome back. Redirecting to your dashboard...', 'success', 'Login Successful');

                // Redirect based on role
                setTimeout(() => {
                    const roleCategory = getRoleCategory(data.user.role_name);
                    if (roleCategory === 'admin') {
                        window.location.href = 'pages/admin/admin_dashboard.html';
                    } else if (roleCategory === 'manager') {
                        window.location.href = 'pages/manager/manager_dashboard.html';
                    } else if (roleCategory === 'staff') {
                        window.location.href = 'pages/desk/desk_attendance.html';
                    } else if (roleCategory === 'instructor') {
                        window.location.href = 'pages/instructor/instructor_dashboard.html';
                    } else if (roleCategory === 'student') {
                        window.location.href = 'pages/student/student_dashboard.html';
                    } else if (roleCategory === 'guardian') {
                        window.location.href = 'pages/guardian/guardian_dashboard.html';
                    } else {
                        window.location.href = 'index.html';
                    }
                }, 1500);
            } else {
                const apiMessage = data && typeof data === 'object' ? data.error : '';
                const status = response.status;
                if (status === 403 && data && data.verification_required) {
                    await promptEmailVerification(data.verification_email || username);
                    if (loginBtn) loginBtn.disabled = false;
                    if (loginBtnText) loginBtnText.textContent = 'Sign In';
                    if (loginBtnIcon) {
                        loginBtnIcon.classList.remove('fa-spinner', 'fa-spin');
                        loginBtnIcon.classList.add('fa-sign-in-alt');
                    }
                    return;
                }
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

                showLoginMessage(message, icon === 'info' ? 'info' : 'error', title || 'Account Notice');
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
            if (status === 403 && error?.response?.data?.verification_required) {
                await promptEmailVerification(error?.response?.data?.verification_email || username);
                if (loginBtn) loginBtn.disabled = false;
                if (loginBtnText) loginBtnText.textContent = 'Sign In';
                if (loginBtnIcon) {
                    loginBtnIcon.classList.remove('fa-spinner', 'fa-spin');
                    loginBtnIcon.classList.add('fa-sign-in-alt');
                }
                return;
            }
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
            showLoginMessage(message, icon === 'info' ? 'info' : 'error', title || 'Account Notice');
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
                const response = await axios.post(`${baseApiUrl}/online_register.php?action=register`, payload);
                const data = response.data || {};

                if (response.status === 200 && data.success) {
                    const verificationEmail = data.verification_email || payload.student_email;
                    const emailSent = Boolean(data.verification_email_sent);
                    registerForm.reset();
                    toggleRegisterModal(false);
                    if (emailSent) {
                        await Swal.fire({
                            icon: 'success',
                            title: 'Check Your Email',
                            text: `We sent a 6-digit code to ${verificationEmail}.`,
                            confirmButtonColor: '#b8860b'
                        });
                    } else {
                        await Swal.fire({
                            icon: 'error',
                            title: 'Email Delivery Failed',
                            text: data.mail_error || data.message || 'The verification email could not be sent.',
                            confirmButtonColor: '#b8860b'
                        });
                    }
                    await showRegisterMessage(
                        data.message || 'Your student account was created.',
                        emailSent ? 'success' : 'info',
                        'Account Created'
                    );
                    if (emailSent) {
                        await promptEmailVerification(verificationEmail);
                    }
                } else {
                    showRegisterMessage(data.error || 'Registration failed. Please try again.', 'error');
                }
            } catch (error) {
                console.error('Basic registration error:', error);
                const serverError = error?.response?.data?.error;
                showRegisterMessage(serverError || error?.message || 'Network error. Please try again.', 'error');
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

function cleanSessionNoteText(text, fallback = '—') {
    const raw = String(text || '').trim();
    if (!raw) return fallback;

    const systemNotes = new Set([
        'completed from manual attendance',
        'completed from attendance check-in',
        'completed from qr attendance',
        'attendance recorded'
    ]);
    const seen = new Set();
    const parts = raw
        .split('|')
        .map(part => part.trim())
        .filter(part => {
            if (!part) return false;
            const key = part.toLowerCase();
            if (systemNotes.has(key)) return false;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

    return parts.length ? parts.join(' | ') : fallback;
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

    if (!emailValidation) {
        return email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    if (email.length === 0) {
        emailValidation.textContent = '';
        emailValidation.className = 'mt-1 text-xs';
        return false;
    }

    // Allow standard addresses (including Gmail +tags)
    const emailPattern = /^[a-zA-Z0-9]([a-zA-Z0-9._+\-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;

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
            const paymentType = escapeHtml(r.payment_type || 'Partial Payment');
            const payableNow = Number(r.payable_now || 0);
            const paymentCellHtml = `
                    <div class="space-y-2">
                        <div class="font-semibold text-slate-800">${paymentType}</div>
                        <button type="button" onclick="openPendingRequestPaymentModal(${Number(r.request_id)})" class="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition">
                            Payment Info
                        </button>
                    </div>
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
                    <td class="px-6 py-4 text-sm text-slate-700">Based on instructor availability</td>
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
                    <div><span class="font-semibold text-slate-900">Schedule Basis:</span> Instructor availability</div>
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
    '<i id="newPasswordEye" class="fas fa-eye" style="cursor:pointer;" onclick="togglePassword(\'swal-new-password\', \'newPasswordEye\')"></i>' +
    '<input id="swal-confirm-password" class="swal2-input" type="password" placeholder="Confirm new password">' +
    '<i id="confirmPasswordEye" class="fas fa-eye" style="cursor:pointer;" onclick="togglePassword(\'swal-confirm-password\', \'confirmPasswordEye\')"></i>',
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
    if (!user || getRoleCategory(user.role_name) !== 'admin') {
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
    if (!user || getRoleCategory(user.role_name) !== 'student') {
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
    if (!user || getRoleCategory(user.role_name) !== 'guardian') {
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

function checkBranchScopedAuth() {
    const user = Auth.getUser();
    const roleCategory = getRoleCategory(user?.role_name);
    if (!user || (roleCategory !== 'manager' && roleCategory !== 'staff')) {
        Swal.fire({
            icon: 'warning',
            title: 'Access Denied',
            text: 'You must be logged in as branch staff or a branch manager to access this page.',
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

function checkInstructorAuth() {
    const user = Auth.getUser();
    if (!user || getRoleCategory(user.role_name) !== 'instructor') {
        Swal.fire({
            icon: 'warning',
            title: 'Access Denied',
            text: 'You must be logged in as an Instructor to access this page.',
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

async function fetchStudentPortalDataByEmail(email) {
    const url = `${baseApiUrl}/students.php?action=get-student-portal&email=${encodeURIComponent(email)}`;
    try {
        const res = await axios.get(url);
        return res.data;
    } catch (error) {
        const message = String(error?.response?.data?.error || '');
        if (error?.response?.status === 404 && message.toLowerCase().includes('student not found for this email')) {
            return {
                success: true,
                registration_required: true,
                message: 'Your previous registration is no longer active. Please register again to continue.',
                student: null,
                guardians: [],
                primary_guardian: null,
                instruments: [],
                current_enrollment: null,
                enrollment_history: [],
                current_session_grades: []
            };
        }
        throw error;
    }
}

async function handleStudentRegistrationReset(portal, fallbackMessage) {
    if (!portal?.registration_required) {
        return false;
    }

    const message = portal.message || fallbackMessage || 'Your registration is no longer active. Please register again.';

    if (typeof Swal !== 'undefined' && Swal.fire) {
        await Swal.fire({
            icon: 'info',
            title: 'Register Again',
            text: message,
            confirmButtonText: 'OK'
        });
    } else {
        alert(message);
    }

    Auth.logout();
    return true;
}

function buildStudentPerformanceMetrics(rows) {
    const rubricRows = Array.isArray(rows) ? rows.filter(row => Number(row?.progress_id || 0) > 0) : [];
    const rubricDefinitions = [
        { label: 'Rhythm', source: 'rhythm_score', helper: 'Timing and pulse' },
        { label: 'Technique', source: 'technique_score', helper: 'Hand control and accuracy' },
        { label: 'Sight Reading', source: 'assignment_score', helper: 'Reading and response' },
        { label: 'Performance Confidence', source: 'performance_score', helper: 'Stage presence and confidence' },
        { label: 'Theory Knowledge', source: 'focus_score', helper: 'Focus and musical understanding' }
    ];

    return rubricDefinitions.map(item => {
        const values = rubricRows
            .map(row => Number(row?.[item.source] || 0))
            .filter(value => Number.isFinite(value) && value > 0);
        const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
        return {
            ...item,
            average,
            percent: average === null ? null : Math.max(0, Math.min(100, Math.round((average / 5) * 100)))
        };
    });
}

function renderStudentPerformanceProfile(metrics, rows) {
    const validMetrics = Array.isArray(metrics) ? metrics : [];
    const gradedRows = Array.isArray(rows)
        ? rows.filter(row => Number(row?.progress_id || 0) > 0)
        : [];
    const hasData = validMetrics.some(metric => Number(metric?.percent || 0) > 0);

    if (!validMetrics.length || !hasData) {
        return `
            <div class="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 shadow-xl dark:shadow-black/40 mb-8">
                <div class="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.28em] text-gold-500">Performance Profile</p>
                        <h2 class="portal-section-title text-zinc-900 dark:text-white">Your Progress</h2>
                    </div>
                </div>
                <div class="mt-6 rounded-3xl border border-dashed border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    Grade a few sessions and your progress profile will appear here.
                </div>
            </div>
        `;
    }

    const availableMetrics = validMetrics.filter(metric => Number.isFinite(Number(metric.percent)) && Number(metric.percent) > 0);
    const averagePercent = availableMetrics.length
        ? Math.round(availableMetrics.reduce((sum, metric) => sum + Number(metric.percent || 0), 0) / availableMetrics.length)
        : 0;
    const strongestMetric = availableMetrics.slice().sort((a, b) => Number(b.percent || 0) - Number(a.percent || 0))[0] || null;
    const radarId = 'studentPerformanceRadarChart';
    const radarEmptyId = 'studentPerformanceRadarEmpty';

    return `
        <div class="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 shadow-xl dark:shadow-black/40 mb-8">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p class="text-xs font-bold uppercase tracking-[0.28em] text-gold-500">Performance Profile</p>
                    <h2 class="portal-section-title text-zinc-900 dark:text-white">Your Progress</h2>
                    <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Based on ${gradedRows.length} graded session${gradedRows.length === 1 ? '' : 's'}.
                    </p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <span class="inline-flex items-center rounded-full border border-gold-200 bg-gold-50 px-3 py-1.5 text-xs font-bold text-gold-700 dark:border-gold-500/20 dark:bg-gold-500/10 dark:text-gold-300">
                        Avg ${averagePercent}%
                    </span>
                    ${strongestMetric ? `<span class="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">${escapeHtml(strongestMetric.label)} leading</span>` : ''}
                </div>
            </div>

            <div class="mt-6 grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.95fr)] gap-8 items-center">
                <div class="relative rounded-3xl border border-zinc-100 dark:border-white/10 bg-gradient-to-br from-white to-zinc-50 dark:from-white/5 dark:to-white/3 p-5 min-h-[320px]">
                    <canvas id="${radarId}" aria-label="Student performance radar chart"></canvas>
                    <div id="${radarEmptyId}" class="hidden absolute inset-0 flex items-center justify-center text-center px-8 text-sm text-zinc-500 dark:text-zinc-400">
                        Grade a session to see the radar snapshot.
                    </div>
                </div>

                <div class="space-y-0 divide-y divide-zinc-100 dark:divide-white/10 rounded-3xl border border-zinc-100 dark:border-white/10 bg-white dark:bg-black/20 overflow-hidden">
                    ${validMetrics.map(metric => {
                        const percent = Number.isFinite(Number(metric.percent)) ? Number(metric.percent) : 0;
                        const helperText = metric.helper
                            ? `<div class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">${escapeHtml(metric.helper)}</div>`
                            : '';
                        return `
                            <div class="px-5 py-4 flex items-start justify-between gap-4">
                                <div class="min-w-0">
                                    <div class="flex items-center gap-2">
                                        <span class="h-2.5 w-2.5 rounded-full bg-gold-500 shrink-0"></span>
                                        <div class="text-base font-semibold text-zinc-900 dark:text-white">${escapeHtml(metric.label)}</div>
                                    </div>
                                    ${helperText}
                                </div>
                                <div class="text-lg font-black text-zinc-900 dark:text-white shrink-0">${percent}%</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderStudentPerformanceRadar(metrics) {
    const validMetrics = Array.isArray(metrics) ? metrics : [];
    const radarCanvas = document.getElementById('studentPerformanceRadarChart');
    const radarEmpty = document.getElementById('studentPerformanceRadarEmpty');

    if (_studentPerformanceRadarChartInstance) {
        _studentPerformanceRadarChartInstance.destroy();
        _studentPerformanceRadarChartInstance = null;
    }

    const hasData = validMetrics.some(metric => Number(metric?.percent || 0) > 0);
    if (!radarCanvas) return;

    if (!hasData || typeof Chart === 'undefined') {
        radarCanvas.style.display = 'none';
        if (radarEmpty) radarEmpty.classList.remove('hidden');
        return;
    }

    if (radarEmpty) radarEmpty.classList.add('hidden');
    radarCanvas.style.display = '';

    _studentPerformanceRadarChartInstance = new Chart(radarCanvas, {
        type: 'radar',
        data: {
            labels: validMetrics.map(metric => metric.label),
            datasets: [{
                data: validMetrics.map(metric => Number(metric.percent || 0)),
                borderColor: '#b8860b',
                backgroundColor: 'rgba(184, 134, 11, 0.16)',
                pointBackgroundColor: '#b8860b',
                pointBorderColor: '#ffffff',
                pointHoverBackgroundColor: '#b8860b',
                pointHoverBorderColor: '#ffffff',
                pointRadius: 4,
                borderWidth: 2.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                r: {
                    min: 0,
                    max: 100,
                    ticks: {
                        stepSize: 20,
                        backdropColor: 'transparent',
                        color: '#9ca3af',
                        font: { size: 10, weight: '600' }
                    },
                    grid: { color: 'rgba(212,175,55,0.12)' },
                    angleLines: { color: 'rgba(212,175,55,0.12)' },
                    pointLabels: {
                        color: '#374151',
                        font: { size: 11, weight: '700' }
                    }
                }
            }
        }
    });
}

function getStudentCertificateState(portal) {
    const enrollment = portal?.current_enrollment || null;
    const student = portal?.student || {};
    const packageSessions = Number(enrollment?.package_sessions || student?.package_sessions || 0);
    const completedSessionsRaw = Number(enrollment?.completed_sessions || 0);
    const gradedSessions = Array.isArray(portal?.current_session_grades)
        ? portal.current_session_grades.filter((row) => Number(row?.progress_id || 0) > 0).length
        : 0;
    const completedSessions = Math.max(completedSessionsRaw, gradedSessions);
    const enrollmentStatus = String(enrollment?.status || '').trim().toLowerCase();
    const isAvailable = enrollmentStatus === 'completed'
        || (packageSessions > 0 && completedSessions >= packageSessions);

    return {
        isAvailable,
        packageSessions,
        completedSessions,
        enrollmentStatus,
        studentName: `${student?.first_name || ''} ${student?.last_name || ''}`.trim() || 'Student',
        packageName: enrollment?.package_name || student?.package_name || 'Lesson Package',
        teacherName: `${enrollment?.teacher_first_name || ''} ${enrollment?.teacher_last_name || ''}`.trim() || 'Teacher',
        issueDate: enrollment?.end_date || enrollment?.updated_at || enrollment?.created_at || new Date().toISOString().slice(0, 10),
        branchName: student?.branch_name || enrollment?.branch_name || 'Father & Sons Music'
    };
}

function isStudentEnrollmentCompleted(portal) {
    return Boolean(getStudentCertificateState(portal).isAvailable);
}

function renderStudentCertificateCard(portal) {
    const state = getStudentCertificateState(portal);
    if (!state.isAvailable) {
        return '';
    }

    const issuedLabel = formatDateLong(state.issueDate) || state.issueDate;
    return `
        <section class="rounded-[1.75rem] border border-gold-200/80 dark:border-gold-500/20 bg-gradient-to-br from-gold-50 via-white to-amber-50 dark:from-gold-500/10 dark:via-white/5 dark:to-white/3 px-5 py-5 sm:px-6 sm:py-5 mb-6">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div class="flex items-start gap-4">
                    <div class="h-14 w-14 rounded-2xl bg-gold-500 text-black grid place-items-center shrink-0">
                        <i class="fas fa-certificate text-2xl"></i>
                    </div>
                    <div class="min-w-0">
                        <p class="text-xs font-black uppercase tracking-[0.3em] text-gold-600 dark:text-gold-300">Certificate Unlocked</p>
                        <h2 class="mt-1 text-2xl font-black text-zinc-900 dark:text-white">Completion Certificate Ready</h2>
                        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300 max-w-2xl">
                            You finished ${escapeHtml(String(state.completedSessions))} of ${escapeHtml(String(state.packageSessions || state.completedSessions))} sessions for ${escapeHtml(state.packageName)}.
                        </p>
                        <div class="mt-3 flex flex-wrap gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                            <span class="inline-flex items-center rounded-full border border-gold-200 bg-white/80 px-3 py-1.5 dark:border-gold-500/20 dark:bg-white/5">
                                <i class="fas fa-user-graduate mr-2 text-gold-500"></i>${escapeHtml(state.studentName)}
                            </span>
                            <span class="inline-flex items-center rounded-full border border-gold-200 bg-white/80 px-3 py-1.5 dark:border-gold-500/20 dark:bg-white/5">
                                <i class="fas fa-chalkboard-teacher mr-2 text-gold-500"></i>${escapeHtml(state.teacherName)}
                            </span>
                            <span class="inline-flex items-center rounded-full border border-gold-200 bg-white/80 px-3 py-1.5 dark:border-gold-500/20 dark:bg-white/5">
                                <i class="fas fa-calendar-check mr-2 text-gold-500"></i>${escapeHtml(issuedLabel)}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button type="button" onclick="openStudentCertificatePreview()" class="px-5 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-extrabold transition">
                        <i class="fas fa-eye mr-2"></i>View Certificate
                    </button>
                    <button type="button" onclick="printStudentCertificate()" class="px-5 py-3 rounded-2xl bg-gold-500 hover:bg-gold-400 text-black text-sm font-extrabold transition">
                        <i class="fas fa-print mr-2"></i>Print / Save PDF
                    </button>
                </div>
            </div>
        </section>
    `;
}

function renderStudentCompletedSessionsPanel(portal) {
    const state = getStudentCertificateState(portal);
    if (!state.isAvailable) {
        return '';
    }

    const completionEntries = [];
    const enrollment = portal?.current_enrollment || null;

    if (enrollment) {
        completionEntries.push(enrollment);
    }

    (Array.isArray(portal?.enrollment_history) ? portal.enrollment_history : []).forEach((row) => {
        if (!row) return;
        const enrollmentId = Number(row.enrollment_id || 0);
        if (enrollmentId > 0 && completionEntries.some((item) => Number(item?.enrollment_id || 0) === enrollmentId)) {
            return;
        }
        completionEntries.push(row);
    });

    const rows = completionEntries
        .filter((row) => {
            const rowStatus = String(row?.status || '').trim().toLowerCase();
            const rowCompletedSessions = Number(row?.completed_sessions || 0);
            const rowPackageSessions = Number(row?.package_sessions || state.packageSessions || 0);
            return rowStatus === 'completed' || (rowPackageSessions > 0 && rowCompletedSessions >= rowPackageSessions);
        })
        .sort((a, b) => {
            const aTime = new Date(a?.end_date || a?.updated_at || a?.created_at || 0).getTime() || 0;
            const bTime = new Date(b?.end_date || b?.updated_at || b?.created_at || 0).getTime() || 0;
            if (aTime !== bTime) return bTime - aTime;
            return Number(b?.enrollment_id || 0) - Number(a?.enrollment_id || 0);
        });

    const historyMarkup = rows.length
        ? rows.map((row) => {
            const completedLabel = formatDateLong(row?.end_date || row?.updated_at || row?.created_at || '') || 'Not set';
            const paymentLabel = String(row?.payment_type || 'Partial Payment');
            const amountLabel = formatCurrencyPHP(Number(row?.total_amount || 0));
            const rowCompletedSessions = Number(row?.completed_sessions || 0);
            const rowRequiredSessions = Number(row?.package_sessions || row?.total_sessions || state.packageSessions || rowCompletedSessions || 0);
            const displayCompletedSessions = rowCompletedSessions > 0
                ? rowCompletedSessions
                : (String(row?.status || '').trim().toLowerCase() === 'completed' ? rowRequiredSessions : 0);
            const sessionLabel = `${displayCompletedSessions} of ${rowRequiredSessions || displayCompletedSessions} sessions`;

            return `
                <article class="rounded-[1.5rem] border border-zinc-200/80 dark:border-white/10 bg-zinc-50/80 dark:bg-white/5 px-5 py-4 sm:px-6 sm:py-5">
                    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div class="flex items-start gap-4 min-w-0">
                            <div class="h-12 w-12 rounded-2xl border border-gold-100 dark:border-white/10 bg-gold-50 dark:bg-white/5 text-gold-600 grid place-items-center shrink-0">
                                <i class="fas fa-calendar-check text-lg"></i>
                            </div>
                            <div class="min-w-0">
                                <div class="text-lg font-extrabold text-zinc-900 dark:text-white truncate">${escapeHtml(row?.package_name || 'Session Package')}</div>
                                <div class="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Completed on ${escapeHtml(completedLabel)}</div>
                            </div>
                        </div>
                        <span class="inline-flex items-center self-start rounded-full border border-gold-200 bg-gold-50 px-3 py-1.5 text-xs font-bold text-gold-700 dark:border-gold-500/20 dark:bg-gold-500/10 dark:text-gold-300">
                            Completed
                        </span>
                    </div>
                </article>
            `;
        }).join('')
        : `
            <div class="rounded-[1.75rem] border border-dashed border-zinc-300 dark:border-white/10 bg-zinc-50/70 dark:bg-white/5 px-6 py-10 text-center text-zinc-500 dark:text-zinc-400">
                Your completed lessons will appear here.
            </div>
        `;

    return `
        <section class="rounded-[1.75rem] border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-white/5 px-5 py-5 sm:px-6 sm:py-6 mb-6">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 class="portal-section-title text-zinc-900 dark:text-white">Session History</h2>
                    <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Your completed lesson packages.</p>
                </div>
                <span class="inline-flex items-center rounded-full border border-gold-200 bg-gold-50 px-4 py-2 text-sm font-bold text-gold-700 dark:border-gold-500/20 dark:bg-gold-500/10 dark:text-gold-300 self-start sm:self-auto">
                    Completed
                </span>
            </div>
            <div class="mt-5 space-y-4">
                ${historyMarkup}
            </div>
        </section>
    `;
}

function ensureStudentCertificateModal() {
    let modal = document.getElementById('studentCertificateModal');
    if (modal) {
        return modal;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
        <div id="studentCertificateModal" class="fixed inset-0 z-[80] hidden bg-black/60 backdrop-blur-sm p-0 sm:p-4" aria-hidden="true">
            <div class="min-h-full flex items-stretch sm:items-center justify-center">
                <div class="w-full h-full sm:h-auto sm:max-h-[94vh] sm:max-w-5xl bg-white dark:bg-obsidian rounded-none sm:rounded-3xl border-0 sm:border sm:border-zinc-200 dark:sm:border-white/10 shadow-2xl overflow-hidden">
                    <div class="flex items-center justify-between gap-4 px-4 sm:px-6 py-4 border-b border-zinc-200 dark:border-white/10">
                        <div>
                            <div class="text-xs uppercase tracking-[0.25em] text-gold-600 dark:text-gold-300 font-bold">Certificate</div>
                            <div class="text-lg font-extrabold text-zinc-900 dark:text-white mt-1">Completion Certificate Preview</div>
                        </div>
                        <button type="button" onclick="closeStudentCertificatePreview()" class="h-10 w-10 rounded-full border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 transition" aria-label="Close certificate preview">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="overflow-y-auto max-h-[calc(100vh-73px)] sm:max-h-[calc(94vh-73px)] px-4 sm:px-6 py-5 bg-zinc-50/80 dark:bg-black/20">
                        <div id="studentCertificatePreview" class="mx-auto max-w-4xl"></div>
                        <div class="mt-4 flex flex-wrap justify-end gap-3">
                            <button type="button" onclick="printStudentCertificate()" class="px-4 py-3 rounded-2xl bg-gold-500 hover:bg-gold-400 text-black text-sm font-extrabold transition">
                                <i class="fas fa-print mr-2"></i>Print / Save PDF
                            </button>
                            <button type="button" onclick="closeStudentCertificatePreview()" class="px-4 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-extrabold transition">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(wrapper.firstElementChild);
    return document.getElementById('studentCertificateModal');
}

function buildStudentCertificateMarkup(portal) {
    const state = getStudentCertificateState(portal);
    const issuedLabel = formatDateLong(state.issueDate) || state.issueDate;
    return `
        <div class="certificate-sheet relative overflow-hidden rounded-[2rem] border-2 border-gold-200 bg-white p-6 sm:p-10 shadow-2xl shadow-black/10">
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.18),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(184,134,11,0.12),_transparent_35%)]"></div>
            <div class="relative">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <p class="text-[11px] font-black uppercase tracking-[0.45em] text-gold-600">Father & Sons Music</p>
                        <h3 class="mt-2 text-3xl sm:text-5xl font-black text-zinc-900">Certificate of Completion</h3>
                    </div>
                    <div class="h-16 w-16 rounded-2xl bg-gold-500 text-black grid place-items-center shadow-lg shadow-gold-500/20 shrink-0">
                        <i class="fas fa-award text-3xl"></i>
                    </div>
                </div>

                <div class="mt-10 text-center">
                    <p class="text-sm font-bold uppercase tracking-[0.3em] text-zinc-500">This certifies that</p>
                    <div class="mt-4 text-3xl sm:text-5xl font-black text-zinc-900">${escapeHtml(state.studentName)}</div>
                    <p class="mt-4 text-base sm:text-lg text-zinc-600">
                        has successfully completed the <span class="font-bold text-zinc-900">${escapeHtml(state.packageName)}</span> lesson package
                        at <span class="font-bold text-zinc-900">${escapeHtml(state.branchName)}</span>.
                    </p>
                </div>

                <div class="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div class="rounded-3xl border border-zinc-200 bg-white/80 px-5 py-4 text-center">
                        <div class="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-bold">Sessions Completed</div>
                        <div class="mt-2 text-3xl font-black text-zinc-900">${escapeHtml(String(state.completedSessions))}</div>
                    </div>
                    <div class="rounded-3xl border border-zinc-200 bg-white/80 px-5 py-4 text-center">
                        <div class="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-bold">Required Sessions</div>
                        <div class="mt-2 text-3xl font-black text-zinc-900">${escapeHtml(String(state.packageSessions || state.completedSessions))}</div>
                    </div>
                    <div class="rounded-3xl border border-zinc-200 bg-white/80 px-5 py-4 text-center">
                        <div class="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-bold">Issued On</div>
                        <div class="mt-2 text-lg font-black text-zinc-900">${escapeHtml(issuedLabel)}</div>
                    </div>
                </div>

                <div class="mt-10 flex items-end justify-between gap-6">
                    <div class="text-left">
                        <div class="text-xs uppercase tracking-[0.3em] text-zinc-500 font-bold">Teacher</div>
                        <div class="mt-2 text-lg font-bold text-zinc-900">${escapeHtml(state.teacherName)}</div>
                        <div class="text-sm text-zinc-500">Lesson instructor</div>
                    </div>
                    <div class="text-right">
                        <div class="text-xs uppercase tracking-[0.3em] text-zinc-500 font-bold">Status</div>
                        <div class="mt-2 text-lg font-black text-emerald-600">Completed</div>
                        <div class="text-sm text-zinc-500">Ready for print</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderStudentCertificatePreview(portal) {
    const modal = ensureStudentCertificateModal();
    const preview = document.getElementById('studentCertificatePreview');
    if (!modal || !preview) return false;
    preview.innerHTML = buildStudentCertificateMarkup(portal);
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    return true;
}

function closeStudentCertificatePreview() {
    const modal = document.getElementById('studentCertificateModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
}

function openStudentCertificatePreview() {
    const portal = studentDashboardPortalState || studentDashboardMetaState || null;
    if (!portal) {
        showMessage('Certificate details are not available yet.', 'error');
        return;
    }
    const state = getStudentCertificateState(portal);
    if (!state.isAvailable) {
        showMessage('Your certificate will unlock after all sessions are completed.', 'error');
        return;
    }
    renderStudentCertificatePreview(portal);
}

function printStudentCertificate() {
    const portal = studentDashboardPortalState || studentDashboardMetaState || null;
    if (!portal) {
        showMessage('Certificate details are not available yet.', 'error');
        return;
    }
    const state = getStudentCertificateState(portal);
    if (!state.isAvailable) {
        showMessage('Your certificate will unlock after all sessions are completed.', 'error');
        return;
    }

    const html = buildStudentCertificateMarkup(portal);
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';

    const cleanup = () => {
        window.setTimeout(() => {
            try {
                iframe.remove();
            } catch (error) {
                console.warn('Unable to remove certificate print iframe.', error);
            }
        }, 1500);
    };

    iframe.onload = () => {
        try {
            const win = iframe.contentWindow;
            if (!win) {
                cleanup();
                return;
            }
            win.focus();
            win.print();
        } catch (error) {
            console.warn('Unable to print certificate iframe.', error);
        } finally {
            cleanup();
        }
    };

    const doc = `
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>Completion Certificate</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        html, body { margin: 0; padding: 0; background: #f4f1e8; font-family: Inter, Arial, sans-serif; }
        .print-wrap { max-width: 1100px; margin: 0 auto; padding: 32px; }
        @media print {
            html, body { background: #fff; }
            .print-wrap { padding: 0; max-width: none; }
        }
    </style>
</head>
<body>
    <div class="print-wrap">${html}</div>
</body>
</html>`;

    document.body.appendChild(iframe);
    iframe.srcdoc = doc;
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
        valid_today: 'Ready to scan',
        early: 'Not yet',
        missed: 'Missed today',
        completed: 'Done for today',
        schedule_frozen: 'On hold',
        room_required: 'Ask the desk',
        no_session: 'No class today'
    };
    const banner = document.getElementById('qrStatusBanner');
    const titleEl = document.getElementById('studentQrStatusTitle');
    const messageEl = document.getElementById('studentQrStatusMessage');
    const styles = {
        valid_today: 'block border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
        early: 'block border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
        missed: 'block border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
        completed: 'block border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200',
        schedule_frozen: 'block border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
        room_required: 'block border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
        no_session: 'block border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-500/30 dark:bg-zinc-500/10 dark:text-zinc-200'
    };

    if (titleEl) titleEl.textContent = titleMap[code] || 'Status';
    if (messageEl) messageEl.textContent = status?.message || '';
    if (banner) {
        banner.className = `w-full mb-4 rounded-2xl border px-4 py-3 text-sm font-medium ${styles[code] || styles.no_session}`;
        banner.textContent = status?.message || '';
        banner.classList.toggle('hidden', !status?.message);
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

function getRegistrationFeeDueAmount(studentOrMeta = null) {
    const source = studentOrMeta && typeof studentOrMeta === 'object' ? studentOrMeta : {};
    const total = Number(source.registration_fee_amount || 1000);
    const paid = Number(source.registration_fee_paid || 0);
    const explicitDue = source.registration_fee_due !== undefined && source.registration_fee_due !== null
        ? Number(source.registration_fee_due)
        : null;
    if (Number.isFinite(explicitDue)) {
        return Math.max(0, explicitDue);
    }
    return Math.max(0, total - paid);
}

function computeStudentRequestPayableNow(basePrice, sessions, paymentRaw, registrationFeeDue = 0) {
    const price = Number(basePrice || 0);
    const s = Number(sessions || 0);
    const v = String(paymentRaw || '').toLowerCase();
    const regDue = Math.max(0, Number(registrationFeeDue || 0));
    if (price <= 0) return regDue;
    const ratio = s === 12 ? (3000 / 7450) : (s === 20 ? (5000 / 11800) : 0.42);
    const partial = Math.round(price * ratio);
    if (v === 'full' || v === 'full payment' || v === 'fullpayment') return price + regDue;
    if (v === 'partial payment' || v === 'partial' || v === 'downpayment') return partial + regDue;
    if (v === 'installment') {
        return Math.max(1, Math.round(price / Math.max(1, s || 1))) + regDue;
    }
    return partial + regDue;
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
    const reserveNotice = getScheduleFreezeReservationNotice(enrollment);
    return `
        <div class="rounded-xl border border-white/10 bg-black/20 p-4">
            <div class="flex items-center justify-between gap-2">
                <div class="text-base font-bold text-white">ENROLLED: ${escapeHtml(enrollment.package_name || 'Package')}</div>
                <span class="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold ${enrollmentStatusBadgeClass(status)}">${escapeHtml(status)}</span>
            </div>
            ${reserveNotice ? `
                <div class="mt-4 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    <div class="font-extrabold">${escapeHtml(reserveNotice.title)}</div>
                    <div class="mt-1 text-amber-50/90">${escapeHtml(reserveNotice.text)}</div>
                </div>
            ` : ''}
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

function getScheduleFreezeReservationNotice(enrollment) {
    if (!enrollment) return null;
    const scheduleStatus = String(enrollment.schedule_status || '').trim().toLowerCase();
    const paymentStatus = String(enrollment.__freeze_payment_status || '').trim().toLowerCase();
    const usedAbsences  = Number(enrollment.used_absences || 0);
    if (paymentStatus === 'paid' || scheduleStatus === 'active') return null;
    const freezeRequired = Number(enrollment.schedule_freeze_required || 0) === 1
        || scheduleStatus === 'frozen'
        || (enrollment.schedule_freeze_required === undefined && !scheduleStatus && usedAbsences >= 3);
    if (!freezeRequired) return null;
    const amount = Number(enrollment.reservation_fee_amount || 100) || 100;
    const amountLabel = formatCurrencyPHP(amount).replace(/\.00$/, '');
    return {
        amount,
        usedAbsences,
        title: `PAY ${amountLabel} to reserve slot`,
        text: `You have ${usedAbsences} recorded absence${usedAbsences === 1 ? '' : 's'}. Please pay the reservation fee to hold your class slot.`
    };
}

function renderEnrollmentHistoryList(history) {
    const rows = (Array.isArray(history) ? history.slice() : []).sort((a, b) => {
        const aTime = new Date(a?.first_session_date || a?.start_date || a?.enrollment_date || a?.created_at || 0).getTime() || 0;
        const bTime = new Date(b?.first_session_date || b?.start_date || b?.enrollment_date || b?.created_at || 0).getTime() || 0;
        if (aTime !== bTime) return bTime - aTime;
        return Number(b?.enrollment_id || 0) - Number(a?.enrollment_id || 0);
    });

    if (!rows.length) {
        return '<div class="text-sm text-zinc-500">No previous enrollments yet.</div>';
    }
    return rows.map(row => {
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

function bindGuardianPortalNav() {
    const toggleBtn = document.getElementById('guardianMobileMenuToggle');
    const menu = document.getElementById('guardianMobileMenu');
    if (!toggleBtn || !menu || menu.dataset.bound === 'true') return;

    menu.dataset.bound = 'true';
    toggleBtn.addEventListener('click', () => {
        menu.classList.toggle('hidden');
    });
    menu.addEventListener('click', (event) => {
        if (event.target === menu) {
            menu.classList.add('hidden');
        }
    });
    menu.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => menu.classList.add('hidden'));
    });
}

function getGuardianPrimaryGuardian(portal, user = null) {
    const guardians = Array.isArray(portal?.guardians) ? portal.guardians : [];
    const email = String(user?.email || '').trim().toLowerCase();
    const matched = guardians.find((guardian) => String(guardian?.email || '').trim().toLowerCase() === email);
    return matched || guardians[0] || portal?.primary_guardian || null;
}

function getGuardianStudentBranchName(item) {
    const student = item?.student || item || {};
    return String(
        student?.branch_name
        || item?.branch_name
        || item?.current_enrollment?.branch_name
        || student?.current_enrollment?.branch_name
        || ''
    ).trim();
}

function getGuardianPortalBranchLabel(portal) {
    const directBranch = String(
        portal?.branch_name
        || portal?.branch
        || portal?.branchName
        || portal?.current_enrollment?.branch_name
        || ''
    ).trim();
    if (directBranch) return directBranch;

    const students = Array.isArray(portal?.students) ? portal.students : [];
    const uniqueBranches = Array.from(new Set(
        students
            .map((item) => getGuardianStudentBranchName(item))
            .filter(Boolean)
    ));
    if (uniqueBranches.length === 0) return '—';
    if (uniqueBranches.length === 1) return uniqueBranches[0];
    return uniqueBranches.join(', ');
}

function getStudentPortalBranchLabel(studentOrPortal) {
    const portal = studentOrPortal?.student ? studentOrPortal : null;
    const student = portal ? portal.student : (studentOrPortal || {});
    const branchName = student?.branch_name
        || student?.branch
        || student?.branchName
        || student?.current_branch_name
        || student?.enrollment_branch_name
        || portal?.current_enrollment?.branch_name
        || portal?.branch_name
        || window.__studentPortalBranchLabel
        || '—';
    return String(branchName).trim() || '—';
}

function applyStudentPortalIdentity(user, studentOrPortal = null) {
    const portal = studentOrPortal?.student ? studentOrPortal : null;
    const student = portal ? portal.student : (studentOrPortal || {});
    const displayName = `${student?.first_name || ''} ${student?.last_name || ''}`.trim()
        || String(student?.student_name || student?.full_name || student?.display_name || student?.name || '').trim()
        || user?.username
        || user?.email
        || 'Student';
    const email = student?.email || portal?.student?.email || user?.email || '—';
    const branchName = getStudentPortalBranchLabel(studentOrPortal);

    window.__studentPortalBranchLabel = branchName;

    setText('studentNavName', displayName);
    setText('studentMobileMenuName', displayName);
    ['studentSidebarName', 'studentSidebarMobileName', 'studentName', 'studentNameMobile'].forEach((id) => setText(id, displayName));
    ['studentSidebarEmail', 'studentSidebarMobileEmail', 'studentEmail', 'studentEmailMobile'].forEach((id) => setText(id, email));
    if (typeof window.setPortalBranchText === 'function') {
        window.setPortalBranchText('#studentSidebarBranch, #studentSidebarMobileBranch, #studentBranch, #studentBranchMobile', branchName);
    } else {
        ['studentSidebarBranch', 'studentSidebarMobileBranch', 'studentBranch', 'studentBranchMobile'].forEach((id) => setText(id, branchName));
    }
    if (typeof window.fitAllPortalBranchLabels === 'function') {
        window.fitAllPortalBranchLabels();
    }
}

function applyGuardianPortalIdentity(user, guardianOrPortal = null) {
    const portal = guardianOrPortal && Array.isArray(guardianOrPortal.guardians)
        ? guardianOrPortal
        : null;
    const guardian = portal
        ? (getGuardianPrimaryGuardian(portal, user) || {})
        : (guardianOrPortal || {});
    const portalGuardian = Array.isArray(portal?.guardians) ? portal.guardians[0] : null;
    const portalUserAccount = portal?.user_account || portal?.user || null;
    const displayName = `${guardian?.first_name || ''} ${guardian?.last_name || ''}`.trim()
        || user?.username
        || user?.email
        || portalGuardian?.first_name
        || portalGuardian?.last_name
        || 'Guardian';
    const email = guardian?.email
        || portalGuardian?.email
        || portalUserAccount?.email
        || user?.email
        || window.__guardianPortalEmail
        || '—';
    const branchName = (portal ? getGuardianPortalBranchLabel(portal) : null)
        || guardian?.branch_name
        || guardian?.branch
        || guardian?.branchName
        || portal?.branch_name
        || portal?.branch
        || portal?.branchName
        || window.__guardianPortalBranchLabel
        || '—';

    window.__guardianPortalEmail = email;
    window.__guardianPortalBranchLabel = branchName;

    setText('guardianNavName', displayName);
    setText('guardianMobileMenuName', displayName);
    setText('guardianSidebarName', displayName);
    setText('guardianSidebarEmail', email);
    if (typeof window.setPortalBranchText === 'function') {
        window.setPortalBranchText('#guardianSidebarBranch, #guardianMobileMenuProfileBranch', branchName);
    } else {
        setText('guardianSidebarBranch', branchName);
        setText('guardianMobileMenuProfileBranch', branchName);
    }
    setText('guardianMobileMenuProfileName', displayName);
    setText('guardianMobileMenuProfileEmail', email);
    if (typeof window.fitAllPortalBranchLabels === 'function') {
        window.fitAllPortalBranchLabels();
    }
}

async function fetchGuardianAbsenceRequests(email) {
    const url = `${baseApiUrl}/attendance.php?action=guardian-absence-list&guardian_email=${encodeURIComponent(email)}`;
    const res = await axios.get(url);
    return res.data;
}

async function submitGuardianAbsenceRequest(payload) {
    const res = await axios.post(`${baseApiUrl}/attendance.php?action=guardian-absence-submit`, payload);
    return res.data;
}

async function updateGuardianProfileRequest(payload) {
    const res = await axios.post(`${baseApiUrl}/students.php?action=update-guardian-profile`, payload);
    return res.data;
}

function getGuardianSessionStatusMetrics(item) {
    const rows = getGuardianSessionRows(item);
    return rows.reduce((acc, row) => {
        const raw = String(row?.attendance_status || row?.status || 'Scheduled').trim().toLowerCase();
        if (['present', 'late', 'completed'].includes(raw)) acc.completed += 1;
        else if (raw === 'absent') acc.absent += 1;
        else if (raw === 'excused') acc.excused += 1;
        else acc.upcoming += 1;
        return acc;
    }, { completed: 0, absent: 0, excused: 0, upcoming: 0 });
}

function renderGuardianAbsenceStudentOptions(items) {
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
        return '<option value="">No linked students found</option>';
    }

    return rows.map((item, index) => {
        const student = item?.student || {};
        const studentId = Number(student.student_id || 0);
        const statusMetrics = getGuardianSessionStatusMetrics(item);
        const suffix = statusMetrics.upcoming > 0 ? ` (${statusMetrics.upcoming} upcoming)` : '';
        return `<option value="${studentId}">${escapeHtml(getGuardianStudentName(item, index))}${escapeHtml(suffix)}</option>`;
    }).join('');
}

function renderGuardianAbsenceRequests(items) {
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
        return `
            <div class="rounded-3xl border border-dashed border-zinc-200 dark:border-white/10 px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No absence requests have been submitted yet.
            </div>
        `;
    }

    return rows.map((row) => {
        const status = String(row?.status || 'Pending');
        const badgeClass = status === 'Approved'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : status === 'Declined'
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : status === 'Reviewed'
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700';

        return `
            <div class="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-5">
                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <div class="text-xs uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400 font-bold">Student</div>
                        <div class="mt-2 text-lg font-black text-zinc-900 dark:text-white">${escapeHtml(row.student_name || 'Student')}</div>
                        <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">${escapeHtml(row.branch_name || 'Assigned branch')} • ${escapeHtml(formatDateLong(row.session_date || ''))}</div>
                    </div>
                    <span class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${badgeClass}">
                        ${escapeHtml(status)}
                    </span>
                </div>
                <div class="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
                    <div>
                        <div class="text-zinc-500 dark:text-zinc-400">Reason</div>
                        <div class="mt-1 font-semibold text-zinc-900 dark:text-white">${escapeHtml(row.reason || '—')}</div>
                    </div>
                    <div>
                        <div class="text-zinc-500 dark:text-zinc-400">Desk Review</div>
                        <div class="mt-1 font-semibold text-zinc-900 dark:text-white">${escapeHtml(row.reviewed_notes || 'Waiting for desk review.')}</div>
                    </div>
                </div>
                <div class="mt-3 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">
                    ${escapeHtml(row.notes || 'No additional notes submitted.')}
                </div>
            </div>
        `;
    }).join('');
}

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

function getGuardianStudentName(item, index) {
    const s = item?.student || {};
    return `${s.first_name || ''} ${s.last_name || ''}`.trim() || `Student ${index + 1}`;
}

function getGuardianSessionRows(item) {
    const rows = Array.isArray(item?.current_session_grades) ? item.current_session_grades.slice() : [];
    return rows.sort((a, b) => {
        const aTime = new Date(`${a?.session_date || ''}T${a?.start_time || '00:00:00'}`).getTime() || 0;
        const bTime = new Date(`${b?.session_date || ''}T${b?.start_time || '00:00:00'}`).getTime() || 0;
        return aTime - bTime;
    });
}

function isGuardianUpcomingSessionRow(row) {
    const raw = String(row?.attendance_status || row?.status || 'Scheduled').trim().toLowerCase();
    if (['present', 'late', 'completed', 'absent', 'cancelled', 'no show', 'cancelled_by_teacher', 'rescheduled'].includes(raw)) {
        return false;
    }
    if (!row?.session_date) return false;
    const sessionDate = new Date(`${row.session_date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sessionDate >= today;
}

function getNextUpcomingSession(item) {
    const rows = getGuardianSessionRows(item).filter(isGuardianUpcomingSessionRow);
    return rows[0] || null;
}

function formatGuardianNextSessionLabel(item) {
    const enrollment = item?.current_enrollment || null;
    const nextRow = getNextUpcomingSession(item);
    if (nextRow) {
        const dateLabel = formatDateLong(nextRow.session_date);
        const timeLabel = nextRow.start_time && nextRow.end_time
            ? `${formatTime12Hour(nextRow.start_time)} - ${formatTime12Hour(nextRow.end_time)}`
            : (nextRow.start_time ? formatTime12Hour(nextRow.start_time) : '');
        return `${dateLabel}${timeLabel ? ` • ${timeLabel}` : ''}`;
    }
    const scheduleDate = enrollment?.first_session_date || enrollment?.start_date;
    if (scheduleDate) {
        return `First lesson: ${formatDateLong(scheduleDate)}`;
    }
    return 'No upcoming session scheduled yet';
}

function collectGuardianUpcomingSessions(items, limit = 6) {
    const rows = [];
    (Array.isArray(items) ? items : []).forEach((item, index) => {
        getGuardianSessionRows(item)
            .filter(isGuardianUpcomingSessionRow)
            .forEach((session) => {
                rows.push({
                    item,
                    index,
                    session,
                    sortTime: new Date(`${session.session_date}T${session.start_time || '00:00:00'}`).getTime() || 0
                });
            });
    });
    return rows.sort((a, b) => a.sortTime - b.sortTime).slice(0, limit);
}

function renderGuardianDashboardAlerts(students) {
    const rows = Array.isArray(students) ? students : [];
    const dueStudents = rows.filter((item) => getGuardianPaymentMetrics(item).totalBalance > 0);
    const alerts = [];

    // ── Frozen account notices ──
    const frozenStudents = rows.filter(item => {
        const enrollment = item?.current_enrollment || null;
        if (!enrollment) return false;
        const notice = getScheduleFreezeReservationNotice(enrollment);
        return !!notice;
    });
    if (frozenStudents.length > 0) {
        frozenStudents.forEach(item => {
            const s    = item?.student || {};
            const name = `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Student';
            const enrollment = item?.current_enrollment || {};
            const notice = getScheduleFreezeReservationNotice(enrollment);
            alerts.push(`
                <div class="rounded-2xl border border-rose-300 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div class="flex items-center gap-2 text-sm font-bold text-rose-800 dark:text-rose-200">
                            <i class="fas fa-snowflake"></i>
                            ${escapeHtml(name)}'s account is frozen
                        </div>
                        <div class="mt-1 text-xs text-rose-600 dark:text-rose-300">
                            ${escapeHtml(notice?.text || `${enrollment.used_absences || 0} absences recorded. ₱${notice?.amount || 100} slot reservation fee required.`)}
                        </div>
                    </div>
                    <span class="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-100 dark:bg-rose-500/20 px-3 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-200">
                        <i class="fas fa-info-circle"></i> Payment required at branch
                    </span>
                </div>
            `);
        });
    }

    if (dueStudents.length > 0) {
        alerts.push(`
            <div class="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div class="text-sm text-amber-900 dark:text-amber-100">
                    <span class="font-bold">${dueStudents.length} student${dueStudents.length === 1 ? '' : 's'}</span> still have an outstanding balance.
                </div>
                <a href="guardian_payments.html" class="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-500 transition">Review payments</a>
            </div>
        `);
    }

    const upcoming = collectGuardianUpcomingSessions(rows, 1);
    if (upcoming.length > 0) {
        const entry = upcoming[0];
        const name = getGuardianStudentName(entry.item, entry.index);
        const when = formatGuardianNextSessionLabel(entry.item);
        alerts.push(`
            <div class="rounded-2xl border border-blue-200 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-500/10 px-4 py-3 text-sm text-blue-900 dark:text-blue-100">
                <span class="font-bold">Next lesson:</span> ${escapeHtml(name)} — ${escapeHtml(when)}
            </div>
        `);
    }

    if (!alerts.length) {
        return `
            <div class="rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
                <i class="fas fa-circle-check mr-2"></i>All caught up for now.
            </div>
        `;
    }
    return alerts.join('');
}

function renderGuardianDashboardUpcomingList(items) {
    const upcoming = collectGuardianUpcomingSessions(items, 6);
    if (!upcoming.length) {
        return `<div class="rounded-2xl border border-dashed border-zinc-200 dark:border-white/10 px-4 py-8 text-center text-sm text-zinc-500">No upcoming sessions in the schedule yet.</div>`;
    }
    return upcoming.map((entry) => {
        const name = getGuardianStudentName(entry.item, entry.index);
        const session = entry.session;
        const when = formatGuardianNextSessionLabel(entry.item);
        const teacher = session.teacher_name || 'Teacher pending';
        const room = session.room_name || 'Room pending';
        return `
            <button type="button" onclick="window.location.href='guardian_students.html'" class="w-full rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-4 text-left hover:border-gold-300 transition">
                <div class="font-bold text-zinc-900 dark:text-white">${escapeHtml(name)}</div>
                <div class="mt-1 text-sm text-zinc-600 dark:text-zinc-300">${escapeHtml(when)}</div>
                <div class="mt-1 text-xs text-zinc-500">${escapeHtml(teacher)} • ${escapeHtml(room)}</div>
            </button>
        `;
    }).join('');
}

function renderGuardianDashboardBalanceList(items) {
    const rows = (Array.isArray(items) ? items : [])
        .map((item, index) => ({ item, index, metrics: getGuardianPaymentMetrics(item) }))
        .filter((row) => row.metrics.totalBalance > 0)
        .sort((a, b) => b.metrics.totalBalance - a.metrics.totalBalance);

    if (!rows.length) {
        return `<div class="rounded-2xl border border-dashed border-zinc-200 dark:border-white/10 px-4 py-8 text-center text-sm text-emerald-600 dark:text-emerald-300">All linked students are fully paid for now.</div>`;
    }

    return rows.map(({ item, index, metrics }) => {
        const name = getGuardianStudentName(item, index);
        return `
            <a href="guardian_payments.html" class="block rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-4 hover:border-gold-300 transition">
                <div class="flex items-center justify-between gap-3">
                    <div class="font-bold text-zinc-900 dark:text-white">${escapeHtml(name)}</div>
                    <div class="text-lg font-black text-gold-600 dark:text-gold-400">${formatCurrencyPHP(metrics.totalBalance)}</div>
                </div>
            </a>
        `;
    }).join('');
}

function buildGuardianSessionDetailMarkup(row) {
    const dateLabel = row.session_date ? formatDateLong(row.session_date) : 'Date pending';
    const timeLabel = row.start_time && row.end_time
        ? `${formatTime12Hour(row.start_time)} - ${formatTime12Hour(row.end_time)}`
        : (row.start_time ? formatTime12Hour(row.start_time) : 'Time pending');
    const attendanceLabel = row.attendance_status && row.attendance_status !== 'Pending'
        ? row.attendance_status
        : (row.status || 'Scheduled');
    const remarksText = cleanSessionNoteText(row.teacher_remarks || row.remarks, 'No teacher remarks recorded yet.');
    const remarks = escapeHtml(remarksText);

    return `
        <div class="text-left">
            <div class="text-xs uppercase tracking-[0.22em] text-zinc-500 font-bold">Session ${escapeHtml(String(row.session_number || ''))}</div>
            <h3 class="mt-2 text-xl font-black text-zinc-900">${escapeHtml(row.instrument_name || 'Student Session')}</h3>
            <div class="mt-2 text-sm text-zinc-500">${escapeHtml(dateLabel)} • ${escapeHtml(timeLabel)}</div>
            <div class="mt-1 text-sm text-zinc-500">${escapeHtml(row.teacher_name || 'Teacher not assigned')} • ${escapeHtml(row.room_name || 'Room pending')}</div>
            <div class="mt-4 flex flex-wrap items-center gap-2">
                ${renderAttendanceStatusBadge(attendanceLabel)}
                ${renderStudentGradeBadge(row.average_score, row.progress_id)}
            </div>
            <div class="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
                <div class="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-bold">Teacher Remarks</div>
                <div class="mt-2 text-sm leading-6 text-zinc-700">${remarks}</div>
            </div>
        </div>
    `;
}

function openGuardianSessionDetails(studentIndex, sessionIndex) {
    const item = guardianPortalStudents[Number(studentIndex)];
    if (!item) return;
    const rows = getGuardianSessionRows(item);
    const row = rows[Number(sessionIndex)];
    if (!row) return;
    Swal.fire({
        width: 920,
        confirmButtonText: 'Close',
        confirmButtonColor: '#b8860b',
        html: buildGuardianSessionDetailMarkup(row)
    });
}

function renderGuardianStudentCard(item, index) {
    const s = item?.student || {};
    const enrollment = item?.current_enrollment || null;
    const studentId = s.student_id ?? `g-${index}`;
    const studentName = getGuardianStudentName(item, index);
    const branch = s.branch_name || '—';
    const regStatus = s.registration_status || 'Pending';
    const pkgName = enrollment?.package_name || s.package_name || 'Not assigned yet';
    const attendanceTotal = Number(enrollment?.package_sessions || s.package_sessions || 0);
    const paymentMetrics = getGuardianPaymentMetrics(item);
    const statusMetrics = getGuardianSessionStatusMetrics(item);

    return `
        <button type="button" onclick="openGuardianStudentModal(${index})" class="w-full rounded-3xl border ${getScheduleFreezeReservationNotice(enrollment) ? 'border-rose-300 dark:border-rose-500/30' : 'border-zinc-200 dark:border-white/10'} bg-white dark:bg-white/5 p-5 text-left shadow-lg transition hover:border-gold-300">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div class="text-xl font-extrabold text-zinc-900 dark:text-white">${escapeHtml(studentName)}</div>
                    <div class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">${escapeHtml(branch)} • ${escapeHtml(pkgName)}</div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${badgeClassForRegistrationStatus(regStatus)}">${escapeHtml(regStatus)}</span>
                    ${getScheduleFreezeReservationNotice(enrollment) ? `<span class="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"><i class="fas fa-snowflake text-[9px]"></i> Frozen</span>` : ''}
                    ${paymentMetrics.totalBalance > 0 ? `<span class="inline-flex items-center rounded-full border border-gold-200 bg-gold-50 px-3 py-1 text-xs font-bold text-gold-700 dark:border-gold-500/20 dark:bg-gold-500/10 dark:text-gold-400">${formatCurrencyPHP(paymentMetrics.totalBalance)} due</span>` : ''}
                </div>
            </div>

            <div class="mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
                <span>Attended <strong id="guardianProgressAttended-${studentId}" class="text-zinc-900 dark:text-white">—</strong> / ${attendanceTotal || '—'}</span>
                <span>•</span>
                <span>Next: ${escapeHtml(formatGuardianNextSessionLabel(item))}</span>
                <span class="ml-auto text-gold-600 dark:text-gold-400 font-bold">View <i class="fas fa-arrow-right"></i></span>
            </div>
            <div id="guardianProgressRemaining-${studentId}" class="portal-hide-tech" aria-hidden="true">—</div>
            <div id="guardianProgressLast-${studentId}" class="portal-hide-tech" aria-hidden="true">—</div>
        </button>
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
    const sessionRows = getGuardianSessionRows(item);

    return `
        <div class="space-y-6">
            ${getScheduleFreezeReservationNotice(enrollment) ? `
            <div class="rounded-2xl border border-rose-300 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10 px-4 py-3 flex items-start gap-3">
                <i class="fas fa-snowflake text-rose-500 mt-0.5 shrink-0"></i>
                <div>
                    <p class="text-sm font-bold text-rose-800 dark:text-rose-200">Account Frozen</p>
                    <p class="text-xs text-rose-600 dark:text-rose-300 mt-0.5">
                        ${enrollment.used_absences || 0} absence${Number(enrollment.used_absences || 0) === 1 ? '' : 's'} recorded.
                        A ₱${getScheduleFreezeReservationNotice(enrollment)?.amount || 100} slot reservation fee must be paid at the branch to restore access.
                    </p>
                </div>
            </div>
            ` : ''}
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
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div class="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold">Session Tracker</div>
                        <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Track completed, upcoming, and graded sessions for this student.</div>
                    </div>
                    <div class="rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                        ${sessionRows.length} session record${sessionRows.length === 1 ? '' : 's'}
                    </div>
                </div>
                <div class="mt-4 space-y-3">
                    ${sessionRows.length ? sessionRows.map((row, sessionIndex) => {
                        const dateLabel = row.session_date ? formatDateShort(row.session_date) : 'Date pending';
                        const timeLabel = row.start_time && row.end_time
                            ? `${formatTime12Hour(row.start_time)} - ${formatTime12Hour(row.end_time)}`
                            : (row.start_time ? formatTime12Hour(row.start_time) : 'Time pending');
                        const attendanceLabel = row.attendance_status && row.attendance_status !== 'Pending'
                            ? row.attendance_status
                            : (row.status || 'Scheduled');
                        return `
                            <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-4">
                                <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <div class="text-sm font-bold text-zinc-900 dark:text-white">Session ${escapeHtml(String(row.session_number || ''))}</div>
                                        <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">${escapeHtml(dateLabel)} • ${escapeHtml(timeLabel)}</div>
                                        <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">${escapeHtml(row.instrument_name || 'Instrument Session')} • ${escapeHtml(row.room_name || 'Room pending')}</div>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2">
                                        ${renderAttendanceStatusBadge(attendanceLabel)}
                                        ${renderStudentGradeBadge(row.average_score, row.progress_id)}
                                        <button type="button" onclick="openGuardianSessionDetails(${index}, ${sessionIndex})" class="inline-flex items-center rounded-xl bg-zinc-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-zinc-800 dark:bg-white/10 dark:hover:bg-white/20">
                                            View Session
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('') : '<div class="rounded-2xl border border-dashed border-zinc-200 dark:border-white/10 px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">No session records yet for this student.</div>'}
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

function getGuardianPaymentMetrics(item) {
    const student = item?.student || {};
    const enrollment = item?.current_enrollment || null;
    const registrationPaid = Number(student.registration_fee_paid || 0);
    const registrationTotal = Number(student.registration_fee_amount || 0);
    const registrationBalance = Math.max(0, registrationTotal - registrationPaid);
    const packagePaid = Number(enrollment?.paid_amount || 0);
    const packageTotal = Number(enrollment?.total_amount || student.package_price || 0);
    const packageBalance = Math.max(0, packageTotal - packagePaid);

    return {
        registrationPaid,
        registrationTotal,
        registrationBalance,
        packagePaid,
        packageTotal,
        packageBalance,
        totalPaid: registrationPaid + packagePaid,
        totalBalance: registrationBalance + packageBalance
    };
}

function renderGuardianPaymentCard(item, index) {
    const student = item?.student || {};
    const enrollment = item?.current_enrollment || null;
    const metrics = getGuardianPaymentMetrics(item);
    const studentName = getGuardianStudentName(item, index);
    const branchName = student.branch_name || '—';
    const packageName = enrollment?.package_name || student.package_name || 'No package yet';
    const paymentStatus = enrollment?.payment_status || student.registration_status || 'Pending';
    const statusMetrics = getGuardianSessionStatusMetrics(item);

    return `
        <button type="button" onclick="openGuardianStudentModal(${index})" class="w-full rounded-3xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-5 text-left transition hover:border-gold-300">
            <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div class="text-xl font-black text-zinc-900 dark:text-white">${escapeHtml(studentName)}</div>
                    <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">${escapeHtml(branchName)} • ${escapeHtml(packageName)}</div>
                </div>
                <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${badgeClassForRegistrationStatus(paymentStatus)}">${escapeHtml(paymentStatus)}</span>
            </div>

            <div class="mt-4 grid grid-cols-2 gap-3">
                <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-4">
                    <div class="portal-stat-label">Paid</div>
                    <div class="mt-2 text-xl font-black text-emerald-600">${formatCurrencyPHP(metrics.totalPaid)}</div>
                </div>
                <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-4">
                    <div class="portal-stat-label">Due</div>
                    <div class="mt-2 text-xl font-black text-gold-500">${formatCurrencyPHP(metrics.totalBalance)}</div>
                </div>
            </div>
        </button>
    `;
}

function renderGuardianPaymentsList(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return `
            <div class="col-span-full rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-10 text-center text-zinc-500 dark:text-zinc-400">
                <i class="fas fa-wallet text-3xl mb-3"></i>
                <div class="font-semibold">No linked student payments found.</div>
                <div class="mt-2 text-xs">Ask the admin to link your guardian account to a student profile first.</div>
            </div>
        `;
    }
    return items.map((item, index) => renderGuardianPaymentCard(item, index)).join('');
}

function updateGuardianPaymentTotals(items) {
    const rows = Array.isArray(items) ? items : [];
    let totalPaid = 0;
    let totalBalance = 0;
    rows.forEach((item) => {
        const metrics = getGuardianPaymentMetrics(item);
        totalPaid += metrics.totalPaid;
        totalBalance += metrics.totalBalance;
    });
    setText('guardianPaymentStudentCount', String(rows.length));
    setText('guardianPaymentTotalPaid', formatCurrencyPHP(totalPaid));
    setText('guardianPaymentTotalBalance', formatCurrencyPHP(totalBalance));
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

function bindGuardianStudentModalEvents() {
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

async function initGuardianDashboardPage() {
    if (!checkGuardianAuth()) return;

    const user = Auth.getUser();
    bindGuardianPortalNav();
    applyGuardianPortalIdentity(user);

    const portal = await fetchGuardianPortalDataByEmail(user?.email || '');
    if (!portal?.success) {
        showMessage(portal?.error || 'Failed to load guardian dashboard.', 'error');
        return;
    }

    const guardian = getGuardianPrimaryGuardian(portal, user) || {};
    window.__guardianPortalBranchLabel = getGuardianPortalBranchLabel(portal);
    applyGuardianPortalIdentity(user, portal);

    const students = Array.isArray(portal.students) ? portal.students : [];
    guardianPortalStudents = students;
    notifyFreezeRestoredForGuardianPortal(students);
    startGuardianFreezeRefreshWatcher();

    const greetingName = `${guardian.first_name || ''}`.trim() || 'Guardian';
    setText('guardianDashboardGreeting', greetingName ? `Hello, ${greetingName}.` : '');

    let totalBalance = 0;
    let totalPaid = 0;
    let upcomingCount = 0;
    students.forEach((item) => {
        const metrics = getGuardianPaymentMetrics(item);
        totalBalance += metrics.totalBalance;
        totalPaid += metrics.totalPaid;
        upcomingCount += getGuardianSessionStatusMetrics(item).upcoming;
    });

    setText('guardianDashboardStudentCount', String(students.length));
    setText('guardianDashboardTotalBalance', formatCurrencyPHP(totalBalance));
    setText('guardianDashboardTotalPaid', formatCurrencyPHP(totalPaid));
    setText('guardianDashboardUpcomingCount', String(upcomingCount));

    setHtml('guardianDashboardAlerts', renderGuardianDashboardAlerts(students));
    setHtml('guardianDashboardUpcomingList', renderGuardianDashboardUpcomingList(students));
    setHtml('guardianDashboardBalanceList', renderGuardianDashboardBalanceList(students));

    await hydrateGuardianAttendance(students);
    bindGuardianStudentModalEvents();
}

async function initGuardianStudentsPage() {
    if (!checkGuardianAuth()) return;

    const user = Auth.getUser();
    bindGuardianPortalNav();
    applyGuardianPortalIdentity(user);

    const portal = await fetchGuardianPortalDataByEmail(user?.email || '');
    if (!portal?.success) {
        showMessage(portal?.error || 'Failed to load guardian portal.', 'error');
        return;
    }

    const primaryGuardian = getGuardianPrimaryGuardian(portal, user) || {};
    window.__guardianPortalBranchLabel = getGuardianPortalBranchLabel(portal);
    applyGuardianPortalIdentity(user, portal);
    setText('guardianName', `${primaryGuardian.first_name || ''} ${primaryGuardian.last_name || ''}`.trim() || (user?.username || 'Guardian'));
    setText('guardianEmail', primaryGuardian.email || user?.email || '—');
    setText('guardianPhone', primaryGuardian.phone || '—');

    const students = Array.isArray(portal.students) ? portal.students : [];
    guardianPortalStudents = students;
    notifyFreezeRestoredForGuardianPortal(students);
    startGuardianFreezeRefreshWatcher();
    updateGuardianTotals(students);
    setHtml('guardianStudentsList', renderGuardianStudentsList(students));
    await hydrateGuardianAttendance(students);
    bindGuardianStudentModalEvents();
}

async function initGuardianPaymentsPage() {
    if (!checkGuardianAuth()) return;

    const user = Auth.getUser();
    bindGuardianPortalNav();
    applyGuardianPortalIdentity(user);

    const portal = await fetchGuardianPortalDataByEmail(user?.email || '');
    if (!portal?.success) {
        showMessage(portal?.error || 'Failed to load guardian payments.', 'error');
        return;
    }

    const primaryGuardian = getGuardianPrimaryGuardian(portal, user) || {};
    window.__guardianPortalBranchLabel = getGuardianPortalBranchLabel(portal);
    applyGuardianPortalIdentity(user, portal);
    const guardianName = `${primaryGuardian.first_name || ''} ${primaryGuardian.last_name || ''}`.trim() || (user?.username || 'Guardian');
    setText('guardianNameInline', guardianName);

    const students = Array.isArray(portal.students) ? portal.students : [];
    guardianPortalStudents = students;
    notifyFreezeRestoredForGuardianPortal(students);
    startGuardianFreezeRefreshWatcher();
    updateGuardianPaymentTotals(students);
    setHtml('guardianPaymentsList', renderGuardianPaymentsList(students));
    await hydrateGuardianAttendance(students);
    bindGuardianStudentModalEvents();
}

async function initGuardianProfilePage() {
    if (!checkGuardianAuth()) return;

    const user = Auth.getUser();
    bindGuardianPortalNav();
    applyGuardianPortalIdentity(user);

    const portal = await fetchGuardianPortalDataByEmail(user?.email || '');
    if (!portal?.success) {
        showMessage(portal?.error || 'Failed to load guardian profile.', 'error');
        return;
    }

    const guardian = getGuardianPrimaryGuardian(portal, user) || {};
    const students = Array.isArray(portal.students) ? portal.students : [];
    const metrics = students.reduce((acc, item) => {
        const payment = getGuardianPaymentMetrics(item);
        acc.balance += payment.totalBalance;
        return acc;
    }, { balance: 0 });

    window.__guardianPortalBranchLabel = getGuardianPortalBranchLabel(portal);
    applyGuardianPortalIdentity(user, portal);
    notifyFreezeRestoredForGuardianPortal(students);
    startGuardianFreezeRefreshWatcher();
    setText('guardianProfileHeading', `${guardian.first_name || ''} ${guardian.last_name || ''}`.trim() || 'Guardian Profile');
    setText('guardianProfileLinkedStudents', String(students.length));
    setText('guardianProfileBalance', formatCurrencyPHP(metrics.balance));

    const fieldMap = {
        guardianProfileGuardianId: guardian.guardian_id || '',
        guardianProfileUserId: user?.user_id || '',
        guardianProfileFirstName: guardian.first_name || '',
        guardianProfileLastName: guardian.last_name || '',
        guardianProfileEmail: guardian.email || user?.email || '',
        guardianProfilePhone: guardian.phone || '',
        guardianProfileRelationship: guardian.relationship_type || 'Legal Guardian',
        guardianProfileOccupation: guardian.occupation || '',
        guardianProfileAddress: guardian.address || ''
    };

    Object.entries(fieldMap).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    });

    const form = document.getElementById('guardianProfileForm');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitBtn = document.getElementById('guardianProfileSaveBtn');
        if (submitBtn) submitBtn.disabled = true;

        const payload = {
            guardian_id: document.getElementById('guardianProfileGuardianId')?.value || '',
            user_id: document.getElementById('guardianProfileUserId')?.value || '',
            first_name: document.getElementById('guardianProfileFirstName')?.value.trim() || '',
            last_name: document.getElementById('guardianProfileLastName')?.value.trim() || '',
            email: document.getElementById('guardianProfileEmail')?.value.trim() || '',
            phone: document.getElementById('guardianProfilePhone')?.value.trim() || '',
            relationship_type: document.getElementById('guardianProfileRelationship')?.value || '',
            occupation: document.getElementById('guardianProfileOccupation')?.value.trim() || '',
            address: document.getElementById('guardianProfileAddress')?.value.trim() || ''
        };

        try {
            const data = await updateGuardianProfileRequest(payload);
            if (data?.success) {
                const nextUser = {
                    ...(Auth.getUser() || {}),
                    username: `${payload.first_name} ${payload.last_name}`.trim() || payload.email,
                    first_name: payload.first_name,
                    last_name: payload.last_name,
                    email: payload.email,
                    phone: payload.phone
                };
                Auth.setUser(nextUser);
                window.__guardianPortalBranchLabel = getGuardianPortalBranchLabel(portal);
                applyGuardianPortalIdentity(nextUser, portal);
                setText('guardianProfileHeading', `${payload.first_name} ${payload.last_name}`.trim() || 'Guardian Profile');
                showMessage(data.message || 'Guardian profile updated.', 'success');
            } else {
                showMessage(data?.error || 'Failed to update guardian profile.', 'error');
            }
        } catch (error) {
            showMessage(error?.response?.data?.error || 'Network error while updating profile.', 'error');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

async function initGuardianAbsencePage() {
    if (!checkGuardianAuth()) return;

    const user = Auth.getUser();
    bindGuardianPortalNav();
    applyGuardianPortalIdentity(user);

    const [portal, absenceData] = await Promise.all([
        fetchGuardianPortalDataByEmail(user?.email || ''),
        fetchGuardianAbsenceRequests(user?.email || '')
    ]);

    if (!portal?.success) {
        showMessage(portal?.error || 'Failed to load guardian absence page.', 'error');
        return;
    }

    const guardian = getGuardianPrimaryGuardian(portal, user) || {};
    const students = Array.isArray(portal.students) ? portal.students : [];
    guardianPortalStudents = students;
    window.__guardianPortalBranchLabel = getGuardianPortalBranchLabel(portal);
    notifyFreezeRestoredForGuardianPortal(students);
    startGuardianFreezeRefreshWatcher();
    applyGuardianPortalIdentity(user, portal);

    setText('guardianAbsenceName', `${guardian.first_name || ''} ${guardian.last_name || ''}`.trim() || 'Guardian');
    setText('guardianAbsenceStudentCount', String(students.length));

    const totalUpcoming = students.reduce((sum, item) => sum + getGuardianSessionStatusMetrics(item).upcoming, 0);
    setText('guardianAbsenceUpcomingCount', String(totalUpcoming));

    const requestRows = Array.isArray(absenceData?.requests) ? absenceData.requests : [];
    setText('guardianAbsencePendingCount', String(requestRows.filter((row) => String(row.status || '').toLowerCase() === 'pending').length));
    setHtml('guardianAbsenceRequestsList', renderGuardianAbsenceRequests(requestRows));

    const studentSelect = document.getElementById('guardianAbsenceStudentId');
    if (studentSelect) {
        studentSelect.innerHTML = renderGuardianAbsenceStudentOptions(students);
    }

    const dateInput = document.getElementById('guardianAbsenceSessionDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().slice(0, 10);
    }

    const form = document.getElementById('guardianAbsenceForm');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitBtn = document.getElementById('guardianAbsenceSubmitBtn');
        if (submitBtn) submitBtn.disabled = true;

        const payload = {
            guardian_email: Auth.getUser()?.email || '',
            guardian_user_id: Auth.getUser()?.user_id || '',
            student_id: document.getElementById('guardianAbsenceStudentId')?.value || '',
            session_date: document.getElementById('guardianAbsenceSessionDate')?.value || '',
            reason: document.getElementById('guardianAbsenceReason')?.value || '',
            notes: document.getElementById('guardianAbsenceNotes')?.value.trim() || ''
        };

        try {
            const data = await submitGuardianAbsenceRequest(payload);
            if (data?.success) {
                showMessage(data.message || 'Absence request submitted.', 'success');
                form.reset();
                if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
                if (studentSelect) studentSelect.innerHTML = renderGuardianAbsenceStudentOptions(students);

                const refreshed = await fetchGuardianAbsenceRequests(Auth.getUser()?.email || '');
                const rows = Array.isArray(refreshed?.requests) ? refreshed.requests : [];
                setText('guardianAbsencePendingCount', String(rows.filter((row) => String(row.status || '').toLowerCase() === 'pending').length));
                setHtml('guardianAbsenceRequestsList', renderGuardianAbsenceRequests(rows));
            } else {
                showMessage(data?.error || 'Failed to submit absence request.', 'error');
            }
        } catch (error) {
            showMessage(error?.response?.data?.error || 'Network error while submitting absence request.', 'error');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
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
            <div class="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3 shadow-sm">
                <label class="block text-sm font-semibold text-slate-700">${slotLabel} *</label>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Type</label>
                        <select class="student-request-instrument-type w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-gold-400" data-slot="${i}" onchange="onStudentRequestInstrumentTypeChange(${i})">
                            <option value="">Select type...</option>
                            ${typeOptionsHtml}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Instrument</label>
                        <select class="student-request-instrument w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-gold-400" data-slot="${i}" onchange="onStudentRequestInstrumentDropdownChange(${i})">
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

    // Check for duplicate type selection across other slots
    if (typeId) {
        const allTypeSelects = document.querySelectorAll('select.student-request-instrument-type');
        const duplicateType = Array.from(allTypeSelects).some(sel =>
            sel !== typeSelect && String(sel.value || '') === String(typeId)
        );
        if (duplicateType) {
            typeSelect.value = '';
            instrumentSelect.innerHTML = '<option value="">Select instrument...</option>';
            instrumentSelect.value = '';
            if (typeof showMessage === 'function') {
                showMessage('That instrument type has already been selected in another slot. Please choose a different type.', 'error');
            }
            // Refresh disabled states without recursing into the type-change handler
            _syncStudentRequestTypeDisabledStates();
            return;
        }
    }

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
    onStudentRequestInstrumentDropdownChange(slot);
}

// Sync disabled state of type dropdowns so already-used types are greyed out
function _syncStudentRequestTypeDisabledStates() {
    const allTypeSelects = document.querySelectorAll('select.student-request-instrument-type');
    const usedTypes = new Set();
    allTypeSelects.forEach(sel => { if (sel.value) usedTypes.add(String(sel.value)); });
    allTypeSelects.forEach(sel => {
        const currentVal = String(sel.value || '');
        Array.from(sel.options).forEach(opt => {
            if (opt.value === '') return;
            opt.disabled = usedTypes.has(String(opt.value)) && String(opt.value) !== currentVal;
        });
    });
}

function onStudentRequestInstrumentDropdownChange(changedSlot = null) {
    const selects = document.querySelectorAll('select.student-request-instrument');
    const changedSelect = changedSlot != null
        ? document.querySelector(`select.student-request-instrument[data-slot="${changedSlot}"]`)
        : null;

    if (changedSelect && changedSelect.value) {
        const selectedValue = String(changedSelect.value);
        const duplicateExists = Array.from(selects).some(select =>
            select !== changedSelect && String(select.value || '') === selectedValue
        );
        if (duplicateExists) {
            changedSelect.value = '';
            if (typeof showMessage === 'function') {
                showMessage('That instrument has already been selected in another slot. Please choose a different instrument.', 'error');
            }
        }
    }

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

    // Also keep type dropdowns in sync
    _syncStudentRequestTypeDisabledStates();
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
        statusEl.textContent = 'You already have a pending request. Please wait for approval.';
    } else if (totalSessions > 0) {
        statusEl.textContent = `${attendedSessions} of ${totalSessions} sessions done. ${remainingSessions} left.`;
    } else {
        statusEl.textContent = 'Finish your current package before adding more sessions.';
    }

    addBtn.onclick = () => {
        if (hasPendingRequest) {
            showMessage('Please wait for your pending request to be approved.', 'error');
            return;
        }

        if (remainingSessions > 0) {
            showMessage(`You still have ${remainingSessions} session(s) left to finish.`, 'error');
            return;
        }

        showMessage('Contact the front desk to add more sessions.', 'success');
    };
}

function initStudentRequestSection(student, requestMeta) {
    const statusEl = document.getElementById('studentRequestStatus');
    const packageSelect = document.getElementById('studentRequestPackage');
    const packageCardsContainer = document.getElementById('studentRequestPackageCards');
    const amountEl = document.getElementById('studentRequestAmount');
    const instrumentsContainer = document.getElementById('studentRequestInstrumentContainer');
    const paymentModeEl = document.getElementById('studentRequestPaymentMode');
    const paymentMethodEl = document.getElementById('studentRequestPaymentMethod');
    const availabilityCalendar = document.getElementById('studentAvailabilityCalendar');
    const form = document.getElementById('studentPackageRequestForm');
    const submitBtn = document.getElementById('studentSubmitRequestBtn');
    const paymentProofEl = document.getElementById('studentRequestPaymentProof');
    const autoDayEl = document.getElementById('studentRequestAutoDay');

    if (!statusEl || !packageSelect || !packageCardsContainer || !amountEl || !instrumentsContainer || !paymentModeEl || !paymentMethodEl || !availabilityCalendar || !form || !submitBtn) {
        return;
    }

    const packages = Array.isArray(requestMeta?.packages) ? requestMeta.packages : [];
    const instruments = Array.isArray(requestMeta?.instruments) ? requestMeta.instruments : [];
    const availabilities = Array.isArray(requestMeta?.availabilities) ? requestMeta.availabilities : [];
    const latest = requestMeta?.latest_request || null;
    const hasPendingRequest = latest && String(latest.status || '') === 'Pending';
    let selectedPackageId = '';

    statusEl.innerHTML = renderStudentRequestStatus(latest);
    availabilityCalendar.innerHTML = '';

    packageSelect.innerHTML = '<option value="">Select package...</option>' + packages.map(pkg => {
        const sessions = Number(pkg.sessions || 0);
        const maxInst = Number(pkg.max_instruments || 1);
        const price = formatCurrencyPHP(pkg.price || 0);
        const instLabel = maxInst > 1 ? `up to ${maxInst} instruments` : '1 instrument';
        return `<option value="${pkg.package_id}" data-max-instruments="${maxInst}" data-sessions="${sessions}" data-price="${pkg.price || 0}">${escapeHtml(pkg.package_name || 'Package')} — ${sessions} sessions, ${instLabel} · ${price}</option>`;
    }).join('');

    const getSelectedPackageData = () => {
        const selected = packageSelect.options[packageSelect.selectedIndex];
        return {
            maxInst: Number(selected?.getAttribute('data-max-instruments') || 0),
            price: Number(selected?.getAttribute('data-price') || 0),
            sessions: Number(selected?.getAttribute('data-sessions') || 0),
            label: String(selected?.textContent || '').trim()
        };
    };

    const renderPackageCards = () => {
        if (!packages.length) {
            packageCardsContainer.innerHTML = `
                <div class="rounded-2xl border border-dashed border-zinc-300 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-4 py-5 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    No session packages are available right now.
                </div>
            `;
            return;
        }

        packageCardsContainer.innerHTML = packages.map((pkg) => {
            const packageId = String(pkg.package_id || '');
            const sessions = Number(pkg.sessions || 0);
            const maxInst = Number(pkg.max_instruments || 1);
            const price = formatCurrencyPHP(pkg.price || 0);
            const active = packageId === selectedPackageId;
            const instLabel = maxInst > 1 ? `up to ${maxInst} instruments` : '1 instrument';

            return `
                <button type="button"
                    class="student-request-package-card w-full text-left rounded-[1.25rem] border px-4 py-3 transition ${active ? 'border-gold-500 bg-gold-50/70 dark:bg-gold-500/10 ring-1 ring-gold-500/25' : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/40 hover:border-gold-300 dark:hover:border-gold-500/30'}"
                    data-package-id="${escapeHtml(packageId)}"
                    data-max-instruments="${maxInst}"
                    data-sessions="${sessions}"
                    data-price="${pkg.price || 0}">
                    <div class="flex items-center justify-between gap-4">
                        <div class="flex items-center gap-4 min-w-0">
                            <span class="h-6 w-6 rounded-full border flex items-center justify-center shrink-0 ${active ? 'border-gold-500 bg-gold-500 text-white' : 'border-zinc-300 dark:border-white/20 bg-white dark:bg-zinc-950 text-transparent'}">
                                <i class="fas fa-check text-[10px]"></i>
                            </span>
                            <div class="min-w-0">
                                <div class="text-base font-semibold text-zinc-900 dark:text-white">${escapeHtml(pkg.package_name || 'Package')}</div>
                                <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">${sessions} sessions · ${escapeHtml(instLabel)}</div>
                            </div>
                        </div>
                        <div class="text-base font-bold text-zinc-700 dark:text-zinc-200 whitespace-nowrap">${escapeHtml(price)}</div>
                    </div>
                </button>
            `;
        }).join('');

        packageCardsContainer.querySelectorAll('.student-request-package-card').forEach((card) => {
            card.addEventListener('click', () => {
                selectedPackageId = String(card.dataset.packageId || '');
                packageSelect.value = selectedPackageId;
                renderPackageCards();
                updateRequestPackageUI();
            });
        });
    };

    if (packages.length === 0) {
        statusEl.innerHTML += '<div class="text-xs text-yellow-300 mt-2">No session package is available for enrollment request right now. Please contact desk/admin.</div>';
    }

    const updateRequestPackageUI = () => {
        const { maxInst, price, sessions, label } = getSelectedPackageData();
        const paymentType = String(paymentModeEl.value || 'Partial Payment');
        const registrationFeeDue = getRegistrationFeeDueAmount(student);
        const payableNow = computeStudentRequestPayableNow(price, sessions, paymentType, registrationFeeDue);
        const enrollmentNow = computeStudentRequestPayableNow(price, sessions, paymentType);
        const partialNow = computeStudentRequestPayableNow(price, sessions, 'Partial Payment', 0);
        const fullNow = computeStudentRequestPayableNow(price, sessions, 'Full Payment', 0);

        if (!price) {
            amountEl.innerHTML = `<p class="text-sm text-zinc-400 dark:text-zinc-500">Select a package to see your payment breakdown.</p>`;
        } else {
            const regFeeRow = registrationFeeDue > 0 ? `
                <div class="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-white/8">
                    <div>
                        <p class="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Registration Fee</p>
                        <p class="text-xs text-zinc-400">One-time lifetime fee</p>
                    </div>
                    <span class="text-sm font-bold text-zinc-900 dark:text-white">${formatCurrencyPHP(registrationFeeDue)}</span>
                </div>` : `
                <div class="flex items-center gap-2 py-2 border-b border-zinc-100 dark:border-white/8">
                    <i class="fas fa-circle-check text-emerald-500 text-sm"></i>
                    <p class="text-sm text-emerald-700 dark:text-emerald-400 font-semibold">Registration fee already paid ✓</p>
                </div>`;

            amountEl.innerHTML = `
                <div class="space-y-4">
                    <div>
                        <div class="text-xs uppercase tracking-[0.25em] text-gold-600 dark:text-gold-400 font-bold">Summary</div>
                        <h3 class="mt-2 text-lg font-extrabold text-zinc-900 dark:text-white">${escapeHtml(label || 'Selected package')}</h3>
                        <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">${sessions} sessions</p>
                    </div>
                    <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 px-4 py-3 space-y-2">
                        <div class="flex items-center justify-between text-sm">
                            <span class="text-zinc-500 dark:text-zinc-400">Package price</span>
                            <span class="font-semibold text-zinc-900 dark:text-white">${formatCurrencyPHP(price)}</span>
                        </div>
                        <div class="flex items-center justify-between text-sm">
                            <span class="text-zinc-500 dark:text-zinc-400">Payment mode</span>
                            <span class="font-semibold text-zinc-900 dark:text-white">${escapeHtml(paymentType)}</span>
                        </div>
                        <div class="flex items-center justify-between text-sm">
                            <span class="text-zinc-500 dark:text-zinc-400">Partial now</span>
                            <span class="font-semibold text-zinc-900 dark:text-white">${formatCurrencyPHP(partialNow)}</span>
                        </div>
                        <div class="flex items-center justify-between text-sm">
                            <span class="text-zinc-500 dark:text-zinc-400">Full payment</span>
                            <span class="font-semibold text-zinc-900 dark:text-white">${formatCurrencyPHP(fullNow)}</span>
                        </div>
                    </div>
                    ${regFeeRow}
                    <div class="space-y-2">
                        <div class="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-white/8">
                            <div>
                                <p class="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Lesson Package</p>
                                <p class="text-xs text-zinc-400">${sessions} sessions · ${paymentType}</p>
                            </div>
                            <span class="text-sm font-bold text-zinc-900 dark:text-white">${formatCurrencyPHP(enrollmentNow)}</span>
                        </div>
                        <div class="flex items-center justify-between pt-1">
                            <p class="text-sm font-black text-zinc-900 dark:text-white">Due now</p>
                            <span class="text-lg font-black text-gold-600 dark:text-gold-400">${formatCurrencyPHP(payableNow)}</span>
                        </div>
                        <div class="text-xs text-zinc-500 dark:text-zinc-400">
                            ${paymentType === 'Full Payment'
                                ? 'You will settle the full package and registration fee now.'
                                : `You will still have ${formatCurrencyPHP(Math.max(0, price - partialNow))} left on the package after this payment.`}
                        </div>
                    </div>
                </div>`;
        }

        instrumentsContainer.innerHTML = maxInst > 0
            ? renderStudentRequestInstrumentSelectors(maxInst, instruments)
            : '<div class="text-sm text-zinc-400 dark:text-zinc-500 text-center py-3">Choose a package first.</div>';

        renderPackageCards();
    };

    packageSelect.onchange = () => {
        selectedPackageId = String(packageSelect.value || '');
        updateRequestPackageUI();
    };
    paymentModeEl.onchange = updateRequestPackageUI;
    renderPackageCards();
    updateRequestPackageUI();

    if (autoDayEl) {
        autoDayEl.textContent = 'Final schedule will be based on instructor availability and branch assignment.';
    }

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
        const paymentType = String(paymentModeEl.value || '').trim();
        const paymentMethod = String(paymentMethodEl.value || '').trim();
        const instrumentIds = Array.from(document.querySelectorAll('.student-request-instrument'))
            .map(el => parseInt(el.value, 10))
            .filter(v => !Number.isNaN(v) && v > 0);
        const uniqueInstrumentIds = Array.from(new Set(instrumentIds));

        if (!packageId || !paymentType || !paymentMethod || uniqueInstrumentIds.length < 1) {
            showMessage('Please complete package, instruments, payment mode, and payment method.', 'error');
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
            requestFormData.append('instrument_ids_json', JSON.stringify(uniqueInstrumentIds));
            if (paymentProofFile) {
                requestFormData.append('package_payment_proof_file', paymentProofFile);
            }

            const response = await postStudentPackageRequest(requestFormData);
            if (response.success) {
                closeStudentRequestModal();
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

function setStudentModalState(modalId, shouldOpen) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    if (shouldOpen) {
        const active = document.activeElement;
        if (active instanceof HTMLElement && !modal.contains(active)) {
            modal.__returnFocusEl = active;
        }
        modal.removeAttribute('inert');
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');

        window.requestAnimationFrame(() => {
            const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (firstFocusable instanceof HTMLElement) {
                firstFocusable.focus();
            }
        });
    } else {
        const active = document.activeElement;
        if (active instanceof HTMLElement && modal.contains(active)) {
            active.blur();
        }

        modal.setAttribute('inert', '');
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.add('hidden');

        const returnFocusEl = modal.__returnFocusEl;
        if (returnFocusEl instanceof HTMLElement && document.contains(returnFocusEl)) {
            window.requestAnimationFrame(() => returnFocusEl.focus());
        }
    }

    const anyOpen = ['studentRegistrationModal', 'studentRequestModal'].some((id) => {
        const item = document.getElementById(id);
        return item && !item.classList.contains('hidden');
    });
    document.body.classList.toggle('overflow-hidden', anyOpen);
}

function openStudentRegistrationModal() {
    const regStatus = String(studentDashboardPortalState?.student?.registration_status || 'Pending');
    if (regStatus === 'Rejected') {
        void handleRejectedStudentRegistrationOpen();
        return;
    }

    setStudentModalState('studentRegistrationModal', true);
}

function closeStudentRegistrationModal() {
    setStudentModalState('studentRegistrationModal', false);
}

function openStudentRequestModal() {
    setStudentModalState('studentRequestModal', true);
}

function closeStudentRequestModal() {
    setStudentModalState('studentRequestModal', false);
}

// ── Freeze Payment Modal (Student Side) ───────────────────────────
function openFreezePaymentModal() {
    const enrollmentId = Number(window.__freezeEnrollmentId || 0);
    const studentId    = Number(window.__freezeStudentId    || 0);
    const amount       = Number(window.__freezeAmount       || 100);
    if (!enrollmentId || !studentId) {
        Swal.fire({ icon:'error', title:'Error', text:'Account information not loaded. Please refresh the page.', confirmButtonColor:'#b8860b' });
        return;
    }

    Swal.fire({
        title: '<i class="fas fa-snowflake text-rose-500 mr-2"></i>Pay Slot Reservation Fee',
        width: 480,
        showCancelButton: true,
        confirmButtonText: 'Submit Payment',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#b8860b',
        allowOutsideClick: false,
        html: `
            <div class="text-left space-y-4 py-2">
                <div class="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 flex items-center justify-between">
                    <span class="text-sm font-semibold text-rose-800">Amount Due</span>
                    <span class="text-xl font-black text-rose-700">₱${Number(amount).toFixed(2)}</span>
                </div>
                <p class="text-sm text-zinc-500">Choose how you'd like to pay. Online payments require desk approval. Cash walk-ins are processed at the branch.</p>

                <!-- Payment type toggle -->
                <div class="grid grid-cols-2 gap-2">
                    <button type="button" id="fpTypeOnline"
                        onclick="selectFreezePayType('online')"
                        class="py-2.5 rounded-xl border-2 border-blue-500 bg-blue-50 text-sm font-bold text-blue-700">
                        Online Payment
                    </button>
                    <button type="button" id="fpTypeCash"
                        onclick="selectFreezePayType('cash')"
                        class="py-2.5 rounded-xl border-2 border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:border-slate-400">
                        Cash (Walk-in)
                    </button>
                </div>

                <!-- Online fields -->
                <div id="fpOnlineFields" class="space-y-3">
                    <div>
                        <label class="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Payment Method</label>
                        <select id="fpMethod" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-blue-400">
                            <option value="GCash">GCash</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Reference Number *</label>
                        <input type="text" id="fpReference" placeholder="e.g. GCash ref #..."
                            class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-blue-400"
                            maxlength="100">
                    </div>
                </div>

                <!-- Cash fields -->
                <div id="fpCashFields" class="hidden">
                    <div class="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                        <i class="fas fa-info-circle mr-1.5"></i>
                        Bring ₱${Number(amount).toFixed(2)} cash to the branch. The desk will process your payment immediately.
                    </div>
                </div>

                <p id="fpMsg" class="hidden text-xs font-medium text-red-600"></p>
            </div>
        `,
        didOpen: () => {
            window.__fpCurrentType = 'online';
        },
        preConfirm: async () => {
            const type   = window.__fpCurrentType || 'online';
            const method = type === 'online' ? (document.getElementById('fpMethod')?.value || 'GCash') : 'Cash';
            const ref    = type === 'online' ? (document.getElementById('fpReference')?.value || '').trim() : '';
            const msgEl  = document.getElementById('fpMsg');

            if (type === 'online' && !ref) {
                if (msgEl) { msgEl.textContent = 'Reference number is required for online payments.'; msgEl.classList.remove('hidden'); }
                return false;
            }
            if (msgEl) msgEl.classList.add('hidden');

            try {
                const payload = new FormData();
                payload.append('action',           'submit-freeze-payment');
                payload.append('enrollment_id',    String(enrollmentId));
                payload.append('student_id',       String(studentId));
                payload.append('payment_method',   method);
                payload.append('reference_number', ref);
                payload.append('source',           'online'); // student always submits as online
                const res  = await axios.post(`${baseApiUrl}/students.php?action=submit-freeze-payment`, payload);
                const data = res.data || {};
                if (!data.success) { Swal.showValidationMessage(data.error || 'Submission failed.'); return false; }
                return data;
            } catch (e) {
                Swal.showValidationMessage('Network error. Please try again.');
                return false;
            }
        }
    }).then(result => {
        if (!result.isConfirmed || !result.value) return;
        Swal.fire({
            icon: 'success',
            title: 'Payment Submitted',
            text: result.value.message || 'Your payment is pending desk approval.',
            confirmButtonColor: '#b8860b'
        }).then(() => window.location.reload());
    });
}

function selectFreezePayType(type) {
    window.__fpCurrentType = type;
    const onlineBtn    = document.getElementById('fpTypeOnline');
    const cashBtn      = document.getElementById('fpTypeCash');
    const onlineFields = document.getElementById('fpOnlineFields');
    const cashFields   = document.getElementById('fpCashFields');
    const activeCls    = 'py-2.5 rounded-xl border-2 border-blue-500 bg-blue-50 text-sm font-bold text-blue-700';
    const inactiveCls  = 'py-2.5 rounded-xl border-2 border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:border-slate-400';
    if (type === 'online') {
        if (onlineBtn)    onlineBtn.className    = activeCls;
        if (cashBtn)      cashBtn.className      = inactiveCls;
        if (onlineFields) onlineFields.classList.remove('hidden');
        if (cashFields)   cashFields.classList.add('hidden');
    } else {
        if (cashBtn)      cashBtn.className      = activeCls;
        if (onlineBtn)    onlineBtn.className    = inactiveCls;
        if (cashFields)   cashFields.classList.remove('hidden');
        if (onlineFields) onlineFields.classList.add('hidden');
    }
}

window.openFreezePaymentModal = openFreezePaymentModal;
window.selectFreezePayType    = selectFreezePayType;

window.openStudentRegistrationModal = openStudentRegistrationModal;
window.closeStudentRegistrationModal = closeStudentRegistrationModal;
window.openStudentRequestModal = openStudentRequestModal;
window.closeStudentRequestModal = closeStudentRequestModal;

async function resetRejectedStudentRegistration(studentId) {
    const res = await axios.post(`${baseApiUrl}/users.php?action=reset-rejected-registration`, {
        student_id: Number(studentId)
    });
    return res.data;
}

async function handleRejectedStudentRegistrationOpen() {
    const studentId = Number(studentDashboardPortalState?.student?.student_id || 0);
    if (studentId < 1) {
        showMessage('Unable to reset this rejected registration right now.', 'error');
        return;
    }

    const result = await Swal.fire({
        icon: 'warning',
        title: 'Registration Rejected By Admin',
        text: 'Registration rejected. Please try again or contact admin.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#b8860b'
    });

    if (!result.isConfirmed) {
        return;
    }

    try {
        const reset = await resetRejectedStudentRegistration(studentId);
        if (!reset?.success) {
            throw new Error(reset?.error || 'Failed to reset rejected registration.');
        }

        try {
            sessionStorage.setItem('student_reopen_registration_modal', '1');
            sessionStorage.setItem('student_registration_rejected_notice', '1');
        } catch (e) {
            // Ignore storage issues and just reload.
        }
        window.location.reload();
    } catch (error) {
        showMessage(error?.message || 'Failed to reset rejected registration.', 'error');
    }
}

function bindStudentModalFrame(modalId, closeFn) {
    const modal = document.getElementById(modalId);
    if (!modal || modal.dataset.bound === 'true') return;
    modal.dataset.bound = 'true';
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeFn();
        }
    });
}

function openPendingRequestPaymentModal(requestId) {
    const req = pendingRequestsById[String(requestId)];
    if (!req) {
        showMessage('Payment details not found.', 'error');
        return;
    }

    const paymentType = escapeHtml(req.payment_type || 'Partial Payment');
    const paymentMethod = escapeHtml(req.payment_method || '—');
    const payableNow = Number(req.payable_now || 0);
    const packageAmount = Number(req.requested_amount || req.package_price || 0);
    const proofHtml = req.payment_proof_path
        ? `<a href="${escapeHtml(buildPublicFileUrl(req.payment_proof_path))}" target="_blank" rel="noopener" class="text-sm text-blue-600 underline">View payment proof</a>`
        : '<span class="text-sm text-slate-500">No payment proof uploaded</span>';

    Swal.fire({
        title: 'Payment Details',
        width: 620,
        confirmButtonText: 'Close',
        html: `
            <div class="text-left space-y-4 text-sm text-slate-700">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><span class="font-semibold text-slate-900">Payment Type:</span> ${paymentType}</div>
                    <div><span class="font-semibold text-slate-900">Payment Method:</span> ${paymentMethod}</div>
                    <div><span class="font-semibold text-slate-900">Pay Now:</span> ${formatCurrencyPHP(payableNow)}</div>
                    <div><span class="font-semibold text-slate-900">Package Amount:</span> ${formatCurrencyPHP(packageAmount)}</div>
                </div>
                <div><span class="font-semibold text-slate-900">Proof of Payment:</span> ${proofHtml}</div>
            </div>
        `
    });
}

function renderStudentRegistrationModal(student, portal) {
    const body = document.getElementById('studentRegistrationModalBody');
    if (!body) return;
    const regStatus = String(student?.registration_status || 'Pending');
    const latestPaymentStatus = String(student?.registration_payment_status || '');
    const profileComplete = isRegistrationProfileComplete(student);
    const hasSubmittedPendingRegistration = regStatus === 'Pending'
        && latestPaymentStatus === 'Pending'
        && profileComplete
        && Boolean(
            student?.registration_proof_path
            || student?.registration_payment_method
            || student?.registration_reference_number
            || student?.registration_receipt_number
        );

    if (hasSubmittedPendingRegistration) {
        body.innerHTML = `
            <div class="space-y-5">
                <div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 sm:px-5">
                    <div class="text-sm font-bold text-amber-800">Registration pending admin review</div>
                    <div class="text-sm text-amber-700 mt-1">Your registration has already been submitted. These details stay locked while admin reviews your request.</div>
                </div>

                <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-4 sm:p-5">
                    <div class="text-xs uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400 font-bold mb-4">Student Details</div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div><span class="font-semibold text-zinc-700 dark:text-zinc-200">Name:</span> ${escapeHtml(`${student?.first_name || ''} ${student?.last_name || ''}`.trim() || '—')}</div>
                        <div><span class="font-semibold text-zinc-700 dark:text-zinc-200">Email:</span> ${escapeHtml(student?.email || '—')}</div>
                        <div><span class="font-semibold text-zinc-700 dark:text-zinc-200">Phone:</span> ${escapeHtml(student?.phone || '—')}</div>
                        <div><span class="font-semibold text-zinc-700 dark:text-zinc-200">Branch:</span> ${escapeHtml(student?.branch_name || '—')}</div>
                        <div><span class="font-semibold text-zinc-700 dark:text-zinc-200">Birthday:</span> ${escapeHtml(student?.date_of_birth || '—')}</div>
                        <div><span class="font-semibold text-zinc-700 dark:text-zinc-200">Address:</span> ${escapeHtml(student?.address || '—')}</div>
                    </div>
                </div>

                <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-4 sm:p-5">
                    <div class="text-xs uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400 font-bold mb-4">Registration Payment</div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div><span class="font-semibold text-zinc-700 dark:text-zinc-200">Registration Fee:</span> ₱1,000.00</div>
                        <div><span class="font-semibold text-zinc-700 dark:text-zinc-200">Payment Method:</span> ${escapeHtml(student?.registration_payment_method || '—')}</div>
                        <div><span class="font-semibold text-zinc-700 dark:text-zinc-200">Reference Number:</span> ${escapeHtml(student?.registration_reference_number || '—')}</div>
                        <div><span class="font-semibold text-zinc-700 dark:text-zinc-200">Receipt Number:</span> ${escapeHtml(student?.registration_receipt_number || '—')}</div>
                        <div><span class="font-semibold text-zinc-700 dark:text-zinc-200">Payment Proof:</span> ${student?.registration_proof_path ? `<a href="${buildPublicFileUrl(student.registration_proof_path)}" target="_blank" rel="noopener" class="text-blue-700 underline">View file</a>` : '—'}</div>
                        <div><span class="font-semibold text-zinc-700 dark:text-zinc-200">Proof ID:</span> ${student?.age_verification_proof_path ? `<a href="${buildPublicFileUrl(student.age_verification_proof_path)}" target="_blank" rel="noopener" class="text-emerald-700 underline">View file</a>` : '—'}</div>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    body.innerHTML = `
        <div class="space-y-5">
            ${studentRegistrationRestartNotice ? `
                <div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 sm:px-5">
                    <div class="text-sm font-bold text-red-700">Registration rejected</div>
                    <div class="text-sm text-red-600 mt-1">Registration rejected. Please try again or contact admin.</div>
                </div>
            ` : ''}
            <div class="rounded-2xl border border-gold-500/20 bg-amber-50 dark:bg-gold-500/10 p-4 sm:p-5">
                <div class="text-sm font-bold text-zinc-900 dark:text-white">Complete this one step at a time</div>
                <div class="text-sm text-zinc-600 dark:text-zinc-300 mt-1">Fill in the student details, add guardian details if needed, then upload your registration payment.</div>
            </div>

            <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-4 sm:p-5">
                <div class="text-xs uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400 font-bold mb-4">1. Guardian</div>
                <div id="guardianAutoStatus" class="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">
                    Select the student's date of birth to check if guardian details are required.
                </div>
                <div id="guardianInputs" class="mt-4 space-y-3 hidden">
                    <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200">Guardian Email *</label>
                    <div class="flex flex-col sm:flex-row gap-2">
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
                    Guardian details are required automatically for students aged 18 and below.
                </div>
            </div>

            <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-4 sm:p-5">
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
                            <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200 mb-2">Middle Name</label>
                            <input id="regMiddleName" class="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:border-gold-500" />
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

            <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-4 sm:p-5">
                <div class="text-xs uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400 font-bold mb-4">3. Registration Payment</div>
                <form id="registrationPaymentForm" class="space-y-3">
                    <div class="rounded-xl border border-amber-300/70 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                        <div class="font-bold">Required before enrollment</div>
                        <div class="mt-1">Father &amp; Sons Music requires a <strong>₱1,000 lifetime registration fee</strong> before a student can be enrolled for the first time.</div>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200 mb-2">Lifetime Registration Fee</label>
                        <div class="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white font-bold">
                            ₱1,000.00
                        </div>
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
                        <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200 mb-2">Reference Number *</label>
                        <input type="text" id="regPayReference" placeholder="Enter GCash reference number" class="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:border-gold-500" />
                        <div id="regPayReferenceHint" class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Enter the payment reference or transaction number from your receipt.</div>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200 mb-2">Proof of Payment *</label>
                        <input type="file" id="regPayProof" accept=".jpg,.jpeg,.png,.webp,.pdf" class="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-700 dark:text-zinc-200 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gold-500/20 file:text-gold-600 file:font-semibold" />
                        <div class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Upload your payment screenshot or receipt for admin review.</div>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-zinc-600 dark:text-zinc-200 mb-2">Proof ID *</label>
                        <input type="file" id="regAgeProof" accept=".jpg,.jpeg,.png,.webp,.pdf" class="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-700 dark:text-zinc-200 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gold-500/20 file:text-gold-600 file:font-semibold" />
                    </div>
                    <div id="regPayStatus" class="text-xs text-zinc-500 dark:text-zinc-300"></div>
                </form>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div id="submitRegistrationStatus" class="text-sm text-zinc-500 dark:text-zinc-400"></div>
                <button type="button" id="submitRegistrationRequestBtn" class="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gold-500 hover:bg-gold-400 text-black text-sm font-extrabold transition">
                    Submit Registration Request
                </button>
            </div>
        </div>
    `;
}

function renderStudentActionBanner(student, meta, portal) {
    const banner = document.getElementById('studentActionBanner');
    const titleEl = document.getElementById('studentActionBannerTitle');
    const textEl = document.getElementById('studentActionBannerText');
    const buttonsEl = document.getElementById('studentActionBannerButtons');
    if (!banner || !titleEl || !textEl || !buttonsEl) return;

    const profileComplete = isRegistrationProfileComplete(student);
    const regStatus = String(student?.registration_status || 'Pending');
    const isRejected = regStatus === 'Rejected';
    const regPaid = ['Approved', 'Fee Paid'].includes(regStatus);
    const latestReq = meta?.latest_request || null;
    const hasPendingReq = latestReq && String(latestReq.status || '') === 'Pending';
    const enrollmentApproved = portal?.current_enrollment && String(portal.current_enrollment.status || '') === 'Active';
    const enrollmentCompleted = isStudentEnrollmentCompleted(portal);
    const reservationNotice = getScheduleFreezeReservationNotice(portal?.current_enrollment || null);

    if (enrollmentApproved && !reservationNotice && !enrollmentCompleted) {
        banner.classList.add('hidden');
        return;
    }

    let title = 'Complete your registration';
    let text = '';
    let actions = `
        <button type="button" onclick="openStudentRegistrationModal()" class="px-5 py-3 rounded-2xl bg-gold-500 hover:bg-gold-400 text-black text-sm font-extrabold transition">Register</button>
        <a href="student_profile.html" class="px-5 py-3 rounded-2xl bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-800 dark:text-zinc-100 text-sm font-semibold transition">Profile</a>
    `;

    if (enrollmentCompleted) {
        title = 'Ready for your next lesson package?';
        text = 'Continue your music journey with a new enrollment.';
        actions = `
            <button type="button" onclick="openStudentRequestModal()" class="px-5 py-3 rounded-2xl bg-gold-500 hover:bg-gold-400 text-black text-sm font-extrabold transition flex items-center gap-2">
                <i class="fas fa-rotate-right"></i>Enroll Again?
            </button>
            <a href="student_sessions.html" class="px-5 py-3 rounded-2xl bg-white/90 dark:bg-white/5 border border-gold-200 dark:border-white/10 text-zinc-800 dark:text-zinc-100 text-sm font-semibold transition">View History</a>
        `;
    } else if (reservationNotice) {
        title = 'Your account is frozen';
        text = `You have ${reservationNotice.usedAbsences} recorded absence${reservationNotice.usedAbsences === 1 ? '' : 's'}. Pay the ₱${reservationNotice.amount} slot reservation fee to restore access.`;

        // Store enrollment info on window for the pay modal
        window.__freezeEnrollmentId = Number(portal?.current_enrollment?.enrollment_id || 0);
        window.__freezeStudentId    = Number(student?.student_id || 0);
        window.__freezeAmount       = reservationNotice.amount;

        // Check if there's already a pending payment submission
        const pendingPayment = portal?.current_enrollment?.__freeze_payment_status;
        if (pendingPayment === 'Pending') {
            actions = `
                <span class="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-100 border border-amber-300 text-amber-800 text-sm font-bold">
                    <i class="fas fa-clock"></i> Payment Pending Approval
                </span>
                <a href="student_attendance.html" class="px-5 py-3 rounded-2xl bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-800 dark:text-zinc-100 text-sm font-semibold transition">Attendance</a>
            `;
        } else if (pendingPayment === 'Rejected') {
            actions = `
                <button type="button" onclick="openFreezePaymentModal()" class="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-extrabold transition flex items-center gap-2">
                    <i class="fas fa-snowflake"></i> Pay Again — ₱${reservationNotice.amount}
                </button>
                <span class="text-xs text-rose-500 font-semibold self-center">Previous payment was rejected.</span>
            `;
        } else {
            actions = `
                <button type="button" onclick="openFreezePaymentModal()" class="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-extrabold transition flex items-center gap-2">
                    <i class="fas fa-snowflake"></i> Pay Now — ₱${reservationNotice.amount}
                </button>
                <a href="student_attendance.html" class="px-5 py-3 rounded-2xl bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-800 dark:text-zinc-100 text-sm font-semibold transition">View Attendance</a>
            `;
        }
        // Make the banner visually distinct for frozen state
        banner.className = banner.className.replace('bg-amber-50', 'bg-rose-50').replace('dark:bg-gold-500/10', 'dark:bg-rose-500/10').replace('border-gold-500/25', 'border-rose-400/40');
    } else if (isRejected) {
        title = 'Registration was rejected';
        text = 'Open the form to try again.';
        actions = `<button type="button" onclick="openStudentRegistrationModal()" class="px-5 py-3 rounded-2xl bg-red-500 hover:bg-red-400 text-white text-sm font-extrabold transition">Register Again</button>`;
    } else if (profileComplete && !regPaid) {
        title = 'Waiting for approval';
        text = 'Your registration is being reviewed.';
        actions = `<button type="button" onclick="openStudentRegistrationModal()" class="px-5 py-3 rounded-2xl bg-gold-500 hover:bg-gold-400 text-black text-sm font-extrabold transition">Check Status</button>`;
    } else if (profileComplete && regPaid && hasPendingReq) {
        title = 'Class request sent';
        text = 'Please wait for staff approval.';
        actions = `<a href="student_sessions.html" class="px-5 py-3 rounded-2xl bg-gold-500 hover:bg-gold-400 text-black text-sm font-extrabold transition">Sessions</a>`;
    } else if (profileComplete && regPaid) {
        title = 'Request your classes';
        text = 'Choose your package and instrument.';
        actions = `
            <button type="button" onclick="openStudentRequestModal()" class="px-5 py-3 rounded-2xl bg-gold-500 hover:bg-gold-400 text-black text-sm font-extrabold transition">Request Classes</button>
            <a href="student_sessions.html" class="px-5 py-3 rounded-2xl bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-800 dark:text-zinc-100 text-sm font-semibold transition">Sessions</a>
        `;
    }

    titleEl.textContent = title;
    if (text) {
        textEl.textContent = text;
        textEl.classList.remove('hidden');
    } else {
        textEl.textContent = '';
        textEl.classList.add('hidden');
    }
    buttonsEl.innerHTML = actions;
    banner.classList.remove('hidden');
}

function renderStudentOnboardingSteps(student, meta, portal) {
    const container = document.getElementById('studentOnboardingSteps');
    if (!container) return;

    const profileComplete = isRegistrationProfileComplete(student);
    const regStatus = String(student?.registration_status || 'Pending');
    const isRejected = regStatus === 'Rejected';
    const regPaid = ['Approved', 'Fee Paid'].includes(regStatus);
    const latestReq = meta?.latest_request || null;
    const hasPendingReq = latestReq && String(latestReq.status || '') === 'Pending';
    const enrollmentApproved = portal?.current_enrollment && String(portal.current_enrollment.status || '') === 'Active';
    const registrationLocked = !profileComplete || !regPaid;
    const registrationBadge = isRejected
        ? renderOnboardingStatusBadge('Rejected', 'red')
        : profileComplete
        ? renderOnboardingStatusBadge('Done', 'green')
        : renderOnboardingStatusBadge('Do This First', 'amber');
    const paymentBadge = isRejected
        ? renderOnboardingStatusBadge('Rejected', 'red')
        : regPaid
        ? renderOnboardingStatusBadge('Approved', 'green')
        : renderOnboardingStatusBadge('Waiting', 'amber');
    const enrollmentBadge = enrollmentApproved
        ? renderOnboardingStatusBadge('Approved', 'green')
        : (hasPendingReq ? renderOnboardingStatusBadge('Sent', 'blue') : renderOnboardingStatusBadge('Not Yet', 'zinc'));

    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-5">
                <div class="flex items-center justify-between gap-2">
                    <div>
                        <div class="text-lg font-extrabold">Your details</div>
                    </div>
                    ${registrationBadge}
                </div>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-2 hidden" aria-hidden="true"></p>
                <div class="mt-4 flex flex-wrap gap-3">
                    <button type="button" onclick="openStudentRegistrationModal()" class="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white/10 text-white text-sm font-semibold">Open Registration</button>
                    <a href="student_profile.html" class="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-200 text-sm font-semibold">Open Profile</a>
                </div>
            </div>

            <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-5">
                <div class="flex items-center justify-between gap-2">
                    <div>
                        <div class="text-lg font-extrabold">Pay registration</div>
                    </div>
                    ${paymentBadge}
                </div>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-2 hidden" aria-hidden="true"></p>
                <div class="mt-4 flex flex-wrap gap-3">
                    ${isRejected
                        ? `<button type="button" onclick="openStudentRegistrationModal()" class="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-bold">Restart Registration</button>`
                        : registrationLocked
                        ? `<button type="button" onclick="openStudentRegistrationModal()" class="px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-black text-sm font-bold">Open Payment Step</button>`
                        : `<span class="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-300 text-sm font-bold">Already approved</span>`}
                </div>
            </div>

            <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-5">
                <div class="flex items-center justify-between gap-2">
                    <div>
                        <div class="text-lg font-extrabold">Request classes</div>
                    </div>
                    ${enrollmentBadge}
                </div>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-2 hidden" aria-hidden="true"></p>
                ${regPaid
                    ? `<div class="mt-4 flex flex-wrap gap-3">
                        <button type="button" onclick="openStudentRequestModal()" class="px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-black text-sm font-semibold">Open Class Request</button>
                        <a href="student_sessions.html" class="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-200 text-sm font-semibold">Open Sessions</a>
                    </div>`
                    : `<div class="mt-4 inline-flex items-center px-3 py-2 rounded-xl bg-zinc-100 dark:bg-white/5 text-sm text-zinc-600 dark:text-zinc-300">
                        Finish steps 1 and 2 first
                    </div>`}
                ${latestReq ? `<div class="mt-4">${renderStudentRequestStatus(latestReq)}</div>` : ''}
            </div>
        </div>
    `;
}

function wireStudentOnboardingActions(student, meta, portal) {
    const guardianAutoStatus = document.getElementById('guardianAutoStatus');
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
    const regPayReference = document.getElementById('regPayReference');
    const regPayReferenceHint = document.getElementById('regPayReferenceHint');
    const regPayProof = document.getElementById('regPayProof');
    const regAgeProof = document.getElementById('regAgeProof');
    const submitAllBtn = document.getElementById('submitRegistrationRequestBtn');
    const submitAllStatus = document.getElementById('submitRegistrationStatus');

    const hasGuardian = Array.isArray(portal?.guardians) && portal.guardians.length > 0;
    const getCurrentAge = () => computeAgeFromDob(document.getElementById('regDob')?.value || '');
    const isGuardianRequired = () => {
        const age = getCurrentAge();
        return age !== null && age <= 18;
    };
    const syncGuardianState = () => {
        const mustHaveGuardian = isGuardianRequired();
        if (guardianInputs) guardianInputs.classList.toggle('hidden', !mustHaveGuardian);
        if (guardianInfoBox) guardianInfoBox.classList.toggle('hidden', !mustHaveGuardian);
        if (guardianAutoStatus) {
            if (mustHaveGuardian) {
                guardianAutoStatus.textContent = 'Guardian details are required because the student is 18 years old or below.';
            } else if (getCurrentAge() === null) {
                guardianAutoStatus.textContent = "Select the student's date of birth to check if guardian details are required.";
            } else {
                guardianAutoStatus.textContent = 'Guardian details are not required because the student is above 18 years old.';
            }
        }
        if (!mustHaveGuardian) {
            if (guardianEmailInput) guardianEmailInput.value = '';
            if (guardianFirstNameInput) guardianFirstNameInput.value = '';
            if (guardianLastNameInput) guardianLastNameInput.value = '';
            if (guardianPhoneInput) guardianPhoneInput.value = '';
            if (guardianRelationshipInput) guardianRelationshipInput.value = '';
            if (guardianInfoBox) guardianInfoBox.textContent = '';
        }
    };

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
    const regMiddleName = document.getElementById('regMiddleName');
    const regEmail = document.getElementById('regEmail');
    const regPhone = document.getElementById('regPhone');
    const regDob = document.getElementById('regDob');
    const regAddress = document.getElementById('regAddress');
    if (regFirstName && !regFirstName.value) regFirstName.value = student?.first_name || '';
    if (regLastName && !regLastName.value) regLastName.value = student?.last_name || '';
    if (regMiddleName && !regMiddleName.value) regMiddleName.value = student?.middle_name || '';
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
            syncGuardianState();
        };
        regDob.addEventListener('change', updateAge);
        regDob.addEventListener('input', updateAge);
        updateAge();
    } else {
        syncGuardianState();
    }

    if (paymentForm) {
        paymentForm.onsubmit = (e) => e.preventDefault();
    }

    const updateRegistrationReferenceUI = () => {
        const method = String(document.getElementById('regPayMethod')?.value || 'Other').trim();
        if (!regPayReference || !regPayReferenceHint) return;
        const isCash = method === 'Cash';
        regPayReference.placeholder = isCash
            ? 'Enter official receipt or transaction number'
            : `Enter ${method || 'payment'} reference number`;
        regPayReferenceHint.textContent = isCash
            ? 'For cash payments, enter the official receipt or transaction number.'
            : 'Required together with the uploaded proof of payment.';
    };
    document.getElementById('regPayMethod')?.addEventListener('change', updateRegistrationReferenceUI);
    updateRegistrationReferenceUI();

    if (submitAllBtn) {
        submitAllBtn.onclick = async () => {
            const guardianRequired = isGuardianRequired();
            if (guardianRequired) {
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
                middle_name: document.getElementById('regMiddleName')?.value?.trim() || '',
                email: document.getElementById('regEmail')?.value?.trim() || '',
                phone: document.getElementById('regPhone')?.value?.trim() || '',
                address: document.getElementById('regAddress')?.value?.trim() || '',
                date_of_birth: document.getElementById('regDob')?.value || null,
                branch_id: Number(document.getElementById('regBranch')?.value || 0)
            };
            payload.age = computeAgeFromDob(payload.date_of_birth);

            const amount = 1000;
            const method = document.getElementById('regPayMethod')?.value || 'Other';
            const referenceNumber = regPayReference?.value?.trim() || '';
            const proofFile = regPayProof?.files && regPayProof.files[0] ? regPayProof.files[0] : null;
            const ageProofFile = regAgeProof?.files && regAgeProof.files[0] ? regAgeProof.files[0] : null;

            if (!isRegistrationProfileComplete(payload)) {
                showMessage('Please complete all required registration details.', 'error');
                return;
            }
            if (!proofFile) {
                showMessage('Upload proof of payment for admin approval.', 'error');
                return;
            }
            if (!referenceNumber) {
                showMessage('Enter the payment reference number for admin approval.', 'error');
                return;
            }
            if (!ageProofFile) {
                showMessage('Upload proof ID for age verification.', 'error');
                return;
            }

            submitAllBtn.disabled = true;
            submitAllBtn.textContent = 'Submitting...';
            if (submitAllStatus) submitAllStatus.textContent = 'Submitting registration request...';
            if (regPayStatus) regPayStatus.textContent = '';

            try {
                if (guardianRequired) {
                    const details = {
                        first_name: guardianFirstNameInput?.value?.trim() || '',
                        last_name: guardianLastNameInput?.value?.trim() || '',
                        phone: guardianPhoneInput?.value?.trim() || '',
                        relationship: guardianRelationshipInput?.value?.trim() || ''
                    };

                    const resGuardian = await setGuardianMode(student.student_id, 'With Guardian', guardianEmailInput?.value?.trim() || '', details);
                    if (!resGuardian?.success) {
                        throw new Error(resGuardian?.error || 'Failed to save guardian details.');
                    }
                } else if (hasGuardian) {
                    // Preserve existing guardian links for adult students unless staff changes them manually.
                }

                const resReg = await axios.post(`${baseApiUrl}/students.php`, payload);
                if (!(resReg.data && resReg.data.success)) {
                    throw new Error(resReg.data?.error || 'Failed to save registration details.');
                }

                const formData = new FormData();
                formData.append('student_id', String(Number(student.student_id)));
                formData.append('amount', String(amount));
                formData.append('payment_method', String(method));
                formData.append('reference_number', String(referenceNumber));
                formData.append('registration_proof_file', proofFile);
                formData.append('age_verification_proof_file', ageProofFile);

                const resPay = await axios.post(`${baseApiUrl}/users.php?action=pay-registration-fee`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (!(resPay.data && resPay.data.success)) {
                    throw new Error(resPay.data?.error || 'Payment submission failed.');
                }

                try {
                    sessionStorage.removeItem('student_registration_rejected_notice');
                } catch (e) {
                    // Ignore storage issues.
                }
                studentRegistrationRestartNotice = false;

                const msg = resPay.data?.message || 'Registration request submitted.';
                closeStudentRegistrationModal();
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

    const portal = await fetchStudentPortalDataByEmail(user.email);
    if (await handleStudentRegistrationReset(portal, 'This registration was rejected or removed. Please register again.')) return;
    if (!portal.success) {
        showMessage(portal.error || 'Failed to load your profile.', 'error');
        return;
    }

    const s = portal.student;
    applyStudentPortalIdentity(user, portal);
    setHtml('studentStatusBadge', `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${badgeClassForRegistrationStatus(s.registration_status)}">${escapeHtml(s.registration_status || '—')}</span>`);

    const profileComplete = isRegistrationProfileComplete(s);
    const regPaid = ['Approved', 'Fee Paid'].includes(String(s.registration_status || 'Pending'));
    const isNewStudent = !profileComplete || !regPaid;
    const enrollmentApproved = portal.current_enrollment && String(portal.current_enrollment.status || '') === 'Active';
    const enrollmentCompleted = isStudentEnrollmentCompleted(portal);
    const isEnrolledStudent = Boolean(enrollmentApproved);
    const overviewGrid = document.getElementById('studentOverviewGrid');
    const overviewCard = document.getElementById('studentEnrollmentOverviewCard');
    const performanceCard = document.getElementById('studentPerformanceCard');
    const requestShortcutCard = document.getElementById('studentRequestShortcutCard');
    const upcomingCard = document.getElementById('studentUpcomingScheduleCard');
    const qrCard = document.getElementById('studentQrCard');
    const completedState = document.getElementById('studentCompletedState');
    bindStudentModalFrame('studentRegistrationModal', closeStudentRegistrationModal);
    bindStudentModalFrame('studentRequestModal', closeStudentRequestModal);
    if (!window.__studentModalEscBound) {
        window.__studentModalEscBound = true;
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeStudentRegistrationModal();
                closeStudentRequestModal();
            }
        });
    }
    if (overviewGrid) {
        overviewGrid.classList.toggle('hidden', isNewStudent || enrollmentCompleted);
    }
    const welcomeNote = document.getElementById('studentWelcomeNote');
    if (welcomeNote) {
        if (enrollmentCompleted) {
            welcomeNote.textContent = 'Your previous package is complete. View your certificate or start a new enrollment.';
        } else if (isEnrolledStudent) {
            welcomeNote.textContent = 'View your upcoming class, open your QR code, and keep your profile updated.';
        } else if (isNewStudent) {
            welcomeNote.textContent = 'Check your registration status here, then continue to enrollment once admin approval is complete.';
        } else {
            welcomeNote.textContent = 'Quick view of your account and QR. For full details, open Sessions or Profile.';
        }
    }
    if (overviewCard) overviewCard.classList.toggle('hidden', isEnrolledStudent || enrollmentCompleted);
    if (performanceCard) performanceCard.classList.toggle('hidden', !isEnrolledStudent || enrollmentCompleted);
    if (requestShortcutCard) requestShortcutCard.classList.toggle('hidden', isEnrolledStudent || !regPaid || enrollmentCompleted);
    if (upcomingCard) upcomingCard.classList.toggle('hidden', !isEnrolledStudent || enrollmentCompleted);
    if (qrCard) qrCard.classList.toggle('hidden', true);
    if (completedState) {
        if (enrollmentCompleted) {
            completedState.innerHTML = renderStudentCompletedSessionsPanel(portal);
            completedState.classList.remove('hidden');
        } else {
            completedState.innerHTML = '';
            completedState.classList.add('hidden');
        }
    }

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

    if (isEnrolledStudent) {
        const performanceRows = Array.isArray(portal.current_session_grades) ? portal.current_session_grades : [];
        const performanceMetrics = buildStudentPerformanceMetrics(performanceRows);
        setHtml('studentPerformanceCard', renderStudentPerformanceProfile(performanceMetrics, performanceRows));
        renderStudentPerformanceRadar(performanceMetrics);
    } else {
        setHtml('studentPerformanceCard', '');
        renderStudentPerformanceRadar([]);
    }

    const dashboardCertificateCard = document.getElementById('studentCertificateCard');
    if (dashboardCertificateCard) {
        const certificateMarkup = renderStudentCertificateCard(portal);
        dashboardCertificateCard.innerHTML = certificateMarkup;
        dashboardCertificateCard.classList.toggle('hidden', certificateMarkup === '');
    }

    let meta = null;
    try {
        const resMeta = await fetchStudentRequestMetaByEmail(user.email);
        if (resMeta?.success) {
            meta = resMeta;
            if (!isEnrolledStudent && regPaid) {
                initStudentRequestSection(s, meta);
            }
        }
    } catch (e) {
        setHtml('studentAvailabilityCalendar', '<div class="text-zinc-500">Unable to load teacher availability right now.</div>');
    }

    // Fetch current freeze payment status so the banner shows the right state
    const freezeNotice = getScheduleFreezeReservationNotice(portal?.current_enrollment || null);
    if (freezeNotice && portal?.current_enrollment?.enrollment_id) {
        try {
            const fpRes  = await axios.get(`${baseApiUrl}/students.php?action=get-student-freeze-payment-status&enrollment_id=${encodeURIComponent(portal.current_enrollment.enrollment_id)}`);
            const fpData = fpRes.data || {};
            if (fpData.success && fpData.payment) {
                portal.current_enrollment.__freeze_payment_status = fpData.payment.status;
            }
        } catch (_) { /* non-critical */ }
    }
    studentDashboardPortalState = portal;
    notifyFreezeRestoredForStudentPortal(portal, s);
    startStudentFreezeRefreshWatcher();

    if (!isEnrolledStudent && !enrollmentCompleted) {
        studentDashboardMetaState = meta;
        renderStudentActionBanner(s, meta, portal);
        renderStudentOnboardingSteps(s, meta, portal);
        renderStudentRegistrationModal(s, portal);
        wireStudentOnboardingActions(s, meta, portal);

        let reopenRegistrationModal = false;
        try {
            reopenRegistrationModal = sessionStorage.getItem('student_reopen_registration_modal') === '1';
            studentRegistrationRestartNotice = sessionStorage.getItem('student_registration_rejected_notice') === '1';
            if (reopenRegistrationModal) {
                sessionStorage.removeItem('student_reopen_registration_modal');
            }
        } catch (e) {
            reopenRegistrationModal = false;
            studentRegistrationRestartNotice = false;
        }
        if (reopenRegistrationModal) {
            renderStudentRegistrationModal(s, portal);
            setStudentModalState('studentRegistrationModal', true);
        }
    } else {
        renderStudentActionBanner(s, meta, portal);
        setHtml('studentOnboardingSteps', '');
        closeStudentRegistrationModal();
        closeStudentRequestModal();
    }

    if (!enrollmentApproved) {
        if (qrCard) {
            qrCard.classList.add('hidden');
            qrCard.classList.add('opacity-70');
        }
        setHtml('qrCodeBox', '<div class="text-sm text-zinc-500 text-center">QR locked until admin approves your enrollment.</div>');
        setText('qrPayloadText', 'Locked — approval required');
    } else {
        try {
            const qrStatusRes = await fetchStudentQrStatus(Number(s.student_id || 0), s.email || '');
            const qrStatus = qrStatusRes?.qr_status || { code: 'no_session', message: 'You do not have a session today.' };

            if (qrStatus.code === 'valid_today') {
                if (qrCard) {
                    qrCard.classList.remove('hidden');
                    qrCard.classList.remove('opacity-70');
                }
                const payload = buildStudentQrPayload(s);
                setText('qrPayloadText', payload);
                renderQrCode('qrCodeBox', payload);
            } else {
                if (qrCard) qrCard.classList.add('hidden');
                setText('qrPayloadText', qrStatus.message || 'QR unavailable');
                setHtml('qrCodeBox', `<div class="text-sm text-zinc-500 text-center">${escapeHtml(qrStatus.message || 'QR unavailable for today.')}</div>`);
            }
        } catch (_) {
            if (qrCard) qrCard.classList.add('hidden');
            setText('qrPayloadText', 'QR status unavailable');
            setHtml('qrCodeBox', '<div class="text-sm text-zinc-500 text-center">Unable to verify your QR status right now.</div>');
        }
    }
}

async function initStudentQrPage() {
    if (!checkStudentAuth()) return;
    const user = Auth.getUser();

    const portal = await fetchStudentPortalDataByEmail(user.email);
    if (await handleStudentRegistrationReset(portal, 'This registration was rejected or removed. Please register again.')) return;
    if (!portal.success) {
        showMessage(portal.error || 'Failed to load your QR code.', 'error');
        return;
    }
    const s = portal.student;
    applyStudentPortalIdentity(user, portal);

    const enrollmentApproved = portal.current_enrollment && String(portal.current_enrollment.status || '') === 'Active';
    if (!enrollmentApproved) {
        renderStudentQrStatus({ code: 'no_session', message: 'QR locked until admin approves your enrollment.' });
        setHtml('qrCodeBox', '<div class="text-sm text-zinc-500 dark:text-zinc-400 text-center">QR locked until admin approves your enrollment.</div>');
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
            setHtml('qrCodeBox', `<div class="text-sm text-zinc-600 dark:text-zinc-300 text-center">${escapeHtml(qrStatus.message || 'QR unavailable for today.')}</div>`);
        }
    } catch (error) {
        renderStudentQrStatus({ code: 'no_session', message: 'Unable to verify your QR status right now.' });
        setText('qrPayloadText', 'QR status unavailable');
        setHtml('qrCodeBox', '<div class="text-sm text-zinc-600 dark:text-zinc-300 text-center">Unable to verify your QR status right now.</div>');
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

    const portal = await fetchStudentPortalDataByEmail(user.email);
    if (await handleStudentRegistrationReset(portal, 'This registration was rejected or removed. Please register again.')) return;
    if (!portal.success) {
        showMessage(portal.error || 'Failed to load sessions.', 'error');
        return;
    }
    const s = portal.student;
    applyStudentPortalIdentity(user, portal);
    setText('packageName', s.package_name || 'Not assigned yet');
    setText('packageSessions', s.package_sessions ? `${s.package_sessions} sessions included` : '—');
    setText('gradedSessionCount', '—');
    setText('currentGradeAverage', '—');

    const enrollmentApproved = portal.current_enrollment && String(portal.current_enrollment.status || '') === 'Active';
    let summaryRes = null;
    if (!enrollmentApproved) {
        setHtml('attendanceTableBody', `
            <tr>
                <td colspan="5" class="px-6 py-10 text-center text-zinc-400">
                    <i class="fas fa-lock text-2xl mb-2"></i>
                    <div class="font-semibold">Session tracking is locked</div>
                    <div class="text-xs text-zinc-500 mt-1">Your session grades will appear here after admin approves your enrollment.</div>
                </td>
            </tr>
        `);
    } else {
        const rows = Array.isArray(portal.current_session_grades) ? portal.current_session_grades : [];
        const gradedRows = rows.filter(r => Number(r.progress_id || 0) > 0 && Number(r.average_score || 0) > 0);
        const averageGrade = gradedRows.length
            ? (gradedRows.reduce((sum, row) => sum + Number(row.average_score || 0), 0) / gradedRows.length).toFixed(2)
            : null;

        setText('gradedSessionCount', String(gradedRows.length));
        setText('currentGradeAverage', averageGrade ? `${averageGrade}/5` : 'Pending');

        const sortedRows = [...rows].sort((a, b) => {
            const aTime = new Date(`${a?.session_date || ''}T${a?.start_time || '00:00:00'}`).getTime() || 0;
            const bTime = new Date(`${b?.session_date || ''}T${b?.start_time || '00:00:00'}`).getTime() || 0;
            return bTime - aTime;
        });

        window.__studentGradesRows = sortedRows;
        window.__studentSessionsRows = sortedRows;

        if (sortedRows.length === 0) {
            setHtml('attendanceTableBody', `
                <div class="rounded-3xl border border-dashed border-zinc-300 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-6 py-10 text-center text-zinc-400">
                    <i class="fas fa-calendar-minus text-2xl mb-2"></i>
                    <div class="font-semibold">No session records yet</div>
                    <div class="text-xs text-zinc-500 mt-1">Your session tracker will fill in once your class schedule is generated.</div>
                </div>
            `);
        } else {
            setHtml('attendanceTableBody', sortedRows.map((r, index) => {
                const dateValue = r.session_date ? new Date(r.session_date) : null;
                const monthLabel = dateValue ? dateValue.toLocaleDateString('en-PH', { month: 'short' }).toUpperCase() : '—';
                const dayLabel = dateValue ? dateValue.toLocaleDateString('en-PH', { day: '2-digit' }) : '—';
                const weekdayLabel = dateValue ? dateValue.toLocaleDateString('en-PH', { weekday: 'short' }).toUpperCase() : '—';
                const dateLabel = r.session_date ? formatDateLong(r.session_date) : 'Date pending';
                const start = r.start_time ? formatTime12Hour(r.start_time) : '';
                const end = r.end_time ? formatTime12Hour(r.end_time) : '';
                const timeLabel = start && end ? `${start} - ${end}` : (start || 'Time pending');
                const sessionNumber = r.session_number ? `Session ${escapeHtml(String(r.session_number))}` : 'Session';
                const attendanceLabel = r.attendance_status && r.attendance_status !== 'Pending'
                    ? r.attendance_status
                    : (r.status || 'Scheduled');
                const roomLabel = r.room_name || 'Room to be confirmed';
                const teacherLabel = r.teacher_name || 'Teacher pending';
                const sessionState = Number(r.progress_id || 0) > 0
                    ? 'Graded'
                    : ((String(r.status || '').toLowerCase() === 'completed' || String(r.attendance_status || '').toLowerCase() === 'present') ? 'Upcoming' : 'Upcoming');
                const noteLabel = Number(r.progress_id || 0) > 0
                    ? 'This session has already been graded. Open the details to review the score and remarks.'
                    : 'Not scored yet - your coach will grade this after the session.';

                return `
                    <article class="rounded-2xl border ${Number(r.progress_id || 0) > 0 ? 'border-zinc-200 dark:border-white/10' : 'border-gold-500/30 dark:border-gold-500/20'} bg-white dark:bg-white/5 p-3 sm:p-4 shadow-sm hover:shadow-md transition">
                        <div class="flex flex-col gap-3 md:flex-row md:items-center">
                            <div class="flex items-start gap-3 min-w-0 flex-1">
                                <div class="shrink-0 rounded-xl bg-amber-50 dark:bg-white/5 border border-amber-100 dark:border-white/10 px-2 py-2 text-center leading-none w-16">
                                    <div class="text-[9px] font-black tracking-[0.18em] text-amber-700 dark:text-amber-300">${escapeHtml(monthLabel)}</div>
                                    <div class="mt-1 text-2xl font-black text-zinc-900 dark:text-white">${escapeHtml(dayLabel)}</div>
                                    <div class="mt-1 text-[9px] font-black tracking-[0.16em] text-amber-700/80 dark:text-amber-200">${escapeHtml(weekdayLabel)}</div>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <div class="text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400 font-bold">${escapeHtml(sessionNumber)}</div>
                                        <span class="inline-flex items-center rounded-full border border-gold-500/30 bg-gold-500/10 px-2.5 py-1 text-[10px] font-bold text-gold-700 dark:text-gold-300">
                                            <i class="fas fa-calendar-day mr-1 text-[9px]"></i>${escapeHtml(sessionState)}
                                        </span>
                                    </div>
                                    <div class="mt-1.5 text-lg sm:text-xl font-black text-zinc-900 dark:text-white">${escapeHtml(dateLabel)}</div>
                                    <div class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-zinc-500 dark:text-zinc-300">
                                        <span class="inline-flex items-center gap-1.5"><i class="far fa-clock text-zinc-400"></i>${escapeHtml(timeLabel)}</span>
                                        <span class="inline-flex items-center gap-1.5"><i class="far fa-circle-dot text-zinc-400"></i>${escapeHtml(roomLabel)}</span>
                                        <span class="inline-flex items-center gap-1.5"><i class="far fa-user text-zinc-400"></i>${escapeHtml(teacherLabel)}</span>
                                    </div>
                                    <div class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">${escapeHtml(noteLabel)}</div>
                                </div>
                            </div>
                            <div class="flex flex-col items-start md:items-end gap-2">
                                <button type="button" onclick="openStudentGradeDetails(${index})" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-gold-500 hover:bg-gold-400 text-black text-xs font-extrabold transition shadow-sm whitespace-nowrap">
                                    View details <i class="fas fa-chevron-right text-[9px]"></i>
                                </button>
                                <div class="flex flex-wrap items-center justify-start md:justify-end gap-2">
                                    ${renderAttendanceStatusBadge(attendanceLabel)}
                                    ${renderStudentGradeBadge(r.average_score, r.progress_id)}
                                </div>
                            </div>
                        </div>
                        <div class="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                            Skill level: <span class="font-semibold text-zinc-700 dark:text-zinc-200">${escapeHtml(r.skill_level || 'Not graded yet')}</span>
                        </div>
                    </article>
                `;
            }).join(''));
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

function renderStudentGradeBadge(averageScore, progressId) {
    const hasGrade = Number(progressId || 0) > 0 && Number(averageScore || 0) > 0;
    const label = hasGrade ? `${Number(averageScore).toFixed(2)}/5` : 'Pending';
    const cls = hasGrade
        ? 'bg-gold-500/15 text-gold-300 border border-gold-500/30'
        : 'bg-zinc-500/15 text-zinc-300 border border-zinc-500/25';
    return `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${cls}">${escapeHtml(label)}</span>`;
}

function renderStudentSkillLevel(skillLevel) {
    if (!skillLevel) {
        return '<span class="text-zinc-500">Not graded yet</span>';
    }
    return `<span class="font-semibold text-white">${escapeHtml(skillLevel)}</span>`;
}

function buildStudentGradeDetailsMarkup(row) {
    const dateLabel = row.session_date ? formatDateLong(row.session_date) : 'Date pending';
    const timeLabel = row.start_time && row.end_time
        ? `${formatTime12Hour(row.start_time)} - ${formatTime12Hour(row.end_time)}`
        : (row.start_time ? formatTime12Hour(row.start_time) : 'Time pending');
    const hasGrade = Number(row.progress_id || 0) > 0 && Number(row.average_score || 0) > 0;
    const averageScore = hasGrade ? Number(row.average_score).toFixed(2) : null;
    const remarksText = cleanSessionNoteText(row.teacher_remarks || row.remarks, 'No remarks recorded for this session.');
    const remarks = escapeHtml(remarksText);
    const scorePills = [
        ['Perf', row.performance_score],
        ['Tech', row.technique_score],
        ['Rhythm', row.rhythm_score],
        ['Focus', row.focus_score],
        ['Assign', row.assignment_score]
    ].map(([label, value]) => `
        <div class="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm">
            <div class="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.16em]">${escapeHtml(label)}</div>
            <div class="mt-0.5 text-sm font-black text-zinc-900">${value ? `${escapeHtml(String(value))}/5` : '—'}</div>
        </div>
    `).join('');

    return `
        <div class="text-left overflow-hidden rounded-[1.25rem] bg-[#f8f4ea] max-w-[94vw] sm:max-w-none max-h-[calc(100vh-1rem)] flex flex-col">
            <div class="flex items-start justify-between gap-3 bg-[#bd9525] px-4 py-3.5 text-white">
                <div>
                    <div class="text-[10px] font-black uppercase tracking-[0.22em] text-white/90">Session ${escapeHtml(String(row.session_number || ''))}</div>
                    <h3 class="mt-1 text-base sm:text-lg font-black leading-tight">${escapeHtml(row.instrument_name || 'Instrument Session')}</h3>
                </div>
                <button type="button" onclick="Swal.close()" class="h-8 w-8 shrink-0 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition" aria-label="Close modal">
                    <i class="fas fa-times text-xs"></i>
                </button>
            </div>
            <div class="px-4 py-4 bg-white overflow-y-auto">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div class="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 flex items-center gap-3">
                        <div class="h-9 w-9 rounded-xl bg-white border border-zinc-200 grid place-items-center text-gold-500 shrink-0">
                            <i class="far fa-calendar text-sm"></i>
                        </div>
                        <div>
                            <div class="text-[11px] text-zinc-400 font-medium">Date</div>
                            <div class="text-sm font-extrabold text-zinc-900">${escapeHtml(dateLabel)}</div>
                        </div>
                    </div>
                    <div class="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 flex items-center gap-3">
                        <div class="h-9 w-9 rounded-xl bg-white border border-zinc-200 grid place-items-center text-gold-500 shrink-0">
                            <i class="far fa-clock text-sm"></i>
                        </div>
                        <div>
                            <div class="text-[11px] text-zinc-400 font-medium">Time</div>
                            <div class="text-sm font-extrabold text-zinc-900">${escapeHtml(timeLabel)}</div>
                        </div>
                    </div>
                    <div class="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 flex items-center gap-3">
                        <div class="h-9 w-9 rounded-xl bg-white border border-zinc-200 grid place-items-center text-gold-500 shrink-0">
                            <i class="far fa-circle-dot text-sm"></i>
                        </div>
                        <div>
                            <div class="text-[11px] text-zinc-400 font-medium">Location</div>
                            <div class="text-sm font-extrabold text-zinc-900">${escapeHtml(row.room_name || 'To be confirmed')}</div>
                        </div>
                    </div>
                    <div class="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 flex items-center gap-3">
                        <div class="h-9 w-9 rounded-xl bg-white border border-zinc-200 grid place-items-center text-gold-500 shrink-0">
                            <i class="far fa-user text-sm"></i>
                        </div>
                        <div>
                            <div class="text-[11px] text-zinc-400 font-medium">Coach</div>
                            <div class="text-sm font-extrabold text-zinc-900">${escapeHtml(row.teacher_name || 'Not assigned')}</div>
                        </div>
                    </div>
                </div>

                <div class="mt-3 flex flex-wrap items-center gap-2">
                    ${renderStudentGradeBadge(row.average_score, row.progress_id)}
                </div>

                <div class="mt-4 rounded-xl border border-zinc-100 bg-[#faf8f2] px-4 py-3">
                    <div class="text-sm font-bold text-zinc-900">${hasGrade ? `Score ${escapeHtml(averageScore)}/5` : 'Not graded yet'}</div>
                    <div class="mt-1 text-sm leading-6 text-zinc-600">
                        ${hasGrade ? 'Feedback below.' : 'Coach will grade after the session.'}
                    </div>
                </div>

                <div class="mt-4">
                    <div class="rounded-xl border border-zinc-100 bg-white px-4 py-3 text-sm leading-6 text-zinc-600 shadow-sm">
                        ${remarks}
                    </div>
                </div>

                <div class="mt-4">
                    <div class="flex items-center gap-2 text-sm font-bold text-zinc-900">
                        <i class="fas fa-chart-pie text-gold-500"></i> Breakdown
                    </div>
                    <div class="mt-2 grid grid-cols-2 gap-2">
                        ${scorePills}
                    </div>
                </div>

                <div class="mt-4">
                    <button type="button" onclick="Swal.close()" class="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#12192a] px-5 py-2.5 text-sm text-white font-extrabold shadow-lg shadow-[#12192a]/20 hover:bg-[#0d1322] transition">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
}

function openStudentGradeDetails(index) {
    const rows = Array.isArray(window.__studentSessionsRows) && window.__studentSessionsRows.length
        ? window.__studentSessionsRows
        : (Array.isArray(window.__studentGradesRows) ? window.__studentGradesRows : []);
    const row = rows[Number(index)];
    if (!row) return;
    Swal.fire({
        width: 390,
        showConfirmButton: false,
        showCloseButton: false,
        background: 'transparent',
        padding: 0,
        customClass: {
            popup: 'session-detail-swal'
        },
        html: buildStudentGradeDetailsMarkup(row)
    });
}

window.openStudentGradeDetails = openStudentGradeDetails;

async function initStudentGradesPage() {
    const listEl = document.getElementById('studentGradesList');
    if (!checkStudentAuth()) return;
    const user = Auth.getUser();

    if (!listEl) return;

    try {
        const portal = await fetchStudentPortalDataByEmail(user.email);
        if (await handleStudentRegistrationReset(portal, 'This registration was rejected or removed. Please register again.')) return;
        if (!portal.success) {
            listEl.innerHTML = `
                <div class="rounded-3xl border border-dashed border-red-200 bg-red-50 px-6 py-12 text-center text-red-600">
                    <div class="font-semibold">Failed to load grades</div>
                    <div class="text-sm mt-2">${escapeHtml(portal.error || 'The portal did not return grade data.')}</div>
                </div>
            `;
            return;
        }

        applyStudentPortalIdentity(user, portal);
        studentDashboardPortalState = portal;
        studentDashboardMetaState = portal;
        const enrollmentApproved = portal.current_enrollment && String(portal.current_enrollment.status || '') === 'Active';
        const rows = Array.isArray(portal.current_session_grades) ? portal.current_session_grades : [];
        const gradedRows = rows.filter(row => Number(row.progress_id || 0) > 0);
        const pendingRows = rows.filter(row => Number(row.progress_id || 0) < 1);
        const packageSessions = Number(portal.current_enrollment?.package_sessions || portal.student?.package_sessions || 0);
        const completedSessions = Math.max(Number(portal.current_enrollment?.completed_sessions || 0), gradedRows.length);
        const remainingSessions = packageSessions > 0 ? Math.max(0, packageSessions - completedSessions) : null;
        const progressPercent = packageSessions > 0
            ? Math.max(0, Math.min(100, Math.round((completedSessions / packageSessions) * 100)))
            : 0;
        const averageValue = gradedRows.length
            ? (gradedRows.reduce((sum, row) => sum + Number(row.average_score || 0), 0) / gradedRows.length).toFixed(2)
            : null;
        const latestGraded = gradedRows.find(row => row.assessment_date || row.updated_at) || null;

        setText('studentGradesPackage', portal.student?.package_name || 'No active package yet');
        setText('studentGradesSessionsDone', String(completedSessions));
        setText('studentGradesSessionsTotal', packageSessions > 0 ? String(packageSessions) : '—');
        setText(
            'studentGradesSessionsLeft',
            packageSessions > 0
                ? `${remainingSessions} session${remainingSessions === 1 ? '' : 's'} left to go`
                : 'Session total not available yet'
        );
        setText('studentGradesAverage', averageValue ? `${averageValue}/5` : 'Pending');
        setText('studentGradesCompleted', String(completedSessions));
        setText('studentGradesPending', String(pendingRows.length));
        setText(
            'studentGradesLatest',
            latestGraded
                ? formatDateLong(latestGraded.assessment_date || latestGraded.session_date || '')
                : (enrollmentApproved ? 'No graded session yet' : 'Locked until approval')
        );
        const progressBar = document.getElementById('studentGradesProgressBar');
        if (progressBar) {
            progressBar.style.width = `${progressPercent}%`;
        }

        const gradesCertificateCard = document.getElementById('studentCertificateCard');
        if (gradesCertificateCard) {
            const certificateMarkup = renderStudentCertificateCard(portal);
            gradesCertificateCard.innerHTML = certificateMarkup;
            gradesCertificateCard.classList.toggle('hidden', certificateMarkup === '');
        }

        if (!enrollmentApproved) {
            listEl.innerHTML = `
                <div class="rounded-3xl border border-dashed border-zinc-300 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-6 py-12 text-center text-zinc-500 dark:text-zinc-400">
                    <i class="fas fa-lock text-2xl mb-3"></i>
                    <div class="font-semibold text-zinc-900 dark:text-white">Grades are locked for now</div>
                    <div class="text-sm mt-2">Your teacher assessments will appear here once your enrollment becomes active.</div>
                </div>
            `;
            return;
        }

        const sortedRows = [...rows].sort((a, b) => {
            const aTime = new Date(`${a?.session_date || ''}T${a?.start_time || '00:00:00'}`).getTime() || 0;
            const bTime = new Date(`${b?.session_date || ''}T${b?.start_time || '00:00:00'}`).getTime() || 0;
            if (aTime !== bTime) return aTime - bTime;
            return Number(a?.session_number || 0) - Number(b?.session_number || 0);
        });
        setText('studentSessionsCount', `${sortedRows.length} total`);
        const sortedGradedRows = sortedRows.filter(row => Number(row.progress_id || 0) > 0);
        const sortedPendingRows = sortedRows.filter(row => Number(row.progress_id || 0) < 1);

        if (!sortedRows.length) {
            setText('studentSessionsCount', '0 total');
            listEl.innerHTML = `
                <div class="rounded-3xl border border-dashed border-zinc-300 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-6 py-12 text-center text-zinc-500 dark:text-zinc-400">
                    <i class="fas fa-chart-line text-2xl mb-3"></i>
                    <div class="font-semibold text-zinc-900 dark:text-white">No session grades yet</div>
                    <div class="text-sm mt-2">Your grade history will appear here as soon as your teacher records session assessments.</div>
                </div>
            `;
            return;
        }

        window.__studentGradesRows = sortedRows;
        const gradedSection = sortedGradedRows.length
            ? `
                <section class="space-y-4">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <div class="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400 font-bold">Graded Sessions</div>
                            <div class="mt-2 text-lg font-extrabold text-zinc-900 dark:text-white">Sessions with recorded grades</div>
                        </div>
                    </div>
                    ${sortedGradedRows.map((row) => {
                        const index = sortedRows.indexOf(row);
                        const dateLabel = row.session_date ? formatDateLong(row.session_date) : 'Date pending';
                        const timeLabel = row.start_time && row.end_time
                            ? `${formatTime12Hour(row.start_time)} - ${formatTime12Hour(row.end_time)}`
                            : (row.start_time ? formatTime12Hour(row.start_time) : 'Time pending');
                        return `
                            <article class="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 shadow-lg dark:shadow-black/20">
                                <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <div class="text-xs uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400 font-bold">Session ${escapeHtml(String(row.session_number || ''))}</div>
                                        <h3 class="mt-2 text-lg font-black text-zinc-900 dark:text-white">${escapeHtml(row.instrument_name || 'Instrument Session')}</h3>
                                        <div class="mt-2 text-sm text-zinc-500 dark:text-zinc-400">${escapeHtml(dateLabel)} • ${escapeHtml(timeLabel)}</div>
                                        <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">${escapeHtml(row.teacher_name || 'Teacher not assigned')} • ${escapeHtml(row.room_name || 'Room to be announced')}</div>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2">
                                        ${renderAttendanceStatusBadge(row.attendance_status && row.attendance_status !== 'Pending' ? row.attendance_status : (row.status || 'Scheduled'))}
                                        ${renderStudentGradeBadge(row.average_score, row.progress_id)}
                                        <button type="button" onclick="openStudentGradeDetails(${index})" class="inline-flex items-center px-4 py-2 rounded-2xl bg-gold-500 hover:bg-gold-400 text-black text-sm font-extrabold transition">
                                            View Grades
                                        </button>
                                    </div>
                                </div>
                            </article>
                        `;
                    }).join('')}
                </section>
            `
            : `
                <section class="rounded-3xl border border-dashed border-zinc-300 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-6 py-10 text-center text-zinc-500 dark:text-zinc-400">
                    <div class="font-semibold text-zinc-900 dark:text-white">No graded sessions yet</div>
                    <div class="text-sm mt-2">Your graded sessions will appear here once your teacher records assessments.</div>
                </section>
            `;

        const pendingSection = sortedPendingRows.length
            ? `
                <section class="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 shadow-lg dark:shadow-black/20">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <div class="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400 font-bold">Waiting for Grade</div>
                            <div class="mt-2 text-lg font-extrabold text-zinc-900 dark:text-white">Upcoming or ungraded sessions</div>
                        </div>
                        <div class="text-sm text-zinc-500 dark:text-zinc-400">${sortedPendingRows.length} session${sortedPendingRows.length > 1 ? 's' : ''}</div>
                    </div>
                    <div class="mt-4 space-y-3">
                        ${sortedPendingRows.map((row) => {
                            const index = sortedRows.indexOf(row);
                            const dateLabel = row.session_date ? formatDateLong(row.session_date) : 'Date pending';
                            const timeLabel = row.start_time && row.end_time
                                ? `${formatTime12Hour(row.start_time)} - ${formatTime12Hour(row.end_time)}`
                                : (row.start_time ? formatTime12Hour(row.start_time) : 'Time pending');
                            return `
                                <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <div class="text-sm font-bold text-zinc-900 dark:text-white">Session ${escapeHtml(String(row.session_number || ''))} • ${escapeHtml(row.instrument_name || 'Instrument Session')}</div>
                                        <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">${escapeHtml(dateLabel)} • ${escapeHtml(timeLabel)}</div>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2">
                                        ${renderAttendanceStatusBadge(row.attendance_status && row.attendance_status !== 'Pending' ? row.attendance_status : (row.status || 'Scheduled'))}
                                        ${renderStudentGradeBadge(row.average_score, row.progress_id)}
                                        <button type="button" onclick="openStudentGradeDetails(${index})" class="inline-flex items-center px-3 py-2 rounded-2xl bg-zinc-900 dark:bg-white/10 hover:bg-zinc-800 dark:hover:bg-white/20 text-white text-xs font-bold transition">
                                            View Session
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </section>
            `
            : '';

        listEl.innerHTML = `
            <div class="space-y-5">
                ${gradedSection}
                ${pendingSection}
            </div>
        `;
    } catch (error) {
        console.error('Failed to initialize student grades page:', error);
        listEl.innerHTML = `
            <div class="rounded-3xl border border-dashed border-red-200 bg-red-50 px-6 py-12 text-center text-red-600">
                <div class="font-semibold">Unable to load grade data right now</div>
                <div class="text-sm mt-2">${escapeHtml(error?.message || 'Unexpected student grade page error.')}</div>
            </div>
        `;
    }
}

async function initStudentAttendancePage() {
    if (!checkStudentAuth()) return;
    const user = Auth.getUser();
    const portal = await fetchStudentPortalDataByEmail(user.email);
    if (await handleStudentRegistrationReset(portal, 'This registration was rejected or removed. Please register again.')) return;
    if (!portal.success) {
        showMessage(portal.error || 'Failed to load attendance.', 'error');
        return;
    }

    const s = portal.student || {};
    applyStudentPortalIdentity(user, portal);
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
    const sortedRows = [...rows].sort((a, b) => {
        const aTime = new Date(`${a?.session_date || ''}T${a?.start_time || '00:00:00'}`).getTime() || 0;
        const bTime = new Date(`${b?.session_date || ''}T${b?.start_time || '00:00:00'}`).getTime() || 0;
        return bTime - aTime;
    });
    if (sortedRows.length === 0) {
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

    setHtml('studentAttendanceTableBody', sortedRows.map(r => {
        const dateLabel = r.session_date ? formatDateLong(r.session_date) : (r.attended_at ? new Date(r.attended_at).toLocaleDateString() : '—');
        const start = r.start_time ? formatTime12Hour(r.start_time) : '';
        const end = r.end_time ? formatTime12Hour(r.end_time) : '';
        const timeLabel = start && end ? `${start} - ${end}` : (start || (r.attended_at ? new Date(r.attended_at).toLocaleTimeString() : '—'));
        const roomLabel = r.room_name || '—';
        const notes = escapeHtml(cleanSessionNoteText(r.notes, '—'));
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

    const portal = await fetchStudentPortalDataByEmail(user.email);
    if (await handleStudentRegistrationReset(portal, 'This registration was rejected or removed. Please register again.')) return;
    if (!portal.success) {
        showMessage(portal.error || 'Failed to load profile.', 'error');
        return;
    }

    const s = portal.student;
    applyStudentPortalIdentity(user, portal);
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
        if (totalEl) {
            totalEl.innerHTML = `
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <div class="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Registration Fee</div>
                        <div class="mt-1 font-bold text-zinc-900 dark:text-white">${formatCurrencyPHP(registrationFee)}</div>
                    </div>
                    <div>
                        <div class="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Enrollment Fee</div>
                        <div class="mt-1 font-bold text-zinc-900 dark:text-white">${formatCurrencyPHP(0)}</div>
                    </div>
                    <div>
                        <div class="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total Due</div>
                        <div class="mt-1 font-bold text-gold-700 dark:text-gold-300">${formatCurrencyPHP(registrationFee)}</div>
                    </div>
                </div>
            `;
        }
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
    if (totalEl) {
        totalEl.innerHTML = `
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <div class="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Registration Fee</div>
                    <div class="mt-1 font-bold text-zinc-900 dark:text-white">${formatCurrencyPHP(registrationFee)}</div>
                </div>
                <div>
                    <div class="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Enrollment Fee</div>
                    <div class="mt-1 font-bold text-zinc-900 dark:text-white">${formatCurrencyPHP(sessionFee)}</div>
                </div>
                <div>
                    <div class="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total Due</div>
                    <div class="mt-1 font-bold text-gold-700 dark:text-gold-300">${formatCurrencyPHP(total)}</div>
                </div>
            </div>
        `;
    }
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
    const guardianSection = document.getElementById('walkin_guardian_section');
    const guardianFields = document.querySelectorAll('.guardian-field');
    const guardianLabels = document.querySelectorAll('.guardian-label');
    const badge = document.getElementById('guardian_required_badge');

    if (!dobInput || !ageDisplay) return;

    const age = calculateAgeFromBirthdate(dobInput.value);
    const isMinor = age !== null && age < 18;

    if (age !== null) {
        ageDisplay.textContent = age + ' years old';
    } else {
        ageDisplay.textContent = '— Select date of birth —';
    }

    if (guardianSection) guardianSection.classList.toggle('hidden', !isMinor);
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

function getWalkinSelectedInstrumentIds() {
    return Array.from(document.querySelectorAll('#walkin_instrumentsContainer select[name="instruments[]"]'))
        .map(select => parseInt(select.value, 10))
        .filter(value => !Number.isNaN(value) && value > 0)
        .filter((value, index, source) => source.indexOf(value) === index);
}

function getWalkinEnrollmentPayload() {
    const packageSelect = document.getElementById('walkinSessionPackageId');
    const paymentTypeEl = document.getElementById('walkin_paymentType');
    const paymentProofEl = document.getElementById('walkinPackagePaymentProof');

    if (!packageSelect || !paymentTypeEl) {
        return null;
    }

    const packageId = parseInt(packageSelect.value, 10);
    const paymentType = String(paymentTypeEl.value || '').trim();
    const instrumentIds = getWalkinSelectedInstrumentIds();
    const selectedOption = packageSelect.options[packageSelect.selectedIndex];
    const maxInstruments = Number(selectedOption?.getAttribute('data-max-instruments') || 1);

    if (!packageId || !paymentType || instrumentIds.length < 1) {
        return { error: 'Please complete package, payment type, and instruments.' };
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

    const activeBranchId = Number(branchSelect?.value || 0);
    if (activeBranchId > 0) {
        loadWalkinPackages(activeBranchId);
        loadWalkinInstruments(activeBranchId);
    } else {
        loadWalkinPackages();
    }
    updateWalkinPackageDetails();
    calculateWalkinTotalFee();
}

function syncWalkinLoginModeUI() {
    const emailInput = document.getElementById('walkin_student_email');
    const emailLabel = document.getElementById('walkin_student_email_label');
    const emailHint = document.getElementById('walkin_student_email_hint');
    if (!emailInput) return;

    emailInput.type = 'text';
    emailInput.autocomplete = 'off';
    emailInput.placeholder = 'Example: juan or juan.dela.cruz';
    emailInput.required = true;

    if (emailLabel) {
        emailLabel.textContent = 'Login Name (Becomes @fas.com)';
    }

    if (emailHint) {
        emailHint.innerHTML = 'Enter a simple name or username. The system will turn it into a <code>@fas.com</code> login automatically.';
    }
}

// Initialize walk-in admin page (used on admin_registration.html)
function initWalkinPage() {
    const form = document.getElementById('walkinForm');
    if (!form) return;

    // Seed dropdowns
    loadWalkinBranches();
    syncWalkinLoginModeUI();

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

        // Prevent double submit (first request can succeed, second can duplicate the walk-in account)
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
            const response = await axios.post(`${baseApiUrl}/walkin_register.php?action=register`, data);

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
                const loginLabel = 'Login Email';
                const loginValue = result.login_email || result.username || data['student_email'] || '—';
                const isWalkInAccount = Boolean(result.walkin_login_generated);

                // Reset form and hide modal if present
                form.reset();
                syncWalkinLoginModeUI();
                const modal = document.getElementById('registerStudentModal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Student Registered',
                    html: `Student account was created successfully.<br><br>
                           <strong>${loginLabel}:</strong> ${escapeHtml(loginValue)}<br>
                           <strong>Student Temporary Password:</strong> fas@123<br>
                           ${guardianLabel}
                           ${isWalkInAccount
                        ? '<br>The student can log in immediately using the login email above.'
                        : '<br>Next step: confirm the walk-in registration payment method.'}`,
                    confirmButtonColor: '#b8860b'
                }).then(() => {
                    if (!isWalkInAccount) {
                        const redirectTemplate = String(form.dataset.paymentRedirectTemplate || '').trim();
                        const redirectUrl = redirectTemplate
                            ? redirectTemplate.replace('{student_id}', encodeURIComponent(String(result.student_id)))
                            : String(form.dataset.paymentRedirectUrl || '').trim();
                        openPaymentModal(result.student_id, { forceSource: 'walkin', redirectUrl });
                    }
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
                'Rejected': 'text-red-400 bg-red-400/10',
                'Walk-In': 'text-purple-400 bg-purple-400/10'
            };
            const displayStatus = getWalkInRegistrationDisplayStatus(s);
            const statusClass = statusColors[displayStatus] || 'text-zinc-400 bg-zinc-400/10';

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
                                ${displayStatus}
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

function showPortalToast(message, type = 'info', title = '') {
    if (typeof Swal !== 'undefined' && typeof Swal.mixin === 'function') {
        const toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3600,
            timerProgressBar: true,
            didOpen: (popup) => {
                popup.addEventListener('mouseenter', Swal.stopTimer);
                popup.addEventListener('mouseleave', Swal.resumeTimer);
            }
        });
        return toast.fire({
            icon: ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info',
            title: title || message,
            text: title ? message : ''
        });
    }

    alert(message);
    return Promise.resolve();
}

function getFreezeRestoreToastKey(context, enrollmentId) {
    return `fas_freeze_restored_${String(context || 'student')}_${Number(enrollmentId || 0)}`;
}

function readFreezeRestoreToastState(context, enrollmentId) {
    try {
        return localStorage.getItem(getFreezeRestoreToastKey(context, enrollmentId)) || '';
    } catch (e) {
        return '';
    }
}

function writeFreezeRestoreToastState(context, enrollmentId, state) {
    try {
        localStorage.setItem(getFreezeRestoreToastKey(context, enrollmentId), String(state || ''));
    } catch (e) {
        // Ignore storage issues.
    }
}

function getEnrollmentFreezePresenceState(enrollment) {
    const scheduleStatus = String(enrollment?.schedule_status || '').trim().toLowerCase();
    const paymentStatus = String(enrollment?.__freeze_payment_status || '').trim().toLowerCase();
    if (scheduleStatus === 'frozen' || paymentStatus === 'pending' || paymentStatus === 'rejected') {
        return 'frozen';
    }
    if (scheduleStatus === 'active') {
        return 'active';
    }
    return scheduleStatus || 'active';
}

function notifyFreezeRestored(enrollment, personName = 'Your account', context = 'student') {
    const enrollmentId = Number(enrollment?.enrollment_id || 0);
    if (enrollmentId < 1) return false;

    const currentState = getEnrollmentFreezePresenceState(enrollment);
    const previousState = readFreezeRestoreToastState(context, enrollmentId);
    const wasFrozenBefore = ['frozen', 'pending'].includes(previousState);
    const isNowActive = currentState === 'active';

    if (isNowActive && wasFrozenBefore) {
        showPortalToast(
            `${personName} can go back to sessions now. The frozen reservation has been cleared.`,
            'success',
            'Account Restored'
        );
    }

    writeFreezeRestoreToastState(context, enrollmentId, currentState);
    return isNowActive && wasFrozenBefore;
}

function notifyFreezeRestoredForStudentPortal(portal, student) {
    const enrollment = portal?.current_enrollment || null;
    const studentName = `${student?.first_name || ''} ${student?.last_name || ''}`.trim() || 'Your account';
    notifyFreezeRestored(enrollment, studentName, 'student');
}

function notifyFreezeRestoredForGuardianPortal(students) {
    (Array.isArray(students) ? students : []).forEach((item) => {
        const s = item?.student || {};
        const studentName = `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'A linked student';
        notifyFreezeRestored(item?.current_enrollment || null, studentName, 'guardian');
    });
}

function hasPendingFreezeRestoration(enrollment) {
    if (!enrollment) return false;
    const presenceState = getEnrollmentFreezePresenceState(enrollment);
    const paymentStatus = String(enrollment.__freeze_payment_status || '').trim().toLowerCase();
    const scheduleStatus = String(enrollment.schedule_status || '').trim().toLowerCase();
    if (paymentStatus === 'paid' || scheduleStatus === 'active') return false;
    return ['frozen', 'pending', 'rejected'].includes(presenceState)
        || ['pending', 'rejected'].includes(paymentStatus)
        || (scheduleStatus && scheduleStatus !== 'active' && Number(enrollment.enrollment_id || 0) > 0);
}

function stopStudentFreezeRefreshWatcher() {
    if (window.__studentFreezeRefreshTimer) {
        window.clearInterval(window.__studentFreezeRefreshTimer);
        window.__studentFreezeRefreshTimer = null;
    }
}

function startStudentFreezeRefreshWatcher() {
    stopStudentFreezeRefreshWatcher();
    const enrollment = studentDashboardPortalState?.current_enrollment || null;
    if (!hasPendingFreezeRestoration(enrollment)) return;
    window.__studentFreezeRefreshBusy = false;
    window.__studentFreezeRefreshTimer = window.setInterval(async () => {
        if (window.__studentFreezeRefreshBusy) return;
        window.__studentFreezeRefreshBusy = true;
        try {
            const restored = await refreshStudentFreezeStatusAndNotify();
            if (restored) {
                stopStudentFreezeRefreshWatcher();
                window.location.reload();
            }
        } finally {
            window.__studentFreezeRefreshBusy = false;
        }
    }, 15000);
}

function stopGuardianFreezeRefreshWatcher() {
    if (window.__guardianFreezeRefreshTimer) {
        window.clearInterval(window.__guardianFreezeRefreshTimer);
        window.__guardianFreezeRefreshTimer = null;
    }
}

function startGuardianFreezeRefreshWatcher() {
    stopGuardianFreezeRefreshWatcher();
    const needsPolling = (Array.isArray(guardianPortalStudents) ? guardianPortalStudents : [])
        .some((item) => hasPendingFreezeRestoration(item?.current_enrollment || null));
    if (!needsPolling) return;
    window.__guardianFreezeRefreshBusy = false;
    window.__guardianFreezeRefreshTimer = window.setInterval(async () => {
        if (window.__guardianFreezeRefreshBusy) return;
        window.__guardianFreezeRefreshBusy = true;
        try {
            const restored = await refreshGuardianFreezeStatusAndNotify();
            if (restored) {
                stopGuardianFreezeRefreshWatcher();
                window.location.reload();
            }
        } finally {
            window.__guardianFreezeRefreshBusy = false;
        }
    }, 15000);
}

async function refreshStudentFreezeStatusAndNotify() {
    const portal = studentDashboardPortalState;
    const enrollment = portal?.current_enrollment || null;
    if (!portal?.student || !enrollment?.enrollment_id) return false;

    try {
        const res = await axios.get(`${baseApiUrl}/students.php?action=get-student-freeze-payment-status&enrollment_id=${encodeURIComponent(enrollment.enrollment_id)}`);
        const data = res.data || {};
        if (!data.success || !data.payment) return false;

        const previousState = String(enrollment.__freeze_payment_status || '').trim();
        enrollment.__freeze_payment_status = data.payment.status || '';
        if (String(data.payment.status || '').toLowerCase() === 'paid') {
            enrollment.schedule_status = 'Active';
        }

        const restored = notifyFreezeRestoredForStudentPortal(portal, portal.student);
        if (restored && previousState !== 'Paid') {
            return true;
        }
    } catch (e) {
        // Non-critical polling failure.
    }

    return false;
}

async function refreshGuardianFreezeStatusAndNotify() {
    if (!Array.isArray(guardianPortalStudents) || guardianPortalStudents.length === 0) return false;
    let restoredAny = false;

    for (const item of guardianPortalStudents) {
        const enrollment = item?.current_enrollment || null;
        const student = item?.student || null;
        if (!enrollment?.enrollment_id) continue;

        try {
            const res = await axios.get(`${baseApiUrl}/students.php?action=get-student-freeze-payment-status&enrollment_id=${encodeURIComponent(enrollment.enrollment_id)}`);
            const data = res.data || {};
            if (!data.success || !data.payment) continue;

            const previousState = String(enrollment.__freeze_payment_status || '').trim();
            enrollment.__freeze_payment_status = data.payment.status || '';
            if (String(data.payment.status || '').toLowerCase() === 'paid') {
                enrollment.schedule_status = 'Active';
            }

            const before = readFreezeRestoreToastState('guardian', enrollment.enrollment_id);
            const restored = notifyFreezeRestored(enrollment, `${student?.first_name || ''} ${student?.last_name || ''}`.trim() || 'A linked student', 'guardian');
            if (restored && (previousState !== 'Paid' || before !== 'active')) {
                restoredAny = true;
            }
        } catch (e) {
            // Non-critical polling failure.
        }
    }

    return restoredAny;
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
    pageSize: 5
};

function sortNewestRegistrationsFirst(rows) {
    return (Array.isArray(rows) ? rows.slice() : []).sort((a, b) => {
        const timeA = new Date(a?.created_at || 0).getTime();
        const timeB = new Date(b?.created_at || 0).getTime();
        if (timeA !== timeB) return timeB - timeA;
        return Number(b?.student_id || 0) - Number(a?.student_id || 0);
    });
}

function getWalkInRegistrationDisplayStatus(registration) {
    const status = String(registration?.registration_status || 'Pending').trim() || 'Pending';
    return status;
}

function getWalkInRegistrationRemainingAmount(registration) {
    const source = String(registration?.registration_source || 'online').toLowerCase();
    const status = String(registration?.registration_status || 'Pending').trim() || 'Pending';
    if (source === 'walkin' && ['Approved', 'Fee Paid', 'Active'].includes(status)) {
        return 0;
    }
    const total = Number(registration?.registration_fee_amount || 0);
    const paid = Number(registration?.registration_fee_paid || 0);
    return Math.max(0, total - paid);
}

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
            registrationsTableState.pageSize = Number.isFinite(nextSize) && nextSize > 0 ? nextSize : 5;
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
            'Rejected': 'text-red-700 bg-red-100',
            'Walk-In': 'text-purple-700 bg-purple-100'
        };

        const displayStatus = getWalkInRegistrationDisplayStatus(reg);
        const statusClass = statusColors[displayStatus] || 'text-slate-700 bg-slate-100';
        const remaining = getWalkInRegistrationRemainingAmount(reg);
        const registrationSource = String(reg.registration_source || 'online').toLowerCase() === 'walkin' ? 'walkin' : 'online';
        const sourceBadgeClass = registrationSource === 'walkin'
            ? 'bg-purple-100 text-purple-700'
            : 'bg-sky-100 text-sky-700';
        const sourceLabel = registrationSource === 'walkin' ? 'Walk-In' : 'Online';
        const registrationProofLink = reg.registration_proof_path
            ? `<a href="${buildPublicFileUrl(reg.registration_proof_path)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800 underline mt-1"><i class="fas fa-file-alt"></i>Payment proof</a>`
            : (registrationSource === 'walkin'
                ? '<div class="text-xs text-slate-500 mt-1">Walk-in payment handled at the branch</div>'
                : '<div class="text-xs text-slate-500 mt-1">No proof uploaded</div>');
        const ageProofLink = reg.age_verification_proof_path
            ? `<a href="${buildPublicFileUrl(reg.age_verification_proof_path)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 underline mt-1"><i class="fas fa-id-card"></i>Proof ID</a>`
            : (registrationSource === 'walkin'
                ? '<div class="text-xs text-slate-500 mt-1">Proof ID not required for walk-in</div>'
                : '<div class="text-xs text-slate-500 mt-1">No proof ID uploaded</div>');

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
                    ${ageProofLink}
                </td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded text-xs font-semibold ${statusClass}">
                        ${displayStatus}
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
    registrationsTableState.rows = sortNewestRegistrationsFirst(registrations);
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
                            <p><span class="text-zinc-400">Status:</span> <span class="text-white">${getWalkInRegistrationDisplayStatus(student)}</span></p>
                            <p><span class="text-zinc-400">Fee Amount:</span> <span class="text-white">₱${parseFloat(student.registration_fee_amount || 0).toFixed(2)}</span></p>
                            <p><span class="text-zinc-400">Paid Amount:</span> <span class="text-white">₱${parseFloat(student.registration_fee_paid || 0).toFixed(2)}</span></p>
                            <p><span class="text-zinc-400">Remaining:</span> <span class="text-white">₱${getWalkInRegistrationRemainingAmount(student).toFixed(2)}</span></p>
                            <p><span class="text-zinc-400">Payment Proof:</span> <span class="text-white">${student.registration_proof_path ? `<a class="text-gold-300 underline" target="_blank" rel="noopener" href="${buildPublicFileUrl(student.registration_proof_path)}">View file</a>` : (String(student.registration_source || 'online').toLowerCase() === 'walkin' ? 'Not required for walk-in' : 'N/A')}</span></p>
                            <p><span class="text-zinc-400">Proof ID:</span> <span class="text-white">${student.age_verification_proof_path ? `<a class="text-gold-300 underline" target="_blank" rel="noopener" href="${buildPublicFileUrl(student.age_verification_proof_path)}">View file</a>` : (String(student.registration_source || 'online').toLowerCase() === 'walkin' ? 'Not required for walk-in' : 'N/A')}</span></p>
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
                                        <th class="px-4 py-2 text-left text-zinc-200">Reference</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${payments.map(p => `
                                        <tr class="border-t border-zinc-800">
                                            <td class="px-4 py-2 text-white">${new Date(p.payment_date).toLocaleDateString()}</td>
                                            <td class="px-4 py-2 text-white">₱${parseFloat(p.amount).toFixed(2)}</td>
                                            <td class="px-4 py-2 text-white">${p.payment_method}</td>
                                            <td class="px-4 py-2 text-white">${p.receipt_number || 'N/A'}</td>
                                            <td class="px-4 py-2 text-white">${p.reference_number || 'N/A'}</td>
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
            const remaining = getWalkInRegistrationRemainingAmount(student);
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
                    ? 'This is the lifetime ₱1,000.00 registration fee for the walk-in student.'
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
    const result = await Swal.fire({
        title: 'Reject Registration?',
        text: 'Are you sure you want to reject this registration?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Reject',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280'
    });
    if (!result.isConfirmed) return;

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

function initAdminSidebarMenu() {
    const pathname = String(window.location.pathname || '').replace(/\\/g, '/').toLowerCase();
    if (!pathname.includes('/pages/admin/')) return;

    const nav = document.querySelector('body > nav');
    const sidebar = document.querySelector('body > aside');
    if (!nav || !sidebar || sidebar.dataset.mobileMenuEnhanced === '1') return;

    sidebar.dataset.mobileMenuEnhanced = '1';

    const desktopMedia = window.matchMedia('(min-width: 1024px)');
    const sidebarId = sidebar.id || 'adminSidebar';
    sidebar.id = sidebarId;

    sidebar.classList.remove('hidden');
    sidebar.classList.add(
        'flex',
        'max-lg:-translate-x-full',
        'max-lg:transition-transform',
        'max-lg:duration-300',
        'max-lg:ease-out',
        'max-lg:z-[60]',
        'max-lg:w-[18.5rem]',
        'max-lg:shadow-2xl'
    );

    const overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.setAttribute('aria-label', 'Close admin menu');
    overlay.className = 'fixed inset-0 z-[55] bg-slate-950/60 opacity-0 pointer-events-none transition-opacity duration-300 lg:hidden';
    document.body.appendChild(overlay);

    const firstNavChild = Array.from(nav.children).find((child) => child.nodeType === 1) || null;
    let leftCluster = firstNavChild;

    if (!leftCluster || !leftCluster.classList.contains('flex')) {
        leftCluster = document.createElement('div');
        leftCluster.className = 'flex items-center gap-3 lg:gap-8';
        if (firstNavChild) {
            nav.insertBefore(leftCluster, firstNavChild);
            leftCluster.appendChild(firstNavChild);
        } else {
            nav.prepend(leftCluster);
        }
    } else {
        leftCluster.classList.add('gap-3', 'lg:gap-8');
    }

    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.setAttribute('aria-controls', sidebarId);
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open admin menu');
    menuButton.className = 'lg:hidden inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-gold-400/60';
    menuButton.innerHTML = '<i class="fas fa-bars text-base"></i><span class="sr-only">Open admin menu</span>';
    leftCluster.prepend(menuButton);

    const menuIcon = menuButton.querySelector('i');

    function setMenuState(isOpen) {
        const open = !desktopMedia.matches && Boolean(isOpen);
        sidebar.classList.toggle('max-lg:-translate-x-full', !open);
        sidebar.classList.toggle('max-lg:translate-x-0', open);
        overlay.classList.toggle('opacity-0', !open);
        overlay.classList.toggle('pointer-events-none', !open);
        overlay.classList.toggle('opacity-100', open);
        overlay.classList.toggle('pointer-events-auto', open);
        menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
        menuButton.setAttribute('aria-label', open ? 'Close admin menu' : 'Open admin menu');

        if (menuIcon) {
            menuIcon.classList.toggle('fa-bars', !open);
            menuIcon.classList.toggle('fa-xmark', open);
        }

        document.body.style.overflow = open ? 'hidden' : '';
    }

    function syncForViewport() {
        if (desktopMedia.matches) {
            setMenuState(false);
        }
    }

    menuButton.addEventListener('click', () => {
        const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
        setMenuState(!isOpen);
    });

    overlay.addEventListener('click', () => setMenuState(false));

    sidebar.addEventListener('click', (event) => {
        if (desktopMedia.matches) return;
        if (event.target.closest('a[href]')) {
            setMenuState(false);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setMenuState(false);
        }
    });

    if (typeof desktopMedia.addEventListener === 'function') {
        desktopMedia.addEventListener('change', syncForViewport);
    } else if (typeof desktopMedia.addListener === 'function') {
        desktopMedia.addListener(syncForViewport);
    }

    syncForViewport();
}

function initAdminResponsiveTables() {
    const pathname = String(window.location.pathname || '').replace(/\\/g, '/').toLowerCase();
    if (!pathname.includes('/pages/admin/')) return;

    if (!document.getElementById('adminResponsiveTableStyles')) {
        const style = document.createElement('style');
        style.id = 'adminResponsiveTableStyles';
        style.textContent = `
            .admin-table-scroll {
                scrollbar-width: thin;
                scrollbar-color: rgba(148, 163, 184, 0.9) rgba(226, 232, 240, 0.9);
                scrollbar-gutter: stable both-edges;
            }
            .admin-table-scroll::-webkit-scrollbar {
                height: 12px;
            }
            .admin-table-scroll::-webkit-scrollbar-track {
                background: rgba(226, 232, 240, 0.9);
                border-radius: 9999px;
            }
            .admin-table-scroll::-webkit-scrollbar-thumb {
                background: rgba(148, 163, 184, 0.95);
                border-radius: 9999px;
                border: 2px solid rgba(226, 232, 240, 0.9);
            }
            @media (min-width: 1024px) {
                .admin-table-scroll {
                    overflow-x: visible !important;
                    scrollbar-width: none;
                }
                .admin-table-scroll::-webkit-scrollbar {
                    height: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    const tableWrappers = document.querySelectorAll('.overflow-x-auto');
    if (!tableWrappers.length) return;

    tableWrappers.forEach((wrapper) => {
        const table = wrapper.querySelector('table');
        if (!table) return;

        wrapper.classList.remove('overflow-x-auto', 'overflow-visible');
        wrapper.classList.add('overflow-x-scroll', 'lg:overflow-visible', 'overscroll-x-contain', 'pb-2', 'admin-table-scroll');
        wrapper.style.webkitOverflowScrolling = 'touch';

        const hasDeclaredMinWidth = /(^|\s)min-w-/.test(table.className) || table.style.minWidth;
        if (!hasDeclaredMinWidth) {
            const headerCount = table.querySelectorAll('thead th').length || table.querySelectorAll('tr:first-child th, tr:first-child td').length || 1;
            const estimatedMinWidth = Math.max(720, headerCount * 140);
            table.style.minWidth = `${estimatedMinWidth}px`;
        }

        if (wrapper.dataset.mobileScrollHint === '1') return;
        wrapper.dataset.mobileScrollHint = '1';

        const hint = document.createElement('p');
        hint.className = 'px-4 pt-3 text-[11px] font-medium tracking-wide text-slate-400 sm:hidden';
        hint.textContent = 'Swipe left or right to view the full table.';
        wrapper.insertAdjacentElement('afterend', hint);
    });
}

function initAdminAutoPagination() {
    const pathname = String(window.location.pathname || '').replace(/\\/g, '/').toLowerCase();
    if (!pathname.includes('/pages/admin/')) return;

    const builtInPaginatedBodies = new Set([
        'registrationsTable',
        'adminUsersTable',
        'enrollmentPaymentsTable',
        'registrationPaymentsTable'
    ]);
    const paginatedState = new WeakMap();

    function getDataRows(tbody) {
        return Array.from(tbody.querySelectorAll(':scope > tr')).filter((row) => {
            const cells = row.children;
            if (!cells.length) return false;
            if (cells.length === 1 && cells[0].hasAttribute('colspan')) return false;
            return true;
        });
    }

    function ensureControls(wrapper) {
        if (!wrapper.dataset.autoPaginationKey) {
            wrapper.dataset.autoPaginationKey = `admin-pagination-${Math.random().toString(36).slice(2, 10)}`;
        }

        let controls = wrapper.parentElement?.querySelector(`:scope > [data-admin-auto-pagination-for="${wrapper.dataset.autoPaginationKey}"]`);
        if (controls) return controls;

        controls = document.createElement('div');
        controls.dataset.adminAutoPagination = '1';
        controls.dataset.adminAutoPaginationFor = wrapper.dataset.autoPaginationKey;
        controls.className = 'flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-slate-200 bg-slate-50/60';
        wrapper.insertAdjacentElement('afterend', controls);
        return controls;
    }

    function renderAutoPage(tbody) {
        if (!tbody || builtInPaginatedBodies.has(tbody.id || '')) return;

        const table = tbody.closest('table');
        const wrapper = table?.closest('.overflow-x-scroll, .overflow-x-auto');
        if (!table || !wrapper) return;

        const rows = getDataRows(tbody);
        const pageSize = 5;
        let state = paginatedState.get(tbody);
        if (!state) {
            state = { page: 1 };
            paginatedState.set(tbody, state);
        }

        const controls = ensureControls(wrapper);
        const totalRows = rows.length;
        const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
        state.page = Math.min(Math.max(1, state.page), totalPages);

        if (totalRows <= pageSize) {
            rows.forEach((row) => { row.style.display = ''; });
            controls.innerHTML = '';
            controls.classList.add('hidden');
            return;
        }

        controls.classList.remove('hidden');

        const start = (state.page - 1) * pageSize;
        const end = start + pageSize;

        rows.forEach((row, index) => {
            row.style.display = index >= start && index < end ? '' : 'none';
        });

        controls.innerHTML = `
            <div class="text-xs font-semibold text-slate-500">
                Showing ${start + 1}-${Math.min(end, totalRows)} of ${totalRows}
            </div>
            <div class="flex items-center gap-2">
                <button type="button" data-admin-auto-page="prev" class="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed" ${state.page <= 1 ? 'disabled' : ''}>
                    Prev
                </button>
                <div class="px-2 text-xs font-semibold text-slate-600">
                    Page ${state.page} of ${totalPages}
                </div>
                <button type="button" data-admin-auto-page="next" class="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed" ${state.page >= totalPages ? 'disabled' : ''}>
                    Next
                </button>
            </div>
        `;

        controls.querySelector('[data-admin-auto-page="prev"]')?.addEventListener('click', () => {
            state.page = Math.max(1, state.page - 1);
            renderAutoPage(tbody);
        });
        controls.querySelector('[data-admin-auto-page="next"]')?.addEventListener('click', () => {
            state.page = Math.min(totalPages, state.page + 1);
            renderAutoPage(tbody);
        });
    }

    document.querySelectorAll('table tbody[id]').forEach((tbody) => {
        if (builtInPaginatedBodies.has(tbody.id || '')) return;

        const observer = new MutationObserver(() => {
            const state = paginatedState.get(tbody);
            if (state && state.page > 1 && getDataRows(tbody).length <= (state.page - 1) * 5) {
                state.page = 1;
            }
            renderAutoPage(tbody);
        });

        observer.observe(tbody, { childList: true });
        renderAutoPage(tbody);
    });
}

function enforceAdminFixedPageSizes() {
    const pathname = String(window.location.pathname || '').replace(/\\/g, '/').toLowerCase();
    if (!pathname.includes('/pages/admin/')) return;

    ['registrationsPageSize', 'adminUsersPageSize'].forEach((id) => {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = '<option value="5" selected>5</option>';
        select.value = '5';
        select.disabled = true;
        select.classList.add('cursor-not-allowed', 'bg-slate-100', 'text-slate-500');
    });
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
    const studentGrades = document.getElementById('studentGradesRoot');
    const studentAttendance = document.getElementById('studentAttendanceRoot');
    const studentQr = document.getElementById('studentQrRoot');
    const guardianStudentsRoot = document.getElementById('guardianStudentsRoot');
    const guardianPaymentsRoot = document.getElementById('guardianPaymentsRoot');
    const guardianProfileRoot = document.getElementById('guardianProfileRoot');
    const guardianAbsenceRoot = document.getElementById('guardianAbsenceRoot');

    initAdminSidebarMenu();
    initAdminResponsiveTables();
    initAdminAutoPagination();
    enforceAdminFixedPageSizes();

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
    } else if (studentGrades) {
        initStudentGradesPage();
    } else if (studentAttendance) {
        initStudentAttendancePage();
    } else if (studentQr) {
        initStudentQrPage();
    } else if (document.getElementById('guardianDashboardRoot')) {
        initGuardianDashboardPage();
    } else if (guardianStudentsRoot) {
        initGuardianStudentsPage();
    } else if (guardianPaymentsRoot) {
        initGuardianPaymentsPage();
    } else if (guardianProfileRoot) {
        initGuardianProfilePage();
    } else if (guardianAbsenceRoot) {
        initGuardianAbsencePage();
    }
});
