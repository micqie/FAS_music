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

function renderInstructorLearningProgress(filter = '') {
    const root = document.getElementById('instructorLearningProgressList');
    if (!root) return;
    const term = String(filter || '').trim().toLowerCase();
    const visibleRows = instructorLearningRows.filter(row => !term || `${row.first_name || ''} ${row.last_name || ''} ${row.instrument_name || ''} ${row.level_name || ''}`.toLowerCase().includes(term));
    const total = document.getElementById('progressTotal');
    const ready = document.getElementById('progressReady');
    const resultCount = document.getElementById('progressResultCount');
    if (total) total.textContent = String(instructorLearningRows.length);
    if (ready) ready.textContent = String(instructorLearningRows.filter(row => row.assessment_readiness === 'Ready for Assessment').length);
    if (resultCount) resultCount.textContent = `${visibleRows.length} record${visibleRows.length === 1 ? '' : 's'}`;
    if (!visibleRows.length) {
        root.innerHTML = '<div class="xl:col-span-2 rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">No assigned student/instrument records were found.</div>';
        return;
    }
    root.innerHTML = visibleRows.map(row => {
        const index = instructorLearningRows.indexOf(row);
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
                <button type="button" onclick="openLearningProgressEditor(${index})" class="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800">${hasRecord ? 'Review Level' : 'Create Progress'}</button>
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

    if (Number(row.learning_level_id || 0) > 0) {
        await openLevelReadinessReview(index);
        return;
    }
    // A new learning record cannot skip the review step and become exam-ready.
    const readinessOptions = ['Not Ready','Developing','Improving'];
    const levelOptions = Array.from({ length: 10 }, (_, levelIndex) => `Level ${levelIndex + 1}`);
    const topicOptions = ['Fundamentals','Technique Development','Reading and Theory','Rhythm and Timing','Repertoire Practice','Performance Preparation','Promotional Exam Preparation'];
    const skillOptions = ['Foundation skills','Technique and control','Reading and theory','Rhythm and timing','Musical expression','Performance confidence'];
    const improvementOptions = ['Technique consistency','Rhythm consistency','Reading accuracy','Practice preparation','Musical expression','Performance confidence'];
    const materials = Array.isArray(row.learning_materials) ? row.learning_materials : [];
    const optionHtml = (values, selected, placeholder) => `<option value="">${learningHtml(placeholder)}</option>${values.map(value => `<option value="${learningHtml(value)}" ${value === selected ? 'selected' : ''}>${learningHtml(value)}</option>`).join('')}`;
    const materialOptions = level => materials.filter(material => !level || material.level_name === level);
    const renderMaterialOptions = level => `<option value="">No book/material selected</option>${materialOptions(level).map(material => `<option value="${learningHtml(material.material_name)}" ${material.material_name === row.book_material ? 'selected' : ''}>${learningHtml(material.material_name)}</option>`).join('')}`;
    const result = await Swal.fire({
        title: 'Create Learning Record',
        width: 620,
        padding: '1.25rem',
        customClass: { popup: 'learning-record-popup', title: 'learning-record-title' },
        showCancelButton: true,
        confirmButtonText: 'Save Learning Progress',
        confirmButtonColor: '#111827',
        html: `<div class="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left"><div class="font-black text-slate-900">${learningHtml(`${row.first_name || ''} ${row.last_name || ''}`.trim())}</div><div class="mt-0.5 text-xs font-semibold text-gold-700">${learningHtml(row.instrument_name || 'Instrument')}</div></div><div class="grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
            <div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Current level *</label><select id="lpLevel" class="swal2-select !m-0 !w-full">${optionHtml(levelOptions, row.level_name || '', 'Select current level')}</select></div>
            <div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Book / material <span class="font-normal normal-case text-slate-400">(optional)</span></label><select id="lpBook" class="swal2-select !m-0 !w-full">${renderMaterialOptions(row.level_name || '')}</select><a id="lpMaterialFile" class="mt-1 hidden text-xs font-bold text-blue-600 hover:underline" target="_blank"><i class="fas fa-file-arrow-down mr-1"></i>View uploaded material</a></div>
            <div class="sm:col-span-2"><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Lesson / current topic</label><select id="lpTopic" class="swal2-select !m-0 !w-full">${optionHtml(topicOptions, row.current_topic || '', 'Select current topic')}</select></div>
            <div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Skills being developed</label><select id="lpSkills" class="swal2-select !m-0 !w-full">${optionHtml(skillOptions, row.skills_developing || '', 'Select primary skill')}</select></div>
            <div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Primary area for improvement</label><select id="lpImprovement" class="swal2-select !m-0 !w-full">${optionHtml(improvementOptions, row.areas_for_improvement || '', 'Select improvement area')}</select></div>
            <div class="sm:col-span-2"><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Instructor notes</label><textarea id="lpNotes" rows="2" class="swal2-textarea !m-0 !h-20 !w-full">${learningHtml(row.instructor_notes || '')}</textarea></div>
            <div class="sm:col-span-2"><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Assessment readiness</label><select id="lpReadiness" class="swal2-select !m-0 !w-full">${readinessOptions.map(value => `<option ${value === (row.assessment_readiness || 'Not Ready') ? 'selected' : ''}>${value}</option>`).join('')}</select></div>
        </div>`,
        didOpen: () => {
            const syncMaterialFile = () => {
                const selectedName = document.getElementById('lpBook')?.value || '';
                const material = materials.find(item => item.material_name === selectedName);
                const link = document.getElementById('lpMaterialFile');
                if (!link) return;
                link.classList.toggle('hidden', !material?.file_path);
                if (material?.file_path) link.href = `../../${String(material.file_path).replace(/^\/+/, '')}`;
            };
            document.getElementById('lpLevel')?.addEventListener('change', event => {
                const book = document.getElementById('lpBook');
                if (book) book.innerHTML = renderMaterialOptions(event.target.value || '');
                syncMaterialFile();
            });
            document.getElementById('lpBook')?.addEventListener('change', syncMaterialFile);
            syncMaterialFile();
        },
        preConfirm: () => {
            const level = document.getElementById('lpLevel')?.value.trim() || '';
            if (!level) { Swal.showValidationMessage('Current level is required.'); return false; }
            const book = document.getElementById('lpBook')?.value.trim() || '';
            return {
                level_name: level,
                book_material: book,
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

function learningDate(value) {
    if (!value) return 'Date unavailable';
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? learningHtml(value) : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function learningTrend(evaluations) {
    const rated = evaluations.filter(item => item.average_score !== null && item.average_score !== '' && Number.isFinite(Number(item.average_score))).slice(0, 4);
    if (rated.length < 2) return { label: 'Not enough rated sessions', detail: 'At least two graded sessions are needed to describe a trend.', className: 'bg-slate-100 text-slate-600' };
    const newest = Number(rated[0].average_score);
    const oldest = Number(rated[rated.length - 1].average_score);
    const change = newest - oldest;
    if (change >= 0.35) return { label: 'Improving', detail: `Recent average increased from ${oldest.toFixed(2)} to ${newest.toFixed(2)}.`, className: 'bg-emerald-100 text-emerald-700' };
    if (change <= -0.35) return { label: 'Needs review', detail: `Recent average changed from ${oldest.toFixed(2)} to ${newest.toFixed(2)}.`, className: 'bg-amber-100 text-amber-700' };
    return { label: 'Steady', detail: `Recent ratings are consistent around ${newest.toFixed(2)}/5.`, className: 'bg-blue-100 text-blue-700' };
}

function evaluationDetails(evaluation) {
    const criteria = Array.isArray(evaluation.criteria_scores) ? evaluation.criteria_scores : [];
    if (!criteria.length) return '';
    return `<div class="mt-3 grid grid-cols-2 gap-2">${criteria.map(item => `<div class="rounded-lg bg-white px-3 py-2"><div class="text-[10px] font-bold uppercase tracking-wide text-slate-400">${learningHtml(item.name || 'Criterion')}</div><div class="mt-0.5 font-black text-slate-800">${Number(item.score || 0)}/5</div></div>`).join('')}</div>`;
}

async function openLevelReadinessReview(index) {
    const row = instructorLearningRows[Number(index)];
    if (!row?.learning_level_id) return;
    const evaluations = Array.isArray(row.session_evaluations) ? row.session_evaluations : [];
    const trend = learningTrend(evaluations);
    const sessionCards = evaluations.length ? evaluations.map(evaluation => {
        const rated = Number(evaluation.progress_id || 0) > 0;
        const rating = evaluation.skill_level || (rated ? 'Evaluated' : 'Not evaluated yet');
        const notes = evaluation.remarks || evaluation.session_notes || evaluation.attendance_notes || 'No notes recorded for this session.';
        return `<article class="rounded-xl border ${rated ? 'border-slate-200 bg-slate-50' : 'border-dashed border-slate-200 bg-white'} p-4">
            <div class="flex flex-wrap items-start justify-between gap-2">
                <div><div class="font-black text-slate-900">Session ${Number(evaluation.session_number || 0) || '—'} — ${learningHtml(rating)}</div><div class="mt-0.5 text-xs text-slate-400">${learningDate(evaluation.session_date)}</div></div>
                ${evaluation.average_score !== null && evaluation.average_score !== '' ? `<span class="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-black text-white">${Number(evaluation.average_score).toFixed(2)}/5</span>` : '<span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">No saved grade</span>'}
            </div>
            <p class="mt-3 text-sm leading-6 text-slate-600">${learningHtml(notes)}</p>
            ${evaluationDetails(evaluation)}
        </article>`;
    }).join('') : '<div class="rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">No completed sessions are available for this instrument yet. Readiness is never set automatically.</div>';

    const result = await Swal.fire({
        width: 820,
        title: 'Review Level Readiness',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Ready for Promotional Exam',
        denyButtonText: 'Continue Current Level',
        cancelButtonText: 'Close',
        confirmButtonColor: '#047857',
        denyButtonColor: '#334155',
        reverseButtons: true,
        html: `<div class="text-left">
            <div class="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
                <div class="col-span-2"><div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Student</div><div class="mt-1 font-black text-slate-900">${learningHtml(`${row.first_name || ''} ${row.last_name || ''}`.trim())}</div></div>
                <div><div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Instrument</div><div class="mt-1 font-bold text-slate-800">${learningHtml(row.instrument_name || '—')}</div></div>
                <div><div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completed</div><div class="mt-1 font-black text-slate-900">${Number(row.completed_sessions || 0)} sessions</div></div>
                <div class="col-span-2"><div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current level</div><div class="mt-1 font-bold text-slate-800">${learningHtml(row.level_name || 'Not set')}</div></div>
                <div class="col-span-2"><div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Book / material</div><div class="mt-1 font-bold text-slate-800">${learningHtml(row.book_material || 'Not set')}</div></div>
            </div>
            <div class="mt-4 rounded-xl px-4 py-3 ${trend.className}"><div class="text-xs font-black uppercase tracking-wider">Recent progress trend: ${trend.label}</div><div class="mt-1 text-sm">${trend.detail}</div></div>
            ${row.instructor_notes ? `<div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"><div class="text-xs font-black uppercase tracking-wider text-amber-800">Current instructor notes</div><p class="mt-1 text-sm leading-6 text-amber-900">${learningHtml(row.instructor_notes)}</p></div>` : ''}
            <div class="mb-2 mt-5 flex items-end justify-between gap-3"><div><div class="font-black text-slate-900">Previous session evaluations</div><div class="text-xs text-slate-500">Newest session first · selected instrument only</div></div><span class="text-xs font-semibold text-slate-500">${evaluations.length} completed</span></div>
            <div class="max-h-[42vh] space-y-3 overflow-y-auto pr-1">${sessionCards}</div>
            <p class="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-xs leading-5 text-slate-600">Session history supports your decision but does not decide it. Only a passed promotional exam advances the level and creates a certificate.</p>
        </div>`
    });
    if (!result.isConfirmed && !result.isDenied) return;

    const readiness = result.isConfirmed ? 'Ready for Assessment' : (row.assessment_readiness === 'Ready for Assessment' ? 'Improving' : (row.assessment_readiness || 'Not Ready'));
    const user = Auth.getUser();
    try {
        const response = await axios.post(`${baseApiUrl}/teachers.php`, {
            action: 'save-learning-progress', user_id: user.user_id,
            student_id: Number(row.student_id), instrument_id: Number(row.instrument_id),
            level_name: row.level_name, book_material: row.book_material || '', current_topic: row.current_topic || '',
            skills_developing: row.skills_developing || '', areas_for_improvement: row.areas_for_improvement || '',
            instructor_notes: row.instructor_notes || '', assessment_readiness: readiness,
            readiness_reviewed: true
        });
        if (!response.data?.success) throw new Error(response.data?.error || 'Unable to save readiness decision.');
        showMessage(result.isConfirmed ? 'Student marked Ready for Promotional Exam.' : 'Student will continue at the current level.', 'success');
        await loadInstructorLearningProgress();
    } catch (error) { showMessage(error?.response?.data?.error || error.message, 'error'); }
}

async function openPromotionalExamForm(index) {
    const row = instructorLearningRows[Number(index)];
    if (!row?.learning_level_id) return;
    const today = new Date().toISOString().slice(0,10);
    const levels = Array.from({ length: 10 }, (_, levelIndex) => `Level ${levelIndex + 1}`);
    const materials = Array.isArray(row.learning_materials) ? row.learning_materials : [];
    const nextMaterialOptions = level => `<option value="">No next book/material</option>${materials.filter(material => !level || material.level_name === level).map(material => `<option value="${learningHtml(material.material_name)}">${learningHtml(material.material_name)}</option>`).join('')}`;
    const result = await Swal.fire({
        title: `Promotional Exam · ${learningHtml(row.level_name)}`,
        width: 580,
        padding: '1rem',
        customClass: { popup: 'promotional-exam-popup' },
        showCancelButton: true,
        confirmButtonText: 'Record Result',
        confirmButtonColor: '#b8860b',
        html: `<div class="space-y-3 text-left">
            <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"><div><div class="text-sm font-bold text-slate-900">${learningHtml(`${row.first_name || ''} ${row.last_name || ''}`.trim())}</div><div class="text-xs text-slate-500">${learningHtml(row.instrument_name || 'Instrument')}</div></div><span class="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700">Formal assessment</span></div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label class="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Exam date</label><input id="examDate" type="date" value="${today}" class="swal2-input !m-0 !w-full"></div>
                <div><label class="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Result</label><select id="examResult" class="swal2-select !m-0 !w-full"><option value="Passed">Passed</option><option value="Retake">Retake</option></select></div>
                <div class="sm:col-span-2"><label class="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Grade / rating *</label><select id="examRating" class="swal2-select !m-0 !w-full"><option value="">Select formal rating</option><option>Outstanding</option><option>Excellent</option><option>Very Good</option><option>Good</option><option>Developing</option></select></div>
            </div>
            <div><label class="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Examiner notes</label><textarea id="examNotes" rows="2" class="swal2-textarea !m-0 !w-full" placeholder="Optional assessment notes"></textarea></div>
            <div id="examNextFields" class="grid grid-cols-1 gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 sm:grid-cols-2"><div><label class="mb-1 block text-[10px] font-bold uppercase tracking-wide text-emerald-700">Next level *</label><select id="examNextLevel" class="swal2-select !m-0 !w-full"><option value="">Select next level</option>${levels.map(level => `<option value="${level}">${level}</option>`).join('')}</select></div><div><label class="mb-1 block text-[10px] font-bold uppercase tracking-wide text-emerald-700">Next material <span class="font-normal normal-case text-slate-400">(optional)</span></label><select id="examNextBook" class="swal2-select !m-0 !w-full">${nextMaterialOptions('')}</select></div></div>
            <p class="text-[11px] leading-4 text-slate-500">Passing advances the level and makes the certificate available. Retake keeps the current level.</p>
        </div>`,
        didOpen: () => {
            const resultSelect = document.getElementById('examResult');
            const nextFields = document.getElementById('examNextFields');
            const levelSelect = document.getElementById('examNextLevel');
            const bookSelect = document.getElementById('examNextBook');
            const syncResult = () => nextFields?.classList.toggle('hidden', resultSelect?.value !== 'Passed');
            resultSelect?.addEventListener('change', syncResult);
            levelSelect?.addEventListener('change', () => { if (bookSelect) bookSelect.innerHTML = nextMaterialOptions(levelSelect.value || ''); });
            syncResult();
        },
        preConfirm: () => {
            const examResult = document.getElementById('examResult')?.value || '';
            const rating = document.getElementById('examRating')?.value.trim() || '';
            const nextLevel = document.getElementById('examNextLevel')?.value.trim() || '';
            const nextBook = document.getElementById('examNextBook')?.value.trim() || '';
            if (!rating) { Swal.showValidationMessage('Formal grade or rating is required.'); return false; }
            if (examResult === 'Passed' && !nextLevel) { Swal.showValidationMessage('Select the next level for a passing result.'); return false; }
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

async function openLearningMaterialRequest() {
    let instrumentNames = [];
    try {
        const specializationResponse = await axios.get(`${baseApiUrl}/learning_materials.php?action=my-specializations`);
        instrumentNames = Array.isArray(specializationResponse.data?.instruments) ? specializationResponse.data.instruments : [];
    } catch (error) {
        showMessage(error?.response?.data?.error || 'Unable to load your instrument specializations.', 'error');
        return;
    }
    if (!instrumentNames.length) {
        showMessage('No active instrument specialization is available for a book request.', 'error');
        return;
    }
    const levels = Array.from({ length: 10 }, (_, index) => `Level ${index + 1}`);
    const result = await Swal.fire({
        title: 'Request Learning Material', width: 540, padding: '1.25rem',
        customClass: { popup: 'learning-record-popup', title: 'learning-record-title' },
        showCancelButton: true, confirmButtonText: 'Send Request', confirmButtonColor: '#111827',
        html: `<div class="space-y-3 text-left"><p class="rounded-xl bg-slate-100 px-4 py-3 text-xs leading-5 text-slate-600">Request only for your specialization. Admin approval is required before the book appears in student dropdowns.</p><div><label class="mb-1 block text-xs font-bold uppercase text-slate-500">Instrument *</label><select id="requestInstrument" class="swal2-select !m-0 !w-full"><option value="">Select instrument</option>${instrumentNames.map(name => `<option value="${learningHtml(name)}">${learningHtml(name)}</option>`).join('')}</select></div><div><label class="mb-1 block text-xs font-bold uppercase text-slate-500">Level *</label><select id="requestLevel" class="swal2-select !m-0 !w-full"><option value="">Select level</option>${levels.map(level => `<option>${level}</option>`).join('')}</select></div><div><label class="mb-1 block text-xs font-bold uppercase text-slate-500">Book / material name *</label><input id="requestMaterialName" class="swal2-input !m-0 !w-full" maxlength="255" placeholder="Enter the published material title"></div><div><label class="mb-1 block text-xs font-bold uppercase text-slate-500">Reason for request</label><textarea id="requestReason" rows="3" class="swal2-textarea !m-0 !w-full" placeholder="How will this support the student’s learning?"></textarea></div></div>`,
        preConfirm: () => {
            const instrument_type=document.getElementById('requestInstrument')?.value||'';
            const level_name=document.getElementById('requestLevel')?.value||'';
            const material_name=document.getElementById('requestMaterialName')?.value.trim()||'';
            if (!instrument_type||!level_name||!material_name) { Swal.showValidationMessage('Instrument, level, and material name are required.'); return false; }
            return { instrument_type,level_name,material_name,request_reason:document.getElementById('requestReason')?.value.trim()||'' };
        }
    });
    if (!result.isConfirmed) return;
    try {
        const response=await axios.post(`${baseApiUrl}/learning_materials.php?action=request`,result.value);
        showMessage(response.data?.message||'Book request sent to Admin.','success');
    } catch(error) { showMessage(error?.response?.data?.error||error.message,'error'); }
}

window.openLearningProgressEditor = openLearningProgressEditor;
window.openPromotionalExamForm = openPromotionalExamForm;
window.filterInstructorLearningProgress = renderInstructorLearningProgress;
window.openLearningMaterialRequest = openLearningMaterialRequest;
document.addEventListener('DOMContentLoaded', loadInstructorLearningProgress);
