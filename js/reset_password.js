(() => {
    const form = document.getElementById('resetPasswordForm');
    const message = document.getElementById('resetPasswordMessage');
    const submit = document.getElementById('resetPasswordSubmit');
    document.querySelectorAll('.password-visibility-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const input = document.getElementById(toggle.dataset.passwordTarget || '');
            if (!input) return;

            const isVisible = input.type === 'text';
            input.type = isVisible ? 'password' : 'text';
            toggle.setAttribute('aria-pressed', String(!isVisible));
            toggle.setAttribute('aria-label', `${isVisible ? 'Show' : 'Hide'} ${input.id === 'resetPassword' ? 'new password' : 'confirmation password'}`);
            const icon = toggle.querySelector('i');
            icon?.classList.toggle('fa-eye', isVisible);
            icon?.classList.toggle('fa-eye-slash', !isVisible);
        });
    });
    const token = new URLSearchParams(window.location.search).get('token') || '';
    const appBasePath = window.location.pathname.replace(/\/reset_password\.html$/i, '').replace(/\/$/, '');
    const defaultApiUrl = `${window.location.origin}${appBasePath}/api`;
    let apiUrl = defaultApiUrl;

    try {
        const storedApiUrl = sessionStorage.getItem('baseAPIUrl') || '';
        if (storedApiUrl) {
            const resolved = new URL(storedApiUrl, window.location.origin);
            if (resolved.origin === window.location.origin) apiUrl = resolved.href.replace(/\/$/, '');
        }
    } catch (error) {
        apiUrl = defaultApiUrl;
    }

    function showMessage(text, type = 'error') {
        if (!message) return;
        message.className = `mb-4 rounded-xl border px-4 py-3 text-sm ${type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`;
        message.textContent = text;
    }

    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
        showMessage('This password-reset link is invalid or missing. Return to sign in and request a new link.');
        if (form) form.classList.add('hidden');
    }

    form?.addEventListener('submit', async event => {
        event.preventDefault();
        const password = document.getElementById('resetPassword')?.value || '';
        const confirmPassword = document.getElementById('resetPasswordConfirm')?.value || '';
        if (password !== confirmPassword) {
            showMessage('The passwords do not match.');
            return;
        }
        if (submit) {
            submit.disabled = true;
            submit.textContent = 'Resetting password…';
        }
        try {
            const response = await axios.post(`${apiUrl}/users.php?action=reset-password`, {
                token,
                password,
                confirm_password: confirmPassword
            }, { validateStatus: () => true });
            if (!response.data?.success) {
                showMessage(response.data?.error || 'Unable to reset the password. Request a new link and try again.');
                return;
            }
            showMessage(response.data.message || 'Your password has been reset. You can now sign in.', 'success');
            form?.classList.add('hidden');
        } catch (error) {
            showMessage('Could not contact the server. Please try again.');
        } finally {
            if (submit) {
                submit.disabled = false;
                submit.textContent = 'Reset Password';
            }
        }
    });
})();
