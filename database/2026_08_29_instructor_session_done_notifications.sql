-- Guardian completion alerts must be triggered only by the instructor's
-- explicit Session Done action, not by generic attendance/session status.

SET @has_instructor_completed_at := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tbl_sessions'
      AND COLUMN_NAME = 'instructor_completed_at'
);

SET @add_instructor_completed_at := IF(
    @has_instructor_completed_at = 0,
    'ALTER TABLE tbl_sessions ADD COLUMN instructor_completed_at DATETIME NULL AFTER attendance_status',
    'SELECT 1'
);

PREPARE add_instructor_completed_at_stmt FROM @add_instructor_completed_at;
EXECUTE add_instructor_completed_at_stmt;
DEALLOCATE PREPARE add_instructor_completed_at_stmt;
