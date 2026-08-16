-- ============================================================
-- FAS Music Academy — Student / Guardian RBAC Migration
-- Run against: music_db
-- Generated: 2026-08-16
--
-- What this does:
--   1. Adds `student_code` to tbl_students  (STU-YYYY-NNNN login key)
--   2. Adds `guardian_code` to tbl_guardians (G-NNNN identifier)
--   3. Adds `guardian_user_id` FK to tbl_guardians → tbl_users
--      (links the guardian's own login account)
--   4. Adds `student_user_id` FK to tbl_students → tbl_users
--      (the SEPARATE student-module login created after approval)
--   5. Adds `guardian_user_id` to tbl_student_guardians
--      (so queries can go straight to the guardian's user account)
--   6. Back-fills student_code for every existing Active student
--   7. Back-fills guardian_code for every existing guardian
--   8. Back-fills guardian_user_id on tbl_guardians by matching email
--   9. Back-fills student_user_id on tbl_students by matching email
--      (existing online students reuse their current user row for now)
--
-- SAFE to run multiple times — every ALTER uses IF NOT EXISTS / checks.
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- STEP 1 — tbl_students: add student_code + student_user_id
-- ============================================================

-- student_code  e.g. STU-2026-0001  — used as the Student Module login
ALTER TABLE `tbl_students`
    ADD COLUMN IF NOT EXISTS `student_code`    VARCHAR(20)  NULL    AFTER `student_id`,
    ADD COLUMN IF NOT EXISTS `student_user_id` INT(11)      NULL    AFTER `student_code`;

-- Unique index so two students can never share a code
ALTER TABLE `tbl_students`
    ADD UNIQUE INDEX IF NOT EXISTS `uq_student_code` (`student_code`);

-- ============================================================
-- STEP 2 — tbl_guardians: add guardian_code + guardian_user_id
-- ============================================================

-- guardian_code  e.g. G-0001  — the guardian's own identifier
ALTER TABLE `tbl_guardians`
    ADD COLUMN IF NOT EXISTS `guardian_code`    VARCHAR(20)  NULL    AFTER `guardian_id`,
    ADD COLUMN IF NOT EXISTS `guardian_user_id` INT(11)      NULL    AFTER `guardian_code`;

ALTER TABLE `tbl_guardians`
    ADD UNIQUE INDEX IF NOT EXISTS `uq_guardian_code`    (`guardian_code`),
    ADD UNIQUE INDEX IF NOT EXISTS `uq_guardian_user_id` (`guardian_user_id`);

-- ============================================================
-- STEP 3 — tbl_student_guardians: expose guardian_user_id
-- ============================================================

-- Denormalised shortcut so we can look up guardian login without a join
ALTER TABLE `tbl_student_guardians`
    ADD COLUMN IF NOT EXISTS `guardian_user_id` INT(11) NULL AFTER `guardian_id`;

-- ============================================================
-- STEP 4 — Back-fill student_code for existing Active students
--           Format: STU-<4-digit year>-<4-digit zero-padded ID>
-- ============================================================

UPDATE `tbl_students`
SET    `student_code` = CONCAT(
           'STU-',
           YEAR(`created_at`),
           '-',
           LPAD(`student_id`, 4, '0')
       )
WHERE  `student_code` IS NULL
  AND  `status` = 'Active';

-- Also assign codes to Inactive/Graduated students so the column is complete
UPDATE `tbl_students`
SET    `student_code` = CONCAT(
           'STU-',
           YEAR(`created_at`),
           '-',
           LPAD(`student_id`, 4, '0')
       )
WHERE  `student_code` IS NULL;

-- ============================================================
-- STEP 5 — Back-fill guardian_code for existing guardians
--           Format: G-<4-digit zero-padded ID>
-- ============================================================

UPDATE `tbl_guardians`
SET    `guardian_code` = CONCAT('G-', LPAD(`guardian_id`, 4, '0'))
WHERE  `guardian_code` IS NULL;

-- ============================================================
-- STEP 6 — Back-fill guardian_user_id on tbl_guardians
--           Match by email (guardian email = their tbl_users email)
-- ============================================================

UPDATE `tbl_guardians` g
INNER JOIN `tbl_users` u
       ON  LOWER(TRIM(u.email))    = LOWER(TRIM(g.email))
        OR LOWER(TRIM(u.username)) = LOWER(TRIM(g.email))
SET    g.`guardian_user_id` = u.`user_id`
WHERE  g.`guardian_user_id` IS NULL
  AND  g.`email` IS NOT NULL
  AND  TRIM(g.`email`) <> '';

-- ============================================================
-- STEP 7 — Back-fill guardian_user_id on tbl_student_guardians
--           from the freshly populated tbl_guardians column
-- ============================================================

UPDATE `tbl_student_guardians` sg
INNER JOIN `tbl_guardians` g ON g.`guardian_id` = sg.`guardian_id`
SET    sg.`guardian_user_id` = g.`guardian_user_id`
WHERE  sg.`guardian_user_id` IS NULL
  AND  g.`guardian_user_id`  IS NOT NULL;

-- ============================================================
-- STEP 8 — Back-fill student_user_id on tbl_students
--           For existing ONLINE students their tbl_users row
--           (role_id=4, same email) IS their current student login.
--           For walk-in students (@fas.com) same logic applies.
--           After approval, a proper STU-xxxx login can be created
--           separately; this just records the current mapping.
-- ============================================================

UPDATE `tbl_students` s
INNER JOIN `tbl_users` u
       ON  LOWER(TRIM(u.email))    = LOWER(TRIM(s.email))
        OR LOWER(TRIM(u.username)) = LOWER(TRIM(s.email))
SET    s.`student_user_id` = u.`user_id`
WHERE  s.`student_user_id` IS NULL
  AND  s.`email` IS NOT NULL
  AND  TRIM(s.`email`) <> ''
  AND  u.`role_id` = 4;   -- role_id 4 = Student

-- ============================================================
-- STEP 9 — Foreign key constraints (added last, after data is clean)
-- ============================================================

-- tbl_guardians.guardian_user_id → tbl_users.user_id
SET @fk1 = (
    SELECT COUNT(*)
    FROM   `information_schema`.`TABLE_CONSTRAINTS`
    WHERE  `CONSTRAINT_SCHEMA` = DATABASE()
      AND  `TABLE_NAME`        = 'tbl_guardians'
      AND  `CONSTRAINT_NAME`   = 'fk_guardian_user'
);
-- Only add if missing (MariaDB 10.4 doesn't support IF NOT EXISTS on FK)
-- Run manually if the UPDATE above left NULLs from mismatched emails:
--
--   ALTER TABLE `tbl_guardians`
--       ADD CONSTRAINT `fk_guardian_user`
--       FOREIGN KEY (`guardian_user_id`) REFERENCES `tbl_users`(`user_id`)
--       ON UPDATE CASCADE ON DELETE SET NULL;
--
-- We do it safely with a prepared statement trick:
DELIMITER ;;
CREATE PROCEDURE _fas_add_fk_if_missing()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE  CONSTRAINT_SCHEMA = DATABASE()
          AND  TABLE_NAME        = 'tbl_guardians'
          AND  CONSTRAINT_NAME   = 'fk_guardian_user'
    ) THEN
        ALTER TABLE `tbl_guardians`
            ADD CONSTRAINT `fk_guardian_user`
            FOREIGN KEY (`guardian_user_id`) REFERENCES `tbl_users`(`user_id`)
            ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE  CONSTRAINT_SCHEMA = DATABASE()
          AND  TABLE_NAME        = 'tbl_students'
          AND  CONSTRAINT_NAME   = 'fk_student_user'
    ) THEN
        ALTER TABLE `tbl_students`
            ADD CONSTRAINT `fk_student_user`
            FOREIGN KEY (`student_user_id`) REFERENCES `tbl_users`(`user_id`)
            ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE  CONSTRAINT_SCHEMA = DATABASE()
          AND  TABLE_NAME        = 'tbl_student_guardians'
          AND  CONSTRAINT_NAME   = 'fk_sg_guardian_user'
    ) THEN
        ALTER TABLE `tbl_student_guardians`
            ADD CONSTRAINT `fk_sg_guardian_user`
            FOREIGN KEY (`guardian_user_id`) REFERENCES `tbl_users`(`user_id`)
            ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END;;
