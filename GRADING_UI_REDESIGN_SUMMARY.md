# Instructor Grading UI Redesign - Task 6

## STATUS: COMPLETED

## User Requirements
Based on user screenshots and feedback:
1. Main page with session list showing time, student name with avatar, instrument/duration/room info
2. Slide-over grading panel (not modal) with student info and grading form
3. Only Present and Absent attendance options (Late treated as Present internally)
4. Overall level as selectable cards with descriptions
5. Lesson history modal with simple table showing DATE, FOCUS, ATTENDANCE, LEVEL, SCORE
6. Date format: "Aug 17, 2026 at 3:00 PM"

## Changes Made

### 1. Backend - API Update
**File:** `api/students.php`

Added `lesson_focus` field to the progress query:
```php
ts.notes AS lesson_focus,
```

This allows lesson history to display the session notes as the focus/topic of the lesson.

### 2. Frontend - HTML Structure
**File:** `pages/instructor/instructor_grading.html`

- Added grading_ui.js script reference
- Updated page header with search bar and "Lesson History" button
- Restructured session list to show cards with time, avatar, name, instrument info
- Converted two-column layout to slide-over panel
- Added attendance section without Late option
- Updated overall level section to card-based selection
- Kept lesson history modal with clean table

### 3. Frontend - Grading Logic
**File:** `js/instructor/grading.js`

**Updated Functions:**
- `renderAttendanceControl()` - Treats "late" status same as "present" (allows grading)
- `populateGradeForm()` - Updates panel header, avatar initials, lesson focus, and session metadata
- `renderGradeSessions()` - New card layout with avatars, scores, and selection state
- `saveSessionGrade()` - Updated button text to "Session done"

**Key Logic:**
- Late students can be graded (treated as present internally)
- Grading panel opens when session card is clicked
- Panel shows student avatar, name, instrument, duration, room
- Session list shows only today's sessions
- Graded sessions show score badge

### 4. Frontend - UI Components
**File:** `js/instructor/grading_ui.js`

**New Functions:**
- `openGradingPanel()` - Slides panel in from right with backdrop
- `closeGradingPanel()` - Slides panel out
- `selectSkillLevel(level)` - Handles skill level card selection
- `openLessonHistoryModal()` - Opens modal and filters graded sessions
- `renderLessonHistoryTable(history)` - Renders table with date+time, focus, attendance, level, score
- `closeLessonHistoryModal()` - Closes modal

**Data Flow:**
- Uses existing `instructorGradeSessions` array
- Filters for graded sessions only (progress_id > 0)
- Displays date as "Aug 17, 2026 at 3:00 PM"
- Shows lesson focus from session notes
- Plain text for attendance (no badges)

### 5. CSS Styles
**File:** `css/instructor.css`

Added styles for:
- Grading panel slide-in animation
- Attendance card selection state
- Skill level button selection state
- Panel transform transitions

## UI Flow

### Session List
1. Shows today's sessions only
2. Each card displays:
   - Time (left)
   - Avatar with initials (colored circle)
   - Student name
   - Instrument · Duration · Studio
   - Score badge (if graded) or "Not graded"
3. Click opens grading panel

### Grading Panel (Slide-over)
1. **Header:**
   - Student avatar (initials)
   - Student name
   - Instrument · Duration · Time in Room
   - Close button

2. **Body:**
   - Lesson focus (from session notes)
   - Attendance section (Present/Absent or instructor override)
   - Performance scores (5 criteria with 1-5 rating)
   - Overall level (4 card buttons: Beginner, Developing, Proficient, Advanced)
   - Notes for student (textarea)

3. **Footer:**
   - Cancel button
   - "Session done" button (saves grade)

### Lesson History Modal
1. Opens from "Lesson history" button in header
2. Shows modal with table:
   - DATE (with time)
   - FOCUS (lesson topic/notes)
   - ATTENDANCE (Present/Late/Absent as plain text)
   - LEVEL (skill level)
   - SCORE (average score, right-aligned)
3. Only shows graded sessions
4. Record count in footer

## Technical Details

### Attendance Logic
- **Graded sessions** (progress_id > 0): Read-only "Present — already graded" badge
- **Present/Late** (desk confirmed): Read-only badge, grading unlocked
- **Absent/Excused/CI**: Read-only badge, grading locked
- **Pending**: "End Session" button for instructor override

### Data Sources
- **Session list**: `instructorGradeSessions` array (loaded from teachers.php)
- **Lesson history**: Filtered from same array (graded sessions only)
- **Lesson focus**: From `notes` or `attendance_notes` field in tbl_sessions

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile responsive (slide panel adapts to screen size)
- Touch-friendly interactions

## Testing Checklist

- [ ] Session cards render correctly
- [ ] Click opens grading panel
- [ ] Panel shows correct student info
- [ ] Attendance control works (Present/Absent/End Session)
- [ ] Score buttons function
- [ ] Skill level cards select/deselect
- [ ] Form submission saves grade
- [ ] Lesson history button opens modal
- [ ] Lesson history table shows correct data
- [ ] Date format is correct ("Aug 17, 2026 at 3:00 PM")
- [ ] Modal closes properly
- [ ] Panel slides in/out smoothly

## Files Modified
1. `api/students.php` - Added lesson_focus field
2. `pages/instructor/instructor_grading.html` - Added script, updated structure
3. `js/instructor/grading.js` - Updated attendance logic, form population, session rendering
4. `js/instructor/grading_ui.js` - Updated lesson history display
5. `css/instructor.css` - Added panel animation styles

## Next Steps
User should test the grading flow:
1. Navigate to Instructor → Grading
2. Verify session list shows today's sessions
3. Click a session card
4. Verify grading panel opens with correct info
5. Test attendance selection
6. Test score rating buttons
7. Test skill level cards
8. Click "Lesson history" button
9. Verify modal shows graded sessions with dates and times
10. Submit a grade and verify it saves
