let studentAssignedSongs = [];
let studentSelectedSongId = 0;
let studentPortalProfile = null;

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

function studentSongStatusLabel(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'completed') return 'Completed';
    if (normalized === 'practicing') return 'In progress';
    if (normalized === 'polishing') return 'Polishing';
    return 'Assigned';
}

function studentSongStatusRank(status) {
    const normalized = String(status || 'assigned').toLowerCase();
    if (normalized === 'assigned') return 1;
    if (normalized === 'practicing') return 2;
    if (normalized === 'polishing') return 3;
    if (normalized === 'completed') return 4;
    return 5;
}

function getSortedStudentSongs() {
    return [...studentAssignedSongs].sort((a, b) => {
        const aRank = studentSongStatusRank(a.progress_status);
        const bRank = studentSongStatusRank(b.progress_status);
        if (aRank !== bRank) return aRank - bRank;
        return Number(a.assignment_id || 0) - Number(b.assignment_id || 0);
    });
}

function getCurrentStudentSong() {
    return getSortedStudentSongs().find(item => String(item.progress_status || '').toLowerCase() !== 'completed') || null;
}

function getStudentLocalDateKey(date = new Date()) {
    const localDate = new Date(date);
    localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
    return localDate.toISOString().slice(0, 10);
}

function showStudentSongAlert(icon, title, text) {
    if (typeof Swal !== 'undefined' && Swal.fire) {
        return Swal.fire({
            icon,
            title,
            text,
            confirmButtonColor: '#d4a017'
        });
    }

    window.alert(`${title}\n\n${text}`);
    return Promise.resolve();
}

function getStudentDisplayName() {
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? (Auth.getUser() || null) : null;
    return user?.username || user?.email || 'Maya';
}

function getStudentAssignedSongById(assignmentId) {
    return studentAssignedSongs.find(item => Number(item.assignment_id || 0) === Number(assignmentId || 0)) || null;
}

function getStudentSelectedSong() {
    return getStudentAssignedSongById(studentSelectedSongId) || getCurrentStudentSong() || getFeaturedSong();
}

function setStudentHeroGreeting(name) {
    const titleEl = document.getElementById('studentPageTitle');
    const subtitleEl = document.getElementById('studentPageSubtitle');
    const displayName = String(name || 'Maya').trim();
    if (titleEl) titleEl.textContent = `Hi ${displayName}, ready to practice?`;
    if (subtitleEl) subtitleEl.textContent = 'Your teacher has new pieces ready for you. Take it one small step at a time.';
}

function setStudentPortalIdentity(portal, user) {
    const student = portal?.student || {};
    const enrollment = portal?.current_enrollment || null;
    const displayName = `${student.first_name || ''} ${student.last_name || ''}`.trim()
        || student.full_name
        || student.student_name
        || user?.username
        || user?.email
        || 'Student';
    const email = student.email || user?.email || '—';
    const branchName = student.branch_name
        || enrollment?.branch_name
        || portal?.branch_name
        || '—';

    studentPortalProfile = portal;
    window.__studentPortalBranchLabel = branchName;

    const setText = (selector, value) => {
        document.querySelectorAll(selector).forEach(node => {
            node.textContent = value;
        });
    };

    setText('#studentNavName', displayName);
    setText('#studentMobileMenuName', displayName);
    setText('#studentSidebarName, #studentSidebarMobileName, #studentName, #studentNameMobile', displayName);
    setText('#studentSidebarEmail, #studentSidebarMobileEmail, #studentEmail, #studentEmailMobile', email);

    if (typeof window.setPortalBranchText === 'function') {
        window.setPortalBranchText('#studentSidebarBranch, #studentSidebarMobileBranch, #studentBranch, #studentBranchMobile', branchName);
    } else {
        setText('#studentSidebarBranch, #studentSidebarMobileBranch, #studentBranch, #studentBranchMobile', branchName);
    }

    if (typeof window.fitAllPortalBranchLabels === 'function') {
        window.fitAllPortalBranchLabels();
    }

    setStudentHeroGreeting(displayName);
}

