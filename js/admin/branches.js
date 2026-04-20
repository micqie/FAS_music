    let branches = [];

        function showMessage(message, type = 'error') {
            Swal.fire({
                icon: type === 'success' ? 'success' : 'error',
                title: type === 'success' ? 'Success' : 'Error',
                text: message,
                confirmButtonColor: '#b8860b'
            });
        }

        function showBranchModalMessage(msg, type) {
            Swal.fire({
                icon: type === 'success' ? 'success' : 'error',
                title: type === 'success' ? 'Success' : 'Error',
                text: msg,
                confirmButtonColor: '#b8860b'
            });
        }

        async function loadBranches() {
            const tableBody = document.getElementById('branchesTable');
            const countEl = document.getElementById('branchCount');
            if (!tableBody) return;

            try {
                const response = await axios.get(`${baseApiUrl}/branch.php?action=get-branches-all`);
                const data = response.data;

                if (data.success && Array.isArray(data.branches)) {
                    branches = data.branches;
                } else {
                    branches = [];
                }
            } catch (e) {
                branches = [];
            }

            renderBranches(tableBody);
            if (countEl) countEl.textContent = branches.length + ' branch(es)';
        }

        function renderBranches(tableBody) {
            if (!branches.length) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-8 text-center text-slate-500">
                            <i class="fas fa-map-marker-alt text-3xl mb-2 text-gold-500/50"></i>
                            <p>No branches yet. Add one to get started.</p>
                        </td>
                    </tr>`;
                return;
            }

            tableBody.innerHTML = branches.map(b => {
                const statusBadge = b.status === 'Active'
                    ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-600">Active</span>'
                    : '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/20 text-slate-500">Inactive</span>';
                return `
                <tr class="hover:bg-slate-50/80 transition">
                    <td class="px-6 py-4 font-medium text-slate-900">${escapeHtml(b.branch_name)}</td>
                    <td class="px-6 py-4 text-sm text-slate-500 max-w-xs truncate" title="${escapeHtml(b.address || '')}">${escapeHtml(b.address || '—')}</td>
                    <td class="px-6 py-4 text-slate-700">${escapeHtml(b.phone || '—')}</td>
                    <td class="px-6 py-4 text-slate-700">${escapeHtml(b.email || '—')}</td>
                    <td class="px-6 py-4">${statusBadge}</td>
                    <td class="px-6 py-4">
                        <button onclick="openEditBranch(${b.branch_id})" class="text-gold-500 hover:text-gold-400 mr-3" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${b.status === 'Active'
                            ? `<button onclick="deactivateBranch(${b.branch_id})" class="text-red-500 hover:text-red-400" title="Deactivate">
                                    <i class="fas fa-user-slash"></i>
                               </button>`
                            : `<button onclick="activateBranch(${b.branch_id})" class="text-green-500 hover:text-green-400" title="Activate">
                                    <i class="fas fa-user-check"></i>
                               </button>`
                        }
                    </td>
                </tr>
            `;
            }).join('');
        }

        function escapeHtml(text) {
            if (text == null) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function openAddBranchModal() {
            document.getElementById('branchModalTitle').textContent = 'Add Branch';
            document.getElementById('submitBranchBtnText').textContent = 'Save Branch';
            document.getElementById('branchId').value = '';
            document.getElementById('branchForm').reset();
            document.getElementById('branchMessage').classList.add('hidden');
            document.getElementById('branchModal').classList.remove('hidden');
            document.getElementById('branchModal').classList.add('flex');
        }

        function openEditBranch(id) {
            const b = branches.find(x => x.branch_id == id);
            if (!b) return;
            document.getElementById('branchModalTitle').textContent = 'Edit Branch';
            document.getElementById('submitBranchBtnText').textContent = 'Update Branch';
            document.getElementById('branchId').value = b.branch_id;
            document.getElementById('branchName').value = b.branch_name || '';
            document.getElementById('branchAddress').value = b.address || '';
            document.getElementById('branchPhone').value = b.phone || '';
            document.getElementById('branchEmail').value = b.email || '';
            document.getElementById('branchMessage').classList.add('hidden');
            document.getElementById('branchModal').classList.remove('hidden');
            document.getElementById('branchModal').classList.add('flex');
        }

        function closeBranchModal() {
            const modal = document.getElementById('branchModal');
            const msg = document.getElementById('branchMessage');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
            if (msg) msg.classList.add('hidden');
        }

        async function saveBranch(e) {
            e.preventDefault();
            const id = document.getElementById('branchId').value;
            const name = document.getElementById('branchName').value.trim();
            const address = document.getElementById('branchAddress').value.trim();
            const phone = document.getElementById('branchPhone').value.trim();
            const email = document.getElementById('branchEmail').value.trim();

            if (!name) {
                showBranchModalMessage('Branch name is required.', 'error');
                return;
            }

            const payload = { branch_name: name, address, phone, email };
            if (id) payload.branch_id = parseInt(id, 10);

            try {
                const action = id ? 'update-branch' : 'add-branch';
                const response = await axios.post(`${baseApiUrl}/branch.php`, { action, ...payload });
                const data = response.data;

                if (data.success) {
                    closeBranchModal();
                    showMessage(id ? 'Branch updated.' : 'Branch added.', 'success');
                    loadBranches();
                } else {
                    showBranchModalMessage(data.error || 'Failed to save branch.', 'error');
                }
            } catch (err) {
                showBranchModalMessage('Network error. Try again.', 'error');
            }
        }

        async function deactivateBranch(id) {
            const b = branches.find(x => x.branch_id == id);
            const name = b ? b.branch_name : 'this branch';
            const result = await Swal.fire({
                title: 'Deactivate Branch?',
                text: `Deactivate "${name}"? (Branch will be set to Inactive so existing data is preserved.)`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#b8860b',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Yes, deactivate'
            });
            if (!result.isConfirmed) return;

            try {
                const response = await axios.post(`${baseApiUrl}/branch.php`, { action: 'delete-branch', branch_id: id });
                const data = response.data;
                if (data.success) {
                    showMessage('Branch deactivated.', 'success');
                    loadBranches();
                } else {
                    showMessage(data.error || 'Delete failed.', 'error');
                }
            } catch (e) {
                showMessage('Network error. Try again.', 'error');
            }
        }

        async function activateBranch(id) {
            const b = branches.find(x => x.branch_id == id);
            const name = b ? b.branch_name : 'this branch';
            const result = await Swal.fire({
                title: 'Activate Branch?',
                text: `Activate "${name}"?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#b8860b',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Yes, activate'
            });
            if (!result.isConfirmed) return;

            try {
                const response = await axios.post(`${baseApiUrl}/branch.php`, { action: 'activate-branch', branch_id: id });
                const data = response.data;
                if (data.success) {
                    showMessage('Branch activated.', 'success');
                    loadBranches();
                } else {
                    showMessage(data.error || 'Activation failed.', 'error');
                }
            } catch (e) {
                showMessage('Network error. Try again.', 'error');
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

            document.getElementById('openAddBranchModalBtn')?.addEventListener('click', openAddBranchModal);
            document.getElementById('closeBranchModalBtn')?.addEventListener('click', closeBranchModal);
            document.getElementById('cancelBranchBtn')?.addEventListener('click', closeBranchModal);
            document.getElementById('branchForm')?.addEventListener('submit', saveBranch);
        });
