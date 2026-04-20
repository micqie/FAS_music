    let allInstruments = [];
        let filteredInstruments = [];
        let allTypes = [];
        let allBranches = [];

        // Show message (SweetAlert)
        function showMessage(message, type = 'error') {
            Swal.fire({
                icon: type === 'success' ? 'success' : 'error',
                title: type === 'success' ? 'Success' : 'Error',
                text: message,
                confirmButtonColor: '#b8860b'
            });
        }

        // Load branches
        async function loadBranches() {
            const branchFilter = document.getElementById('branchFilter');
            const instrumentBranchId = document.getElementById('instrumentBranchId');

            try {
                const response = await axios.get(`${baseApiUrl}/branch.php?action=get-branches`);
                const data = response.data;

                if (data.success && data.branches) {
                    allBranches = data.branches;
                    const options = data.branches.map(branch =>
                        `<option value="${branch.branch_id}">${branch.branch_name}</option>`
                    ).join('');

                    if (branchFilter) {
                        branchFilter.innerHTML = '<option value="">All Branches</option>' + options;
                    }
                    if (instrumentBranchId) {
                        instrumentBranchId.innerHTML = '<option value="">Select Branch</option>' + options;
                    }
                    const editBranchId = document.getElementById('editInstrumentBranchId');
                    if (editBranchId) {
                        editBranchId.innerHTML = '<option value="">Select Branch</option>' + options;
                    }
                }
            } catch (error) {
                console.error('Failed to load branches:', error);
            }
        }

        // Load instrument types
        async function loadInstrumentTypes() {
            const typeFilter = document.getElementById('typeFilter');
            const instrumentTypeId = document.getElementById('instrumentTypeId');

            try {
                const response = await axios.get(`${baseApiUrl}/instruments.php?action=get-types`);
                const data = response.data;

                if (data.success && data.types) {
                    allTypes = data.types;
                    const options = data.types.map(type =>
                        `<option value="${type.type_id}">${type.type_name}</option>`
                    ).join('');

                    if (typeFilter) {
                        typeFilter.innerHTML = '<option value="">All Types</option>' + options;
                    }
                    if (instrumentTypeId) {
                        instrumentTypeId.innerHTML = '<option value="">Select Type</option>' + options;
                    }
                    const editTypeId = document.getElementById('editInstrumentTypeId');
                    if (editTypeId) {
                        editTypeId.innerHTML = '<option value="">Select Type</option>' + options;
                    }
                    displayTypeMaster();
                }
            } catch (error) {
                console.error('Failed to load instrument types:', error);
            }
        }

        function displayTypeMaster() {
            const tableBody = document.getElementById('typesTable');
            const countDiv = document.getElementById('typeCount');
            if (!tableBody) return;

            if (!allTypes.length) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="3" class="px-6 py-8 text-center text-slate-500">
                            <i class="fas fa-inbox text-2xl mb-2"></i>
                            <p>No instrument types found</p>
                        </td>
                    </tr>
                `;
                if (countDiv) countDiv.textContent = '0 types';
                return;
            }

            tableBody.innerHTML = allTypes.map(type => {
                const safeName = JSON.stringify(type.type_name || '');
                const safeDesc = JSON.stringify(type.description || '');
                return `
                <tr class="hover:bg-slate-50/80 transition">
                    <td class="px-6 py-4 text-slate-900 font-medium">${escapeHtml(type.type_name || 'N/A')}</td>
                    <td class="px-6 py-4 text-slate-600">${escapeHtml(type.description || '-')}</td>
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-2">
                            <button onclick='openEditTypeModal(${Number(type.type_id)}, ${safeName}, ${safeDesc})'
                                class="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-bold">
                                Edit
                            </button>
                            <button onclick='deleteInstrumentType(${Number(type.type_id)}, ${safeName})'
                                class="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 text-xs font-bold">
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            }).join('');

            if (countDiv) countDiv.textContent = `${allTypes.length} ${allTypes.length === 1 ? 'type' : 'types'}`;
        }

        // Load instruments
        async function loadInstruments() {
            const tableBody = document.getElementById('instrumentsTable');
            if (!tableBody) return;

            try {
                const branchFilter = document.getElementById('branchFilter');
                const typeFilter = document.getElementById('typeFilter');

                let url = `${baseApiUrl}/instruments.php?action=get-instruments`;
                if (branchFilter && branchFilter.value) {
                    url += `&branch_id=${branchFilter.value}`;
                }
                if (typeFilter && typeFilter.value) {
                    url += `&type_id=${typeFilter.value}`;
                }

                const response = await axios.get(url);
                const data = response.data;

                if (data.success && data.instruments) {
                    allInstruments = data.instruments;
                    filteredInstruments = allInstruments;
                    displayInstruments();
                    updateInstrumentCount();
                } else {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="6" class="px-6 py-8 text-center text-slate-500">
                                <i class="fas fa-inbox text-2xl mb-2"></i>
                                <p>No instruments found</p>
                            </td>
                        </tr>
                    `;
                    allInstruments = [];
                    filteredInstruments = [];
                    updateInstrumentCount();
                }
            } catch (error) {
                console.error('Failed to load instruments:', error);
                const tableBody = document.getElementById('instrumentsTable');
                if (tableBody) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="6" class="px-6 py-8 text-center text-red-500 dark:text-red-400">
                                <i class="fas fa-exclamation-circle text-2xl mb-2 text-red-500"></i>
                                <p>Failed to load instruments</p>
                            </td>
                        </tr>
                    `;
                }
            }
        }

        // Display instruments
        function displayInstruments() {
            const tableBody = document.getElementById('instrumentsTable');
            if (!tableBody) return;

            if (!filteredInstruments || filteredInstruments.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-8 text-center text-slate-500">
                            <i class="fas fa-inbox text-2xl mb-2"></i>
                            <p>No instruments found</p>
                        </td>
                    </tr>
                `;
                return;
            }

            const statusColors = {
                'Available': 'bg-green-500/10 text-green-500 border-green-500/20',
                'In Use': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                'Under Repair': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
                'Inactive': 'bg-gray-500/10 text-gray-500 border-gray-500/20'
            };

            tableBody.innerHTML = filteredInstruments.map(instrument => {
                const statusClass = statusColors[instrument.status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';

                return `
                    <tr class="hover:bg-slate-50/80 transition">
                        <td class="px-6 py-4">
                            <div class="font-medium text-slate-900">${instrument.instrument_name || 'N/A'}</div>
                        </td>
                        <td class="px-6 py-4 text-slate-900">${instrument.type_name || 'N/A'}</td>
                        <td class="px-6 py-4 text-slate-900">${instrument.branch_name || 'N/A'}</td>
                        <td class="px-6 py-4 text-slate-500">${instrument.serial_number || '-'}</td>

                        <td class="px-6 py-4">
                            <span class="px-2 py-1 rounded text-xs font-semibold border ${statusClass}">
                                ${instrument.status || 'N/A'}
                            </span>
                        </td>
                        <td class="px-6 py-4">
                            <div class="flex items-center gap-2">
                                <button onclick="openEditInstrumentModal(${Number(instrument.instrument_id)})"
                                    class="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-bold">
                                    Edit
                                </button>
                                <button onclick="deleteInstrument(${Number(instrument.instrument_id)}, ${JSON.stringify(instrument.instrument_name || '')})"
                                    class="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 text-xs font-bold">
                                    Delete
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Update instrument count
        function updateInstrumentCount() {
            const countDiv = document.getElementById('instrumentCount');
            if (countDiv) {
                const count = filteredInstruments.length;
                const total = allInstruments.length;
                countDiv.textContent = `Showing ${count} ${count === 1 ? 'instrument' : 'instruments'}${total !== count ? ` (${total} total)` : ''}`;
            }
        }

        // Add Instrument Type
        async function addInstrumentType() {
            const form = document.getElementById('addTypeForm');
            const typeName = document.getElementById('typeName');
            const typeDescription = document.getElementById('typeDescription');
            const submitBtn = document.getElementById('submitTypeBtn');
            const submitBtnText = document.getElementById('submitTypeBtnText');

            if (!form || !typeName) return;

            submitBtn.disabled = true;
            submitBtnText.textContent = 'Adding...';

            try {
                const response = await axios.post(`${baseApiUrl}/instruments.php?action=add-type`, {
                    type_name: typeName.value.trim(),
                    description: typeDescription.value.trim() || null
                });

                const result = response.data;

                if (result.success) {
                    showMessage(result.message || 'Instrument type added successfully', 'success');
                    form.reset();
                    closeAddTypeModal();
                    await loadInstrumentTypes();
                    await loadInstruments();
                } else {
                    showMessage(result.error || 'Failed to add instrument type', 'error');
                }
            } catch (error) {
                console.error('Failed to add instrument type:', error);
                showMessage('An error occurred. Please try again.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtnText.textContent = 'Add Type';
            }
        }

        function decodeEntities(str) {
            if (!str) return '';
            const txt = document.createElement('textarea');
            txt.innerHTML = str;
            return txt.value;
        }

        function openEditTypeModal(typeId, typeName, description) {
            const modal = document.getElementById('editTypeModal');
            if (!modal) return;
            document.getElementById('editTypeId').value = String(typeId || '');
            document.getElementById('editTypeName').value = decodeEntities(typeName || '');
            document.getElementById('editTypeDescription').value = decodeEntities(description || '');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function closeEditTypeModal() {
            const modal = document.getElementById('editTypeModal');
            const form = document.getElementById('editTypeForm');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
            if (form) form.reset();
        }

        async function updateInstrumentType() {
            const typeId = Number(document.getElementById('editTypeId')?.value || 0);
            const typeName = document.getElementById('editTypeName')?.value?.trim() || '';
            const description = document.getElementById('editTypeDescription')?.value?.trim() || '';
            const submitBtn = document.getElementById('submitEditTypeBtn');
            const submitBtnText = document.getElementById('submitEditTypeBtnText');

            if (!typeId || !typeName) {
                showMessage('Type ID and name are required.', 'error');
                return;
            }

            submitBtn.disabled = true;
            submitBtnText.textContent = 'Saving...';
            try {
                const response = await axios.post(`${baseApiUrl}/instruments.php?action=update-type`, {
                    type_id: typeId,
                    type_name: typeName,
                    description: description || null
                });
                const result = response.data;
                if (result.success) {
                    showMessage(result.message || 'Instrument type updated successfully', 'success');
                    closeEditTypeModal();
                    await loadInstrumentTypes();
                    await loadInstruments();
                } else {
                    showMessage(result.error || 'Failed to update instrument type', 'error');
                }
            } catch (error) {
                console.error('Failed to update instrument type:', error);
                showMessage('An error occurred. Please try again.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtnText.textContent = 'Save Changes';
            }
        }

        async function deleteInstrumentType(typeId, typeName) {
            const cleanName = decodeEntities(typeName || 'this type');
            const confirm = await Swal.fire({
                icon: 'warning',
                title: 'Delete Instrument Type?',
                text: `This will delete "${cleanName}" if not used by instruments.`,
                showCancelButton: true,
                confirmButtonText: 'Delete',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#dc2626'
            });
            if (!confirm.isConfirmed) return;

            try {
                const response = await axios.post(`${baseApiUrl}/instruments.php?action=delete-type`, {
                    type_id: Number(typeId)
                });
                const result = response.data;
                if (result.success) {
                    showMessage(result.message || 'Instrument type deleted successfully', 'success');
                    await loadInstrumentTypes();
                    await loadInstruments();
                } else {
                    showMessage(result.error || 'Failed to delete instrument type', 'error');
                }
            } catch (error) {
                console.error('Failed to delete instrument type:', error);
                showMessage('An error occurred. Please try again.', 'error');
            }
        }

        function escapeHtml(text) {
            if (text == null) return '';
            const div = document.createElement('div');
            div.textContent = String(text);
            return div.innerHTML;
        }

        // Add Instrument
        async function addInstrument() {
            const form = document.getElementById('addInstrumentForm');
            const submitBtn = document.getElementById('submitInstrumentBtn');
            const submitBtnText = document.getElementById('submitInstrumentBtnText');

            if (!form) return;

            submitBtn.disabled = true;
            submitBtnText.textContent = 'Adding...';

            try {
                const formData = {
                    branch_id: document.getElementById('instrumentBranchId').value,
                    instrument_name: document.getElementById('instrumentName').value.trim(),
                    type_id: document.getElementById('instrumentTypeId').value,
                    serial_number: document.getElementById('serialNumber').value.trim() || null
                };

                const response = await axios.post(`${baseApiUrl}/instruments.php?action=add-instrument`, formData);
                const result = response.data;

                if (result.success) {
                    showMessage(result.message || 'Instrument added successfully', 'success');
                    form.reset();
                    closeAddInstrumentModal();
                    await loadInstruments();
                } else {
                    showMessage(result.error || 'Failed to add instrument', 'error');
                }
            } catch (error) {
                console.error('Failed to add instrument:', error);
                showMessage('An error occurred. Please try again.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtnText.textContent = 'Add Instrument';
            }
        }

        // Modal functions
        function openAddTypeModal() {
            const modal = document.getElementById('addTypeModal');
            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            }
        }

        function closeAddTypeModal() {
            const modal = document.getElementById('addTypeModal');
            const form = document.getElementById('addTypeForm');
            const messageDiv = document.getElementById('typeMessage');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
            if (form) form.reset();
            if (messageDiv) messageDiv.classList.add('hidden');
        }

        function openAddInstrumentModal() {
            const modal = document.getElementById('addInstrumentModal');
            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            }
        }

        function closeAddInstrumentModal() {
            const modal = document.getElementById('addInstrumentModal');
            const form = document.getElementById('addInstrumentForm');
            const messageDiv = document.getElementById('instrumentMessage');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
            if (form) form.reset();
            if (messageDiv) messageDiv.classList.add('hidden');
        }

        function switchInstrumentTab(tab) {
            const instrumentsPanel = document.getElementById('instrumentsPanel');
            const typesPanel = document.getElementById('typesPanel');
            const tabInstrumentsBtn = document.getElementById('tabInstrumentsBtn');
            const tabTypesBtn = document.getElementById('tabTypesBtn');
            const addTypeBtn = document.getElementById('openAddTypeModalBtn');
            const addInstrumentBtn = document.getElementById('openAddInstrumentModalBtn');
            if (!instrumentsPanel || !typesPanel || !tabInstrumentsBtn || !tabTypesBtn) return;

            if (tab === 'types') {
                instrumentsPanel.classList.add('hidden');
                typesPanel.classList.remove('hidden');
                tabTypesBtn.className = 'px-4 py-2 rounded-lg text-sm font-semibold bg-gold-500 text-black';
                tabInstrumentsBtn.className = 'px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-900';
                if (addTypeBtn) addTypeBtn.classList.remove('hidden');
                if (addInstrumentBtn) addInstrumentBtn.classList.add('hidden');
            } else {
                typesPanel.classList.add('hidden');
                instrumentsPanel.classList.remove('hidden');
                tabInstrumentsBtn.className = 'px-4 py-2 rounded-lg text-sm font-semibold bg-gold-500 text-black';
                tabTypesBtn.className = 'px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-900';
                if (addTypeBtn) addTypeBtn.classList.add('hidden');
                if (addInstrumentBtn) addInstrumentBtn.classList.remove('hidden');
            }
        }

        function openEditInstrumentModal(instrumentId) {
            const instrument = (allInstruments || []).find(i => Number(i.instrument_id) === Number(instrumentId));
            if (!instrument) {
                showMessage('Instrument not found.', 'error');
                return;
            }
            const modal = document.getElementById('editInstrumentModal');
            if (!modal) return;
            document.getElementById('editInstrumentId').value = String(instrument.instrument_id || '');
            document.getElementById('editInstrumentBranchId').value = String(instrument.branch_id || '');
            document.getElementById('editInstrumentTypeId').value = String(instrument.type_id || '');
            document.getElementById('editInstrumentName').value = instrument.instrument_name || '';
            document.getElementById('editSerialNumber').value = instrument.serial_number || '';
            document.getElementById('editInstrumentStatus').value = instrument.status || 'Available';
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function closeEditInstrumentModal() {
            const modal = document.getElementById('editInstrumentModal');
            const form = document.getElementById('editInstrumentForm');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
            if (form) form.reset();
        }

        async function updateInstrument() {
            const instrumentId = Number(document.getElementById('editInstrumentId')?.value || 0);
            const payload = {
                instrument_id: instrumentId,
                branch_id: Number(document.getElementById('editInstrumentBranchId')?.value || 0),
                type_id: Number(document.getElementById('editInstrumentTypeId')?.value || 0),
                instrument_name: document.getElementById('editInstrumentName')?.value?.trim() || '',
                serial_number: document.getElementById('editSerialNumber')?.value?.trim() || null,
                status: document.getElementById('editInstrumentStatus')?.value || 'Available'
            };
            if (!payload.instrument_id || !payload.branch_id || !payload.type_id || !payload.instrument_name) {
                showMessage('Please complete all required fields.', 'error');
                return;
            }

            const submitBtn = document.getElementById('submitEditInstrumentBtn');
            const submitBtnText = document.getElementById('submitEditInstrumentBtnText');
            submitBtn.disabled = true;
            submitBtnText.textContent = 'Saving...';
            try {
                const response = await axios.post(`${baseApiUrl}/instruments.php?action=update-instrument`, payload);
                const result = response.data;
                if (result.success) {
                    showMessage(result.message || 'Instrument updated successfully', 'success');
                    closeEditInstrumentModal();
                    await loadInstruments();
                } else {
                    showMessage(result.error || 'Failed to update instrument', 'error');
                }
            } catch (error) {
                console.error('Failed to update instrument:', error);
                showMessage('An error occurred. Please try again.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtnText.textContent = 'Save Instrument';
            }
        }

        async function deleteInstrument(instrumentId, instrumentName) {
            const confirm = await Swal.fire({
                icon: 'warning',
                title: 'Delete Instrument?',
                text: `This will mark "${instrumentName || 'instrument'}" as Inactive.`,
                showCancelButton: true,
                confirmButtonText: 'Delete',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#dc2626'
            });
            if (!confirm.isConfirmed) return;

            try {
                const response = await axios.post(`${baseApiUrl}/instruments.php?action=update-instrument`, {
                    instrument_id: Number(instrumentId),
                    status: 'Inactive'
                });
                const result = response.data;
                if (result.success) {
                    showMessage('Instrument marked as Inactive.', 'success');
                    await loadInstruments();
                } else {
                    showMessage(result.error || 'Failed to delete instrument', 'error');
                }
            } catch (error) {
                console.error('Failed to delete instrument:', error);
                showMessage('An error occurred. Please try again.', 'error');
            }
        }

        document.addEventListener('DOMContentLoaded', function() {
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

            // Load data
            loadBranches();
            loadInstrumentTypes();
            loadInstruments();
            switchInstrumentTab('instruments');

            // Modal event listeners
            document.getElementById('openAddTypeModalBtn')?.addEventListener('click', openAddTypeModal);
            document.getElementById('closeAddTypeModalBtn')?.addEventListener('click', closeAddTypeModal);
            document.getElementById('cancelAddTypeBtn')?.addEventListener('click', closeAddTypeModal);
            document.getElementById('addTypeForm')?.addEventListener('submit', function(e) {
                e.preventDefault();
                addInstrumentType();
            });

            document.getElementById('openAddInstrumentModalBtn')?.addEventListener('click', openAddInstrumentModal);
            document.getElementById('closeAddInstrumentModalBtn')?.addEventListener('click', closeAddInstrumentModal);
            document.getElementById('cancelAddInstrumentBtn')?.addEventListener('click', closeAddInstrumentModal);
            document.getElementById('addInstrumentForm')?.addEventListener('submit', function(e) {
                e.preventDefault();
                addInstrument();
            });
            document.getElementById('closeEditInstrumentModalBtn')?.addEventListener('click', closeEditInstrumentModal);
            document.getElementById('cancelEditInstrumentBtn')?.addEventListener('click', closeEditInstrumentModal);
            document.getElementById('editInstrumentForm')?.addEventListener('submit', function(e) {
                e.preventDefault();
                updateInstrument();
            });
            document.getElementById('closeEditTypeModalBtn')?.addEventListener('click', closeEditTypeModal);
            document.getElementById('cancelEditTypeBtn')?.addEventListener('click', closeEditTypeModal);
            document.getElementById('editTypeForm')?.addEventListener('submit', function(e) {
                e.preventDefault();
                updateInstrumentType();
            });
            document.getElementById('tabInstrumentsBtn')?.addEventListener('click', () => switchInstrumentTab('instruments'));
            document.getElementById('tabTypesBtn')?.addEventListener('click', () => switchInstrumentTab('types'));

            // Filter event listeners
            document.getElementById('branchFilter')?.addEventListener('change', loadInstruments);
            document.getElementById('typeFilter')?.addEventListener('change', loadInstruments);
        });
