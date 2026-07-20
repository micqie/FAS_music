 let allStudents = [];
        let packagePagePackages = [];
        let managerBranchId = 0;
        let managerBranchName = '';
        let uiIsDesk = false;
        let managerPageMode = 'enrollments';
        let assignRequestTeacherCandidates = [];
        let assignRequestInstruments = [];
        let activeAssignRequestSlotRow = null;
        let activeAssignRequest = null;
        let assignRequestAvailabilitySlots = [];
        let assignRequestBookedSessions = [];
        let assignRequestAvailabilityMonth = '';
        let assignRequestAvailabilitySelectedDate = '';
        let assignRequestAvailabilityLoadTimer = null;
        let assignRequestAvailabilityRequestToken = 0;
        const assignRequestAvailabilityCache = new Map();
        let walkinStudents = [];
        let walkinMeta = null;
        let walkinStudentLookup = new Map();

        function showMessage(message, type = 'error') {
            Swal.fire({
                icon: type === 'success' ? 'success' : 'error',
                title: type === 'success' ? 'Success' : 'Error',
                text: message,
                confirmButtonColor: '#b8860b'
            });
        }

        function showToast(message, type = 'success') {
            Swal.fire({
                icon: type === 'success' ? 'success' : 'error',
                title: message,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3500,
                timerProgressBar: true,
                customClass: {
                    popup: 'text-sm',
                    container: 'swal2-toast-container-high-z'
                },
                didOpen: (toast) => {
                    toast.style.zIndex = '99999';
                }
            });
        }

        function showAssignPackageMessage(msg, type) {
            Swal.fire({
                icon: type === 'success' ? 'success' : 'error',
                title: type === 'success' ? 'Success' : 'Error',
                text: msg,
                confirmButtonColor: '#b8860b'
            });
        }

        function normalizeText(value) {
            return String(value || '').toLowerCase().trim();
        }

        function isGeneralTeacherSpecialization(text) {
            const spec = normalizeText(text);
            return spec.includes('all around')
                || spec.includes('all-around')
                || spec.includes('all instruments')
                || spec.includes('multi')
                || spec === 'general';
        }

        function getInstrumentKeywords(instrument) {
            const keywords = [
                instrument?.instrument_name || '',
                instrument?.type_name || ''
            ].map(normalizeText).filter(Boolean);
            return Array.from(new Set(keywords));
        }

        function splitTeacherSpecializations(text) {
            return String(text || '')
                .split(',')
                .map(part => normalizeText(part))
                .filter(Boolean);
        }

        function keywordMatchesSpecialization(keyword, specialization) {
            if (!keyword || !specialization) return false;
            if (keyword === specialization) return true;
            return specialization.includes(keyword) || keyword.includes(specialization);
        }

        function teacherMatchesInstrument(teacher, instrument) {
            if (!instrument) return false;
            const specializations = splitTeacherSpecializations(teacher?.specialization || '');
            if (!specializations.length) return false;
            if (specializations.some(isGeneralTeacherSpecialization)) return false;

            const keywords = getInstrumentKeywords(instrument);
            const typeName = normalizeText(instrument?.type_name || '');

            return specializations.some(spec => {
                if (typeName && spec === typeName) return true;
                return keywords.some(keyword => keywordMatchesSpecialization(keyword, spec));
            });
        }

        function getTeachersForInstrument(instrument) {
            if (!instrument) {
                return assignRequestTeacherCandidates.filter(teacher => !isGeneralTeacherSpecialization(teacher.specialization));
            }
            return assignRequestTeacherCandidates.filter(teacher => teacherMatchesInstrument(teacher, instrument));
        }

        function getInstrumentRowLabel(instrument, index) {
            if (!instrument) return `Additional Slot ${index + 1}`;
            const name = `${instrument.instrument_name || 'Instrument'}${instrument.type_name ? ` (${instrument.type_name})` : ''}`;
            return name;
        }

        function getAssignRequestInstrumentForIndex(index) {
            return Array.isArray(assignRequestInstruments) ? assignRequestInstruments[index] || null : null;
        }

        function buildAssignRequestSlotValue(slot) {
            return [
                String(slot.session_date || '').trim(),
                String(slot.day_of_week || '').trim(),
                String(slot.start_time || '').trim(),
                String(slot.end_time || '').trim()
            ].join('__');
        }

        function parseAssignRequestSlotValue(value) {
            const parts = String(value || '').split('__');
            if (parts.length !== 4) return null;
            return {
                session_date: parts[0] || '',
                day_of_week: parts[1] || '',
                start_time: parts[2] || '',
                end_time: parts[3] || ''
            };
        }

        function setSessionNavState(view) {
            const topPending = document.getElementById('viewNavPending');
            const topActive = document.getElementById('viewNavActive');
            const topBase = 'px-4 py-2 text-sm font-semibold rounded-lg text-slate-700 hover:bg-slate-100 transition';
            const topActiveClass = 'px-4 py-2 text-sm font-semibold rounded-lg bg-gold-500 text-white shadow';
            if (topPending) topPending.className = (view === 'pending') ? topActiveClass : topBase;
            if (topActive) topActive.className = (view === 'active') ? topActiveClass : topBase;

            if (managerPageMode !== 'enrollments') return;

            const pendingLink = document.getElementById('navEnrollmentPending');
            const activeLink = document.getElementById('navEnrollmentActive');
            const baseClass = 'block ml-11 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all';
            const activeClass = 'block ml-11 px-3 py-2 text-sm font-semibold text-white bg-white/10 rounded-lg';
            if (pendingLink) pendingLink.className = (view === 'pending') ? activeClass : baseClass;
            if (activeLink) activeLink.className = (view === 'active') ? activeClass : baseClass;
        }

        function applyManagerSidebarMode() {
            const enrollmentsSummary = document.getElementById('navManagerEnrollmentsSummary');
            const enrollmentsGroup = document.getElementById('navManagerEnrollmentsGroup');
            const sessionsLink = document.getElementById('navManagerSessionsLink');
            const baseClass = 'flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all w-full list-none cursor-pointer';
            const activeClass = 'sidebar-item-active flex items-center justify-between px-4 py-3 text-sm font-semibold rounded-xl shadow-lg transition-all w-full list-none cursor-pointer';
            const linkBaseClass = 'flex items-center px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all group';
            const linkActiveClass = 'sidebar-item-active flex items-center px-4 py-3 text-sm font-semibold rounded-xl shadow-lg transition-all group';
            if (enrollmentsSummary) enrollmentsSummary.className = managerPageMode === 'enrollments' ? activeClass : baseClass;
            if (sessionsLink) sessionsLink.className = managerPageMode === 'sessions' ? linkActiveClass : linkBaseClass;
            if (enrollmentsGroup) enrollmentsGroup.open = managerPageMode === 'enrollments';
        }

        function applyManagerPageMode() {
            managerPageMode = 'enrollments';

            const pageTitle = document.getElementById('sessionsPageTitle');
            const pageSubtitle = document.getElementById('sessionsPageSubtitle');
            const branchScopeLabel = document.getElementById('managerBranchScopeLabel');
            const pendingTitle = document.getElementById('pendingSectionTitle');
            const activeTitle = document.getElementById('activeSectionTitle');

            if (managerPageMode === 'enrollments') {
                document.title = 'Desk - Enrollments';
                if (pageTitle) pageTitle.textContent = 'Enrollments';
                if (pageSubtitle) pageSubtitle.textContent = 'Manage branch enrollments and send students into scheduling.';
                if (branchScopeLabel) branchScopeLabel.textContent = 'Enrollments are locked to your branch:';
                if (pendingTitle) pendingTitle.innerHTML = '<i class="fas fa-inbox mr-2 text-gold-500"></i>Pending Enrollments';
                if (activeTitle) activeTitle.innerHTML = '<i class="fas fa-user-check mr-2 text-gold-500"></i>Active Enrollments';
                window.pendingRequestActionLabel = 'Schedule Sessions';
                window.onPendingRequestAssignClick = function(requestId) {
                    openAssignRequestModal(requestId);
                };
            } else {
                document.title = 'Desk - Sessions';
                if (pageTitle) pageTitle.textContent = 'Sessions';
                if (pageSubtitle) pageSubtitle.textContent = 'Manage pending and active sessions';
                if (branchScopeLabel) branchScopeLabel.textContent = 'Sessions are locked to your branch:';
                if (pendingTitle) pendingTitle.innerHTML = '<i class="fas fa-inbox mr-2 text-gold-500"></i>Pending Student Requests';
                if (activeTitle) activeTitle.innerHTML = '<i class="fas fa-box mr-2 text-gold-500"></i>Active Sessions';
                window.pendingRequestActionLabel = 'Assign & Approve';
                window.onPendingRequestAssignClick = null;
            }

            applyManagerSidebarMode();
        }

        function applySessionView() {
            const params = new URLSearchParams(window.location.search);
            const view = String(params.get('view') || 'active').toLowerCase();
            const pendingSection = document.getElementById('pendingSessionsSection');
            const activeSection = document.getElementById('activeSessionsSection');
            const title = document.getElementById('sessionsPageTitle');
            const subtitle = document.getElementById('sessionsPageSubtitle');

            const enrollmentMode = uiIsDesk || managerPageMode === 'enrollments';
            const baseLabel = enrollmentMode ? 'Enrollments' : 'Sessions';
            const pendingLabel = enrollmentMode ? 'Pending Enrollments' : 'Pending Sessions';
            const activeLabel = enrollmentMode ? 'Active Enrollments' : 'Active Sessions';
            const pendingSub = enrollmentMode
                ? 'Review and assign pending enrollment requests'
                : 'Review and assign pending session requests';
            const activeSub = enrollmentMode
                ? 'Manage active student enrollment assignments'
                : 'Manage active student session assignments';
            const baseSub = enrollmentMode
                ? 'Manage pending and active enrollments'
                : 'Manage pending and active sessions';

            if (view === 'pending') {
                if (pendingSection) pendingSection.classList.remove('hidden');
                if (activeSection) activeSection.classList.add('hidden');
                if (title) title.textContent = pendingLabel;
                if (subtitle) subtitle.textContent = pendingSub;
                setSessionNavState('pending');
                return;
            }

            if (view === 'active') {
                if (pendingSection) pendingSection.classList.add('hidden');
                if (activeSection) activeSection.classList.remove('hidden');
                if (title) title.textContent = activeLabel;
                if (subtitle) subtitle.textContent = activeSub;
                setSessionNavState('active');
                return;
            }

            if (pendingSection) pendingSection.classList.remove('hidden');
            if (activeSection) activeSection.classList.remove('hidden');
            if (title) title.textContent = baseLabel;
            if (subtitle) subtitle.textContent = baseSub;
            setSessionNavState('');
        }

        async function maybeAutoOpenAssignPackageModalFromUrl() {
            const params = new URLSearchParams(window.location.search);
            const studentId = Number(params.get('assign_student_id') || 0);
            if (!studentId) return;

            const studentName = params.get('assign_student_name') || '';
            const packageId = Number(params.get('assign_package_id') || 0) || null;

            // Always show the active students view when navigating from registration
            const viewUrl = new URL(window.location.href);
            viewUrl.searchParams.set('view', 'active');
            window.history.replaceState({}, '', viewUrl.toString());
            applySessionView();

            // Ensure the packages are loaded before opening the modal
            await loadSessionPackages();
            await loadActiveStudents();
            openAssignPackageModal(studentId, studentName, packageId);
        }

        async function maybeAutoOpenAssignRequestModalFromUrl() {
            const params = new URLSearchParams(window.location.search);
            const requestId = Number(params.get('assign_request_id') || 0);
            if (!requestId) return;

            // Ensure pending requests are loaded so we can open the modal
            await loadPendingRequests();

            // Ensure we're viewing the pending requests tab
            const viewUrl = new URL(window.location.href);
            viewUrl.searchParams.set('view', 'pending');
            window.history.replaceState({}, '', viewUrl.toString());
            applySessionView();

            openAssignRequestModal(requestId);
        }

        async function lockWalkinBranchToManager() {
            const branchSelect = document.getElementById('walkin_branch_id');
            if (!branchSelect || !managerBranchId) return;
            if (!branchSelect.options.length || branchSelect.options[0].textContent === 'Loading branch...') {
                await loadWalkinBranches();
            }
            branchSelect.value = String(managerBranchId);
            branchSelect.dataset.lockedBranchId = String(managerBranchId);
            branchSelect.title = managerBranchName ? `Locked to ${managerBranchName}` : 'Locked to your branch';
            branchSelect.classList.add('bg-zinc-800/60');
            if (!branchSelect.dataset.managerLockBound) {
                branchSelect.addEventListener('change', function() {
                    this.value = this.dataset.lockedBranchId || '';
                });
                branchSelect.dataset.managerLockBound = '1';
            }
        }

        async function openWalkinRegistrationModal() {
            const modal = document.getElementById('registerStudentModal');
            const form = document.getElementById('walkinForm');
            if (!modal || !form) return;
            await lockWalkinBranchToManager();
            form.dataset.paymentRedirectTemplate = 'desk_enrollment.html?view=active&assign_student_id={student_id}';
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            updateWalkinAgeAndGuardianRequired();
        }

        function closeWalkinRegistrationModal() {
            const modal = document.getElementById('registerStudentModal');
            const form = document.getElementById('walkinForm');
            const msgDiv = document.getElementById('walkinMessage');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
            if (form) {
                form.reset();
                form.dataset.paymentRedirectTemplate = 'desk_enrollment.html?view=active&assign_student_id={student_id}';
            }
            if (msgDiv) msgDiv.classList.add('hidden');
            updateWalkinAgeAndGuardianRequired();
            lockWalkinBranchToManager();
        }

        async function loadWalkinStudents() {
            try {
                if (!requireManagerBranch()) return;
                const response = await axios.get(`${baseApiUrl}/students.php?action=get-active-students&branch_id=${encodeURIComponent(managerBranchId)}`);
                const data = response.data;
                const students = data.success && Array.isArray(data.students) ? data.students : [];
                walkinStudents = students.filter(student => {
                    const source = String(student.registration_source || 'online').toLowerCase();
                    const registrationStatus = String(student.registration_status || 'Pending');
                    
                    // Registration fee status - check if they've completed their lifetime registration (₱1000)
                    const isLifetimeRegistered = registrationStatus === 'Approved' || registrationStatus === 'Fee Paid';
                    
                    // Check if they have an active/pending enrollment (currently enrolled)
                    const hasActiveEnrollment = Number(student.has_active_enrollment || 0) === 1;
                    
                    // Only show walk-in students who:
                    // 1. Paid the lifetime registration fee (₱1000)
                    // 2. Do NOT have an active or pending enrollment (not currently enrolled)
                    // This includes students who have completed their package and are ready for a new one
                    return source === 'walkin' && isLifetimeRegistered && !hasActiveEnrollment;
                });
                populateWalkinStudentSelect();
            } catch (error) {
                console.error('Failed to load walk-in students:', error);
            }
        }

        function populateWalkinStudentSelect() {
            const input = document.getElementById('walkinStudentSearch');
            const hidden = document.getElementById('walkinStudentSelect');
            if (!input || !hidden) return;

            walkinStudentLookup = new Map();
            walkinStudents.forEach(student => {
                const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
                const email = student.email || '';
                const label = email ? `${name} (${email})` : name;
                walkinStudentLookup.set(label, student);
                if (email) walkinStudentLookup.set(email.toLowerCase(), student);
                walkinStudentLookup.set(name.toLowerCase(), student);
            });
            input.value = '';
            hidden.value = '';
            renderWalkinStudentResults('');
            updateWalkinSelectedStudentCard(null);
        }

        function resolveWalkinSelectedStudent() {
            const input = document.getElementById('walkinStudentSearch');
            const hidden = document.getElementById('walkinStudentSelect');
            if (!input || !hidden) return null;
            const label = String(input.value || '').trim();
            const student = walkinStudentLookup.get(label) || walkinStudentLookup.get(label.toLowerCase()) || null;
            hidden.value = student ? String(student.email || '') : '';
            return student;
        }

        function getWalkinStudentLabel(student) {
            const name = `${student?.first_name || ''} ${student?.last_name || ''}`.trim() || 'Student';
            const email = String(student?.email || '').trim();
            return email ? `${name} (${email})` : name;
        }

        function getWalkinStudentStatusBadge(student) {
            const hasCompleted = Number(student?.has_completed_enrollment || 0) === 1;
            const registrationStatus = String(student?.registration_status || 'Pending');

            if (hasCompleted) {
                return `<span class="inline-flex items-center rounded-sm border border-sky-200 bg-sky-50 px-2.5 py-1 text-sm font-bold text-sky-700">Re-enrollment</span>`;
            }
            const cls = registrationStatus === 'Approved' || registrationStatus === 'Fee Paid'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-700';
            const label = registrationStatus === 'Approved' || registrationStatus === 'Fee Paid'
                ? 'Registered'
                : registrationStatus;
            return `<span class="inline-flex items-center rounded-sm border px-2.5 py-1 text-sm font-bold ${cls}">${escapeHtml(label)}</span>`;
        }

        function updateWalkinSelectedStudentCard(student) {
            const card = document.getElementById('walkinSelectedStudentCard');
            const nameEl = document.getElementById('walkinSelectedStudentName');
            const metaEl = document.getElementById('walkinSelectedStudentMeta');
            if (!card || !nameEl || !metaEl) return;

            if (!student) {
                card.classList.add('hidden');
                nameEl.textContent = '—';
                metaEl.textContent = '—';
                return;
            }

            const branch = student.branch_name || managerBranchName || 'Assigned branch';
            const phone = student.phone || 'No phone';
            nameEl.textContent = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
            metaEl.textContent = `${student.email || 'No email'} • ${phone} • ${branch}`;
            card.classList.remove('hidden');
        }

        function renderWalkinStudentResults(query) {
            const listEl = document.getElementById('walkinStudentResults');
            const hidden = document.getElementById('walkinStudentSelect');
            if (!listEl) return;

            const term = String(query || '').trim().toLowerCase();
            const rows = !term
                ? walkinStudents.slice(0, 8)
                : walkinStudents.filter((student) => {
                    const haystack = [
                        `${student.first_name || ''} ${student.last_name || ''}`,
                        student.email || '',
                        student.phone || ''
                    ].join(' ').toLowerCase();
                    return haystack.includes(term);
                }).slice(0, 10);

            if (!walkinStudents.length) {
                listEl.innerHTML = `
                    <div class="desk-modal-list-item text-center text-slate-500 py-4">
                        No walk-in students are currently available for enrollment in this branch.
                    </div>
                `;
                return;
            }

            if (!rows.length) {
                listEl.innerHTML = `
                    <div class="desk-modal-list-item text-center text-slate-500 py-4">
                        No student matched that search.
                    </div>
                `;
                return;
            }

            const selectedEmail = String(hidden?.value || '').trim().toLowerCase();
            listEl.innerHTML = rows.map((student, index) => {
                const isSelected = selectedEmail && selectedEmail === String(student.email || '').trim().toLowerCase();
                const branchName = student.branch_name || managerBranchName || 'Assigned branch';
                return `
                    <button
                        type="button"
                        class="walkin-student-result w-full desk-modal-list-item text-left transition ${isSelected ? 'border-gold-500 bg-amber-50' : 'hover:bg-slate-50'}"
                        data-student-index="${index}"
                    >
                        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <div class="text-lg font-bold text-slate-900">${escapeHtml(`${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student')}</div>
                                <div class="mt-1 text-base text-slate-600">${escapeHtml(student.email || 'No email on file')}</div>
                                <div class="mt-1.5 text-sm text-slate-500">${escapeHtml(branchName)} • ${escapeHtml(student.phone || 'No phone')}</div>
                            </div>
                            <div class="flex flex-wrap items-center gap-2">
                                ${getWalkinStudentStatusBadge(student)}
                                <span class="inline-flex items-center rounded-sm border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm font-bold text-slate-700">Walk-In</span>
                            </div>
                        </div>
                    </button>
                `;
            }).join('');
        }

        function renderWalkinPackageCards() {
            const packageSelect = document.getElementById('walkinPackageSelect');
            const cardsContainer = document.getElementById('walkinPackageCards');
            if (!packageSelect || !cardsContainer) return;

            const options = Array.from(packageSelect.options || []).filter(option => String(option.value || '').trim());
            if (!options.length) {
                cardsContainer.innerHTML = '';
                return;
            }

            const selectedValue = String(packageSelect.value || '');
            cardsContainer.innerHTML = options.map(option => {
                const maxInst = Number(option.getAttribute('data-max-instruments') || 0);
                const sessions = Number(option.getAttribute('data-sessions') || 0);
                const isSelected = selectedValue && selectedValue === String(option.value || '');
                return `
                    <button
                        type="button"
                        class="walkin-package-card ${isSelected ? 'is-selected' : ''}"
                        data-package-id="${escapeHtml(String(option.value || ''))}"
                    >
                        <div class="flex items-start gap-3">
                            <div class="min-w-0 flex-1">
                                <div class="walkin-package-card-title">${escapeHtml((option.textContent || 'Package').split(' (')[0])}</div>
                                <div class="walkin-package-card-subtitle">${sessions} session${sessions === 1 ? '' : 's'} • up to ${maxInst} instrument${maxInst === 1 ? '' : 's'}</div>
                                <div class="walkin-package-card-price">${escapeHtml(option.getAttribute('data-price') ? formatCurrencyPHP(option.getAttribute('data-price')) : '₱0.00')}</div>
                            </div>
                            <span class="walkin-package-card-check ${isSelected ? '' : 'opacity-0'}"><i class="fas fa-check"></i></span>
                        </div>
                    </button>
                `;
            }).join('');
        }

        function syncWalkinPackageCardSelection() {
            const packageSelect = document.getElementById('walkinPackageSelect');
            const cardsContainer = document.getElementById('walkinPackageCards');
            if (!packageSelect || !cardsContainer) return;

            const selectedValue = String(packageSelect.value || '');
            cardsContainer.querySelectorAll('.walkin-package-card').forEach(card => {
                const isSelected = selectedValue && String(card.getAttribute('data-package-id') || '') === selectedValue;
                card.classList.toggle('is-selected', isSelected);
                const check = card.querySelector('.walkin-package-card-check');
                if (check) {
                    check.classList.toggle('opacity-0', !isSelected);
                }
            });
        }

        function selectWalkinPackage(packageId) {
            const packageSelect = document.getElementById('walkinPackageSelect');
            if (!packageSelect) return;
            packageSelect.value = String(packageId || '');
            packageSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }

        function renderWalkinPaymentTypeCards() {
            const paymentTypeSelect = document.getElementById('walkinPaymentType');
            const cardsContainer = document.getElementById('walkinPaymentTypeCards');
            if (!paymentTypeSelect || !cardsContainer) return;

            const options = Array.from(paymentTypeSelect.options || []).filter(option => String(option.value || '').trim());
            const selectedValue = String(paymentTypeSelect.value || options[0]?.value || '');
            cardsContainer.innerHTML = options.map(option => {
                const value = String(option.value || '');
                const label = String(option.textContent || value);
                const subtitle = value === 'Partial Payment'
                    ? 'Pay a deposit now, rest later'
                    : 'Pay the total amount now';
                const isSelected = selectedValue === value;
                return `
                    <button type="button" class="walkin-choice-card ${isSelected ? 'is-selected' : ''}" data-payment-type="${escapeHtml(value)}">
                        <div class="flex items-start gap-3">
                            <span class="walkin-choice-card-radio"><span class="walkin-choice-card-radio-dot"></span></span>
                            <div class="min-w-0 flex-1">
                                <div class="walkin-choice-card-title">${escapeHtml(label)}</div>
                                <div class="walkin-choice-card-subtitle">${escapeHtml(subtitle)}</div>
                            </div>
                        </div>
                    </button>
                `;
            }).join('');
        }

        function syncWalkinPaymentTypeCardSelection() {
            const paymentTypeSelect = document.getElementById('walkinPaymentType');
            const cardsContainer = document.getElementById('walkinPaymentTypeCards');
            if (!paymentTypeSelect || !cardsContainer) return;

            const selectedValue = String(paymentTypeSelect.value || '');
            cardsContainer.querySelectorAll('.walkin-choice-card').forEach(card => {
                const isSelected = selectedValue && String(card.getAttribute('data-payment-type') || '') === selectedValue;
                card.classList.toggle('is-selected', isSelected);
            });
        }

        function selectWalkinPaymentType(paymentType) {
            const paymentTypeSelect = document.getElementById('walkinPaymentType');
            if (!paymentTypeSelect) return;
            paymentTypeSelect.value = String(paymentType || '');
            paymentTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }

        async function selectWalkinStudent(student) {
            const hidden = document.getElementById('walkinStudentSelect');
            const statusEl = document.getElementById('walkinStatusInfo');
            const packageSelect = document.getElementById('walkinPackageSelect');
            const instrumentsContainer = document.getElementById('walkinInstrumentsContainer');
            const submitBtn = document.getElementById('submitWalkinEnrollmentBtn');
            const input = document.getElementById('walkinStudentSearch');
            if (!hidden || !packageSelect || !instrumentsContainer) return;

            hidden.value = student ? String(student.email || '') : '';
            if (input) input.value = student ? getWalkinStudentLabel(student) : '';
            updateWalkinSelectedStudentCard(student);
            renderWalkinStudentResults(input?.value || '');

            if (!student || !hidden.value) {
                packageSelect.innerHTML = '<option value="">Select package...</option>';
                renderWalkinPackageCards();
                renderWalkinPaymentTypeCards();
                syncWalkinPaymentTypeCardSelection();
                instrumentsContainer.innerHTML = '<div class="text-sm text-slate-500">Select a package first.</div>';
                if (statusEl) statusEl.textContent = '';
                if (submitBtn) submitBtn.disabled = false;
                walkinMeta = null;
                return;
            }

            const meta = await fetchStudentRequestMetaByEmail(hidden.value);
            if (!meta?.success) {
                if (statusEl) statusEl.textContent = meta?.error || 'Failed to load student request details.';
                walkinMeta = null;
                return;
            }

            walkinMeta = meta;
            const packages = Array.isArray(meta.packages) ? meta.packages : [];
            const previousValue = String(packageSelect.value || '');
            packageSelect.innerHTML = '<option value="">Select package...</option>' + packages.map(pkg => {
                const sessions = Number(pkg.sessions || 0);
                const maxInst = Number(pkg.max_instruments || 1);
                const price = formatCurrencyPHP(pkg.price || 0);
                return `<option value="${pkg.package_id}" data-max-instruments="${maxInst}" data-sessions="${sessions}" data-price="${pkg.price || 0}">${escapeHtml(pkg.package_name || 'Package')} (${sessions} sessions, up to ${maxInst} instrument${maxInst > 1 ? 's' : ''}) - ${price}</option>`;
            }).join('');
            if (previousValue && packages.some(pkg => String(pkg.package_id) === previousValue)) {
                packageSelect.value = previousValue;
            }
            renderWalkinPackageCards();
            renderWalkinPaymentTypeCards();
            syncWalkinPaymentTypeCardSelection();

            const latest = meta.latest_request || null;
            const hasPending = latest && String(latest.status || '') === 'Pending';
            if (statusEl) {
                statusEl.textContent = hasPending
                    ? 'This student already has a pending enrollment request. Finish that scheduling first before creating another one.'
                    : 'Student selected. Continue with package, instrument, and payment details.';
            }
            if (submitBtn) submitBtn.disabled = hasPending;
            updateWalkinPackageUI();
        }

        function openWalkinEnrollmentModal() {
            const modal = document.getElementById('walkinEnrollmentModal');
            if (!modal) return;
            loadWalkinStudents();
            document.body.style.overflow = 'hidden';
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function closeWalkinEnrollmentModal() {
            const modal = document.getElementById('walkinEnrollmentModal');
            const form = document.getElementById('walkinEnrollmentForm');
            const submitBtn = document.getElementById('submitWalkinEnrollmentBtn');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
            document.body.style.overflow = '';
            if (form) form.reset();
            walkinMeta = null;
            if (submitBtn) submitBtn.disabled = false;
            const statusEl = document.getElementById('walkinStatusInfo');
            const searchInput = document.getElementById('walkinStudentSearch');
            const hiddenSelect = document.getElementById('walkinStudentSelect');
            const packageSelect = document.getElementById('walkinPackageSelect');
            const instrumentsContainer = document.getElementById('walkinInstrumentsContainer');
            if (statusEl) statusEl.textContent = '';
            if (searchInput) searchInput.value = '';
            if (hiddenSelect) hiddenSelect.value = '';
            if (packageSelect) packageSelect.innerHTML = '<option value="">Select package...</option>';
            renderWalkinPackageCards();
            renderWalkinPaymentTypeCards();
            syncWalkinPaymentTypeCardSelection();
            if (instrumentsContainer) instrumentsContainer.innerHTML = '<div class="text-sm text-slate-500">Select a package first.</div>';
            updateWalkinSelectedStudentCard(null);
            renderWalkinStudentResults('');
        }

        function updateWalkinPackageUI() {
            const packageSelect = document.getElementById('walkinPackageSelect');
            const paymentTypeEl = document.getElementById('walkinPaymentType');
            const instrumentsContainer = document.getElementById('walkinInstrumentsContainer');
            const amountEl = document.getElementById('walkinAmountInfo');
            if (!packageSelect || !paymentTypeEl || !instrumentsContainer || !amountEl) return;

            const selected = packageSelect.options[packageSelect.selectedIndex];
            const maxInst = Number(selected?.getAttribute('data-max-instruments') || 0);
            const price = Number(selected?.getAttribute('data-price') || 0);
            const sessions = Number(selected?.getAttribute('data-sessions') || 0);
            const paymentType = String(paymentTypeEl.value || 'Partial Payment');
            syncWalkinPackageCardSelection();
            syncWalkinPaymentTypeCardSelection();
            const registrationFeeDue = typeof getRegistrationFeeDueAmount === 'function'
                ? getRegistrationFeeDueAmount(walkinMeta?.student || null)
                : 1000;
            const partialDeposit = 5000;
            const partialAmount = computeStudentRequestPayableNow(price, sessions, 'Partial Payment');
            const fullAmount = computeStudentRequestPayableNow(price, sessions, 'Full Payment');
            const payableNow = computeStudentRequestPayableNow(price, sessions, paymentType, registrationFeeDue);
            const enrollmentNow = computeStudentRequestPayableNow(price, sessions, paymentType);
            const summaryLabel = paymentType === 'Full Payment' ? 'Full Payment' : 'Partial Deposit';
            amountEl.innerHTML = `
                <div class="space-y-0">
                    <div class="walkin-summary-row">
                        <div>
                            <div class="walkin-summary-label">Package Amount</div>
                            <div class="walkin-summary-subtext">(${escapeHtml(selected?.textContent?.split(' (')[0] || 'Selected package')})</div>
                        </div>
                        <div class="walkin-summary-value">${formatCurrencyPHP(price)}</div>
                    </div>
                    <div class="walkin-summary-row">
                        <div class="walkin-summary-label">Registration Fee</div>
                        <div class="walkin-summary-value">${formatCurrencyPHP(registrationFeeDue)}</div>
                    </div>
                    <div class="walkin-summary-row">
                        <div class="walkin-summary-label">${escapeHtml(summaryLabel)}</div>
                        <div class="walkin-summary-value">${formatCurrencyPHP(enrollmentNow)}</div>
                    </div>
                    <div class="walkin-summary-total">
                        <div class="walkin-summary-label">Total Due Now</div>
                        <div class="walkin-summary-value">${formatCurrencyPHP(payableNow)}</div>
                    </div>
                    ${paymentType === 'Partial Payment'
                        ? `<div class="walkin-summary-balance">Remaining balance: ${formatCurrencyPHP(Math.max(price - partialDeposit, 0))}</div>`
                        : ''}
                </div>`;
            instrumentsContainer.innerHTML = maxInst > 0
                ? renderStudentRequestInstrumentSelectors(maxInst, walkinMeta?.instruments || [])
                : '<div class="text-sm text-slate-500">Select a package first.</div>';
        }

        async function handleWalkinStudentChange() {
            const statusEl = document.getElementById('walkinStatusInfo');
            const input = document.getElementById('walkinStudentSearch');
            const term = String(input?.value || '').trim();
            renderWalkinStudentResults(term);

            const selectedStudent = resolveWalkinSelectedStudent();
            if (selectedStudent && term) {
                await selectWalkinStudent(selectedStudent);
                return;
            }

            updateWalkinSelectedStudentCard(null);
            if (statusEl) {
                statusEl.textContent = term ? 'Choose a student card below to continue.' : '';
            }
        }

        async function submitWalkinEnrollment(e) {
            e.preventDefault();
            const submitBtn = document.getElementById('submitWalkinEnrollmentBtn');
            if (!submitBtn) return;

            const studentSelect = document.getElementById('walkinStudentSelect');
            const packageSelect = document.getElementById('walkinPackageSelect');
            const paymentTypeEl = document.getElementById('walkinPaymentType');
            const paymentMethodEl = document.getElementById('walkinPaymentMethod');
            if (!studentSelect || !packageSelect || !paymentTypeEl || !paymentMethodEl) {
                console.error('[Walk-in Enrollment] Missing required form elements');
                return;
            }

            const selectedStudent = resolveWalkinSelectedStudent();
            const email = studentSelect.value || '';
            const studentId = Number(selectedStudent?.student_id || 0);
            const packageId = parseInt(packageSelect.value, 10);
            const paymentType = String(paymentTypeEl.value || '').trim();
            const paymentMethod = String(paymentMethodEl.value || '').trim();
            const instrumentIds = Array.from(document.querySelectorAll('#walkinInstrumentsContainer .student-request-instrument'))
                .map(el => parseInt(el.value, 10))
                .filter(value => !Number.isNaN(value) && value > 0);
            const uniqueInstrumentIds = Array.from(new Set(instrumentIds));

            console.log('[Walk-in Enrollment Debug]', {
                email,
                studentId,
                packageId,
                paymentType,
                paymentMethod,
                instrumentIds,
                uniqueInstrumentIds
            });

            if (!email || !studentId || !packageId || !paymentType || !paymentMethod || uniqueInstrumentIds.length < 1) {
                showToast('Please complete student, package, instruments, payment type, and payment method.', 'error');
                console.error('[Walk-in Enrollment] Validation failed: missing required fields');
                return;
            }
            if (instrumentIds.length !== uniqueInstrumentIds.length) {
                showToast('Each selected instrument must be unique. Please change the duplicate selection.', 'error');
                console.error('[Walk-in Enrollment] Validation failed: duplicate instruments');
                return;
            }

            // Validate that no two instrument slots share the same type
            const typeSelects = Array.from(document.querySelectorAll('#walkinInstrumentsContainer .student-request-instrument-type'));
            const selectedTypeIds = typeSelects.map(el => String(el.value || '').trim()).filter(Boolean);
            
            console.log('[Walk-in Enrollment Type Check]', { typeSelects: typeSelects.length, selectedTypeIds });
            
            // Only check for duplicate types if there are multiple types selected
            if (selectedTypeIds.length > 1 && selectedTypeIds.length !== new Set(selectedTypeIds).size) {
                showToast('Each instrument slot must have a different instrument type. Please change the duplicate type selection.', 'error');
                console.error('[Walk-in Enrollment] Validation failed: duplicate types');
                return;
            }

            const selectedOption = packageSelect.options[packageSelect.selectedIndex];
            const maxInst = Number(selectedOption?.getAttribute('data-max-instruments') || 1);
            if (uniqueInstrumentIds.length > maxInst) {
                showToast(`You can select up to ${maxInst} instrument(s) for this package.`, 'error');
                console.error('[Walk-in Enrollment] Validation failed: too many instruments');
                return;
            }

            console.log('[Walk-in Enrollment] Validation passed, submitting...');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            try {
                const requestFormData = new FormData();
                requestFormData.append('action', 'submit-package-request');
                requestFormData.append('student_id', String(studentId));
                requestFormData.append('package_id', String(packageId));
                requestFormData.append('payment_type', paymentType);
                requestFormData.append('payment_method', paymentMethod);
                requestFormData.append('instrument_ids_json', JSON.stringify(uniqueInstrumentIds));
                requestFormData.append('is_walkin_request', '1');

                const response = await postStudentPackageRequest(requestFormData);
                if (response.success) {
                    closeWalkinEnrollmentModal();
                    await Promise.all([loadPendingRequests(), loadActiveStudents(), loadWalkinStudents()]);
                    showToast(response.message || 'Walk-in enrollment submitted successfully.', 'success');
                    // Stay on the current page and show pending enrollments
                    const viewUrl = new URL(window.location.href);
                    viewUrl.searchParams.set('view', 'pending');
                    window.history.replaceState({}, '', viewUrl.toString());
                    applySessionView();
                } else {
                    showToast(response.error || 'Failed to submit walk-in enrollment.', 'error');
                }
            } catch (error) {
                console.error('[Walk-in Enrollment] Network error:', error);
                showToast('Network error. Please try again.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Walk-In Enrollment';
            }
        }

        function requireManagerBranch() {
            if (!managerBranchId) {
                showMessage('Your account has no branch assigned. Please contact the administrator.', 'error');
                return false;
            }
            return true;
        }

        async function loadSessionPackages() {
            try {
                const response = await axios.get(`${baseApiUrl}/sessions.php?action=get-packages&branch_id=${encodeURIComponent(managerBranchId)}`);
                const data = response.data;

                if (data.success && data.packages) {
                    packagePagePackages = data.packages;
                    const select = document.getElementById('assignPackageSelect');
                    if (select) {
                        select.innerHTML = '<option value="">Select Package</option>';
                        data.packages.forEach(pkg => {
                            const option = document.createElement('option');
                            option.value = pkg.package_id;
                            option.textContent = `${pkg.package_name} (${pkg.sessions} sessions, ${pkg.max_instruments} instrument${pkg.max_instruments > 1 ? 's' : ''})`;
                            select.appendChild(option);
                        });
                    }
                }
            } catch (error) {
                console.error('Failed to load session packages:', error);
            }
        }

        function formatCurrencyPHP(amount) {
            const n = Number(amount || 0);
            return `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        function buildPublicFileUrl(filePath) {
            if (!filePath) return '';
            const raw = String(filePath).trim();
            if (!raw) return '';
            if (/^https?:\/\//i.test(raw)) return raw;
            const appBase = String(baseApiUrl || '').replace(/\/api\/?$/, '');
            const cleanPath = raw.replace(/^\/+/, '');
            return `${appBase}/${cleanPath}`;
        }

        function formatTime12Hour(timeString) {
            if (!timeString) return '—';
            const parts = String(timeString).split(':');
            if (parts.length < 2) return timeString;
            const h = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            if (Number.isNaN(h) || Number.isNaN(m)) return timeString;
            const suffix = h >= 12 ? 'PM' : 'AM';
            const hh = h % 12 === 0 ? 12 : h % 12;
            return `${hh}:${String(m).padStart(2, '0')} ${suffix}`;
        }

        async function loadPendingRequests() {
            const tableBody = document.getElementById('pendingRequestsTable');
            const countEl = document.getElementById('pendingRequestCount');
            if (!tableBody) return;

            try {
                if (!requireManagerBranch()) return;
                let url = `${baseApiUrl}/students.php?action=get-pending-package-requests&branch_id=${encodeURIComponent(managerBranchId)}`;

                const response = await axios.get(url);
                const data = response.data;
                const requests = data.success && Array.isArray(data.requests) ? data.requests : [];

                if (countEl) countEl.textContent = `${requests.length} pending`;

                if (!requests.length) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="6" class="px-6 py-8 text-center text-slate-500">
                                <i class="fas fa-inbox text-2xl mb-2 text-gold-500/60"></i>
                                <p>${uiIsDesk ? 'No pending enrollment requests.' : 'No pending student requests.'}</p>
                            </td>
                        </tr>`;
                    return;
                }

                pendingRequestsById = {};
                tableBody.innerHTML = requests.map(r => {
                    pendingRequestsById[String(r.request_id)] = r;
                    const studentName = `${escapeHtml(r.first_name || '')} ${escapeHtml(r.last_name || '')}`.trim();
                    const pkg = escapeHtml(r.package_name || '—');
                    const instruments = Array.isArray(r.instruments) && r.instruments.length
                        ? r.instruments.map(i => escapeHtml(i.instrument_name || 'Instrument')).join(', ')
                        : '—';
                    const paymentType = escapeHtml(r.payment_type || 'Partial Payment');
                    const payableNow = Number(r.payable_now || 0);
                    return `
                        <tr class="hover:bg-slate-50/80 transition">
                            <td class="px-6 py-4">
                                <div class="font-semibold text-base text-slate-900">${studentName || 'Student'}</div>
                                <div class="text-base text-slate-600">${escapeHtml(r.email || '')}</div>
                                <div class="text-sm text-slate-500">${escapeHtml(r.branch_name || '')}</div>
                            </td>
                            <td class="px-6 py-4 text-base text-slate-700">${pkg}</td>
                            <td class="px-6 py-4 text-base text-slate-700">${instruments}</td>
                            <td class="px-6 py-4 text-base text-slate-700">Based on instructor availability</td>
                            <td class="px-6 py-4 text-base text-slate-700">
                                <div class="space-y-2">
                                   
                                    <button type="button" onclick="openPendingRequestPaymentModal(${Number(r.request_id)})" class="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 transition">
                                        Payment Info
                                    </button>
                                </div>
                            </td>
                            <td class="px-6 py-4">
                                <div class="flex flex-wrap items-center gap-2">
                                    <button onclick="openPendingRequestViewModal(${Number(r.request_id)})" class="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-bold">
                                        View
                                    </button>
                                    <button onclick="(window.onPendingRequestAssignClick || openAssignRequestModal)(${Number(r.request_id)})" class="px-4 py-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 text-sm font-bold">
                                        ${window.pendingRequestActionLabel || 'Assign & Approve'}
                                    </button>
                                    <button onclick="rejectStudentRequest(${Number(r.request_id)})" class="px-4 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 text-sm font-bold">
                                        Reject
                                    </button>
                                </div>
                            </td>
                        </tr>`;
                }).join('');
            } catch (error) {
                console.error('Failed to load pending package requests:', error);
                if (countEl) countEl.textContent = 'Error';
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-8 text-center text-red-500">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <p>Failed to load pending requests.</p>
                        </td>
                    </tr>`;
            }
        }

        function openPendingRequestViewModal(requestId) {
            const req = pendingRequestsById[String(requestId)];
            if (!req) {
                showMessage('Request not found.', 'error');
                return;
            }

            const studentName = `${escapeHtml(req.first_name || '')} ${escapeHtml(req.last_name || '')}`.trim() || 'Student';
            const instruments = Array.isArray(req.instruments) && req.instruments.length
                ? req.instruments.map(i => {
                    const instrumentName = escapeHtml(i.instrument_name || 'Instrument');
                    const typeName = escapeHtml(i.type_name || '');
                    return typeName ? `${instrumentName} (${typeName})` : instrumentName;
                }).join(', ')
                : '—';
            const paymentType = escapeHtml(req.payment_type || 'Partial Payment');
            const paymentMethod = escapeHtml(req.payment_method || '—');
            const payableNow = Number(req.payable_now || 0);
            const packageAmount = Number(req.requested_amount || req.package_price || 0);
            const proofHtml = req.payment_proof_path
                ? `<a href="${escapeHtml(buildPublicFileUrl(req.payment_proof_path))}" target="_blank" rel="noopener" class="text-sm text-blue-600 underline">View payment proof</a>`
                : '<span class="text-sm text-slate-500">No payment proof</span>';

            Swal.fire({
                title: 'Enrollment Request',
                width: 760,
                confirmButtonText: 'Close',
                html: `
                    <div class="text-left space-y-4 text-sm text-slate-700">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div><span class="font-semibold text-slate-900">Student:</span> ${studentName}</div>
                            <div><span class="font-semibold text-slate-900">Branch:</span> ${escapeHtml(req.branch_name || '—')}</div>
                            <div><span class="font-semibold text-slate-900">Package:</span> ${escapeHtml(req.package_name || '—')}</div>
                            <div><span class="font-semibold text-slate-900">Selected Instrument:</span> ${instruments}</div>
                            <div><span class="font-semibold text-slate-900">Schedule Basis:</span> Instructor availability</div>
                            <div><span class="font-semibold text-slate-900">Payment Type:</span> ${paymentType}</div>
                            <div><span class="font-semibold text-slate-900">Payment Method:</span> ${paymentMethod}</div>
                            <div><span class="font-semibold text-slate-900">Amount Paid:</span> ${formatCurrencyPHP(payableNow)}</div>
                            <div><span class="font-semibold text-slate-900">Package Amount:</span> ${formatCurrencyPHP(packageAmount)}</div>
                        </div>
                        <div><span class="font-semibold text-slate-900">Proof of Payment:</span> ${proofHtml}</div>
                    </div>
                `
            });
        }

        function getDayNameFromDate(dateValue) {
            if (!dateValue) return '';
            const parts = String(dateValue).split('-');
            if (parts.length !== 3) return '';
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            const dNum = parseInt(parts[2], 10);
            if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(dNum)) return '';
            const d = new Date(y, m - 1, dNum);
            if (Number.isNaN(d.getTime())) return '';
            return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()] || '';
        }

        function getTimeMinutes(value) {
            const raw = String(value || '').trim();
            if (!/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) return NaN;
            const [hours, minutes] = raw.split(':');
            return (Number(hours || 0) * 60) + Number(minutes || 0);
        }

        function getTeacherCandidateById(teacherId) {
            return assignRequestTeacherCandidates.find(teacher => Number(teacher.teacher_id) === Number(teacherId)) || null;
        }

        function getTeacherNameById(teacherId) {
            return String(getTeacherCandidateById(teacherId)?.teacher_name || '').trim();
        }

        function getAssignRequestRowTeacherId(row) {
            if (!row) return null;
            const hiddenInput = row.querySelector('.assign-request-slot-teacher-id');
            const selectInput = row.querySelector('.assign-request-slot-teacher-select');
            const teacherId = Number(hiddenInput?.value || selectInput?.value || row.dataset.teacherId || 0);
            return teacherId > 0 ? teacherId : null;
        }

        function getAssignRequestRowTeacherName(row) {
            if (!row) return '';
            const hiddenInput = row.querySelector('.assign-request-slot-teacher-id');
            const selectInput = row.querySelector('.assign-request-slot-teacher-select');
            const teacherId = getAssignRequestRowTeacherId(row);
            const candidate = teacherId ? getTeacherCandidateById(teacherId) : null;
            return String(
                hiddenInput?.dataset.teacherName
                || candidate?.teacher_name
                || selectInput?.selectedOptions?.[0]?.textContent
                || ''
            ).trim();
        }

        function getAssignableAssignRequestSlotRow() {
            const container = document.getElementById('assignRequestSlotsContainer');
            const rows = Array.from(container?.querySelectorAll('.assign-request-slot') || []);
            if (!rows.length) return null;

            const activeRow = activeAssignRequestSlotRow && container?.contains(activeAssignRequestSlotRow)
                ? activeAssignRequestSlotRow
                : null;
            if (activeRow && getAssignRequestRowTeacherId(activeRow)) {
                return activeRow;
            }

            const teacherReadyRow = rows.find(row => getAssignRequestRowTeacherId(row));
            return teacherReadyRow || rows[0] || null;
        }

        function getAssignRequestRowData(row) {
            if (!row) return null;
            return {
                instrument_id: Number(row.querySelector('.assign-request-slot-instrument')?.value || row.dataset.instrumentId || 0) || null,
                teacher_id: getAssignRequestRowTeacherId(row),
                day_of_week: row.querySelector('.assign-request-slot-day')?.value || '',
                start_time: row.querySelector('.assign-request-slot-start')?.value || '',
                end_time: row.querySelector('.assign-request-slot-end')?.value || ''
            };
        }

        function renderTeacherControlForInstrument(instrument, selectedTeacherId = '', lockTeacher = false, rowIndex = null) {
            const teachers = getTeachersForInstrument(instrument);
            const resolvedTeacherId = Number(selectedTeacherId || 0) || null;
            const resolvedTeacher = resolvedTeacherId ? getTeacherCandidateById(resolvedTeacherId) : null;
            const fallbackTeacher = teachers.length === 1 ? teachers[0] : null;
            const lockedTeacher = lockTeacher || (!!fallbackTeacher && teachers.length === 1);
            const teacherIdToUse = resolvedTeacherId || Number(fallbackTeacher?.teacher_id || 0) || 0;
            const teacherNameToUse = getTeacherNameById(teacherIdToUse)
                || String(resolvedTeacher?.teacher_name || fallbackTeacher?.teacher_name || '').trim();

            if (lockedTeacher) {
                return `
                    <button
                        type="button"
                        onclick="event.stopPropagation(); selectAssignRequestTeacherForRow(${Number(rowIndex || 0)}, ${Number(teacherIdToUse || 0)})"
                        class="w-full rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-left transition hover:border-emerald-300 hover:bg-emerald-100"
                    >
                        <div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Fixed teacher</div>
                        <div class="mt-1 font-semibold text-slate-900">${escapeHtml(teacherNameToUse || 'Teacher')}</div>
                        <input
                            type="hidden"
                            class="assign-request-slot-teacher-id"
                            value="${escapeHtml(String(teacherIdToUse || ''))}"
                            data-teacher-name="${escapeHtml(teacherNameToUse || '')}"
                        >
                    </button>
                `;
            }

            const options = teachers.length
                ? teachers.map(teacher => {
                    const selected = Number(teacher.teacher_id) === Number(teacherIdToUse);
                    const label = teacher.specialization
                        ? `${teacher.teacher_name} • ${teacher.specialization}`
                        : teacher.teacher_name;
                    return `<option value="${Number(teacher.teacher_id)}"${selected ? ' selected' : ''}>${escapeHtml(label || 'Teacher')}</option>`;
                }).join('')
                : '<option value="">No matching teacher found</option>';
            return `
                <select class="assign-request-slot-teacher-select desk-modal-input">
                    <option value="">Select teacher...</option>
                    ${options}
                </select>
            `;
        }

        function updateAssignRequestRecurringSummary() {
            const summaryEl = document.getElementById('assignRequestRecurringSummary');
            if (!summaryEl) return;

            const slots = collectAssignRequestSlots();
            if (!slots.length) {
                summaryEl.textContent = 'Choose a specialist teacher, then set one or more one-hour slots. Those times will become reserved weekly for this student to avoid conflicts.';
                return;
            }

            const slotText = slots.map(slot => {
                const teacherName = getTeacherNameById(slot.teacher_id) || 'Teacher';
                const instrument = assignRequestInstruments.find(item => Number(item.instrument_id) === Number(slot.instrument_id));
                const instrumentName = instrument ? getInstrumentRowLabel(instrument, 0) : 'Instrument';
                return `${instrumentName} / ${teacherName}: ${slot.day_of_week}, ${formatTime12Hour(slot.start_time)} - ${formatTime12Hour(slot.end_time)}`;
            }).join('; ');
            summaryEl.textContent = `Reserved weekly on ${slotText}. Other students will no longer be offered these recurring slots.`;
        }

        function formatAssignRequestScheduleLabel(dayOfWeek, startTime, endTime) {
            const day = String(dayOfWeek || '').trim();
            const start = String(startTime || '').trim();
            const end = String(endTime || '').trim();
            if (!day || !start || !end) {
                return {
                    title: 'Choose from the calendar',
                    subtitle: 'Select a highlighted slot on the right to fill this row.'
                };
            }
            return {
                title: `${formatTime12Hour(start)} - ${formatTime12Hour(end)}`,
                subtitle: `${day} recurring`
            };
        }

        function updateAssignRequestRowScheduleDisplay(row) {
            if (!row) return;
            const dayEl = row.querySelector('.assign-request-slot-day');
            const startEl = row.querySelector('.assign-request-slot-start');
            const endEl = row.querySelector('.assign-request-slot-end');
            const titleEl = row.querySelector('.assign-request-slot-schedule-title');
            const subtitleEl = row.querySelector('.assign-request-slot-schedule-subtitle');
            const schedule = formatAssignRequestScheduleLabel(dayEl?.value || '', startEl?.value || '', endEl?.value || '');
            if (titleEl) titleEl.textContent = schedule.title;
            if (subtitleEl) subtitleEl.textContent = schedule.subtitle;
            row.dataset.scheduleSet = (dayEl?.value && startEl?.value && endEl?.value) ? '1' : '0';
        }

        function renderAssignRequestSlotRow(slot = {}, index = 0, options = {}) {
            const day = String(slot.day_of_week || '').trim();
            const start = String(slot.start_time || '').slice(0, 5);
            const end = String(slot.end_time || '').slice(0, 5);
            const teacherId = Number(slot.teacher_id || options.teacher_id || 0);
            const instrument = slot.instrument_id
                ? assignRequestInstruments.find(item => Number(item.instrument_id) === Number(slot.instrument_id)) || null
                : getAssignRequestInstrumentForIndex(index);
            const label = getInstrumentRowLabel(instrument, index);
            const teacherCandidates = getTeachersForInstrument(instrument);
            const teacherLocked = Boolean(options.lock_teacher || slot.lock_teacher || (teacherCandidates.length === 1));
            const removeLocked = Boolean(options.lock_remove || slot.lock_remove);
            const fixedRow = removeLocked;
            const schedule = formatAssignRequestScheduleLabel(day, start, end);
            return `
                <div class="assign-request-slot transition ${fixedRow ? 'border-gold-200 bg-amber-50/40' : (teacherLocked ? 'border-emerald-200 bg-emerald-50/30' : '')}" data-instrument-id="${instrument?.instrument_id || ''}" data-teacher-id="${teacherId || ''}" data-remove-locked="${removeLocked ? '1' : '0'}" data-teacher-locked="${teacherLocked ? '1' : '0'}">
                    <div class="assign-request-slot-header">
                        <div>
                            <div class="assign-request-field-caption">Instrument</div>
                            <div class="assign-request-slot-title">${escapeHtml(label)}</div>
                            ${fixedRow ? '<div class="assign-request-fixed-badge">Fixed instrument row</div>' : ''}
                        </div>
                        ${removeLocked ? '' : '<button type="button" class="assign-request-slot-remove assign-request-slot-trash" aria-label="Remove slot"><i class="fas fa-trash-can"></i></button>'}
                    </div>
                    <input type="hidden" class="assign-request-slot-instrument" value="${escapeHtml(String(instrument?.instrument_id || slot.instrument_id || ''))}">
                    <input type="hidden" class="assign-request-slot-day" value="${escapeHtml(day)}">
                    <input type="hidden" class="assign-request-slot-start" value="${escapeHtml(start)}">
                    <input type="hidden" class="assign-request-slot-end" value="${escapeHtml(end)}">
                    <div class="assign-request-slot-fields">
                        <div class="assign-request-slot-field">
                            <label class="desk-modal-label">Teacher</label>
                            ${renderTeacherControlForInstrument(instrument, teacherId, teacherLocked, index)}
                        </div>
                        <div class="assign-request-slot-field">
                            <label class="desk-modal-label">Schedule</label>
                            <div class="assign-request-slot-schedule">
                                <div class="assign-request-slot-schedule-title">${escapeHtml(schedule.title)}</div>
                                <div class="assign-request-slot-schedule-subtitle">${escapeHtml(schedule.subtitle)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        function setActiveAssignRequestSlot(row) {
            const rows = Array.from(document.querySelectorAll('#assignRequestSlotsContainer .assign-request-slot'));
            const nextActive = row && rows.includes(row) ? row : (rows[0] || null);
            activeAssignRequestSlotRow = nextActive;
            rows.forEach(item => {
                const isActive = item === nextActive;
                item.classList.toggle('border-gold-400', isActive);
                item.classList.toggle('bg-gold-50', isActive);
                item.classList.toggle('shadow-sm', isActive);
                item.classList.toggle('border-slate-200', !isActive);
                item.classList.toggle('bg-white', !isActive);
            });
        }

        function openPendingRequestPaymentModal(requestId) {
            const req = pendingRequestsById[String(requestId)];
            if (!req) {
                showMessage('Payment details not found.', 'error');
                return;
            }

            const paymentType = escapeHtml(req.payment_type || 'Partial Payment');
            const paymentMethod = escapeHtml(req.payment_method || '—');
            const payableNow = Number(req.payable_now || 0);
            const packageAmount = Number(req.requested_amount || req.package_price || 0);
            const proofHtml = req.payment_proof_path
                ? `<a href="${escapeHtml(buildPublicFileUrl(req.payment_proof_path))}" target="_blank" rel="noopener" class="text-sm text-blue-600 underline">View payment proof</a>`
                : '<span class="text-sm text-slate-500">No payment proof uploaded</span>';

            Swal.fire({
                title: 'Payment Details',
                width: 620,
                confirmButtonText: 'Close',
                html: `
                    <div class="text-left space-y-4 text-sm text-slate-700">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div><span class="font-semibold text-slate-900">Payment Type:</span> ${paymentType}</div>
                            <div><span class="font-semibold text-slate-900">Payment Method:</span> ${paymentMethod}</div>
                            <div><span class="font-semibold text-slate-900">Pay Now:</span> ${formatCurrencyPHP(payableNow)}</div>
                            <div><span class="font-semibold text-slate-900">Package Amount:</span> ${formatCurrencyPHP(packageAmount)}</div>
                        </div>
                        <div><span class="font-semibold text-slate-900">Proof of Payment:</span> ${proofHtml}</div>
                    </div>
                `
            });
        }

        function bindAssignRequestSlotFocusHandlers() {
            document.querySelectorAll('#assignRequestSlotsContainer .assign-request-slot').forEach(row => {
                if (row.dataset.bound === '1') return;
                row.dataset.bound = '1';
                row.addEventListener('click', () => setActiveAssignRequestSlot(row));
                row.addEventListener('focusin', () => setActiveAssignRequestSlot(row));
                row.querySelectorAll('select,input').forEach(input => input.addEventListener('change', () => {
                    if (input.classList.contains('assign-request-slot-teacher-select') || input.classList.contains('assign-request-slot-teacher-id')) {
                        setActiveAssignRequestSlot(row);
                    }
                    updateAssignRequestRowScheduleDisplay(row);
                    updateAssignRequestRecurringSummary();
                    if (input.classList.contains('assign-request-slot-teacher-select') || input.classList.contains('assign-request-slot-teacher-id')) {
                        queueLoadAssignRequestAvailability();
                    } else {
                        renderAssignRequestAvailability(assignRequestAvailabilitySlots, assignRequestAvailabilitySelectedDate);
                    }
                }));
            });
        }

        function bindAssignRequestSlotRemoveHandlers() {
            document.querySelectorAll('.assign-request-slot-remove').forEach(button => {
                if (button.dataset.bound === '1') return;
                button.dataset.bound = '1';
                button.addEventListener('click', () => {
                    const container = document.getElementById('assignRequestSlotsContainer');
                    const row = button.closest('.assign-request-slot');
                    if (!container || !row) return;
                    if (container.children.length <= 1 || row.dataset.removeLocked === '1') {
                        showMessage('At least one weekly slot is required.', 'error');
                        return;
                    }
                    const wasActive = activeAssignRequestSlotRow === row;
                    row.remove();
                    if (wasActive) setActiveAssignRequestSlot(container.querySelector('.assign-request-slot'));
                    updateAssignRequestRecurringSummary();
                    renderAssignRequestAvailability(assignRequestAvailabilitySlots, assignRequestAvailabilitySelectedDate);
                });
            });
        }

        function addAssignRequestSlot(slot = {}) {
            const container = document.getElementById('assignRequestSlotsContainer');
            if (!container) return;
            const index = container.querySelectorAll('.assign-request-slot').length;
            const activeRow = activeAssignRequestSlotRow && container.contains(activeAssignRequestSlotRow) ? activeAssignRequestSlotRow : null;
            const activeRowInstrumentId = Number(activeRow?.querySelector('.assign-request-slot-instrument')?.value || activeRow?.dataset.instrumentId || 0) || null;
            const activeRowTeacherId = getAssignRequestRowTeacherId(activeRow);
            const instrument = slot.instrument_id
                ? assignRequestInstruments.find(item => Number(item.instrument_id) === Number(slot.instrument_id)) || null
                : (activeRowInstrumentId ? assignRequestInstruments.find(item => Number(item.instrument_id) === Number(activeRowInstrumentId)) || null : getAssignRequestInstrumentForIndex(index));
            const teacherCandidates = getTeachersForInstrument(instrument);
            const teacherId = Number(slot.teacher_id || activeRowTeacherId || (teacherCandidates.length === 1 ? teacherCandidates[0]?.teacher_id : 0) || 0) || null;
            const teacherLocked = Boolean(slot.lock_teacher || (teacherCandidates.length === 1));
            container.insertAdjacentHTML('beforeend', renderAssignRequestSlotRow({
                instrument_id: instrument?.instrument_id || slot.instrument_id || null,
                teacher_id: teacherId,
                day_of_week: slot.day_of_week || '',
                start_time: slot.start_time || '',
                end_time: slot.end_time || '',
                lock_teacher: teacherLocked,
                lock_remove: Boolean(slot.lock_remove)
            }, index, {
                lock_teacher: teacherLocked,
                lock_remove: Boolean(slot.lock_remove)
            }));
            bindAssignRequestSlotFocusHandlers();
            bindAssignRequestSlotRemoveHandlers();
            const insertedRow = container.lastElementChild;
            if (!activeAssignRequestSlotRow || !container.contains(activeAssignRequestSlotRow)) {
                setActiveAssignRequestSlot(insertedRow);
            } else {
                setActiveAssignRequestSlot(activeAssignRequestSlotRow);
            }
            updateAssignRequestRowScheduleDisplay(container.lastElementChild);
            updateAssignRequestRecurringSummary();
        }

        function collectAssignRequestSlots() {
            const rows = Array.from(document.querySelectorAll('#assignRequestSlotsContainer .assign-request-slot'));
            return rows.map(row => ({
                instrument_id: Number(row.querySelector('.assign-request-slot-instrument')?.value || row.dataset.instrumentId || 0) || null,
                teacher_id: getAssignRequestRowTeacherId(row),
                day_of_week: row.querySelector('.assign-request-slot-day')?.value || '',
                start_time: row.querySelector('.assign-request-slot-start')?.value || '',
                end_time: row.querySelector('.assign-request-slot-end')?.value || ''
            })).filter(slot => slot.teacher_id && slot.day_of_week && slot.start_time && slot.end_time);
        }

        function getActiveAssignRequestSlotData() {
            return getAssignRequestRowData(activeAssignRequestSlotRow);
        }

        function getLockedAssignRequestDays() {
            const rows = Array.from(document.querySelectorAll('#assignRequestSlotsContainer .assign-request-slot'));
            return new Set(rows
                .filter(row => row !== activeAssignRequestSlotRow)
                .map(row => row.querySelector('.assign-request-slot-day')?.value || '')
                .filter(Boolean));
        }

        function setAssignRequestTeacherSelection(teacherId) {
            const selected = getTeacherCandidateById(teacherId);
            const container = document.getElementById('assignRequestSlotsContainer');
            const row = activeAssignRequestSlotRow && container?.contains(activeAssignRequestSlotRow)
                ? activeAssignRequestSlotRow
                : container?.querySelector('.assign-request-slot');
            if (row && selected) {
                const hiddenInput = row.querySelector('.assign-request-slot-teacher-id');
                const selectInput = row.querySelector('.assign-request-slot-teacher-select');
                if (hiddenInput) {
                    hiddenInput.value = String(selected.teacher_id);
                    hiddenInput.dataset.teacherName = selected.teacher_name || '';
                }
                if (selectInput) {
                    selectInput.value = String(selected.teacher_id);
                }
                row.dataset.teacherId = String(selected.teacher_id);
            }
            if (selected) {
                updateAssignRequestRecurringSummary();
            }
            void loadAssignRequestAvailability();
        }

        function selectAssignRequestTeacherForRow(rowIndex, teacherId) {
            const container = document.getElementById('assignRequestSlotsContainer');
            const rows = Array.from(container?.querySelectorAll('.assign-request-slot') || []);
            const row = rows[Number(rowIndex || 0)] || null;
            if (row) {
                setActiveAssignRequestSlot(row);
                const selectInput = row.querySelector('.assign-request-slot-teacher-select');
                const hiddenInput = row.querySelector('.assign-request-slot-teacher-id');
                if (selectInput) selectInput.value = String(teacherId || '');
                if (hiddenInput) {
                    const candidate = getTeacherCandidateById(teacherId);
                    hiddenInput.value = String(teacherId || '');
                    hiddenInput.dataset.teacherName = candidate?.teacher_name || hiddenInput.dataset.teacherName || '';
                }
                row.dataset.teacherId = String(teacherId || '');
                updateAssignRequestRowScheduleDisplay(row);
                updateAssignRequestRecurringSummary();
            }
            setAssignRequestTeacherSelection(teacherId);
        }

        function renderAssignRequestTeacherSuggestions(query = '') {
            const suggestionsEl = document.getElementById('assignRequestTeacherSuggestions');
            if (!suggestionsEl) return;
            const q = String(query || '').trim().toLowerCase();
            const rows = assignRequestTeacherCandidates.filter(t => {
                const teacherName = String(t.teacher_name || '').toLowerCase();
                const specialization = String(t.specialization || '').toLowerCase();
                return !q || teacherName.includes(q) || specialization.includes(q);
            });
            if (!rows.length) {
                suggestionsEl.innerHTML = '<div class="px-4 py-3 text-sm text-slate-500">No matching instrument-focused instructors found.</div>';
                suggestionsEl.classList.remove('hidden');
                return;
            }
            suggestionsEl.innerHTML = rows.map(teacher => `
                <button type="button" class="w-full text-left px-4 py-3 hover:bg-slate-50 transition border-b border-slate-100 last:border-b-0" onclick="setAssignRequestTeacherSelection(${Number(teacher.teacher_id)})">
                    <div class="text-sm font-semibold text-slate-900">${escapeHtml(teacher.teacher_name || 'Teacher')}</div>
                    <div class="text-xs text-slate-500 mt-1">${escapeHtml(teacher.specialization || 'General')}</div>
                </button>
            `).join('');
            suggestionsEl.classList.remove('hidden');
        }

        function initAssignTeacherSearchBox() {
            const searchInput = document.getElementById('assignRequestTeacherSearch');
            const suggestionsEl = document.getElementById('assignRequestTeacherSuggestions');
            if (!searchInput || !suggestionsEl) return;
            searchInput.addEventListener('focus', () => renderAssignRequestTeacherSuggestions(searchInput.value || ''));
            searchInput.addEventListener('input', () => renderAssignRequestTeacherSuggestions(searchInput.value || ''));
            document.addEventListener('click', (event) => {
                const withinSearch = event.target.closest('#assignRequestTeacherSuggestions') || event.target.closest('#assignRequestTeacherSearch');
                if (!withinSearch) suggestionsEl.classList.add('hidden');
            });
        }

        function formatAssignAvailabilityMonthLabel(monthKey) {
            if (!monthKey) return '';
            const parts = String(monthKey).split('-');
            if (parts.length !== 2) return monthKey;
            const year = Number(parts[0]);
            const month = Number(parts[1]);
            const dt = new Date(year, month - 1, 1);
            return Number.isNaN(dt.getTime())
                ? monthKey
                : dt.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        }

        function shiftAssignAvailabilityMonth(monthKey, delta) {
            const parts = String(monthKey || '').split('-');
            const year = Number(parts[0] || 0);
            const month = Number(parts[1] || 0);
            const base = !Number.isNaN(year) && !Number.isNaN(month) && month >= 1 && month <= 12
                ? new Date(year, month - 1, 1)
                : new Date();
            base.setMonth(base.getMonth() + delta);
            return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
        }

        function setAssignRequestAvailabilityMonth(monthKey) {
            assignRequestAvailabilityMonth = monthKey || '';
            renderAssignRequestAvailability(assignRequestAvailabilitySlots, assignRequestAvailabilitySelectedDate);
        }

        function selectAssignRequestAvailabilityDate(dateKey) {
            assignRequestAvailabilitySelectedDate = dateKey || '';
            renderAssignRequestAvailability(assignRequestAvailabilitySlots, assignRequestAvailabilitySelectedDate);
        }

        function formatAssignRequestSessionLabel(session) {
            const sessionNumber = Number(session?.session_number || 0);
            const numberLabel = sessionNumber > 0 ? `Session ${sessionNumber}` : 'Session';
            const timeLabel = `${formatTime12Hour(session?.start_time)} - ${formatTime12Hour(session?.end_time)}`;
            return `${numberLabel} • ${timeLabel}`;
        }

        function renderAssignRequestAvailability(slots, selectedDate = '') {
            const listEl = document.getElementById('assignRequestAvailabilityList');
            const hintEl = document.getElementById('assignRequestAvailabilityHint');
            const slotSelect = document.getElementById('assignRequestAvailableSlotSelect');
            const slotHint = document.getElementById('assignRequestAvailableSlotHint');
            if (!listEl || !hintEl) return;

            assignRequestAvailabilitySlots = Array.isArray(slots) ? slots.slice() : [];
            if (selectedDate) {
                assignRequestAvailabilitySelectedDate = selectedDate;
            }

            const bookedGrouped = {};
            (Array.isArray(assignRequestBookedSessions) ? assignRequestBookedSessions : []).forEach((session) => {
                const dateKey = String(session.session_date || '').trim();
                if (!dateKey) return;
                if (!bookedGrouped[dateKey]) bookedGrouped[dateKey] = [];
                bookedGrouped[dateKey].push(session);
            });

            const hasAnyBookedSessions = Object.keys(bookedGrouped).length > 0;
            if ((!Array.isArray(slots) || !slots.length) && !hasAnyBookedSessions) {
                assignRequestAvailabilityMonth = '';
                assignRequestAvailabilitySelectedDate = '';
                hintEl.textContent = 'No conflict-free recurring one-hour slots were found for the selected instructor and date range.';
                listEl.innerHTML = '<div class="text-sm text-slate-500">No available slots found.</div>';
                if (slotSelect) {
                    slotSelect.innerHTML = '<option value="">No available slots found</option>';
                    slotSelect.disabled = true;
                }
                if (slotHint) {
                    slotHint.textContent = 'The selected instructor has no valid one-hour slots for this date range.';
                }
                return;
            }

            const grouped = {};
            slots.forEach((slot) => {
                const dateKey = String(slot.session_date || '').trim();
                if (!dateKey) return;
                if (!grouped[dateKey]) grouped[dateKey] = [];
                grouped[dateKey].push(slot);
            });

            const availableDates = Object.keys(grouped).sort();
            const bookedDates = Object.keys(bookedGrouped).sort();
            const resolvedSelectedDate = grouped[assignRequestAvailabilitySelectedDate]
                ? assignRequestAvailabilitySelectedDate
                : (availableDates.includes(selectedDate) ? selectedDate : availableDates[0] || bookedDates[0] || selectedDate);
            assignRequestAvailabilitySelectedDate = resolvedSelectedDate;

            const monthSource = assignRequestAvailabilityMonth || resolvedSelectedDate || availableDates[0] || bookedDates[0];
            const monthParts = String(monthSource).slice(0, 7).split('-');
            const monthDate = new Date(Number(monthParts[0]), Number(monthParts[1]) - 1, 1);
            if (Number.isNaN(monthDate.getTime())) {
                listEl.innerHTML = '<div class="text-sm text-slate-500">No sessions found.</div>';
                return;
            }
            const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
            assignRequestAvailabilityMonth = monthKey;

            hintEl.textContent = 'Pick a highlighted date, then choose a recurring one-hour slot to fill the weekly assignment.';

            const firstWeekday = monthDate.getDay();
            const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
            const cells = [];
            for (let i = 0; i < firstWeekday; i += 1) {
                cells.push('<div class="h-16 rounded-sm border border-transparent bg-transparent"></div>');
            }
            for (let day = 1; day <= daysInMonth; day += 1) {
                const dateKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const daySlots = grouped[dateKey] || [];
                const dayBooked = bookedGrouped[dateKey] || [];
                const isSelected = dateKey === resolvedSelectedDate;
                const hasSlots = daySlots.length > 0;
                const hasBooked = dayBooked.length > 0;
                const baseClass = hasSlots
                    ? (isSelected ? 'border-gold-400 bg-gold-50 shadow-sm' : 'border-emerald-200 bg-white hover:border-emerald-300 hover:bg-emerald-50')
                    : (hasBooked
                        ? (isSelected ? 'border-amber-400 bg-amber-50 shadow-sm' : 'border-amber-200 bg-white hover:border-amber-300 hover:bg-amber-50')
                        : 'border-slate-200 bg-slate-50 text-slate-300');
                cells.push(`
                    <button
                        type="button"
                        ${hasSlots || hasBooked ? `onclick="selectAssignRequestAvailabilityDate('${dateKey}')"` : 'disabled'}
                        class="h-16 rounded-sm border p-1.5 text-left text-xs transition ${baseClass} ${(hasSlots || hasBooked) ? '' : 'cursor-not-allowed'}"
                    >
                        <div class="flex items-start justify-between gap-2">
                            <span class="text-sm font-semibold ${hasSlots || hasBooked ? 'text-slate-900' : 'text-slate-400'}">${day}</span>
                            <div class="flex flex-col items-end gap-1">
                                ${hasSlots ? `<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">${daySlots.length} slot${daySlots.length > 1 ? 's' : ''}</span>` : ''}
                                ${hasBooked ? `<span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">${dayBooked.length} booked</span>` : ''}
                            </div>
                        </div>
                        <div class="mt-2 text-[11px] ${hasSlots || hasBooked ? 'text-slate-500' : 'text-slate-400'}">${hasSlots ? `${escapeHtml(daySlots[0].day_of_week || '')} recurring` : (hasBooked ? 'Already enrolled' : 'Unavailable')}</div>
                    </button>
                `);
            }

            const selectedSlots = grouped[resolvedSelectedDate] || [];
            const selectedBookedSessions = bookedGrouped[resolvedSelectedDate] || [];
            const lockedDays = getLockedAssignRequestDays();
            const activeSlot = getActiveAssignRequestSlotData();
            listEl.innerHTML = `
                <div class="space-y-4">
                    <div class="flex items-center justify-between gap-3">
                        <button type="button" onclick="setAssignRequestAvailabilityMonth('${shiftAssignAvailabilityMonth(monthKey, -1)}')" class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                            <i class="fas fa-chevron-left mr-2 text-[10px]"></i>Prev
                        </button>
                        <div class="text-sm font-semibold text-slate-900">${escapeHtml(formatAssignAvailabilityMonthLabel(monthKey))}</div>
                        <button type="button" onclick="setAssignRequestAvailabilityMonth('${shiftAssignAvailabilityMonth(monthKey, 1)}')" class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                            Next<i class="fas fa-chevron-right ml-2 text-[10px]"></i>
                        </button>
                    </div>
                    <div class="grid grid-cols-7 gap-2 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                    </div>
                    <div class="grid grid-cols-7 gap-2">
                        ${cells.join('')}
                    </div>
                    <div class="border border-slate-200 rounded-sm bg-white p-2">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <div class="text-sm font-semibold text-slate-900">${escapeHtml(formatDateLong(resolvedSelectedDate) || resolvedSelectedDate)}</div>
                                <div class="text-xs text-slate-500 mt-1">${selectedSlots.length ? `${selectedSlots.length} recurring slot${selectedSlots.length > 1 ? 's' : ''}` : 'No available slots on this date.'}</div>
                            </div>
                        </div>
                        ${selectedBookedSessions.length ? `
                            <div class="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
                                <div class="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">Already Enrolled</div>
                                <div class="mt-2 space-y-2">
                                    ${selectedBookedSessions.map(session => `
                                        <div class="rounded-xl border border-amber-100 bg-white px-3 py-2">
                                            <div class="text-sm font-semibold text-slate-900">${escapeHtml(formatAssignRequestSessionLabel(session))}</div>
                                            <div class="mt-1 text-xs text-slate-500">
                                                ${escapeHtml(session.package_name || '')}${session.teacher_name ? ` • ${escapeHtml(session.teacher_name)}` : ''}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            ${selectedSlots.map(slot => {
                                const slotDay = String(slot.day_of_week || '');
                                const slotStart = String(slot.start_time || '').slice(0, 5);
                                const slotEnd = String(slot.end_time || '').slice(0, 5);
                                const isActiveMatch = activeSlot
                                    && activeSlot.day_of_week === slotDay
                                    && String(activeSlot.start_time || '').slice(0, 5) === slotStart
                                    && String(activeSlot.end_time || '').slice(0, 5) === slotEnd;
                                const isLocked = lockedDays.has(slotDay) || (activeSlot?.day_of_week === slotDay && !isActiveMatch);
                                return `
                                <button
                                    type="button"
                                    ${isLocked ? 'disabled' : `onclick="applyAssignRequestAvailabilitySlot('${escapeHtml(String(slot.session_date || ''))}','${escapeHtml(String(slot.day_of_week || ''))}','${escapeHtml(String(slot.start_time || ''))}','${escapeHtml(String(slot.end_time || ''))}')"`}
                                    class="rounded-sm border px-2 py-2 text-left text-xs transition ${isLocked ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-70' : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'}"
                                >
                                    <div class="text-sm font-semibold ${isLocked ? 'text-slate-500' : 'text-emerald-800'}">${escapeHtml(`${formatTime12Hour(slot.start_time)} - ${formatTime12Hour(slot.end_time)}`)}</div>
                                    <div class="mt-1 text-xs ${isLocked ? 'text-slate-400' : 'text-slate-500'}">${escapeHtml(slot.day_of_week || '')} • ${isLocked ? 'Locked by current selection' : 'Weekly recurring'}</div>
                                </button>
                            `;
                            }).join('') || '<div class="text-sm text-slate-500">No available slots on this date.</div>'}
                        </div>
                    </div>
                </div>
            `;

            if (slotSelect) {
                const currentValue = String(slotSelect.value || '');
                const activeValue = activeSlot
                    ? buildAssignRequestSlotValue({
                        session_date: resolvedSelectedDate,
                        day_of_week: activeSlot.day_of_week,
                        start_time: activeSlot.start_time,
                        end_time: activeSlot.end_time
                    })
                    : '';
                slotSelect.disabled = !selectedSlots.length;
                slotSelect.innerHTML = selectedSlots.length
                    ? '<option value="">Select a slot for the selected day...</option>' + selectedSlots.map(slot => {
                        const value = buildAssignRequestSlotValue(slot);
                        const label = `${formatDateLong(slot.session_date) || slot.session_date} • ${slot.day_of_week || 'Day'} • ${formatTime12Hour(slot.start_time)} - ${formatTime12Hour(slot.end_time)}`;
                        return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
                    }).join('')
                    : '<option value="">No available slots on this date</option>';
                slotSelect.value = activeValue && selectedSlots.some(slot => buildAssignRequestSlotValue(slot) === activeValue)
                    ? activeValue
                    : (selectedSlots.some(slot => buildAssignRequestSlotValue(slot) === currentValue) ? currentValue : '');
                if (slotHint) {
                    slotHint.textContent = selectedSlots.length
                        ? 'Pick a date, then choose one valid one-hour slot from the dropdown to populate the active weekly slot row.'
                        : 'No valid slots are available on the selected date.';
                }
            }
        }

        function applyAssignRequestAvailabilitySlot(sessionDate, dayOfWeek, startTime, endTime) {
            const dateEl = document.getElementById('assignRequestDate');
            const slotSelect = document.getElementById('assignRequestAvailableSlotSelect');
            if (dateEl) dateEl.value = sessionDate || '';
            const container = document.getElementById('assignRequestSlotsContainer');
            const targetRow = getAssignableAssignRequestSlotRow();
            if (targetRow) {
                const dayEl = targetRow.querySelector('.assign-request-slot-day');
                const startEl = targetRow.querySelector('.assign-request-slot-start');
                const endEl = targetRow.querySelector('.assign-request-slot-end');
                if (dayEl) dayEl.value = dayOfWeek || getDayNameFromDate(sessionDate || '');
                if (startEl) startEl.value = String(startTime || '').slice(0, 5);
                if (endEl) endEl.value = String(endTime || '').slice(0, 5);
                updateAssignRequestRowScheduleDisplay(targetRow);
                setActiveAssignRequestSlot(targetRow);
            }
            if (slotSelect) {
                slotSelect.value = buildAssignRequestSlotValue({
                    session_date: sessionDate || '',
                    day_of_week: dayOfWeek || '',
                    start_time: String(startTime || '').slice(0, 5),
                    end_time: String(endTime || '').slice(0, 5)
                });
            }
            updateAssignRequestRecurringSummary();
            renderAssignRequestAvailability(assignRequestAvailabilitySlots, assignRequestAvailabilitySelectedDate || sessionDate || '');
        }

        function getAssignRequestAvailabilityCacheKey(teacherId, startDate) {
            return [
                Number(teacherId || 0),
                Number(activeAssignRequest?.branch_id || managerBranchId || 0),
                Number(activeAssignRequest?.student_id || 0),
                String(startDate || ''),
                '180'
            ].join('|');
        }

        function queueLoadAssignRequestAvailability() {
            if (assignRequestAvailabilityLoadTimer) {
                clearTimeout(assignRequestAvailabilityLoadTimer);
            }
            assignRequestAvailabilityLoadTimer = setTimeout(() => {
                assignRequestAvailabilityLoadTimer = null;
                loadAssignRequestAvailability();
            }, 180);
        }

        async function loadAssignRequestAvailability() {
            const listEl = document.getElementById('assignRequestAvailabilityList');
            const hintEl = document.getElementById('assignRequestAvailabilityHint');
            const slotSelect = document.getElementById('assignRequestAvailableSlotSelect');
            const startDate = document.getElementById('assignRequestDate')?.value || '';
            const activeRow = getAssignableAssignRequestSlotRow();
            const activeSlotData = getAssignRequestRowData(activeRow);
            const teacherId = Number(activeSlotData?.teacher_id || 0);
            const activeRowTeacherLabel = activeRow ? getAssignRequestRowTeacherName(activeRow) : '';
            if (!listEl || !hintEl) return;

            if (!activeAssignRequest || !teacherId) {
                assignRequestAvailabilitySlots = [];
                assignRequestBookedSessions = [];
                assignRequestAvailabilityMonth = '';
                assignRequestAvailabilitySelectedDate = '';
                hintEl.textContent = activeAssignRequest
                    ? 'Choose a teacher in the selected instrument row to see available one-hour slots.'
                    : 'Open a student request first.';
                listEl.innerHTML = '<div class="text-sm text-slate-500">No teacher selected yet.</div>';
                if (slotSelect) {
                    slotSelect.innerHTML = '<option value="">Choose a date first</option>';
                    slotSelect.disabled = true;
                }
                return;
            }

            const cacheKey = getAssignRequestAvailabilityCacheKey(teacherId, startDate);
            const cachedSlots = assignRequestAvailabilityCache.get(cacheKey);
            if (cachedSlots) {
                assignRequestAvailabilitySlots = Array.isArray(cachedSlots.slots) ? cachedSlots.slots : [];
                assignRequestBookedSessions = Array.isArray(cachedSlots.booked_sessions) ? cachedSlots.booked_sessions : [];
                hintEl.textContent = activeRowTeacherLabel
                    ? `Showing available one-hour slots for ${activeRowTeacherLabel}.`
                    : 'Showing available one-hour slots for the selected teacher.';
                renderAssignRequestAvailability(assignRequestAvailabilitySlots, startDate);
                return;
            }

            listEl.innerHTML = '<div class="text-sm text-slate-500">Loading available slots...</div>';
            hintEl.textContent = activeRowTeacherLabel
                ? `Loading available one-hour slots for ${activeRowTeacherLabel}.`
                : 'Loading available one-hour slots for the selected teacher.';

            const requestToken = ++assignRequestAvailabilityRequestToken;
            try {
                let url = `${baseApiUrl}/students.php?action=get-teacher-available-slots&teacher_id=${encodeURIComponent(teacherId)}&branch_id=${encodeURIComponent(activeAssignRequest.branch_id || managerBranchId || 0)}&student_id=${encodeURIComponent(activeAssignRequest.student_id || 0)}&days_ahead=60`;
                if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
                const response = await axios.get(url);
                if (requestToken !== assignRequestAvailabilityRequestToken) return;
                const data = response.data || {};
                if (activeRowTeacherLabel) {
                    hintEl.textContent = `Showing available one-hour slots for ${activeRowTeacherLabel}.`;
                }
                const slots = Array.isArray(data.slots) ? data.slots : [];
                const bookedSessions = Array.isArray(data.booked_sessions) ? data.booked_sessions : [];
                assignRequestAvailabilitySlots = slots;
                assignRequestBookedSessions = bookedSessions;
                assignRequestAvailabilityCache.set(cacheKey, { slots, booked_sessions: bookedSessions });
                renderAssignRequestAvailability(slots, startDate);
            } catch (error) {
                if (requestToken !== assignRequestAvailabilityRequestToken) return;
                hintEl.textContent = 'Unable to load instructor availability right now.';
                listEl.innerHTML = '<div class="text-sm text-red-500">Failed to load available slots.</div>';
                if (slotSelect) {
                    slotSelect.innerHTML = '<option value="">Failed to load slots</option>';
                    slotSelect.disabled = true;
                }
            }
        }

        async function openAssignRequestModal(requestId) {
            const req = pendingRequestsById[String(requestId)];
            if (!req) {
                showMessage('Request not found.', 'error');
                return;
            }

            const modal = document.getElementById('assignRequestModal');
            const info = document.getElementById('assignRequestStudentInfo');
            const requestIdEl = document.getElementById('assignRequestId');
            const studentNameEl = document.getElementById('assignRequestStudentName');
            const studentBranchEl = document.getElementById('assignRequestStudentBranch');
            const studentPackageEl = document.getElementById('assignRequestStudentPackage');
            const studentInstrumentEl = document.getElementById('assignRequestStudentInstrument');
            const dateEl = document.getElementById('assignRequestDate');
            const slotsContainer = document.getElementById('assignRequestSlotsContainer');
            const notesEl = document.getElementById('assignRequestNotes');

            if (!modal || !info || !requestIdEl || !dateEl || !slotsContainer || !notesEl) return;

            const studentName = `${req.first_name || ''} ${req.last_name || ''}`.trim();
            const instrumentSummary = Array.isArray(req.instruments) && req.instruments.length
                ? req.instruments.map(i => {
                    const instrumentName = escapeHtml(i.instrument_name || 'Instrument');
                    const typeName = escapeHtml(i.type_name || '');
                    return typeName ? `${instrumentName} (${typeName})` : instrumentName;
                }).join(', ')
                : '—';
            info.textContent = 'Assign a schedule based on instructor availability.';
            if (studentNameEl) studentNameEl.textContent = studentName || 'Student';
            if (studentBranchEl) studentBranchEl.textContent = req.branch_name || 'No branch';
            if (studentPackageEl) studentPackageEl.textContent = req.package_name || 'Package';
            if (studentInstrumentEl) studentInstrumentEl.innerHTML = instrumentSummary;
            requestIdEl.value = String(requestId);
            activeAssignRequest = req;
            assignRequestAvailabilitySlots = [];
            assignRequestAvailabilityMonth = '';
            assignRequestAvailabilitySelectedDate = '';

            assignRequestTeacherCandidates = Array.isArray(req.teacher_candidates) ? req.teacher_candidates : [];
            assignRequestInstruments = Array.isArray(req.instruments) ? req.instruments.slice() : [];
            assignRequestAvailabilityCache.clear();
            assignRequestAvailabilityRequestToken += 1;
            if (assignRequestAvailabilityLoadTimer) {
                clearTimeout(assignRequestAvailabilityLoadTimer);
                assignRequestAvailabilityLoadTimer = null;
            }

            const todayYmd = new Date(Date.now() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
            dateEl.min = todayYmd;
            dateEl.value = '';
            slotsContainer.innerHTML = '';
            activeAssignRequestSlotRow = null;
            const initialSlotCount = Math.max(1, assignRequestInstruments.length || 0);
            for (let i = 0; i < initialSlotCount; i += 1) {
                const instrument = assignRequestInstruments[i] || null;
                const teacherCandidates = getTeachersForInstrument(instrument);
                const teacherId = teacherCandidates.length === 1 ? Number(teacherCandidates[0]?.teacher_id || 0) || null : '';
                const isSingleFixedRow = assignRequestInstruments.length === 1 && teacherCandidates.length === 1;
                addAssignRequestSlot({
                    instrument_id: instrument?.instrument_id || null,
                    teacher_id: teacherId,
                    day_of_week: '',
                    start_time: '',
                    end_time: '',
                    lock_teacher: teacherCandidates.length === 1,
                    lock_remove: isSingleFixedRow
                });
            }
            const firstRow = slotsContainer.querySelector('.assign-request-slot');
            if (firstRow) {
                setActiveAssignRequestSlot(firstRow);
            }
            notesEl.value = '';
            updateAssignRequestRecurringSummary();

            modal.classList.remove('hidden');
            modal.classList.add('flex');
            void loadAssignRequestAvailability();
        }

        function closeAssignRequestModal() {
            const modal = document.getElementById('assignRequestModal');
            if (!modal) return;
            activeAssignRequest = null;
            assignRequestInstruments = [];
            assignRequestAvailabilitySlots = [];
            assignRequestBookedSessions = [];
            assignRequestAvailabilityMonth = '';
            assignRequestAvailabilitySelectedDate = '';
            assignRequestAvailabilityCache.clear();
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }

        async function approveStudentRequest(payload) {
            try {
                const response = await axios.post(`${baseApiUrl}/students.php`, payload);
                const data = response.data;
                if (data.success) {
                    closeAssignRequestModal();
                    showMessage(data.message || 'Request approved.', 'success');
                    loadPendingRequests();
                    loadActiveStudents();
                } else {
                    showMessage(data.error || 'Failed to approve request.', 'error');
                }
            } catch (error) {
                showMessage('Network error while approving request.', 'error');
            }
        }

        async function submitAssignRequestForm(e) {
            e.preventDefault();
            const requestId = Number(document.getElementById('assignRequestId')?.value || 0);
            const assignedDate = document.getElementById('assignRequestDate')?.value || '';
            const todayYmd = new Date(Date.now() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
            const slotRows = Array.from(document.querySelectorAll('#assignRequestSlotsContainer .assign-request-slot'));
            const invalidRow = slotRows.find(row => {
                const teacherId = Number(getAssignRequestRowTeacherId(row) || 0);
                const day = String(row.querySelector('.assign-request-slot-day')?.value || '').trim();
                const startTime = String(row.querySelector('.assign-request-slot-start')?.value || '').trim();
                const endTime = String(row.querySelector('.assign-request-slot-end')?.value || '').trim();
                return !teacherId || !day || !startTime || !endTime;
            });
            const assignedSlots = collectAssignRequestSlots();
            const adminNotes = document.getElementById('assignRequestNotes')?.value?.trim() || '';

            if (!requestId || !assignedDate || !assignedSlots.length) {
                showMessage('Please complete the date and at least one teacher slot.', 'error');
                return;
            }
            if (invalidRow) {
                showMessage('Each instrument row needs a teacher, day, start, and end time.', 'error');
                return;
            }
            if (assignedDate < todayYmd) {
                showMessage('Past dates are not allowed for enrollment scheduling.', 'error');
                return;
            }
            const invalidSlot = assignedSlots.find(slot => {
                const startMinutes = getTimeMinutes(slot.start_time);
                const endMinutes = getTimeMinutes(slot.end_time);
                return !slot.day_of_week || !slot.start_time || !slot.end_time || startMinutes >= endMinutes || (endMinutes - startMinutes) !== 60;
            });
            if (invalidSlot) {
                showMessage('Each weekly slot needs a valid day and must be exactly 1 hour.', 'error');
                return;
            }
            const primarySlot = assignedSlots[0];

            await approveStudentRequest({
                action: 'approve-package-request',
                request_id: requestId,
                teacher_id: Number(primarySlot.teacher_id || 0),
                assigned_date: assignedDate,
                assigned_day_of_week: primarySlot.day_of_week,
                assigned_start_time: primarySlot.start_time,
                assigned_end_time: primarySlot.end_time,
                assigned_slots: assignedSlots,
                admin_notes: adminNotes,
                branch_id: managerBranchId
            });
        }

        window.openAssignRequestModal = openAssignRequestModal;
        window.closeAssignRequestModal = closeAssignRequestModal;
        window.setAssignRequestTeacherSelection = setAssignRequestTeacherSelection;

        async function rejectStudentRequest(requestId) {
            if (!requestId) return;
            const input = await Swal.fire({
                icon: 'warning',
                title: 'Reject request?',
                text: 'You can add an optional reason for the student.',
                input: 'text',
                inputPlaceholder: 'Reason (optional)',
                showCancelButton: true,
                confirmButtonText: 'Reject',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#dc2626'
            });
            if (!input.isConfirmed) return;

            try {
                const response = await axios.post(`${baseApiUrl}/students.php`, {
                    action: 'reject-package-request',
                    request_id: Number(requestId),
                    admin_notes: input.value || '',
                    branch_id: managerBranchId
                });
                const data = response.data;
                if (data.success) {
                    showMessage(data.message || 'Request rejected.', 'success');
                    loadPendingRequests();
                } else {
                    showMessage(data.error || 'Failed to reject request.', 'error');
                }
            } catch (error) {
                showMessage('Network error while rejecting request.', 'error');
            }
        }

        async function loadActiveStudents() {
            const tableBody = document.getElementById('studentsTable');
            const countEl = document.getElementById('studentCount');
            if (!tableBody) return;

            try {
                if (!requireManagerBranch()) return;
                let url = `${baseApiUrl}/students.php?action=get-active-enrollments&branch_id=${encodeURIComponent(managerBranchId)}`;

                const response = await axios.get(url);
                const data = response.data;

                if (data.success && Array.isArray(data.enrollments)) {
                    allStudents = data.enrollments;
                    renderStudents(tableBody);
                    if (countEl) countEl.textContent = `${data.enrollments.length} active`;
                } else {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="6" class="px-6 py-8 text-center text-slate-500">
                                <i class="fas fa-users text-3xl mb-2 text-gold-500/50"></i>
                                <p>${uiIsDesk ? 'No active enrollments found.' : 'No active sessions found.'}</p>
                            </td>
                        </tr>`;
                    if (countEl) countEl.textContent = '0 active';
                }
            } catch (error) {
                console.error('Failed to load active sessions:', error);
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-8 text-center text-red-500">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <p>Failed to load active enrollments. Please try again.</p>
                        </td>
                    </tr>`;
            }
        }

        function renderStudents(tableBody) {
            if (!allStudents.length) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-8 text-center text-slate-500">
                            <i class="fas fa-users text-3xl mb-2 text-gold-500/50"></i>
                            <p>No active enrollments found.</p>
                        </td>
                    </tr>`;
                return;
            }

            tableBody.innerHTML = allStudents.map(student => {
                const packageName = student.package_name || '—';
                const totalAmount = Number(student.total_amount || 0);
                const paidAmount = Number(student.paid_amount || 0);
                const balance = Math.max(0, totalAmount - paidAmount);

                return `
                    <tr class="hover:bg-slate-50/80 transition">
                        <td class="px-6 py-4">
                            <div class="font-semibold text-base text-slate-900">${escapeHtml(student.first_name || '')} ${escapeHtml(student.last_name || '')}</div>
                            <div class="text-base text-slate-600">${escapeHtml(student.email || '')}</div>
                        </td>
                        <td class="px-6 py-4 text-base text-slate-700">${escapeHtml(packageName)}</td>
                        <td class="px-6 py-4 text-base text-slate-700 font-semibold">${formatCurrencyPHP(totalAmount)}</td>
                        <td class="px-6 py-4 text-base text-emerald-700 font-semibold">${formatCurrencyPHP(paidAmount)}</td>
                        <td class="px-6 py-4 text-base ${balance > 0 ? 'text-red-600' : 'text-slate-700'} font-semibold">${formatCurrencyPHP(balance)}</td>
                        <td class="px-6 py-4">
                            <button type="button" class="px-4 py-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm font-bold" onclick="openEnrollmentDetailsModal(${Number(student.enrollment_id)})">
                                More Details
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        function renderEnrollmentDetailCard(label, value, iconClass, valueClass = 'text-slate-900') {
            return `
                <div class="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                    <div class="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
                        <i class="fas ${iconClass} text-gold-500/90"></i>
                        ${escapeHtml(label)}
                    </div>
                    <div class="mt-2 text-sm font-semibold ${valueClass}">${value}</div>
                </div>
            `;
        }

        async function getEnrollmentSessionProgress(student) {
            const totalSessions = Math.max(0, Number(student?.sessions || 0));
            const studentId = Number(student?.student_id || 0);

            if (!studentId) {
                return { used: 0, total: totalSessions };
            }

            try {
                const summary = await fetchAttendanceSummary(studentId);
                const presentCount = Number(summary?.summary?.present_count || 0);
                const lateCount = Number(summary?.summary?.late_count || 0);
                const used = Math.min(totalSessions, presentCount + lateCount);
                return { used, total: totalSessions };
            } catch (error) {
                console.error('Failed to load attendance summary for enrollment modal:', error);
                return { used: 0, total: totalSessions };
            }
        }

        function formatDateOnly(dateString) {
            if (!dateString) return '—';
            const isYmd = /^\d{4}-\d{2}-\d{2}$/.test(String(dateString));
            const date = new Date(isYmd ? `${dateString}T00:00:00` : dateString);
            return Number.isNaN(date.getTime()) ? dateString : date.toLocaleDateString();
        }

        async function openEnrollmentDetailsModal(enrollmentId) {
            const student = allStudents.find(row => Number(row.enrollment_id) === Number(enrollmentId));
            if (!student) {
                showMessage('Enrollment details not found.', 'error');
                return;
            }

            const totalAmount    = Number(student.total_amount || 0);
            const paidAmount     = Number(student.paid_amount  || 0);
            const balance        = Math.max(0, totalAmount - paidAmount);
            const sessionProgress = await getEnrollmentSessionProgress(student);
            const sessionPercent  = sessionProgress.total > 0
                ? Math.min(100, Math.round((sessionProgress.used / sessionProgress.total) * 100))
                : 0;

            const studentName = `${escapeHtml(student.first_name || '')} ${escapeHtml(student.last_name || '')}`.trim() || 'Student';
            const packageName = escapeHtml(student.package_name || '—');
            const branchName  = escapeHtml(student.branch_name  || '—');
            const paymentType = escapeHtml(student.payment_type || '—');

            const hasFirstSession = Boolean(student.first_session_date);
            const firstSession    = hasFirstSession ? formatDateOnly(student.first_session_date) : 'No session scheduled yet';

            const balanceValueClass = balance > 0 ? 'text-red-600' : 'text-slate-900';

            // ── Build teacher list from schedule_slots (one slot per instrument/teacher) ──
            const slots       = Array.isArray(student.schedule_slots)  ? student.schedule_slots  : [];
            const sessionList = Array.isArray(student.sessions_list)   ? student.sessions_list   : [];

            // Build a teacher_id → name map from sessions_list (has joined teacher names)
            const teacherNameMap = {};
            sessionList.forEach(s => {
                const tid   = Number(s.teacher_id || 0);
                const tName = `${String(s.teacher_first_name || '').trim()} ${String(s.teacher_last_name || '').trim()}`.trim();
                if (tid > 0 && tName && !teacherNameMap[tid]) {
                    teacherNameMap[tid] = tName;
                }
            });

            // Collect unique teachers from slots
            let teacherRows = [];
            if (slots.length > 0) {
                const seen = new Set();
                slots.forEach(slot => {
                    const tid  = Number(slot.teacher_id || 0);
                    const tName = teacherNameMap[tid]
                        || `${String(slot.teacher_first_name || slot.first_name || '').trim()} ${String(slot.teacher_last_name || slot.last_name || '').trim()}`.trim()
                        || (tid > 0 ? `Teacher #${tid}` : '—');
                    const day  = escapeHtml(slot.day_of_week || '');
                    const time = slot.start_time
                        ? `${formatTime12Hour(slot.start_time)} – ${formatTime12Hour(slot.end_time)}`
                        : '';
                    const key = `${tid}|${day}|${slot.start_time}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        teacherRows.push({ name: tName, instrument: '', day, time });
                    }
                });
            }

            // If no slots, fall back to the single teacher from the enrollment row
            if (teacherRows.length === 0) {
                const fallback = `${String(student.teacher_first_name || '').trim()} ${String(student.teacher_last_name || '').trim()}`.trim();
                teacherRows.push({ name: fallback || '—', instrument: '', day: '', time: '' });
            }

            // ── Render teacher rows ──
            const teacherListHtml = teacherRows.map((t, idx) => `
                <div class="desk-modal-list-item">
                    <span class="font-semibold text-slate-900">${escapeHtml(t.name)}</span>
                    ${t.day || t.time ? `<span class="text-slate-500"> · ${[t.day, t.time].filter(Boolean).map(v => escapeHtml(v)).join(' · ')}</span>` : ''}
                </div>
            `).join('');

            const paymentBadge = balance <= 0
                ? '<span class="text-emerald-700 font-semibold">Fully paid</span>'
                : '<span class="text-red-600 font-semibold">Balance due</span>';

            Swal.fire({
                title: 'Enrollment Details',
                width: 760,
                confirmButtonText: 'Close',
                confirmButtonColor: '#b8860b',
                customClass: {
                    popup: 'enrollment-details-popup enrollment-details-readable',
                    title: 'text-xl font-bold text-slate-900',
                    htmlContainer: 'px-0',
                    confirmButton: 'desk-modal-btn desk-modal-btn-gold'
                },
                html: `
                    <div class="text-left text-base text-slate-700">
                        <div class="desk-modal-summary" style="border-radius:0;border-left:none;border-right:none;">
                            <span><b>Student</b> ${studentName}</span>
                            <span><b>Package</b> ${packageName}</span>
                            <span><b>Branch</b> ${branchName}</span>
                            <span><b>Payment</b> ${paymentType}</span>
                        </div>

                        <div class="px-5 py-4 border-b border-slate-100">
                            <div class="flex items-center justify-between gap-2 mb-2">
                                <span class="text-sm font-semibold uppercase tracking-wide text-slate-500">Sessions</span>
                                <span class="text-sm text-slate-600">${sessionPercent}% · ${sessionProgress.used} / ${sessionProgress.total}</span>
                            </div>
                            <div class="h-3 rounded-sm bg-slate-100 overflow-hidden">
                                <div class="h-full rounded-sm bg-gold-500" style="width:${sessionPercent}%"></div>
                            </div>
                        </div>

                        <div class="px-5 py-4 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                            <div><span class="block text-slate-400 font-semibold uppercase mb-1">Fee</span><span class="text-lg font-bold text-slate-900">${formatCurrencyPHP(totalAmount)}</span></div>
                            <div><span class="block text-slate-400 font-semibold uppercase mb-1">Paid</span><span class="text-lg font-bold text-emerald-700">${formatCurrencyPHP(paidAmount)}</span></div>
                            <div><span class="block text-slate-400 font-semibold uppercase mb-1">Balance</span><span class="text-lg font-bold ${balanceValueClass}">${formatCurrencyPHP(balance)}</span> · ${paymentBadge}</div>
                        </div>

                        <div class="px-5 py-4 border-b border-slate-100">
                            <div class="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-2">${teacherRows.length > 1 ? 'Teachers' : 'Teacher'}</div>
                            <div class="space-y-2">${teacherListHtml}</div>
                        </div>

                        <div class="px-5 py-4 text-sm">
                            <span class="text-slate-400 font-semibold uppercase">Start date</span>
                            <span class="ml-2 text-base font-semibold ${hasFirstSession ? 'text-slate-900' : 'text-slate-400'}">${escapeHtml(firstSession)}</span>
                        </div>
                    </div>
                `
            });
        }

        function escapeHtml(text) {
            if (text == null) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function openAssignPackageModal(studentId, studentName, currentPackageId) {
            const modal = document.getElementById('assignPackageModal');
            const studentInfo = document.getElementById('assignPackageStudentInfo');
            const studentIdInput = document.getElementById('assignStudentId');
            const packageSelect = document.getElementById('assignPackageSelect');

            if (modal && studentInfo && studentIdInput && packageSelect) {
                studentInfo.textContent = studentName
                    ? `Select a session package for ${studentName}`
                    : 'Select a session package for this student';
                studentIdInput.value = studentId;
                packageSelect.value = currentPackageId || '';
                document.getElementById('assignPackageMessage').classList.add('hidden');
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            }
        }

        function closeAssignPackageModal() {
            const modal = document.getElementById('assignPackageModal');
            const msg = document.getElementById('assignPackageMessage');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
            if (msg) msg.classList.add('hidden');
        }

        async function assignPackage(e) {
            e.preventDefault();
            const studentId = document.getElementById('assignStudentId').value;
            const packageId = document.getElementById('assignPackageSelect').value;

            if (!studentId || !packageId) {
                showAssignPackageMessage('Please select a package.', 'error');
                return;
            }

            try {
                const response = await axios.post(`${baseApiUrl}/students.php`, {
                    action: 'assign-package',
                    student_id: parseInt(studentId),
                    session_package_id: parseInt(packageId)
                });
                const data = response.data;

                if (data.success) {
                    closeAssignPackageModal();
                    showMessage('Package assigned successfully.', 'success');
                    loadActiveStudents();
                } else {
                    showAssignPackageMessage(data.error || 'Failed to assign package.', 'error');
                }
            } catch (error) {
                console.error('Failed to assign package:', error);
                showAssignPackageMessage('Network error. Please try again.', 'error');
            }
        }

        document.addEventListener('DOMContentLoaded', async function() {
            applyManagerPageMode();

            if (typeof Auth !== 'undefined' && Auth.getUser) {
                const user = Auth.getUser();
                const role = String(user?.role_name || '').toLowerCase();
                const params = new URLSearchParams(window.location.search);
                const mode = String(params.get('mode') || '').toLowerCase();

                const deskRoles = ['staff', 'desk', 'front desk'];
                const managerRoles = ['manager', 'branch manager'];

                const isDeskRole = deskRoles.includes(role);
                const isManager = managerRoles.includes(role);
                // Desk view is active for desk roles (UI hint is still passed via `mode=desk`).
                const isDesk = isDeskRole;
                uiIsDesk = isDesk;

                if (!user || (!isDeskRole && !isManager)) {
                    showMessage('Access denied. Desk/Manager only.', 'error');
                    setTimeout(() => {
                        window.location.href = '../../index.html';
                    }, 900);
                    return;
                }

                managerBranchId = Number(user.branch_id || 0);
                managerBranchName = user.branch_name || '';
                if (typeof syncDeskNavUser === 'function') {
                    syncDeskNavUser();
                } else {
                    const userNameNav = document.getElementById('userNameNav');
                    const profileMenuName = document.getElementById('profileMenuName');
                    const displayName = `${String(user.first_name || '').trim()} ${String(user.last_name || '').trim()}`.trim()
                        || user.username || user.email || (isDesk ? 'Front Desk' : 'Manager');
                    if (userNameNav) userNameNav.textContent = displayName;
                    if (profileMenuName) profileMenuName.textContent = displayName;
                }

                // Swap dashboard links for desk users.
                const deskDashboardHref = '../desk/desk_scanner.html';
                const managerDashboardHref = 'manager_dashboard.html';
                const logoLink = document.getElementById('deskOrManagerLogoLink');
                const dashLink = document.getElementById('navDashboardLink');
                if (logoLink) logoLink.href = isDesk ? deskDashboardHref : managerDashboardHref;
                if (dashLink) dashLink.href = isDesk ? deskDashboardHref : managerDashboardHref;

                const sideTitle = document.getElementById('sessionsSidePanelTitle');
                if (sideTitle) sideTitle.textContent = isDesk ? 'Desk Panel' : 'Manager Panel';

                const branchNameEl = document.getElementById('managerBranchName');
                const branchNotice = document.getElementById('managerBranchNotice');
                if (branchNameEl) branchNameEl.textContent = managerBranchName || '—';
                if (branchNotice) branchNotice.textContent = managerBranchName || '—';
            }

            initPaymentForm();
            initWalkinPage();
            await lockWalkinBranchToManager();

            await Promise.all([
                loadSessionPackages(),
                loadWalkinStudents()
            ]);

            await loadPendingRequests();
            await loadActiveStudents();

            applySessionView();
            await maybeAutoOpenAssignPackageModalFromUrl();
            await maybeAutoOpenAssignRequestModalFromUrl();
            initAssignTeacherSearchBox();

            document.getElementById('closeAssignPackageModalBtn')?.addEventListener('click', closeAssignPackageModal);
            document.getElementById('cancelAssignPackageBtn')?.addEventListener('click', closeAssignPackageModal);
            document.getElementById('assignPackageForm')?.addEventListener('submit', assignPackage);
            document.getElementById('closeAssignRequestModalBtn')?.addEventListener('click', closeAssignRequestModal);
            document.getElementById('cancelAssignRequestBtn')?.addEventListener('click', closeAssignRequestModal);
            document.getElementById('assignRequestForm')?.addEventListener('submit', submitAssignRequestForm);
            document.getElementById('viewNavPending')?.addEventListener('click', () => {
                const viewUrl = new URL(window.location.href);
                viewUrl.searchParams.set('view', 'pending');
                window.history.replaceState({}, '', viewUrl.toString());
                applySessionView();
            });
            document.getElementById('viewNavActive')?.addEventListener('click', () => {
                const viewUrl = new URL(window.location.href);
                viewUrl.searchParams.set('view', 'active');
                window.history.replaceState({}, '', viewUrl.toString());
                applySessionView();
            });
            document.getElementById('openWalkinRegistrationModalBtn')?.addEventListener('click', openWalkinRegistrationModal);
            document.getElementById('closeRegisterStudentModalBtn')?.addEventListener('click', closeWalkinRegistrationModal);
            document.getElementById('cancelRegisterStudentBtn')?.addEventListener('click', closeWalkinRegistrationModal);
            document.getElementById('openWalkinEnrollmentModalBtn')?.addEventListener('click', openWalkinEnrollmentModal);
            document.getElementById('closeWalkinEnrollmentModalBtn')?.addEventListener('click', closeWalkinEnrollmentModal);
            document.getElementById('cancelWalkinEnrollmentBtn')?.addEventListener('click', closeWalkinEnrollmentModal);
            document.getElementById('walkinEnrollmentForm')?.addEventListener('submit', submitWalkinEnrollment);
            document.getElementById('walkinStudentSearch')?.addEventListener('input', handleWalkinStudentChange);
            document.getElementById('walkinStudentSearch')?.addEventListener('change', handleWalkinStudentChange);
            document.getElementById('walkinPackageCards')?.addEventListener('click', (event) => {
                const button = event.target.closest('.walkin-package-card');
                if (!button) return;
                selectWalkinPackage(button.getAttribute('data-package-id'));
            });
            document.getElementById('walkinPaymentTypeCards')?.addEventListener('click', (event) => {
                const button = event.target.closest('.walkin-choice-card');
                if (!button) return;
                selectWalkinPaymentType(button.getAttribute('data-payment-type'));
            });
            document.getElementById('walkinStudentResults')?.addEventListener('click', async (event) => {
                const button = event.target.closest('.walkin-student-result');
                if (!button) return;
                const index = Number(button.getAttribute('data-student-index') || -1);
                const student = walkinStudents[index];
                if (!student) return;
                await selectWalkinStudent(student);
            });
            renderWalkinPaymentTypeCards();
            syncWalkinPaymentTypeCardSelection();
            document.getElementById('walkinClearStudentBtn')?.addEventListener('click', async () => {
                const input = document.getElementById('walkinStudentSearch');
                const hidden = document.getElementById('walkinStudentSelect');
                const packageSelect = document.getElementById('walkinPackageSelect');
                const instrumentsContainer = document.getElementById('walkinInstrumentsContainer');
                const submitBtn = document.getElementById('submitWalkinEnrollmentBtn');
                const statusEl = document.getElementById('walkinStatusInfo');
                if (input) input.value = '';
                if (hidden) hidden.value = '';
                if (packageSelect) packageSelect.innerHTML = '<option value="">Select package...</option>';
                if (instrumentsContainer) instrumentsContainer.innerHTML = '<div class="text-sm text-slate-500">Select a package first.</div>';
                if (submitBtn) submitBtn.disabled = false;
                if (statusEl) statusEl.textContent = '';
                walkinMeta = null;
                updateWalkinSelectedStudentCard(null);
                renderWalkinStudentResults('');
                renderWalkinPackageCards();
                renderWalkinPaymentTypeCards();
                syncWalkinPaymentTypeCardSelection();
                updateWalkinPackageUI();
            });
            document.getElementById('walkinPackageSelect')?.addEventListener('change', updateWalkinPackageUI);
            document.getElementById('walkinPaymentType')?.addEventListener('change', updateWalkinPackageUI);
            document.getElementById('assignRequestDate')?.addEventListener('change', () => {
                updateAssignRequestRecurringSummary();
                queueLoadAssignRequestAvailability();
            });
            document.getElementById('assignRequestAvailableSlotSelect')?.addEventListener('change', (event) => {
                const selected = parseAssignRequestSlotValue(event.target.value);
                if (!selected) return;
                applyAssignRequestAvailabilitySlot(selected.session_date, selected.day_of_week, selected.start_time, selected.end_time);
            });
            document.getElementById('addAssignRequestSlotBtn')?.addEventListener('click', () => addAssignRequestSlot());
        });

        window.applyAssignRequestAvailabilitySlot = applyAssignRequestAvailabilitySlot;
        window.selectAssignRequestAvailabilityDate = selectAssignRequestAvailabilityDate;
        window.setAssignRequestAvailabilityMonth = setAssignRequestAvailabilityMonth;
