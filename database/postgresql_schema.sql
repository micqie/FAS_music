-- Schema-only PostgreSQL starter generated from database/current_database.sql.
-- No application or user data is included. Check in sync with database migrations.

CREATE TABLE IF NOT EXISTS "tbl_attendance" ("attendance_id" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "branch_id" INTEGER DEFAULT NULL,
  "attended_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" VARCHAR(7) NOT NULL DEFAULT 'Present',
  "source" varchar(30) DEFAULT NULL,
  "notes" varchar(255) DEFAULT NULL);
CREATE TABLE IF NOT EXISTS "tbl_audit_logs" ("log_id" BIGINT NOT NULL,
  "user_id" INTEGER DEFAULT NULL,
  "user_name" varchar(120) DEFAULT NULL,
  "user_role" varchar(60) DEFAULT NULL,
  "user_email" varchar(255) DEFAULT NULL,
  "action" varchar(100) NOT NULL,
  "module" varchar(80) NOT NULL DEFAULT 'General',
  "target_type" varchar(80) DEFAULT NULL,
  "target_table" varchar(100) DEFAULT NULL,
  "target_id" INTEGER DEFAULT NULL,
  "target_label" varchar(255) DEFAULT NULL,
  "description" text DEFAULT NULL,
  "severity" VARCHAR(8) NOT NULL DEFAULT 'info',
  "old_value" TEXT DEFAULT NULL,
  "new_value" TEXT DEFAULT NULL,
  "ip_address" varchar(45) DEFAULT NULL,
  "user_agent" varchar(512) DEFAULT NULL,
  "device_label" varchar(255) DEFAULT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_branches" ("branch_id" INTEGER NOT NULL,
  "branch_name" varchar(100) NOT NULL,
  "address" text DEFAULT NULL,
  "phone" varchar(20) DEFAULT NULL,
  "email" varchar(100) DEFAULT NULL,
  "status" VARCHAR(8) DEFAULT 'Active',
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_enrollments" ("enrollment_id" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "package_id" INTEGER NOT NULL,
  "instrument_id" INTEGER DEFAULT NULL,
  "assigned_teacher_id" INTEGER DEFAULT NULL,
  "fixed_day_of_week" VARCHAR(9) DEFAULT NULL,
  "fixed_start_time" time DEFAULT NULL,
  "fixed_end_time" time DEFAULT NULL,
  "fixed_room_id" INTEGER DEFAULT NULL,
  "preferred_schedule" text DEFAULT NULL,
  "request_notes" text DEFAULT NULL,
  "enrollment_date" date DEFAULT CURRENT_DATE,
  "start_date" date DEFAULT NULL,
  "end_date" date DEFAULT NULL,
  "status" VARCHAR(9) DEFAULT 'Pending',
  "schedule_status" VARCHAR(6) NOT NULL DEFAULT 'Active',
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enrolled_by_type" VARCHAR(8) NOT NULL DEFAULT 'Self',
  "student_guardian_id" INTEGER DEFAULT NULL,
  "total_sessions" INTEGER NOT NULL,
  "allowed_absences" INTEGER NOT NULL DEFAULT 0,
  "used_absences" INTEGER NOT NULL DEFAULT 0,
  "consecutive_absences" INTEGER NOT NULL DEFAULT 0,
  "auto_generated_until" date DEFAULT NULL,
  "fixed_schedule_locked" INTEGER NOT NULL DEFAULT 1,
  "completed_sessions" INTEGER NOT NULL DEFAULT 0,
  "payment_type" VARCHAR(15) NOT NULL DEFAULT 'Partial Payment',
  "current_operation_id" INTEGER DEFAULT NULL);
CREATE TABLE IF NOT EXISTS "tbl_enrollment_schedule_slots" ("slot_id" INTEGER NOT NULL,
  "enrollment_id" INTEGER NOT NULL,
  "teacher_id" INTEGER NOT NULL,
  "instrument_id" INTEGER DEFAULT NULL,
  "day_of_week" VARCHAR(9) NOT NULL,
  "start_time" time NOT NULL,
  "end_time" time NOT NULL,
  "room_id" INTEGER DEFAULT NULL,
  "room_name" varchar(100) DEFAULT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 1,
  "status" VARCHAR(8) NOT NULL DEFAULT 'Active',
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_featured_posts" ("featured_post_id" INTEGER NOT NULL,
  "branch_id" INTEGER DEFAULT NULL,
  "title" varchar(180) NOT NULL,
  "category" varchar(80) NOT NULL,
  "content" text NOT NULL,
  "media_type" VARCHAR(5) NOT NULL DEFAULT 'Image',
  "media_path" varchar(255) NOT NULL,
  "status" VARCHAR(9) NOT NULL DEFAULT 'Draft',
  "published_at" TIMESTAMP DEFAULT NULL,
  "created_by_user_id" INTEGER DEFAULT NULL,
  "updated_by_user_id" INTEGER DEFAULT NULL,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_freeze_payments" ("freeze_payment_id" INTEGER NOT NULL,
  "enrollment_id" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "amount" decimal(10,2) NOT NULL DEFAULT 100.00,
  "payment_method" VARCHAR(13) NOT NULL DEFAULT 'Cash',
  "reference_number" varchar(100) DEFAULT NULL,
  "proof_path" varchar(255) DEFAULT NULL,
  "status" VARCHAR(8) NOT NULL DEFAULT 'Pending',
  "receipt_number" varchar(50) DEFAULT NULL,
  "notes" text DEFAULT NULL,
  "reviewed_by" INTEGER DEFAULT NULL,
  "reviewed_at" TIMESTAMP DEFAULT NULL,
  "payment_date" date DEFAULT NULL,
  "source" VARCHAR(6) NOT NULL DEFAULT 'online',
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_guardians" ("guardian_id" INTEGER NOT NULL,
  "guardian_code" varchar(20) DEFAULT NULL,
  "guardian_user_id" INTEGER DEFAULT NULL,
  "first_name" varchar(50) NOT NULL,
  "last_name" varchar(50) NOT NULL,
  "relationship_type" VARCHAR(14) NOT NULL,
  "phone" varchar(20) DEFAULT NULL,
  "occupation" varchar(50) DEFAULT NULL,
  "email" varchar(100) DEFAULT NULL,
  "address" text DEFAULT NULL,
  "status" VARCHAR(8) DEFAULT 'Active',
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_guardian_absence_requests" ("request_id" INTEGER NOT NULL,
  "guardian_id" INTEGER NOT NULL,
  "guardian_user_id" INTEGER DEFAULT NULL,
  "student_id" INTEGER NOT NULL,
  "branch_id" INTEGER DEFAULT NULL,
  "session_date" date NOT NULL,
  "reason" varchar(120) NOT NULL,
  "notes" text DEFAULT NULL,
  "status" VARCHAR(8) NOT NULL DEFAULT 'Pending',
  "reviewed_notes" text DEFAULT NULL,
  "reviewed_by_user_id" INTEGER DEFAULT NULL,
  "reviewed_at" TIMESTAMP DEFAULT NULL,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_instruments" ("instrument_id" INTEGER NOT NULL,
  "branch_id" INTEGER NOT NULL,
  "instrument_name" varchar(100) NOT NULL,
  "type_id" INTEGER NOT NULL,
  "condition" VARCHAR(9) DEFAULT 'Good',
  "status" VARCHAR(12) DEFAULT 'Available',
  "serial_number" varchar(50) DEFAULT NULL);
CREATE TABLE IF NOT EXISTS "tbl_instrument_types" ("type_id" INTEGER NOT NULL,
  "type_name" varchar(50) NOT NULL,
  "description" text DEFAULT NULL);
