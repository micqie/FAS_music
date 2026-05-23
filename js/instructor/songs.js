let instructorSongLibrary = [];
let instructorSongAssignments = [];
let instructorSongStudents = [];
let instructorSongCategories = [];
let currentInstructorUser = null;
let activeSongModalId = null;

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

function formatSongDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function songAssetUrl(path) {
    return path ? `../../${String(path).replace(/^\/+/, '')}` : '';
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

    setText('songCountStat', instructorSongLibrary.length);
    setText('assignedCountStat', counts.assigned || 0);
    setText('practicingCountStat', counts.practicing || 0);
    setText('completedCountStat', counts.completed || 0);
    setText('assignmentCountLabel', `${instructorSongAssignments.length} assignment${instructorSongAssignments.length === 1 ? '' : 's'}`);
}

function renderSongCategoryOptions() {
    const categorySelect = document.getElementById('songCategorySelect');
    const categoryFilter = document.getElementById('songCategoryFilter');
    const options = instructorSongCategories.map(category => `
        <option value="${escapeSongHtml(category.value || '')}">${escapeSongHtml(category.label || category.value || '')}</option>
    `).join('');

    if (categorySelect) {
        categorySelect.innerHTML = '<option value="">Select category...</option>' + options;
    }
    if (categoryFilter) {
        categoryFilter.innerHTML = '<option value="">All categories</option>' + options;
    }
}

function renderAssignmentSelects() {
    const studentSelect = document.getElementById('assignmentStudentSelect');
    const songSelect = document.getElementById('assignmentSongSelect');
    const assignmentHint = document.getElementById('assignmentCategoryHint');
    const selectedStudentId = Number(studentSelect?.value || 0);
    const selectedStudent = instructorSongStudents.find(student => Number(student.student_id || 0) === selectedStudentId) || null;
    const allowedCategoryValues = (selectedStudent?.song_eligibility?.allowed_categories || []).map(item => String(item.value || '').toLowerCase());

    if (studentSelect) {
        studentSelect.innerHTML = '<option value="">Select student...</option>' + instructorSongStudents.map(student => `
            <option value="${Number(student.student_id || 0)}">${escapeSongHtml(student.student_name || 'Student')} - ${escapeSongHtml(((student.song_eligibility?.allowed_categories || []).map(item => item.label || item.value).join(', ')) || student.instrument_name || 'Instrument')}</option>
        `).join('');
        if (selectedStudentId > 0) {
            studentSelect.value = String(selectedStudentId);
        }
    }
    if (songSelect) {
        const visibleSongs = selectedStudent && allowedCategoryValues.length
            ? instructorSongLibrary.filter(song => allowedCategoryValues.includes(String(song.category || '').toLowerCase()))
            : instructorSongLibrary;

        songSelect.innerHTML = '<option value="">Select song...</option>' + visibleSongs.map(song => `
            <option value="${Number(song.song_id || 0)}">${escapeSongHtml(song.title || 'Untitled')} ${song.artist ? `- ${escapeSongHtml(song.artist)}` : ''}</option>
        `).join('');
        songSelect.disabled = !!selectedStudent && !visibleSongs.length;
    }
    if (assignmentHint) {
        if (!selectedStudent) {
            assignmentHint.textContent = 'Pick a student first to see which song categories fit their package.';
        } else {
            const labels = (selectedStudent.song_eligibility?.allowed_categories || []).map(item => item.label || item.value).filter(Boolean);
            assignmentHint.textContent = labels.length
                ? `Allowed categories for this student: ${labels.join(', ')}`
                : 'This student has no valid song categories yet.';
        }
    }
}

