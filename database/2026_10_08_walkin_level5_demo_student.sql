-- Fresh walk-in student demo for the student portal.
-- Login: walkin.level5.demo@fas.com
-- Password: Test1234!
-- Run once against the FAS Music database. It creates a new student, paid
-- 12-session Ukulele enrollment, 8 completed/graded lessons, 4 future lessons,
-- passed Levels 1-4 with certificates, and Level 5 (Intermediate) in progress.

START TRANSACTION;
SET NAMES utf8mb4 COLLATE utf8mb4_general_ci;

SET @demo_email := 'walkin.level5.demo@fas.com';
SET @demo_password_hash := '$2y$10$UN15UGLpHGt55XHIbL5EoOI.jZxPASVxR4k0NUgkI4Jhn9lGcU/DG';
SET @branch_id := 5;
SET @teacher_id := 17;
SET @instrument_id := 17;
SET @package_id := 13;
SET @current_week_monday := DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY);

-- Create the walk-in student and portal login.
INSERT INTO tbl_students (
    branch_id, first_name, last_name, middle_name, date_of_birth, age,
    phone, email, address, status, registration_source, session_package_id
)
VALUES (
    @branch_id, 'Mika', 'Demo', 'Ukulele', '2008-04-12', 18,
    '09170000000', @demo_email, 'Cagayan de Oro City', 'Active', 'walkin', @package_id
);
SET @student_id := LAST_INSERT_ID();
UPDATE tbl_students
SET student_code=CONCAT('STU-',YEAR(CURDATE()),'-',LPAD(@student_id,4,'0'))
WHERE student_id=@student_id;

SELECT role_id INTO @student_role_id FROM tbl_roles WHERE role_name='Student' LIMIT 1;
INSERT INTO tbl_users (
    username, password, role_id, branch_id, first_name, last_name, email,
    phone, status, email_verified_at
)
VALUES (
    @demo_email, @demo_password_hash, @student_role_id, @branch_id,
    'Mika', 'Demo', @demo_email, '09170000000', 'Active', NOW()
);
SET @student_user_id := LAST_INSERT_ID();
UPDATE tbl_students SET student_user_id=@student_user_id WHERE student_id=@student_id;

INSERT INTO tbl_student_instruments (student_id,instrument_id,priority_order)
VALUES (@student_id,@instrument_id,1);

-- Walk-in enrollment, paid in full by cash. The request metadata also marks it
-- as a walk-in so reports that inspect enrollment notes classify it correctly.
INSERT INTO tbl_enrollments (
    student_id, package_id, instrument_id, assigned_teacher_id,
    fixed_day_of_week, fixed_start_time, fixed_end_time,
    preferred_schedule, request_notes, enrollment_date, start_date, end_date,
    status, schedule_status, enrolled_by_type, total_sessions, allowed_absences,
    completed_sessions, payment_type
)
VALUES (
    @student_id, @package_id, @instrument_id, @teacher_id,
    'Monday', '15:00:00', '16:00:00', 'Monday 15:00:00-16:00:00',
    CONCAT('{"payment_type":"Full Payment","payment_method":"Cash","payable_now":7450,"package_total_amount":7450,"instrument_ids":[',@instrument_id,'],"is_walkin_request":1,"enrollment_mode":"initial"}'),
    DATE_SUB(@current_week_monday,INTERVAL 7 WEEK),
    DATE_SUB(@current_week_monday,INTERVAL 7 WEEK),
    DATE_ADD(@current_week_monday,INTERVAL 4 WEEK),
    'Active', 'Active', 'Self', 12, 2, 8, 'Full Payment'
);
SET @enrollment_id := LAST_INSERT_ID();

INSERT INTO tbl_payments (
    enrollment_id, payment_date, amount, payment_method, payment_type,
    status, receipt_number, notes
)
VALUES (
    @enrollment_id, DATE_SUB(@current_week_monday,INTERVAL 7 WEEK), 7450.00, 'Cash', 'Full Payment',
    'Paid', CONCAT('DEMO-WALKIN-',@enrollment_id), 'Paid in full at walk-in registration.'
);

INSERT INTO tbl_enrollment_schedule_slots (
    enrollment_id, teacher_id, instrument_id, day_of_week, start_time,
    end_time, room_name, sort_order, status
)
VALUES (
    @enrollment_id, @teacher_id, @instrument_id, 'Monday', '15:00:00',
    '16:00:00', 'Ukulele Studio', 1, 'Active'
);

