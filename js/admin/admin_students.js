  let allStudents = [];
        let filteredStudents = [];

        // Load branches for filter
        async function loadBranchesForFilter() {
            const branchFilter = document.getElementById('branchFilter');
            if (!branchFilter) return Promise.resolve();

            try {
                const response = await axios.get(`${baseApiUrl}/branch.php?action=get-branches`);
                const data = response.data;

                if (data.success && data.branches) {
                    branchFilter.innerHTML = '<option value="">All Branches</option>';
                    data.branches.forEach(branch => {
                        const option = document.createElement('option');
                        option.value = branch.branch_id;
                        option.textContent = branch.branch_name;
                        branchFilter.appendChild(option);
                    });
                }
                return Promise.resolve();
            } catch (error) {
                console.error('Failed to load branches:', error);
                return Promise.resolve();
            }
        }

        // Filter students by branch
        function filterStudentsByBranch(branchId) {
            if (!branchId || branchId === '') {
                filteredStudents = allStudents;
            } else {
                // Filter by branch_id (convert to number for comparison)
                filteredStudents = allStudents.filter(student => {
                    // Handle both string and number comparisons
                    const studentBranchId = student.branch_id ? String(student.branch_id) : null;
                    const filterBranchId = String(branchId);
                    return studentBranchId === filterBranchId;
                });
            }
            displayFilteredStudents();
            updateStudentCount();
        }

        // Display filtered students
        function displayFilteredStudents() {
            const tableBody = document.getElementById('studentsTable');
            if (!tableBody) return;

            if (!filteredStudents || filteredStudents.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-8 text-center text-slate-500">
                            <i class="fas fa-inbox text-2xl mb-2 text-gold-500/50"></i>
                            <p>No students found</p>
                        </td>
                    </tr>
                `;
                return;
            }

            tableBody.innerHTML = filteredStudents.map(student => {
                const statusColors = {
                    'Pending': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
                    'Fee Paid': 'bg-green-500/10 text-green-500 border-green-500/20',
                    'Approved': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                    'Active': 'bg-green-500/10 text-green-500 border-green-500/20',
                    'Inactive': 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                };
                const statusClass = statusColors[student.status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';
                const isActive = String(student.status || '') === 'Active';
                const actionLabel = isActive ? 'Deactivate' : 'Activate';
                const actionClass = isActive
                    ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                    : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100';

                return `
                    <tr class="hover:bg-slate-50/80 transition">
                        <td class="px-6 py-4">
                            <div class="font-medium text-slate-900">${student.first_name} ${student.last_name}</div>
                            <div class="text-sm text-slate-500">${student.email || ''}</div>
                        </td>
                        <td class="px-6 py-4 text-slate-800">${student.phone || ''}</td>
                        <td class="px-6 py-4 text-slate-800">${student.branch_name || 'N/A'}</td>
                        <td class="px-6 py-4">
                            <div class="text-slate-800 font-medium">₱${parseFloat(student.registration_fee_amount || 0).toFixed(2)}</div>
                            ${student.registration_fee_paid ? `<div class="text-xs text-slate-500">Paid: ₱${parseFloat(student.registration_fee_paid).toFixed(2)}</div>` : ''}
                        </td>
                        <td class="px-6 py-4">
                            <span class="px-2 py-1 rounded text-xs font-semibold border ${statusClass}">
                                ${student.status || 'N/A'}
                            </span>
                        </td>
                        <td class="px-6 py-4 text-slate-500 text-sm">
                            ${new Date(student.created_at).toLocaleDateString()}
                        </td>
                        <td class="px-6 py-4">
                            <button class="px-3 py-1.5 text-xs font-semibold rounded border ${actionClass} transition"
                                onclick="toggleStudentStatus(${Number(student.student_id)}, '${isActive ? 'Inactive' : 'Active'}')">
                                ${actionLabel}
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Update student count
        function updateStudentCount() {
            const studentCount = document.getElementById('studentCount');
            const tableCount = document.getElementById('tableCount');
            const branchFilter = document.getElementById('branchFilter');
            const selectedBranch = branchFilter ? branchFilter.options[branchFilter.selectedIndex] : null;
            const branchName = selectedBranch && selectedBranch.value ? selectedBranch.textContent : 'All Branches';
            const count = filteredStudents.length;
            const total = allStudents.length;

            if (studentCount) {
                studentCount.textContent = `Showing ${count} ${count === 1 ? 'student' : 'students'}${selectedBranch && selectedBranch.value ? ` in ${branchName}` : ''} (${total} total)`;
            }
            if (tableCount) {
                tableCount.textContent = `${count} ${count === 1 ? 'student' : 'students'}${selectedBranch && selectedBranch.value ? ` in ${branchName}` : ''}`;
            }
        }

        async function toggleStudentStatus(studentId, nextStatus) {
            const actionLabel = nextStatus === 'Active' ? 'activate' : 'deactivate';
            const confirmText = `Are you sure you want to ${actionLabel} this student?`;
            const confirmed = await Swal.fire({
                icon: 'warning',
                title: 'Confirm Action',
                text: confirmText,
                showCancelButton: true,
                confirmButtonColor: '#b8860b',
                confirmButtonText: 'Yes, continue',
                cancelButtonText: 'Cancel'
            });
            if (!confirmed.isConfirmed) return;

            try {
                const res = await axios.post(`${baseApiUrl}/students.php`, {
                    action: 'set-student-status',
                    student_id: Number(studentId),
                    status: nextStatus
                });
                const data = res.data || {};
                if (data.success) {
                    await loadStudents();
                    Swal.fire({
                        icon: 'success',
                        title: 'Updated',
                        text: data.message || 'Student status updated.',
                        confirmButtonColor: '#b8860b'
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Update Failed',
                        text: data.error || 'Unable to update student status.',
                        confirmButtonColor: '#b8860b'
                    });
                }
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Update Failed',
                    text: 'Network error. Please try again.',
                    confirmButtonColor: '#b8860b'
                });
            }
        }

        // Load students
        async function loadStudents() {
            const tableBody = document.getElementById('studentsTable');
            if (!tableBody) return;

            try {
                const res = await axios.get(`${baseApiUrl}/students.php?action=get-all-students`);
                const data = res.data;
                if (data && data.success && data.students) {
                    allStudents = data.students;
                    // Apply current filter if one is selected
                    const branchFilter = document.getElementById('branchFilter');
                    const selectedBranchId = branchFilter ? branchFilter.value : '';
                    filterStudentsByBranch(selectedBranchId);
                } else {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="7" class="px-6 py-8 text-center text-gray-500 dark:text-zinc-400">
                                <i class="fas fa-inbox text-2xl mb-2"></i>
                                <p>No students found</p>
                            </td>
                        </tr>
                    `;
                    allStudents = [];
                    filteredStudents = [];
                    updateStudentCount();
                }
            } catch (error) {
                console.error('Failed to load students:', error);
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-8 text-center text-red-500">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <p>Failed to load students</p>
                        </td>
                    </tr>
                `;
                allStudents = [];
                filteredStudents = [];
                updateStudentCount();
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
                    const displayName = user.username || user.email || 'Admin';
                    if (userNameNav) userNameNav.textContent = displayName;
                    if (profileMenuName) profileMenuName.textContent = displayName;
                }
            }

            // Load branches first, then students
            loadBranchesForFilter().then(() => {
                loadStudents();
            });

            // Branch filter change handler
            const branchFilter = document.getElementById('branchFilter');
            if (branchFilter) {
                branchFilter.addEventListener('change', function() {
                    filterStudentsByBranch(this.value);
                });
            }
        });
