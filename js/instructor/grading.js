let instructorGradeSessions = [];
let selectedGradeSessionId = 0;
let currentGradeFilter = 'all';

function toggleInstructorMenu() {
    const menu = document.getElementById('instructorMobileMenu');
    const icon = document.getElementById('instructorMenuIcon');
    if (!menu || !icon) return;
    const isHidden = menu.classList.contains('hidden');
    menu.classList.toggle('hidden');
    icon.classList.toggle('fa-bars', !isHidden);
    icon.classList.toggle('fa-times', isHidden);
}

function setGradeText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function showGradeMessage(message, type = 'info') {
    const box = document.getElementById('gradeMessage');
    if (!box) return;
    const styles = {
        error: 'border-red-200 bg-red-50 text-red-700',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        info: 'border-slate-200 bg-slate-50 text-slate-700'
    };
    box.className = `mt-4 rounded-2xl border px-4 py-3 text-sm ${styles[type] || styles.info}`;
    box.textContent = message;
    box.classList.remove('hidden');
}

function formatShortDate(dateValue) {
    if (!dateValue) return '—';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime12Hour(timeString) {
    if (!timeString) return '—';
    const parts = String(timeString).split(':');
    if (parts.length < 2) return timeString;
    const hour = Number(parts[0]);
    const minute = Number(parts[1]);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return timeString;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hh = hour % 12 === 0 ? 12 : hour % 12;
    return `${hh}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function getStatusClasses(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'completed') return 'bg-emerald-100 text-emerald-700';
    if (normalized === 'scheduled') return 'bg-sky-100 text-sky-700';
    if (normalized === 'cancelled_by_teacher') return 'bg-rose-100 text-rose-700';
    if (normalized === 'rescheduled') return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-700';
}

function getGradeState(session) {
    return Number(session.progress_id || 0) > 0 ? 'Graded' : 'Needs Grade';
}

function getGradeStateClasses(session) {
    return Number(session.progress_id || 0) > 0
        ? 'bg-gold-100 text-gold-700'
        : 'bg-slate-100 text-slate-700';
}

function computeAverageFromInputs() {
    const ids = [
        'performanceScoreInput',
        'techniqueScoreInput',
        'rhythmScoreInput',
        'focusScoreInput',
        'assignmentScoreInput'
    ];
    const values = ids
        .map(id => Number(document.getElementById(id)?.value || 0))
        .filter(value => value >= 1 && value <= 5);
    if (values.length !== ids.length) {
        return null;
    }
    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function updateScorePreview() {
    const preview = document.getElementById('scorePreview');
    const badge = document.getElementById('gradeAverageBadge');
    const average = computeAverageFromInputs();
    if (!preview || !badge) return;

    if (average === null) {
        preview.textContent = 'Average score will appear after selecting all ratings.';
        badge.classList.add('hidden');
        badge.textContent = '';
        return;
    }

    preview.textContent = `Average session score: ${average.toFixed(2)} / 5`;
    badge.textContent = `Avg ${average.toFixed(2)}`;
    badge.classList.remove('hidden');
}

function populateGradeForm(session) {
    selectedGradeSessionId = Number(session?.session_id || 0);
    document.getElementById('sessionIdInput').value = selectedGradeSessionId ? String(selectedGradeSessionId) : '';

    const studentName = session
        ? `${session.student_first_name || ''} ${session.student_last_name || ''}`.trim() || 'Student'
        : 'Select a session';
    const sessionMeta = session
        ? `${formatShortDate(session.session_date)} • ${formatTime12Hour(session.start_time)} - ${formatTime12Hour(session.end_time)}`
        : 'No session selected';

    setGradeText('gradeStudentName', studentName);
    setGradeText('gradeSessionMeta', sessionMeta);
    setGradeText(
        'gradeFormSubtitle',
        session
            ? `${session.instrument_name || 'Instrument'} • ${session.package_name || 'Package'} • ${getGradeState(session)}`
            : 'Choose a session from the left to record performance.'
    );

    document.getElementById('skillLevelInput').value = session?.skill_level || '';
    document.getElementById('performanceScoreInput').value = session?.performance_score ? String(session.performance_score) : '';
    document.getElementById('techniqueScoreInput').value = session?.technique_score ? String(session.technique_score) : '';
    document.getElementById('rhythmScoreInput').value = session?.rhythm_score ? String(session.rhythm_score) : '';
    document.getElementById('focusScoreInput').value = session?.focus_score ? String(session.focus_score) : '';
    document.getElementById('assignmentScoreInput').value = session?.assignment_score ? String(session.assignment_score) : '';
    document.getElementById('remarksInput').value = session?.remarks || '';

    updateScorePreview();
}

function renderGradeStats(rows) {
    const gradedRows = rows.filter(item => Number(item.progress_id || 0) > 0);
    const averages = gradedRows
        .map(item => Number(item.average_score || 0))
        .filter(value => value > 0);
    const overallAverage = averages.length
        ? (averages.reduce((sum, value) => sum + value, 0) / averages.length).toFixed(2)
        : '—';

    setGradeText('statSessionsInView', String(rows.length));
    setGradeText('statGradedSessions', String(gradedRows.length));
    setGradeText('statAverageScore', overallAverage === '—' ? '—' : `${overallAverage}/5`);
}

function getVisibleGradeSessions() {
    const searchValue = String(document.getElementById('gradeSearch')?.value || '').trim().toLowerCase();
    return instructorGradeSessions.filter(session => {
        if (searchValue) {
            const haystack = [
                session.student_first_name,
                session.student_last_name,
                session.instrument_name,
                session.package_name
            ].join(' ').toLowerCase();
            if (!haystack.includes(searchValue)) {
                return false;
            }
        }
        return true;
    });
}

function renderGradeSessions() {
    const list = document.getElementById('sessionGradeList');
    const count = document.getElementById('sessionGradeCount');
    if (!list) return;

    const rows = getVisibleGradeSessions();
    renderGradeStats(rows);
    if (count) count.textContent = `${rows.length} session${rows.length === 1 ? '' : 's'} in current view`;

    if (!rows.length) {
        list.innerHTML = '<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No matching session records were returned for this grading filter.</div>';
        populateGradeForm(null);
        return;
    }

    if (!rows.some(session => Number(session.session_id) === selectedGradeSessionId)) {
        populateGradeForm(rows[0]);
    }

    list.innerHTML = rows.map(session => {
        const sessionId = Number(session.session_id || 0);
        const isSelected = sessionId === selectedGradeSessionId;
        const studentName = `${session.student_first_name || ''} ${session.student_last_name || ''}`.trim() || 'Student';
        const averageScore = session.average_score ? Number(session.average_score).toFixed(2) : null;
        return `
            <button type="button" data-session-id="${sessionId}" class="grade-session-card w-full text-left rounded-3xl border ${isSelected ? 'border-gold-400 bg-gold-50/50' : 'border-slate-200 bg-slate-50'} p-5 transition hover:border-gold-300 hover:bg-gold-50/30">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <div class="truncate text-base font-bold text-slate-900">${escapeHtml(studentName)}</div>
                        <div class="mt-1 text-xs text-slate-500">${escapeHtml(session.instrument_name || 'Instrument')} • ${escapeHtml(session.package_name || 'Package')}</div>
                    </div>
                    <span class="px-2.5 py-1 rounded-full text-[11px] font-bold ${getStatusClasses(session.status)}">${escapeHtml(session.status || '—')}</span>
                </div>
                <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <div class="text-xs uppercase tracking-[0.18em] text-slate-400 font-bold">Session</div>
                        <div class="mt-1 font-semibold text-slate-800">${escapeHtml(formatShortDate(session.session_date))}</div>
                        <div class="text-xs text-slate-500 mt-1">${escapeHtml(`${formatTime12Hour(session.start_time)} - ${formatTime12Hour(session.end_time)}`)}</div>
                    </div>
                    <div>
                        <div class="text-xs uppercase tracking-[0.18em] text-slate-400 font-bold">Grade Status</div>
                        <div class="mt-1 inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${getGradeStateClasses(session)}">${getGradeState(session)}</div>
                        <div class="text-xs text-slate-500 mt-1">${averageScore ? `Average: ${averageScore}/5` : 'No score yet'}</div>
                    </div>
                </div>
                <div class="mt-4 text-xs text-slate-500">
                    ${session.remarks ? escapeHtml(session.remarks) : 'No teacher remarks recorded for this session yet.'}
                </div>
            </button>
        `;
    }).join('');

    document.querySelectorAll('.grade-session-card').forEach(button => {
        button.addEventListener('click', () => {
            const sessionId = Number(button.dataset.sessionId || 0);
            const target = instructorGradeSessions.find(item => Number(item.session_id || 0) === sessionId) || null;
            populateGradeForm(target);
            renderGradeSessions();
        });
    });
}

async function loadGradeSessions(filter = currentGradeFilter) {
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
    if (!user?.user_id) {
        instructorGradeSessions = [];
        renderGradeSessions();
        return;
    }

    currentGradeFilter = filter;

    try {
        const response = await axios.get(`${baseApiUrl}/teachers.php?action=get-teacher-session-grades&user_id=${encodeURIComponent(user.user_id)}&filter=${encodeURIComponent(filter)}`);
        const data = response.data || {};
        instructorGradeSessions = data.success && Array.isArray(data.sessions) ? data.sessions : [];
    } catch (error) {
        console.error('Failed to load grading sessions:', error);
        instructorGradeSessions = [];
    }

    renderGradeSessions();
}

async function saveSessionGrade(event) {
    event.preventDefault();
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
    if (!user?.user_id) {
        showGradeMessage('Teacher account is not available. Please log in again.', 'error');
        return;
    }

    const sessionId = Number(document.getElementById('sessionIdInput').value || 0);
    if (sessionId < 1) {
        showGradeMessage('Select a session before saving a grade.', 'error');
        return;
    }

    const payload = {
        action: 'save-session-grade',
        user_id: Number(user.user_id),
        session_id: sessionId,
        skill_level: document.getElementById('skillLevelInput').value,
        performance_score: Number(document.getElementById('performanceScoreInput').value || 0),
        technique_score: Number(document.getElementById('techniqueScoreInput').value || 0),
        rhythm_score: Number(document.getElementById('rhythmScoreInput').value || 0),
        focus_score: Number(document.getElementById('focusScoreInput').value || 0),
        assignment_score: Number(document.getElementById('assignmentScoreInput').value || 0),
        remarks: document.getElementById('remarksInput').value.trim()
    };

    const button = document.getElementById('saveGradeBtn');
    if (button) button.disabled = true;

    try {
        const response = await axios.post(`${baseApiUrl}/teachers.php?action=save-session-grade`, payload);
        const data = response.data || {};
        if (!data.success) {
            showGradeMessage(data.error || 'Failed to save session grade.', 'error');
            return;
        }

        showGradeMessage(data.message || 'Session grade saved successfully.', 'success');
        await loadGradeSessions(currentGradeFilter);
        const refreshed = instructorGradeSessions.find(item => Number(item.session_id || 0) === sessionId) || null;
        populateGradeForm(refreshed);
        renderGradeSessions();
    } catch (error) {
        console.error('Failed to save session grade:', error);
        showGradeMessage('Network error while saving the session grade.', 'error');
    } finally {
        if (button) button.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof Auth !== 'undefined' && Auth.getUser) {
        const user = Auth.getUser() || {};
        const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || user.email || 'Instructor';
        const nameEl = document.getElementById('instructorNameNav');
        if (nameEl) nameEl.textContent = displayName;
    }

    await loadGradeSessions('all');

    document.getElementById('gradeFilter')?.addEventListener('change', (event) => {
        loadGradeSessions(event.target.value);
    });
    document.getElementById('gradeSearch')?.addEventListener('input', () => {
        renderGradeSessions();
    });
    document.getElementById('gradingForm')?.addEventListener('submit', saveSessionGrade);

    [
        'performanceScoreInput',
        'techniqueScoreInput',
        'rhythmScoreInput',
        'focusScoreInput',
        'assignmentScoreInput'
    ].forEach(id => {
        document.getElementById(id)?.addEventListener('change', updateScorePreview);
    });
});