-- Eight completed lessons and four upcoming lessons, all on the same weekly slot.
INSERT INTO tbl_sessions (
    enrollment_id, teacher_id, session_number, session_date, start_time, end_time,
    session_type, instrument_id, status, attendance_status, absence_notice,
    counted_in, notes
)
VALUES
    (@enrollment_id,@teacher_id,1,DATE_SUB(@current_week_monday,INTERVAL 7 WEEK),'15:00:00','16:00:00','Regular',@instrument_id,'Completed','Present','None',1,'Posture, tuning, and first chords.'),
    (@enrollment_id,@teacher_id,2,DATE_SUB(@current_week_monday,INTERVAL 6 WEEK),'15:00:00','16:00:00','Regular',@instrument_id,'Completed','Present','None',1,'C, F, and G7 chord transitions.'),
    (@enrollment_id,@teacher_id,3,DATE_SUB(@current_week_monday,INTERVAL 5 WEEK),'15:00:00','16:00:00','Regular',@instrument_id,'Completed','Present','None',1,'Down-up strumming and steady beat.'),
    (@enrollment_id,@teacher_id,4,DATE_SUB(@current_week_monday,INTERVAL 4 WEEK),'15:00:00','16:00:00','Regular',@instrument_id,'Completed','Present','None',1,'Chord changes with metronome.'),
    (@enrollment_id,@teacher_id,5,DATE_SUB(@current_week_monday,INTERVAL 3 WEEK),'15:00:00','16:00:00','Regular',@instrument_id,'Completed','Present','None',1,'Syncopation and dynamics.'),
    (@enrollment_id,@teacher_id,6,DATE_SUB(@current_week_monday,INTERVAL 2 WEEK),'15:00:00','16:00:00','Regular',@instrument_id,'Completed','Present','None',1,'Musical phrasing and clean transitions.'),
    (@enrollment_id,@teacher_id,7,DATE_SUB(@current_week_monday,INTERVAL 1 WEEK),'15:00:00','16:00:00','Regular',@instrument_id,'Completed','Present','None',1,'Complete song arrangement.'),
    (@enrollment_id,@teacher_id,8,@current_week_monday,'15:00:00','16:00:00','Regular',@instrument_id,'Completed','Present','None',1,'Level 4 promotional assessment preparation.'),
    (@enrollment_id,@teacher_id,9,DATE_ADD(@current_week_monday,INTERVAL 1 WEEK),'15:00:00','16:00:00','Regular',@instrument_id,'Scheduled','Pending','None',0,'Upcoming weekly Ukulele lesson.'),
    (@enrollment_id,@teacher_id,10,DATE_ADD(@current_week_monday,INTERVAL 2 WEEK),'15:00:00','16:00:00','Regular',@instrument_id,'Scheduled','Pending','None',0,'Upcoming weekly Ukulele lesson.'),
    (@enrollment_id,@teacher_id,11,DATE_ADD(@current_week_monday,INTERVAL 3 WEEK),'15:00:00','16:00:00','Regular',@instrument_id,'Scheduled','Pending','None',0,'Upcoming weekly Ukulele lesson.'),
    (@enrollment_id,@teacher_id,12,DATE_ADD(@current_week_monday,INTERVAL 4 WEEK),'15:00:00','16:00:00','Regular',@instrument_id,'Scheduled','Pending','None',0,'Upcoming weekly Ukulele lesson.');

-- Session grades power the certificate skill breakdown on the student page.
INSERT INTO tbl_student_progress (
    student_id, session_id, instrument_id, skill_level, performance_score,
    technique_score, rhythm_score, focus_score, assignment_score,
    criteria_scores, remarks, assessment_date
)
SELECT
    @student_id, ts.session_id, @instrument_id,
    CASE WHEN ts.session_number>=7 THEN 'Advanced' ELSE 'Developing' END,
    5,5,5,5,5,
    '[{"name":"Performance","score":5},{"name":"Technique","score":5},{"name":"Rhythm & Timing","score":5},{"name":"Focus & Discipline","score":5},{"name":"Assignment & Practice","score":5}]',
    'Demo assessment: excellent progress.', ts.session_date
FROM tbl_sessions ts
WHERE ts.enrollment_id=@enrollment_id AND ts.status='Completed';

-- Passed levels and certificates, linked in order from Level 1 through Level 4.
INSERT INTO tbl_student_learning_levels (
    student_id,instrument_id,teacher_id,level_name,book_material,current_topic,
    instructor_notes,skills_developing,areas_for_improvement,
    assessment_readiness,status,started_at,achieved_at
)
VALUES (
    @student_id,@instrument_id,@teacher_id,'Level 1','Hal Leonard Ukulele Method Book 1',
    'Posture, tuning, and foundational chords',
    'Passed the Level 1 promotional assessment.',
    'Instrument care; C, F, and G7 chords; steady down-strums',
    'Relaxed fretting-hand movement','Ready for Assessment','Achieved',
    DATE_SUB(@current_week_monday,INTERVAL 7 WEEK),DATE_SUB(@current_week_monday,INTERVAL 6 WEEK)
);
SET @level1_id := LAST_INSERT_ID();
INSERT INTO tbl_promotional_exams
    (student_id,instrument_id,learning_level_id,teacher_id,assessed_level,exam_date,grade_rating,result,examiner_notes)