function getFeaturedSong() {
    return getCurrentStudentSong() || getSortedStudentSongs()[0] || null;
}

function getWeekPracticeDays() {
    const seen = new Set();
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 7);

    studentAssignedSongs.forEach(item => {
        (item.history || []).forEach(history => {
            const date = new Date(history.lesson_date);
            if (Number.isNaN(date.getTime())) return;
            if (date < start || date > now) return;
            seen.add(date.toISOString().slice(0, 10));
        });
    });

    if (seen.size) return seen.size;

    const activeSongs = studentAssignedSongs.filter(item => String(item.progress_status || '').toLowerCase() !== 'completed');
    return activeSongs.length ? 1 : 0;
}

function getPracticeMaterials(song) {
    if (!song) return [];
    const materials = [];
    if (song.sheet_music_path) {
        materials.push({
            label: 'Sheet music',
            icon: 'fa-file-pdf',
            color: 'text-rose-600',
            bg: 'bg-rose-50 dark:bg-rose-500/15',
            href: studentSongAssetUrl(song.sheet_music_path),
            subtitle: song.sheet_music_path.split('/').pop() || 'PDF file'
        });
    }
    if (song.youtube_link) {
        materials.push({
            label: 'Watch the lesson video',
            icon: 'fa-video',
            color: 'text-red-600',
            bg: 'bg-red-50 dark:bg-red-500/15',
            href: song.youtube_link,
            subtitle: 'See and hear the first section'
        });
    }
    if (song.spotify_link) {
        materials.push({
            label: 'Listen on Spotify',
            icon: 'fa-spotify',
            color: 'text-emerald-600',
            bg: 'bg-emerald-50 dark:bg-emerald-500/15',
            href: song.spotify_link,
            subtitle: 'Practice along with the reference track'
        });
    }
    if (song.accompaniment_audio_path) {
        materials.push({
            label: 'Accompaniment audio',
            icon: 'fa-headphones',
            color: 'text-violet-600',
            bg: 'bg-violet-50 dark:bg-violet-500/15',
            href: studentSongAssetUrl(song.accompaniment_audio_path),
            subtitle: 'Use this when you practice at home'
        });
    }
    return materials;
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

    const practiceDays = getWeekPracticeDays();
    setText('studentSongCount', studentAssignedSongs.length);
    setText('studentAssignedCount', counts.assigned || 0);
    setText('studentPracticingCount', counts.practicing || 0);
    setText('studentCompletedCount', counts.completed || 0);
    setText('studentPracticeDays', `${practiceDays} practice day${practiceDays === 1 ? '' : 's'}`);
    const activeSongs = studentAssignedSongs.filter(item => String(item.progress_status || '').toLowerCase() !== 'completed').length;
    const queuedSongs = Math.max(0, activeSongs - 1);
    setText('studentSongStatus', activeSongs > 0
        ? `${activeSongs} active song${activeSongs === 1 ? '' : 's'} · ${queuedSongs} queued`
        : `${studentAssignedSongs.length} assigned song${studentAssignedSongs.length === 1 ? '' : 's'}`);
}

