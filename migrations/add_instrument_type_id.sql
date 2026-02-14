-- ============================================
-- Migration: Add type_id to tbl_instruments
-- Fixes: SQLSTATE[42S22]: Column not found: 1054 Unknown column 'type_id'
-- ============================================

-- 1. Create instrument types table if it doesn't exist
CREATE TABLE IF NOT EXISTS tbl_instrument_types (
    type_id INT AUTO_INCREMENT PRIMARY KEY,
    type_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

-- 2. Insert default instrument type if table is empty (needed for migration)
INSERT IGNORE INTO tbl_instrument_types (type_name, description) 
VALUES ('Other', 'General/uncategorized instrument type');

-- 3. Add type_id column to tbl_instruments (if it doesn't exist)
-- Run these one at a time - if you get "Duplicate column" error, the column already exists, skip to step 4

-- Add column as nullable first to handle existing rows
ALTER TABLE tbl_instruments ADD COLUMN type_id INT NULL;

-- 4. Set default type for any existing instruments
UPDATE tbl_instruments 
SET type_id = (SELECT type_id FROM tbl_instrument_types WHERE type_name = 'Other' LIMIT 1) 
WHERE type_id IS NULL;

-- 5. Make column NOT NULL
ALTER TABLE tbl_instruments MODIFY COLUMN type_id INT NOT NULL;

-- 6. Add foreign key (drop first if it exists from partial migration)
-- MySQL will error if FK doesn't exist - that's OK, just run the ADD

ALTER TABLE tbl_instruments 
ADD CONSTRAINT fk_instruments_type 
FOREIGN KEY (type_id) REFERENCES tbl_instrument_types(type_id);