VALUES
    (@student_id,@instrument_id,@level1_id,@teacher_id,'Level 1',DATE_SUB(@current_week_monday,INTERVAL 6 WEEK),'Excellent — 5/5','Passed','Secure posture, tuning, basic chords, and steady rhythm.');
SET @exam1_id := LAST_INSERT_ID();
UPDATE tbl_student_learning_levels SET achieved_exam_id=@exam1_id WHERE learning_level_id=@level1_id;
INSERT INTO tbl_student_certificates
    (student_id,promotional_exam_id,learning_level_id,instrument_id,achieved_level,certificate_number,issued_at,issued_by,status)
VALUES
    (@student_id,@exam1_id,@level1_id,@instrument_id,'Level 1',CONCAT('FAS-',YEAR(CURDATE()),'-',LPAD(@student_id,5,'0'),'-UKU-L1'),DATE_SUB(@current_week_monday,INTERVAL 6 WEEK),@teacher_id,'Issued');

INSERT INTO tbl_student_learning_levels (
    student_id,instrument_id,teacher_id,level_name,book_material,current_topic,
    instructor_notes,skills_developing,areas_for_improvement,
    assessment_readiness,status,started_at,achieved_at,previous_learning_level_id
)
VALUES (
    @student_id,@instrument_id,@teacher_id,'Level 2','Hal Leonard Ukulele Method Book 1',
    'Chord transitions and strumming patterns',
    'Passed Level 2 with consistent chord transitions and rhythm.',
    'C–F–G7 changes; down-up strumming; metronome practice',
    'Even dynamics during longer patterns','Ready for Assessment','Achieved',
    DATE_SUB(@current_week_monday,INTERVAL 6 WEEK),DATE_SUB(@current_week_monday,INTERVAL 4 WEEK),@level1_id
);
SET @level2_id := LAST_INSERT_ID();
INSERT INTO tbl_promotional_exams
    (student_id,instrument_id,learning_level_id,teacher_id,assessed_level,exam_date,grade_rating,result,examiner_notes)
VALUES
    (@student_id,@instrument_id,@level2_id,@teacher_id,'Level 2',DATE_SUB(@current_week_monday,INTERVAL 4 WEEK),'Excellent — 5/5','Passed','Accurate chord changes and reliable tempo.');
SET @exam2_id := LAST_INSERT_ID();
UPDATE tbl_student_learning_levels SET achieved_exam_id=@exam2_id WHERE learning_level_id=@level2_id;
INSERT INTO tbl_student_certificates
    (student_id,promotional_exam_id,learning_level_id,instrument_id,achieved_level,certificate_number,issued_at,issued_by,status)
VALUES
    (@student_id,@exam2_id,@level2_id,@instrument_id,'Level 2',CONCAT('FAS-',YEAR(CURDATE()),'-',LPAD(@student_id,5,'0'),'-UKU-L2'),DATE_SUB(@current_week_monday,INTERVAL 4 WEEK),@teacher_id,'Issued');

INSERT INTO tbl_student_learning_levels (
    student_id,instrument_id,teacher_id,level_name,book_material,current_topic,
    instructor_notes,skills_developing,areas_for_improvement,
    assessment_readiness,status,started_at,achieved_at,previous_learning_level_id
)
VALUES (
    @student_id,@instrument_id,@teacher_id,'Level 3','Hal Leonard Ukulele Method Book 1',
    'Syncopation, dynamics, and musical phrasing',
    'Passed Level 3 with expressive, controlled playing.',
    'Syncopated rhythm; dynamics; musical phrasing',
    'Consistent tone across string changes','Ready for Assessment','Achieved',
    DATE_SUB(@current_week_monday,INTERVAL 4 WEEK),DATE_SUB(@current_week_monday,INTERVAL 2 WEEK),@level2_id
);
SET @level3_id := LAST_INSERT_ID();
INSERT INTO tbl_promotional_exams
    (student_id,instrument_id,learning_level_id,teacher_id,assessed_level,exam_date,grade_rating,result,examiner_notes)
VALUES
    (@student_id,@instrument_id,@level3_id,@teacher_id,'Level 3',DATE_SUB(@current_week_monday,INTERVAL 2 WEEK),'Excellent — 5/5','Passed','Strong timing, dynamics, focus, and phrasing.');
