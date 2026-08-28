 let allStudents = [];
        let packagePagePackages = [];
        let managerBranchId = 0;
        let managerBranchName = '';
        let uiIsDesk = false;
        let managerPageMode = 'enrollments';
        let allPendingRequests = [];
        let allSessionExtensionRequests = [];
        let pendingEnrollmentRequestsById = {};
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
        const assignRequestTeacherCache = new Map();
        let walkinStudents = [];
        let walkinMeta = null;
        let walkinStudentLookup = new Map();
        let pendingSessionExtensionRequestsById = {};

        function nextFrame() {
            if (typeof requestAnimationFrame === 'function') {
                return new Promise(resolve => requestAnimationFrame(() => resolve()));
            }
            return new Promise(resolve => setTimeout(resolve, 0));
        }

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

        function getEnrollmentSearchTerm() {
            const input = document.getElementById('enrollmentSearchInput');
            return String(input?.value || '').trim().toLowerCase();
        }

        function getEnrollmentBranchId() {
            const branchFilter = document.getElementById('branchFilter');
            const selectedBranchId = Number(branchFilter?.value || 0);
            return selectedBranchId > 0 ? selectedBranchId : Number(managerBranchId || 0);
        }

        function matchesEnrollmentSearch(values) {
            const term = getEnrollmentSearchTerm();
            if (!term) return true;
            return values.some(value => String(value || '').toLowerCase().includes(term));
        }

        function matchesSelectedBranch(rowBranchId, rowBranchName) {
            const selectedBranchId = getEnrollmentBranchId();
            if (!selectedBranchId) return true;
            if (Number(rowBranchId || 0) === selectedBranchId) return true;
            const selectedBranch = document.getElementById('branchFilter')?.selectedOptions?.[0]?.textContent || '';
            return String(rowBranchName || '').toLowerCase() === String(selectedBranch || '').toLowerCase();
        }

        function setEnrollmentSummaryText(id, value) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        }

        function updateEnrollmentSummary() {
            const pendingCount = allPendingRequests.length;
            const activeCount = allStudents.length;
            const extensionCount = allSessionExtensionRequests.length;

            setEnrollmentSummaryText('pendingTabCount', String(pendingCount));
            setEnrollmentSummaryText('activeTabCount', String(activeCount));
            setEnrollmentSummaryText('itemsNeedActionCount', String(pendingCount + extensionCount));
            setEnrollmentSummaryText('pendingRequestCount', `${pendingCount} pending`);
            setEnrollmentSummaryText('studentCount', `${activeCount} active`);
            setEnrollmentSummaryText('sessionExtensionRequestCount', `${extensionCount}`);
            setEnrollmentSummaryText('sessionExtensionRequestCountHeader', `${extensionCount} pending`);
        }

        async function loadBranchesForFilter() {
            const branchFilter = document.getElementById('branchFilter');
            if (!branchFilter) return;

            try {
                const response = await axios.get(`${baseApiUrl}/branch.php?action=get-branches`);
                const data = response.data || {};
                if (!data.success || !Array.isArray(data.branches)) return;

                const currentBranchId = String(managerBranchId || '');
                branchFilter.innerHTML = '<option value="">All branches</option>' + data.branches.map(branch => {
                    const branchId = String(branch.branch_id || '');
                    const selected = currentBranchId && branchId === currentBranchId ? ' selected' : '';
                    return `<option value="${escapeHtml(branchId)}"${selected}>${escapeHtml(branch.branch_name || 'Branch')}</option>`;
                }).join('');
            } catch (error) {
                console.error('Failed to load branches:', error);
            }
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
            const teachers = Array.isArray(assignRequestTeacherCandidates) ? assignRequestTeacherCandidates : [];
            const key = [
                instrument?.instrument_id || '',
                instrument?.instrument_name || '',
                instrument?.type_name || '',
                teachers.length,
                teachers.map(teacher => `${teacher.teacher_id || ''}:${teacher.specialization || ''}`).join('|')
            ].join('::');

            if (assignRequestTeacherCache.has(key)) {
                return assignRequestTeacherCache.get(key);
            }

            const result = !instrument
                ? teachers.filter(teacher => !isGeneralTeacherSpecialization(teacher.specialization))
                : teachers.filter(teacher => teacherMatchesInstrument(teacher, instrument));

            assignRequestTeacherCache.set(key, result);
            return result;
        }

        function getInstrumentRowLabel(instrument, index) {
            if (!instrument) return `Slot ${index + 1}`;
            return `Instrument ${index + 1}`;
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
            const topBase = 'rounded-md px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 transition';
            const topActiveClass = 'rounded-md bg-gold-500 px-3 py-1.5 text-xs sm:text-sm font-semibold text-black shadow-sm';
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
            const avatarEl = document.getElementById('walkinSelectedStudentAvatar');
            const nameEl = document.getElementById('walkinSelectedStudentName');
            const metaEl = document.getElementById('walkinSelectedStudentMeta');
            const searchWrap = document.getElementById('walkinStudentSearchWrap');
            const resultsEl = document.getElementById('walkinStudentResults');
            if (!card || !nameEl || !metaEl) return;

            if (!student) {
                card.classList.add('hidden');
                nameEl.textContent = '—';
                metaEl.textContent = '—';
                if (avatarEl) avatarEl.textContent = '--';
                if (searchWrap) searchWrap.classList.remove('hidden');
                if (resultsEl) resultsEl.classList.remove('hidden');
                return;
            }

            const branch = student.branch_name || managerBranchName || 'Assigned branch';
            const phone = student.phone || 'No phone';
            nameEl.textContent = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
            metaEl.textContent = `${student.email || 'No email'} • ${phone} • ${branch}`;
            if (avatarEl) {
                const initials = `${String(student.first_name || '').trim().charAt(0) || ''}${String(student.last_name || '').trim().charAt(0) || ''}`.toUpperCase();
                avatarEl.textContent = initials || 'ST';
            }
            card.classList.remove('hidden');
            if (searchWrap) searchWrap.classList.add('hidden');
            if (resultsEl) resultsEl.classList.add('hidden');
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
                        data-student-email="${escapeHtml(String(student.email || ''))}"
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

            const options = Array.from(packageSelect.options || [])
                .filter(option => String(option.value || '').trim())
                .filter(option => Number(option.getAttribute('data-sessions') || 0) > 12);
            if (!options.length) {
                cardsContainer.innerHTML = '<div class="text-sm text-slate-500">12 sessions is the default package.</div>';
                return;
            }

            const selectedValue = String(packageSelect.value || '');
            cardsContainer.innerHTML = options.map(option => {
                const maxInst = getWalkinPackageInstrumentLimitFromOption(option);
                const sessions = Number(option.getAttribute('data-sessions') || 0);
                const isSelected = selectedValue && selectedValue === String(option.value || '');
                return `
                    <button
                        type="button"
                        class="walkin-package-card ${isSelected ? 'is-selected' : ''}"
                        data-package-id="${escapeHtml(String(option.value || ''))}"
                        data-session-count="${sessions}"
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

        function getWalkinPackageOptions() {
            const packageSelect = document.getElementById('walkinPackageSelect');
            if (!packageSelect) return [];
            return Array.from(packageSelect.options || []).filter(option => String(option.value || '').trim());
        }

        function getWalkinSessionSelect() {
            return document.getElementById('walkinSessionSelect');
        }

        function getWalkinSelectedPackageOption() {
            const packageSelect = document.getElementById('walkinPackageSelect');
            const sessionSelect = getWalkinSessionSelect();
            if (!packageSelect || !sessionSelect) return null;

            const selectedSessionCount = Number(sessionSelect.value || 12);
            const options = getWalkinPackageOptions();
            return options.find(option => Number(option.getAttribute('data-sessions') || 0) === selectedSessionCount)
                || options.find(option => Number(option.getAttribute('data-sessions') || 0) === 12)
                || options[0]
                || null;
        }

        function syncWalkinSessionSelectUI() {
            const sessionSelect = getWalkinSessionSelect();
            const selectedPackage = getWalkinSelectedPackageOption();
            const addSessionsBtn = document.getElementById('addSessionsBtn');
            const sessionHint = document.getElementById('walkinSessionHint');
            if (!sessionSelect) return;

            const sessions = Number(selectedPackage?.getAttribute('data-sessions') || 12);
            sessionSelect.value = String(sessions || 12);
            
            // Update hint text
            if (sessionHint) {
                if (walkinMeta && canAccessExtendedWalkinPackages(walkinMeta)) {
                    sessionHint.textContent = 'Returning student - all packages available. Additional sessions: ₱650 each.';
                } else if (walkinMeta) {
                    sessionHint.textContent = 'Beginner student - 12 session package. Additional sessions: ₱650 each.';
                } else {
                    sessionHint.textContent = '';
                }
            }
            
            // Enable/disable add sessions button
            if (addSessionsBtn) {
                addSessionsBtn.disabled = !walkinMeta;
            }
        }
        
        function populateWalkinSessionDropdown(isReturningStudent) {
            const sessionSelect = getWalkinSessionSelect();
            const addSessionsBtn = document.getElementById('addSessionsBtn');
            if (!sessionSelect) return;
            
            sessionSelect.disabled = false;
            
            if (isReturningStudent) {
                // Returning students can choose 12, 20, or 50 sessions
                sessionSelect.innerHTML = `
                    <option value="12">12 Sessions</option>
                    <option value="20">20 Sessions</option>
                    <option value="50">50 Sessions</option>
                `;
            } else {
                // Beginners only get 12 sessions
                sessionSelect.innerHTML = `
                    <option value="12">12 Sessions</option>
                `;
            }
            
            // Enable add sessions button if student selected
            if (addSessionsBtn) {
                addSessionsBtn.disabled = false;
            }
        }

        function selectWalkinSessionPackage(sessionCount) {
            const sessionSelect = getWalkinSessionSelect();
            if (!sessionSelect) return;

            sessionSelect.value = String(sessionCount || 12);
            const selectedPackage = getWalkinSelectedPackageOption();
            const packageSelect = document.getElementById('walkinPackageSelect');
            if (packageSelect && selectedPackage) {
                packageSelect.value = String(selectedPackage.value || '');
            }
            updateWalkinPackageUI();
        }

        function syncWalkinSessionStepperUI() {
            syncWalkinSessionSelectUI();
        }

        function selectWalkinPackageByOffset(delta) {
            const sessionSelect = getWalkinSessionSelect();
            if (!sessionSelect) return;
            const sessions = [12, 20, 50];
            const currentIndex = sessions.indexOf(Number(sessionSelect.value || 12));
            const safeIndex = currentIndex >= 0 ? currentIndex : 0;
            const nextIndex = Math.max(0, Math.min(sessions.length - 1, safeIndex + delta));
            selectWalkinSessionPackage(sessions[nextIndex]);
        }

        function syncWalkinInstrumentDefaults() {
            const container = document.getElementById('walkinInstrumentsContainer');
            if (!container) return;

            const typeSelects = Array.from(container.querySelectorAll('select.student-request-instrument-type'));
            if (!typeSelects.length) return;

            if (typeof _syncStudentRequestTypeDisabledStates === 'function') {
                _syncStudentRequestTypeDisabledStates();
            }
        }

        function getWalkinPrimaryInstrumentLabel() {
            const container = document.getElementById('walkinInstrumentsContainer');
            if (!container) return '';

            const typeSelect = container.querySelector('select.student-request-instrument-type');
            if (!typeSelect) return '';

            const option = typeSelect.options?.[typeSelect.selectedIndex];
            return String(option?.textContent || '').trim();
        }

        function getWalkinInstrumentIdsLocal() {
            // Use the global function from index.js which has the correct selectors
            if (typeof getResolvedInstrumentIdsFromSelectors === 'function' && typeof studentRequestAvailableInstruments !== 'undefined') {
                return getResolvedInstrumentIdsFromSelectors(
                    '#walkinInstrumentsContainer',
                    'select.student-request-instrument-type',
                    'select.student-request-instrument',
                    studentRequestAvailableInstruments
                );
            }
            // Fallback
            return [];
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
            const sessionSelect = getWalkinSessionSelect();
            const instrumentsContainer = document.getElementById('walkinInstrumentsContainer');
            const submitBtn = document.getElementById('submitWalkinEnrollmentBtn');
            const input = document.getElementById('walkinStudentSearch');
            if (!hidden || !packageSelect || !sessionSelect || !instrumentsContainer) return;

            hidden.value = student ? String(student.email || '') : '';
            if (input) input.value = student ? getWalkinStudentLabel(student) : '';
            updateWalkinSelectedStudentCard(student);
            renderWalkinStudentResults(input?.value || '');

            if (!student || !hidden.value) {
                packageSelect.innerHTML = '<option value="">Select package...</option>';
                sessionSelect.disabled = true;
                sessionSelect.innerHTML = '<option value="">Select student first</option>';
                const addSessionsBtn = document.getElementById('addSessionsBtn');
                if (addSessionsBtn) addSessionsBtn.disabled = true;
                renderWalkinPackageCards();
                renderWalkinPaymentTypeCards();
                syncWalkinPaymentTypeCardSelection();
                instrumentsContainer.innerHTML = '<div class="text-sm text-slate-500">Select a student first.</div>';
                if (statusEl) statusEl.textContent = '';
                if (submitBtn) submitBtn.disabled = false;
                walkinMeta = null;
                syncWalkinSessionSelectUI();
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
            const packageScope = String(meta.package_scope || '').toLowerCase();
            const defaultPackageId = String(meta.default_package_id || '');
            const studentSkillLevel = String(meta.student_skill_level || '').toLowerCase();
            const previousValue = String(packageSelect.value || '');

            const canAccessExtendedPackages = canAccessExtendedWalkinPackages(meta);
            
            // Populate session dropdown based on student type
            populateWalkinSessionDropdown(canAccessExtendedPackages);
            
            const filteredPackages = canAccessExtendedPackages
                ? packages.filter(pkg => {
                    const sessions = Number(pkg.sessions || 0);
                    return sessions === 12 || sessions === 20 || sessions === 50;
                })
                : packages.filter(pkg => Number(pkg.sessions || 0) === 12);
            
            packageSelect.innerHTML = '<option value="">Select package...</option>' + filteredPackages.map(pkg => {
                const sessions = Number(pkg.sessions || 0);
                const maxInst = sessions === 12 ? 1 : sessions === 20 ? 2 : sessions >= 50 ? 3 : Math.max(1, Number(pkg.max_instruments || 1));
                const price = formatCurrencyPHP(pkg.price || 0);
                return `<option value="${pkg.package_id}" data-max-instruments="${maxInst}" data-sessions="${sessions}" data-price="${pkg.price || 0}">${escapeHtml(pkg.package_name || 'Package')} (${sessions} sessions, up to ${maxInst} instrument${maxInst > 1 ? 's' : ''}) - ${price}</option>`;
            }).join('');
            const selectedPackage = filteredPackages.find(pkg => String(pkg.package_id) === previousValue)
                || filteredPackages.find(pkg => String(pkg.package_id) === defaultPackageId)
                || filteredPackages.find(pkg => Number(pkg.sessions || 0) === 12)
                || filteredPackages[0]
                || null;
            if (selectedPackage) {
                packageSelect.value = String(selectedPackage.package_id || '');
                sessionSelect.value = String(Number(selectedPackage.sessions || 12));
            } else {
                sessionSelect.value = '12';
            }
            renderWalkinPackageCards();
            renderWalkinPaymentTypeCards();
            syncWalkinPaymentTypeCardSelection();

            const latest = meta.latest_request || null;
            const hasPending = latest && String(latest.status || '') === 'Pending';
            if (statusEl) {
                if (hasPending) {
                    statusEl.textContent = 'Student has a pending request. Complete that first.';
                } else if (canAccessExtendedPackages) {
                    statusEl.textContent = 'Returning student - all packages available.';
                } else {
                    statusEl.textContent = 'Beginner student - 12-session package only.';
                }
            }
            if (submitBtn) submitBtn.disabled = hasPending;
            updateWalkinPackageUI();
            syncWalkinSessionSelectUI();
        }

        function openWalkinEnrollmentModal() {
            const modal = document.getElementById('walkinEnrollmentModal');
            if (!modal) return;
            loadWalkinStudents();
            updateWalkinPackageUI();
            syncWalkinSessionSelectUI();
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
            const sessionSelect = getWalkinSessionSelect();
            const addSessionsBtn = document.getElementById('addSessionsBtn');
            if (statusEl) statusEl.textContent = '';
            if (searchInput) searchInput.value = '';
            if (hiddenSelect) hiddenSelect.value = '';
            if (packageSelect) packageSelect.innerHTML = '<option value="">Select package...</option>';
            if (sessionSelect) {
                sessionSelect.disabled = true;
                sessionSelect.innerHTML = '<option value="">Select student first</option>';
            }
            if (addSessionsBtn) addSessionsBtn.disabled = true;
            renderWalkinPackageCards();
            renderWalkinPaymentTypeCards();
            syncWalkinPaymentTypeCardSelection();
            if (instrumentsContainer) instrumentsContainer.innerHTML = '<div class="text-sm text-slate-500">Select a package first.</div>';
            updateWalkinSelectedStudentCard(null);
            renderWalkinStudentResults('');
            syncWalkinSessionSelectUI();
        }
        
        function showAddSessionsModal() {
            if (!walkinMeta) {
                showMessage('Please select a student first.', 'error');
                return;
            }
            
            Swal.fire({
                title: 'Add Extra Sessions',
                html: `
                    <div class="text-left space-y-3">
                        <p class="text-sm text-slate-600">₱650 per session</p>
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 mb-1">Sessions to Add</label>
                            <input type="number" id="extraSessionsInput" min="1" max="50" value="1" 
                                class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-gold-500">
                        </div>
                        <div class="bg-gold-50 border border-gold-200 rounded-lg p-3">
                            <div class="flex justify-between text-sm">
                                <span class="font-semibold">Cost:</span>
                                <span id="extraSessionsCost" class="font-bold text-gold-700">₱650.00</span>
                            </div>
                        </div>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Add Sessions',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#b8860b',
                didOpen: () => {
                    const input = document.getElementById('extraSessionsInput');
                    const costDisplay = document.getElementById('extraSessionsCost');
                    if (input && costDisplay) {
                        input.addEventListener('input', () => {
                            const count = Number(input.value) || 0;
                            const cost = count * 650;
                            costDisplay.textContent = formatCurrencyPHP(cost);
                        });
                    }
                },
                preConfirm: () => {
                    const input = document.getElementById('extraSessionsInput');
                    const extraSessions = Number(input?.value) || 0;
                    if (extraSessions < 1) {
                        Swal.showValidationMessage('Please enter at least 1 session');
                        return false;
                    }
                    return extraSessions;
                }
            }).then((result) => {
                if (result.isConfirmed && result.value) {
                    const sessionSelect = getWalkinSessionSelect();
                    if (sessionSelect) {
                        const currentSessions = Number(sessionSelect.value) || 12;
                        const newTotal = currentSessions + result.value;
                        
                        // Create a custom option if needed
                        const existingOption = Array.from(sessionSelect.options).find(opt => Number(opt.value) === newTotal);
                        if (!existingOption) {
                            const option = document.createElement('option');
                            option.value = String(newTotal);
                            option.textContent = `${newTotal} Sessions`;
                            sessionSelect.appendChild(option);
                        }
                        
                        sessionSelect.value = String(newTotal);
                        updateWalkinPackageUI();
                        showToast(`Added ${result.value} session(s). Total: ${newTotal} sessions`, 'success');
                    }
                }
            });
        }

        function updateWalkinPackageUI() {
            const packageSelect = document.getElementById('walkinPackageSelect');
            const sessionSelect = getWalkinSessionSelect();
            const instrumentsContainer = document.getElementById('walkinInstrumentsContainer');
            const amountEl = document.getElementById('walkinAmountInfo');
            const paymentTypeEl = document.getElementById('walkinPaymentType');
            if (!packageSelect || !sessionSelect || !instrumentsContainer || !amountEl) return;

            const selectedSessionCount = Number(sessionSelect.value || 12);
            const selected = Array.from(packageSelect.options || []).find(option => Number(option.getAttribute('data-sessions') || 0) === selectedSessionCount)
                || Array.from(packageSelect.options || []).find(option => Number(option.getAttribute('data-sessions') || 0) === 12)
                || packageSelect.options[0]
                || null;
            if (selected) {
                packageSelect.value = String(selected.value || '');
            }
            const maxInst = getWalkinPackageInstrumentLimitFromOption(selected);
            const basePrice = Number(selected?.getAttribute('data-price') || 0);
            const baseSessions = Number(selected?.getAttribute('data-sessions') || 12);
            
            // Calculate actual sessions and price (including add-ons)
            const actualSessions = selectedSessionCount;
            const extraSessions = Math.max(0, actualSessions - baseSessions);
            const extraCost = extraSessions * 650;
            const totalPrice = basePrice + extraCost;
            
            // Calculate payable amount based on payment type
            const paymentType = String(paymentTypeEl?.value || 'Full Payment').trim();
            const isPartialPayment = paymentType === 'Partial Payment';
            const depositAmount = Math.ceil(totalPrice * 0.3); // 30% deposit for partial payment
            const payableNow = isPartialPayment ? depositAmount : totalPrice;
            const remainingBalance = isPartialPayment ? (totalPrice - depositAmount) : 0;
            
            syncWalkinPackageCardSelection();
            syncWalkinSessionSelectUI();
            if (paymentTypeEl && !String(paymentTypeEl.value || '').trim()) {
                paymentTypeEl.value = 'Full Payment';
            }
            const instrumentLabel = getWalkinPrimaryInstrumentLabel() || '—';
            
            let summaryHtml = `
                <div class="walkin-summary-line">
                    <span>Instrument</span>
                    <span>${escapeHtml(instrumentLabel || '—')}</span>
                </div>
                <div class="walkin-summary-line">
                    <span>Sessions</span>
                    <span>${actualSessions > 0 ? actualSessions : '—'}</span>
                </div>
                <div class="walkin-summary-line">
                    <span>Max instruments</span>
                    <span>${maxInst > 0 ? maxInst : '—'}</span>
                </div>`;
            
            if (extraSessions > 0) {
                summaryHtml += `
                <div class="walkin-summary-line">
                    <span>Extra sessions</span>
                    <span>${extraSessions} × ₱650</span>
                </div>`;
            }
            
            summaryHtml += `
                <div class="walkin-summary-total">
                    <span>Total</span>
                    <span>${formatCurrencyPHP(totalPrice)}</span>
                </div>`;
            
            if (isPartialPayment) {
                summaryHtml += `
                <div class="walkin-summary-line" style="margin-top: 0.5rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0;">
                    <span class="font-semibold text-gold-700">Payable Now (30%)</span>
                    <span class="font-bold text-gold-700">${formatCurrencyPHP(payableNow)}</span>
                </div>
                <div class="walkin-summary-line text-xs text-slate-500">
                    <span>Remaining Balance</span>
                    <span>${formatCurrencyPHP(remainingBalance)}</span>
                </div>`;
            }
            
            amountEl.innerHTML = summaryHtml;
            instrumentsContainer.innerHTML = maxInst > 0
                ? renderStudentRequestInstrumentSelectors(maxInst, walkinMeta?.instruments || [])
                : '<div class="text-sm text-slate-500">Select a package first.</div>';
            syncWalkinInstrumentDefaults();
            renderWalkinPackageCards();
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
            
            const instrumentIds = typeof getWalkinInstrumentIdsLocal === 'function'
                ? getWalkinInstrumentIdsLocal()
                : typeof getResolvedInstrumentIdsFromSelectors === 'function'
                    ? getResolvedInstrumentIdsFromSelectors(
                        '#walkinInstrumentsContainer',
                        'select.student-request-instrument-type',
                        'select.student-request-instrument',
                        studentRequestAvailableInstruments
                    )
                    : [];
            const uniqueInstrumentIds = Array.from(new Set(instrumentIds));

            // Validate required fields
            if (!email || !studentId || !packageId || !paymentType || !paymentMethod || uniqueInstrumentIds.length < 1) {
                const missingFields = [];
                if (!email || !studentId) missingFields.push('student');
                if (!packageId) missingFields.push('package');
                if (uniqueInstrumentIds.length < 1) missingFields.push('instrument');
                if (!paymentType) missingFields.push('payment type');
                if (!paymentMethod) missingFields.push('payment method');
                showToast(`Missing: ${missingFields.join(', ')}`, 'error');
                return;
            }
            if (instrumentIds.length !== uniqueInstrumentIds.length) {
                showToast('Duplicate instruments selected', 'error');
                return;
            }

            const selectedOption = packageSelect.options[packageSelect.selectedIndex];
            const maxInst = getWalkinPackageInstrumentLimitFromOption(selectedOption) || 1;
            if (uniqueInstrumentIds.length > maxInst) {
                showToast(`Maximum ${maxInst} instrument(s) allowed`, 'error');
                return;
            }

            console.log('[Walk-in Enrollment] Validation passed, submitting...');
            
            // Calculate payment amounts
            const sessionSelect = getWalkinSessionSelect();
            const selectedSessionCount = Number(sessionSelect?.value || 12);
            const basePrice = Number(selectedOption?.getAttribute('data-price') || 0);
            const baseSessions = Number(selectedOption?.getAttribute('data-sessions') || 12);
            const extraSessions = Math.max(0, selectedSessionCount - baseSessions);
            const extraCost = extraSessions * 650;
            const totalPrice = basePrice + extraCost;
            const isPartialPayment = paymentType === 'Partial Payment';
            const depositAmount = Math.ceil(totalPrice * 0.3); // 30% deposit
            const payableNow = isPartialPayment ? depositAmount : totalPrice;
            
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
                requestFormData.append('payable_now', String(payableNow));
                requestFormData.append('requested_amount', String(totalPrice));
                requestFormData.append('requested_session_count', String(selectedSessionCount));

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
                    showToast(response.error || 'Failed to submit enrollment', 'error');
                }
            } catch (error) {
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

        function getWalkinPackageInstrumentLimitFromOption(option) {
            const sessions = Number(option?.getAttribute?.('data-sessions') || 0);
            const explicitMax = Number(option?.getAttribute?.('data-max-instruments') || 0);
            if (sessions === 12) return Math.max(1, explicitMax || 1);
            if (sessions === 20) return Math.max(2, explicitMax || 2);
            if (sessions >= 50) return Math.max(3, explicitMax || 3);
            return Math.max(1, explicitMax || 1);
        }

        function canAccessExtendedWalkinPackages(meta) {
            const packageScope = String(meta?.package_scope || '').toLowerCase();
            const studentSkillLevel = String(meta?.student_skill_level || '').toLowerCase();
            const isInitialEnrollment = Boolean(meta?.is_initial_enrollment);
            const isReturnee = packageScope === 'extension' || !isInitialEnrollment;
            if (isReturnee) return true;
            if (!studentSkillLevel) return false;
            return studentSkillLevel !== 'beginner';
        }

        function renderPendingRequests() {
            const tableBody = document.getElementById('pendingRequestsTable');
            const countEl = document.getElementById('pendingRequestCount');
            if (!tableBody) return;

            const rows = (Array.isArray(allPendingRequests) ? allPendingRequests : []).filter(r => {
                if (!matchesSelectedBranch(r.branch_id, r.branch_name)) return false;
                return matchesEnrollmentSearch([
                    `${r.first_name || ''} ${r.last_name || ''}`,
                    r.email,
                    r.branch_name,
                    r.package_name,
                    Array.isArray(r.instruments) ? r.instruments.map(i => i.type_name || i.instrument_name || '').join(', ') : '',
                    'Based on instructor availability',
                    r.payment_type,
                    r.payment_method
                ]);
            });

            if (countEl) countEl.textContent = `${rows.length} pending`;
            
            // Update tab count
            const pendingTabCountEl = document.getElementById('pendingTabCount');
            if (pendingTabCountEl) pendingTabCountEl.textContent = String(allPendingRequests.length);

            if (!rows.length) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-4 py-6 text-center text-slate-500">
                            <i class="fas fa-inbox text-2xl mb-2 text-gold-500/60"></i>
                            <p>No pending enrollment requests.</p>
                        </td>
                    </tr>`;
                return;
            }

            tableBody.innerHTML = rows.map(r => {
                const studentName = `${escapeHtml(r.first_name || '')} ${escapeHtml(r.last_name || '')}`.trim();
                const pkg = escapeHtml(r.package_name || '—');
                const instruments = Array.isArray(r.instruments) && r.instruments.length
                    ? r.instruments.map(i => escapeHtml(i.type_name || i.instrument_name || 'Instrument')).join(', ')
                    : '—';
                return `
                    <tr class="hover:bg-slate-50/80 transition">
                        <td class="px-3 py-2.5">
                            <div class="font-semibold text-sm text-slate-900">${studentName || 'Student'}</div>
                            <div class="text-xs text-slate-600">${escapeHtml(r.email || '')}</div>
                            <div class="text-xs text-slate-500">${escapeHtml(r.branch_name || '')}</div>
                        </td>
                        <td class="px-3 py-2.5 text-sm text-slate-700">${pkg}</td>
                        <td class="px-3 py-2.5 text-sm text-slate-700">${instruments}</td>
                        <td class="px-3 py-2.5 text-sm text-slate-700">Instructor availability</td>
                        <td class="px-3 py-2.5 text-sm text-slate-700">
                            <div>
                                <button type="button" onclick="openPendingRequestPaymentModal(${Number(r.request_id)})" class="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition">
                                    Payment Info
                                </button>
                            </div>
                        </td>
                        <td class="px-3 py-2.5">
                            <div class="flex flex-nowrap items-center gap-1.5">
                                <button onclick="openPendingRequestViewModal(${Number(r.request_id)})" class="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                                    View
                                </button>
                                <button onclick="handleScheduleClick(${Number(r.request_id)})" class="rounded-md bg-green-100 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-200">
                                    ${window.pendingRequestActionLabel || 'Assign & Approve'}
                                </button>
                                <button onclick="rejectStudentRequest(${Number(r.request_id)})" class="rounded-md bg-red-100 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200">
                                    Reject
                                </button>
                            </div>
                        </td>
                    </tr>`;
            }).join('');
        }

        async function loadPendingRequests() {
            if (!requireManagerBranch()) return;

            try {
                const branchId = getEnrollmentBranchId();
                let url = `${baseApiUrl}/students.php?action=get-pending-package-requests`;
                if (branchId > 0) {
                    url += `&branch_id=${encodeURIComponent(branchId)}`;
                }

                const response = await axios.get(url);
                const data = response.data || {};
                allPendingRequests = data.success && Array.isArray(data.requests) ? data.requests : [];
                pendingEnrollmentRequestsById = {};
                allPendingRequests.forEach(r => {
                    pendingEnrollmentRequestsById[String(r.request_id)] = r;
                });
                updateEnrollmentSummary();
                renderPendingRequests();
            } catch (error) {
                console.error('Failed to load pending package requests:', error);
                const tableBody = document.getElementById('pendingRequestsTable');
                const countEl = document.getElementById('pendingRequestCount');
                if (countEl) countEl.textContent = 'Error';
                if (tableBody) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="6" class="px-4 py-6 text-center text-red-500">
                                <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                                <p>Failed to load pending requests.</p>
                            </td>
                    </tr>`;
                }
            }
        }

        async function loadPendingSessionExtensionRequests() {
            const tableBody = document.getElementById('sessionExtensionRequestsTable');
            const countEl = document.getElementById('sessionExtensionRequestCountHeader');
            if (!tableBody) return;

            try {
                if (!requireManagerBranch()) return;
                const branchId = getEnrollmentBranchId();
                let url = `${baseApiUrl}/students.php?action=get-pending-session-extension-requests`;
                if (branchId > 0) {
                    url += `&branch_id=${encodeURIComponent(branchId)}`;
                }
                const response = await axios.get(url);
                const data = response.data || {};
                allSessionExtensionRequests = data.success && Array.isArray(data.requests) ? data.requests : [];
                pendingSessionExtensionRequestsById = {};
                allSessionExtensionRequests.forEach(req => {
                    pendingSessionExtensionRequestsById[String(req.request_id)] = req;
                });
                updateEnrollmentSummary();
                renderSessionExtensionRequests();
            } catch (error) {
                console.error('Failed to load pending session extension requests:', error);
                if (countEl) countEl.textContent = 'Error';
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-4 py-6 text-center text-red-500">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <p>Failed to load session extension requests.</p>
                        </td>
                        </tr>`;
            }
        }

        function renderSessionExtensionRequests() {
            const tableBody = document.getElementById('sessionExtensionRequestsTable');
            const countEl = document.getElementById('sessionExtensionRequestCountHeader');
            if (!tableBody) return;

            const rows = (Array.isArray(allSessionExtensionRequests) ? allSessionExtensionRequests : []).filter(req => {
                if (!matchesSelectedBranch(req.branch_id, req.branch_name)) return false;
                return matchesEnrollmentSearch([
                    `${req.first_name || ''} ${req.last_name || ''}`,
                    req.email,
                    req.branch_name,
                    req.preferred_day_of_week,
                    req.preferred_start_time,
                    req.preferred_end_time,
                    req.payment_method,
                    req.requested_amount
                ]);
            });

            if (countEl) countEl.textContent = `${rows.length} pending`;
            setEnrollmentSummaryText('sessionExtensionRequestCount', String(rows.length));

            if (!rows.length) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-4 py-6 text-center text-slate-500">
                            <i class="fas fa-calendar-plus text-2xl mb-2 text-gold-500/60"></i>
                            <p>No pending session extension requests.</p>
                        </td>
                    </tr>`;
                return;
            }

            tableBody.innerHTML = rows.map(req => {
                const studentName = `${escapeHtml(req.first_name || '')} ${escapeHtml(req.last_name || '')}`.trim() || 'Student';
                const schedule = req.preferred_day_of_week
                    ? `${escapeHtml(req.preferred_day_of_week)} • ${formatTime12Hour(req.preferred_start_time || '')} - ${formatTime12Hour(req.preferred_end_time || '')}`
                    : '—';
                const amount = formatCurrencyPHP(req.requested_amount || 650);
                const paymentMethod = escapeHtml(req.payment_method || 'Cash');
                const proofLink = req.payment_proof_path
                    ? `<a href="${escapeHtml(buildPublicFileUrl(req.payment_proof_path))}" target="_blank" rel="noopener" class="text-xs text-blue-600 underline">Proof</a>`
                    : '<span class="text-xs text-slate-400">No proof</span>';
                return `
                    <tr class="hover:bg-slate-50/80 transition">
                        <td class="px-4 py-3">
                            <div class="font-semibold text-sm sm:text-base text-slate-900">${studentName}</div>
                            <div class="text-sm text-slate-500">${escapeHtml(req.email || '')}</div>
                        </td>
                        <td class="px-4 py-3 text-sm sm:text-base text-slate-700">${escapeHtml(req.branch_name || '')}</td>
                        <td class="px-4 py-3 text-sm sm:text-base text-slate-700">${schedule}</td>
                        <td class="px-4 py-3 text-sm sm:text-base text-slate-700">
                            <div>${paymentMethod}</div>
                            <div class="mt-1">${proofLink}</div>
                        </td>
                        <td class="px-4 py-3 text-sm sm:text-base text-slate-700">${amount}</td>
                        <td class="px-4 py-3">
                            <span class="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">Pending</span>
                        </td>
                        <td class="px-4 py-3">
                            <button type="button" onclick="approveSessionExtensionRequest(${Number(req.request_id)})" class="px-4 py-2 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-sm font-bold">
                                Approve
                            </button>
                        </td>
                    </tr>`;
            }).join('');
        }

        async function openSessionExtensionRequestsModal() {
            const modal = document.getElementById('sessionExtensionRequestsModal');
            if (!modal) return;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            document.body.style.overflow = 'hidden';
            await loadPendingSessionExtensionRequests();
            renderSessionExtensionRequests();
        }

        function closeSessionExtensionRequestsModal() {
            const modal = document.getElementById('sessionExtensionRequestsModal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            document.body.style.overflow = '';
        }

        async function approveSessionExtensionRequest(requestId) {
            if (!requestId) return;

            const confirm = await Swal.fire({
                icon: 'question',
                title: 'Approve session extension?',
                text: 'This will confirm the student\'s ₱650 extra session request.',
                showCancelButton: true,
                confirmButtonText: 'Approve',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#059669'
            });
            if (!confirm.isConfirmed) return;

            try {
                const response = await axios.post(`${baseApiUrl}/students.php`, {
                    action: 'approve-session-extension-request',
                    request_id: Number(requestId),
                    branch_id: Number(managerBranchId || 0)
                });
                const data = response.data || {};
                if (data.success) {
                    showMessage(data.message || 'Session extension request approved.', 'success');
                    await loadPendingSessionExtensionRequests();
                } else {
                    showMessage(data.error || 'Failed to approve session extension request.', 'error');
                }
            } catch (error) {
                showMessage(error?.response?.data?.error || 'Network error while approving session extension request.', 'error');
            }
        }

        // Global handler for Schedule Sessions button
        window.handleScheduleClick = function(requestId) {
            try {
                if (window.onPendingRequestAssignClick) {
                    window.onPendingRequestAssignClick(requestId);
                } else {
                    openAssignRequestModal(requestId);
                }
            } catch (error) {
                console.error('Error in handleScheduleClick:', error);
            }
        };

        function openPendingRequestViewModal(requestId) {
            const req = pendingEnrollmentRequestsById[String(requestId)];
            if (!req) {
                showMessage('Request not found.', 'error');
                return;
            }

            const studentName = `${escapeHtml(req.first_name || '')} ${escapeHtml(req.last_name || '')}`.trim() || 'Student';
            const instruments = Array.isArray(req.instruments) && req.instruments.length
                ? req.instruments.map(i => {
                    return escapeHtml(i.type_name || i.instrument_name || 'Instrument');
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
                            <div><span class="font-semibold text-slate-900">Selected Instrument Type:</span> ${instruments}</div>
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

        function formatDateCompact(dateString) {
            const raw = String(dateString || '').trim();
            if (!raw) return '';
            const dt = new Date(raw);
            if (Number.isNaN(dt.getTime())) return raw;
            return new Intl.DateTimeFormat('en-US', {
                weekday: 'short',
                month: 'short',
                day: '2-digit',
                year: 'numeric'
            }).format(dt);
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
                    const label = teacher.teacher_name;
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

        function formatAssignRequestScheduleLabel(sessionDate, dayOfWeek, startTime, endTime) {
            const date = String(sessionDate || '').trim();
            const day = String(dayOfWeek || '').trim();
            const start = String(startTime || '').trim();
            const end = String(endTime || '').trim();
            if (!day || !start || !end) {
                return {
                    dateLabel: 'Choose from the calendar',
                    timeLabel: 'Select a slot',
                    subtitle: 'Pick a highlighted time on the right.'
                };
            }
            if (date) {
                return {
                    dateLabel: formatDateCompact(date) || formatDateLong(date) || date,
                    timeLabel: `${formatTime12Hour(start)} - ${formatTime12Hour(end)}`,
                    subtitle: `${day} recurring`
                };
            }
            return {
                dateLabel: day,
                timeLabel: `${formatTime12Hour(start)} - ${formatTime12Hour(end)}`,
                subtitle: 'Recurring'
            };
        }

        function updateAssignRequestSelectionSummary() {
            const summaryEl = document.getElementById('assignRequestSummary');
            if (!summaryEl) return;

            const row = activeAssignRequestSlotRow
                && document.getElementById('assignRequestSlotsContainer')?.contains(activeAssignRequestSlotRow)
                ? activeAssignRequestSlotRow
                : getAssignableAssignRequestSlotRow();

            const data = getAssignRequestRowData(row);
            const teacherName = row ? getAssignRequestRowTeacherName(row) : '';
            const schedule = formatAssignRequestScheduleLabel(
                data?.session_date || '',
                data?.day_of_week || '',
                data?.start_time || '',
                data?.end_time || ''
            );

            if (!data || (!data.session_date && !data.day_of_week && !data.start_time && !data.end_time)) {
                summaryEl.innerHTML = `
                    <div class="flex items-center gap-2 text-slate-500">
                        <i class="fas fa-calendar-day text-gold-500"></i>
                        <span>Choose a date and time from the calendar.</span>
                    </div>
                `;
                return;
            }

            summaryEl.innerHTML = `
                <div class="flex flex-wrap items-center gap-2">
                    <span class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-900 shadow-sm">
                        <i class="fas fa-calendar-day text-[11px] text-gold-500"></i>
                        <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Date</span>
                        <span class="text-sm font-semibold">${escapeHtml(schedule.dateLabel)}</span>
                    </span>
                    <span class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-900 shadow-sm">
                        <i class="fas fa-clock text-[11px] text-gold-500"></i>
                        <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Time</span>
                        <span class="text-sm font-semibold">${escapeHtml(schedule.timeLabel)}</span>
                    </span>
                    <span class="text-xs text-slate-500">
                        ${escapeHtml(teacherName ? `${teacherName} • ${schedule.subtitle}` : schedule.subtitle)}
                    </span>
                </div>
            `;
        }

        function updateAssignRequestRowScheduleDisplay(row) {
            if (!row) return;
            const dateEl = row.querySelector('.assign-request-slot-session-date');
            const dayEl = row.querySelector('.assign-request-slot-day');
            const startEl = row.querySelector('.assign-request-slot-start');
            const endEl = row.querySelector('.assign-request-slot-end');
            const dateValueEl = row.querySelector('.assign-request-slot-schedule-date-value');
            const timeValueEl = row.querySelector('.assign-request-slot-schedule-time-value');
            const subtitleEl = row.querySelector('.assign-request-slot-schedule-subtitle');
            const schedule = formatAssignRequestScheduleLabel(dateEl?.value || '', dayEl?.value || '', startEl?.value || '', endEl?.value || '');
            if (dateValueEl) dateValueEl.textContent = schedule.dateLabel;
            if (timeValueEl) timeValueEl.textContent = schedule.timeLabel;
            if (subtitleEl) subtitleEl.textContent = schedule.subtitle;
            row.dataset.scheduleSet = (dayEl?.value && startEl?.value && endEl?.value) ? '1' : '0';
            if (row === activeAssignRequestSlotRow) {
                updateAssignRequestSelectionSummary();
            }
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
            const sessionDate = String(slot.session_date || '').slice(0, 10);
            const schedule = formatAssignRequestScheduleLabel(sessionDate, day, start, end);
            return `
                <div class="assign-request-slot transition ${fixedRow ? 'border-gold-200 bg-amber-50/40' : (teacherLocked ? 'border-emerald-200 bg-emerald-50/30' : '')}" data-instrument-id="${instrument?.instrument_id || ''}" data-teacher-id="${teacherId || ''}" data-remove-locked="${removeLocked ? '1' : '0'}" data-teacher-locked="${teacherLocked ? '1' : '0'}">
                    <div class="assign-request-slot-header">
                        <div>
                            <div class="text-sm font-semibold text-slate-800">${escapeHtml(label)}</div>
                            ${fixedRow ? '<div class="text-xs text-amber-600 mt-0.5">Fixed slot</div>' : ''}
                        </div>
                        ${removeLocked ? '' : '<button type="button" class="assign-request-slot-remove assign-request-slot-trash" aria-label="Remove slot"><i class="fas fa-trash-can"></i></button>'}
                    </div>
                    <input type="hidden" class="assign-request-slot-instrument" value="${escapeHtml(String(instrument?.instrument_id || slot.instrument_id || ''))}">
                    <input type="hidden" class="assign-request-slot-session-date" value="${escapeHtml(sessionDate)}">
                    <input type="hidden" class="assign-request-slot-day" value="${escapeHtml(day)}">
                    <input type="hidden" class="assign-request-slot-start" value="${escapeHtml(start)}">
                    <input type="hidden" class="assign-request-slot-end" value="${escapeHtml(end)}">
                    <div class="space-y-3">
                        <div>
                            <label class="block text-xs font-medium text-slate-600 mb-1.5">Teacher</label>
                            ${renderTeacherControlForInstrument(instrument, teacherId, teacherLocked, index)}
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-slate-600 mb-1.5">Schedule</label>
                            <div class="assign-request-slot-schedule">
                                <div class="assign-request-slot-schedule-meta">
                                    <span class="assign-request-slot-schedule-chip">
                                        <i class="fas fa-calendar-day"></i>
                                        <span class="assign-request-slot-schedule-chip-label">Date</span>
                                        <strong class="assign-request-slot-schedule-title assign-request-slot-schedule-date-value">${escapeHtml(schedule.dateLabel)}</strong>
                                    </span>
                                    <span class="assign-request-slot-schedule-chip">
                                        <i class="fas fa-clock"></i>
                                        <span class="assign-request-slot-schedule-chip-label">Time</span>
                                        <strong class="assign-request-slot-schedule-title assign-request-slot-schedule-time-value">${escapeHtml(schedule.timeLabel)}</strong>
                                    </span>
                                </div>
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
            updateAssignRequestSelectionSummary();
        }

        function openPendingRequestPaymentModal(requestId) {
            const req = pendingEnrollmentRequestsById[String(requestId)];
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
                        queueLoadAssignRequestAvailability();
                        return;
                    }
                    updateAssignRequestRowScheduleDisplay(row);
                    updateAssignRequestRecurringSummary();
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
                session_date: slot.session_date || '',
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
                session_date: row.querySelector('.assign-request-slot-session-date')?.value || '',
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

        function openAssignRequestAvailabilityDatePicker(dateKey) {
            const normalizedDate = String(dateKey || '').trim();
            if (!normalizedDate) return;

            selectAssignRequestAvailabilityDate(normalizedDate);

            const groupedSlots = Array.isArray(assignRequestAvailabilitySlots)
                ? assignRequestAvailabilitySlots
                    .filter(slot => String(slot.session_date || '').trim() === normalizedDate)
                    .slice()
                    .sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')))
                : [];

            if (!groupedSlots.length || typeof Swal === 'undefined') {
                return;
            }

            const dateLabel = formatDateLong(normalizedDate) || normalizedDate;
            const slotCount = groupedSlots.length;

            Swal.fire({
                title: dateLabel,
                html: `
                    <div class="text-sm text-slate-500 mb-4">${slotCount} available slot${slotCount > 1 ? 's' : ''}</div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                        ${groupedSlots.map((slot, index) => `
                            <button
                                type="button"
                                class="assign-request-slot-picker-btn rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-100"
                                data-slot-index="${index}"
                            >
                                <div class="text-base font-bold text-emerald-800">${escapeHtml(`${formatTime12Hour(slot.start_time)} - ${formatTime12Hour(slot.end_time)}`)}</div>
                                <div class="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">${escapeHtml(slot.day_of_week || '')}</div>
                            </button>
                        `).join('')}
                    </div>
                `,
                showConfirmButton: false,
                showCloseButton: true,
                width: '42rem',
                heightAuto: false,
                padding: '1.5rem',
                customClass: {
                    popup: 'assign-request-slot-picker-popup',
                    htmlContainer: 'm-0',
                    title: 'text-lg font-bold text-slate-900'
                },
                didOpen: () => {
                    const popup = Swal.getPopup();
                    if (!popup) return;
                    popup.querySelectorAll('.assign-request-slot-picker-btn').forEach((button, index) => {
                        button.addEventListener('click', () => {
                            const slot = groupedSlots[index];
                            if (!slot) return;
                            applyAssignRequestAvailabilitySlot(
                                String(slot.session_date || ''),
                                String(slot.day_of_week || ''),
                                String(slot.start_time || ''),
                                String(slot.end_time || '')
                            );
                            Swal.close();
                        });
                    });
                }
            });
        }

        function renderAssignRequestAvailability(slots, selectedDate = '') {
            const listEl = document.getElementById('assignRequestAvailabilityList');
            if (!listEl) return;

            assignRequestAvailabilitySlots = Array.isArray(slots) ? slots.slice() : [];
            if (selectedDate) {
                assignRequestAvailabilitySelectedDate = selectedDate;
            }

            if (!Array.isArray(slots) || !slots.length) {
                assignRequestAvailabilityMonth = '';
                assignRequestAvailabilitySelectedDate = '';
                listEl.innerHTML = '<div class="text-sm text-slate-500">No available slots found.</div>';
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
            const resolvedSelectedDate = grouped[assignRequestAvailabilitySelectedDate]
                ? assignRequestAvailabilitySelectedDate
                : (availableDates.includes(selectedDate) ? selectedDate : availableDates[0]);
            assignRequestAvailabilitySelectedDate = resolvedSelectedDate;

            const monthSource = assignRequestAvailabilityMonth || resolvedSelectedDate || availableDates[0];
            const monthParts = String(monthSource).slice(0, 7).split('-');
            const monthDate = new Date(Number(monthParts[0]), Number(monthParts[1]) - 1, 1);
            if (Number.isNaN(monthDate.getTime())) {
                listEl.innerHTML = '<div class="text-sm text-slate-500">No available slots found.</div>';
                return;
            }
            const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
            assignRequestAvailabilityMonth = monthKey;

            const firstWeekday = monthDate.getDay();
            const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
            const cells = [];
            for (let i = 0; i < firstWeekday; i += 1) {
                cells.push('<div class="h-14 rounded-lg border border-transparent bg-transparent"></div>');
            }
            for (let day = 1; day <= daysInMonth; day += 1) {
                const dateKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const daySlots = grouped[dateKey] || [];
                const isSelected = dateKey === resolvedSelectedDate;
                const hasSlots = daySlots.length > 0;
                const baseClass = hasSlots
                    ? (isSelected ? 'border-gold-400 bg-gold-50 shadow-sm' : 'border-emerald-200 bg-white hover:border-emerald-300 hover:bg-emerald-50')
                    : 'border-slate-200 bg-slate-50 text-slate-300';
                cells.push(`
                    <button
                        type="button"
                        ${hasSlots ? `onclick="openAssignRequestAvailabilityDatePicker('${dateKey}')"` : 'disabled'}
                        class="h-14 rounded-lg border p-1.5 text-left transition ${baseClass} ${hasSlots ? '' : 'cursor-not-allowed'}"
                    >
                        <div class="flex items-start justify-between gap-2">
                            <span class="text-sm font-semibold leading-none ${hasSlots ? 'text-slate-900' : 'text-slate-400'}">${day}</span>
                            ${hasSlots ? `<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">${daySlots.length}</span>` : ''}
                        </div>
                        <div class="mt-0.5 text-[9px] ${hasSlots ? 'text-slate-500' : 'text-slate-400'} leading-tight">${hasSlots ? escapeHtml(daySlots[0].day_of_week || '') : 'Unavailable'}</div>
                    </button>
                `);
            }

            listEl.innerHTML = `
                <div class="space-y-3">
                    <div class="flex items-center justify-between gap-3">
                        <button type="button" onclick="setAssignRequestAvailabilityMonth('${shiftAssignAvailabilityMonth(monthKey, -1)}')" class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                            <i class="fas fa-chevron-left mr-2 text-[10px]"></i>Prev
                        </button>
                        <div class="text-sm font-semibold text-slate-900">${escapeHtml(formatAssignAvailabilityMonthLabel(monthKey))}</div>
                        <button type="button" onclick="setAssignRequestAvailabilityMonth('${shiftAssignAvailabilityMonth(monthKey, 1)}')" class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                            Next<i class="fas fa-chevron-right ml-2 text-[10px]"></i>
                        </button>
                    </div>
                    <div class="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                    </div>
                    <div class="grid grid-cols-7 gap-1.5">
                        ${cells.join('')}
                    </div>
                    <div class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                        Choose a highlighted date to view and pick a time slot.
                    </div>
                </div>
            `;
        }

        function applyAssignRequestAvailabilitySlot(sessionDate, dayOfWeek, startTime, endTime) {
            const dateEl = document.getElementById('assignRequestDate');
            if (dateEl) dateEl.value = sessionDate || '';
            const container = document.getElementById('assignRequestSlotsContainer');
            const targetRow = activeAssignRequestSlotRow && container?.contains(activeAssignRequestSlotRow)
                ? activeAssignRequestSlotRow
                : container?.querySelector('.assign-request-slot');
            if (targetRow) {
                setActiveAssignRequestSlot(targetRow);
                const dateInput = targetRow.querySelector('.assign-request-slot-session-date');
                const dayInput = targetRow.querySelector('.assign-request-slot-day');
                const startInput = targetRow.querySelector('.assign-request-slot-start');
                const endInput = targetRow.querySelector('.assign-request-slot-end');
                if (dateInput) dateInput.value = sessionDate || '';
                if (dayInput) dayInput.value = dayOfWeek || getDayNameFromDate(sessionDate || '');
                if (startInput) startInput.value = String(startTime || '').slice(0, 5);
                if (endInput) endInput.value = String(endTime || '').slice(0, 5);
                updateAssignRequestRowScheduleDisplay(targetRow);
            }
            loadAssignRequestAvailability();
        }

        function getAssignRequestAvailabilityCacheKey(teacherId, startDate) {
            return [
                Number(teacherId || 0),
                Number(activeAssignRequest?.branch_id || managerBranchId || 0),
                Number(activeAssignRequest?.student_id || 0),
                'teacher-availability'
            ].join('|');
        }

        function queueLoadAssignRequestAvailability() {
            if (assignRequestAvailabilityLoadTimer) {
                clearTimeout(assignRequestAvailabilityLoadTimer);
            }
            assignRequestAvailabilityLoadTimer = setTimeout(() => {
                assignRequestAvailabilityLoadTimer = null;
                loadAssignRequestAvailability();
            }, 50);
        }

        async function loadAssignRequestAvailability() {
            const listEl = document.getElementById('assignRequestAvailabilityList');
            const selectedDate = document.getElementById('assignRequestDate')?.value || assignRequestAvailabilitySelectedDate || '';
            const activeRow = getAssignableAssignRequestSlotRow();
            const activeSlotData = getAssignRequestRowData(activeRow);
            const teacherId = Number(activeSlotData?.teacher_id || 0);
            const activeRowTeacherLabel = activeRow ? getAssignRequestRowTeacherName(activeRow) : '';
            if (!listEl) return;

            if (!activeAssignRequest || !teacherId) {
                assignRequestAvailabilitySlots = [];
                assignRequestAvailabilityMonth = '';
                assignRequestAvailabilitySelectedDate = '';
                listEl.innerHTML = `
                    <div class="flex items-center justify-center h-64">
                        <div class="text-center">
                            <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 text-slate-400 mb-3">
                                <i class="fas fa-user-tie text-2xl"></i>
                            </div>
                            <p class="text-sm font-medium text-slate-600">No teacher selected</p>
                            <p class="text-xs text-slate-500 mt-1">Select a teacher from the slot to view their schedule</p>
                        </div>
                    </div>
                `;
                return;
            }

            const cacheKey = getAssignRequestAvailabilityCacheKey(teacherId, selectedDate);
            const cachedSlots = assignRequestAvailabilityCache.get(cacheKey);
            if (cachedSlots) {
                assignRequestAvailabilitySlots = Array.isArray(cachedSlots.availability_rows) ? cachedSlots.availability_rows : [];
                renderAssignRequestAvailability(assignRequestAvailabilitySlots, selectedDate);
                return;
            }

            listEl.innerHTML = `
                <div class="flex items-center justify-center h-64">
                    <div class="text-center">
                        <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-50 text-blue-600 mb-2">
                            <i class="fas fa-spinner fa-spin text-xl"></i>
                        </div>
                        <p class="text-sm font-semibold text-slate-700">Loading schedule...</p>
                        <p class="text-xs text-slate-500 mt-1">${escapeHtml(activeRowTeacherLabel || 'Please wait')}</p>
                    </div>
                </div>
            `;

            const requestToken = ++assignRequestAvailabilityRequestToken;
            try {
                const params = new URLSearchParams({
                    action: 'get-teacher-available-slots',
                    teacher_id: teacherId,
                    branch_id: Number(activeAssignRequest.branch_id || managerBranchId || 0),
                    student_id: Number(activeAssignRequest.student_id || 0)
                });
                if (selectedDate) params.append('start_date', selectedDate);

                const response = await axios.get(`${baseApiUrl}/students.php?${params.toString()}`, {
                    timeout: 30000 // Increased to 30 seconds for complex availability queries
                });
                if (requestToken !== assignRequestAvailabilityRequestToken) return;
                const data = response.data || {};
                const availabilityRows = Array.isArray(data.slots) ? data.slots : [];
                assignRequestAvailabilitySlots = availabilityRows;
                assignRequestAvailabilityCache.set(cacheKey, { availability_rows: availabilityRows });
                renderAssignRequestAvailability(availabilityRows, selectedDate);
            } catch (error) {
                if (requestToken !== assignRequestAvailabilityRequestToken) return;
                
                console.error('Failed to load availability:', error);
                const status = Number(error?.response?.status || 0);
                const isTimeout = error?.code === 'ECONNABORTED' || error?.message?.includes('timeout');
                
                if (status === 403) {
                    listEl.innerHTML = `
                        <div class="flex items-center justify-center h-64">
                            <div class="text-center max-w-sm px-4">
                                <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 text-amber-600 mb-3">
                                    <i class="fas fa-triangle-exclamation text-xl"></i>
                                </div>
                                <p class="text-sm font-semibold text-slate-800">You do not have permission to view this teacher's availability.</p>
                                <p class="text-xs text-slate-500 mt-1">Try selecting a teacher in your branch, or ask a manager to assign it.</p>
                            </div>
                        </div>
                    `;
                    return;
                }
                
                if (isTimeout) {
                    listEl.innerHTML = `
                        <div class="flex items-center justify-center h-64">
                            <div class="text-center max-w-sm px-4">
                                <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 text-amber-600 mb-3">
                                    <i class="fas fa-clock text-xl"></i>
                                </div>
                                <p class="text-sm font-semibold text-slate-800">Loading is taking longer than expected.</p>
                                <p class="text-xs text-slate-500 mt-1">The teacher's schedule is being calculated. Please try again in a moment.</p>
                                <button onclick="loadAssignRequestAvailability()" class="mt-3 px-4 py-2 rounded-lg bg-gold-500 hover:bg-gold-600 text-white text-sm font-semibold transition">
                                    Retry
                                </button>
                            </div>
                        </div>
                    `;
                    return;
                }

                listEl.innerHTML = `
                    <div class="flex items-center justify-center h-64">
                        <div class="text-center max-w-sm px-4">
                            <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-50 text-red-600 mb-3">
                                <i class="fas fa-triangle-exclamation text-xl"></i>
                            </div>
                            <p class="text-sm font-semibold text-slate-800">Unable to load schedule.</p>
                            <p class="text-xs text-slate-500 mt-1">Check your connection and try again.</p>
                            <button onclick="loadAssignRequestAvailability()" class="mt-3 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition">
                                Retry
                            </button>
                        </div>
                    </div>
                `;
            }
        }

        async function openAssignRequestModal(requestId) {
            const req = pendingEnrollmentRequestsById[String(requestId)];
            if (!req) {
                showMessage('Request not found.', 'error');
                return;
            }

            const modal = document.getElementById('assignRequestModal');
            const requestIdEl = document.getElementById('assignRequestId');
            const studentNameEl = document.getElementById('assignRequestStudentName');
            const studentBranchEl = document.getElementById('assignRequestStudentBranch');
            const studentPackageEl = document.getElementById('assignRequestStudentPackage');
            const studentInstrumentEl = document.getElementById('assignRequestStudentInstrument');
            const dateEl = document.getElementById('assignRequestDate');
            const slotsContainer = document.getElementById('assignRequestSlotsContainer');
            const notesEl = document.getElementById('assignRequestNotes');

            if (!modal || !requestIdEl || !dateEl || !slotsContainer || !notesEl) {
                console.error('Missing required modal elements');
                return;
            }

            const studentName = `${req.first_name || ''} ${req.last_name || ''}`.trim();
            const instrumentSummary = Array.isArray(req.instruments) && req.instruments.length
                ? req.instruments.map(i => {
                    return escapeHtml(i.type_name || i.instrument_name || 'Instrument');
                }).join(', ')
                : '—';
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
            assignRequestTeacherCache.clear();
            assignRequestAvailabilityRequestToken += 1;
            if (assignRequestAvailabilityLoadTimer) {
                clearTimeout(assignRequestAvailabilityLoadTimer);
                assignRequestAvailabilityLoadTimer = null;
            }

            const todayYmd = new Date(Date.now() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
            dateEl.min = todayYmd;
            dateEl.value = todayYmd;
            slotsContainer.innerHTML = '';
            activeAssignRequestSlotRow = null;
            notesEl.value = '';
            updateAssignRequestRecurringSummary();

            modal.classList.remove('hidden');
            modal.classList.add('flex');
            await nextFrame();
            if (!modal.classList.contains('flex')) {
                return;
            }
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
            queueLoadAssignRequestAvailability();
        }

        // Expose globally
        window.openAssignRequestModal = openAssignRequestModal;

        function closeAssignRequestModal() {
            const modal = document.getElementById('assignRequestModal');
            if (!modal) return;
            activeAssignRequest = null;
            assignRequestInstruments = [];
            assignRequestAvailabilitySlots = [];
            assignRequestBookedSessions = [];
            assignRequestAvailabilityMonth = '';
            assignRequestAvailabilitySelectedDate = '';
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
                const branchId = getEnrollmentBranchId();
                let url = `${baseApiUrl}/students.php?action=get-active-enrollments`;
                if (branchId > 0) {
                    url += `&branch_id=${encodeURIComponent(branchId)}`;
                }

                const response = await axios.get(url);
                const data = response.data;

                if (data.success && Array.isArray(data.enrollments)) {
                    allStudents = data.enrollments;
                    renderStudents(tableBody);
                    if (countEl) countEl.textContent = `${data.enrollments.length} active`;
                    updateEnrollmentSummary(); // Update tab counts
                } else {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="6" class="px-4 py-6 text-center text-slate-500">
                                <i class="fas fa-users text-3xl mb-2 text-gold-500/50"></i>
                                <p>${uiIsDesk ? 'No active enrollments found.' : 'No active sessions found.'}</p>
                            </td>
                        </tr>`;
                    if (countEl) countEl.textContent = '0 active';
                    updateEnrollmentSummary(); // Update tab counts even when empty
                }
            } catch (error) {
                console.error('Failed to load active sessions:', error);
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-4 py-6 text-center text-red-500">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <p>Failed to load active enrollments. Please try again.</p>
                        </td>
                    </tr>`;
            }
        }

        function renderStudents(tableBody) {
            const rows = (Array.isArray(allStudents) ? allStudents : []).filter(student => {
                if (!matchesSelectedBranch(student.branch_id, student.branch_name)) return false;
                return matchesEnrollmentSearch([
                    `${student.first_name || ''} ${student.last_name || ''}`,
                    student.email,
                    student.branch_name,
                    student.package_name,
                    student.teacher_first_name,
                    student.teacher_last_name,
                    student.first_session_date
                ]);
            });

            const countEl = document.getElementById('studentCount');
            if (countEl) countEl.textContent = `${rows.length} active`;
            
            // Update tab count
            const activeTabCountEl = document.getElementById('activeTabCount');
            if (activeTabCountEl) activeTabCountEl.textContent = String(allStudents.length);

            if (!rows.length) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-4 py-6 text-center text-slate-500">
                            <i class="fas fa-users text-3xl mb-2 text-gold-500/50"></i>
                            <p>No active enrollments found.</p>
                        </td>
                    </tr>`;
                return;
            }

            tableBody.innerHTML = rows.map(student => {
                const packageName = student.package_name || '—';
                const totalAmount = Number(student.total_amount || 0);
                const paidAmount = Number(student.paid_amount || 0);
                const balance = Math.max(0, totalAmount - paidAmount);

                return `
                    <tr class="hover:bg-slate-50/80 transition">
                        <td class="px-3 py-2.5">
                            <div class="font-semibold text-sm text-slate-900">${escapeHtml(student.first_name || '')} ${escapeHtml(student.last_name || '')}</div>
                            <div class="text-xs text-slate-600">${escapeHtml(student.email || '')}</div>
                        </td>
                        <td class="px-3 py-2.5 text-sm text-slate-700">${escapeHtml(packageName)}</td>
                        <td class="px-3 py-2.5 text-sm text-slate-700 font-semibold">${formatCurrencyPHP(totalAmount)}</td>
                        <td class="px-3 py-2.5 text-sm text-emerald-700 font-semibold">${formatCurrencyPHP(paidAmount)}</td>
                        <td class="px-3 py-2.5 text-sm ${balance > 0 ? 'text-red-600' : 'text-slate-700'} font-semibold">${formatCurrencyPHP(balance)}</td>
                        <td class="px-3 py-2.5">
                            <button type="button" class="rounded-md bg-blue-100 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-200" onclick="openEnrollmentDetailsModal(${Number(student.enrollment_id)})">
                                Details
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
                const displayName = `${String(user.first_name || '').trim()} ${String(user.last_name || '').trim()}`.trim()
                    || user.username || user.email || (isDesk ? 'Front Desk' : 'Manager');
                if (typeof syncDeskNavUser === 'function') {
                    syncDeskNavUser();
                } else {
                    const userNameNav = document.getElementById('userNameNav');
                    const profileMenuName = document.getElementById('profileMenuName');
                    if (userNameNav) userNameNav.textContent = displayName;
                    if (profileMenuName) profileMenuName.textContent = displayName;
                }
                if (!isDesk && typeof window.syncManagerShell === 'function') {
                    window.syncManagerShell(displayName, managerBranchName, user.email || user.username || '');
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
            await loadBranchesForFilter();

            await Promise.all([
                loadSessionPackages(),
                loadWalkinStudents()
            ]);

            await loadPendingRequests();
            await loadPendingSessionExtensionRequests();
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
            document.getElementById('submitAssignRequestBtn')?.addEventListener('click', function(e) {
                e.preventDefault();
                submitAssignRequestForm(e);
            });
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
            document.getElementById('openSessionExtensionRequestsModalBtn')?.addEventListener('click', openSessionExtensionRequestsModal);
            document.getElementById('closeSessionExtensionRequestsModalBtn')?.addEventListener('click', closeSessionExtensionRequestsModal);
            document.getElementById('sessionExtensionRequestsModal')?.addEventListener('click', (event) => {
                if (event.target?.id === 'sessionExtensionRequestsModal') {
                    closeSessionExtensionRequestsModal();
                }
            });
            document.getElementById('branchFilter')?.addEventListener('change', () => {
                loadPendingRequests();
                loadPendingSessionExtensionRequests();
                loadActiveStudents();
                applySessionView();
            });
            document.getElementById('enrollmentSearchInput')?.addEventListener('input', () => {
                renderPendingRequests();
                renderSessionExtensionRequests();
                renderStudents(document.getElementById('studentsTable'));
                updateEnrollmentSummary();
            });
            document.getElementById('openWalkinRegistrationModalBtn')?.addEventListener('click', openWalkinRegistrationModal);
            document.getElementById('closeRegisterStudentModalBtn')?.addEventListener('click', closeWalkinRegistrationModal);
            document.getElementById('cancelRegisterStudentBtn')?.addEventListener('click', closeWalkinRegistrationModal);
            document.getElementById('openWalkinEnrollmentModalBtn')?.addEventListener('click', openWalkinEnrollmentModal);
            document.getElementById('closeWalkinEnrollmentModalBtn')?.addEventListener('click', closeWalkinEnrollmentModal);
            document.getElementById('cancelWalkinEnrollmentBtn')?.addEventListener('click', closeWalkinEnrollmentModal);
            document.getElementById('walkinEnrollmentForm')?.addEventListener('submit', submitWalkinEnrollment);
            document.getElementById('addSessionsBtn')?.addEventListener('click', showAddSessionsModal);
            document.getElementById('walkinStudentSearch')?.addEventListener('input', handleWalkinStudentChange);
            document.getElementById('walkinStudentSearch')?.addEventListener('change', handleWalkinStudentChange);
            document.getElementById('walkinSessionSelect')?.addEventListener('change', () => updateWalkinPackageUI());
            document.getElementById('walkinPackageCards')?.addEventListener('click', (event) => {
                const button = event.target.closest('.walkin-package-card');
                if (!button) return;
                selectWalkinSessionPackage(button.getAttribute('data-session-count'));
            });
            document.getElementById('walkinPaymentTypeCards')?.addEventListener('click', (event) => {
                const button = event.target.closest('.walkin-choice-card');
                if (!button) return;
                selectWalkinPaymentType(button.getAttribute('data-payment-type'));
            });
            document.getElementById('walkinStudentResults')?.addEventListener('click', async (event) => {
                const button = event.target.closest('.walkin-student-result');
                if (!button) return;
                const email = String(button.getAttribute('data-student-email') || '').trim().toLowerCase();
                const student = walkinStudents.find(item => String(item.email || '').trim().toLowerCase() === email);
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
                syncWalkinSessionSelectUI();
            });
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
        window.loadAssignRequestAvailability = loadAssignRequestAvailability;
        window.selectAssignRequestAvailabilityDate = selectAssignRequestAvailabilityDate;
        window.setAssignRequestAvailabilityMonth = setAssignRequestAvailabilityMonth;