function renderPracticeMaterials(song) {
    const mount = document.getElementById('studentPracticeMaterials');
    const count = document.getElementById('practiceMaterialsCount');
    if (!mount || !count) return;

    const materials = getPracticeMaterials(song);
    count.textContent = `${materials.length} item${materials.length === 1 ? '' : 's'}`;

    if (!song) {
        mount.innerHTML = `
            <div class="rounded-[1.25rem] border border-dashed border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                Your teacher will add practice materials here once a song is assigned.
            </div>
        `;
        return;
    }

    if (!materials.length) {
        mount.innerHTML = `
            <div class="rounded-[1.25rem] border border-dashed border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                No practice materials were attached yet.
            </div>
        `;
        return;
    }

    mount.innerHTML = materials.map(material => `
        <a href="${escapeStudentSongHtml(material.href)}" target="_blank" rel="noopener noreferrer" class="flex items-center justify-between gap-3 rounded-[1.25rem] border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 transition hover:border-gold-300 hover:bg-[#fffdf2]">
            <div class="flex items-center gap-3 min-w-0">
                <div class="grid h-11 w-11 place-items-center rounded-2xl ${material.bg} ${material.color}">
                    <i class="fas ${material.icon}"></i>
                </div>
                <div class="min-w-0">
                    <div class="truncate text-base font-black text-zinc-900 dark:text-white">${escapeStudentSongHtml(material.label)}</div>
                    <div class="truncate text-sm text-zinc-500 dark:text-zinc-400">${escapeStudentSongHtml(material.subtitle || '')}</div>
                </div>
            </div>
            <div class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-zinc-300">
                <i class="fas fa-arrow-right"></i>
            </div>
        </a>
    `).join('');
}

function renderSelectedSongHeader(song) {
    const titleEl = document.getElementById('featuredTitle');
    const composerEl = document.getElementById('featuredComposer');
    const badgeEl = document.getElementById('featuredBadge');
    const practiceByEl = document.getElementById('featuredPracticeBy');
    const startTimeEl = document.getElementById('featuredStartTime');
    const goalEl = document.getElementById('featuredGoal');
    const goalNoteEl = document.getElementById('featuredGoalNote');
    const checkInEl = document.getElementById('studentCheckInStatus');
    const queueCountEl = document.getElementById('studentQueueCount');
    const noteTitleEl = document.getElementById('teacherNoteTitle');
    const noteBodyEl = document.getElementById('teacherNoteBody');

    if (!song) {
        if (titleEl) titleEl.textContent = 'No song yet';
        if (composerEl) composerEl.textContent = 'Your teacher will assign your next piece soon.';
        if (badgeEl) badgeEl.innerHTML = '<i class="fas fa-music mr-2"></i><span>Waiting for assignment</span>';
        if (practiceByEl) practiceByEl.textContent = 'Practice by your next lesson';
        if (startTimeEl) startTimeEl.textContent = 'Start with 10 minutes';
        if (goalEl) goalEl.textContent = 'A new piece will appear here once it is assigned.';
        if (goalNoteEl) goalNoteEl.textContent = 'Keep checking back after each lesson.';
        if (checkInEl) checkInEl.textContent = 'Waiting for your first practice piece';
        if (queueCountEl) queueCountEl.textContent = '0 songs in queue';
        if (noteTitleEl) noteTitleEl.textContent = 'Your teacher is preparing your next practice steps.';
        if (noteBodyEl) noteBodyEl.textContent = 'Once a piece is assigned, this note will show the focus for your next lesson.';
        renderPracticeMaterials(null);
        return;
    }

    const instrumentLabel = [song.category, song.difficulty_level].filter(Boolean).join(' · ') || 'Practice piece';
    const goalText = song.assigned_notes || song.song_notes || 'Focus on small sections, slow tempo, and even rhythm.';
    const teacherName = song.teacher_name || 'Your teacher';
    const statusLabel = studentSongStatusLabel(song.progress_status);
    const practiceDays = getWeekPracticeDays();

    if (titleEl) titleEl.textContent = song.title || 'Untitled';
    if (composerEl) composerEl.textContent = song.artist || 'Unknown composer';
    if (badgeEl) badgeEl.innerHTML = `<i class="fas fa-music mr-2"></i><span>${escapeStudentSongHtml(instrumentLabel)}</span>`;
    if (practiceByEl) practiceByEl.textContent = 'Practice by your next lesson';
    if (startTimeEl) startTimeEl.textContent = practiceDays > 0 ? `Keep your daily routine going` : 'Start with 10 minutes';
    if (goalEl) goalEl.textContent = goalText.length > 72 ? `${goalText.slice(0, 72).trim()}...` : goalText;
    if (goalNoteEl) goalNoteEl.textContent = song.assigned_notes || song.song_notes || 'Keep your left hand soft and listen for an even pulse.';
    if (checkInEl) checkInEl.textContent = statusLabel === 'Completed' ? 'Great job, this piece is done' : `Your current status: ${statusLabel}`;
    if (queueCountEl) {
        const activeSongs = studentAssignedSongs.filter(item => String(item.progress_status || '').toLowerCase() !== 'completed').length;
        const queuedSongs = Math.max(0, activeSongs - 1);
        queueCountEl.textContent = activeSongs > 0
            ? `${queuedSongs} song${queuedSongs === 1 ? '' : 's'} waiting after this one`
            : 'No active songs';
    }
    if (noteTitleEl) noteTitleEl.textContent = `A note from ${teacherName}`;
    if (noteBodyEl) noteBodyEl.textContent = song.assigned_notes || song.song_notes || 'Focus on short, steady practice and return to the tricky bars often.';

    renderPracticeMaterials(song);
}

