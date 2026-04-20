  let packages = [];
        let branches = [];
        let selectedBranchFilter = '';

        function showMessage(message, type = 'error') {
            Swal.fire({
                icon: type === 'success' ? 'success' : 'error',
                title: type === 'success' ? 'Success' : 'Error',
                text: message,
                confirmButtonColor: '#b8860b'
            });
        }

        function showPackageModalMessage(msg, type) {
            Swal.fire({
                icon: type === 'success' ? 'success' : 'error',
                title: type === 'success' ? 'Success' : 'Error',
                text: msg,
                confirmButtonColor: '#b8860b'
            });
        }

        function getBranchNameById(branchId) {
            const id = Number(branchId || 0);
            const match = branches.find(b => Number(b.branch_id) === id);
            return match ? String(match.branch_name || '') : '';
        }

        function fillBranchSelectOptions(selectEl, includeAllOption = false) {
            if (!selectEl) return;
            let html = includeAllOption ? '<option value="">All branches</option>' : '<option value="">Select branch...</option>';
            html += branches.map(b =>
                `<option value="${Number(b.branch_id)}">${escapeHtml(String(b.branch_name || 'Unnamed Branch'))}</option>`
            ).join('');
            selectEl.innerHTML = html;
        }

        async function loadBranches() {
            const branchFilter = document.getElementById('packageBranchFilter');
            const branchModalSelect = document.getElementById('packageBranchId');

            try {
                const response = await axios.get(`${baseApiUrl}/branch.php?action=get-branches-all`);
                const data = response.data;
                if (data.success && Array.isArray(data.branches)) {
                    branches = data.branches.filter(b => String(b.status || 'Active') === 'Active');
                } else {
                    branches = [];
                }
            } catch (e) {
                branches = [];
            }

            fillBranchSelectOptions(branchFilter, true);
            fillBranchSelectOptions(branchModalSelect, false);
        }

        async function loadPackages() {
            const tableBody = document.getElementById('packagesTable');
            const countEl = document.getElementById('packageCount');
            const tableTitleEl = document.getElementById('packageTableTitle');
            if (!tableBody) return;

            try {
                let url = `${baseApiUrl}/sessions.php?action=get-packages`;
                if (selectedBranchFilter) {
                    url += `&branch_id=${encodeURIComponent(selectedBranchFilter)}`;
                }
                const response = await axios.get(url);
                const data = response.data;

                if (data.success && Array.isArray(data.packages)) {
                    packages = data.packages;
                } else {
                    packages = [];
                }
            } catch (e) {
                packages = [];
                showMessage('Unable to load packages from the database.', 'error');
            }

            renderPackageHighlights();
            renderPackages(tableBody);
            if (countEl) countEl.textContent = packages.length + ' package(s)';
            if (tableTitleEl) {
                const branchName = getBranchNameById(selectedBranchFilter);
                tableTitleEl.innerHTML = `<i class="fas fa-calendar-check mr-2 text-gold-500"></i>${branchName ? `${escapeHtml(branchName)} Session Packages` : 'All Session Packages'}`;
            }
        }

        function getHighlightIcon(maxInstruments) {
            if (Number(maxInstruments) <= 1) return 'fa-drum';
            if (Number(maxInstruments) === 2) return 'fa-guitar';
            return 'fa-music';
        }

        function renderPackageHighlights() {
            const highlightsEl = document.getElementById('packageHighlights');
            if (!highlightsEl) return;

            if (!packages.length) {
                highlightsEl.innerHTML = `
                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 md:col-span-3">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                <i class="fas fa-box-open text-slate-400"></i>
                            </div>
                            <span class="font-semibold text-slate-900">No packages found</span>
                        </div>
                        <p class="text-sm text-slate-500">This section only shows packages currently saved in the database.</p>
                    </div>
                `;
                return;
            }

            highlightsEl.innerHTML = packages.map((p) => {
                const sessionsLabel = `${Number(p.sessions)} Session${Number(p.sessions) === 1 ? '' : 's'}`;
                const instrumentsLabel = `${Number(p.max_instruments)} instrument${Number(p.max_instruments) === 1 ? ' only' : 's'}`;
                const branchName = p.branch_name || getBranchNameById(p.branch_id);
                const description = p.description ? escapeHtml(String(p.description)) : `1 package = ${instrumentsLabel}`;

                return `
                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="h-10 w-10 rounded-lg bg-gold-500/20 flex items-center justify-center">
                                <i class="fas ${getHighlightIcon(p.max_instruments)} text-gold-500"></i>
                            </div>
                            <div>
                                <div class="font-semibold text-slate-900">${escapeHtml(sessionsLabel)}</div>
                                <div class="text-xs uppercase tracking-wide text-slate-400">${escapeHtml(p.package_name || 'Package')}</div>
                            </div>
                        </div>
                        <p class="text-sm text-slate-500">1 package = <strong class="text-gold-500">${escapeHtml(instrumentsLabel)}</strong></p>
                        <p class="mt-2 text-xs text-slate-400">${branchName ? escapeHtml(branchName) + ' • ' : ''}${description}</p>
                    </div>
                `;
            }).join('');
        }

        function renderPackages(tableBody) {
            if (!packages.length) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-8 text-center text-slate-500">
                            <i class="fas fa-calendar-alt text-3xl mb-2 text-gold-500/50"></i>
                            <p>No session packages yet. Add one to get started.</p>
                        </td>
                    </tr>`;
                return;
            }

            tableBody.innerHTML = packages.map(p => {
                const price = parseFloat(p.price || 0);
                const priceFormatted = price.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 });
                const branchName = p.branch_name || getBranchNameById(p.branch_id) || 'Unassigned';
                return `
                <tr class="hover:bg-slate-50/80 transition">
                    <td class="px-6 py-4 text-slate-700">${escapeHtml(branchName)}</td>
                    <td class="px-6 py-4 font-medium text-slate-900">${escapeHtml(p.package_name)}</td>
                    <td class="px-6 py-4 text-slate-700">${p.sessions}</td>
                    <td class="px-6 py-4">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gold-500/20 text-gold-600">
                            ${p.max_instruments} instrument${p.max_instruments > 1 ? 's' : ''}
                        </span>
                    </td>
                    <td class="px-6 py-4 font-semibold text-slate-900">${priceFormatted}</td>
                    <td class="px-6 py-4 text-sm text-slate-500">${escapeHtml(p.description || '—')}</td>
                    <td class="px-6 py-4">
                        <button onclick="openEditPackage(${p.package_id})" class="text-gold-500 hover:text-gold-400 mr-3" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deletePackage(${p.package_id})" class="text-red-500 hover:text-red-400" title="Delete">
                            <i class="fas fa-trash-alt"></i>
                        </button>
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

        function openAddPackageModal() {
            document.getElementById('packageModalTitle').textContent = 'Add Session Package';
            document.getElementById('submitPackageBtnText').textContent = 'Save Package';
            document.getElementById('packageId').value = '';
            document.getElementById('packageForm').reset();
            const branchSelect = document.getElementById('packageBranchId');
            if (branchSelect) {
                const defaultBranch = selectedBranchFilter || (branches[0] ? String(branches[0].branch_id) : '');
                branchSelect.value = defaultBranch;
            }
            document.getElementById('packageMessage').classList.add('hidden');
            document.getElementById('packageModal').classList.remove('hidden');
            document.getElementById('packageModal').classList.add('flex');
        }

        function openEditPackage(id) {
            const p = packages.find(x => x.package_id == id);
            if (!p) return;
            document.getElementById('packageModalTitle').textContent = 'Edit Session Package';
            document.getElementById('submitPackageBtnText').textContent = 'Update Package';
            document.getElementById('packageId').value = p.package_id;
            document.getElementById('packageBranchId').value = p.branch_id || '';
            document.getElementById('packageName').value = p.package_name;
            document.getElementById('packageSessions').value = p.sessions;
            document.getElementById('packageMaxInstruments').value = p.max_instruments;
            document.getElementById('packagePrice').value = p.price ?? 0;
            document.getElementById('packageDescription').value = p.description || '';
            document.getElementById('packageMessage').classList.add('hidden');
            document.getElementById('packageModal').classList.remove('hidden');
            document.getElementById('packageModal').classList.add('flex');
        }

        function closePackageModal() {
            const modal = document.getElementById('packageModal');
            const msg = document.getElementById('packageMessage');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
            if (msg) msg.classList.add('hidden');
        }

        async function savePackage(e) {
            e.preventDefault();
            const id = document.getElementById('packageId').value;
            const branchId = parseInt(document.getElementById('packageBranchId').value, 10);
            const name = document.getElementById('packageName').value.trim();
            const sessions = parseInt(document.getElementById('packageSessions').value, 10);
            const maxInstruments = parseInt(document.getElementById('packageMaxInstruments').value, 10);
            const price = parseFloat(document.getElementById('packagePrice').value) || 0;
            const description = document.getElementById('packageDescription').value.trim();

            if (!branchId || !name || sessions < 1 || maxInstruments < 1 || maxInstruments > 3) {
                showPackageModalMessage('Please fill required fields, including branch. Max instruments must be 1–3.', 'error');
                return;
            }
            if (price < 0) {
                showPackageModalMessage('Price cannot be negative.', 'error');
                return;
            }

            const payload = { branch_id: branchId, package_name: name, sessions, max_instruments: maxInstruments, price, description };
            if (id) payload.package_id = id;

            try {
                const action = id ? 'update-package' : 'add-package';
                const response = await axios.post(`${baseApiUrl}/sessions.php`, { action, ...payload });
                const data = response.data;

                if (data.success) {
                    closePackageModal();
                    showMessage(id ? 'Package updated.' : 'Package added.', 'success');
                    loadPackages();
                } else {
                    showPackageModalMessage(data.error || 'Failed to save package.', 'error');
                }
            } catch (err) {
                showPackageModalMessage('Unable to save package to the database. Try again.', 'error');
            }
        }

        async function deletePackage(id) {
            const p = packages.find(x => x.package_id == id);
            const name = p ? p.package_name : 'this package';
            const result = await Swal.fire({
                title: 'Delete Package?',
                text: `Remove "${name}"? This cannot be undone.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#b8860b',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Yes, delete'
            });
            if (!result.isConfirmed) return;

            try {
                const response = await axios.post(`${baseApiUrl}/sessions.php`, { action: 'delete-package', package_id: id });
                const data = response.data;
                if (data.success) {
                    showMessage('Package deleted.', 'success');
                    loadPackages();
                } else {
                    showMessage(data.error || 'Delete failed.', 'error');
                }
            } catch (e) {
                showMessage('Unable to delete package from the database. Try again.', 'error');
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

            await loadBranches();
            await loadPackages();

            document.getElementById('openAddPackageModalBtn')?.addEventListener('click', openAddPackageModal);
            document.getElementById('closePackageModalBtn')?.addEventListener('click', closePackageModal);
            document.getElementById('cancelPackageBtn')?.addEventListener('click', closePackageModal);
            document.getElementById('packageForm')?.addEventListener('submit', savePackage);
            document.getElementById('packageBranchFilter')?.addEventListener('change', async function() {
                selectedBranchFilter = this.value || '';
                await loadPackages();
            });
            document.getElementById('clearPackageBranchFilterBtn')?.addEventListener('click', async function() {
                const filterEl = document.getElementById('packageBranchFilter');
                selectedBranchFilter = '';
                if (filterEl) filterEl.value = '';
                await loadPackages();
            });
        });
