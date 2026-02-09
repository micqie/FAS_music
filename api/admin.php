<?php
require_once 'db_connect.php';

header("Content-Type: application/json");

class Admin
{
    private $conn;

    public function __construct($pdo)
    {
        $this->conn = $pdo;
    }

    private function sendJSON($data, $status = 200)
    {
        http_response_code($status);
        echo json_encode($data);
        exit;
    }

    // 🔍 View pending students
    public function getPendingStudents()
    {
        $stmt = $this->conn->prepare("
            SELECT student_id, first_name, last_name, email, phone,
                   registration_fee_amount, registration_status
            FROM tbl_students
            WHERE registration_status = 'Pending'
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
        $stmt = $this->conn->prepare("
            SELECT 
                s.student_id,
                s.first_name,
                s.last_name,
                s.email,
                s.phone,
                s.registration_fee_amount,
                s.registration_fee_paid,
                s.registration_status,
                s.created_at,
                b.branch_name,
                g.first_name as guardian_first_name,
                g.last_name as guardian_last_name,
                g.phone as guardian_phone
            FROM tbl_students s
            LEFT JOIN tbl_branches b ON s.branch_id = b.branch_id
            LEFT JOIN tbl_student_guardians sg ON s.student_id = sg.student_id AND sg.is_primary_guardian = 'Y'
            LEFT JOIN tbl_guardians g ON sg.guardian_id = g.guardian_id
            WHERE s.registration_status = 'Pending'
            ORDER BY s.created_at DESC
        ");
        $stmt->execute();

        $this->sendJSON([
            'success' => true,
            'registrations' => $stmt->fetchAll(PDO::FETCH_ASSOC)
        ]);
    }

    // 🔍 Get all registrations with guardian and branch info
    public function getAllRegistrations()
    {
        $stmt = $this->conn->prepare("
            SELECT 
                s.student_id,
                s.first_name,
                s.last_name,
                s.email,
                s.phone,
                s.registration_fee_amount,
                s.registration_fee_paid,
                s.registration_status,
                s.created_at,
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

        $this->sendJSON([
            'success' => true,
            'registrations' => $stmt->fetchAll(PDO::FETCH_ASSOC)
        ]);
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

            // Update student status
            $stmt = $this->conn->prepare("
                UPDATE tbl_students
                SET registration_status = 'Approved',
                    status = 'Active'
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

    // ❌ Reject student
    public function rejectStudent($json)
    {
        $data = json_decode($json, true);

        if (empty($data['student_id'])) {
            $this->sendJSON(['error' => 'student_id required'], 400);
        }

        $stmt = $this->conn->prepare("
            UPDATE tbl_students
            SET registration_status = 'Rejected',
                status = 'Inactive'
            WHERE student_id = ?
        ");

        $stmt->execute([$data['student_id']]);

        $this->sendJSON([
            'success' => true,
            'message' => 'Student rejected'
        ]);
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

            // Get current student payment info
            $stmt = $this->conn->prepare("
                SELECT registration_fee_amount, registration_fee_paid, registration_status
                FROM tbl_students
                WHERE student_id = ?
            ");
            $stmt->execute([$data['student_id']]);
            $student = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$student) {
                $this->conn->rollBack();
                $this->sendJSON(['error' => 'Student not found'], 404);
            }

            $newPaid = ($student['registration_fee_paid'] ?? 0) + $data['amount'];
            $remaining = $student['registration_fee_amount'] - $newPaid;
            $receipt = $data['receipt_number'] ?? 'REG-' . time();

            // Insert payment record
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

            // Update student payment info
            $newStatus = ($remaining <= 0) ? 'Fee Paid' : 'Pending';
            $stmtUpdate = $this->conn->prepare("
                UPDATE tbl_students
                SET registration_fee_paid = ?, registration_status = ?
                WHERE student_id = ?
            ");
            $stmtUpdate->execute([$newPaid, $newStatus, $data['student_id']]);

            $this->conn->commit();

            $this->sendJSON([
                'success' => true,
                'message' => 'Payment recorded successfully',
                'paid_amount' => $newPaid,
                'remaining_amount' => max(0, $remaining),
                'registration_status' => $newStatus
            ]);
        } catch (Exception $e) {
            $this->conn->rollBack();
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
            // Get student info
            $stmt = $this->conn->prepare("
                SELECT s.*, b.branch_name
                FROM tbl_students s
                LEFT JOIN tbl_branches b ON s.branch_id = b.branch_id
                WHERE s.student_id = ?
            ");
            $stmt->execute([$studentId]);
            $student = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$student) {
                $this->sendJSON(['error' => 'Student not found'], 404);
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
            $stmtPayments = $this->conn->prepare("
                SELECT * FROM tbl_registration_payments
                WHERE student_id = ?
                ORDER BY payment_date DESC
            ");
            $stmtPayments->execute([$studentId]);
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
