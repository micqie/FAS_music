(function initDeskPendingSessionRequests() {
    const state = {
        requests: new Map(),
        rows: [],
        knownIds: null,
        busy: false,
        timer: null,
        search: '',
        page: 1,
        pageSize: 10
    };

    function escapeRequestHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatRequestMoney(value) {
        return `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function formatRequestDate(value) {
        const date = new Date(String(value || '').replace(' ', 'T'));
        if (Number.isNaN(date.getTime())) return String(value || '—');
        return new Intl.DateTimeFormat('en-PH', {
            month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
        }).format(date);
    }

    function publicRequestFileUrl(path) {
        const raw = String(path || '').trim();
        if (!raw) return '';
        if (/^https?:\/\//i.test(raw)) return raw;
        return `${String(window.appBaseUrl || '').replace(/\/$/, '')}/${raw.replace(/^\/+/, '')}`;
    }

    function notifyDeskRequest(message, type = 'info', title = '') {
        if (typeof window.showPortalToast === 'function') {
            window.showPortalToast(message, type, title);
            return;
        }
        if (typeof Swal !== 'undefined') {
            Swal.fire({ toast: true, position: 'top-end', icon: type, title: title || message, text: title ? message : '', timer: 3500, showConfirmButton: false });
        }
    }

    function renderRequests() {
        const body = document.getElementById('deskPendingSessionRequestsTable');
        const count = document.getElementById('deskPendingSessionRequestCount');
        const modalCount = document.getElementById('deskPendingSessionModalCount');
        const range = document.getElementById('pendingSessionRequestRange');
        const pageLabel = document.getElementById('pendingSessionRequestPage');
        const previous = document.getElementById('pendingSessionRequestPrev');
        const next = document.getElementById('pendingSessionRequestNext');
        if (!body) return;
        const total = state.rows.length;
        if (count) count.textContent = String(total);
        if (modalCount) modalCount.textContent = `${total} pending`;

        const filtered = state.search
            ? state.rows.filter(request => [
                request.request_id,
                request.first_name,
                request.last_name,
                request.email,
                request.branch_name,
                request.payment_method,
                request.requested_sessions,
                request.requested_amount
            ].some(value => String(value ?? '').toLowerCase().includes(state.search)))
            : state.rows;
        const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
        state.page = Math.min(Math.max(1, state.page), totalPages);
        const start = (state.page - 1) * state.pageSize;
        const rows = filtered.slice(start, start + state.pageSize);
        if (range) range.textContent = filtered.length
            ? `Showing ${start + 1}–${start + rows.length} of ${filtered.length}${state.search ? ' matching' : ''} requests`
            : state.search ? 'No matching requests' : 'Showing 0 requests';
        if (pageLabel) pageLabel.textContent = `Page ${state.page} of ${totalPages}`;
        if (previous) previous.disabled = state.page <= 1;
        if (next) next.disabled = state.page >= totalPages;

        if (!rows.length) {
            body.innerHTML = state.search
                ? '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-500"><i class="fas fa-search mb-2 block text-xl text-slate-400"></i>No requests match your search.</td></tr>'
                : '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-500"><i class="fas fa-circle-check mb-2 block text-xl text-emerald-500"></i>No pending additional-session requests.</td></tr>';
            return;
        }

        body.innerHTML = rows.map(request => {
            const requestId = Number(request.request_id || 0);
            const quantity = Math.max(1, Number(request.requested_sessions || 1));
            const studentName = `${request.first_name || ''} ${request.last_name || ''}`.trim() || 'Student';
            const proofButton = request.payment_proof_path
                ? `<button type="button" data-session-proof="${requestId}" class="mt-1 inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline"><i class="fas fa-eye"></i>View proof</button>`
                : '<div class="mt-1 text-xs text-slate-400">No proof uploaded</div>';
            return `<tr class="transition hover:bg-slate-50/80">
                <td data-label="Student" class="px-4 py-3"><div class="font-bold text-slate-900">${escapeRequestHtml(studentName)}</div><div class="text-xs text-slate-500">${escapeRequestHtml(request.email || '')}</div><div class="mt-1 text-[11px] font-semibold text-slate-500"><i class="fas fa-location-dot mr-1 text-amber-600"></i>${escapeRequestHtml(request.branch_name || 'Branch')}</div></td>
                <td data-label="Request" class="px-4 py-3"><div class="font-bold text-slate-900">${quantity} additional session${quantity === 1 ? '' : 's'}</div><div class="mt-1 text-xs text-slate-500">Added to the current package after approval</div></td>
                <td data-label="Payment" class="px-4 py-3"><div><span class="font-bold text-slate-900">${formatRequestMoney(request.requested_amount)}</span> · ${escapeRequestHtml(request.payment_method || '—')}</div>${proofButton}</td>
                <td data-label="Submitted" class="px-4 py-3 text-xs text-slate-600">${escapeRequestHtml(formatRequestDate(request.created_at))}</td>
                <td data-label="Actions" class="px-4 py-3"><div class="flex justify-end gap-2"><button type="button" data-session-request-approve="${requestId}" class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700">Schedule &amp; Approve</button><button type="button" data-session-request-reject="${requestId}" class="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50">Reject</button></div></td>
            </tr>`;
        }).join('');
    }

    async function loadRequests(options = {}) {
        if (state.busy) return;
        state.busy = true;
        const refreshButton = document.getElementById('refreshPendingSessionRequestsBtn');
        refreshButton?.querySelector('i')?.classList.add('fa-spin');
        try {
            const user = Auth.getUser() || {};
            const branchId = Number(user.branch_id || 0);
            const params = new URLSearchParams({ action: 'get-pending-session-extension-requests' });
            if (branchId > 0) params.set('branch_id', String(branchId));
            const response = await axios.get(`${baseApiUrl}/students.php?${params.toString()}`);
            if (!response.data?.success) throw new Error(response.data?.error || 'Unable to load requests.');
            const rows = Array.isArray(response.data.requests) ? response.data.requests : [];
            state.rows = rows;
            state.requests = new Map(rows.map(row => [Number(row.request_id || 0), row]));
            const nextIds = new Set(rows.map(row => Number(row.request_id || 0)).filter(Boolean));
            if (state.knownIds && !options.silent) {
                const added = Array.from(nextIds).filter(id => !state.knownIds.has(id));
                if (added.length) notifyDeskRequest(`${added.length} new additional-session request${added.length === 1 ? '' : 's'} received.`, 'info', 'New Session Request');
            }
            state.knownIds = nextIds;
            renderRequests();
        } catch (error) {
            const body = document.getElementById('deskPendingSessionRequestsTable');
            if (body && !options.silent) body.innerHTML = `<tr><td colspan="5" class="px-4 py-7 text-center text-rose-600">${escapeRequestHtml(error?.response?.data?.error || error.message || 'Unable to load pending requests.')}</td></tr>`;
        } finally {
            state.busy = false;
            refreshButton?.querySelector('i')?.classList.remove('fa-spin');
        }
    }

    function openPaymentProof(requestId) {
        const request = state.requests.get(Number(requestId));
        const url = publicRequestFileUrl(request?.payment_proof_path);
        if (!request || !url || typeof Swal === 'undefined') return;
        const isPdf = /\.pdf(?:$|[?#])/i.test(url);
        const content = isPdf
            ? `<iframe src="${escapeRequestHtml(url)}" title="Payment proof" class="h-[65vh] w-full rounded-xl border border-slate-200 bg-white"></iframe>`
            : `<img src="${escapeRequestHtml(url)}" alt="Payment proof" class="mx-auto max-h-[68vh] max-w-full rounded-xl object-contain">`;
        Swal.fire({ title: 'Payment Proof', html: content, width: '52rem', confirmButtonText: 'Close', confirmButtonColor: '#64748b' });
    }

    async function approveRequest(requestId) {
        const request = state.requests.get(Number(requestId));
        if (!request || typeof Swal === 'undefined') return;
        const quantity = Math.max(1, Number(request.requested_sessions || 1));
        const teacherId = Number(request.assigned_teacher_id || 0);
        if (!teacherId) {
            Swal.fire({ icon: 'warning', title: 'Instructor Required', text: 'Assign an instructor to this enrollment before approving additional sessions.', confirmButtonColor: '#b8860b' });
            return;
        }
        let slots = [];
        try {
            Swal.fire({ title: 'Finding available schedules…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const params = new URLSearchParams({
                action: 'get-teacher-available-slots',
                teacher_id: String(teacherId),
                branch_id: String(Number(request.branch_id || 0)),
                student_id: String(Number(request.student_id || 0)),
                days_ahead: String(Math.min(365, Math.max(90, quantity * 14)))
            });
            const response = await axios.get(`${baseApiUrl}/students.php?${params.toString()}`);
            if (!response.data?.success) throw new Error(response.data?.error || 'Unable to load available schedules.');
            slots = Array.isArray(response.data.slots) ? response.data.slots : [];
            Swal.close();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Schedules Unavailable', text: error?.response?.data?.error || error.message || 'Unable to load available schedules.', confirmButtonColor: '#b8860b' });
            return;
        }
        if (slots.length < quantity) {
            Swal.fire({ icon: 'warning', title: 'Not Enough Available Slots', text: `Only ${slots.length} available schedule${slots.length === 1 ? '' : 's'} were found. ${quantity} are required before this request can be approved.`, confirmButtonColor: '#b8860b' });
            return;
        }
        const visibleSlots = slots.slice(0, Math.max(80, quantity * 3));
        const slotHtml = visibleSlots.map((slot, index) => {
            const date = new Date(`${slot.session_date}T00:00:00`);
            const dateLabel = Number.isNaN(date.getTime()) ? slot.session_date : new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(date);
            const timeLabel = `${String(slot.start_time || '').slice(0, 5)}–${String(slot.end_time || '').slice(0, 5)}`;
            const value = escapeRequestHtml(JSON.stringify({ session_date: slot.session_date, start_time: slot.start_time, end_time: slot.end_time }));
            return `<label class="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left transition hover:border-amber-300 hover:bg-amber-50"><input type="checkbox" class="additional-session-slot h-4 w-4 accent-emerald-600" value="${value}" ${index < quantity ? 'checked' : ''}><span class="min-w-0"><strong class="block text-sm text-slate-900">${escapeRequestHtml(dateLabel)}</strong><span class="text-xs text-slate-500">${escapeRequestHtml(timeLabel)}</span></span></label>`;
        }).join('');
        const result = await Swal.fire({
            title: 'Schedule additional sessions',
            html: `<div class="text-left"><div class="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600"><strong class="text-slate-900">${escapeRequestHtml(`${request.first_name || ''} ${request.last_name || ''}`.trim() || 'Student')}</strong><br>${escapeRequestHtml(request.teacher_name || 'Assigned instructor')} · ${escapeRequestHtml(request.instrument_name || 'Instrument')}<div class="mt-1 text-xs">Select exactly <strong>${quantity}</strong> available schedule${quantity === 1 ? '' : 's'}.</div></div><div id="additionalSessionSlotCount" class="mb-2 text-xs font-bold text-emerald-700">${quantity} of ${quantity} selected</div><div class="grid max-h-[45vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">${slotHtml}</div></div>`,
            width: '48rem',
            showCancelButton: true,
            confirmButtonText: 'Schedule & Approve',
            confirmButtonColor: '#059669',
            didOpen: popup => {
                const inputs = Array.from(popup.querySelectorAll('.additional-session-slot'));
                const countLabel = popup.querySelector('#additionalSessionSlotCount');
                const updateCount = changed => {
                    let selected = inputs.filter(input => input.checked);
                    if (selected.length > quantity && changed) changed.checked = false;
                    selected = inputs.filter(input => input.checked);
                    if (countLabel) countLabel.textContent = `${selected.length} of ${quantity} selected`;
                };
                inputs.forEach(input => input.addEventListener('change', () => updateCount(input)));
            },
            preConfirm: () => {
                const selected = Array.from(document.querySelectorAll('.additional-session-slot:checked'));
                if (selected.length !== quantity) {
                    Swal.showValidationMessage(`Select exactly ${quantity} schedule${quantity === 1 ? '' : 's'}.`);
                    return false;
                }
                return selected.map(input => JSON.parse(input.value));
            }
        });
        if (!result.isConfirmed) return;
        try {
            const response = await axios.post(`${baseApiUrl}/students.php`, {
                action: 'approve-session-extension-request',
                request_id: Number(requestId),
                branch_id: Number(request.branch_id || Auth.getUser()?.branch_id || 0),
                scheduled_slots: result.value
            });
            if (!response.data?.success) throw new Error(response.data?.error || 'Approval failed.');
            notifyDeskRequest(response.data.message || 'Additional sessions approved.', 'success', 'Request Approved');
            await loadRequests({ silent: true });
            if (typeof window.loadActiveStudents === 'function') await window.loadActiveStudents();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Approval Failed', text: error?.response?.data?.error || error.message || 'Unable to approve this request.', confirmButtonColor: '#b8860b' });
        }
    }

    async function rejectRequest(requestId) {
        const request = state.requests.get(Number(requestId));
        if (!request || typeof Swal === 'undefined') return;
        const result = await Swal.fire({
            icon: 'warning',
            title: 'Reject additional sessions?',
            input: 'textarea',
            inputLabel: 'Reason for the student or guardian',
            inputPlaceholder: 'Enter a short reason (optional)',
            showCancelButton: true,
            confirmButtonText: 'Reject Request',
            confirmButtonColor: '#dc2626'
        });
        if (!result.isConfirmed) return;
        try {
            const response = await axios.post(`${baseApiUrl}/students.php`, {
                action: 'reject-session-extension-request',
                request_id: Number(requestId),
                branch_id: Number(request.branch_id || Auth.getUser()?.branch_id || 0),
                admin_notes: String(result.value || '').trim()
            });
            if (!response.data?.success) throw new Error(response.data?.error || 'Rejection failed.');
            notifyDeskRequest(response.data.message || 'Additional-session request rejected.', 'success', 'Request Rejected');
            await loadRequests({ silent: true });
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Unable to Reject', text: error?.response?.data?.error || error.message || 'Unable to reject this request.', confirmButtonColor: '#b8860b' });
        }
    }

    function setRequestsModal(open) {
        const modal = document.getElementById('deskPendingSessionRequestsModal');
        if (!modal) return;
        modal.classList.toggle('hidden', !open);
        modal.classList.toggle('flex', open);
        modal.setAttribute('aria-hidden', open ? 'false' : 'true');
        document.body.classList.toggle('overflow-hidden', open);
        if (open) {
            state.page = 1;
            renderRequests();
            window.setTimeout(() => document.getElementById('pendingSessionRequestSearch')?.focus(), 50);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const table = document.getElementById('deskPendingSessionRequestsTable');
        if (!table) return;
        const modal = document.getElementById('deskPendingSessionRequestsModal');
        const search = document.getElementById('pendingSessionRequestSearch');
        document.getElementById('openPendingSessionRequestsBtn')?.addEventListener('click', () => setRequestsModal(true));
        document.getElementById('closePendingSessionRequestsBtn')?.addEventListener('click', () => setRequestsModal(false));
        document.getElementById('refreshPendingSessionRequestsBtn')?.addEventListener('click', () => loadRequests());
        search?.addEventListener('input', event => {
            state.search = String(event.target.value || '').trim().toLowerCase();
            state.page = 1;
            renderRequests();
        });
        document.getElementById('pendingSessionRequestPrev')?.addEventListener('click', () => {
            if (state.page > 1) {
                state.page -= 1;
                renderRequests();
            }
        });
        document.getElementById('pendingSessionRequestNext')?.addEventListener('click', () => {
            state.page += 1;
            renderRequests();
        });
        modal?.addEventListener('click', event => {
            if (event.target === modal) setRequestsModal(false);
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && modal?.getAttribute('aria-hidden') === 'false') setRequestsModal(false);
        });
        table.addEventListener('click', event => {
            const proof = event.target.closest('[data-session-proof]');
            const approve = event.target.closest('[data-session-request-approve]');
            const reject = event.target.closest('[data-session-request-reject]');
            if (proof) openPaymentProof(proof.dataset.sessionProof);
            else if (approve) void approveRequest(approve.dataset.sessionRequestApprove);
            else if (reject) void rejectRequest(reject.dataset.sessionRequestReject);
        });
        const requestedId = new URLSearchParams(window.location.search).get('session_request_id');
        if (requestedId) {
            state.search = String(requestedId).trim().toLowerCase();
            if (search) search.value = requestedId;
            setRequestsModal(true);
        }
        void loadRequests({ silent: true });
        state.timer = window.setInterval(() => {
            if (document.visibilityState === 'visible' && !(typeof Swal !== 'undefined' && Swal.isVisible())) void loadRequests();
        }, 10000);
        window.addEventListener('focus', () => void loadRequests());
    });
})();
