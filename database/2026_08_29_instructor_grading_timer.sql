ALTER TABLE tbl_sessions
    ADD COLUMN IF NOT EXISTS grading_started_at DATETIME NULL AFTER instructor_completed_at,
    ADD COLUMN IF NOT EXISTS grading_completed_at DATETIME NULL AFTER grading_started_at;
