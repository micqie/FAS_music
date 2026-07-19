-- ── Freeze / Slot Reservation Payments ────────────────────────────
-- Tracks ₱100 slot reservation payments when a student's schedule is frozen.
-- Student submits → status = 'Pending'
-- Desk approves  → status = 'Paid', enrollment schedule_status reset to 'Active'

CREATE TABLE IF NOT EXISTS `tbl_freeze_payments` (
    `freeze_payment_id`  INT          NOT NULL AUTO_INCREMENT,
    `enrollment_id`      INT          NOT NULL,
    `student_id`         INT          NOT NULL,
    `amount`             DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    `payment_method`     ENUM('Cash','GCash','Bank Transfer','Other') NOT NULL DEFAULT 'Cash',
    `reference_number`   VARCHAR(100)  NULL,
    `proof_path`         VARCHAR(255)  NULL,
    `status`             ENUM('Pending','Paid','Rejected') NOT NULL DEFAULT 'Pending',
    `receipt_number`     VARCHAR(50)   NULL,
    `notes`              TEXT          NULL,
    `reviewed_by`        INT           NULL COMMENT 'user_id of desk/manager who approved',
    `reviewed_at`        DATETIME      NULL,
    `payment_date`       DATE          NULL,
    `created_at`         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`freeze_payment_id`),
    KEY `idx_freeze_payments_enrollment` (`enrollment_id`),
    KEY `idx_freeze_payments_student`    (`student_id`),
    KEY `idx_freeze_payments_status`     (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
