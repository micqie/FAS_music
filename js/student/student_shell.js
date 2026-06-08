(() => {
    function setText(selector, value) {
        document.querySelectorAll(selector).forEach((node) => {
            node.textContent = value;
        });
    }

    async function hydrateStudentShell() {
        const user = window.Auth?.getUser?.();
        if (!user) {
            window.setTimeout(hydrateStudentShell, 250);
            return;
        }

        const fallbackName = user.username || user.email || 'Student';
        setText('#studentNavName', fallbackName);
        setText('#studentMobileMenuName, #studentMobileMenuName2', 'Signed in');
        setText('#studentSidebarName, #studentSidebarMobileName, #studentName, #studentNameMobile', fallbackName);
        setText('#studentSidebarEmail, #studentSidebarMobileEmail, #studentEmail, #studentEmailMobile', user.email || '—');
        if (typeof window.setPortalBranchText === 'function') {
            window.setPortalBranchText('#studentSidebarBranch, #studentSidebarMobileBranch, #studentBranch, #studentBranchMobile', window.__studentPortalBranchLabel || '—');
        } else {
            setText('#studentSidebarBranch, #studentSidebarMobileBranch, #studentBranch, #studentBranchMobile', window.__studentPortalBranchLabel || '—');
        }

        if (typeof window.fetchStudentPortalDataByEmail !== 'function' || !user.email) return;

        try {
            const portal = await window.fetchStudentPortalDataByEmail(user.email);
            if (!portal?.success || !portal?.student) return;

            const student = portal.student;
            const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || fallbackName;
            const branchName = student.branch_name
                || portal.current_enrollment?.branch_name
                || portal.branch_name
                || '—';
            const email = student.email || user.email || '—';

            window.__studentPortalBranchLabel = branchName;
            setText('#studentNavName', fullName);
            setText('#studentMobileMenuName, #studentMobileMenuName2', 'Signed in');
            setText('#studentSidebarName, #studentSidebarMobileName, #studentName, #studentNameMobile', fullName);
            setText('#studentSidebarEmail, #studentSidebarMobileEmail, #studentEmail, #studentEmailMobile', email);
            if (typeof window.setPortalBranchText === 'function') {
                window.setPortalBranchText('#studentSidebarBranch, #studentSidebarMobileBranch, #studentBranch, #studentBranchMobile', branchName);
            } else {
                setText('#studentSidebarBranch, #studentSidebarMobileBranch, #studentBranch, #studentBranchMobile', branchName);
            }
        } catch (error) {
            console.warn('Unable to load student sidebar profile.', error);
            window.setTimeout(hydrateStudentShell, 500);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hydrateStudentShell, { once: true });
    } else {
        hydrateStudentShell();
    }
})();
