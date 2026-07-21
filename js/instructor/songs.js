let instructorSongLibrary = [];
let instructorSongAssignments = [];
let instructorSongStudents = [];
let instructorSongSessions = [];
let instructorSongCategories = [];
let currentInstructorUser = null;
let activeSongModalId = null;
let instructorSongSelectedStudentId = 0;
let instructorSongSelectedSongId = 0;
let instructorSongSelectedPracticeBy = 'next_lesson';
let instructorSongSelectedCategory = '';

function toggleInstructorMenu() {
    const menu = document.getElementById('instructorMobileMenu');
    const icon = document.getElementById('instructorMenuIcon');
    if (!menu || !icon) return;
    const isHidden = menu.classList.contains('hidden');
    menu.classList.toggle('hidden');
    icon.classList.toggle('fa-bars', !isHidden);
    icon.classList.toggle('fa-times', isHidden);
}

function escapeSongHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function songAssetUrl(path) {
    return path ? `../../${String(path).replace(/^\/+/, '')}` : '';
}

function formatSongDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatSongTime(value) {
    if (!value) return '—';
    const parts = String(value).split(':');
    if (parts.length < 2) return value;
    const hour = Number(parts[0]);
    const minute = Number(parts[1]);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return value;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function progressBadgeClass(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'completed') return 'bg-emerald-100 text-emerald-700';
    if (normalized === 'polishing') return 'bg-violet-100 text-violet-700';
    if (normalized === 'practicing') return 'bg-sky-100 text-sky-700';
    return 'bg-amber-100 text-amber-700';
}

function setSongModalVisibility(modalId, shouldOpen) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    if (shouldOpen && modalId === 'studentSwitcherModal') {
        renderStudentSwitcherContent();
    }
    modal.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
    document.body.classList.toggle('overflow-hidden', shouldOpen);
    activeSongModalId = shouldOpen ? modalId : (activeSongModalId === modalId ? null : activeSongModalId);
}

function attachSongModals() {
    document.querySelectorAll('[data-open-song-modal]').forEach(button => {
        button.addEventListener('click', () => {
            const modalId = button.getAttribute('data-open-song-modal');
            if (!modalId) return;
            setSongModalVisibility(modalId, true);
        });
    });

    document.querySelectorAll('.song-modal').forEach(modal => {
        modal.querySelectorAll('[data-close-song-modal]').forEach(button => {
            button.addEventListener('click', () => {
                setSongModalVisibility(modal.id, false);
            });
        });
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && activeSongModalId) {
            setSongModalVisibility(activeSongModalId, false);
        }
    });
}

function showSongMessage(targetId, message, type = 'info') {
    const el = document.getElementById(targetId);
    if (!el) return;
    const styles = {
        error: 'border-red-200 bg-red-50 text-red-700',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        info: 'border-slate-200 bg-slate-50 text-slate-700'
    };
    el.className = `mt-4 rounded-2xl border px-4 py-3 text-sm ${styles[type] || styles.info}`;
    el.textContent = message;
    el.classList.remove('hidden');
}

function hideSongMessage(targetId) {
    const el = document.getElementById(targetId);
    if (el) el.classList.add('hidden');
}

function setQuickAssignHint(message, type = 'info') {
    const el = document.getElementById('quickAssignHint');
    if (!el) return;
    const styles = {
        error: 'text-rose-600',
        success: 'text-emerald-600',
        info: 'text-slate-500',
        muted: 'text-slate-400'
    };
    el.className = `mt-3 text-center text-sm ${styles[type] || styles.info}`;
    el.textContent = message;
}

function normalizeCategory(value) {
    return String(value || '').trim().toLowerCase();
}

