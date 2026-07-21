-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jul 20, 2026 at 05:25 AM
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
(1, 61, 6, '2026-06-09 06:25:11', 'Present', 'QR', NULL),
(2, 66, 6, '2026-06-09 08:19:32', 'Present', 'QR', NULL),
(3, 71, 5, '2026-06-24 08:31:26', 'Present', 'QR', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `tbl_audit_logs`
--

CREATE TABLE `tbl_audit_logs` (
  `log_id` int(10) UNSIGNED NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `user_name` varchar(120) DEFAULT NULL,
  `user_role` varchar(60) DEFAULT NULL,
  `user_email` varchar(255) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `module` varchar(80) NOT NULL DEFAULT 'General',
  `target_type` varchar(80) DEFAULT NULL,
  `target_table` varchar(100) DEFAULT NULL,
  `target_id` int(11) DEFAULT NULL,
  `target_label` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
  `old_value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_value`)),
  `new_value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_value`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(512) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_audit_logs`
--

INSERT INTO `tbl_audit_logs` (`log_id`, `user_id`, `user_name`, `user_role`, `user_email`, `action`, `module`, `target_type`, `target_table`, `target_id`, `target_label`, `description`, `severity`, `old_value`, `new_value`, `ip_address`, `user_agent`, `created_at`) VALUES
(1, 1, 'admin@fas.com', 'admin', 'admin@fas.com', 'Admin Login', 'Users', 'user', 'user', 1, 'admin@fas.com', 'Administrator logged in successfully.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:17'),
(2, 2, 'manager@fas.com', 'manager', 'manager@fas.com', 'Student Approved', 'Registrations', 'student', 'student', 5, 'Juan dela Cruz', 'Registration approved for Juan dela Cruz.', 'info', '{\"status\":\"Pending\"}', '{\"status\":\"Active\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:17'),
(3, 3, 'desk.staff@fas.com', 'staff', 'desk.staff@fas.com', 'Payment Confirmed', 'Payments', 'payment', 'payment', 12, 'Maria Santos', 'Payment of ₱7,450.00 confirmed for Maria Santos.', 'info', NULL, '{\"amount\":7450,\"method\":\"GCash\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:17'),
(4, 1, 'admin@fas.com', 'admin', 'admin@fas.com', 'Session Cancelled', 'Sessions', 'session', 'session', 34, 'Session #34', 'Session #34 cancelled by teacher — needs rescheduling.', 'warning', '{\"status\":\"Scheduled\"}', '{\"status\":\"Cancelled\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:17'),
(5, 2, 'manager@fas.com', 'manager', 'manager@fas.com', 'User Role Changed', 'Users', 'user', 'user', 8, 'desk.staff@fas.com', 'User role updated from Staff to Manager.', 'warning', '{\"role\":\"Staff\"}', '{\"role\":\"Manager\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:17'),
(6, 3, 'desk.staff@fas.com', 'staff', 'desk.staff@fas.com', 'Student Rejected', 'Registrations', 'student', 'student', 7, 'Pedro Reyes', 'Registration rejected — incomplete documents submitted.', 'warning', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:17'),
(7, 1, 'admin@fas.com', 'admin', 'admin@fas.com', 'Unauthorized Access', 'General', NULL, NULL, NULL, NULL, 'Failed login attempt detected from IP 192.168.1.100.', 'critical', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:17'),
(8, 2, 'manager@fas.com', 'manager', 'manager@fas.com', 'Bulk Session Generated', 'Sessions', 'enrollment', 'enrollment', 88, 'Enrollment #88', '12 sessions generated for enrollment #88.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:17'),
(9, 3, 'desk.staff@fas.com', 'staff', 'desk.staff@fas.com', 'Teacher Assigned', 'Teachers', 'enrollment', 'enrollment', 91, 'Enrollment #91', 'Teacher Messi Hersomach assigned to enrollment #91.', 'info', '{\"teacher\":null}', '{\"teacher\":\"Messi Hersomach\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:17'),
(10, 1, 'admin@fas.com', 'admin', 'admin@fas.com', 'Package Created', 'Packages', 'package', 'package', 3, '12 Session Premium', 'New package \"12 Session Premium\" created.', 'info', NULL, '{\"sessions\":12,\"price\":7450}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:17'),
(11, 2, 'manager@fas.com', 'manager', 'manager@fas.com', 'Enrollment Activated', 'Enrollments', 'enrollment', 'enrollment', 45, 'Ana Garcia', 'Enrollment activated for Ana Garcia — Guitar package.', 'info', '{\"status\":\"Pending\"}', '{\"status\":\"Active\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:17'),
(12, 3, 'desk.staff@fas.com', 'staff', 'desk.staff@fas.com', 'Password Reset', 'Users', 'user', 'user', 8, 'desk.staff@fas.com', 'Password reset triggered for user desk.staff@fas.com.', 'warning', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:17'),
(13, 1, 'admin@fas.com', 'admin', 'admin@fas.com', 'Branch Created', 'Branches', 'branch', 'branch', 2, 'SM Uptown', 'New branch \"SM Uptown\" created successfully.', 'info', NULL, '{\"branch_name\":\"SM Uptown\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:17'),
(14, 2, 'manager@fas.com', 'manager', 'manager@fas.com', 'Critical DB Error', 'General', NULL, NULL, NULL, NULL, 'Database backup failed — storage quota exceeded.', 'critical', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:17'),
(15, 3, 'desk.staff@fas.com', 'staff', 'desk.staff@fas.com', 'Report Exported', 'Reports', NULL, NULL, NULL, NULL, 'Monthly revenue report exported to CSV.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:17'),
(16, 1, 'admin@fas.com', 'admin', 'admin@fas.com', 'Admin Login', 'Users', 'user', 'user', 1, 'admin@fas.com', 'Administrator logged in successfully.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:54'),
(17, 2, 'manager@fas.com', 'manager', 'manager@fas.com', 'Student Approved', 'Registrations', 'student', 'student', 5, 'Juan dela Cruz', 'Registration approved for Juan dela Cruz.', 'info', '{\"status\":\"Pending\"}', '{\"status\":\"Active\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:54'),
(18, 3, 'desk.staff@fas.com', 'staff', 'desk.staff@fas.com', 'Payment Confirmed', 'Payments', 'payment', 'payment', 12, 'Maria Santos', 'Payment of ₱7,450.00 confirmed for Maria Santos.', 'info', NULL, '{\"amount\":7450,\"method\":\"GCash\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:54'),
(19, 1, 'admin@fas.com', 'admin', 'admin@fas.com', 'Session Cancelled', 'Sessions', 'session', 'session', 34, 'Session #34', 'Session #34 cancelled by teacher — needs rescheduling.', 'warning', '{\"status\":\"Scheduled\"}', '{\"status\":\"Cancelled\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:54'),
(20, 2, 'manager@fas.com', 'manager', 'manager@fas.com', 'User Role Changed', 'Users', 'user', 'user', 8, 'desk.staff@fas.com', 'User role updated from Staff to Manager.', 'warning', '{\"role\":\"Staff\"}', '{\"role\":\"Manager\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:54'),
(21, 3, 'desk.staff@fas.com', 'staff', 'desk.staff@fas.com', 'Student Rejected', 'Registrations', 'student', 'student', 7, 'Pedro Reyes', 'Registration rejected — incomplete documents submitted.', 'warning', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:54'),
(22, 1, 'admin@fas.com', 'admin', 'admin@fas.com', 'Unauthorized Access', 'General', NULL, NULL, NULL, NULL, 'Failed login attempt detected from IP 192.168.1.100.', 'critical', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:54'),
(23, 2, 'manager@fas.com', 'manager', 'manager@fas.com', 'Bulk Session Generated', 'Sessions', 'enrollment', 'enrollment', 88, 'Enrollment #88', '12 sessions generated for enrollment #88.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:54'),
(26, 2, 'manager@fas.com', 'manager', 'manager@fas.com', 'Enrollment Activated', 'Enrollments', 'enrollment', 'enrollment', 45, 'Ana Garcia', 'Enrollment activated for Ana Garcia — Guitar package.', 'info', '{\"status\":\"Pending\"}', '{\"status\":\"Active\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:54'),
(27, 3, 'desk.staff@fas.com', 'staff', 'desk.staff@fas.com', 'Password Reset', 'Users', 'user', 'user', 8, 'desk.staff@fas.com', 'Password reset triggered for user desk.staff@fas.com.', 'warning', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:54'),
(28, 1, 'admin@fas.com', 'admin', 'admin@fas.com', 'Branch Created', 'Branches', 'branch', 'branch', 2, 'SM Uptown', 'New branch \"SM Uptown\" created successfully.', 'info', NULL, '{\"branch_name\":\"SM Uptown\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:54'),
(29, 2, 'manager@fas.com', 'manager', 'manager@fas.com', 'Critical DB Error', 'General', NULL, NULL, NULL, NULL, 'Database backup failed — storage quota exceeded.', 'critical', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:54'),
(30, 3, 'desk.staff@fas.com', 'staff', 'desk.staff@fas.com', 'Report Exported', 'Reports', NULL, NULL, NULL, NULL, 'Monthly revenue report exported to CSV.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-14 18:48:54'),
(31, 7, 'deskup1@gmail.com', 'Staff', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-17 16:56:12'),
(32, 93, 'silentqie01@gmail.com', 'Student', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-18 01:04:13'),
(33, 93, 'silentqie01@gmail.com', 'Student', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'User was warned of session expiry and did not respond or chose to log out.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-18 01:04:14'),
(34, 9, 'branchup1@gmail.com', 'Manager', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-18 01:33:09'),
(35, 9, 'branchup1@gmail.com', 'Manager', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'User was warned of session expiry and did not respond or chose to log out.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-18 01:33:10'),
(36, 9, 'branchup1@gmail.com', 'Manager', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'User was warned of session expiry and did not respond or chose to log out.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-19 12:04:08'),
(37, 9, 'branchup1@gmail.com', 'Manager', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-19 12:04:08'),
(38, 9, 'branchup1@gmail.com', 'Manager', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-20 14:33:38'),
(39, NULL, NULL, NULL, NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'User was warned of session expiry and did not respond or chose to log out.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-20 21:13:05'),
(40, 7, 'deskup1@gmail.com', 'Staff', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-20 21:13:05'),
(41, 7, 'deskup1@gmail.com', 'Staff', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'User was warned of session expiry and did not respond or chose to log out.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-20 21:13:05'),
(42, 1, 'fasadmin@music.com', 'Admin', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-20 21:57:08'),
(43, NULL, NULL, NULL, NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'User was warned of session expiry and did not respond or chose to log out.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-20 21:57:09'),
(44, 7, 'deskup1@gmail.com', 'Staff', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0', '2026-06-20 23:36:24'),
(45, 8, 'deskdown1@gmail.com', 'Staff', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-21 23:33:50'),
(46, 8, 'deskdown1@gmail.com', 'Staff', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-23 17:36:43'),
(47, 9, 'branchup1@gmail.com', 'Manager', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-23 18:41:49'),
(48, 7, 'deskup1@gmail.com', 'Staff', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-23 18:41:49'),
(49, NULL, NULL, NULL, NULL, 'Payment Confirmed', 'Payments', 'student', 'student', 71, 'pacaambungnorcaya@gmail.com', 'Registration payment of ₱1000 confirmed for student ID 71 via Bank Transfer.', 'info', NULL, '{\"amount\":1000,\"method\":\"Bank Transfer\",\"status\":\"Approved\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-24 14:38:32'),
(50, 94, 'pacaambungnorcaya@gmail.com', 'Student', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-24 15:20:07'),
(51, 1, 'fasadmin@music.com', 'Admin', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-24 16:34:56'),
(52, 1, 'fasadmin@music.com', 'Admin', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'User was warned of session expiry and did not respond or chose to log out.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-24 16:34:57'),
(53, NULL, NULL, NULL, NULL, 'Payment Confirmed', 'Payments', 'student', 'student', 73, 'sham.linaac.coc@phinmaed.com', 'Registration payment of ₱1000 confirmed for student ID 73 via GCash.', 'info', NULL, '{\"amount\":1000,\"method\":\"GCash\",\"status\":\"Approved\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-24 16:54:48'),
(54, 10, 'drum2@gmail.com', 'Instructor', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-24 19:28:16'),
(55, 1, 'fasadmin@music.com', 'Admin', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-24 19:28:16'),
(56, 1, 'fasadmin@music.com', 'Admin', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'User chose to log out from the session timeout prompt.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-24 23:25:56'),
(57, 32, 'branchdown2@gmail.com', 'Manager', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-25 11:00:37'),
(58, 32, 'branchdown2@gmail.com', 'Manager', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'User was warned of session expiry and did not respond or chose to log out.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-06-25 11:00:48'),
(59, 9, 'branchup1@gmail.com', 'Manager', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-07-03 15:35:32'),
(60, 1, 'fasadmin@music.com', 'Admin', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-07-05 22:48:14'),
(61, NULL, NULL, NULL, NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'User was warned of session expiry and did not respond or chose to log out.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-07-05 22:48:15'),
(62, 105, 'dongpitz@fas.com', 'Instructor', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-07-07 11:34:50'),
(63, 7, 'deskup1@gmail.com', 'Staff', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-07-07 18:10:47'),
(64, 105, 'dongpitz@fas.com', 'Instructor', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-07-07 20:27:20'),
(65, 105, 'dongpitz@fas.com', 'Instructor', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'User was warned of session expiry and did not respond or chose to log out.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-07-07 20:27:20'),
(66, 116, 'justinyu@fas.com', 'Instructor', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-07-07 21:28:21'),
(67, NULL, NULL, NULL, NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'User was warned of session expiry and did not respond or chose to log out.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-07-07 21:28:22'),
(68, 7, 'deskup1@gmail.com', 'Staff', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-07-09 23:06:23'),
(69, NULL, NULL, NULL, NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'User was warned of session expiry and did not respond or chose to log out.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-07-09 23:22:23'),
(70, NULL, NULL, NULL, NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'User was warned of session expiry and did not respond or chose to log out.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-07-10 06:05:48'),
(71, 105, 'dongpitz@fas.com', 'Instructor', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-13 14:20:34'),
(72, NULL, NULL, NULL, NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'User was warned of session expiry and did not respond or chose to log out.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-13 14:20:35'),
(73, 7, 'deskup1@gmail.com', 'Staff', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-13 18:43:29'),
(74, 8, 'deskdown1@gmail.com', 'Staff', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-16 00:27:42'),
(75, 8, 'deskdown1@gmail.com', 'Staff', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'User was warned of session expiry and did not respond or chose to log out.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-16 00:28:06'),
(76, 7, 'deskup1@gmail.com', 'Staff', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'Session timed out after inactivity.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-20 02:17:57'),
(77, 7, 'deskup1@gmail.com', 'Staff', NULL, 'Session Timeout', 'General', NULL, NULL, NULL, NULL, 'User was warned of session expiry and did not respond or chose to log out.', 'info', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-20 02:17:58');

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
(1, 60, 15, 13, 5, 'Tuesday', '09:00:00', '10:00:00', 8, 'Tuesday 09:00:00-10:00:00', '{\"payment_type\":\"Installment\",\"payment_method\":\"GCash\",\"payable_now\":590,\"package_total_amount\":11800,\"instrument_ids\":[13,23],\"payment_proof_path\":\"uploads\\/payment_proofs\\/package_requests\\/20260609080038_15de7569305da553.png\",\"is_walkin_request\":0}', '2026-06-09', '2026-06-10', '2026-10-21', 'Active', 'Frozen', '2026-06-09 06:00:38', 'Self', NULL, 20, 3, 3, 3, '2026-10-27', 1, 0, 'Installment', 8),
(2, 61, 14, 12, 12, 'Tuesday', '13:00:00', '14:00:00', NULL, 'Tuesday 13:00:00-14:00:00', '{\"payment_type\":\"Installment\",\"payment_method\":\"GCash\",\"payable_now\":621,\"package_total_amount\":7450,\"instrument_ids\":[12],\"payment_proof_path\":\"uploads\\/payment_proofs\\/package_requests\\/20260609082057_2c1939cb3c778c26.png\",\"is_walkin_request\":0,\"admin_notes\":\"test june\"}', '2026-06-09', '2026-06-09', '2026-08-25', 'Active', 'Active', '2026-06-09 06:20:57', 'Self', NULL, 12, 2, 5, 0, '2026-08-25', 1, 0, 'Installment', 8),
(3, 63, 14, 23, NULL, NULL, NULL, NULL, NULL, NULL, '{\"payment_type\":\"Full Payment\",\"payment_method\":\"GCash\",\"payable_now\":7450,\"package_total_amount\":7450,\"instrument_ids\":[23],\"payment_proof_path\":\"uploads\\/payment_proofs\\/package_requests\\/20260609095704_3bbb610fda84b29b.png\",\"is_walkin_request\":0}', '2026-06-09', NULL, NULL, 'Cancelled', 'Active', '2026-06-09 07:57:04', 'Self', NULL, 12, 0, 0, 0, NULL, 1, 0, 'Partial Payment', NULL),
(4, 64, 14, 12, 12, 'Tuesday', '09:00:00', '10:00:00', 15, 'Tuesday 09:00:00-10:00:00', '{\"payment_type\":\"Full Payment\",\"payment_method\":\"GCash\",\"payable_now\":7450,\"package_total_amount\":7450,\"instrument_ids\":[12],\"payment_proof_path\":\"uploads\\/payment_proofs\\/package_requests\\/20260609100203_4056ecf63dc8d07a.png\",\"is_walkin_request\":0}', '2026-06-09', '2026-06-10', '2026-08-26', 'Active', 'Frozen', '2026-06-09 08:02:03', 'Self', NULL, 12, 2, 3, 3, '2026-09-01', 1, 0, 'Full Payment', 8),
(5, 66, 14, 12, 12, 'Tuesday', '11:00:00', '12:00:00', NULL, 'Tuesday 11:00:00-12:00:00', '{\"payment_type\":\"Full Payment\",\"payment_method\":\"GCash\",\"payable_now\":7450,\"package_total_amount\":7450,\"instrument_ids\":[12],\"payment_proof_path\":\"uploads\\/payment_proofs\\/package_requests\\/20260609101228_02ccdc6a3a1633d4.png\",\"is_walkin_request\":0}', '2026-06-09', '2026-06-09', '2026-08-25', 'Active', 'Frozen', '2026-06-09 08:12:28', 'Self', NULL, 12, 2, 5, 5, '2026-08-25', 1, 0, 'Full Payment', 8),
(6, 71, 13, 15, 16, 'Wednesday', '16:00:00', '17:00:00', NULL, 'Wednesday 16:00:00-17:00:00', '{\"payment_type\":\"Partial Payment\",\"payment_method\":\"GCash\",\"payable_now\":3000,\"package_total_amount\":7450,\"instrument_ids\":[15],\"payment_proof_path\":\"uploads\\/payment_proofs\\/package_requests\\/20260624084117_d957ece0df5a10c6.png\",\"is_walkin_request\":0,\"admin_notes\":\"test for cello\"}', '2026-06-24', '2026-06-24', '2026-09-09', 'Active', 'Active', '2026-06-24 06:41:17', 'Self', NULL, 12, 2, 0, 0, '2026-09-09', 1, 0, 'Partial Payment', NULL),
(7, 73, 17, 17, 17, 'Thursday', '09:00:00', '10:00:00', NULL, 'Thursday 09:00:00-10:00:00 | Friday 09:00:00-10:00:00 | Wednesday 09:00:00-10:00:00', '{\"payment_type\":\"Full Payment\",\"payment_method\":\"GCash\",\"payable_now\":29500,\"package_total_amount\":29500,\"instrument_ids\":[17,11,18],\"payment_proof_path\":\"uploads\\/payment_proofs\\/package_requests\\/20260624165636_6083254e75654e22.jpg\",\"is_walkin_request\":0}', '2026-06-24', '2026-06-24', '2026-10-26', 'Active', 'Active', '2026-06-24 08:56:36', 'Self', NULL, 50, 3, 0, 0, '2026-10-15', 1, 0, 'Full Payment', NULL),
(8, 74, 17, 18, NULL, NULL, NULL, NULL, NULL, NULL, '{\"payment_type\":\"Partial Payment\",\"payment_method\":\"GCash\",\"payable_now\":12390,\"package_total_amount\":29500,\"instrument_ids\":[18,15,17],\"payment_proof_path\":\"uploads\\/payment_proofs\\/package_requests\\/20260624173645_4975d1c003dde6a6.png\",\"is_walkin_request\":0}', '2026-06-24', NULL, NULL, 'Cancelled', 'Active', '2026-06-24 09:36:45', 'Self', NULL, 50, 0, 0, 0, NULL, 1, 0, 'Partial Payment', NULL),
(9, 75, 13, 18, NULL, NULL, NULL, NULL, NULL, NULL, '{\"payment_type\":\"Partial Payment\",\"payment_method\":\"Cash\",\"payable_now\":3000,\"package_total_amount\":7450,\"instrument_ids\":[18],\"payment_proof_path\":null,\"is_walkin_request\":1}', '2026-06-24', NULL, NULL, 'Cancelled', 'Active', '2026-06-24 09:47:11', 'Self', NULL, 12, 0, 0, 0, NULL, 1, 0, 'Partial Payment', NULL),
(10, 76, 17, 10, NULL, NULL, NULL, NULL, NULL, NULL, '{\"payment_type\":\"Full Payment\",\"payment_method\":\"Cash\",\"payable_now\":29500,\"package_total_amount\":29500,\"instrument_ids\":[10],\"payment_proof_path\":null,\"is_walkin_request\":1}', '2026-06-25', NULL, NULL, 'Cancelled', 'Active', '2026-06-24 16:23:05', 'Self', NULL, 50, 0, 0, 0, NULL, 1, 0, 'Partial Payment', NULL),
(11, 75, 17, 18, NULL, NULL, NULL, NULL, NULL, NULL, '{\"payment_type\":\"Full Payment\",\"payment_method\":\"Cash\",\"payable_now\":29500,\"package_total_amount\":29500,\"instrument_ids\":[18,10,9],\"payment_proof_path\":null,\"is_walkin_request\":1}', '2026-06-25', NULL, NULL, 'Pending', 'Active', '2026-06-24 16:30:38', 'Self', NULL, 50, 0, 0, 0, NULL, 1, 0, 'Partial Payment', NULL),
(12, 74, 12, 17, 17, 'Thursday', '10:00:00', '11:00:00', NULL, 'Thursday 10:00:00-11:00:00 | Monday 09:00:00-10:00:00', '{\"payment_type\":\"Full Payment\",\"payment_method\":\"Cash\",\"payable_now\":11800,\"package_total_amount\":11800,\"instrument_ids\":[17,18],\"payment_proof_path\":\"\",\"is_walkin_request\":1,\"admin_notes\":\"test\"}', '2026-06-25', '2026-06-29', '2026-09-07', 'Active', 'Active', '2026-06-24 16:46:15', 'Self', NULL, 20, 3, 2, 2, '2026-11-12', 1, 0, 'Full Payment', NULL),
(13, 77, 13, 15, NULL, NULL, NULL, NULL, NULL, NULL, '{\"payment_type\":\"Full Payment\",\"payment_method\":\"Cash\",\"payable_now\":7450,\"package_total_amount\":7450,\"instrument_ids\":[15],\"payment_proof_path\":null,\"is_walkin_request\":1}', '2026-06-25', NULL, NULL, 'Pending', 'Active', '2026-06-24 17:35:26', 'Self', NULL, 12, 0, 0, 0, NULL, 1, 0, 'Partial Payment', NULL),
(14, 78, 15, 23, NULL, NULL, NULL, NULL, NULL, NULL, '{\"payment_type\":\"Full Payment\",\"payment_method\":\"Cash\",\"payable_now\":11800,\"package_total_amount\":11800,\"instrument_ids\":[23,25],\"payment_proof_path\":null,\"is_walkin_request\":1}', '2026-07-03', NULL, NULL, 'Pending', 'Active', '2026-07-03 08:46:48', 'Self', NULL, 20, 0, 0, 0, NULL, 1, 0, 'Partial Payment', NULL),
(15, 65, 16, 23, 19, 'Monday', '11:00:00', '12:00:00', NULL, 'Monday 11:00:00-12:00:00 | Tuesday 14:00:00-15:00:00 | Wednesday 11:00:00-12:00:00', '{\"payment_type\":\"Partial Payment\",\"payment_method\":\"GCash\",\"payable_now\":12390,\"package_total_amount\":29500,\"instrument_ids\":[23,12,22],\"payment_proof_path\":\"\",\"is_walkin_request\":1,\"admin_notes\":\"test for new scheduling\"}', '2026-07-03', '2026-07-29', '2026-11-25', 'Active', 'Active', '2026-07-03 08:49:59', 'Self', NULL, 50, 5, 0, 0, '2027-01-18', 1, 0, 'Partial Payment', NULL),
(16, 79, 13, 16, 9, 'Monday', '10:00:00', '11:00:00', NULL, 'Monday 10:00:00-11:00:00', '{\"payment_type\":\"Partial Payment\",\"payment_method\":\"GCash\",\"payable_now\":3000,\"package_total_amount\":7450,\"instrument_ids\":[16],\"payment_proof_path\":\"uploads\\/payment_proofs\\/package_requests\\/20260720095229_3f0c5225f3452e57.png\",\"is_walkin_request\":0}', '2026-07-20', '2026-07-20', '2026-10-05', 'Active', 'Active', '2026-07-20 01:52:29', 'Self', NULL, 12, 2, 0, 0, '2026-10-05', 1, 0, 'Partial Payment', NULL);

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
(4, 2, 12, 'Tuesday', '13:00:00', '14:00:00', NULL, NULL, 1, 'Active', '2026-06-09 06:21:37', '2026-06-09 06:21:37'),
(10, 1, 5, 'Tuesday', '09:00:00', '10:00:00', 8, 'Room 1', 1, 'Active', '2026-06-09 08:06:38', '2026-06-09 08:06:38'),
(12, 4, 12, 'Tuesday', '09:00:00', '10:00:00', 15, 'Room 7', 1, 'Active', '2026-06-09 08:07:25', '2026-06-09 08:07:25'),
(13, 5, 12, 'Tuesday', '11:00:00', '12:00:00', NULL, NULL, 1, 'Active', '2026-06-09 08:19:08', '2026-06-09 08:19:08'),
(14, 6, 16, 'Wednesday', '16:00:00', '17:00:00', NULL, NULL, 1, 'Active', '2026-06-24 08:02:58', '2026-06-24 08:02:58'),
(39, 7, 17, 'Thursday', '09:00:00', '10:00:00', NULL, NULL, 1, 'Active', '2026-06-24 14:54:45', '2026-06-24 14:54:45'),
(40, 7, 17, 'Friday', '09:00:00', '10:00:00', NULL, NULL, 2, 'Active', '2026-06-24 14:54:45', '2026-06-24 14:54:45'),
(41, 7, 17, 'Wednesday', '09:00:00', '10:00:00', NULL, NULL, 3, 'Active', '2026-06-24 14:54:45', '2026-06-24 14:54:45'),
(42, 12, 17, 'Thursday', '10:00:00', '11:00:00', NULL, NULL, 1, 'Active', '2026-06-24 17:32:54', '2026-06-24 17:32:54'),
(43, 12, 4, 'Monday', '09:00:00', '10:00:00', NULL, NULL, 2, 'Active', '2026-06-24 17:32:54', '2026-06-24 17:32:54'),
(44, 15, 19, 'Monday', '11:00:00', '12:00:00', NULL, NULL, 1, 'Active', '2026-07-19 17:25:28', '2026-07-19 17:25:28'),
(45, 15, 12, 'Tuesday', '14:00:00', '15:00:00', NULL, NULL, 2, 'Active', '2026-07-19 17:25:28', '2026-07-19 17:25:28'),
(46, 15, 20, 'Wednesday', '11:00:00', '12:00:00', NULL, NULL, 3, 'Active', '2026-07-19 17:25:28', '2026-07-19 17:25:28'),
(47, 16, 9, 'Monday', '10:00:00', '11:00:00', NULL, NULL, 1, 'Active', '2026-07-20 01:55:05', '2026-07-20 01:55:05');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_featured_posts`
--

