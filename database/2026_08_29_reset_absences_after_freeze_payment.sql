-- Start a fresh absence-policy cycle after an approved freeze payment.
-- Historical session attendance is retained for audit/history.

SET @has_absence_reset_at := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tbl_enrollments'
      AND COLUMN_NAME = 'absence_reset_at'
);

SET @add_absence_reset_at := IF(
    @has_absence_reset_at = 0,
    'ALTER TABLE tbl_enrollments ADD COLUMN absence_reset_at DATETIME NULL AFTER consecutive_absences',
    'SELECT 1'
);

PREPARE add_absence_reset_at_stmt FROM @add_absence_reset_at;
EXECUTE add_absence_reset_at_stmt;
DEALLOCATE PREPARE add_absence_reset_at_stmt;