SET @exam3_id := LAST_INSERT_ID();
UPDATE tbl_student_learning_levels SET achieved_exam_id=@exam3_id WHERE learning_level_id=@level3_id;
INSERT INTO tbl_student_certificates
    (student_id,promotional_exam_id,learning_level_id,instrument_id,achieved_level,certificate_number,issued_at,issued_by,status)
VALUES
    (@student_id,@exam3_id,@level3_id,@instrument_id,'Level 3',CONCAT('FAS-',YEAR(CURDATE()),'-',LPAD(@student_id,5,'0'),'-UKU-L3'),DATE_SUB(@current_week_monday,INTERVAL 2 WEEK),@teacher_id,'Issued');

INSERT INTO tbl_student_learning_levels (
    student_id,instrument_id,teacher_id,level_name,book_material,current_topic,
    instructor_notes,skills_developing,areas_for_improvement,
    assessment_readiness,status,started_at,achieved_at,previous_learning_level_id
)
VALUES (
    @student_id,@instrument_id,@teacher_id,'Level 4','Hal Leonard Ukulele Method Book 1',
    'Performance preparation and complete song arrangements',
    'Passed Level 4 after performing a complete arrangement with confidence.',
    'Performance confidence; clean transitions; steady tempo; musical expression',
    'Explore more complex chord voicings','Ready for Assessment','Achieved',
    DATE_SUB(@current_week_monday,INTERVAL 2 WEEK),@current_week_monday,@level3_id
);
SET @level4_id := LAST_INSERT_ID();
INSERT INTO tbl_promotional_exams
    (student_id,instrument_id,learning_level_id,teacher_id,assessed_level,exam_date,grade_rating,result,examiner_notes)
VALUES
    (@student_id,@instrument_id,@level4_id,@teacher_id,'Level 4',@current_week_monday,'Excellent — 5/5','Passed','Confident full-song performance with strong technique and timing.');
SET @exam4_id := LAST_INSERT_ID();
UPDATE tbl_student_learning_levels SET achieved_exam_id=@exam4_id WHERE learning_level_id=@level4_id;
INSERT INTO tbl_student_certificates
    (student_id,promotional_exam_id,learning_level_id,instrument_id,achieved_level,certificate_number,issued_at,issued_by,status)
VALUES
    (@student_id,@exam4_id,@level4_id,@instrument_id,'Level 4',CONCAT('FAS-',YEAR(CURDATE()),'-',LPAD(@student_id,5,'0'),'-UKU-L4'),@current_week_monday,@teacher_id,'Issued');

INSERT INTO tbl_student_learning_levels (
    student_id,instrument_id,teacher_id,level_name,book_material,current_topic,
    instructor_notes,skills_developing,areas_for_improvement,
    assessment_readiness,status,started_at,previous_learning_level_id
)
VALUES (
    @student_id,@instrument_id,@teacher_id,'Level 5 — Intermediate','Hal Leonard Ukulele Method Book 2',
    'Intermediate chord vocabulary, fingerpicking, and arranging',
    'Mika has completed Levels 1–4 and is beginning the Intermediate course.',
    'Barre chords; fingerpicking; syncopated accompaniment; song arranging',
    'Build clean barre-chord transitions and an even fingerpicking pulse',
    'Developing','In Progress',@current_week_monday,@level4_id
);

COMMIT;

-- Verify the new login and learning setup.
SELECT s.student_id,s.student_code,s.first_name,s.last_name,s.email,
       u.username AS login_email,'Test1234!' AS demo_password,
       e.enrollment_id,e.status AS enrollment_status,e.total_sessions,e.completed_sessions,
       p.amount AS paid_amount,p.payment_method,p.status AS payment_status,
       (SELECT COUNT(*) FROM tbl_student_learning_levels ll
        WHERE ll.student_id=s.student_id AND ll.instrument_id=@instrument_id AND ll.status='Achieved') AS achieved_levels,
       (SELECT COUNT(*) FROM tbl_student_certificates c
        WHERE c.student_id=s.student_id AND c.instrument_id=@instrument_id AND c.status='Issued') AS certificates,
       (SELECT ll.level_name FROM tbl_student_learning_levels ll
        WHERE ll.student_id=s.student_id AND ll.instrument_id=@instrument_id AND ll.status='In Progress'
        ORDER BY ll.learning_level_id DESC LIMIT 1) AS current_level
FROM tbl_students s
INNER JOIN tbl_users u ON u.user_id=s.student_user_id
INNER JOIN tbl_enrollments e ON e.student_id=s.student_id
INNER JOIN tbl_payments p ON p.enrollment_id=e.enrollment_id
WHERE s.student_id=@student_id;