function getStudentInitials(student) {
    const parts = String(student?.student_name || 'Student').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'ST';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function getStudentById(studentId) {
    return instructorSongStudents.find(student => Number(student.student_id || 0) === Number(studentId || 0)) || null;
}

function getSongById(songId) {
    return instructorSongLibrary.find(song => Number(song.song_id || 0) === Number(songId || 0)) || null;
}

function getSessionDateTime(session) {
    if (!session?.session_date || !session?.start_time) return null;
    const value = new Date(`${session.session_date}T${session.start_time}`);
    return Number.isNaN(value.getTime()) ? null : value;
}

function getSessionEndDateTime(session) {
    if (!session?.session_date || !session?.end_time) return null;
    const value = new Date(`${session.session_date}T${session.end_time}`);
    return Number.isNaN(value.getTime()) ? null : value;
}

function isSameLocalDate(dateA, dateB) {
    return String(dateA || '').slice(0, 10) === String(dateB || '').slice(0, 10);
}

function toLocalDateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isActiveSession(session) {
    const start = getSessionDateTime(session);
    const end = getSessionEndDateTime(session);
    if (!start || !end) return false;
    const status = String(session?.status || '').toLowerCase();
    if (status === 'completed' || status === 'cancelled_by_teacher' || status === 'cancelled_by_student') return false;
    const now = new Date();
    return start <= now && end >= now;
}

function getCurrentSessionRecord() {
    const now = new Date();
    const activeSessions = instructorSongSessions.filter(isActiveSession).sort((a, b) => {
        const startA = getSessionDateTime(a)?.getTime() || 0;
        const startB = getSessionDateTime(b)?.getTime() || 0;
        return startA - startB;
    });
    if (activeSessions.length) return activeSessions[0];

    const todayUpcoming = instructorSongSessions
        .filter(session => {
            const start = getSessionDateTime(session);
            const status = String(session?.status || '').toLowerCase();
            return !!start && start >= now && isSameLocalDate(session.session_date, toLocalDateKey(now));
        })
        .sort((a, b) => (getSessionDateTime(a)?.getTime() || 0) - (getSessionDateTime(b)?.getTime() || 0));

    if (todayUpcoming.length) return todayUpcoming[0];

    const allUpcoming = instructorSongSessions
        .filter(session => {
            const start = getSessionDateTime(session);
            const status = String(session?.status || '').toLowerCase();
            return !!start && start >= now && status !== 'completed';
        })
        .sort((a, b) => (getSessionDateTime(a)?.getTime() || 0) - (getSessionDateTime(b)?.getTime() || 0));

    return allUpcoming[0] || instructorSongSessions[0] || null;
}

function getCurrentSessionStudentId() {
    const currentSession = getCurrentSessionRecord();
    return Number(currentSession?.student_id || 0) || 0;
}

function getAllowedCategoriesForStudent(student) {
    const categories = Array.isArray(student?.song_eligibility?.allowed_categories)
        ? student.song_eligibility.allowed_categories
        : [];
    const normalized = categories
        .map(item => normalizeCategory(item?.value || item?.label))
        .filter(Boolean);
    if (normalized.length) return normalized;
    const instrument = normalizeCategory(student?.instrument_name);
    return instrument ? [instrument] : [];
}

function songIsAllowedForStudent(student, song) {
    const allowed = getAllowedCategoriesForStudent(student);
    if (!allowed.length) return true;
    return allowed.includes(normalizeCategory(song?.category));
}

function getPreferredCategoryForStudent(student) {
    const allowed = getAllowedCategoriesForStudent(student);
    if (allowed.length) return allowed[0];
    const categories = getAvailableCategories();
    return categories[0]?.value || '';
}

function getAvailableCategories() {
    if (Array.isArray(instructorSongCategories) && instructorSongCategories.length) {
        return instructorSongCategories.map(category => ({
            value: normalizeCategory(category.value || category.label),
            label: category.label || category.value || 'Category'
        })).filter(category => category.value);
    }

    const fromLibrary = [];
    const seen = new Set();
    instructorSongLibrary.forEach(song => {
        const value = normalizeCategory(song.category);
        if (!value || seen.has(value)) return;
        seen.add(value);
        fromLibrary.push({
            value,
            label: String(song.category || value).replace(/\b\w/g, char => char.toUpperCase())
        });
    });
    return fromLibrary;
}

function syncSelectionState() {
    if (!instructorSongStudents.length) {
        instructorSongSelectedStudentId = 0;
    } else if (!getStudentById(instructorSongSelectedStudentId)) {
        const currentStudentId = getCurrentSessionStudentId();
        instructorSongSelectedStudentId = currentStudentId || Number(instructorSongStudents[0]?.student_id || 0) || 0;
    }

    const selectedStudent = getStudentById(instructorSongSelectedStudentId);
    const preferredCategory = selectedStudent ? getPreferredCategoryForStudent(selectedStudent) : '';
    const availableCategories = getAvailableCategories();
    const categoryExists = availableCategories.some(category => category.value === normalizeCategory(instructorSongSelectedCategory));
    if (!instructorSongSelectedCategory || !categoryExists) {
        instructorSongSelectedCategory = preferredCategory || availableCategories[0]?.value || '';
    }

    const selectedSong = getSongById(instructorSongSelectedSongId);
    if (selectedSong && selectedStudent && !songIsAllowedForStudent(selectedStudent, selectedSong)) {
        instructorSongSelectedSongId = 0;
    }
}

function updateQuickAssignControls() {
    const studentInput = document.getElementById('quickAssignStudentId');
    const songInput = document.getElementById('quickAssignSongId');
    const progressInput = document.getElementById('quickAssignProgressStatus');
    const button = document.getElementById('quickAssignSubmit');

    if (studentInput) studentInput.value = String(instructorSongSelectedStudentId || '');
    if (songInput) songInput.value = String(instructorSongSelectedSongId || '');
    if (progressInput) progressInput.value = 'assigned';

    const selectedStudent = getStudentById(instructorSongSelectedStudentId);
    const selectedSong = getSongById(instructorSongSelectedSongId);
    const canSend = !!selectedStudent && !!selectedSong && songIsAllowedForStudent(selectedStudent, selectedSong);

    if (button) {
        button.disabled = !canSend;
    }

    if (!selectedStudent && !selectedSong) {
        setQuickAssignHint('Choose a student and a song to unlock sending.', 'muted');
    } else if (!selectedStudent) {
        setQuickAssignHint('Choose a student to continue.', 'muted');
    } else if (!selectedSong) {
        setQuickAssignHint('Choose a song from the library to continue.', 'muted');
    } else if (!songIsAllowedForStudent(selectedStudent, selectedSong)) {
        setQuickAssignHint('That song category is not available for this student.', 'error');
    } else {
        setQuickAssignHint('Ready to send this practice song.', 'success');
    }
}

function setPracticeBy(value) {
    instructorSongSelectedPracticeBy = value;
    document.querySelectorAll('.practice-pill').forEach(button => {
        const active = button.getAttribute('data-practice-by') === value;
        button.classList.toggle('border-gold-400', active);
        button.classList.toggle('bg-[#fff6de]', active);
        button.classList.toggle('text-[#a86100]', active);
        button.classList.toggle('border-slate-200', !active);
        button.classList.toggle('bg-white', !active);
        button.classList.toggle('text-slate-600', !active);
        button.classList.toggle('font-bold', active);
        button.classList.toggle('font-semibold', !active);
    });
}

function renderHeroSession() {
    const session = getCurrentSessionRecord();
    const student = session ? getStudentById(session.student_id) : null;
    const summaryEl = document.getElementById('heroSessionSummary');
    const metaEl = document.getElementById('heroSessionMeta');

    if (!summaryEl || !metaEl) return;

    if (!session) {
        summaryEl.textContent = 'No student in session right now';
        metaEl.textContent = 'Once a lesson begins, the active student will appear here.';
        return;
    }

    summaryEl.textContent = `${student?.student_name || session.student_first_name || 'Student'} · ${session.instrument_name || student?.instrument_name || 'Instrument'}`;

    if (isActiveSession(session)) {
        const end = getSessionEndDateTime(session);
        const minutesLeft = end ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / 60000)) : null;
        const room = session.room_name || student?.branch_name || 'Studio';
        metaEl.textContent = `${minutesLeft !== null ? `In session ${minutesLeft} min` : 'In session now'} • ${room}`;
    } else {
        const start = getSessionDateTime(session);
        const minutesUntil = start ? Math.max(0, Math.ceil((start.getTime() - Date.now()) / 60000)) : null;
        metaEl.textContent = `${minutesUntil !== null ? `Starts in ${minutesUntil} min` : 'Next session'} • ${session.room_name || student?.branch_name || 'Studio'}`;
    }
}

