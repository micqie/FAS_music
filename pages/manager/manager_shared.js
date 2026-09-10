(() => {
    const shellRole = String(document.body?.dataset?.shellRole || 'manager').toLowerCase();
    const displayRoleName = shellRole === 'desk'
        ? 'Desk Staff'
        : 'Branch Manager';

    const PROFILE_HTML = `
        <div class="manager-sidebar-profile block rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center transition hover:border-gold-500/30 hover:bg-white/10">
            <div class="mx-auto h-20 w-20 rounded-full border-2 border-gold-500/40 bg-[#1a1d23] flex items-center justify-center shadow-lg shadow-black/20">
                <i class="fas fa-user-circle text-7xl leading-none text-gold-400"></i>
            </div>
            <p class="manager-shell-name mt-3 truncate text-sm font-bold text-white">${displayRoleName}</p>
            <p class="manager-shell-email mt-1 truncate text-xs text-slate-400">email@example.com</p>
            <p class="mt-2 text-[10px] font-black uppercase tracking-[0.22em] text-gold-400">${displayRoleName}</p>
        </div>
    `;

    function setText(target, value) {
        if (!target) return;
        target.textContent = value;
    }

    function updateBranchLabels(branchName) {
        const value = branchName || '—';
        document.querySelectorAll(
            '.manager-shell-branch, [data-manager-shell-branch], #managerBranchName, #managerBranchNameSidebar, #managerBranchNamePill, #managerBranchNotice, #profileMenuBranch'
        ).forEach((node) => setText(node, value));
    }

    function updateUserLabels(displayName) {
        const value = displayName || displayRoleName;
        document.querySelectorAll(
            '#managerNameNav, #userNameNav, #profileMenuName, .manager-shell-name'
        ).forEach((node) => setText(node, value));
    }

    function updateEmailLabel(email) {
        const value = email || '';
        document.querySelectorAll('.manager-shell-email').forEach((node) => setText(node, value));
    }

    function mountProfileBlock() {
        document.querySelectorAll('[data-manager-shell-profile]').forEach((node) => {
            node.innerHTML = PROFILE_HTML;
        });
    }

    function mountFrozenAccountsLink() {
        const sidebar = document.querySelector('body > aside');
        const managementNav = sidebar?.querySelector('nav');
        if (!managementNav || managementNav.querySelector('a[href*="manager_frozen_accounts.html"]')) return;
        const link = document.createElement('a');
        link.href = 'manager_frozen_accounts.html';
        link.className = 'flex items-center px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all group';
        link.innerHTML = '<i class="fas fa-snowflake mr-3 text-slate-500 group-hover:text-gold-400 transition-colors"></i> Frozen Accounts';
        const sessionsLink = managementNav.querySelector('a[href*="manager_sessions.html"]');
        if (sessionsLink) sessionsLink.insertAdjacentElement('afterend', link);
        else managementNav.appendChild(link);
    }

    window.syncManagerShell = function syncManagerShell(displayName, branchName, email) {
        if (typeof displayName !== 'undefined') {
            updateUserLabels(displayName);
        }
        if (typeof branchName !== 'undefined') {
            updateBranchLabels(branchName);
        }
        if (typeof email !== 'undefined') {
            updateEmailLabel(email);
        }
    };

    window.syncManagerBranchLabels = updateBranchLabels;
    window.syncManagerUserLabels = updateUserLabels;

    const bootstrap = () => {
        mountProfileBlock();
        mountFrozenAccountsLink();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
    } else {
        bootstrap();
    }
})();
