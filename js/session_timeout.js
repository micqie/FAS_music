/**
 * session_timeout.js
 * ─────────────────────────────────────────────────────────────────
 * Auto-logout after 30 minutes of inactivity on any authenticated page.
 * Shows a 60-second countdown warning before forced logout.
 *
 * Usage: include AFTER index.js on every portal page.
 *   <script src="../../js/session_timeout.js"></script>
 *
 * Override defaults (optional, set before this script loads):
 *   window.SESSION_TIMEOUT_MINUTES = 30;   // idle minutes before logout
 *   window.SESSION_WARN_SECONDS    = 60;   // warning countdown in seconds
 * ─────────────────────────────────────────────────────────────────
 */
(function () {
    'use strict';

    /* ── Configuration ─────────────────────────────────────────── */
    const IDLE_MS = (window.SESSION_TIMEOUT_MINUTES || 30) * 60 * 1000;
    const WARN_MS = (window.SESSION_WARN_SECONDS    || 60) * 1000;

    /* ── Guard: skip on the public login/landing page ──────────── */
    function isPortalPage() {
        const path = window.location.pathname.toLowerCase();
        // The root index.html is the public login/home page — skip it
        if (/\/(fas_music\/?)?(index\.html)?$/.test(path)) return false;
        // Must have an active Auth session
        return typeof Auth !== 'undefined'
            && typeof Auth.getUser === 'function'
            && Auth.getUser() !== null;
    }

    if (!isPortalPage()) return;

    /* ── Redirect helper ───────────────────────────────────────── */
    function getAppBase() {
        if (typeof appBaseUrl === 'string' && appBaseUrl) return appBaseUrl;
        if (typeof baseApiUrl === 'string' && baseApiUrl.endsWith('/api'))
            return baseApiUrl.slice(0, -4);
        return window.location.origin + '/FAS_music';
    }

    function forceLogout(reason) {
        _clearAll();
        // Log to audit if possible
        try {
            if (typeof axios !== 'undefined' && typeof baseApiUrl !== 'undefined') {
                const user = Auth.getUser() || {};
                axios.post(`${baseApiUrl}/audit_logs.php?action=log`, {
                    action_name: 'Session Timeout',
                    module:      'General',
                    description: reason || 'User session expired due to inactivity.',
                    severity:    'info',
                    user_id:     user.user_id  || null,
                    user_name:   user.email    || user.username || null,
                    user_role:   user.role_name || null
                }).catch(() => {/* silent */});
            }
        } catch (_) {/* silent */}

        // Small delay so the audit POST can fire before redirect
        setTimeout(() => {
            if (typeof Auth !== 'undefined' && Auth.logout) {
                Auth.logout();
            } else {
                window.location.href = `${getAppBase()}/index.html`;
            }
        }, 200);
    }

    /* ── State ─────────────────────────────────────────────────── */
    let _warnTimer     = null;
    let _logoutTimer   = null;
    let _countdownTick = null;
    let _warningOpen   = false;

    function _clearAll() {
        clearTimeout(_warnTimer);
        clearTimeout(_logoutTimer);
        clearInterval(_countdownTick);
        _warningOpen = false;
    }

    /* ── Warning dialog (SweetAlert2 or plain confirm) ─────────── */
    function _showWarning() {
        if (_warningOpen) return;
        _warningOpen = true;

        let seconds = Math.round(WARN_MS / 1000);

        if (typeof Swal !== 'undefined') {
            /* ── SweetAlert2 version ── */
            Swal.fire({
                title: '⏰ Session Expiring Soon',
                html: `
                    <p style="font-size:15px;color:#475569;margin:0 0 12px;">
                        You've been inactive for a while.<br>
                        Your session will automatically end in:
                    </p>
                    <p id="_sto_countdown"
                       style="font-size:48px;font-weight:900;color:#b8860b;
                              letter-spacing:-1px;margin:0 0 10px;line-height:1;">
                        ${seconds}
                    </p>
                    <p style="font-size:13px;color:#94a3b8;margin:0;">
                        Click <strong>Stay Logged In</strong> to continue.
                    </p>`,
                icon: 'warning',
                confirmButtonText:  '<i class="fas fa-check" style="margin-right:6px"></i>Stay Logged In',
                confirmButtonColor: '#b8860b',
                showCancelButton:   true,
                cancelButtonText:   'Log Out Now',
                cancelButtonColor:  '#6b7280',
                allowOutsideClick:  false,
                allowEscapeKey:     false,
                timer:              WARN_MS,
                timerProgressBar:   true,
                didOpen: () => {
                    _countdownTick = setInterval(() => {
                        seconds = Math.max(0, seconds - 1);
                        const el = document.getElementById('_sto_countdown');
                        if (el) el.textContent = String(seconds);
                    }, 1000);
                },
                willClose: () => {
                    clearInterval(_countdownTick);
                }
            }).then(result => {
                _warningOpen = false;
                if (result.isConfirmed) {
                    _resetTimer(); // user clicked Stay
                } else {
                    forceLogout('User was warned of session expiry and did not respond or chose to log out.');
                }
            });

        } else {
            /* ── Plain browser confirm fallback ── */
            _countdownTick = setInterval(() => {
                seconds = Math.max(0, seconds - 1);
                if (seconds <= 0) {
                    clearInterval(_countdownTick);
                    _warningOpen = false;
                    forceLogout('Session expired — countdown reached zero.');
                }
            }, 1000);

            const stay = window.confirm(
                `Your session will expire in ${seconds} seconds due to inactivity.\n\nClick OK to stay logged in, or Cancel to log out now.`
            );
            clearInterval(_countdownTick);
            _warningOpen = false;

            if (stay) {
                _resetTimer();
            } else {
                forceLogout('User chose to log out from the session timeout prompt.');
            }
        }
    }

    /* ── Timer reset ───────────────────────────────────────────── */
    function _resetTimer() {
        if (_warningOpen) return; // don't reset while warning is visible
        _clearAll();

        // Show warning at (IDLE_MS - WARN_MS) of idle time
        _warnTimer   = setTimeout(_showWarning,                    IDLE_MS - WARN_MS);
        // Force logout at full IDLE_MS (backup in case SweetAlert timer fails)
        _logoutTimer = setTimeout(() => forceLogout('Session timed out after inactivity.'), IDLE_MS);
    }

    /* ── Activity event listeners ──────────────────────────────── */
    const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'wheel'];

    function _onActivity() {
        if (!_warningOpen) _resetTimer();
    }

    EVENTS.forEach(e => window.addEventListener(e, _onActivity, { passive: true, capture: true }));

    /* ── Cross-tab sync via localStorage ───────────────────────── */
    // If the user logs out or times out in another tab, mirror it here
    window.addEventListener('storage', e => {
        if (e.key === 'fas_session_logout' && e.newValue === '1') {
            _clearAll();
            window.location.href = `${getAppBase()}/index.html`;
        }
    });

    // Broadcast logout to other tabs when this tab logs out
    const _origLogout = typeof Auth !== 'undefined' ? Auth.logout : null;
    if (_origLogout) {
        Auth.logout = function () {
            try { localStorage.setItem('fas_session_logout', '1'); } catch (_) {}
            try { localStorage.removeItem('fas_session_logout'); }   catch (_) {}
            _origLogout.call(Auth);
        };
    }

    /* ── Boot ──────────────────────────────────────────────────── */
    _resetTimer();

    // Expose reset function globally so other scripts can extend inactivity
    // (e.g. when an API call succeeds, call resetSessionTimeout())
    window.resetSessionTimeout = _resetTimer;

})();