CREATE TABLE IF NOT EXISTS "tbl_makeup_sessions" ("makeup_id" INTEGER NOT NULL,
  "original_session_id" INTEGER NOT NULL,
  "makeup_session_id" INTEGER DEFAULT NULL,
  "teacher_id" INTEGER NOT NULL,
  "status" VARCHAR(9) DEFAULT 'Scheduled',
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_payments" ("payment_id" INTEGER NOT NULL,
  "enrollment_id" INTEGER NOT NULL,
  "payment_date" date DEFAULT CURRENT_DATE,
  "amount" decimal(10,2) NOT NULL,
  "payment_method" VARCHAR(13) NOT NULL,
  "payment_type" VARCHAR(15) DEFAULT 'Partial Payment',
  "status" VARCHAR(8) DEFAULT 'Pending',
  "receipt_number" varchar(50) DEFAULT NULL,
  "reference_number" varchar(100) DEFAULT NULL,
  "notes" text DEFAULT NULL,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_payment_schedule" ("schedule_id" INTEGER NOT NULL,
  "enrollment_id" INTEGER NOT NULL,
  "session_number" INTEGER NOT NULL,
  "required_amount" decimal(10,2) NOT NULL,
  "paid_amount" decimal(10,2) DEFAULT 0.00,
  "deadline_date" date DEFAULT NULL,
  "status" VARCHAR(7) DEFAULT 'Pending');
CREATE TABLE IF NOT EXISTS "tbl_promotional_exams" ("exam_id" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "instrument_id" INTEGER DEFAULT NULL,
  "learning_level_id" INTEGER DEFAULT NULL,
  "teacher_id" INTEGER DEFAULT NULL,
  "assessed_level" varchar(100) NOT NULL,
  "exam_date" date DEFAULT NULL,
  "grade_rating" varchar(100) DEFAULT NULL,
  "result" VARCHAR(7) NOT NULL DEFAULT 'Pending',
  "examiner_notes" text DEFAULT NULL,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_recitals" ("recital_id" INTEGER NOT NULL,
  "branch_id" INTEGER NOT NULL,
  "teacher_id" INTEGER DEFAULT NULL,
  "recital_name" varchar(100) NOT NULL,
  "recital_date" date NOT NULL,
  "start_time" time DEFAULT NULL,
  "end_time" time DEFAULT NULL,
  "venue" varchar(100) DEFAULT NULL,
  "max_audience_capacity" INTEGER DEFAULT NULL,
  "status" VARCHAR(9) DEFAULT 'Scheduled',
  "description" text DEFAULT NULL,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_recital_participants" ("participant_id" INTEGER NOT NULL,
  "recital_id" INTEGER NOT NULL,
  "participant_type" VARCHAR(9) NOT NULL DEFAULT 'Performer',
  "student_id" INTEGER DEFAULT NULL,
  "guardian_id" INTEGER DEFAULT NULL,
  "participant_name" varchar(120) DEFAULT NULL,
  "instrument_id" INTEGER DEFAULT NULL,
  "number_of_guests" INTEGER DEFAULT 1,
  "performance_order" INTEGER DEFAULT NULL,
  "performance_time" time DEFAULT NULL,
  "piece_name" varchar(200) DEFAULT NULL,
  "confirmed" VARCHAR(1) DEFAULT 'N',
  "confirmed_at" timestamp NULL DEFAULT NULL,
  "evaluation_notes" text DEFAULT NULL,
  "notes" text DEFAULT NULL,
  "status" VARCHAR(9) DEFAULT 'Confirmed');
CREATE TABLE IF NOT EXISTS "tbl_recurring_schedule" ("recurring_id" INTEGER NOT NULL,
  "enrollment_id" INTEGER NOT NULL,
  "teacher_id" INTEGER NOT NULL,
  "room_id" INTEGER NOT NULL,
  "day_of_week" VARCHAR(9) NOT NULL,
  "start_time" time NOT NULL,
  "end_time" time NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "status" VARCHAR(7) DEFAULT 'Active',
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_registration_payments" ("registration_payment_id" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "payment_date" date DEFAULT CURRENT_DATE,
  "amount" decimal(10,2) NOT NULL,
  "payment_method" VARCHAR(13) NOT NULL,
  "status" VARCHAR(8) DEFAULT 'Pending',
  "receipt_number" varchar(50) DEFAULT NULL,
  "reference_number" varchar(100) DEFAULT NULL);
CREATE TABLE IF NOT EXISTS "tbl_repairs" ("repair_id" INTEGER NOT NULL,
  "school_instrument_id" INTEGER NOT NULL,
  "service_provider_id" INTEGER NOT NULL,
  "issue_description" text NOT NULL,
  "reported_date" date DEFAULT CURRENT_DATE,
  "repair_date" date DEFAULT NULL,
  "expected_completion_date" date DEFAULT NULL,
  "actual_completion_date" date DEFAULT NULL,
  "cost" decimal(10,2) DEFAULT NULL,
  "status" VARCHAR(11) DEFAULT 'Reported',
  "notes" text DEFAULT NULL,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_roles" ("role_id" INTEGER NOT NULL,
  "role_name" varchar(50) NOT NULL);
CREATE TABLE IF NOT EXISTS "tbl_rooms" ("room_id" INTEGER NOT NULL,
  "branch_id" INTEGER NOT NULL,
  "room_name" varchar(50) NOT NULL,
  "capacity" INTEGER DEFAULT 1,
  "room_type" VARCHAR(14) DEFAULT 'Private Lesson',
  "status" VARCHAR(17) DEFAULT 'Available',
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_schedule" ("schedule_id" INTEGER NOT NULL,
  "branch_id" INTEGER NOT NULL,
  "teacher_id" INTEGER NOT NULL,
  "room_id" INTEGER NOT NULL,
  "enrollment_id" INTEGER DEFAULT NULL,
  "session_id" INTEGER DEFAULT NULL,
  "schedule_date" date NOT NULL,
  "start_time" time NOT NULL,
  "end_time" time NOT NULL,
  "schedule_type" VARCHAR(7) DEFAULT 'Lesson',
  "status" VARCHAR(9) DEFAULT 'Scheduled',
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_schedule_operation_lookup" ("operation_id" INTEGER NOT NULL,
  "operation_code" varchar(50) NOT NULL,
  "operation_name" varchar(100) NOT NULL,
  "applies_to" VARCHAR(10) NOT NULL,
  "counts_as_absence" INTEGER NOT NULL DEFAULT 0,
  "counts_as_consumed_session" INTEGER NOT NULL DEFAULT 0,
  "allows_makeup" INTEGER NOT NULL DEFAULT 0,
  "requires_admin_approval" INTEGER NOT NULL DEFAULT 0,
  "freezes_schedule" INTEGER NOT NULL DEFAULT 0,
  "requires_holding_fee" INTEGER NOT NULL DEFAULT 0,
  "description" varchar(255) DEFAULT NULL,
  "status" VARCHAR(8) NOT NULL DEFAULT 'Active',
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_school_instruments" ("school_instrument_id" INTEGER NOT NULL,
  "branch_id" INTEGER NOT NULL,
  "instrument_id" INTEGER NOT NULL,
  "instrument_name" varchar(100) DEFAULT NULL,
  "brand" varchar(100) DEFAULT NULL,
  "purchase_date" date DEFAULT NULL,
  "purchase_cost" decimal(10,2) DEFAULT NULL,
  "condition" VARCHAR(9) DEFAULT 'Good',
  "status" VARCHAR(12) DEFAULT 'Available');
