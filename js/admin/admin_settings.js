(() => {
    const form = document.getElementById('systemPaymentSettingsForm');
    if (!form) return;

    const get = id => document.getElementById(id);
    const list = get('paymentMethodList');
    const modal = get('paymentMethodModal');
    let methods = [];
    let editingId = null;
    let gcashQrPath = '';
    const message = (text, success = false) => {
        const el = get('systemSettingsMessage');
        if (!el) return;
        el.textContent = text;
        el.className = `text-sm font-semibold ${success ? 'text-emerald-700' : 'text-rose-700'}`;
        el.classList.remove('hidden');
    };
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const openModal = () => { modal?.classList.remove('hidden'); modal?.classList.add('flex'); get('paymentMethodName')?.focus(); };
    const closeModal = () => { modal?.classList.add('hidden'); modal?.classList.remove('flex'); };

    function renderList() {
        if (!list) return;
        list.innerHTML = methods.map(method => `
            <button type="button" class="payment-method-row flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-amber-50/60 sm:px-7" data-method-id="${escapeHtml(method.id)}">
                <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${method.id === 'gcash' ? 'bg-blue-50 text-blue-600' : method.id === 'bank_transfer' ? 'bg-violet-50 text-violet-600' : 'bg-amber-50 text-amber-700'}"><i class="fas ${method.id === 'gcash' ? 'fa-mobile-alt' : method.id === 'bank_transfer' ? 'fa-building-columns' : 'fa-wallet'}"></i></span>
                <span class="min-w-0 flex-1"><span class="block truncate font-extrabold text-slate-900">${escapeHtml(method.name)}</span><span class="mt-0.5 block truncate text-xs text-slate-500">${escapeHtml(method.account_number || method.details || 'Tap to add recipient details')}</span></span>
                <span class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${method.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${method.enabled ? 'Available' : 'Off'}</span>
                <i class="fas fa-chevron-right text-xs text-slate-400"></i>
            </button>`).join('');
        list.querySelectorAll('.payment-method-row').forEach(row => row.addEventListener('click', () => editMethod(row.dataset.methodId)));
    }

    function editMethod(id) {
        const method = methods.find(item => item.id === id);
        if (!method) return;
        editingId = id;
        get('paymentMethodModalTitle').textContent = `Edit ${method.name}`;
        get('paymentMethodName').value = method.name;
        get('paymentMethodName').disabled = id === 'gcash' || id === 'bank_transfer';
        get('paymentNameField').classList.toggle('hidden', id === 'gcash' || id === 'bank_transfer');
        get('paymentAccountName').value = method.account_name || '';
        get('paymentAccountNumber').value = method.account_number || '';
        get('paymentDetails').value = method.details || '';
        get('paymentMethodEnabled').checked = method.enabled !== false;
        get('paymentAccountNumberLabel').textContent = id === 'gcash' ? 'GCash number' : id === 'bank_transfer' ? 'Account number' : 'Account number / phone';
        get('paymentDetailsLabel').textContent = id === 'bank_transfer' ? 'Bank name' : 'Extra payment details';
        get('paymentDetailsField').classList.toggle('hidden', id === 'gcash');
        get('gcashQrField').classList.toggle('hidden', id !== 'gcash');
        openModal();
    }

    function newMethod() {
        editingId = null;
        get('paymentMethodModalTitle').textContent = 'Add payment method';
        get('paymentMethodName').disabled = false;
        get('paymentNameField').classList.remove('hidden');
        get('paymentMethodName').value = '';
        get('paymentAccountName').value = '';
        get('paymentAccountNumber').value = '';
        get('paymentDetails').value = '';
        get('paymentMethodEnabled').checked = true;
        get('paymentAccountNumberLabel').textContent = 'Account number / phone';
        get('paymentDetailsLabel').textContent = 'Extra payment details';
        get('paymentDetailsField').classList.remove('hidden');
        get('gcashQrField').classList.add('hidden');
        openModal();
    }

    get('addPaymentMethod')?.addEventListener('click', newMethod);
    get('closePaymentMethodModal')?.addEventListener('click', closeModal);
    get('cancelPaymentMethod')?.addEventListener('click', closeModal);
    modal?.addEventListener('click', event => { if (event.target === modal) closeModal(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
    get('savePaymentMethod')?.addEventListener('click', () => {
        const name = get('paymentMethodName').value.trim();
        if (!editingId && !name) { get('paymentMethodName').focus(); return; }
        if (!editingId && ['gcash', 'bank transfer'].includes(name.toLowerCase())) {
            message('GCash and Bank Transfer already have dedicated payment rows.');
            get('paymentMethodName').focus();
            return;
        }
        if (editingId === 'gcash' && get('paymentAccountNumber').value.trim() && !/^[0-9+() -]{7,24}$/.test(get('paymentAccountNumber').value.trim())) {
            get('paymentAccountNumber').focus(); message('Enter a valid GCash number.'); return;
        }
        let method = methods.find(item => item.id === editingId);
        if (!method) {
            const baseId = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'payment';
            let id = baseId; let suffix = 2;
            while (methods.some(item => item.id === id)) id = `${baseId}_${suffix++}`;
            method = { id, name, enabled: true, account_name: '', account_number: '', details: '' };
            methods.push(method);
        }
        method.name = (editingId === 'gcash' || editingId === 'bank_transfer') ? method.name : name;
        method.account_name = get('paymentAccountName').value.trim();
        method.account_number = get('paymentAccountNumber').value.trim();
        method.details = get('paymentDetails').value.trim();
        method.enabled = get('paymentMethodEnabled').checked;
        renderList();
        closeModal();
        message('Payment details updated. Select Save payment settings to publish the changes.', true);
    });

    get('settingsGcashQr')?.addEventListener('change', event => {
        const file = event.target.files?.[0];
        if (!file) return;
        get('settingsGcashQrPreview').src = URL.createObjectURL(file);
        get('settingsGcashQrOpen').classList.remove('hidden');
    });
    get('settingsGcashQrOpen')?.addEventListener('click', () => {
        const modalQr = get('settingsQrModal');
        const preview = get('settingsGcashQrPreview');
        if (!preview?.src) return;
        get('settingsQrLarge').src = preview.src;
        modalQr.classList.remove('hidden'); modalQr.classList.add('flex');
    });
    const closeQr = () => { get('settingsQrModal')?.classList.add('hidden'); get('settingsQrModal')?.classList.remove('flex'); };
    get('settingsQrClose')?.addEventListener('click', closeQr);
    get('settingsQrModal')?.addEventListener('click', event => { if (event.target === event.currentTarget) closeQr(); });

    async function loadSettings() {
        try {
            const response = await axios.get(`${baseApiUrl}/payment_destination.php`);
            const recipient = response.data?.recipient || {};
            methods = Array.isArray(recipient.payment_methods) ? recipient.payment_methods : [];
            gcashQrPath = recipient.gcash_qr_path || '';
            if (recipient.gcash_qr_path) {
                get('settingsGcashQrPreview').src = buildPublicFileUrl(recipient.gcash_qr_path);
                get('settingsGcashQrOpen').classList.remove('hidden');
            }
            renderList();
        } catch (error) {
            message(error?.response?.data?.error || 'Could not load the current payment settings.');
        }
    }

    form.addEventListener('submit', async event => {
        event.preventDefault();
        const button = get('saveSystemPaymentSettings');
        const formData = new FormData();
        formData.set('methods_json', JSON.stringify(methods));
        if (get('settingsGcashQr').files?.[0]) formData.set('gcash_qr', get('settingsGcashQr').files[0]);
        if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>Saving…'; }
        try {
            const response = await axios.post(`${baseApiUrl}/payment_destination.php`, formData);
            if (typeof paymentDestinationRequest !== 'undefined') paymentDestinationRequest = null;
            message(response.data?.message || 'Payment settings saved.', true);
            get('settingsGcashQr').value = '';
            await loadSettings();
        } catch (error) {
            message(error?.response?.data?.error || 'Unable to save payment settings.');
        } finally {
            if (button) { button.disabled = false; button.innerHTML = '<i class="fas fa-save"></i>Save payment settings'; }
        }
    });

    if (typeof checkAuth === 'function') checkAuth();
    const user = typeof Auth !== 'undefined' && Auth.getUser ? Auth.getUser() : null;
    const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || user?.email || 'Administrator';
    if (get('userNameNav')) get('userNameNav').textContent = displayName;
    if (get('profileMenuName')) get('profileMenuName').textContent = displayName;
    void loadSettings();
})();
