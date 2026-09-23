(() => {
    function setText(selector, value) {
        document.querySelectorAll(selector).forEach((node) => {
            node.textContent = value;
        });
    }

    function showFreezeIndicator(enrollment) {
        const main = document.querySelector('main');
        if (!main) return;
        let notice = document.getElementById('studentGlobalFreezeNotice');
        const status = String(enrollment?.schedule_status || '').trim().toLowerCase();
        const frozen = status === 'frozen' || (status !== 'active' && Number(enrollment?.schedule_freeze_required || 0) === 1);
        if (!frozen) {
            notice?.remove();
            return;
        }
        if (!notice) {
            notice = document.createElement('section');
            notice.id = 'studentGlobalFreezeNotice';
            notice.className = 'student-freeze-notice';
            notice.setAttribute('role', 'status');
            main.prepend(notice);
        }
        const paymentStatus = String(enrollment.__freeze_payment_status || '').trim().toLowerCase();
        const detail = paymentStatus === 'pending'
            ? 'Your payment is awaiting staff approval. Your schedule remains frozen until it is approved.'
            : paymentStatus === 'rejected'
                ? 'Your previous payment was rejected. Please contact the front desk or submit a new payment.'
                : 'Your schedule is frozen. Pay the slot reservation fee or contact the front desk to restore access.';
        notice.innerHTML = '<div class="student-freeze-notice__icon" aria-hidden="true"><i class="fas fa-snowflake"></i></div>'
            + '<div class="student-freeze-notice__copy"><strong>Account frozen</strong><span></span></div>'
            + '<a class="student-freeze-notice__link" href="student_dashboard.html">View account details <i class="fas fa-arrow-right" aria-hidden="true"></i></a>';
        notice.querySelector('span').textContent = detail;
    }

    let refreshInProgress = false;
    async function refreshFreezeIndicator() {
        const user = window.Auth?.getUser?.();
        if (!user?.email || typeof window.fetchStudentPortalDataByEmail !== 'function' || refreshInProgress) return;
        refreshInProgress = true;
        try {
            const portal = await window.fetchStudentPortalDataByEmail(user.email);
            if (portal?.success) showFreezeIndicator(portal.current_enrollment);
        } catch (error) {
            console.warn('Unable to refresh student account status.', error);
        } finally {
            refreshInProgress = false;
        }
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
            showFreezeIndicator(portal.current_enrollment);
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
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) refreshFreezeIndicator();
    });
    window.setInterval(() => {
        if (!document.hidden) refreshFreezeIndicator();
    }, 60000);
})();
