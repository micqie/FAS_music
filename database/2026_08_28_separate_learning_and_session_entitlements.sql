-- Additional-session purchases belong to an existing enrollment. They do not
-- create or reset learning-progress records and do not schedule lessons.
CREATE TABLE IF NOT EXISTS tbl_student_session_extension_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    branch_id INT NOT NULL,
    enrollment_id INT NULL,
    requested_sessions INT NOT NULL DEFAULT 1,
    requested_amount DECIMAL(10,2) NOT NULL DEFAULT 650.00,
    preferred_day_of_week ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NULL,
    preferred_start_time TIME NULL,
    preferred_end_time TIME NULL,
    payment_method ENUM('Cash','GCash','Bank Transfer') NOT NULL DEFAULT 'Cash',
    payment_proof_path VARCHAR(255) NULL,
    notes TEXT NULL,
    status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
    admin_notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Run this only on installations where the extension table predates this change.
-- ALTER TABLE tbl_student_session_extension_requests ADD COLUMN enrollment_id INT NULL AFTER branch_id;

-- Preserve the academy's chosen instrument on each recurring schedule slot.
-- This supports flexible multi-instrument patterns rather than dividing a
-- package's sessions evenly between instruments.
-- ALTER TABLE tbl_enrollment_schedule_slots ADD COLUMN instrument_id INT NULL AFTER teacher_id;

CREATE TABLE IF NOT EXISTS tbl_promotional_exams (
    exam_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    instrument_id INT NULL,
    learning_level_id INT NULL,
    teacher_id INT NULL,
    assessed_level VARCHAR(100) NOT NULL,
    exam_date DATE NULL,
    grade_rating VARCHAR(100) NULL,
    result ENUM('Pending','Passed','Retake') NOT NULL DEFAULT 'Pending',
    examiner_notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tbl_student_certificates (
    certificate_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    promotional_exam_id INT NULL,
    learning_level_id INT NULL,
    instrument_id INT NULL,
    achieved_level VARCHAR(100) NOT NULL,
    certificate_number VARCHAR(100) NULL,
    issued_at DATE NOT NULL,
    issued_by INT NULL,
    status ENUM('Issued','Revoked') NOT NULL DEFAULT 'Issued',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tbl_student_learning_levels (
    learning_level_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    instrument_id INT NOT NULL,
    teacher_id INT NULL,
    level_name VARCHAR(100) NOT NULL,
    book_material VARCHAR(255) NULL,
    current_topic VARCHAR(255) NULL,
    instructor_notes TEXT NULL,
    skills_developing TEXT NULL,
    areas_for_improvement TEXT NULL,
    assessment_readiness ENUM('Not Ready','Developing','Improving','Ready for Assessment') NOT NULL DEFAULT 'Not Ready',
    status ENUM('In Progress','Achieved') NOT NULL DEFAULT 'In Progress',
    started_at DATE NOT NULL,
    achieved_at DATE NULL,
    achieved_exam_id INT NULL,
    previous_learning_level_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_learning_levels_student_instrument (student_id, instrument_id, status)
);

-- Each instructor may use any practical number of descriptive lesson criteria.
-- The criteria_scores snapshot on progress preserves the labels used for that
-- particular lesson even when the instructor changes their rubric later.
CREATE TABLE IF NOT EXISTS tbl_teacher_grading_criteria (
    criterion_id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT NOT NULL,
    criterion_name VARCHAR(100) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_teacher_grading_criteria (teacher_id, status, sort_order)
);

-- Legacy upgrade notes (run only when the columns are not already present):
-- ALTER TABLE tbl_promotional_exams ADD COLUMN learning_level_id INT NULL AFTER instrument_id;
-- ALTER TABLE tbl_promotional_exams ADD COLUMN teacher_id INT NULL AFTER learning_level_id;
-- ALTER TABLE tbl_promotional_exams ADD COLUMN grade_rating VARCHAR(100) NULL AFTER exam_date;
-- ALTER TABLE tbl_promotional_exams MODIFY result ENUM('Pending','Passed','Failed','Retake') NOT NULL DEFAULT 'Pending';
-- UPDATE tbl_promotional_exams SET result='Retake' WHERE result='Failed';
-- ALTER TABLE tbl_promotional_exams MODIFY result ENUM('Pending','Passed','Retake') NOT NULL DEFAULT 'Pending';
-- ALTER TABLE tbl_student_certificates ADD COLUMN learning_level_id INT NULL AFTER promotional_exam_id;
-- ALTER TABLE tbl_student_progress ADD COLUMN criteria_scores TEXT NULL AFTER assignment_score;
