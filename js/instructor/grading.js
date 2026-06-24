/* ================================================================
   instructor/grading.js
   ================================================================ */

let instructorGradeSessions = [];
let selectedGradeSessionId  = 0;
let currentGradeFilter      = 'all';

let _radarChartInstance = null;
let _trendChartInstance = null;

// ── Constants ──────────────────────────────────────────────────────
const SCORE_FIELDS = [
    { key: 'performance_score', label: 'Performance',        icon: 'fa-music',     labelId: 'perfLabel'   },
    { key: 'technique_score',   label: 'Technique',          icon: 'fa-hands',     labelId: 'techLabel'   },
    { key: 'rhythm_score',      label: 'Rhythm & Timing',    icon: 'fa-drum',      labelId: 'rhythmLabel' },
    { key: 'focus_score',       label: 'Focus & Discipline', icon: 'fa-brain',     labelId: 'focusLabel'  },
    { key: 'assignment_score',  label: 'Assignment',         icon: 'fa-book-open', labelId: 'assignLabel' }
];

const SCORE_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

const IMPROVEMENT_TIPS = {
    performance_score: {
        low:  'Practice performing full pieces from start to finish without stopping — even if there are small mistakes.',
        mid:  'Record yourself playing and listen back to spot inconsistencies.',
        high: 'Great level! Push yourself with more challenging repertoire.'
    },
    technique_score: {
        low:  'Go slow with a metronome and focus on posture and hand position first.',
        mid:  'Work on the specific technical weak points from this session with targeted exercises.',
        high: 'Solid technique — try exploring advanced articulations for your instrument.'
    },
    rhythm_score: {
        low:  'Practice with a metronome every day. Start slower than you think and only speed up when it\'s clean.',
        mid:  'Clap or tap the rhythm before playing it. Try subdividing each beat.',
        high: 'Rhythm is strong! Try syncopation and off-beat exercises to stay challenged.'
    },
    focus_score: {
        low:  'Keep practice sessions short (15–20 min) with one clear goal at a time.',
        mid:  'Reduce distractions during practice and write down what you worked on each session.',
        high: 'Great discipline! Try mental practice — imagining the music without the instrument.'
    },
    assignment_score: {
        low:  'Review the assigned material for just 10 minutes every day — small consistent effort beats long irregular sessions.',
        mid:  'Split the assignment into small pieces and check them off one by one across the week.',
        high: 'Excellent practice completion! Ask your teacher to add more material to keep it challenging.'
    }
};

// ── Utility helpers ────────────────────────────────────────────────
function getTipLevel(score) {
    if (score <= 2) return 'low';
    if (score <= 3) return 'mid';
    return 'high';
}

