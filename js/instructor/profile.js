
        function toggleInstructorMenu() {
            const menu = document.getElementById('instructorMobileMenu');
            const icon = document.getElementById('instructorMenuIcon');
            if (!menu || !icon) return;
            const isHidden = menu.classList.contains('hidden');
            menu.classList.toggle('hidden');
            icon.classList.toggle('fa-bars', !isHidden);
            icon.classList.toggle('fa-times', isHidden);
        }

        document.addEventListener('DOMContentLoaded', async () => {
            if (!(typeof Auth !== 'undefined' && Auth.getUser)) return;
            const user = Auth.getUser() || {};
            const nameEl = document.getElementById('instructorNameNav');
            const profileName = document.getElementById('profileName');
            const profileEmail = document.getElementById('profileEmail');
            const profileStatus = document.getElementById('profileStatus');
            const profileSpecialization = document.getElementById('profileSpecialization');
            const profileBranch = document.getElementById('profileBranch');
            const profileEmploymentType = document.getElementById('profileEmploymentType');
            const profileFirstName = document.getElementById('profileFirstName');
            const profileLastName = document.getElementById('profileLastName');
            const profileEmailInput = document.getElementById('profileEmailInput');
            const profilePhone = document.getElementById('profilePhone');
            const profileBranchInput = document.getElementById('profileBranchInput');
            const profileEmploymentTypeInput = document.getElementById('profileEmploymentTypeInput');
            const profileSpecializationInput = document.getElementById('profileSpecializationInput');
            const profileStatusInline = document.getElementById('profileStatusInline');
            const profileLoginEmail = document.getElementById('profileLoginEmail');
            const profileTeacherId = document.getElementById('profileTeacherId');

            const fallbackName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.username || user.email || 'Instructor';
            if (nameEl) nameEl.textContent = fallbackName;
            if (profileName) profileName.textContent = fallbackName;
            if (profileEmail) profileEmail.textContent = user.email || 'instructor@fas.edu';
            if (profileEmailInput) profileEmailInput.value = user.email || '';
            if (profileLoginEmail) profileLoginEmail.textContent = user.email || '—';

            try {
                const userId = Number(user.user_id || 0);
                if (userId < 1) return;
                const response = await axios.get(`${baseApiUrl}/teachers.php?action=get-teachers&user_id=${encodeURIComponent(userId)}`);
                const teachers = response?.data?.success && Array.isArray(response.data.teachers) ? response.data.teachers : [];
                const teacher = teachers[0] || null;
                if (!teacher) return;

                const liveName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || fallbackName;
                const statusText = teacher.status || '—';
                const specializationText = teacher.specialization || 'General';
                const branchText = teacher.branch_name || '—';
                const employmentTypeText = teacher.employment_type || '—';
                const teacherEmail = teacher.email || user.email || '';

                if (nameEl) nameEl.textContent = liveName;
                if (profileName) profileName.textContent = liveName;
                if (profileEmail) profileEmail.textContent = teacherEmail || 'instructor@fas.edu';
                if (profileStatus) {
                    profileStatus.textContent = statusText;
                    profileStatus.className = `mt-4 px-3 py-1 rounded-full text-xs font-semibold ${statusText === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`;
                }
                if (profileSpecialization) {
                    if (profileSpecialization.dataset.specializationBadges === 'true') {
                        const names = specializationText.split(',').map(name => name.trim()).filter(Boolean);
                        profileSpecialization.replaceChildren(...(names.length ? names : ['General']).map(name => {
                            const badge = document.createElement('span');
                            badge.className = 'inline-flex items-center gap-1.5 rounded-lg border border-gold-400/40 bg-gold-50 px-3 py-1.5 text-xs font-bold text-gold-600 shadow-sm';
                            const icon = document.createElement('i');
                            icon.className = 'fas fa-music text-[10px]';
                            const label = document.createElement('span');
                            label.textContent = name;
                            badge.append(icon, label);
                            return badge;
                        }));
                    } else {
                        profileSpecialization.textContent = `Primary: ${specializationText}`;
                    }
                }
                if (profileBranch) profileBranch.textContent = branchText;
                if (profileEmploymentType) profileEmploymentType.textContent = employmentTypeText;
                if (profileFirstName) profileFirstName.value = teacher.first_name || '';
                if (profileLastName) profileLastName.value = teacher.last_name || '';
                if (profileEmailInput) profileEmailInput.value = teacherEmail;
                if (profilePhone) profilePhone.value = teacher.phone || '';
                if (profileBranchInput) profileBranchInput.value = branchText;
                if (profileEmploymentTypeInput) profileEmploymentTypeInput.value = employmentTypeText;
                if (profileSpecializationInput) profileSpecializationInput.value = specializationText;
                if (profileStatusInline) profileStatusInline.textContent = statusText;
                if (profileLoginEmail) profileLoginEmail.textContent = teacherEmail || '—';
                if (profileTeacherId) profileTeacherId.textContent = String(teacher.teacher_id || '—');
            } catch (error) {
                console.error('Failed to load live teacher profile:', error);
            }
        });
