/* ================================================================
   instructor/grading.js  — minimal, teacher-friendly rewrite
   ================================================================ */

let instructorGradeSessions = [];
let selectedGradeSessionId  = 0;
let currentGradeFilter      = 'all';
let _radarChartInstance     = null;
let _trendChartInstance     = null;

// ── Criteria ───────────────────────────────────────────────────────
const DEFAULT_CRITERIA = ['Performance','Technique','Rhythm & Timing','Focus & Discipline','Assignment & Practice'];
const CRITERIA_STORAGE_KEY = 'fas_grade_criteria';
let isEditingCriteria = false;

function loadCriteria() {
    try {
        const s = localStorage.getItem(CRITERIA_STORAGE_KEY);
        if (s) { const p = JSON.parse(s); if (Array.isArray(p) && p.length) return p; }
    } catch(e) {}
    return [...DEFAULT_CRITERIA];
}
function saveCriteria(c) { try { localStorage.setItem(CRITERIA_STORAGE_KEY, JSON.stringify(c)); } catch(e) {} }

// ── Score fields ───────────────────────────────────────────────────
function buildScoreFields() {
    const criteria = loadCriteria();
    const keys     = ['performance_score','technique_score','rhythm_score','focus_score','assignment_score'];
    const labelIds = ['perfLabel','techLabel','rhythmLabel','focusLabel','assignLabel'];
    const icons    = ['fa-music','fa-hands','fa-drum','fa-brain','fa-book-open'];
    return keys.map((key, i) => ({ key, label: criteria[i] || DEFAULT_CRITERIA[i], icon: icons[i], labelId: labelIds[i] }));
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
    const fieldKeys   = ['performanceScoreInput','techniqueScoreInput','rhythmScoreInput','focusScoreInput','assignmentScoreInput'];
    const labelIds    = ['perfLabel','techLabel','rhythmLabel','focusLabel','assignLabel'];

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
        const fieldId    = fieldKeys[i] || `extraScore${i}Input`;
        const labelId    = labelIds[i]  || `extraLabel${i}`;
        const currentVal = document.getElementById(fieldId)?.value || '';
        const activeWord = currentVal ? (SCORE_WORDS[Number(currentVal)] || '—') : '—';
        const wordBtns   = ['Poor','Fair','Good','Very Good','Excellent'].map((word, wi) => {
            const val = String(wi + 1);
            const isActive = currentVal === val;
            const activeCls = ['bg-red-100 border-red-400 text-red-700','bg-orange-100 border-orange-400 text-orange-700','bg-yellow-100 border-yellow-400 text-yellow-700','bg-green-100 border-green-400 text-green-700','bg-emerald-100 border-emerald-400 text-emerald-700'][wi];
            return `<button type="button"
                class="score-btn score-btn-${val} py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${isActive ? activeCls : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'}"
                data-field="${fieldId}" data-val="${val}">${word}</button>`;
        }).join('');
        return `<div class="criterion-row">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-semibold text-gray-700">${escapeHtml(name)}</span>
                <span id="${labelId}" class="text-xs font-medium text-gray-400">${activeWord}</span>
            </div>
            <div class="grid grid-cols-5 gap-1.5">${wordBtns}</div>
        </div>`;
    }).join('');
    initScoreButtons();
}

