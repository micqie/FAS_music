/* ================================================================
   instructor/grading.js  — minimal, teacher-friendly rewrite
   ================================================================ */

let instructorGradeSessions = [];
let selectedGradeSessionId  = 0;
let currentGradeFilter      = 'all';
let _radarChartInstance     = null;
let _trendChartInstance     = null;
let _lessonTimerInterval    = null;
let _rowTimerInterval       = null;

// ── Criteria ───────────────────────────────────────────────────────
const DEFAULT_CRITERIA = ['Performance','Technique','Rhythm & Timing','Focus & Discipline','Assignment & Practice'];
let isEditingCriteria = false;
let instructorCriteria = [...DEFAULT_CRITERIA];
let criteriaSessionId = 0;

function loadCriteria() {
    if (Array.isArray(instructorCriteria) && instructorCriteria.length) return [...instructorCriteria];
    return [...DEFAULT_CRITERIA];
}
function saveCriteria(c) {
    instructorCriteria = [...c];
}
async function loadServerCriteria() {
    // Criteria are session-specific. Every new ungraded session starts with defaults.
    saveCriteria(DEFAULT_CRITERIA);
}
async function persistCriteria(criteria) {
    saveCriteria(criteria);
}

// ── Score fields ───────────────────────────────────────────────────
function buildScoreFields() {
    const criteria = loadCriteria();
    const keys     = ['performance_score','technique_score','rhythm_score','focus_score','assignment_score'];
    const icons    = ['fa-music','fa-hands','fa-drum','fa-brain','fa-book-open'];
    return criteria.map((label, i) => ({ key: keys[i] || `criterion_${i}`, label, icon: icons[i] || 'fa-star', labelId: `criterionLabel${i}`, inputId: `criterionScore${i}Input`, index:i }));
}
function getCriterionScore(record, field) {
    const saved = Array.isArray(record?.criteria_scores) ? record.criteria_scores : [];
    const matched = saved.find(item => String(item?.name || '') === field.label) || saved[field.index] || null;
    if (matched) return Number(matched.score || 0);
    return field.index < 5 ? Number(record?.[field.key] || 0) : 0;
}
const SCORE_FIELDS = buildScoreFields();
const SCORE_WORDS  = ['','Poor','Fair','Good','Very Good','Excellent'];

const IMPROVEMENT_TIPS = {
    performance_score: { low:'Practice full pieces without stopping.', mid:'Record yourself and listen back.', high:'Challenge yourself with harder repertoire.' },
    technique_score:   { low:'Slow down — focus on posture and hand position.', mid:'Work on specific weak points with targeted exercises.', high:'Try exploring advanced articulations.' },
    rhythm_score:      { low:'Practice with a metronome every day.', mid:'Clap the rhythm before playing it.', high:'Try syncopation and off-beat exercises.' },
    focus_score:       { low:'Keep sessions short with one clear goal.', mid:'Reduce distractions and log what you practiced.', high:'Try mental practice without the instrument.' },
    assignment_score:  { low:'10 minutes of assigned material every day beats long irregular sessions.', mid:'Break the assignment into small pieces and check them off.', high:'Ask your teacher for more material to stay challenged.' }
};

// ── Criteria rendering ─────────────────────────────────────────────
function renderScoreCriteria() {
    const container = document.getElementById('scoreCriteriaContainer');
    if (!container) return;
    const criteria    = loadCriteria();
    const preservedScores = {};
    container.querySelectorAll('.criterion-score-input').forEach(input => { preservedScores[input.dataset.criterionName || ''] = input.value; });

    if (isEditingCriteria) {
        container.innerHTML = `
            <div class="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
                <div id="criteriaEditList" class="space-y-2">
                    ${criteria.map((name, i) => `
                        <div class="flex items-center gap-2">
                            <input type="text" value="${escapeHtml(name)}" data-criteria-index="${i}"
                                class="criteria-name-input flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 transition"
                                placeholder="Criterion name…">
                            <button type="button" onclick="deleteCriterion(${i})"
                                class="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition">
                                <i class="fas fa-trash text-xs"></i>
                            </button>
                        </div>`).join('')}
                </div>
                <button type="button" onclick="addCriterion()"
                    class="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-1">
                    <i class="fas fa-plus text-xs"></i> Add Criterion
                </button>
            </div>`;
        return;
    }

    container.innerHTML = criteria.map((name, i) => {
        const fieldId    = `criterionScore${i}Input`;
        const labelId    = `criterionLabel${i}`;
        const currentVal = preservedScores[name] || '';
        const activeWord = currentVal ? (SCORE_WORDS[Number(currentVal)] || '—') : '—';
        const wordBtns   = ['1','2','3','4','5'].map((word, wi) => {
            const val = String(wi + 1);
            const isActive = currentVal === val;
            const activeCls = ['bg-red-100 border-red-400 text-red-700','bg-orange-100 border-orange-400 text-orange-700','bg-yellow-100 border-yellow-400 text-yellow-700','bg-green-100 border-green-400 text-green-700','bg-emerald-100 border-emerald-400 text-emerald-700'][wi];
            return `<button type="button"
                class="score-btn score-btn-${val} py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${isActive ? activeCls : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'}"
                data-field="${fieldId}" data-label-id="${labelId}" data-val="${val}"
                aria-label="Rate ${escapeHtml(name)} ${val} out of 5" aria-pressed="${isActive ? 'true' : 'false'}"
                onclick="selectCriterionScore('${fieldId}', '${labelId}', ${val}, this)">${word}</button>`;
        }).join('');
        return `<div class="criterion-row">
            <input type="hidden" id="${fieldId}" class="criterion-score-input" data-criterion-name="${escapeHtml(name)}" value="${escapeHtml(currentVal)}">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-semibold text-gray-700">${escapeHtml(name)}</span>
                <span id="${labelId}" class="text-xs font-medium text-gray-400">${activeWord}</span>
            </div>
            <div class="grid grid-cols-5 gap-1.5">${wordBtns}</div>
        </div>`;
    }).join('');
    setGradeText('criteriaTotalLabel', `${criteria.length} active ${criteria.length === 1 ? 'criterion' : 'criteria'}.`);
    initScoreButtons();
}

