ALTER TABLE `tbl_registration_payments`
ADD COLUMN `reference_number` VARCHAR(100) NULL AFTER `receipt_number`;

ALTER TABLE `tbl_payments`
ADD COLUMN `reference_number` VARCHAR(100) NULL AFTER `receipt_number`;
