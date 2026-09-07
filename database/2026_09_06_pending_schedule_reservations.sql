-- Pending online enrollment schedules temporarily reserve instructor time.
-- The API also applies this change defensively for installations that run without migrations.

ALTER TABLE tbl_enrollments
    ADD COLUMN IF NOT EXISTS schedule_request_status
        ENUM('Pending','Schedule Conflict','Suggested','Approved','Rejected','Expired') NULL
        AFTER schedule_status,
    ADD COLUMN IF NOT EXISTS reservation_expires_at DATETIME NULL
        AFTER schedule_request_status,
    ADD INDEX IF NOT EXISTS idx_pending_schedule_reservation
        (status, schedule_request_status, reservation_expires_at);

-- Existing online requests receive the default 24-hour reservation window.
-- Change this deployment default with FAS_PENDING_RESERVATION_MINUTES for new requests.
UPDATE tbl_enrollments
SET schedule_request_status = 'Pending',
    reservation_expires_at = DATE_ADD(created_at, INTERVAL 24 HOUR)
WHERE status = 'Pending'
  AND schedule_request_status IS NULL
  AND COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(request_notes) THEN request_notes ELSE '{}' END, '$.is_walkin_request')),
        '0'
      ) = '0';
      

UPDATE tbl_enrollments
SET schedule_request_status = 'Pending'
WHERE status = 'Pending'
  AND schedule_request_status IS NULL;
