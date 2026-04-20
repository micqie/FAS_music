     let specializations = [];

        function esc(v) {
            if (v == null) return '';
            const d = document.createElement('div');
            d.textContent = String(v);
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

        function statusBadge(status) {
            return status === 'Active'
                ? 'bg-green-100 text-green-700 border-green-200'
                : 'bg-slate-100 text-slate-700 border-slate-200';
        }

        async function loadSpecializations() {
            const res = await axios.get(`${baseApiUrl}/teachers.php?action=get-specializations`);
            const data = res.data;
            specializations = (data.success && Array.isArray(data.specializations)) ? data.specializations : [];
            renderSpecializations();
        }

        function renderSpecializations() {
            const table = document.getElementById('specTable');
            const count = document.getElementById('specCount');
            if (!table) return;
            if (count) count.textContent = `${specializations.length} specialization(s)`;

            if (!specializations.length) {
                table.innerHTML = '<tr><td colspan="3" class="px-6 py-8 text-center text-slate-500"><i class="fas fa-inbox text-2xl mb-2 text-gold-500/50"></i><p>No records found.</p></td></tr>';
                return;
            }

            table.innerHTML = specializations.map(s => `
                <tr class="hover:bg-slate-50/80 transition">
                    <td class="px-6 py-4 text-slate-900 font-medium">${esc(s.specialization_name)}</td>
                    <td class="px-6 py-4"><span class="px-2 py-1 rounded text-xs font-semibold border ${statusBadge(s.status)}">${esc(s.status)}</span></td>
                    <td class="px-6 py-4">
                        <button onclick="toggleSpecStatus(${Number(s.specialization_id)}, '${s.status === 'Active' ? 'Inactive' : 'Active'}')" class="px-3 py-1.5 rounded-lg ${s.status === 'Active' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'} text-xs font-bold">
                            ${s.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        async function saveSpecialization(event) {
            event.preventDefault();
            const payload = {
                action: 'add-specialization',
                specialization_name: document.getElementById('specializationName').value.trim(),
                status: document.getElementById('specializationStatus').value
            };

            const res = await axios.post(`${baseApiUrl}/teachers.php?action=add-specialization`, payload);
            const data = res.data;
            if (!data.success) {
                showMessage(data.error || 'Failed to save specialization');
                return;
            }

            document.getElementById('specializationForm').reset();
            showMessage('Specialization saved', 'success');
            await loadSpecializations();
        }

        async function toggleSpecStatus(specializationId, status) {
            const res = await axios.post(`${baseApiUrl}/teachers.php?action=set-specialization-status`, {
                action: 'set-specialization-status',
                specialization_id: Number(specializationId),
                status
            });
            const data = res.data;
            if (!data.success) {
                showMessage(data.error || 'Failed to update status');
                return;
            }
            await loadSpecializations();
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
            await loadSpecializations();
            document.getElementById('specializationForm')?.addEventListener('submit', saveSpecialization);
        });
