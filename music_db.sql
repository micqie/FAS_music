-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Apr 19, 2026 at 12:18 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `music_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `tbl_attendance`
--

CREATE TABLE `tbl_attendance` (
  `attendance_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `branch_id` int(11) DEFAULT NULL,
  `attended_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` enum('Present','Absent','Late','Excused') NOT NULL DEFAULT 'Present',
  `source` varchar(30) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_attendance`
--

INSERT INTO `tbl_attendance` (`attendance_id`, `student_id`, `branch_id`, `attended_at`, `status`, `source`, `notes`) VALUES
(1, 4, 6, '2026-03-28 13:44:18', 'Present', 'QR', NULL),
(2, 1, 6, '2026-03-28 13:46:54', 'Present', 'Manual', NULL),
(3, 4, 6, '2026-03-29 01:22:52', 'Present', 'Manual', NULL),
(4, 9, 5, '2026-03-29 01:27:09', 'Present', 'Manual', NULL),
(6, 10, 6, '2026-03-29 03:55:14', 'Present', 'QR', NULL),
(7, 1, 6, '2026-03-29 03:59:03', 'Present', 'Manual', NULL),
(8, 10, 6, '2026-04-07 06:00:31', 'Present', 'Manual', NULL),
(9, 4, 6, '2026-04-07 22:47:10', 'Present', 'Manual', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `tbl_branches`
--

CREATE TABLE `tbl_branches` (
  `branch_id` int(11) NOT NULL,
  `branch_name` varchar(100) NOT NULL,
  `address` text DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_branches`
--

INSERT INTO `tbl_branches` (`branch_id`, `branch_name`, `address`, `phone`, `email`, `status`, `created_at`) VALUES
(5, 'SM Downtown', 'CDO', '0909090909', 'smdt@gmail.com', 'Active', '2026-02-21 00:18:58'),
(6, 'SM Uptown', 'CDO', '0192092019', 'smupt@gmail.com', 'Active', '2026-02-21 00:19:18');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_enrollments`
--

CREATE TABLE `tbl_enrollments` (
  `enrollment_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `package_id` int(11) NOT NULL,
  `instrument_id` int(11) DEFAULT NULL,
  `assigned_teacher_id` int(11) DEFAULT NULL,
  `fixed_day_of_week` enum('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') DEFAULT NULL,
  `fixed_start_time` time DEFAULT NULL,
  `fixed_end_time` time DEFAULT NULL,
  `fixed_room_id` int(11) DEFAULT NULL,
  `preferred_schedule` text DEFAULT NULL,
  `request_notes` text DEFAULT NULL,
  `enrollment_date` date DEFAULT curdate(),
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `status` enum('Pending','Active','Completed','Cancelled','Expired') DEFAULT 'Pending',
  `schedule_status` enum('Active','Frozen','Ended') NOT NULL DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `enrolled_by_type` enum('Self','Guardian') NOT NULL DEFAULT 'Self',
  `student_guardian_id` int(11) DEFAULT NULL,
  `total_sessions` int(11) NOT NULL,
  `allowed_absences` int(11) NOT NULL DEFAULT 0,
  `used_absences` int(11) NOT NULL DEFAULT 0,
  `consecutive_absences` int(11) NOT NULL DEFAULT 0,
  `auto_generated_until` date DEFAULT NULL,
  `fixed_schedule_locked` tinyint(1) NOT NULL DEFAULT 1,
  `completed_sessions` int(11) NOT NULL DEFAULT 0,
  `payment_type` enum('Full Payment','Partial Payment','Installment') NOT NULL DEFAULT 'Partial Payment',
  `current_operation_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_enrollments`
--

