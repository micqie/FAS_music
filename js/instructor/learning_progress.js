let instructorLearningRows = [];

function learningHtml(value) {
    return typeof escapeHtml === 'function' ? escapeHtml(String(value ?? '')) : String(value ?? '');
}

function learningReadinessClass(status) {
    if (status === 'Ready for Assessment') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'Improving') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (status === 'Developing') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
}

function renderInstructorLearningProgress() {
    const root = document.getElementById('instructorLearningProgressList');
    if (!root) return;
    if (!instructorLearningRows.length) {
        root.innerHTML = '<div class="xl:col-span-2 rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">No assigned student/instrument records were found.</div>';
        return;
    }
    root.innerHTML = instructorLearningRows.map((row, index) => {
        const hasRecord = Number(row.learning_level_id || 0) > 0;
        const readiness = row.assessment_readiness || 'Not Ready';
        return `<article class="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div class="flex items-start justify-between gap-3">
                <div><div class="font-black text-slate-900">${learningHtml(`${row.first_name || ''} ${row.last_name || ''}`.trim())}</div><div class="mt-1 text-sm font-semibold text-gold-700">${learningHtml(row.instrument_name || 'Instrument')}</div></div>
                <span class="rounded-full border px-3 py-1 text-[11px] font-bold ${learningReadinessClass(readiness)}">${learningHtml(readiness)}</span>
            </div>
            <div class="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div><span class="text-slate-400">Current level</span><div class="font-bold text-slate-800">${learningHtml(row.level_name || 'Not set')}</div></div>
                <div><span class="text-slate-400">Book / material</span><div class="font-bold text-slate-800">${learningHtml(row.book_material || 'Not set')}</div></div>
                <div class="sm:col-span-2"><span class="text-slate-400">Current topic</span><div class="font-semibold text-slate-700">${learningHtml(row.current_topic || 'Not set')}</div></div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
                <button type="button" onclick="openLearningProgressEditor(${index})" class="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800">${hasRecord ? 'Update Progress' : 'Create Progress'}</button>
                ${hasRecord && readiness === 'Ready for Assessment' ? `<button type="button" onclick="openPromotionalExamForm(${index})" class="rounded-xl bg-gold-500 px-4 py-2.5 text-xs font-extrabold text-black hover:bg-gold-400">Record Promotional Exam</button>` : ''}
                ${Array.isArray(row.learning_history) && row.learning_history.length ? `<span class="self-center text-xs text-slate-500">${row.learning_history.length} level record${row.learning_history.length === 1 ? '' : 's'}</span>` : ''}
            </div>
        </article>`;
    }).join('');
}

async function loadInstructorLearningProgress() {
    const user = typeof Auth !== 'undefined' ? Auth.getUser() : null;
    if (!user?.user_id) return;
    try {
        const response = await axios.get(`${baseApiUrl}/teachers.php?action=get-learning-progress&user_id=${encodeURIComponent(user.user_id)}`);
        instructorLearningRows = response.data?.success && Array.isArray(response.data.learning_progress) ? response.data.learning_progress : [];
    } catch (error) {
        instructorLearningRows = [];
        if (typeof showMessage === 'function') showMessage(error?.response?.data?.error || 'Unable to load learning progress.', 'error');
    }
    renderInstructorLearningProgress();
}