function getTipStyle(score) {
    if (score <= 2) return { wrap: 'border-rose-200 bg-rose-50',    icon: 'text-rose-400',    title: 'text-rose-800',    body: 'text-rose-700',    badge: 'bg-rose-100 text-rose-700'    };
    if (score <= 3) return { wrap: 'border-amber-200 bg-amber-50',  icon: 'text-amber-400',   title: 'text-amber-800',   body: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700'  };
    return             { wrap: 'border-emerald-200 bg-emerald-50', icon: 'text-emerald-400', title: 'text-emerald-800', body: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' };
}

function getTipLabel(score) {
    if (score <= 2) return 'Needs Work';
    if (score <= 3) return 'Developing';
    return 'Strong';
}

function toggleInstructorMenu() {
    const menu = document.getElementById('instructorMobileMenu');
    const icon = document.getElementById('instructorMenuIcon');
    if (!menu || !icon) return;
    const hidden = menu.classList.contains('hidden');
    menu.classList.toggle('hidden');
    icon.classList.toggle('fa-bars',  !hidden);
    icon.classList.toggle('fa-times', hidden);
}

function setGradeText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function showGradeMessage(message, type = 'info') {
    const box = document.getElementById('gradeMessage');
    if (!box) return;
    const styles = {
        error:   'border-red-200 bg-red-50 text-red-800',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        info:    'border-slate-200 bg-slate-50 text-slate-700'
    };
    box.className = `rounded-2xl border px-4 py-3 text-sm font-medium ${styles[type] || styles.info}`;
    box.textContent = message;
    box.classList.remove('hidden');
}

function formatShortDate(v) {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime12Hour(t) {
    if (!t) return '—';
    const p = String(t).split(':');
    const h = Number(p[0]), m = Number(p[1] || 0);
    if (Number.isNaN(h)) return t;
    return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// ── Gradeability ───────────────────────────────────────────────────
function isGradeable(session) {
    return String(session?.status           || '').toLowerCase() === 'completed' &&
           String(session?.attendance_status || '').toLowerCase() === 'present';
}

function getAttendanceBadgeLabel(session) {
    if (Number(session.progress_id || 0) > 0) return '⭐ Graded';
    const att    = String(session?.attendance_status || '').toLowerCase();
    const status = String(session?.status           || '').toLowerCase();
    if (att === 'present')        return '✅ Present';
    if (att === 'absent')         return '❌ Absent';
    if (att === 'late')           return '🕐 Late';
    if (att === 'excused')        return '📋 Excused';
    if (att === 'ci')             return '🔄 CI';
    if (att === 'teacher absent') return '👨‍🏫 Teacher Absent';
    if (status === 'scheduled')   return '📅 Scheduled';
    if (status === 'rescheduled') return '🔃 Rescheduled';
    if (status === 'cancelled_by_teacher') return '🚫 Cancelled';
    return String(session?.status || '—');
}

function getAttendanceBadgeClasses(session) {
    if (Number(session.progress_id || 0) > 0) return 'bg-gold-100 text-gold-700 border border-gold-200';
    const att    = String(session?.attendance_status || '').toLowerCase();
    const status = String(session?.status           || '').toLowerCase();
    if (att === 'present')        return 'bg-emerald-100 text-emerald-700';
    if (att === 'absent')         return 'bg-rose-100 text-rose-700';
    if (att === 'late')           return 'bg-amber-100 text-amber-700';
    if (att === 'excused')        return 'bg-purple-100 text-purple-700';
    if (att === 'ci')             return 'bg-orange-100 text-orange-700';
    if (att === 'teacher absent') return 'bg-rose-100 text-rose-700';
    if (status === 'scheduled')   return 'bg-sky-100 text-sky-700';
    if (status === 'cancelled_by_teacher') return 'bg-rose-100 text-rose-700';
    if (status === 'rescheduled') return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-600';
}

function getGradeState(session) {
    if (Number(session.progress_id || 0) > 0) return 'Graded';
    if (isGradeable(session)) return 'Ready to Grade';
    return 'Attendance Pending';
}

function getGradeStateClasses(session) {
    if (Number(session.progress_id || 0) > 0) return 'bg-gold-100 text-gold-700 border border-gold-200';
    if (isGradeable(session)) return 'bg-emerald-100 text-emerald-700';
    return 'bg-slate-100 text-slate-500';
}

function getGradeSessionSortRank(session) {
    if (Number(session?.progress_id || 0) > 0) return 2;
    if (isGradeable(session)) return 0;
    return 1;
}

function getGradeSessionSortTime(session) {
    return new Date(`${session?.session_date || ''}T${session?.start_time || '00:00:00'}`).getTime() || 0;
}

// ── Score buttons ──────────────────────────────────────────────────
function initScoreButtons() {
    document.querySelectorAll('.score-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.field;
            const val   = btn.dataset.val;
            const input = document.getElementById(field);
            if (!input || input.disabled) return;

            input.value = val;

            // Visual: deactivate all siblings, activate this one
            document.querySelectorAll(`.score-btn[data-field="${field}"]`).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update the inline label
            const sf = SCORE_FIELDS.find(f => f.key.replace('_score','ScoreInput').replace('_','ScoreInput') === field
                || (f.key.split('_')[0] + 'ScoreInput') === field
                || field === f.key.replace('_score', 'ScoreInput').replace(/(\w+)_score/,'$1ScoreInput'));
            const labelId = SCORE_FIELDS.find(f => {
                const mapped = f.key.replace('_score', 'ScoreInput');
                return mapped === field || field === mapped;
            })?.labelId;

            const labelEl = labelId ? document.getElementById(labelId) : null;
            if (labelEl) labelEl.textContent = `${val} – ${SCORE_WORDS[Number(val)] || ''}`;

            updateScorePreview();
        });
    });
}

function getFieldInputId(scoreFieldKey) {
    // 'performance_score' → 'performanceScoreInput'
    const parts = scoreFieldKey.replace('_score', '').split('_');
    return parts.map((p, i) => i === 0 ? p : p[0].toUpperCase() + p.slice(1)).join('') + 'ScoreInput';
}

function syncScoreButtons(session) {
    SCORE_FIELDS.forEach(field => {
        const inputId = getFieldInputId(field.key);
        const val     = session ? String(session[field.key] || '') : '';
        const input   = document.getElementById(inputId);
        if (input) input.value = val;

        document.querySelectorAll(`.score-btn[data-field="${inputId}"]`).forEach(btn => {
            btn.classList.remove('active');
            if (val && btn.dataset.val === val) btn.classList.add('active');
        });

        const labelEl = field.labelId ? document.getElementById(field.labelId) : null;
        if (labelEl) labelEl.textContent = val ? `${val} – ${SCORE_WORDS[Number(val)] || ''}` : '—';
    });
}

function setScoreButtonsDisabled(disabled) {
    document.querySelectorAll('.score-btn').forEach(btn => {
        btn.disabled = disabled;
        btn.classList.toggle('opacity-40', disabled);
        btn.classList.toggle('cursor-not-allowed', disabled);
    });
}

// ── Average preview ────────────────────────────────────────────────
function computeAverageFromInputs() {
    const ids    = SCORE_FIELDS.map(f => getFieldInputId(f.key));
    const values = ids.map(id => Number(document.getElementById(id)?.value || 0)).filter(v => v >= 1 && v <= 5);
    if (values.length !== ids.length) return null;
    return Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(2));
}