function renderSelectedStudentCard() {
    const student = getStudentById(instructorSongSelectedStudentId);
    const session = getCurrentSessionRecord();
    const selectedStudentIsCurrent = !!student && Number(student.student_id || 0) === Number(session?.student_id || 0) && isActiveSession(session);

    const avatarEl = document.getElementById('selectedStudentAvatar');
    const nameEl = document.getElementById('selectedStudentName');
    const metaEl = document.getElementById('selectedStudentMeta');
    const statusEl = document.getElementById('selectedStudentStatus');
    const timeEl = document.getElementById('selectedStudentTime');
    const locationEl = document.getElementById('selectedStudentLocation');

    if (!student) {
        if (avatarEl) avatarEl.textContent = '--';
        if (nameEl) nameEl.textContent = 'No student selected';
        if (metaEl) metaEl.textContent = 'Choose a student to start assigning songs.';
        if (statusEl) statusEl.textContent = 'Waiting for selection';
        if (timeEl) timeEl.textContent = '—';
        if (locationEl) locationEl.textContent = '—';
        return;
    }

    if (avatarEl) avatarEl.textContent = getStudentInitials(student);
    if (nameEl) nameEl.textContent = student.student_name || 'Student';
    if (metaEl) {
        metaEl.textContent = `${student.instrument_name || 'Instrument'} · ${student.package_name || student.branch_name || 'Student'}`;
    }
    if (statusEl) {
        if (selectedStudentIsCurrent) {
            statusEl.textContent = 'Currently in session';
            statusEl.className = 'mt-1 text-sm font-semibold text-emerald-700';
        } else {
            statusEl.textContent = 'Selected from roster';
            statusEl.className = 'mt-1 text-sm font-semibold text-amber-700';
        }
    }
    if (timeEl) {
        if (selectedStudentIsCurrent && session) {
            const end = getSessionEndDateTime(session);
            const minutesLeft = end ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / 60000)) : null;
            timeEl.textContent = minutesLeft !== null ? `In session ${minutesLeft} min` : 'In session now';
        } else if (session && Number(session.student_id || 0) === Number(student.student_id || 0)) {
            const start = getSessionDateTime(session);
            const minutesUntil = start ? Math.max(0, Math.ceil((start.getTime() - Date.now()) / 60000)) : null;
            timeEl.textContent = minutesUntil !== null ? `Starts in ${minutesUntil} min` : 'Ready for practice';
        } else {
            timeEl.textContent = 'Ready for practice';
        }
    }
    if (locationEl) {
        locationEl.textContent = session && Number(session.student_id || 0) === Number(student.student_id || 0)
            ? (session.room_name || student.branch_name || 'Studio')
            : (student.branch_name || student.package_name || '—');
    }
}

