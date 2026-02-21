<?php
// Suppress error display for JSON APIs
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once 'db_connect.php';

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

// Check if database connection exists
if (!isset($conn) || $conn === null) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

class User
{
    private $conn;

    public function __construct($pdo)
    {
        $this->conn = $pdo;
    }

    public function sendJSON($data, $statusCode = 200)
    {
        http_response_code($statusCode);
        echo json_encode($data);
        exit;
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

    private function isMultipartRequest()
    {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? ($_SERVER['HTTP_CONTENT_TYPE'] ?? '');
        return stripos((string)$contentType, 'multipart/form-data') !== false;
    }

    private function ensureStudentRegistrationProofColumn()
    {
        // Proof path is not stored in tbl_students in current schema.
        return;
    }

    private function ensureStudentRegistrationColumns()
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
            // Keep registration flow alive even if migration fails
        }
    }

    private function storePaymentProofUpload($file, $scope = 'registration')
    {
        if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            return null;
        }
        if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
            throw new Exception('Failed to upload payment proof file.');
        }

        $maxBytes = 5 * 1024 * 1024; // 5MB
        $size = (int)($file['size'] ?? 0);
        if ($size < 1 || $size > $maxBytes) {
            throw new Exception('Payment proof file must be between 1 byte and 5MB.');
        }

        $tmpName = $file['tmp_name'] ?? '';
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            throw new Exception('Invalid uploaded file.');
        }

        $allowedExt = ['jpg', 'jpeg', 'png', 'pdf', 'webp'];
        $originalName = (string)($file['name'] ?? '');
        $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        if (!in_array($ext, $allowedExt, true)) {
            throw new Exception('Payment proof must be JPG, JPEG, PNG, WEBP, or PDF.');
        }

        $baseDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'payment_proofs' . DIRECTORY_SEPARATOR . $scope;
        if (!is_dir($baseDir) && !mkdir($baseDir, 0777, true) && !is_dir($baseDir)) {
            throw new Exception('Unable to create upload directory.');
        }

        $safeName = date('YmdHis') . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
        $targetPath = $baseDir . DIRECTORY_SEPARATOR . $safeName;
        if (!move_uploaded_file($tmpName, $targetPath)) {
            throw new Exception('Unable to save payment proof file.');
        }

        return 'uploads/payment_proofs/' . $scope . '/' . $safeName;
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

        $isMultipart = $this->isMultipartRequest();
        $data = $isMultipart ? $_POST : json_decode($json, true);
        if (!is_array($data)) {
            $this->sendJSON(['error' => 'Invalid request data'], 400);
        }

        // Normalize string fields (trim)
        foreach (['student_first_name', 'student_last_name', 'student_email', 'student_phone', 'branch_id',
                  'guardian_first_name', 'guardian_last_name', 'guardian_relationship', 'guardian_phone'] as $k) {
            if (isset($data[$k]) && is_string($data[$k])) {
                $data[$k] = trim($data[$k]);
            }
        }

        // Admin-added student (walk-in/admin panel) should be immediately registered.
        // Public self-registration from index remains pending.
        $isWalkIn = filter_var(($data['is_walkin'] ?? false), FILTER_VALIDATE_BOOLEAN);
        $registrationSource = strtolower(trim((string)($data['registration_source'] ?? '')));
        $isAdminRegistration = $isWalkIn || in_array($registrationSource, ['admin', 'walkin', 'staff'], true);

        // Base required fields (student only)
        $required = ['student_first_name', 'student_last_name', 'student_email',
                     'student_phone', 'branch_id'];
        $fieldLabels = [
            'student_first_name' => 'First Name',
            'student_last_name' => 'Last Name',
            'student_email' => 'Email',
            'student_phone' => 'Phone',
            'branch_id' => 'Branch'
        ];

        foreach ($required as $field) {
            $val = $data[$field] ?? '';
            if ($val === '' || $val === null) {
                $label = $fieldLabels[$field] ?? $field;
                $this->sendJSON(['error' => ucfirst($label) . ' is required'], 400);
            }
        }

        // Calculate age from date_of_birth for guardian requirement
        $dateOfBirth = $data['student_date_of_birth'] ?? null;
        $age = null;
        if (!empty($dateOfBirth)) {
            $dob = new DateTime($dateOfBirth);
            $now = new DateTime();
            $age = $now->diff($dob)->y;
        }
        $isMinor = ($age !== null) && ($age <= 18); // Guardian required only for 18 and below

        // Guardian required only for students aged 18 and below
        if ($isMinor) {
            $guardianLabels = [
                'guardian_first_name' => 'Guardian First Name',
                'guardian_last_name' => 'Guardian Last Name',
                'guardian_relationship' => 'Guardian Relationship',
                'guardian_phone' => 'Guardian Phone'
            ];
            foreach (['guardian_first_name', 'guardian_last_name', 'guardian_relationship', 'guardian_phone'] as $field) {
                $val = $data[$field] ?? '';
                if ($val === '' || $val === null) {
                    $label = $guardianLabels[$field] ?? $field;
                    $this->sendJSON(['error' => 'Guardian information is required for students aged 18 and below. Please fill in ' . $label . '.'], 400);
                }
            }
        }

        // Validate email
        $email = trim($data['student_email'] ?? '');
        if (!empty($email)) {
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $this->sendJSON(['error' => 'Invalid email address format'], 400);
            }
            if (strlen($email) > 254) {
                $this->sendJSON(['error' => 'Email address is too long (max 254 characters)'], 400);
            }
            $this->ensureStudentRegistrationColumns();

            // One-time registration fee guard.
            $existingStudentStmt = $this->conn->prepare("
                SELECT
                    s.student_id,
                    COALESCE(rf.registration_status, 'Pending') AS registration_status,
                    COALESCE(rf.registration_fee_paid, 0) AS registration_fee_paid
                FROM tbl_students s
                LEFT JOIN tbl_student_registration_fees rf ON rf.student_id = s.student_id
                WHERE s.email = ?
                LIMIT 1
            ");
            $existingStudentStmt->execute([$email]);
            $existingStudent = $existingStudentStmt->fetch(PDO::FETCH_ASSOC);
            if ($existingStudent) {
                $alreadySettled = ((float)($existingStudent['registration_fee_paid'] ?? 0) >= 1000)
                    || in_array($existingStudent['registration_status'], ['Approved', 'Fee Paid'], true);

                if ($alreadySettled) {
                    $this->sendJSON([
                        'error' => 'This student is already registered. The ₱1,000 registration fee is one-time only and should not be paid again.'
                    ], 400);
                }

                // Existing record but not yet settled: avoid duplicate registration row.
                $this->sendJSON([
                    'error' => 'A registration request for this email already exists and is still being processed. Please wait for desk staff confirmation.'
                ], 400);
            }

            // Check if email or username already exists (email is used as username)
            $dupCheck = $this->conn->prepare("SELECT user_id FROM tbl_users WHERE username = ? OR email = ? LIMIT 1");
            $dupCheck->execute([$email, $email]);
            if ($dupCheck->fetch()) {
                $this->sendJSON(['error' => 'This email is already registered. Please use a different email address.'], 400);
            }
        }

        // Determine password:
        // - Admin-added (walk-in): default simple password "123" (no strict validation)
        // - Self-registration: strong password policy
        if ($isAdminRegistration) {
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

        // Initial registration fee is fixed.
        $data['registration_fee_amount'] = 1000;

        $registrationProofPath = null;
        if ($isMultipart && isset($_FILES['registration_proof_file'])) {
            try {
                $registrationProofPath = $this->storePaymentProofUpload($_FILES['registration_proof_file'], 'registration');
            } catch (Exception $e) {
                $this->sendJSON(['error' => $e->getMessage()], 400);
            }
        }
        if (!$isAdminRegistration && empty($registrationProofPath)) {
            $this->sendJSON(['error' => 'Registration payment proof is required.'], 400);
        }

        try {
            $this->ensureStudentRegistrationColumns();
            $this->conn->beginTransaction();

            // Get default role for students
            $roleStmt = $this->conn->prepare("SELECT role_id FROM tbl_roles WHERE role_name = 'Student' LIMIT 1");
            $roleStmt->execute();
            $role = $roleStmt->fetch(PDO::FETCH_ASSOC);

            if (!$role) throw new Exception("Student role not found");

            $roleId = $role['role_id'];

            // Insert Student (schema-aware)
            $hasSessionPackageCol = $this->hasStudentColumn('session_package_id');

            $regStatus = $isAdminRegistration ? 'Approved' : 'Pending';
            $studentStatus = $isAdminRegistration ? 'Active' : 'Inactive';

            $studentColumns = [
                'branch_id', 'first_name', 'last_name', 'middle_name', 'date_of_birth',
                'age', 'phone', 'email', 'address', 'school', 'grade_year', 'health_diagnosis',
                'status'
            ];
            $studentValues = [
                $data['branch_id'],
                $data['student_first_name'],
                $data['student_last_name'],
                $data['student_middle_name'] ?? null,
                $data['student_date_of_birth'] ?? null,
                $age ?? $data['student_age'] ?? null,
                $data['student_phone'],
                $data['student_email'],
                $data['student_address'] ?? null,
                $data['student_school'] ?? null,
                $data['student_grade_year'] ?? null,
                $data['student_health_diagnosis'] ?? null,
                $studentStatus
            ];

            if ($hasSessionPackageCol) {
                $studentColumns[] = 'session_package_id';
                $studentValues[] = $data['session_package_id'] ?? null;
            }

            $studentPlaceholders = implode(',', array_fill(0, count($studentColumns), '?'));
            $studentColsSql = implode(', ', $studentColumns);
            $stmtStudent = $this->conn->prepare("
                INSERT INTO tbl_students ({$studentColsSql})
                VALUES ({$studentPlaceholders})
            ");
            $stmtStudent->execute($studentValues);

            $studentId = (int)$this->conn->lastInsertId();

            $stmtReg = $this->conn->prepare("
                INSERT INTO tbl_student_registration_fees (
                    student_id,
                    registration_fee_amount,
                    registration_fee_paid,
                    registration_status,
                    notes
                ) VALUES (?, ?, 0.00, ?, ?)
            ");
            $stmtReg->execute([
                $studentId,
                (float)$data['registration_fee_amount'],
                $regStatus,
                $registrationProofPath ? ('Payment proof: ' . $registrationProofPath) : null
            ]);

            // Insert Guardian and link only when guardian info is provided (required for minors, optional for 18+)
            $guardianId = null;
            $hasGuardianData = !empty($data['guardian_first_name']) && !empty($data['guardian_last_name'])
                && !empty($data['guardian_relationship']) && !empty($data['guardian_phone']);

            if ($hasGuardianData) {
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
            }

            // Create user account (Active for walk-in/admin, Inactive for self-registration until admin approves)
            $userStatus = $isAdminRegistration ? 'Active' : 'Inactive';
            $username = $data['username'] ?? $data['student_email'];
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

            $stmtUser = $this->conn->prepare("
                INSERT INTO tbl_users (
                    username, password, role_id, first_name, last_name,
                    email, phone, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmtUser->execute([
                $username,
                $hashedPassword,
                $roleId,
                $data['student_first_name'],
                $data['student_last_name'],
                $data['student_email'],
                $data['student_phone'],
                $userStatus
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
                'message' => $isAdminRegistration
                    ? 'Student registered successfully. Account is active and can log in immediately.'
                    : 'Registration submitted successfully. Your account is pending admin approval.',
                'student_id' => $studentId,
                'guardian_id' => $guardianId,
                'user_id' => $userId,
                'username' => $username,
                'registration_status' => $regStatus,
                'registration_fee_amount' => $data['registration_fee_amount'],
                'registration_proof_path' => $registrationProofPath,
                'account_status' => $isAdminRegistration ? 'Active - Can log in' : 'Inactive - Pending Admin Approval'
            ]);

        } catch (PDOException $e) {
            if ($this->conn && $this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            // User-friendly message for duplicate email/username
            if ($e->getCode() == 23000 && (strpos($e->getMessage(), 'Duplicate entry') !== false || strpos($e->getMessage(), 'username') !== false || strpos($e->getMessage(), 'email') !== false)) {
                $this->sendJSON(['error' => 'This email is already registered. Please use a different email address.'], 400);
            }
            $this->sendJSON(['error' => 'Registration failed: ' . $e->getMessage()], 500);
        } catch (Exception $e) {
            if ($this->conn && $this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
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
            $this->ensureStudentRegistrationColumns();
            $stmt = $this->conn->prepare("
                SELECT
                    s.student_id,
                    s.first_name,
                    s.last_name,
                    COALESCE(rf.registration_fee_amount, 1000.00) AS registration_fee_amount,
                    COALESCE(rf.registration_fee_paid, 0.00) AS registration_fee_paid,
                    COALESCE(rf.registration_status, 'Pending') AS registration_status,
                    s.status
                FROM tbl_students s
                LEFT JOIN tbl_student_registration_fees rf ON rf.student_id = s.student_id
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
            $this->ensureStudentRegistrationColumns();
            $this->conn->beginTransaction();

            $stmt = $this->conn->prepare("
                SELECT student_id, registration_fee_amount, registration_fee_paid, registration_status
                FROM tbl_student_registration_fees
                WHERE student_id = ?
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

            // Registration payment confirmation approves account once fully paid.
            $newStatus = ($remaining <= 0) ? 'Approved' : 'Pending';
            $stmtUpdate = $this->conn->prepare("
                UPDATE tbl_student_registration_fees
                SET registration_fee_paid = ?, registration_status = ?
                WHERE student_id = ?
            ");
            $stmtUpdate->execute([$newPaid, $newStatus, $data['student_id']]);

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
                'message' => 'Registration fee payment recorded successfully',
                'paid_amount' => $newPaid,
                'remaining_amount' => max(0, $remaining),
                'registration_status' => $newStatus,
                'receipt_number' => $receipt
            ]);

        } catch (Exception $e) {
            if ($this->conn && $this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
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