function renderSongLibrary() {
    const grid = document.getElementById('songLibraryGrid');
    if (!grid) return;

    const search = String(document.getElementById('songSearchInput')?.value || '').trim().toLowerCase();
    const category = String(document.getElementById('songCategoryFilter')?.value || '').trim().toLowerCase();
    const rows = instructorSongLibrary.filter(song => {
        if (category && String(song.category || '').toLowerCase() !== category) return false;
        if (!search) return true;
        const haystack = [
            song.title,
            song.artist,
            song.genre,
            song.tags,
            song.notes
        ].join(' ').toLowerCase();
        return haystack.includes(search);
    });

    if (!rows.length) {
        grid.innerHTML = '<div class="lg:col-span-2 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">No songs match the current search.</div>';
        return;
    }

    grid.innerHTML = rows.map(song => `
        <article class="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                    <h3 class="truncate text-lg font-black text-slate-900">${escapeSongHtml(song.title || 'Untitled')}</h3>
                    <div class="mt-1 text-sm text-slate-500">${escapeSongHtml(song.artist || 'Unknown Artist')}</div>
                </div>
                <span class="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">${escapeSongHtml(song.category || 'voice')}</span>
            </div>
            <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div class="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <div class="text-xs text-slate-500">Genre</div>
                    <div class="mt-1 font-semibold text-slate-900">${escapeSongHtml(song.genre || '—')}</div>
                </div>
                <div class="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <div class="text-xs text-slate-500">Difficulty</div>
                    <div class="mt-1 font-semibold text-slate-900">${escapeSongHtml(song.difficulty_level || '—')}</div>
                </div>
                <div class="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <div class="text-xs text-slate-500">Vocal Range</div>
                    <div class="mt-1 font-semibold text-slate-900">${escapeSongHtml(song.vocal_range || '—')}</div>
                </div>
                <div class="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <div class="text-xs text-slate-500">Tags</div>
                    <div class="mt-1 font-semibold text-slate-900">${escapeSongHtml(song.tags || '—')}</div>
                </div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
                ${song.youtube_link ? `<a href="${escapeSongHtml(song.youtube_link)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700"><i class="fab fa-youtube mr-2"></i>YouTube</a>` : ''}
                ${song.spotify_link ? `<a href="${escapeSongHtml(song.spotify_link)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><i class="fab fa-spotify mr-2"></i>Spotify</a>` : ''}
                ${song.sheet_music_path ? `<a href="${escapeSongHtml(songAssetUrl(song.sheet_music_path))}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center rounded-xl bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700"><i class="fas fa-file-pdf mr-2"></i>Sheet PDF</a>` : ''}
                ${song.accompaniment_audio_path ? `<a href="${escapeSongHtml(songAssetUrl(song.accompaniment_audio_path))}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center rounded-xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700"><i class="fas fa-headphones mr-2"></i>Audio</a>` : ''}
            </div>
            <div class="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                ${escapeSongHtml(song.notes || 'No teaching notes saved for this song yet.')}
            </div>
        </article>
    `).join('');
}

function renderAssignments() {
    const list = document.getElementById('assignmentList');
    if (!list) return;

    if (!instructorSongAssignments.length) {
        list.innerHTML = '<div class="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">No song assignments yet. Assign one from the panel above to get started.</div>';
        updateSongStats();
        return;
    }

    list.innerHTML = instructorSongAssignments.map(item => `
        <article class="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                        <h3 class="text-lg font-black text-slate-900">${escapeSongHtml(item.title || 'Untitled')}</h3>
                        <span class="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${progressBadgeClass(item.progress_status)}">${escapeSongHtml(item.progress_status || 'assigned')}</span>
                    </div>
                    <div class="mt-1 text-sm text-slate-500">${escapeSongHtml(item.artist || 'Unknown Artist')} • ${escapeSongHtml(item.student_name || 'Student')}</div>
                    <div class="mt-1 text-xs text-slate-400">Assigned ${formatSongDate(item.assigned_at)}</div>
                </div>
                <div class="text-sm text-slate-500">${escapeSongHtml(item.category || 'voice')} • ${escapeSongHtml(item.difficulty_level || 'No difficulty set')}</div>
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

async function loadSongLibrary() {
    const response = await axios.get(`${baseApiUrl}/songs.php?action=get-songs&user_id=${encodeURIComponent(currentInstructorUser.user_id)}`);
    instructorSongLibrary = response.data?.success && Array.isArray(response.data.songs) ? response.data.songs : [];
    renderAssignmentSelects();
    renderSongLibrary();
    updateSongStats();
}

async function loadSongCategories() {
    const response = await axios.get(`${baseApiUrl}/songs.php?action=get-song-categories`);
    instructorSongCategories = response.data?.success && Array.isArray(response.data.categories) ? response.data.categories : [];
    renderSongCategoryOptions();
}

async function loadInstructorSongStudents() {
    const response = await axios.get(`${baseApiUrl}/songs.php?action=get-teacher-students&user_id=${encodeURIComponent(currentInstructorUser.user_id)}`);
    instructorSongStudents = response.data?.success && Array.isArray(response.data.students) ? response.data.students : [];
    renderAssignmentSelects();
}

async function loadAssignments() {
    const response = await axios.get(`${baseApiUrl}/songs.php?action=get-teacher-assignments&user_id=${encodeURIComponent(currentInstructorUser.user_id)}`);
    instructorSongAssignments = response.data?.success && Array.isArray(response.data.assignments) ? response.data.assignments : [];
    renderAssignments();
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
    } catch (error) {
        showSongMessage('songFormMessage', error.response?.data?.error || 'Failed to save song.', 'error');
    }
}

async function submitAssignmentForm(event) {
    event.preventDefault();
    hideSongMessage('assignFormMessage');
    const form = event.currentTarget;
    const payload = {
        action: 'assign-song',
        user_id: Number(currentInstructorUser.user_id || 0),
        student_id: Number(form.student_id.value || 0),
        song_id: Number(form.song_id.value || 0),
        progress_status: form.progress_status.value || 'assigned',
        assigned_notes: form.assigned_notes.value || ''
    };

    try {
        const response = await axios.post(`${baseApiUrl}/songs.php`, payload);
        if (!response.data?.success) {
            showSongMessage('assignFormMessage', response.data?.error || 'Failed to assign song.', 'error');
            return;
        }
        form.reset();
        showSongMessage('assignFormMessage', 'Song assigned successfully.', 'success');
        setSongModalVisibility('assignSongModal', false);
        renderAssignmentSelects();
        await loadAssignments();
    } catch (error) {
        showSongMessage('assignFormMessage', error.response?.data?.error || 'Failed to assign song.', 'error');
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
}

function attachSongEvents() {
    document.getElementById('songCreateForm')?.addEventListener('submit', submitSongForm);
    document.getElementById('songAssignForm')?.addEventListener('submit', submitAssignmentForm);
    document.getElementById('songSearchInput')?.addEventListener('input', renderSongLibrary);
    document.getElementById('songCategoryFilter')?.addEventListener('change', renderSongLibrary);
    document.getElementById('assignmentStudentSelect')?.addEventListener('change', renderAssignmentSelects);

    document.addEventListener('click', async event => {
        const saveAssignmentBtn = event.target.closest('[data-save-assignment]');
        if (saveAssignmentBtn) {
            try {
                await saveAssignmentProgress(Number(saveAssignmentBtn.getAttribute('data-save-assignment') || 0));
            } catch (error) {
                alert(error.response?.data?.error || 'Failed to update song progress.');
            }
        }

        const saveHistoryBtn = event.target.closest('[data-save-history]');
        if (saveHistoryBtn) {
            try {
                await saveAssignmentHistory(Number(saveHistoryBtn.getAttribute('data-save-history') || 0));
            } catch (error) {
                alert(error.response?.data?.error || 'Failed to save lesson history.');
            }
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

    try {
        await Promise.all([
            loadSongCategories(),
            loadSongLibrary(),
            loadInstructorSongStudents(),
            loadAssignments()
        ]);
    } catch (error) {
        console.error('Failed to load song module:', error);
        showSongMessage('songFormMessage', 'Failed to load song library data. Please refresh the page.', 'error');
    }
});
