-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Mar 10, 2026 at 08:37 AM
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
-- Create database for easier import
--
CREATE DATABASE IF NOT EXISTS `music-db1`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;
USE `music-db1`;

--
-- Database: `music-db`
--

-- --------------------------------------------------------

--
-- Table structure for table `backup_tbl_student_registration_fees`
--

CREATE TABLE `backup_tbl_student_registration_fees` (
  `registration_id` int(11) NOT NULL DEFAULT 0,
  `student_id` int(11) NOT NULL,
  `registration_fee_amount` decimal(10,2) NOT NULL DEFAULT 1000.00,
  `registration_fee_paid` decimal(10,2) NOT NULL DEFAULT 0.00,
  `registration_status` enum('Pending','Fee Paid','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `backup_tbl_student_registration_fees`
--

INSERT INTO `backup_tbl_student_registration_fees` (`registration_id`, `student_id`, `registration_fee_amount`, `registration_fee_paid`, `registration_status`, `notes`, `created_at`) VALUES
(1, 1, 1000.00, 1000.00, 'Approved', 'Backfilled from tbl_students', '2026-02-21 02:03:36'),
(2, 2, 1000.00, 1000.00, 'Approved', 'Backfilled from tbl_students', '2026-02-21 02:03:36'),
(3, 3, 1000.00, 1000.00, 'Approved', 'Seeded approved fee', '2026-02-21 03:25:00'),
(4, 4, 1000.00, 1000.00, 'Approved', 'Seeded approved fee', '2026-02-21 03:25:00');

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
(1, 'TEST BRANCH', 'Test', '1231', 'asd@gmaol.com', 'Inactive', '2026-02-20 16:23:23'),
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
  `preferred_schedule` text DEFAULT NULL,
  `request_notes` text DEFAULT NULL,
  `enrollment_date` date DEFAULT curdate(),
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `status` enum('Pending','Active','Completed','Cancelled','Expired') DEFAULT 'Pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `enrolled_by_type` enum('Self','Guardian') NOT NULL DEFAULT 'Self',
  `student_guardian_id` int(11) DEFAULT NULL,
  `total_sessions` int(11) NOT NULL,
  `completed_sessions` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_enrollments`
--

INSERT INTO `tbl_enrollments` (`enrollment_id`, `student_id`, `package_id`, `instrument_id`, `preferred_schedule`, `request_notes`, `enrollment_date`, `start_date`, `end_date`, `status`, `created_at`, `enrolled_by_type`, `student_guardian_id`, `total_sessions`, `completed_sessions`) VALUES
(8, 2, 1, NULL, NULL, NULL, '2026-02-21', '2026-02-23', '2026-05-11', 'Active', '2026-02-20 18:27:03', 'Self', NULL, 12, 0),
(9, 2, 1, NULL, NULL, NULL, '2026-02-21', '2026-02-22', '2026-05-10', 'Active', '2026-02-21 00:35:03', 'Self', NULL, 12, 0),
(10, 3, 6, 10, 'Tuesday|2026-02-24', '{\"payment_type\":\"Partial Payment\",\"instrument_ids\":[10,11],\"payment_proof_path\":null}', '2026-02-21', NULL, NULL, 'Pending', '2026-02-21 04:10:00', 'Self', NULL, 8, 0),
(11, 4, 10, 13, 'Thursday|2026-02-26', '{\"payment_type\":\"Full Payment\",\"instrument_ids\":[13],\"payment_proof_path\":null,\"admin_notes\":\"hays\"}', '2026-02-21', NULL, NULL, 'Cancelled', '2026-02-21 04:20:00', 'Self', NULL, 16, 0);

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
(4, 1, 'Yamaha na piano', 23, '23232', 'Good', 'Available'),
(5, 1, 'Yamaha U1 Piano', 23, 'P-1001', 'Excellent', 'Available'),
(6, 1, 'Fender Stratocaster', 24, 'G-1001', 'Good', 'Inactive'),
(7, 1, 'Pearl Export Drum Kit', 29, 'D-1001', 'Good', 'In Use'),
(8, 1, 'Suzuki Violin 4/4', 28, 'V-1001', 'Excellent', 'Available'),
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
(1, 1, '2026-02-21', 1000.00, 'Other', 'Paid', 'MIG-REG-1'),
(2, 2, '2026-02-21', 1000.00, 'Other', 'Paid', 'MIG-REG-2'),
(3, 3, '2026-02-21', 1000.00, 'Other', 'Paid', 'MIG-REG-3'),
(4, 4, '2026-02-21', 1000.00, 'Other', 'Paid', 'MIG-REG-4'),
(8, 1, '2026-02-23', 100.00, 'Cash', 'Paid', 'REG-1771836808'),
(9, 5, '2026-02-23', 0.00, 'Other', 'Pending', 'REG-PROOF-1771838177'),
(10, 6, '2026-02-26', 0.00, 'Other', 'Pending', 'REG-PROOF-1772065922'),
(11, 6, '2026-02-26', 1000.00, 'Cash', 'Paid', 'REG-1772065983'),
(14, 9, '2026-03-10', 1000.00, 'Other', 'Paid', 'REG-AUTO-1773122863'),
(15, 10, '2026-03-10', 1000.00, 'Other', 'Paid', 'REG-AUTO-1773124692');

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
(1, 1, 'Studio A', 2, 'Private Lesson', 'Available', '2026-02-21 03:00:00'),
(2, 1, 'Studio B', 2, 'Private Lesson', 'Available', '2026-02-21 03:00:00'),
(3, 1, 'Recital Hall A', 30, 'Recital Hall', 'Available', '2026-02-21 03:00:00'),
(4, 5, 'Downtown Room 1', 2, 'Private Lesson', 'Available', '2026-02-21 03:00:00'),
(5, 5, 'Downtown Group Room', 5, 'Group Room', 'Available', '2026-02-21 03:00:00'),
(6, 6, 'Uptown Studio 1', 2, 'Private Lesson', 'Available', '2026-02-21 03:00:00'),
(7, 6, 'Uptown Hall', 20, 'Recital Hall', 'Available', '2026-02-21 03:00:00');

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
  `status` enum('Scheduled','Completed','Cancelled','No Show','Late') DEFAULT 'Scheduled',
  `attendance_notes` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_sessions`
--

INSERT INTO `tbl_sessions` (`session_id`, `enrollment_id`, `teacher_id`, `session_number`, `session_date`, `start_time`, `end_time`, `session_type`, `instrument_id`, `school_instrument_id`, `room_id`, `status`, `attendance_notes`, `notes`, `created_at`) VALUES
(1, 8, 1, 1, '2026-02-23', '14:00:00', '15:00:00', 'Regular', 4, NULL, NULL, 'Scheduled', NULL, 'room 2', '2026-02-20 18:27:31'),
(2, 9, 1, 1, '2026-02-22', '14:00:00', '15:00:00', 'Regular', 4, NULL, NULL, 'Scheduled', NULL, 'room 2', '2026-02-21 00:40:44');

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
(1, 1, 'Basic (12 Sessions)', 12, 1, 7450.00, '1 instrument only', '2026-02-20 16:00:25'),
(6, 5, 'Starter (8 Sessions)', 8, 1, 5200.00, 'Entry package for one instrument', '2026-02-21 03:10:00'),
(7, 5, 'Standard (16 Sessions)', 16, 2, 9800.00, 'Balanced package for two instruments', '2026-02-21 03:10:00'),
(8, 5, 'Performance Track (24 Sessions)', 24, 3, 14500.00, 'Intensive package for performance prep', '2026-02-21 03:10:00'),
(9, 6, 'Starter (8 Sessions)', 8, 1, 5400.00, 'Entry package for one instrument', '2026-02-21 03:11:00'),
(10, 6, 'Standard (16 Sessions)', 16, 2, 10200.00, 'Balanced package for two instruments', '2026-02-21 03:11:00'),
(11, 6, 'Intensive (24 Sessions)', 24, 3, 15000.00, 'High-frequency training package', '2026-02-21 03:11:00');

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
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `session_package_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_students`
--

INSERT INTO `tbl_students` (`student_id`, `branch_id`, `first_name`, `last_name`, `middle_name`, `date_of_birth`, `age`, `phone`, `email`, `address`, `school`, `grade_year`, `health_diagnosis`, `status`, `created_at`, `session_package_id`) VALUES
(1, 1, 'Lenard', 'Laurente', 'James Tingas', '2000-02-02', 26, '123123', 'enti@phinmaed.com', 'phinma cagayan de oro college, max suiniel street, carmen, 9000 cagayan de oro city misamis oriental', NULL, '12', 'none ', 'Active', '2026-02-20 16:34:46', NULL),
(2, 1, 'Lenard', 'Laurente', 'James Tingas', '2000-02-02', 26, '123123', 'lenard@phinmaed.com', 'phinma cagayan de oro college, max suiniel street, carmen, 9000 cagayan de oro city misamis oriental', NULL, '12', 'none ', 'Active', '2026-02-20 16:39:13', 1),
(3, 5, 'Anna', 'Dela Cruz', NULL, '2010-04-15', 15, '09171234567', 'anna.delacruz@fas.local', 'Carmen, Cagayan de Oro', 'St. Mary School', 'Grade 9', NULL, 'Active', '2026-02-21 03:20:00', NULL),
(4, 6, 'Miguel', 'Santos', NULL, '2008-09-10', 17, '09179876543', 'miguel.santos@fas.local', 'Uptown, Cagayan de Oro', 'Xavier Academy', 'Grade 11', NULL, 'Active', '2026-02-21 03:22:00', NULL),
(5, 5, 'Micah', 'Lago', 'Dusil', '2000-02-16', 26, '09659153090', 'midu.lago.coc@phinmaed.com', 'zone 3 upper, Brgy. Bulua, Cagayan de Oro City, Misamis Oriental', 'COC', '3rd year ', 'none', 'Inactive', '2026-02-23 09:16:17', NULL),
(6, 5, 'Micah', 'Lago', '', '2000-02-02', 26, '09659153090', 'micah@gmail.com', 'zone 3 upper, Brgy. Bulua, Cagayan de Oro City, Misamis Oriental', 'COC', '3rd year ', '', 'Active', '2026-02-26 00:32:02', NULL),
(9, 5, 'arman', 'salon', '', '2003-02-10', 23, '0129391023123', 'arman@gmail.com', 'asdasdasd', NULL, '3rd year ', 'asdasd', 'Active', '2026-03-10 06:07:43', NULL),
(10, 5, 'test', 'test', '', '2003-02-09', 23, 'none', 'test3@gmail.com', 'asd', NULL, 'asd', 'none ', 'Active', '2026-03-10 06:38:12', 8);

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
(3, 2, 4, 1, '2026-02-21 00:40:44');

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
(1, NULL, 1, 'Test', 'Piano', 'test.piano@fas.local', '09170000001', 'Full-time', 'Active', '2026-02-20 18:14:00'),
(2, NULL, 1, 'Test', 'Guitar', 'test.guitar@fas.local', '09170000002', 'Part-time', 'Active', '2026-02-20 18:14:00'),
(3, NULL, 5, 'Aira', 'Santos', 'aira.santos@fas.local', '09170000003', 'Full-time', 'Active', '2026-02-21 03:30:00'),
(4, NULL, 5, 'Marco', 'Reyes', 'marco.reyes@fas.local', '09170000004', 'Part-time', 'Active', '2026-02-21 03:30:00'),
(5, NULL, 6, 'Nina', 'Uy', 'nina.uy@fas.local', '09170000005', 'Full-time', 'Active', '2026-02-21 03:31:00'),
(6, NULL, 6, 'John', 'Tan', 'john.tan@fas.local', '09170000006', 'Part-time', 'Active', '2026-02-21 03:31:00');

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
(1, 1, 1, 'Monday', '09:00:00', '17:00:00', 'Available', '2026-02-20 18:14:00'),
(2, 2, 1, 'Monday', '09:00:00', '17:00:00', 'Available', '2026-02-20 18:14:00'),
(3, 1, 1, 'Wednesday', '09:00:00', '17:00:00', 'Available', '2026-02-20 18:14:00'),
(4, 2, 1, 'Wednesday', '09:00:00', '17:00:00', 'Available', '2026-02-20 18:14:00'),
(5, 1, 1, 'Friday', '09:00:00', '17:00:00', 'Available', '2026-02-20 18:14:00'),
(6, 2, 1, 'Friday', '09:00:00', '17:00:00', 'Available', '2026-02-20 18:14:00'),
(7, 3, 5, 'Tuesday', '10:00:00', '18:00:00', 'Available', '2026-02-21 03:32:00'),
(8, 4, 5, 'Tuesday', '10:00:00', '18:00:00', 'Available', '2026-02-21 03:32:00'),
(9, 3, 5, 'Thursday', '10:00:00', '18:00:00', 'Available', '2026-02-21 03:32:00'),
(10, 4, 5, 'Thursday', '10:00:00', '18:00:00', 'Available', '2026-02-21 03:32:00'),
(11, 3, 5, 'Saturday', '09:00:00', '17:00:00', 'Available', '2026-02-21 03:32:00'),
(12, 4, 5, 'Saturday', '09:00:00', '17:00:00', 'Available', '2026-02-21 03:32:00'),
(13, 5, 6, 'Monday', '10:00:00', '18:00:00', 'Available', '2026-02-21 03:33:00'),
(14, 6, 6, 'Monday', '10:00:00', '18:00:00', 'Available', '2026-02-21 03:33:00'),
(15, 5, 6, 'Wednesday', '10:00:00', '18:00:00', 'Available', '2026-02-21 03:33:00'),
(16, 6, 6, 'Wednesday', '10:00:00', '18:00:00', 'Available', '2026-02-21 03:33:00'),
(17, 5, 6, 'Friday', '10:00:00', '18:00:00', 'Available', '2026-02-21 03:33:00'),
(18, 6, 6, 'Friday', '10:00:00', '18:00:00', 'Available', '2026-02-21 03:33:00');

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
(1, 1),
(2, 2),
(3, 1),
(4, 2),
(5, 1),
(6, 3);

-- --------------------------------------------------------

--
-- Table structure for table `tbl_users`
--

CREATE TABLE `tbl_users` (
  `user_id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role_id` int(11) NOT NULL,
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

INSERT INTO `tbl_users` (`user_id`, `username`, `password`, `role_id`, `first_name`, `last_name`, `email`, `phone`, `status`, `created_at`) VALUES
(1, 'fasadmin@music.com', '$2y$10$.FZqFS/PLmwEinoUEAWfh.70K3ibcQcTrC0qMyh3kjtNqZGZ8UB6W', 1, 'FAS', 'Administrator', 'fasadmin@music.com', NULL, 'Active', '2026-02-20 15:52:18'),
(2, 'lenard@phinmaed.com', '$2y$10$kQjaOc66Iv6pTykUtGOouu.6O1K2O3I7L88hpgR/ce5EBS8I5eA/K', 4, 'Lenard', 'Laurente', 'lenard@phinmaed.com', '123123', 'Active', '2026-02-20 16:39:13'),
(3, 'midu.lago.coc@phinmaed.com', '$2y$10$1pkBXU7RsVKgs9lp8tegkeN6s3Oy8zPU0.jnKVyDasOIWPk7GXLje', 4, 'Micah', 'Lago', 'midu.lago.coc@phinmaed.com', '09659153090', 'Inactive', '2026-02-23 09:16:17'),
(4, 'micah@gmail.com', '$2y$10$p7GUBbweXBx0juGbXX5FJOZOVq2RpAgQHuWkNdtd/0CFJQ9E9NZzC', 4, 'Micah', 'Lago', 'micah@gmail.com', '09659153090', 'Active', '2026-02-26 00:32:02'),
(7, 'arman@gmail.com', '$2y$10$qwlDMuqkXNEO7cnbYIPn1ORtYw4cwnbtQ1z7WNUP5qAp/2txTLSf2', 4, 'arman', 'salon', 'arman@gmail.com', '0129391023123', 'Active', '2026-03-10 06:07:43'),
(8, 'test3@gmail.com', '$2y$10$qOdJu2702RWZ7EmY55eMu.aTWoxrSZpKDmpkzOblt823DvHTBi7gi', 4, 'test', 'test', 'test3@gmail.com', 'none', 'Active', '2026-03-10 06:38:12');

--
-- --------------------------------------------------------

--
-- Table structure for table `tbl_attendance`
--

CREATE TABLE `tbl_attendance` (
  `attendance_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `attended_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` enum('Present','Absent','Late','Excused') NOT NULL DEFAULT 'Present',
  `source` varchar(30) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tbl_lesson_packages`
--

CREATE TABLE `tbl_lesson_packages` (
  `package_id` int(11) NOT NULL,
  `branch_id` int(11) DEFAULT NULL,
  `package_name` varchar(100) NOT NULL,
  `total_sessions` int(11) NOT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `description` text DEFAULT NULL,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tbl_student_package_requests`
--

CREATE TABLE `tbl_student_package_requests` (
  `request_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `branch_id` int(11) NOT NULL,
  `package_id` int(11) NOT NULL,
  `instrument_ids_json` text DEFAULT NULL,
  `selected_availability_id` int(11) DEFAULT NULL,
  `preferred_date` date DEFAULT NULL,
  `preferred_day_of_week` enum('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') DEFAULT NULL,
  `preferred_start_time` time DEFAULT NULL,
  `preferred_end_time` time DEFAULT NULL,
  `assigned_teacher_id` int(11) DEFAULT NULL,
  `payment_proof_path` varchar(255) DEFAULT NULL,
  `assigned_date` date DEFAULT NULL,
  `assigned_day_of_week` enum('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') DEFAULT NULL,
  `assigned_start_time` time DEFAULT NULL,
  `assigned_end_time` time DEFAULT NULL,
  `assigned_room` varchar(100) DEFAULT NULL,
  `requested_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `payment_type` enum('Full Payment','Partial Payment','Installment') NOT NULL DEFAULT 'Partial Payment',
  `status` enum('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  `admin_notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tbl_enrollment_core`
--

CREATE TABLE `tbl_enrollment_core` (
  `enrollment_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `package_id` int(11) NOT NULL,
  `instrument_id` int(11) NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `enrollment_date` date DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `status` enum('Pending Payment','Ongoing','Completed','Cancelled') NOT NULL DEFAULT 'Pending Payment',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tbl_enrollment_registration`
--

CREATE TABLE `tbl_enrollment_registration` (
  `enrollment_id` int(11) NOT NULL,
  `registration_fee_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `registration_fee_paid` decimal(10,2) NOT NULL DEFAULT 0.00,
  `registration_status` enum('Unpaid','Partial','Paid') NOT NULL DEFAULT 'Unpaid'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tbl_enrollment_financials`
--

CREATE TABLE `tbl_enrollment_financials` (
  `enrollment_id` int(11) NOT NULL,
  `total_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `paid_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `payment_deadline_session` int(11) NOT NULL DEFAULT 7
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

-- Indexes for dumped tables
--

--
-- Indexes for table `tbl_branches`
--
ALTER TABLE `tbl_branches`
  ADD PRIMARY KEY (`branch_id`);

--
-- Indexes for table `tbl_attendance`
--
ALTER TABLE `tbl_attendance`
  ADD PRIMARY KEY (`attendance_id`),
  ADD KEY `idx_attendance_student` (`student_id`),
  ADD KEY `idx_attendance_date` (`attended_at`);

--
-- Indexes for table `tbl_lesson_packages`
--
ALTER TABLE `tbl_lesson_packages`
  ADD PRIMARY KEY (`package_id`),
  ADD KEY `idx_lesson_packages_branch` (`branch_id`),
  ADD KEY `idx_lesson_packages_status` (`status`);

--
-- Indexes for table `tbl_student_package_requests`
--
ALTER TABLE `tbl_student_package_requests`
  ADD PRIMARY KEY (`request_id`),
  ADD KEY `idx_student_package_requests_student` (`student_id`),
  ADD KEY `idx_student_package_requests_status` (`status`),
  ADD KEY `idx_student_package_requests_created` (`created_at`),
  ADD KEY `idx_student_package_requests_teacher` (`assigned_teacher_id`),
  ADD KEY `idx_student_package_requests_assigned_date` (`assigned_date`);

--
-- Indexes for table `tbl_enrollment_core`
--
ALTER TABLE `tbl_enrollment_core`
  ADD PRIMARY KEY (`enrollment_id`);

--
-- Indexes for table `tbl_enrollment_registration`
--
ALTER TABLE `tbl_enrollment_registration`
  ADD PRIMARY KEY (`enrollment_id`);

--
-- Indexes for table `tbl_enrollment_financials`
--
ALTER TABLE `tbl_enrollment_financials`
  ADD PRIMARY KEY (`enrollment_id`);

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
  ADD UNIQUE KEY `unique_session_per_enrollment` (`enrollment_id`,`session_number`),
  ADD KEY `teacher_id` (`teacher_id`),
  ADD KEY `instrument_id` (`instrument_id`),
  ADD KEY `school_instrument_id` (`school_instrument_id`),
  ADD KEY `room_id` (`room_id`),
  ADD KEY `idx_sessions_enrollment` (`enrollment_id`),
  ADD KEY `idx_sessions_date` (`session_date`),
  ADD KEY `idx_sessions_status` (`status`);

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
-- AUTO_INCREMENT for table `tbl_branches`
--
ALTER TABLE `tbl_branches`
  MODIFY `branch_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `tbl_attendance`
--
ALTER TABLE `tbl_attendance`
  MODIFY `attendance_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_lesson_packages`
--
ALTER TABLE `tbl_lesson_packages`
  MODIFY `package_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_student_package_requests`
--
ALTER TABLE `tbl_student_package_requests`
  MODIFY `request_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_enrollments`
--
ALTER TABLE `tbl_enrollments`
  MODIFY `enrollment_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `tbl_guardians`
--
ALTER TABLE `tbl_guardians`
  MODIFY `guardian_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_instruments`
--
ALTER TABLE `tbl_instruments`
  MODIFY `instrument_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `tbl_instrument_types`
--
ALTER TABLE `tbl_instrument_types`
  MODIFY `type_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=50;

--
-- AUTO_INCREMENT for table `tbl_makeup_sessions`
--
ALTER TABLE `tbl_makeup_sessions`
  MODIFY `makeup_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_payments`
--
ALTER TABLE `tbl_payments`
  MODIFY `payment_id` int(11) NOT NULL AUTO_INCREMENT;

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
  MODIFY `registration_payment_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `tbl_repairs`
--
ALTER TABLE `tbl_repairs`
  MODIFY `repair_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_roles`
--
ALTER TABLE `tbl_roles`
  MODIFY `role_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `tbl_rooms`
--
ALTER TABLE `tbl_rooms`
  MODIFY `room_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `tbl_schedule`
--
ALTER TABLE `tbl_schedule`
  MODIFY `schedule_id` int(11) NOT NULL AUTO_INCREMENT;

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
  MODIFY `session_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `tbl_session_packages`
--
ALTER TABLE `tbl_session_packages`
  MODIFY `package_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

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
  MODIFY `student_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `tbl_student_guardians`
--
ALTER TABLE `tbl_student_guardians`
  MODIFY `student_guardian_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_student_instruments`
--
ALTER TABLE `tbl_student_instruments`
  MODIFY `student_instrument_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `tbl_student_progress`
--
ALTER TABLE `tbl_student_progress`
  MODIFY `progress_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_teachers`
--
ALTER TABLE `tbl_teachers`
  MODIFY `teacher_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `tbl_teacher_availability`
--
ALTER TABLE `tbl_teacher_availability`
  MODIFY `availability_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `tbl_users`
--
ALTER TABLE `tbl_users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `tbl_attendance`
--
ALTER TABLE `tbl_attendance`
  ADD CONSTRAINT `tbl_attendance_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `tbl_students` (`student_id`) ON DELETE CASCADE;

--
-- Constraints for table `tbl_lesson_packages`
--
ALTER TABLE `tbl_lesson_packages`
  ADD CONSTRAINT `tbl_lesson_packages_ibfk_1` FOREIGN KEY (`branch_id`) REFERENCES `tbl_branches` (`branch_id`) ON DELETE SET NULL;

--
-- Constraints for table `tbl_student_package_requests`
--
ALTER TABLE `tbl_student_package_requests`
  ADD CONSTRAINT `tbl_student_package_requests_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `tbl_students` (`student_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `tbl_student_package_requests_ibfk_2` FOREIGN KEY (`branch_id`) REFERENCES `tbl_branches` (`branch_id`),
  ADD CONSTRAINT `tbl_student_package_requests_ibfk_3` FOREIGN KEY (`package_id`) REFERENCES `tbl_session_packages` (`package_id`),
  ADD CONSTRAINT `tbl_student_package_requests_ibfk_4` FOREIGN KEY (`assigned_teacher_id`) REFERENCES `tbl_teachers` (`teacher_id`) ON DELETE SET NULL;

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
