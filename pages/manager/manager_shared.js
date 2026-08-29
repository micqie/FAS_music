(() => {
    const shellRole = String(document.body?.dataset?.shellRole || 'manager').toLowerCase();
    const displayRoleName = shellRole === 'desk'
        ? 'Desk Staff'
        : 'Branch Manager';

    const PROFILE_HTML = `
        <div class="px-4 mb-4">
            <div class="flex justify-center">
                <i class="fas fa-user-circle fa-6x text-gold-400"></i>
            </div>
            <p class="manager-shell-name text-center text-white font-semibold text-sm mt-3">${displayRoleName} Name</p>
            <p class="manager-shell-email text-center text-slate-400 text-xs mt-1">email@example.com</p>
            <p class="text-center text-slate-500 text-xs font-bold tracking-wider mt-2">
                <span class="uppercase">Branch:</span>
                <span class="manager-shell-branch text-center font-bold text-white">Branch Name</span>
            </p>
            <div class="mt-3 h-2 w-[14rem] rounded-full bg-gold-500"></div>
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