function updateScorePreview() {
    const previewEl  = document.getElementById('scorePreview');
    const badgeEl    = document.getElementById('gradeAverageBadge');
    const previewBox = document.getElementById('avgPreviewBox');
    const avg        = computeAverageFromInputs();
    const selectedSession = instructorGradeSessions.find(s => Number(s.session_id || 0) === Number(selectedGradeSessionId || 0)) || null;

    if (!previewEl) return;

    if (avg === null) {
        previewEl.textContent = '—';
        if (previewBox) previewBox.classList.add('hidden');
        if (badgeEl)    { badgeEl.classList.add('hidden'); badgeEl.querySelector('span').textContent = ''; }
        if (selectedSession) {
            renderAnalytics(selectedSession);
        }
        return;
    }

    previewEl.textContent = `${avg.toFixed(2)} / 5`;
    if (previewBox) previewBox.classList.remove('hidden');

    if (badgeEl) {
        badgeEl.classList.remove('hidden');
        badgeEl.classList.add('flex');
        const span = badgeEl.querySelector('span');
        if (span) span.textContent = `Avg ${avg.toFixed(2)}`;
    }

    if (selectedSession) {
        renderAnalytics(selectedSession);
    }
}

function getAnalyticsPreviewSession(session) {
    if (!session) return null;

    const preview = { ...session };
    let hasAnyScore = false;

    SCORE_FIELDS.forEach((field) => {
        const inputId = getFieldInputId(field.key);
        const value = Number(document.getElementById(inputId)?.value || 0);
        if (value > 0) {
            preview[field.key] = value;
            hasAnyScore = true;
        } else {
            preview[field.key] = 0;
        }
    });

    preview.skill_level = document.getElementById('skillLevelInput')?.value || preview.skill_level || '';
    preview.remarks = document.getElementById('remarksInput')?.value || preview.remarks || '';

    const previewAverage = computeAverageFromInputs();
    preview.average_score = previewAverage !== null ? previewAverage : null;
    preview.__has_live_preview = hasAnyScore;

    return preview;
}