INSERT INTO `tbl_enrollments` (`enrollment_id`, `student_id`, `package_id`, `instrument_id`, `assigned_teacher_id`, `fixed_day_of_week`, `fixed_start_time`, `fixed_end_time`, `fixed_room_id`, `preferred_schedule`, `request_notes`, `enrollment_date`, `start_date`, `end_date`, `status`, `schedule_status`, `created_at`, `enrolled_by_type`, `student_guardian_id`, `total_sessions`, `allowed_absences`, `used_absences`, `consecutive_absences`, `auto_generated_until`, `fixed_schedule_locked`, `completed_sessions`, `payment_type`, `current_operation_id`) VALUES
(1, 1, 14, 14, 1, NULL, NULL, NULL, NULL, 'Tuesday 17:00-18:00', '{\"payment_type\":\"Partial Payment\",\"instrument_ids\":[14],\"payment_proof_path\":\"uploads\\/payment_proofs\\/package_requests\\/20260328033951_8a97c41058c3cfe8.png\",\"admin_notes\":\"n\\/a\"}', '2026-03-28', '2026-03-31', '2026-06-16', 'Active', 'Active', '2026-03-28 02:39:51', 'Self', NULL, 12, 0, 0, 0, NULL, 1, 0, 'Partial Payment', NULL),
(2, 4, 14, 13, 2, NULL, NULL, NULL, NULL, 'Sunday 10:00-11:00', '{\"payment_type\":\"Partial Payment\",\"instrument_ids\":[13],\"payment_proof_path\":\"uploads\\/payment_proofs\\/package_requests\\/20260328141503_ec20727edbd376ed.png\",\"admin_notes\":\"1 hour session\"}', '2026-03-28', '2026-03-29', '2026-06-14', 'Active', 'Active', '2026-03-28 13:15:03', 'Self', NULL, 12, 0, 0, 0, NULL, 1, 0, 'Partial Payment', NULL),
(3, 6, 13, 9, NULL, NULL, NULL, NULL, NULL, 'Monday|2026-03-30', '{\"payment_type\":\"Full Payment\",\"instrument_ids\":[9],\"payment_proof_path\":null}', '2026-03-28', NULL, NULL, 'Pending', 'Active', '2026-03-28 14:49:21', 'Self', NULL, 12, 0, 0, 0, NULL, 1, 0, 'Partial Payment', NULL),
(4, 7, 12, 11, 7, NULL, NULL, NULL, NULL, 'Tuesday 08:00-09:00', '{\"payment_type\":\"Full Payment\",\"instrument_ids\":[11,9],\"payment_proof_path\":null,\"admin_notes\":\"test for walkin enrollment\"}', '2026-03-28', '2026-03-31', '2026-08-11', 'Active', 'Active', '2026-03-28 15:05:17', 'Self', NULL, 20, 0, 0, 0, NULL, 1, 0, 'Partial Payment', NULL),
(5, 8, 13, 11, 7, NULL, NULL, NULL, NULL, 'Tuesday 13:00-14:00', '{\"payment_type\":\"Full Payment\",\"instrument_ids\":[11],\"payment_proof_path\":null,\"admin_notes\":\"test for walkin enrollment\"}', '2026-03-28', '2026-03-31', '2026-06-16', 'Active', 'Active', '2026-03-28 15:52:27', 'Self', NULL, 12, 0, 0, 0, NULL, 1, 0, 'Partial Payment', NULL),
(6, 9, 13, 11, 7, NULL, NULL, NULL, NULL, 'Tuesday 14:00-15:00', '{\"payment_type\":\"Full Payment\",\"instrument_ids\":[11],\"payment_proof_path\":null,\"admin_notes\":\"test2 for walkin\"}', '2026-03-29', '2026-03-31', '2026-06-16', 'Active', 'Active', '2026-03-28 16:11:49', 'Self', NULL, 12, 0, 0, 0, NULL, 1, 0, 'Partial Payment', NULL),
(7, 10, 14, 14, 1, NULL, NULL, NULL, NULL, 'Tuesday 10:00-11:00', '{\"payment_type\":\"Partial Payment\",\"payment_method\":\"GCash\",\"payable_now\":3000,\"package_total_amount\":7450,\"instrument_ids\":[14],\"payment_proof_path\":\"uploads\\/payment_proofs\\/package_requests\\/20260329044537_cc02c7935cb1bd87.png\",\"admin_notes\":\"test for online session\"}', '2026-03-29', '2026-03-31', '2026-06-16', 'Active', 'Active', '2026-03-29 02:45:37', 'Self', NULL, 12, 0, 0, 0, NULL, 1, 0, 'Partial Payment', NULL),
(8, 12, 13, 10, 2, NULL, NULL, NULL, NULL, 'Thursday 15:00-16:00', '{\"payment_type\":\"Installment\",\"payment_method\":\"Cash\",\"payable_now\":621,\"package_total_amount\":7450,\"instrument_ids\":[10],\"payment_proof_path\":\"\",\"admin_notes\":\"test for walkin downtown\"}', '2026-03-29', '2026-04-02', '2026-06-18', 'Active', 'Active', '2026-03-29 04:09:57', 'Self', NULL, 12, 0, 0, 0, NULL, 1, 0, 'Installment', NULL),
(9, 13, 13, 10, 9, 'Friday', '09:00:00', '10:00:00', 10, 'Friday 09:00:00-10:00:00 | Friday 13:00:00-14:00:00', '{\"payment_type\":\"Installment\",\"payment_method\":\"Cash\",\"payable_now\":621,\"package_total_amount\":7450,\"instrument_ids\":[10],\"payment_proof_path\":\"uploads\\/payment_proofs\\/package_requests\\/20260417102140_2787fbf6e7dce8fe.jpg\",\"admin_notes\":\"TEST\"}', '2026-04-17', '2026-05-01', '2026-06-12', 'Active', 'Active', '2026-04-17 08:21:40', 'Self', NULL, 12, 2, 0, 0, '2026-06-05', 1, 0, 'Installment', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `tbl_enrollment_schedule_slots`
--

CREATE TABLE `tbl_enrollment_schedule_slots` (
  `slot_id` int(11) NOT NULL,
  `enrollment_id` int(11) NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `day_of_week` enum('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `room_id` int(11) DEFAULT NULL,
  `room_name` varchar(100) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 1,
  `status` enum('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_enrollment_schedule_slots`
--

INSERT INTO `tbl_enrollment_schedule_slots` (`slot_id`, `enrollment_id`, `teacher_id`, `day_of_week`, `start_time`, `end_time`, `room_id`, `room_name`, `sort_order`, `status`, `created_at`, `updated_at`) VALUES
(1, 9, 9, 'Friday', '09:00:00', '10:00:00', 10, 'Room 1', 1, 'Active', '2026-04-18 06:45:01', '2026-04-18 06:45:01'),
(2, 9, 9, 'Friday', '13:00:00', '14:00:00', 10, 'Room 1', 2, 'Active', '2026-04-18 06:45:01', '2026-04-18 06:45:01');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_guardians`
--

CREATE TABLE `tbl_guardians` (
  `guardian_id` int(11) NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `relationship_type` enum('Father','Mother','Legal Guardian','Other') NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `occupation` varchar(50) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_guardians`
--

INSERT INTO `tbl_guardians` (`guardian_id`, `first_name`, `last_name`, `relationship_type`, `phone`, `occupation`, `email`, `address`, `status`, `created_at`) VALUES
(1, 'Jonah', 'Lago', 'Mother', '09079090', NULL, 'jonah@gmail.com', NULL, 'Active', '2026-03-28 02:04:13'),
(2, 'Oliver', 'Garcia', 'Father', '096483472', NULL, 'oliver@gmail.com', NULL, 'Active', '2026-03-29 02:20:36');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_instruments`
--

CREATE TABLE `tbl_instruments` (
  `instrument_id` int(11) NOT NULL,
  `branch_id` int(11) NOT NULL,
  `instrument_name` varchar(100) NOT NULL,
  `type_id` int(11) NOT NULL,
  `serial_number` varchar(50) DEFAULT NULL,
  `condition` enum('Excellent','Good','Fair','Poor') DEFAULT 'Good',
  `status` enum('Available','In Use','Under Repair','Inactive') DEFAULT 'Available'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_instruments`
--

INSERT INTO `tbl_instruments` (`instrument_id`, `branch_id`, `instrument_name`, `type_id`, `serial_number`, `condition`, `status`) VALUES
(9, 5, 'Kawai K-200 Piano', 23, 'P-5001', 'Good', 'Available'),
(10, 5, 'Taylor Acoustic Guitar', 24, 'G-5001', 'Good', 'Available'),
(11, 5, 'Yamaha Violin V5', 28, 'V-5001', 'Good', 'Available'),
(12, 6, 'Roland FP-30X', 23, 'P-6001', 'Excellent', 'Available'),
(13, 6, 'Ibanez RG421', 24, 'G-6001', 'Good', 'Available'),
(14, 6, 'Mapex Drum Kit', 29, 'D-6001', 'Good', 'Available');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_instrument_types`
--

CREATE TABLE `tbl_instrument_types` (
  `type_id` int(11) NOT NULL,
  `type_name` varchar(50) NOT NULL,
  `description` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_instrument_types`
--

INSERT INTO `tbl_instrument_types` (`type_id`, `type_name`, `description`) VALUES
(1, 'Other', 'General/uncategorized instrument type'),
(23, 'Piano', 'keyboard'),
(24, 'Guitar', 'Acoustic and electric guitar'),
(28, 'Violin', 'Bow string instrument'),
(29, 'Drums', 'Drum set and percussion'),
(30, 'Voice', 'Vocal training'),
(31, 'Ukulele', 'Four-string instrument');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_makeup_sessions`
--

CREATE TABLE `tbl_makeup_sessions` (
  `makeup_id` int(11) NOT NULL,
  `original_session_id` int(11) NOT NULL,
  `makeup_session_id` int(11) DEFAULT NULL,
  `teacher_id` int(11) NOT NULL,
  `status` enum('Scheduled','Completed','Cancelled','Expired') DEFAULT 'Scheduled',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tbl_payments`
--

CREATE TABLE `tbl_payments` (
  `payment_id` int(11) NOT NULL,
  `enrollment_id` int(11) NOT NULL,
  `payment_date` date DEFAULT curdate(),
  `amount` decimal(10,2) NOT NULL,
  `payment_method` enum('Cash','Card','Bank Transfer','GCash','Check','Other') NOT NULL,
  `payment_type` enum('Full Payment','Partial Payment','Installment') DEFAULT 'Partial Payment',
  `status` enum('Pending','Paid','Failed','Refunded') DEFAULT 'Pending',
  `receipt_number` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_payments`
--

INSERT INTO `tbl_payments` (`payment_id`, `enrollment_id`, `payment_date`, `amount`, `payment_method`, `payment_type`, `status`, `receipt_number`, `notes`, `created_at`) VALUES
(1, 7, '2026-03-29', 3000.00, 'GCash', 'Partial Payment', 'Paid', 'ENR-7-1774754237', NULL, '2026-03-29 03:17:17'),
(2, 8, '2026-03-29', 621.00, 'Cash', 'Installment', 'Paid', 'ENR-8-1774757894', NULL, '2026-03-29 04:18:14'),
(3, 8, '2026-03-29', 621.00, 'Cash', 'Installment', 'Paid', 'ENR-8-1774758170', NULL, '2026-03-29 04:22:50'),
(4, 9, '2026-04-18', 621.00, 'Cash', 'Installment', 'Paid', 'ENR-9-1776494701', NULL, '2026-04-18 06:45:01');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_payment_schedule`
--

CREATE TABLE `tbl_payment_schedule` (
  `schedule_id` int(11) NOT NULL,
  `enrollment_id` int(11) NOT NULL,
  `session_number` int(11) NOT NULL,
  `required_amount` decimal(10,2) NOT NULL,
  `paid_amount` decimal(10,2) DEFAULT 0.00,
  `deadline_date` date DEFAULT NULL,
  `status` enum('Pending','Partial','Paid','Overdue') DEFAULT 'Pending'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tbl_recitals`
--

CREATE TABLE `tbl_recitals` (
  `recital_id` int(11) NOT NULL,
  `branch_id` int(11) NOT NULL,
  `teacher_id` int(11) DEFAULT NULL,
  `recital_name` varchar(100) NOT NULL,
  `recital_date` date NOT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `venue` varchar(100) DEFAULT NULL,
  `max_audience_capacity` int(11) DEFAULT NULL,
  `status` enum('Scheduled','Completed','Cancelled','Postponed') DEFAULT 'Scheduled',
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tbl_recital_participants`
--

CREATE TABLE `tbl_recital_participants` (
  `participant_id` int(11) NOT NULL,
  `recital_id` int(11) NOT NULL,
  `participant_type` enum('Performer','Audience','Other') NOT NULL DEFAULT 'Performer',
  `student_id` int(11) DEFAULT NULL,
  `guardian_id` int(11) DEFAULT NULL,
  `participant_name` varchar(120) DEFAULT NULL,
  `instrument_id` int(11) DEFAULT NULL,
  `number_of_guests` int(11) DEFAULT 1,
  `performance_order` int(11) DEFAULT NULL,
  `performance_time` time DEFAULT NULL,
  `piece_name` varchar(200) DEFAULT NULL,
  `confirmed` enum('Y','N') DEFAULT 'N',
  `confirmed_at` timestamp NULL DEFAULT NULL,
  `evaluation_notes` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `status` enum('Confirmed','Cancelled') DEFAULT 'Confirmed'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tbl_recurring_schedule`
--

CREATE TABLE `tbl_recurring_schedule` (
  `recurring_id` int(11) NOT NULL,
  `enrollment_id` int(11) NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `room_id` int(11) NOT NULL,
  `day_of_week` enum('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `status` enum('Active','Stopped') DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tbl_registration_payments`
--

CREATE TABLE `tbl_registration_payments` (
  `registration_payment_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `payment_date` date DEFAULT curdate(),
  `amount` decimal(10,2) NOT NULL,
  `payment_method` enum('Cash','Card','Bank Transfer','GCash','Check','Other') NOT NULL,
  `status` enum('Paid','Pending','Failed','Refunded') DEFAULT 'Pending',
  `receipt_number` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_registration_payments`
--

INSERT INTO `tbl_registration_payments` (`registration_payment_id`, `student_id`, `payment_date`, `amount`, `payment_method`, `status`, `receipt_number`) VALUES
(1, 1, '2026-03-28', 1000.00, 'Cash', 'Paid', 'REG-PROOF-1774663453'),
(2, 4, '2026-03-28', 1000.00, 'GCash', 'Paid', 'REG-PROOF-1774703433'),
(3, 5, '2026-03-28', 1000.00, 'Other', 'Paid', 'REG-AUTO-1774707151'),
(4, 6, '2026-03-28', 1000.00, 'Cash', 'Paid', 'REG-WALKIN-1774708798'),
(5, 7, '2026-03-28', 1000.00, 'Cash', 'Paid', 'REG-WALKIN-1774710219'),
(6, 8, '2026-03-28', 1000.00, 'Cash', 'Paid', 'REG-WALKIN-1774713069'),
(7, 9, '2026-03-29', 1000.00, 'Cash', 'Paid', 'REG-WALKIN-1774714181'),
(8, 10, '2026-03-29', 1000.00, 'GCash', 'Paid', 'REG-PROOF-1774750837'),
(9, 11, '2026-03-29', 0.00, '', 'Pending', 'REG-WALKIN-1774757077'),
(10, 12, '2026-03-29', 1000.00, 'Cash', 'Paid', 'REG-WALKIN-1774757249'),
(11, 13, '2026-04-17', 1000.00, 'Cash', 'Paid', 'REG-WALKIN-1776414043'),
(12, 14, '2026-04-18', 1000.00, 'Cash', 'Paid', 'REG-WALKIN-1776478573');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_repairs`
--

CREATE TABLE `tbl_repairs` (
  `repair_id` int(11) NOT NULL,
  `school_instrument_id` int(11) NOT NULL,
  `service_provider_id` int(11) NOT NULL,
  `issue_description` text NOT NULL,
  `reported_date` date DEFAULT curdate(),
  `repair_date` date DEFAULT NULL,
  `expected_completion_date` date DEFAULT NULL,
  `actual_completion_date` date DEFAULT NULL,
  `cost` decimal(10,2) DEFAULT NULL,
  `status` enum('Reported','Scheduled','In Progress','Completed','Cancelled') DEFAULT 'Reported',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tbl_roles`
--

CREATE TABLE `tbl_roles` (
  `role_id` int(11) NOT NULL,
  `role_name` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_roles`
--

INSERT INTO `tbl_roles` (`role_id`, `role_name`) VALUES
(1, 'Admin'),
(5, 'Guardians'),
(7, 'Instructor'),
(2, 'Manager'),
(3, 'Staff'),
(4, 'Student');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_rooms`
--

CREATE TABLE `tbl_rooms` (
  `room_id` int(11) NOT NULL,
  `branch_id` int(11) NOT NULL,
  `room_name` varchar(50) NOT NULL,
  `capacity` int(11) DEFAULT 1,
  `room_type` enum('Private Lesson','Group Room','Recital Hall','Other') DEFAULT 'Private Lesson',
  `status` enum('Available','Under Maintenance','Inactive') DEFAULT 'Available',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_rooms`
--

INSERT INTO `tbl_rooms` (`room_id`, `branch_id`, `room_name`, `capacity`, `room_type`, `status`, `created_at`) VALUES
(8, 6, 'Room 1', 1, 'Private Lesson', 'Available', '2026-03-28 03:24:24'),
(9, 6, 'Room 2', 1, 'Private Lesson', 'Available', '2026-03-28 03:24:34'),
(10, 5, 'Room 1', 1, 'Private Lesson', 'Available', '2026-03-28 03:24:45');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_schedule`
--

CREATE TABLE `tbl_schedule` (
  `schedule_id` int(11) NOT NULL,
  `branch_id` int(11) NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `room_id` int(11) NOT NULL,
  `enrollment_id` int(11) DEFAULT NULL,
  `session_id` int(11) DEFAULT NULL,
  `schedule_date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `schedule_type` enum('Lesson','Makeup','Recital','Blocked','Other') DEFAULT 'Lesson',
  `status` enum('Scheduled','Completed','Cancelled') DEFAULT 'Scheduled',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tbl_schedule_operation_lookup`
--

CREATE TABLE `tbl_schedule_operation_lookup` (
  `operation_id` int(11) NOT NULL,
  `operation_code` varchar(50) NOT NULL,
  `operation_name` varchar(100) NOT NULL,
  `applies_to` enum('Enrollment','Session','Attendance','Request') NOT NULL,
  `counts_as_absence` tinyint(1) NOT NULL DEFAULT 0,
  `counts_as_consumed_session` tinyint(1) NOT NULL DEFAULT 0,
  `allows_makeup` tinyint(1) NOT NULL DEFAULT 0,
  `requires_admin_approval` tinyint(1) NOT NULL DEFAULT 0,
  `freezes_schedule` tinyint(1) NOT NULL DEFAULT 0,
  `requires_holding_fee` tinyint(1) NOT NULL DEFAULT 0,
  `description` varchar(255) DEFAULT NULL,
  `status` enum('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_schedule_operation_lookup`
--

INSERT INTO `tbl_schedule_operation_lookup` (`operation_id`, `operation_code`, `operation_name`, `applies_to`, `counts_as_absence`, `counts_as_consumed_session`, `allows_makeup`, `requires_admin_approval`, `freezes_schedule`, `requires_holding_fee`, `description`, `status`, `created_at`, `updated_at`) VALUES
(1, 'REGULAR_SESSION', 'Regular Fixed Session', 'Session', 0, 0, 0, 0, 0, 0, 'Normal weekly generated session', 'Active', '2026-04-17 05:51:57', '2026-04-17 05:51:57'),
(2, 'STUDENT_ABSENT_NOTICE', 'Student Absent With Notice', 'Attendance', 1, 0, 1, 0, 0, 0, 'Absent within allowed policy, makeup may be allowed', 'Active', '2026-04-17 05:51:57', '2026-04-17 05:51:57'),
(3, 'STUDENT_ABSENT_NO_NOTICE', 'Student Absent No Notice / CI', 'Attendance', 1, 1, 0, 0, 0, 0, 'Session is counted-in and consumed', 'Active', '2026-04-17 05:51:57', '2026-04-17 05:51:57'),
(4, 'TEACHER_ABSENT', 'Teacher Absent', 'Attendance', 0, 0, 1, 0, 0, 0, 'Does not count against student, makeup required', 'Active', '2026-04-17 05:51:57', '2026-04-17 05:51:57'),
(5, 'TEACHER_RESCHEDULE_REQUEST', 'Teacher Reschedule Request', 'Request', 0, 0, 0, 1, 0, 0, 'Teacher cannot directly edit schedule', 'Active', '2026-04-17 05:51:57', '2026-04-17 05:51:57'),
(6, 'STUDENT_SCHEDULE_CHANGE_REQUEST', 'Student Schedule Change Request', 'Request', 0, 0, 0, 1, 0, 0, 'Student cannot directly edit fixed schedule', 'Active', '2026-04-17 05:51:57', '2026-04-17 05:51:57'),
(7, 'MAKEUP_SESSION', 'Makeup Session', 'Session', 0, 0, 0, 0, 0, 0, 'Extra scheduled replacement lesson', 'Active', '2026-04-17 05:51:57', '2026-04-17 05:51:57'),
(8, 'SCHEDULE_FREEZE', 'Schedule Freeze', 'Enrollment', 0, 0, 0, 0, 1, 1, 'Applied after consecutive absences', 'Active', '2026-04-17 05:51:57', '2026-04-17 08:09:27');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_school_instruments`
--

CREATE TABLE `tbl_school_instruments` (
  `school_instrument_id` int(11) NOT NULL,
  `branch_id` int(11) NOT NULL,
  `instrument_id` int(11) NOT NULL,
  `instrument_name` varchar(100) DEFAULT NULL,
  `brand` varchar(100) DEFAULT NULL,
  `serial_number` varchar(50) DEFAULT NULL,
  `purchase_date` date DEFAULT NULL,
  `purchase_cost` decimal(10,2) DEFAULT NULL,
  `condition` enum('Excellent','Good','Fair','Poor') DEFAULT 'Good',
  `status` enum('Available','In Use','Under Repair','Inactive') DEFAULT 'Available'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tbl_service_providers`
--

CREATE TABLE `tbl_service_providers` (
  `service_provider_id` int(11) NOT NULL,
  `provider_name` varchar(100) NOT NULL,
  `provider_type` enum('Brand Service Center','Independent Technician','Repair Shop','Other') NOT NULL,
  `brand_specialization` varchar(100) DEFAULT NULL,
  `contact_person` varchar(50) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tbl_sessions`
--

CREATE TABLE `tbl_sessions` (
  `session_id` int(11) NOT NULL,
  `enrollment_id` int(11) NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `session_number` int(11) NOT NULL,
  `session_date` date NOT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `session_type` enum('Regular','Makeup') DEFAULT 'Regular',
  `instrument_id` int(11) DEFAULT NULL,
  `school_instrument_id` int(11) DEFAULT NULL,
  `room_id` int(11) DEFAULT NULL,
  `status` enum('Scheduled','Completed','Cancelled','No Show','Late','cancelled_by_teacher','rescheduled') NOT NULL DEFAULT 'Scheduled',
  `attendance_status` enum('Pending','Present','Absent','Late','Excused','CI','Teacher Absent') NOT NULL DEFAULT 'Pending',
  `absence_notice` enum('None','Prior','NoNotice','Teacher') NOT NULL DEFAULT 'None',
  `counted_in` tinyint(1) NOT NULL DEFAULT 0,
  `makeup_eligible` tinyint(1) NOT NULL DEFAULT 0,
  `makeup_required` tinyint(1) NOT NULL DEFAULT 0,
  `attendance_notes` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `rescheduled_from_session_id` int(11) DEFAULT NULL,
  `rescheduled_to_session_id` int(11) DEFAULT NULL,
  `needs_rescheduling` tinyint(1) NOT NULL DEFAULT 0,
  `cancellation_reason` text DEFAULT NULL,
  `cancelled_by_teacher_at` datetime DEFAULT NULL,
  `rescheduled_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `operation_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_sessions`
--

INSERT INTO `tbl_sessions` (`session_id`, `enrollment_id`, `teacher_id`, `session_number`, `session_date`, `start_time`, `end_time`, `session_type`, `instrument_id`, `school_instrument_id`, `room_id`, `status`, `attendance_status`, `absence_notice`, `counted_in`, `makeup_eligible`, `makeup_required`, `attendance_notes`, `notes`, `rescheduled_from_session_id`, `rescheduled_to_session_id`, `needs_rescheduling`, `cancellation_reason`, `cancelled_by_teacher_at`, `rescheduled_at`, `created_at`, `operation_id`) VALUES
(1, 1, 1, 1, '2026-03-31', '17:00:00', '18:00:00', 'Regular', 14, NULL, 8, 'No Show', 'Pending', 'None', 0, 0, 0, 'Automatically marked missed based on scheduled date.', 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-03-28 03:53:25', NULL),
(2, 2, 2, 1, '2026-03-29', '10:00:00', '11:00:00', 'Regular', 13, NULL, 8, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-03-28 13:32:28', NULL),
(3, 4, 7, 1, '2026-03-31', '08:00:00', '09:00:00', 'Regular', 11, NULL, 10, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-03-28 15:08:51', NULL),
(4, 5, 7, 1, '2026-03-31', '13:00:00', '14:00:00', 'Regular', 11, NULL, 10, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-03-28 15:53:06', NULL),
(5, 6, 7, 1, '2026-03-31', '14:00:00', '15:00:00', 'Regular', 11, NULL, 10, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-03-28 16:12:28', NULL),
(6, 7, 1, 1, '2026-03-31', '10:00:00', '11:00:00', 'Regular', 14, NULL, 9, 'No Show', 'Pending', 'None', 0, 0, 0, 'Automatically marked missed based on scheduled date.', 'Room 2', NULL, NULL, 0, NULL, NULL, NULL, '2026-03-29 03:17:17', NULL),
(8, 7, 1, 2, '2026-04-04', '09:00:00', '10:00:00', 'Regular', 14, NULL, 8, 'No Show', 'Pending', 'None', 0, 0, 0, 'Automatically marked missed based on scheduled date.', 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-03-29 03:48:51', NULL),
(10, 8, 2, 1, '2026-04-02', '15:00:00', '16:00:00', 'Regular', 10, NULL, 10, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-03-29 04:22:50', NULL),
(11, 2, 2, 2, '2026-04-08', '09:00:00', '10:00:00', 'Regular', 13, NULL, 8, 'Completed', 'Pending', 'None', 0, 0, 0, 'Completed from manual attendance', 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-04-07 06:40:27', NULL),
(12, 9, 9, 1, '2026-05-01', '09:00:00', '10:00:00', 'Regular', 10, NULL, 10, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-04-18 06:45:01', 1),
(13, 9, 9, 2, '2026-05-01', '13:00:00', '14:00:00', 'Regular', 10, NULL, 10, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-04-18 06:45:01', 1),
(14, 9, 9, 3, '2026-05-08', '09:00:00', '10:00:00', 'Regular', 10, NULL, 10, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-04-18 06:45:01', 1),
(15, 9, 9, 4, '2026-05-08', '13:00:00', '14:00:00', 'Regular', 10, NULL, 10, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-04-18 06:45:01', 1),
(16, 9, 9, 5, '2026-05-15', '09:00:00', '10:00:00', 'Regular', 10, NULL, 10, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-04-18 06:45:01', 1),
(17, 9, 9, 6, '2026-05-15', '13:00:00', '14:00:00', 'Regular', 10, NULL, 10, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-04-18 06:45:01', 1),
(18, 9, 9, 7, '2026-05-22', '09:00:00', '10:00:00', 'Regular', 10, NULL, 10, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-04-18 06:45:01', 1),
(19, 9, 9, 8, '2026-05-22', '13:00:00', '14:00:00', 'Regular', 10, NULL, 10, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-04-18 06:45:01', 1),
(20, 9, 9, 9, '2026-05-29', '09:00:00', '10:00:00', 'Regular', 10, NULL, 10, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-04-18 06:45:01', 1),
(21, 9, 9, 10, '2026-05-29', '13:00:00', '14:00:00', 'Regular', 10, NULL, 10, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-04-18 06:45:01', 1),
(22, 9, 9, 11, '2026-06-05', '09:00:00', '10:00:00', 'Regular', 10, NULL, 10, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-04-18 06:45:01', 1),
(23, 9, 9, 12, '2026-06-05', '13:00:00', '14:00:00', 'Regular', 10, NULL, 10, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-04-18 06:45:01', 1);

-- --------------------------------------------------------

--
-- Table structure for table `tbl_session_packages`
--

CREATE TABLE `tbl_session_packages` (
  `package_id` int(11) NOT NULL,
  `branch_id` int(11) DEFAULT NULL,
  `package_name` varchar(100) NOT NULL,
  `sessions` int(11) NOT NULL,
  `max_instruments` tinyint(4) NOT NULL DEFAULT 1,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_session_packages`
--

INSERT INTO `tbl_session_packages` (`package_id`, `branch_id`, `package_name`, `sessions`, `max_instruments`, `price`, `description`, `created_at`) VALUES
(12, 5, 'Standard', 20, 2, 11800.00, 'test', '2026-03-28 00:48:31'),
(13, 5, 'Basic', 12, 1, 7450.00, 'test', '2026-03-28 00:48:57'),
(14, 6, 'Basic', 12, 1, 7450.00, 'test upt', '2026-03-28 00:49:27'),
(15, 6, '20', 20, 2, 11800.00, 'test upt', '2026-03-28 00:49:43');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_settings`
--

CREATE TABLE `tbl_settings` (
  `setting_id` int(11) NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text NOT NULL,
  `setting_type` enum('String','Number','Decimal','Boolean','JSON') DEFAULT 'String',
  `description` text DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `updated_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_settings`
--

INSERT INTO `tbl_settings` (`setting_id`, `setting_key`, `setting_value`, `setting_type`, `description`, `updated_at`, `updated_by`) VALUES
(1, 'registration_fee', '1000.00', 'Decimal', 'Default registration fee amount in PHP', '2026-02-20 15:51:31', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `tbl_specialization`
--

CREATE TABLE `tbl_specialization` (
  `specialization_id` int(11) NOT NULL,
  `specialization_name` varchar(100) NOT NULL,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_specialization`
--

INSERT INTO `tbl_specialization` (`specialization_id`, `specialization_name`, `status`, `created_at`) VALUES
(1, 'Piano', 'Active', '2026-02-23 09:45:38'),
(2, 'Guitar', 'Active', '2026-02-23 09:45:38'),
(3, 'Drums', 'Active', '2026-02-23 09:45:38'),
(4, 'Violin', 'Active', '2026-02-23 09:45:38'),
(5, 'General', 'Active', '2026-02-23 09:45:38');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_students`
--

CREATE TABLE `tbl_students` (
  `student_id` int(11) NOT NULL,
  `branch_id` int(11) NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `middle_name` varchar(50) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `age` int(11) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `school` varchar(100) DEFAULT NULL,
  `grade_year` varchar(50) DEFAULT NULL,
  `health_diagnosis` text DEFAULT NULL,
  `status` enum('Active','Inactive','Graduated') DEFAULT 'Active',
  `registration_source` varchar(20) NOT NULL DEFAULT 'online',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `session_package_id` int(11) DEFAULT NULL,
  `registration_proof_path` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_students`
--

INSERT INTO `tbl_students` (`student_id`, `branch_id`, `first_name`, `last_name`, `middle_name`, `date_of_birth`, `age`, `phone`, `email`, `address`, `school`, `grade_year`, `health_diagnosis`, `status`, `registration_source`, `created_at`, `session_package_id`, `registration_proof_path`) VALUES
(1, 6, 'Micah', 'Lago', NULL, '2011-10-28', 14, '09902019202', 'micah@gmail.com', 'Tablon', 'Coc', 'HighSchool', NULL, 'Active', 'online', '2026-03-28 02:02:57', 14, 'uploads/payment_proofs/registration/20260328030413_2b2ea77f71a022c2.png'),
(3, 6, 'mckenzie', 'lago', NULL, NULL, NULL, '0909090909', 'mckenzie@gmail.com', NULL, NULL, NULL, NULL, 'Inactive', 'online', '2026-03-28 12:04:04', NULL, NULL),
(4, 6, 'Yumi', 'Lago', NULL, '2014-02-27', 12, '09659153090', 'yumi@gmail.com', 'CDO tablon', 'Tablon Elementary School', 'Grade 5', NULL, 'Active', 'online', '2026-03-28 12:58:40', 14, 'uploads/payment_proofs/registration/20260328141033_62e66192ac872762.png'),
(5, 5, 'Juan', 'Delacruz', 'Pepito', '2003-02-28', 23, '09090900', 'juan@gmail.com', 'CDO Bugo', NULL, 'grade 10', 'none ', 'Inactive', 'online', '2026-03-28 14:12:31', NULL, NULL),
(6, 5, 'test', 'test', 'Dusil', '2004-02-28', 22, '090909090', 'test@gmail.com', 'zone 3 upper, Brgy. Bulua, Cagayan de Oro City, Misamis Oriental', NULL, 'adult ', 'none ', 'Inactive', 'walkin', '2026-03-28 14:39:58', NULL, NULL),
(7, 5, 'Arman', 'Salon', 'Dusil', '2005-02-28', 21, '09659153090', 'arman@gmail.com', 'CDO Gusa ', NULL, NULL, NULL, 'Active', 'walkin', '2026-03-28 15:03:39', 12, NULL),
(8, 5, 'Bruno', 'Mars', '', '1995-06-28', 30, '09748372013', 'bruno@gmail.com', 'CDO Bugo ', NULL, NULL, NULL, 'Inactive', 'walkin', '2026-03-28 15:51:09', 13, NULL),
(9, 5, 'Ariana', 'Grande', 'Dusil ', '2006-02-28', 20, '090049303', 'ariana@gmail.com', 'CDO tablon ', NULL, NULL, NULL, 'Active', 'walkin', '2026-03-28 16:09:41', 13, NULL),
(10, 6, 'James', 'Garcia', NULL, '2017-06-29', 8, '098069503', 'james@gmail.com', 'grade 2', NULL, NULL, NULL, 'Active', 'online', '2026-03-29 01:57:17', 14, 'uploads/payment_proofs/registration/20260329042037_586845efce8a3c44.png'),
(11, 5, 'Jeon', 'Jungkook', 'Yoo', '1998-06-17', 27, '090799574903', 'jeon@gmail.com', 'zone 3 bulua ', NULL, NULL, NULL, 'Active', 'walkin', '2026-03-29 04:04:37', NULL, NULL),
(12, 5, 'Seokjin', 'Kim', 'Martinez', '2005-10-29', 20, '0907940902', 'seokjin@gmail.com', 'CDO tablon', NULL, NULL, NULL, 'Active', 'walkin', '2026-03-29 04:07:29', 13, NULL),
(13, 5, 'Jennie', 'Kim', 'idk', '1998-07-17', 27, '090909090', 'jennie@gmail.com', 'YG station', NULL, NULL, NULL, 'Active', 'walkin', '2026-04-17 08:20:43', 13, NULL),
(14, 5, 'Skusta', 'Clee', '', '1997-06-18', 28, '09090909', 'skusta@gmail.com', 'AMBOT ', NULL, NULL, NULL, 'Active', 'walkin', '2026-04-18 02:16:13', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `tbl_student_guardians`
--

CREATE TABLE `tbl_student_guardians` (
  `student_guardian_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `guardian_id` int(11) NOT NULL,
  `is_primary_guardian` enum('Y','N') DEFAULT 'N',
  `can_enroll` enum('Y','N') DEFAULT 'Y',
  `can_pay` enum('Y','N') DEFAULT 'Y',
  `emergency_contact` enum('Y','N') DEFAULT 'N'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_student_guardians`
--

INSERT INTO `tbl_student_guardians` (`student_guardian_id`, `student_id`, `guardian_id`, `is_primary_guardian`, `can_enroll`, `can_pay`, `emergency_contact`) VALUES
(1, 1, 1, 'Y', 'Y', 'Y', 'Y'),
(2, 4, 1, 'Y', 'Y', 'Y', 'Y'),
(3, 10, 2, 'Y', 'Y', 'Y', 'Y');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_student_instruments`
--

CREATE TABLE `tbl_student_instruments` (
  `student_instrument_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `instrument_id` int(11) NOT NULL,
  `priority_order` int(11) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_student_instruments`
--

INSERT INTO `tbl_student_instruments` (`student_instrument_id`, `student_id`, `instrument_id`, `priority_order`, `created_at`) VALUES
(1, 1, 14, 1, '2026-03-28 03:53:25'),
(2, 4, 13, 1, '2026-03-28 13:32:28'),
(3, 7, 11, 1, '2026-03-28 15:08:51'),
(4, 7, 9, 2, '2026-03-28 15:08:51'),
(5, 8, 11, 1, '2026-03-28 15:53:06'),
(6, 9, 11, 1, '2026-03-28 16:12:28'),
(8, 10, 14, 1, '2026-03-29 03:17:16'),
(10, 12, 10, 1, '2026-03-29 04:22:49'),
(11, 13, 10, 1, '2026-04-18 06:45:01');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_student_progress`
--

CREATE TABLE `tbl_student_progress` (
  `progress_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `session_id` int(11) NOT NULL,
  `instrument_id` int(11) NOT NULL,
  `skill_level` varchar(50) DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `assessment_date` date DEFAULT curdate(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tbl_teachers`
--

CREATE TABLE `tbl_teachers` (
  `teacher_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `branch_id` int(11) NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `employment_type` enum('Full-time','Part-time','Contract') DEFAULT 'Full-time',
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_teachers`
--

INSERT INTO `tbl_teachers` (`teacher_id`, `user_id`, `branch_id`, `first_name`, `last_name`, `email`, `phone`, `employment_type`, `status`, `created_at`) VALUES
(1, 26, 6, 'Kim', 'Minjeong', 'drum1@gmail.com', '0900900909', 'Full-time', 'Active', '2026-03-28 03:31:56'),
(2, NULL, 5, 'Yu', 'Jimin', 'guitar1@gmail.com', '0920239293', 'Full-time', 'Active', '2026-03-28 11:35:07'),
(3, NULL, 6, 'Kim', 'Aeri', 'Aeri@gmail.com', '090293021', 'Full-time', 'Inactive', '2026-03-28 11:35:42'),
(4, NULL, 5, 'Jeon', 'Jungkook', 'drum2@gmail.com', '090900900', 'Full-time', 'Active', '2026-03-28 11:46:22'),
(5, 15, 6, 'John', 'Doe', 'johndoe@gmail.com', '09095650494', 'Full-time', 'Active', '2026-03-28 13:16:44'),
(6, 16, 5, 'Alex', 'Guitar', 'guitar3@gmail.com', '0909090', 'Full-time', 'Active', '2026-03-28 13:28:04'),
(7, 20, 5, 'Reyna', 'Doe', 'violin2@gmail.com', '0090090', 'Full-time', 'Active', '2026-03-28 15:06:07'),
(8, 25, 6, 'Ning', 'Ning', 'ning@gmail.com', '0909209032', 'Full-time', 'Active', '2026-03-29 02:51:45'),
(9, 30, 5, 'GD', 'Dragon', 'gdragon@gmail.com', '09000909090', 'Full-time', 'Active', '2026-04-17 08:17:08');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_teacher_availability`
--

CREATE TABLE `tbl_teacher_availability` (
  `availability_id` int(11) NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `branch_id` int(11) NOT NULL,
  `day_of_week` enum('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `status` enum('Available','Unavailable') DEFAULT 'Available',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_teacher_availability`
--

INSERT INTO `tbl_teacher_availability` (`availability_id`, `teacher_id`, `branch_id`, `day_of_week`, `start_time`, `end_time`, `status`, `created_at`) VALUES
(28, 1, 6, 'Monday', '09:00:00', '17:00:00', 'Available', '2026-03-29 03:48:40'),
(29, 1, 6, 'Tuesday', '09:00:00', '17:00:00', 'Available', '2026-03-29 03:48:40'),
(30, 1, 6, 'Wednesday', '09:00:00', '17:00:00', 'Available', '2026-03-29 03:48:40'),
(31, 1, 6, 'Thursday', '09:00:00', '17:00:00', 'Available', '2026-03-29 03:48:40'),
(32, 1, 6, 'Friday', '09:00:00', '17:00:00', 'Available', '2026-03-29 03:48:40'),
(33, 1, 6, 'Saturday', '09:00:00', '17:00:00', 'Available', '2026-03-29 03:48:40'),
(34, 6, 5, 'Wednesday', '09:00:00', '17:00:00', 'Available', '2026-03-29 04:16:24'),
(35, 6, 5, 'Friday', '09:00:00', '17:00:00', 'Available', '2026-03-29 04:16:24'),
(36, 6, 5, 'Saturday', '09:00:00', '17:00:00', 'Available', '2026-03-29 04:16:24'),
(48, 9, 5, 'Monday', '09:00:00', '17:00:00', 'Available', '2026-04-18 06:26:10'),
(49, 9, 5, 'Friday', '09:00:00', '17:00:00', 'Available', '2026-04-18 06:26:10');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_teacher_specializations`
--

CREATE TABLE `tbl_teacher_specializations` (
  `teacher_id` int(11) NOT NULL,
  `specialization_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_teacher_specializations`
--

INSERT INTO `tbl_teacher_specializations` (`teacher_id`, `specialization_id`) VALUES
(1, 3),
(2, 2),
(3, 4),
(4, 3),
(5, 2),
(6, 2),
(7, 4),
(8, 3),
(9, 2);

-- --------------------------------------------------------

--
-- Table structure for table `tbl_users`
--

CREATE TABLE `tbl_users` (
  `user_id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role_id` int(11) NOT NULL,
  `branch_id` int(11) DEFAULT NULL,
  `first_name` varchar(50) DEFAULT NULL,
  `last_name` varchar(50) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_users`
--

INSERT INTO `tbl_users` (`user_id`, `username`, `password`, `role_id`, `branch_id`, `first_name`, `last_name`, `email`, `phone`, `status`, `created_at`) VALUES
(1, 'fasadmin@music.com', '$2y$10$z3leOydLuLCNIgA3dHSQAeJAep.BZ7R92sufR87aETmyfLGSv7s5e', 1, NULL, 'FAS', 'Administrator', 'fasadmin@music.com', NULL, 'Active', '2026-03-28 00:25:11'),
(2, 'micah@gmail.com', '$2y$10$rYChNQTjsdLXy8VzJGg/H.Z.UVvQImYehTt9roOSqcDOminpRQZJm', 4, NULL, 'Micah', 'Lago', 'micah@gmail.com', '09902019202', 'Active', '2026-03-28 02:02:57'),
(3, 'jonah@gmail.com', '$2y$10$w9lle5td/E0DVdjN52GkYOZ8Qu1yU59dVallIxenjSq6uW8FxpabC', 5, NULL, 'Jonah', 'Lago', 'jonah@gmail.com', '09079090', 'Active', '2026-03-28 02:04:13'),
(4, 'drumuptown@gmail.com', '$2y$10$Cm4IuXpuIf68y73K.HjwFuoPVMkqRKqWPy.Avo0LXwWgVtBh91sp2', 7, NULL, 'Drum', 'Instructor test', 'drumuptown@gmail.com', '0900900909', 'Active', '2026-03-28 03:31:56'),
(5, 'guitar1@gmail.com', '$2y$10$vnFspU/Tl/L6Aj0M15d8f.zVAK5hmbI37sIWl15xLSdD8YJUyUeTK', 7, NULL, 'Guitar Instructor', 'Test', 'guitar1@gmail.com', '0920239293', 'Active', '2026-03-28 11:35:07'),
(6, 'violin1@gmail.com', '$2y$10$oB6qLufbGkyNoOsPC2GNqeRwCCs.YBZy/rBSls9X2Lx4Z4SeoYQbO', 7, NULL, 'Violin Instructor', 'Test', 'violin1@gmail.com', '090293021', 'Active', '2026-03-28 11:35:42'),
(7, 'deskup1@gmail.com', '$2y$10$35NPUA4VAWddcCHa9VCMW.vqfRxh64pUo866Eo8qqLApJ.pB0MrGK', 3, 6, 'Desk', 'Uptown 1', 'deskup1@gmail.com', '090900900', 'Active', '2026-03-28 11:38:43'),
(8, 'deskdown1@gmail.com', '$2y$10$EvsFNXZ3Y7c5xYBSGe4asOJXDJelV4tz/mghw3b40Jfvl8WatS3p2', 3, 5, 'Desk', 'Downtown 1', 'deskdown1@gmail.com', '009090090', 'Active', '2026-03-28 11:39:22'),
(9, 'branchup1@gmail.com', '$2y$10$mt42UVmdRB5co8vrHPLO..P7Jum.LPuxAB.UENX6OGLUpgkHP9mmu', 2, 6, 'Branch Manager', 'Uptown 1', 'branchup1@gmail.com', '0909090900', 'Active', '2026-03-28 11:41:28'),
(10, 'drum2@gmail.com', '$2y$10$0PP75irgv2TtGEcBok0L1e97ytmUdTPVwBiCjPSutpPqff37Ijww.', 7, NULL, 'Drum', 'Downtown 1', 'drum2@gmail.com', '090900900', 'Active', '2026-03-28 11:46:22'),
(12, 'mckenzie@gmail.com', '$2y$10$kFm5b6/I0NJi5THslORMeurpikuY1N/T1hZVymmjcWdwvSdAFK.0O', 4, NULL, 'mckenzie', 'lago', 'mckenzie@gmail.com', '0909090909', 'Active', '2026-03-28 12:04:04'),
(13, 'branchdown1@gmail.com', '$2y$10$.xetbce02mCU0vwtDQibAexAnGkhKpKkw8OnhXqgwP81rYpRieAc.', 2, 5, 'Branch Manager', 'Downtown', 'branchdown1@gmail.com', '09090090', 'Inactive', '2026-03-28 12:22:35'),
(14, 'yumi@gmail.com', '$2y$10$1sofaD86x5jOGgmMIuNtRuLJzM4EQRcgZx6jaeK5GzepRlg7NNmSO', 4, NULL, 'Yumi', 'Lago', 'yumi@gmail.com', '09659153090', 'Active', '2026-03-28 12:58:40'),
(15, 'johndoe@gmail.com', '$2y$10$GF3OGjLxNeJ00SJ2bIiale4iHAfYm5Mn4E4wksJxS/39Dx.dMe26K', 7, NULL, 'John', 'Doe', 'johndoe@gmail.com', '09095650494', 'Active', '2026-03-28 13:16:44'),
(16, 'guitar3@gmail.com', '$2y$10$XDX1IIM3RWhmKomKB6OupeZC.N4HtgQbayL2dfz3rGhL8saaY57bG', 7, NULL, 'Alex', 'Guitar', 'guitar3@gmail.com', '0909090', 'Active', '2026-03-28 13:28:04'),
(18, 'test@gmail.com', '$2y$10$XdtoDrZXcikbmRM5c6uPw.eIKJnoBPcjLI4Ph1ddk6kCnIND/R5bi', 4, NULL, 'test', 'test', 'test@gmail.com', '090909090', 'Inactive', '2026-03-28 14:39:58'),
(19, 'arman@gmail.com', '$2y$10$MdioBTf5Ce4sDFoZpTE.8.J9DajHH.yBe/zqmzjNAL7gFi9CDzBVe', 4, NULL, 'Arman', 'Salon', 'arman@gmail.com', '09659153090', 'Active', '2026-03-28 15:03:39'),
(20, 'violin2@gmail.com', '$2y$10$SaHANQ4A4OrJqGUUGZsHu.QF5QyBdCrWkvVO1M9U2jqCi1mgp.hRu', 7, NULL, 'Reyna', 'Doe', 'violin2@gmail.com', '0090090', 'Active', '2026-03-28 15:06:07'),
(21, 'bruno@gmail.com', '$2y$10$SVoMZbNLGllp52HQM.rkze6XXOUtXej9t3UqN.O0jF6hY8eGD9h06', 4, NULL, 'Bruno', 'Mars', 'bruno@gmail.com', '09748372013', 'Inactive', '2026-03-28 15:51:09'),
(22, 'ariana@gmail.com', '$2y$10$7Td2fm0i4AOxDWZWqICA/eg6xkbC.CczFkj27hQ2nve/SNwOwN5TC', 4, NULL, 'Ariana', 'Grande', 'ariana@gmail.com', '090049303', 'Active', '2026-03-28 16:09:41'),
(23, 'james@gmail.com', '$2y$10$gW/briMNyynBeXz/Ka6GrOEBjFCbgjmSPySe1mX.8oEIABtVQrZfS', 4, NULL, 'James', 'Garcia', 'james@gmail.com', '098069503', 'Active', '2026-03-29 01:57:18'),
(24, 'oliver@gmail.com', '$2y$10$Ppw7NAyTo1Z3T0q5BgCsT.Blpj0HxbX4kNIHgQxgrw2ZlzsC2EcKy', 5, NULL, 'Oliver', 'Garcia', 'oliver@gmail.com', '096483472', 'Active', '2026-03-29 02:20:37'),
(25, 'ning@gmail.com', '$2y$10$hJGNAs9PitcShvLLlghGM.2BEuiQ.53gHA1cHy4bv5KrIDxvw4GvO', 7, NULL, 'Ning', 'Ning', 'ning@gmail.com', '0909209032', 'Active', '2026-03-29 02:51:45'),
(26, 'drum1@gmail.com', '$2y$10$l6fsq9fuzxNgpUfAhBqha.DvIoBeLF1yRMTTgdT8XNFInt0z3NSmq', 7, NULL, 'Kim', 'Minjeong', 'drum1@gmail.com', '0900900909', 'Active', '2026-03-29 03:26:18'),
(27, 'jeon@gmail.com', '$2y$10$/p1FjpM/7mcG22l.zvYwveBCr8Tk5TxLSFAMlaagfS4LxOgZ3aQGa', 4, NULL, 'Jeon', 'Jungkook', 'jeon@gmail.com', '090799574903', 'Active', '2026-03-29 04:04:37'),
(28, 'seokjin@gmail.com', '$2y$10$NLCv467L3yIwShrRYSLhm.3DDZh5zJo4cuvScKb.yQS7VOlz84/kK', 4, NULL, 'Seokjin', 'Kim', 'seokjin@gmail.com', '0907940902', 'Active', '2026-03-29 04:07:29'),
(29, 'branchup2@gmail.com', '$2y$10$eKpiWHYvDpb0T9PSVu3PCumif93Fcc0msA7yssvdR36LXYnstT/di', 2, 6, 'branch', 'uptown test 2', 'branchup2@gmail.com', '090290302901', 'Active', '2026-04-07 02:24:45'),
(30, 'gdragon@gmail.com', '$2y$10$Or4Jx5U4m6mIyJ9CndZQJeyfGeK1BhxM7J4d70R33xIz8imPrPWhe', 7, NULL, 'GD', 'Dragon', 'gdragon@gmail.com', '09000909090', 'Active', '2026-04-17 08:17:08'),
(31, 'jennie@gmail.com', '$2y$10$jbLw7Kty.tSPS.2lOS4F6Od/abQ9LhPh21NTP92QGBjtTyPAaa9nu', 4, NULL, 'Jennie', 'Kim', 'jennie@gmail.com', '090909090', 'Active', '2026-04-17 08:20:43'),
(32, 'branchdown2@gmail.com', '$2y$10$nV2qIKPVatAcb0UAfT2v/ez3iLO5pPoAY91LQHDExhrTDXcD8NkZu', 2, 5, 'Branch', 'Downtown', 'branchdown2@gmail.com', '09090009', 'Active', '2026-04-17 15:18:48'),
(33, 'skusta@gmail.com', '$2y$10$c.8eIq8OxFBugvyFVYcPCOZ4K4eNOkiS.kUizJ9Eu.GZQsbTi7GQ2', 4, NULL, 'Skusta', 'Clee', 'skusta@gmail.com', '09090909', 'Active', '2026-04-18 02:16:13');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `tbl_attendance`
--
ALTER TABLE `tbl_attendance`
  ADD PRIMARY KEY (`attendance_id`),
  ADD KEY `idx_attendance_student` (`student_id`),
  ADD KEY `idx_attendance_date` (`attended_at`),
  ADD KEY `idx_attendance_branch` (`branch_id`);

--
-- Indexes for table `tbl_branches`
--
ALTER TABLE `tbl_branches`
  ADD PRIMARY KEY (`branch_id`);

--
-- Indexes for table `tbl_enrollments`
--
ALTER TABLE `tbl_enrollments`
  ADD PRIMARY KEY (`enrollment_id`),
  ADD KEY `package_id` (`package_id`),
  ADD KEY `idx_enrollments_student` (`student_id`),
  ADD KEY `idx_enrollments_status` (`status`),
  ADD KEY `fk_enroll_student_guardian` (`student_guardian_id`),
  ADD KEY `fk_enroll_instrument` (`instrument_id`);

--
-- Indexes for table `tbl_enrollment_schedule_slots`
--
ALTER TABLE `tbl_enrollment_schedule_slots`
  ADD PRIMARY KEY (`slot_id`),
  ADD KEY `idx_enrollment_schedule_slots_enrollment` (`enrollment_id`,`status`,`sort_order`),
  ADD KEY `idx_enrollment_schedule_slots_teacher` (`teacher_id`,`day_of_week`,`start_time`,`end_time`);

--
-- Indexes for table `tbl_guardians`
--
ALTER TABLE `tbl_guardians`
  ADD PRIMARY KEY (`guardian_id`);

--
-- Indexes for table `tbl_instruments`
--
ALTER TABLE `tbl_instruments`
  ADD PRIMARY KEY (`instrument_id`),
  ADD KEY `branch_id` (`branch_id`),
  ADD KEY `type_id` (`type_id`);

--
-- Indexes for table `tbl_instrument_types`
--
ALTER TABLE `tbl_instrument_types`
  ADD PRIMARY KEY (`type_id`),
  ADD UNIQUE KEY `type_name` (`type_name`);

--
-- Indexes for table `tbl_makeup_sessions`
--
ALTER TABLE `tbl_makeup_sessions`
  ADD PRIMARY KEY (`makeup_id`),
  ADD KEY `original_session_id` (`original_session_id`),
  ADD KEY `makeup_session_id` (`makeup_session_id`),
  ADD KEY `teacher_id` (`teacher_id`);

--
-- Indexes for table `tbl_payments`
--
ALTER TABLE `tbl_payments`
  ADD PRIMARY KEY (`payment_id`),
  ADD KEY `idx_payments_enrollment` (`enrollment_id`),
  ADD KEY `idx_payments_date` (`payment_date`);

--
-- Indexes for table `tbl_payment_schedule`
--
ALTER TABLE `tbl_payment_schedule`
  ADD PRIMARY KEY (`schedule_id`),
  ADD UNIQUE KEY `unique_enrollment_session` (`enrollment_id`,`session_number`);

--
-- Indexes for table `tbl_recitals`
--
ALTER TABLE `tbl_recitals`
  ADD PRIMARY KEY (`recital_id`),
  ADD KEY `branch_id` (`branch_id`),
  ADD KEY `teacher_id` (`teacher_id`),
  ADD KEY `idx_recitals_date` (`recital_date`);

--
-- Indexes for table `tbl_recital_participants`
--
ALTER TABLE `tbl_recital_participants`
  ADD PRIMARY KEY (`participant_id`),
  ADD KEY `recital_id` (`recital_id`),
  ADD KEY `idx_recital_participant_type` (`participant_type`),
  ADD KEY `student_id` (`student_id`),
  ADD KEY `guardian_id` (`guardian_id`),
  ADD KEY `instrument_id` (`instrument_id`);

--
-- Indexes for table `tbl_recurring_schedule`
--
ALTER TABLE `tbl_recurring_schedule`
  ADD PRIMARY KEY (`recurring_id`),
  ADD KEY `enrollment_id` (`enrollment_id`),
  ADD KEY `teacher_id` (`teacher_id`),
  ADD KEY `room_id` (`room_id`);

--
-- Indexes for table `tbl_registration_payments`
--
ALTER TABLE `tbl_registration_payments`
  ADD PRIMARY KEY (`registration_payment_id`),
  ADD KEY `fk_registration_student` (`student_id`);

--
-- Indexes for table `tbl_repairs`
--
ALTER TABLE `tbl_repairs`
  ADD PRIMARY KEY (`repair_id`),
  ADD KEY `school_instrument_id` (`school_instrument_id`),
  ADD KEY `service_provider_id` (`service_provider_id`);

--
-- Indexes for table `tbl_roles`
--
ALTER TABLE `tbl_roles`
  ADD PRIMARY KEY (`role_id`),
  ADD UNIQUE KEY `role_name` (`role_name`);

--
-- Indexes for table `tbl_rooms`
--
ALTER TABLE `tbl_rooms`
  ADD PRIMARY KEY (`room_id`),
  ADD UNIQUE KEY `unique_room_per_branch` (`branch_id`,`room_name`);

--
-- Indexes for table `tbl_schedule`
--
ALTER TABLE `tbl_schedule`
  ADD PRIMARY KEY (`schedule_id`),
  ADD KEY `enrollment_id` (`enrollment_id`),
  ADD KEY `session_id` (`session_id`),
  ADD KEY `idx_schedule_teacher_date` (`teacher_id`,`schedule_date`),
  ADD KEY `idx_schedule_room_date` (`room_id`,`schedule_date`),
  ADD KEY `idx_schedule_branch_date` (`branch_id`,`schedule_date`);

--
-- Indexes for table `tbl_schedule_operation_lookup`
--
ALTER TABLE `tbl_schedule_operation_lookup`
  ADD PRIMARY KEY (`operation_id`),
  ADD UNIQUE KEY `operation_code` (`operation_code`);

--
-- Indexes for table `tbl_school_instruments`
--
ALTER TABLE `tbl_school_instruments`
  ADD PRIMARY KEY (`school_instrument_id`),
  ADD KEY `branch_id` (`branch_id`),
  ADD KEY `instrument_id` (`instrument_id`);

--
-- Indexes for table `tbl_service_providers`
--
ALTER TABLE `tbl_service_providers`
  ADD PRIMARY KEY (`service_provider_id`);

--
-- Indexes for table `tbl_sessions`
--
ALTER TABLE `tbl_sessions`
  ADD PRIMARY KEY (`session_id`),
  ADD KEY `teacher_id` (`teacher_id`),
  ADD KEY `instrument_id` (`instrument_id`),
  ADD KEY `school_instrument_id` (`school_instrument_id`),
  ADD KEY `room_id` (`room_id`),
  ADD KEY `idx_sessions_enrollment` (`enrollment_id`),
  ADD KEY `idx_sessions_date` (`session_date`),
  ADD KEY `idx_sessions_status` (`status`),
  ADD KEY `idx_sessions_enrollment_number` (`enrollment_id`,`session_number`),
  ADD KEY `idx_sessions_rescheduled_from` (`rescheduled_from_session_id`),
  ADD KEY `idx_sessions_rescheduled_to` (`rescheduled_to_session_id`),
  ADD KEY `idx_sessions_needs_rescheduling` (`needs_rescheduling`);

--
-- Indexes for table `tbl_session_packages`
--
ALTER TABLE `tbl_session_packages`
  ADD PRIMARY KEY (`package_id`),
  ADD KEY `idx_session_packages_branch` (`branch_id`);

--
-- Indexes for table `tbl_settings`
--
ALTER TABLE `tbl_settings`
  ADD PRIMARY KEY (`setting_id`),
  ADD UNIQUE KEY `setting_key` (`setting_key`),
  ADD KEY `updated_by` (`updated_by`);

--
-- Indexes for table `tbl_specialization`
--
ALTER TABLE `tbl_specialization`
  ADD PRIMARY KEY (`specialization_id`),
  ADD UNIQUE KEY `uniq_specialization_name` (`specialization_name`);

--
-- Indexes for table `tbl_students`
--
ALTER TABLE `tbl_students`
  ADD PRIMARY KEY (`student_id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_students_branch` (`branch_id`),
  ADD KEY `idx_students_status` (`status`),
  ADD KEY `idx_students_session_package` (`session_package_id`);

--
-- Indexes for table `tbl_student_guardians`
--
ALTER TABLE `tbl_student_guardians`
  ADD PRIMARY KEY (`student_guardian_id`),
  ADD UNIQUE KEY `unique_student_guardian` (`student_id`,`guardian_id`),
  ADD KEY `guardian_id` (`guardian_id`);

--
-- Indexes for table `tbl_student_instruments`
--
ALTER TABLE `tbl_student_instruments`
  ADD PRIMARY KEY (`student_instrument_id`),
  ADD UNIQUE KEY `unique_student_instrument` (`student_id`,`instrument_id`),
  ADD UNIQUE KEY `unique_student_priority` (`student_id`,`priority_order`),
  ADD KEY `idx_student_instruments_student` (`student_id`),
  ADD KEY `idx_student_instruments_instrument` (`instrument_id`);

--
-- Indexes for table `tbl_student_progress`
--
ALTER TABLE `tbl_student_progress`
  ADD PRIMARY KEY (`progress_id`),
  ADD KEY `student_id` (`student_id`),
  ADD KEY `session_id` (`session_id`),
  ADD KEY `instrument_id` (`instrument_id`);

--
-- Indexes for table `tbl_teachers`
--
ALTER TABLE `tbl_teachers`
  ADD PRIMARY KEY (`teacher_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `branch_id` (`branch_id`);

--
-- Indexes for table `tbl_teacher_availability`
--
ALTER TABLE `tbl_teacher_availability`
  ADD PRIMARY KEY (`availability_id`),
  ADD UNIQUE KEY `unique_teacher_day_timeslot` (`teacher_id`,`day_of_week`,`start_time`,`end_time`),
  ADD KEY `branch_id` (`branch_id`),
  ADD KEY `idx_teacher_availability` (`teacher_id`,`day_of_week`);

--
-- Indexes for table `tbl_teacher_specializations`
--
ALTER TABLE `tbl_teacher_specializations`
  ADD PRIMARY KEY (`teacher_id`,`specialization_id`),
  ADD KEY `idx_tts_specialization` (`specialization_id`);

--
-- Indexes for table `tbl_users`
--
ALTER TABLE `tbl_users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `role_id` (`role_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `tbl_attendance`
--
ALTER TABLE `tbl_attendance`
  MODIFY `attendance_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `tbl_branches`
--
ALTER TABLE `tbl_branches`
  MODIFY `branch_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `tbl_enrollments`
--
ALTER TABLE `tbl_enrollments`
  MODIFY `enrollment_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `tbl_enrollment_schedule_slots`
--
ALTER TABLE `tbl_enrollment_schedule_slots`
  MODIFY `slot_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `tbl_guardians`
--
ALTER TABLE `tbl_guardians`
  MODIFY `guardian_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `tbl_instruments`
--
ALTER TABLE `tbl_instruments`
  MODIFY `instrument_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `tbl_instrument_types`
--
ALTER TABLE `tbl_instrument_types`
  MODIFY `type_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=64;

--
-- AUTO_INCREMENT for table `tbl_makeup_sessions`
--
ALTER TABLE `tbl_makeup_sessions`
  MODIFY `makeup_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_payments`
--
ALTER TABLE `tbl_payments`
  MODIFY `payment_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `tbl_payment_schedule`
--
ALTER TABLE `tbl_payment_schedule`
  MODIFY `schedule_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_recitals`
--
ALTER TABLE `tbl_recitals`
  MODIFY `recital_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_recital_participants`
--
ALTER TABLE `tbl_recital_participants`
  MODIFY `participant_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_recurring_schedule`
--
ALTER TABLE `tbl_recurring_schedule`
  MODIFY `recurring_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_registration_payments`
--
ALTER TABLE `tbl_registration_payments`
  MODIFY `registration_payment_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `tbl_repairs`
--
ALTER TABLE `tbl_repairs`
  MODIFY `repair_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_roles`
--
ALTER TABLE `tbl_roles`
  MODIFY `role_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `tbl_rooms`
--
ALTER TABLE `tbl_rooms`
  MODIFY `room_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `tbl_schedule`
--
ALTER TABLE `tbl_schedule`
  MODIFY `schedule_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_schedule_operation_lookup`
--
ALTER TABLE `tbl_schedule_operation_lookup`
  MODIFY `operation_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3867;

--
-- AUTO_INCREMENT for table `tbl_school_instruments`
--
ALTER TABLE `tbl_school_instruments`
  MODIFY `school_instrument_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_service_providers`
--
ALTER TABLE `tbl_service_providers`
  MODIFY `service_provider_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_sessions`
--
ALTER TABLE `tbl_sessions`
  MODIFY `session_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `tbl_session_packages`
--
ALTER TABLE `tbl_session_packages`
  MODIFY `package_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `tbl_settings`
--
ALTER TABLE `tbl_settings`
  MODIFY `setting_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `tbl_specialization`
--
ALTER TABLE `tbl_specialization`
  MODIFY `specialization_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `tbl_students`
--
ALTER TABLE `tbl_students`
  MODIFY `student_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `tbl_student_guardians`
--
ALTER TABLE `tbl_student_guardians`
  MODIFY `student_guardian_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `tbl_student_instruments`
--
ALTER TABLE `tbl_student_instruments`
  MODIFY `student_instrument_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `tbl_student_progress`
--
ALTER TABLE `tbl_student_progress`
  MODIFY `progress_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_teachers`
--
ALTER TABLE `tbl_teachers`
  MODIFY `teacher_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `tbl_teacher_availability`
--
ALTER TABLE `tbl_teacher_availability`
  MODIFY `availability_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=50;

--
-- AUTO_INCREMENT for table `tbl_users`
--
ALTER TABLE `tbl_users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `tbl_enrollments`
--
ALTER TABLE `tbl_enrollments`
  ADD CONSTRAINT `fk_enroll_instrument` FOREIGN KEY (`instrument_id`) REFERENCES `tbl_instruments` (`instrument_id`),
  ADD CONSTRAINT `fk_enroll_student_guardian` FOREIGN KEY (`student_guardian_id`) REFERENCES `tbl_student_guardians` (`student_guardian_id`),
  ADD CONSTRAINT `fk_enrollment_session_package` FOREIGN KEY (`package_id`) REFERENCES `tbl_session_packages` (`package_id`),
  ADD CONSTRAINT `tbl_enrollments_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `tbl_students` (`student_id`);

--
-- Constraints for table `tbl_instruments`
--
ALTER TABLE `tbl_instruments`
  ADD CONSTRAINT `tbl_instruments_ibfk_1` FOREIGN KEY (`branch_id`) REFERENCES `tbl_branches` (`branch_id`),
  ADD CONSTRAINT `tbl_instruments_ibfk_2` FOREIGN KEY (`type_id`) REFERENCES `tbl_instrument_types` (`type_id`);

--
-- Constraints for table `tbl_makeup_sessions`
--
ALTER TABLE `tbl_makeup_sessions`
  ADD CONSTRAINT `tbl_makeup_sessions_ibfk_1` FOREIGN KEY (`original_session_id`) REFERENCES `tbl_sessions` (`session_id`),
  ADD CONSTRAINT `tbl_makeup_sessions_ibfk_2` FOREIGN KEY (`makeup_session_id`) REFERENCES `tbl_sessions` (`session_id`),
  ADD CONSTRAINT `tbl_makeup_sessions_ibfk_3` FOREIGN KEY (`teacher_id`) REFERENCES `tbl_teachers` (`teacher_id`);

--
-- Constraints for table `tbl_payments`
--
ALTER TABLE `tbl_payments`
  ADD CONSTRAINT `fk_payments_enrollment` FOREIGN KEY (`enrollment_id`) REFERENCES `tbl_enrollments` (`enrollment_id`) ON DELETE CASCADE;

--
-- Constraints for table `tbl_payment_schedule`
--
ALTER TABLE `tbl_payment_schedule`
  ADD CONSTRAINT `fk_payment_schedule_enrollment` FOREIGN KEY (`enrollment_id`) REFERENCES `tbl_enrollments` (`enrollment_id`) ON DELETE CASCADE;

--
-- Constraints for table `tbl_recitals`
--
ALTER TABLE `tbl_recitals`
  ADD CONSTRAINT `tbl_recitals_ibfk_1` FOREIGN KEY (`branch_id`) REFERENCES `tbl_branches` (`branch_id`),
  ADD CONSTRAINT `tbl_recitals_ibfk_2` FOREIGN KEY (`teacher_id`) REFERENCES `tbl_teachers` (`teacher_id`) ON DELETE SET NULL;

--
-- Constraints for table `tbl_recital_participants`
--
ALTER TABLE `tbl_recital_participants`
  ADD CONSTRAINT `tbl_recital_participants_ibfk_1` FOREIGN KEY (`recital_id`) REFERENCES `tbl_recitals` (`recital_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `tbl_recital_participants_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `tbl_students` (`student_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `tbl_recital_participants_ibfk_3` FOREIGN KEY (`guardian_id`) REFERENCES `tbl_guardians` (`guardian_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `tbl_recital_participants_ibfk_4` FOREIGN KEY (`instrument_id`) REFERENCES `tbl_instruments` (`instrument_id`) ON DELETE SET NULL;

--
-- Constraints for table `tbl_recurring_schedule`
--
ALTER TABLE `tbl_recurring_schedule`
  ADD CONSTRAINT `tbl_recurring_schedule_ibfk_1` FOREIGN KEY (`enrollment_id`) REFERENCES `tbl_enrollments` (`enrollment_id`),
  ADD CONSTRAINT `tbl_recurring_schedule_ibfk_2` FOREIGN KEY (`teacher_id`) REFERENCES `tbl_teachers` (`teacher_id`),
  ADD CONSTRAINT `tbl_recurring_schedule_ibfk_3` FOREIGN KEY (`room_id`) REFERENCES `tbl_rooms` (`room_id`);

--
-- Constraints for table `tbl_registration_payments`
--
ALTER TABLE `tbl_registration_payments`
  ADD CONSTRAINT `fk_registration_student` FOREIGN KEY (`student_id`) REFERENCES `tbl_students` (`student_id`) ON DELETE CASCADE;

--
-- Constraints for table `tbl_repairs`
--
ALTER TABLE `tbl_repairs`
  ADD CONSTRAINT `tbl_repairs_ibfk_1` FOREIGN KEY (`school_instrument_id`) REFERENCES `tbl_school_instruments` (`school_instrument_id`),
  ADD CONSTRAINT `tbl_repairs_ibfk_2` FOREIGN KEY (`service_provider_id`) REFERENCES `tbl_service_providers` (`service_provider_id`);

--
-- Constraints for table `tbl_rooms`
--
ALTER TABLE `tbl_rooms`
  ADD CONSTRAINT `tbl_rooms_ibfk_1` FOREIGN KEY (`branch_id`) REFERENCES `tbl_branches` (`branch_id`);

--
-- Constraints for table `tbl_schedule`
--
ALTER TABLE `tbl_schedule`
  ADD CONSTRAINT `tbl_schedule_ibfk_1` FOREIGN KEY (`branch_id`) REFERENCES `tbl_branches` (`branch_id`),
  ADD CONSTRAINT `tbl_schedule_ibfk_2` FOREIGN KEY (`teacher_id`) REFERENCES `tbl_teachers` (`teacher_id`),
  ADD CONSTRAINT `tbl_schedule_ibfk_3` FOREIGN KEY (`room_id`) REFERENCES `tbl_rooms` (`room_id`),
  ADD CONSTRAINT `tbl_schedule_ibfk_4` FOREIGN KEY (`enrollment_id`) REFERENCES `tbl_enrollments` (`enrollment_id`),
  ADD CONSTRAINT `tbl_schedule_ibfk_5` FOREIGN KEY (`session_id`) REFERENCES `tbl_sessions` (`session_id`);

--
-- Constraints for table `tbl_school_instruments`
--
ALTER TABLE `tbl_school_instruments`
  ADD CONSTRAINT `tbl_school_instruments_ibfk_1` FOREIGN KEY (`branch_id`) REFERENCES `tbl_branches` (`branch_id`),
  ADD CONSTRAINT `tbl_school_instruments_ibfk_2` FOREIGN KEY (`instrument_id`) REFERENCES `tbl_instruments` (`instrument_id`);

--
-- Constraints for table `tbl_sessions`
--
ALTER TABLE `tbl_sessions`
  ADD CONSTRAINT `fk_sessions_enrollment` FOREIGN KEY (`enrollment_id`) REFERENCES `tbl_enrollments` (`enrollment_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_sessions_room` FOREIGN KEY (`room_id`) REFERENCES `tbl_rooms` (`room_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `tbl_sessions_ibfk_2` FOREIGN KEY (`teacher_id`) REFERENCES `tbl_teachers` (`teacher_id`),
  ADD CONSTRAINT `tbl_sessions_ibfk_3` FOREIGN KEY (`instrument_id`) REFERENCES `tbl_instruments` (`instrument_id`),
  ADD CONSTRAINT `tbl_sessions_ibfk_4` FOREIGN KEY (`school_instrument_id`) REFERENCES `tbl_school_instruments` (`school_instrument_id`);

--
-- Constraints for table `tbl_settings`
--
ALTER TABLE `tbl_settings`
  ADD CONSTRAINT `tbl_settings_ibfk_1` FOREIGN KEY (`updated_by`) REFERENCES `tbl_users` (`user_id`) ON DELETE SET NULL;

--
-- Constraints for table `tbl_students`
--
ALTER TABLE `tbl_students`
  ADD CONSTRAINT `fk_students_session_package` FOREIGN KEY (`session_package_id`) REFERENCES `tbl_session_packages` (`package_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `tbl_students_ibfk_1` FOREIGN KEY (`branch_id`) REFERENCES `tbl_branches` (`branch_id`);

--
-- Constraints for table `tbl_student_guardians`
--
ALTER TABLE `tbl_student_guardians`
  ADD CONSTRAINT `tbl_student_guardians_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `tbl_students` (`student_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `tbl_student_guardians_ibfk_2` FOREIGN KEY (`guardian_id`) REFERENCES `tbl_guardians` (`guardian_id`) ON DELETE CASCADE;

--
-- Constraints for table `tbl_student_instruments`
--
ALTER TABLE `tbl_student_instruments`
  ADD CONSTRAINT `fk_student_instruments_instrument` FOREIGN KEY (`instrument_id`) REFERENCES `tbl_instruments` (`instrument_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_student_instruments_student` FOREIGN KEY (`student_id`) REFERENCES `tbl_students` (`student_id`) ON DELETE CASCADE;

--
-- Constraints for table `tbl_student_progress`
--
ALTER TABLE `tbl_student_progress`
  ADD CONSTRAINT `tbl_student_progress_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `tbl_students` (`student_id`),
  ADD CONSTRAINT `tbl_student_progress_ibfk_2` FOREIGN KEY (`session_id`) REFERENCES `tbl_sessions` (`session_id`),
  ADD CONSTRAINT `tbl_student_progress_ibfk_3` FOREIGN KEY (`instrument_id`) REFERENCES `tbl_instruments` (`instrument_id`);

--
-- Constraints for table `tbl_teachers`
--
ALTER TABLE `tbl_teachers`
  ADD CONSTRAINT `tbl_teachers_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `tbl_users` (`user_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `tbl_teachers_ibfk_2` FOREIGN KEY (`branch_id`) REFERENCES `tbl_branches` (`branch_id`);

--
-- Constraints for table `tbl_teacher_availability`
--
ALTER TABLE `tbl_teacher_availability`
  ADD CONSTRAINT `tbl_teacher_availability_ibfk_1` FOREIGN KEY (`teacher_id`) REFERENCES `tbl_teachers` (`teacher_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `tbl_teacher_availability_ibfk_2` FOREIGN KEY (`branch_id`) REFERENCES `tbl_branches` (`branch_id`);

--
-- Constraints for table `tbl_teacher_specializations`
--
ALTER TABLE `tbl_teacher_specializations`
  ADD CONSTRAINT `tbl_teacher_specializations_ibfk_1` FOREIGN KEY (`teacher_id`) REFERENCES `tbl_teachers` (`teacher_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `tbl_teacher_specializations_ibfk_2` FOREIGN KEY (`specialization_id`) REFERENCES `tbl_specialization` (`specialization_id`);

--
-- Constraints for table `tbl_users`
--
ALTER TABLE `tbl_users`
  ADD CONSTRAINT `tbl_users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `tbl_roles` (`role_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
