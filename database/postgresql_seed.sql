-- Minimum role rows for a fresh PostgreSQL database. This does not create a
-- default administrator or copy any MySQL application data.
INSERT INTO tbl_roles (role_name) VALUES
    ('Admin'),
    ('Manager'),
    ('Staff'),
    ('Student'),
    ('Guardians')
ON CONFLICT (role_name) DO NOTHING;