function renderStudentSongs() {
    const grid = document.getElementById('studentSongsGrid');
    const emptyState = document.getElementById('studentCompletedEmptyState');
    const currentSong = getCurrentStudentSong();
    const featured = getStudentAssignedSongById(studentSelectedSongId) || currentSong || getFeaturedSong();
    const doneButton = document.getElementById('studentMarkSongDoneBtn');
    const featuredIsCurrent = !!featured && !!currentSong && Number(featured.assignment_id || 0) === Number(currentSong.assignment_id || 0);
    if (doneButton) {
        doneButton.classList.toggle('hidden', !featuredIsCurrent);
        doneButton.disabled = !featuredIsCurrent;
    }
    if (!grid) return;

    renderSelectedSongHeader(featured);
    updateStudentSongStats();

    if (!studentAssignedSongs.length) {
        grid.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    const selectedId = Number(featured?.assignment_id || 0);
    const currentId = Number(currentSong?.assignment_id || 0);
    grid.innerHTML = getSortedStudentSongs().map(item => {
        const active = Number(item.assignment_id || 0) === selectedId;
        const isCurrent = Number(item.assignment_id || 0) === currentId;
        const isCompleted = String(item.progress_status || '').toLowerCase() === 'completed';
        return `
        <article class="rounded-[1.25rem] border ${active ? 'border-gold-400 ring-2 ring-gold-400/30' : 'border-zinc-200 dark:border-white/10'} bg-white dark:bg-white/5 p-4 shadow-lg dark:shadow-black/20 transition ${isCurrent ? 'relative' : ''}">
            ${isCurrent ? '<div class="absolute right-4 top-4 rounded-full bg-gold-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#a15d00]">Current</div>' : ''}
            <div class="flex items-start gap-3">
                <div class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${active ? 'bg-gold-500 text-black' : isCompleted ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-zinc-300'}">
                    <i class="fas fa-music"></i>
                </div>
                <div class="min-w-0 flex-1">
                    <div class="truncate text-lg font-black text-zinc-900 dark:text-white">${escapeStudentSongHtml(item.title || 'Untitled')}</div>
                    <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">${escapeStudentSongHtml(item.artist || 'Unknown Artist')}</div>
                    <div class="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">${escapeStudentSongHtml(item.teacher_name || 'Your teacher')} • ${escapeStudentSongHtml(formatStudentSongDate(item.assigned_at))}</div>
                    <span class="mt-2 inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${studentProgressBadgeClass(item.progress_status)}">${escapeStudentSongHtml(studentSongStatusLabel(item.progress_status))}</span>
                </div>
            </div>
            <div class="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" data-student-song-open="${Number(item.assignment_id || 0)}" class="inline-flex items-center rounded-2xl ${active ? 'bg-gold-500 text-black' : 'bg-zinc-900 text-white dark:bg-white/10 dark:text-white'} px-3 py-2 text-sm font-bold transition hover:opacity-90">
                    <i class="fas fa-folder-open mr-2"></i>Open practice song
                </button>
                ${isCompleted ? '<span class="inline-flex items-center rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"><i class="fas fa-circle-check mr-2"></i>Practice completed</span>' : ''}
            </div>
            ${isCurrent ? '<p class="mt-2 text-xs font-semibold text-[#a15d00]">This is the next song to finish.</p>' : ''}
            ${item.assigned_notes ? `<p class="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">${escapeStudentSongHtml(item.assigned_notes)}</p>` : ''}
        </article>
        `;
    }).join('');
}

async function markCurrentStudentSongDone() {
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? (Auth.getUser() || null) : null;
    const currentSong = getCurrentStudentSong();

    if (!currentSong) {
        await showStudentSongAlert('info', 'No active song yet', 'Your teacher has not assigned an active song to finish.');
        return;
    }

    const studentId = Number(studentPortalProfile?.student?.student_id || user?.student_id || 0);
    const payload = {
        action: 'complete-student-assignment',
        assignment_id: Number(currentSong.assignment_id || 0),
        email: user?.email || studentPortalProfile?.student?.email || '',
        username: user?.username || studentPortalProfile?.student?.username || '',
        lesson_date: getStudentLocalDateKey(),
        lesson_notes: `Completed from student portal on ${new Date().toLocaleDateString('en-PH')}`
    };

    if (studentId > 0) {
        payload.student_id = studentId;
    }

    try {
        const response = await axios.post(`${baseApiUrl}/songs.php`, payload);
        if (response.data?.success) {
            await showStudentSongAlert('success', 'Song marked done', 'Nice work — your next assigned song is now ready.');
            studentSelectedSongId = 0;
            await loadStudentSongs();
            return;
        }
        await showStudentSongAlert('error', 'Could not mark song done', response.data?.error || 'Please try again.');
    } catch (error) {
        await showStudentSongAlert('error', 'Could not mark song done', error.response?.data?.error || 'Please try again.');
    }
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
    setStudentHeroGreeting(displayName);

    try {
        if (typeof window.fetchStudentPortalDataByEmail === 'function') {
            const portal = await window.fetchStudentPortalDataByEmail(user.email);
            if (portal?.success) {
                setStudentPortalIdentity(portal, user);
            }
        }
    } catch (error) {
        console.warn('Unable to load student profile data for songs page.', error);
    }

    const response = await axios.get(`${baseApiUrl}/songs.php?action=get-student-assigned-songs&email=${encodeURIComponent(user.email)}&username=${encodeURIComponent(user.username || '')}`);
    studentAssignedSongs = response.data?.success && Array.isArray(response.data.songs) ? response.data.songs : [];
    if (!studentSelectedSongId && studentAssignedSongs.length) {
        studentSelectedSongId = Number((getCurrentStudentSong() || studentAssignedSongs[0])?.assignment_id || 0);
    }
    renderStudentSongs();
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.__fasAuthReady) {
        await window.__fasAuthReady;
    }
    if (typeof checkStudentAuth === 'function') {
        checkStudentAuth();
    }

    attachStudentSongMenu();
    document.getElementById('studentSongsGrid')?.addEventListener('click', event => {
        const button = event.target.closest('[data-student-song-open]');
        if (!button) return;
        studentSelectedSongId = Number(button.getAttribute('data-student-song-open') || 0);
        renderStudentSongs();
        document.getElementById('featuredTitle')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.getElementById('studentMarkSongDoneBtn')?.addEventListener('click', () => {
        markCurrentStudentSongDone();
    });

    try {
        await loadStudentSongs();
    } catch (error) {
        console.error('Failed to load student songs:', error);
        const songsGrid = document.getElementById('studentSongsGrid');
        if (songsGrid) {
            songsGrid.innerHTML = '<div class="rounded-[1.5rem] border border-dashed border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Failed to load songs.</div>';
        }
    }
});
