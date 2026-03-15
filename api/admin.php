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
        // Registration fee state now comes from tbl_registration_payments.
        return;
    }

    private function getRegistrationPaidAmount($studentId)
    {
        $stmt = $this->conn->prepare("
            SELECT COALESCE(SUM(amount), 0)
            FROM tbl_registration_payments
            WHERE student_id = ?
              AND status = 'Paid'
        ");
        $stmt->execute([(int)$studentId]);
        return (float)($stmt->fetchColumn() ?: 0);
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
            $sql .= " AND e.status IN ({$placeholders})";
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

    private function extractRegistrationProofPathFromNotes($notes)
    {
        $raw = trim((string)($notes ?? ''));
        if ($raw === '') return null;

        $prefix = 'Payment proof:';
        if (stripos($raw, $prefix) === 0) {
            $path = trim(substr($raw, strlen($prefix)));
            return $path !== '' ? $path : null;
        }

        if (preg_match('/uploads\/payment_proofs\/registration\/[^\s]+/i', $raw, $m)) {
            return $m[0];
        }

        return null;
    }

    // 🔍 View pending students
    public function getPendingStudents()
    {
        $stmt = $this->conn->prepare("
            SELECT
                s.student_id,
                s.first_name,
                s.last_name,
                s.email,
                s.phone,
                1000.00 AS registration_fee_amount,
                COALESCE((
                    SELECT SUM(rp.amount)
                    FROM tbl_registration_payments rp
                    WHERE rp.student_id = s.student_id
                      AND rp.status = 'Paid'
                ), 0.00) AS registration_fee_paid,
                'Pending' AS registration_status
            FROM tbl_students s
            WHERE s.status = 'Inactive'
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
        $this->ensureStudentRegistrationProofColumn();
        $hasProofCol = $this->hasStudentColumn('registration_proof_path');
        $stmt = $this->conn->prepare("
            SELECT
                s.student_id,
                s.first_name,
                s.last_name,
                s.email,
                s.phone,
                1000.00 AS registration_fee_amount,
                COALESCE((
                    SELECT SUM(rp.amount)
                    FROM tbl_registration_payments rp
                    WHERE rp.student_id = s.student_id
                      AND rp.status = 'Paid'
                ), 0.00) AS registration_fee_paid,
                " . ($hasProofCol ? "s.registration_proof_path" : "NULL") . " AS registration_proof_path,
                'Pending' AS registration_status,
                s.created_at AS created_at,
                b.branch_name,
                g.first_name as guardian_first_name,
                g.last_name as guardian_last_name,
                g.phone as guardian_phone
            FROM tbl_students s
            LEFT JOIN tbl_branches b ON s.branch_id = b.branch_id
            LEFT JOIN tbl_student_guardians sg ON s.student_id = sg.student_id AND sg.is_primary_guardian = 'Y'
            LEFT JOIN tbl_guardians g ON sg.guardian_id = g.guardian_id
            WHERE s.status = 'Inactive'
            ORDER BY s.created_at DESC
        ");
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $this->sendJSON([
            'success' => true,
            'registrations' => $rows
        ]);
    }

    // 🔍 Get all registrations with guardian and branch info (excludes Rejected - they are removed/counted separately)
    public function getAllRegistrations()
    {
        $this->ensureStudentRegistrationProofColumn();
        $hasProofCol = $this->hasStudentColumn('registration_proof_path');
        $stmt = $this->conn->prepare("
            SELECT
                s.student_id,
                s.first_name,
                s.last_name,
                s.email,
                s.phone,
                1000.00 AS registration_fee_amount,
                COALESCE((
                    SELECT SUM(rp.amount)
                    FROM tbl_registration_payments rp
                    WHERE rp.student_id = s.student_id
                      AND rp.status = 'Paid'
                ), 0.00) AS registration_fee_paid,
                " . ($hasProofCol ? "s.registration_proof_path" : "NULL") . " AS registration_proof_path,
                CASE
                    WHEN s.status = 'Active' THEN 'Approved'
                    WHEN COALESCE((
                        SELECT SUM(rp3.amount)
                        FROM tbl_registration_payments rp3
                        WHERE rp3.student_id = s.student_id
                          AND rp3.status = 'Paid'
                    ), 0.00) >= 1000 THEN 'Fee Paid'
                    ELSE 'Pending'
                END AS registration_status,
                s.created_at AS created_at,
                b.branch_name,
                g.first_name as guardian_first_name,
                g.last_name as guardian_last_name,
                g.phone as guardian_phone
            FROM tbl_students s
            LEFT JOIN tbl_branches b ON s.branch_id = b.branch_id
            LEFT JOIN tbl_student_guardians sg ON s.student_id = sg.student_id AND sg.is_primary_guardian = 'Y'
            LEFT JOIN tbl_guardians g ON sg.guardian_id = g.guardian_id
            ORDER BY s.created_at DESC
        ");
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $this->sendJSON([
            'success' => true,
            'registrations' => $rows
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

            $paid = $this->getRegistrationPaidAmount((int)$data['student_id']);
            if ($paid < 1000.0) {
                $stmtReg = $this->conn->prepare("
                    INSERT INTO tbl_registration_payments (
                        student_id, payment_date, amount, payment_method, status, receipt_number
                    ) VALUES (?, CURRENT_DATE, ?, 'Other', 'Paid', ?)
                ");
                $stmtReg->execute([
                    (int)$data['student_id'],
                    1000.0 - $paid,
                    'REG-APPROVE-' . time()
                ]);
            }

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
            // If hard delete fails, deactivate instead.
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
            $this->conn->beginTransaction();
            $stmtStudent = $this->conn->prepare("SELECT student_id, email FROM tbl_students WHERE student_id = ? LIMIT 1");
            $stmtStudent->execute([(int)$data['student_id']]);
            $student = $stmtStudent->fetch(PDO::FETCH_ASSOC);
            if (!$student) {
                $this->conn->rollBack();
                $this->sendJSON(['error' => 'Student not found'], 404);
            }

            $currentPaid = $this->getRegistrationPaidAmount((int)$data['student_id']);
            $newPaid = $currentPaid + (float)$data['amount'];
            $remaining = 1000.0 - $newPaid;
            $receipt = $data['receipt_number'] ?? 'REG-' . time();

            // Insert payment record - check if table uses student_id or enrollment_id
            $checkCol = $this->conn->query("SHOW COLUMNS FROM tbl_registration_payments LIKE 'student_id'");
            $hasStudentId = $checkCol && $checkCol->rowCount() > 0;

            if ($hasStudentId) {
                $stmtPayment = $this->conn->prepare("
                    INSERT INTO tbl_registration_payments (
                        student_id, amount, payment_method, receipt_number, status, payment_date
                    ) VALUES (?, ?, ?, ?, 'Paid', CURRENT_DATE)
                ");
                $stmtPayment->execute([
                    $data['student_id'],
                    $data['amount'],
                    $data['payment_method'],
                    $receipt
                ]);
            } else {
                // fas_db.sql structure - record against target enrollment row
                $targetEnrollmentId = (int)($student['enrollment_id'] ?? 0);
                if ($targetEnrollmentId > 0) {
                    $stmtPayment = $this->conn->prepare("
                        INSERT INTO tbl_registration_payments (
                            enrollment_id, amount, payment_method, receipt_number, status, payment_date
                        ) VALUES (?, ?, ?, ?, 'Paid', CURRENT_DATE)
                    ");
                    $stmtPayment->execute([
                        $targetEnrollmentId,
                        $data['amount'],
                        $data['payment_method'],
                        $receipt
                    ]);
                }
            }

            $newStatus = ($remaining <= 0) ? 'Approved' : 'Pending';

            // When approved, activate both student profile and login account.
            if ($newStatus === 'Approved') {
                $stmtActivateStudent = $this->conn->prepare("
                    UPDATE tbl_students
                    SET status = 'Active'
                    WHERE student_id = ?
                ");
                $stmtActivateStudent->execute([$data['student_id']]);

                if (!empty($student['email'])) {
                    $stmtActivateUser = $this->conn->prepare("
                        UPDATE tbl_users
                        SET status = 'Active'
                        WHERE email = ?
                    ");
                    $stmtActivateUser->execute([$student['email']]);
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
            $this->ensureStudentRegistrationProofColumn();
            $hasProofCol = $this->hasStudentColumn('registration_proof_path');
            $stmt = $this->conn->prepare("
                SELECT
                    s.*,
                    b.branch_name,
                    1000.00 AS registration_fee_amount,
                    COALESCE((
                        SELECT SUM(rp.amount)
                        FROM tbl_registration_payments rp
                        WHERE rp.student_id = s.student_id
                          AND rp.status = 'Paid'
                    ), 0.00) AS registration_fee_paid,
                    CASE
                        WHEN s.status = 'Active' THEN 'Approved'
                        WHEN COALESCE((
                            SELECT SUM(rp2.amount)
                            FROM tbl_registration_payments rp2
                            WHERE rp2.student_id = s.student_id
                              AND rp2.status = 'Paid'
                        ), 0.00) >= 1000 THEN 'Fee Paid'
                        ELSE 'Pending'
                    END AS registration_status
                FROM tbl_students s
                LEFT JOIN tbl_branches b ON s.branch_id = b.branch_id
                WHERE s.student_id = ?
            ");
            $stmt->execute([$studentId]);
            $student = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$student) {
                $this->sendJSON(['error' => 'Student not found'], 404);
            }
            if (!$hasProofCol) $student['registration_proof_path'] = null;

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

    // 👥 List all user accounts with roles (and optional branch if linked)
    public function getUsers()
    {
        try {
            $sql = "
                SELECT
                    u.user_id,
                    u.username,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.phone,
                    u.status,
                    CASE
                        WHEN r.role_name = 'Manager' THEN 'Branch Manager'
                        WHEN r.role_name = 'Staff' THEN 'Staff'
                        ELSE r.role_name
                    END AS role_name,
                    COALESCE(b.branch_name, '') AS branch_name
                FROM tbl_users u
                INNER JOIN tbl_roles r ON u.role_id = r.role_id
                LEFT JOIN tbl_teachers t ON t.user_id = u.user_id
                LEFT JOIN tbl_branches b ON t.branch_id = b.branch_id
                ORDER BY r.role_name, u.first_name, u.last_name, u.user_id
            ";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $this->sendJSON([
                'success' => true,
                'users' => $rows
            ]);
        } catch (Exception $e) {
            $this->sendJSON(['error' => 'Failed to load users: ' . $e->getMessage()], 500);
        }
    }

    // ➕ Create a new user account (admin-created staff / branch manager / student)
    public function createUser($json)
    {
        $data = json_decode($json, true);
        if (!is_array($data)) {
            $this->sendJSON(['error' => 'Invalid payload'], 400);
        }

        $firstName = trim((string)($data['first_name'] ?? ''));
        $lastName  = trim((string)($data['last_name'] ?? ''));
        $email     = trim((string)($data['email'] ?? ''));
        $phone     = trim((string)($data['phone'] ?? ''));
        $roleName  = trim((string)($data['role'] ?? ''));
        $password  = (string)($data['password'] ?? '');

        if ($firstName === '' || $lastName === '' || $email === '' || $roleName === '' || $password === '') {
            $this->sendJSON(['error' => 'first_name, last_name, email, role and password are required'], 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->sendJSON(['error' => 'Invalid email address'], 400);
        }

        try {
            // Normalize UI role labels to database role_name values
            $lookupRoleName = $roleName;
            if (strcasecmp($roleName, 'Branch Manager') === 0) {
                $lookupRoleName = 'Manager';
            } elseif (strcasecmp($roleName, 'Staff') === 0) {
                $lookupRoleName = 'Staff';
            }

            // Find role_id by role_name
            $stmtRole = $this->conn->prepare("SELECT role_id FROM tbl_roles WHERE role_name = ? LIMIT 1");
            $stmtRole->execute([$lookupRoleName]);
            $role = $stmtRole->fetch(PDO::FETCH_ASSOC);
            if (!$role) {
                $this->sendJSON(['error' => 'Role not found: ' . $roleName], 400);
            }
            $roleId = (int)$role['role_id'];

            // Prevent duplicate username/email
            $dupCheck = $this->conn->prepare("
                SELECT user_id FROM tbl_users
                WHERE username = ? OR email = ?
                LIMIT 1
            ");
            $dupCheck->execute([$email, $email]);
            if ($dupCheck->fetch()) {
                $this->sendJSON(['error' => 'This email is already registered. Please use a different email address.'], 400);
            }

            $hashed = password_hash($password, PASSWORD_DEFAULT);

            $stmt = $this->conn->prepare("
                INSERT INTO tbl_users (
                    username, password, role_id, first_name, last_name,
                    email, phone, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
            ");
            $stmt->execute([
                $email,
                $hashed,
                $roleId,
                $firstName,
                $lastName,
                $email,
                $phone
            ]);

            $userId = (int)$this->conn->lastInsertId();

            $this->sendJSON([
                'success' => true,
                'message' => 'User created successfully.',
                'user_id' => $userId
            ]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                $this->sendJSON(['error' => 'This email is already registered. Please use a different email address.'], 400);
            }
            $this->sendJSON(['error' => 'Failed to create user: ' . $e->getMessage()], 500);
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
    case 'get-users':
        $admin->getUsers();
        break;
    case 'create-user':
        $admin->createUser(file_get_contents('php://input'));
        break;
    default:
        $admin->sendJSON(['error' => 'Invalid action'], 400);
}
?>