DELIMITER ;

CALL _fas_add_fk_if_missing();
DROP PROCEDURE IF EXISTS _fas_add_fk_if_missing;

-- ============================================================
-- STEP 10 — Verification queries (run to confirm, then delete)
-- ============================================================

-- Check student codes
-- SELECT student_id, student_code, student_user_id, first_name, last_name, status
-- FROM   tbl_students
-- ORDER  BY student_id;

-- Check guardian codes + user links
-- SELECT guardian_id, guardian_code, guardian_user_id, first_name, last_name, email
-- FROM   tbl_guardians
-- ORDER  BY guardian_id;

-- Check the full relationship
-- SELECT
--     sg.student_guardian_id,
--     s.student_code,
--     CONCAT(s.first_name,' ',s.last_name)   AS student_name,
--     g.guardian_code,
--     CONCAT(g.first_name,' ',g.last_name)   AS guardian_name,
--     g.relationship_type,
--     gu.username                             AS guardian_login,
--     su.username                             AS student_login,
--     sg.is_primary_guardian,
--     sg.can_enroll,
--     sg.can_pay
-- FROM   tbl_student_guardians sg
-- JOIN   tbl_students  s  ON s.student_id   = sg.student_id
-- JOIN   tbl_guardians g  ON g.guardian_id  = sg.guardian_id
-- LEFT JOIN tbl_users  gu ON gu.user_id     = g.guardian_user_id
-- LEFT JOIN tbl_users  su ON su.user_id     = s.student_user_id
-- ORDER  BY s.student_id;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- SUMMARY OF CHANGES
-- ============================================================
-- tbl_students
--   + student_code    VARCHAR(20) UNIQUE  — "STU-2026-0001"
--   + student_user_id INT FK→tbl_users   — the student-module login row
--
-- tbl_guardians
--   + guardian_code    VARCHAR(20) UNIQUE — "G-0001"
--   + guardian_user_id INT FK→tbl_users  — the guardian-module login row
--
-- tbl_student_guardians
--   + guardian_user_id INT FK→tbl_users  — shortcut for auth queries
--
-- Login logic going forward:
--   Guardian login  → guardian email/username + password → Guardian Module
--   Student login   → student_code            + password → Student Module
--   Staff/Admin     → their own credentials              → unchanged
-- ============================================================
