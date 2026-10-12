-- EXISTING-ACCOUNT TEST DATA
-- Instructor: Bon Sabeliina (bon@fas.com), existing teacher_id 17
-- Student: Arman Salon (arman@gmail.com), existing student_id 7
-- Existing enrollment: 12-session Ukulele package
-- Password for both accounts after import: Test1234!
--
-- No users, admins, instructors, students, or enrollments are created.
-- Arman is seeded with passed Levels 1-4, issued certificates, and Level 5
-- (Intermediate) in progress so the student progress page has a complete example.

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

-- Reset this pair's learning test results before seeding the achievement history.
DELETE FROM tbl_student_certificates WHERE student_id=@student AND instrument_id=@instrument;
DELETE FROM tbl_promotional_exams WHERE student_id=@student AND instrument_id=@instrument;
DELETE FROM tbl_student_learning_levels WHERE student_id=@student AND instrument_id=@instrument;
DELETE p FROM tbl_student_progress p
INNER JOIN tbl_sessions s ON s.session_id=p.session_id
WHERE s.enrollment_id=@enrollment;

-- Add the eight completed-session assessments. The five scored areas feed the
-- certificate skill-strength summary shown on the student's page.
INSERT INTO tbl_student_progress (
    student_id, session_id, instrument_id, skill_level,
    performance_score, technique_score, rhythm_score, focus_score, assignment_score,
    criteria_scores, remarks, assessment_date
)
SELECT
    e.student_id,
    ts.session_id,
    COALESCE(ts.instrument_id,e.instrument_id),
    CASE WHEN ts.session_number >= 7 THEN 'Advanced' ELSE 'Developing' END,
    5, 5, 5, 5, 5,
    '[{"name":"Performance","score":5},{"name":"Technique","score":5},{"name":"Rhythm & Timing","score":5},{"name":"Focus & Discipline","score":5},{"name":"Assignment & Practice","score":5}]',
    'Demo assessment: excellent progress.',
    ts.session_date
FROM tbl_enrollments e
INNER JOIN tbl_sessions ts ON ts.enrollment_id=e.enrollment_id
WHERE e.enrollment_id=@enrollment
  AND e.student_id=@student
  AND ts.status='Completed'
  AND ts.attendance_status='Present'
  AND NOT EXISTS (
      SELECT 1 FROM tbl_student_progress p
      WHERE p.student_id=e.student_id AND p.session_id=ts.session_id
  );

-- Each passed promotional exam records an achieved level and its certificate.
-- Link the levels so the history accurately shows the Level 1 → Level 4 path.
INSERT INTO tbl_student_learning_levels
    (student_id,instrument_id,teacher_id,level_name,book_material,current_topic,
     instructor_notes,skills_developing,areas_for_improvement,
     assessment_readiness,status,started_at,achieved_at)
VALUES
    (@student,@instrument,@teacher,'Level 1','Hal Leonard Ukulele Method Book 1',
     'Ukulele posture, tuning, and basic chords',
     'Completed foundational ukulele technique and passed the Level 1 assessment.',
     'Instrument care; C, F, and G7 chords; steady down-strums',
     'Continue building relaxed fretting-hand movement',
     'Ready for Assessment','Achieved',CURDATE()-INTERVAL 8 WEEK,CURDATE()-INTERVAL 7 WEEK);
SET @level1 := LAST_INSERT_ID();
INSERT INTO tbl_promotional_exams
    (student_id,instrument_id,learning_level_id,teacher_id,assessed_level,exam_date,grade_rating,result,examiner_notes)
VALUES
    (@student,@instrument,@level1,@teacher,'Level 1',CURDATE()-INTERVAL 7 WEEK,'Excellent — 5/5','Passed','Secure posture, tuning, basic chords, and steady rhythm.');
SET @exam1 := LAST_INSERT_ID();
UPDATE tbl_student_learning_levels SET achieved_exam_id=@exam1 WHERE learning_level_id=@level1;
INSERT INTO tbl_student_certificates
    (student_id,promotional_exam_id,learning_level_id,instrument_id,achieved_level,certificate_number,issued_at,issued_by,status)
VALUES
    (@student,@exam1,@level1,@instrument,'Level 1',CONCAT('FAS-',YEAR(CURDATE()),'-',LPAD(@student,5,'0'),'-UKU-L1'),CURDATE()-INTERVAL 7 WEEK,@teacher,'Issued');

INSERT INTO tbl_student_learning_levels
    (student_id,instrument_id,teacher_id,level_name,book_material,current_topic,
     instructor_notes,skills_developing,areas_for_improvement,
     assessment_readiness,status,started_at,achieved_at,previous_learning_level_id)
VALUES
    (@student,@instrument,@teacher,'Level 2','Hal Leonard Ukulele Method Book 1',
     'Chord transitions and changing strumming patterns',
     'Completed Level 2 with consistent chord transitions and rhythm.',
     'Clean C–F–G7 changes; down-up strumming; metronome practice',
     'Keep dynamics even during longer patterns',
     'Ready for Assessment','Achieved',CURDATE()-INTERVAL 7 WEEK,CURDATE()-INTERVAL 5 WEEK,@level1);
SET @level2 := LAST_INSERT_ID();
INSERT INTO tbl_promotional_exams
    (student_id,instrument_id,learning_level_id,teacher_id,assessed_level,exam_date,grade_rating,result,examiner_notes)
VALUES
    (@student,@instrument,@level2,@teacher,'Level 2',CURDATE()-INTERVAL 5 WEEK,'Excellent — 5/5','Passed','Accurate chord changes and reliable tempo.');
