-- FAS Music School Test Seed
-- Run after fas_db.sql
-- DB: fas_music

USE fas_music;
SET NAMES utf8mb4;

START TRANSACTION;



-- =========================
-- 2) MASTER: BRANCHES
-- =========================
INSERT INTO tbl_branches (branch_name, address, phone, email, status)
SELECT v.branch_name, v.address, v.phone, v.email, 'Active'
FROM (
    SELECT 'Main Branch' AS branch_name, '123 Rizal Ave, Manila' AS address, '02-8123-4567' AS phone, 'main@fasmusic.test' AS email
    UNION ALL
    SELECT 'North Branch', '45 Quezon St, Quezon City', '02-8456-7788', 'north@fasmusic.test'
    UNION ALL
    SELECT 'South Branch', '89 Aguinaldo Hwy, Cavite', '046-123-8899', 'south@fasmusic.test'
) v
WHERE NOT EXISTS (
    SELECT 1
    FROM tbl_branches b
    WHERE b.branch_name = v.branch_name
);

-- =========================
-- 3) MASTER: SETTINGS
-- =========================
INSERT INTO tbl_settings (setting_key, setting_value, setting_type, description, updated_by)
VALUES ('registration_fee', '1000.00', 'Decimal', 'Default registration fee amount in PHP', NULL)
ON DUPLICATE KEY UPDATE
    setting_value = VALUES(setting_value),
    setting_type = VALUES(setting_type),
    description = VALUES(description),
    updated_by = VALUES(updated_by);


-- =========================
-- 5) MASTER: INSTRUMENT TYPES
-- =========================
INSERT INTO tbl_instrument_types (type_name, description)
SELECT v.type_name, v.description
FROM (
    SELECT 'Keyboard' AS type_name, 'Piano/keyboard family' AS description
    UNION ALL SELECT 'Strings', 'Guitar/violin family'
    UNION ALL SELECT 'Percussion', 'Drums and rhythm instruments'
    UNION ALL SELECT 'Woodwind', 'Flute/clarinet/sax'
    UNION ALL SELECT 'Other', 'Fallback type'
) v
WHERE NOT EXISTS (
    SELECT 1
    FROM tbl_instrument_types t
    WHERE t.type_name = v.type_name
);

-- =========================
-- 6) MASTER: INSTRUMENTS
-- =========================
INSERT INTO tbl_instruments (branch_id, instrument_name, type_id, serial_number, `condition`, status)
SELECT
    (SELECT branch_id FROM tbl_branches WHERE branch_name = 'Main Branch' LIMIT 1),
    'Yamaha Digital Piano P-125',
    (SELECT type_id FROM tbl_instrument_types WHERE type_name = 'Keyboard' LIMIT 1),
    'PIANO-M-001',
    'Good',
    'Available'
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_instruments
    WHERE serial_number = 'PIANO-M-001'
);

INSERT INTO tbl_instruments (branch_id, instrument_name, type_id, serial_number, `condition`, status)
SELECT
    (SELECT branch_id FROM tbl_branches WHERE branch_name = 'Main Branch' LIMIT 1),
    'Yamaha Acoustic Guitar F310',
    (SELECT type_id FROM tbl_instrument_types WHERE type_name = 'Strings' LIMIT 1),
    'GTR-M-001',
    'Good',
    'Available'
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_instruments
    WHERE serial_number = 'GTR-M-001'
);

INSERT INTO tbl_instruments (branch_id, instrument_name, type_id, serial_number, `condition`, status)
SELECT
    (SELECT branch_id FROM tbl_branches WHERE branch_name = 'North Branch' LIMIT 1),
    'Pearl Drum Set Roadshow',
    (SELECT type_id FROM tbl_instrument_types WHERE type_name = 'Percussion' LIMIT 1),
    'DRM-N-001',
    'Fair',
    'Available'
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_instruments
    WHERE serial_number = 'DRM-N-001'
);

-- =========================
-- 7) MASTER: LESSON PACKAGES
-- =========================
INSERT INTO tbl_lesson_packages (package_name, total_sessions, price, validity_period, description, status)
SELECT v.package_name, v.total_sessions, v.price, v.validity_period, v.description, 'Active'
FROM (
    SELECT 'Starter 8 Sessions' AS package_name, 8 AS total_sessions, 4000.00 AS price, 60 AS validity_period, 'Beginner package'
    UNION ALL
    SELECT 'Standard 12 Sessions', 12, 5800.00, 90, 'Most popular package'
    UNION ALL
    SELECT 'Advanced 20 Sessions', 20, 9200.00, 120, 'Serious learner package'
) v
WHERE NOT EXISTS (
    SELECT 1
    FROM tbl_lesson_packages p
    WHERE p.package_name = v.package_name
);

