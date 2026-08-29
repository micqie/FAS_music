-- EXISTING-ACCOUNT TEST DATA
-- Instructor: Bon Sabeliina (bon@fas.com), existing teacher_id 17
-- Student: Arman Salon (arman@gmail.com), existing student_id 7
-- Existing enrollment: 12-session Ukulele package
-- Password for both accounts after import: Test1234!
--
-- No users, admins, instructors, students, enrollments, exams, or certificates
-- are created. This prepares the existing pair for a manual end-to-end test.

START TRANSACTION;

-- Match the collation used by the existing FAS tables for this import session.
SET NAMES utf8mb4 COLLATE utf8mb4_general_ci;

SET @test_hash := '$2y$10$UN15UGLpHGt55XHIbL5EoOI.jZxPASVxR4k0NUgkI4Jhn9lGcU/DG';
-- Numeric IDs are used deliberately. The source dump contains mixed text
-- collations, so comparing username/type text can raise error 1267.
SET @instructor_login := CONVERT('bon@fas.com' USING utf8mb4) COLLATE utf8mb4_general_ci;
SET @student_login := CONVERT('arman@gmail.com' USING utf8mb4) COLLATE utf8mb4_general_ci;
SET @instructor_user := 108;
SET @student_user := 19;
SET @teacher := 17;
SET @student := 7;
SET @enrollment := 28;
SET @instrument := 17;

-- Reset only the two selected existing accounts to a known testing password.
UPDATE tbl_users
SET password=@test_hash, status='Active', failed_login_attempts=0,
    account_locked_at=NULL, account_locked_reason=NULL, failed_login_last_at=NULL,
    active_session_token=NULL, active_session_updated_at=NULL,
    active_browser_token_hash=NULL, active_browser_token_updated_at=NULL
WHERE user_id IN (@instructor_user,@student_user);

-- Four instructor-defined criteria, intentionally fewer than five.
DELETE FROM tbl_teacher_grading_criteria WHERE teacher_id=@teacher;
INSERT INTO tbl_teacher_grading_criteria
    (teacher_id,criterion_name,sort_order,status)
VALUES
    (@teacher,'Chord Accuracy',0,'Active'),
    (@teacher,'Rhythm & Timing',1,'Active'),
    (@teacher,'Strumming Control',2,'Active'),
    (@teacher,'Musical Expression',3,'Active');

-- Complete only Sessions 1-8. Sessions 9-12 remain purchased and unused.
UPDATE tbl_sessions
SET teacher_id=@teacher, instrument_id=@instrument,
    session_date=CASE session_number
        WHEN 1 THEN CURDATE()-INTERVAL 8 WEEK
        WHEN 2 THEN CURDATE()-INTERVAL 7 WEEK
        WHEN 3 THEN CURDATE()-INTERVAL 6 WEEK
        WHEN 4 THEN CURDATE()-INTERVAL 5 WEEK
        WHEN 5 THEN CURDATE()-INTERVAL 4 WEEK
        WHEN 6 THEN CURDATE()-INTERVAL 3 WEEK
        WHEN 7 THEN CURDATE()-INTERVAL 2 WEEK
        WHEN 8 THEN CURDATE()-INTERVAL 1 WEEK
        ELSE session_date END,
    status='Completed', attendance_status='Present', absence_notice='None',
    counted_in=1, attendance_notes='Present - promotional workflow test',
    notes=CASE session_number
        WHEN 1 THEN 'Ukulele posture and basic C chord'
        WHEN 2 THEN 'C, F, and G7 chord transitions'
        WHEN 3 THEN 'Down-strum rhythm patterns'
        WHEN 4 THEN 'Up-strum and syncopation practice'
        WHEN 5 THEN 'Chord changes with metronome'
        WHEN 6 THEN 'Dynamics and musical phrasing'
        WHEN 7 THEN 'Performance preparation'
        WHEN 8 THEN 'Level 1 assessment preparation'
        ELSE notes END