SET @exam2 := LAST_INSERT_ID();
UPDATE tbl_student_learning_levels SET achieved_exam_id=@exam2 WHERE learning_level_id=@level2;
INSERT INTO tbl_student_certificates
    (student_id,promotional_exam_id,learning_level_id,instrument_id,achieved_level,certificate_number,issued_at,issued_by,status)
VALUES
    (@student,@exam2,@level2,@instrument,'Level 2',CONCAT('FAS-',YEAR(CURDATE()),'-',LPAD(@student,5,'0'),'-UKU-L2'),CURDATE()-INTERVAL 5 WEEK,@teacher,'Issued');

INSERT INTO tbl_student_learning_levels
    (student_id,instrument_id,teacher_id,level_name,book_material,current_topic,
     instructor_notes,skills_developing,areas_for_improvement,
     assessment_readiness,status,started_at,achieved_at,previous_learning_level_id)
VALUES
    (@student,@instrument,@teacher,'Level 3','Hal Leonard Ukulele Method Book 1',
     'Syncopation, dynamics, and musical phrasing',
     'Completed Level 3 and demonstrated expressive, controlled playing.',
     'Syncopated rhythm; dynamics; musical phrasing',
     'Keep tone consistent across string changes',
     'Ready for Assessment','Achieved',CURDATE()-INTERVAL 5 WEEK,CURDATE()-INTERVAL 3 WEEK,@level2);
SET @level3 := LAST_INSERT_ID();
INSERT INTO tbl_promotional_exams
    (student_id,instrument_id,learning_level_id,teacher_id,assessed_level,exam_date,grade_rating,result,examiner_notes)
VALUES
    (@student,@instrument,@level3,@teacher,'Level 3',CURDATE()-INTERVAL 3 WEEK,'Excellent — 5/5','Passed','Strong timing, dynamics, focus, and musical phrasing.');
SET @exam3 := LAST_INSERT_ID();
UPDATE tbl_student_learning_levels SET achieved_exam_id=@exam3 WHERE learning_level_id=@level3;
INSERT INTO tbl_student_certificates
    (student_id,promotional_exam_id,learning_level_id,instrument_id,achieved_level,certificate_number,issued_at,issued_by,status)
VALUES
    (@student,@exam3,@level3,@instrument,'Level 3',CONCAT('FAS-',YEAR(CURDATE()),'-',LPAD(@student,5,'0'),'-UKU-L3'),CURDATE()-INTERVAL 3 WEEK,@teacher,'Issued');

INSERT INTO tbl_student_learning_levels
    (student_id,instrument_id,teacher_id,level_name,book_material,current_topic,
     instructor_notes,skills_developing,areas_for_improvement,
     assessment_readiness,status,started_at,achieved_at,previous_learning_level_id)
VALUES
    (@student,@instrument,@teacher,'Level 4','Hal Leonard Ukulele Method Book 1',
     'Performance preparation and complete song arrangements',
     'Passed Level 4 after performing a complete arrangement with confidence.',
     'Performance confidence; clean transitions; steady tempo; musical expression',
     'Explore more complex chord voicings in the next level',
     'Ready for Assessment','Achieved',CURDATE()-INTERVAL 3 WEEK,CURDATE()-INTERVAL 1 WEEK,@level3);
SET @level4 := LAST_INSERT_ID();
INSERT INTO tbl_promotional_exams
    (student_id,instrument_id,learning_level_id,teacher_id,assessed_level,exam_date,grade_rating,result,examiner_notes)
VALUES
    (@student,@instrument,@level4,@teacher,'Level 4',CURDATE()-INTERVAL 1 WEEK,'Excellent — 5/5','Passed','Confident full-song performance with strong technique and timing.');
SET @exam4 := LAST_INSERT_ID();
UPDATE tbl_student_learning_levels SET achieved_exam_id=@exam4 WHERE learning_level_id=@level4;
INSERT INTO tbl_student_certificates
    (student_id,promotional_exam_id,learning_level_id,instrument_id,achieved_level,certificate_number,issued_at,issued_by,status)
VALUES
    (@student,@exam4,@level4,@instrument,'Level 4',CONCAT('FAS-',YEAR(CURDATE()),'-',LPAD(@student,5,'0'),'-UKU-L4'),CURDATE()-INTERVAL 1 WEEK,@teacher,'Issued');

INSERT INTO tbl_student_learning_levels
    (student_id,instrument_id,teacher_id,level_name,book_material,current_topic,
     instructor_notes,skills_developing,areas_for_improvement,
     assessment_readiness,status,started_at,previous_learning_level_id)
VALUES
    (@student,@instrument,@teacher,'Level 5 — Intermediate','Hal Leonard Ukulele Method Book 2',
     'Intermediate chord vocabulary, fingerpicking, and arranging',
     'Arman has completed Levels 1–4 and is beginning the Intermediate course.',
     'Barre chords; fingerpicking patterns; syncopated accompaniment; song arranging',
     'Build clean barre-chord transitions and maintain an even fingerpicking pulse',
     'Developing','In Progress',CURDATE()-INTERVAL 1 WEEK,@level4);

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
       ll.level_name, ll.assessment_readiness, ll.status AS learning_status,
       (SELECT COUNT(*) FROM tbl_student_learning_levels h
        WHERE h.student_id=e.student_id AND h.instrument_id=e.instrument_id AND h.status='Achieved') AS achieved_levels,
       (SELECT COUNT(*) FROM tbl_student_certificates c
        WHERE c.student_id=e.student_id AND c.instrument_id=e.instrument_id AND c.status='Issued') AS issued_certificates
FROM tbl_enrollments e
INNER JOIN tbl_student_learning_levels ll
  ON ll.student_id=e.student_id AND ll.instrument_id=e.instrument_id
WHERE e.enrollment_id=@enrollment AND ll.status='In Progress';