CREATE TABLE IF NOT EXISTS "tbl_service_providers" ("service_provider_id" INTEGER NOT NULL,
  "provider_name" varchar(100) NOT NULL,
  "provider_type" VARCHAR(22) NOT NULL,
  "brand_specialization" varchar(100) DEFAULT NULL,
  "contact_person" varchar(50) DEFAULT NULL,
  "phone" varchar(20) DEFAULT NULL,
  "email" varchar(100) DEFAULT NULL,
  "address" text DEFAULT NULL,
  "status" VARCHAR(8) DEFAULT 'Active',
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_sessions" ("session_id" INTEGER NOT NULL,
  "enrollment_id" INTEGER NOT NULL,
  "teacher_id" INTEGER NOT NULL,
  "session_number" INTEGER NOT NULL,
  "session_date" date NOT NULL,
  "start_time" time DEFAULT NULL,
  "end_time" time DEFAULT NULL,
  "session_type" VARCHAR(7) DEFAULT 'Regular',
  "instrument_id" INTEGER DEFAULT NULL,
  "school_instrument_id" INTEGER DEFAULT NULL,
  "room_id" INTEGER DEFAULT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'Scheduled',
  "attendance_status" VARCHAR(14) NOT NULL DEFAULT 'Pending',
  "absence_notice" VARCHAR(8) NOT NULL DEFAULT 'None',
  "counted_in" INTEGER NOT NULL DEFAULT 0,
  "makeup_eligible" INTEGER NOT NULL DEFAULT 0,
  "makeup_required" INTEGER NOT NULL DEFAULT 0,
  "attendance_notes" text DEFAULT NULL,
  "notes" text DEFAULT NULL,
  "rescheduled_from_session_id" INTEGER DEFAULT NULL,
  "rescheduled_to_session_id" INTEGER DEFAULT NULL,
  "needs_rescheduling" INTEGER NOT NULL DEFAULT 0,
  "cancellation_reason" text DEFAULT NULL,
  "cancelled_by_teacher_at" TIMESTAMP DEFAULT NULL,
  "rescheduled_at" TIMESTAMP DEFAULT NULL,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "operation_id" INTEGER DEFAULT NULL);
