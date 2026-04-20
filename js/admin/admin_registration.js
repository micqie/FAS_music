   function setActiveMode(mode) {
            const title = document.getElementById('tableTitle');
            const subtitle = document.getElementById('tableSubtitle');
            const btnPending = document.getElementById('btnPending');
            const btnAll = document.getElementById('btnAll');

            const pendingActive = 'px-4 py-2 rounded-lg bg-gold-500 hover:bg-gold-400 text-black font-semibold text-sm transition';
            const normalBtn = 'px-4 py-2 rounded-lg bg-white hover:bg-gray-50 text-gray-900 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white border border-gray-200 dark:border-white/10 font-semibold text-sm transition';

            if (mode === 'all') {
                if (title) title.textContent = 'All Registrations';
                if (subtitle) subtitle.textContent = 'Showing all registration records in the system.';
                if (btnAll) btnAll.className = pendingActive;
                if (btnPending) btnPending.className = normalBtn;
                if (typeof loadAllRegistrations === 'function') loadAllRegistrations();
            } else {
                if (title) title.textContent = 'Pending Registrations';
                if (subtitle) subtitle.textContent = 'Showing records that are waiting for admin review/payment confirmation.';
                if (btnPending) btnPending.className = pendingActive;
                if (btnAll) btnAll.className = normalBtn;
                if (typeof loadPendingRegistrations === 'function') loadPendingRegistrations();
            }
        }

        document.addEventListener('DOMContentLoaded', function() {
            if (typeof checkAuth === 'function') {
                checkAuth();
            }

            // Load user info in top nav
            if (typeof Auth !== 'undefined' && Auth.getUser) {
                const user = Auth.getUser();
                if (user) {
                    const userNameNav = document.getElementById('userNameNav');
                    const profileMenuName = document.getElementById('profileMenuName');
                    const displayName = user.username || user.email || 'Admin';
                    if (userNameNav) userNameNav.textContent = displayName;
                    if (profileMenuName) profileMenuName.textContent = displayName;
                }
            }

            if (typeof initPaymentForm === 'function') {
                initPaymentForm();
            }

            // Initialize Register Student Modal
            const registerModal = document.getElementById('registerStudentModal');
            const openRegisterBtn = document.getElementById('openRegisterStudentModalBtn');
            const closeRegisterBtn = document.getElementById('closeRegisterStudentModalBtn');
            const cancelRegisterBtn = document.getElementById('cancelRegisterStudentBtn');
            const walkinForm = document.getElementById('walkinForm');

            const openRegisterModal = () => {
                registerModal.classList.remove('hidden');
                registerModal.classList.add('flex');
                if (typeof loadWalkinBranches === 'function') loadWalkinBranches();
                if (typeof updateWalkinAgeAndGuardianRequired === 'function') updateWalkinAgeAndGuardianRequired();
            };
            const closeRegisterModal = () => {
                registerModal.classList.add('hidden');
                registerModal.classList.remove('flex');
                if (walkinForm) {
                    walkinForm.reset();
                    if (typeof updateWalkinAgeAndGuardianRequired === 'function') updateWalkinAgeAndGuardianRequired();
                }
                const msgDiv = document.getElementById('walkinMessage');
                if (msgDiv) msgDiv.classList.add('hidden');
            };

            if (openRegisterBtn) openRegisterBtn.addEventListener('click', openRegisterModal);
            if (closeRegisterBtn) closeRegisterBtn.addEventListener('click', closeRegisterModal);
            if (cancelRegisterBtn) cancelRegisterBtn.addEventListener('click', closeRegisterModal);

            // Initialize walk-in form submission
            if (walkinForm && typeof initWalkinPage === 'function') {
                initWalkinPage();
            }

            const hash = (window.location.hash || '').replace('#', '').toLowerCase();
            setActiveMode(hash === 'pending' ? 'pending' : 'all');

            window.addEventListener('hashchange', () => {
                const h = (window.location.hash || '').replace('#', '').toLowerCase();
                setActiveMode(h === 'pending' ? 'pending' : 'all');
            });
        });