CREATE TABLE `tbl_featured_posts` (
  `featured_post_id` int(11) NOT NULL,
  `branch_id` int(11) DEFAULT NULL,
  `title` varchar(180) NOT NULL,
  `category` varchar(80) NOT NULL,
  `content` text NOT NULL,
  `media_type` enum('Image','Video') NOT NULL DEFAULT 'Image',
  `media_path` varchar(255) NOT NULL,
  `status` enum('Draft','Published','Archived') NOT NULL DEFAULT 'Draft',
  `published_at` datetime DEFAULT NULL,
  `created_by_user_id` int(11) DEFAULT NULL,
  `updated_by_user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_featured_posts`
--

INSERT INTO `tbl_featured_posts` (`featured_post_id`, `branch_id`, `title`, `category`, `content`, `media_type`, `media_path`, `status`, `published_at`, `created_by_user_id`, `updated_by_user_id`, `created_at`, `updated_at`) VALUES
(1, 6, 'Test', 'Update', 'Test only post', 'Image', 'uploads/featured_posts/images/20260604054800_ff139244aef8c732.png', 'Published', '2026-06-04 05:48:00', 9, 9, '2026-06-04 03:48:00', '2026-06-04 03:48:00');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_freeze_payments`
--

CREATE TABLE `tbl_freeze_payments` (
  `freeze_payment_id` int(11) NOT NULL,
  `enrollment_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL DEFAULT 100.00,
  `payment_method` enum('Cash','GCash','Bank Transfer','Other') NOT NULL DEFAULT 'Cash',
  `reference_number` varchar(100) DEFAULT NULL,
  `proof_path` varchar(255) DEFAULT NULL,
  `status` enum('Pending','Paid','Rejected') NOT NULL DEFAULT 'Pending',
  `receipt_number` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `payment_date` date DEFAULT NULL,
  `source` enum('online','walkin') NOT NULL DEFAULT 'online',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_freeze_payments`
--

INSERT INTO `tbl_freeze_payments` (`freeze_payment_id`, `enrollment_id`, `student_id`, `amount`, `payment_method`, `reference_number`, `proof_path`, `status`, `receipt_number`, `notes`, `reviewed_by`, `reviewed_at`, `payment_date`, `source`, `created_at`) VALUES
(1, 5, 66, 100.00, 'Bank Transfer', '123123', NULL, 'Paid', 'FREEZE-1784476420', NULL, 7, '2026-07-19 23:53:40', '2026-07-19', 'online', '2026-07-19 15:46:06'),
(2, 5, 66, 100.00, 'Cash', NULL, NULL, 'Paid', 'FREEZE-1784477043', NULL, 7, '2026-07-20 00:04:03', '2026-07-20', 'online', '2026-07-19 15:54:48'),
(3, 2, 61, 100.00, 'Cash', NULL, NULL, 'Paid', 'FREEZE-WALKIN-1784476794', NULL, NULL, '2026-07-19 23:59:54', '2026-07-19', 'walkin', '2026-07-19 15:59:54');

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
(2, 'Oliver', 'Garcia', 'Father', '096483472', NULL, 'oliver@gmail.com', NULL, 'Active', '2026-03-29 02:20:36'),
(3, 'Roberto', 'Villanueva', 'Father', '131231235', NULL, 'roberto@gmail.com', NULL, 'Active', '2026-05-23 05:28:15'),
(4, 'Berto', 'Reyes', 'Father', '9659153090', NULL, 'berto', 'zone 3 upper, Brgy. Bulua, Cagayan de Oro City, Misamis Oriental', 'Active', '2026-06-24 16:11:56');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_guardian_absence_requests`
--

CREATE TABLE `tbl_guardian_absence_requests` (
  `request_id` int(11) NOT NULL,
  `guardian_id` int(11) NOT NULL,
  `guardian_user_id` int(11) DEFAULT NULL,
  `student_id` int(11) NOT NULL,
  `branch_id` int(11) DEFAULT NULL,
  `session_date` date NOT NULL,
  `reason` varchar(120) NOT NULL,
  `notes` text DEFAULT NULL,
  `status` enum('Pending','Reviewed','Approved','Declined') NOT NULL DEFAULT 'Pending',
  `reviewed_notes` text DEFAULT NULL,
  `reviewed_by_user_id` int(11) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
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
  `condition` enum('Excellent','Good','Fair','Poor') DEFAULT 'Good',
  `status` enum('Available','In Use','Under Repair','Inactive') DEFAULT 'Available',
  `serial_number` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_instruments`
--

INSERT INTO `tbl_instruments` (`instrument_id`, `branch_id`, `instrument_name`, `type_id`, `condition`, `status`, `serial_number`) VALUES
(9, 5, 'Kawai K-200 Piano', 23, 'Good', 'Available', NULL),
(10, 5, 'Taylor Acoustic Guitar', 24, 'Good', 'Available', NULL),
(11, 5, 'Yamaha Violin V5', 28, 'Good', 'Available', NULL),
(12, 6, 'Roland FP-30X', 23, 'Excellent', 'Available', NULL),
(13, 6, 'Ibanez RG421', 24, 'Good', 'Available', NULL),
(14, 6, 'Mapex Drum Kit', 29, 'Good', 'Available', NULL),
(15, 5, 'Student Cello', 32, 'Good', 'Available', NULL),
(16, 5, 'Fender Bass Guitar', 33, 'Good', 'Available', NULL),
(17, 5, 'Kala Ukulele', 31, 'Good', 'Available', NULL),
(18, 5, 'Pearl Drum Kit', 29, 'Good', 'Available', NULL),
(19, 5, 'Yamaha Flute', 34, 'Good', 'Available', NULL),
(20, 5, 'Alto Saxophone', 35, 'Good', 'Available', NULL),
(21, 5, 'Voice Lessons', 30, 'Good', 'Available', NULL),
(22, 6, 'Yamaha Violin V5', 28, 'Good', 'Available', NULL),
(23, 6, 'Student Cello', 32, 'Good', 'Available', NULL),
(24, 6, 'Fender Bass Guitar', 33, 'Good', 'Available', NULL),
(25, 6, 'Kala Ukulele', 31, 'Good', 'Available', NULL),
(26, 6, 'Yamaha Flute', 34, 'Good', 'Available', NULL),
(27, 6, 'Alto Saxophone', 35, 'Good', 'Available', NULL),
(28, 6, 'Voice Lessons', 30, 'Good', 'Available', NULL);

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
(31, 'Ukulele', 'Four-string instrument'),
(32, 'Cello', 'Bowed string instrument'),
(33, 'Bass Guitar', 'Electric or acoustic bass guitar'),
(34, 'Flute', 'Woodwind instrument'),
(35, 'Saxophone', 'Woodwind instrument');

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
  `reference_number` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_payments`
--

INSERT INTO `tbl_payments` (`payment_id`, `enrollment_id`, `payment_date`, `amount`, `payment_method`, `payment_type`, `status`, `receipt_number`, `reference_number`, `notes`, `created_at`) VALUES
(1, 1, '2026-06-09', 590.00, 'GCash', 'Installment', 'Paid', 'ENR-1-1780985410', NULL, NULL, '2026-06-09 06:10:10'),
(2, 2, '2026-06-09', 621.00, 'GCash', 'Installment', 'Paid', 'ENR-2-1780986097', NULL, NULL, '2026-06-09 06:21:37'),
(3, 4, '2026-06-09', 7450.00, 'GCash', 'Full Payment', 'Paid', 'ENR-4-1780992163', NULL, NULL, '2026-06-09 08:02:43'),
(4, 5, '2026-06-09', 7450.00, 'GCash', 'Full Payment', 'Paid', 'ENR-5-1780993148', NULL, NULL, '2026-06-09 08:19:08'),
(5, 6, '2026-06-24', 3000.00, 'GCash', 'Partial Payment', 'Paid', 'ENR-6-1782288178', NULL, NULL, '2026-06-24 08:02:58'),
(6, 7, '2026-06-24', 29500.00, 'GCash', 'Full Payment', 'Paid', 'ENR-7-1782292462', NULL, NULL, '2026-06-24 09:14:22'),
(7, 12, '2026-06-25', 11800.00, 'Cash', 'Full Payment', 'Paid', 'ENR-12-1782322374', NULL, NULL, '2026-06-24 17:32:54'),
(8, 15, '2026-07-20', 12390.00, 'GCash', 'Partial Payment', 'Paid', 'ENR-15-1784481928', NULL, NULL, '2026-07-19 17:25:28'),
(9, 16, '2026-07-20', 3000.00, 'GCash', 'Partial Payment', 'Paid', 'ENR-16-1784512505', NULL, NULL, '2026-07-20 01:55:05');

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
  `receipt_number` varchar(50) DEFAULT NULL,
  `reference_number` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_registration_payments`
--

INSERT INTO `tbl_registration_payments` (`registration_payment_id`, `student_id`, `payment_date`, `amount`, `payment_method`, `status`, `receipt_number`, `reference_number`) VALUES
(1, 1, '2026-03-28', 1000.00, 'Cash', 'Paid', 'REG-PROOF-1774663453', NULL),
(2, 4, '2026-03-28', 1000.00, 'GCash', 'Paid', 'REG-PROOF-1774703433', NULL),
(5, 7, '2026-03-28', 1000.00, 'Cash', 'Paid', 'REG-WALKIN-1774710219', NULL),
(7, 9, '2026-03-29', 1000.00, 'Cash', 'Paid', 'REG-WALKIN-1774714181', NULL),
(8, 10, '2026-03-29', 1000.00, 'GCash', 'Paid', 'REG-PROOF-1774750837', NULL),
(9, 11, '2026-03-29', 1000.00, 'Cash', 'Paid', 'REG-WALKIN-1774757077', NULL),
(10, 12, '2026-03-29', 1000.00, 'Cash', 'Paid', 'REG-WALKIN-1774757249', NULL),
(11, 13, '2026-04-17', 1000.00, 'Cash', 'Paid', 'REG-WALKIN-1776414043', NULL),
(12, 14, '2026-04-18', 1000.00, 'Cash', 'Paid', 'REG-WALKIN-1776478573', NULL),
(20, 16, '2026-05-23', 1000.00, 'Bank Transfer', 'Paid', 'REG-1779541370', '123'),
(21, 60, '2026-06-09', 1000.00, 'GCash', 'Paid', 'REG-1780984647', '023480298402840'),
(22, 61, '2026-06-09', 1000.00, 'GCash', 'Paid', 'REG-1780985933', '2123123'),
(23, 64, '2026-06-09', 1000.00, '', 'Paid', 'REG-WALKIN-1780991153', NULL),
(24, 65, '2026-06-09', 1000.00, '', 'Paid', 'REG-WALKIN-1780991214', NULL),
(25, 63, '2026-06-09', 1000.00, 'GCash', 'Paid', 'REG-1780991694', '123123'),
(26, 66, '2026-06-09', 1000.00, '', 'Paid', 'REG-WALKIN-1780992664', NULL),
(27, 71, '2026-06-24', 1000.00, 'Bank Transfer', 'Paid', 'REG-1782282903', '909090'),
(28, 73, '2026-06-24', 1000.00, 'GCash', 'Paid', 'REG-1782291182', '12345'),
(29, 74, '2026-06-24', 1000.00, '', 'Paid', 'REG-WALKIN-1782293643', NULL),
(30, 75, '2026-06-24', 1000.00, '', 'Paid', 'REG-WALKIN-1782294404', NULL),
(31, 76, '2026-06-25', 1000.00, '', 'Paid', 'REG-WALKIN-1782317516', NULL),
(32, 77, '2026-06-25', 1000.00, '', 'Paid', 'REG-WALKIN-1782322503', NULL),
(33, 78, '2026-07-03', 1000.00, '', 'Paid', 'REG-WALKIN-1783067593', NULL),
(34, 79, '2026-07-20', 1000.00, '', 'Paid', 'REG-WALKIN-1784511845', NULL);

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
(10, 5, 'Room 1', 1, 'Private Lesson', 'Available', '2026-03-28 03:24:45'),
(11, 6, 'Room 3', 1, 'Private Lesson', 'Available', '2026-06-04 12:00:00'),
(12, 6, 'Room 4', 1, 'Private Lesson', 'Available', '2026-06-04 12:00:00'),
(13, 6, 'Room 5', 1, 'Private Lesson', 'Available', '2026-06-04 12:00:00'),
(14, 6, 'Room 6', 1, 'Private Lesson', 'Available', '2026-06-04 12:00:00'),
(15, 6, 'Room 7', 1, 'Private Lesson', 'Available', '2026-06-04 12:00:00'),
(16, 6, 'Room 8', 1, 'Private Lesson', 'Available', '2026-06-04 12:00:00'),
(17, 5, 'Room 2', 1, 'Private Lesson', 'Available', '2026-06-04 12:00:00'),
(18, 5, 'Room 3', 1, 'Private Lesson', 'Available', '2026-06-04 12:00:00'),
(19, 5, 'Room 4', 1, 'Private Lesson', 'Available', '2026-06-04 12:00:00'),
(20, 5, 'Room 5', 1, 'Private Lesson', 'Available', '2026-06-04 12:00:00'),
(21, 5, 'Room 6', 1, 'Private Lesson', 'Available', '2026-06-04 12:00:00'),
(22, 5, 'Room 7', 1, 'Private Lesson', 'Available', '2026-06-04 12:00:00'),
(23, 5, 'Room 8', 1, 'Private Lesson', 'Available', '2026-06-04 12:00:00'),
(24, 5, 'Room 9', 1, 'Private Lesson', 'Available', '2026-06-04 12:00:00');

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
(1, 1, 5, 1, '2026-06-16', '09:00:00', '10:00:00', 'Regular', 13, NULL, 8, 'No Show', 'CI', 'NoNotice', 1, 0, 0, 'Automatically marked missed based on scheduled date.', 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:10:10', 3),
(2, 1, 5, 2, '2026-06-23', '09:00:00', '10:00:00', 'Regular', 13, NULL, 8, 'No Show', 'CI', 'NoNotice', 1, 0, 0, 'Automatically marked missed based on scheduled date.', 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:10:10', 3),
(3, 1, 5, 3, '2026-06-30', '09:00:00', '10:00:00', 'Regular', 13, NULL, 8, 'No Show', 'CI', 'NoNotice', 1, 0, 0, 'Automatically marked missed based on scheduled date.', 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:10:10', 3),
(4, 1, 5, 4, '2026-07-07', '09:00:00', '10:00:00', 'Regular', 13, NULL, 8, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:10:10', 1),
(5, 1, 5, 5, '2026-07-14', '09:00:00', '10:00:00', 'Regular', 13, NULL, 8, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:10:10', 1),
(6, 1, 5, 6, '2026-07-21', '09:00:00', '10:00:00', 'Regular', 13, NULL, 8, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:10:10', 1),
(7, 1, 5, 7, '2026-07-28', '09:00:00', '10:00:00', 'Regular', 13, NULL, 8, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:10:10', 1),
(8, 1, 5, 8, '2026-08-04', '09:00:00', '10:00:00', 'Regular', 13, NULL, 8, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:10:10', 1),
(9, 1, 5, 9, '2026-08-11', '09:00:00', '10:00:00', 'Regular', 13, NULL, 8, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:10:10', 1),
(10, 1, 5, 10, '2026-08-18', '09:00:00', '10:00:00', 'Regular', 13, NULL, 8, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:10:10', 1),
(11, 1, 5, 11, '2026-08-25', '09:00:00', '10:00:00', 'Regular', 13, NULL, 8, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:10:10', 1),
(12, 1, 5, 12, '2026-09-01', '09:00:00', '10:00:00', 'Regular', 13, NULL, 8, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:10:10', 1),
(13, 1, 5, 13, '2026-09-08', '09:00:00', '10:00:00', 'Regular', 13, NULL, 8, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:10:10', 1),
(14, 1, 5, 14, '2026-09-15', '09:00:00', '10:00:00', 'Regular', 13, NULL, 8, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:10:10', 1),
(15, 1, 5, 15, '2026-09-22', '09:00:00', '10:00:00', 'Regular', 13, NULL, 8, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:10:10', 1),
(16, 1, 5, 16, '2026-09-29', '09:00:00', '10:00:00', 'Regular', 13, NULL, 8, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:10:10', 1),
(17, 1, 5, 17, '2026-10-06', '09:00:00', '10:00:00', 'Regular', 13, NULL, 8, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:10:10', 1),
(18, 1, 5, 18, '2026-10-13', '09:00:00', '10:00:00', 'Regular', 13, NULL, 8, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:10:10', 1),
(19, 1, 5, 19, '2026-10-20', '09:00:00', '10:00:00', 'Regular', 13, NULL, 8, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:10:10', 1),
(20, 1, 5, 20, '2026-10-27', '09:00:00', '10:00:00', 'Regular', 13, NULL, 8, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 1', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:10:10', 1),
(21, 2, 12, 1, '2026-06-09', '13:00:00', '14:00:00', 'Regular', 12, NULL, NULL, 'Completed', 'Present', 'None', 1, 0, 0, 'Completed from QR attendance', NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:21:37', 1),
(22, 2, 12, 2, '2026-06-16', '13:00:00', '14:00:00', 'Regular', 12, NULL, NULL, 'No Show', 'CI', 'NoNotice', 1, 0, 0, 'Automatically marked missed based on scheduled date.', NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:21:37', 3),
(23, 2, 12, 3, '2026-06-23', '13:00:00', '14:00:00', 'Regular', 12, NULL, NULL, 'No Show', 'CI', 'NoNotice', 1, 0, 0, 'Automatically marked missed based on scheduled date.', NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:21:37', 3),
(24, 2, 12, 4, '2026-06-30', '13:00:00', '14:00:00', 'Regular', 12, NULL, NULL, 'No Show', 'CI', 'NoNotice', 1, 0, 0, 'Automatically marked missed based on scheduled date.', NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:21:37', 3),
(25, 2, 12, 5, '2026-07-07', '13:00:00', '14:00:00', 'Regular', 12, NULL, NULL, 'No Show', 'CI', 'NoNotice', 1, 0, 0, 'Automatically marked missed based on scheduled date.', NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:21:37', 3),
(26, 2, 12, 6, '2026-07-14', '13:00:00', '14:00:00', 'Regular', 12, NULL, NULL, 'No Show', 'CI', 'NoNotice', 1, 0, 0, 'Automatically marked missed based on scheduled date.', NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:21:37', 3),
(27, 2, 12, 7, '2026-07-21', '13:00:00', '14:00:00', 'Regular', 12, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:21:37', 1),
(28, 2, 12, 8, '2026-07-28', '13:00:00', '14:00:00', 'Regular', 12, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:21:37', 1),
(29, 2, 12, 9, '2026-08-04', '13:00:00', '14:00:00', 'Regular', 12, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:21:37', 1),
(30, 2, 12, 10, '2026-08-11', '13:00:00', '14:00:00', 'Regular', 12, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:21:37', 1),
(31, 2, 12, 11, '2026-08-18', '13:00:00', '14:00:00', 'Regular', 12, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:21:37', 1),
(32, 2, 12, 12, '2026-08-25', '13:00:00', '14:00:00', 'Regular', 12, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 06:21:37', 1),
(33, 4, 12, 1, '2026-06-16', '09:00:00', '10:00:00', 'Regular', 12, NULL, 15, 'No Show', 'CI', 'NoNotice', 1, 0, 0, 'Automatically marked missed based on scheduled date.', 'Room 7', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:02:43', 3),
(34, 4, 12, 2, '2026-06-23', '09:00:00', '10:00:00', 'Regular', 12, NULL, 15, 'No Show', 'CI', 'NoNotice', 1, 0, 0, 'Automatically marked missed based on scheduled date.', 'Room 7', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:02:43', 3),
(35, 4, 12, 3, '2026-06-30', '09:00:00', '10:00:00', 'Regular', 12, NULL, 15, 'No Show', 'CI', 'NoNotice', 1, 0, 0, 'Automatically marked missed based on scheduled date.', 'Room 7', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:02:43', 3),
(36, 4, 12, 4, '2026-07-07', '09:00:00', '10:00:00', 'Regular', 12, NULL, 15, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 7', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:02:43', 1),
(37, 4, 12, 5, '2026-07-14', '09:00:00', '10:00:00', 'Regular', 12, NULL, 15, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 7', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:02:43', 1),
(38, 4, 12, 6, '2026-07-21', '09:00:00', '10:00:00', 'Regular', 12, NULL, 15, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 7', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:02:43', 1),
(39, 4, 12, 7, '2026-07-28', '09:00:00', '10:00:00', 'Regular', 12, NULL, 15, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 7', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:02:43', 1),
(40, 4, 12, 8, '2026-08-04', '09:00:00', '10:00:00', 'Regular', 12, NULL, 15, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 7', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:02:43', 1),
(41, 4, 12, 9, '2026-08-11', '09:00:00', '10:00:00', 'Regular', 12, NULL, 15, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 7', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:02:43', 1),
(42, 4, 12, 10, '2026-08-18', '09:00:00', '10:00:00', 'Regular', 12, NULL, 15, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 7', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:02:43', 1),
(43, 4, 12, 11, '2026-08-25', '09:00:00', '10:00:00', 'Regular', 12, NULL, 15, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 7', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:02:43', 1),
(44, 4, 12, 12, '2026-09-01', '09:00:00', '10:00:00', 'Regular', 12, NULL, 15, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, 'Room 7', NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:02:43', 1),
(45, 5, 12, 1, '2026-06-09', '11:00:00', '12:00:00', 'Regular', 12, NULL, NULL, 'Completed', 'Present', 'None', 1, 0, 0, 'Completed from QR attendance', NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:19:08', 1),
(46, 5, 12, 2, '2026-06-16', '11:00:00', '12:00:00', 'Regular', 12, NULL, NULL, 'No Show', 'CI', 'NoNotice', 1, 0, 0, 'Automatically marked missed based on scheduled date.', NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:19:08', 3),
(47, 5, 12, 3, '2026-06-23', '11:00:00', '12:00:00', 'Regular', 12, NULL, NULL, 'No Show', 'CI', 'NoNotice', 1, 0, 0, 'Automatically marked missed based on scheduled date.', NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:19:08', 3),
(48, 5, 12, 4, '2026-06-30', '11:00:00', '12:00:00', 'Regular', 12, NULL, NULL, 'No Show', 'CI', 'NoNotice', 1, 0, 0, 'Automatically marked missed based on scheduled date.', NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:19:08', 3),
(49, 5, 12, 5, '2026-07-07', '11:00:00', '12:00:00', 'Regular', 12, NULL, 15, 'No Show', 'CI', 'NoNotice', 1, 0, 0, 'Automatically marked missed based on scheduled date.', NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:19:08', 3),
(50, 5, 12, 6, '2026-07-14', '11:00:00', '12:00:00', 'Regular', 12, NULL, NULL, 'No Show', 'CI', 'NoNotice', 1, 0, 0, 'Automatically marked missed based on scheduled date.', NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:19:08', 3),
(51, 5, 12, 7, '2026-07-22', '11:00:00', '12:00:00', 'Regular', 12, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:19:08', 1),
(52, 5, 12, 8, '2026-07-28', '11:00:00', '12:00:00', 'Regular', 12, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:19:08', 1),
(53, 5, 12, 9, '2026-08-04', '11:00:00', '12:00:00', 'Regular', 12, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:19:09', 1),
(54, 5, 12, 10, '2026-08-11', '11:00:00', '12:00:00', 'Regular', 12, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:19:09', 1),
(55, 5, 12, 11, '2026-08-18', '11:00:00', '12:00:00', 'Regular', 12, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:19:09', 1),
(56, 5, 12, 12, '2026-08-25', '11:00:00', '12:00:00', 'Regular', 12, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-09 08:19:09', 1),
(57, 6, 16, 1, '2026-06-24', '16:00:00', '17:00:00', 'Regular', 15, NULL, 10, 'Completed', 'Present', 'None', 1, 0, 0, 'Completed from QR attendance', NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 08:02:59', 1),
(58, 6, 16, 2, '2026-07-01', '16:00:00', '17:00:00', 'Regular', 15, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 08:02:59', 1),
(59, 6, 16, 3, '2026-07-08', '16:00:00', '17:00:00', 'Regular', 15, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 08:02:59', 1),
(60, 6, 16, 4, '2026-07-15', '16:00:00', '17:00:00', 'Regular', 15, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 08:02:59', 1),
(61, 6, 16, 5, '2026-07-22', '16:00:00', '17:00:00', 'Regular', 15, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 08:02:59', 1),
(62, 6, 16, 6, '2026-07-29', '16:00:00', '17:00:00', 'Regular', 15, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 08:02:59', 1),
(63, 6, 16, 7, '2026-08-05', '16:00:00', '17:00:00', 'Regular', 15, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 08:02:59', 1),
(64, 6, 16, 8, '2026-08-12', '16:00:00', '17:00:00', 'Regular', 15, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 08:02:59', 1),
(65, 6, 16, 9, '2026-08-19', '16:00:00', '17:00:00', 'Regular', 15, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 08:02:59', 1),
(66, 6, 16, 10, '2026-08-26', '16:00:00', '17:00:00', 'Regular', 15, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 08:02:59', 1),
(67, 6, 16, 11, '2026-09-02', '16:00:00', '17:00:00', 'Regular', 15, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 08:02:59', 1),
(68, 6, 16, 12, '2026-09-09', '16:00:00', '17:00:00', 'Regular', 15, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 08:02:59', 1),
(69, 7, 17, 1, '2026-06-24', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(70, 7, 17, 2, '2026-06-25', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(71, 7, 17, 3, '2026-06-26', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(72, 7, 17, 4, '2026-07-01', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(73, 7, 17, 5, '2026-07-02', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(74, 7, 17, 6, '2026-07-03', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(75, 7, 17, 7, '2026-07-08', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(76, 7, 17, 8, '2026-07-09', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(77, 7, 17, 9, '2026-07-10', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(78, 7, 17, 10, '2026-07-15', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(79, 7, 17, 11, '2026-07-16', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(80, 7, 17, 12, '2026-07-17', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(81, 7, 17, 13, '2026-07-22', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(82, 7, 17, 14, '2026-07-23', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(83, 7, 17, 15, '2026-07-24', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(84, 7, 17, 16, '2026-07-29', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(85, 7, 17, 17, '2026-07-30', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(86, 7, 17, 18, '2026-07-31', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(87, 7, 17, 19, '2026-08-05', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(88, 7, 17, 20, '2026-08-06', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(89, 7, 17, 21, '2026-08-07', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(90, 7, 17, 22, '2026-08-12', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(91, 7, 17, 23, '2026-08-13', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(92, 7, 17, 24, '2026-08-14', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(93, 7, 17, 25, '2026-08-19', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(94, 7, 17, 26, '2026-08-20', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(95, 7, 17, 27, '2026-08-21', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:22', 1),
(96, 7, 17, 28, '2026-08-26', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(97, 7, 17, 29, '2026-08-27', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(98, 7, 17, 30, '2026-08-28', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(99, 7, 17, 31, '2026-09-02', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(100, 7, 17, 32, '2026-09-03', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(101, 7, 17, 33, '2026-09-04', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(102, 7, 17, 34, '2026-09-09', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(103, 7, 17, 35, '2026-09-10', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(104, 7, 17, 36, '2026-09-11', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(105, 7, 17, 37, '2026-09-16', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(106, 7, 17, 38, '2026-09-17', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(107, 7, 17, 39, '2026-09-18', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(108, 7, 17, 40, '2026-09-23', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(109, 7, 17, 41, '2026-09-24', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(110, 7, 17, 42, '2026-09-25', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(111, 7, 17, 43, '2026-09-30', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(112, 7, 17, 44, '2026-10-01', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(113, 7, 17, 45, '2026-10-02', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(114, 7, 17, 46, '2026-10-07', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(115, 7, 17, 47, '2026-10-08', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(116, 7, 17, 48, '2026-10-09', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(117, 7, 17, 49, '2026-10-14', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(118, 7, 17, 50, '2026-10-15', '09:00:00', '10:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 09:14:23', 1),
(119, 12, 17, 1, '2026-07-02', '10:00:00', '11:00:00', 'Regular', 17, NULL, NULL, 'No Show', 'CI', 'NoNotice', 1, 0, 0, 'Automatically marked missed based on scheduled date.', NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 17:32:54', 3),
(120, 12, 17, 2, '2026-07-09', '10:00:00', '11:00:00', 'Regular', 17, NULL, NULL, 'No Show', 'CI', 'NoNotice', 1, 0, 0, 'Automatically marked missed based on scheduled date.', NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 17:32:54', 3),
(121, 12, 17, 3, '2026-07-16', '10:00:00', '11:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 17:32:54', 1),
(122, 12, 17, 4, '2026-07-23', '10:00:00', '11:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 17:32:54', 1),
(123, 12, 17, 5, '2026-07-30', '10:00:00', '11:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 17:32:54', 1),
(124, 12, 17, 6, '2026-08-06', '10:00:00', '11:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 17:32:54', 1),
(125, 12, 17, 7, '2026-08-13', '10:00:00', '11:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 17:32:54', 1),
(126, 12, 17, 8, '2026-08-20', '10:00:00', '11:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 17:32:54', 1),
(127, 12, 17, 9, '2026-08-27', '10:00:00', '11:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 17:32:54', 1),
(128, 12, 17, 10, '2026-09-03', '10:00:00', '11:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 17:32:54', 1),
(129, 12, 17, 11, '2026-09-10', '10:00:00', '11:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 17:32:54', 1),
(130, 12, 17, 12, '2026-09-17', '10:00:00', '11:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 17:32:54', 1),
(131, 12, 17, 13, '2026-09-24', '10:00:00', '11:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 17:32:54', 1),
(132, 12, 17, 14, '2026-10-01', '10:00:00', '11:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 17:32:54', 1),
(133, 12, 17, 15, '2026-10-08', '10:00:00', '11:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 17:32:54', 1),
(134, 12, 17, 16, '2026-10-15', '10:00:00', '11:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 17:32:54', 1),
(135, 12, 17, 17, '2026-10-22', '10:00:00', '11:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 17:32:54', 1),
(136, 12, 17, 18, '2026-10-29', '10:00:00', '11:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 17:32:54', 1),
(137, 12, 17, 19, '2026-11-05', '10:00:00', '11:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 17:32:54', 1),
(138, 12, 17, 20, '2026-11-12', '10:00:00', '11:00:00', 'Regular', 17, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-06-24 17:32:54', 1),
(139, 15, 19, 1, '2026-07-29', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(140, 15, 19, 2, '2026-07-20', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(141, 15, 19, 3, '2026-08-05', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(142, 15, 19, 4, '2026-08-10', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(143, 15, 19, 5, '2026-08-12', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(144, 15, 19, 6, '2026-08-17', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(145, 15, 19, 7, '2026-08-19', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(146, 15, 19, 8, '2026-08-24', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(147, 15, 19, 9, '2026-08-26', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(148, 15, 19, 10, '2026-08-31', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(149, 15, 19, 11, '2026-09-02', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(150, 15, 19, 12, '2026-09-07', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(151, 15, 19, 13, '2026-09-09', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(152, 15, 19, 14, '2026-09-14', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(153, 15, 19, 15, '2026-09-16', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(154, 15, 19, 16, '2026-09-21', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(155, 15, 19, 17, '2026-09-23', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(156, 15, 19, 18, '2026-09-28', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(157, 15, 19, 19, '2026-09-30', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(158, 15, 19, 20, '2026-10-05', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(159, 15, 19, 21, '2026-10-07', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(160, 15, 19, 22, '2026-10-12', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(161, 15, 19, 23, '2026-10-14', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(162, 15, 19, 24, '2026-10-19', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(163, 15, 19, 25, '2026-10-21', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(164, 15, 19, 26, '2026-10-26', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(165, 15, 19, 27, '2026-10-28', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(166, 15, 19, 28, '2026-11-02', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(167, 15, 19, 29, '2026-11-04', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(168, 15, 19, 30, '2026-11-09', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(169, 15, 19, 31, '2026-11-11', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(170, 15, 19, 32, '2026-11-16', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(171, 15, 19, 33, '2026-11-18', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(172, 15, 19, 34, '2026-11-23', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(173, 15, 19, 35, '2026-11-25', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(174, 15, 19, 36, '2026-11-30', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(175, 15, 19, 37, '2026-12-02', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(176, 15, 19, 38, '2026-12-07', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(177, 15, 19, 39, '2026-12-09', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(178, 15, 19, 40, '2026-12-14', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(179, 15, 19, 41, '2026-12-16', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(180, 15, 19, 42, '2026-12-21', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(181, 15, 19, 43, '2026-12-23', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(182, 15, 19, 44, '2026-12-28', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(183, 15, 19, 45, '2026-12-30', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(184, 15, 19, 46, '2027-01-04', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(185, 15, 19, 47, '2027-01-06', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(186, 15, 19, 48, '2027-01-11', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(187, 15, 19, 49, '2027-01-13', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(188, 15, 19, 50, '2027-01-18', '11:00:00', '12:00:00', 'Regular', 23, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-19 17:25:28', 1),
(189, 16, 9, 1, '2026-07-20', '10:00:00', '11:00:00', 'Regular', 16, NULL, 10, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-20 01:55:05', 1),
(190, 16, 9, 2, '2026-07-27', '10:00:00', '11:00:00', 'Regular', 16, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-20 01:55:05', 1),
(191, 16, 9, 3, '2026-08-03', '10:00:00', '11:00:00', 'Regular', 16, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-20 01:55:05', 1),
(192, 16, 9, 4, '2026-08-10', '10:00:00', '11:00:00', 'Regular', 16, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-20 01:55:05', 1),
(193, 16, 9, 5, '2026-08-17', '10:00:00', '11:00:00', 'Regular', 16, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-20 01:55:05', 1),
(194, 16, 9, 6, '2026-08-24', '10:00:00', '11:00:00', 'Regular', 16, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-20 01:55:05', 1),
(195, 16, 9, 7, '2026-08-31', '10:00:00', '11:00:00', 'Regular', 16, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-20 01:55:05', 1),
(196, 16, 9, 8, '2026-09-07', '10:00:00', '11:00:00', 'Regular', 16, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-20 01:55:05', 1),
(197, 16, 9, 9, '2026-09-14', '10:00:00', '11:00:00', 'Regular', 16, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-20 01:55:05', 1),
(198, 16, 9, 10, '2026-09-21', '10:00:00', '11:00:00', 'Regular', 16, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-20 01:55:05', 1),
(199, 16, 9, 11, '2026-09-28', '10:00:00', '11:00:00', 'Regular', 16, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-20 01:55:05', 1),
(200, 16, 9, 12, '2026-10-05', '10:00:00', '11:00:00', 'Regular', 16, NULL, NULL, 'Scheduled', 'Pending', 'None', 0, 0, 0, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2026-07-20 01:55:05', 1);

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
(12, 5, '20 Session Package', 20, 2, 11800.00, '20 session package for SM Downtown', '2026-03-28 00:48:31'),
(13, 5, '12 Session Package', 12, 1, 7450.00, '12 session package for SM Downtown', '2026-03-28 00:48:57'),
(14, 6, '12 Session Package', 12, 1, 7450.00, '12 session package for SM Uptown', '2026-03-28 00:49:27'),
(15, 6, '20 Session Package', 20, 2, 11800.00, '20 session package for SM Uptown', '2026-03-28 00:49:43'),
(16, 6, '50 Session Package', 50, 3, 29500.00, '50 session package for SM Uptown', '2026-05-23 13:08:19'),
(17, 5, '50 Session Package', 50, 3, 29500.00, '50 session package for SM Downtown', '2026-06-04 12:00:00');

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
-- Table structure for table `tbl_song_lesson_history`
--

CREATE TABLE `tbl_song_lesson_history` (
  `history_id` int(11) NOT NULL,
  `assignment_id` int(11) NOT NULL,
  `session_id` int(11) DEFAULT NULL,
  `teacher_id` int(11) NOT NULL,
  `lesson_date` date NOT NULL,
  `progress_status` enum('assigned','practicing','polishing','completed') NOT NULL DEFAULT 'assigned',
  `lesson_notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tbl_song_library`
--

CREATE TABLE `tbl_song_library` (
  `song_id` int(11) NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `artist` varchar(255) DEFAULT NULL,
  `genre` varchar(100) DEFAULT NULL,
  `category` varchar(100) NOT NULL DEFAULT 'voice',
  `difficulty_level` varchar(100) DEFAULT NULL,
  `vocal_range` varchar(100) DEFAULT NULL,
  `tags` text DEFAULT NULL,
  `youtube_link` varchar(500) DEFAULT NULL,
  `spotify_link` varchar(500) DEFAULT NULL,
  `sheet_music_path` varchar(255) DEFAULT NULL,
  `accompaniment_audio_path` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `status` enum('Active','Archived') NOT NULL DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_song_library`
--

INSERT INTO `tbl_song_library` (`song_id`, `teacher_id`, `title`, `artist`, `genre`, `category`, `difficulty_level`, `vocal_range`, `tags`, `youtube_link`, `spotify_link`, `sheet_music_path`, `accompaniment_audio_path`, `notes`, `status`, `created_at`, `updated_at`) VALUES
(1, 9, 'River Flows in You', 'Yiruma', 'Contemporary', 'piano', 'Intermediate', NULL, NULL, 'https://youtu.be/icG1f55SytI?si=OpQOBj9fgeFiEdnX', NULL, NULL, NULL, 'For intermediate piano', 'Active', '2026-06-09 01:53:19', '2026-06-09 01:53:19');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_specialization`
--

CREATE TABLE `tbl_specialization` (
  `specialization_id` int(11) NOT NULL,
  `specialization_name` varchar(100) NOT NULL,
  `type_id` int(11) DEFAULT NULL,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_specialization`
--

INSERT INTO `tbl_specialization` (`specialization_id`, `specialization_name`, `type_id`, `status`, `created_at`) VALUES
(1, 'Piano', 23, 'Active', '2026-02-23 09:45:38'),
(2, 'Guitar', 24, 'Active', '2026-02-23 09:45:38'),
(3, 'Drums', 29, 'Active', '2026-02-23 09:45:38'),
(4, 'Violin', 28, 'Active', '2026-02-23 09:45:38'),
(5, 'General', NULL, 'Active', '2026-02-23 09:45:38'),
(8, 'Cello', 32, 'Active', '2026-06-09 06:02:01'),
(9, 'Bass Guitar', 33, 'Active', '2026-06-16 05:07:46'),
(10, 'Flute', 34, 'Active', '2026-06-16 05:07:46'),
(11, 'Saxophone', 35, 'Active', '2026-06-16 05:07:46'),
(12, 'Ukulele', 31, 'Active', '2026-06-16 05:07:46'),
(13, 'Voice', 30, 'Active', '2026-06-16 05:07:46');

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
  `registration_proof_path` varchar(255) DEFAULT NULL,
  `age_verification_proof_path` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_students`
--

INSERT INTO `tbl_students` (`student_id`, `branch_id`, `first_name`, `last_name`, `middle_name`, `date_of_birth`, `age`, `phone`, `email`, `address`, `school`, `grade_year`, `health_diagnosis`, `status`, `registration_source`, `created_at`, `session_package_id`, `registration_proof_path`, `age_verification_proof_path`) VALUES
(1, 6, 'Micah', 'Lago', NULL, '2011-10-28', 14, '09902019202', 'micah@gmail.com', 'Tablon', 'Coc', 'HighSchool', NULL, 'Active', 'online', '2026-03-28 02:02:57', 14, 'uploads/payment_proofs/registration/20260328030413_2b2ea77f71a022c2.png', NULL),
(3, 6, 'mckenzie', 'lago', NULL, NULL, NULL, '0909090909', 'mckenzie@gmail.com', NULL, NULL, NULL, NULL, 'Inactive', 'online', '2026-03-28 12:04:04', NULL, NULL, NULL),
(4, 6, 'Yumi', 'Lago', NULL, '2014-02-27', 12, '09659153090', 'yumi@gmail.com', 'CDO tablon', 'Tablon Elementary School', 'Grade 5', NULL, 'Active', 'online', '2026-03-28 12:58:40', 14, 'uploads/payment_proofs/registration/20260328141033_62e66192ac872762.png', NULL),
(6, 5, 'test', 'test', 'Dusil', '2004-02-28', 22, '090909090', 'test@gmail.com', 'zone 3 upper, Brgy. Bulua, Cagayan de Oro City, Misamis Oriental', NULL, 'adult ', 'none ', 'Inactive', 'walkin', '2026-03-28 14:39:58', NULL, NULL, NULL),
(7, 5, 'Arman', 'Salon', 'Dusil', '2005-02-28', 21, '09659153090', 'arman@gmail.com', 'CDO Gusa ', NULL, NULL, NULL, 'Active', 'walkin', '2026-03-28 15:03:39', 12, NULL, NULL),
(8, 5, 'Bruno', 'Mars', '', '1995-06-28', 30, '09748372013', 'bruno@gmail.com', 'CDO Bugo ', NULL, NULL, NULL, 'Inactive', 'walkin', '2026-03-28 15:51:09', NULL, NULL, NULL),
(9, 5, 'Ariana', 'Grande', 'Dusil ', '2006-02-28', 20, '090049303', 'ariana@gmail.com', 'CDO tablon ', NULL, NULL, NULL, 'Active', 'walkin', '2026-03-28 16:09:41', 13, NULL, NULL),
(10, 6, 'James', 'Garcia', NULL, '2017-06-29', 8, '098069503', 'james@gmail.com', 'CDO Tablon', 'Tablon Elementary School', 'Grade 2', NULL, 'Active', 'online', '2026-03-29 01:57:17', 14, 'uploads/payment_proofs/registration/20260329042037_586845efce8a3c44.png', NULL),
(11, 5, 'Jeon', 'Jungkook', 'Yoo', '1998-06-17', 27, '090799574903', 'jeon@gmail.com', 'zone 3 bulua ', NULL, NULL, NULL, 'Active', 'walkin', '2026-03-29 04:04:37', NULL, NULL, NULL),
(12, 5, 'Seokjin', 'Kim', 'Martinez', '2005-10-29', 20, '0907940902', 'seokjin@gmail.com', 'CDO tablon', NULL, NULL, NULL, 'Active', 'walkin', '2026-03-29 04:07:29', 13, NULL, NULL),
(13, 5, 'Jennie', 'Kim', 'idk', '1998-07-17', 27, '090909090', 'jennie@gmail.com', 'YG station', NULL, NULL, NULL, 'Active', 'walkin', '2026-04-17 08:20:43', 13, NULL, NULL),
(14, 5, 'Skusta', 'Clee', '', '1997-06-18', 28, '09090909', 'skusta@gmail.com', 'AMBOT ', NULL, NULL, NULL, 'Inactive', 'walkin', '2026-04-18 02:16:13', NULL, NULL, NULL),
(16, 6, 'Sophie', 'Villanueva', 'Dusil', '2003-02-23', 23, '0908090808', 'sophie@gmail.com', 'zone 3 upper, Brgy. Bulua, Cagayan de Oro City, Misamis Oriental', NULL, NULL, NULL, 'Inactive', 'online', '2026-05-23 11:44:27', 14, 'uploads/payment_proofs/registration/20260523150250_2cb856221b1393db.png', 'uploads/payment_proofs/age_verification/20260523150250_f5b29ebd69f9bd29.png'),
(42, 6, 'Micah', 'Lago', 'Dusil', '2001-07-04', 24, '09659153090', 'lago@fas.com', 'zone 3 upper, Brgy. Bulua, Cagayan de Oro City, Misamis Oriental', NULL, NULL, NULL, 'Inactive', 'walkin', '2026-06-04 12:21:15', 15, NULL, NULL),
(60, 6, 'sean', 'pabilona', 'Dusil', '2005-03-07', 21, '09069263319', 'seanjoneilpabilona@gmail.com', 'zone 3 upper, Brgy. Bulua, Cagayan de Oro City, Misamis Oriental', NULL, NULL, NULL, 'Active', 'online', '2026-06-09 05:54:08', 15, 'uploads/payment_proofs/registration/20260609075727_598eaf806cdfba1d.png', 'uploads/payment_proofs/age_verification/20260609075727_d39613b9cdee83c6.png'),
(61, 6, 'Lenard', 'Laurente', 'James', '2007-03-09', 19, '09089605960', 'Lenardjameslaurente123@gmail.com', 'Camaman an Elsal', NULL, NULL, NULL, 'Active', 'online', '2026-06-09 06:16:18', 14, 'uploads/payment_proofs/registration/20260609081853_807c6f43b5674462.png', 'uploads/payment_proofs/age_verification/20260609081853_d0e47d0b6257aa3c.png'),
(62, 6, 'jannah', 'mcrambon', NULL, NULL, NULL, '165616', 'janahmacarambon580@gmail.com', NULL, NULL, NULL, NULL, 'Inactive', 'online', '2026-06-09 07:37:57', NULL, NULL, NULL),
(63, 6, 'jannah', 'macarambon', 'macs', '2005-07-03', 20, '09069263319', 'jannahmacarambon580@gmail.com', 'zone 3 upper, Brgy. Bulua, Cagayan de Oro City, Misamis Oriental', NULL, NULL, NULL, 'Active', 'online', '2026-06-09 07:40:33', NULL, 'uploads/payment_proofs/registration/20260609095454_61638e07a2c074fe.png', 'uploads/payment_proofs/age_verification/20260609095454_78148319e04cd140.png'),
(64, 6, 'pabs', 'kie', 'sords', '2005-05-03', 21, '09659153090', 'pabs@fas.com', 'zone 3 upper, Brgy. Bulua, Cagayan de Oro City, Misamis Oriental', NULL, NULL, NULL, 'Active', 'walkin', '2026-06-09 07:45:53', 14, NULL, NULL),
(65, 6, 'shandi', 'kate', 'linaac', '2006-11-02', 19, '09659153090', 'shandi@fas.com', 'zone 3 upper, Brgy. Bulua, Cagayan de Oro City, Misamis Oriental', NULL, NULL, NULL, 'Active', 'walkin', '2026-06-09 07:46:54', 16, NULL, NULL),
(66, 6, 'Micah', 'Lago', 'Dusil', '2001-02-02', 25, '09659153090', 'mica@fas.com', 'zone 3 upper, Brgy. Bulua, Cagayan de Oro City, Misamis Oriental', NULL, NULL, NULL, 'Active', 'walkin', '2026-06-09 08:11:04', 14, NULL, NULL),
(69, 5, 'Micah', 'Lago', NULL, NULL, NULL, '0965915309', 'midu.lago.coc@phinmaed.com', NULL, NULL, NULL, NULL, 'Inactive', 'online', '2026-06-14 11:57:11', NULL, NULL, NULL),
(70, 5, 'mai', 'kie', NULL, NULL, NULL, '0965915309', 'silentqie01@gmail.com', NULL, NULL, NULL, NULL, 'Inactive', 'online', '2026-06-17 16:22:15', NULL, NULL, NULL),
(71, 5, 'Norcaya', 'Pacaambung', 'Mariano', '2004-03-07', 22, '9535149532', 'pacaambungnorcaya@gmail.com', 'Carmen', NULL, NULL, NULL, 'Active', 'online', '2026-06-24 06:29:46', 13, 'uploads/payment_proofs/registration/20260624083503_0e8c431ef6dbcf11.png', 'uploads/payment_proofs/age_verification/20260624083503_cb5c51198e442dfc.png'),
(72, 5, 'Alek', 'Benjamin', NULL, '0000-00-00', NULL, '9675218039', 'alekkkkk@gmail.com', NULL, NULL, NULL, NULL, 'Inactive', 'online', '2026-06-24 08:47:05', NULL, NULL, NULL),
(73, 5, 'Alek', 'Benjamin', NULL, '2004-03-01', 22, '9675218039', 'sham.linaac.coc@phinmaed.com', 'nha', NULL, NULL, NULL, 'Active', 'online', '2026-06-24 08:48:23', 17, 'uploads/payment_proofs/registration/20260624165302_f62df0099990e22c.jpg', 'uploads/payment_proofs/age_verification/20260624165302_dc83d7781f7a4ca0.jpg'),
(74, 5, 'Shan', 'Makalimot', 'Dee', '2003-02-24', 23, '09659153090', 'shandee@fas.com', 'zone 3 upper, Brgy. Bulua, Cagayan de Oro City, Misamis Oriental', NULL, NULL, NULL, 'Active', 'walkin', '2026-06-24 09:34:03', 12, NULL, NULL),
(75, 5, 'jann', 'nnah', '', '2004-02-24', 22, '09090909', 'jannahxd@fas.com', '', NULL, NULL, NULL, 'Active', 'walkin', '2026-06-24 09:46:44', NULL, NULL, NULL),
(76, 5, 'Michael', 'Reyes', 'Dusil', '2021-02-25', 5, NULL, 'michael@fas.com', 'zone 3, Bulua, Cagayan de oro mis.or., Misamis Or.', NULL, NULL, NULL, 'Active', 'walkin', '2026-06-24 16:11:56', NULL, NULL, NULL),
(77, 5, 'Clove', 'Delacruz', 'Dusil', '2006-06-25', 20, '9659153090', 'clove@fas.com', 'zone 3 upper, Brgy. Bulua, Cagayan de Oro City, Misamis Oriental, Bulua, Cagayan de oro mis.or., Misamis Or.', NULL, NULL, NULL, 'Active', 'walkin', '2026-06-24 17:35:03', NULL, NULL, NULL),
(78, 6, 'example', 'ex', 'e', '2003-02-03', 23, '09659153090', 'example@fas.com', 'zone 3 upper, Brgy. Bulua, Cagayan de Oro City, Misamis Oriental', NULL, NULL, NULL, 'Active', 'walkin', '2026-07-03 08:33:13', NULL, NULL, NULL),
(79, 5, 'pabskie', 'papabs', 'sorz', '2005-03-20', 21, '0900909', 'pabilona@fas.com', 'zone 3 upper, Brgy. Bulua, Cagayan de Oro City, Misamis Oriental', NULL, NULL, NULL, 'Active', 'walkin', '2026-07-20 01:44:05', 13, NULL, NULL);

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
(3, 10, 2, 'Y', 'Y', 'Y', 'Y'),
(5, 76, 4, 'Y', 'Y', 'Y', 'Y');

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
(1, 60, 13, 1, '2026-06-09 06:10:10'),
(2, 60, 23, 2, '2026-06-09 06:10:10'),
(3, 61, 12, 1, '2026-06-09 06:21:37'),
(4, 64, 12, 1, '2026-06-09 08:02:42'),
(5, 66, 12, 1, '2026-06-09 08:19:08'),
(6, 71, 15, 1, '2026-06-24 08:02:58'),
(7, 73, 17, 1, '2026-06-24 09:14:22'),
(8, 73, 11, 2, '2026-06-24 09:14:22'),
(9, 73, 18, 3, '2026-06-24 09:14:22'),
(10, 74, 17, 1, '2026-06-24 17:32:54'),
(11, 74, 18, 2, '2026-06-24 17:32:54'),
(12, 65, 23, 1, '2026-07-19 17:25:28'),
(13, 65, 12, 2, '2026-07-19 17:25:28'),
(14, 65, 22, 3, '2026-07-19 17:25:28'),
(15, 79, 16, 1, '2026-07-20 01:55:04');

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
  `performance_score` tinyint(3) UNSIGNED DEFAULT NULL,
  `technique_score` tinyint(3) UNSIGNED DEFAULT NULL,
  `rhythm_score` tinyint(3) UNSIGNED DEFAULT NULL,
  `focus_score` tinyint(3) UNSIGNED DEFAULT NULL,
  `assignment_score` tinyint(3) UNSIGNED DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `assessment_date` date DEFAULT curdate(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_student_progress`
--

INSERT INTO `tbl_student_progress` (`progress_id`, `student_id`, `session_id`, `instrument_id`, `skill_level`, `performance_score`, `technique_score`, `rhythm_score`, `focus_score`, `assignment_score`, `remarks`, `assessment_date`, `created_at`, `updated_at`) VALUES
(1, 61, 21, 12, 'Needs Improvement', 1, 1, 1, 1, 1, 'di kablog piano yapun', '2026-06-09', '2026-06-09 06:26:37', '2026-06-09 06:26:37'),
(2, 66, 45, 12, 'Needs Improvement', 1, 2, 3, 2, 2, NULL, '2026-06-09', '2026-06-09 08:25:01', '2026-06-09 08:25:01'),
(3, 60, 1, 13, 'Developing', 1, 3, 3, 3, 3, 'asd', '2026-06-12', '2026-06-12 12:01:01', '2026-06-12 12:01:01'),
(4, 71, 57, 15, 'Developing', 3, 3, 3, 4, 3, 'good test', '2026-06-24', '2026-06-24 08:43:15', '2026-06-24 08:43:15');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_student_song_assignments`
--

CREATE TABLE `tbl_student_song_assignments` (
  `assignment_id` int(11) NOT NULL,
  `song_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `enrollment_id` int(11) DEFAULT NULL,
  `progress_status` enum('assigned','practicing','polishing','completed') NOT NULL DEFAULT 'assigned',
  `assigned_notes` text DEFAULT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
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
(1, 26, 6, 'Kim', 'Minjeong', 'minjeong@gmail.com', '0900900909', 'Full-time', 'Active', '2026-03-28 03:31:56'),
(2, NULL, 5, 'Yu', 'Jimin', 'guitar1@gmail.com', '0920239293', 'Full-time', 'Active', '2026-03-28 11:35:07'),
(3, NULL, 6, 'Kim', 'Aeri', 'Aeri@gmail.com', '090293021', 'Full-time', 'Inactive', '2026-03-28 11:35:42'),
(4, 10, 5, 'Jeon', 'Jungkook', 'drum2@gmail.com', '090900900', 'Full-time', 'Active', '2026-03-28 11:46:22'),
(5, 15, 6, 'John', 'Doe', 'johndoe@gmail.com', '09095650494', 'Full-time', 'Active', '2026-03-28 13:16:44'),
(6, 16, 5, 'Alex', 'Guitar', 'guitar3@gmail.com', '0909090', 'Full-time', 'Active', '2026-03-28 13:28:04'),
(7, 20, 5, 'Reyna', 'Doe', 'violin2@gmail.com', '0090090', 'Full-time', 'Active', '2026-03-28 15:06:07'),
(8, 25, 6, 'Ning', 'Ning', 'ning@gmail.com', '0909209032', 'Full-time', 'Active', '2026-03-29 02:51:45'),
(9, 30, 5, 'GD', 'Dragon', 'gdragon@gmail.com', '09000909090', 'Full-time', 'Active', '2026-04-17 08:17:08'),
(12, NULL, 6, 'messi', 'hersomach', 'seanpabilona92@gmail.com', '88888', 'Full-time', 'Active', '2026-06-09 06:06:21'),
(13, NULL, 5, 'jhon', 'mica', 'reemchar2005@gmail.com', '09659153090', 'Full-time', 'Inactive', '2026-06-24 06:44:35'),
(14, NULL, 5, 'jhon', 'mica', 'reemchar2005@gmail.com', '09659153090', 'Full-time', 'Active', '2026-06-24 06:45:59'),
(15, NULL, 5, 'john', 'meca', 'reemchar2005@gmail.com', '09659153090', 'Full-time', 'Inactive', '2026-06-24 06:46:52'),
(16, 105, 5, 'Dong', 'Pitz', 'dongpitz@fas.com', '09659153090', 'Full-time', 'Active', '2026-06-24 07:57:07'),
(17, 108, 5, 'Bon', 'Sabeliina', 'bon@fas.com', '09875435679', 'Full-time', 'Active', '2026-06-24 09:01:20'),
(18, 111, 5, 'nicolas', 'cage', 'nicolas@fas.com', '09090909090', 'Full-time', 'Active', '2026-06-24 09:48:49'),
(19, 116, 6, 'Justin', 'Yu', NULL, '09090090909', 'Full-time', 'Active', '2026-07-07 12:34:27'),
(20, 117, 6, 'Ethan', 'Cruz', 'ethan@fas.com', '09171234561', 'Full-time', 'Active', '2026-07-07 12:38:03'),
(21, 118, 6, 'Liam', 'Santos', 'liam@fas.com', '09181234562', 'Full-time', 'Active', '2026-07-07 12:38:40');

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
(34, 6, 5, 'Wednesday', '09:00:00', '17:00:00', 'Available', '2026-03-29 04:16:24'),
(35, 6, 5, 'Friday', '09:00:00', '17:00:00', 'Available', '2026-03-29 04:16:24'),
(36, 6, 5, 'Saturday', '09:00:00', '17:00:00', 'Available', '2026-03-29 04:16:24'),
(48, 9, 5, 'Monday', '09:00:00', '17:00:00', 'Available', '2026-04-18 06:26:10'),
(49, 9, 5, 'Friday', '09:00:00', '17:00:00', 'Available', '2026-04-18 06:26:10'),
(50, 1, 6, 'Monday', '09:00:00', '17:00:00', 'Available', '2026-05-23 14:23:58'),
(51, 1, 6, 'Tuesday', '09:00:00', '17:00:00', 'Available', '2026-05-23 14:23:58'),
(52, 1, 6, 'Wednesday', '09:00:00', '17:00:00', 'Available', '2026-05-23 14:23:58'),
(53, 1, 6, 'Thursday', '09:00:00', '17:00:00', 'Available', '2026-05-23 14:23:58'),
(71, 5, 6, 'Monday', '09:00:00', '17:00:00', 'Available', '2026-06-09 06:12:56'),
(72, 5, 6, 'Tuesday', '09:00:00', '17:00:00', 'Available', '2026-06-09 06:12:56'),
(73, 5, 6, 'Wednesday', '09:00:00', '17:00:00', 'Available', '2026-06-09 06:12:56'),
(74, 5, 6, 'Thursday', '09:00:00', '17:00:00', 'Available', '2026-06-09 06:12:56'),
(75, 12, 6, 'Monday', '09:00:00', '17:00:00', 'Available', '2026-06-09 08:13:27'),
(76, 12, 6, 'Tuesday', '09:00:00', '17:00:00', 'Available', '2026-06-09 08:13:27'),
(77, 12, 6, 'Wednesday', '09:00:00', '17:00:00', 'Available', '2026-06-09 08:13:27'),
(78, 12, 6, 'Thursday', '09:00:00', '17:00:00', 'Available', '2026-06-09 08:13:27'),
(79, 12, 6, 'Friday', '09:00:00', '17:00:00', 'Available', '2026-06-09 08:13:27'),
(80, 12, 6, 'Saturday', '09:00:00', '17:00:00', 'Available', '2026-06-09 08:13:27'),
(81, 12, 6, 'Sunday', '09:00:00', '17:00:00', 'Available', '2026-06-09 08:13:27'),
(86, 15, 5, 'Monday', '09:00:00', '17:00:00', 'Available', '2026-06-24 06:55:51'),
(87, 15, 5, 'Tuesday', '09:00:00', '17:00:00', 'Available', '2026-06-24 06:55:51'),
(88, 15, 5, 'Wednesday', '09:00:00', '17:00:00', 'Available', '2026-06-24 06:55:51'),
(89, 15, 5, 'Thursday', '09:00:00', '17:00:00', 'Available', '2026-06-24 06:55:51'),
(90, 15, 5, 'Friday', '09:00:00', '17:00:00', 'Available', '2026-06-24 06:55:51'),
(91, 15, 5, 'Saturday', '09:00:00', '17:00:00', 'Available', '2026-06-24 06:55:51'),
(92, 15, 5, 'Sunday', '09:00:00', '17:00:00', 'Available', '2026-06-24 06:55:51'),
(95, 17, 5, 'Wednesday', '09:00:00', '17:00:00', 'Available', '2026-06-24 09:05:58'),
(96, 17, 5, 'Thursday', '09:00:00', '17:00:00', 'Available', '2026-06-24 09:05:58'),
(97, 17, 5, 'Friday', '09:00:00', '17:00:00', 'Available', '2026-06-24 09:05:58'),
(103, 7, 5, 'Wednesday', '09:00:00', '17:00:00', 'Available', '2026-06-24 09:12:28'),
(104, 7, 5, 'Thursday', '09:00:00', '17:00:00', 'Available', '2026-06-24 09:12:28'),
(105, 7, 5, 'Friday', '09:00:00', '17:00:00', 'Available', '2026-06-24 09:12:28'),
(114, 18, 5, 'Monday', '09:00:00', '17:00:00', 'Available', '2026-06-24 09:49:48'),
(115, 18, 5, 'Tuesday', '09:00:00', '17:00:00', 'Available', '2026-06-24 09:49:48'),
(116, 18, 5, 'Wednesday', '09:00:00', '17:00:00', 'Available', '2026-06-24 09:49:48'),
(117, 18, 5, 'Friday', '09:00:00', '17:00:00', 'Available', '2026-06-24 09:49:48'),
(118, 4, 5, 'Monday', '09:00:00', '17:00:00', 'Available', '2026-06-24 09:53:53'),
(119, 4, 5, 'Tuesday', '09:00:00', '17:00:00', 'Available', '2026-06-24 09:53:53'),
(120, 4, 5, 'Wednesday', '09:00:00', '17:00:00', 'Available', '2026-06-24 09:53:53'),
(121, 4, 5, 'Thursday', '09:00:00', '17:00:00', 'Available', '2026-06-24 09:53:53'),
(122, 4, 5, 'Friday', '09:00:00', '17:00:00', 'Available', '2026-06-24 09:53:53'),
(123, 16, 5, 'Wednesday', '09:00:00', '17:00:00', 'Available', '2026-06-24 17:44:42'),
(124, 16, 5, 'Thursday', '09:00:00', '17:00:00', 'Available', '2026-06-24 17:44:42'),
(125, 16, 5, 'Friday', '09:00:00', '17:00:00', 'Available', '2026-06-24 17:44:42'),
(126, 16, 5, 'Saturday', '09:00:00', '17:00:00', 'Available', '2026-06-24 17:44:42'),
(127, 16, 5, 'Sunday', '09:00:00', '17:00:00', 'Available', '2026-06-24 17:44:42'),
(128, 19, 6, 'Monday', '09:00:00', '17:00:00', 'Available', '2026-07-19 16:43:36'),
(129, 19, 6, 'Wednesday', '09:00:00', '17:00:00', 'Available', '2026-07-19 16:43:36'),
(130, 19, 6, 'Friday', '09:00:00', '17:00:00', 'Available', '2026-07-19 16:43:36'),
(131, 19, 6, 'Sunday', '09:00:00', '17:00:00', 'Available', '2026-07-19 16:43:36'),
(132, 20, 6, 'Monday', '09:00:00', '17:00:00', 'Available', '2026-07-19 17:24:23'),
(133, 20, 6, 'Tuesday', '09:00:00', '17:00:00', 'Available', '2026-07-19 17:24:23'),
(134, 20, 6, 'Wednesday', '09:00:00', '17:00:00', 'Available', '2026-07-19 17:24:23'),
(135, 20, 6, 'Thursday', '09:00:00', '17:00:00', 'Available', '2026-07-19 17:24:23'),
(136, 20, 6, 'Friday', '09:00:00', '17:00:00', 'Available', '2026-07-19 17:24:23');

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
(9, 2),
(12, 1),
(13, 8),
(14, 8),
(15, 8),
(16, 8),
(17, 12),
(18, 3),
(19, 8),
(20, 4),
(21, 4);

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
  `email_verified_at` datetime DEFAULT NULL,
  `email_verification_code_hash` varchar(255) DEFAULT NULL,
  `email_verification_code_expires_at` datetime DEFAULT NULL,
  `email_verification_sent_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_users`
--

INSERT INTO `tbl_users` (`user_id`, `username`, `password`, `role_id`, `branch_id`, `first_name`, `last_name`, `email`, `phone`, `status`, `email_verified_at`, `email_verification_code_hash`, `email_verification_code_expires_at`, `email_verification_sent_at`, `created_at`) VALUES
(1, 'fasadmin@music.com', '$2y$10$z3leOydLuLCNIgA3dHSQAeJAep.BZ7R92sufR87aETmyfLGSv7s5e', 1, NULL, 'FAS', 'Administrator', 'fasadmin@music.com', NULL, 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-28 00:25:11'),
(2, 'micah@gmail.com', '$2y$10$rYChNQTjsdLXy8VzJGg/H.Z.UVvQImYehTt9roOSqcDOminpRQZJm', 4, NULL, 'Micah', 'Lago', 'micah@gmail.com', '09902019202', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-28 02:02:57'),
(3, 'jonah@gmail.com', '$2y$10$w9lle5td/E0DVdjN52GkYOZ8Qu1yU59dVallIxenjSq6uW8FxpabC', 5, NULL, 'Jonah', 'Lago', 'jonah@gmail.com', '09079090', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-28 02:04:13'),
(4, 'drumuptown@gmail.com', '$2y$10$Cm4IuXpuIf68y73K.HjwFuoPVMkqRKqWPy.Avo0LXwWgVtBh91sp2', 7, NULL, 'Drum', 'Instructor test', 'drumuptown@gmail.com', '0900900909', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-28 03:31:56'),
(5, 'guitar1@gmail.com', '$2y$10$vnFspU/Tl/L6Aj0M15d8f.zVAK5hmbI37sIWl15xLSdD8YJUyUeTK', 7, NULL, 'Guitar Instructor', 'Test', 'guitar1@gmail.com', '0920239293', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-28 11:35:07'),
(6, 'violin1@gmail.com', '$2y$10$oB6qLufbGkyNoOsPC2GNqeRwCCs.YBZy/rBSls9X2Lx4Z4SeoYQbO', 7, NULL, 'Violin Instructor', 'Test', 'violin1@gmail.com', '090293021', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-28 11:35:42'),
(7, 'deskup1@gmail.com', '$2y$10$35NPUA4VAWddcCHa9VCMW.vqfRxh64pUo866Eo8qqLApJ.pB0MrGK', 3, 6, 'Desk', 'Uptown 1', 'deskup1@gmail.com', '090900900', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-28 11:38:43'),
(8, 'deskdown1@gmail.com', '$2y$10$EvsFNXZ3Y7c5xYBSGe4asOJXDJelV4tz/mghw3b40Jfvl8WatS3p2', 3, 5, 'Desk', 'Downtown 1', 'deskdown1@gmail.com', '009090090', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-28 11:39:22'),
(9, 'branchup1@gmail.com', '$2y$10$mt42UVmdRB5co8vrHPLO..P7Jum.LPuxAB.UENX6OGLUpgkHP9mmu', 2, 6, 'Branch Manager', 'Uptown 1', 'branchup1@gmail.com', '0909090900', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-28 11:41:28'),
(10, 'drum2@gmail.com', '$2y$10$w/JVZ5cCaEQf6i7f9/shzO33Fd6T9lgEUjhpODEuxQWB1ew.Hoj8K', 7, NULL, 'Drum', 'Downtown 1', 'drum2@gmail.com', '090900900', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-28 11:46:22'),
(12, 'mckenzie@gmail.com', '$2y$10$kFm5b6/I0NJi5THslORMeurpikuY1N/T1hZVymmjcWdwvSdAFK.0O', 4, NULL, 'mckenzie', 'lago', 'mckenzie@gmail.com', '0909090909', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-28 12:04:04'),
(13, 'branchdown1@gmail.com', '$2y$10$.xetbce02mCU0vwtDQibAexAnGkhKpKkw8OnhXqgwP81rYpRieAc.', 2, 5, 'Branch Manager', 'Downtown', 'branchdown1@gmail.com', '09090090', 'Active', NULL, NULL, NULL, NULL, '2026-03-28 12:22:35'),
(14, 'yumi@gmail.com', '$2y$10$1sofaD86x5jOGgmMIuNtRuLJzM4EQRcgZx6jaeK5GzepRlg7NNmSO', 4, NULL, 'Yumi', 'Lago', 'yumi@gmail.com', '09659153090', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-28 12:58:40'),
(15, 'johndoe@gmail.com', '$2y$10$fH7GpjTCl8ufxEwRUU4n1.fzrM28cxhwfGi9mSZIroXNI.k6J.dwy', 7, NULL, 'John', 'Doe', 'johndoe@gmail.com', '09095650494', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-28 13:16:44'),
(16, 'guitar3@gmail.com', '$2y$10$XDX1IIM3RWhmKomKB6OupeZC.N4HtgQbayL2dfz3rGhL8saaY57bG', 7, NULL, 'Alex', 'Guitar', 'guitar3@gmail.com', '0909090', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-28 13:28:04'),
(18, 'test@gmail.com', '$2y$10$XdtoDrZXcikbmRM5c6uPw.eIKJnoBPcjLI4Ph1ddk6kCnIND/R5bi', 4, NULL, 'test', 'test', 'test@gmail.com', '090909090', 'Inactive', '2026-06-04 19:34:04', NULL, NULL, NULL, '2026-03-28 14:39:58'),
(19, 'arman@gmail.com', '$2y$10$MdioBTf5Ce4sDFoZpTE.8.J9DajHH.yBe/zqmzjNAL7gFi9CDzBVe', 4, NULL, 'Arman', 'Salon', 'arman@gmail.com', '09659153090', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-28 15:03:39'),
(20, 'violin2@gmail.com', '$2y$10$e2jixKabXElo/i8wWaJeK.fu3IUqHmdzewEM4wl4K2rXA/fGg98Qa', 7, NULL, 'Reyna', 'Doe', 'violin2@gmail.com', '0090090', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-28 15:06:07'),
(21, 'bruno@gmail.com', '$2y$10$SVoMZbNLGllp52HQM.rkze6XXOUtXej9t3UqN.O0jF6hY8eGD9h06', 4, NULL, 'Bruno', 'Mars', 'bruno@gmail.com', '09748372013', 'Inactive', '2026-06-04 19:34:04', NULL, NULL, NULL, '2026-03-28 15:51:09'),
(22, 'ariana@gmail.com', '$2y$10$7Td2fm0i4AOxDWZWqICA/eg6xkbC.CczFkj27hQ2nve/SNwOwN5TC', 4, NULL, 'Ariana', 'Grande', 'ariana@gmail.com', '090049303', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-28 16:09:41'),
(23, 'james@gmail.com', '$2y$10$gW/briMNyynBeXz/Ka6GrOEBjFCbgjmSPySe1mX.8oEIABtVQrZfS', 4, NULL, 'James', 'Garcia', 'james@gmail.com', '098069503', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-29 01:57:18'),
(24, 'oliver@gmail.com', '$2y$10$71wm6hE2a67MAGgagpqtBubhwJFKZ.Pxtvv49u3uLm4thamv06gVq', 5, NULL, 'Oliver', 'Garcia', 'oliver@gmail.com', '096483472', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-29 02:20:37'),
(25, 'ning@gmail.com', '$2y$10$hJGNAs9PitcShvLLlghGM.2BEuiQ.53gHA1cHy4bv5KrIDxvw4GvO', 7, NULL, 'Ning', 'Ning', 'ning@gmail.com', '0909209032', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-29 02:51:45'),
(26, 'minjeong@gmail.com', '$2y$10$BGH9IiuxAAsRxlAVRYUy4ug3r0nujcYjkLuiiQ.Xxlqx.KT9aHz1m', 7, NULL, 'Kim', 'Minjeong', 'minjeong@gmail.com', '0900900909', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-29 03:26:18'),
(27, 'jeon@gmail.com', '$2y$10$/p1FjpM/7mcG22l.zvYwveBCr8Tk5TxLSFAMlaagfS4LxOgZ3aQGa', 4, NULL, 'Jeon', 'Jungkook', 'jeon@gmail.com', '090799574903', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-29 04:04:37'),
(28, 'seokjin@gmail.com', '$2y$10$NLCv467L3yIwShrRYSLhm.3DDZh5zJo4cuvScKb.yQS7VOlz84/kK', 4, NULL, 'Seokjin', 'Kim', 'seokjin@gmail.com', '0907940902', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-03-29 04:07:29'),
(29, 'branchup2@gmail.com', '$2y$10$eKpiWHYvDpb0T9PSVu3PCumif93Fcc0msA7yssvdR36LXYnstT/di', 2, 6, 'branch', 'uptown test 2', 'branchup2@gmail.com', '090290302901', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-04-07 02:24:45'),
(30, 'gdragon@gmail.com', '$2y$10$Or4Jx5U4m6mIyJ9CndZQJeyfGeK1BhxM7J4d70R33xIz8imPrPWhe', 7, NULL, 'GD', 'Dragon', 'gdragon@gmail.com', '09000909090', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-04-17 08:17:08'),
(31, 'jennie@gmail.com', '$2y$10$jbLw7Kty.tSPS.2lOS4F6Od/abQ9LhPh21NTP92QGBjtTyPAaa9nu', 4, NULL, 'Jennie', 'Kim', 'jennie@gmail.com', '090909090', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-04-17 08:20:43'),
(32, 'branchdown2@gmail.com', '$2y$10$nV2qIKPVatAcb0UAfT2v/ez3iLO5pPoAY91LQHDExhrTDXcD8NkZu', 2, 5, 'Branch', 'Downtown', 'branchdown2@gmail.com', '09090009', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-04-17 15:18:48'),
(33, 'skusta@gmail.com', '$2y$10$c.8eIq8OxFBugvyFVYcPCOZ4K4eNOkiS.kUizJ9Eu.GZQsbTi7GQ2', 4, NULL, 'Skusta', 'Clee', 'skusta@gmail.com', '09090909', 'Inactive', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-04-18 02:16:13'),
(35, 'roberto@gmail.com', '$2y$10$lZp8H8AC9gpP.gsS63nG2e4/MmdIVpgeT7qDynrVrCz4hc4p9BLpG', 5, NULL, 'Roberto', 'Villanueva', 'roberto@gmail.com', '131231235', 'Active', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-05-23 05:28:16'),
(36, 'sophie@gmail.com', '$2y$10$MwxgcZ6rA0Jwmi4nTMIRWuPH1mkAU0Q0XLu3JwqCJHgEvDv52Jdx.', 4, NULL, 'Sophie', 'Villanueva', 'sophie@gmail.com', '0908090808', 'Inactive', '2026-05-31 17:06:42', NULL, NULL, NULL, '2026-05-23 11:44:27'),
(81, 'seanjoneilpabilona@gmail.com', '$2y$10$PTySbDhVCnjscAMGVqwNg.m0gJ7OmY36AM9OwDVgZhfxKGrWGbgqm', 4, NULL, 'sean', 'pabilona', 'seanjoneilpabilona@gmail.com', '09069263319', 'Active', '2026-06-09 13:55:20', NULL, NULL, NULL, '2026-06-09 05:54:08'),
(84, 'Lenardjameslaurente123@gmail.com', '$2y$10$nZAqi166lHJQi5gJlkZCmuKih9bWjtMXnUKXsdKo21iK5riICWzia', 4, NULL, 'Lenard', 'Laurente', 'Lenardjameslaurente123@gmail.com', '09089605960', 'Active', '2026-06-09 14:16:50', NULL, NULL, NULL, '2026-06-09 06:16:18'),
(87, 'pabs@fas.com', '$2y$10$sh40ovNBAJgr8hUCoifD8O3iStxisUt0Qcu/lXDl.qugfWOLzLarC', 4, NULL, 'pabs', 'kie', 'pabs@fas.com', '09659153090', 'Active', '2026-06-09 15:45:53', NULL, NULL, NULL, '2026-06-09 07:45:53'),
(88, 'shandi@fas.com', '$2y$10$g26vQmeCKe5g7JjQrftmBulG58Amj0DMFFGiZpzC6gbLFvjvuhWnW', 4, NULL, 'shandi', 'kate', 'shandi@fas.com', '09659153090', 'Active', '2026-06-09 15:46:55', NULL, NULL, NULL, '2026-06-09 07:46:54'),
(89, 'mica@fas.com', '$2y$10$op6yORDdQiGB0Qd6uAqkyuXYCoU3Mc99aT61rK0RIjLrTkYckkq4W', 4, NULL, 'Micah', 'Lago', 'mica@fas.com', '09659153090', 'Active', '2026-06-09 16:11:05', NULL, NULL, NULL, '2026-06-09 08:11:05'),
(92, 'midu.lago.coc@phinmaed.com', '$2y$10$LixY68ShsEpIN/COkBkzSe2w0kl7YNWMdjyr6oEaC/E/OoZI0ERN2', 4, NULL, 'Micah', 'Lago', 'midu.lago.coc@phinmaed.com', '0965915309', 'Active', '2026-06-14 19:57:57', NULL, NULL, NULL, '2026-06-14 11:57:11'),
(93, 'silentqie01@gmail.com', '$2y$10$orkk2Au7kwg46nPeWF2P8edGJzM1.Dx.MDaYWSa5Tb9rno2Rr44vW', 4, NULL, 'mai', 'kie', 'silentqie01@gmail.com', '0965915309', 'Active', '2026-06-18 00:22:51', NULL, NULL, NULL, '2026-06-17 16:22:16'),
(94, 'pacaambungnorcaya@gmail.com', '$2y$10$BiMPjsQ1W/C.o9.8OkO1heLchzg/e1G8B5316pedY2Jlx2Y/Cz7B2', 4, NULL, 'Norcaya', 'Pacaambung', 'pacaambungnorcaya@gmail.com', '9535149532', 'Active', '2026-06-24 14:30:47', NULL, NULL, NULL, '2026-06-24 06:29:47'),
(105, 'dongpitz@fas.com', '$2y$10$HY5zNHG2VybAldhJLC5sCOfoGZvEZC/8KxJMEo0B04RVJmLhPr8Ui', 7, NULL, 'Dong', 'Pitz', 'dongpitz@fas.com', '09659153090', 'Active', '2026-06-24 15:57:33', NULL, NULL, NULL, '2026-06-24 07:57:07'),
(106, 'alekkkkk@gmail.com', '$2y$10$BCQLGNi2IEKwXuadneODRus5xxKLMpXsg9dFhzBHSxCIwt8DLgbdm', 4, NULL, 'Alek', 'Benjamin', 'alekkkkk@gmail.com', '9675218039', 'Inactive', NULL, '$2y$10$/0XG5nRpNs9pvbohfgaLduOYeP7Ur6J/AtmXgE7GTMA624KezMKEq', '2026-06-24 17:02:05', '2026-06-24 16:47:05', '2026-06-24 08:47:05'),
(107, 'sham.linaac.coc@phinmaed.com', '$2y$10$qETZZ61gNreHCDDmlvri1.nEIAjBjgu9hhEbVzIAA8z2k8JVBUYXe', 4, NULL, 'Alek', 'Benjamin', 'sham.linaac.coc@phinmaed.com', '9675218039', 'Active', '2026-06-24 16:49:59', NULL, NULL, NULL, '2026-06-24 08:48:23'),
(108, 'bon@fas.com', '$2y$10$oevMg6pE74.4ffb7Crhyle7460W.2wHQdsNkQ7PB7GIeVLqJg4aBK', 7, NULL, 'Bon', 'Sabeliina', 'bon@fas.com', '09875435679', 'Active', '2026-06-24 17:03:07', NULL, NULL, NULL, '2026-06-24 09:01:20'),
(109, 'shandee@fas.com', '$2y$10$iWHNM0RKi3L78F9em.vJAeFg3/kd1GGuAkJ5DIUGKYMjXUcPeY/..', 4, NULL, 'Shan', 'Makalimot', 'shandee@fas.com', '09659153090', 'Active', '2026-06-24 17:34:03', NULL, NULL, NULL, '2026-06-24 09:34:03'),
(110, 'jannahxd@fas.com', '$2y$10$BFd0mq5WJerityQiJerqDOZ3Mc0JwjkNgW4KOpptiCP7/ozOu0Doa', 4, NULL, 'jann', 'nnah', 'jannahxd@fas.com', '09090909', 'Active', '2026-06-24 17:46:44', NULL, NULL, NULL, '2026-06-24 09:46:44'),
(111, 'nicolas@fas.com', '$2y$10$21bXFDz8paoDgVsW9vVP9uL7uMclIjAt.i4D0sbIbbxMuXh5WVmQa', 7, NULL, 'nicolas', 'cage', 'nicolas@fas.com', '09090909090', 'Active', '2026-06-24 17:49:09', NULL, NULL, NULL, '2026-06-24 09:48:49'),
(112, 'michael@fas.com', '$2y$10$iWoYb.Xv67eA9haEmZ3E/eCAUM52bTuGsdAGvkb4GlGGCgEThz/bm', 4, NULL, 'Michael', 'Reyes', 'michael@fas.com', NULL, 'Active', '2026-06-25 00:11:56', NULL, NULL, NULL, '2026-06-24 16:11:56'),
(113, 'berto@fas.com', '$2y$10$VFfdqqSWd/ziOt3M4D88QOHJH0jr./LWxTA1kkRdv9UOoWzCkxrtO', 5, NULL, 'Berto', 'Reyes', 'berto@fas.com', '9659153090', 'Active', '2026-06-25 00:11:56', NULL, NULL, NULL, '2026-06-24 16:11:56'),
(114, 'clove@fas.com', '$2y$10$lZChraLg7sZ/5TaI/VoBae1ANU9v5xGyULxGwgr7irCMiK.MlHxI2', 4, NULL, 'Clove', 'Delacruz', 'clove@fas.com', '9659153090', 'Active', '2026-06-25 01:35:03', NULL, NULL, NULL, '2026-06-24 17:35:03'),
(115, 'example@fas.com', '$2y$10$Ce8E1pIzCQNEyg4v5i2qqegXnABSt.ErgxCi7L2YEOnwlwLcrwTIG', 4, NULL, 'example', 'ex', 'example@fas.com', '09659153090', 'Active', '2026-07-03 16:33:13', NULL, NULL, NULL, '2026-07-03 08:33:13'),
(116, 'justinyu@fas.com', '$2y$10$v824XnQjOwmOnYnP6619yesZqjARC8xI5GvMD1XEPFx6NBqcM2tA2', 7, NULL, 'Justin', 'Yu', NULL, '09090090909', 'Active', '2026-07-07 20:34:43', NULL, NULL, NULL, '2026-07-07 12:34:27'),
(117, 'ethan@fas.com', '$2y$10$t1h73rttlBhH6PswROx2WO.0/K4QZxC0KqVcdXAJSqPhubhj4zqcS', 7, NULL, 'Ethan', 'Cruz', 'ethan@fas.com', '09171234561', 'Active', '2026-07-09 21:53:47', NULL, NULL, NULL, '2026-07-07 12:38:03'),
(118, 'liam@fas.com', '$2y$10$XkC935f83ftQk4/h66SRduwIXT7tJiQ1oBM6JWUli8ra/g9GAegau', 7, NULL, 'Liam', 'Santos', 'liam@fas.com', '09181234562', 'Active', '2026-07-09 21:53:47', NULL, NULL, NULL, '2026-07-07 12:38:40'),
(119, 'pabilona@fas.com', '$2y$10$8AB/WKCUUfbB8cDiACj2L.wr5JBszwApuLrcUhSOUMhuf/YEuVMhW', 4, NULL, 'pabskie', 'papabs', 'pabilona@fas.com', '0900909', 'Active', '2026-07-20 09:44:05', NULL, NULL, NULL, '2026-07-20 01:44:05');

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
-- Indexes for table `tbl_audit_logs`
--
ALTER TABLE `tbl_audit_logs`
  ADD PRIMARY KEY (`log_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_action` (`action`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_audit_module` (`module`),
  ADD KEY `idx_audit_severity` (`severity`);

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
-- Indexes for table `tbl_featured_posts`
--
ALTER TABLE `tbl_featured_posts`
  ADD PRIMARY KEY (`featured_post_id`),
  ADD KEY `idx_featured_posts_status` (`status`),
  ADD KEY `idx_featured_posts_branch` (`branch_id`),
  ADD KEY `idx_featured_posts_published` (`published_at`);

--
-- Indexes for table `tbl_freeze_payments`
--
ALTER TABLE `tbl_freeze_payments`
  ADD PRIMARY KEY (`freeze_payment_id`),
  ADD KEY `idx_fp_enrollment` (`enrollment_id`),
  ADD KEY `idx_fp_student` (`student_id`),
  ADD KEY `idx_fp_status` (`status`);

--
-- Indexes for table `tbl_guardians`
--
ALTER TABLE `tbl_guardians`
  ADD PRIMARY KEY (`guardian_id`);

--
-- Indexes for table `tbl_guardian_absence_requests`
--
ALTER TABLE `tbl_guardian_absence_requests`
  ADD PRIMARY KEY (`request_id`),
  ADD KEY `idx_guardian_absence_branch_status` (`branch_id`,`status`,`session_date`),
  ADD KEY `idx_guardian_absence_guardian` (`guardian_id`,`created_at`),
  ADD KEY `idx_guardian_absence_student_date` (`student_id`,`session_date`);

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
-- Indexes for table `tbl_song_lesson_history`
--
ALTER TABLE `tbl_song_lesson_history`
  ADD PRIMARY KEY (`history_id`),
  ADD KEY `idx_song_history_assignment` (`assignment_id`);

--
-- Indexes for table `tbl_song_library`
--
ALTER TABLE `tbl_song_library`
  ADD PRIMARY KEY (`song_id`),
  ADD KEY `idx_song_library_teacher` (`teacher_id`),
  ADD KEY `idx_song_library_category` (`category`);

--
-- Indexes for table `tbl_specialization`
--
ALTER TABLE `tbl_specialization`
  ADD PRIMARY KEY (`specialization_id`),
  ADD UNIQUE KEY `uniq_specialization_name` (`specialization_name`),
  ADD KEY `idx_spec_type_id` (`type_id`);

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
  ADD KEY `instrument_id` (`instrument_id`),
  ADD KEY `idx_student_progress_session` (`session_id`),
  ADD KEY `idx_student_progress_student` (`student_id`);

--
-- Indexes for table `tbl_student_song_assignments`
--
ALTER TABLE `tbl_student_song_assignments`
  ADD PRIMARY KEY (`assignment_id`),
  ADD KEY `idx_song_assignments_teacher` (`teacher_id`),
  ADD KEY `idx_song_assignments_student` (`student_id`),
  ADD KEY `idx_song_assignments_song` (`song_id`);

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
  MODIFY `attendance_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `tbl_audit_logs`
--
ALTER TABLE `tbl_audit_logs`
  MODIFY `log_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=78;

--
-- AUTO_INCREMENT for table `tbl_branches`
--
ALTER TABLE `tbl_branches`
  MODIFY `branch_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `tbl_enrollments`
--
ALTER TABLE `tbl_enrollments`
  MODIFY `enrollment_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `tbl_enrollment_schedule_slots`
--
ALTER TABLE `tbl_enrollment_schedule_slots`
  MODIFY `slot_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=48;

--
-- AUTO_INCREMENT for table `tbl_featured_posts`
--
ALTER TABLE `tbl_featured_posts`
  MODIFY `featured_post_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `tbl_freeze_payments`
--
ALTER TABLE `tbl_freeze_payments`
  MODIFY `freeze_payment_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `tbl_guardians`
--
ALTER TABLE `tbl_guardians`
  MODIFY `guardian_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `tbl_guardian_absence_requests`
--
ALTER TABLE `tbl_guardian_absence_requests`
  MODIFY `request_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_instruments`
--
ALTER TABLE `tbl_instruments`
  MODIFY `instrument_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;

--
-- AUTO_INCREMENT for table `tbl_instrument_types`
--
ALTER TABLE `tbl_instrument_types`
  MODIFY `type_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=106;

--
-- AUTO_INCREMENT for table `tbl_makeup_sessions`
--
ALTER TABLE `tbl_makeup_sessions`
  MODIFY `makeup_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_payments`
--
ALTER TABLE `tbl_payments`
  MODIFY `payment_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

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
  MODIFY `registration_payment_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

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
  MODIFY `room_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `tbl_schedule`
--
ALTER TABLE `tbl_schedule`
  MODIFY `schedule_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_schedule_operation_lookup`
--
ALTER TABLE `tbl_schedule_operation_lookup`
  MODIFY `operation_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27987;

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
  MODIFY `session_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=201;

--
-- AUTO_INCREMENT for table `tbl_session_packages`
--
ALTER TABLE `tbl_session_packages`
  MODIFY `package_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `tbl_settings`
--
ALTER TABLE `tbl_settings`
  MODIFY `setting_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `tbl_song_lesson_history`
--
ALTER TABLE `tbl_song_lesson_history`
  MODIFY `history_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_song_library`
--
ALTER TABLE `tbl_song_library`
  MODIFY `song_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `tbl_specialization`
--
ALTER TABLE `tbl_specialization`
  MODIFY `specialization_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `tbl_students`
--
ALTER TABLE `tbl_students`
  MODIFY `student_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=80;

--
-- AUTO_INCREMENT for table `tbl_student_guardians`
--
ALTER TABLE `tbl_student_guardians`
  MODIFY `student_guardian_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `tbl_student_instruments`
--
ALTER TABLE `tbl_student_instruments`
  MODIFY `student_instrument_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `tbl_student_progress`
--
ALTER TABLE `tbl_student_progress`
  MODIFY `progress_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `tbl_student_song_assignments`
--
ALTER TABLE `tbl_student_song_assignments`
  MODIFY `assignment_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_teachers`
--
ALTER TABLE `tbl_teachers`
  MODIFY `teacher_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `tbl_teacher_availability`
--
ALTER TABLE `tbl_teacher_availability`
  MODIFY `availability_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=137;

--
-- AUTO_INCREMENT for table `tbl_users`
--
ALTER TABLE `tbl_users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=120;

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
