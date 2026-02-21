<?php
// Suppress error display for JSON APIs
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once 'db_connect.php';

header("Content-Type: application/json");

// Check if database connection exists
if (!isset($conn) || $conn === null) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

class Admin
{
    private $conn;

    public function __construct($pdo)
    {
        $this->conn = $pdo;
    }

    public function sendJSON($data, $status = 200)
    {
        http_response_code($status);
        echo json_encode($data);
        exit;
    }

    private function hasStudentColumn($columnName)
    {
        try {
            $stmt = $this->conn->prepare("SHOW COLUMNS FROM tbl_students LIKE ?");
            $stmt->execute([$columnName]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            return false;
        }
    }

    private function tableExists($tableName)
    {
        try {
            $stmt = $this->conn->prepare("SHOW TABLES LIKE ?");
            $stmt->execute([$tableName]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            return false;
        }
    }

    private function ensureStudentRegistrationFeesTable()
    {
        try {
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS tbl_student_registration_fees (
                    registration_id INT AUTO_INCREMENT PRIMARY KEY,
                    student_id INT NOT NULL,
                    registration_fee_amount DECIMAL(10,2) NOT NULL DEFAULT 1000.00,
                    registration_fee_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    registration_status ENUM('Pending','Fee Paid','Approved','Rejected') NOT NULL DEFAULT 'Pending',
                    notes TEXT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_registration_fee_student (student_id)
                )
            ");
        } catch (PDOException $e) {
            // Keep API alive
        }
    }

    private function getLatestEnrollmentIdByStudent($studentId, $statuses = [])
    {
        if (!$this->tableExists('tbl_enrollments')) {
            return 0;
        }

        $params = [(int)$studentId];
        $sql = "
            SELECT e.enrollment_id
            FROM tbl_enrollments e
            WHERE e.student_id = ?
        ";
        if (!empty($statuses)) {
            $placeholders = implode(',', array_fill(0, count($statuses), '?'));
            $sql .= " AND e.registration_status IN ({$placeholders})";
            foreach ($statuses as $status) {
                $params[] = $status;
            }
        }
        $sql .= " ORDER BY e.created_at DESC, e.enrollment_id DESC LIMIT 1";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);
        return (int)($stmt->fetchColumn() ?: 0);
    }

    private function ensureStudentRegistrationProofColumn()
    {
        if ($this->hasStudentColumn('registration_proof_path')) return;
        try {
            $this->conn->exec("ALTER TABLE tbl_students ADD COLUMN registration_proof_path VARCHAR(255) NULL AFTER registration_fee_paid");
        } catch (PDOException $e) {
            // Keep API working even if alter fails
        }
    }

    // 🔍 View pending students
    public function getPendingStudents()
    {
        $this->ensureStudentRegistrationFeesTable();
        $stmt = $this->conn->prepare("
            SELECT
                s.student_id,
                s.first_name,
                s.last_name,
                s.email,
                s.phone,
                COALESCE(rf.registration_fee_amount, 1000.00) AS registration_fee_amount,
                COALESCE(rf.registration_status, 'Pending') AS registration_status
            FROM tbl_students s
            LEFT JOIN tbl_student_registration_fees rf ON rf.student_id = s.student_id
            WHERE COALESCE(rf.registration_status, 'Pending') = 'Pending'
        ");
        $stmt->execute();

        $this->sendJSON([
            'success' => true,
            'students' => $stmt->fetchAll(PDO::FETCH_ASSOC)
        ]);
    }

    // 🔍 Get pending registrations with guardian and branch info
    public function getPendingRegistrations()
    {
        $this->ensureStudentRegistrationFeesTable();
        $stmt = $this->conn->prepare("
            SELECT
                s.student_id,
                s.first_name,
                s.last_name,
                s.email,
                s.phone,
                COALESCE(rf.registration_fee_amount, 1000.00) AS registration_fee_amount,
                COALESCE(rf.registration_fee_paid, 0.00) AS registration_fee_paid,
                NULL AS registration_proof_path,
                COALESCE(rf.registration_status, 'Pending') AS registration_status,
                COALESCE(rf.created_at, s.created_at) AS created_at,
                b.branch_name,
                g.first_name as guardian_first_name,
                g.last_name as guardian_last_name,
                g.phone as guardian_phone
            FROM tbl_students s
            LEFT JOIN tbl_student_registration_fees rf ON rf.student_id = s.student_id
            LEFT JOIN tbl_branches b ON s.branch_id = b.branch_id
            LEFT JOIN tbl_student_guardians sg ON s.student_id = sg.student_id AND sg.is_primary_guardian = 'Y'
            LEFT JOIN tbl_guardians g ON sg.guardian_id = g.guardian_id
            WHERE COALESCE(rf.registration_status, 'Pending') = 'Pending'
            ORDER BY COALESCE(rf.created_at, s.created_at) DESC
        ");
        $stmt->execute();

        $this->sendJSON([
            'success' => true,
            'registrations' => $stmt->fetchAll(PDO::FETCH_ASSOC)
        ]);
    }

    // 🔍 Get all registrations with guardian and branch info (excludes Rejected - they are removed/counted separately)
    public function getAllRegistrations()
    {
        $this->ensureStudentRegistrationFeesTable();
        $stmt = $this->conn->prepare("
            SELECT
                s.student_id,
                s.first_name,
                s.last_name,
                s.email,
                s.phone,
                COALESCE(rf.registration_fee_amount, 1000.00) AS registration_fee_amount,
                COALESCE(rf.registration_fee_paid, 0.00) AS registration_fee_paid,
                NULL AS registration_proof_path,
                COALESCE(rf.registration_status, 'Pending') AS registration_status,
                COALESCE(rf.created_at, s.created_at) AS created_at,
                b.branch_name,
                g.first_name as guardian_first_name,
                g.last_name as guardian_last_name,
                g.phone as guardian_phone
            FROM tbl_students s
            LEFT JOIN tbl_student_registration_fees rf ON rf.student_id = s.student_id
            LEFT JOIN tbl_branches b ON s.branch_id = b.branch_id
            LEFT JOIN tbl_student_guardians sg ON s.student_id = sg.student_id AND sg.is_primary_guardian = 'Y'
            LEFT JOIN tbl_guardians g ON sg.guardian_id = g.guardian_id
            WHERE COALESCE(rf.registration_status, 'Pending') != 'Rejected'
            ORDER BY COALESCE(rf.created_at, s.created_at) DESC
        ");
        $stmt->execute();

        $this->sendJSON([
            'success' => true,
            'registrations' => $stmt->fetchAll(PDO::FETCH_ASSOC)
        ]);
    }

    // 💰 Get total revenue summary (registration payments + lesson/enrollment payments)
    public function getRevenueSummary()
    {
        try {
            // Check if registration_payments uses student_id or enrollment_id
            $checkCol = $this->conn->query("SHOW COLUMNS FROM tbl_registration_payments LIKE 'student_id'");
            $hasStudentId = $checkCol && $checkCol->rowCount() > 0;
            
            if ($hasStudentId) {
                $stmtRegistration = $this->conn->prepare("
                    SELECT COALESCE(SUM(amount), 0) AS total
                    FROM tbl_registration_payments
                    WHERE status = 'Paid'
                ");
            } else {
                // fas_db.sql structure - uses enrollment_id
                $stmtRegistration = $this->conn->prepare("
                    SELECT COALESCE(SUM(amount), 0) AS total
                    FROM tbl_registration_payments
                    WHERE status = 'Paid'
                ");
            }
            $stmtRegistration->execute();
            $registrationRevenue = (float)($stmtRegistration->fetch(PDO::FETCH_ASSOC)['total'] ?? 0);

            $stmtLesson = $this->conn->prepare("
                SELECT COALESCE(SUM(amount), 0) AS total
                FROM tbl_payments
                WHERE status = 'Paid'
            ");
            $stmtLesson->execute();
            $lessonRevenue = (float)($stmtLesson->fetch(PDO::FETCH_ASSOC)['total'] ?? 0);

            $this->sendJSON([
                'success' => true,
                'registration_revenue' => $registrationRevenue,
                'lesson_revenue' => $lessonRevenue,
                'total_revenue' => $registrationRevenue + $lessonRevenue
            ]);
        } catch (Exception $e) {
            $this->sendJSON(['error' => 'Failed to load revenue summary: ' . $e->getMessage()], 500);
        }
    }


    // ✅ Approve student
    public function approveStudent($json)
    {
        $data = json_decode($json, true);

        if (empty($data['student_id'])) {
            $this->sendJSON(['error' => 'student_id required'], 400);
        }

        try {
            $this->conn->beginTransaction();

            // Get student email to find associated user account
            $stmtStudent = $this->conn->prepare("
                SELECT email FROM tbl_students WHERE student_id = ?
            ");
            $stmtStudent->execute([$data['student_id']]);
            $student = $stmtStudent->fetch(PDO::FETCH_ASSOC);

            if (!$student) {
                $this->conn->rollBack();
                $this->sendJSON(['error' => 'Student not found'], 404);
            }

            $this->ensureStudentRegistrationFeesTable();
            $stmtReg = $this->conn->prepare("
                INSERT INTO tbl_student_registration_fees (
                    student_id, registration_fee_amount, registration_fee_paid, registration_status
                ) VALUES (?, 1000.00, 1000.00, 'Approved')
                ON DUPLICATE KEY UPDATE
                    registration_status = 'Approved',
                    registration_fee_paid = GREATEST(registration_fee_paid, registration_fee_amount)
            ");
            $stmtReg->execute([$data['student_id']]);

            $stmt = $this->conn->prepare("
                UPDATE tbl_students
                SET status = 'Active'
                WHERE student_id = ?
            ");
            $stmt->execute([$data['student_id']]);

            // Activate user account if it exists (linked by email)
            if (!empty($student['email'])) {
                $stmtUser = $this->conn->prepare("
                    UPDATE tbl_users
                    SET status = 'Active'
                    WHERE email = ? AND status = 'Inactive'
                ");
                $stmtUser->execute([$student['email']]);
            }

            $this->conn->commit();

            $this->sendJSON([
                'success' => true,
                'message' => 'Student approved successfully. User account has been activated.'
            ]);
        } catch (Exception $e) {
            $this->conn->rollBack();
            $this->sendJSON(['error' => 'Failed to approve student: ' . $e->getMessage()], 500);
        }
    }

    // ❌ Reject student (removes from DB so they are not counted as registered)
    public function rejectStudent($json)
    {
        $data = json_decode($json, true);

        if (empty($data['student_id'])) {
            $this->sendJSON(['error' => 'student_id required'], 400);
        }

        $studentId = (int) $data['student_id'];

        try {
            $this->conn->beginTransaction();

            // Get student email before delete (for user account removal)
            $stmtStudent = $this->conn->prepare("SELECT email FROM tbl_students WHERE student_id = ?");
            $stmtStudent->execute([$studentId]);
            $student = $stmtStudent->fetch(PDO::FETCH_ASSOC);

            if (!$student) {
                $this->conn->rollBack();
                $this->sendJSON(['error' => 'Student not found'], 404);
            }

            $email = $student['email'] ?? null;

            // Delete user account (linked by email) so they cannot login
            if (!empty($email)) {
                $roleStmt = $this->conn->prepare("SELECT role_id FROM tbl_roles WHERE role_name = 'Student' LIMIT 1");
                $roleStmt->execute();
                $role = $roleStmt->fetch(PDO::FETCH_ASSOC);
                if ($role) {
                    $stmtUser = $this->conn->prepare("DELETE FROM tbl_users WHERE email = ? AND role_id = ?");
                    $stmtUser->execute([$email, $role['role_id']]);
                }
            }

            // Delete student (CASCADE will remove related records)
            // Note: In fas_db.sql, registration_payments links to enrollments, so delete enrollments first
            $checkCol = $this->conn->query("SHOW COLUMNS FROM tbl_registration_payments LIKE 'student_id'");
            $hasStudentId = $checkCol && $checkCol->rowCount() > 0;
            
            if (!$hasStudentId) {
                // fas_db.sql structure - delete enrollments first (which will cascade delete registration_payments)
                $stmtDelEnroll = $this->conn->prepare("DELETE FROM tbl_enrollments WHERE student_id = ?");
                $stmtDelEnroll->execute([$studentId]);
            }
            
            $stmtDelete = $this->conn->prepare("DELETE FROM tbl_students WHERE student_id = ?");
            $stmtDelete->execute([$studentId]);

            $this->conn->commit();

            $this->sendJSON([
                'success' => true,
                'message' => 'Registration rejected and removed from the system'
            ]);
        } catch (Exception $e) {
            $this->conn->rollBack();
            // If hard delete fails, mark registration as rejected and deactivate.
            $this->ensureStudentRegistrationFeesTable();
            $stmt = $this->conn->prepare("
                INSERT INTO tbl_student_registration_fees (
                    student_id, registration_fee_amount, registration_fee_paid, registration_status
                ) VALUES (?, 1000.00, 0.00, 'Rejected')
                ON DUPLICATE KEY UPDATE registration_status = 'Rejected'
            ");
            $stmt->execute([$studentId]);
            $stmt2 = $this->conn->prepare("
                UPDATE tbl_students
                SET status = 'Inactive'
                WHERE student_id = ?
            ");
            $stmt2->execute([$studentId]);
            $this->sendJSON([
                'success' => true,
                'message' => 'Registration rejected'
            ]);
        }
    }

    // 💰 Confirm Payment
    public function confirmPayment($json)
    {
        $data = json_decode($json, true);

        if (empty($data['student_id']) || empty($data['amount']) || empty($data['payment_method'])) {
            $this->sendJSON(['error' => 'student_id, amount, and payment_method are required'], 400);
        }

        try {
            $this->ensureStudentRegistrationFeesTable();
            $this->conn->beginTransaction();
            $stmt = $this->conn->prepare("
                SELECT
                    student_id,
                    registration_fee_amount,
                    registration_fee_paid,
                    registration_status
                FROM tbl_student_registration_fees
                WHERE student_id = ?
                LIMIT 1
            ");
            $stmt->execute([$data['student_id']]);
            $student = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$student) {
                $seed = $this->conn->prepare("
                    INSERT INTO tbl_student_registration_fees (
                        student_id, registration_fee_amount, registration_fee_paid, registration_status
                    ) VALUES (?, 1000.00, 0.00, 'Pending')
                ");
                $seed->execute([$data['student_id']]);
                $stmt->execute([$data['student_id']]);
                $student = $stmt->fetch(PDO::FETCH_ASSOC);
            }

            $newPaid = ($student['registration_fee_paid'] ?? 0) + $data['amount'];
            $remaining = $student['registration_fee_amount'] - $newPaid;
            $receipt = $data['receipt_number'] ?? 'REG-' . time();

            // Insert payment record - check if table uses student_id or enrollment_id
            $checkCol = $this->conn->query("SHOW COLUMNS FROM tbl_registration_payments LIKE 'student_id'");
            $hasStudentId = $checkCol && $checkCol->rowCount() > 0;
            
            if ($hasStudentId) {
                $stmtPayment = $this->conn->prepare("
                    INSERT INTO tbl_registration_payments (
                        student_id, amount, payment_method, receipt_number, notes, status, payment_date
                    ) VALUES (?, ?, ?, ?, ?, 'Paid', CURRENT_DATE)
                ");
                $stmtPayment->execute([
                    $data['student_id'],
                    $data['amount'],
                    $data['payment_method'],
                    $receipt,
                    $data['notes'] ?? null
                ]);
            } else {
                // fas_db.sql structure - record against target enrollment row
                $targetEnrollmentId = (int)($student['enrollment_id'] ?? 0);
                if ($targetEnrollmentId > 0) {
                    $stmtPayment = $this->conn->prepare("
                        INSERT INTO tbl_registration_payments (
                            enrollment_id, amount, payment_method, receipt_number, notes, status, payment_date
                        ) VALUES (?, ?, ?, ?, ?, 'Paid', CURRENT_DATE)
                    ");
                    $stmtPayment->execute([
                        $targetEnrollmentId,
                        $data['amount'],
                        $data['payment_method'],
                        $receipt,
                        $data['notes'] ?? null
                    ]);
                }
            }

            $newStatus = ($remaining <= 0) ? 'Approved' : 'Pending';
            $stmtUpdate = $this->conn->prepare("
                UPDATE tbl_student_registration_fees
                SET registration_fee_paid = ?, registration_status = ?
                WHERE student_id = ?
            ");
            $stmtUpdate->execute([$newPaid, $newStatus, $data['student_id']]);

            // When approved, activate both student profile and login account.
            if ($newStatus === 'Approved') {
                $stmtActivateStudent = $this->conn->prepare("
                    UPDATE tbl_students
                    SET status = 'Active'
                    WHERE student_id = ?
                ");
                $stmtActivateStudent->execute([$data['student_id']]);

                $stmtEmail = $this->conn->prepare("SELECT email FROM tbl_students WHERE student_id = ?");
                $stmtEmail->execute([$data['student_id']]);
                $studentRow = $stmtEmail->fetch(PDO::FETCH_ASSOC);
                if (!empty($studentRow['email'])) {
                    $stmtActivateUser = $this->conn->prepare("
                        UPDATE tbl_users
                        SET status = 'Active'
                        WHERE email = ?
                    ");
                    $stmtActivateUser->execute([$studentRow['email']]);
                }
            }

            $this->conn->commit();

            $this->sendJSON([
                'success' => true,
                'message' => 'Payment recorded successfully',
                'paid_amount' => $newPaid,
                'remaining_amount' => max(0, $remaining),
                'registration_status' => $newStatus
            ]);
        } catch (Exception $e) {
            if ($this->conn && $this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            $this->sendJSON(['error' => 'Failed to record payment: ' . $e->getMessage()], 500);
        }
    }

    // 🔍 Get Registration Details
    public function getRegistrationDetails($studentId)
    {
        if (empty($studentId)) {
            $this->sendJSON(['error' => 'Student ID is required'], 400);
        }

        try {
            $this->ensureStudentRegistrationFeesTable();
            $stmt = $this->conn->prepare("
                SELECT
                    s.*,
                    b.branch_name,
                    COALESCE(rf.registration_fee_amount, 1000.00) AS registration_fee_amount,
                    COALESCE(rf.registration_fee_paid, 0.00) AS registration_fee_paid,
                    COALESCE(rf.registration_status, 'Pending') AS registration_status,
                    NULL AS registration_proof_path
                FROM tbl_students s
                LEFT JOIN tbl_branches b ON s.branch_id = b.branch_id
                LEFT JOIN tbl_student_registration_fees rf ON rf.student_id = s.student_id
                WHERE s.student_id = ?
            ");
            $stmt->execute([$studentId]);
            $student = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$student) {
                $this->sendJSON(['error' => 'Student not found'], 404);
            }
            if (!array_key_exists('registration_proof_path', $student)) {
                $student['registration_proof_path'] = null;
            }

            // Get guardians
            $stmtGuardians = $this->conn->prepare("
                SELECT g.*
                FROM tbl_guardians g
                INNER JOIN tbl_student_guardians sg ON g.guardian_id = sg.guardian_id
                WHERE sg.student_id = ?
            ");
            $stmtGuardians->execute([$studentId]);
            $guardians = $stmtGuardians->fetchAll(PDO::FETCH_ASSOC);

            // Get payments
            $checkCol = $this->conn->query("SHOW COLUMNS FROM tbl_registration_payments LIKE 'student_id'");
            $hasStudentId = $checkCol && $checkCol->rowCount() > 0;
            
            if ($hasStudentId) {
                $stmtPayments = $this->conn->prepare("
                    SELECT * FROM tbl_registration_payments
                    WHERE student_id = ?
                    ORDER BY payment_date DESC
                ");
                $stmtPayments->execute([$studentId]);
            } else {
                // fas_db.sql structure - get via enrollments
                $stmtPayments = $this->conn->prepare("
                    SELECT rp.* FROM tbl_registration_payments rp
                    INNER JOIN tbl_enrollments e ON rp.enrollment_id = e.enrollment_id
                    WHERE e.student_id = ?
                    ORDER BY rp.payment_date DESC
                ");
                $stmtPayments->execute([$studentId]);
            }
            $payments = $stmtPayments->fetchAll(PDO::FETCH_ASSOC);

            // Get user account
            $stmtUser = $this->conn->prepare("
                SELECT username, email, status
                FROM tbl_users
                WHERE email = ?
                LIMIT 1
            ");
            $stmtUser->execute([$student['email']]);
            $userAccount = $stmtUser->fetch(PDO::FETCH_ASSOC);

            $this->sendJSON([
                'success' => true,
                'student' => $student,
                'guardians' => $guardians,
                'payments' => $payments,
                'user_account' => $userAccount
            ]);
        } catch (Exception $e) {
            $this->sendJSON(['error' => 'Failed to load details: ' . $e->getMessage()], 500);
        }
    }
}

// Router
$admin = new Admin($conn);
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get-pending-students':
        $admin->getPendingStudents();
        break;
    case 'get-pending-registrations':
        $admin->getPendingRegistrations();
        break;
    case 'get-all-registrations':
        $admin->getAllRegistrations();
        break;
    case 'get-revenue-summary':
        $admin->getRevenueSummary();
        break;
    case 'get-registration-details':
        $admin->getRegistrationDetails($_GET['student_id'] ?? '');
        break;
    case 'approve-student':
        $admin->approveStudent(file_get_contents('php://input'));
        break;
    case 'reject-student':
    case 'reject-registration':
        $admin->rejectStudent(file_get_contents('php://input'));
        break;
    case 'confirm-payment':
        $admin->confirmPayment(file_get_contents('php://input'));
        break;
    default:
        $admin->sendJSON(['error' => 'Invalid action'], 400);
}
?>