// ── Grade form ─────────────────────────────────────────────────────
function populateGradeForm(session) {
    selectedGradeSessionId = Number(session?.session_id || 0);
    document.getElementById('sessionIdInput').value = selectedGradeSessionId ? String(selectedGradeSessionId) : '';

    const studentName = session
        ? `${session.student_first_name || ''} ${session.student_last_name || ''}`.trim() || 'Student'
        : '—';
    const sessionMeta = session
        ? `${formatShortDate(session.session_date)}  ${formatTime12Hour(session.start_time)} – ${formatTime12Hour(session.end_time)}`
        : '—';

    setGradeText('gradeStudentName', studentName);
    setGradeText('gradeSessionMeta',  sessionMeta);
    setGradeText('gradeFormSubtitle',
        session
            ? `${session.instrument_name || 'Instrument'} • ${session.package_name || 'Package'} • ${getGradeState(session)}`
            : 'Select a session from the list to get started.'
    );

    // Sync score buttons + skill level + remarks
    syncScoreButtons(session);
    const skillEl   = document.getElementById('skillLevelInput');
    const remarksEl = document.getElementById('remarksInput');
    if (skillEl)   skillEl.value   = session?.skill_level || '';
    if (remarksEl) remarksEl.value = session?.remarks    || '';

    // Determine if editable
    const graded    = session ? Number(session.progress_id || 0) > 0 : false;
    const gradeable = session ? isGradeable(session) : false;
    const active    = gradeable || graded;

    // Lock / unlock inputs
    const formInputs = document.querySelectorAll('#gradingForm select, #gradingForm textarea');
    formInputs.forEach(el => {
        el.disabled = !active;
        el.classList.toggle('opacity-50', !active);
        el.classList.toggle('cursor-not-allowed', !active);
    });
    setScoreButtonsDisabled(!active);

    const saveBtn = document.getElementById('saveGradeBtn');
    if (saveBtn) {
        saveBtn.disabled = !active;
        saveBtn.classList.toggle('opacity-40', !active);
        saveBtn.classList.toggle('cursor-not-allowed', !active);
    }

    // Lock banner
    const lockBanner = document.getElementById('gradeLockBanner');
    const lockMsg    = document.getElementById('gradeLockMsg');
    if (lockBanner) {
        if (session && !active) {
            const att    = String(session.attendance_status || '').toLowerCase();
            const status = String(session.status            || '').toLowerCase();
            let msg = 'This session cannot be graded yet.';
            if (status === 'scheduled') {
                msg = 'This session is still Scheduled. Attendance must be marked Present before you can grade.';
            } else if (att !== 'present') {
                msg = `The student's attendance is "${getAttendanceBadgeLabel(session).replace(/^\S+\s/, '')}" — only Present sessions can be graded.`;
            }
            if (lockMsg) lockMsg.textContent = msg;
            lockBanner.classList.remove('hidden');
        } else {
            lockBanner.classList.add('hidden');
        }
    }

    updateScorePreview();
    renderAnalytics(session);
}

// ── Stats ──────────────────────────────────────────────────────────
function renderGradeStats(rows) {
    const graded  = rows.filter(r => Number(r.progress_id || 0) > 0);
    const avgs    = graded.map(r => Number(r.average_score || 0)).filter(v => v > 0);
    const overall = avgs.length ? (avgs.reduce((s, v) => s + v, 0) / avgs.length).toFixed(2) : '—';
    setGradeText('statSessionsInView', String(rows.length));
    setGradeText('statGradedSessions', String(graded.length));
    setGradeText('statAverageScore',   overall === '—' ? '—' : `${overall}/5`);
}

