    let rooms = [];
        let branches = [];
        let branchTotals = [];

        function escapeHtml(text) {
            if (text == null) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function showMessage(message, type = 'error') {
            Swal.fire({
                icon: type === 'success' ? 'success' : 'error',
                title: type === 'success' ? 'Success' : 'Error',
                text: message,
                confirmButtonColor: '#b8860b'
            });
        }

        function showRoomModalMessage(message) {
            const box = document.getElementById('roomModalMessage');
            if (!box) return;
            box.textContent = message;
            box.className = 'mb-4 p-3 rounded text-sm bg-red-500/15 text-red-300 border border-red-500/30';
            box.classList.remove('hidden');
        }

        async function loadBranches() {
            try {
                const response = await axios.get(`${baseApiUrl}/branch.php?action=get-branches`);
                branches = response.data.success && Array.isArray(response.data.branches) ? response.data.branches : [];
            } catch (error) {
                branches = [];
            }
            const select = document.getElementById('roomBranch');
            if (!select) return;
            select.innerHTML = '<option value="">Select branch...</option>' + branches.map(branch => `<option value="${branch.branch_id}">${escapeHtml(branch.branch_name)}</option>`).join('');
        }

        function updateSummaryCards(summary) {
            document.getElementById('currentRoomsCount').textContent = summary.current_rooms || 0;
            document.getElementById('availableRoomsCount').textContent = summary.available_rooms || 0;
            document.getElementById('maintenanceRoomsCount').textContent = summary.maintenance_rooms || 0;
            document.getElementById('branchCoverageCount').textContent = branchTotals.filter(item => Number(item.current_rooms || 0) > 0).length;
            document.getElementById('totalRoomCountLabel').textContent = `${summary.total_rooms || 0} total room(s)`;
            document.getElementById('roomCount').textContent = `${rooms.length} room(s)`;
        }

        function getStatusBadge(status) {
            if (status === 'Available') return '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700">Available</span>';
            if (status === 'Under Maintenance') return '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700">Under Maintenance</span>';
            return '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-600">Inactive</span>';
        }

        function renderBranchTotals() {
            const grid = document.getElementById('branchTotalsGrid');
            if (!grid) return;
            if (!branchTotals.length) {
                grid.innerHTML = '<div class="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">No branches available.</div>';
                return;
            }
            grid.innerHTML = branchTotals.map(item => `
                <div class="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-5">
                    <p class="text-xs uppercase tracking-[0.2em] text-slate-400 font-bold">Branch</p>
                    <h4 class="mt-2 text-lg font-bold text-slate-900">${escapeHtml(item.branch_name)}</h4>
                    <p class="mt-3 text-sm text-slate-500">Current rooms: <span class="font-semibold text-slate-800">${escapeHtml(String(item.current_rooms || 0))}</span></p>
                </div>
            `).join('');
        }

        function renderRooms() {
            const tableBody = document.getElementById('roomsTable');
            if (!tableBody) return;
            if (!rooms.length) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-8 text-center text-slate-500">
                            <i class="fas fa-door-open text-3xl mb-2 text-yellow-500/50"></i>
                            <p>No rooms yet. Add one to get started.</p>
                        </td>
                    </tr>`;
                return;
            }
            tableBody.innerHTML = rooms.map(room => `
                <tr class="hover:bg-slate-50/80 transition">
                    <td class="px-6 py-4">
                        <div class="font-semibold text-slate-900">${escapeHtml(room.room_name)}</div>
                        <div class="text-xs text-slate-500">Created ${new Date(room.created_at).toLocaleDateString()}</div>
                    </td>
                    <td class="px-6 py-4 text-slate-700">${escapeHtml(room.branch_name)}</td>
                    <td class="px-6 py-4 text-slate-700">${escapeHtml(room.room_type)}</td>
                    <td class="px-6 py-4 text-slate-700">${escapeHtml(String(room.capacity || 0))}</td>
                    <td class="px-6 py-4">${getStatusBadge(room.status)}</td>
                    <td class="px-6 py-4">
                        <button onclick="openEditRoom(${room.room_id})" class="text-yellow-600 hover:text-yellow-500 mr-3" title="Edit"><i class="fas fa-edit"></i></button>
                        ${room.status === 'Inactive'
                            ? `<button onclick="activateRoom(${room.room_id})" class="text-emerald-500 hover:text-emerald-400" title="Activate"><i class="fas fa-toggle-on"></i></button>`
                            : `<button onclick="deactivateRoom(${room.room_id})" class="text-red-500 hover:text-red-400" title="Deactivate"><i class="fas fa-trash-alt"></i></button>`
                        }
                    </td>
                </tr>
            `).join('');
        }

        async function loadRooms() {
            try {
                const response = await axios.get(`${baseApiUrl}/rooms.php?action=get-rooms`);
                const data = response.data || {};
                rooms = Array.isArray(data.rooms) ? data.rooms : [];
                branchTotals = Array.isArray(data.branch_totals) ? data.branch_totals : [];
                updateSummaryCards(data.summary || {});
            } catch (error) {
                rooms = [];
                branchTotals = [];
                updateSummaryCards({});
            }
            renderRooms();
            renderBranchTotals();
        }

        function openAddRoomModal() {
            document.getElementById('roomModalTitle').textContent = 'Add Room';
            document.getElementById('submitRoomBtnText').textContent = 'Save Room';
            document.getElementById('roomForm').reset();
            document.getElementById('roomId').value = '';
            document.getElementById('roomCapacity').value = '1';
            document.getElementById('roomStatus').value = 'Available';
            document.getElementById('roomType').value = 'Private Lesson';
            document.getElementById('roomModalMessage').classList.add('hidden');
            document.getElementById('roomModal').classList.remove('hidden');
            document.getElementById('roomModal').classList.add('flex');
        }

        function openEditRoom(roomId) {
            const room = rooms.find(item => Number(item.room_id) === Number(roomId));
            if (!room) return;
            document.getElementById('roomModalTitle').textContent = 'Edit Room';
            document.getElementById('submitRoomBtnText').textContent = 'Update Room';
            document.getElementById('roomId').value = room.room_id;
            document.getElementById('roomName').value = room.room_name || '';
            document.getElementById('roomBranch').value = room.branch_id || '';
            document.getElementById('roomType').value = room.room_type || 'Private Lesson';
            document.getElementById('roomCapacity').value = room.capacity || 1;
            document.getElementById('roomStatus').value = room.status || 'Available';
            document.getElementById('roomModalMessage').classList.add('hidden');
            document.getElementById('roomModal').classList.remove('hidden');
            document.getElementById('roomModal').classList.add('flex');
        }

        function closeRoomModal() {
            const modal = document.getElementById('roomModal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            document.getElementById('roomModalMessage').classList.add('hidden');
        }

        async function saveRoom(event) {
            event.preventDefault();
            const roomId = document.getElementById('roomId').value;
            const payload = {
                room_name: document.getElementById('roomName').value.trim(),
                branch_id: parseInt(document.getElementById('roomBranch').value, 10) || 0,
                room_type: document.getElementById('roomType').value,
                capacity: parseInt(document.getElementById('roomCapacity').value, 10) || 0,
                status: document.getElementById('roomStatus').value
            };
            if (!payload.room_name) return showRoomModalMessage('Room name is required.');
            if (!payload.branch_id) return showRoomModalMessage('Branch is required.');
            if (payload.capacity < 1) return showRoomModalMessage('Capacity must be at least 1.');

            const action = roomId ? 'update-room' : 'add-room';
            if (roomId) payload.room_id = parseInt(roomId, 10);

            try {
                const response = await axios.post(`${baseApiUrl}/rooms.php`, { action, ...payload });
                if (response.data && response.data.success) {
                    closeRoomModal();
                    showMessage(roomId ? 'Room updated.' : 'Room added.', 'success');
                    loadRooms();
                } else {
                    showRoomModalMessage(response.data.error || 'Failed to save room.');
                }
            } catch (error) {
                showRoomModalMessage(error.response?.data?.error || 'Network error. Try again.');
            }
        }

        async function deactivateRoom(roomId) {
            const room = rooms.find(item => Number(item.room_id) === Number(roomId));
            const result = await Swal.fire({
                title: 'Set Room Inactive?',
                text: `This will hide "${room?.room_name || 'this room'}" from active room lists while keeping history intact.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#b8860b',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Yes, set inactive'
            });
            if (!result.isConfirmed) return;

            try {
                const response = await axios.post(`${baseApiUrl}/rooms.php`, { action: 'delete-room', room_id: roomId });
                if (response.data && response.data.success) {
                    showMessage('Room set to inactive.', 'success');
                    loadRooms();
                } else {
                    showMessage(response.data.error || 'Failed to update room.');
                }
            } catch (error) {
                showMessage(error.response?.data?.error || 'Network error. Try again.');
            }
        }

        async function activateRoom(roomId) {
            try {
                const response = await axios.post(`${baseApiUrl}/rooms.php`, { action: 'activate-room', room_id: roomId });
                if (response.data && response.data.success) {
                    showMessage('Room reactivated.', 'success');
                    loadRooms();
                } else {
                    showMessage(response.data.error || 'Failed to reactivate room.');
                }
            } catch (error) {
                showMessage(error.response?.data?.error || 'Network error. Try again.');
            }
        }

        document.addEventListener('DOMContentLoaded', async function() {
            await loadBranches();
            await loadRooms();
            document.getElementById('openAddRoomModalBtn')?.addEventListener('click', openAddRoomModal);
            document.getElementById('closeRoomModalBtn')?.addEventListener('click', closeRoomModal);
            document.getElementById('cancelRoomBtn')?.addEventListener('click', closeRoomModal);
            document.getElementById('roomForm')?.addEventListener('submit', saveRoom);
        });
