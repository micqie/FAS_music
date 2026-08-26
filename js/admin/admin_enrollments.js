        window.pendingRequestActionLabel = 'Branch Review';
        window.onPendingRequestAssignClick = null;
        let adminPendingEnrollments = [];
        let adminActiveEnrollments = [];
        let adminEnrollmentSearch = '';
        let adminEnrollmentExtensionOnly = false;

        function getEnrollmentSearchTerm() {
            const input = document.getElementById('enrollmentSearchInput');
            return String(input?.value || adminEnrollmentSearch || '').trim().toLowerCase();
        }

        function getEnrollmentBranchId() {
            const branchFilter = document.getElementById('branchFilter');
            return Number(branchFilter?.value || 0);
        }

        function getEnrollmentExtensionOnlyState() {
            const toggle = document.getElementById('extensionOnlyToggle');
            return Boolean(toggle?.checked || adminEnrollmentExtensionOnly);
        }

        function matchesEnrollmentSearch(row, values) {
            const term = getEnrollmentSearchTerm();
            if (!term) return true;
            return values.some(value => String(value || '').toLowerCase().includes(term));
        }

        function setEnrollmentSummaryText(id, value) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        }

        function updateEnrollmentSummary() {
            const pendingCount = adminPendingEnrollments.length;
            const activeCount = adminActiveEnrollments.length;
            const collected = adminActiveEnrollments.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0);
            const outstanding = adminActiveEnrollments.reduce((sum, row) => {
                const total = Number(row.total_amount || 0);
                const paid = Number(row.paid_amount || 0);
                return sum + Math.max(0, total - paid);
            }, 0);

            setEnrollmentSummaryText('enrollSummaryPendingCount', String(pendingCount));
            setEnrollmentSummaryText('enrollSummaryActiveCount', String(activeCount));
            setEnrollmentSummaryText('enrollSummaryCollected', formatCurrencyPHP(collected));
            setEnrollmentSummaryText('enrollSummaryOutstanding', formatCurrencyPHP(outstanding));
            setEnrollmentSummaryText('pendingTabCount', String(pendingCount));
            setEnrollmentSummaryText('activeTabCount', String(activeCount));
            setEnrollmentSummaryText('itemsNeedActionCount', String(pendingCount));
        }

        function setEnrollmentNavState(view) {
            const pendingLink = document.getElementById('enrollNavPending');
            const activeLink = document.getElementById('enrollNavActive');

            const baseClass = 'px-5 py-2.5 text-sm font-semibold rounded-xl text-slate-800 hover:bg-slate-100 transition';
            const activeClass = 'px-5 py-2.5 text-sm font-semibold rounded-xl bg-gold-500 text-black shadow-sm';
            if (pendingLink) pendingLink.className = (view === 'pending') ? activeClass : baseClass;
            if (activeLink) activeLink.className = (view === 'active') ? activeClass : baseClass;
        }

        function applyEnrollmentView() {
            const params = new URLSearchParams(window.location.search);
            const view = String(params.get('view') || 'active').toLowerCase();
            const pendingSection = document.getElementById('pendingSessionsSection');
            const activeSection = document.getElementById('activeEnrollmentsSection');
            const title = document.getElementById('sessionsPageTitle');
            const subtitle = document.getElementById('sessionsPageSubtitle');

            if (view === 'pending') {
                if (pendingSection) pendingSection.classList.remove('hidden');
                if (activeSection) activeSection.classList.add('hidden');
                if (title) title.textContent = 'Enrollments';
                if (subtitle) subtitle.textContent = 'Read-only enrollment oversight across all branches.';
                setEnrollmentNavState('pending');
                return;
            }

            if (view === 'active') {
                if (pendingSection) pendingSection.classList.add('hidden');
                if (activeSection) activeSection.classList.remove('hidden');
                if (title) title.textContent = 'Enrollments';
                if (subtitle) subtitle.textContent = 'Read-only enrollment oversight across all branches.';
                setEnrollmentNavState('active');
                return;
            }

            if (pendingSection) pendingSection.classList.remove('hidden');
            if (activeSection) {
                if (getEnrollmentExtensionOnlyState()) {
                    activeSection.classList.add('hidden');
                } else {
                    activeSection.classList.remove('hidden');
                }
            }
            if (title) title.textContent = 'Enrollments';
            if (subtitle) subtitle.textContent = getEnrollmentExtensionOnlyState()
                ? 'Focused on add-on session requests.'
                : 'Review portal sign-ups, approve add-on sessions, and keep active students on schedule.';
            setEnrollmentNavState('');
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

        function renderPendingSessionExtensionRequests() {
            const tableBody = document.getElementById('pendingRequestsTable');
            const countEl = document.getElementById('pendingRequestCount');
            if (!tableBody) return;

            const rows = adminPendingEnrollments.filter(req => {
                const branchId = getEnrollmentBranchId();
                if (branchId > 0 && Number(req.branch_id || 0) !== branchId) return false;
                const branchName = String(req.branch_name || '').toLowerCase();
                const studentName = `${req.first_name || ''} ${req.last_name || ''}`.toLowerCase();
                const email = String(req.email || '').toLowerCase();
                const schedule = `${req.preferred_day_of_week || ''} ${req.preferred_start_time || ''}`.toLowerCase();
                return matchesEnrollmentSearch(req, [branchName, studentName, email, schedule, req.payment_method, req.requested_amount]);
            });

            if (countEl) countEl.textContent = `${rows.length} pending`;

            if (!rows.length) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-8 text-center text-slate-500">
                            <i class="fas fa-calendar-plus text-2xl mb-2 text-gold-500/60"></i>
                            <p>No pending session extension requests found.</p>
                        </td>
                    </tr>`;
                return;
            }

            tableBody.innerHTML = rows.map(req => {
                const studentName = `${escapeHtml(req.first_name || '')} ${escapeHtml(req.last_name || '')}`.trim() || 'Student';
                const email = escapeHtml(req.email || '');
                const branchName = escapeHtml(req.branch_name || '—');
                const schedule = req.preferred_day_of_week
                    ? `${escapeHtml(req.preferred_day_of_week)} • ${escapeHtml(formatTime12Hour(req.preferred_start_time || ''))}`
                    : 'Based on instructor availability';
                const addOn = `${Number(req.requested_sessions || 1)} session${Number(req.requested_sessions || 1) > 1 ? 's' : ''}`;
                const paymentMethod = escapeHtml(req.payment_method || 'Cash');
                const amount = formatCurrencyPHP(req.requested_amount || 650);
                return `
                    <tr class="hover:bg-slate-50/80 transition">
                        <td class="px-6 py-4">
                            <div class="font-semibold text-slate-900">${studentName}</div>
                            <div class="text-sm text-slate-500">${email}</div>
                            <div class="text-xs text-slate-400">Requested ${new Date(req.created_at || Date.now()).toLocaleDateString()}</div>
                        </td>
                        <td class="px-6 py-4 text-sm text-slate-700">${branchName}</td>
                        <td class="px-6 py-4 text-sm text-slate-700">${schedule}</td>
                        <td class="px-6 py-4">
                            <div class="font-semibold text-slate-900">${addOn}</div>
                            <div class="text-xs text-slate-500">1 hour each</div>
                        </td>
                        <td class="px-6 py-4">
                            <div class="inline-flex items-center gap-2">
                                <span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">${escapeHtml(paymentMethod === 'Cash' ? 'Cash' : 'Paid')}</span>
                                <span class="font-semibold text-slate-900">${amount}</span>
                            </div>
                            <div class="text-xs text-slate-500">${paymentMethod}</div>
                        </td>
                        <td class="px-6 py-4">
                            <div class="flex flex-wrap items-center gap-2">
                                <button type="button" onclick="openPendingSessionExtensionViewModal(${Number(req.request_id)})" class="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-bold">View</button>
                                <button type="button" onclick="approveSessionExtensionRequest(${Number(req.request_id)})" class="px-4 py-2 rounded-lg bg-gold-500 text-black hover:bg-gold-400 text-sm font-bold">Approve</button>
                                <button type="button" onclick="rejectSessionExtensionRequest(${Number(req.request_id)})" class="px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-sm font-bold">Decline</button>
                            </div>
                        </td>
                    </tr>`;
            }).join('');
        }

        async function loadPendingEnrollmentSummary() {
            try {
                const branchFilter = document.getElementById('branchFilter');
                let url = `${baseApiUrl}/students.php?action=get-pending-session-extension-requests`;
                if (branchFilter && branchFilter.value) {
                    url += `&branch_id=${branchFilter.value}`;
                }
                const response = await axios.get(url);
                const data = response.data || {};
                adminPendingEnrollments = data.success && Array.isArray(data.requests) ? data.requests : [];
            } catch (error) {
                console.error('Failed to load pending enrollment summary:', error);
                adminPendingEnrollments = [];
            }
            updateEnrollmentSummary();
            renderPendingSessionExtensionRequests();
        }

        async function loadActiveEnrollments() {
            const tableBody = document.getElementById('activeEnrollmentsTable');
            const countEl = document.getElementById('activeEnrollmentCount');
            if (!tableBody) return;

            try {
                const branchId = getEnrollmentBranchId();
                let url = `${baseApiUrl}/students.php?action=get-active-enrollments`;
                if (branchId > 0) {
                    url += `&branch_id=${branchId}`;
                }

                const response = await axios.get(url);
                const data = response.data;
                const enrollments = data.success && Array.isArray(data.enrollments) ? data.enrollments : [];
                adminActiveEnrollments = enrollments;
                updateEnrollmentSummary();

                const rows = enrollments.filter(r => {
                    const branchName = String(r.branch_name || '').toLowerCase();
                    const studentName = `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase();
                    const email = String(r.email || '').toLowerCase();
                    const packageName = String(r.package_name || '').toLowerCase();
                    const teacherName = `${r.teacher_first_name || ''} ${r.teacher_last_name || ''}`.toLowerCase();
                    const nextSession = String(r.first_session_date || '').toLowerCase();
                    return matchesEnrollmentSearch(r, [branchName, studentName, email, packageName, teacherName, nextSession]);
                });

                if (countEl) countEl.textContent = `${rows.length} active`;

                if (!rows.length) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="6" class="px-6 py-8 text-center text-slate-500">
                                <i class="fas fa-user-check text-2xl mb-2 text-gold-500/60"></i>
                                <p>No active enrollments found.</p>
                            </td>
                        </tr>`;
                    return;
                }

                tableBody.innerHTML = rows.map(r => {
                    const studentName = `${escapeHtml(r.first_name || '')} ${escapeHtml(r.last_name || '')}`.trim();
                    const email = escapeHtml(r.email || '');
                    const packageName = escapeHtml(r.package_name || '—');
                    const teacherName = `${escapeHtml(r.teacher_first_name || '')} ${escapeHtml(r.teacher_last_name || '')}`.trim() || '—';
                    const branchName = escapeHtml(r.branch_name || '—');
                    const totalSessions = Number(r.sessions || 0);
                    const completedSessions = Number(r.completed_sessions || r.used_sessions || 0);
                    const progress = totalSessions > 0 ? Math.min(100, Math.round((completedSessions / totalSessions) * 100)) : 0;
                    const progressText = totalSessions > 0 ? `${completedSessions}/${totalSessions}` : '—';
                    const sessionDate = r.first_session_date ? new Date(r.first_session_date).toLocaleDateString() : '—';
                    const startTime = formatTime12Hour(r.first_start_time);
                    const nextSession = r.first_session_date ? `${sessionDate} • ${startTime}` : '—';
                    const statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-700">Active</span>';
                    return `
                        <tr class="hover:bg-slate-50/80 transition">
                            <td class="px-6 py-4 table-name-cell">
                                <div class="font-medium text-slate-900 truncate-text" title="${studentName || 'Student'}">${studentName || 'Student'}</div>
                                <div class="text-sm text-slate-500 truncate-text" title="${email}">${email}</div>
                                <div class="text-xs text-slate-400 truncate-text" title="${branchName}">${branchName}</div>
                            </td>
                            <td class="px-6 py-4 text-sm text-slate-700 table-text-cell truncate-text" title="${packageName}">${packageName}</td>
                            <td class="px-6 py-4 text-sm text-slate-700 table-text-cell truncate-text" title="${teacherName}">${teacherName}</td>
                            <td class="px-6 py-4">
                                <div class="font-semibold text-slate-900">${progressText}</div>
                                <div class="mt-2 h-2 w-full max-w-[180px] rounded-full bg-slate-100 overflow-hidden">
                                    <div class="h-full rounded-full bg-gold-500" style="width:${progress}%"></div>
                                </div>
                                <div class="mt-1 text-xs text-slate-400">${progress}%</div>
                            </td>
                            <td class="px-6 py-4 text-sm text-slate-700 table-date-cell truncate-text" title="${nextSession}">${nextSession}</td>
                            <td class="px-6 py-4">
                                <div class="flex flex-wrap items-center gap-2">
                                    <button type="button" class="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-bold">View</button>
                                    <button type="button" class="px-4 py-2 rounded-lg bg-gold-500 text-black hover:bg-gold-400 text-sm font-bold">Manage</button>
                                </div>
                                ${statusBadge}
                            </td>
                        </tr>`;
                }).join('');
            } catch (error) {
                console.error('Failed to load active enrollments:', error);
                adminActiveEnrollments = [];
                updateEnrollmentSummary();
                if (countEl) countEl.textContent = 'Error';
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-8 text-center text-red-500">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <p>Failed to load active enrollments.</p>
                        </td>
                    </tr>`;
            }
        }

        function openPendingSessionExtensionViewModal(requestId) {
            const req = adminPendingEnrollments.find(row => String(row.request_id) === String(requestId));
            if (!req) {
                showMessage('Request not found.', 'error');
                return;
            }

            const studentName = `${escapeHtml(req.first_name || '')} ${escapeHtml(req.last_name || '')}`.trim() || 'Student';
            const schedule = req.preferred_day_of_week
                ? `${escapeHtml(req.preferred_day_of_week)} ${escapeHtml(formatTime12Hour(req.preferred_start_time || ''))}`
                : 'Based on instructor availability';

            Swal.fire({
                title: 'Session Extension Request',
                width: 760,
                confirmButtonText: 'Close',
                html: `
                    <div class="text-left space-y-3 text-sm text-slate-700">
                        <div><span class="font-semibold text-slate-900">Student:</span> ${studentName}</div>
                        <div><span class="font-semibold text-slate-900">Branch:</span> ${escapeHtml(req.branch_name || '—')}</div>
                        <div><span class="font-semibold text-slate-900">Schedule:</span> ${schedule}</div>
                        <div><span class="font-semibold text-slate-900">Payment:</span> ${escapeHtml(req.payment_method || 'Cash')} • ${formatCurrencyPHP(req.requested_amount || 650)}</div>
                        <div><span class="font-semibold text-slate-900">Notes:</span> ${escapeHtml(req.notes || '—')}</div>
                    </div>
                `
            });
        }

        async function rejectSessionExtensionRequest(requestId) {
            if (!requestId) return;
            const result = await Swal.fire({
                icon: 'warning',
                title: 'Decline session extension?',
                text: 'You can add a short reason for the student.',
                input: 'text',
                inputPlaceholder: 'Reason (optional)',
                showCancelButton: true,
                confirmButtonText: 'Decline',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#dc2626'
            });
            if (!result.isConfirmed) return;

            try {
                const response = await axios.post(`${baseApiUrl}/students.php`, {
                    action: 'reject-session-extension-request',
                    request_id: Number(requestId),
                    admin_notes: result.value || '',
                    branch_id: Number(getEnrollmentBranchId() || 0)
                });
                const data = response.data || {};
                if (data.success) {
                    showMessage(data.message || 'Session extension request declined.', 'success');
                    await loadPendingEnrollmentSummary();
                } else {
                    showMessage(data.error || 'Failed to decline request.', 'error');
                }
            } catch (error) {
                showMessage(error?.response?.data?.error || 'Network error while declining request.', 'error');
            }
        }

        let walkinStudents = [];
        let walkinMeta = null;
        let walkinStudentLookup = new Map();
        let walkinAllBranches = [];

        async function loadWalkinBranches() {
            try {
                const response = await axios.get(`${baseApiUrl}/branch.php?action=get-branches`);
                const data = response.data;
                walkinAllBranches = data.success && Array.isArray(data.branches) ? data.branches : [];
                const branchSelect = document.getElementById('walkinBranchSelect');
                if (branchSelect) {
                    branchSelect.innerHTML = '<option value="">Select branch...</option>' + walkinAllBranches.map(b => {
                        return `<option value="${escapeHtml(String(b.branch_id || ''))}">${escapeHtml(b.branch_name || 'Branch')}</option>`;
                    }).join('');
                }
            } catch (error) {
                console.error('Failed to load branches for walk-in:', error);
            }
        }

        async function loadWalkinStudents() {
            try {
                const response = await axios.get(`${baseApiUrl}/students.php?action=get-active-students`);
                const data = response.data;
                const students = data.success && Array.isArray(data.students) ? data.students : [];
                walkinStudents = students.filter(s => {
                    const source = String(s.registration_source || 'online').toLowerCase();
                    return source === 'walkin' && !s.session_package_id;
                });
                populateWalkinStudentSelect();
            } catch (error) {
                console.error('Failed to load walk-in students:', error);
            }
        }

        function populateWalkinStudentSelect() {
            const input = document.getElementById('walkinStudentSearch');
            const dataList = document.getElementById('walkinStudentOptions');
            const hidden = document.getElementById('walkinStudentSelect');
            if (!input || !dataList || !hidden) return;

            walkinStudentLookup = new Map();
            const options = walkinStudents.map(s => {
                const name = `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Student';
                const email = s.email || '';
                const label = email ? `${name} (${email})` : name;
                walkinStudentLookup.set(label, s);
                return `<option value="${escapeHtml(label)}"></option>`;
            }).join('');
            dataList.innerHTML = options;
            input.value = '';
            hidden.value = '';
        }

        function resolveWalkinSelectedStudent() {
            const input = document.getElementById('walkinStudentSearch');
            const hidden = document.getElementById('walkinStudentSelect');
            if (!input || !hidden) return null;
            const label = String(input.value || '').trim();
            const student = walkinStudentLookup.get(label) || null;
            hidden.value = student ? String(student.email || '') : '';
            return student;
        }

        function openWalkinEnrollmentModal() {
            const modal = document.getElementById('walkinEnrollmentModal');
            if (!modal) return;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function closeWalkinEnrollmentModal() {
            const modal = document.getElementById('walkinEnrollmentModal');
            const form = document.getElementById('walkinEnrollmentForm');
            const msg = document.getElementById('walkinEnrollmentMessage');
            const submitBtn = document.getElementById('submitWalkinEnrollmentBtn');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
            if (form) form.reset();
            if (msg) msg.classList.add('hidden');
            if (submitBtn) submitBtn.disabled = false;
            walkinMeta = null;
            const searchInput = document.getElementById('walkinStudentSearch');
            const hiddenSelect = document.getElementById('walkinStudentSelect');
            if (searchInput) searchInput.value = '';
            if (hiddenSelect) hiddenSelect.value = '';
            const instrumentsContainer = document.getElementById('walkinInstrumentsContainer');
            if (instrumentsContainer) instrumentsContainer.innerHTML = '<div class="text-sm text-slate-500">Select a package first.</div>';
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
            const registrationFeeDue = typeof getRegistrationFeeDueAmount === 'function'
                ? getRegistrationFeeDueAmount(walkinMeta?.student || null)
                : 1000;
            const partialAmount = computeStudentRequestPayableNow(price, sessions, 'Partial Payment');
            const fullAmount = computeStudentRequestPayableNow(price, sessions, 'Full Payment');
            const installmentAmount = computeStudentRequestPayableNow(price, sessions, 'Installment');
            const payableNow = computeStudentRequestPayableNow(price, sessions, paymentType, registrationFeeDue);
            const enrollmentNow = computeStudentRequestPayableNow(price, sessions, paymentType);
            const selectedLabel = paymentType === 'Full Payment'
                ? 'Full Payment'
                : (paymentType === 'Installment' ? 'Installment (est. per session)' : 'Partial Payment');
            amountEl.innerHTML = `Estimated package amount: <span class="font-bold">${formatCurrencyPHP(price)}</span><br>Registration fee due: <span class="font-bold">${formatCurrencyPHP(registrationFeeDue)}</span><br>Enrollment fee (${escapeHtml(selectedLabel)}): <span class="font-bold">${formatCurrencyPHP(enrollmentNow)}</span><br>Full Payment: <span class="font-bold">${formatCurrencyPHP(fullAmount)}</span> | Partial Payment: <span class="font-bold">${formatCurrencyPHP(partialAmount)}</span><br>Installment (est./session): <span class="font-bold">${formatCurrencyPHP(installmentAmount)}</span><br>Total due now (${escapeHtml(selectedLabel)}): <span class="font-bold">${formatCurrencyPHP(payableNow)}</span>`;
            instrumentsContainer.innerHTML = maxInst > 0
                ? renderStudentRequestInstrumentSelectors(maxInst, walkinMeta?.instruments || [])
                : '<div class="text-sm text-slate-500">Select a package first.</div>';
        }

        async function handleWalkinStudentChange() {
            const hidden = document.getElementById('walkinStudentSelect');
            const statusEl = document.getElementById('walkinStatusInfo');
            const packageSelect = document.getElementById('walkinPackageSelect');
            const instrumentsContainer = document.getElementById('walkinInstrumentsContainer');
            if (!hidden || !packageSelect || !instrumentsContainer) return;

            const selectedStudent = resolveWalkinSelectedStudent();
            const email = hidden.value || '';
            if (!email) {
                packageSelect.innerHTML = '<option value="">Select package...</option>';
                instrumentsContainer.innerHTML = '<div class="text-sm text-slate-500">Select a package first.</div>';
                if (statusEl) statusEl.textContent = selectedStudent === null && (document.getElementById('walkinStudentSearch')?.value || '').trim()
                    ? 'Please select a walk-in student from the suggestions.'
                    : '';
                walkinMeta = null;
                return;
            }

            const meta = await fetchStudentRequestMetaByEmail(email);
            if (!meta?.success) {
                if (statusEl) statusEl.textContent = meta?.error || 'Failed to load student request meta.';
                walkinMeta = null;
                return;
            }
            walkinMeta = meta;
            const packages = meta.packages || [];
            packageSelect.innerHTML = '<option value="">Select package...</option>' + packages.map(pkg => {
                const sessions = Number(pkg.sessions || 0);
                const maxInst = Number(pkg.max_instruments || 1);
                const price = formatCurrencyPHP(pkg.price || 0);
                return `<option value="${pkg.package_id}" data-max-instruments="${maxInst}" data-sessions="${sessions}" data-price="${pkg.price || 0}">${escapeHtml(pkg.package_name || 'Package')} (${sessions} sessions, up to ${maxInst} instrument${maxInst > 1 ? 's' : ''}) - ${price}</option>`;
            }).join('');

            const latest = meta.latest_request || null;
            const hasPending = latest && String(latest.status || '') === 'Pending';
            if (statusEl) {
                statusEl.textContent = hasPending
                    ? 'This student already has a pending request. Please schedule/approve it first.'
                    : '';
            }
            const submitBtn = document.getElementById('submitWalkinEnrollmentBtn');
            if (submitBtn) submitBtn.disabled = hasPending;
            updateWalkinPackageUI();
        }

        async function submitWalkinEnrollment(e) {
            e.preventDefault();
            const submitBtn = document.getElementById('submitWalkinEnrollmentBtn');
            const msgEl = document.getElementById('walkinEnrollmentMessage');
            if (!submitBtn) return;

            const studentSearch = document.getElementById('walkinStudentSearch');
            const studentSelect = document.getElementById('walkinStudentSelect');
            const packageSelect = document.getElementById('walkinPackageSelect');
            const paymentTypeEl = document.getElementById('walkinPaymentType');
            const paymentMethodEl = document.getElementById('walkinPaymentMethod');
            const paymentProofEl = document.getElementById('walkinPaymentProof');
            if (!studentSearch || !studentSelect || !packageSelect || !paymentTypeEl || !paymentMethodEl) return;

            const selectedStudent = resolveWalkinSelectedStudent();
            const email = studentSelect.value || '';
            const studentId = Number(selectedStudent?.student_id || 0);
            const packageId = parseInt(packageSelect.value, 10);
            const paymentType = String(paymentTypeEl.value || '').trim();
            const paymentMethod = String(paymentMethodEl.value || '').trim();
            const instrumentIds = typeof getWalkinSelectedInstrumentIds === 'function'
                ? getWalkinSelectedInstrumentIds()
                : Array.from(document.querySelectorAll('#walkinInstrumentsContainer .student-request-instrument'))
                    .map(el => parseInt(el.value, 10))
                    .filter(v => !Number.isNaN(v) && v > 0);
            const uniqueInstrumentIds = Array.from(new Set(instrumentIds));

            if (!email || !studentId || !packageId || !paymentType || !paymentMethod || uniqueInstrumentIds.length < 1) {
                showMessage('Please complete student, package, instruments, payment type, and payment method.', 'error');
                return;
            }
            if (!['Full Payment', 'Partial Payment', 'Installment'].includes(paymentType)) {
                showMessage('Invalid payment type selected.', 'error');
                return;
            }
            const paymentProofFile = paymentProofEl && paymentProofEl.files && paymentProofEl.files[0] ? paymentProofEl.files[0] : null;
            if (paymentMethod !== 'Cash' && !paymentProofFile) {
                showMessage('Upload proof of payment for non-cash enrollment payments.', 'error');
                return;
            }

            const selectedOption = packageSelect.options[packageSelect.selectedIndex];
            const maxInst = Number(selectedOption?.getAttribute('data-max-instruments') || 1);
            if (uniqueInstrumentIds.length > maxInst) {
                showMessage(`You can select up to ${maxInst} instrument(s) for this package.`, 'error');
                return;
            }

            // Validate that no two instrument slots share the same type
            const typeSelects = Array.from(document.querySelectorAll('#walkinInstrumentsContainer .student-request-instrument-type'));
            const selectedTypeIds = typeSelects.map(el => String(el.value || '').trim()).filter(Boolean);
            
            // Only check for duplicate types if there are multiple types selected
            if (selectedTypeIds.length > 1 && selectedTypeIds.length !== new Set(selectedTypeIds).size) {
                showMessage('Each instrument slot must have a different instrument type. Please change the duplicate type selection.', 'error');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            try {
                const requestFormData = new FormData();
                requestFormData.append('action', 'submit-package-request');
                requestFormData.append('student_id', String(Number(studentId)));
                requestFormData.append('package_id', String(packageId));
                requestFormData.append('payment_type', paymentType);
                requestFormData.append('payment_method', paymentMethod);
                requestFormData.append('instrument_ids_json', JSON.stringify(uniqueInstrumentIds));
                if (paymentProofFile) {
                    requestFormData.append('package_payment_proof_file', paymentProofFile);
                }

                const response = await postStudentPackageRequest(requestFormData);
                if (response.success) {
                    closeWalkinEnrollmentModal();
                    loadPendingEnrollmentSummary();
                    showMessage(response.message || 'Walk-in enrollment submitted.', 'success');
                    if (response.request_id) {
                        window.location.href = `admin_sessions.html?view=pending&assign_request_id=${response.request_id}`;
                    }
                } else {
                    showMessage(response.error || 'Failed to submit walk-in enrollment.', 'error');
                }
            } catch (error) {
                showMessage('Network error. Please try again.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Walk-In Enrollment';
            }
        }

        document.addEventListener('DOMContentLoaded', function() {
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

            loadBranches();
            loadPendingEnrollmentSummary();
            loadActiveEnrollments();
            applyEnrollmentView();

            document.getElementById('branchFilter')?.addEventListener('change', () => {
                loadPendingEnrollmentSummary();
                loadActiveEnrollments();
            });
            document.getElementById('enrollmentSearchInput')?.addEventListener('input', () => {
                adminEnrollmentSearch = String(document.getElementById('enrollmentSearchInput')?.value || '');
                renderPendingSessionExtensionRequests();
                loadActiveEnrollments();
            });
            document.getElementById('extensionOnlyToggle')?.addEventListener('change', (event) => {
                adminEnrollmentExtensionOnly = Boolean(event.target.checked);
                applyEnrollmentView();
            });
            document.getElementById('enrollNavPending')?.addEventListener('click', () => {
                const viewUrl = new URL(window.location.href);
                viewUrl.searchParams.set('view', 'pending');
                window.history.replaceState({}, '', viewUrl.toString());
                applyEnrollmentView();
            });
            document.getElementById('enrollNavActive')?.addEventListener('click', () => {
                const viewUrl = new URL(window.location.href);
                viewUrl.searchParams.set('view', 'active');
                window.history.replaceState({}, '', viewUrl.toString());
                applyEnrollmentView();
            });
            document.getElementById('branchFilter')?.addEventListener('change', () => {
                loadPendingEnrollmentSummary();
                loadActiveEnrollments();
            });

            // Walk-in enrollment modal
            document.getElementById('openWalkinEnrollmentModalBtn')?.addEventListener('click', () => {
                openWalkinEnrollmentModal();
            });
            document.getElementById('closeWalkinEnrollmentModalBtn')?.addEventListener('click', () => {
                closeWalkinEnrollmentModal();
            });
            document.getElementById('cancelWalkinEnrollmentBtn')?.addEventListener('click', () => {
                closeWalkinEnrollmentModal();
            });

            loadWalkinBranches();
            loadWalkinStudents();
        });

        function openWalkinEnrollmentModal() {
            const modal = document.getElementById('walkinEnrollmentModal');
            if (!modal) return;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            loadWalkinBranches();
            loadWalkinStudents();
        }

        function closeWalkinEnrollmentModal() {
            const modal = document.getElementById('walkinEnrollmentModal');
            const form = document.getElementById('walkinEnrollmentForm');
            const msg = document.getElementById('walkinEnrollmentMessage');
            const submitBtn = document.getElementById('submitWalkinEnrollmentBtn');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
            if (form) form.reset();
            if (msg) msg.classList.add('hidden');
            if (submitBtn) submitBtn.disabled = false;
            walkinMeta = null;
            const searchInput = document.getElementById('walkinStudentSearch');
            const hiddenSelect = document.getElementById('walkinStudentSelect');
            if (searchInput) searchInput.value = '';
            if (hiddenSelect) hiddenSelect.value = '';
            const instrumentsContainer = document.getElementById('walkinInstrumentsContainer');
            if (instrumentsContainer) instrumentsContainer.innerHTML = '<div class="text-sm text-slate-500">Select a student first.</div>';
        }
