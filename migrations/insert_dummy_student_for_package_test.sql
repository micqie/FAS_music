-- Dummy student for testing admin_package.html (Packages page)
-- Run this in phpMyAdmin or MySQL after you have at least one branch.

-- 1) Ensure you have a branch (skip if you already have branches)
INSERT INTO tbl_branches (branch_name, address, phone, email, status)
SELECT 'SM Downtown', 'SM Downtown Address', '02-1234567', 'smdowntown@fas.com', 'Active'
WHERE NOT EXISTS (SELECT 1 FROM tbl_branches LIMIT 1);

-- 2) Get branch_id to use (use 1 if you have branches already)
SET @branch_id = (SELECT branch_id FROM tbl_branches LIMIT 1);

-- 3) Insert dummy student: Active + Fee Paid (so they show on Packages page)
INSERT INTO tbl_students (
    branch_id,
    first_name,
    last_name,
    phone,
    email,
    registration_fee_amount,
    registration_fee_paid,
    registration_status,
    status
) VALUES (
    @branch_id,
    'Test',
    'Student',
    '09171234567',
    'test.student@example.com',
    8450.00,
    8450.00,
    'Fee Paid',
    'Active'
);

-- Optional: if your tbl_students has session_package_id column, assign a package:
-- SET @student_id = LAST_INSERT_ID();
-- SET @package_id = (SELECT package_id FROM tbl_session_packages WHERE sessions = 12 LIMIT 1);
-- UPDATE tbl_students SET session_package_id = @package_id WHERE student_id = @student_id;
