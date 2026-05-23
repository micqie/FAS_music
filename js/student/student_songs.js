let studentAssignedSongs = [];

function escapeStudentSongHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatStudentSongDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function studentSongAssetUrl(path) {
    return path ? `../../${String(path).replace(/^\/+/, '')}` : '';
}

function studentProgressBadgeClass(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'completed') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200';
    if (normalized === 'polishing') return 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200';
    if (normalized === 'practicing') return 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200';
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200';
}

function updateStudentSongStats() {
    const counts = studentAssignedSongs.reduce((acc, item) => {
        const key = String(item.progress_status || 'assigned').toLowerCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
    };

    setText('studentSongCount', studentAssignedSongs.length);
    setText('studentAssignedCount', counts.assigned || 0);
    setText('studentPracticingCount', counts.practicing || 0);
    setText('studentCompletedCount', counts.completed || 0);
    setText('studentSongStatus', `${studentAssignedSongs.length} assigned song${studentAssignedSongs.length === 1 ? '' : 's'}`);
}

function renderStudentSongs() {
    const grid = document.getElementById('studentSongsGrid');
    if (!grid) return;

    if (!studentAssignedSongs.length) {
        grid.innerHTML = '<div class="rounded-3xl border border-dashed border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">No songs have been assigned to you yet.</div>';
        updateStudentSongStats();
        return;
    }

    grid.innerHTML = studentAssignedSongs.map(item => `
        <article class="rounded-3xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 p-5">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                        <h3 class="text-xl font-black text-zinc-900 dark:text-white">${escapeStudentSongHtml(item.title || 'Untitled')}</h3>
                        <span class="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${studentProgressBadgeClass(item.progress_status)}">${escapeStudentSongHtml(item.progress_status || 'assigned')}</span>
                    </div>
                    <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">${escapeStudentSongHtml(item.artist || 'Unknown Artist')} • ${escapeStudentSongHtml(item.category || 'voice')} • Teacher: ${escapeStudentSongHtml(item.teacher_name || 'Instructor')}</div>
                </div>
                <div class="text-sm text-zinc-500 dark:text-zinc-400">${escapeStudentSongHtml(item.difficulty_level || 'No difficulty set')}</div>
            </div>

            <div class="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <div class="space-y-4">
                    <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-4">
                        <div class="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Song Snapshot</div>
                        <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <div class="text-xs text-zinc-500 dark:text-zinc-400">Genre</div>
                                <div class="mt-1 font-semibold text-zinc-900 dark:text-white">${escapeStudentSongHtml(item.genre || '—')}</div>
                            </div>
                            <div>
                                <div class="text-xs text-zinc-500 dark:text-zinc-400">Vocal Range</div>
                                <div class="mt-1 font-semibold text-zinc-900 dark:text-white">${escapeStudentSongHtml(item.vocal_range || '—')}</div>
                            </div>
                            <div class="col-span-2">
                                <div class="text-xs text-zinc-500 dark:text-zinc-400">Tags</div>
                                <div class="mt-1 font-semibold text-zinc-900 dark:text-white">${escapeStudentSongHtml(item.tags || '—')}</div>
                            </div>
                        </div>
                    </div>
                    <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-4">
                        <div class="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">References</div>
                        <div class="mt-3 flex flex-wrap gap-2">
                            ${item.youtube_link ? `<a href="${escapeStudentSongHtml(item.youtube_link)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-500/15 dark:text-red-200"><i class="fab fa-youtube mr-2"></i>YouTube</a>` : ''}
                            ${item.spotify_link ? `<a href="${escapeStudentSongHtml(item.spotify_link)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"><i class="fab fa-spotify mr-2"></i>Spotify</a>` : ''}
                            ${item.sheet_music_path ? `<a href="${escapeStudentSongHtml(studentSongAssetUrl(item.sheet_music_path))}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center rounded-xl bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 dark:bg-sky-500/15 dark:text-sky-200"><i class="fas fa-file-pdf mr-2"></i>Sheet PDF</a>` : ''}
                            ${item.accompaniment_audio_path ? `<a href="${escapeStudentSongHtml(studentSongAssetUrl(item.accompaniment_audio_path))}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center rounded-xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-200"><i class="fas fa-headphones mr-2"></i>Audio</a>` : ''}
                        </div>
                    </div>
                    <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-4">
                        <div class="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Teacher Notes</div>
                        <div class="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200">${escapeStudentSongHtml(item.assigned_notes || item.song_notes || 'No notes added yet.')}</div>
                    </div>
                </div>
                <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-4">
                    <div class="flex items-center justify-between gap-3">
                        <div class="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Lesson History</div>
                        <div class="text-xs text-zinc-400 dark:text-zinc-500">${(item.history || []).length} entr${(item.history || []).length === 1 ? 'y' : 'ies'}</div>
                    </div>
                    <div class="mt-4 space-y-3">
                        ${(item.history || []).length ? item.history.map(history => `
                            <div class="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-4 py-4">
                                <div class="flex flex-wrap items-center justify-between gap-2">
                                    <div class="text-sm font-bold text-zinc-900 dark:text-white">${formatStudentSongDate(history.lesson_date)}</div>
                                    <span class="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${studentProgressBadgeClass(history.progress_status)}">${escapeStudentSongHtml(history.progress_status || 'assigned')}</span>
                                </div>
                                <div class="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200">${escapeStudentSongHtml(history.lesson_notes || 'No lesson note recorded.')}</div>
                            </div>
                        `).join('') : '<div class="rounded-2xl border border-dashed border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-4 py-5 text-sm text-zinc-500 dark:text-zinc-400">Your teacher has not added lesson history for this song yet.</div>'}
                    </div>
                </div>
            </div>
        </article>
    `).join('');

    updateStudentSongStats();
}

function attachStudentSongMenu() {
    const toggle = document.getElementById('studentMobileMenuToggle');
    const menu = document.getElementById('studentMobileMenu');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', () => {
        menu.classList.toggle('hidden');
    });

    menu.addEventListener('click', event => {
        if (event.target === menu) {
            menu.classList.add('hidden');
        }
    });
}

async function loadStudentSongs() {
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? (Auth.getUser() || null) : null;
    if (!user?.email) {
        return;
    }

    const displayName = user.username || user.email || 'Student';
    const navName = document.getElementById('studentNavName');
    const mobileName = document.getElementById('studentMobileMenuName');
    if (navName) navName.textContent = displayName;
    if (mobileName) mobileName.textContent = displayName;

    const response = await axios.get(`${baseApiUrl}/songs.php?action=get-student-assigned-songs&email=${encodeURIComponent(user.email)}`);
    studentAssignedSongs = response.data?.success && Array.isArray(response.data.songs) ? response.data.songs : [];
    renderStudentSongs();
}

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof checkAuth === 'function') {
        checkAuth();
    }

    attachStudentSongMenu();

    try {
        await loadStudentSongs();
    } catch (error) {
        console.error('Failed to load student songs:', error);
        const status = document.getElementById('studentSongStatus');
        if (status) status.textContent = 'Failed to load songs';
    }
});
