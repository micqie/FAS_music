        window.pendingRequestActionLabel = 'Branch Review';
        window.onPendingRequestAssignClick = null;
        let adminPendingEnrollments = [];
        let adminPendingExtensions = [];
        let adminActiveEnrollments = [];
        let adminEnrollmentSearch = '';
        let adminEnrollmentExtensionOnly = false;
        let adminAssignRequest = null;
        let adminAssignActiveRow = null;
        let adminAssignAvailability = [];
        let adminAssignElapsedAvailabilityDates = new Set();
        let adminAssignSelectedDate = '';
        let adminAssignCalendarMonth = '';
        let adminAssignAvailabilityToken = 0;
        let adminAssignAvailabilityTimer = null;
        let adminAssignAvailabilityController = null;

        function getEnrollmentSearchTerm() {
            const input = document.getElementById('enrollmentSearchInput');
            return String(input?.value || adminEnrollmentSearch || '').trim().toLowerCase();
        }

        function getEnrollmentBranchId() {
            const branchFilter = document.getElementById('branchFilter');
            return Number(branchFilter?.value || 0);
        }

        async function loadEnrollmentBranches() {
            const branchFilter = document.getElementById('branchFilter');
            if (!branchFilter) return;
            const selectedValue = String(branchFilter.value || '');
            branchFilter.disabled = true;
            branchFilter.innerHTML = '<option value="">Loading branches...</option>';
            try {
                const response = await axios.get(`${baseApiUrl}/branch.php?action=get-branches`);
                const branches = response.data?.success && Array.isArray(response.data.branches)
                    ? response.data.branches
                    : [];
                branchFilter.innerHTML = '<option value="">All branches</option>' + branches.map(branch =>
                    `<option value="${escapeHtml(String(branch.branch_id || ''))}">${escapeHtml(branch.branch_name || 'Branch')}</option>`
                ).join('');
                if (selectedValue && branches.some(branch => String(branch.branch_id) === selectedValue)) {
                    branchFilter.value = selectedValue;
                }
            } catch (error) {
                console.error('Failed to load enrollment branches:', error);
                branchFilter.innerHTML = '<option value="">Unable to load branches</option>';
            } finally {
                branchFilter.disabled = false;
            }
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
            const extensionCount = adminPendingExtensions.length;
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
            setEnrollmentSummaryText('itemsNeedActionCount', String(pendingCount + extensionCount));
            setEnrollmentSummaryText('sessionExtensionRequestCount', String(extensionCount));
        }

        function setEnrollmentNavState(view) {
            const pendingLink = document.getElementById('enrollNavPending');
            const activeLink = document.getElementById('enrollNavActive');

            const baseClass = 'rounded-md px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-800 hover:bg-slate-100 transition';
            const activeClass = 'rounded-md bg-gold-500 px-3 py-1.5 text-xs sm:text-sm font-semibold text-black shadow-sm';
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
                if (subtitle) subtitle.textContent = 'Pending enrollment requests across all branches.';
                setEnrollmentNavState('pending');
                return;
            }

            if (view === 'active') {
                if (pendingSection) pendingSection.classList.add('hidden');
                if (activeSection) activeSection.classList.remove('hidden');
                if (title) title.textContent = 'Enrollments';
                if (subtitle) subtitle.textContent = 'Active enrollments across all branches.';
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
            if (subtitle) subtitle.textContent = 'All enrollment activity across branches.';
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
            const tableBody = document.getElementById('sessionExtensionRequestsTable');
            if (!tableBody) return;

            const rows = adminPendingExtensions.filter(req => {
                const branchId = getEnrollmentBranchId();
                if (branchId > 0 && Number(req.branch_id || 0) !== branchId) return false;
                const branchName = String(req.branch_name || '').toLowerCase();
                const studentName = `${req.first_name || ''} ${req.last_name || ''}`.toLowerCase();
                const email = String(req.email || '').toLowerCase();
                const schedule = `${req.preferred_day_of_week || ''} ${req.preferred_start_time || ''}`.toLowerCase();
                return matchesEnrollmentSearch(req, [branchName, studentName, email, schedule, req.payment_method, req.requested_amount]);
            });

            setEnrollmentSummaryText('sessionExtensionRequestCount', String(rows.length));

            if (!rows.length) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-4 py-6 text-center text-slate-500">
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
                const schedule = 'Managed separately in Sessions';
                const addOn = `${Number(req.requested_sessions || 1)} session${Number(req.requested_sessions || 1) > 1 ? 's' : ''}`;
                const paymentMethod = escapeHtml(req.payment_method || 'Cash');
                const amount = formatCurrencyPHP(req.requested_amount || 650);
                return `
                    <tr class="hover:bg-slate-50/80 transition">
                        <td class="px-3 py-2.5">
                            <div class="font-semibold text-slate-900">${studentName}</div>
                            <div class="text-sm text-slate-500">${email}</div>
                            <div class="text-xs text-slate-400">Requested ${new Date(req.created_at || Date.now()).toLocaleDateString()}</div>
                        </td>
                        <td class="px-3 py-2.5 text-sm text-slate-700">${branchName}</td>
                        <td class="px-3 py-2.5 text-sm text-slate-700">${schedule}</td>
                        <td class="px-3 py-2.5">
                            <div class="font-semibold text-slate-900">${addOn}</div>
                            <div class="text-xs text-slate-500">1 hour each</div>
                        </td>
                        <td class="px-3 py-2.5">
                            <div class="inline-flex items-center gap-2">
                                <span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">${escapeHtml(paymentMethod === 'Cash' ? 'Cash' : 'Paid')}</span>
                                <span class="font-semibold text-slate-900">${amount}</span>
                            </div>
                            <div class="text-xs text-slate-500">${paymentMethod}</div>
                        </td>
                        <td class="px-3 py-2.5">
                            <div class="flex flex-wrap items-center gap-2">
                                <button type="button" onclick="openPendingSessionExtensionViewModal(${Number(req.request_id)})" class="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-bold">View</button>
                                <button type="button" onclick="approveSessionExtensionRequest(${Number(req.request_id)})" class="px-4 py-2 rounded-lg bg-gold-500 text-black hover:bg-gold-400 text-sm font-bold">Approve</button>
                                <button type="button" onclick="rejectSessionExtensionRequest(${Number(req.request_id)})" class="px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-sm font-bold">Decline</button>
                            </div>
                        </td>
                    </tr>`;
            }).join('');
        }

        function renderPendingPackageRequests() {
            const tableBody = document.getElementById('pendingRequestsTable');
            const countEl = document.getElementById('pendingRequestCount');
            if (!tableBody) return;

            const branchId = getEnrollmentBranchId();
            const rows = adminPendingEnrollments.filter(req => {
                if (branchId > 0 && Number(req.branch_id || 0) !== branchId) return false;
                const instruments = Array.isArray(req.instruments)
                    ? req.instruments.map(item => item.type_name || item.instrument_name || '').join(' ')
                    : '';
                return matchesEnrollmentSearch(req, [
                    `${req.first_name || ''} ${req.last_name || ''}`,
                    req.email, req.branch_name, req.package_name, instruments,
                    req.payment_type, req.payment_method
                ]);
            });

            if (countEl) countEl.textContent = `${rows.length} pending`;
            if (!rows.length) {
                tableBody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-500"><i class="fas fa-inbox mb-2 text-xl text-gold-500/60"></i><p>No pending enrollment requests found.</p></td></tr>';
                return;
            }

            tableBody.innerHTML = rows.map(req => {
                const studentName = `${escapeHtml(req.first_name || '')} ${escapeHtml(req.last_name || '')}`.trim() || 'Student';
                const instruments = Array.isArray(req.instruments) && req.instruments.length
                    ? req.instruments.map(item => escapeHtml(item.type_name || item.instrument_name || 'Instrument')).join(', ')
                    : '—';
                const payment = [req.payment_type, req.payment_method].filter(Boolean).map(escapeHtml).join(' • ') || '—';
                return `
                    <tr class="hover:bg-slate-50/80 transition">
                        <td class="px-3 py-2.5"><div class="font-semibold text-sm text-slate-900">${studentName}</div><div class="text-xs text-slate-500">${escapeHtml(req.email || '')}</div></td>
                        <td class="px-3 py-2.5 text-sm text-slate-700">${escapeHtml(req.branch_name || '—')}</td>
                        <td class="px-3 py-2.5 text-sm text-slate-700">${escapeHtml(req.package_name || '—')}</td>
                        <td class="px-3 py-2.5 text-sm text-slate-700">${instruments}</td>
                        <td class="px-3 py-2.5 text-sm text-slate-700">${payment}</td>
                        <td class="px-3 py-2.5"><div class="flex flex-nowrap gap-1.5">
                            <button type="button" onclick="openPendingEnrollmentViewModal(${Number(req.request_id)})" class="bg-slate-100 text-slate-700 hover:bg-slate-200">View</button>
                            <button type="button" onclick="openAdminAssignRequestModal(${Number(req.request_id)})" class="bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Schedule</button>
                        </div></td>
                    </tr>`;
            }).join('');
        }

        function openPendingEnrollmentViewModal(requestId) {
            const req = adminPendingEnrollments.find(row => String(row.request_id) === String(requestId));
            if (!req) return showMessage('Enrollment request not found.', 'error');
            const instruments = Array.isArray(req.instruments) && req.instruments.length
                ? req.instruments.map(item => escapeHtml(item.type_name || item.instrument_name || 'Instrument')).join(', ')
                : '—';
            Swal.fire({
                title: 'Enrollment Request',
                width: 720,
                confirmButtonText: 'Close',
                html: `<div class="space-y-2 text-left text-sm text-slate-700">
                    <div><b>Student:</b> ${escapeHtml(`${req.first_name || ''} ${req.last_name || ''}`.trim() || 'Student')}</div>
                    <div><b>Branch:</b> ${escapeHtml(req.branch_name || '—')}</div>
                    <div><b>Package:</b> ${escapeHtml(req.package_name || '—')}</div>
                    <div><b>Instruments:</b> ${instruments}</div>
                    <div><b>Payment:</b> ${escapeHtml([req.payment_type, req.payment_method].filter(Boolean).join(' • ') || '—')}</div>
                </div>`
            });
        }

        async function loadPendingEnrollmentSummary() {
            try {
                const branchFilter = document.getElementById('branchFilter');
                let packageUrl = `${baseApiUrl}/students.php?action=get-pending-package-requests`;
                let extensionUrl = `${baseApiUrl}/students.php?action=get-pending-session-extension-requests`;
                if (branchFilter && branchFilter.value) {
                    const branchParam = `&branch_id=${encodeURIComponent(branchFilter.value)}`;
                    packageUrl += branchParam;
                    extensionUrl += branchParam;
                }
                const [packageResponse, extensionResponse] = await Promise.all([
                    axios.get(packageUrl),
                    axios.get(extensionUrl)
                ]);
                const packageData = packageResponse.data || {};
                const extensionData = extensionResponse.data || {};
                adminPendingEnrollments = packageData.success && Array.isArray(packageData.requests) ? packageData.requests : [];
                adminPendingExtensions = extensionData.success && Array.isArray(extensionData.requests) ? extensionData.requests : [];
            } catch (error) {
                console.error('Failed to load pending enrollment summary:', error);
                adminPendingEnrollments = [];
                adminPendingExtensions = [];
            }
            updateEnrollmentSummary();
            renderPendingPackageRequests();
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
                            <td colspan="4" class="px-6 py-8 text-center text-slate-500">
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
                                <div class="flex flex-wrap items-center gap-2">
                                    <button type="button" onclick="openAdminEnrollmentDetails(${Number(r.enrollment_id)})" class="rounded-md bg-blue-100 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-200">Details</button>
                                </div>
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
                        <td colspan="4" class="px-6 py-8 text-center text-red-500">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <p>Failed to load active enrollments.</p>
                        </td>
                    </tr>`;
            }
        }

        function openAdminEnrollmentDetails(enrollmentId) {
            const enrollment = adminActiveEnrollments.find(row => Number(row.enrollment_id) === Number(enrollmentId));
            if (!enrollment) return showMessage('Enrollment details not found.', 'error');
            const total = Number(enrollment.total_amount || 0);
            const paid = Number(enrollment.paid_amount || 0);
            const balance = Math.max(0, total - paid);
            const teacher = `${enrollment.teacher_first_name || ''} ${enrollment.teacher_last_name || ''}`.trim() || '—';
            Swal.fire({
                title: 'Enrollment Details',
                width: 760,
                confirmButtonText: 'Close',
                html: `<div class="grid grid-cols-1 gap-2 text-left text-sm text-slate-700 sm:grid-cols-2">
                    <div><b>Student:</b> ${escapeHtml(`${enrollment.first_name || ''} ${enrollment.last_name || ''}`.trim() || 'Student')}</div>
                    <div><b>Branch:</b> ${escapeHtml(enrollment.branch_name || '—')}</div>
                    <div><b>Package:</b> ${escapeHtml(enrollment.package_name || '—')}</div>
                    <div><b>Teacher:</b> ${escapeHtml(teacher)}</div>
                    <div><b>Enrollment fee:</b> ${formatCurrencyPHP(total)}</div>
                    <div><b>Paid:</b> ${formatCurrencyPHP(paid)}</div>
                    <div><b>Balance:</b> ${formatCurrencyPHP(balance)}</div>
                    <div><b>Payment type:</b> ${escapeHtml(enrollment.payment_type || '—')}</div>
                </div>`
            });
        }

        function openPendingSessionExtensionViewModal(requestId) {
            const req = adminPendingExtensions.find(row => String(row.request_id) === String(requestId));
            if (!req) {
                showMessage('Request not found.', 'error');
                return;
            }

            const studentName = `${escapeHtml(req.first_name || '')} ${escapeHtml(req.last_name || '')}`.trim() || 'Student';
            const schedule = 'Managed separately in Sessions';
            const proof = req.payment_proof_path
                ? `<a href="${escapeHtml(buildPublicFileUrl(req.payment_proof_path))}" target="_blank" rel="noopener" class="font-semibold text-blue-600 underline">View payment proof</a>`
                : '<span class="text-slate-500">No proof uploaded</span>';

            Swal.fire({
                title: 'Session Extension Request',
                width: 760,
                confirmButtonText: 'Close',
                html: `
                    <div class="text-left space-y-3 text-sm text-slate-700">
                        <div><span class="font-semibold text-slate-900">Student:</span> ${studentName}</div>
                        <div><span class="font-semibold text-slate-900">Branch:</span> ${escapeHtml(req.branch_name || '—')}</div>
                        <div><span class="font-semibold text-slate-900">Scheduling:</span> ${schedule}</div>
                        <div><span class="font-semibold text-slate-900">Payment:</span> ${escapeHtml(req.payment_method || 'Cash')} • ${formatCurrencyPHP(req.requested_amount || 650)}</div>
                        <div><span class="font-semibold text-slate-900">Proof:</span> ${proof}</div>
                        <div><span class="font-semibold text-slate-900">Notes:</span> ${escapeHtml(req.notes || '—')}</div>
                    </div>
                `
            });
        }

        async function approveSessionExtensionRequest(requestId) {
            const req = adminPendingExtensions.find(row => String(row.request_id) === String(requestId));
            if (!req) return showMessage('Session extension request not found.', 'error');
            const result = await Swal.fire({
                icon: 'question',
                title: 'Approve session extension?',
                text: `This adds ${Number(req.requested_sessions || 1)} purchased session${Number(req.requested_sessions || 1) === 1 ? '' : 's'} to the enrollment without changing learning progress.`,
                showCancelButton: true,
                confirmButtonText: 'Approve',
                confirmButtonColor: '#059669'
            });
            if (!result.isConfirmed) return;

            try {
                const response = await axios.post(`${baseApiUrl}/students.php`, {
                    action: 'approve-session-extension-request',
                    request_id: Number(requestId),
                    branch_id: Number(req.branch_id || 0)
                });
                const data = response.data || {};
                if (!data.success) return showMessage(data.error || 'Failed to approve request.', 'error');
                showMessage(data.message || 'Session extension request approved.', 'success');
                await loadPendingEnrollmentSummary();
            } catch (error) {
                showMessage(error?.response?.data?.error || 'Network error while approving request.', 'error');
            }
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
                    branch_id: Number(adminPendingExtensions.find(row => String(row.request_id) === String(requestId))?.branch_id || 0)
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
            const branchId = Number(document.getElementById('walkinBranchSelect')?.value || 0);
            const searchInput = document.getElementById('walkinStudentSearch');
            if (!branchId) {
                walkinStudents = [];
                if (searchInput) {
                    searchInput.disabled = true;
                    searchInput.placeholder = 'Select a branch first';
                }
                populateWalkinStudentSelect();
                return;
            }

            try {
                if (searchInput) {
                    searchInput.disabled = true;
                    searchInput.placeholder = 'Loading students...';
                }
                const response = await axios.get(`${baseApiUrl}/students.php?action=get-active-students&branch_id=${encodeURIComponent(branchId)}`);
                const data = response.data;
                const students = data.success && Array.isArray(data.students) ? data.students : [];
                walkinStudents = students.filter(s => {
                    const registrationStatus = String(s.registration_status || '').toLowerCase();
                    const isRegistered = ['approved', 'fee paid'].includes(registrationStatus);
                    const isActiveStudent = String(s.status || '').toLowerCase() === 'active';
                    const hasActiveEnrollment = Number(s.has_active_enrollment || 0) === 1;
                    return Number(s.branch_id || 0) === branchId && isRegistered && isActiveStudent && !hasActiveEnrollment;
                });
                populateWalkinStudentSelect();
            } catch (error) {
                console.error('Failed to load walk-in students:', error);
                walkinStudents = [];
                populateWalkinStudentSelect();
            } finally {
                if (searchInput) {
                    searchInput.disabled = false;
                    searchInput.placeholder = 'Search name, email, or phone';
                }
            }
        }

        function populateWalkinStudentSelect() {
            const input = document.getElementById('walkinStudentSearch');
            const hidden = document.getElementById('walkinStudentSelect');
            if (!input || !hidden) return;

            walkinStudentLookup = new Map();
            walkinStudents.forEach(s => {
                const name = `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Student';
                const email = s.email || '';
                const label = email ? `${name} (${email})` : name;
                walkinStudentLookup.set(label, s);
                walkinStudentLookup.set(label.toLowerCase(), s);
                if (email) walkinStudentLookup.set(String(email).toLowerCase(), s);
            });
            input.value = '';
            hidden.value = '';
            updateWalkinSelectedStudentCard(null);
            renderWalkinStudentResults('');
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
            return student?.email ? `${name} (${student.email})` : name;
        }

        function getWalkinStudentIndicator(student) {
            return Number(student?.has_completed_enrollment || 0) === 1
                ? '<span class="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">Re-enrollment</span>'
                : '<span class="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Registered</span>';
        }

        function updateWalkinSelectedStudentCard(student) {
            const card = document.getElementById('walkinSelectedStudentCard');
            const avatar = document.getElementById('walkinSelectedStudentAvatar');
            const name = document.getElementById('walkinSelectedStudentName');
            const meta = document.getElementById('walkinSelectedStudentMeta');
            const searchWrap = document.getElementById('walkinStudentSearchWrap');
            const results = document.getElementById('walkinStudentResults');
            if (!card || !name || !meta) return;

            if (!student) {
                card.classList.add('hidden');
                card.classList.remove('flex');
                searchWrap?.classList.remove('hidden');
                results?.classList.remove('hidden');
                return;
            }

            name.textContent = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
            const studentType = Number(student.has_completed_enrollment || 0) === 1 ? 'Re-enrollment' : 'Registered';
            meta.textContent = [studentType, student.email, student.phone].filter(Boolean).join(' • ');
            if (avatar) {
                avatar.textContent = `${String(student.first_name || '').charAt(0)}${String(student.last_name || '').charAt(0)}`.toUpperCase() || 'ST';
            }
            card.classList.remove('hidden');
            card.classList.add('flex');
            searchWrap?.classList.add('hidden');
            results?.classList.add('hidden');
        }

        function renderWalkinStudentResults(query = '') {
            const results = document.getElementById('walkinStudentResults');
            if (!results) return;
            const branchId = Number(document.getElementById('walkinBranchSelect')?.value || 0);
            if (!branchId) {
                results.innerHTML = '<div class="p-4 text-center text-sm text-slate-500">Select a branch to view students.</div>';
                return;
            }

            const term = String(query || '').trim().toLowerCase();
            const rows = walkinStudents.filter(student => [
                `${student.first_name || ''} ${student.last_name || ''}`,
                student.email,
                student.phone
            ].join(' ').toLowerCase().includes(term)).slice(0, 12);

            if (!rows.length) {
                results.innerHTML = `<div class="p-4 text-center text-sm text-slate-500">${walkinStudents.length ? 'No matching student.' : 'No available registered students in this branch.'}</div>`;
                return;
            }

            results.innerHTML = rows.map(student => `
                <button type="button" class="walkin-student-result flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50" data-student-label="${escapeHtml(getWalkinStudentLabel(student))}">
                    <span class="min-w-0"><span class="block truncate text-sm font-semibold text-slate-900">${escapeHtml(`${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student')}</span><span class="block truncate text-xs text-slate-500">${escapeHtml(student.email || student.phone || 'No contact details')}</span></span>
                    <span class="flex items-center gap-2">${getWalkinStudentIndicator(student)}<i class="fas fa-chevron-right text-xs text-slate-300"></i></span>
                </button>`).join('');
        }

        function resetWalkinStudentSelection() {
            const input = document.getElementById('walkinStudentSearch');
            const hidden = document.getElementById('walkinStudentSelect');
            const packageSelect = document.getElementById('walkinPackageSelect');
            const instruments = document.getElementById('walkinInstrumentsContainer');
            const status = document.getElementById('walkinStatusInfo');
            const amount = document.getElementById('walkinAmountInfo');
            if (input) input.value = '';
            if (hidden) hidden.value = '';
            if (packageSelect) {
                packageSelect.innerHTML = '<option value="">Select a student first</option>';
                packageSelect.disabled = true;
            }
            if (instruments) instruments.innerHTML = '<div class="text-xs text-slate-500">Select a student and package.</div>';
            if (status) status.textContent = '';
            if (amount) amount.textContent = 'Select a package to view the total.';
            const sessionInput = document.getElementById('walkinSessionCount');
            if (sessionInput) {
                sessionInput.value = '';
                sessionInput.disabled = true;
            }
            const decreaseBtn = document.getElementById('walkinSessionDecreaseBtn');
            const increaseBtn = document.getElementById('walkinSessionIncreaseBtn');
            if (decreaseBtn) decreaseBtn.disabled = true;
            if (increaseBtn) increaseBtn.disabled = true;
            walkinMeta = null;
            updateWalkinSelectedStudentCard(null);
            renderWalkinPackageCards();
        }

        function openWalkinEnrollmentModal() {
            const modal = document.getElementById('walkinEnrollmentModal');
            if (!modal) return;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            document.body.style.overflow = 'hidden';
            loadWalkinBranches();
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
            document.body.style.overflow = '';
            if (form) form.reset();
            if (msg) msg.classList.add('hidden');
            if (submitBtn) submitBtn.disabled = false;
            walkinMeta = null;
            const searchInput = document.getElementById('walkinStudentSearch');
            const hiddenSelect = document.getElementById('walkinStudentSelect');
            if (searchInput) {
                searchInput.value = '';
                searchInput.disabled = true;
                searchInput.placeholder = 'Select a branch first';
            }
            if (hiddenSelect) hiddenSelect.value = '';
            walkinStudents = [];
            walkinStudentLookup = new Map();
            updateWalkinSelectedStudentCard(null);
            renderWalkinStudentResults('');
            const packageSelect = document.getElementById('walkinPackageSelect');
            if (packageSelect) {
                packageSelect.innerHTML = '<option value="">Select a student first</option>';
                packageSelect.disabled = true;
            }
            const instrumentsContainer = document.getElementById('walkinInstrumentsContainer');
            if (instrumentsContainer) instrumentsContainer.innerHTML = '<div class="text-xs text-slate-500">Select a student and package.</div>';
            const amountEl = document.getElementById('walkinAmountInfo');
            if (amountEl) amountEl.textContent = 'Select a package to view the total.';
            document.getElementById('walkinPaymentProofWrap')?.classList.add('hidden');
            const proofInput = document.getElementById('walkinPaymentProof');
            if (proofInput) proofInput.required = false;
        }

        function canAccessExtendedWalkinPackages(meta) {
            const packageScope = String(meta?.package_scope || '').toLowerCase();
            const skillLevel = String(meta?.student_skill_level || '').toLowerCase();
            const isReturnee = packageScope === 'extension' || !Boolean(meta?.is_initial_enrollment);
            return isReturnee || Boolean(skillLevel && skillLevel !== 'beginner');
        }

        function renderWalkinPackageCards() {
            const select = document.getElementById('walkinPackageSelect');
            const container = document.getElementById('walkinPackageCards');
            if (!select || !container) return;
            const options = Array.from(select.options).filter(option => String(option.value || '').trim());
            if (!options.length) {
                container.innerHTML = '<div class="col-span-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">Select a student first.</div>';
                return;
            }
            container.innerHTML = options.map(option => {
                const selected = String(select.value) === String(option.value);
                const sessions = Number(option.dataset.sessions || 0);
                const maxInstruments = Number(option.dataset.maxInstruments || 1);
                const title = String(option.textContent || 'Package').split(' (')[0];
                return `<button type="button" class="admin-package-card ${selected ? 'is-selected' : ''}" data-package-id="${escapeHtml(option.value)}">
                    <div class="flex items-start justify-between gap-2"><span class="text-sm font-bold text-slate-900">${escapeHtml(title)}</span>${selected ? '<i class="fas fa-check-circle text-gold-500"></i>' : ''}</div>
                    <div class="mt-1 text-xs text-slate-500">${sessions} sessions • ${maxInstruments} instrument${maxInstruments === 1 ? '' : 's'}</div>
                    <div class="mt-1 text-sm font-black text-slate-900">${formatCurrencyPHP(option.dataset.price || 0)}</div>
                </button>`;
            }).join('');
        }

        function syncWalkinSessionControl(resetToPackage = false) {
            const packageSelect = document.getElementById('walkinPackageSelect');
            const sessionInput = document.getElementById('walkinSessionCount');
            const decreaseBtn = document.getElementById('walkinSessionDecreaseBtn');
            const increaseBtn = document.getElementById('walkinSessionIncreaseBtn');
            const selected = packageSelect?.options?.[packageSelect.selectedIndex];
            const baseSessions = Number(selected?.dataset?.sessions || 0);
            const enabled = Boolean(selected?.value && baseSessions > 0);
            if (!sessionInput) return;
            sessionInput.disabled = !enabled;
            if (decreaseBtn) decreaseBtn.disabled = !enabled;
            if (increaseBtn) increaseBtn.disabled = !enabled;
            if (!enabled) {
                sessionInput.value = '';
                return;
            }
            sessionInput.min = String(baseSessions);
            sessionInput.max = String(Math.min(100, baseSessions + 50));
            const current = Number(sessionInput.value || 0);
            if (resetToPackage || current < baseSessions) sessionInput.value = String(baseSessions);
        }

        function updateWalkinPackageUI(renderInstruments = true) {
            const packageSelect = document.getElementById('walkinPackageSelect');
            const paymentTypeEl = document.getElementById('walkinPaymentType');
            const instrumentsContainer = document.getElementById('walkinInstrumentsContainer');
            const amountEl = document.getElementById('walkinAmountInfo');
            if (!packageSelect || !paymentTypeEl || !instrumentsContainer || !amountEl) return;

            const selected = packageSelect.options[packageSelect.selectedIndex];
            const maxInst = Number(selected?.getAttribute('data-max-instruments') || 0);
            const price = Number(selected?.getAttribute('data-price') || 0);
            const baseSessions = Number(selected?.getAttribute('data-sessions') || 0);
            syncWalkinSessionControl(false);
            const sessionInput = document.getElementById('walkinSessionCount');
            const sessions = Math.max(baseSessions, Number(sessionInput?.value || baseSessions));
            const extraSessions = Math.max(0, sessions - baseSessions);
            const totalPrice = price + (extraSessions * 650);
            const paymentType = String(paymentTypeEl.value || 'Partial Payment');
            const isPartial = paymentType === 'Partial Payment';
            const payableNow = typeof computeStudentRequestPayableNow === 'function'
                ? computeStudentRequestPayableNow(totalPrice, sessions, paymentType)
                : (isPartial ? Math.round(totalPrice * 0.42) : totalPrice);
            const remaining = Math.max(0, totalPrice - payableNow);
            amountEl.innerHTML = selected?.value
                ? `<div class="flex flex-wrap items-center gap-x-5 gap-y-1">
                    <div><span class="block text-[10px] uppercase tracking-wide text-slate-500">Package</span><span class="text-sm font-bold text-slate-900">${sessions} sessions</span></div>
                    ${extraSessions ? `<div><span class="block text-[10px] uppercase tracking-wide text-slate-500">Added</span><span class="text-sm font-bold text-slate-900">${extraSessions} × ₱650</span></div>` : ''}
                    <div><span class="block text-[10px] uppercase tracking-wide text-slate-500">Total</span><span class="text-sm font-bold text-slate-900">${formatCurrencyPHP(totalPrice)}</span></div>
                    <div><span class="block text-[10px] uppercase tracking-wide text-slate-500">Pay now</span><span class="text-lg font-black text-gold-600">${formatCurrencyPHP(payableNow)}</span></div>
                    ${isPartial ? `<div><span class="block text-[10px] uppercase tracking-wide text-slate-500">Balance</span><span class="text-sm font-bold text-slate-700">${formatCurrencyPHP(remaining)}</span></div>` : ''}
                </div>`
                : 'Select a package to view the total.';
            if (renderInstruments) {
                instrumentsContainer.innerHTML = maxInst > 0
                    ? renderStudentRequestInstrumentSelectors(maxInst, walkinMeta?.instruments || [])
                    : '<div class="text-xs text-slate-500">Select a package.</div>';
            }
            renderWalkinPackageCards();
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

            updateWalkinSelectedStudentCard(selectedStudent);

            const meta = await fetchStudentRequestMetaByEmail(email, { staffContext: true });
            if (!meta?.success) {
                if (statusEl) statusEl.textContent = meta?.error || 'Failed to load student request meta.';
                walkinMeta = null;
                return;
            }
            walkinMeta = meta;
            const packages = Array.isArray(meta.packages) ? meta.packages : [];
            const canUseExtended = canAccessExtendedWalkinPackages(meta);
            const filteredPackages = canUseExtended
                ? packages.filter(pkg => [12, 20, 50].includes(Number(pkg.sessions || 0)))
                : packages.filter(pkg => Number(pkg.sessions || 0) === 12);
            packageSelect.innerHTML = '<option value="">Select package...</option>' + filteredPackages.map(pkg => {
                const sessions = Number(pkg.sessions || 0);
                const maxInst = sessions === 12 ? 1 : sessions === 20 ? 2 : sessions >= 50 ? 3 : Number(pkg.max_instruments || 1);
                const price = formatCurrencyPHP(pkg.price || 0);
                return `<option value="${pkg.package_id}" data-max-instruments="${maxInst}" data-sessions="${sessions}" data-price="${pkg.price || 0}">${escapeHtml(pkg.package_name || 'Package')} (${sessions} sessions, up to ${maxInst} instrument${maxInst > 1 ? 's' : ''}) - ${price}</option>`;
            }).join('');
            packageSelect.disabled = false;
            const defaultPackage = filteredPackages.find(pkg => String(pkg.package_id) === String(meta.default_package_id || ''))
                || filteredPackages.find(pkg => Number(pkg.sessions || 0) === 12)
                || filteredPackages[0];
            if (defaultPackage) packageSelect.value = String(defaultPackage.package_id);
            syncWalkinSessionControl(true);

            const latest = meta.latest_request || null;
            const hasPending = latest && String(latest.status || '') === 'Pending';
            if (statusEl) {
                statusEl.textContent = hasPending
                    ? 'This student already has a pending request.'
                    : (canUseExtended ? 'Returning student — all packages are available.' : 'Registered student — 12-session package available.');
            }
            const submitBtn = document.getElementById('submitWalkinEnrollmentBtn');
            if (submitBtn) submitBtn.disabled = hasPending;
            updateWalkinPackageUI();
        }

        function getAdminAssignTeacherName(teacherId) {
            const candidates = Array.isArray(adminAssignRequest?.teacher_candidates) ? adminAssignRequest.teacher_candidates : [];
            return candidates.find(item => Number(item.teacher_id) === Number(teacherId))?.teacher_name || '';
        }

        function getAdminAssignRowData(row) {
            if (!row) return null;
            return {
                instrument_id: Number(row.dataset.instrumentId || 0) || null,
                teacher_id: Number(row.querySelector('.admin-assign-teacher')?.value || 0) || null,
                session_date: row.querySelector('.admin-assign-session-date')?.value || '',
                day_of_week: row.querySelector('.admin-assign-day')?.value || '',
                start_time: row.querySelector('.admin-assign-start')?.value || '',
                end_time: row.querySelector('.admin-assign-end')?.value || ''
            };
        }

        function formatAdminAssignDate(dateValue) {
            if (!dateValue) return 'Choose from calendar';
            const date = new Date(`${dateValue}T00:00:00`);
            return Number.isNaN(date.getTime()) ? dateValue : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        }

        function updateAdminAssignSummary() {
            const rows = Array.from(document.querySelectorAll('#assignRequestSlotsContainer .admin-assign-row'));
            const completed = rows.map(getAdminAssignRowData).filter(slot => slot?.teacher_id && slot.day_of_week && slot.start_time && slot.end_time);
            const countEl = document.getElementById('assignRequestSlotCount');
            const summaryEl = document.getElementById('assignRequestSummary');
            if (countEl) countEl.textContent = `${completed.length} of ${rows.length} scheduled`;
            if (!summaryEl) return;
            if (!completed.length) {
                summaryEl.innerHTML = '<i class="fas fa-calendar-day mr-2 text-gold-600"></i><span>Choose a date and time from the calendar.</span>';
                return;
            }
            summaryEl.innerHTML = `<button type="button" onclick="openAdminAssignScheduleReview()" class="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"><i class="fas fa-list-check"></i> Review final schedule <span class="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] text-white">${completed.length}</span></button>`;
        }

        function getAdminAssignSlotKey(slot) {
            return `${String(slot?.day_of_week || '').toLowerCase()}|${String(slot?.start_time || '').slice(0, 5)}|${String(slot?.end_time || '').slice(0, 5)}`;
        }

        function isAdminAssignSlotSelected(slot, ignoredRow = null) {
            return Array.from(document.querySelectorAll('#assignRequestSlotsContainer .admin-assign-row')).some(row =>
                row !== ignoredRow && getAdminAssignSlotKey(getAdminAssignRowData(row)) === getAdminAssignSlotKey(slot)
            );
        }

        function openAdminAssignScheduleReview() {
            const rows = Array.from(document.querySelectorAll('#assignRequestSlotsContainer .admin-assign-row'));
            const slots = rows.map(row => ({ row, slot: getAdminAssignRowData(row) })).filter(item => item.slot?.teacher_id && item.slot.day_of_week && item.slot.start_time && item.slot.end_time);
            if (!slots.length || typeof Swal === 'undefined') return;
            Swal.fire({
                title: 'Final weekly schedule',
                html: `<div class="space-y-2 text-left">${slots.map(({ row, slot }, index) => `<div class="rounded-xl border border-slate-200 bg-slate-50 p-3"><div class="text-xs font-bold uppercase tracking-wide text-slate-400">Schedule ${index + 1}</div><div class="mt-1 font-bold text-slate-900">${escapeHtml(row.querySelector('.assign-request-slot-title')?.textContent || 'Instrument')}</div><div class="mt-1 text-sm text-slate-600">${escapeHtml(getAdminAssignTeacherName(slot.teacher_id) || 'Teacher')} • ${escapeHtml(slot.day_of_week)}, ${escapeHtml(formatTime12Hour(slot.start_time))}–${escapeHtml(formatTime12Hour(slot.end_time))}</div></div>`).join('')}</div>`,
                confirmButtonText: 'Looks good',
                confirmButtonColor: '#2563eb',
                width: '38rem'
            });
        }

        function updateAdminAssignRow(row) {
            if (!row) return;
            const slot = getAdminAssignRowData(row);
            const dateEl = row.querySelector('.admin-assign-date-label');
            const timeEl = row.querySelector('.admin-assign-time-label');
            if (dateEl) dateEl.textContent = formatAdminAssignDate(slot?.session_date);
            if (timeEl) timeEl.textContent = slot?.start_time && slot?.end_time
                ? `${formatTime12Hour(slot.start_time)} – ${formatTime12Hour(slot.end_time)}`
                : 'No time selected';
            row.classList.toggle('border-gold-400', row === adminAssignActiveRow);
            row.classList.toggle('ring-1', row === adminAssignActiveRow);
            row.classList.toggle('ring-gold-400/30', row === adminAssignActiveRow);
            updateAdminAssignSummary();
        }

        function setAdminAssignActiveRow(row) {
            if (!row) return;
            adminAssignActiveRow = row;
            document.querySelectorAll('#assignRequestSlotsContainer .admin-assign-row').forEach(updateAdminAssignRow);
            queueAdminAssignAvailability();
        }

        function getAdminAssignAvailabilityCacheKey(slot) {
            return [
                Number(slot?.teacher_id || 0),
                Number(adminAssignRequest?.branch_id || 0),
                Number(adminAssignRequest?.student_id || 0),
                document.getElementById('assignRequestDate')?.value || ''
            ].join('|');
        }

        function queueAdminAssignAvailability(delay = 80) {
            if (adminAssignAvailabilityTimer) clearTimeout(adminAssignAvailabilityTimer);
            adminAssignAvailabilityTimer = setTimeout(() => {
                adminAssignAvailabilityTimer = null;
                void loadAdminAssignAvailability();
            }, delay);
        }

        function getAdminAssignTeachersForInstrument(instrument) {
            const candidates = Array.isArray(adminAssignRequest?.teacher_candidates) ? adminAssignRequest.teacher_candidates : [];
            const instrumentTypeId = Number(instrument?.type_id || 0);
            const keywords = [instrument?.type_name, instrument?.instrument_name]
                .map(value => String(value || '').trim().toLowerCase())
                .filter(Boolean);
            if (!keywords.length && instrumentTypeId < 1) return [];
            const matched = candidates.filter(teacher => {
                const teacherTypeIds = Array.isArray(teacher.specialization_type_ids)
                    ? teacher.specialization_type_ids.map(Number)
                    : String(teacher.specialization_type_ids || '').split(',').map(Number);
                if (instrumentTypeId > 0 && teacherTypeIds.some(typeId => typeId === instrumentTypeId)) return true;
                if (instrumentTypeId > 0 && teacherTypeIds.some(typeId => typeId > 0)) return false;
                const specializations = String(teacher.specialization || '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean);
                return specializations.some(specialization => keywords.includes(specialization));
            });
            return matched;
        }

        function getAdminAssignTeacherOptions(instrument, selectedId = '') {
            const candidates = getAdminAssignTeachersForInstrument(instrument);
            if (!candidates.length) return '<option value="">No matching teachers</option>';
            return '<option value="">Select teacher</option>' + candidates.map(teacher =>
                `<option value="${Number(teacher.teacher_id)}"${Number(selectedId) === Number(teacher.teacher_id) ? ' selected' : ''}>${escapeHtml(teacher.teacher_name || 'Teacher')}</option>`
            ).join('');
        }

        function renderAdminAssignRows() {
            const container = document.getElementById('assignRequestSlotsContainer');
            if (!container || !adminAssignRequest) return;
            const instruments = Array.isArray(adminAssignRequest.instruments) && adminAssignRequest.instruments.length
                ? adminAssignRequest.instruments
                : [{ instrument_id: adminAssignRequest.instrument_id || 0, type_name: 'Instrument' }];
            container.innerHTML = instruments.map((instrument, index) => {
                const matchingTeachers = getAdminAssignTeachersForInstrument(instrument);
                const defaultTeacherId = matchingTeachers.length === 1 ? Number(matchingTeachers[0].teacher_id) : '';
                return `
                <div class="admin-assign-row assign-request-slot cursor-pointer transition" data-instrument-id="${Number(instrument.instrument_id || 0)}" data-remove-locked="1">
                    <div class="assign-request-slot-header">
                        <span class="assign-request-slot-title text-slate-800">${escapeHtml(instrument.type_name || instrument.instrument_name || `Instrument ${index + 1}`)}</span>
                        <span class="text-[10px] font-bold uppercase tracking-wide text-slate-400">${index + 1}</span>
                    </div>
                    <label class="desk-modal-label">Teacher</label>
                    <select class="admin-assign-teacher desk-modal-input w-full">
                        ${getAdminAssignTeacherOptions(instrument, defaultTeacherId)}
                    </select>
                    <input type="hidden" class="admin-assign-session-date" value="">
                    <input type="hidden" class="admin-assign-day" value="">
                    <input type="hidden" class="admin-assign-start" value="">
                    <input type="hidden" class="admin-assign-end" value="">
                    <div class="assign-request-slot-schedule mt-3">
                        <div class="assign-request-slot-schedule-meta">
                            <span class="assign-request-slot-schedule-chip"><i class="fas fa-calendar-day text-gold-500"></i><span><span class="assign-request-slot-schedule-chip-label">Date</span><strong class="admin-assign-date-label assign-request-slot-schedule-title">Choose from the calendar</strong></span></span>
                            <span class="assign-request-slot-schedule-chip"><i class="fas fa-clock text-gold-500"></i><span><span class="assign-request-slot-schedule-chip-label">Time</span><strong class="admin-assign-time-label assign-request-slot-schedule-title">Select a slot</strong></span></span>
                        </div>
                        <div class="assign-request-slot-schedule-subtitle">Pick a highlighted time on the right.</div>
                    </div>
                </div>
            `;
            }).join('');

            const rows = Array.from(container.querySelectorAll('.admin-assign-row'));
            rows.forEach(bindAdminAssignRow);
            if (rows[0]) setAdminAssignActiveRow(rows[0]);
        }

        function bindAdminAssignRow(row) {
            if (!row || row.dataset.bound === '1') return;
            row.dataset.bound = '1';
                row.addEventListener('click', event => {
                    if (event.target.closest('select')) return;
                    setAdminAssignActiveRow(row);
                });
                row.querySelector('.admin-assign-teacher')?.addEventListener('change', () => {
                    adminAssignActiveRow = row;
                    row.querySelector('.admin-assign-session-date').value = '';
                    row.querySelector('.admin-assign-day').value = '';
                    row.querySelector('.admin-assign-start').value = '';
                    row.querySelector('.admin-assign-end').value = '';
                    document.querySelectorAll('#assignRequestSlotsContainer .admin-assign-row').forEach(updateAdminAssignRow);
                    queueAdminAssignAvailability();
                });
            row.querySelector('.admin-assign-remove')?.addEventListener('click', event => {
                event.stopPropagation();
                if (row.dataset.removeLocked === '1') return;
                const container = document.getElementById('assignRequestSlotsContainer');
                const wasActive = adminAssignActiveRow === row;
                row.remove();
                if (wasActive) setAdminAssignActiveRow(container?.querySelector('.admin-assign-row') || null);
                updateAdminAssignSummary();
            });
        }

        function addAdminAssignDay() {
            const container = document.getElementById('assignRequestSlotsContainer');
            const source = adminAssignActiveRow && container?.contains(adminAssignActiveRow)
                ? adminAssignActiveRow
                : container?.querySelector('.admin-assign-row');
            if (!container || !source) return;
            const instrumentId = Number(source.dataset.instrumentId || 0);
            const sameInstrumentDays = Array.from(container.querySelectorAll('.admin-assign-row')).filter(row =>
                Number(row.dataset.instrumentId || 0) === instrumentId
            ).length;
            if (sameInstrumentDays >= 7) {
                showMessage('All seven weekly days are already available for this instrument.', 'error');
                return;
            }
            const row = source.cloneNode(true);
            row.dataset.bound = '0';
            row.dataset.removeLocked = '0';
            row.classList.remove('border-gold-400', 'ring-1', 'ring-gold-400/30');
            const header = row.querySelector('.assign-request-slot-header');
            header?.querySelector('.admin-assign-remove')?.remove();
            header?.insertAdjacentHTML('beforeend', '<button type="button" class="admin-assign-remove assign-request-slot-trash" aria-label="Remove day"><i class="fas fa-trash-can"></i></button>');
            row.querySelector('.admin-assign-session-date').value = '';
            row.querySelector('.admin-assign-day').value = '';
            row.querySelector('.admin-assign-start').value = '';
            row.querySelector('.admin-assign-end').value = '';
            row.querySelector('.admin-assign-date-label').textContent = 'Choose from the calendar';
            row.querySelector('.admin-assign-time-label').textContent = 'Select a slot';
            container.appendChild(row);
            bindAdminAssignRow(row);
            setAdminAssignActiveRow(row);
            row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        function shiftAdminAssignMonth(monthKey, delta) {
            const [year, month] = String(monthKey || '').split('-').map(Number);
            const date = year && month ? new Date(year, month - 1 + delta, 1) : new Date();
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        function setAdminAssignCalendarMonth(monthKey) {
            adminAssignCalendarMonth = monthKey;
            renderAdminAssignAvailability();
        }

        function selectAdminAssignAvailabilityDate(dateValue) {
            adminAssignSelectedDate = dateValue;
            renderAdminAssignAvailability();
        }

        function applyAdminAssignAvailabilitySlot(slotIndex) {
            const slot = adminAssignAvailability[Number(slotIndex)] || null;
            if (!slot || !adminAssignActiveRow) return;
            const candidate = {
                ...slot,
                day_of_week: String(slot.day_of_week || getDayNameFromDate(slot.session_date || '')),
                start_time: String(slot.start_time || '').slice(0, 5),
                end_time: String(slot.end_time || '').slice(0, 5)
            };
            if (isAdminAssignSlotSelected(candidate, adminAssignActiveRow)) {
                showMessage('That weekly time is already selected for this student.', 'error');
                return;
            }
            adminAssignActiveRow.querySelector('.admin-assign-session-date').value = String(slot.session_date || '');
            adminAssignActiveRow.querySelector('.admin-assign-day').value = candidate.day_of_week;
            adminAssignActiveRow.querySelector('.admin-assign-start').value = candidate.start_time;
            adminAssignActiveRow.querySelector('.admin-assign-end').value = candidate.end_time;
            const startDate = document.getElementById('assignRequestDate');
            if (startDate && slot.session_date) startDate.value = String(slot.session_date);
            updateAdminAssignRow(adminAssignActiveRow);
            renderAdminAssignAvailability();
        }

        function openAdminAssignAvailabilityDatePicker(dateValue) {
            const date = String(dateValue || '').trim();
            if (!date || typeof Swal === 'undefined') return;
            selectAdminAssignAvailabilityDate(date);
            const slots = adminAssignAvailability
                .map((slot, index) => ({ slot, index }))
                .filter(item => String(item.slot.session_date || '') === date)
                .filter(item => !isAdminAssignSlotSelected(item.slot))
                .sort((a, b) => String(a.slot.start_time || '').localeCompare(String(b.slot.start_time || '')));
            if (!slots.length) return;
            Swal.fire({
                title: formatAdminAssignDate(date),
                html: `<div class="text-sm text-slate-500 mb-4">${slots.length} available slot${slots.length === 1 ? '' : 's'}</div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                        ${slots.map(({ slot, index }) => `<button type="button" class="admin-assign-slot-picker-btn assign-request-slot-picker-btn rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-100" data-slot-index="${index}"><div class="text-base font-bold text-emerald-800">${escapeHtml(`${formatTime12Hour(slot.start_time)} - ${formatTime12Hour(slot.end_time)}`)}</div><div class="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">${escapeHtml(slot.day_of_week || '')}</div></button>`).join('')}
                    </div>`,
                showConfirmButton: false,
                showCloseButton: true,
                width: '42rem',
                heightAuto: false,
                padding: '1.5rem',
                customClass: { popup: 'assign-request-slot-picker-popup', htmlContainer: 'm-0', title: 'text-lg font-bold text-slate-900' },
                didOpen: () => {
                    Swal.getPopup()?.querySelectorAll('.admin-assign-slot-picker-btn').forEach(button => {
                        button.addEventListener('click', () => {
                            applyAdminAssignAvailabilitySlot(Number(button.dataset.slotIndex));
                            Swal.close();
                        });
                    });
                }
            });
        }

        function renderAdminAssignAvailability() {
            const listEl = document.getElementById('assignRequestAvailabilityList');
            if (!listEl) return;
            if (!adminAssignAvailability.length) {
                listEl.innerHTML = '<div class="grid min-h-[320px] place-items-center text-center text-sm text-slate-500"><div><i class="fas fa-calendar-xmark mb-2 text-2xl text-slate-300"></i><p>No available slots found.</p></div></div>';
                return;
            }

            const grouped = {};
            adminAssignAvailability.forEach((slot, index) => {
                const date = String(slot.session_date || '');
                if (!date) return;
                if (!grouped[date]) grouped[date] = [];
                grouped[date].push({ slot, index });
            });
            const dates = Object.keys(grouped).sort();
            if (!dates.includes(adminAssignSelectedDate)) adminAssignSelectedDate = dates[0] || '';
            if (!adminAssignCalendarMonth) adminAssignCalendarMonth = String(adminAssignSelectedDate || dates[0]).slice(0, 7);
            const [year, month] = adminAssignCalendarMonth.split('-').map(Number);
            const first = new Date(year, month - 1, 1);
            const days = new Date(year, month, 0).getDate();
            const cells = Array(first.getDay()).fill('<div class="h-14 rounded-lg border border-transparent bg-transparent"></div>');
            for (let day = 1; day <= days; day += 1) {
                const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const availableItems = (grouped[date] || []).filter(item => !isAdminAssignSlotSelected(item.slot));
                const count = availableItems.length;
                const selected = date === adminAssignSelectedDate;
                const elapsedToday = adminAssignElapsedAvailabilityDates.has(date);
                cells.push(`<button type="button" ${count ? `onclick="openAdminAssignAvailabilityDatePicker('${date}')"` : 'disabled'} class="h-14 rounded-lg border p-1.5 text-left transition ${count ? (selected ? 'border-gold-400 bg-gold-50 shadow-sm' : 'border-emerald-200 bg-white hover:border-emerald-300 hover:bg-emerald-50') : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300'}"><div class="flex items-start justify-between gap-2"><span class="text-sm font-semibold leading-none ${count ? 'text-slate-900' : 'text-slate-400'}">${day}</span>${count ? `<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">${count}</span>` : ''}</div><div class="mt-0.5 text-[9px] leading-tight ${count ? 'text-slate-500' : (elapsedToday ? 'text-amber-600' : 'text-slate-400')}">${count ? escapeHtml(availableItems[0]?.slot?.day_of_week || '') : (elapsedToday ? 'Ended today' : 'Unavailable')}</div></button>`);
            }
            const monthLabel = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
            listEl.innerHTML = `
                <div class="space-y-3">
                <div class="flex items-center justify-between gap-3">
                    <button type="button" onclick="setAdminAssignCalendarMonth('${shiftAdminAssignMonth(adminAssignCalendarMonth, -1)}')" class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><i class="fas fa-chevron-left mr-2 text-[10px]"></i>Prev</button>
                    <div class="text-sm font-bold text-slate-800">${escapeHtml(monthLabel)}</div>
                    <button type="button" onclick="setAdminAssignCalendarMonth('${shiftAdminAssignMonth(adminAssignCalendarMonth, 1)}')" class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Next<i class="fas fa-chevron-right ml-2 text-[10px]"></i></button>
                </div>
                <div class="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400"><div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div></div>
                <div class="grid grid-cols-7 gap-1.5">${cells.join('')}</div>
                <div class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">Choose a highlighted date to view and pick a time slot.</div>
                </div>`;
        }

        async function loadAdminAssignAvailability() {
            const listEl = document.getElementById('assignRequestAvailabilityList');
            const slot = getAdminAssignRowData(adminAssignActiveRow);
            if (!listEl || !adminAssignRequest || !slot?.teacher_id) {
                adminAssignAvailability = [];
                if (listEl) listEl.innerHTML = '<div class="grid min-h-[320px] place-items-center text-center text-sm text-slate-500"><div><i class="fas fa-user-tie mb-2 text-2xl text-slate-300"></i><p>Select a teacher to view availability.</p></div></div>';
                return;
            }
            listEl.innerHTML = '<div class="grid min-h-[320px] place-items-center text-sm text-slate-500"><span><i class="fas fa-spinner fa-spin mr-2 text-gold-500"></i>Loading teacher availability...</span></div>';
            const token = ++adminAssignAvailabilityToken;
            if (adminAssignAvailabilityController) adminAssignAvailabilityController.abort();
            adminAssignAvailabilityController = new AbortController();
            const params = new URLSearchParams({
                action: 'get-teacher-available-slots',
                teacher_id: String(slot.teacher_id),
                branch_id: String(Number(adminAssignRequest.branch_id || 0)),
                student_id: String(Number(adminAssignRequest.student_id || 0)),
                start_date: document.getElementById('assignRequestDate')?.value || ''
            });
            try {
                const response = await axios.get(`${baseApiUrl}/students.php?${params.toString()}`, {
                    timeout: 30000,
                    signal: adminAssignAvailabilityController.signal
                });
                if (token !== adminAssignAvailabilityToken) return;
                adminAssignAvailability = response.data?.success && Array.isArray(response.data.slots) ? response.data.slots : [];
                adminAssignElapsedAvailabilityDates = new Set(Array.isArray(response.data?.elapsed_availability_dates) ? response.data.elapsed_availability_dates : []);
                adminAssignSelectedDate = adminAssignAvailability[0]?.session_date || '';
                adminAssignCalendarMonth = String(adminAssignSelectedDate).slice(0, 7);
                renderAdminAssignAvailability();
            } catch (error) {
                if (token !== adminAssignAvailabilityToken) return;
                if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') return;
                console.error('Failed to load admin scheduling availability:', error);
                listEl.innerHTML = '<div class="grid min-h-[320px] place-items-center text-center text-sm text-rose-600"><div><i class="fas fa-triangle-exclamation mb-2 text-2xl"></i><p>Unable to load availability.</p><button type="button" onclick="loadAdminAssignAvailability()" class="mt-2 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold">Retry</button></div></div>';
            } finally {
                if (token === adminAssignAvailabilityToken) adminAssignAvailabilityController = null;
            }
        }

        async function openAdminAssignRequestModal(requestId) {
            let request = adminPendingEnrollments.find(row => String(row.request_id) === String(requestId));
            if (!request) {
                await loadPendingEnrollmentSummary();
                request = adminPendingEnrollments.find(row => String(row.request_id) === String(requestId));
            }
            if (!request) return showMessage('Pending enrollment request not found.', 'error');
            adminAssignRequest = request;
            document.getElementById('assignRequestId').value = String(requestId);
            document.getElementById('assignRequestStudentName').textContent = `${request.first_name || ''} ${request.last_name || ''}`.trim() || 'Student';
            document.getElementById('assignRequestStudentBranch').textContent = request.branch_name || '—';
            document.getElementById('assignRequestStudentPackage').textContent = request.package_name || '—';
            document.getElementById('assignRequestStudentInstrument').textContent = Array.isArray(request.instruments) ? request.instruments.map(item => item.type_name || item.instrument_name || 'Instrument').join(', ') : '—';
            const today = new Date(Date.now() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
            const dateEl = document.getElementById('assignRequestDate');
            dateEl.min = today;
            dateEl.value = request.preferred_date && request.preferred_date >= today ? request.preferred_date : today;
            adminAssignAvailability = [];
            adminAssignSelectedDate = '';
            adminAssignCalendarMonth = '';
            const modal = document.getElementById('assignRequestModal');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            document.body.classList.add('overflow-hidden');
            renderAdminAssignRows();
        }

        function closeAdminAssignRequestModal() {
            const modal = document.getElementById('assignRequestModal');
            modal?.classList.add('hidden');
            modal?.classList.remove('flex');
            document.body.classList.remove('overflow-hidden');
            const pageUrl = new URL(window.location.href);
            if (pageUrl.searchParams.has('assign_request_id')) {
                pageUrl.searchParams.delete('assign_request_id');
                window.history.replaceState({}, '', pageUrl);
            }
            adminAssignRequest = null;
            adminAssignActiveRow = null;
            adminAssignAvailabilityToken += 1;
            if (adminAssignAvailabilityTimer) {
                clearTimeout(adminAssignAvailabilityTimer);
                adminAssignAvailabilityTimer = null;
            }
            if (adminAssignAvailabilityController) {
                adminAssignAvailabilityController.abort();
                adminAssignAvailabilityController = null;
            }
        }

        async function submitAdminAssignRequest() {
            if (!adminAssignRequest) return;
            const rows = Array.from(document.querySelectorAll('#assignRequestSlotsContainer .admin-assign-row'));
            const slots = rows.map(getAdminAssignRowData);
            if (!slots.length || slots.some(slot => !slot?.teacher_id || !slot.session_date || !slot.day_of_week || !slot.start_time || !slot.end_time)) {
                return showMessage('Select a teacher and available time for every instrument.', 'error');
            }
            const invalid = slots.find(slot => {
                const [sh, sm] = slot.start_time.split(':').map(Number);
                const [eh, em] = slot.end_time.split(':').map(Number);
                return ((eh * 60 + em) - (sh * 60 + sm)) !== 60;
            });
            if (invalid) return showMessage('Every class slot must be exactly one hour.', 'error');
            if (new Set(slots.map(getAdminAssignSlotKey)).size !== slots.length) {
                return showMessage('The same weekly time cannot be selected more than once.', 'error');
            }
            const submitBtn = document.getElementById('submitAssignRequestBtn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Assigning...';
            try {
                const first = slots[0];
                const response = await axios.post(`${baseApiUrl}/students.php`, {
                    action: 'approve-package-request',
                    request_id: Number(adminAssignRequest.request_id),
                    branch_id: Number(adminAssignRequest.branch_id || 0),
                    teacher_id: Number(first.teacher_id),
                    assigned_date: first.session_date,
                    assigned_day_of_week: first.day_of_week,
                    assigned_start_time: first.start_time,
                    assigned_end_time: first.end_time,
                    assigned_slots: slots,
                    admin_notes: ''
                });
                if (!response.data?.success) throw new Error(response.data?.error || 'Failed to assign schedule.');
                closeAdminAssignRequestModal();
                await Promise.all([loadPendingEnrollmentSummary(), loadActiveEnrollments()]);
                showMessage(response.data.message || 'Enrollment scheduled successfully.', 'success');
            } catch (error) {
                showMessage(error?.response?.data?.error || error.message || 'Unable to assign this schedule.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Assign Schedule';
            }
        }

        window.openAdminAssignRequestModal = openAdminAssignRequestModal;
        window.setAdminAssignCalendarMonth = setAdminAssignCalendarMonth;
        window.selectAdminAssignAvailabilityDate = selectAdminAssignAvailabilityDate;
        window.openAdminAssignAvailabilityDatePicker = openAdminAssignAvailabilityDatePicker;
        window.openAdminAssignScheduleReview = openAdminAssignScheduleReview;
        window.applyAdminAssignAvailabilitySlot = applyAdminAssignAvailabilitySlot;
        window.loadAdminAssignAvailability = loadAdminAssignAvailability;

        async function submitWalkinEnrollment(e) {
            e.preventDefault();
            const submitBtn = document.getElementById('submitWalkinEnrollmentBtn');
            const msgEl = document.getElementById('walkinEnrollmentMessage');
            if (!submitBtn) return;

            const studentSearch = document.getElementById('walkinStudentSearch');
            const studentSelect = document.getElementById('walkinStudentSelect');
            const branchSelect = document.getElementById('walkinBranchSelect');
            const packageSelect = document.getElementById('walkinPackageSelect');
            const paymentTypeEl = document.getElementById('walkinPaymentType');
            const paymentMethodEl = document.getElementById('walkinPaymentMethod');
            const paymentProofEl = document.getElementById('walkinPaymentProof');
            if (!studentSearch || !studentSelect || !branchSelect || !packageSelect || !paymentTypeEl || !paymentMethodEl) return;

            const selectedStudent = resolveWalkinSelectedStudent();
            const branchId = Number(branchSelect.value || 0);
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

            if (!branchId || !email || !studentId || !packageId || !paymentType || !paymentMethod || uniqueInstrumentIds.length < 1) {
                showMessage('Please select a branch, student, package, instrument, and payment method.', 'error');
                return;
            }
            if (Number(selectedStudent?.branch_id || 0) !== branchId) {
                showMessage('The selected student does not belong to this branch.', 'error');
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

            const totalPrice = Number(selectedOption?.getAttribute('data-price') || 0);
            const baseSessions = Number(selectedOption?.getAttribute('data-sessions') || 0);
            const requestedSessionCount = Math.max(baseSessions, Number(document.getElementById('walkinSessionCount')?.value || baseSessions));
            const extraSessions = Math.max(0, requestedSessionCount - baseSessions);
            const requestedTotal = totalPrice + (extraSessions * 650);
            const payableNow = typeof computeStudentRequestPayableNow === 'function'
                ? computeStudentRequestPayableNow(requestedTotal, requestedSessionCount, paymentType)
                : (paymentType === 'Partial Payment' ? Math.round(requestedTotal * 0.42) : requestedTotal);

            try {
                const requestFormData = new FormData();
                requestFormData.append('action', 'submit-package-request');
                requestFormData.append('student_id', String(Number(studentId)));
                requestFormData.append('branch_id', String(branchId));
                requestFormData.append('package_id', String(packageId));
                requestFormData.append('payment_type', paymentType);
                requestFormData.append('payment_method', paymentMethod);
                requestFormData.append('instrument_ids_json', JSON.stringify(uniqueInstrumentIds));
                requestFormData.append('is_walkin_request', '1');
                requestFormData.append('requested_amount', String(requestedTotal));
                requestFormData.append('payable_now', String(payableNow));
                requestFormData.append('requested_session_count', String(requestedSessionCount));
                if (paymentProofFile) {
                    requestFormData.append('package_payment_proof_file', paymentProofFile);
                }

                const response = await postStudentPackageRequest(requestFormData);
                if (response.success) {
                    closeWalkinEnrollmentModal();
                    const pendingUrl = new URL(window.location.href);
                    pendingUrl.searchParams.set('view', 'pending');
                    pendingUrl.searchParams.delete('assign_request_id');
                    window.history.replaceState({}, '', pendingUrl);
                    applyEnrollmentView();
                    const pageBranchFilter = document.getElementById('branchFilter');
                    if (pageBranchFilter) pageBranchFilter.value = '';
                    await loadPendingEnrollmentSummary();
                    if (response.request_id) {
                        await openAdminAssignRequestModal(response.request_id);
                    } else {
                        showMessage(response.message || 'Walk-in enrollment submitted.', 'success');
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

            loadEnrollmentBranches();
            loadPendingEnrollmentSummary().then(() => {
                const requestId = Number(new URLSearchParams(window.location.search).get('assign_request_id') || 0);
                if (requestId) void openAdminAssignRequestModal(requestId);
            });
            loadActiveEnrollments();
            applyEnrollmentView();

            document.getElementById('branchFilter')?.addEventListener('change', () => {
                loadPendingEnrollmentSummary();
                loadActiveEnrollments();
            });
            document.getElementById('closeAssignRequestModalBtn')?.addEventListener('click', closeAdminAssignRequestModal);
            document.getElementById('cancelAssignRequestBtn')?.addEventListener('click', closeAdminAssignRequestModal);
            document.getElementById('submitAssignRequestBtn')?.addEventListener('click', submitAdminAssignRequest);
            document.getElementById('addAssignRequestSlotBtn')?.addEventListener('click', addAdminAssignDay);
            document.getElementById('assignRequestDate')?.addEventListener('change', () => queueAdminAssignAvailability(120));
            document.getElementById('assignRequestModal')?.addEventListener('click', event => {
                if (event.target?.id === 'assignRequestModal') closeAdminAssignRequestModal();
            });
            document.getElementById('enrollmentSearchInput')?.addEventListener('input', () => {
                adminEnrollmentSearch = String(document.getElementById('enrollmentSearchInput')?.value || '');
                renderPendingPackageRequests();
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
            document.getElementById('openSessionExtensionRequestsModalBtn')?.addEventListener('click', () => {
                const modal = document.getElementById('sessionExtensionRequestsModal');
                modal?.classList.remove('hidden');
                modal?.classList.add('flex');
                renderPendingSessionExtensionRequests();
            });
            document.getElementById('closeSessionExtensionRequestsModalBtn')?.addEventListener('click', () => {
                const modal = document.getElementById('sessionExtensionRequestsModal');
                modal?.classList.add('hidden');
                modal?.classList.remove('flex');
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
            document.getElementById('walkinBranchSelect')?.addEventListener('change', async () => {
                resetWalkinStudentSelection();
                await loadWalkinStudents();
            });
            document.getElementById('walkinStudentSearch')?.addEventListener('input', (event) => {
                renderWalkinStudentResults(event.target.value);
            });
            document.getElementById('walkinStudentResults')?.addEventListener('click', async (event) => {
                const button = event.target.closest('.walkin-student-result');
                if (!button) return;
                const student = walkinStudentLookup.get(String(button.dataset.studentLabel || '').toLowerCase());
                if (!student) return;
                const input = document.getElementById('walkinStudentSearch');
                const hidden = document.getElementById('walkinStudentSelect');
                if (input) input.value = getWalkinStudentLabel(student);
                if (hidden) hidden.value = student.email || '';
                await handleWalkinStudentChange();
            });
            document.getElementById('walkinClearStudentBtn')?.addEventListener('click', () => {
                resetWalkinStudentSelection();
                renderWalkinStudentResults('');
                document.getElementById('walkinStudentSearch')?.focus();
            });
            document.getElementById('walkinPackageSelect')?.addEventListener('change', updateWalkinPackageUI);
            document.getElementById('walkinPackageCards')?.addEventListener('click', (event) => {
                const card = event.target.closest('.admin-package-card');
                if (!card) return;
                const select = document.getElementById('walkinPackageSelect');
                if (!select) return;
                select.value = card.dataset.packageId || '';
                syncWalkinSessionControl(true);
                updateWalkinPackageUI(true);
            });
            document.getElementById('walkinPaymentType')?.addEventListener('change', () => updateWalkinPackageUI(false));
            document.getElementById('walkinSessionDecreaseBtn')?.addEventListener('click', () => {
                const input = document.getElementById('walkinSessionCount');
                if (!input) return;
                const minimum = Number(input.min || 1);
                input.value = String(Math.max(minimum, Number(input.value || minimum) - 1));
                updateWalkinPackageUI(false);
            });
            document.getElementById('walkinSessionIncreaseBtn')?.addEventListener('click', () => {
                const input = document.getElementById('walkinSessionCount');
                if (!input) return;
                const maximum = Number(input.max || 100);
                input.value = String(Math.min(maximum, Number(input.value || input.min || 1) + 1));
                updateWalkinPackageUI(false);
            });
            document.getElementById('walkinSessionCount')?.addEventListener('change', (event) => {
                const minimum = Number(event.target.min || 1);
                const maximum = Number(event.target.max || 100);
                event.target.value = String(Math.max(minimum, Math.min(maximum, Number(event.target.value || minimum))));
                updateWalkinPackageUI(false);
            });
            document.getElementById('walkinPaymentMethod')?.addEventListener('change', (event) => {
                const proofWrap = document.getElementById('walkinPaymentProofWrap');
                const proofInput = document.getElementById('walkinPaymentProof');
                const needsProof = Boolean(event.target.value && event.target.value !== 'Cash');
                proofWrap?.classList.toggle('hidden', !needsProof);
                if (proofInput) proofInput.required = needsProof;
            });
            document.getElementById('walkinEnrollmentForm')?.addEventListener('submit', submitWalkinEnrollment);
            document.getElementById('walkinEnrollmentModal')?.addEventListener('click', (event) => {
                if (event.target?.id === 'walkinEnrollmentModal') closeWalkinEnrollmentModal();
            });

            loadWalkinBranches();
            loadWalkinStudents();
        });
