     // Load Dashboard Stats
        function formatPeso(value) {
            const num = Number(value) || 0;
            return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        async function loadDashboardStats() {
            try {
                const [registrationsResult, revenueResult] = await Promise.allSettled([
                    axios.get(`${baseApiUrl}/admin.php?action=get-all-registrations`),
                    axios.get(`${baseApiUrl}/admin.php?action=get-revenue-summary`)
                ]);
                const registrationsData = registrationsResult.status === 'fulfilled' ? registrationsResult.value.data : null;
                const revenueData = revenueResult.status === 'fulfilled' ? revenueResult.value.data : null;

                if (registrationsData && registrationsData.success && registrationsData.registrations) {
                    updateStats(registrationsData.registrations);
                    displayRecentActivity(registrationsData.registrations);
                }

                const revenueEl = document.getElementById('statFeePaid');
                if (revenueEl) {
                    if (revenueData && revenueData.success) {
                        revenueEl.textContent = formatPeso(revenueData.total_revenue);
                    } else if (registrationsData && registrationsData.success && registrationsData.registrations) {
                        // Fallback: sum paid registration amounts from loaded rows
                        const fallbackRevenue = registrationsData.registrations.reduce(
                            (sum, reg) => sum + (parseFloat(reg.registration_fee_paid) || 0),
                            0
                        );
                        revenueEl.textContent = formatPeso(fallbackRevenue);
                    } else {
                        revenueEl.textContent = formatPeso(0);
                    }
                }
            } catch (error) {
                console.error('Failed to load dashboard stats:', error);
                showMessage('Failed to load dashboard statistics', 'error');
            }
        }

        // Display Recent Activity
        function displayRecentActivity(registrations) {
            const recentDiv = document.getElementById('recentActivity');
            if (!recentDiv) return;

            if (!registrations || registrations.length === 0) {
                recentDiv.innerHTML = `
                    <div class="text-center py-8 text-black">
                        <i class="fas fa-inbox text-4xl text-gray-300 dark:text-zinc-700 mb-3"></i>
                        <p class="text-gray-500 dark:text-zinc-400">No registrations yet</p>
                    </div>
                `;
                return;
            }

            const recent = registrations.slice(0, 5);
            recentDiv.innerHTML = recent.map(reg => {
                const statusColors = {
                    'Pending': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
                    'Fee Paid': 'bg-green-500/10 text-green-500 border-green-500/20',
                    'Approved': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                    'Rejected': 'bg-red-500/10 text-red-500 border-red-500/20'
                };
                const statusClass = statusColors[reg.registration_status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';

                return `
                    <div class="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gold-500/10 hover:bg-gray-50 dark:hover:bg-white/5 transition mb-2">
                        <div class="flex items-center gap-3">
                            <div class="h-10 w-10 rounded-full bg-gold-500/10 dark:bg-gold-500/20 flex items-center justify-center">
                                <i class="fas fa-user text-gold-500 dark:text-gold-400"></i>
                            </div>
                            <div>
                                <p class="font-medium text-black ">${reg.first_name} ${reg.last_name}</p>
                                <p class="text-xs text-gray-500 dark:text-zinc-400">${reg.branch_name || 'No branch'} • ${new Date(reg.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <span class="px-3 py-1 rounded-full text-xs font-semibold border ${statusClass}">
                            ${reg.registration_status}
                        </span>
                    </div>
                `;
            }).join('');
        }

        // Load Branches
        async function loadBranches() {
            const branchesDiv = document.getElementById('branchesList');
            if (!branchesDiv) return;

            try {
                const response = await axios.get(`${baseApiUrl}/branch.php?action=get-branches`);
                const data = response.data;

                if (data.success && data.branches && data.branches.length > 0) {
                    branchesDiv.innerHTML = data.branches.map(branch => `
                        <div class="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-gold-500/10 hover:bg-gray-50 dark:hover:bg-white/5 transition">
                            <div class="h-10 w-10 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                <i class="fas fa-building text-blue-500 dark:text-blue-400"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="font-semibold text-gray-900 dark:text-black truncate">${branch.branch_name}</p>
                                ${branch.address ? `<p class="text-xs text-gray-500 dark:text-zinc-400 truncate mt-1">${branch.address}</p>` : ''}
                                ${branch.phone ? `<p class="text-xs text-gray-500 dark:text-zinc-400 mt-1"><i class="fas fa-phone mr-1"></i>${branch.phone}</p>` : ''}
                            </div>
                        </div>
                    `).join('');
                } else {
                    branchesDiv.innerHTML = `
                        <div class="text-center py-8">
                            <i class="fas fa-building text-4xl text-gray-300 dark:text-zinc-700 mb-3"></i>
                            <p class="text-gray-500 dark:text-zinc-400">No branches found</p>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Failed to load branches:', error);
                branchesDiv.innerHTML = `
                    <div class="text-center py-8 text-red-500 dark:text-red-400">
                        <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                        <p>Failed to load branches</p>
                    </div>
                `;
            }
        }

        document.addEventListener('DOMContentLoaded', function() {
            if (typeof checkAuth === 'function') {
                checkAuth();
            }

            // Load user info in top nav
            if (typeof Auth !== 'undefined' && Auth.getUser) {
                const user = Auth.getUser();
                if (user) {
                    const userNameNav = document.getElementById('userNameNav');
                    const profileMenuName = document.getElementById('profileMenuName');
                    const userRoleNav = document.getElementById('userRoleNav');
                    const displayName = user.username || user.email || 'Admin';
                    if (userNameNav) userNameNav.textContent = displayName;
                    if (profileMenuName) profileMenuName.textContent = displayName;
                    if (userRoleNav) userRoleNav.textContent = user.role_name || 'Admin';
                }
            }

            // Load dashboard data
            loadDashboardStats();
            loadBranches();
        });
