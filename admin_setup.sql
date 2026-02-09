-- ============================================
-- ADMIN ACCOUNT SETUP
-- ============================================

-- Insert Roles (if not exists)
INSERT INTO tbl_roles (role_name) VALUES ('Admin') ON DUPLICATE KEY UPDATE role_name = role_name;
INSERT INTO tbl_roles (role_name) VALUES ('Manager') ON DUPLICATE KEY UPDATE role_name = role_name;
INSERT INTO tbl_roles (role_name) VALUES ('Staff') ON DUPLICATE KEY UPDATE role_name = role_name;
INSERT INTO tbl_roles (role_name) VALUES ('Student') ON DUPLICATE KEY UPDATE role_name = role_name;
INSERT INTO tbl_roles (role_name) VALUES ('Guardians') ON DUPLICATE KEY UPDATE role_name = role_name;

-- Create Admin Account
-- Username: fasadmin@music.com
-- Password: password2020 (hashed with PHP password_hash)

-- First, ensure Admin role exists
INSERT INTO tbl_roles (role_name) VALUES ('Admin') ON DUPLICATE KEY UPDATE role_name = role_name;

-- Create Admin User
-- Password hash generated for: password2020
INSERT INTO tbl_users (
    username,
    password,
    role_id,
    first_name,
    last_name,
    email,
    phone,
    status
)
SELECT
    'fasadmin@music.com',
    '$2y$10$rioDBIW6MNarnd6ZRJF9g.Dma59mDAHCdRiploZMYWYfnwvXJC1j2', -- Hash for password2020
    (SELECT role_id FROM tbl_roles WHERE role_name = 'Admin' LIMIT 1),
    'FAS',
    'Administrator',
    'fasadmin@music.com',
    NULL,
    'Active'
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_users WHERE username = 'fasadmin@music.com'
);

-- Verify the admin account was created
SELECT
    u.user_id,
    u.username,
    u.first_name,
    u.last_name,
    u.email,
    r.role_name,
    u.status
FROM tbl_users u
INNER JOIN tbl_roles r ON u.role_id = r.role_id
WHERE u.username = 'fasadmin@music.com';
