(function (global) {
    'use strict';

    function esc(v) {
        if (v == null) return '';
        const d = document.createElement('div');
        d.textContent = String(v);
        return d.innerHTML;
    }

    function renderSpecializationChips(container, specializations, selectedIds) {
        if (!container) return;
        const wanted = new Set((Array.isArray(selectedIds) ? selectedIds : []).map(v => Number(v)).filter(v => v > 0));
        const activeSpecs = (Array.isArray(specializations) ? specializations : [])
            .filter(s => String(s.status || 'Active') === 'Active');

        if (!activeSpecs.length) {
            container.innerHTML = '<p class="text-sm text-slate-500">No specializations available. Add them under Teachers → Specializations.</p>';
            return;
        }

        container.innerHTML = activeSpecs.map(spec => {
            const id = Number(spec.specialization_id || 0);
            const selected = wanted.has(id);
            return `
                <button type="button"
                    class="teacher-spec-chip inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${selected ? 'border-gold-500 bg-gold-50 text-gold-800 shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-gold-300 hover:bg-gold-50/40'}"
                    data-spec-id="${id}"
                    aria-pressed="${selected ? 'true' : 'false'}">
                    <i class="fas fa-music text-xs ${selected ? 'text-gold-600' : 'text-slate-400'}"></i>
                    <span>${esc(spec.specialization_name || 'Specialization')}</span>
                    ${selected ? '<i class="fas fa-check text-xs text-gold-600"></i>' : ''}
                </button>
            `;
        }).join('');

        container.querySelectorAll('.teacher-spec-chip').forEach(button => {
            button.addEventListener('click', () => {
                const id = Number(button.dataset.specId || 0);
                if (id < 1) return;
                if (wanted.has(id)) {
                    wanted.delete(id);
                } else {
                    wanted.add(id);
                }
                renderSpecializationChips(container, specializations, Array.from(wanted));
                updateSpecializationSummary();
            });
        });

        updateSpecializationSummary();
    }

    function getSelectedSpecializationIdsFromChips(container) {
        if (!container) return [];
        return Array.from(container.querySelectorAll('.teacher-spec-chip[aria-pressed="true"]'))
            .map(btn => Number(btn.dataset.specId || 0))
            .filter(v => v > 0);
    }

    function updateSpecializationSummary() {
        const summary = document.getElementById('specializationSelectionSummary');
        const container = document.getElementById('specializationChipGrid');
        if (!summary || !container) return;
        const count = getSelectedSpecializationIdsFromChips(container).length;
        summary.textContent = count
            ? `${count} specialization${count === 1 ? '' : 's'} selected`
            : 'Tap one or more instruments this teacher can teach';
        summary.classList.toggle('text-gold-700', count > 0);
        summary.classList.toggle('text-slate-500', count < 1);
    }

    function setAccountMode(mode, isEdit) {
        const normalized = mode === 'real_email' ? 'real_email' : 'system_account';
        const realPanel = document.getElementById('accountModeRealPanel');
        const systemPanel = document.getElementById('accountModeSystemPanel');
        const accountSection = document.getElementById('teacherAccountSection');
        const realRadio = document.getElementById('accountModeReal');
        const systemRadio = document.getElementById('accountModeSystem');

        if (accountSection) {
            accountSection.classList.toggle('hidden', !!isEdit);
        }
        if (realRadio) realRadio.checked = normalized === 'real_email';
        if (systemRadio) systemRadio.checked = normalized === 'system_account';
        if (realPanel) realPanel.classList.toggle('hidden', normalized !== 'real_email');
        if (systemPanel) systemPanel.classList.toggle('hidden', normalized !== 'system_account');

        const emailInput = document.getElementById('email');
        const systemLoginInput = document.getElementById('systemLoginName');
        if (emailInput) {
            emailInput.required = !isEdit && normalized === 'real_email';
            emailInput.placeholder = normalized === 'real_email'
                ? 'teacher@example.com'
                : 'Optional contact email';
        }
        if (systemLoginInput) {
            systemLoginInput.required = !isEdit && normalized === 'system_account';
        }
    }

    function bindAccountModeControls() {
        document.getElementById('accountModeReal')?.addEventListener('change', () => setAccountMode('real_email', false));
        document.getElementById('accountModeSystem')?.addEventListener('change', () => setAccountMode('system_account', false));
    }

    function previewSystemLogin() {
        const first = String(document.getElementById('firstName')?.value || '').trim();
        const last = String(document.getElementById('lastName')?.value || '').trim();
        const custom = String(document.getElementById('systemLoginName')?.value || '').trim();
        const preview = document.getElementById('systemLoginPreview');
        if (!preview) return;

        const base = custom || [first, last].filter(Boolean).join('.') || 'teacher.name';
        const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'teacher.name';
        preview.textContent = `${slug}@fas.com`;
    }

    function bindSystemLoginPreview() {
        ['firstName', 'lastName', 'systemLoginName'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', previewSystemLogin);
        });
    }

    function getAccountModePayload(isEdit) {
        if (isEdit) return {};
        const mode = document.getElementById('accountModeReal')?.checked ? 'real_email' : 'system_account';
        return {
            account_mode: mode,
            system_login_name: String(document.getElementById('systemLoginName')?.value || '').trim()
        };
    }

    global.TeacherFormUI = {
        esc,
        renderSpecializationChips,
        getSelectedSpecializationIdsFromChips,
        setAccountMode,
        bindAccountModeControls,
        bindSystemLoginPreview,
        previewSystemLogin,
        getAccountModePayload,
        updateSpecializationSummary
    };
})(window);
