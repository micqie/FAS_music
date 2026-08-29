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
    const DEFAULT_IDLE_MINUTES = 30;
    const DEFAULT_WARN_SECONDS = 60;
    const configuredIdleMinutes = Number(window.SESSION_TIMEOUT_MINUTES || DEFAULT_IDLE_MINUTES);
    const configuredWarnSeconds = Number(window.SESSION_WARN_SECONDS || DEFAULT_WARN_SECONDS);
    const IDLE_MS = (Number.isFinite(configuredIdleMinutes) && configuredIdleMinutes > 0 ? configuredIdleMinutes : DEFAULT_IDLE_MINUTES) * 60 * 1000;
    const WARN_MS = (Number.isFinite(configuredWarnSeconds) && configuredWarnSeconds > 0 ? configuredWarnSeconds : DEFAULT_WARN_SECONDS) * 1000;

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
                title: 'Your session is about to expire',
                html: `
                    <div style="text-align:left;">
                        <div style="display:flex;align-items:flex-start;gap:12px;padding:14px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;">
                            <div style="display:grid;flex:0 0 34px;width:34px;height:34px;place-items:center;border-radius:8px;background:#fef3c7;color:#92400e;font-size:15px;">
                                <i class="fas fa-clock"></i>
                            </div>
                            <div style="min-width:0;">
                                <p style="font-size:14px;line-height:1.5;color:#475569;margin:0;">You have been inactive. For your security, you will be signed out automatically.</p>
                                <div style="margin-top:10px;font-size:13px;color:#64748b;">
                                    Time remaining: <strong id="_sto_countdown" style="color:#0f172a;font-variant-numeric:tabular-nums;">${seconds}</strong> seconds
                                </div>
                            </div>
                        </div>
                    </div>`,
                confirmButtonText:  'Continue session',
                confirmButtonColor: '#1d4ed8',
                showCancelButton:   true,
                cancelButtonText:   'Sign out',
                cancelButtonColor:  '#ffffff',
                allowOutsideClick:  false,
                allowEscapeKey:     false,
                width:              '430px',
                padding:            '1.5rem',
                reverseButtons:     true,
                buttonsStyling:     true,
                customClass: {
                    popup: 'session-timeout-popup',
                    title: 'session-timeout-title',
                    confirmButton: 'session-timeout-confirm',
                    cancelButton: 'session-timeout-cancel'
                },
                timer:              WARN_MS,
                timerProgressBar:   true,
                didOpen: () => {
                    const popup = Swal.getPopup();
                    const title = popup?.querySelector('.swal2-title');
                    const actions = popup?.querySelector('.swal2-actions');
                    const confirmButton = Swal.getConfirmButton();
                    const cancelButton = Swal.getCancelButton();
                    if (popup) popup.style.borderRadius = '14px';
                    if (title) {
                        title.style.padding = '0';
                        title.style.fontSize = '20px';
                        title.style.lineHeight = '1.3';
                        title.style.textAlign = 'left';
                        title.style.color = '#0f172a';
                    }
                    if (actions) {
                        actions.style.width = '100%';
                        actions.style.justifyContent = 'flex-end';
                        actions.style.marginTop = '18px';
                    }
                    [confirmButton, cancelButton].forEach(button => {
                        if (!button) return;
                        button.style.margin = '0 0 0 8px';
                        button.style.padding = '10px 16px';
                        button.style.borderRadius = '8px';
                        button.style.fontSize = '14px';
                        button.style.fontWeight = '600';
                        button.style.boxShadow = 'none';
                    });
                    if (cancelButton) {
                        cancelButton.style.background = '#ffffff';
                        cancelButton.style.color = '#475569';
                        cancelButton.style.border = '1px solid #cbd5e1';
                    }
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

    /* ── Cross-tab sync ────────────────────────────────────────── */
    // Auth._initChannel() in index.js already sets up BroadcastChannel and
    // the localStorage 'storage' event listener that redirect all tabs on
    // logout.  session_timeout.js only needs to stop its own timers when
    // another tab has already handled the redirect.
    //
    // We patch Auth.logout once so the inactivity timer is also cleared
    // before Auth.logout performs the server call and redirect.
    const _origLogout = typeof Auth !== 'undefined' ? Auth.logout : null;
    if (_origLogout && !Auth.__sessionTimeoutPatched) {
        Auth.__sessionTimeoutPatched = true;
        Auth.logout = function () {
            _clearAll();
            _origLogout.call(Auth);
        };
    }

    /* ── Boot ──────────────────────────────────────────────────── */
    _resetTimer();

    // Expose reset function globally so other scripts can extend inactivity
    // (e.g. when an API call succeeds, call resetSessionTimeout())
    window.resetSessionTimeout = _resetTimer;

})();
