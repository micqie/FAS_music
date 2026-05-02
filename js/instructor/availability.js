 const availabilityDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        function toggleInstructorMenu() {
            const menu = document.getElementById('instructorMobileMenu');
            const icon = document.getElementById('instructorMenuIcon');
            if (!menu || !icon) return;
            const isHidden = menu.classList.contains('hidden');
            menu.classList.toggle('hidden');
            icon.classList.toggle('fa-bars', !isHidden);
            icon.classList.toggle('fa-times', isHidden);
        }

        function showAvailabilityStatus(message, type = 'success') {
            const box = document.getElementById('availabilityStatus');
            if (!box) return;
            box.textContent = message;
            box.className = `mt-4 rounded-2xl border px-4 py-3 text-sm ${type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`;
            box.classList.remove('hidden');
        }

        function renderAvailabilityGrid(entries = []) {
            const grid = document.getElementById('availabilityGrid');
            const template = document.getElementById('availabilityCardTemplate');
            if (!grid || !template) return;

            const byDay = new Map(entries.map(item => [item.day_of_week, item]));
            grid.innerHTML = '';

            availabilityDays.forEach(day => {
                const row = byDay.get(day) || {};
                const card = template.content.firstElementChild.cloneNode(true);
                card.dataset.day = day;
                card.querySelector('.availability-label').textContent = day;

                const enabled = card.querySelector('.availability-enabled');
                const start = card.querySelector('.availability-start');
                const end = card.querySelector('.availability-end');

                enabled.checked = !!row.start_time;
                start.value = String(row.start_time || '09:00:00').slice(0, 5);
                end.value = String(row.end_time || '17:00:00').slice(0, 5);

                const syncDisabled = () => {
                    const disabled = !enabled.checked;
                    start.disabled = disabled;
                    end.disabled = disabled;
                    card.classList.toggle('opacity-60', disabled);
                };
                enabled.addEventListener('change', syncDisabled);
                syncDisabled();

                grid.appendChild(card);
            });
        }

        async function loadAvailability() {
            const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
            if (!user?.user_id) {
                renderAvailabilityGrid([]);
                return;
            }

            try {
                const response = await axios.get(`${baseApiUrl}/teachers.php?action=get-teacher-availability&user_id=${encodeURIComponent(user.user_id)}`);
                const rows = response.data?.success && Array.isArray(response.data.availability) ? response.data.availability : [];
                renderAvailabilityGrid(rows);
            } catch (error) {
                console.error('Failed to load availability:', error);
                renderAvailabilityGrid([]);
                showAvailabilityStatus('Failed to load saved availability.', 'error');
            }
        }

        function collectAvailabilityPayload() {
            return Array.from(document.querySelectorAll('.availability-card')).map(card => ({
                day_of_week: card.dataset.day || '',
                enabled: !!card.querySelector('.availability-enabled')?.checked,
                start_time: card.querySelector('.availability-start')?.value || '',
                end_time: card.querySelector('.availability-end')?.value || ''
            }));
        }

       async function saveAvailability() {
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;

    if (!user?.user_id) {
        await Swal.fire({
            icon: 'error',
            title: 'Session Error',
            text: 'Teacher session not found. Please log in again.',
            confirmButtonColor: '#d33'
        });
        return;
    }

    const payload = collectAvailabilityPayload();

    for (const row of payload) {
        if (!row.enabled) continue;

        if (!row.start_time || !row.end_time) {
            await Swal.fire({
                icon: 'error',
                title: 'Incomplete Time',
                text: `Please complete the time range for ${row.day_of_week}.`,
                confirmButtonColor: '#d33'
            });
            return;
        }

        if (row.end_time <= row.start_time) {
            await Swal.fire({
                icon: 'error',
                title: 'Invalid Time',
                text: `End time must be later than start time for ${row.day_of_week}.`,
                confirmButtonColor: '#d33'
            });
            return;
        }
    }

    try {
        const response = await axios.post(`${baseApiUrl}/teachers.php?action=save-teacher-availability`, {
            action: 'save-teacher-availability',
            user_id: Number(user.user_id),
            availability: payload
        });

        if (response.data?.success) {
            await Swal.fire({
                icon: 'success',
                title: 'Saved!',
                text: 'Availability saved. Admin scheduling will now follow these day and time limits.',
                confirmButtonColor: '#3085d6'
            });

            await loadAvailability();
        } else {
            await Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: response.data?.error || 'Failed to save availability.',
                confirmButtonColor: '#d33'
            });
        }

    } catch (error) {
        await Swal.fire({
            icon: 'error',
            title: 'Network Error',
            text: error.response?.data?.error || 'Network error while saving availability.',
            confirmButtonColor: '#d33'
        });
    }
}

        document.addEventListener('DOMContentLoaded', async () => {
            if (typeof Auth !== 'undefined' && Auth.getUser) {
                const user = Auth.getUser() || {};
                const displayName = user.username || user.email || 'Instructor';
                const nameEl = document.getElementById('instructorNameNav');
                if (nameEl) nameEl.textContent = displayName;
            }
            await loadAvailability();
            document.getElementById('saveAvailabilityBtn')?.addEventListener('click', saveAvailability);
        });
