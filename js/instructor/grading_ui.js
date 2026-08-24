/* ================================================================
   instructor/grading_ui.js  — UI helpers for the new grading panel
   ================================================================ */

// ── Grading Panel (Slide-over) ────────────────────────────────────
function openGradingPanel() {
    const panel = document.getElementById('gradingPanel');
    const backdrop = document.getElementById('gradingBackdrop');
    if (!panel || !backdrop) return;
    
    panel.classList.remove('hidden');
    backdrop.classList.remove('hidden');
    // Trigger reflow
    void panel.offsetWidth;
    panel.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeGradingPanel() {
    const panel = document.getElementById('gradingPanel');
    const backdrop = document.getElementById('gradingBackdrop');
    if (!panel || !backdrop) return;
    
    panel.classList.remove('show');
    setTimeout(() => {
        panel.classList.add('hidden');
        backdrop.classList.add('hidden');
        document.body.style.overflow = '';
    }, 300);
}

function selectSkillLevel(level) {
    const input = document.getElementById('skillLevelInput');
    if (input) input.value = level;
    
    // Update button states
    document.querySelectorAll('.skill-level-btn').forEach(btn => {
        if (btn.dataset.level === level) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
    
    if (typeof updateScorePreview === 'function') updateScorePreview();
}

window.openGradingPanel = openGradingPanel;
window.closeGradingPanel = closeGradingPanel;
window.selectSkillLevel = selectSkillLevel;

// ── Lesson History Modal ──────────────────────────────────────────
async function openLessonHistoryModal() {
    const modal = document.getElementById('lessonHistoryModal');
    if (!modal) return;
    
    const session = (typeof instructorGradeSessions !== 'undefined' && Array.isArray(instructorGradeSessions)) 
        ? instructorGradeSessions.find(s => Number(s.session_id || 0) === Number(selectedGradeSessionId || 0)) 
        : null;
        
    // If no session selected, show all graded sessions from all students
    if (!session) {
        const titleEl = document.getElementById('lessonHistoryModalTitle');
        const subtitleEl = document.getElementById('lessonHistoryModalSubtitle');
        if (titleEl) titleEl.textContent = 'Lesson History';
        if (subtitleEl) subtitleEl.textContent = 'All graded sessions from your students.';
        
        // Get all graded sessions and mark that we want to show student names
        const allGradedSessions = instructorGradeSessions.filter(s => Number(s.progress_id || 0) > 0);
        renderLessonHistoryTable(allGradedSessions, true); // true = show student column
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
        return;
    }

    const studentName = `${session.student_first_name || ''} ${session.student_last_name || ''}`.trim() || 'Student';
    const studentId = Number(session.student_id || 0);
    const enrollmentId = Number(session.enrollment_id || 0);
    
    const titleEl = document.getElementById('lessonHistoryModalTitle');
    const subtitleEl = document.getElementById('lessonHistoryModalSubtitle');
    if (titleEl) titleEl.textContent = studentName;
    if (subtitleEl) subtitleEl.textContent = `Previous grades for ${studentName}.`;
    
    // Fetch lesson history from backend using the correct internal helper
    try {
        // Use the internal grading system's existing session list
        const allSessions = instructorGradeSessions.filter(s => 
            Number(s.student_id) === studentId && 
            Number(s.enrollment_id) === enrollmentId &&
            Number(s.progress_id || 0) > 0  // Only show graded sessions
        );
        
        renderLessonHistoryTable(allSessions, false); // false = don't show student column
        
    } catch (error) {
        console.error('Failed to load lesson history:', error);
        if (typeof showGradeMessage === 'function') {
            showGradeMessage('Network error — please try again.', 'error');
        }
        return;
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function renderLessonHistoryTable(history) {
    const tbody = document.getElementById('lessonHistoryTableBody');
    const recordCount = document.getElementById('lessonHistoryRecordCount');
    
    if (!tbody) return;
    
    if (!history.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-10 text-center text-sm text-gray-400">
                    <i class="fas fa-history text-2xl text-gray-200 block mb-3 mx-auto"></i>
                    No lesson history found for this student.
                </td>
            </tr>`;
        if (recordCount) recordCount.textContent = '0 records';
        return;
    }
    
    tbody.innerHTML = history.map(record => {
        const formatDate = (dateStr, time) => {
            if (!dateStr) return '—';
            const d = new Date(dateStr);
            if (Number.isNaN(d.getTime())) return '—';
            // Format as "Aug 17, 2026 at 3:00 PM"
            const month = d.toLocaleDateString('en-US', { month: 'short' });
            const day = d.getDate();
            const year = d.getFullYear();
            
            // Format time
            let timeStr = '';
            if (time) {
                const parts = String(time).split(':');
                const h = Number(parts[0]), m = Number(parts[1] || 0);
                if (!Number.isNaN(h)) {
                    timeStr = ` at ${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
                }
            }
            
            return `${month} ${day}, ${year}${timeStr}`;
        };
        
        const date = formatDate(record.session_date, record.start_time);
        const focus = record.lesson_focus || record.notes || '—';
        const attendance = String(record.attendance_status || 'Pending');
        const level = record.skill_level || '—';
        const score = record.average_score ? `${Number(record.average_score).toFixed(1)}` : '—';
        
        // Simple text for attendance - matching your screenshot
        const attText = attendance.toLowerCase() === 'present' 
            ? 'Present'
            : attendance.toLowerCase() === 'late'
            ? 'Late'
            : 'Absent';
        
        return `
            <tr class="border-b border-gray-100 last:border-b-0">
                <td class="px-6 py-4 text-sm text-gray-700">${date}</td>
                <td class="px-6 py-4 text-sm text-gray-900">${focus}</td>
                <td class="px-6 py-4 text-sm text-gray-700">${attText}</td>
                <td class="px-6 py-4 text-sm text-gray-700">${level}</td>
                <td class="px-6 py-4 text-right text-base font-semibold text-gray-900">${score}</td>
            </tr>`;
    }).join('');
    
    if (recordCount) recordCount.textContent = `${history.length} record${history.length !== 1 ? 's' : ''}`;
}

function closeLessonHistoryModal() {
    const modal = document.getElementById('lessonHistoryModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
}

window.openLessonHistoryModal = openLessonHistoryModal;
window.closeLessonHistoryModal = closeLessonHistoryModal;
