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
        let assignRequestReservedSlots = [];
        let assignRequestOccupiedSlots = [];
        let assignRequestAvailabilityTeacherId = 0;
        let assignRequestBookedSessions = [];
        let assignRequestAvailabilityMonth = '';
        let assignRequestAvailabilitySelectedDate = '';
        let assignRequestAvailabilityLoadTimer = null;
        let assignRequestAvailabilityRequestToken = 0;
        let assignRequestCalendarInitialized = false;
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

        function getEnrollmentStudentDisplayId(student) {
            const savedCode = String(student?.student_code || '').trim();
            if (savedCode) return savedCode;
            const numericId = Number(student?.student_id || 0);
            const createdAt = new Date(student?.student_created_at || student?.created_at || '');
            const year = Number.isNaN(createdAt.getTime()) ? new Date().getFullYear() : createdAt.getFullYear();
            return numericId > 0 ? `STU-${year}-${String(numericId).padStart(4, '0')}` : 'ID unavailable';
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
            return keyword === specialization;
        }

        function teacherMatchesInstrument(teacher, instrument) {
            if (!instrument) return false;
            const specializations = splitTeacherSpecializations(teacher?.specialization || '');
            if (!specializations.length) return false;
            if (specializations.some(isGeneralTeacherSpecialization)) return false;

            const keywords = getInstrumentKeywords(instrument);
            const typeName = normalizeText(instrument?.type_name || '');
            const instrumentTypeId = Number(instrument?.type_id || 0);
            const teacherTypeIds = Array.isArray(teacher?.specialization_type_ids)
                ? teacher.specialization_type_ids.map(Number)
                : String(teacher?.specialization_type_ids || '').split(',').map(Number);

            if (instrumentTypeId > 0 && teacherTypeIds.some(typeId => typeId === instrumentTypeId)) return true;
            if (instrumentTypeId > 0 && teacherTypeIds.some(typeId => typeId > 0)) return false;

            return specializations.some(spec => {
                if (typeName && spec === typeName) return true;
                return keywords.some(keyword => keywordMatchesSpecialization(keyword, spec));
            });
        }

        function getTeachersForInstrument(instrument) {
            const teachers = Array.isArray(assignRequestTeacherCandidates) ? assignRequestTeacherCandidates : [];
            const key = [
                instrument?.instrument_id || '',
                instrument?.type_id || '',
                instrument?.instrument_name || '',
                instrument?.type_name || '',
                teachers.length,
                teachers.map(teacher => `${teacher.teacher_id || ''}:${teacher.specialization || ''}:${teacher.specialization_type_ids || ''}`).join('|')
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
            return String(instrument.type_name || instrument.instrument_name || `Instrument ${index + 1}`).trim();
        }

        function getUniqueAssignRequestInstruments(instruments) {
            const seen = new Set();
            return (Array.isArray(instruments) ? instruments : []).filter((instrument, index) => {
                const instrumentId = Number(instrument?.instrument_id || 0);
                const typeId = Number(instrument?.type_id || 0);
                const name = normalizeText(instrument?.type_name || instrument?.instrument_name || '');
                const key = instrumentId > 0
                    ? `instrument:${instrumentId}`
                    : typeId > 0
                        ? `type:${typeId}`
                        : `name:${name || index}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
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
                if (pageSubtitle) pageSubtitle.textContent = 'Review requested schedules, confirm available times, or adjust conflicts.';
                if (branchScopeLabel) branchScopeLabel.textContent = 'Enrollments are locked to your branch:';
                if (pendingTitle) pendingTitle.innerHTML = '<i class="fas fa-inbox mr-2 text-gold-500"></i>Pending Enrollments';
                if (activeTitle) activeTitle.innerHTML = '<i class="fas fa-user-check mr-2 text-gold-500"></i>Active Enrollments';
                window.pendingRequestActionLabel = 'Review Schedule';
                window.onPendingRequestAssignClick = function(requestId) {
                    openPendingRequestScheduleModal(requestId);
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

            const meta = await fetchStudentRequestMetaByEmail(hidden.value, { staffContext: true });
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

        let paymentProofPreviewReturnRequestId = 0;

        function ensurePaymentProofPreviewModal() {
            if (document.getElementById('paymentProofPreviewModal')) return;
            document.body.insertAdjacentHTML('beforeend', `
                <div id="paymentProofPreviewModal" class="fixed inset-0 hidden items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6" style="z-index: 10000" role="dialog" aria-modal="true" aria-labelledby="paymentProofPreviewTitle">
                    <div class="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                        <div class="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-5">
                            <div class="min-w-0">
                                <div class="text-[10px] font-bold uppercase tracking-[.2em] text-emerald-600">Proof of payment</div>
                                <h3 id="paymentProofPreviewTitle" class="truncate text-base font-black text-slate-900 sm:text-lg">Payment proof</h3>
                            </div>
                            <button type="button" id="closePaymentProofPreviewBtn" class="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100" aria-label="Close payment proof preview"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="relative min-h-[260px] flex-1 overflow-auto bg-slate-950 p-3 sm:min-h-[520px] sm:p-5">
                            <img id="paymentProofPreviewImage" class="mx-auto hidden max-h-[78vh] max-w-full rounded-lg object-contain shadow-xl" alt="Uploaded payment proof">
                            <iframe id="paymentProofPreviewFrame" class="hidden h-[75vh] w-full rounded-lg border-0 bg-white" title="Uploaded payment proof document"></iframe>
                            <div id="paymentProofPreviewError" class="absolute inset-0 hidden items-center justify-center p-6 text-center text-sm text-slate-300">This file could not be previewed.</div>
                        </div>
                    </div>
                </div>
            `);
            const modal = document.getElementById('paymentProofPreviewModal');
            document.getElementById('closePaymentProofPreviewBtn')?.addEventListener('click', closePaymentProofPreviewModal);
            modal?.addEventListener('click', event => {
                if (event.target === modal) closePaymentProofPreviewModal();
            });
            document.addEventListener('keydown', event => {
                if (event.key !== 'Escape' || modal?.classList.contains('hidden')) return;
                event.preventDefault();
                event.stopImmediatePropagation();
                closePaymentProofPreviewModal();
            }, true);
        }

        function openPaymentProofPreviewModal(fileUrl, studentName = '', returnRequestId = 0) {
            const url = String(fileUrl || '').trim();
            if (!url) return;
            ensurePaymentProofPreviewModal();
            const modal = document.getElementById('paymentProofPreviewModal');
            const title = document.getElementById('paymentProofPreviewTitle');
            const image = document.getElementById('paymentProofPreviewImage');
            const frame = document.getElementById('paymentProofPreviewFrame');
            const error = document.getElementById('paymentProofPreviewError');
            if (!modal || !image || !frame || !error) return;
            paymentProofPreviewReturnRequestId = Number(returnRequestId || 0);
            if (title) title.textContent = studentName ? `${studentName} — Payment Proof` : 'Payment Proof';
            image.classList.add('hidden');
            frame.classList.add('hidden');
            error.classList.add('hidden');
            error.classList.remove('flex');
            image.removeAttribute('src');
            frame.removeAttribute('src');
            const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
            if (cleanUrl.endsWith('.pdf')) {
                frame.src = url;
                frame.classList.remove('hidden');
            } else {
                image.onload = () => {
                    image.classList.remove('hidden');
                    error.classList.add('hidden');
                    error.classList.remove('flex');
                };
                image.onerror = () => {
                    image.classList.add('hidden');
                    error.classList.remove('hidden');
                    error.classList.add('flex');
                };
                image.src = url;
            }
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function closePaymentProofPreviewModal() {
            const modal = document.getElementById('paymentProofPreviewModal');
            const image = document.getElementById('paymentProofPreviewImage');
            const frame = document.getElementById('paymentProofPreviewFrame');
            if (!modal) return;
            const returnRequestId = paymentProofPreviewReturnRequestId;
            paymentProofPreviewReturnRequestId = 0;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            if (image) image.removeAttribute('src');
            if (frame) frame.removeAttribute('src');
            if (returnRequestId > 0) {
                setTimeout(() => openPendingRequestPaymentModal(returnRequestId), 80);
            }
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
                            <span class="mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${r.schedule_request_status === 'Schedule Conflict' ? 'bg-red-100 text-red-700' : r.schedule_request_status === 'Suggested' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-800'}">${escapeHtml(r.schedule_request_status || 'Pending')}</span>
                        </td>
                        <td class="px-3 py-2.5 text-sm text-slate-700">${pkg}</td>
                        <td class="px-3 py-2.5 text-sm text-slate-700">${instruments}</td>
                        <td class="px-3 py-2.5 text-sm text-slate-700">
                            <button type="button" onclick="openPendingRequestScheduleModal(${Number(r.request_id)})" class="group block w-full min-w-[220px] max-w-xs rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-left transition hover:border-blue-300 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1" aria-label="Review schedule request for ${studentName || 'student'}">
                                <span class="mb-1 flex items-center justify-between gap-2">
                                    <span class="text-[11px] font-bold text-blue-700"><i class="fas fa-calendar-alt mr-1" aria-hidden="true"></i>Requested schedule</span>
                                    <span class="text-[10px] font-semibold text-blue-500">Review <i class="fas fa-chevron-right ml-0.5 transition group-hover:translate-x-0.5" aria-hidden="true"></i></span>
                                </span>
                                ${renderPendingRequestScheduleCell(r)}
                            </button>
                        </td>
                        <td class="px-3 py-2.5 text-sm text-slate-700">
                            <button type="button" onclick="openPendingRequestPaymentModal(${Number(r.request_id)})" class="group inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-left transition hover:border-emerald-300 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1">
                                <span class="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white text-emerald-600 shadow-sm">
                                    <i class="fas fa-wallet" aria-hidden="true"></i>
                                </span>
                                <span>
                                    <span class="block text-xs font-bold text-emerald-700">Payment info</span>
                                    <span class="mt-0.5 block whitespace-nowrap text-xs text-slate-600">${escapeHtml(r.payment_method || 'No method selected')}</span>
                                </span>
                                <i class="fas fa-chevron-right text-[10px] text-emerald-400 transition group-hover:translate-x-0.5" aria-hidden="true"></i>
                            </button>
                        </td>
                        <td class="px-3 py-2.5">
                            <div class="flex flex-nowrap items-center gap-1.5">
                                <button onclick="openPendingRequestViewModal(${Number(r.request_id)})" class="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                                    View
                                </button>
                                <button onclick="handleScheduleClick(${Number(r.request_id)})" class="rounded-md bg-green-100 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-200">
                                    Approve Schedule
                                </button>
                                ${!r.is_walkin_request ? `<button onclick="suggestStudentRequest(${Number(r.request_id)})" class="rounded-md bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-200">Suggest New Schedule</button>` : ''}
                                <button onclick="rejectStudentRequest(${Number(r.request_id)})" class="rounded-md bg-red-100 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200">
                                    Reject Request
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
                const purchasedSessions = `${Number(req.requested_sessions || 1)} session${Number(req.requested_sessions || 1) === 1 ? '' : 's'}`;
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
                        <td class="px-4 py-3 text-sm sm:text-base text-slate-700"><div class="font-semibold">${purchasedSessions}</div><div class="text-xs text-slate-400">Schedule required for approval</div></td>
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
                                Schedule &amp; Approve
                            </button>
                            <button type="button" onclick="rejectSessionExtensionRequest(${Number(req.request_id)})" class="ml-2 px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-sm font-bold">Reject</button>
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
            window.location.href = `desk_sessions.html?session_request_id=${encodeURIComponent(requestId)}`;
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
                            <div><span class="font-semibold text-slate-900">Requested Schedule:</span> ${escapeHtml(formatPendingRequestSchedule(req))}</div>
                            <div><span class="font-semibold text-slate-900">Payment Type:</span> ${paymentType}</div>
                            <div><span class="font-semibold text-slate-900">Payment Method:</span> ${paymentMethod}</div>
                            <div><span class="font-semibold text-slate-900">Amount Paid:</span> ${formatCurrencyPHP(payableNow)}</div>
                            <div><span class="font-semibold text-slate-900">Package Amount:</span> ${formatCurrencyPHP(packageAmount)}</div>
                        </div>
                        <div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">The requested time is pending. Confirm it after checking the instructor and room, or choose another available schedule if it conflicts.</div>
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

        async function rejectSessionExtensionRequest(requestId) {
            const request = pendingSessionExtensionRequestsById[String(requestId)]
                || allSessionExtensionRequests.find(row => String(row.request_id) === String(requestId));
            if (!request) return showMessage('Session extension request not found.', 'error');
            const result = await Swal.fire({
                icon: 'warning',
                title: 'Reject additional sessions?',
                input: 'text',
                inputPlaceholder: 'Reason (optional)',
                showCancelButton: true,
                confirmButtonText: 'Reject',
                confirmButtonColor: '#dc2626'
            });
            if (!result.isConfirmed) return;
            try {
                const response = await axios.post(`${baseApiUrl}/students.php`, {
                    action: 'reject-session-extension-request',
                    request_id: Number(requestId),
                    branch_id: Number(request.branch_id || managerBranchId || 0),
                    admin_notes: result.value || ''
                });
                const data = response.data || {};
                if (!data.success) return showMessage(data.error || 'Failed to reject request.', 'error');
                showMessage(data.message || 'Additional-session request rejected.', 'success');
                await loadPendingSessionExtensionRequests();
            } catch (error) {
                showMessage(error?.response?.data?.error || 'Network error while rejecting request.', 'error');
            }
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

        function formatPendingRequestSchedule(request) {
            const first = getPendingRequestPreferredSlots(request)[0] || {};
            const date = formatDateCompact(first.session_date || '');
            const day = String(first.day_of_week || '').trim();
            const start = first.start_time ? formatTime12Hour(first.start_time) : '';
            const end = first.end_time ? formatTime12Hour(first.end_time) : '';
            const datePart = date || day || 'No preferred date';
            const timePart = start && end ? `${start} - ${end}` : (start || 'No preferred time');
            const count = getPendingRequestPreferredSlots(request).length;
            return `${datePart} • ${timePart}${count > 1 ? ` (+${count - 1} more)` : ''}`;
        }

        function getPendingRequestPreferredSlots(request) {
            const saved = Array.isArray(request?.preferred_slots) ? request.preferred_slots : [];
            if (saved.length) return saved.map(slot => ({
                teacher_id: Number(slot.teacher_id || request?.preferred_teacher_id || 0),
                teacher_name: String(slot.teacher_name || ''),
                session_date: String(slot.session_date || '').trim(),
                day_of_week: String(slot.day_of_week || getDayNameFromDate(slot.session_date) || '').trim(),
                start_time: String(slot.start_time || '').slice(0, 5),
                end_time: String(slot.end_time || '').slice(0, 5)
            }));
            return [{
                teacher_id: Number(request?.preferred_teacher_id || 0),
                teacher_name: '',
                session_date: String(request?.preferred_date || '').trim(),
                day_of_week: String(request?.preferred_day_of_week || getDayNameFromDate(request?.preferred_date) || '').trim(),
                start_time: String(request?.preferred_start_time || '').slice(0, 5),
                end_time: String(request?.preferred_end_time || '').slice(0, 5)
            }];
        }

        function getPendingRequestPreferredTeacherName(request, slot = {}) {
            const savedName = String(slot.teacher_name || '').trim();
            if (savedName) return savedName;
            const teacherId = Number(slot.teacher_id || request?.preferred_teacher_id || 0);
            const candidate = (Array.isArray(request?.teacher_candidates) ? request.teacher_candidates : [])
                .find(teacher => Number(teacher.teacher_id || 0) === teacherId);
            return String(candidate?.teacher_name || '').trim() || (teacherId > 0 ? `Instructor #${teacherId}` : 'No preferred instructor');
        }

        function renderPendingRequestScheduleCell(request) {
            const slots = getPendingRequestPreferredSlots(request).filter(slot => slot.session_date || slot.day_of_week || slot.start_time);
            if (!slots.length) {
                return '<div class="text-xs font-semibold text-slate-500">No preferred date or time</div>';
            }
            const first = slots[0];
            const dateLabel = first.day_of_week ? `Every ${first.day_of_week}` : (formatDateCompact(first.session_date) || 'No preferred date');
            const timeLabel = first.start_time && first.end_time
                ? `${formatTime12Hour(first.start_time)} - ${formatTime12Hour(first.end_time)}`
                : 'No preferred time';
            const teacherName = getPendingRequestPreferredTeacherName(request, first);
            const moreLabel = slots.length > 1
                ? `<span class="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">+${slots.length - 1} day${slots.length === 2 ? '' : 's'}</span>`
                : '';
            return `<div class="min-w-0"><div class="flex items-center gap-1.5"><span class="truncate text-xs font-bold text-slate-900">${escapeHtml(dateLabel)}</span>${moreLabel}</div><div class="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] text-slate-600"><span class="shrink-0">${escapeHtml(timeLabel)}</span><span class="text-slate-300">•</span><span class="truncate font-semibold text-emerald-700"><i class="fas fa-chalkboard-user mr-1" aria-hidden="true"></i>${escapeHtml(teacherName)}</span></div></div>`;
        }

        function openPendingRequestRecurringDates(requestId, slotIndex) {
            const request = pendingEnrollmentRequestsById[String(requestId)];
            const slots = getPendingRequestPreferredSlots(request);
            const slot = slots[slotIndex];
            if (!request || !slot || typeof Swal === 'undefined') return;
            const dates = buildAssignRequestProjectedDates(slots, Number(request.sessions || 12))[slotIndex] || [];
            Swal.fire({
                title: `Every ${slot.day_of_week || 'selected day'}`,
                html: `<div class="text-left"><div class="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"><strong>${escapeHtml(`${formatTime12Hour(slot.start_time)} - ${formatTime12Hour(slot.end_time)}`)}</strong><div class="mt-1 text-xs">Projected lesson dates for the requested package.</div></div><div class="max-h-72 space-y-2 overflow-y-auto">${dates.map((date, index) => `<div class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2"><span class="grid h-7 w-7 place-items-center rounded-full bg-blue-100 text-xs font-black text-blue-700">${index + 1}</span><span class="text-sm font-semibold text-slate-800">${escapeHtml(formatDateLong(date) || date)}</span></div>`).join('') || '<div class="text-sm text-slate-500">No projected dates available.</div>'}</div></div>`,
                confirmButtonText: 'Close',
                confirmButtonColor: '#2563eb',
                width: '32rem'
            });
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
            return activeRow || rows[0] || null;
        }

        function getAssignRequestRowData(row) {
            if (!row) return null;
            return {
                instrument_id: Number(row.querySelector('.assign-request-slot-instrument')?.value || row.dataset.instrumentId || 0) || null,
                teacher_id: getAssignRequestRowTeacherId(row),
                session_date: row.querySelector('.assign-request-slot-session-date')?.value || '',
                day_of_week: row.querySelector('.assign-request-slot-day')?.value || '',
                start_time: row.querySelector('.assign-request-slot-start')?.value || '',
                end_time: row.querySelector('.assign-request-slot-end')?.value || ''
            };
        }

        function renderTeacherControlForInstrument(instrument, selectedTeacherId = '', lockTeacher = false, rowIndex = null) {
            const teachers = getTeachersForInstrument(instrument);
            const resolvedTeacherId = Number(selectedTeacherId || 0) || null;
            const fallbackTeacher = teachers.length === 1 ? teachers[0] : null;
            const teacherIdToUse = resolvedTeacherId || Number(fallbackTeacher?.teacher_id || 0) || 0;

            const options = teachers.length
                ? teachers.map(teacher => {
                    const selected = Number(teacher.teacher_id) === Number(teacherIdToUse);
                    const label = teacher.teacher_name;
                    return `<option value="${Number(teacher.teacher_id)}"${selected ? ' selected' : ''}>${escapeHtml(label || 'Teacher')}</option>`;
                }).join('')
                : '<option value="">No matching teacher found</option>';
            return `
                <select class="assign-request-slot-teacher-select desk-modal-input" aria-label="Instructor for ${escapeHtml(getInstrumentRowLabel(instrument, Number(rowIndex || 0)))}">
                    <option value="">Select instructor...</option>
                    ${options}
                </select>
            `;
        }

        function renderInheritedTeacherControl(teacherId) {
            const teacherName = getTeacherNameById(teacherId) || 'Select an instructor on the main instrument row';
            return `
                <input type="hidden" class="assign-request-slot-teacher-id" value="${escapeHtml(String(teacherId || ''))}" data-teacher-name="${escapeHtml(teacherName)}">
                <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <i class="fas fa-link mr-1.5 text-blue-500"></i>Uses <strong class="assign-request-inherited-teacher-name text-slate-800">${escapeHtml(teacherName)}</strong>
                </div>
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
                    dateLabel: `Every ${day}`,
                    timeLabel: `${formatTime12Hour(start)} - ${formatTime12Hour(end)}`,
                    subtitle: 'Click to view projected lesson dates'
                };
            }
            return {
                dateLabel: day,
                timeLabel: `${formatTime12Hour(start)} - ${formatTime12Hour(end)}`,
                subtitle: 'Recurring'
            };
        }

        function buildAssignRequestProjectedDates(slots, sessionCount = 12) {
            const rows = Array.isArray(slots) ? slots : [];
            const projections = rows.map(() => []);
            const queue = rows.map((slot, index) => ({
                index,
                nextDate: String(slot.session_date || '').slice(0, 10),
                startTime: String(slot.start_time || '').slice(0, 5)
            })).filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item.nextDate));
            const total = Math.max(1, Math.min(100, Number(sessionCount || 12)));
            for (let session = 0; session < total && queue.length; session += 1) {
                queue.sort((a, b) => a.nextDate.localeCompare(b.nextDate) || a.startTime.localeCompare(b.startTime) || a.index - b.index);
                const current = queue[0];
                projections[current.index].push(current.nextDate);
                const next = new Date(`${current.nextDate}T00:00:00`);
                next.setDate(next.getDate() + 7);
                current.nextDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
            }
            return projections;
        }

        function openAssignRequestRecurringDates(row) {
            const container = document.getElementById('assignRequestSlotsContainer');
            const rows = Array.from(container?.querySelectorAll('.assign-request-slot') || []);
            const index = rows.indexOf(row);
            const slots = rows.map(getAssignRequestRowData);
            const slot = slots[index];
            if (index < 0 || !slot?.day_of_week || typeof Swal === 'undefined') return;
            const dates = buildAssignRequestProjectedDates(slots, Number(activeAssignRequest?.sessions || 12))[index] || [];
            Swal.fire({
                title: `Every ${slot.day_of_week}`,
                html: `<div class="text-left"><div class="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"><strong>${escapeHtml(`${formatTime12Hour(slot.start_time)} - ${formatTime12Hour(slot.end_time)}`)}</strong><div class="mt-1 text-xs">Projected lesson dates for this package.</div></div><div class="max-h-72 space-y-2 overflow-y-auto">${dates.map((date, dateIndex) => `<div class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2"><span class="grid h-7 w-7 place-items-center rounded-full bg-blue-100 text-xs font-black text-blue-700">${dateIndex + 1}</span><span class="text-sm font-semibold text-slate-800">${escapeHtml(formatDateLong(date) || date)}</span></div>`).join('') || '<div class="text-sm text-slate-500">Choose a date and time first.</div>'}</div></div>`,
                confirmButtonText: 'Close',
                confirmButtonColor: '#2563eb',
                width: '32rem'
            });
        }

        function updateAssignRequestSelectionSummary() {
            const summaryEl = document.getElementById('assignRequestSummary');
            const countEl = document.getElementById('assignRequestSlotCount');
            if (!summaryEl) return;
            const slots = collectAssignRequestSlots();
            if (countEl) countEl.textContent = `${slots.length} scheduled`;
            summaryEl.innerHTML = slots.length
                ? `<button type="button" onclick="openAssignRequestScheduleReview()" class="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"><i class="fas fa-list-check"></i> Review final schedule <span class="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] text-white">${slots.length}</span></button>`
                : '<div class="flex items-center gap-2 text-slate-500"><i class="fas fa-calendar-day text-gold-500"></i><span>Choose a date and time from the calendar.</span></div>';
        }

        function getAssignRequestSlotKey(slot) {
            return `${String(slot?.day_of_week || '').toLowerCase()}|${String(slot?.start_time || '').slice(0, 5)}|${String(slot?.end_time || '').slice(0, 5)}`;
        }

        function isAssignRequestSlotSelected(slot, ignoredRow = null) {
            return Array.from(document.querySelectorAll('#assignRequestSlotsContainer .assign-request-slot')).some(row =>
                row !== ignoredRow && getAssignRequestSlotKey(getAssignRequestRowData(row)) === getAssignRequestSlotKey(slot)
            );
        }

        function isAssignRequestDateSelected(dateKey, ignoredRow = null) {
            const normalizedDate = String(dateKey || '').trim();
            if (!normalizedDate) return false;
            return Array.from(document.querySelectorAll('#assignRequestSlotsContainer .assign-request-slot')).some(row =>
                row !== ignoredRow
                && String(row.querySelector('.assign-request-slot-session-date')?.value || '').trim() === normalizedDate
            );
        }

        function openAssignRequestScheduleReview() {
            const slots = collectAssignRequestSlots();
            if (!slots.length || typeof Swal === 'undefined') return;
            Swal.fire({
                title: 'Final weekly schedule',
                html: `<div class="space-y-2 text-left">${slots.map((slot, index) => {
                    const instrument = assignRequestInstruments.find(item => Number(item.instrument_id) === Number(slot.instrument_id));
                    return `<div class="rounded-xl border border-slate-200 bg-slate-50 p-3"><div class="text-xs font-bold uppercase tracking-wide text-slate-400">Schedule ${index + 1}</div><div class="mt-1 font-bold text-slate-900">${escapeHtml(instrument ? getInstrumentRowLabel(instrument, index) : 'Instrument')}</div><div class="mt-1 text-sm text-slate-600">${escapeHtml(getTeacherNameById(slot.teacher_id) || 'Teacher')} • ${escapeHtml(slot.day_of_week)}, ${escapeHtml(formatTime12Hour(slot.start_time))}–${escapeHtml(formatTime12Hour(slot.end_time))}</div></div>`;
                }).join('')}</div>`,
                confirmButtonText: 'Looks good',
                confirmButtonColor: '#2563eb',
                width: '38rem'
            });
        }

        function openPendingRequestScheduleModal(requestId) {
            const req = pendingEnrollmentRequestsById[String(requestId)];
            if (!req) {
                showMessage('Schedule request not found.', 'error');
                return;
            }

            const studentName = `${req.first_name || ''} ${req.last_name || ''}`.trim() || 'Student';
            const preferredDate = formatDateCompact(req.preferred_date || '') || 'No preferred date';
            const preferredDay = String(req.preferred_day_of_week || '').trim() || 'No preferred day';
            const preferredStart = req.preferred_start_time
                ? formatTime12Hour(req.preferred_start_time)
                : '';
            const preferredEnd = req.preferred_end_time
                ? formatTime12Hour(req.preferred_end_time)
                : '';
            const preferredTime = preferredStart && preferredEnd
                ? `${preferredStart} - ${preferredEnd}`
                : (preferredStart || preferredEnd || 'No preferred time');
            const requestedSlots = getPendingRequestPreferredSlots(req).filter(slot => slot.session_date && slot.start_time && slot.end_time);
            const preferredInstructorName = getPendingRequestPreferredTeacherName(req, requestedSlots[0] || {});
            const requestedSlotsHtml = requestedSlots.length
                ? `<div class="mt-4"><div class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Recurring class days</div><div class="space-y-2">${requestedSlots.map((slot, index) => `<button type="button" data-request-recurring-index="${index}" class="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50"><div><div class="text-xs font-semibold text-blue-600">Every ${escapeHtml(slot.day_of_week || 'selected day')}</div><div class="font-bold text-slate-900">${escapeHtml(`${formatTime12Hour(slot.start_time)} - ${formatTime12Hour(slot.end_time)}`)}</div></div><div class="text-right text-xs font-semibold text-blue-600">View dates <i class="fas fa-chevron-right ml-1"></i>${slot.teacher_name ? `<div class="mt-1 text-emerald-700">${escapeHtml(slot.teacher_name)}</div>` : ''}</div></button>`).join('')}</div></div>`
                : '';

            Swal.fire({
                title: 'Online Schedule Request',
                width: 760,
                showDenyButton: true,
                showCancelButton: true,
                confirmButtonText: '<i class="fas fa-check mr-1"></i> Approve Request',
                denyButtonText: '<i class="fas fa-triangle-exclamation mr-1"></i> Schedule Conflict',
                cancelButtonText: 'Close',
                confirmButtonColor: '#059669',
                denyButtonColor: '#d97706',
                didOpen: () => {
                    Swal.getPopup()?.querySelectorAll('[data-request-recurring-index]').forEach(button => {
                        button.addEventListener('click', () => openPendingRequestRecurringDates(requestId, Number(button.dataset.requestRecurringIndex || 0)));
                    });
                },
                html: `
                    <div class="text-left">
                        <div class="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Student</div>
                            <div class="mt-1 font-bold text-slate-900">${escapeHtml(studentName)}</div>
                            <div class="text-sm text-slate-600">${escapeHtml(req.package_name || 'No package specified')}</div>
                            <div class="mt-1 text-xs font-semibold text-emerald-700"><i class="fas fa-chalkboard-user mr-1" aria-hidden="true"></i>Requested instructor: ${escapeHtml(preferredInstructorName)}</div>
                        </div>
                        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div class="rounded-xl border border-slate-200 p-4">
                                <div class="mb-2 text-blue-600"><i class="fas fa-calendar-day" aria-hidden="true"></i></div>
                                <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Preferred date</div>
                                <div class="mt-1 font-bold text-slate-900">${escapeHtml(preferredDate)}</div>
                            </div>
                            <div class="rounded-xl border border-slate-200 p-4">
                                <div class="mb-2 text-blue-600"><i class="fas fa-calendar-week" aria-hidden="true"></i></div>
                                <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Preferred day</div>
                                <div class="mt-1 font-bold text-slate-900">${escapeHtml(preferredDay)}</div>
                            </div>
                            <div class="rounded-xl border border-slate-200 p-4">
                                <div class="mb-2 text-blue-600"><i class="fas fa-clock" aria-hidden="true"></i></div>
                                <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Preferred time</div>
                                <div class="mt-1 font-bold text-slate-900">${escapeHtml(preferredTime)}</div>
                            </div>
                        </div>
                        ${requestedSlotsHtml}
                        <div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            <i class="fas fa-info-circle mr-1" aria-hidden="true"></i>
                            This is the student's requested schedule. Approve it if all slots are clear, or choose Schedule Conflict to edit it.
                        </div>
                    </div>
                `
            }).then(result => {
                if (result.isConfirmed) {
                    void approvePendingRequestedSchedule(requestId);
                } else if (result.isDenied) {
                    void openAssignRequestModal(requestId);
                }
            });
        }

        async function approvePendingRequestedSchedule(requestId) {
            const req = pendingEnrollmentRequestsById[String(requestId)];
            if (!req) {
                showMessage('Schedule request not found.', 'error');
                return;
            }
            const instruments = getUniqueAssignRequestInstruments(req.instruments);
            const primaryInstrument = instruments[0] || null;
            const requestedSlots = getPendingRequestPreferredSlots(req);
            const candidates = Array.isArray(req.teacher_candidates) ? req.teacher_candidates : [];
            const candidateById = new Map(candidates.map(candidate => [Number(candidate.teacher_id || 0), candidate]));

            const requestComplete = primaryInstrument && requestedSlots.length && requestedSlots.every(slot =>
                slot.teacher_id > 0 && candidateById.has(slot.teacher_id)
                && slot.session_date && slot.day_of_week && slot.start_time && slot.end_time
            );
            if (!requestComplete) {
                const result = await Swal.fire({
                    icon: 'warning',
                    title: 'Schedule needs editing',
                    text: 'The request is missing a complete class day or its selected instructor is no longer eligible. Please resolve it in the desk scheduler.',
                    confirmButtonText: 'Edit Schedule',
                    confirmButtonColor: '#d97706',
                    showCancelButton: true
                });
                if (result.isConfirmed) void openAssignRequestModal(requestId);
                return;
            }

            Swal.fire({
                title: 'Checking request...',
                html: '<div class="text-sm text-slate-500">Verifying the instructor, branch, schedule, and current conflicts.</div>',
                allowOutsideClick: false,
                showConfirmButton: false,
                didOpen: () => Swal.showLoading()
            });

            let validationIncomplete = false;
            const slotsByTeacher = new Map();
            requestedSlots.forEach(slot => {
                if (!slotsByTeacher.has(slot.teacher_id)) slotsByTeacher.set(slot.teacher_id, []);
                slotsByTeacher.get(slot.teacher_id).push(slot);
            });
            const availabilityByTeacher = new Map();
            await Promise.all(Array.from(slotsByTeacher.entries()).map(async ([teacherId, teacherSlots]) => {
                try {
                    const dates = teacherSlots.map(slot => slot.session_date).sort();
                    const params = new URLSearchParams({
                        action: 'get-teacher-available-slots',
                        teacher_id: String(teacherId),
                        branch_id: String(Number(req.branch_id || managerBranchId || 0)),
                        student_id: String(Number(req.student_id || 0)),
                        // The request being reviewed owns this temporary reservation.
                        // Excluding it prevents its own yellow slot from being reported
                        // as unavailable during the desk's pre-approval check.
                        exclude_request_id: String(Number(requestId)),
                        start_date: dates[0],
                        end_date: dates[dates.length - 1]
                    });
                    const response = await axios.get(`${baseApiUrl}/students.php?${params.toString()}`, { timeout: 15000 });
                    availabilityByTeacher.set(teacherId, Array.isArray(response.data?.slots) ? response.data.slots : []);
                } catch (error) {
                    validationIncomplete = true;
                    console.error('Unable to validate requested schedule for instructor:', error);
                }
            }));

            const conflictingSlots = requestedSlots.filter(requested => !(availabilityByTeacher.get(requested.teacher_id) || []).some(available =>
                String(available.session_date || '') === requested.session_date
                && String(available.start_time || '').slice(0, 5) === requested.start_time
                && String(available.end_time || '').slice(0, 5) === requested.end_time
            ));
            if (validationIncomplete || conflictingSlots.length) {
                const conflictResult = await Swal.fire({
                    icon: 'warning',
                    title: validationIncomplete ? 'Automatic check incomplete' : 'Schedule conflict detected',
                    text: validationIncomplete
                        ? 'The system could not verify all requested days. Open the desk scheduler to review them manually.'
                        : `${conflictingSlots.length} requested class day${conflictingSlots.length === 1 ? ' is' : 's are'} no longer available. Open the desk scheduler to adjust the conflict.`,
                    confirmButtonText: validationIncomplete ? 'Review Schedule' : 'Resolve Conflict',
                    confirmButtonColor: '#d97706',
                    showCancelButton: true,
                    cancelButtonText: 'Close'
                });
                if (conflictResult.isConfirmed) void openAssignRequestModal(requestId);
                return;
            }

            const teacherNames = Array.from(new Set(requestedSlots.map(slot => String(candidateById.get(slot.teacher_id)?.teacher_name || slot.teacher_name || 'Instructor'))));
            const firstSlot = requestedSlots[0];
            const scheduleStartSlot = requestedSlots.slice().sort((a, b) => String(a.session_date).localeCompare(String(b.session_date)) || String(a.start_time).localeCompare(String(b.start_time)))[0];
            const requestedSessionCount = Math.max(1, Number(req.sessions || 12));
            const projectedDates = buildAssignRequestProjectedDates(requestedSlots, requestedSessionCount);
            const projectedSessions = requestedSlots.flatMap((slot, slotIndex) =>
                (projectedDates[slotIndex] || []).map(date => ({
                    ...slot,
                    session_date: date,
                    instructor_name: String(candidateById.get(slot.teacher_id)?.teacher_name || slot.teacher_name || 'Instructor')
                }))
            ).sort((a, b) => String(a.session_date).localeCompare(String(b.session_date)) || String(a.start_time).localeCompare(String(b.start_time)));
            const weekKeyForDate = dateValue => {
                const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
                if (Number.isNaN(date.getTime())) return String(dateValue);
                const day = date.getDay();
                date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            };
            const projectedWeeks = [];
            projectedSessions.forEach((session, index) => {
                const weekKey = weekKeyForDate(session.session_date);
                let week = projectedWeeks.find(item => item.key === weekKey);
                if (!week) {
                    week = { key: weekKey, sessions: [] };
                    projectedWeeks.push(week);
                }
                week.sessions.push({ ...session, session_number: index + 1 });
            });
            const weeklyScheduleHtml = projectedWeeks.map((week, weekIndex) => `
                <div class="grid gap-2 border-b border-slate-200 px-3 py-2.5 last:border-b-0 sm:grid-cols-[70px_minmax(0,1fr)] sm:items-start">
                    <div class="pt-1 text-xs font-black uppercase tracking-wider text-amber-700">Week ${weekIndex + 1}</div>
                    <div class="grid gap-2 sm:grid-cols-2">${week.sessions.map(session => `
                        <div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                            <div class="flex items-start justify-between gap-2">
                                <div>
                                    <div class="text-xs font-extrabold text-slate-900">${escapeHtml(formatDateCompact(session.session_date))}</div>
                                    <div class="mt-0.5 text-xs text-slate-700">${escapeHtml(`${formatTime12Hour(session.start_time)} - ${formatTime12Hour(session.end_time)}`)}</div>
                                </div>
                                <span class="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-[9px] font-bold text-amber-800">Session ${session.session_number}</span>
                            </div>
                            <div class="mt-1 truncate text-[10px] font-semibold text-emerald-700" title="${escapeHtml(session.instructor_name)}"><i class="fas fa-chalkboard-user mr-1"></i>${escapeHtml(session.instructor_name)}</div>
                        </div>`).join('')}</div>
                </div>`).join('');
            const confirmResult = await Swal.fire({
                title: 'Approve requested schedule?',
                width: '64rem',
                html: `<div class="text-left text-sm text-slate-600"><div class="mb-3 flex flex-wrap items-center justify-between gap-2"><div><span class="font-bold text-slate-900">Instructor:</span> ${escapeHtml(teacherNames.join(', '))}</div><div class="text-xs font-semibold text-amber-700"><i class="fas fa-calendar-check mr-1"></i>${projectedSessions.length} class date${projectedSessions.length === 1 ? '' : 's'}</div></div><div class="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Complete package schedule</div><div class="max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 bg-white">${weeklyScheduleHtml || '<div class="p-4 text-sm text-slate-500">No projected class dates available.</div>'}</div><div class="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800"><i class="fas fa-circle-check mr-1"></i>All requested class times are available and passed the conflict check.</div></div>`,
                confirmButtonText: 'Approve Enrollment',
                confirmButtonColor: '#059669',
                showCancelButton: true,
                cancelButtonText: 'Cancel'
            });
            if (!confirmResult.isConfirmed) return;

            await approveStudentRequest({
                action: 'approve-package-request',
                request_id: Number(requestId),
                teacher_id: firstSlot.teacher_id,
                assigned_date: scheduleStartSlot.session_date,
                assigned_day_of_week: scheduleStartSlot.day_of_week,
                assigned_start_time: firstSlot.start_time,
                assigned_end_time: firstSlot.end_time,
                assigned_slots: requestedSlots.map(slot => ({
                    instrument_id: Number(primaryInstrument.instrument_id || 0),
                    teacher_id: slot.teacher_id,
                    session_date: slot.session_date,
                    day_of_week: slot.day_of_week,
                    start_time: slot.start_time,
                    end_time: slot.end_time
                })),
                admin_notes: `Approved using the student’s ${requestedSlots.length}-day requested schedule.`,
                branch_id: Number(req.branch_id || managerBranchId || 0)
            });
        }

        window.openPendingRequestScheduleModal = openPendingRequestScheduleModal;

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
            const removeLocked = Boolean(options.lock_remove || slot.lock_remove);
            const inheritsTeacher = Boolean(options.inherit_teacher || slot.inherit_teacher);
            const sessionDate = String(slot.session_date || '').slice(0, 10);
            const schedule = formatAssignRequestScheduleLabel(sessionDate, day, start, end);
            return `
                <div class="assign-request-slot transition" data-instrument-id="${instrument?.instrument_id || ''}" data-teacher-id="${teacherId || ''}" data-last-teacher-id="${teacherId || ''}" data-remove-locked="${removeLocked ? '1' : '0'}" data-inherits-teacher="${inheritsTeacher ? '1' : '0'}" data-teacher-locked="0">
                    <div class="assign-request-slot-header">
                        <div>
                            <div class="text-sm font-semibold text-slate-800">${escapeHtml(label)}${inheritsTeacher ? ' · Additional day' : ''}</div>
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
                            <label class="block text-xs font-medium text-slate-600 mb-1.5">Instructor</label>
                            ${inheritsTeacher ? renderInheritedTeacherControl(teacherId) : renderTeacherControlForInstrument(instrument, teacherId, false, index)}
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-slate-600 mb-1.5">Schedule</label>
                            <button type="button" class="assign-request-slot-schedule w-full text-left" data-view-recurring-dates aria-label="View projected dates for ${escapeHtml(day || 'this schedule')}">
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
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        function setActiveAssignRequestSlot(row) {
            const rows = Array.from(document.querySelectorAll('#assignRequestSlotsContainer .assign-request-slot'));
            const nextActive = row && rows.includes(row) ? row : (rows[0] || null);
            const activeRowChanged = activeAssignRequestSlotRow !== nextActive;
            const previousTeacherId = Number(getAssignRequestRowTeacherId(activeAssignRequestSlotRow) || 0);
            const nextTeacherId = Number(getAssignRequestRowTeacherId(nextActive) || 0);
            activeAssignRequestSlotRow = nextActive;
            rows.forEach(item => {
                const isActive = item === nextActive;
                item.classList.toggle('border-gold-400', isActive);
                item.classList.toggle('bg-gold-50', isActive);
                item.classList.toggle('shadow-sm', isActive);
                item.classList.toggle('border-slate-200', !isActive);
                item.classList.toggle('bg-white', !isActive);
            });
            const addDayButton = document.getElementById('addAssignRequestSlotBtn');
            if (addDayButton && nextActive) {
                const instrumentId = Number(nextActive.querySelector('.assign-request-slot-instrument')?.value || nextActive.dataset.instrumentId || 0);
                const instrument = assignRequestInstruments.find(item => Number(item.instrument_id) === instrumentId);
                addDayButton.innerHTML = `<i class="fas fa-plus"></i> Add another day for ${escapeHtml(getInstrumentRowLabel(instrument, 0))}`;
            }
            updateAssignRequestSelectionSummary();
            if (activeRowChanged && activeAssignRequest) {
                if (nextTeacherId > 0 && nextTeacherId === previousTeacherId && nextTeacherId === assignRequestAvailabilityTeacherId) {
                    updateAssignRequestCalendarAvailability();
                    return;
                }
                clearAssignRequestAvailabilityView();
                queueLoadAssignRequestAvailability();
            }
        }

        function clearAssignRequestAvailabilityView(message = 'Select an instructor to show availability.') {
            assignRequestAvailabilityRequestToken += 1;
            assignRequestAvailabilitySlots = [];
            assignRequestReservedSlots = [];
            assignRequestOccupiedSlots = [];
            assignRequestAvailabilityTeacherId = 0;
            initializeAssignRequestCalendar(assignRequestAvailabilitySelectedDate);
            updateAssignRequestCalendarAvailability(message);
        }

        function clearAssignRequestRowSchedule(row) {
            if (!row) return;
            ['.assign-request-slot-session-date', '.assign-request-slot-day', '.assign-request-slot-start', '.assign-request-slot-end']
                .forEach(selector => {
                    const input = row.querySelector(selector);
                    if (input) input.value = '';
                });
            updateAssignRequestRowScheduleDisplay(row);
        }

        function syncInheritedInstructorRows(sourceRow, teacherId) {
            if (!sourceRow || sourceRow.dataset.inheritsTeacher === '1') return;
            const instrumentId = Number(sourceRow.querySelector('.assign-request-slot-instrument')?.value || sourceRow.dataset.instrumentId || 0);
            document.querySelectorAll('#assignRequestSlotsContainer .assign-request-slot[data-inherits-teacher="1"]').forEach(row => {
                const rowInstrumentId = Number(row.querySelector('.assign-request-slot-instrument')?.value || row.dataset.instrumentId || 0);
                if (rowInstrumentId !== instrumentId) return;
                const input = row.querySelector('.assign-request-slot-teacher-id');
                const teacherName = getTeacherNameById(teacherId) || 'Select an instructor on the main instrument row';
                if (input) {
                    input.value = teacherId > 0 ? String(teacherId) : '';
                    input.dataset.teacherName = teacherName;
                }
                row.dataset.teacherId = teacherId > 0 ? String(teacherId) : '';
                row.dataset.lastTeacherId = teacherId > 0 ? String(teacherId) : '';
                const nameEl = row.querySelector('.assign-request-inherited-teacher-name');
                if (nameEl) nameEl.textContent = teacherName;
                clearAssignRequestRowSchedule(row);
            });
        }

        function openPendingRequestPaymentModal(requestId) {
            const req = pendingEnrollmentRequestsById[String(requestId)];
            if (!req) {
                showMessage('Payment details not found.', 'error');
                return;
            }

            const studentName = `${req.first_name || ''} ${req.last_name || ''}`.trim() || 'Student';
            const paymentType = String(req.payment_type || '').trim() || 'No payment type selected';
            const paymentMethod = String(req.payment_method || '').trim() || 'No payment method selected';
            const referenceNumber = String(req.reference_number || '').trim() || 'Not provided';
            const payableNow = Number(req.payable_now || 0);
            const packageAmount = Number(req.package_total_amount || req.requested_amount || req.package_price || 0);
            const remainingBalance = Math.max(0, packageAmount - payableNow);
            const isCashPayment = paymentMethod.toLowerCase() === 'cash';
            const proofUrl = req.payment_proof_path ? buildPublicFileUrl(req.payment_proof_path) : '';
            const proofHtml = req.payment_proof_path
                ? `<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div class="font-bold text-slate-900">Payment proof uploaded</div>
                            <div class="mt-0.5 text-xs text-slate-500">Preview the submitted photo without leaving this page.</div>
                        </div>
                        <button type="button" id="pendingPaymentProofPreviewBtn" class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700">
                            <i class="fas fa-eye" aria-hidden="true"></i> View proof
                        </button>
                   </div>`
                : `<div class="flex items-start gap-3">
                        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full ${isCashPayment ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}">
                            <i class="fas ${isCashPayment ? 'fa-money-bill-wave' : 'fa-file-circle-xmark'}" aria-hidden="true"></i>
                        </span>
                        <div>
                            <div class="font-bold text-slate-900">${isCashPayment ? 'No proof required for cash payment' : 'No payment proof uploaded'}</div>
                            <div class="mt-0.5 text-xs text-slate-500">${isCashPayment ? 'Verify and collect the payment at the desk.' : 'Ask the student for proof before confirming an online payment.'}</div>
                        </div>
                   </div>`;

            Swal.fire({
                title: 'Payment Details',
                width: 680,
                confirmButtonText: 'Close',
                confirmButtonColor: '#059669',
                customClass: {
                    popup: 'rounded-3xl',
                    title: 'text-slate-900'
                },
                didOpen: () => {
                    document.getElementById('pendingPaymentProofPreviewBtn')?.addEventListener('click', () => {
                        Swal.close();
                        setTimeout(() => openPaymentProofPreviewModal(proofUrl, studentName, requestId), 180);
                    });
                },
                html: `
                    <div class="text-left text-sm text-slate-700">
                        <div class="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <span class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                                <i class="fas fa-user" aria-hidden="true"></i>
                            </span>
                            <div class="min-w-0">
                                <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Payment request for</div>
                                <div class="truncate text-base font-bold text-slate-900">${escapeHtml(studentName)}</div>
                                <div class="truncate text-xs text-slate-500">${escapeHtml(req.package_name || 'No package specified')}</div>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div class="rounded-xl border border-slate-200 p-4">
                                <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Payment type</div>
                                <div class="mt-1 font-bold text-slate-900">${escapeHtml(paymentType)}</div>
                            </div>
                            <div class="rounded-xl border border-slate-200 p-4">
                                <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Payment method</div>
                                <div class="mt-1 font-bold text-slate-900">${escapeHtml(paymentMethod)}</div>
                            </div>
                            <div class="rounded-xl border border-slate-200 p-4 sm:col-span-2">
                                <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Reference number</div>
                                <div class="mt-1 break-all font-bold text-slate-900">${escapeHtml(referenceNumber)}</div>
                            </div>
                            <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                <div class="text-xs font-semibold uppercase tracking-wider text-emerald-700">Amount to pay now</div>
                                <div class="mt-1 text-xl font-black text-emerald-800">${formatCurrencyPHP(payableNow)}</div>
                            </div>
                            <div class="rounded-xl border border-slate-200 p-4">
                                <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Package amount</div>
                                <div class="mt-1 text-xl font-black text-slate-900">${formatCurrencyPHP(packageAmount)}</div>
                                ${remainingBalance > 0 ? `<div class="mt-1 text-xs text-slate-500">Remaining after this payment: ${formatCurrencyPHP(remainingBalance)}</div>` : '<div class="mt-1 text-xs font-semibold text-emerald-600">Full package amount</div>'}
                            </div>
                        </div>

                        <div class="mt-4 rounded-xl border border-slate-200 p-4">
                            <div class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Proof of payment</div>
                            ${proofHtml}
                        </div>
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
                row.querySelector('[data-view-recurring-dates]')?.addEventListener('click', event => {
                    event.stopPropagation();
                    setActiveAssignRequestSlot(row);
                    openAssignRequestRecurringDates(row);
                });
                row.querySelectorAll('select,input').forEach(input => input.addEventListener('change', () => {
                    if (input.classList.contains('assign-request-slot-teacher-select') || input.classList.contains('assign-request-slot-teacher-id')) {
                        const previousTeacherId = Number(row.dataset.lastTeacherId || 0);
                        const nextTeacherId = Number(input.value || 0);
                        row.dataset.teacherId = nextTeacherId > 0 ? String(nextTeacherId) : '';
                        row.dataset.lastTeacherId = nextTeacherId > 0 ? String(nextTeacherId) : '';
                        if (previousTeacherId !== nextTeacherId) {
                            clearAssignRequestRowSchedule(row);
                            syncInheritedInstructorRows(row, nextTeacherId);
                        }
                        setActiveAssignRequestSlot(row);
                        clearAssignRequestAvailabilityView(nextTeacherId ? 'Loading instructor availability...' : 'Select an instructor to show availability.');
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
                    updateAssignRequestSelectionSummary();
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
            const instrumentId = Number(instrument?.instrument_id || slot.instrument_id || 0);
            const sameInstrumentDays = Array.from(container.querySelectorAll('.assign-request-slot')).filter(row =>
                Number(row.querySelector('.assign-request-slot-instrument')?.value || row.dataset.instrumentId || 0) === instrumentId
            ).length;
            if (sameInstrumentDays >= 7) {
                showMessage('All seven weekly days are already scheduled for this instrument.', 'error');
                return;
            }
            const teacherCandidates = getTeachersForInstrument(instrument);
            const teacherId = Number(slot.teacher_id || activeRowTeacherId || (teacherCandidates.length === 1 ? teacherCandidates[0]?.teacher_id : 0) || 0) || null;
            container.insertAdjacentHTML('beforeend', renderAssignRequestSlotRow({
                instrument_id: instrument?.instrument_id || slot.instrument_id || null,
                teacher_id: teacherId,
                session_date: slot.session_date || '',
                day_of_week: slot.day_of_week || '',
                start_time: slot.start_time || '',
                end_time: slot.end_time || '',
                lock_remove: Boolean(slot.lock_remove),
                inherit_teacher: Boolean(slot.inherit_teacher)
            }, index, {
                lock_remove: Boolean(slot.lock_remove),
                inherit_teacher: Boolean(slot.inherit_teacher)
            }));
            bindAssignRequestSlotFocusHandlers();
            bindAssignRequestSlotRemoveHandlers();
            const insertedRow = container.lastElementChild;
            if (slot.activate_new) {
                setActiveAssignRequestSlot(insertedRow);
            } else if (!activeAssignRequestSlotRow || !container.contains(activeAssignRequestSlotRow)) {
                setActiveAssignRequestSlot(insertedRow);
            } else {
                setActiveAssignRequestSlot(activeAssignRequestSlotRow);
            }
            updateAssignRequestRowScheduleDisplay(container.lastElementChild);
            updateAssignRequestRecurringSummary();
        }

        function addAssignRequestDay() {
            const container = document.getElementById('assignRequestSlotsContainer');
            const activeRow = activeAssignRequestSlotRow && container?.contains(activeAssignRequestSlotRow)
                ? activeAssignRequestSlotRow
                : container?.querySelector('.assign-request-slot');
            if (!activeRow) return;
            const instrumentId = Number(activeRow.querySelector('.assign-request-slot-instrument')?.value || activeRow.dataset.instrumentId || 0);
            const teacherId = Number(getAssignRequestRowTeacherId(activeRow) || 0);
            if (!teacherId) {
                showMessage('Select an instructor for this instrument before adding another day.', 'error');
                return;
            }
            addAssignRequestSlot({
                instrument_id: instrumentId,
                teacher_id: teacherId,
                inherit_teacher: true,
                lock_remove: false,
                activate_new: true
            });
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
            const dt = new Date(Date.UTC(year, month - 1, 15, 12));
            return Number.isNaN(dt.getTime())
                ? monthKey
                : dt.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' });
        }

        function shiftAssignAvailabilityMonth(monthKey, delta) {
            const parts = String(monthKey || '').split('-');
            const year = Number(parts[0] || 0);
            const month = Number(parts[1] || 0);
            const base = !Number.isNaN(year) && !Number.isNaN(month) && month >= 1 && month <= 12
                ? new Date(year, month - 1, 1)
                : (() => { const now = window.getManilaDateParts(); return new Date(now.year, now.month - 1, 1); })();
            base.setMonth(base.getMonth() + delta);
            return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
        }

        function setAssignRequestAvailabilityMonth(monthKey) {
            assignRequestAvailabilityMonth = monthKey || '';
            renderAssignRequestCalendarMonth();
            queueLoadAssignRequestAvailability();
        }

        function selectAssignRequestAvailabilityDate(dateKey) {
            assignRequestAvailabilitySelectedDate = dateKey || '';
            updateAssignRequestCalendarAvailability();
        }

        function openAssignRequestAvailabilityDatePicker(dateKey) {
            const normalizedDate = String(dateKey || '').trim();
            if (!normalizedDate) return;
            const activeRow = getAssignableAssignRequestSlotRow();
            if (isAssignRequestDateSelected(normalizedDate, activeRow)) {
                showMessage('This date is already selected. Choose a different date for the additional schedule.', 'error');
                return;
            }
            selectAssignRequestAvailabilityDate(normalizedDate);

            const groupedSlots = assignRequestAvailabilitySlots
                .filter(slot => String(slot.session_date || '').trim() === normalizedDate)
                .filter(slot => !isAssignRequestSlotSelected(slot, activeRow))
                .slice()
                .sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')));
            const reservedForDate = assignRequestReservedSlots.filter(slot => String(slot.session_date || '') === normalizedDate);
            const occupiedForDate = assignRequestOccupiedSlots.filter(slot => String(slot.session_date || '') === normalizedDate);
            if (!groupedSlots.length || typeof Swal === 'undefined') return;

            Swal.fire({
                title: formatDateLong(normalizedDate) || normalizedDate,
                html: `
                    <div class="mb-4 text-sm text-slate-500">${groupedSlots.length} available time slot${groupedSlots.length === 1 ? '' : 's'}</div>
                    <div class="grid grid-cols-1 gap-2 text-left sm:grid-cols-2">
                        ${groupedSlots.map((slot, index) => `
                            <button type="button" class="assign-request-slot-picker-btn rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-100" data-slot-index="${index}">
                                <div class="text-base font-bold text-emerald-800">${escapeHtml(`${formatTime12Hour(slot.start_time)} - ${formatTime12Hour(slot.end_time)}`)}</div>
                                <div class="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">${escapeHtml(slot.day_of_week || '')}</div>
                            </button>
                        `).join('')}
                        ${reservedForDate.map(slot => `<div class="rounded-xl border border-amber-300 bg-amber-100 px-4 py-3"><div class="text-base font-bold text-amber-900">${escapeHtml(`${formatTime12Hour(slot.start_time)} - ${formatTime12Hour(slot.end_time)}`)}</div><div class="mt-1 text-xs font-bold uppercase tracking-wide text-amber-700">Pending reservation</div></div>`).join('')}
                        ${occupiedForDate.map(slot => `<div class="rounded-xl border border-red-300 bg-red-100 px-4 py-3"><div class="text-base font-bold text-red-900">${escapeHtml(`${formatTime12Hour(slot.start_time)} - ${formatTime12Hour(slot.end_time)}`)}</div><div class="mt-1 text-xs font-bold uppercase tracking-wide text-red-700">Occupied</div></div>`).join('')}
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
                    popup?.querySelectorAll('.assign-request-slot-picker-btn').forEach((button, index) => {
                        button.addEventListener('click', () => {
                            const slot = groupedSlots[index];
                            if (!slot) return;
                            applyAssignRequestAvailabilitySlot(slot.session_date, slot.day_of_week, slot.start_time, slot.end_time);
                            Swal.close();
                        });
                    });
                }
            });
        }

        function groupAssignRequestAvailabilitySlots() {
            return assignRequestAvailabilitySlots.reduce((grouped, slot) => {
                const dateKey = String(slot.session_date || '').trim();
                if (!dateKey) return grouped;
                if (!grouped[dateKey]) grouped[dateKey] = [];
                grouped[dateKey].push(slot);
                return grouped;
            }, {});
        }

        function initializeAssignRequestCalendar(initialDate = '') {
            const listEl = document.getElementById('assignRequestAvailabilityList');
            if (!listEl) return;
            if (!assignRequestCalendarInitialized || !document.getElementById('assignRequestCalendarGrid')) {
                listEl.innerHTML = `
                    <div class="space-y-3" id="assignRequestCalendarShell">
                        <div class="flex items-center justify-between gap-3">
                            <button type="button" id="assignRequestCalendarPrev" class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                                <i class="fas fa-chevron-left mr-2 text-[10px]"></i>Prev
                            </button>
                            <div id="assignRequestCalendarMonthLabel" class="text-sm font-semibold text-slate-900"></div>
                            <button type="button" id="assignRequestCalendarNext" class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                                Next<i class="fas fa-chevron-right ml-2 text-[10px]"></i>
                            </button>
                        </div>
                        <div class="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                        </div>
                        <div id="assignRequestCalendarGrid" class="grid grid-cols-7 gap-1.5"></div>
                        <div id="assignRequestCalendarStatus" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500" aria-live="polite">
                            Select an instructor to show availability.
                        </div>
                    </div>
                `;
                document.getElementById('assignRequestCalendarPrev')?.addEventListener('click', () => {
                    setAssignRequestAvailabilityMonth(shiftAssignAvailabilityMonth(assignRequestAvailabilityMonth, -1));
                });
                document.getElementById('assignRequestCalendarNext')?.addEventListener('click', () => {
                    setAssignRequestAvailabilityMonth(shiftAssignAvailabilityMonth(assignRequestAvailabilityMonth, 1));
                });
                document.getElementById('assignRequestCalendarGrid')?.addEventListener('click', event => {
                    const dayButton = event.target.closest('[data-calendar-date]');
                    if (dayButton) openAssignRequestAvailabilityDatePicker(dayButton.dataset.calendarDate || '');
                });
                assignRequestCalendarInitialized = true;
            }

            const resolvedInitialDate = String(initialDate || assignRequestAvailabilitySelectedDate || '').trim();
            if (resolvedInitialDate) assignRequestAvailabilitySelectedDate = resolvedInitialDate;
            if (!assignRequestAvailabilityMonth) {
                assignRequestAvailabilityMonth = (resolvedInitialDate || window.getManilaYmd()).slice(0, 7);
            }
            renderAssignRequestCalendarMonth();
            updateAssignRequestCalendarAvailability();
        }

        function renderAssignRequestCalendarMonth() {
            const gridEl = document.getElementById('assignRequestCalendarGrid');
            const labelEl = document.getElementById('assignRequestCalendarMonthLabel');
            if (!gridEl) return;
            const monthSource = assignRequestAvailabilityMonth || assignRequestAvailabilitySelectedDate || window.getManilaMonthKey();
            const monthParts = String(monthSource).slice(0, 7).split('-');
            const monthDate = new Date(Number(monthParts[0]), Number(monthParts[1]) - 1, 1);
            if (Number.isNaN(monthDate.getTime())) {
                return;
            }
            const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
            assignRequestAvailabilityMonth = monthKey;
            if (labelEl) labelEl.textContent = formatAssignAvailabilityMonthLabel(monthKey);
            if (gridEl.dataset.month === monthKey) return;

            const firstWeekday = monthDate.getDay();
            const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
            const fragment = document.createDocumentFragment();
            for (let i = 0; i < firstWeekday; i += 1) {
                const spacer = document.createElement('div');
                spacer.className = 'h-14 rounded-lg border border-transparent bg-transparent';
                fragment.appendChild(spacer);
            }
            for (let day = 1; day <= daysInMonth; day += 1) {
                const dateKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const button = document.createElement('button');
                button.type = 'button';
                button.dataset.calendarDate = dateKey;
                button.dataset.dayNumber = String(day);
                button.className = 'h-14 rounded-lg border border-slate-200 bg-white p-1.5 text-left transition hover:bg-slate-50';
                fragment.appendChild(button);
            }
            gridEl.replaceChildren(fragment);
            gridEl.dataset.month = monthKey;
        }

        function updateAssignRequestCalendarAvailability(statusMessage = '') {
            const gridEl = document.getElementById('assignRequestCalendarGrid');
            const statusEl = document.getElementById('assignRequestCalendarStatus');
            if (!gridEl || !statusEl) return;
            const grouped = groupAssignRequestAvailabilitySlots();
            const reservedDates = new Set(assignRequestReservedSlots.map(slot => String(slot.session_date || '')));
            const occupiedDates = new Set(assignRequestOccupiedSlots.map(slot => String(slot.session_date || '')));
            const activeRow = getAssignableAssignRequestSlotRow();
            const teacherId = Number(getAssignRequestRowTeacherId(activeRow) || 0);

            gridEl.querySelectorAll('[data-calendar-date]').forEach(button => {
                const dateKey = button.dataset.calendarDate || '';
                const dateAlreadySelected = isAssignRequestDateSelected(dateKey, activeRow);
                const daySlots = (grouped[dateKey] || []).filter(slot => !isAssignRequestSlotSelected(slot, activeRow));
                const hasSlots = teacherId > 0 && daySlots.length > 0 && !dateAlreadySelected;
                const hasReservation = reservedDates.has(dateKey);
                const isOccupied = occupiedDates.has(dateKey);
                const reservationCount = assignRequestReservedSlots.filter(slot => String(slot.session_date || '') === dateKey).length;
                const occupiedCount = assignRequestOccupiedSlots.filter(slot => String(slot.session_date || '') === dateKey).length;
                const isSelected = dateKey === assignRequestAvailabilitySelectedDate;
                button.className = `h-14 rounded-lg border p-1.5 text-left transition ${
                    dateAlreadySelected
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                        : hasSlots
                        ? (isSelected ? 'border-gold-400 bg-gold-50 shadow-sm' : 'border-emerald-300 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100')
                        : hasReservation
                        ? 'cursor-not-allowed border-amber-300 bg-amber-100 text-amber-900'
                        : isOccupied
                        ? 'cursor-not-allowed border-red-300 bg-red-100 text-red-900'
                        : 'cursor-not-allowed border-slate-300 bg-slate-100 text-slate-500'
                }`;
                button.disabled = dateAlreadySelected || !hasSlots;
                button.setAttribute('aria-label', `${dateKey}${dateAlreadySelected ? ', already selected' : hasSlots ? `, ${daySlots.length} available slots` : ''}`);
                const dayNumber = button.dataset.dayNumber || '';
                button.innerHTML = `
                    <div class="flex items-start justify-between gap-1">
                        <span class="text-sm font-semibold leading-none text-slate-900">${escapeHtml(dayNumber)}</span>
                        ${hasSlots ? `<span class="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">${daySlots.length}</span>` : ''}
                        ${reservationCount ? `<span class="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">${reservationCount}</span>` : ''}
                        ${occupiedCount ? `<span class="rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">${occupiedCount}</span>` : ''}
                    </div>
                    ${dateAlreadySelected ? '<div class="mt-1 text-[9px] font-semibold leading-tight text-slate-500">Selected</div>' : hasSlots ? '<div class="mt-1 text-[9px] font-semibold leading-tight text-emerald-700">Available</div>' : hasReservation ? '<div class="mt-1 text-[9px] font-semibold leading-tight text-amber-800">Reserved</div>' : isOccupied ? '<div class="mt-1 text-[9px] font-semibold leading-tight text-red-700">Occupied</div>' : '<div class="mt-1 text-[9px] font-semibold leading-tight text-slate-500">Unavailable</div>'}
                `;
            });
            if (statusMessage) {
                statusEl.innerHTML = statusMessage;
            } else if (!teacherId) {
                statusEl.textContent = 'Select an instructor to show availability.';
            } else {
                statusEl.textContent = 'Green: available · Yellow: pending reservation · Red: occupied · Gray: unavailable.';
            }
        }

        function renderAssignRequestAvailability(slots, selectedDate = '') {
            assignRequestAvailabilitySlots = Array.isArray(slots) ? slots.slice() : [];
            if (selectedDate) assignRequestAvailabilitySelectedDate = selectedDate;
            initializeAssignRequestCalendar(assignRequestAvailabilitySelectedDate);
            updateAssignRequestCalendarAvailability();
        }

        function applyAssignRequestAvailabilitySlot(sessionDate, dayOfWeek, startTime, endTime) {
            const container = document.getElementById('assignRequestSlotsContainer');
            const targetRow = activeAssignRequestSlotRow && container?.contains(activeAssignRequestSlotRow)
                ? activeAssignRequestSlotRow
                : container?.querySelector('.assign-request-slot');
            if (isAssignRequestDateSelected(sessionDate, targetRow)) {
                showMessage('This date is already selected. Choose a different date for the additional schedule.', 'error');
                return;
            }
            assignRequestAvailabilitySelectedDate = sessionDate || assignRequestAvailabilitySelectedDate;
            const candidate = { session_date: sessionDate, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime };
            if (isAssignRequestSlotSelected(candidate, targetRow)) {
                showMessage('That weekly time is already selected for this student.', 'error');
                return;
            }
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
            updateAssignRequestCalendarAvailability();
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
            const selectedDate = assignRequestAvailabilitySelectedDate || '';
            const activeRow = getAssignableAssignRequestSlotRow();
            const activeSlotData = getAssignRequestRowData(activeRow);
            const teacherId = Number(activeSlotData?.teacher_id || 0);
            const activeRowTeacherLabel = activeRow ? getAssignRequestRowTeacherName(activeRow) : '';
            if (!listEl) return;
            const requestToken = ++assignRequestAvailabilityRequestToken;
            initializeAssignRequestCalendar(selectedDate);
            assignRequestAvailabilitySlots = [];
            assignRequestReservedSlots = [];
            assignRequestOccupiedSlots = [];

            if (!activeAssignRequest || !teacherId) {
                assignRequestAvailabilityTeacherId = 0;
                updateAssignRequestCalendarAvailability('Select an instructor to show availability.');
                return;
            }

            assignRequestAvailabilityTeacherId = teacherId;
            updateAssignRequestCalendarAvailability(`<i class="fas fa-spinner fa-spin mr-2 text-blue-600"></i>Loading ${escapeHtml(activeRowTeacherLabel || 'instructor')} availability...`);
            const requestId = Number(activeAssignRequest?.request_id || activeAssignRequest?.id || 0);
            try {
                const params = new URLSearchParams({
                    action: 'get-teacher-available-slots',
                    teacher_id: teacherId,
                    branch_id: Number(activeAssignRequest.branch_id || managerBranchId || 0),
                    student_id: Number(activeAssignRequest.student_id || 0)
                });
                const visibleMonth = assignRequestAvailabilityMonth || (selectedDate ? selectedDate.slice(0, 7) : window.getManilaMonthKey());
                const [visibleYear, visibleMonthNumber] = visibleMonth.split('-').map(Number);
                const visibleMonthStart = `${visibleYear}-${String(visibleMonthNumber).padStart(2, '0')}-01`;
                const visibleMonthEnd = `${visibleYear}-${String(visibleMonthNumber).padStart(2, '0')}-${String(new Date(visibleYear, visibleMonthNumber, 0).getDate()).padStart(2, '0')}`;
                params.append('start_date', visibleMonthStart);
                params.append('end_date', visibleMonthEnd);
                if (requestId) params.append('exclude_request_id', String(requestId));

                const response = await axios.get(`${baseApiUrl}/students.php?${params.toString()}`, {
                    timeout: 30000 // Increased to 30 seconds for complex availability queries
                });
                if (
                    requestToken !== assignRequestAvailabilityRequestToken
                    || teacherId !== Number(getAssignRequestRowTeacherId(getAssignableAssignRequestSlotRow()) || 0)
                    || requestId !== Number(activeAssignRequest?.request_id || activeAssignRequest?.id || 0)
                ) return;
                const data = response.data || {};
                const availabilityRows = Array.isArray(data.slots) ? data.slots : [];
                assignRequestAvailabilitySlots = availabilityRows;
                assignRequestReservedSlots = Array.isArray(data.reserved_slots) ? data.reserved_slots : [];
                assignRequestOccupiedSlots = Array.isArray(data.occupied_slots) ? data.occupied_slots : [];
                renderAssignRequestAvailability(availabilityRows, selectedDate);
            } catch (error) {
                if (requestToken !== assignRequestAvailabilityRequestToken) return;
                
                console.error('Failed to load availability:', error);
                const status = Number(error?.response?.status || 0);
                const isTimeout = error?.code === 'ECONNABORTED' || error?.message?.includes('timeout');
                
                if (status === 403) {
                    updateAssignRequestCalendarAvailability('<i class="fas fa-triangle-exclamation mr-2 text-amber-600"></i>You do not have permission to view this instructor\'s availability.');
                    return;
                }
                
                if (isTimeout) {
                    updateAssignRequestCalendarAvailability('<i class="fas fa-clock mr-2 text-amber-600"></i>Availability is taking longer than expected. Select the instructor again to retry.');
                    return;
                }

                updateAssignRequestCalendarAvailability('<i class="fas fa-triangle-exclamation mr-2 text-red-600"></i>Unable to load availability. Check your connection and select the instructor again.');
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
            const preferredScheduleEl = document.getElementById('assignRequestPreferredSchedule');
            const slotsContainer = document.getElementById('assignRequestSlotsContainer');
            const notesEl = document.getElementById('assignRequestNotes');

            if (!modal || !requestIdEl || !slotsContainer || !notesEl) {
                console.error('Missing required modal elements');
                return;
            }

            const studentName = `${req.first_name || ''} ${req.last_name || ''}`.trim();
            const uniqueInstruments = getUniqueAssignRequestInstruments(req.instruments);
            const instrumentSummary = uniqueInstruments.length
                ? uniqueInstruments.map(i => {
                    return escapeHtml(i.type_name || i.instrument_name || 'Instrument');
                }).join(', ')
                : '—';
            if (studentNameEl) studentNameEl.textContent = studentName || 'Student';
            if (studentBranchEl) studentBranchEl.textContent = req.branch_name || 'No branch';
            if (studentPackageEl) studentPackageEl.textContent = req.package_name || 'Package';
            if (studentInstrumentEl) studentInstrumentEl.innerHTML = instrumentSummary;
            if (preferredScheduleEl) preferredScheduleEl.textContent = formatPendingRequestSchedule(req);
            requestIdEl.value = String(requestId);
            activeAssignRequest = req;
            assignRequestAvailabilitySlots = [];
            assignRequestReservedSlots = [];
            assignRequestOccupiedSlots = [];
            assignRequestAvailabilityTeacherId = 0;
            assignRequestAvailabilityMonth = '';
            assignRequestAvailabilitySelectedDate = '';

            assignRequestTeacherCandidates = Array.isArray(req.teacher_candidates) ? req.teacher_candidates : [];
            assignRequestInstruments = uniqueInstruments;
            assignRequestTeacherCache.clear();
            assignRequestAvailabilityRequestToken += 1;
            if (assignRequestAvailabilityLoadTimer) {
                clearTimeout(assignRequestAvailabilityLoadTimer);
                assignRequestAvailabilityLoadTimer = null;
            }

            const todayYmd = window.getManilaYmd();
            const preferredRequestSlots = getPendingRequestPreferredSlots(req);
            const requestedDate = String(preferredRequestSlots[0]?.session_date || req.preferred_date || '').trim();
            const initialDate = requestedDate && requestedDate >= todayYmd ? requestedDate : todayYmd;
            assignRequestAvailabilityMonth = initialDate.slice(0, 7);
            assignRequestAvailabilitySelectedDate = initialDate;
            slotsContainer.innerHTML = '';
            activeAssignRequestSlotRow = null;
            notesEl.value = '';
            updateAssignRequestRecurringSummary();

            modal.classList.remove('hidden');
            modal.classList.add('flex');
            initializeAssignRequestCalendar(initialDate);
            await nextFrame();
            if (!modal.classList.contains('flex')) {
                return;
            }
            const slotsToLoad = preferredRequestSlots.some(slot => slot.session_date || slot.start_time)
                ? preferredRequestSlots
                : Array.from({ length: Math.max(1, assignRequestInstruments.length || 0) }, () => ({}));
            const initializedInstrumentIds = new Set();
            for (let i = 0; i < slotsToLoad.length; i += 1) {
                const requestedSlot = slotsToLoad[i] || {};
                const requestedInstrumentId = Number(requestedSlot.instrument_id || 0);
                const instrument = (requestedInstrumentId
                    ? assignRequestInstruments.find(item => Number(item.instrument_id || 0) === requestedInstrumentId)
                    : null)
                    || assignRequestInstruments[Math.min(i, Math.max(0, assignRequestInstruments.length - 1))]
                    || assignRequestInstruments[0]
                    || null;
                const instrumentId = Number(instrument?.instrument_id || requestedInstrumentId || 0);
                const isAdditionalDay = initializedInstrumentIds.has(instrumentId);
                initializedInstrumentIds.add(instrumentId);
                const teacherCandidates = getTeachersForInstrument(instrument);
                const requestedTeacherId = Number(requestedSlot.teacher_id || 0);
                const teacherId = requestedTeacherId && teacherCandidates.some(candidate => Number(candidate.teacher_id || 0) === requestedTeacherId)
                    ? requestedTeacherId
                    : (teacherCandidates.length === 1 ? Number(teacherCandidates[0]?.teacher_id || 0) || null : '');
                addAssignRequestSlot({
                    instrument_id: instrument?.instrument_id || null,
                    teacher_id: teacherId,
                    session_date: requestedSlot.session_date || (i === 0 ? initialDate : ''),
                    day_of_week: requestedSlot.day_of_week || (i === 0 ? getDayNameFromDate(initialDate) : ''),
                    start_time: String(requestedSlot.start_time || '').slice(0, 5),
                    end_time: String(requestedSlot.end_time || '').slice(0, 5),
                    lock_teacher: false,
                    // Every selected instrument has a required main row with its own
                    // instructor dropdown. Only extra days for that same instrument
                    // inherit the main row's instructor.
                    lock_remove: !isAdditionalDay,
                    inherit_teacher: isAdditionalDay
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
            assignRequestAvailabilityRequestToken += 1;
            assignRequestInstruments = [];
            assignRequestAvailabilitySlots = [];
            assignRequestReservedSlots = [];
            assignRequestOccupiedSlots = [];
            assignRequestAvailabilityTeacherId = 0;
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
                const conflictData = error?.response?.data || {};
                if (Number(error?.response?.status || 0) === 409 && conflictData.conflict_type === 'pending_online_request' && conflictData.requires_override) {
                    await showWalkinReservationConflict(payload, Array.isArray(conflictData.conflicts) ? conflictData.conflicts : []);
                    return;
                }
                if (Number(error?.response?.status || 0) === 409 && Array.isArray(conflictData.alternative_slots)) {
                    const alternatives = conflictData.alternative_slots.map(slot => `${formatDateLong(slot.session_date)} · ${formatTime12Hour(slot.start_time)}–${formatTime12Hour(slot.end_time)}`).join('<br>');
                    await Swal.fire({ icon: 'warning', title: 'Schedule Conflict', html: `<p>${escapeHtml(conflictData.error || 'The schedule is unavailable.')}</p>${alternatives ? `<div class="mt-3 rounded-lg bg-emerald-50 p-3 text-left text-sm"><strong>Available alternatives</strong><br>${alternatives}</div>` : ''}`, confirmButtonColor: '#b8860b' });
                    loadPendingRequests();
                    return;
                }
                showMessage(error?.response?.data?.error || 'Network error while approving request.', 'error');
            }
        }

        function conflictDetailsHtml(conflicts) {
            return conflicts.map(c => `<div class="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-sm"><div><strong>Requester:</strong> ${escapeHtml(c.requester || c.email || 'Student')}</div><div><strong>Instructor:</strong> ${escapeHtml(c.instructor || 'Instructor')}</div><div><strong>Requested schedule:</strong> ${escapeHtml(`${c.day_of_week || ''} ${c.session_date || ''}, ${formatTime12Hour(c.start_time)}–${formatTime12Hour(c.end_time)}`)}</div><div><strong>Branch:</strong> ${escapeHtml(c.branch || '—')}</div><div><strong>Instrument:</strong> ${escapeHtml(c.instrument || '—')}</div><div><strong>Submitted:</strong> ${escapeHtml(c.submitted_at || '—')}</div></div>`).join('');
        }

        async function chooseConflictResolutions(conflicts) {
            const resolutions = [];
            for (const conflict of conflicts) {
                const alternatives = Array.isArray(conflict.alternative_slots) ? conflict.alternative_slots : [];
                if (!alternatives.length) {
                    await Swal.fire({ icon: 'error', title: 'No replacement available', text: `No available replacement was found for ${conflict.requester || 'the requester'}. Choose another walk-in slot.`, confirmButtonColor: '#b8860b' });
                    return null;
                }
                const result = await Swal.fire({
                    title: `Suggest a new schedule for ${escapeHtml(conflict.requester || 'requester')}`,
                    input: 'select',
                    inputOptions: Object.fromEntries(alternatives.map((slot, index) => [index, `${formatDateLong(slot.session_date)} · ${formatTime12Hour(slot.start_time)}–${formatTime12Hour(slot.end_time)}`])),
                    inputPlaceholder: 'Choose an available replacement',
                    showCancelButton: true,
                    confirmButtonText: 'Use Suggestion',
                    confirmButtonColor: '#059669',
                    inputValidator: value => value === '' ? 'Choose a replacement schedule.' : undefined
                });
                if (!result.isConfirmed) return null;
                resolutions.push({ request_id: Number(conflict.request_id), suggested_slot: alternatives[Number(result.value)] });
            }
            return resolutions;
        }

        async function showWalkinReservationConflict(payload, conflicts) {
            const decision = await Swal.fire({
                icon: 'warning',
                title: 'Pending Online Reservation',
                html: conflictDetailsHtml(conflicts),
                showDenyButton: true,
                showCancelButton: true,
                confirmButtonText: 'Continue With Walk-In',
                denyButtonText: 'View Online Request',
                cancelButtonText: 'Choose Another Slot',
                confirmButtonColor: '#dc2626',
                denyButtonColor: '#2563eb'
            });
            if (decision.isDenied) {
                const firstConflict = conflicts[0];
                if (firstConflict?.request_id && pendingEnrollmentRequestsById[String(firstConflict.request_id)]) {
                    openPendingRequestViewModal(Number(firstConflict.request_id));
                } else if (firstConflict) {
                    await Swal.fire({ title: 'Online Schedule Request', html: conflictDetailsHtml([firstConflict]), confirmButtonText: 'Back to Scheduler', confirmButtonColor: '#2563eb' });
                }
                return;
            }
            if (!decision.isConfirmed) return;
            const conflictResolutions = await chooseConflictResolutions(conflicts);
            if (!conflictResolutions) return;
            await approveStudentRequest({ ...payload, override_pending_reservations: true, conflict_resolutions: conflictResolutions });
        }

        async function suggestStudentRequest(requestId) {
            const request = pendingEnrollmentRequestsById[String(requestId)];
            const teacherId = Number(request?.preferred_teacher_id || request?.preferred_slots?.[0]?.teacher_id || 0);
            if (!request || !teacherId) return showMessage('This request has no preferred instructor.', 'error');
            try {
                const params = new URLSearchParams({ action: 'get-teacher-available-slots', teacher_id: String(teacherId), branch_id: String(request.branch_id || managerBranchId || 0), student_id: String(request.student_id || 0), exclude_request_id: String(requestId), days_ahead: '45' });
                const response = await axios.get(`${baseApiUrl}/students.php?${params.toString()}`);
                const slots = Array.isArray(response.data?.slots) ? response.data.slots.slice(0, 12) : [];
                if (!slots.length) return showMessage('No alternative slots are currently available.', 'error');
                const result = await Swal.fire({ title: 'Suggest New Schedule', input: 'select', inputOptions: Object.fromEntries(slots.map((slot, index) => [index, `${formatDateLong(slot.session_date)} · ${formatTime12Hour(slot.start_time)}–${formatTime12Hour(slot.end_time)}`])), inputPlaceholder: 'Choose an available slot', showCancelButton: true, confirmButtonText: 'Send Suggestion', confirmButtonColor: '#2563eb', inputValidator: value => value === '' ? 'Choose a schedule.' : undefined });
                if (!result.isConfirmed) return;
                const slot = { ...slots[Number(result.value)], teacher_id: teacherId };
                const saved = await axios.post(`${baseApiUrl}/students.php`, { action: 'suggest-package-request', request_id: Number(requestId), suggested_slot: slot, branch_id: Number(managerBranchId || 0) });
                showMessage(saved.data?.message || 'New schedule suggested.', 'success');
                loadPendingRequests();
            } catch (error) {
                showMessage(error?.response?.data?.error || 'Unable to suggest a new schedule.', 'error');
            }
        }
        window.suggestStudentRequest = suggestStudentRequest;

        async function submitAssignRequestForm(e) {
            e.preventDefault();
            const requestId = Number(document.getElementById('assignRequestId')?.value || 0);
            const todayYmd = window.getManilaYmd();
            const slotRows = Array.from(document.querySelectorAll('#assignRequestSlotsContainer .assign-request-slot'));
            const invalidRow = slotRows.find(row => {
                const teacherId = Number(getAssignRequestRowTeacherId(row) || 0);
                const sessionDate = String(row.querySelector('.assign-request-slot-session-date')?.value || '').trim();
                const day = String(row.querySelector('.assign-request-slot-day')?.value || '').trim();
                const startTime = String(row.querySelector('.assign-request-slot-start')?.value || '').trim();
                const endTime = String(row.querySelector('.assign-request-slot-end')?.value || '').trim();
                return !teacherId || !sessionDate || !day || !startTime || !endTime;
            });
            const assignedSlots = collectAssignRequestSlots();
            const adminNotes = document.getElementById('assignRequestNotes')?.value?.trim() || '';
            const primarySlot = assignedSlots[0] || null;
            const assignedDate = assignedSlots.map(slot => String(slot.session_date || '').trim()).filter(Boolean).sort()[0] || '';

            if (!requestId || !assignedDate || !assignedSlots.length) {
                showMessage('Please select an instructor, then choose a date and time from the calendar for each instrument.', 'error');
                return;
            }
            if (invalidRow) {
                showMessage('Each instrument row needs a teacher, day, start, and end time.', 'error');
                return;
            }
            if (assignedSlots.some(slot => String(slot.session_date || '') < todayYmd)) {
                showMessage('Past dates are not allowed for enrollment scheduling.', 'error');
                return;
            }
            const selectedDates = assignedSlots.map(slot => String(slot.session_date || '').trim());
            if (new Set(selectedDates).size !== selectedDates.length) {
                showMessage('Each schedule must use a different date. Choose another date for the additional schedule.', 'error');
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
            const uniqueSlotKeys = new Set(assignedSlots.map(getAssignRequestSlotKey));
            if (uniqueSlotKeys.size !== assignedSlots.length) {
                showMessage('The same weekly time cannot be selected more than once.', 'error');
                return;
            }
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
        window.openAssignRequestScheduleReview = openAssignRequestScheduleReview;

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
                    getEnrollmentStudentDisplayId(student),
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
                const studentDisplayId = getEnrollmentStudentDisplayId(student);
                const totalAmount = Number(student.total_amount || 0);
                const paidAmount = Number(student.paid_amount || 0);
                const balance = Math.max(0, totalAmount - paidAmount);

                return `
                    <tr class="hover:bg-slate-50/80 transition">
                        <td class="px-3 py-2.5">
                            <div class="font-semibold text-sm text-slate-900">${escapeHtml(student.first_name || '')} ${escapeHtml(student.last_name || '')}</div>
                            <div class="text-xs font-medium text-slate-600">${escapeHtml(studentDisplayId)}</div>
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
            document.getElementById('assignRequestAvailableSlotSelect')?.addEventListener('change', (event) => {
                const selected = parseAssignRequestSlotValue(event.target.value);
                if (!selected) return;
                applyAssignRequestAvailabilitySlot(selected.session_date, selected.day_of_week, selected.start_time, selected.end_time);
            });
            document.getElementById('addAssignRequestSlotBtn')?.addEventListener('click', addAssignRequestDay);
        });

        window.applyAssignRequestAvailabilitySlot = applyAssignRequestAvailabilitySlot;
        window.loadAssignRequestAvailability = loadAssignRequestAvailability;
        window.selectAssignRequestAvailabilityDate = selectAssignRequestAvailabilityDate;
        window.setAssignRequestAvailabilityMonth = setAssignRequestAvailabilityMonth;
