-- Multi-specialization migration for teachers
-- Database: music-db

START TRANSACTION;

-- 1) Ensure specialization masterfile exists.
CREATE TABLE IF NOT EXISTS `tbl_specialization` (
  `specialization_id` int(11) NOT NULL AUTO_INCREMENT,
  `specialization_name` varchar(100) NOT NULL,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`specialization_id`),
  UNIQUE KEY `uniq_specialization_name` (`specialization_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2) Create pivot table for many-to-many teacher specializations.
CREATE TABLE IF NOT EXISTS `tbl_teacher_specializations` (
  `teacher_id` int(11) NOT NULL,
  `specialization_id` int(11) NOT NULL,
  PRIMARY KEY (`teacher_id`, `specialization_id`),
  KEY `idx_tts_specialization` (`specialization_id`),
  CONSTRAINT `tbl_teacher_specializations_ibfk_1` FOREIGN KEY (`teacher_id`) REFERENCES `tbl_teachers` (`teacher_id`) ON DELETE CASCADE,
  CONSTRAINT `tbl_teacher_specializations_ibfk_2` FOREIGN KEY (`specialization_id`) REFERENCES `tbl_specialization` (`specialization_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3) Move existing one-to-many (tbl_teachers.specialization_id) to pivot, if column exists.
SET @has_specialization_id := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tbl_teachers'
    AND COLUMN_NAME = 'specialization_id'
);

SET @sql_migrate_column := IF(
  @has_specialization_id = 1,
  'INSERT IGNORE INTO tbl_teacher_specializations (teacher_id, specialization_id)
   SELECT teacher_id, specialization_id
   FROM tbl_teachers
   WHERE specialization_id IS NOT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_migrate_column;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4) Backfill from legacy text column, if still present.
SET @has_specialization_text := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tbl_teachers'
    AND COLUMN_NAME = 'specialization'
);

SET @sql_seed_from_text := IF(
  @has_specialization_text = 1,
  "INSERT IGNORE INTO tbl_specialization (specialization_name, status)
   SELECT DISTINCT TRIM(SUBSTRING_INDEX(specialization, ',', 1)), 'Active'
   FROM tbl_teachers
   WHERE specialization IS NOT NULL AND TRIM(specialization) <> ''",
  'SELECT 1'
);
PREPARE stmt FROM @sql_seed_from_text;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql_map_from_text := IF(
  @has_specialization_text = 1,
  "INSERT IGNORE INTO tbl_teacher_specializations (teacher_id, specialization_id)
   SELECT t.teacher_id, s.specialization_id
   FROM tbl_teachers t
   JOIN tbl_specialization s
     ON s.specialization_name = TRIM(SUBSTRING_INDEX(t.specialization, ',', 1))
   WHERE t.specialization IS NOT NULL AND TRIM(t.specialization) <> ''",
  'SELECT 1'
);
PREPARE stmt FROM @sql_map_from_text;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5) Ensure every teacher has at least one specialization (General fallback).
INSERT IGNORE INTO tbl_specialization (specialization_name, status) VALUES ('General', 'Active');
INSERT IGNORE INTO tbl_teacher_specializations (teacher_id, specialization_id)
SELECT t.teacher_id, s.specialization_id
FROM tbl_teachers t
JOIN tbl_specialization s ON s.specialization_name = 'General'
LEFT JOIN tbl_teacher_specializations ts ON ts.teacher_id = t.teacher_id
WHERE ts.teacher_id IS NULL;

-- 6) Drop old specialization columns if present.
SET @sql_drop_fk_teachers_spec := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tbl_teachers'
        AND CONSTRAINT_NAME = 'tbl_teachers_ibfk_3'
    ),
    'ALTER TABLE tbl_teachers DROP FOREIGN KEY tbl_teachers_ibfk_3',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql_drop_fk_teachers_spec;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql_drop_idx_teachers_spec := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tbl_teachers'
        AND INDEX_NAME = 'specialization_id'
    ),
    'ALTER TABLE tbl_teachers DROP INDEX specialization_id',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql_drop_idx_teachers_spec;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql_drop_col_specialization_id := IF(
  @has_specialization_id = 1,
  'ALTER TABLE tbl_teachers DROP COLUMN specialization_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql_drop_col_specialization_id;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql_drop_col_specialization := IF(
  @has_specialization_text = 1,
  'ALTER TABLE tbl_teachers DROP COLUMN specialization',
  'SELECT 1'
);
PREPARE stmt FROM @sql_drop_col_specialization;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 7) Remove deprecated teacher instrument mapping table.
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS tbl_teacher_instruments;
SET FOREIGN_KEY_CHECKS = 1;

COMMIT;

