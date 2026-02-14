-- =============================================================================
-- INSERT prices for lesson packages (tbl_lesson_packages from fas_db.sql 198-207)
-- Schema: package_id, package_name, total_sessions, price, validity_period,
--         description, status, created_at
-- =============================================================================
-- 1. Ensure tbl_lesson_packages exists (create from fas_db.sql if needed).
-- 2. Run the INSERT below. Adjust price values as needed for your academy.
-- =============================================================================

-- Clear if re-running (optional; remove if you want to keep existing data)
-- DELETE FROM tbl_lesson_packages WHERE package_name IN ('Basic (12 Sessions)', 'Standard (20 Sessions)', 'Premium (20+ Sessions)');

INSERT INTO tbl_lesson_packages (package_name, total_sessions, price, validity_period, description, status) VALUES
('Basic (12 Sessions)', 12, 7450.00, 90, '1 instrument only', 'Active'),
('Standard (20 Sessions)', 20, 11800.00, 90, '2 instruments', 'Active'),
('Premium (20+ Sessions)', 24, 14200.00, 90, '3 instruments', 'Active');

-- =============================================================================
-- tbl_session_packages: used by api/sessions.php (admin packages, registration).
-- Creates the table if missing, then seeds or updates prices.
-- =============================================================================

-- Create table if it doesn't exist (includes price column)
CREATE TABLE IF NOT EXISTS tbl_session_packages (
    package_id INT AUTO_INCREMENT PRIMARY KEY,
    package_name VARCHAR(100) NOT NULL,
    sessions INT NOT NULL,
    max_instruments TINYINT NOT NULL DEFAULT 1,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- If table already existed without price, add the column (run once; ignore error if column exists)
-- ALTER TABLE tbl_session_packages ADD COLUMN price DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER max_instruments;

-- Seed default packages only when table is empty
INSERT INTO tbl_session_packages (package_name, sessions, max_instruments, price, description)
SELECT * FROM (
    SELECT 'Basic (12 Sessions)' AS package_name, 12 AS sessions, 1 AS max_instruments, 7450.00 AS price, '1 instrument only' AS description
    UNION ALL
    SELECT 'Standard (20 Sessions)', 20, 2, 11800.00, '2 instruments'
    UNION ALL
    SELECT 'Premium (20+ Sessions)', 24, 3, 14200.00, '3 instruments'
) t
WHERE (SELECT COUNT(*) FROM tbl_session_packages) = 0;

-- Set/update prices on existing session packages (match by sessions)
UPDATE tbl_session_packages SET price = 7450.00  WHERE sessions = 12 AND max_instruments = 1;
UPDATE tbl_session_packages SET price = 11800.00 WHERE sessions = 20 AND max_instruments = 2;
UPDATE tbl_session_packages SET price = 14200.00 WHERE sessions = 24 AND max_instruments = 3;