function renderStudentSwitcherContent() {
    const mount = document.getElementById('studentSwitcherContent');
    if (!mount) return;

    if (!instructorSongStudents.length) {
        mount.innerHTML = '<div class="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">No students found for this instructor.</div>';
        return;
    }

    const currentSession = getCurrentSessionRecord();
    const currentStudentId = Number(currentSession?.student_id || 0);
    const currentStudent = getStudentById(currentStudentId);
    const otherStudents = instructorSongStudents.filter(student => Number(student.student_id || 0) !== currentStudentId);

    const currentCard = currentStudent ? `
        <button type="button" data-student-select="${Number(currentStudent.student_id || 0)}" class="w-full rounded-[1.75rem] border-2 border-[#f0a000] bg-[#fff7e6] p-5 text-left transition hover:-translate-y-0.5">
            <div class="flex items-center gap-4">
                <div class="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#d28a00] text-xl font-black text-white">${escapeSongHtml(getStudentInitials(currentStudent))}</div>
                <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                        <div class="truncate text-xl font-black text-slate-900">${escapeSongHtml(currentStudent.student_name || 'Student')}</div>
                        <span class="rounded-full bg-[#f8a500] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">Current session</span>
                    </div>
                    <div class="mt-1 text-sm text-slate-600">${escapeSongHtml(currentStudent.instrument_name || 'Instrument')} · ${escapeSongHtml(currentStudent.package_name || currentStudent.branch_name || 'Student')}</div>
                </div>
                <div class="grid h-10 w-10 place-items-center rounded-full bg-[#f8a500] text-white">
                    <i class="fas fa-check"></i>
                </div>
            </div>
            <div class="mt-4 grid gap-3 sm:grid-cols-3">
                <div class="rounded-2xl bg-white/70 px-4 py-3 text-sm text-slate-700">
                    <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</div>
                    <div class="mt-1 font-semibold text-emerald-700">Currently in session</div>
                </div>
                <div class="rounded-2xl bg-white/70 px-4 py-3 text-sm text-slate-700">
                    <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Time</div>
                    <div class="mt-1 font-semibold text-amber-700">${escapeSongHtml(renderSessionTimeLabel(currentSession))}</div>
                </div>
                <div class="rounded-2xl bg-white/70 px-4 py-3 text-sm text-slate-700">
                    <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Location</div>
                    <div class="mt-1 font-semibold text-slate-700">${escapeSongHtml(currentSession?.room_name || currentStudent.branch_name || 'Studio')}</div>
                </div>
            </div>
        </button>
    ` : '';

    const otherCards = otherStudents.length ? `
        <div class="pt-2">
            <div class="mb-3 text-sm font-black uppercase tracking-[0.22em] text-slate-500">Your other students</div>
            <div class="space-y-3">
                ${otherStudents.map(student => `
                    <button type="button" data-student-select="${Number(student.student_id || 0)}" class="w-full rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-gold-300 hover:bg-[#fffaf0]">
                        <div class="flex items-center gap-4">
                            <div class="grid h-12 w-12 shrink-0 place-items-center rounded-full text-base font-black text-white ${avatarTintForStudent(student.student_id)}">${escapeSongHtml(getStudentInitials(student))}</div>
                            <div class="min-w-0 flex-1">
                                <div class="truncate text-base font-black text-slate-900">${escapeSongHtml(student.student_name || 'Student')}</div>
                                <div class="mt-0.5 text-sm text-slate-600">${escapeSongHtml(student.instrument_name || 'Instrument')} · ${escapeSongHtml(student.package_name || student.branch_name || 'Student')}</div>
                            </div>
                            <i class="fas fa-chevron-right text-slate-300"></i>
                        </div>
                    </button>
                `).join('')}
            </div>
        </div>
    ` : '<div class="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">No other students found.</div>';

    mount.innerHTML = `${currentCard}${otherCards}`;
}

function renderSessionTimeLabel(session) {
    if (!session) return '—';
    if (isActiveSession(session)) {
        const end = getSessionEndDateTime(session);
        const minutesLeft = end ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / 60000)) : null;
        return minutesLeft !== null ? `In session ${minutesLeft} min` : 'In session now';
    }
    const start = getSessionDateTime(session);
    if (start) {
        const minutesUntil = Math.max(0, Math.ceil((start.getTime() - Date.now()) / 60000));
        return `Starts in ${minutesUntil} min`;
    }
    return 'Ready for practice';
}

function avatarTintForStudent(studentId) {
    const palette = [
        'bg-emerald-700',
        'bg-sky-700',
        'bg-violet-700',
        'bg-rose-700',
        'bg-amber-700'
    ];
    const index = Math.abs(Number(studentId || 0)) % palette.length;
    return palette[index];
}

function renderSongCategoryOptions() {
    const categorySelect = document.getElementById('songCategorySelect');
    const categories = getAvailableCategories();
    if (categorySelect) {
        const options = categories.map(category => `<option value="${escapeSongHtml(category.value)}">${escapeSongHtml(category.label)}</option>`).join('');
        categorySelect.innerHTML = '<option value="">Select instrument...</option>' + options;
        if (instructorSongSelectedCategory) {
            categorySelect.value = instructorSongSelectedCategory;
        }
    }
}

function renderSongCategoryTabs() {
    const mount = document.getElementById('songCategoryTabs');
    const subtitle = document.getElementById('songLibrarySubtitle');
    const categories = getAvailableCategories();
    const selectedStudent = getStudentById(instructorSongSelectedStudentId);
    const selectedLabel = selectedCategoryLabel();

    if (subtitle) {
        subtitle.textContent = selectedLabel
            ? `Your ${selectedLabel} library is ready for this lesson.`
            : 'Your library is ready for this lesson.';
    }

    if (!mount) return;

    const tabs = categories.length ? categories : [{ value: '', label: 'All' }];
    mount.innerHTML = `
        <button type="button" data-song-category-filter="" class="song-category-tab rounded-full border px-4 py-2 text-sm font-semibold transition ${!instructorSongSelectedCategory ? 'border-[#0f172a] bg-[#0f172a] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-gold-300'}">
            All
        </button>
        ${tabs.map(category => {
            const active = normalizeCategory(instructorSongSelectedCategory) === category.value;
            return `
                <button type="button" data-song-category-filter="${escapeSongHtml(category.value)}" class="song-category-tab rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? 'border-[#0f172a] bg-[#0f172a] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-gold-300'}">
                    ${escapeSongHtml(category.label)}
                </button>
            `;
        }).join('')}
    `;

    if (selectedStudent) {
        const preferred = getPreferredCategoryForStudent(selectedStudent);
        if (!instructorSongSelectedCategory && preferred) {
            instructorSongSelectedCategory = preferred;
        }
    }
}