CREATE TABLE IF NOT EXISTS "tbl_session_packages" ("package_id" INTEGER NOT NULL,
  "branch_id" INTEGER DEFAULT NULL,
  "package_name" varchar(100) NOT NULL,
  "sessions" INTEGER NOT NULL,
  "max_instruments" INTEGER NOT NULL DEFAULT 1,
  "price" decimal(10,2) NOT NULL DEFAULT 0.00,
  "description" text DEFAULT NULL,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_settings" ("setting_id" INTEGER NOT NULL,
  "setting_key" varchar(100) NOT NULL,
  "setting_value" text NOT NULL,
  "setting_type" VARCHAR(7) DEFAULT 'String',
  "description" text DEFAULT NULL,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" INTEGER DEFAULT NULL);
CREATE TABLE IF NOT EXISTS "tbl_song_lesson_history" ("history_id" INTEGER NOT NULL,
  "assignment_id" INTEGER NOT NULL,
  "session_id" INTEGER DEFAULT NULL,
  "teacher_id" INTEGER NOT NULL,
  "lesson_date" date NOT NULL,
  "progress_status" VARCHAR(10) NOT NULL DEFAULT 'assigned',
  "lesson_notes" text DEFAULT NULL,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_song_library" ("song_id" INTEGER NOT NULL,
  "teacher_id" INTEGER NOT NULL,
  "title" varchar(255) NOT NULL,
  "artist" varchar(255) DEFAULT NULL,
  "genre" varchar(100) DEFAULT NULL,
  "category" varchar(100) NOT NULL DEFAULT 'voice',
  "difficulty_level" varchar(100) DEFAULT NULL,
  "vocal_range" varchar(100) DEFAULT NULL,
  "tags" text DEFAULT NULL,
  "youtube_link" varchar(500) DEFAULT NULL,
  "spotify_link" varchar(500) DEFAULT NULL,
  "sheet_music_path" varchar(255) DEFAULT NULL,
  "accompaniment_audio_path" varchar(255) DEFAULT NULL,
  "notes" text DEFAULT NULL,
  "status" VARCHAR(8) NOT NULL DEFAULT 'Active',
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_specialization" ("specialization_id" INTEGER NOT NULL,
  "specialization_name" varchar(100) NOT NULL,
  "type_id" INTEGER DEFAULT NULL,
  "status" VARCHAR(8) DEFAULT 'Active',
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_students" ("student_id" INTEGER NOT NULL,
  "student_code" varchar(20) DEFAULT NULL,
  "student_user_id" INTEGER DEFAULT NULL,
  "branch_id" INTEGER NOT NULL,
  "first_name" varchar(50) NOT NULL,
  "last_name" varchar(50) NOT NULL,
  "middle_name" varchar(50) DEFAULT NULL,
  "date_of_birth" date DEFAULT NULL,
  "age" INTEGER DEFAULT NULL,
  "phone" varchar(20) DEFAULT NULL,
  "email" varchar(100) DEFAULT NULL,
  "address" text DEFAULT NULL,
  "school" varchar(100) DEFAULT NULL,
  "grade_year" varchar(50) DEFAULT NULL,
  "health_diagnosis" text DEFAULT NULL,
  "status" VARCHAR(9) DEFAULT 'Active',
  "registration_source" varchar(20) NOT NULL DEFAULT 'online',
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "session_package_id" INTEGER DEFAULT NULL,
  "registration_proof_path" varchar(255) DEFAULT NULL,
  "age_verification_proof_path" varchar(255) DEFAULT NULL);
CREATE TABLE IF NOT EXISTS "tbl_student_certificates" ("certificate_id" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "promotional_exam_id" INTEGER DEFAULT NULL,
  "learning_level_id" INTEGER DEFAULT NULL,
  "instrument_id" INTEGER DEFAULT NULL,
  "achieved_level" varchar(100) NOT NULL,
  "certificate_number" varchar(100) DEFAULT NULL,
  "issued_at" date NOT NULL,
  "issued_by" INTEGER DEFAULT NULL,
  "status" VARCHAR(7) NOT NULL DEFAULT 'Issued',
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_student_guardians" ("student_guardian_id" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "guardian_id" INTEGER NOT NULL,
  "guardian_user_id" INTEGER DEFAULT NULL,
  "is_primary_guardian" VARCHAR(1) DEFAULT 'N',
  "can_enroll" VARCHAR(1) DEFAULT 'Y',
  "can_pay" VARCHAR(1) DEFAULT 'Y',
  "emergency_contact" VARCHAR(1) DEFAULT 'N');
CREATE TABLE IF NOT EXISTS "tbl_student_instruments" ("student_instrument_id" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "instrument_id" INTEGER NOT NULL,
  "priority_order" INTEGER NOT NULL DEFAULT 1,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_student_learning_levels" ("learning_level_id" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "instrument_id" INTEGER NOT NULL,
  "teacher_id" INTEGER DEFAULT NULL,
  "level_name" varchar(100) NOT NULL,
  "book_material" varchar(255) DEFAULT NULL,
  "current_topic" varchar(255) DEFAULT NULL,
  "instructor_notes" text DEFAULT NULL,
  "skills_developing" text DEFAULT NULL,
  "areas_for_improvement" text DEFAULT NULL,
  "assessment_readiness" VARCHAR(20) NOT NULL DEFAULT 'Not Ready',
  "status" VARCHAR(11) NOT NULL DEFAULT 'In Progress',
  "started_at" date NOT NULL,
  "achieved_at" date DEFAULT NULL,
  "achieved_exam_id" INTEGER DEFAULT NULL,
  "previous_learning_level_id" INTEGER DEFAULT NULL,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_student_progress" ("progress_id" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "session_id" INTEGER NOT NULL,
  "instrument_id" INTEGER NOT NULL,
  "skill_level" varchar(50) DEFAULT NULL,
  "performance_score" BIGINT DEFAULT NULL,
  "technique_score" BIGINT DEFAULT NULL,
  "rhythm_score" BIGINT DEFAULT NULL,
  "focus_score" BIGINT DEFAULT NULL,
  "assignment_score" BIGINT DEFAULT NULL,
  "criteria_scores" text DEFAULT NULL,
  "remarks" text DEFAULT NULL,
  "assessment_date" date DEFAULT CURRENT_DATE,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_student_session_extension_requests" ("request_id" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "branch_id" INTEGER NOT NULL,
  "enrollment_id" INTEGER DEFAULT NULL,
  "requested_sessions" INTEGER NOT NULL DEFAULT 1,
  "requested_amount" decimal(10,2) NOT NULL DEFAULT 650.00,
  "preferred_day_of_week" VARCHAR(9) DEFAULT NULL,
  "preferred_start_time" time DEFAULT NULL,
  "preferred_end_time" time DEFAULT NULL,
  "payment_method" VARCHAR(13) NOT NULL DEFAULT 'Cash',
  "payment_proof_path" varchar(255) DEFAULT NULL,
  "notes" text DEFAULT NULL,
  "status" VARCHAR(8) NOT NULL DEFAULT 'Pending',
  "admin_notes" text DEFAULT NULL,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_student_song_assignments" ("assignment_id" INTEGER NOT NULL,
  "song_id" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "teacher_id" INTEGER NOT NULL,
  "enrollment_id" INTEGER DEFAULT NULL,
  "progress_status" VARCHAR(10) NOT NULL DEFAULT 'assigned',
  "assigned_notes" text DEFAULT NULL,
  "assigned_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_teachers" ("teacher_id" INTEGER NOT NULL,
  "user_id" INTEGER DEFAULT NULL,
  "branch_id" INTEGER NOT NULL,
  "first_name" varchar(50) NOT NULL,
  "last_name" varchar(50) NOT NULL,
  "email" varchar(100) DEFAULT NULL,
  "phone" varchar(20) DEFAULT NULL,
  "employment_type" VARCHAR(9) DEFAULT 'Full-time',
  "status" VARCHAR(8) DEFAULT 'Active',
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_teacher_availability" ("availability_id" INTEGER NOT NULL,
  "teacher_id" INTEGER NOT NULL,
  "branch_id" INTEGER NOT NULL,
  "day_of_week" VARCHAR(9) NOT NULL,
  "start_time" time NOT NULL,
  "end_time" time NOT NULL,
  "status" VARCHAR(11) DEFAULT 'Available',
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_teacher_grading_criteria" ("criterion_id" INTEGER NOT NULL,
  "teacher_id" INTEGER NOT NULL,
  "criterion_name" varchar(100) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(8) NOT NULL DEFAULT 'Active',
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tbl_teacher_specializations" ("teacher_id" INTEGER NOT NULL,
  "specialization_id" INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS "tbl_users" ("user_id" INTEGER NOT NULL,
  "username" varchar(50) NOT NULL,
  "password" varchar(255) NOT NULL,
  "must_change_password" INTEGER NOT NULL DEFAULT 0,
  "role_id" INTEGER NOT NULL,
  "branch_id" INTEGER DEFAULT NULL,
  "first_name" varchar(50) DEFAULT NULL,
  "last_name" varchar(50) DEFAULT NULL,
  "email" varchar(100) DEFAULT NULL,
  "phone" varchar(20) DEFAULT NULL,
  "status" VARCHAR(11) DEFAULT 'Active',
  "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  "account_locked_at" TIMESTAMP DEFAULT NULL,
  "account_locked_reason" varchar(255) DEFAULT NULL,
  "failed_login_last_at" TIMESTAMP DEFAULT NULL,
  "active_session_token" varchar(128) DEFAULT NULL,
  "active_session_updated_at" TIMESTAMP DEFAULT NULL,
  "active_browser_token_hash" varchar(255) DEFAULT NULL,
  "active_browser_token_updated_at" TIMESTAMP DEFAULT NULL,
  "email_verified_at" TIMESTAMP DEFAULT NULL,
  "email_verification_code_hash" varchar(255) DEFAULT NULL,
  "email_verification_code_expires_at" TIMESTAMP DEFAULT NULL,
  "email_verification_sent_at" TIMESTAMP DEFAULT NULL,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE OR REPLACE FUNCTION fas_touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := CURRENT_TIMESTAMP; RETURN NEW; END; $$;
CREATE TRIGGER "trg_uat_tbl_enrollment_schedule_slots" BEFORE UPDATE ON "tbl_enrollment_schedule_slots" FOR EACH ROW EXECUTE FUNCTION fas_touch_updated_at();
CREATE TRIGGER "trg_uat_tbl_featured_posts" BEFORE UPDATE ON "tbl_featured_posts" FOR EACH ROW EXECUTE FUNCTION fas_touch_updated_at();
CREATE TRIGGER "trg_uat_tbl_promotional_exams" BEFORE UPDATE ON "tbl_promotional_exams" FOR EACH ROW EXECUTE FUNCTION fas_touch_updated_at();
CREATE TRIGGER "trg_uat_tbl_schedule_operation_lookup" BEFORE UPDATE ON "tbl_schedule_operation_lookup" FOR EACH ROW EXECUTE FUNCTION fas_touch_updated_at();
CREATE TRIGGER "trg_uat_tbl_settings" BEFORE UPDATE ON "tbl_settings" FOR EACH ROW EXECUTE FUNCTION fas_touch_updated_at();
CREATE TRIGGER "trg_uat_tbl_song_library" BEFORE UPDATE ON "tbl_song_library" FOR EACH ROW EXECUTE FUNCTION fas_touch_updated_at();
CREATE TRIGGER "trg_uat_tbl_student_learning_levels" BEFORE UPDATE ON "tbl_student_learning_levels" FOR EACH ROW EXECUTE FUNCTION fas_touch_updated_at();
CREATE TRIGGER "trg_uat_tbl_student_progress" BEFORE UPDATE ON "tbl_student_progress" FOR EACH ROW EXECUTE FUNCTION fas_touch_updated_at();
CREATE TRIGGER "trg_uat_tbl_student_session_extension_requests" BEFORE UPDATE ON "tbl_student_session_extension_requests" FOR EACH ROW EXECUTE FUNCTION fas_touch_updated_at();
CREATE TRIGGER "trg_uat_tbl_student_song_assignments" BEFORE UPDATE ON "tbl_student_song_assignments" FOR EACH ROW EXECUTE FUNCTION fas_touch_updated_at();
CREATE TRIGGER "trg_uat_tbl_teacher_grading_criteria" BEFORE UPDATE ON "tbl_teacher_grading_criteria" FOR EACH ROW EXECUTE FUNCTION fas_touch_updated_at();
ALTER TABLE "tbl_attendance" ALTER COLUMN "attendance_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_audit_logs" ALTER COLUMN "log_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_branches" ALTER COLUMN "branch_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_enrollments" ALTER COLUMN "enrollment_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_enrollment_schedule_slots" ALTER COLUMN "slot_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_featured_posts" ALTER COLUMN "featured_post_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_freeze_payments" ALTER COLUMN "freeze_payment_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_guardians" ALTER COLUMN "guardian_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_guardian_absence_requests" ALTER COLUMN "request_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_instruments" ALTER COLUMN "instrument_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_instrument_types" ALTER COLUMN "type_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_makeup_sessions" ALTER COLUMN "makeup_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_payments" ALTER COLUMN "payment_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_payment_schedule" ALTER COLUMN "schedule_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_promotional_exams" ALTER COLUMN "exam_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_recitals" ALTER COLUMN "recital_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_recital_participants" ALTER COLUMN "participant_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_recurring_schedule" ALTER COLUMN "recurring_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_registration_payments" ALTER COLUMN "registration_payment_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_repairs" ALTER COLUMN "repair_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_roles" ALTER COLUMN "role_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_rooms" ALTER COLUMN "room_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_schedule" ALTER COLUMN "schedule_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_schedule_operation_lookup" ALTER COLUMN "operation_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_school_instruments" ALTER COLUMN "school_instrument_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_service_providers" ALTER COLUMN "service_provider_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_sessions" ALTER COLUMN "session_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_session_packages" ALTER COLUMN "package_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_settings" ALTER COLUMN "setting_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_song_lesson_history" ALTER COLUMN "history_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_song_library" ALTER COLUMN "song_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_specialization" ALTER COLUMN "specialization_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_students" ALTER COLUMN "student_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_student_certificates" ALTER COLUMN "certificate_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_student_guardians" ALTER COLUMN "student_guardian_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_student_instruments" ALTER COLUMN "student_instrument_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_student_learning_levels" ALTER COLUMN "learning_level_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_student_progress" ALTER COLUMN "progress_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_student_session_extension_requests" ALTER COLUMN "request_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_student_song_assignments" ALTER COLUMN "assignment_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_teachers" ALTER COLUMN "teacher_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_teacher_availability" ALTER COLUMN "availability_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_teacher_grading_criteria" ALTER COLUMN "criterion_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_users" ALTER COLUMN "user_id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "tbl_attendance" ADD PRIMARY KEY ("attendance_id");
ALTER TABLE "tbl_audit_logs" ADD PRIMARY KEY ("log_id");
ALTER TABLE "tbl_branches" ADD PRIMARY KEY ("branch_id");
ALTER TABLE "tbl_enrollments" ADD PRIMARY KEY ("enrollment_id");
ALTER TABLE "tbl_enrollment_schedule_slots" ADD PRIMARY KEY ("slot_id");
ALTER TABLE "tbl_featured_posts" ADD PRIMARY KEY ("featured_post_id");
ALTER TABLE "tbl_freeze_payments" ADD PRIMARY KEY ("freeze_payment_id");
ALTER TABLE "tbl_guardians" ADD PRIMARY KEY ("guardian_id");
ALTER TABLE "tbl_guardian_absence_requests" ADD PRIMARY KEY ("request_id");
ALTER TABLE "tbl_instruments" ADD PRIMARY KEY ("instrument_id");
ALTER TABLE "tbl_instrument_types" ADD PRIMARY KEY ("type_id");
ALTER TABLE "tbl_makeup_sessions" ADD PRIMARY KEY ("makeup_id");
ALTER TABLE "tbl_payments" ADD PRIMARY KEY ("payment_id");
ALTER TABLE "tbl_payment_schedule" ADD PRIMARY KEY ("schedule_id");
ALTER TABLE "tbl_promotional_exams" ADD PRIMARY KEY ("exam_id");
ALTER TABLE "tbl_recitals" ADD PRIMARY KEY ("recital_id");
ALTER TABLE "tbl_recital_participants" ADD PRIMARY KEY ("participant_id");
ALTER TABLE "tbl_recurring_schedule" ADD PRIMARY KEY ("recurring_id");
ALTER TABLE "tbl_registration_payments" ADD PRIMARY KEY ("registration_payment_id");
ALTER TABLE "tbl_repairs" ADD PRIMARY KEY ("repair_id");
ALTER TABLE "tbl_roles" ADD PRIMARY KEY ("role_id");
ALTER TABLE "tbl_rooms" ADD PRIMARY KEY ("room_id");
ALTER TABLE "tbl_schedule" ADD PRIMARY KEY ("schedule_id");
ALTER TABLE "tbl_schedule_operation_lookup" ADD PRIMARY KEY ("operation_id");
ALTER TABLE "tbl_school_instruments" ADD PRIMARY KEY ("school_instrument_id");
ALTER TABLE "tbl_service_providers" ADD PRIMARY KEY ("service_provider_id");
ALTER TABLE "tbl_sessions" ADD PRIMARY KEY ("session_id");
ALTER TABLE "tbl_session_packages" ADD PRIMARY KEY ("package_id");
ALTER TABLE "tbl_settings" ADD PRIMARY KEY ("setting_id");
ALTER TABLE "tbl_song_lesson_history" ADD PRIMARY KEY ("history_id");
ALTER TABLE "tbl_song_library" ADD PRIMARY KEY ("song_id");
ALTER TABLE "tbl_specialization" ADD PRIMARY KEY ("specialization_id");
ALTER TABLE "tbl_students" ADD PRIMARY KEY ("student_id");
ALTER TABLE "tbl_student_certificates" ADD PRIMARY KEY ("certificate_id");
ALTER TABLE "tbl_student_guardians" ADD PRIMARY KEY ("student_guardian_id");
ALTER TABLE "tbl_student_instruments" ADD PRIMARY KEY ("student_instrument_id");
ALTER TABLE "tbl_student_learning_levels" ADD PRIMARY KEY ("learning_level_id");
ALTER TABLE "tbl_student_progress" ADD PRIMARY KEY ("progress_id");
ALTER TABLE "tbl_student_session_extension_requests" ADD PRIMARY KEY ("request_id");
ALTER TABLE "tbl_student_song_assignments" ADD PRIMARY KEY ("assignment_id");
ALTER TABLE "tbl_teachers" ADD PRIMARY KEY ("teacher_id");
ALTER TABLE "tbl_teacher_availability" ADD PRIMARY KEY ("availability_id");
ALTER TABLE "tbl_teacher_grading_criteria" ADD PRIMARY KEY ("criterion_id");
ALTER TABLE "tbl_teacher_specializations" ADD PRIMARY KEY ("teacher_id","specialization_id");
ALTER TABLE "tbl_users" ADD PRIMARY KEY ("user_id");
CREATE INDEX IF NOT EXISTS "idx_attendance_student" ON "tbl_attendance" ("student_id");
CREATE INDEX IF NOT EXISTS "idx_attendance_date" ON "tbl_attendance" ("attended_at");
CREATE INDEX IF NOT EXISTS "idx_attendance_branch" ON "tbl_attendance" ("branch_id");
CREATE INDEX IF NOT EXISTS "idx_user_id" ON "tbl_audit_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_action" ON "tbl_audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "idx_created_at" ON "tbl_audit_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_module" ON "tbl_audit_logs" ("module");
CREATE INDEX IF NOT EXISTS "idx_audit_severity" ON "tbl_audit_logs" ("severity");
CREATE INDEX IF NOT EXISTS "package_id" ON "tbl_enrollments" ("package_id");
CREATE INDEX IF NOT EXISTS "idx_enrollments_student" ON "tbl_enrollments" ("student_id");
CREATE INDEX IF NOT EXISTS "idx_enrollments_status" ON "tbl_enrollments" ("status");
CREATE INDEX IF NOT EXISTS "fk_enroll_student_guardian" ON "tbl_enrollments" ("student_guardian_id");
CREATE INDEX IF NOT EXISTS "fk_enroll_instrument" ON "tbl_enrollments" ("instrument_id");
CREATE INDEX IF NOT EXISTS "idx_enrollment_schedule_slots_enrollment" ON "tbl_enrollment_schedule_slots" ("enrollment_id","status","sort_order");
CREATE INDEX IF NOT EXISTS "idx_enrollment_schedule_slots_teacher" ON "tbl_enrollment_schedule_slots" ("teacher_id","day_of_week","start_time","end_time");
CREATE INDEX IF NOT EXISTS "idx_featured_posts_status" ON "tbl_featured_posts" ("status");
CREATE INDEX IF NOT EXISTS "idx_featured_posts_branch" ON "tbl_featured_posts" ("branch_id");
CREATE INDEX IF NOT EXISTS "idx_featured_posts_published" ON "tbl_featured_posts" ("published_at");
CREATE INDEX IF NOT EXISTS "idx_fp_enrollment" ON "tbl_freeze_payments" ("enrollment_id");
CREATE INDEX IF NOT EXISTS "idx_fp_student" ON "tbl_freeze_payments" ("student_id");
CREATE INDEX IF NOT EXISTS "idx_fp_status" ON "tbl_freeze_payments" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_guardian_code" ON "tbl_guardians" ("guardian_code");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_guardian_user_id" ON "tbl_guardians" ("guardian_user_id");
CREATE INDEX IF NOT EXISTS "idx_guardian_absence_branch_status" ON "tbl_guardian_absence_requests" ("branch_id","status","session_date");
CREATE INDEX IF NOT EXISTS "idx_guardian_absence_guardian" ON "tbl_guardian_absence_requests" ("guardian_id","created_at");
CREATE INDEX IF NOT EXISTS "idx_guardian_absence_student_date" ON "tbl_guardian_absence_requests" ("student_id","session_date");
CREATE INDEX IF NOT EXISTS "branch_id" ON "tbl_instruments" ("branch_id");
CREATE INDEX IF NOT EXISTS "type_id" ON "tbl_instruments" ("type_id");
CREATE UNIQUE INDEX IF NOT EXISTS "type_name" ON "tbl_instrument_types" ("type_name");
CREATE INDEX IF NOT EXISTS "original_session_id" ON "tbl_makeup_sessions" ("original_session_id");
CREATE INDEX IF NOT EXISTS "makeup_session_id" ON "tbl_makeup_sessions" ("makeup_session_id");
CREATE INDEX IF NOT EXISTS "teacher_id" ON "tbl_makeup_sessions" ("teacher_id");
CREATE INDEX IF NOT EXISTS "idx_payments_enrollment" ON "tbl_payments" ("enrollment_id");
CREATE INDEX IF NOT EXISTS "idx_payments_date" ON "tbl_payments" ("payment_date");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_enrollment_session" ON "tbl_payment_schedule" ("enrollment_id","session_number");
CREATE INDEX IF NOT EXISTS "idx_promotional_exams_student" ON "tbl_promotional_exams" ("student_id");
CREATE INDEX IF NOT EXISTS "branch_id" ON "tbl_recitals" ("branch_id");
CREATE INDEX IF NOT EXISTS "teacher_id" ON "tbl_recitals" ("teacher_id");
CREATE INDEX IF NOT EXISTS "idx_recitals_date" ON "tbl_recitals" ("recital_date");
CREATE INDEX IF NOT EXISTS "recital_id" ON "tbl_recital_participants" ("recital_id");
CREATE INDEX IF NOT EXISTS "idx_recital_participant_type" ON "tbl_recital_participants" ("participant_type");
CREATE INDEX IF NOT EXISTS "student_id" ON "tbl_recital_participants" ("student_id");
CREATE INDEX IF NOT EXISTS "guardian_id" ON "tbl_recital_participants" ("guardian_id");
CREATE INDEX IF NOT EXISTS "instrument_id" ON "tbl_recital_participants" ("instrument_id");
CREATE INDEX IF NOT EXISTS "enrollment_id" ON "tbl_recurring_schedule" ("enrollment_id");
CREATE INDEX IF NOT EXISTS "teacher_id" ON "tbl_recurring_schedule" ("teacher_id");
CREATE INDEX IF NOT EXISTS "room_id" ON "tbl_recurring_schedule" ("room_id");
CREATE INDEX IF NOT EXISTS "fk_registration_student" ON "tbl_registration_payments" ("student_id");
CREATE INDEX IF NOT EXISTS "school_instrument_id" ON "tbl_repairs" ("school_instrument_id");
CREATE INDEX IF NOT EXISTS "service_provider_id" ON "tbl_repairs" ("service_provider_id");
CREATE UNIQUE INDEX IF NOT EXISTS "role_name" ON "tbl_roles" ("role_name");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_room_per_branch" ON "tbl_rooms" ("branch_id","room_name");
CREATE INDEX IF NOT EXISTS "enrollment_id" ON "tbl_schedule" ("enrollment_id");
CREATE INDEX IF NOT EXISTS "session_id" ON "tbl_schedule" ("session_id");
CREATE INDEX IF NOT EXISTS "idx_schedule_teacher_date" ON "tbl_schedule" ("teacher_id","schedule_date");
CREATE INDEX IF NOT EXISTS "idx_schedule_room_date" ON "tbl_schedule" ("room_id","schedule_date");
CREATE INDEX IF NOT EXISTS "idx_schedule_branch_date" ON "tbl_schedule" ("branch_id","schedule_date");
CREATE UNIQUE INDEX IF NOT EXISTS "operation_code" ON "tbl_schedule_operation_lookup" ("operation_code");
CREATE INDEX IF NOT EXISTS "branch_id" ON "tbl_school_instruments" ("branch_id");
CREATE INDEX IF NOT EXISTS "instrument_id" ON "tbl_school_instruments" ("instrument_id");
CREATE INDEX IF NOT EXISTS "teacher_id" ON "tbl_sessions" ("teacher_id");
CREATE INDEX IF NOT EXISTS "instrument_id" ON "tbl_sessions" ("instrument_id");
CREATE INDEX IF NOT EXISTS "school_instrument_id" ON "tbl_sessions" ("school_instrument_id");
CREATE INDEX IF NOT EXISTS "room_id" ON "tbl_sessions" ("room_id");
CREATE INDEX IF NOT EXISTS "idx_sessions_enrollment" ON "tbl_sessions" ("enrollment_id");
CREATE INDEX IF NOT EXISTS "idx_sessions_date" ON "tbl_sessions" ("session_date");
CREATE INDEX IF NOT EXISTS "idx_sessions_status" ON "tbl_sessions" ("status");
CREATE INDEX IF NOT EXISTS "idx_sessions_enrollment_number" ON "tbl_sessions" ("enrollment_id","session_number");
CREATE INDEX IF NOT EXISTS "idx_sessions_rescheduled_from" ON "tbl_sessions" ("rescheduled_from_session_id");
CREATE INDEX IF NOT EXISTS "idx_sessions_rescheduled_to" ON "tbl_sessions" ("rescheduled_to_session_id");
CREATE INDEX IF NOT EXISTS "idx_sessions_needs_rescheduling" ON "tbl_sessions" ("needs_rescheduling");
CREATE INDEX IF NOT EXISTS "idx_session_packages_branch" ON "tbl_session_packages" ("branch_id");
CREATE UNIQUE INDEX IF NOT EXISTS "setting_key" ON "tbl_settings" ("setting_key");
CREATE INDEX IF NOT EXISTS "updated_by" ON "tbl_settings" ("updated_by");
CREATE INDEX IF NOT EXISTS "idx_song_history_assignment" ON "tbl_song_lesson_history" ("assignment_id");
CREATE INDEX IF NOT EXISTS "idx_song_library_teacher" ON "tbl_song_library" ("teacher_id");
CREATE INDEX IF NOT EXISTS "idx_song_library_category" ON "tbl_song_library" ("category");
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_specialization_name" ON "tbl_specialization" ("specialization_name");
CREATE INDEX IF NOT EXISTS "idx_spec_type_id" ON "tbl_specialization" ("type_id");
CREATE UNIQUE INDEX IF NOT EXISTS "email" ON "tbl_students" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_student_code" ON "tbl_students" ("student_code");
CREATE INDEX IF NOT EXISTS "idx_students_branch" ON "tbl_students" ("branch_id");
CREATE INDEX IF NOT EXISTS "idx_students_status" ON "tbl_students" ("status");
CREATE INDEX IF NOT EXISTS "idx_students_session_package" ON "tbl_students" ("session_package_id");
CREATE INDEX IF NOT EXISTS "fk_student_user" ON "tbl_students" ("student_user_id");
CREATE INDEX IF NOT EXISTS "idx_student_certificates_student" ON "tbl_student_certificates" ("student_id");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_student_guardian" ON "tbl_student_guardians" ("student_id","guardian_id");
CREATE INDEX IF NOT EXISTS "guardian_id" ON "tbl_student_guardians" ("guardian_id");
CREATE INDEX IF NOT EXISTS "fk_sg_guardian_user" ON "tbl_student_guardians" ("guardian_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_student_instrument" ON "tbl_student_instruments" ("student_id","instrument_id");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_student_priority" ON "tbl_student_instruments" ("student_id","priority_order");
CREATE INDEX IF NOT EXISTS "idx_student_instruments_student" ON "tbl_student_instruments" ("student_id");
CREATE INDEX IF NOT EXISTS "idx_student_instruments_instrument" ON "tbl_student_instruments" ("instrument_id");
CREATE INDEX IF NOT EXISTS "idx_learning_levels_student_instrument" ON "tbl_student_learning_levels" ("student_id","instrument_id","status");
CREATE INDEX IF NOT EXISTS "student_id" ON "tbl_student_progress" ("student_id");
CREATE INDEX IF NOT EXISTS "session_id" ON "tbl_student_progress" ("session_id");
CREATE INDEX IF NOT EXISTS "instrument_id" ON "tbl_student_progress" ("instrument_id");
CREATE INDEX IF NOT EXISTS "idx_student_progress_session" ON "tbl_student_progress" ("session_id");
CREATE INDEX IF NOT EXISTS "idx_student_progress_student" ON "tbl_student_progress" ("student_id");
CREATE INDEX IF NOT EXISTS "idx_student_session_extension_requests_student" ON "tbl_student_session_extension_requests" ("student_id");
CREATE INDEX IF NOT EXISTS "idx_student_session_extension_requests_status" ON "tbl_student_session_extension_requests" ("status");
CREATE INDEX IF NOT EXISTS "idx_student_session_extension_requests_created" ON "tbl_student_session_extension_requests" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_song_assignments_teacher" ON "tbl_student_song_assignments" ("teacher_id");
CREATE INDEX IF NOT EXISTS "idx_song_assignments_student" ON "tbl_student_song_assignments" ("student_id");
CREATE INDEX IF NOT EXISTS "idx_song_assignments_song" ON "tbl_student_song_assignments" ("song_id");
CREATE INDEX IF NOT EXISTS "user_id" ON "tbl_teachers" ("user_id");
CREATE INDEX IF NOT EXISTS "branch_id" ON "tbl_teachers" ("branch_id");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_teacher_day_timeslot" ON "tbl_teacher_availability" ("teacher_id","day_of_week","start_time","end_time");
CREATE INDEX IF NOT EXISTS "branch_id" ON "tbl_teacher_availability" ("branch_id");
CREATE INDEX IF NOT EXISTS "idx_teacher_availability" ON "tbl_teacher_availability" ("teacher_id","day_of_week");
CREATE INDEX IF NOT EXISTS "idx_teacher_grading_criteria" ON "tbl_teacher_grading_criteria" ("teacher_id","status","sort_order");
CREATE INDEX IF NOT EXISTS "idx_tts_specialization" ON "tbl_teacher_specializations" ("specialization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "username" ON "tbl_users" ("username");
CREATE INDEX IF NOT EXISTS "role_id" ON "tbl_users" ("role_id");
ALTER TABLE "tbl_enrollments" ADD CONSTRAINT "fk_enroll_instrument" FOREIGN KEY ("instrument_id") REFERENCES "tbl_instruments" ("instrument_id");
ALTER TABLE "tbl_enrollments" ADD CONSTRAINT "fk_enroll_student_guardian" FOREIGN KEY ("student_guardian_id") REFERENCES "tbl_student_guardians" ("student_guardian_id");
ALTER TABLE "tbl_enrollments" ADD CONSTRAINT "fk_enrollment_session_package" FOREIGN KEY ("package_id") REFERENCES "tbl_session_packages" ("package_id");
ALTER TABLE "tbl_enrollments" ADD CONSTRAINT "tbl_enrollments_ibfk_1" FOREIGN KEY ("student_id") REFERENCES "tbl_students" ("student_id");
ALTER TABLE "tbl_guardians" ADD CONSTRAINT "fk_guardian_user" FOREIGN KEY ("guardian_user_id") REFERENCES "tbl_users" ("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tbl_instruments" ADD CONSTRAINT "tbl_instruments_ibfk_1" FOREIGN KEY ("branch_id") REFERENCES "tbl_branches" ("branch_id");
ALTER TABLE "tbl_instruments" ADD CONSTRAINT "tbl_instruments_ibfk_2" FOREIGN KEY ("type_id") REFERENCES "tbl_instrument_types" ("type_id");
ALTER TABLE "tbl_makeup_sessions" ADD CONSTRAINT "tbl_makeup_sessions_ibfk_1" FOREIGN KEY ("original_session_id") REFERENCES "tbl_sessions" ("session_id");
ALTER TABLE "tbl_makeup_sessions" ADD CONSTRAINT "tbl_makeup_sessions_ibfk_2" FOREIGN KEY ("makeup_session_id") REFERENCES "tbl_sessions" ("session_id");
ALTER TABLE "tbl_makeup_sessions" ADD CONSTRAINT "tbl_makeup_sessions_ibfk_3" FOREIGN KEY ("teacher_id") REFERENCES "tbl_teachers" ("teacher_id");
ALTER TABLE "tbl_payments" ADD CONSTRAINT "fk_payments_enrollment" FOREIGN KEY ("enrollment_id") REFERENCES "tbl_enrollments" ("enrollment_id") ON DELETE CASCADE;
ALTER TABLE "tbl_payment_schedule" ADD CONSTRAINT "fk_payment_schedule_enrollment" FOREIGN KEY ("enrollment_id") REFERENCES "tbl_enrollments" ("enrollment_id") ON DELETE CASCADE;
ALTER TABLE "tbl_recitals" ADD CONSTRAINT "tbl_recitals_ibfk_1" FOREIGN KEY ("branch_id") REFERENCES "tbl_branches" ("branch_id");
ALTER TABLE "tbl_recitals" ADD CONSTRAINT "tbl_recitals_ibfk_2" FOREIGN KEY ("teacher_id") REFERENCES "tbl_teachers" ("teacher_id") ON DELETE SET NULL;
ALTER TABLE "tbl_recital_participants" ADD CONSTRAINT "tbl_recital_participants_ibfk_1" FOREIGN KEY ("recital_id") REFERENCES "tbl_recitals" ("recital_id") ON DELETE CASCADE;
ALTER TABLE "tbl_recital_participants" ADD CONSTRAINT "tbl_recital_participants_ibfk_2" FOREIGN KEY ("student_id") REFERENCES "tbl_students" ("student_id") ON DELETE SET NULL;
ALTER TABLE "tbl_recital_participants" ADD CONSTRAINT "tbl_recital_participants_ibfk_3" FOREIGN KEY ("guardian_id") REFERENCES "tbl_guardians" ("guardian_id") ON DELETE SET NULL;
ALTER TABLE "tbl_recital_participants" ADD CONSTRAINT "tbl_recital_participants_ibfk_4" FOREIGN KEY ("instrument_id") REFERENCES "tbl_instruments" ("instrument_id") ON DELETE SET NULL;
ALTER TABLE "tbl_recurring_schedule" ADD CONSTRAINT "tbl_recurring_schedule_ibfk_1" FOREIGN KEY ("enrollment_id") REFERENCES "tbl_enrollments" ("enrollment_id");
ALTER TABLE "tbl_recurring_schedule" ADD CONSTRAINT "tbl_recurring_schedule_ibfk_2" FOREIGN KEY ("teacher_id") REFERENCES "tbl_teachers" ("teacher_id");
ALTER TABLE "tbl_recurring_schedule" ADD CONSTRAINT "tbl_recurring_schedule_ibfk_3" FOREIGN KEY ("room_id") REFERENCES "tbl_rooms" ("room_id");
ALTER TABLE "tbl_registration_payments" ADD CONSTRAINT "fk_registration_student" FOREIGN KEY ("student_id") REFERENCES "tbl_students" ("student_id") ON DELETE CASCADE;
ALTER TABLE "tbl_repairs" ADD CONSTRAINT "tbl_repairs_ibfk_1" FOREIGN KEY ("school_instrument_id") REFERENCES "tbl_school_instruments" ("school_instrument_id");
ALTER TABLE "tbl_repairs" ADD CONSTRAINT "tbl_repairs_ibfk_2" FOREIGN KEY ("service_provider_id") REFERENCES "tbl_service_providers" ("service_provider_id");
ALTER TABLE "tbl_rooms" ADD CONSTRAINT "tbl_rooms_ibfk_1" FOREIGN KEY ("branch_id") REFERENCES "tbl_branches" ("branch_id");
ALTER TABLE "tbl_schedule" ADD CONSTRAINT "tbl_schedule_ibfk_1" FOREIGN KEY ("branch_id") REFERENCES "tbl_branches" ("branch_id");
ALTER TABLE "tbl_schedule" ADD CONSTRAINT "tbl_schedule_ibfk_2" FOREIGN KEY ("teacher_id") REFERENCES "tbl_teachers" ("teacher_id");
ALTER TABLE "tbl_schedule" ADD CONSTRAINT "tbl_schedule_ibfk_3" FOREIGN KEY ("room_id") REFERENCES "tbl_rooms" ("room_id");
ALTER TABLE "tbl_schedule" ADD CONSTRAINT "tbl_schedule_ibfk_4" FOREIGN KEY ("enrollment_id") REFERENCES "tbl_enrollments" ("enrollment_id");
ALTER TABLE "tbl_schedule" ADD CONSTRAINT "tbl_schedule_ibfk_5" FOREIGN KEY ("session_id") REFERENCES "tbl_sessions" ("session_id");
ALTER TABLE "tbl_school_instruments" ADD CONSTRAINT "tbl_school_instruments_ibfk_1" FOREIGN KEY ("branch_id") REFERENCES "tbl_branches" ("branch_id");
ALTER TABLE "tbl_school_instruments" ADD CONSTRAINT "tbl_school_instruments_ibfk_2" FOREIGN KEY ("instrument_id") REFERENCES "tbl_instruments" ("instrument_id");
ALTER TABLE "tbl_sessions" ADD CONSTRAINT "fk_sessions_enrollment" FOREIGN KEY ("enrollment_id") REFERENCES "tbl_enrollments" ("enrollment_id") ON DELETE CASCADE;
ALTER TABLE "tbl_sessions" ADD CONSTRAINT "fk_sessions_room" FOREIGN KEY ("room_id") REFERENCES "tbl_rooms" ("room_id") ON DELETE SET NULL;
ALTER TABLE "tbl_sessions" ADD CONSTRAINT "tbl_sessions_ibfk_2" FOREIGN KEY ("teacher_id") REFERENCES "tbl_teachers" ("teacher_id");
ALTER TABLE "tbl_sessions" ADD CONSTRAINT "tbl_sessions_ibfk_3" FOREIGN KEY ("instrument_id") REFERENCES "tbl_instruments" ("instrument_id");
ALTER TABLE "tbl_sessions" ADD CONSTRAINT "tbl_sessions_ibfk_4" FOREIGN KEY ("school_instrument_id") REFERENCES "tbl_school_instruments" ("school_instrument_id");
ALTER TABLE "tbl_settings" ADD CONSTRAINT "tbl_settings_ibfk_1" FOREIGN KEY ("updated_by") REFERENCES "tbl_users" ("user_id") ON DELETE SET NULL;
ALTER TABLE "tbl_students" ADD CONSTRAINT "fk_student_user" FOREIGN KEY ("student_user_id") REFERENCES "tbl_users" ("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tbl_students" ADD CONSTRAINT "fk_students_session_package" FOREIGN KEY ("session_package_id") REFERENCES "tbl_session_packages" ("package_id") ON DELETE SET NULL;
ALTER TABLE "tbl_students" ADD CONSTRAINT "tbl_students_ibfk_1" FOREIGN KEY ("branch_id") REFERENCES "tbl_branches" ("branch_id");
ALTER TABLE "tbl_student_guardians" ADD CONSTRAINT "fk_sg_guardian_user" FOREIGN KEY ("guardian_user_id") REFERENCES "tbl_users" ("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tbl_student_guardians" ADD CONSTRAINT "tbl_student_guardians_ibfk_1" FOREIGN KEY ("student_id") REFERENCES "tbl_students" ("student_id") ON DELETE CASCADE;
ALTER TABLE "tbl_student_guardians" ADD CONSTRAINT "tbl_student_guardians_ibfk_2" FOREIGN KEY ("guardian_id") REFERENCES "tbl_guardians" ("guardian_id") ON DELETE CASCADE;
ALTER TABLE "tbl_student_instruments" ADD CONSTRAINT "fk_student_instruments_instrument" FOREIGN KEY ("instrument_id") REFERENCES "tbl_instruments" ("instrument_id") ON DELETE CASCADE;
ALTER TABLE "tbl_student_instruments" ADD CONSTRAINT "fk_student_instruments_student" FOREIGN KEY ("student_id") REFERENCES "tbl_students" ("student_id") ON DELETE CASCADE;
ALTER TABLE "tbl_student_progress" ADD CONSTRAINT "tbl_student_progress_ibfk_1" FOREIGN KEY ("student_id") REFERENCES "tbl_students" ("student_id");
ALTER TABLE "tbl_student_progress" ADD CONSTRAINT "tbl_student_progress_ibfk_2" FOREIGN KEY ("session_id") REFERENCES "tbl_sessions" ("session_id");
ALTER TABLE "tbl_student_progress" ADD CONSTRAINT "tbl_student_progress_ibfk_3" FOREIGN KEY ("instrument_id") REFERENCES "tbl_instruments" ("instrument_id");
ALTER TABLE "tbl_teachers" ADD CONSTRAINT "tbl_teachers_ibfk_1" FOREIGN KEY ("user_id") REFERENCES "tbl_users" ("user_id") ON DELETE SET NULL;
ALTER TABLE "tbl_teachers" ADD CONSTRAINT "tbl_teachers_ibfk_2" FOREIGN KEY ("branch_id") REFERENCES "tbl_branches" ("branch_id");
ALTER TABLE "tbl_teacher_availability" ADD CONSTRAINT "tbl_teacher_availability_ibfk_1" FOREIGN KEY ("teacher_id") REFERENCES "tbl_teachers" ("teacher_id") ON DELETE CASCADE;
ALTER TABLE "tbl_teacher_availability" ADD CONSTRAINT "tbl_teacher_availability_ibfk_2" FOREIGN KEY ("branch_id") REFERENCES "tbl_branches" ("branch_id");
ALTER TABLE "tbl_teacher_specializations" ADD CONSTRAINT "tbl_teacher_specializations_ibfk_1" FOREIGN KEY ("teacher_id") REFERENCES "tbl_teachers" ("teacher_id") ON DELETE CASCADE;
ALTER TABLE "tbl_teacher_specializations" ADD CONSTRAINT "tbl_teacher_specializations_ibfk_2" FOREIGN KEY ("specialization_id") REFERENCES "tbl_specialization" ("specialization_id");
ALTER TABLE "tbl_users" ADD CONSTRAINT "tbl_users_ibfk_1" FOREIGN KEY ("role_id") REFERENCES "tbl_roles" ("role_id");
