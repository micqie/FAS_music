   let allStudents = [];
        let cancelledSessions = [];
        let packagePagePackages = [];
        let availableRoomsByBranch = {};
        let assignRequestTeacherCandidates = [];

        function showMessage(message, type = 'error') {
            Swal.fire({
                icon: type === 'success' ? 'success' : 'error',
                title: type === 'success' ? 'Success' : 'Error',
                text: message,
                confirmButtonColor: '#b8860b'
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

        async function maybeAutoOpenAssignPackageModalFromUrl() {
            const params = new URLSearchParams(window.location.search);
            const studentId = Number(params.get('assign_student_id') || 0);
            if (!studentId) return;

            const studentName = params.get('assign_student_name') || '';
            const packageId = Number(params.get('assign_package_id') || 0) || null;

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

            openAssignRequestModal(requestId);
        }

        async function loadBranches() {
            const branchFilter = document.getElementById('branchFilter');
            if (!branchFilter) return;

            try {
                const response = await axios.get(`${baseApiUrl}/branch.php?action=get-branches`);
                const data = response.data;

                if (data.success && data.branches) {
                    const options = data.branches.map(branch =>
                        `<option value="${branch.branch_id}">${branch.branch_name}</option>`
                    ).join('');
                    branchFilter.innerHTML = '<option value="">All Branches</option>' + options;
                }
            } catch (error) {
                console.error('Failed to load branches:', error);
            }
        }

        async function loadSessionPackages() {
            try {
                const response = await axios.get(`${baseApiUrl}/sessions.php?action=get-packages`);
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

        function formatDateShort(dateString) {
            if (!dateString) return '—';
            const d = new Date(dateString);
            return Number.isNaN(d.getTime()) ? dateString : d.toLocaleDateString();
        }

        function formatTeacherSuggestionText(teacher) {
            const teacherName = String(teacher?.teacher_name || 'Teacher').trim();
            const specialization = String(teacher?.specialization || 'General').trim();
            return specialization && specialization !== 'General'
                ? `${teacherName} • ${specialization}`
                : teacherName;
        }

        function setAssignRequestTeacherSelection(teacherId) {
            const hiddenInput = document.getElementById('assignRequestTeacherSelect');
            const searchInput = document.getElementById('assignRequestTeacherSearch');
            const helpEl = document.getElementById('assignRequestTeacherSearchHelp');
            const suggestionsEl = document.getElementById('assignRequestTeacherSuggestions');
            const selected = assignRequestTeacherCandidates.find(t => Number(t.teacher_id) === Number(teacherId)) || null;

            if (hiddenInput) hiddenInput.value = selected ? String(Number(selected.teacher_id)) : '';
            if (searchInput) {
                searchInput.value = '';
                searchInput.placeholder = selected
                    ? `Selected: ${String(selected.teacher_name || '').trim()}`
                    : 'Search teacher or specialization...';
            }
            if (helpEl) {
                helpEl.textContent = selected
                    ? `Selected: ${formatTeacherSuggestionText(selected)}`
                    : 'Search teacher or specialization.';
            }
            if (suggestionsEl) {
                suggestionsEl.classList.add('hidden');
                suggestionsEl.innerHTML = '';
            }
        }

        function renderAssignRequestTeacherSuggestions(query = '') {
            const suggestionsEl = document.getElementById('assignRequestTeacherSuggestions');
            if (!suggestionsEl) return;

            const keyword = String(query || '').trim().toLowerCase();
            const rows = assignRequestTeacherCandidates.filter(t => {
                if (!keyword) return true;
                const haystack = `${String(t.teacher_name || '')} ${String(t.specialization || '')}`.toLowerCase();
                return haystack.includes(keyword);
            });

            if (!rows.length) {
                suggestionsEl.innerHTML = '<div class="px-4 py-3 text-sm text-zinc-400">No matching teacher found.</div>';
                suggestionsEl.classList.remove('hidden');
                return;
            }

            suggestionsEl.innerHTML = rows.map((teacher) => `
                <button type="button" class="w-full text-left px-4 py-3 hover:bg-zinc-900 transition border-b border-zinc-800 last:border-b-0" onclick="setAssignRequestTeacherSelection(${Number(teacher.teacher_id)})">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <div class="text-sm font-semibold text-white">${escapeHtml(teacher.teacher_name || 'Teacher')}</div>
                            <div class="text-xs text-zinc-400 mt-1">${escapeHtml(teacher.specialization || 'General')}</div>
                        </div>
                        <span class="inline-flex items-center px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold">Recommended</span>
                    </div>
                </button>
            `).join('');
            suggestionsEl.classList.remove('hidden');
        }

        function initAssignTeacherSearchBox() {
            const searchInput = document.getElementById('assignRequestTeacherSearch');
            const suggestionsEl = document.getElementById('assignRequestTeacherSuggestions');
            if (!searchInput || !suggestionsEl) return;

            searchInput.addEventListener('focus', () => {
                renderAssignRequestTeacherSuggestions('');
            });
            searchInput.addEventListener('input', () => {
                renderAssignRequestTeacherSuggestions(searchInput.value || '');
            });
            document.addEventListener('click', (event) => {
                const withinSearch = event.target.closest('#assignRequestTeacherSuggestions') || event.target.closest('#assignRequestTeacherSearch');
                if (!withinSearch) {
                    suggestionsEl.classList.add('hidden');
                }
            });
        }

        function getSessionStatusBadge(status) {
            const value = String(status || '').trim();
            const normalized = value.toLowerCase();
            let classes = 'bg-slate-100 text-slate-700';
            if (normalized === 'scheduled') classes = 'bg-sky-100 text-sky-700';
            if (normalized === 'completed') classes = 'bg-emerald-100 text-emerald-700';
            if (normalized === 'cancelled_by_teacher') classes = 'bg-rose-100 text-rose-700';
            if (normalized === 'rescheduled') classes = 'bg-amber-100 text-amber-700';
            if (normalized === 'no show') classes = 'bg-red-100 text-red-700';
            return `<span class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${classes}">${escapeHtml(value || 'Unknown')}</span>`;
        }

        async function fetchRoomsForBranch(branchId) {
            const key = Number(branchId || 0);
            if (key > 0 && Array.isArray(availableRoomsByBranch[key])) {
                return availableRoomsByBranch[key];
            }
            try {
                let url = `${baseApiUrl}/students.php?action=get-available-rooms`;
                if (key > 0) {
                    url += `&branch_id=${key}`;
                }
                const response = await axios.get(url);
                const data = response.data;
                const rooms = data.success && Array.isArray(data.rooms) ? data.rooms : [];
                availableRoomsByBranch[key] = rooms;
                return rooms;
            } catch (error) {
                console.error('Failed to load rooms:', error);
                return [];
            }
        }

        async function populateAssignRoomDropdown(req) {
            const roomEl = document.getElementById('assignRequestRoom');
            if (!roomEl) return;

            roomEl.innerHTML = '<option value="">Select room...</option>';
            const rooms = await fetchRoomsForBranch(req?.branch_id || 0);
            if (!rooms.length) {
                roomEl.innerHTML = '<option value="">No available rooms in this branch</option>';
                return;
            }
            roomEl.innerHTML = '<option value="">Select room...</option>' + rooms.map(room => {
                const label = `${escapeHtml(room.room_name || 'Room')} (${escapeHtml(room.room_type || 'Room')}, cap ${Number(room.capacity || 1)})`;
                return `<option value="${escapeHtml(room.room_name || '')}">${label}</option>`;
            }).join('');
        }

        async function loadPendingRequests() {
            const tableBody = document.getElementById('pendingRequestsTable');
            const countEl = document.getElementById('pendingRequestCount');
            const hasTable = !!tableBody;

            try {
                const branchFilter = document.getElementById('branchFilter');
                let url = `${baseApiUrl}/students.php?action=get-pending-package-requests`;
                if (branchFilter && branchFilter.value) {
                    url += `&branch_id=${branchFilter.value}`;
                }

                const response = await axios.get(url);
                const data = response.data;
                const requests = data.success && Array.isArray(data.requests) ? data.requests : [];

                if (countEl) countEl.textContent = `${requests.length} pending`;

                pendingRequestsById = {};
                if (!hasTable) {
                    requests.forEach(r => {
                        pendingRequestsById[String(r.request_id)] = r;
                    });
                    return;
                }

                if (!requests.length) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="7" class="px-6 py-8 text-center text-slate-500">
                                <i class="fas fa-inbox text-2xl mb-2 text-gold-500/60"></i>
                                <p>No pending student requests.</p>
                            </td>
                        </tr>`;
                    return;
                }

                tableBody.innerHTML = requests.map(r => {
                    pendingRequestsById[String(r.request_id)] = r;
                    const studentName = `${escapeHtml(r.first_name || '')} ${escapeHtml(r.last_name || '')}`.trim();
                    const pkg = escapeHtml(r.package_name || '—');
                    const instruments = Array.isArray(r.instruments) && r.instruments.length
                        ? r.instruments.map(i => escapeHtml(i.instrument_name || 'Instrument')).join(', ')
                        : '—';
                    const schedule = r.preferred_day_of_week
                        ? `${escapeHtml(r.preferred_day_of_week)}`
                        : '—';
                    const prefDate = r.preferred_date ? new Date(r.preferred_date).toLocaleDateString() : '—';
                    const paymentType = escapeHtml(r.payment_type || 'Partial Payment');
                    const paymentMethod = escapeHtml(r.payment_method || '—');
                    const payableNow = Number(r.payable_now || 0);
                    const paymentProofHtml = r.payment_proof_path
                        ? `<a href="${escapeHtml(buildPublicFileUrl(r.payment_proof_path))}" target="_blank" rel="noopener" class="text-xs text-blue-600 underline">View payment proof</a>`
                        : '<span class="text-xs text-slate-500">No payment proof</span>';
                    return `
                        <tr class="hover:bg-slate-50/80 transition">
                            <td class="px-6 py-4">
                                <div class="font-medium text-slate-900">${studentName || 'Student'}</div>
                                <div class="text-sm text-slate-500">${escapeHtml(r.email || '')}</div>
                                <div class="text-xs text-slate-400">${escapeHtml(r.branch_name || '')}</div>
                            </td>
                            <td class="px-6 py-4 text-sm text-slate-700">${pkg}</td>
                            <td class="px-6 py-4 text-sm text-slate-700">${instruments}</td>
                            <td class="px-6 py-4 text-sm text-slate-700">
                                <div>${schedule}</div>
                                <div class="text-xs text-slate-500 mt-1">Date: ${prefDate}</div>
                            </td>
                            <td class="px-6 py-4 text-sm text-slate-700">
                                <div class="font-semibold text-slate-800">${paymentType}</div>
                                <div class="text-xs text-slate-500 mt-1">Method: ${paymentMethod}</div>
                                <div class="text-xs text-slate-500 mt-1">Pay now: ${formatCurrencyPHP(payableNow)}</div>
                                <div class="mt-1">${paymentProofHtml}</div>
                            </td>
                            <td class="px-6 py-4 text-sm font-semibold text-gold-600">${formatCurrencyPHP(payableNow)}</td>
                            <td class="px-6 py-4">
                                <button onclick="openPendingRequestViewModal(${Number(r.request_id)})" class="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold">
                                    View
                                </button>
                            </td>
                        </tr>`;
                }).join('');
            } catch (error) {
                console.error('Failed to load pending package requests:', error);
                if (countEl) countEl.textContent = 'Error';
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-8 text-center text-red-500">
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
            const preferredDay = escapeHtml(req.preferred_day_of_week || '—');
            const preferredDate = req.preferred_date ? new Date(req.preferred_date).toLocaleDateString() : '—';
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
                            <div><span class="font-semibold text-slate-900">Preferred Day:</span> ${preferredDay}</div>
                            <div><span class="font-semibold text-slate-900">Preferred Date:</span> ${preferredDate}</div>
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

        async function openAssignRequestModal(requestId) {
            const req = pendingRequestsById[String(requestId)];
            if (!req) {
                showMessage('Request not found.', 'error');
                return;
            }

            const modal = document.getElementById('assignRequestModal');
            const info = document.getElementById('assignRequestStudentInfo');
            const studentNameEl = document.getElementById('assignRequestStudentName');
            const studentBranchEl = document.getElementById('assignRequestStudentBranch');
            const studentPackageEl = document.getElementById('assignRequestStudentPackage');
            const studentInstrumentEl = document.getElementById('assignRequestStudentInstrument');
            const requestIdEl = document.getElementById('assignRequestId');
            const teacherSelect = document.getElementById('assignRequestTeacherSelect');
            const teacherSearch = document.getElementById('assignRequestTeacherSearch');
            const teacherHelp = document.getElementById('assignRequestTeacherSearchHelp');
            const dateEl = document.getElementById('assignRequestDate');
            const dayEl = document.getElementById('assignRequestDay');
            const startEl = document.getElementById('assignRequestStartTime');
            const endEl = document.getElementById('assignRequestEndTime');
            const roomEl = document.getElementById('assignRequestRoom');
            const notesEl = document.getElementById('assignRequestNotes');

            if (!modal || !info || !requestIdEl || !teacherSelect || !dateEl || !dayEl || !startEl || !endEl || !roomEl || !notesEl) return;

            const studentName = `${req.first_name || ''} ${req.last_name || ''}`.trim();
            const instrumentSummary = Array.isArray(req.instruments) && req.instruments.length
                ? req.instruments.map(i => {
                    const instrumentName = escapeHtml(i.instrument_name || 'Instrument');
                    const typeName = escapeHtml(i.type_name || '');
                    return typeName ? `${instrumentName} (${typeName})` : instrumentName;
                }).join(', ')
                : '—';
            info.textContent = `Preferred schedule: ${req.preferred_day_of_week || '—'} / ${req.preferred_date || '—'}`;
            if (studentNameEl) studentNameEl.textContent = studentName || 'Student';
            if (studentBranchEl) studentBranchEl.textContent = req.branch_name || 'No branch';
            if (studentPackageEl) studentPackageEl.textContent = req.package_name || 'Package';
            if (studentInstrumentEl) studentInstrumentEl.innerHTML = instrumentSummary;
            requestIdEl.value = String(requestId);

            assignRequestTeacherCandidates = Array.isArray(req.teacher_candidates) ? req.teacher_candidates : [];
            teacherSelect.value = '';
            if (teacherSearch) teacherSearch.value = '';
            if (teacherHelp) {
                teacherHelp.textContent = assignRequestTeacherCandidates.length
                    ? 'Recommended teachers are matched from the student request. You can search by name or specialization.'
                    : 'No teacher suggestions found yet for this request.';
            }
            if (assignRequestTeacherCandidates.length) {
                setAssignRequestTeacherSelection(assignRequestTeacherCandidates[0].teacher_id);
            } else {
                setAssignRequestTeacherSelection('');
            }

            dateEl.value = req.preferred_date || '';
            dayEl.value = getDayNameFromDate(dateEl.value || '') || req.preferred_day_of_week || '';
            startEl.value = '';
            endEl.value = '';
            await populateAssignRoomDropdown(req);
            roomEl.value = '';
            notesEl.value = '';

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function closeAssignRequestModal() {
            const modal = document.getElementById('assignRequestModal');
            if (!modal) return;
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
            const teacherId = Number(document.getElementById('assignRequestTeacherSelect')?.value || 0);
            const assignedDate = document.getElementById('assignRequestDate')?.value || '';
            const assignedDay = getDayNameFromDate(assignedDate);
            const assignedStart = document.getElementById('assignRequestStartTime')?.value || '';
            const assignedEnd = document.getElementById('assignRequestEndTime')?.value || '';
            const assignedRoom = document.getElementById('assignRequestRoom')?.value?.trim() || '';
            const adminNotes = document.getElementById('assignRequestNotes')?.value?.trim() || '';

            if (!requestId || !teacherId || !assignedDate || !assignedDay || !assignedStart || !assignedEnd) {
                showMessage('Please complete teacher, date, start time, and end time.', 'error');
                return;
            }
            if (assignedStart >= assignedEnd) {
                showMessage('End time must be later than start time.', 'error');
                return;
            }

            await approveStudentRequest({
                action: 'approve-package-request',
                request_id: requestId,
                teacher_id: teacherId,
                assigned_date: assignedDate,
                assigned_day_of_week: assignedDay,
                assigned_start_time: assignedStart,
                assigned_end_time: assignedEnd,
                assigned_room: assignedRoom,
                admin_notes: adminNotes
            });
        }

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
                    admin_notes: input.value || ''
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
            const listEl = document.getElementById('sessionsList');
            const countEl = document.getElementById('studentCount');
            if (!listEl) return;

            try {
                const branchFilter = document.getElementById('branchFilter');
                let url = `${baseApiUrl}/students.php?action=get-active-enrollments`;
                if (branchFilter && branchFilter.value) {
                    url += `&branch_id=${branchFilter.value}`;
                }

                const response = await axios.get(url);
                const data = response.data;

                if (data.success && Array.isArray(data.enrollments)) {
                    allStudents = data.enrollments;
                    renderStudents(listEl);
                    if (countEl) countEl.textContent = `${data.enrollments.length} enrolled`;
                } else {
                    listEl.innerHTML = `
                        <tr>
                            <td colspan="4" class="px-6 py-8 text-center text-slate-500">
                                <i class="fas fa-users text-3xl mb-2 text-gold-500/50"></i>
                                <p>No enrolled students found.</p>
                            </td>
                        </tr>`;
                    if (countEl) countEl.textContent = '0 enrolled';
                }
            } catch (error) {
                console.error('Failed to load sessions:', error);
                listEl.innerHTML = `
                    <tr>
                        <td colspan="4" class="px-6 py-8 text-center text-red-500">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <p>Failed to load sessions. Please try again.</p>
                        </td>
                    </tr>`;
            }
        }

        async function loadCancelledSessions() {
            const listEl = document.getElementById('cancelledSessionsList');
            const countEl = document.getElementById('cancelledSessionCount');
            if (!listEl) return;

            try {
                const branchFilter = document.getElementById('branchFilter');
                let url = `${baseApiUrl}/students.php?action=get-cancelled-sessions`;
                if (branchFilter && branchFilter.value) {
                    url += `&branch_id=${encodeURIComponent(branchFilter.value)}`;
                }
                const response = await axios.get(url);
                const data = response.data || {};
                cancelledSessions = data.success && Array.isArray(data.sessions) ? data.sessions : [];
                if (countEl) countEl.textContent = `${cancelledSessions.length} waiting`;
                renderCancelledSessions(listEl);
            } catch (error) {
                console.error('Failed to load cancelled sessions:', error);
                cancelledSessions = [];
                if (countEl) countEl.textContent = 'Error';
                listEl.innerHTML = '<div class="text-sm text-red-500">Failed to load cancelled sessions.</div>';
            }
        }

        function renderCancelledSessions(listEl) {
            if (!cancelledSessions.length) {
                listEl.innerHTML = `
                    <div class="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                        No teacher-cancelled sessions need rescheduling right now.
                    </div>`;
                return;
            }

            listEl.innerHTML = cancelledSessions.map(session => {
                const studentName = `${escapeHtml(session.student_first_name || '')} ${escapeHtml(session.student_last_name || '')}`.trim() || 'Student';
                const teacherName = `${escapeHtml(session.teacher_first_name || '')} ${escapeHtml(session.teacher_last_name || '')}`.trim() || 'Teacher';
                const originalTime = `${formatDateShort(session.session_date)} • ${formatTime12Hour(session.start_time)} - ${formatTime12Hour(session.end_time)}`;
                const reason = session.cancellation_reason ? escapeHtml(session.cancellation_reason) : 'No reason provided.';
                const roomText = session.room_name ? ` • ${escapeHtml(session.room_name)}` : '';
                return `
                    <div class="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div class="space-y-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <div class="text-sm font-bold text-slate-900">${studentName}</div>
                                ${getSessionStatusBadge(session.status)}
                            </div>
                            <div class="text-xs text-slate-500">${escapeHtml(session.package_name || 'Package')} • Session ${Number(session.session_number || 0)}</div>
                            <div class="text-sm text-slate-700">${teacherName}${roomText}</div>
                            <div class="text-sm text-slate-600">Cancelled slot: ${originalTime}</div>
                            <div class="text-xs text-slate-500">Reason: ${reason}</div>
                        </div>
                        <div class="text-xs font-semibold text-rose-600">Branch manager action required</div>
                    </div>
                `;
            }).join('');
        }

        function renderStudents(listEl) {
            if (!allStudents.length) {
                listEl.innerHTML = `
                    <tr>
                        <td colspan="4" class="px-6 py-8 text-center text-slate-500">
                            <i class="fas fa-users text-3xl mb-2 text-gold-500/50"></i>
                            <p>No enrolled students found.</p>
                        </td>
                    </tr>`;
                return;
            }

            listEl.innerHTML = allStudents.map(student => {
                const studentName = `${escapeHtml(student.first_name || '')} ${escapeHtml(student.last_name || '')}`.trim() || 'Student';
                const packageName = escapeHtml(student.package_name || '—');
                const sessionsTotal = Number(student.sessions || 0);
                return `
                    <tr class="hover:bg-slate-50/80 transition">
                        <td class="px-6 py-4">
                            <div class="font-medium text-slate-900">${studentName}</div>
                            <div class="text-sm text-slate-500">${escapeHtml(student.email || '')}</div>
                        </td>
                        <td class="px-6 py-4 text-sm text-slate-700">${escapeHtml(student.branch_name || '—')}</td>
                        <td class="px-6 py-4 text-sm text-slate-700">
                            ${packageName}
                            <div class="text-xs text-slate-400 mt-1">${sessionsTotal} sessions</div>
                        </td>
                        <td class="px-6 py-4">
                            <button type="button" class="px-3 py-1.5 rounded-lg bg-gold-500/15 text-gold-700 hover:bg-gold-500/25 text-xs font-bold" onclick="openSessionScheduleModal(${Number(student.enrollment_id)})">
                                View Schedule
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        const teachersByBranch = {};

        async function fetchTeachersForBranch(branchId) {
            const key = Number(branchId || 0);
            if (key > 0 && Array.isArray(teachersByBranch[key])) {
                return teachersByBranch[key];
            }
            try {
                let url = `${baseApiUrl}/teachers.php?action=get-teachers&status=Active`;
                if (key > 0) url += `&branch_id=${key}`;
                const response = await axios.get(url);
                const data = response.data;
                const teachers = data.success && Array.isArray(data.teachers) ? data.teachers : [];
                teachersByBranch[key] = teachers;
                return teachers;
            } catch (error) {
                console.error('Failed to load teachers:', error);
                return [];
            }
        }

        function openSessionScheduleModal(enrollmentId) {
            const modal = document.getElementById('scheduleModal');
            const body = document.getElementById('scheduleModalBody');
            const meta = document.getElementById('scheduleModalMeta');
            const hint = document.getElementById('nextSessionHint');
            const toggleBtn = document.getElementById('toggleAddScheduleBtn');
            const form = document.getElementById('addScheduleForm');
            const enrollmentInput = document.getElementById('scheduleEnrollmentId');
            const sessionInput = document.getElementById('scheduleSessionNumber');
            const teacherInput = document.getElementById('scheduleTeacher');
            const teacherLabel = document.getElementById('scheduleTeacherLabel');
            const roomSelect = document.getElementById('scheduleRoom');
            if (!modal || !body || !meta) return;

            const row = allStudents.find(r => Number(r.enrollment_id) === Number(enrollmentId));
            if (!row) return;

            const studentName = `${escapeHtml(row.first_name || '')} ${escapeHtml(row.last_name || '')}`.trim() || 'Student';
            meta.textContent = `${studentName} • ${escapeHtml(row.package_name || 'Package')} • ${Number(row.sessions || 0)} sessions`;

            const sessionsList = Array.isArray(row.sessions_list) ? row.sessions_list : [];
            const sessionsTotal = Number(row.sessions || 0);
            const rows = [];
            let nextUnscheduled = 0;
            if (sessionsTotal > 0) {
                for (let i = 1; i <= sessionsTotal; i += 1) {
                    const slotHistory = sessionsList.filter(s => Number(s.session_number) === i);
                    if (!slotHistory.length && nextUnscheduled === 0) nextUnscheduled = i;
                    const slotHtml = slotHistory.length
                        ? slotHistory.map(slot => {
                            const dateText = slot?.session_date ? formatDateShort(slot.session_date) : 'Unscheduled';
                            const timeText = slot?.start_time ? `${formatTime12Hour(slot.start_time)} - ${formatTime12Hour(slot.end_time)}` : '—';
                            const roomText = slot?.room_name ? ` • ${escapeHtml(slot.room_name)}` : '';
                            const teacherName = slot?.teacher_first_name || slot?.teacher_last_name
                                ? `${escapeHtml(slot.teacher_first_name || '')} ${escapeHtml(slot.teacher_last_name || '')}`.trim()
                                : '';
                            const teacherText = teacherName ? ` • ${teacherName}` : '';
                            const reasonText = slot?.cancellation_reason
                                ? `<div class="text-[11px] text-slate-500 mt-1">Reason: ${escapeHtml(slot.cancellation_reason)}</div>`
                                : '';
                            return `
                                <div class="rounded-lg border border-white/70 bg-white px-3 py-2">
                                    <div class="flex flex-wrap items-center gap-2">
                                        ${getSessionStatusBadge(slot.status)}
                                        <div>${escapeHtml(dateText)} • ${escapeHtml(timeText)}${roomText}${teacherText}</div>
                                    </div>
                                    ${reasonText}
                                </div>
                            `;
                        }).join('')
                        : '<div class="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-slate-400">Unscheduled</div>';
                    rows.push(`
                        <div class="rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                            <div class="font-semibold text-slate-700 mb-2">Session ${i}</div>
                            <div class="space-y-2">${slotHtml}</div>
                        </div>
                    `);
                }
            } else {
                rows.push(`<div class="text-sm text-slate-500">No session count found for this package.</div>`);
            }

            body.innerHTML = rows.join('');
            if (form) form.classList.add('hidden');
            if (enrollmentInput) enrollmentInput.value = String(enrollmentId);
            if (sessionInput) sessionInput.value = String(nextUnscheduled);
            if (hint) {
                hint.textContent = 'This view is read-only for super admin.';
            }

            const teacherName = `${escapeHtml(row.teacher_first_name || '')} ${escapeHtml(row.teacher_last_name || '')}`.trim() || 'No fixed teacher assigned';
            if (teacherInput) {
                teacherInput.value = String(Number(row.assigned_teacher_id || 0));
            }
            if (teacherLabel) {
                teacherLabel.value = teacherName;
            }
            if (roomSelect) {
                roomSelect.innerHTML = '<option value="">Read-only view</option>';
            }

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function closeScheduleModal() {
            const modal = document.getElementById('scheduleModal');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        }

        function toggleAddScheduleForm() {
            const form = document.getElementById('addScheduleForm');
            if (!form) return;
            form.classList.toggle('hidden');
        }

        async function submitAddScheduleForm(e) {
            e.preventDefault();
            const enrollmentId = Number(document.getElementById('scheduleEnrollmentId')?.value || 0);
            const sessionNumber = Number(document.getElementById('scheduleSessionNumber')?.value || 0);
            const sessionDate = document.getElementById('scheduleDate')?.value || '';
            const startTime = document.getElementById('scheduleStart')?.value || '';
            const endTime = document.getElementById('scheduleEnd')?.value || '';
            const teacherId = Number(document.getElementById('scheduleTeacher')?.value || 0);
            const roomName = document.getElementById('scheduleRoom')?.value || '';

            if (!enrollmentId || !sessionNumber || !sessionDate || !startTime || !endTime) {
                showMessage('Please complete date and time before saving.', 'error');
                return;
            }

            try {
                const response = await axios.post(`${baseApiUrl}/students.php?action=schedule-session`, {
                    enrollment_id: enrollmentId,
                    session_number: sessionNumber,
                    session_date: sessionDate,
                    start_time: startTime,
                    end_time: endTime,
                    teacher_id: teacherId,
                    room_name: roomName
                });
                const data = response.data || {};
                if (data.success) {
                    showMessage(data.message || 'Session scheduled.', 'success');
                    await loadActiveStudents();
                    openSessionScheduleModal(enrollmentId);
                } else {
                    showMessage(data.error || 'Failed to schedule session.', 'error');
                }
            } catch (error) {
                showMessage('Network error. Please try again.', 'error');
            }
        }

        async function openReschedulePicker(sessionId) {
            const target = cancelledSessions.find(s => Number(s.session_id) === Number(sessionId));
            if (!target) {
                showMessage('Cancelled session not found.', 'error');
                return;
            }

            try {
                const response = await axios.get(`${baseApiUrl}/students.php?action=get-reschedule-slots&session_id=${encodeURIComponent(sessionId)}`);
                const data = response.data || {};
                const slots = Array.isArray(data.slots) ? data.slots : [];
                if (!data.success) {
                    showMessage(data.error || 'Failed to load available slots.', 'error');
                    return;
                }
                if (!slots.length) {
                    showMessage('No available slots found for this teacher right now.', 'error');
                    return;
                }

                const inputOptions = {};
                slots.forEach((slot, index) => {
                    inputOptions[String(index)] = `${formatDateShort(slot.session_date)} • ${slot.day_of_week} • ${formatTime12Hour(slot.start_time)} - ${formatTime12Hour(slot.end_time)}`;
                });

                const result = await Swal.fire({
                    icon: 'info',
                    title: 'Reschedule Cancelled Session',
                    text: 'Student and teacher are fixed. Select one available slot.',
                    input: 'select',
                    inputOptions,
                    inputPlaceholder: 'Select an available slot',
                    showCancelButton: true,
                    confirmButtonText: 'Reschedule',
                    cancelButtonText: 'Close',
                    confirmButtonColor: '#b8860b',
                    inputValidator: value => value === '' || value == null ? 'Please select a slot.' : null
                });
                if (!result.isConfirmed) return;

                const chosen = slots[Number(result.value)];
                if (!chosen) {
                    showMessage('Selected slot is invalid.', 'error');
                    return;
                }

                const saveRes = await axios.post(`${baseApiUrl}/students.php?action=reschedule-cancelled-session`, {
                    session_id: Number(sessionId),
                    session_date: chosen.session_date,
                    start_time: chosen.start_time,
                    end_time: chosen.end_time
                });
                const saveData = saveRes.data || {};
                if (saveData.success) {
                    showMessage(saveData.message || 'Session rescheduled.', 'success');
                    await Promise.all([loadActiveStudents(), loadCancelledSessions()]);
                    openSessionScheduleModal(Number(target.enrollment_id));
                } else {
                    showMessage(saveData.error || 'Failed to reschedule session.', 'error');
                }
            } catch (error) {
                showMessage('Network error while rescheduling session.', 'error');
            }
        }

        // Ensure global access for inline button handlers
        window.openSessionScheduleModal = openSessionScheduleModal;
        window.openReschedulePicker = openReschedulePicker;
        window.setAssignRequestTeacherSelection = setAssignRequestTeacherSelection;

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
                studentInfo.textContent = `Select a session package for ${studentName}`;
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

            await Promise.all([
                loadBranches()
            ]);

            await Promise.all([
                loadActiveStudents(),
                loadCancelledSessions()
            ]);

            await Promise.all([
                maybeAutoOpenAssignPackageModalFromUrl(),
                maybeAutoOpenAssignRequestModalFromUrl()
            ]);

            document.getElementById('branchFilter')?.addEventListener('change', () => {
                loadActiveStudents();
                loadCancelledSessions();
            });
            document.getElementById('closeScheduleModalBtn')?.addEventListener('click', closeScheduleModal);
        });