-- =========================
-- 8) MASTER: TEACHERS
-- =========================
INSERT INTO tbl_teachers (user_id, branch_id, first_name, last_name, specialization, email, phone, employment_type, status)
SELECT
    NULL,
    (SELECT branch_id FROM tbl_branches WHERE branch_name = 'Main Branch' LIMIT 1),
    'Mark', 'Dizon', 'Piano, Keyboard', 'mark.dizon@fasmusic.test', '09170000011',
    'Full-time', 'Active'
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_teachers WHERE email = 'mark.dizon@fasmusic.test'
);

INSERT INTO tbl_teachers (user_id, branch_id, first_name, last_name, specialization, email, phone, employment_type, status)
SELECT
    NULL,
    (SELECT branch_id FROM tbl_branches WHERE branch_name = 'Main Branch' LIMIT 1),
    'Leah', 'Reyes', 'Guitar, Strings', 'leah.reyes@fasmusic.test', '09170000012',
    'Part-time', 'Active'
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_teachers WHERE email = 'leah.reyes@fasmusic.test'
);

-- Teacher instrument mapping
INSERT IGNORE INTO tbl_teacher_instruments (teacher_id, instrument_id, proficiency_level)
SELECT
    (SELECT teacher_id FROM tbl_teachers WHERE email = 'mark.dizon@fasmusic.test' LIMIT 1),
    (SELECT instrument_id FROM tbl_instruments WHERE serial_number = 'PIANO-M-001' LIMIT 1),
    'Advanced';

INSERT IGNORE INTO tbl_teacher_instruments (teacher_id, instrument_id, proficiency_level)
SELECT
    (SELECT teacher_id FROM tbl_teachers WHERE email = 'leah.reyes@fasmusic.test' LIMIT 1),
    (SELECT instrument_id FROM tbl_instruments WHERE serial_number = 'GTR-M-001' LIMIT 1),
    'Expert';

-- =========================
-- 9) MASTER: ROOMS
-- =========================
INSERT IGNORE INTO tbl_rooms (branch_id, room_name, capacity, room_type, status)
SELECT (SELECT branch_id FROM tbl_branches WHERE branch_name = 'Main Branch' LIMIT 1), 'Room A', 1, 'Private Lesson', 'Available';

INSERT IGNORE INTO tbl_rooms (branch_id, room_name, capacity, room_type, status)
SELECT (SELECT branch_id FROM tbl_branches WHERE branch_name = 'Main Branch' LIMIT 1), 'Room B', 1, 'Private Lesson', 'Available';

INSERT IGNORE INTO tbl_rooms (branch_id, room_name, capacity, room_type, status)
SELECT (SELECT branch_id FROM tbl_branches WHERE branch_name = 'North Branch' LIMIT 1), 'Studio 1', 3, 'Group Room', 'Available';

-- =========================
-- 10) MASTER: TEACHER AVAILABILITY
-- =========================
INSERT INTO tbl_teacher_availability (teacher_id, branch_id, day_of_week, start_time, end_time, status)
SELECT
    (SELECT teacher_id FROM tbl_teachers WHERE email = 'mark.dizon@fasmusic.test' LIMIT 1),
    (SELECT branch_id FROM tbl_branches WHERE branch_name = 'Main Branch' LIMIT 1),
    'Monday', '13:00:00', '18:00:00', 'Available'
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_teacher_availability
    WHERE teacher_id = (SELECT teacher_id FROM tbl_teachers WHERE email = 'mark.dizon@fasmusic.test' LIMIT 1)
      AND day_of_week = 'Monday'
      AND start_time = '13:00:00'
      AND end_time = '18:00:00'
);

INSERT INTO tbl_teacher_availability (teacher_id, branch_id, day_of_week, start_time, end_time, status)
SELECT
    (SELECT teacher_id FROM tbl_teachers WHERE email = 'leah.reyes@fasmusic.test' LIMIT 1),
    (SELECT branch_id FROM tbl_branches WHERE branch_name = 'Main Branch' LIMIT 1),
    'Wednesday', '10:00:00', '15:00:00', 'Available'
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_teacher_availability
    WHERE teacher_id = (SELECT teacher_id FROM tbl_teachers WHERE email = 'leah.reyes@fasmusic.test' LIMIT 1)
      AND day_of_week = 'Wednesday'
      AND start_time = '10:00:00'
      AND end_time = '15:00:00'
);

