<?php
require_once 'db_connect.php';

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

class User
{
    private $conn;

    public function __construct($pdo)
    {
        $this->conn = $pdo;
    }

    private function sendJSON($data, $statusCode = 200)
    {
        http_response_code($statusCode);
        echo json_encode($data);
        exit;
    }

    public function login($json)
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode($json, true);
        $username = $data['username'] ?? '';
        $password = $data['password'] ?? '';

        if (empty($username) || empty($password)) {
            $this->sendJSON(['error' => 'Username and password are required'], 400);
        }

        try {
            // First check if user exists and get status
            $stmt = $this->conn->prepare("
                SELECT u.user_id, u.username, u.password, u.first_name, u.last_name,
                       u.email, u.phone, u.status, r.role_name
                FROM tbl_users u
                INNER JOIN tbl_roles r ON u.role_id = r.role_id
                WHERE u.username = ?
            ");
            $stmt->execute([$username]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                $this->sendJSON(['error' => 'Invalid username or password'], 401);
            }

            // Check if password is correct
            if (!password_verify($password, $user['password'])) {
                $this->sendJSON(['error' => 'Invalid username or password'], 401);
            }

            // Check if account is active
            if ($user['status'] !== 'Active') {
                $this->sendJSON(['error' => 'Your account is pending admin approval. Please wait for approval before logging in.'], 403);
            }

            // Detect default password "123" for students (first-login change requirement)
            $mustChangePassword = false;
            if ($user['role_name'] === 'Student' && password_verify('123', $user['password'])) {
                $mustChangePassword = true;
            }

            unset($user['password']);
            $this->sendJSON([
                'success' => true,
                'message' => 'Login successful',
                'user' => $user,
                'must_change_password' => $mustChangePassword
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function changePassword($json)
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode($json, true);
        $userId = $data['user_id'] ?? null;
        $oldPassword = $data['old_password'] ?? '';
        $newPassword = $data['new_password'] ?? '';

        if (empty($userId) || empty($oldPassword) || empty($newPassword)) {
            $this->sendJSON(['error' => 'user_id, old_password and new_password are required'], 400);
        }

        try {
            $stmt = $this->conn->prepare("SELECT user_id, password FROM tbl_users WHERE user_id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                $this->sendJSON(['error' => 'User not found'], 404);
            }

            if (!password_verify($oldPassword, $user['password'])) {
                $this->sendJSON(['error' => 'Current password is incorrect'], 400);
            }

            // Validate new password with same strong policy as registration
            if (strlen($newPassword) < 8) {
                $this->sendJSON(['error' => 'New password must be at least 8 characters long'], 400);
            }
            if (!preg_match('/[A-Z]/', $newPassword)) {
                $this->sendJSON(['error' => 'New password must contain at least one uppercase letter'], 400);
            }
            if (!preg_match('/[a-z]/', $newPassword)) {
                $this->sendJSON(['error' => 'New password must contain at least one lowercase letter'], 400);
            }
            if (!preg_match('/[0-9]/', $newPassword)) {
                $this->sendJSON(['error' => 'New password must contain at least one number'], 400);
            }
            if (!preg_match('/[!@#$%^&*]/', $newPassword)) {
                $this->sendJSON(['error' => 'New password must contain at least one special character (!@#$%^&*)'], 400);
            }

            $hashed = password_hash($newPassword, PASSWORD_DEFAULT);
            $update = $this->conn->prepare("UPDATE tbl_users SET password = ? WHERE user_id = ?");
            $update->execute([$hashed, $userId]);

            $this->sendJSON(['success' => true, 'message' => 'Password changed successfully']);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function register($json)
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode($json, true);

        $isWalkIn = !empty($data['is_walkin']); // admin-added student

        $required = ['student_first_name', 'student_last_name', 'student_email',
                     'student_phone', 'guardian_first_name', 'guardian_last_name',
                     'guardian_relationship', 'guardian_phone', 'branch_id'];

        foreach ($required as $field) {
            if (empty($data[$field])) {
                $this->sendJSON(['error' => "Field $field is required"], 400);
            }
        }

        // Validate email with strict pattern
        $email = $data['student_email'] ?? '';
        if (!empty($email)) {
            $emailPattern = '/^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/';
            if (!preg_match($emailPattern, $email)) {
                $this->sendJSON(['error' => 'Invalid email address format'], 400);
            }
            if (strlen($email) > 254) {
                $this->sendJSON(['error' => 'Email address is too long (max 254 characters)'], 400);
            }
            // Check if email already exists
            $emailCheck = $this->conn->prepare("SELECT user_id FROM tbl_users WHERE email = ? LIMIT 1");
            $emailCheck->execute([$email]);
            if ($emailCheck->fetch()) {
                $this->sendJSON(['error' => 'Email address is already registered'], 400);
            }
        }

        // Determine password:
        // - Admin-added (walk-in): default simple password "123" (no strict validation)
        // - Self-registration: strong password policy
        if ($isWalkIn) {
            $password = '123';
        } else {
            if (empty($data['password'])) {
                $this->sendJSON(['error' => 'Password is required'], 400);
            }
            $password = $data['password'];

            // Validate password policy for self-registration
            if (strlen($password) < 8) {
                $this->sendJSON(['error' => 'Password must be at least 8 characters long'], 400);
            }
            if (!preg_match('/[A-Z]/', $password)) {
                $this->sendJSON(['error' => 'Password must contain at least one uppercase letter'], 400);
            }
            if (!preg_match('/[a-z]/', $password)) {
                $this->sendJSON(['error' => 'Password must contain at least one lowercase letter'], 400);
            }
            if (!preg_match('/[0-9]/', $password)) {
                $this->sendJSON(['error' => 'Password must contain at least one number'], 400);
            }
            if (!preg_match('/[!@#$%^&*]/', $password)) {
                $this->sendJSON(['error' => 'Password must contain at least one special character (!@#$%^&*)'], 400);
            }
        }

        // Set default registration fee if not provided
        if (empty($data['registration_fee_amount'])) {
            $data['registration_fee_amount'] = 0;
        }

        try {
            $this->conn->beginTransaction();

            // Get default role for students
            $roleStmt = $this->conn->prepare("SELECT role_id FROM tbl_roles WHERE role_name = 'Student' LIMIT 1");
            $roleStmt->execute();
            $role = $roleStmt->fetch(PDO::FETCH_ASSOC);

            if (!$role) throw new Exception("Student role not found");

            $roleId = $role['role_id'];

            // Insert Student
            $stmtStudent = $this->conn->prepare("
                INSERT INTO tbl_students (
                    branch_id, first_name, last_name, middle_name, date_of_birth,
                    age, phone, email, address, school, grade_year, health_diagnosis,
                    registration_fee_amount, registration_status, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Inactive')
            ");
            $stmtStudent->execute([
                $data['branch_id'],
                $data['student_first_name'],
                $data['student_last_name'],
                $data['student_middle_name'] ?? null,
                $data['student_date_of_birth'] ?? null,
                $data['student_age'] ?? null,
                $data['student_phone'],
                $data['student_email'],
                $data['student_address'] ?? null,
                $data['student_school'] ?? null,
                $data['student_grade_year'] ?? null,
                $data['student_health_diagnosis'] ?? null,
                $data['registration_fee_amount']
            ]);

            $studentId = $this->conn->lastInsertId();

            // Insert Guardian
            $stmtGuardian = $this->conn->prepare("
                INSERT INTO tbl_guardians (
                    first_name, last_name, relationship_type, phone,
                    occupation, email, address, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
            ");
            $stmtGuardian->execute([
                $data['guardian_first_name'],
                $data['guardian_last_name'],
                $data['guardian_relationship'],
                $data['guardian_phone'],
                $data['guardian_occupation'] ?? null,
                $data['guardian_email'] ?? null,
                $data['guardian_address'] ?? null
            ]);

            $guardianId = $this->conn->lastInsertId();

            // Link Student and Guardian
            $stmtLink = $this->conn->prepare("
                INSERT INTO tbl_student_guardians (
                    student_id, guardian_id, is_primary_guardian,
                    can_enroll, can_pay, emergency_contact
                ) VALUES (?, ?, 'Y', 'Y', 'Y', 'Y')
            ");
            $stmtLink->execute([$studentId, $guardianId]);

            // Create user account (status will be Inactive until admin approves)
            $username = $data['username'] ?? $data['student_email'];
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

            $stmtUser = $this->conn->prepare("
                INSERT INTO tbl_users (
                    username, password, role_id, first_name, last_name,
                    email, phone, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Inactive')
            ");
            $stmtUser->execute([
                $username,
                $hashedPassword,
                $roleId,
                $data['student_first_name'],
                $data['student_last_name'],
                $data['student_email'],
                $data['student_phone']
            ]);

            $userId = $this->conn->lastInsertId();

            // Add instruments if provided
            if (!empty($data['instruments']) && is_array($data['instruments'])) {
                $stmtInstrument = $this->conn->prepare("
                    INSERT INTO tbl_student_instruments (student_id, instrument_id, priority_order)
                    VALUES (?, ?, ?)
                ");
                foreach ($data['instruments'] as $index => $instrumentId) {
                    $stmtInstrument->execute([$studentId, $instrumentId, $index + 1]);
                }
            }

            $this->conn->commit();

            $this->sendJSON([
                'success' => true,
                'message' => 'Registration submitted successfully. Your account is pending admin approval.',
                'student_id' => $studentId,
                'guardian_id' => $guardianId,
                'user_id' => $userId,
                'username' => $username,
                'registration_status' => 'Pending',
                'registration_fee_amount' => $data['registration_fee_amount'],
                'account_status' => 'Inactive - Pending Admin Approval'
            ]);

        } catch (Exception $e) {
            $this->conn->rollBack();
            $this->sendJSON(['error' => 'Registration failed: ' . $e->getMessage()], 500);
        }
    }

    public function checkRegistrationStatus($studentId)
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        if (empty($studentId)) {
            $this->sendJSON(['error' => 'Student ID is required'], 400);
        }

        try {
            $stmt = $this->conn->prepare("
                SELECT student_id, first_name, last_name, registration_fee_amount,
                       registration_fee_paid, registration_status, status
                FROM tbl_students
                WHERE student_id = ?
            ");
            $stmt->execute([$studentId]);
            $student = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$student) $this->sendJSON(['error' => 'Student not found'], 404);

            $this->sendJSON(['success' => true, 'student' => $student]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function payRegistrationFee($json)
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode($json, true);
        foreach (['student_id', 'amount', 'payment_method'] as $field) {
            if (empty($data[$field])) $this->sendJSON(['error' => "Field $field is required"], 400);
        }

        try {
            $this->conn->beginTransaction();

            $stmt = $this->conn->prepare("
                SELECT student_id, registration_fee_amount, registration_fee_paid, registration_status
                FROM tbl_students
                WHERE student_id = ?
            ");
            $stmt->execute([$data['student_id']]);
            $student = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$student) throw new Exception("Student not found");
            if (in_array($student['registration_status'], ['Fee Paid', 'Approved'])) {
                throw new Exception("Registration fee already paid");
            }

            $newPaid = ($student['registration_fee_paid'] ?? 0) + $data['amount'];
            $remaining = $student['registration_fee_amount'] - $newPaid;
            $receipt = $data['receipt_number'] ?? 'REG-' . time();
            $notes = $data['notes'] ?? '';

            $stmtPayment = $this->conn->prepare("
                INSERT INTO tbl_registration_payments (
                    student_id, amount, payment_method, receipt_number, notes, status
                ) VALUES (?, ?, ?, ?, ?, 'Paid')
            ");
            $stmtPayment->execute([$data['student_id'], $data['amount'], $data['payment_method'], $receipt, $notes]);

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
                'message' => 'Registration fee payment recorded successfully',
                'paid_amount' => $newPaid,
                'remaining_amount' => max(0, $remaining),
                'registration_status' => $newStatus,
                'receipt_number' => $receipt
            ]);

        } catch (Exception $e) {
            $this->conn->rollBack();
            $this->sendJSON(['error' => $e->getMessage()], 500);
        }
    }
}

// Usage Example
$user = new User($conn);
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'login':
        $user->login(file_get_contents('php://input'));
        break;
    case 'register':
        $user->register(file_get_contents('php://input'));
        break;
    case 'check-registration-status':
        $user->checkRegistrationStatus($_GET['student_id'] ?? '');
        break;
    case 'pay-registration-fee':
        $user->payRegistrationFee(file_get_contents('php://input'));
        break;
    case 'change-password':
        $user->changePassword(file_get_contents('php://input'));
        break;
    default:
        $user->sendJSON(['error' => 'Invalid action'], 400);
}
?>
