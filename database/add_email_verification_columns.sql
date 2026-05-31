ALTER TABLE tbl_users
    ADD COLUMN email_verified_at DATETIME NULL AFTER status,
    ADD COLUMN email_verification_code_hash VARCHAR(255) NULL AFTER email_verified_at,
    ADD COLUMN email_verification_code_expires_at DATETIME NULL AFTER email_verification_code_hash,
    ADD COLUMN email_verification_sent_at DATETIME NULL AFTER email_verification_code_expires_at;

UPDATE tbl_users
SET email_verified_at = COALESCE(email_verified_at, NOW())
WHERE status = 'Active'
  AND email_verified_at IS NULL;
