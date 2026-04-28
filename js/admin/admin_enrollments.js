        window.adminEnrollmentsAllowActions = true;
        window.pendingRequestActionLabel = 'Schedule Sessions';
        window.onPendingRequestAssignClick = function(requestId) {
            window.location.href = `admin_sessions.html?view=pending&assign_request_id=${requestId}`;
        };

        function setEnrollmentNavState(view) {
            const pendingLink = document.getElementById('enrollNavPending');
            const activeLink = document.getElementById('enrollNavActive');
            const sidebarPending = document.getElementById('navEnrollPending');
            const sidebarActive = document.getElementById('navEnrollActive');

            const baseClass = 'px-4 py-2 text-sm font-semibold rounded-lg text-slate-700 hover:bg-slate-100 transition';
            const activeClass = 'px-4 py-2 text-sm font-semibold rounded-lg bg-gold-500 text-white shadow';
            if (pendingLink) pendingLink.className = (view === 'pending') ? activeClass : baseClass;
            if (activeLink) activeLink.className = (view === 'active') ? activeClass : baseClass;

            const sidebarBase = 'block ml-11 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all';
            const sidebarActiveClass = 'block ml-11 px-3 py-2 text-sm font-semibold text-white bg-white/10 rounded-lg';
            if (sidebarPending) sidebarPending.className = (view === 'pending') ? sidebarActiveClass : sidebarBase;
            if (sidebarActive) sidebarActive.className = (view === 'active') ? sidebarActiveClass : sidebarBase;
        }

        function applyEnrollmentView() {
            const params = new URLSearchParams(window.location.search);
            const view = String(params.get('view') || '').toLowerCase();
            const pendingSection = document.getElementById('pendingSessionsSection');
            const activeSection = document.getElementById('activeEnrollmentsSection');
            const title = document.getElementById('sessionsPageTitle');
            const subtitle = document.getElementById('sessionsPageSubtitle');

            if (view === 'pending') {
                if (pendingSection) pendingSection.classList.remove('hidden');
                if (activeSection) activeSection.classList.add('hidden');
                if (title) title.textContent = 'Pending Enrollments';
                if (subtitle) subtitle.textContent = 'Requests submitted by students and waiting for branch manager action.';
                setEnrollmentNavState('pending');
                return;
            }

            if (view === 'active') {
                if (pendingSection) pendingSection.classList.add('hidden');
                if (activeSection) activeSection.classList.remove('hidden');
                if (title) title.textContent = 'Active Enrollments';
                if (subtitle) subtitle.textContent = 'Students with approved packages and active sessions.';
                setEnrollmentNavState('active');
                return;
            }

            if (pendingSection) pendingSection.classList.remove('hidden');
            if (activeSection) activeSection.classList.remove('hidden');
            if (title) title.textContent = 'Enrollments';
            if (subtitle) subtitle.textContent = 'General overview of pending and active enrollments.';
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

        async function loadActiveEnrollments() {
            const tableBody = document.getElementById('activeEnrollmentsTable');
            const countEl = document.getElementById('activeEnrollmentCount');
            if (!tableBody) return;

            try {
                const branchFilter = document.getElementById('branchFilter');
                let url = `${baseApiUrl}/students.php?action=get-active-enrollments`;
                if (branchFilter && branchFilter.value) {
                    url += `&branch_id=${branchFilter.value}`;
                }

                const response = await axios.get(url);
                const data = response.data;
                const enrollments = data.success && Array.isArray(data.enrollments) ? data.enrollments : [];

                if (countEl) countEl.textContent = `${enrollments.length} active`;

                if (!enrollments.length) {
                    tableBody.innerHTML = `
                        <tr>
                                <td colspan="10" class="px-6 py-8 text-center text-slate-500">
                                    <i class="fas fa-user-check text-2xl mb-2 text-gold-500/60"></i>
                                    <p>No active enrollments found.</p>
                                </td>
                            </tr>`;
                    return;
                }

                tableBody.innerHTML = enrollments.map(r => {
                    const studentName = `${escapeHtml(r.first_name || '')} ${escapeHtml(r.last_name || '')}`.trim();
                    const packageName = escapeHtml(r.package_name || '—');
                    const teacherName = `${escapeHtml(r.teacher_first_name || '')} ${escapeHtml(r.teacher_last_name || '')}`.trim() || '—';
                    const roomName = escapeHtml(r.assigned_room || '—');
                    const sessionDate = r.first_session_date ? new Date(r.first_session_date).toLocaleDateString() : '—';
                    const startTime = formatTime12Hour(r.first_start_time);
                    const endTime = formatTime12Hour(r.first_end_time);
                    const sessionTime = r.first_session_date ? `${sessionDate} • ${startTime} - ${endTime}` : '—';
                    const paymentType = escapeHtml(r.payment_type || '—');
                    const totalAmount = Number(r.total_amount || 0);
                    const paidAmount = Number(r.paid_amount || 0);
                    const amountText = `${formatCurrencyPHP(paidAmount)} / ${formatCurrencyPHP(totalAmount)}`;
                    const balanceText = formatCurrencyPHP(Math.max(0, totalAmount - paidAmount));
                    const statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-700">Active</span>';
                    return `
                        <tr class="hover:bg-slate-50/80 transition">
                            <td class="px-6 py-4">
                                <div class="font-medium text-slate-900">${studentName || 'Student'}</div>
                                <div class="text-sm text-slate-500">${escapeHtml(r.email || '')}</div>
                            </td>
                            <td class="px-6 py-4 text-sm text-slate-700">${escapeHtml(r.branch_name || '—')}</td>
                            <td class="px-6 py-4 text-sm text-slate-700">${packageName}</td>
                            <td class="px-6 py-4 text-sm text-slate-700">${sessionTime}</td>
                            <td class="px-6 py-4 text-sm text-slate-700">${teacherName}</td>
                            <td class="px-6 py-4 text-sm text-slate-700">${roomName}</td>
                            <td class="px-6 py-4 text-sm text-slate-700">${paymentType}</td>
                            <td class="px-6 py-4 text-sm text-slate-700">${amountText}</td>
                            <td class="px-6 py-4 text-sm text-slate-700">${balanceText}</td>
                            <td class="px-6 py-4">${statusBadge}</td>
                        </tr>`;
                }).join('');
            } catch (error) {
                console.error('Failed to load active enrollments:', error);
                if (countEl) countEl.textContent = 'Error';
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="10" class="px-6 py-8 text-center text-red-500">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <p>Failed to load active enrollments.</p>
                        </td>
                    </tr>`;
            }
        }

        let walkinStudents = [];
        let walkinMeta = null;
        let walkinStudentLookup = new Map();

        async function loadWalkinStudents() {
            try {
                const branchFilter = document.getElementById('branchFilter');
                let url = `${baseApiUrl}/students.php?action=get-active-students`;
                if (branchFilter && branchFilter.value) {
                    url += `&branch_id=${branchFilter.value}`;
                }
                const response = await axios.get(url);
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
            const partialAmount = computeStudentRequestPayableNow(price, sessions, 'Partial Payment');
            const fullAmount = computeStudentRequestPayableNow(price, sessions, 'Full Payment');
            const installmentAmount = computeStudentRequestPayableNow(price, sessions, 'Installment');
            const payableNow = computeStudentRequestPayableNow(price, sessions, paymentType);
            const selectedLabel = paymentType === 'Full Payment'
                ? 'Full Payment'
                : (paymentType === 'Installment' ? 'Installment (est. per session)' : 'Partial Payment');
            amountEl.innerHTML = `Estimated package amount: <span class="font-bold">${formatCurrencyPHP(price)}</span><br>Full Payment: <span class="font-bold">${formatCurrencyPHP(fullAmount)}</span> | Partial Payment: <span class="font-bold">${formatCurrencyPHP(partialAmount)}</span><br>Installment (est./session): <span class="font-bold">${formatCurrencyPHP(installmentAmount)}</span><br>Amount to pay now (${escapeHtml(selectedLabel)}): <span class="font-bold">${formatCurrencyPHP(payableNow)}</span>`;
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
            const instrumentIds = Array.from(document.querySelectorAll('#walkinInstrumentsContainer .student-request-instrument'))
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
                    loadPendingRequests();
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
            loadPendingRequests();
            loadActiveEnrollments();
            loadWalkinStudents();
            applyEnrollmentView();

            document.getElementById('branchFilter')?.addEventListener('change', () => {
                loadPendingRequests();
                loadActiveEnrollments();
                loadWalkinStudents();
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
            document.getElementById('openWalkinEnrollmentModalBtn')?.addEventListener('click', openWalkinEnrollmentModal);
            document.getElementById('closeWalkinEnrollmentModalBtn')?.addEventListener('click', closeWalkinEnrollmentModal);
            document.getElementById('cancelWalkinEnrollmentBtn')?.addEventListener('click', closeWalkinEnrollmentModal);
            document.getElementById('walkinEnrollmentForm')?.addEventListener('submit', submitWalkinEnrollment);
            document.getElementById('walkinStudentSearch')?.addEventListener('input', handleWalkinStudentChange);
            document.getElementById('walkinStudentSearch')?.addEventListener('change', handleWalkinStudentChange);
            document.getElementById('walkinPackageSelect')?.addEventListener('change', updateWalkinPackageUI);
            document.getElementById('walkinPaymentType')?.addEventListener('change', updateWalkinPackageUI);
        });