async function openLearningProgressEditor(index) {
    const row = instructorLearningRows[Number(index)];
    if (!row) return;
    const readinessOptions = ['Not Ready','Developing','Improving','Ready for Assessment'];
    const result = await Swal.fire({
        title: `${learningHtml(row.first_name)} · ${learningHtml(row.instrument_name)}`,
        width: 720,
        showCancelButton: true,
        confirmButtonText: 'Save Learning Progress',
        confirmButtonColor: '#111827',
        html: `<div class="grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
            <div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Current level *</label><input id="lpLevel" class="swal2-input !m-0 !w-full" value="${learningHtml(row.level_name || '')}" placeholder="Level 1"></div>
            <div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Book / material</label><input id="lpBook" class="swal2-input !m-0 !w-full" value="${learningHtml(row.book_material || '')}" placeholder="John Thompson Book 1"></div>
            <div class="sm:col-span-2"><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Lesson / current topic</label><input id="lpTopic" class="swal2-input !m-0 !w-full" value="${learningHtml(row.current_topic || '')}"></div>
            <div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Skills being developed</label><textarea id="lpSkills" class="swal2-textarea !m-0 !w-full">${learningHtml(row.skills_developing || '')}</textarea></div>
            <div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Areas for improvement</label><textarea id="lpImprovement" class="swal2-textarea !m-0 !w-full">${learningHtml(row.areas_for_improvement || '')}</textarea></div>
            <div class="sm:col-span-2"><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Instructor notes</label><textarea id="lpNotes" class="swal2-textarea !m-0 !w-full">${learningHtml(row.instructor_notes || '')}</textarea></div>
            <div class="sm:col-span-2"><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Assessment readiness</label><select id="lpReadiness" class="swal2-select !m-0 !w-full">${readinessOptions.map(value => `<option ${value === (row.assessment_readiness || 'Not Ready') ? 'selected' : ''}>${value}</option>`).join('')}</select></div>
        </div>`,
        preConfirm: () => {
            const level = document.getElementById('lpLevel')?.value.trim() || '';
            if (!level) { Swal.showValidationMessage('Current level is required.'); return false; }
            return {
                level_name: level,
                book_material: document.getElementById('lpBook')?.value.trim() || '',
                current_topic: document.getElementById('lpTopic')?.value.trim() || '',
                skills_developing: document.getElementById('lpSkills')?.value.trim() || '',
                areas_for_improvement: document.getElementById('lpImprovement')?.value.trim() || '',
                instructor_notes: document.getElementById('lpNotes')?.value.trim() || '',
                assessment_readiness: document.getElementById('lpReadiness')?.value || 'Not Ready'
            };
        }
    });
    if (!result.isConfirmed) return;
    const user = Auth.getUser();
    try {
        const response = await axios.post(`${baseApiUrl}/teachers.php`, {
            action: 'save-learning-progress', user_id: user.user_id,
            student_id: Number(row.student_id), instrument_id: Number(row.instrument_id), ...result.value
        });
        if (!response.data?.success) throw new Error(response.data?.error || 'Unable to save progress.');
        showMessage(response.data.message || 'Learning progress saved.', 'success');
        await loadInstructorLearningProgress();
    } catch (error) { showMessage(error?.response?.data?.error || error.message, 'error'); }
}

async function openPromotionalExamForm(index) {
    const row = instructorLearningRows[Number(index)];
    if (!row?.learning_level_id) return;
    const today = new Date().toISOString().slice(0,10);
    const result = await Swal.fire({
        title: `Promotional Exam · ${learningHtml(row.level_name)}`,
        width: 650,
        showCancelButton: true,
        confirmButtonText: 'Record Result',
        confirmButtonColor: '#b8860b',
        html: `<div class="space-y-4 text-left">
            <p class="rounded-xl bg-amber-50 px-4 py-3 text-sm text-slate-600">This formal result—not session or song completion—controls level achievement and certificate issuance.</p>
            <div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Exam date</label><input id="examDate" type="date" value="${today}" class="swal2-input !m-0 !w-full"></div>
            <div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Grade / rating *</label><input id="examRating" class="swal2-input !m-0 !w-full" placeholder="Formal exam grade or rating"></div>
            <div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Result</label><select id="examResult" class="swal2-select !m-0 !w-full"><option value="Passed">Passed</option><option value="Retake">Retake</option></select></div>
            <div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Examiner notes</label><textarea id="examNotes" class="swal2-textarea !m-0 !w-full"></textarea></div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Next level (if passed)</label><input id="examNextLevel" class="swal2-input !m-0 !w-full" placeholder="Level 2"></div><div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Next book/material (if passed)</label><input id="examNextBook" class="swal2-input !m-0 !w-full" placeholder="John Thompson Book 2"></div></div>
        </div>`,
        preConfirm: () => {
            const examResult = document.getElementById('examResult')?.value || '';
            const rating = document.getElementById('examRating')?.value.trim() || '';
            const nextLevel = document.getElementById('examNextLevel')?.value.trim() || '';
            const nextBook = document.getElementById('examNextBook')?.value.trim() || '';
            if (!rating) { Swal.showValidationMessage('Formal grade or rating is required.'); return false; }
            if (examResult === 'Passed' && (!nextLevel || !nextBook)) { Swal.showValidationMessage('Enter the next level and book/material for a passing result.'); return false; }
            return { exam_date: document.getElementById('examDate')?.value || today, grade_rating: rating, result: examResult, examiner_notes: document.getElementById('examNotes')?.value.trim() || '', next_level_name: nextLevel, next_book_material: nextBook };
        }
    });
    if (!result.isConfirmed) return;
    const user = Auth.getUser();
    try {
        const response = await axios.post(`${baseApiUrl}/teachers.php`, { action:'record-promotional-exam', user_id:user.user_id, learning_level_id:Number(row.learning_level_id), ...result.value });
        if (!response.data?.success) throw new Error(response.data?.error || 'Unable to record exam.');
        showMessage(response.data.message, 'success');
        await loadInstructorLearningProgress();
    } catch (error) { showMessage(error?.response?.data?.error || error.message, 'error'); }
}

window.openLearningProgressEditor = openLearningProgressEditor;
window.openPromotionalExamForm = openPromotionalExamForm;
document.addEventListener('DOMContentLoaded', loadInstructorLearningProgress);