WHERE enrollment_id=@enrollment AND session_number BETWEEN 1 AND 8;

UPDATE tbl_sessions
SET teacher_id=@teacher, instrument_id=@instrument, status='Scheduled',
    attendance_status='Pending', absence_notice='None', counted_in=0,
    attendance_notes=NULL
WHERE enrollment_id=@enrollment AND session_number BETWEEN 9 AND 12;

UPDATE tbl_enrollments
SET completed_sessions=8, schedule_status='Active', used_absences=0,
    consecutive_absences=0, status='Active'
WHERE enrollment_id=@enrollment;

-- Clear this pair's learning test results so you can perform the flow yourself.
DELETE FROM tbl_student_certificates WHERE student_id=@student AND instrument_id=@instrument;
DELETE FROM tbl_promotional_exams WHERE student_id=@student AND instrument_id=@instrument;
DELETE FROM tbl_student_learning_levels WHERE student_id=@student AND instrument_id=@instrument;
DELETE p FROM tbl_student_progress p
INNER JOIN tbl_sessions s ON s.session_id=p.session_id
WHERE s.enrollment_id=@enrollment;

-- Current learning record only: there is deliberately no exam/certificate yet.
INSERT INTO tbl_student_learning_levels
    (student_id,instrument_id,teacher_id,level_name,book_material,current_topic,
     instructor_notes,skills_developing,areas_for_improvement,
     assessment_readiness,status,started_at)
VALUES
    (@student,@instrument,@teacher,'Level 1',
     'Hal Leonard Ukulele Method Book 1',
     'Chord transitions, rhythm, and performance preparation',
     'Arman is progressing quickly after eight lessons. Save a session grade, then mark him Ready for Assessment.',
     'Clean chord changes; steady rhythm; musical expression',
     'Keep a consistent tempo during faster chord transitions',
     'Improving','In Progress',CURDATE()-INTERVAL 8 WEEK);

-- Small song masterfile for Bon's Ukulele specialization.
DELETE FROM tbl_song_library
WHERE teacher_id=@teacher AND tags LIKE '%EXISTING-PAIR-TEST%';
INSERT INTO tbl_song_library
    (teacher_id,title,artist,genre,category,difficulty_level,tags,notes,status)
VALUES
    (@teacher,'Riptide','Vance Joy','Indie Pop','ukulele','Beginner','EXISTING-PAIR-TEST, chords','For chord and rhythm practice.','Active'),
    (@teacher,'Count on Me','Bruno Mars','Pop','ukulele','Beginner','EXISTING-PAIR-TEST, rhythm','For steady strumming and chord transitions.','Active'),
    (@teacher,'Somewhere Over the Rainbow','Israel Kamakawiwoole','Hawaiian Pop','ukulele','Intermediate','EXISTING-PAIR-TEST, performance','For phrasing and performance preparation.','Active'),
    (@teacher,'I''m Yours','Jason Mraz','Pop','ukulele','Beginner','EXISTING-PAIR-TEST, strumming','For relaxed strumming patterns.','Active'),
    (@teacher,'You Are My Sunshine','Traditional','Folk','ukulele','Beginner','EXISTING-PAIR-TEST, recital','For beginner recital preparation.','Active');

COMMIT;

-- Verification output
SELECT @teacher AS teacher_id, @instructor_login AS instructor_login,
       @student AS student_id, @student_login AS student_login,
       @enrollment AS enrollment_id, @instrument AS instrument_id,
       'Test1234!' AS test_password;
SELECT e.total_sessions AS purchased, e.completed_sessions AS completed,
       e.total_sessions-e.completed_sessions AS remaining,
       ll.level_name, ll.assessment_readiness, ll.status AS learning_status
FROM tbl_enrollments e
INNER JOIN tbl_student_learning_levels ll
  ON ll.student_id=e.student_id AND ll.instrument_id=e.instrument_id
WHERE e.enrollment_id=@enrollment AND ll.status='In Progress';