function toggleEditCriteria() {
    if (isEditingCriteria) {
        const inputs = document.querySelectorAll('.criteria-name-input');
        const newC   = Array.from(inputs).map(inp => inp.value.trim()).filter(Boolean);
        if (newC.length) saveCriteria(newC);
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
}
function addCriterion() {
    const inputs = document.querySelectorAll('.criteria-name-input');
    const c = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
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

// ── Gradeability ───────────────────────────────────────────────────
function isGradeable(session) {
    return String(session?.status || '').toLowerCase() === 'completed' &&
           String(session?.attendance_status || '').toLowerCase() === 'present';
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

// ── Attendance control ─────────────────────────────────────────────
// Rules:
//   graded (progress_id > 0)          → read-only "Present — Graded" badge
//   att = present / late              → read-only desk-confirmed badge, grading unlocked
//   att = absent / excused / ci / etc → read-only badge, grading locked
//   att = pending / not set           → "Mark as Present" button (instructor override)
function renderAttendanceControl(session) {
    const container = document.getElementById('attendanceControl');
    const descEl    = document.getElementById('attendanceSectionDesc');
    if (!container) return;

    const graded = session ? Number(session.progress_id || 0) > 0 : false;
    const att    = String(session?.attendance_status || 'Pending').toLowerCase();

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
        container.innerHTML = badge('fa-circle-check', 'Present — already graded', 'border-teal-200 bg-teal-50 text-teal-700');
        if (descEl) descEl.textContent = 'This session has already been graded.';
        return;
    }

    if (att === 'present') {
        container.innerHTML = badge('fa-circle-check', 'Present — confirmed by desk', 'border-emerald-200 bg-emerald-50 text-emerald-700');
        if (descEl) descEl.textContent = 'Attendance confirmed. You can now grade this session.';
        return;
    }

    if (att === 'late') {
        container.innerHTML = badge('fa-clock', 'Late — confirmed by desk', 'border-amber-200 bg-amber-50 text-amber-700');
        if (descEl) descEl.textContent = 'Student arrived late. You can still grade this session.';
        return;
    }

    if (['absent','excused','ci','teacher absent'].includes(att)) {
        const labels = { absent:'Absent', excused:'Excused', ci:'CI', 'teacher absent':'Teacher Absent' };
        container.innerHTML = badge('fa-times-circle', labels[att] || att, 'border-rose-200 bg-rose-50 text-rose-600');
        if (descEl) descEl.textContent = 'Student is not present — grading is not available for this session.';
        return;
    }

    // Pending / Scheduled — instructor can mark present
    container.innerHTML = `
        <div class="flex flex-wrap items-center gap-3">
            <span class="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500">
                <i class="fas fa-clock text-gray-400 text-xs"></i>Not yet marked by desk
            </span>
            <button type="button" id="markPresentBtn"
                onclick="instructorMarkPresent()"
                class="inline-flex items-center gap-2 rounded-xl border border-teal-300 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-100 transition">
                <i class="fas fa-user-check text-sm"></i>Mark as Present
            </button>
        </div>`;
    if (descEl) descEl.textContent = 'Not yet confirmed by desk. You can mark the student present if they\'re here.';
}

async function instructorMarkPresent() {
    const session = instructorGradeSessions.find(s => Number(s.session_id || 0) === Number(selectedGradeSessionId || 0)) || null;
    if (!session) return;
    const btn  = document.getElementById('markPresentBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin text-xs mr-2"></i>Marking…'; }
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
    try {
        const res  = await axios.post(`${baseApiUrl}/attendance.php?action=mark-present-by-instructor`, {
            session_id: Number(session.session_id),
            user_id:    Number(user?.user_id || 0)
        });
        const data = res.data || {};
        if (!data.success) {
            showGradeMessage(data.error || 'Could not mark attendance. Please try again.', 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-check text-sm"></i>Mark as Present'; }
            return;
        }
        await loadGradeSessions(currentGradeFilter);
        const refreshed = instructorGradeSessions.find(s => Number(s.session_id || 0) === Number(selectedGradeSessionId || 0)) || null;
        populateGradeForm(refreshed);
        renderGradeSessions();
    } catch (e) {
        console.error('Mark present failed:', e);
        showGradeMessage('Network error — please try again.', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-check text-sm"></i>Mark as Present'; }
    }
}
window.instructorMarkPresent = instructorMarkPresent;

// ── Score buttons ──────────────────────────────────────────────────
function initScoreButtons() {
    document.querySelectorAll('.score-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.field;
            const val   = btn.dataset.val;
            const input = document.getElementById(field);
            if (!input || input.disabled) return;
            input.value = val;
            document.querySelectorAll(`.score-btn[data-field="${field}"]`).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const sf = buildScoreFields().find(f => f.key.replace('_score','ScoreInput') === field || field === f.key.replace('_score','ScoreInput'));
            const labelEl = sf?.labelId ? document.getElementById(sf.labelId) : null;
            if (labelEl) labelEl.textContent = SCORE_WORDS[Number(val)] || val;
            updateScorePreview();
        });
    });
}
function getFieldInputId(key) {
    const parts = key.replace('_score','').split('_');
    return parts.map((p, i) => i === 0 ? p : p[0].toUpperCase() + p.slice(1)).join('') + 'ScoreInput';
}
function syncScoreButtons(session) {
    buildScoreFields().forEach(field => {
        const inputId = getFieldInputId(field.key);
        const val     = session ? String(session[field.key] || '') : '';
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
    const ids    = buildScoreFields().map(f => getFieldInputId(f.key));
    const values = ids.map(id => Number(document.getElementById(id)?.value || 0)).filter(v => v >= 1 && v <= 5);
    if (values.length !== ids.length) return null;
    return Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(2));
}
function updateScorePreview() {
    const previewEl  = document.getElementById('scorePreview');
    const badgeEl    = document.getElementById('gradeAverageBadge');
    const previewBox = document.getElementById('avgPreviewBox');
    const avg        = computeAverageFromInputs();
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
    buildScoreFields().forEach(f => {
        const v = Number(document.getElementById(getFieldInputId(f.key))?.value || 0);
        preview[f.key] = v > 0 ? v : 0;
        if (v > 0) has = true;
    });
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

    const studentName = session ? `${session.student_first_name || ''} ${session.student_last_name || ''}`.trim() || 'Student' : 'Select a session';
    const sessionMeta = session ? `${formatShortDate(session.session_date)} · ${formatTime12Hour(session.start_time)} – ${formatTime12Hour(session.end_time)}` : '—';
    setGradeText('gradeStudentHeading', session ? `Grade ${studentName}` : 'Select a session');
    setGradeText('gradeSessionMeta', sessionMeta);
    // Keep hidden fields for any legacy lookups
    const hidName = document.getElementById('gradeStudentName');
    const hidSub  = document.getElementById('gradeFormSubtitle');
    if (hidName) hidName.value = studentName;
    if (hidSub)  hidSub.value  = sessionMeta;

    // Pre-fill score inputs then render criteria
    buildScoreFields().forEach(field => {
        const inputEl = document.getElementById(getFieldInputId(field.key));
        if (inputEl) inputEl.value = session ? String(session[field.key] || '') : '';
    });
    renderScoreCriteria();

    const skillEl   = document.getElementById('skillLevelInput');
    const remarksEl = document.getElementById('remarksInput');
    if (skillEl)   skillEl.value   = session?.skill_level || '';
    if (remarksEl) remarksEl.value = session?.remarks     || '';

    const graded    = session ? Number(session.progress_id || 0) > 0 : false;
    const gradeable = session ? isGradeable(session) : false;
    const active    = gradeable || graded;

    // Render smart attendance control (read-only badge or Mark Present button)
    renderAttendanceControl(session);

    // Lock / unlock grading based on attendance + grade state
    const lockBanner = document.getElementById('gradeLockBanner');
    const lockMsg    = document.getElementById('gradeLockMsg');
    const saveBtn    = document.getElementById('saveGradeBtn');

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
            if (!session) {
                lockMsg.textContent = 'Select Present to continue.';
            } else if (['absent','excused','ci','teacher absent'].includes(att)) {
                lockMsg.textContent = 'Student is not present — grading is not available for this session.';
            } else {
                lockMsg.textContent = 'Desk hasn\'t marked attendance yet. Use the Mark as Present button above if the student is here.';
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
    renderGradeStats(rows);
    if (count) count.textContent = String(rows.length);

    if (!rows.length) {
        list.innerHTML = `<div class="px-4 py-10 text-center text-sm text-gray-400">
            <i class="fas fa-calendar-xmark text-2xl text-gray-200 block mb-3"></i>
            No sessions match this filter.
        </div>`;
        populateGradeForm(null);
        return;
    }

    if (!rows.some(s => Number(s.session_id) === selectedGradeSessionId)) {
        populateGradeForm(rows[0]);
    }

    list.innerHTML = rows.map(session => {
        const sid        = Number(session.session_id || 0);
        const isSelected = sid === selectedGradeSessionId;
        const name       = `${session.student_first_name || ''} ${session.student_last_name || ''}`.trim() || 'Student';
        const state      = getGradeState(session);
        const stateCls   = getGradeStateCls(session);
        const time       = session.start_time ? `${formatTime12Hour(session.start_time)} – ${formatTime12Hour(session.end_time)}` : 'Time pending';

        return `<button type="button" data-session-id="${sid}"
            class="session-card w-full text-left px-4 py-4 border-l-4 transition-all ${isSelected ? 'is-selected border-l-teal-500' : 'border-l-transparent hover:border-l-gray-200'}">
            <p class="text-sm font-semibold text-gray-900">${escapeHtml(name)}</p>
            <div class="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                <i class="fas fa-calendar-alt text-[10px]"></i>
                <span>${escapeHtml(formatShortDate(session.session_date))}</span>
            </div>
            <div class="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
                <i class="fas fa-clock text-[10px]"></i>
                <span>${escapeHtml(time)}</span>
                <span class="ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${stateCls}">${escapeHtml(state)}</span>
            </div>
        </button>`;
    }).join('');

    document.querySelectorAll('.grade-session-card, [data-session-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = instructorGradeSessions.find(s => Number(s.session_id || 0) === Number(btn.dataset.sessionId || 0)) || null;
            populateGradeForm(target);
            renderGradeSessions();
            if (window.innerWidth < 1024) {
                document.getElementById('gradingForm')?.closest('.bg-white')?.scrollIntoView({ behavior:'smooth', block:'start' });
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
        showGradeMessage('Attendance must be marked Present before grading.', 'error'); return;
    }

    const payload = {
        action: 'save-session-grade',
        user_id: Number(user.user_id),
        session_id: sessionId,
        skill_level:       document.getElementById('skillLevelInput').value,
        performance_score: Number(document.getElementById('performanceScoreInput').value  || 0),
        technique_score:   Number(document.getElementById('techniqueScoreInput').value    || 0),
        rhythm_score:      Number(document.getElementById('rhythmScoreInput').value       || 0),
        focus_score:       Number(document.getElementById('focusScoreInput').value        || 0),
        assignment_score:  Number(document.getElementById('assignmentScoreInput').value   || 0),
        remarks:           document.getElementById('remarksInput').value.trim()
    };

    const btn = document.getElementById('saveGradeBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1.5"></i>Saving…'; }

    try {
        const res  = await axios.post(`${baseApiUrl}/teachers.php?action=save-session-grade`, payload);
        const data = res.data || {};
        if (!data.success) { showGradeMessage(data.error || 'Failed to save. Please try again.', 'error'); return; }
        showGradeMessage(data.message || 'Grade saved.', 'success');
        await loadGradeSessions(currentGradeFilter);
        const refreshed = instructorGradeSessions.find(s => Number(s.session_id || 0) === sessionId) || null;
        populateGradeForm(refreshed);
        renderGradeSessions();
    } catch (e) {
        console.error('Save failed:', e);
        showGradeMessage('Network error — please try again.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check text-xs mr-1.5"></i>Save Grade'; }
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

    const SCORE_FIELDS_NOW = buildScoreFields();
    const preview          = getAnalyticsPreviewSession(session);
    const studentId        = Number(session.student_id || 0);
    const history          = getStudentGradedHistory(studentId);
    const isGraded         = Number(session.progress_id || 0) > 0;
    const hasPreview       = SCORE_FIELDS_NOW.some(f => Number(preview?.[f.key] || 0) > 0);
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
                    data: SCORE_FIELDS_NOW.map(f => Number(radarSource[f.key] || 0)),
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
                const vals  = trendHistory.map(s => Number(s[field.key] || 0)).filter(v => v > 0);
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
            const sorted = SCORE_FIELDS_NOW.map(f => ({ ...f, score: Number(source[f.key] || 0) }))
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
    renderScoreCriteria();
    await loadGradeSessions('all');
    document.getElementById('gradeFilter')?.addEventListener('change',  e => loadGradeSessions(e.target.value));
    document.getElementById('gradeSearch')?.addEventListener('input',   () => renderGradeSessions());
    document.getElementById('gradingForm')?.addEventListener('submit',  saveSessionGrade);
    document.getElementById('skillLevelInput')?.addEventListener('change', updateScorePreview);
    document.getElementById('remarksInput')?.addEventListener('input',  updateScorePreview);
    // Close progress modal on backdrop click
    document.getElementById('progressModal')?.addEventListener('click', e => {
        if (e.target === document.getElementById('progressModal')) closeProgressModal();
    });
});
