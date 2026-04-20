      let allInstruments = [];
        let filteredInstruments = [];
        let allBranches = [];

        function escapeHtml(value) {
            if (value == null) return '';
            const d = document.createElement('div');
            d.textContent = String(value);
            return d.innerHTML;
        }

        function showMessage(message, type = 'error') {
            Swal.fire({
                icon: type === 'success' ? 'success' : 'error',
                title: type === 'success' ? 'Success' : 'Error',
                text: message,
                confirmButtonColor: '#b8860b'
            });
        }

        function statusBadgeClass(status) {
            const s = String(status || '');
            if (s === 'Available') return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
            if (s === 'In Use') return 'bg-blue-100 text-blue-700 border border-blue-200';
            if (s === 'Under Repair') return 'bg-amber-100 text-amber-700 border border-amber-200';
            if (s === 'Inactive') return 'bg-red-100 text-red-700 border border-red-200';
            return 'bg-slate-100 text-slate-700 border border-slate-200';
        }

        async function loadBranches() {
            const branchFilter = document.getElementById('branchFilter');
            if (!branchFilter) return;
            try {
                const response = await axios.get(`${baseApiUrl}/branch.php?action=get-branches`);
                const data = response.data;
                if (data.success && Array.isArray(data.branches)) {
                    allBranches = data.branches;
                    const options = allBranches.map(b => `<option value="${b.branch_id}">${escapeHtml(b.branch_name)}</option>`).join('');
                    branchFilter.innerHTML = '<option value="">All Branches</option>' + options;
                }
            } catch (error) {
                console.error('Failed to load branches:', error);
            }
        }

        async function loadInstruments() {
            const table = document.getElementById('maintenanceTable');
            if (!table) return;
            try {
                const response = await axios.get(`${baseApiUrl}/instruments.php?action=get-instruments`);
                const data = response.data;
                allInstruments = data.success && Array.isArray(data.instruments) ? data.instruments : [];
                applyFilters();
            } catch (error) {
                console.error('Failed to load instruments:', error);
                table.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-10 text-center text-red-500">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <p>Failed to load maintenance data.</p>
                        </td>
                    </tr>`;
            }
        }

        function applyFilters() {
            const branchId = document.getElementById('branchFilter')?.value || '';
            const status = document.getElementById('statusFilter')?.value || '';
            const keyword = String(document.getElementById('searchInput')?.value || '').trim().toLowerCase();

            filteredInstruments = allInstruments.filter(i => {
                if (branchId && String(i.branch_id) !== String(branchId)) return false;
                if (status && String(i.status || '') !== status) return false;
                if (keyword) {
                    const hay = `${i.instrument_name || ''} ${i.serial_number || ''} ${i.type_name || ''} ${i.branch_name || ''}`.toLowerCase();
                    if (!hay.includes(keyword)) return false;
                }
                return true;
            });
            renderTable();
        }

        function renderTable() {
            const table = document.getElementById('maintenanceTable');
            const count = document.getElementById('instrumentCount');
            if (!table) return;

            if (count) count.textContent = `Showing ${filteredInstruments.length} instrument${filteredInstruments.length === 1 ? '' : 's'}`;

            if (!filteredInstruments.length) {
                table.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-10 text-center text-slate-500">
                            <i class="fas fa-inbox text-2xl mb-2 text-gold-500/60"></i>
                            <p>No instruments found for current filters.</p>
                        </td>
                    </tr>`;
                return;
            }

            table.innerHTML = filteredInstruments.map(i => `
                <tr class="hover:bg-slate-50/80 transition">
                    <td class="px-6 py-4 text-slate-900 font-medium">${escapeHtml(i.instrument_name || 'N/A')}</td>
                    <td class="px-6 py-4 text-slate-700">${escapeHtml(i.type_name || '-')}</td>
                    <td class="px-6 py-4 text-slate-700">${escapeHtml(i.branch_name || '-')}</td>
                    <td class="px-6 py-4 text-slate-700">${escapeHtml(i.serial_number || '-')}</td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-1 rounded text-xs font-semibold ${statusBadgeClass(i.status)}">${escapeHtml(i.status || 'N/A')}</span>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-2">
                            <button onclick="openMaintenanceModal(${Number(i.instrument_id)})" class="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-bold">Edit</button>
                            <button onclick="quickSetRepair(${Number(i.instrument_id)})" class="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 text-xs font-bold">Mark Repair</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }

        function openMaintenanceModal(instrumentId) {
            const row = allInstruments.find(x => Number(x.instrument_id) === Number(instrumentId));
            if (!row) return;
            const modal = document.getElementById('editMaintenanceModal');
            const info = document.getElementById('maintenanceModalInfo');
            const idEl = document.getElementById('maintenanceInstrumentId');
            const statusEl = document.getElementById('maintenanceStatus');
            if (!modal || !info || !idEl || !statusEl) return;

            idEl.value = String(instrumentId);
            info.textContent = `${row.instrument_name || 'Instrument'} • ${row.branch_name || 'Branch'}`;
            statusEl.value = row.status || 'Available';
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function closeMaintenanceModal() {
            const modal = document.getElementById('editMaintenanceModal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }

        async function updateMaintenance(instrumentId, status) {
            const payload = {
                instrument_id: Number(instrumentId),
                status: String(status || 'Available')
            };
            const response = await axios.post(`${baseApiUrl}/instruments.php?action=update-instrument`, payload);
            return response.data;
        }

        async function quickSetRepair(instrumentId) {
            try {
                const data = await updateMaintenance(instrumentId, 'Under Repair');
                if (data.success) {
                    showMessage('Instrument set to Under Repair.', 'success');
                    closeMaintenanceModal();
                    await loadInstruments();
                } else {
                    showMessage(data.error || 'Failed to update instrument.', 'error');
                }
            } catch (error) {
                showMessage('Network error while updating maintenance.', 'error');
            }
        }

        async function submitMaintenanceForm(event) {
            event.preventDefault();
            const instrumentId = document.getElementById('maintenanceInstrumentId')?.value || '';
            const status = document.getElementById('maintenanceStatus')?.value || 'Available';
            if (!instrumentId) {
                showMessage('Instrument not found.', 'error');
                return;
            }
            try {
                const data = await updateMaintenance(instrumentId, status);
                if (data.success) {
                    showMessage('Maintenance info updated.', 'success');
                    closeMaintenanceModal();
                    await loadInstruments();
                } else {
                    showMessage(data.error || 'Failed to save changes.', 'error');
                }
            } catch (error) {
                showMessage('Network error while saving maintenance.', 'error');
            }
        }

        document.addEventListener('DOMContentLoaded', async function() {
            if (typeof Auth !== 'undefined' && Auth.getUser) {
                const user = Auth.getUser();
                const userNameNav = document.getElementById('userNameNav');
                    const profileMenuName = document.getElementById('profileMenuName');
                const displayName = user.username || user.email || 'Admin';
                if (userNameNav) userNameNav.textContent = displayName;
                if (profileMenuName) profileMenuName.textContent = displayName;
            }

            await loadBranches();
            await loadInstruments();

            document.getElementById('branchFilter')?.addEventListener('change', applyFilters);
            document.getElementById('statusFilter')?.addEventListener('change', applyFilters);
            document.getElementById('searchInput')?.addEventListener('input', applyFilters);
            document.getElementById('maintenanceForm')?.addEventListener('submit', submitMaintenanceForm);
            document.getElementById('closeMaintenanceModalBtn')?.addEventListener('click', closeMaintenanceModal);
            document.getElementById('cancelMaintenanceBtn')?.addEventListener('click', closeMaintenanceModal);
        });