async function toggleEditCriteria() {
    const selected = instructorGradeSessions.find(s => Number(s.session_id || 0) === Number(selectedGradeSessionId || 0)) || null;
    if (selected && Number(selected.progress_id || 0) > 0) {
        showGradeMessage('This grade is saved and its criteria can no longer be changed.', 'error');
        return;
    }
    if (!selected || Number(selected.room_id || 0) < 1 || Number(selected.assigned_instrument_id || 0) < 1) {
        showGradeMessage('Desk must assign the room and physical instrument before criteria can be edited.', 'error');
        return;
    }
    if (isEditingCriteria) {
        const inputs = document.querySelectorAll('.criteria-name-input');
        const newC   = Array.from(inputs).map(inp => inp.value.trim()).filter(Boolean);
        if (!newC.length) return showGradeMessage('Keep at least one grading criterion.', 'error');
        try { await persistCriteria(newC); } catch (e) { return showGradeMessage(e?.response?.data?.error || e.message, 'error'); }
        isEditingCriteria = false;
    } else { isEditingCriteria = true; }
    const btn = document.getElementById('editCriteriaBtn');
    if (btn) {
        btn.innerHTML = isEditingCriteria
            ? '<i class="fas fa-check text-[10px]"></i>Done'
            : '<i class="fas fa-pencil text-[10px]"></i>Edit Criteria';
        btn.className = isEditingCriteria
            ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-indigo-300 bg-white text-indigo-700 text-xs font-bold hover:bg-indigo-50 transition'
            : 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-50 transition';
    }
    renderScoreCriteria();
    if (!isEditingCriteria) {
        const selected = instructorGradeSessions.find(s => Number(s.session_id || 0) === Number(selectedGradeSessionId || 0)) || null;
        syncScoreButtons(selected);
        updateScorePreview();
    }
}
function addCriterion() {
    const inputs = document.querySelectorAll('.criteria-name-input');
    const c = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
    if (c.length >= 20) return showGradeMessage('A maximum of 20 grading criteria is supported.', 'error');
    c.push('New Criterion'); saveCriteria(c); renderScoreCriteria();
}
function deleteCriterion(index) {
    const inputs = document.querySelectorAll('.criteria-name-input');
    const c = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
    c.splice(index, 1); if (!c.length) c.push('Performance');
    saveCriteria(c); renderScoreCriteria();
}

// ── Utilities ──────────────────────────────────────────────────────
function getTipLevel(s) { return s <= 2 ? 'low' : s <= 3 ? 'mid' : 'high'; }
function getTipStyle(s) {
    if (s <= 2) return { wrap:'border-rose-200 bg-rose-50', title:'text-rose-800', body:'text-rose-700', badge:'bg-rose-100 text-rose-700' };
    if (s <= 3) return { wrap:'border-amber-200 bg-amber-50', title:'text-amber-800', body:'text-amber-700', badge:'bg-amber-100 text-amber-700' };
    return { wrap:'border-emerald-200 bg-emerald-50', title:'text-emerald-800', body:'text-emerald-700', badge:'bg-emerald-100 text-emerald-700' };
}
function getTipLabel(s) { return s <= 2 ? 'Needs Work' : s <= 3 ? 'Developing' : 'Strong'; }
function getTipEmoji(s) { return s <= 2 ? '💪' : s <= 3 ? '📈' : '🌟'; }

function toggleInstructorMenu() {
    const menu = document.getElementById('instructorMobileMenu');
    const icon = document.getElementById('instructorMenuIcon');
    if (!menu || !icon) return;
    const hidden = menu.classList.contains('hidden');
    menu.classList.toggle('hidden');
    icon.classList.toggle('fa-bars', !hidden);
    icon.classList.toggle('fa-times', hidden);
}
function setGradeText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }

function showGradeMessage(message, type = 'info') {
    const box = document.getElementById('gradeMessage');
    if (!box) return;
    const styles = { error:'border-red-200 bg-red-50 text-red-800', success:'border-emerald-200 bg-emerald-50 text-emerald-800', info:'border-gray-200 bg-gray-50 text-gray-700' };
    box.className = `rounded-xl border px-4 py-3 text-sm font-medium ${styles[type] || styles.info}`;
    box.textContent = message;
    box.classList.remove('hidden');
    if (type === 'success') setTimeout(() => box.classList.add('hidden'), 4000);
}

