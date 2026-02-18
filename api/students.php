<?php
require_once 'db_connect.php';

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

class StudentsApi
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

    /** Ensure session_package_id column exists on tbl_students (replaces add_session_package_to_students.php) */
    private function ensureSessionPackageColumn()
    {
        try {
            $stmt = $this->conn->query("DESCRIBE tbl_students");
            if ($stmt === false) return;
            $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
            if (in_array('session_package_id', $columns)) return;

            $this->conn->exec("ALTER TABLE tbl_students ADD COLUMN session_package_id INT NULL");
            try {
                $this->conn->exec("
                    ALTER TABLE tbl_students
                    ADD CONSTRAINT fk_students_session_package
                    FOREIGN KEY (session_package_id) REFERENCES tbl_session_packages(package_id)
                ");
            } catch (PDOException $e) { /* tbl_session_packages may not exist yet */ }
        } catch (PDOException $e) {
            // Do not break API
        }
    }

    /** Ensure tbl_student_instruments exists (created during registration) */
    private function ensureStudentInstrumentsTable()
    {
        try {
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS tbl_student_instruments (
                    student_instrument_id INT AUTO_INCREMENT PRIMARY KEY,
                    student_id INT NOT NULL,
                    instrument_id INT NOT NULL,
                    priority_order INT NOT NULL DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ");
            // Attempt to add indexes (safe if already exists)
            try { $this->conn->exec("CREATE INDEX idx_student_instruments_student ON tbl_student_instruments(student_id)"); } catch (PDOException $e) {}
            try { $this->conn->exec("CREATE INDEX idx_student_instruments_instrument ON tbl_student_instruments(instrument_id)"); } catch (PDOException $e) {}
        } catch (PDOException $e) {
            // Do not break API
        }
    }

    /** Check whether a table exists in current DB */
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

    // Get all students for admin_students page
    public function getAllStudents()
    {
        $this->ensureSessionPackageColumn();
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
                s.status,
                s.created_at,
                s.branch_id,
                b.branch_name
            FROM tbl_students s
            LEFT JOIN tbl_branches b ON s.branch_id = b.branch_id
            WHERE s.registration_status != 'Rejected'
            ORDER BY s.created_at DESC
        ");
        $stmt->execute();

        $this->sendJSON([
            'success'   => true,
            'students'  => $stmt->fetchAll(PDO::FETCH_ASSOC)
        ]);
    }

    // Get one student by ID (for view/edit)
    public function getStudent()
    {
        $studentId = (int) ($_GET['student_id'] ?? 0);
        if ($studentId < 1) {
            $this->sendJSON(['error' => 'Student ID is required'], 400);
        }

        try {
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
            $this->sendJSON(['success' => true, 'student' => $student]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    // Update student
    public function updateStudent()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $id = (int) ($data['student_id'] ?? 0);
        $firstName = trim($data['first_name'] ?? '');
        $lastName = trim($data['last_name'] ?? '');
        $middleName = trim($data['middle_name'] ?? '');
        $email = trim($data['email'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $address = trim($data['address'] ?? '');
        $branchId = (int) ($data['branch_id'] ?? 0);
        $dateOfBirth = !empty($data['date_of_birth']) ? $data['date_of_birth'] : null;
        $age = isset($data['age']) ? (int) $data['age'] : null;
        $school = trim($data['school'] ?? '');
        $gradeYear = trim($data['grade_year'] ?? '');
        $registrationFeeAmount = isset($data['registration_fee_amount']) ? (float) $data['registration_fee_amount'] : null;
        $registrationFeePaid = isset($data['registration_fee_paid']) ? (float) $data['registration_fee_paid'] : null;
        $registrationStatus = isset($data['registration_status']) && in_array($data['registration_status'], ['Pending', 'Fee Paid', 'Approved', 'Rejected'], true) ? $data['registration_status'] : null;
        $status = isset($data['status']) && in_array($data['status'], ['Active', 'Inactive'], true) ? $data['status'] : null;

        if ($id < 1) {
            $this->sendJSON(['error' => 'Student ID is required'], 400);
        }
        if ($firstName === '' || $lastName === '') {
            $this->sendJSON(['error' => 'First name and last name are required'], 400);
        }
        if ($branchId < 1) {
            $this->sendJSON(['error' => 'Branch is required'], 400);
        }

        try {
            $stmt = $this->conn->prepare("
                UPDATE tbl_students SET
                    first_name = ?, last_name = ?, middle_name = ?, email = ?, phone = ?, address = ?,
                    branch_id = ?, date_of_birth = ?, age = ?, school = ?, grade_year = ?,
                    registration_fee_amount = COALESCE(?, registration_fee_amount),
                    registration_fee_paid = COALESCE(?, registration_fee_paid),
                    registration_status = COALESCE(?, registration_status),
                    status = COALESCE(?, status)
                WHERE student_id = ?
            ");
            $stmt->execute([
                $firstName, $lastName, $middleName ?: null, $email ?: null, $phone ?: null, $address ?: null,
                $branchId, $dateOfBirth, $age ?: null, $school ?: null, $gradeYear ?: null,
                $registrationFeeAmount, $registrationFeePaid, $registrationStatus, $status, $id
            ]);
            if ($stmt->rowCount() === 0) {
                $this->sendJSON(['error' => 'Student not found'], 404);
            }
            $this->sendJSON(['success' => true, 'message' => 'Student updated']);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    // Delete student (soft delete: set status to Inactive)
    public function deleteStudent()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $studentId = (int) ($data['student_id'] ?? 0);
        if ($studentId < 1) {
            $this->sendJSON(['error' => 'Student ID is required'], 400);
        }

        try {
            $stmt = $this->conn->prepare("UPDATE tbl_students SET status = 'Inactive' WHERE student_id = ?");
            $stmt->execute([$studentId]);
            if ($stmt->rowCount() === 0) {
                $this->sendJSON(['error' => 'Student not found'], 404);
            }
            $this->sendJSON(['success' => true, 'message' => 'Student deactivated']);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    // Get active students with session package info for admin_package page
    public function getActiveStudents()
    {
        $this->ensureSessionPackageColumn();
        $branchId = $_GET['branch_id'] ?? null;

        // Check if session_package_id exists and tbl_session_packages exists (avoid SQL errors)
        $hasPackageCol = false;
        $hasPackagesTable = false;
        try {
            $colCheck = $this->conn->query("SHOW COLUMNS FROM tbl_students LIKE 'session_package_id'");
            $hasPackageCol = $colCheck && $colCheck->rowCount() > 0;
            $tblCheck = $this->conn->query("SHOW TABLES LIKE 'tbl_session_packages'");
            $hasPackagesTable = $tblCheck && $tblCheck->rowCount() > 0;
        } catch (PDOException $e) {
            // Ignore
        }

        if ($hasPackageCol && $hasPackagesTable) {
            $sql = "
                SELECT
                    s.student_id,
                    s.first_name,
                    s.last_name,
                    s.email,
                    s.phone,
                    s.registration_status,
                    s.status,
                    s.branch_id,
                    s.session_package_id,
                    b.branch_name,
                    sp.package_name,
                    sp.sessions,
                    sp.max_instruments
                FROM tbl_students s
                LEFT JOIN tbl_branches b ON s.branch_id = b.branch_id
                LEFT JOIN tbl_session_packages sp ON s.session_package_id = sp.package_id
                WHERE s.status = 'Active' AND s.registration_status IN ('Fee Paid', 'Approved')
            ";
        } else {
            $sql = "
                SELECT
                    s.student_id,
                    s.first_name,
                    s.last_name,
                    s.email,
                    s.phone,
                    s.registration_status,
                    s.status,
                    s.branch_id,
                    b.branch_name
                FROM tbl_students s
                LEFT JOIN tbl_branches b ON s.branch_id = b.branch_id
                WHERE s.status = 'Active' AND s.registration_status IN ('Fee Paid', 'Approved')
            ";
        }

        $params = [];
        if ($branchId) {
            $sql .= " AND s.branch_id = ?";
            $params[] = $branchId;
        }
        $sql .= " ORDER BY s.first_name ASC, s.last_name ASC";

        try {
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);
            $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
            // Ensure package fields exist for frontend
            if (!$hasPackageCol || !$hasPackagesTable) {
                foreach ($students as &$row) {
                    $row['session_package_id'] = null;
                    $row['package_name'] = null;
                    $row['sessions'] = null;
                    $row['max_instruments'] = null;
                }
                unset($row);
            }
            $this->sendJSON([
                'success' => true,
                'students' => $students
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    // Assign/Update session package for a student
    public function assignPackage()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $studentId = (int) ($data['student_id'] ?? 0);
        $packageId = (int) ($data['session_package_id'] ?? 0);

        if ($studentId < 1) {
            $this->sendJSON(['error' => 'Student ID is required'], 400);
        }

        if ($packageId < 1) {
            $this->sendJSON(['error' => 'Session package ID is required'], 400);
        }

        try {
            // Check if student exists
            $checkStudent = $this->conn->prepare("SELECT student_id FROM tbl_students WHERE student_id = ?");
            $checkStudent->execute([$studentId]);
            if (!$checkStudent->fetch()) {
                $this->sendJSON(['error' => 'Student not found'], 404);
            }

            // Check if package exists
            $checkPackage = $this->conn->prepare("SELECT package_id FROM tbl_session_packages WHERE package_id = ?");
            $checkPackage->execute([$packageId]);
            if (!$checkPackage->fetch()) {
                $this->sendJSON(['error' => 'Session package not found'], 404);
            }

            // Check if session_package_id column exists
            $hasCol = false;
            try {
                $checkCol = $this->conn->query("SHOW COLUMNS FROM tbl_students LIKE 'session_package_id'");
                $hasCol = $checkCol->rowCount() > 0;
            } catch (PDOException $e) {
                // Column might not exist
            }

            if ($hasCol) {
                $stmt = $this->conn->prepare("UPDATE tbl_students SET session_package_id = ? WHERE student_id = ?");
                $stmt->execute([$packageId, $studentId]);
            } else {
                // Try to add column if it doesn't exist
                try {
                    $this->conn->exec("ALTER TABLE tbl_students ADD COLUMN session_package_id INT NULL");
                    $stmt = $this->conn->prepare("UPDATE tbl_students SET session_package_id = ? WHERE student_id = ?");
                    $stmt->execute([$packageId, $studentId]);
                } catch (PDOException $e) {
                    $this->sendJSON(['error' => 'Failed to update student package. Please run migration first.'], 500);
                }
            }

            $this->sendJSON([
                'success' => true,
                'message' => 'Package assigned successfully'
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Student Portal payload:
     * - profile (tbl_students)
     * - branch
     * - session package (if available)
     * - instruments (tbl_student_instruments -> tbl_instruments + type)
     * - guardians (primary + all)
     * - computed balance (registration_fee_amount - registration_fee_paid)
     */
    public function getStudentPortal()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $email = trim($_GET['email'] ?? '');
        if ($email === '') {
            $this->sendJSON(['error' => 'Email is required'], 400);
        }

        $this->ensureSessionPackageColumn();
        $this->ensureStudentInstrumentsTable();

        $hasPackagesTable = $this->tableExists('tbl_session_packages');
        $hasPackageCol = false;
        try {
            $colCheck = $this->conn->query("SHOW COLUMNS FROM tbl_students LIKE 'session_package_id'");
            $hasPackageCol = $colCheck && $colCheck->rowCount() > 0;
        } catch (PDOException $e) { /* ignore */ }

        try {
            if ($hasPackagesTable && $hasPackageCol) {
                $stmtStudent = $this->conn->prepare("
                    SELECT
                        s.*,
                        b.branch_name,
                        sp.package_name,
                        sp.sessions AS package_sessions,
                        sp.max_instruments AS package_max_instruments,
                        COALESCE(sp.price, 0) AS package_price
                    FROM tbl_students s
                    LEFT JOIN tbl_branches b ON s.branch_id = b.branch_id
                    LEFT JOIN tbl_session_packages sp ON s.session_package_id = sp.package_id
                    WHERE s.email = ?
                    LIMIT 1
                ");
            } else {
                $stmtStudent = $this->conn->prepare("
                    SELECT
                        s.*,
                        b.branch_name
                    FROM tbl_students s
                    LEFT JOIN tbl_branches b ON s.branch_id = b.branch_id
                    WHERE s.email = ?
                    LIMIT 1
                ");
            }
            $stmtStudent->execute([$email]);
            $student = $stmtStudent->fetch(PDO::FETCH_ASSOC);

            if (!$student) {
                $this->sendJSON(['error' => 'Student not found for this email'], 404);
            }

            // Balance calculation (amount due)
            $amount = (float) ($student['registration_fee_amount'] ?? 0);
            $paid = (float) ($student['registration_fee_paid'] ?? 0);
            $student['balance_due'] = max(0, $amount - $paid);

            // Instruments currently associated with student
            $instruments = [];
            try {
                $stmtInstruments = $this->conn->prepare("
                    SELECT
                        si.instrument_id,
                        si.priority_order,
                        i.instrument_name,
                        i.serial_number,
                        i.`condition`,
                        i.status,
                        it.type_name
                    FROM tbl_student_instruments si
                    INNER JOIN tbl_instruments i ON si.instrument_id = i.instrument_id
                    LEFT JOIN tbl_instrument_types it ON i.type_id = it.type_id
                    WHERE si.student_id = ?
                    ORDER BY si.priority_order ASC, si.student_instrument_id ASC
                ");
                $stmtInstruments->execute([(int) $student['student_id']]);
                $instruments = $stmtInstruments->fetchAll(PDO::FETCH_ASSOC);
            } catch (PDOException $e) {
                $instruments = [];
            }

            // Guardians
            $guardians = [];
            $primaryGuardian = null;
            try {
                $stmtGuardians = $this->conn->prepare("
                    SELECT
                        g.*,
                        sg.is_primary_guardian
                    FROM tbl_guardians g
                    INNER JOIN tbl_student_guardians sg ON g.guardian_id = sg.guardian_id
                    WHERE sg.student_id = ?
                    ORDER BY (sg.is_primary_guardian = 'Y') DESC, g.guardian_id ASC
                ");
                $stmtGuardians->execute([(int) $student['student_id']]);
                $guardians = $stmtGuardians->fetchAll(PDO::FETCH_ASSOC);
                if (!empty($guardians)) {
                    $primaryGuardian = $guardians[0];
                }
            } catch (PDOException $e) {
                $guardians = [];
                $primaryGuardian = null;
            }

            $this->sendJSON([
                'success' => true,
                'student' => $student,
                'guardians' => $guardians,
                'primary_guardian' => $primaryGuardian,
                'instruments' => $instruments
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }
}

$studentsApi = new StudentsApi($conn);
$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $action = $input['action'] ?? $_GET['action'] ?? '';
}

switch ($action) {
    case 'get-all-students':
        $studentsApi->getAllStudents();
        break;
    case 'get-student':
        $studentsApi->getStudent();
        break;
    case 'update-student':
        $studentsApi->updateStudent();
        break;
    case 'delete-student':
        $studentsApi->deleteStudent();
        break;
    case 'get-active-students':
        $studentsApi->getActiveStudents();
        break;
    case 'assign-package':
        $studentsApi->assignPackage();
        break;
    case 'get-student-portal':
        $studentsApi->getStudentPortal();
        break;
    default:
        $studentsApi->sendJSON(['error' => 'Invalid action'], 400);
}

