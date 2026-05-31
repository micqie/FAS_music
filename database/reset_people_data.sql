-- Reset people/account data only.
-- This follows the tables present in music_db.sql and deletes rows only, not tables.
-- It removes existing admin, manager, staff/desk, teacher, student, and guardian data
-- so you can restart without duplicate users.
--
-- After running this, import admin_setup.sql if you want a fresh admin account again.

SET FOREIGN_KEY_CHECKS = 0;

-- Keep settings records, but clear user references before deleting users.
UPDATE tbl_settings
SET updated_by = NULL
WHERE updated_by IS NOT NULL;

-- Delete dependent data first.
DELETE FROM tbl_student_progress;
DELETE FROM tbl_makeup_sessions;
DELETE FROM tbl_schedule;
DELETE FROM tbl_recurring_schedule;
DELETE FROM tbl_sessions;
DELETE FROM tbl_payment_schedule;
DELETE FROM tbl_payments;
DELETE FROM tbl_registration_payments;
DELETE FROM tbl_enrollments;
DELETE FROM tbl_student_guardians;
DELETE FROM tbl_student_instruments;
DELETE FROM tbl_teacher_specializations;
DELETE FROM tbl_teacher_availability;
DELETE FROM tbl_guardians;
DELETE FROM tbl_teachers;
DELETE FROM tbl_students;
DELETE FROM tbl_users;

SET FOREIGN_KEY_CHECKS = 1;

-- Reset auto-increment counters for cleaned tables.
ALTER TABLE tbl_student_progress AUTO_INCREMENT = 1;
ALTER TABLE tbl_makeup_sessions AUTO_INCREMENT = 1;
ALTER TABLE tbl_schedule AUTO_INCREMENT = 1;
ALTER TABLE tbl_recurring_schedule AUTO_INCREMENT = 1;
ALTER TABLE tbl_sessions AUTO_INCREMENT = 1;
ALTER TABLE tbl_payment_schedule AUTO_INCREMENT = 1;
ALTER TABLE tbl_payments AUTO_INCREMENT = 1;
ALTER TABLE tbl_registration_payments AUTO_INCREMENT = 1;
ALTER TABLE tbl_enrollments AUTO_INCREMENT = 1;
ALTER TABLE tbl_student_guardians AUTO_INCREMENT = 1;
ALTER TABLE tbl_student_instruments AUTO_INCREMENT = 1;
ALTER TABLE tbl_guardians AUTO_INCREMENT = 1;
ALTER TABLE tbl_teachers AUTO_INCREMENT = 1;
ALTER TABLE tbl_students AUTO_INCREMENT = 1;
ALTER TABLE tbl_users AUTO_INCREMENT = 1;

-- Optional:
-- Run admin_setup.sql after this if you want to recreate the default admin login.