function selectedCategoryLabel() {
    const categories = getAvailableCategories();
    const selected = categories.find(category => category.value === normalizeCategory(instructorSongSelectedCategory));
    return selected?.label || '';
}

function renderSelectedSongPreview() {
    const mount = document.getElementById('assignmentSelectedSong');
    if (!mount) return;
    const song = getSongById(instructorSongSelectedSongId);
    const student = getStudentById(instructorSongSelectedStudentId);

    if (!song) {
        mount.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="grid h-14 w-14 place-items-center rounded-2xl bg-white text-slate-400 border border-slate-200">
                    <i class="fas fa-music"></i>
                </div>
                <div class="min-w-0">
                    <div class="text-base font-semibold text-slate-500">Choose a song from the library to begin.</div>
                    <div class="mt-1 text-sm text-slate-400">Your selected song will appear here with notes and practice timing.</div>
                </div>
            </div>
        `;
        return;
    }

    const allowed = !student || songIsAllowedForStudent(student, song);
    mount.innerHTML = `
        <div class="flex items-start gap-4">
            <div class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${allowed ? 'bg-[#0f172a] text-white' : 'bg-amber-100 text-amber-700'}">
                <i class="fas fa-music"></i>
            </div>
            <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                    <h3 class="truncate text-xl font-black text-slate-900">${escapeSongHtml(song.title || 'Untitled')}</h3>
                    <span class="rounded-full ${allowed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'} px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]">${allowed ? 'Ready to assign' : 'Not allowed'}</span>
                </div>
                <p class="mt-1 text-sm text-slate-600">${escapeSongHtml(song.artist || 'Unknown Artist')} · ${escapeSongHtml(song.category || 'Category')}</p>
                <p class="mt-2 text-sm text-slate-500">${escapeSongHtml(song.notes || 'No teaching notes saved for this song yet.')}</p>
            </div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
            ${song.youtube_link ? `<a href="${escapeSongHtml(song.youtube_link)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700"><i class="fab fa-youtube mr-2"></i>YouTube</a>` : ''}
            ${song.spotify_link ? `<a href="${escapeSongHtml(song.spotify_link)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><i class="fab fa-spotify mr-2"></i>Spotify</a>` : ''}
            ${song.sheet_music_path ? `<a href="${escapeSongHtml(songAssetUrl(song.sheet_music_path))}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center rounded-xl bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700"><i class="fas fa-file-pdf mr-2"></i>Sheet PDF</a>` : ''}
            ${song.accompaniment_audio_path ? `<a href="${escapeSongHtml(songAssetUrl(song.accompaniment_audio_path))}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center rounded-xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700"><i class="fas fa-headphones mr-2"></i>Audio</a>` : ''}
        </div>
    `;
}

function renderSongLibrary() {
    const grid = document.getElementById('songLibraryGrid');
    if (!grid) return;

    const search = String(document.getElementById('songSearchInput')?.value || '').trim().toLowerCase();
    const category = normalizeCategory(instructorSongSelectedCategory);
    const selectedStudent = getStudentById(instructorSongSelectedStudentId);

    let rows = instructorSongLibrary.filter(song => {
        if (category && normalizeCategory(song.category) !== category) return false;
        if (!search) return true;
        const haystack = [song.title, song.artist, song.genre, song.tags, song.notes].join(' ').toLowerCase();
        return haystack.includes(search);
    });

    if (!rows.length) {
        grid.innerHTML = '<div class="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">No songs match the current filters.</div>';
        return;
    }

    grid.innerHTML = rows.map(song => {
        const selected = Number(song.song_id || 0) === Number(instructorSongSelectedSongId || 0);
        const allowed = !selectedStudent || songIsAllowedForStudent(selectedStudent, song);
        return `
            <button type="button" data-song-select="${Number(song.song_id || 0)}" class="w-full rounded-[1.4rem] border px-4 py-4 text-left transition ${selected ? 'border-[#d9a81f] bg-[#fff8e8]' : 'border-slate-200 bg-white hover:border-gold-300 hover:bg-[#fffaf0]'} ${allowed ? '' : 'opacity-70'}">
                <div class="flex items-start justify-between gap-4">
                    <div class="flex min-w-0 items-start gap-4">
                        <div class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${selected ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-500'}">
                            <i class="fas fa-music"></i>
                        </div>
                        <div class="min-w-0">
                            <div class="truncate text-lg font-black text-slate-900">${escapeSongHtml(song.title || 'Untitled')}</div>
                            <div class="mt-0.5 text-sm text-slate-600">${escapeSongHtml(song.artist || 'Unknown Artist')} · ${escapeSongHtml(song.difficulty_level || 'No level')}</div>
                            <div class="mt-2 flex flex-wrap gap-2">
                                <span class="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">${escapeSongHtml(song.category || 'Category')}</span>
                                ${song.genre ? `<span class="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">${escapeSongHtml(song.genre)}</span>` : ''}
                                ${allowed ? '<span class="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Allowed</span>' : '<span class="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">Not for selected student</span>'}
                            </div>
                        </div>
                    </div>
                    <div class="flex shrink-0 items-center gap-2 text-slate-400">
                        ${song.sheet_music_path ? '<i class="fas fa-file-pdf"></i>' : ''}
                        ${song.youtube_link ? '<i class="fab fa-youtube"></i>' : ''}
                        ${song.accompaniment_audio_path ? '<i class="fas fa-headphones"></i>' : ''}
                    </div>
                </div>
            </button>
        `;
    }).join('');
}

function renderAssignments() {
    const list = document.getElementById('assignmentList');
    if (!list) return;

    if (!instructorSongAssignments.length) {
        list.innerHTML = '<div class="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">No song assignments yet. Pick a student and a song to start.</div>';
        updateSongStats();
        return;
    }

    list.innerHTML = instructorSongAssignments.map(item => `
        <article class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                        <h3 class="text-lg font-black text-slate-900">${escapeSongHtml(item.title || 'Untitled')}</h3>
                        <span class="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${progressBadgeClass(item.progress_status)}">${escapeSongHtml(item.progress_status || 'assigned')}</span>
                    </div>
                    <div class="mt-1 text-sm text-slate-500">${escapeSongHtml(item.artist || 'Unknown Artist')} • ${escapeSongHtml(item.student_name || 'Student')}</div>
                    <div class="mt-1 text-xs text-slate-400">Assigned ${formatSongDate(item.assigned_at)}</div>
                </div>
                <div class="text-sm text-slate-500">${escapeSongHtml(item.category || 'Category')} • ${escapeSongHtml(item.difficulty_level || 'No difficulty set')}</div>
            </div>

            <div class="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <div class="space-y-4">
                    <div class="rounded-2xl border border-slate-200 bg-white p-4">
                        <div class="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Assignment Notes</div>
                        <textarea data-assignment-notes="${Number(item.assignment_id || 0)}" rows="4" class="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">${escapeSongHtml(item.assigned_notes || '')}</textarea>
                        <div class="mt-3 flex flex-col gap-3 sm:flex-row">
                            <select data-assignment-progress="${Number(item.assignment_id || 0)}" class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                                <option value="assigned" ${String(item.progress_status) === 'assigned' ? 'selected' : ''}>Assigned</option>
                                <option value="practicing" ${String(item.progress_status) === 'practicing' ? 'selected' : ''}>Practicing</option>
                                <option value="polishing" ${String(item.progress_status) === 'polishing' ? 'selected' : ''}>Polishing</option>
                                <option value="completed" ${String(item.progress_status) === 'completed' ? 'selected' : ''}>Completed</option>
                            </select>
                            <button type="button" data-save-assignment="${Number(item.assignment_id || 0)}" class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700">Save Progress</button>
                        </div>
                    </div>
                    <div class="rounded-2xl border border-slate-200 bg-white p-4">
                        <div class="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Reference Links</div>
                        <div class="mt-3 flex flex-wrap gap-2">
                            ${item.youtube_link ? `<a href="${escapeSongHtml(item.youtube_link)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700"><i class="fab fa-youtube mr-2"></i>YouTube</a>` : ''}
                            ${item.spotify_link ? `<a href="${escapeSongHtml(item.spotify_link)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><i class="fab fa-spotify mr-2"></i>Spotify</a>` : ''}
                            ${item.sheet_music_path ? `<a href="${escapeSongHtml(songAssetUrl(item.sheet_music_path))}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center rounded-xl bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700"><i class="fas fa-file-pdf mr-2"></i>Sheet PDF</a>` : ''}
                            ${item.accompaniment_audio_path ? `<a href="${escapeSongHtml(songAssetUrl(item.accompaniment_audio_path))}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center rounded-xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700"><i class="fas fa-headphones mr-2"></i>Audio</a>` : ''}
                        </div>
                    </div>
                </div>
                <div class="rounded-2xl border border-slate-200 bg-white p-4">
                    <div class="flex items-center justify-between gap-3">
                        <div class="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Lesson History</div>
                        <div class="text-xs text-slate-400">${(item.history || []).length} entr${(item.history || []).length === 1 ? 'y' : 'ies'}</div>
                    </div>
                    <div class="mt-3 grid gap-3 md:grid-cols-2">
                        <input type="date" data-history-date="${Number(item.assignment_id || 0)}" class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" value="${new Date().toISOString().slice(0, 10)}">
                        <select data-history-progress="${Number(item.assignment_id || 0)}" class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                            <option value="assigned">Assigned</option>
                            <option value="practicing">Practicing</option>
                            <option value="polishing">Polishing</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                    <textarea data-history-notes="${Number(item.assignment_id || 0)}" rows="3" class="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" placeholder="What happened in today’s lesson? Which section improved, and what needs work next?"></textarea>
                    <button type="button" data-save-history="${Number(item.assignment_id || 0)}" class="mt-3 rounded-2xl bg-gold-500 px-4 py-3 text-sm font-black text-black transition hover:bg-gold-400">Add Lesson History</button>
                    <div class="mt-4 space-y-3">
                        ${(item.history || []).length ? item.history.map(history => `
                            <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <div class="flex flex-wrap items-center justify-between gap-2">
                                    <div class="text-sm font-bold text-slate-900">${formatSongDate(history.lesson_date)}</div>
                                    <span class="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${progressBadgeClass(history.progress_status)}">${escapeSongHtml(history.progress_status || 'assigned')}</span>
                                </div>
                                <div class="mt-2 text-sm text-slate-600">${escapeSongHtml(history.lesson_notes || 'No lesson note recorded.')}</div>
                            </div>
                        `).join('') : '<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">No lesson history yet for this song.</div>'}
                    </div>
                </div>
            </div>
        </article>
    `).join('');

    updateSongStats();
}

function renderInstructorSongView() {
    syncSelectionState();
    renderHeroSession();
    renderSelectedStudentCard();
    renderStudentSwitcherContent();
    renderSongCategoryOptions();
    renderSongCategoryTabs();
    renderSelectedSongPreview();
    updateQuickAssignControls();
    renderSongLibrary();
    renderAssignments();
}

function updateSongStats() {
    const counts = instructorSongAssignments.reduce((acc, item) => {
        const key = String(item.progress_status || 'assigned').toLowerCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
    };

    setText('assignmentCountLabel', `${instructorSongAssignments.length} assignment${instructorSongAssignments.length === 1 ? '' : 's'}`);
}

async function loadSongLibrary() {
    try {
        const response = await axios.get(`${baseApiUrl}/songs.php?action=get-songs&user_id=${encodeURIComponent(currentInstructorUser.user_id)}`);
        instructorSongLibrary = response.data?.success && Array.isArray(response.data.songs) ? response.data.songs : [];
    } catch (error) {
        console.error('Failed to load song library:', error);
        instructorSongLibrary = [];
    }
}

async function loadSongCategories() {
    try {
        const response = await axios.get(`${baseApiUrl}/songs.php?action=get-song-categories`);
        instructorSongCategories = response.data?.success && Array.isArray(response.data.categories) ? response.data.categories : [];
    } catch (error) {
        console.error('Failed to load song categories:', error);
        instructorSongCategories = [];
    }
}

async function loadInstructorSongStudents() {
    try {
        const response = await axios.get(`${baseApiUrl}/songs.php?action=get-teacher-students&user_id=${encodeURIComponent(currentInstructorUser.user_id)}`);
        instructorSongStudents = response.data?.success && Array.isArray(response.data.students) ? response.data.students : [];
    } catch (error) {
        console.error('Failed to load instructor students:', error);
        instructorSongStudents = [];
    }
}

async function loadTeacherSessions() {
    try {
        const response = await axios.get(`${baseApiUrl}/teachers.php?action=get-teacher-sessions&user_id=${encodeURIComponent(currentInstructorUser.user_id)}&filter=all`);
        instructorSongSessions = response.data?.success && Array.isArray(response.data.sessions) ? response.data.sessions : [];
    } catch (error) {
        console.error('Failed to load teacher sessions:', error);
        instructorSongSessions = [];
    }
}

async function loadAssignments() {
    try {
        const response = await axios.get(`${baseApiUrl}/songs.php?action=get-teacher-assignments&user_id=${encodeURIComponent(currentInstructorUser.user_id)}`);
        instructorSongAssignments = response.data?.success && Array.isArray(response.data.assignments) ? response.data.assignments : [];
    } catch (error) {
        console.error('Failed to load assignments:', error);
        instructorSongAssignments = [];
    }
}

function applyStudentSelection(studentId) {
    instructorSongSelectedStudentId = Number(studentId || 0);
    const student = getStudentById(instructorSongSelectedStudentId);
    if (student) {
        const preferred = getPreferredCategoryForStudent(student);
        if (preferred) {
            instructorSongSelectedCategory = preferred;
        }
    }

    const selectedSong = getSongById(instructorSongSelectedSongId);
    if (selectedSong && student && !songIsAllowedForStudent(student, selectedSong)) {
        instructorSongSelectedSongId = 0;
    }
    renderInstructorSongView();
}

function applySongSelection(songId) {
    instructorSongSelectedSongId = Number(songId || 0);
    const song = getSongById(instructorSongSelectedSongId);
    if (song && normalizeCategory(song.category)) {
        instructorSongSelectedCategory = normalizeCategory(song.category);
    }
    renderInstructorSongView();
}

function applyCategorySelection(categoryValue) {
    instructorSongSelectedCategory = normalizeCategory(categoryValue);
    const selectedSong = getSongById(instructorSongSelectedSongId);
    if (selectedSong && instructorSongSelectedCategory && normalizeCategory(selectedSong.category) !== instructorSongSelectedCategory) {
        instructorSongSelectedSongId = 0;
    }
    renderInstructorSongView();
}

async function submitSongForm(event) {
    event.preventDefault();
    hideSongMessage('songFormMessage');

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.append('user_id', String(currentInstructorUser.user_id || ''));

    try {
        const response = await axios.post(`${baseApiUrl}/songs.php`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (!response.data?.success) {
            showSongMessage('songFormMessage', response.data?.error || 'Failed to save song.', 'error');
            return;
        }
        form.reset();
        showSongMessage('songFormMessage', 'Song added to the library.', 'success');
        setSongModalVisibility('createSongModal', false);
        await loadSongLibrary();
        renderInstructorSongView();
    } catch (error) {
        showSongMessage('songFormMessage', error.response?.data?.error || 'Failed to save song.', 'error');
    }
}

async function submitQuickAssignment(event) {
    event.preventDefault();
    const selectedStudent = getStudentById(instructorSongSelectedStudentId);
    const selectedSong = getSongById(instructorSongSelectedSongId);

    if (!selectedStudent || !selectedSong) {
        setQuickAssignHint('Choose a student and a song first.', 'error');
        return;
    }
    if (!songIsAllowedForStudent(selectedStudent, selectedSong)) {
        setQuickAssignHint('That song category is not available for this student.', 'error');
        return;
    }

    const payload = {
        action: 'assign-song',
        user_id: Number(currentInstructorUser.user_id || 0),
        student_id: Number(selectedStudent.student_id || 0),
        song_id: Number(selectedSong.song_id || 0),
        progress_status: 'assigned',
        assigned_notes: document.getElementById('quickAssignNotes')?.value || ''
    };

    try {
        const response = await axios.post(`${baseApiUrl}/songs.php`, payload);
        if (!response.data?.success) {
            setQuickAssignHint(response.data?.error || 'Failed to assign song.', 'error');
            return;
        }
        const notesEl = document.getElementById('quickAssignNotes');
        if (notesEl) notesEl.value = '';
        setQuickAssignHint('Song assigned successfully.', 'success');
        await loadAssignments();
        renderInstructorSongView();
    } catch (error) {
        setQuickAssignHint(error.response?.data?.error || 'Failed to assign song.', 'error');
    }
}

async function saveAssignmentProgress(assignmentId) {
    const progressEl = document.querySelector(`[data-assignment-progress="${assignmentId}"]`);
    const notesEl = document.querySelector(`[data-assignment-notes="${assignmentId}"]`);
    if (!progressEl || !notesEl) return;

    await axios.post(`${baseApiUrl}/songs.php`, {
        action: 'update-assignment-progress',
        user_id: Number(currentInstructorUser.user_id || 0),
        assignment_id: Number(assignmentId),
        progress_status: progressEl.value,
        assigned_notes: notesEl.value
    });
    await loadAssignments();
    renderInstructorSongView();
}

async function saveAssignmentHistory(assignmentId) {
    const dateEl = document.querySelector(`[data-history-date="${assignmentId}"]`);
    const progressEl = document.querySelector(`[data-history-progress="${assignmentId}"]`);
    const notesEl = document.querySelector(`[data-history-notes="${assignmentId}"]`);
    if (!dateEl || !progressEl || !notesEl) return;

    await axios.post(`${baseApiUrl}/songs.php`, {
        action: 'add-lesson-history',
        user_id: Number(currentInstructorUser.user_id || 0),
        assignment_id: Number(assignmentId),
        lesson_date: dateEl.value,
        progress_status: progressEl.value,
        lesson_notes: notesEl.value
    });
    await loadAssignments();
    renderInstructorSongView();
}

function attachSongEvents() {
    document.getElementById('songCreateForm')?.addEventListener('submit', submitSongForm);
    document.getElementById('songQuickAssignForm')?.addEventListener('submit', submitQuickAssignment);
    document.getElementById('songSearchInput')?.addEventListener('input', () => renderSongLibrary());

    document.getElementById('songCategoryTabs')?.addEventListener('click', event => {
        const button = event.target.closest('[data-song-category-filter]');
        if (!button) return;
        applyCategorySelection(button.getAttribute('data-song-category-filter') || '');
    });

    document.getElementById('songLibraryGrid')?.addEventListener('click', event => {
        const button = event.target.closest('[data-song-select]');
        if (!button) return;
        applySongSelection(button.getAttribute('data-song-select') || '');
    });

    document.getElementById('studentSwitcherContent')?.addEventListener('click', event => {
        const button = event.target.closest('[data-student-select]');
        if (!button) return;
        applyStudentSelection(button.getAttribute('data-student-select') || '');
        setSongModalVisibility('studentSwitcherModal', false);
    });

    document.addEventListener('click', async event => {
        const practiceButton = event.target.closest('[data-practice-by]');
        if (practiceButton) {
            setPracticeBy(practiceButton.getAttribute('data-practice-by') || 'next_lesson');
            return;
        }

        const saveAssignmentBtn = event.target.closest('[data-save-assignment]');
        if (saveAssignmentBtn) {
            try {
                await saveAssignmentProgress(Number(saveAssignmentBtn.getAttribute('data-save-assignment') || 0));
            } catch (error) {
                alert(error.response?.data?.error || 'Failed to update song progress.');
            }
            return;
        }

        const saveHistoryBtn = event.target.closest('[data-save-history]');
        if (saveHistoryBtn) {
            try {
                await saveAssignmentHistory(Number(saveHistoryBtn.getAttribute('data-save-history') || 0));
            } catch (error) {
                alert(error.response?.data?.error || 'Failed to save lesson history.');
            }
            return;
        }
    });

}

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof checkInstructorAuth === 'function' && !checkInstructorAuth()) {
        return;
    }

    currentInstructorUser = (typeof Auth !== 'undefined' && Auth.getUser) ? (Auth.getUser() || null) : null;
    if (!currentInstructorUser?.user_id) {
        return;
    }

    const displayName = currentInstructorUser.username || currentInstructorUser.email || 'Instructor';
    const nameEl = document.getElementById('instructorNameNav');
    if (nameEl) nameEl.textContent = displayName;

    attachSongEvents();
    attachSongModals();
    setPracticeBy(instructorSongSelectedPracticeBy);

    try {
        await Promise.all([
            loadSongCategories(),
            loadSongLibrary(),
            loadInstructorSongStudents(),
            loadTeacherSessions(),
            loadAssignments()
        ]);
        syncSelectionState();
        renderInstructorSongView();
    } catch (error) {
        console.error('Failed to load song module:', error);
        showSongMessage('songFormMessage', 'Failed to load song library data. Please refresh the page.', 'error');
    }
});