-- =========================
-- 11) MASTER: SERVICE PROVIDERS
-- =========================
INSERT INTO tbl_service_providers (provider_name, provider_type, brand_specialization, contact_person, phone, email, address, status)
SELECT
    'Yamaha Service PH',
    'Brand Service Center',
    'Yamaha',
    'Carlos Mendoza',
    '02-8777-1234',
    'service@yamaha-ph.test',
    'Makati City',
    'Active'
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_service_providers WHERE provider_name = 'Yamaha Service PH'
);

-- =========================
-- 12) SAMPLE TEST DATA
-- =========================
-- Student (approved)
INSERT INTO tbl_students (
    branch_id, first_name, last_name, middle_name, date_of_birth, age,
    phone, email, address, school, grade_year, health_diagnosis, status
)
SELECT
    (SELECT branch_id FROM tbl_branches WHERE branch_name = 'Main Branch' LIMIT 1),
    'Juan', 'Dela Cruz', 'Santos', '2010-05-11', 15,
    '09170010001', 'juan.delacruz@student.test', 'QC',
    'FAS Academy', 'Grade 9', NULL, 'Active'
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_students WHERE email = 'juan.delacruz@student.test'
);

-- Guardian
INSERT INTO tbl_guardians (first_name, last_name, relationship_type, phone, occupation, email, address, status)
SELECT 'Maria', 'Dela Cruz', 'Mother', '09170010002', 'Teacher', 'maria.guardian@test.mail', 'QC', 'Active'
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_guardians WHERE phone = '09170010002' AND first_name = 'Maria' AND last_name = 'Dela Cruz'
);

INSERT IGNORE INTO tbl_student_guardians (
    student_id, guardian_id, is_primary_guardian, can_enroll, can_pay, emergency_contact
)
SELECT
    (SELECT student_id FROM tbl_students WHERE email = 'juan.delacruz@student.test' LIMIT 1),
    (SELECT guardian_id FROM tbl_guardians WHERE phone = '09170010002' LIMIT 1),
    'Y', 'Y', 'Y', 'Y';

-- Enrollment for approved student
INSERT INTO tbl_enrollments (
    student_id, package_id, instrument_id, teacher_id,
    registration_fee_amount, registration_fee_paid, registration_status,
    enrollment_date, start_date, total_amount, paid_amount, payment_deadline_session, status
)
SELECT
    (SELECT student_id FROM tbl_students WHERE email = 'juan.delacruz@student.test' LIMIT 1),
    (SELECT package_id FROM tbl_lesson_packages WHERE package_name = 'Standard 12 Sessions' LIMIT 1),
    (SELECT instrument_id FROM tbl_instruments WHERE serial_number = 'PIANO-M-001' LIMIT 1),
    (SELECT teacher_id FROM tbl_teachers WHERE email = 'mark.dizon@fasmusic.test' LIMIT 1),
    1000.00, 1000.00, 'Approved',
    CURRENT_DATE, CURRENT_DATE, 5800.00, 3000.00, 7, 'Ongoing'
WHERE NOT EXISTS (
    SELECT 1
    FROM tbl_enrollments e
    WHERE e.student_id = (SELECT student_id FROM tbl_students WHERE email = 'juan.delacruz@student.test' LIMIT 1)
      AND e.status = 'Ongoing'
);

-- Registration payment
INSERT INTO tbl_registration_payments (
    enrollment_id, payment_date, amount, payment_method, status, receipt_number, notes
)
SELECT
    (SELECT enrollment_id
     FROM tbl_enrollments
     WHERE student_id = (SELECT student_id FROM tbl_students WHERE email = 'juan.delacruz@student.test' LIMIT 1)
     ORDER BY enrollment_id DESC LIMIT 1),
    CURRENT_DATE, 1000.00, 'GCash', 'Paid', 'REG-SEED-0001', 'Seed payment'
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_registration_payments WHERE receipt_number = 'REG-SEED-0001'
);