function formatShortDate(v) {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-PH', { weekday:'short', month:'long', day:'numeric' });
}
function formatTime12Hour(t) {
    if (!t) return '—';
    const p = String(t).split(':');
    const h = Number(p[0]), m = Number(p[1] || 0);
    if (Number.isNaN(h)) return t;
    return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
function getLocalISODate(date = new Date()) {
    const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    return local.toISOString().slice(0, 10);
}

// ── Gradeability ───────────────────────────────────────────────────
function isGradeable(session) {
    if (String(session?._attendanceDraft || '').toLowerCase() === 'present' || session?.grading_started_at) return true;
    const att = String(session?.attendance_status || '').toLowerCase();
    return String(session?.status || '').toLowerCase() === 'completed' &&
           (att === 'present' || att === 'late');
}
function getGradeState(session) {
    if (Number(session.progress_id || 0) > 0) return 'Saved';
    if (isGradeable(session)) return 'To mark';
    const att = String(session?.attendance_status || '').toLowerCase();
    if (att === 'absent') return 'Absent';
    if (att === 'late')   return 'Late';
    return 'Scheduled';
}
function getGradeStateCls(session) {
    const state = getGradeState(session);
    if (state === 'Saved')     return 'text-teal-600 bg-teal-50 border border-teal-200';
    if (state === 'To mark')   return 'text-amber-600 bg-amber-50 border border-amber-200';
    if (state === 'Absent')    return 'text-red-500 bg-red-50 border border-red-200';
    if (state === 'Late')      return 'text-orange-500 bg-orange-50 border border-orange-200';
    return 'text-gray-500 bg-gray-50 border border-gray-200';
}
function getAttendanceBadgeClasses(session) {
    if (Number(session.progress_id || 0) > 0) return 'bg-teal-50 text-teal-600 border border-teal-200';
    const att = String(session?.attendance_status || '').toLowerCase();
    if (att === 'present') return 'bg-emerald-50 text-emerald-600';
    if (att === 'absent')  return 'bg-rose-50 text-rose-600';
    if (att === 'late')    return 'bg-amber-50 text-amber-600';
    return 'bg-gray-50 text-gray-500';
}
function getGradeSessionSortRank(s) {
    if (Number(s?.progress_id || 0) > 0) return 2;
    if (isGradeable(s)) return 0;
    return 1;
}
function getGradeSessionSortTime(s) {
    return new Date(`${s?.session_date || ''}T${s?.start_time || '00:00:00'}`).getTime() || 0;
}
function isTodaySession(session) {
    return String(session?.session_date || '') === getLocalISODate();
}

// ── Attendance control ─────────────────────────────────────────────
// Rules:
//   graded (progress_id > 0)          → read-only "Present — Graded" badge
//   att = present / late              → read-only desk-confirmed badge, grading unlocked
//   att = absent / excused / ci / etc → read-only badge, grading locked
//   att = pending / not set           → "Session Done" action on the student row
function renderAttendanceControl(session) {
    const container = document.getElementById('attendanceControl');
    const descEl    = document.getElementById('attendanceSectionDesc');
    if (!container) return;

    const graded = session ? Number(session.progress_id || 0) > 0 : false;
    const att    = String(session?.attendance_status || 'Pending').toLowerCase();
    const hasRequiredAssignment = Number(session?.room_id || 0) > 0 && Number(session?.assigned_instrument_id || 0) > 0;

    const badge = (icon, label, cls) =>
        `<span class="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${cls}">
             <i class="fas ${icon} text-sm"></i>${label}
         </span>`;

    if (!session) {
        container.innerHTML = `<p class="text-sm text-gray-400 italic">Select a session to see attendance.</p>`;
        if (descEl) descEl.textContent = 'Session attendance status.';
        return;
    }

    if (graded) {
        const gradedLabel = att === 'late' ? 'Late — grade saved' : 'Present — grade saved';
        container.innerHTML = badge('fa-circle-check', gradedLabel, 'border-teal-200 bg-teal-50 text-teal-700');
        if (descEl) descEl.textContent = 'Attendance and grade have been recorded.';
        return;
    }

    if (session.grading_started_at) {
        container.innerHTML = badge('fa-stopwatch', 'Present — lesson in progress', 'border-blue-200 bg-blue-50 text-blue-700');
        if (descEl) descEl.textContent = 'Attendance is locked after the lesson timer starts. Your ratings and timer will be kept.';
        return;
    }

    if (['excused','ci','teacher absent'].includes(att)) {
        const labels = { absent:'Absent', excused:'Excused', ci:'CI', 'teacher absent':'Teacher Absent' };
        container.innerHTML = badge('fa-times-circle', labels[att] || att, 'border-rose-200 bg-rose-50 text-rose-600');
        if (descEl) descEl.textContent = 'Student is not present — grading is not available for this session.';
        return;
    }

    const selectedAttendance = String(session._attendanceDraft || (session.grading_started_at ? 'present' : att) || '').toLowerCase();
    const assignmentTitle = hasRequiredAssignment ? '' : 'title="Desk must assign a room and physical instrument first"';
    container.innerHTML = `
        <div class="flex flex-wrap items-center gap-3">
            <button type="button" onclick="instructorMarkAttendance(${Number(session.session_id)}, 'present', this)" ${hasRequiredAssignment ? '' : 'disabled'} ${assignmentTitle} class="rounded-xl border px-4 py-2.5 text-sm font-semibold ${hasRequiredAssignment ? (selectedAttendance === 'present' ? 'border-emerald-500 bg-emerald-100 text-emerald-800 ring-2 ring-emerald-200' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100') : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'}"><i class="fas fa-check mr-2"></i>Present</button>
            <button type="button" onclick="instructorMarkAttendance(${Number(session.session_id)}, 'absent', this)" ${hasRequiredAssignment ? '' : 'disabled'} ${assignmentTitle} class="rounded-xl border px-4 py-2.5 text-sm font-semibold ${hasRequiredAssignment ? (selectedAttendance === 'absent' ? 'border-rose-500 bg-rose-100 text-rose-800 ring-2 ring-rose-200' : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100') : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'}"><i class="fas fa-user-xmark mr-2"></i>Absent</button>
        </div>`;
    if (descEl) descEl.textContent = !hasRequiredAssignment
        ? 'Attendance is locked. Desk must assign the room and physical instrument first.'
        : selectedAttendance === 'present'
        ? 'Present is selected. It becomes final only when the grade is saved.'
        : 'Choose Present to grade, or Absent. You can change this before a grade is saved.';
}

async function instructorMarkAttendance(sessionId, attendanceStatus, triggerButton = null) {
    const session = instructorGradeSessions.find(item => Number(item.session_id) === Number(sessionId));
    if (!session || Number(session.progress_id || 0) > 0) return;
    if (Number(session.room_id || 0) < 1 || Number(session.assigned_instrument_id || 0) < 1) {
        showGradeMessage('Desk must assign the room and physical instrument before attendance can be marked.', 'error');
        return;
    }
    if (attendanceStatus === 'absent' && session.grading_started_at) {
        showGradeMessage('This lesson is already in progress. Absent can no longer be selected; your ratings and timer were kept.', 'error');
        return;
    }
    if (attendanceStatus === 'present') {
        const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
        if (triggerButton) triggerButton.disabled = true;
        try {
            const response = await axios.post(`${baseApiUrl}/teachers.php?action=start-grading-timer`, {
                action: 'start-grading-timer', session_id: Number(sessionId), user_id: Number(user?.user_id || 0)
            });
            const data = response.data || {};
            if (!data.success) throw new Error(data.error || 'Unable to start the lesson timer.');
            session._attendanceDraft = 'present';
            session.grading_started_at = data.grading_started_at || session.grading_started_at;
            populateGradeForm(session);
            renderGradeSessions();
        } catch (error) {
            showGradeMessage(error?.response?.data?.error || error.message || 'Unable to start the timer.', 'error');
            if (triggerButton) triggerButton.disabled = false;
        }
        return;
    }

    if (!isTodaySession(session) && !['present', 'late'].includes(att)) {
        showGradeMessage('Attendance can only be selected on the scheduled session date.', 'error');
        return;
    }
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
    if (triggerButton) triggerButton.disabled = true;
    try {
        const res = await axios.post(`${baseApiUrl}/attendance.php?action=mark-attendance-by-instructor`, {
            session_id: Number(sessionId),
            user_id: Number(user?.user_id || 0),
            attendance_status: 'absent'
        });
        const data = res.data || {};
        if (!data.success) throw new Error(data.error || 'Could not save attendance.');
        await loadGradeSessions(currentGradeFilter);
        const refreshed = instructorGradeSessions.find(s => Number(s.session_id) === Number(sessionId)) || null;
        if (refreshed) { refreshed._attendanceDraft = 'absent'; populateGradeForm(refreshed); }
        showGradeMessage(data.message || 'Attendance saved.', 'success');
    } catch (error) {
        showGradeMessage(error?.response?.data?.error || error.message || 'Unable to save attendance.', 'error');
        if (triggerButton) triggerButton.disabled = false;
    }
}
window.instructorMarkAttendance = instructorMarkAttendance;

function parseGradeDateTime(value) {
    if (!value) return null;
    const parsed = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function formatLessonClock(date) {
    return date ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—';
}
function formatTimerDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hours > 0
        ? `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}`
        : `${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
}
function getSessionTimerSeconds(startValue, completedValue) {
    const started = parseGradeDateTime(startValue);
    const completed = parseGradeDateTime(completedValue);
    if (!started) return null;
    const end = completed || new Date();
    return Math.max(0, Math.floor((end.getTime() - started.getTime()) / 1000));
}
function renderLessonTimer(session) {
    if (_lessonTimerInterval) { clearInterval(_lessonTimerInterval); _lessonTimerInterval = null; }
    const valueEl = document.getElementById('lessonTimerValue');
    const rangeEl = document.getElementById('lessonTimerRange');
    const hintEl = document.getElementById('lessonTimerHint');
    if (!valueEl || !rangeEl || !hintEl) return;
    const started = parseGradeDateTime(session?.grading_started_at);
    const completed = parseGradeDateTime(session?.grading_completed_at);
    const startParts = String(session?.start_time || '').split(':').map(Number);
    const endParts = String(session?.end_time || '').split(':').map(Number);
    const scheduledMinutes = startParts.length >= 2 && endParts.length >= 2
        ? Math.max(1, (endParts[0] * 60 + endParts[1]) - (startParts[0] * 60 + startParts[1]))
        : 60;
    const paint = () => {
        const seconds = getSessionTimerSeconds(session?.grading_started_at, session?.grading_completed_at) || 0;
        const targetSeconds = scheduledMinutes * 60;
        const remainingSeconds = Math.max(0, targetSeconds - seconds);
        valueEl.textContent = completed ? `${formatTimerDuration(seconds)} used` : (started ? `${formatTimerDuration(remainingSeconds)} left` : '60:00');
        rangeEl.textContent = started ? `${formatLessonClock(started)} – ${completed ? formatLessonClock(completed) : 'In progress'}` : 'Not started';
        hintEl.textContent = completed
            ? `Grade saved after ${formatTimerDuration(seconds)}. The lesson was not forced to use the full ${scheduledMinutes} minutes.`
            : (started ? `${formatTimerDuration(seconds)} elapsed of the ${scheduledMinutes}-minute lesson. Timer stops when Save Grade is clicked.` : `Select Present to start the ${scheduledMinutes}-minute timer.`);
    };
    paint();
    if (started && !completed) _lessonTimerInterval = setInterval(paint, 1000);
}
function updateSessionRowTimers() {
    document.querySelectorAll('[data-row-timer-start]').forEach(element => {
        const seconds = getSessionTimerSeconds(element.dataset.rowTimerStart, element.dataset.rowTimerEnd || '');
        if (seconds === null) return;
        element.textContent = `${formatTimerDuration(seconds)} ${element.dataset.rowTimerEnd ? 'used' : 'elapsed'}`;
    });
}
function markGradeDirty() {
    const status = document.getElementById('gradeSaveStatus');
    if (status) { status.classList.add('hidden'); status.classList.remove('flex'); }
    const btn = document.getElementById('saveGradeBtn');
    if (btn && !btn.disabled) btn.innerHTML = '<i class="fas fa-save text-xs"></i> Save Grade';
}

async function instructorMarkPresent(sessionId = selectedGradeSessionId, triggerButton = null) {
    const session = instructorGradeSessions.find(s => Number(s.session_id || 0) === Number(sessionId || 0)) || null;
    if (!session) return;
    const btn = triggerButton || document.querySelector(`[data-session-done-id="${Number(sessionId)}"]`);
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin text-xs mr-2"></i>Ending…'; }
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
    try {
        const res  = await axios.post(`${baseApiUrl}/attendance.php?action=mark-present-by-instructor`, {
            session_id: Number(session.session_id),
            user_id:    Number(user?.user_id || 0)
        });
        const data = res.data || {};
        if (!data.success) {
            showGradeMessage(data.error || 'Could not mark attendance. Please try again.', 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-flag-checkered text-sm"></i>Session Ended'; }
            return;
        }
        await loadGradeSessions(currentGradeFilter);
        showGradeMessage(data.message || 'Session ended successfully.', 'success');
        if (typeof showMessage === 'function') showMessage(data.message || 'Session ended successfully.', 'success');
        const refreshed = instructorGradeSessions.find(s => Number(s.session_id || 0) === Number(selectedGradeSessionId || 0)) || null;
        if (refreshed) populateGradeForm(refreshed);
        renderGradeSessions();
    } catch (e) {
        console.error('Mark present failed:', e);
        showGradeMessage(e?.response?.data?.error || 'Network error — please try again.', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-flag-checkered text-sm"></i>Session Ended'; }
    }
}
window.instructorMarkPresent = instructorMarkPresent;

// ── Score buttons ──────────────────────────────────────────────────
function initScoreButtons() {
    // Buttons use an explicit click handler so all five values behave consistently.
}
function selectCriterionScore(field, labelId, value, button) {
    const score = Number(value);
    const input = document.getElementById(field);
    if (!input || input.disabled || score < 1 || score > 5) return;
    input.value = String(score);
    document.querySelectorAll(`.score-btn[data-field="${field}"]`).forEach(item => {
        const selected = item === button;
        item.classList.toggle('active', selected);
        item.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    const labelEl = document.getElementById(labelId || '');
    if (labelEl) labelEl.textContent = SCORE_WORDS[score] || String(score);
    markGradeDirty();
    updateScorePreview();
}
window.selectCriterionScore = selectCriterionScore;
function getFieldInputId(key) {
    const parts = key.replace('_score','').split('_');
    return parts.map((p, i) => i === 0 ? p : p[0].toUpperCase() + p.slice(1)).join('') + 'ScoreInput';
}
function syncScoreButtons(session) {
    buildScoreFields().forEach(field => {
        const inputId = field.inputId;
        const saved = Array.isArray(session?.criteria_scores) ? session.criteria_scores : [];
        const matched = saved.find(item => String(item?.name || '') === field.label) || saved[field.index] || null;
        const val = matched ? String(matched.score || '') : (field.index < 5 && session ? String(session[field.key] || '') : '');
        const input   = document.getElementById(inputId);
        if (input) input.value = val;
        document.querySelectorAll(`.score-btn[data-field="${inputId}"]`).forEach(btn => {
            btn.classList.remove('active');
            if (val && btn.dataset.val === val) btn.classList.add('active');
        });
        const lEl = field.labelId ? document.getElementById(field.labelId) : null;
        if (lEl) lEl.textContent = val ? (SCORE_WORDS[Number(val)] || '—') : '—';
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
    const ids = buildScoreFields().map(field => field.inputId);
    const values = ids.map(id => Number(document.getElementById(id)?.value || 0)).filter(v => v >= 1 && v <= 5);
    if (!values.length || values.length !== ids.length) return null;
    return Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(2));
}
function updateScorePreview() {
    const previewEl  = document.getElementById('scorePreview');
    const badgeEl    = document.getElementById('gradeAverageBadge');
    const previewBox = document.getElementById('avgPreviewBox');
    const avg        = computeAverageFromInputs();
    const fields = buildScoreFields();
    const rated = fields.filter(field => Number(document.getElementById(field.inputId)?.value || 0) > 0).length;
    setGradeText('criteriaTotalLabel', `${rated} of ${fields.length} ${fields.length === 1 ? 'criterion' : 'criteria'} rated.`);
    setGradeText('criteriaRemainingCount', `${Math.max(0, fields.length - rated)} ${fields.length - rated === 1 ? 'criterion' : 'criteria'} still to rate.`);
    if (!previewEl) return;
    if (avg === null) {
        previewEl.textContent = '—';
        if (previewBox) previewBox.classList.add('hidden');
        if (badgeEl) badgeEl.classList.add('hidden');
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
    const sel = instructorGradeSessions.find(s => Number(s.session_id || 0) === Number(selectedGradeSessionId || 0)) || null;
    if (sel) renderAnalytics(sel);
}
function getAnalyticsPreviewSession(session) {
    if (!session) return null;
    const preview = { ...session };
    let has = false;
    const activeFields = buildScoreFields();
    const criteriaScores = [];
    activeFields.forEach(f => {
        const v = Number(document.getElementById(f.inputId)?.value || 0);
        preview[f.key] = v > 0 ? v : 0;
        criteriaScores.push({ name:f.label, score:v });
        if (v > 0) has = true;
    });
    preview.criteria_scores = criteriaScores;
    preview.skill_level    = document.getElementById('skillLevelInput')?.value || preview.skill_level || '';
    preview.remarks        = document.getElementById('remarksInput')?.value    || preview.remarks     || '';
    preview.average_score  = computeAverageFromInputs();
    preview.__has_live_preview = has;
    return preview;
}

// ── Progress modal ─────────────────────────────────────────────────
function openProgressModal() {
    const modal = document.getElementById('progressModal');
    if (!modal) return;
    const session = instructorGradeSessions.find(s => Number(s.session_id || 0) === Number(selectedGradeSessionId || 0)) || null;
    if (session) {
        const name = `${session.student_first_name || ''} ${session.student_last_name || ''}`.trim() || 'Student';
        setGradeText('progressModalTitle', name);
        setGradeText('progressModalSubtitle', `${session.instrument_name || 'Instrument'} — ${formatShortDate(session.session_date)}`);
        renderAnalytics(session);
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}
function closeProgressModal() {
    const modal = document.getElementById('progressModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
}
window.closeProgressModal = closeProgressModal;
window.openProgressModal  = openProgressModal;

// ── Grade form population ──────────────────────────────────────────
function populateGradeForm(session) {
    selectedGradeSessionId = Number(session?.session_id || 0);
    document.getElementById('sessionIdInput').value = selectedGradeSessionId ? String(selectedGradeSessionId) : '';
    const saveStatus = document.getElementById('gradeSaveStatus');
    if (saveStatus) { saveStatus.classList.add('hidden'); saveStatus.classList.remove('flex'); }

    const studentName = session ? `${session.student_first_name || ''} ${session.student_last_name || ''}`.trim() || 'Student' : 'Select a session';
    const instrument = session?.instrument_name || 'Instrument';
    const room = session?.room_name || 'Room not assigned';
    const time = session ? `${formatTime12Hour(session.start_time)}${session.end_time ? ` – ${formatTime12Hour(session.end_time)}` : ''}` : '—';
    const sessionMeta = session ? `${instrument} · ${time} · ${room}` : '—';
    
    // Update panel header
    setGradeText('gradeStudentHeading', studentName);
    setGradeText('gradeSessionMeta', sessionMeta);
    
    // Update avatar initials
    const avatarEl = document.getElementById('gradeStudentAvatar');
    if (avatarEl && session) {
        const initials = studentName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        avatarEl.textContent = initials;
    }
    
    // Update lesson focus section
    const focusText = document.getElementById('gradeLessonFocusText');
    if (focusText) {
        focusText.textContent = session?.notes || session?.attendance_notes || 'No lesson focus specified.';
    }
    
    // Keep hidden fields for any legacy lookups
    const hidName = document.getElementById('gradeStudentName');
    const hidSub  = document.getElementById('gradeFormSubtitle');
    if (hidName) hidName.value = studentName;
    if (hidSub)  hidSub.value  = sessionMeta;

    // Each session starts with defaults; saved sessions restore only their own criteria.
    if (criteriaSessionId !== selectedGradeSessionId) {
        criteriaSessionId = selectedGradeSessionId;
        isEditingCriteria = false;
        const savedCriteria = Array.isArray(session?.criteria_scores)
            ? session.criteria_scores.map(item => String(item?.name || '').trim()).filter(Boolean)
            : [];
        saveCriteria(savedCriteria.length ? savedCriteria : DEFAULT_CRITERIA);
    }

    // Pre-fill score inputs then render criteria
    renderScoreCriteria();
    syncScoreButtons(session);

    const skillEl   = document.getElementById('skillLevelInput');
    const remarksEl = document.getElementById('remarksInput');
    if (skillEl)   skillEl.value   = session?.skill_level || '';
    if (remarksEl) remarksEl.value = session?.remarks     || '';
    
    // Update skill level button selection
    document.querySelectorAll('.skill-level-btn').forEach(btn => {
        if (btn.dataset.level === session?.skill_level) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });

    const graded    = session ? Number(session.progress_id || 0) > 0 : false;
    const hasRequiredAssignment = Number(session?.room_id || 0) > 0 && Number(session?.assigned_instrument_id || 0) > 0;
    const gradeable = session ? isGradeable(session) && hasRequiredAssignment : false;
    const active    = gradeable && !graded;
    if (graded && isEditingCriteria) {
        isEditingCriteria = false;
        renderScoreCriteria();
        syncScoreButtons(session);
    }
    renderLessonTimer(session);

    // Render smart attendance control (read-only badge or Mark Present button)
    renderAttendanceControl(session);

    // Lock / unlock grading based on attendance + grade state
    const lockBanner = document.getElementById('gradeLockBanner');
    const lockMsg    = document.getElementById('gradeLockMsg');
    const saveBtn    = document.getElementById('saveGradeBtn');
    const criteriaBtn = document.getElementById('editCriteriaBtn');

    if (criteriaBtn) {
        const criteriaLocked = graded || !hasRequiredAssignment;
        criteriaBtn.disabled = criteriaLocked;
        criteriaBtn.classList.toggle('opacity-40', criteriaLocked);
        criteriaBtn.classList.toggle('cursor-not-allowed', criteriaLocked);
        criteriaBtn.title = graded ? 'Saved grades are read-only' : (!hasRequiredAssignment ? 'Assign the room and physical instrument first' : 'Edit this session’s grading criteria');
    }
    document.querySelectorAll('.skill-level-btn').forEach(btn => {
        btn.disabled = !active;
        btn.classList.toggle('opacity-40', !active);
        btn.classList.toggle('cursor-not-allowed', !active);
    });

    if (active) {
        if (lockBanner) lockBanner.classList.add('hidden');
        setScoreButtonsDisabled(false);
        document.querySelectorAll('#gradingForm select, #gradingForm textarea').forEach(el => {
            el.disabled = false;
            el.classList.remove('opacity-50','cursor-not-allowed');
        });
        if (saveBtn) { saveBtn.disabled = false; saveBtn.classList.remove('opacity-40','cursor-not-allowed'); }
    } else {
        if (lockBanner) lockBanner.classList.remove('hidden');
        const att = String(session?.attendance_status || '').toLowerCase();
        if (lockMsg) {
            if (graded) {
                lockMsg.textContent = 'Grade saved — this evaluation is now read-only.';
            } else if (!session) {
                lockMsg.textContent = 'Select Present to continue.';
            } else if (['absent','excused','ci','teacher absent'].includes(att)) {
                lockMsg.textContent = 'Student is not present — grading is not available for this session.';
            } else if (!hasRequiredAssignment) {
                lockMsg.textContent = 'Desk must assign a room and physical instrument before attendance and grading.';
            } else {
                lockMsg.textContent = 'Desk hasn\'t marked attendance yet. Use Session Done on the student row if the lesson is finished.';
            }
        }
        setScoreButtonsDisabled(true);
        document.querySelectorAll('#gradingForm select, #gradingForm textarea').forEach(el => {
            el.disabled = true;
            el.classList.add('opacity-50','cursor-not-allowed');
        });
        if (saveBtn) { saveBtn.disabled = true; saveBtn.classList.add('opacity-40','cursor-not-allowed'); }
    }

    // Show "View Progress" button only for graded sessions
    const vpBtn = document.getElementById('viewProgressBtn');
    if (vpBtn) vpBtn.classList.toggle('hidden', !graded);

    updateScorePreview();
    renderStudentHistory(session);
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
        .filter(isTodaySession)
        .filter(s => !q || [s.student_first_name, s.student_last_name, s.instrument_name, s.package_name].join(' ').toLowerCase().includes(q))
        .slice()
        .sort((a, b) => {
            const rd = getGradeSessionSortRank(a) - getGradeSessionSortRank(b);
            if (rd !== 0) return rd;
            const da = getGradeSessionSortTime(a), db = getGradeSessionSortTime(b);
            return da !== db ? da - db : Number(a.session_id) - Number(b.session_id);
        });
}

function renderGradeSessions() {
    const list  = document.getElementById('sessionGradeList');
    const count = document.getElementById('sessionGradeCount');
    if (!list) return;

    const rows = getVisibleGradeSessions();
    if (count) count.textContent = rows.length ? `${rows.length} shown` : '0 shown';

    if (!rows.length) {
        list.innerHTML = `<div class="px-6 py-16 text-center text-sm text-gray-400">
            <i class="fas fa-calendar-xmark text-3xl text-gray-200 block mb-3"></i>
            No sessions found for today.
        </div>`;
        if (selectedGradeSessionId === 0 || isTodaySession(instructorGradeSessions.find(s => Number(s.session_id || 0) === selectedGradeSessionId))) {
            closeGradingPanel();
        }
        return;
    }

    list.innerHTML = rows.map(session => {
        const sid        = Number(session.session_id || 0);
        const isSelected = sid === selectedGradeSessionId;
        const name       = `${session.student_first_name || ''} ${session.student_last_name || ''}`.trim() || 'Student';
        const instrument = session.instrument_name || 'Instrument';
        const room       = session.room_name || 'Studio';
        const time       = formatTime12Hour(session.start_time);
        const graded     = Number(session.progress_id || 0) > 0;
        const score      = graded && session.average_score ? Number(session.average_score).toFixed(1) : null;
        const attendance = String(session.attendance_status || 'Pending').toLowerCase();
        const sessionEnded = Boolean(session.instructor_completed_at);
        const canEndSession = graded && ['present','late'].includes(attendance) && !sessionEnded;
        const cannotComplete = ['absent','excused','ci','teacher absent'].includes(attendance)
            || ['cancelled','cancelled_by_teacher','rescheduled','no show'].includes(String(session.status || '').toLowerCase());
        const timerMarkup = session.grading_started_at
            ? `<span class="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold ${session.grading_completed_at ? 'text-slate-500' : 'text-blue-600'}"><i class="fas fa-stopwatch"></i><span data-row-timer-start="${escapeHtml(String(session.grading_started_at))}" data-row-timer-end="${escapeHtml(String(session.grading_completed_at || ''))}">00:00</span></span>`
            : '';
        
        // Get initials for avatar
        const initials   = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        return `<div class="session-card w-full px-4 py-3 rounded-2xl border-2 ${isSelected ? 'selected border-teal-500' : 'border-gray-100'}">
            <div class="flex items-center gap-3">
              <button type="button" data-session-id="${sid}" class="flex min-w-0 flex-1 items-start gap-3 text-left rounded-xl p-1 focus:outline-none focus:ring-2 focus:ring-teal-300">
                <div class="flex-shrink-0">
                    <p class="text-base font-semibold text-gray-900">${escapeHtml(time)}</p>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        <div class="h-8 w-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            ${escapeHtml(initials)}
                        </div>
                        <p class="text-sm font-semibold text-gray-900 truncate">${escapeHtml(name)}</p>
                    </div>
                    <p class="text-sm text-gray-500">${escapeHtml(instrument)} · ${escapeHtml(room)}</p>
                    ${timerMarkup}
                </div>
                ${score ? `<div class="flex-shrink-0 flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-teal-700">
                    <i class="fas fa-check text-xs"></i>
                    <span class="text-xs font-bold">Graded · ${score}/5</span>
                </div>` : '<div class="flex-shrink-0 text-sm text-gray-400">Not graded</div>'}
              </button>
              ${sessionEnded
                ? '<span class="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><i class="fas fa-circle-check"></i>Session Ended</span>'
                : cannotComplete
                    ? `<span class="inline-flex shrink-0 items-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-500">${escapeHtml(session.attendance_status || session.status || 'Unavailable')}</span>`
                : `<button type="button" data-session-done-id="${sid}" onclick="event.stopPropagation(); instructorMarkPresent(${sid}, this)" ${canEndSession ? '' : 'disabled title="Save the grade before ending this session"'} class="inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${canEndSession ? 'border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100' : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'}"><i class="fas fa-flag-checkered"></i>Session Ended</button>`}
            </div>
        </div>`;
    }).join('');

    document.querySelectorAll('[data-session-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = instructorGradeSessions.find(s => Number(s.session_id || 0) === Number(btn.dataset.sessionId || 0)) || null;
            if (target) {
                populateGradeForm(target);
                renderGradeSessions();
                openGradingPanel();
            }
        });
    });
    updateSessionRowTimers();
    if (_rowTimerInterval) clearInterval(_rowTimerInterval);
    if (rows.some(session => session.grading_started_at && !session.grading_completed_at)) {
        _rowTimerInterval = setInterval(updateSessionRowTimers, 1000);
    }
}

// ── Student history panel ─────────────────────────────────────────
function getStudentSessionHistory(studentId) {
    return instructorGradeSessions
        .filter(s => Number(s.student_id || 0) === Number(studentId || 0))
        .slice()
        .sort((a, b) => {
            const da = new Date(`${a.session_date || ''}T${a.start_time || '00:00:00'}`).getTime();
            const db = new Date(`${b.session_date || ''}T${b.start_time || '00:00:00'}`).getTime();
            return db !== da ? db - da : Number(b.session_id || 0) - Number(a.session_id || 0);
        });
}

function renderStudentHistory(session) {
    const heading = document.getElementById('studentHistoryHeading');
    const list = document.getElementById('studentHistoryList');
    if (!heading || !list) return;

    if (!session) {
        heading.textContent = 'Select a student';
        list.innerHTML = `
            <div class="px-6 py-10 text-center text-sm text-gray-400">
                Select a session above to view the student's grading history.
            </div>`;
        return;
    }

    const studentName = `${session.student_first_name || ''} ${session.student_last_name || ''}`.trim() || 'Student';
    const history = getStudentSessionHistory(session.student_id);
    const gradedCount = history.filter(row => Number(row.progress_id || 0) > 0).length;

    heading.textContent = studentName;
    list.innerHTML = history.length ? `
        <div class="px-6 py-3 border-b border-gray-100 bg-gray-50/70 text-xs text-gray-500">
            ${history.length} session${history.length === 1 ? '' : 's'} total · ${gradedCount} graded
        </div>
        ${history.map(row => {
        const sid = Number(row.session_id || 0);
        const isSelected = sid === Number(selectedGradeSessionId || 0);
        const graded = Number(row.progress_id || 0) > 0;
        const scoreText = graded && row.average_score !== null && row.average_score !== undefined
            ? `${Number(row.average_score).toFixed(2)}/5`
            : 'Not graded';
        const state = getGradeState(row);
        const stateCls = getGradeStateCls(row);
        const meta = [
            formatShortDate(row.session_date),
            `${formatTime12Hour(row.start_time)} - ${formatTime12Hour(row.end_time)}`,
            row.instrument_name || 'Instrument'
        ].join(' • ');

        return `
            <button type="button" data-history-session-id="${sid}"
                class="w-full text-left px-6 py-4 transition ${isSelected ? 'bg-teal-50/80' : 'hover:bg-gray-50'}">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <p class="text-sm font-semibold text-gray-900">${escapeHtml(state)} Session</p>
                        <p class="text-xs text-gray-400 mt-1 truncate">${escapeHtml(meta)}</p>
                    </div>
                    <div class="shrink-0 text-right">
                        <div class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${stateCls}">
                            ${escapeHtml(scoreText)}
                        </div>
                        <div class="mt-1 text-[11px] font-medium text-gray-400">${escapeHtml(graded ? `${row.skill_level || '—'}` : 'Awaiting grade')}</div>
                    </div>
                </div>
            </button>`;
    }).join('')}` : `
        <div class="px-6 py-10 text-center text-sm text-gray-400">
            No sessions found for this student.
        </div>`;

    document.querySelectorAll('[data-history-session-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = instructorGradeSessions.find(s => Number(s.session_id || 0) === Number(btn.dataset.historySessionId || 0)) || null;
            populateGradeForm(target);
            renderGradeSessions();
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
    if (Number(sessionData?.progress_id || 0) > 0 || sessionData?.grading_completed_at) {
        showGradeMessage('This grade has already been saved and is read-only.', 'error');
        return;
    }
    if (Number(sessionData?.room_id || 0) < 1 || Number(sessionData?.assigned_instrument_id || 0) < 1) {
        showGradeMessage('Desk must assign a room and physical instrument before saving the grade.', 'error');
        return;
    }
    if (sessionData && !isGradeable(sessionData) && Number(sessionData.progress_id || 0) < 1) {
        showGradeMessage('Attendance must be marked Present before grading.', 'error'); return;
    }

    const criteriaScores = buildScoreFields().map(field => ({
        name: field.label,
        score: Number(document.getElementById(field.inputId)?.value || 0)
    }));
    if (criteriaScores.some(item => item.score < 1 || item.score > 5)) {
        showGradeMessage('Rate every active criterion from 1 to 5.', 'error');
        return;
    }

    const skillLevelInput = document.getElementById('skillLevelInput');
    const skillLevel = String(skillLevelInput?.value || '').trim();
    const validSkillLevels = ['Beginner', 'Developing', 'Proficient', 'Advanced'];
    if (!validSkillLevels.includes(skillLevel)) {
        showGradeMessage('Choose the student’s overall level before saving the grade.', 'error');
        document.querySelector('.skill-level-btn')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    const payload = {
        action: 'save-session-grade',
        user_id: Number(user.user_id),
        session_id: sessionId,
        skill_level: skillLevel,
        criteria_scores: criteriaScores,
        remarks: document.getElementById('remarksInput').value.trim()
    };

    const btn = document.getElementById('saveGradeBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1.5"></i>Saving…'; }
    let savedSuccessfully = false;

    try {
        const res  = await axios.post(`${baseApiUrl}/teachers.php?action=save-session-grade`, payload);
        const data = res.data || {};
        if (!data.success) { showGradeMessage(data.error || 'Failed to save. Please try again.', 'error'); return; }
        showGradeMessage(data.message || 'Grade saved.', 'success');
        await loadGradeSessions(currentGradeFilter);
        const refreshed = instructorGradeSessions.find(s => Number(s.session_id || 0) === sessionId) || null;
        populateGradeForm(refreshed);
        renderGradeSessions();
        savedSuccessfully = true;
        const status = document.getElementById('gradeSaveStatus');
        if (status) { status.classList.remove('hidden'); status.classList.add('flex'); }
    } catch (e) {
        console.error('Save failed:', e);
        showGradeMessage(e?.response?.data?.error || 'Network error — please try again.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = savedSuccessfully
                ? '<i class="fas fa-circle-check text-xs"></i> Grade Saved'
                : '<i class="fas fa-save text-xs"></i> Save Grade';
        }
    }
}

// ── Analytics (rendered inside the progress modal) ─────────────────
function getStudentGradedHistory(studentId) {
    return instructorGradeSessions
        .filter(s => Number(s.student_id) === Number(studentId) && Number(s.progress_id || 0) > 0)
        .slice().sort((a, b) => {
            const da = new Date(a.session_date || 0).getTime();
            const db = new Date(b.session_date || 0).getTime();
            return da !== db ? da - db : Number(a.session_id) - Number(b.session_id);
        });
}

function renderAnalytics(session) {
    // Keep legacy analyticsPanel hidden (it's a hidden dummy element now)
    const panel = document.getElementById('analyticsPanel');
    if (panel) panel.classList.add('hidden');
    if (!session) return;

    // Only use the criteria the instructor has actually defined
    const SCORE_FIELDS_NOW = buildScoreFields();
    const preview          = getAnalyticsPreviewSession(session);
    const studentId        = Number(session.student_id || 0);
    const history          = getStudentGradedHistory(studentId);
    const isGraded         = Number(session.progress_id || 0) > 0;
    const hasPreview       = SCORE_FIELDS_NOW.some(f => getCriterionScore(preview, f) > 0);
    const radarSource      = hasPreview ? preview : (isGraded ? session : null);
    const trendHistory     = history.slice();
    if (!isGraded && preview?.average_score !== null) trendHistory.push(preview);

    setGradeText('analyticsStudentLabel', `${session.student_first_name || ''} ${session.student_last_name || ''}`.trim());
    setGradeText('analyticsSessionCount', history.length === 0 ? 'No graded sessions yet' : `${history.length} session${history.length === 1 ? '' : 's'} graded`);

    // Radar
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
                data: { labels: SCORE_FIELDS_NOW.map(f => f.label), datasets: [{
                    data: SCORE_FIELDS_NOW.map(f => getCriterionScore(radarSource, f)),
                    backgroundColor: 'rgba(13,148,136,0.12)', borderColor: '#0d9488',
                    pointBackgroundColor: '#0d9488', pointBorderColor: '#fff', pointRadius: 4, borderWidth: 2
                }]},
                options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false }},
                    scales:{ r:{ min:0, max:5, ticks:{ stepSize:1, font:{ size:10 }, color:'#9ca3af' },
                        grid:{ color:'#f3f4f6' }, pointLabels:{ font:{ size:10, weight:'600' }, color:'#6b7280' },
                        angleLines:{ color:'#f3f4f6' }}}}
            });
        }
    }

    // Trend
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
                data: { labels: trendHistory.map((_, i) => `S${i+1}`), datasets:[{ data: tData,
                    borderColor:'#0d9488', backgroundColor:'rgba(13,148,136,0.08)',
                    pointBackgroundColor: tData.map((_, i) => i === tData.length - 1 ? '#111827' : '#0d9488'),
                    pointRadius: tData.map((_, i) => i === tData.length - 1 ? 6 : 4),
                    tension:0.35, fill:true, borderWidth:2 }]},
                options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false },
                    tooltip:{ callbacks:{ label: ctx => `Avg: ${Number(ctx.parsed.y).toFixed(2)}/5` }}},
                    scales:{ y:{ min:0, max:5, ticks:{ stepSize:1, font:{ size:10 }, color:'#9ca3af' }, grid:{ color:'#f9fafb' }},
                        x:{ ticks:{ font:{ size:10 }, color:'#9ca3af' }, grid:{ display:false }}}}
            });
        }
    }

    // Category bars
    const barsEl = document.getElementById('categoryBars');
    if (barsEl) {
        if (!trendHistory.length) {
            barsEl.innerHTML = '<p class="text-sm text-gray-400 text-center py-2">No data yet.</p>';
        } else {
            barsEl.innerHTML = SCORE_FIELDS_NOW.map(field => {
                const vals  = trendHistory.map(s => getCriterionScore(s, field)).filter(v => v > 0);
                const mean  = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                const pct   = (mean / 5) * 100;
                const color = mean <= 2 ? 'bg-rose-400' : mean <= 3 ? 'bg-amber-400' : 'bg-teal-500';
                const word  = mean > 0 ? (SCORE_WORDS[Math.round(mean)] || mean.toFixed(1)) : '—';
                const tc    = mean <= 2 ? 'text-rose-600' : mean <= 3 ? 'text-amber-600' : 'text-teal-600';
                return `<div>
                    <div class="flex items-center justify-between mb-1.5">
                        <span class="text-sm font-medium text-gray-700">${escapeHtml(field.label)}</span>
                        <span class="text-sm font-bold ${tc}">${word}</span>
                    </div>
                    <div class="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div class="h-full rounded-full ${color} transition-all duration-700" style="width:${pct.toFixed(1)}%"></div>
                    </div>
                </div>`;
            }).join('');
        }
    }

    // Tips
    const tipsEl = document.getElementById('improvementTips');
    if (tipsEl) {
        const source = hasPreview ? preview : (isGraded ? session : (history.length ? history[history.length - 1] : null));
        if (!source) {
            tipsEl.innerHTML = '<p class="text-sm text-gray-400 text-center py-2">Grade this session to see tips.</p>';
        } else {
            const sorted = SCORE_FIELDS_NOW.map(f => ({ ...f, score: getCriterionScore(source, f) }))
                .filter(f => f.score > 0).sort((a, b) => a.score - b.score);
            tipsEl.innerHTML = sorted.length ? sorted.map(f => {
                const style = getTipStyle(f.score);
                const tip   = IMPROVEMENT_TIPS[f.key]?.[getTipLevel(f.score)] || `Keep working on ${f.label}.`;
                return `<div class="rounded-xl border ${style.wrap} p-3.5 flex gap-3">
                    <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2 mb-1">
                            <span class="text-sm font-semibold ${style.title}">${escapeHtml(f.label)}</span>
                            <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${style.badge}">${getTipLabel(f.score)}</span>
                        </div>
                        <p class="text-sm ${style.body} leading-relaxed">${tip}</p>
                    </div>
                </div>`;
            }).join('') : '<p class="text-sm text-gray-400 text-center py-2">No scores yet.</p>';
        }
    }
}

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadServerCriteria();
    renderScoreCriteria();
    await loadGradeSessions('all');
    document.getElementById('gradeSearch')?.addEventListener('input',   () => renderGradeSessions());
    document.getElementById('gradingForm')?.addEventListener('submit',  saveSessionGrade);
    document.getElementById('skillLevelInput')?.addEventListener('change', () => { markGradeDirty(); updateScorePreview(); });
    document.getElementById('remarksInput')?.addEventListener('input',  () => { markGradeDirty(); updateScorePreview(); });
    // Close progress modal on backdrop click
    document.getElementById('progressModal')?.addEventListener('click', e => {
        if (e.target === document.getElementById('progressModal')) closeProgressModal();
    });
});
