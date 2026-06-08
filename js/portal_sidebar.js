(() => {
    function fitBranchElement(el) {
        if (!el) return;
        const text = String(el.textContent || '').trim();
        el.classList.remove('portal-profile-branch-value--sm', 'portal-profile-branch-value--xs');
        if (text.length > 28) {
            el.classList.add('portal-profile-branch-value--xs');
        } else if (text.length > 16) {
            el.classList.add('portal-profile-branch-value--sm');
        }
        el.title = text && text !== '—' ? text : '';
    }

    function fitAllPortalBranchLabels() {
        document.querySelectorAll('[data-portal-branch]').forEach(fitBranchElement);
    }

    window.setPortalBranchText = function setPortalBranchText(target, value) {
        const label = value == null || value === '' ? '—' : String(value);
        const nodes = typeof target === 'string'
            ? document.querySelectorAll(target.startsWith('#') || target.startsWith('.') ? target : `#${target}`)
            : (target instanceof Element ? [target] : Array.from(target || []));

        nodes.forEach((node) => {
            if (!node) return;
            node.textContent = label;
            fitBranchElement(node);
        });
    };

    window.fitAllPortalBranchLabels = fitAllPortalBranchLabels;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fitAllPortalBranchLabels, { once: true });
    } else {
        fitAllPortalBranchLabels();
    }
})();