// ── Session list ───────────────────────────────────────────────────
function getVisibleGradeSessions() {
    const q = String(document.getElementById('gradeSearch')?.value || '').trim().toLowerCase();
    return instructorGradeSessions
        .filter(s => {
            if (!q) return true;
            return [s.student_first_name, s.student_last_name, s.instrument_name, s.package_name]
                .join(' ').toLowerCase().includes(q);
        })
        .slice()
        .sort((a, b) => {
            const rankDiff = getGradeSessionSortRank(a) - getGradeSessionSortRank(b);
            if (rankDiff !== 0) return rankDiff;

            const da = getGradeSessionSortTime(a);
            const db = getGradeSessionSortTime(b);
            if (da !== db) return da - db;

            return Number(a.session_id) - Number(b.session_id);
        });
}

function renderGradeSessions() {
    const list  = document.getElementById('sessionGradeList');
    const count = document.getElementById('sessionGradeCount');
    if (!list) return;

    const rows = getVisibleGradeSessions();
    renderGradeStats(rows);
    if (count) count.textContent = `${rows.length}`;

    if (!rows.length) {
        list.innerHTML = `<div class="text-center py-10 text-slate-400">
            <i class="fas fa-calendar-xmark text-3xl mb-3 block text-slate-200"></i>
            <p class="text-sm font-medium">No sessions match this filter.</p>
            <p class="text-xs mt-1">Try switching to "All Sessions" above.</p>
        </div>`;
        populateGradeForm(null);
        return;
    }

    // Auto-select first if nothing currently selected
    if (!rows.some(s => Number(s.session_id) === selectedGradeSessionId)) {
        populateGradeForm(rows[0]);
    }

    list.innerHTML = rows.map(session => {
        const sid        = Number(session.session_id || 0);
        const isSelected = sid === selectedGradeSessionId;
        const name       = `${session.student_first_name || ''} ${session.student_last_name || ''}`.trim() || 'Student';
        const graded     = Number(session.progress_id || 0) > 0;
        const gradeable  = isGradeable(session);
        const avgScore   = session.average_score ? Number(session.average_score).toFixed(1) : null;

        // Left border accent
        const accent = graded    ? 'border-l-[#d4af37]'
                     : gradeable ? 'border-l-emerald-400'
                     :             'border-l-slate-200';

        const selBg = isSelected
            ? 'bg-gold-50 border-t-gold-200 border-r-gold-200 border-b-gold-200'
            : 'bg-white border-t-slate-200 border-r-slate-200 border-b-slate-200 hover:bg-slate-50';

        return `<button type="button" data-session-id="${sid}"
            class="grade-session-card w-full text-left rounded-2xl border border-l-4 ${accent} ${selBg} px-4 py-3.5 transition-all">
            <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                    <p class="text-sm font-bold text-slate-900 truncate">${escapeHtml(name)}</p>
                    <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(session.instrument_name || '')} · ${escapeHtml(session.package_name || '')}</p>
                </div>
                <span class="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${getAttendanceBadgeClasses(session)}">${getAttendanceBadgeLabel(session)}</span>
            </div>
            <div class="mt-2.5 flex items-center justify-between text-xs text-slate-400">
                <span><i class="fas fa-calendar mr-1"></i>${escapeHtml(formatShortDate(session.session_date))}</span>
                <div class="flex items-center gap-2">
                    ${avgScore ? `<span class="font-bold text-gold-600">★ ${avgScore}/5</span>` : ''}
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${getGradeStateClasses(session)}">${getGradeState(session)}</span>
                </div>
            </div>
        </button>`;
    }).join('');

    document.querySelectorAll('.grade-session-card').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = instructorGradeSessions.find(s => Number(s.session_id || 0) === Number(btn.dataset.sessionId || 0)) || null;
            populateGradeForm(target);
            renderGradeSessions();
            // On mobile, scroll to form
            if (window.innerWidth < 1024) {
                document.getElementById('gradingForm')?.closest('.bg-white')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// ── Load data ──────────────────────────────────────────────────────
async function loadGradeSessions(filter = currentGradeFilter) {
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
    if (!user?.user_id) { instructorGradeSessions = []; renderGradeSessions(); return; }

    currentGradeFilter = filter;
    try {
        const res  = await axios.get(`${baseApiUrl}/teachers.php?action=get-teacher-session-grades&user_id=${encodeURIComponent(user.user_id)}&filter=${encodeURIComponent(filter)}`);
        const data = res.data || {};
        instructorGradeSessions = data.success && Array.isArray(data.sessions) ? data.sessions : [];
    } catch (e) {
        console.error('Failed to load grading sessions:', e);
        instructorGradeSessions = [];
    }
    renderGradeSessions();
}

// ── Save grade ─────────────────────────────────────────────────────
async function saveSessionGrade(event) {
    event.preventDefault();
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
    if (!user?.user_id) { showGradeMessage('Your account is not available — please log in again.', 'error'); return; }

    const sessionId = Number(document.getElementById('sessionIdInput').value || 0);
    if (sessionId < 1) { showGradeMessage('Please select a session first.', 'error'); return; }

    const sessionData = instructorGradeSessions.find(s => Number(s.session_id || 0) === sessionId);
    if (sessionData && !isGradeable(sessionData) && Number(sessionData.progress_id || 0) < 1) {
        showGradeMessage('This session cannot be graded — attendance must be marked Present first.', 'error');
        return;
    }

    const payload = {
        action:            'save-session-grade',
        user_id:           Number(user.user_id),
        session_id:        sessionId,
        skill_level:       document.getElementById('skillLevelInput').value,
        performance_score: Number(document.getElementById('performanceScoreInput').value || 0),
        technique_score:   Number(document.getElementById('techniqueScoreInput').value   || 0),
        rhythm_score:      Number(document.getElementById('rhythmScoreInput').value      || 0),
        focus_score:       Number(document.getElementById('focusScoreInput').value       || 0),
        assignment_score:  Number(document.getElementById('assignmentScoreInput').value  || 0),
        remarks:           document.getElementById('remarksInput').value.trim()
    };

    const btn = document.getElementById('saveGradeBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving…'; }

    try {
        const res  = await axios.post(`${baseApiUrl}/teachers.php?action=save-session-grade`, payload);
        const data = res.data || {};
        if (!data.success) { showGradeMessage(data.error || 'Failed to save grade. Please try again.', 'error'); return; }

        showGradeMessage('✅ ' + (data.message || 'Grade saved successfully!'), 'success');
        await loadGradeSessions(currentGradeFilter);
        const refreshed = instructorGradeSessions.find(s => Number(s.session_id || 0) === sessionId) || null;
        populateGradeForm(refreshed);
        renderGradeSessions();
        renderAnalytics(refreshed);
    } catch (e) {
        console.error('Failed to save grade:', e);
        showGradeMessage('Network error — please check your connection and try again.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save mr-2"></i>Save Session Grade'; }
    }
}

// ── Analytics panel ────────────────────────────────────────────────
function getStudentGradedHistory(studentId) {
    return instructorGradeSessions
        .filter(s => Number(s.student_id) === Number(studentId) && Number(s.progress_id || 0) > 0)
        .slice()
        .sort((a, b) => {
            const da = new Date(a.session_date || 0).getTime();
            const db = new Date(b.session_date || 0).getTime();
            return da !== db ? da - db : Number(a.session_id) - Number(b.session_id);
        });
}

function renderAnalytics(session) {
    const panel = document.getElementById('analyticsPanel');
    if (!panel) return;
    if (!session) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');

    const previewSession = getAnalyticsPreviewSession(session);
    const studentId   = Number(session.student_id || 0);
    const studentName = `${session.student_first_name || ''} ${session.student_last_name || ''}`.trim() || 'Student';
    const history     = getStudentGradedHistory(studentId);
    const isGraded    = Number(session.progress_id || 0) > 0;
    const hasPreviewScores = SCORE_FIELDS.some(field => Number(previewSession?.[field.key] || 0) > 0);
    const radarSource = hasPreviewScores ? previewSession : (isGraded ? session : null);
    const trendHistory = history.slice();

    if (!isGraded && previewSession?.average_score !== null) {
        trendHistory.push(previewSession);
    }

    setGradeText('analyticsStudentLabel', `${studentName} — ${session.instrument_name || 'Instrument'}`);
    setGradeText('analyticsSessionCount', `${history.length} graded session${history.length === 1 ? '' : 's'}`);

    // ── Radar ──
    const radarCanvas = document.getElementById('radarChart');
    const radarEmpty  = document.getElementById('radarEmpty');
    if (_radarChartInstance) { _radarChartInstance.destroy(); _radarChartInstance = null; }
    if (!radarSource) {
        if (radarCanvas) radarCanvas.style.display = 'none';
        if (radarEmpty)  { radarEmpty.style.display = ''; radarEmpty.classList.remove('hidden'); }
    } else {
        if (radarEmpty)  radarEmpty.style.display = 'none';
        if (radarCanvas) {
            radarCanvas.style.display = '';
            _radarChartInstance = new Chart(radarCanvas, {
                type: 'radar',
                data: {
                    labels: SCORE_FIELDS.map(f => f.label),
                    datasets: [{
                        label: 'This Session',
                        data: SCORE_FIELDS.map(f => Number(radarSource[f.key] || 0)),
                        backgroundColor: 'rgba(212,175,55,0.15)',
                        borderColor: '#d4af37',
                        pointBackgroundColor: '#d4af37',
                        pointBorderColor: '#fff',
                        pointRadius: 4, borderWidth: 2
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { r: {
                        min: 0, max: 5,
                        ticks: { stepSize: 1, font: { size: 10 }, color: '#94a3b8' },
                        grid: { color: '#e2e8f0' },
                        pointLabels: { font: { size: 10, weight: '600' }, color: '#475569' },
                        angleLines: { color: '#e2e8f0' }
                    }}
                }
            });
        }
    }

    // ── Trend ──
    const trendCanvas = document.getElementById('trendChart');
    const trendEmpty  = document.getElementById('trendEmpty');
    if (_trendChartInstance) { _trendChartInstance.destroy(); _trendChartInstance = null; }
    if (trendHistory.length < 2) {
        if (trendCanvas) trendCanvas.style.display = 'none';
        if (trendEmpty)  { trendEmpty.style.display = ''; trendEmpty.classList.remove('hidden'); }
    } else {
        if (trendEmpty)  trendEmpty.style.display = 'none';
        if (trendCanvas) {
            trendCanvas.style.display = '';
            const tData = trendHistory.map(s => Number(s.average_score || 0));
            _trendChartInstance = new Chart(trendCanvas, {
                type: 'line',
                data: {
                    labels: trendHistory.map((entry, i) => {
                        if (!isGraded && entry === previewSession) return 'Current Draft';
                        return `Session ${i + 1}`;
                    }),
                    datasets: [{
                        label: 'Avg Score', data: tData,
                        borderColor: '#d4af37', backgroundColor: 'rgba(212,175,55,0.10)',
                        pointBackgroundColor: tData.map((_, i) => i === tData.length - 1 ? '#0f1115' : '#d4af37'),
                        pointRadius: tData.map((_, i) => i === tData.length - 1 ? 6 : 4),
                        tension: 0.35, fill: true, borderWidth: 2
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: ctx => `Avg: ${Number(ctx.parsed.y).toFixed(2)}/5` } }
                    },
                    scales: {
                        y: { min: 0, max: 5, ticks: { stepSize: 1, font: { size: 10 }, color: '#94a3b8' }, grid: { color: '#f1f5f9' } },
                        x: { ticks: { font: { size: 10 }, color: '#94a3b8' }, grid: { display: false } }
                    }
                }
            });
        }
    }

    // ── Category bars ──
    const barsEl = document.getElementById('categoryBars');
    if (barsEl) {
        if (!trendHistory.length) {
            barsEl.innerHTML = '<p class="text-sm text-slate-400 text-center py-2">No graded sessions yet.</p>';
        } else {
            barsEl.innerHTML = SCORE_FIELDS.map(field => {
                const vals  = trendHistory.map(s => Number(s[field.key] || 0)).filter(v => v > 0);
                const mean  = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                const pct   = (mean / 5) * 100;
                const color = mean <= 2 ? 'bg-rose-400' : mean <= 3 ? 'bg-amber-400' : 'bg-emerald-500';
                const word  = mean > 0 ? SCORE_WORDS[Math.round(mean)] || mean.toFixed(1) : '—';
                return `<div>
                    <div class="flex items-center justify-between mb-1.5">
                        <span class="text-sm font-semibold text-slate-700"><i class="fas ${field.icon} mr-2 text-slate-400 w-4"></i>${field.label}</span>
                        <span class="text-sm font-bold text-slate-800">${mean > 0 ? mean.toFixed(1) : '—'}/5 <span class="text-xs font-normal text-slate-400">${word}</span></span>
                    </div>
                    <div class="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div class="h-full rounded-full ${color} transition-all duration-700" style="width:${pct.toFixed(1)}%"></div>
                    </div>
                </div>`;
            }).join('');
        }
    }

    // ── Tips ──
    const tipsEl = document.getElementById('improvementTips');
    if (tipsEl) {
        const source = hasPreviewScores ? previewSession : (isGraded ? session : (history.length ? history[history.length - 1] : null));
        if (!source) {
            tipsEl.innerHTML = '<p class="text-sm text-slate-400 text-center py-2">Grade this session to see personalised tips.</p>';
        } else {
            const sorted = SCORE_FIELDS
                .map(f => ({ ...f, score: Number(source[f.key] || 0) }))
                .filter(f => f.score > 0)
                .sort((a, b) => a.score - b.score);

            tipsEl.innerHTML = sorted.length ? sorted.map(f => {
                const style = getTipStyle(f.score);
                const tip   = IMPROVEMENT_TIPS[f.key][getTipLevel(f.score)];
                const stars = '★'.repeat(f.score) + '☆'.repeat(5 - f.score);
                return `<div class="rounded-2xl border-2 ${style.wrap} p-4 flex gap-3">
                    <div class="w-8 h-8 rounded-xl bg-white/60 flex items-center justify-center shrink-0 mt-0.5">
                        <i class="fas ${f.icon} ${style.icon} text-sm"></i>
                    </div>
                    <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2 mb-1">
                            <span class="text-sm font-bold ${style.title}">${f.label}</span>
                            <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${style.badge}">${getTipLabel(f.score)}</span>
                            <span class="text-xs ${style.body}">${stars} ${f.score}/5</span>
                        </div>
                        <p class="text-sm ${style.body} leading-relaxed">${tip}</p>
                    </div>
                </div>`;
            }).join('') : '<p class="text-sm text-slate-400 text-center py-2">No scores recorded yet.</p>';
        }
    }
}

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    initScoreButtons();
    await loadGradeSessions('all');

    document.getElementById('gradeFilter')?.addEventListener('change', e => loadGradeSessions(e.target.value));
    document.getElementById('gradeSearch')?.addEventListener('input',  () => renderGradeSessions());
    document.getElementById('gradingForm')?.addEventListener('submit',  saveSessionGrade);
    document.getElementById('skillLevelInput')?.addEventListener('change', () => {
        const selectedSession = instructorGradeSessions.find(s => Number(s.session_id || 0) === Number(selectedGradeSessionId || 0)) || null;
        if (selectedSession) renderAnalytics(selectedSession);
    });
    document.getElementById('remarksInput')?.addEventListener('input', () => {
        const selectedSession = instructorGradeSessions.find(s => Number(s.session_id || 0) === Number(selectedGradeSessionId || 0)) || null;
        if (selectedSession) renderAnalytics(selectedSession);
    });
});