-- Lesson payment
INSERT INTO tbl_payments (
    enrollment_id, payment_date, amount, payment_method, payment_type, status, receipt_number, notes
)
SELECT
    (SELECT enrollment_id
     FROM tbl_enrollments
     WHERE student_id = (SELECT student_id FROM tbl_students WHERE email = 'juan.delacruz@student.test' LIMIT 1)
     ORDER BY enrollment_id DESC LIMIT 1),
    CURRENT_DATE, 3000.00, 'Cash', 'Partial Payment', 'Paid', 'PAY-SEED-0001', 'Seed lesson payment'
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_payments WHERE receipt_number = 'PAY-SEED-0001'
);

-- Sessions for attendance/dashboard testing
INSERT INTO tbl_sessions (
    enrollment_id, teacher_id, session_number, session_date, start_time, end_time,
    session_type, instrument_id, room_id, status, attendance_notes, notes
)
SELECT
    e.enrollment_id,
    e.teacher_id,
    1,
    CURRENT_DATE - INTERVAL 14 DAY,
    '14:00:00',
    '15:00:00',
    'Regular',
    e.instrument_id,
    (SELECT room_id FROM tbl_rooms WHERE room_name = 'Room A' AND branch_id = (SELECT branch_id FROM tbl_branches WHERE branch_name = 'Main Branch' LIMIT 1) LIMIT 1),
    'Completed',
    'On time',
    'Scales and arpeggios'
FROM (
    SELECT enrollment_id, teacher_id, instrument_id
    FROM tbl_enrollments
    WHERE student_id = (SELECT student_id FROM tbl_students WHERE email = 'juan.delacruz@student.test' LIMIT 1)
    ORDER BY enrollment_id DESC LIMIT 1
) e
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_sessions s
    WHERE s.enrollment_id = e.enrollment_id AND s.session_number = 1
);

INSERT INTO tbl_sessions (
    enrollment_id, teacher_id, session_number, session_date, start_time, end_time,
    session_type, instrument_id, room_id, status, attendance_notes, notes
)
SELECT
    e.enrollment_id,
    e.teacher_id,
    2,
    CURRENT_DATE - INTERVAL 7 DAY,
    '14:00:00',
    '15:00:00',
    'Regular',
    e.instrument_id,
    (SELECT room_id FROM tbl_rooms WHERE room_name = 'Room A' AND branch_id = (SELECT branch_id FROM tbl_branches WHERE branch_name = 'Main Branch' LIMIT 1) LIMIT 1),
    'Late',
    'Arrived 10 minutes late',
    'Chord transitions'
FROM (
    SELECT enrollment_id, teacher_id, instrument_id
    FROM tbl_enrollments
    WHERE student_id = (SELECT student_id FROM tbl_students WHERE email = 'juan.delacruz@student.test' LIMIT 1)
    ORDER BY enrollment_id DESC LIMIT 1
) e
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_sessions s
    WHERE s.enrollment_id = e.enrollment_id AND s.session_number = 2
);

-- Pending registration student (for admin pending list tests)
INSERT INTO tbl_students (
    branch_id, first_name, last_name, middle_name, date_of_birth, age,
    phone, email, address, school, grade_year, health_diagnosis, status
)
SELECT
    (SELECT branch_id FROM tbl_branches WHERE branch_name = 'North Branch' LIMIT 1),
    'Ana', 'Santos', NULL, '2012-09-20', 13,
    '09170020001', 'ana.santos@student.test', 'Quezon City',
    'North High', 'Grade 7', NULL, 'Inactive'
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_students WHERE email = 'ana.santos@student.test'
);

INSERT INTO tbl_enrollments (
    student_id, package_id, instrument_id, teacher_id,
    registration_fee_amount, registration_fee_paid, registration_status,
    enrollment_date, total_amount, paid_amount, payment_deadline_session, status
)
SELECT
    (SELECT student_id FROM tbl_students WHERE email = 'ana.santos@student.test' LIMIT 1),
    (SELECT package_id FROM tbl_lesson_packages WHERE package_name = 'Starter 8 Sessions' LIMIT 1),
    (SELECT instrument_id FROM tbl_instruments WHERE serial_number = 'DRM-N-001' LIMIT 1),
    (SELECT teacher_id FROM tbl_teachers WHERE email = 'mark.dizon@fasmusic.test' LIMIT 1),
    1000.00, 0.00, 'Pending',
    CURRENT_DATE, 4000.00, 0.00, 7, 'Pending Payment'
WHERE NOT EXISTS (
    SELECT 1
    FROM tbl_enrollments e
    WHERE e.student_id = (SELECT student_id FROM tbl_students WHERE email = 'ana.santos@student.test' LIMIT 1)
      AND e.registration_status = 'Pending'
);

COMMIT;

-- End of seed.sql
