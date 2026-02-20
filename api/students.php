<?php
// Suppress error display for JSON APIs
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once 'db_connect.php';

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

// Check if database connection exists
if (!isset($conn) || $conn === null) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

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

    private function isMultipartRequest()
    {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? ($_SERVER['HTTP_CONTENT_TYPE'] ?? '');
        return stripos((string)$contentType, 'multipart/form-data') !== false;
    }

    private function storePaymentProofUpload($file, $scope = 'package_requests')
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

    /** Ensure tbl_student_package_requests exists (student availing flow) */
    private function ensureStudentPackageRequestsTable()
    {
        try {
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS tbl_student_package_requests (
                    request_id INT AUTO_INCREMENT PRIMARY KEY,
                    student_id INT NOT NULL,
                    branch_id INT NOT NULL,
                    package_id INT NOT NULL,
                    instrument_ids_json TEXT NULL,
                    selected_availability_id INT NULL,
                    preferred_date DATE NULL,
                    preferred_day_of_week ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NULL,
                    preferred_start_time TIME NULL,
                    preferred_end_time TIME NULL,
                    assigned_teacher_id INT NULL,
                    payment_proof_path VARCHAR(255) NULL,
                    assigned_date DATE NULL,
                    assigned_day_of_week ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NULL,
                    assigned_start_time TIME NULL,
                    assigned_end_time TIME NULL,
                    assigned_room VARCHAR(100) NULL,
                    requested_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
                    status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
                    admin_notes TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            ");
            try {
                $stmt = $this->conn->query("SHOW COLUMNS FROM tbl_student_package_requests LIKE 'preferred_day_of_week'");
                if ($stmt && $stmt->rowCount() === 0) {
                    $this->conn->exec("ALTER TABLE tbl_student_package_requests ADD COLUMN preferred_day_of_week ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NULL AFTER preferred_date");
                }
            } catch (PDOException $e) {}
            try {
                $stmt = $this->conn->query("SHOW COLUMNS FROM tbl_student_package_requests LIKE 'preferred_start_time'");
                if ($stmt && $stmt->rowCount() === 0) {
                    $this->conn->exec("ALTER TABLE tbl_student_package_requests ADD COLUMN preferred_start_time TIME NULL AFTER preferred_day_of_week");
                }
            } catch (PDOException $e) {}
            try {
                $stmt = $this->conn->query("SHOW COLUMNS FROM tbl_student_package_requests LIKE 'preferred_end_time'");
                if ($stmt && $stmt->rowCount() === 0) {
                    $this->conn->exec("ALTER TABLE tbl_student_package_requests ADD COLUMN preferred_end_time TIME NULL AFTER preferred_start_time");
                }
            } catch (PDOException $e) {}
            try {
                $stmt = $this->conn->query("SHOW COLUMNS FROM tbl_student_package_requests LIKE 'assigned_teacher_id'");
                if ($stmt && $stmt->rowCount() === 0) {
                    $this->conn->exec("ALTER TABLE tbl_student_package_requests ADD COLUMN assigned_teacher_id INT NULL AFTER preferred_end_time");
                }
            } catch (PDOException $e) {}
            try {
                $stmt = $this->conn->query("SHOW COLUMNS FROM tbl_student_package_requests LIKE 'payment_proof_path'");
                if ($stmt && $stmt->rowCount() === 0) {
                    $this->conn->exec("ALTER TABLE tbl_student_package_requests ADD COLUMN payment_proof_path VARCHAR(255) NULL AFTER assigned_teacher_id");
                }
            } catch (PDOException $e) {}
            try {
                $stmt = $this->conn->query("SHOW COLUMNS FROM tbl_student_package_requests LIKE 'assigned_date'");
                if ($stmt && $stmt->rowCount() === 0) {
                    $this->conn->exec("ALTER TABLE tbl_student_package_requests ADD COLUMN assigned_date DATE NULL AFTER assigned_teacher_id");
                }
            } catch (PDOException $e) {}
            try {
                $stmt = $this->conn->query("SHOW COLUMNS FROM tbl_student_package_requests LIKE 'assigned_day_of_week'");
                if ($stmt && $stmt->rowCount() === 0) {
                    $this->conn->exec("ALTER TABLE tbl_student_package_requests ADD COLUMN assigned_day_of_week ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NULL AFTER assigned_date");
                }
            } catch (PDOException $e) {}
            try {
                $stmt = $this->conn->query("SHOW COLUMNS FROM tbl_student_package_requests LIKE 'assigned_start_time'");
                if ($stmt && $stmt->rowCount() === 0) {
                    $this->conn->exec("ALTER TABLE tbl_student_package_requests ADD COLUMN assigned_start_time TIME NULL AFTER assigned_day_of_week");
                }
            } catch (PDOException $e) {}
            try {
                $stmt = $this->conn->query("SHOW COLUMNS FROM tbl_student_package_requests LIKE 'assigned_end_time'");
                if ($stmt && $stmt->rowCount() === 0) {
                    $this->conn->exec("ALTER TABLE tbl_student_package_requests ADD COLUMN assigned_end_time TIME NULL AFTER assigned_start_time");
                }
            } catch (PDOException $e) {}
            try {
                $stmt = $this->conn->query("SHOW COLUMNS FROM tbl_student_package_requests LIKE 'assigned_room'");
                if ($stmt && $stmt->rowCount() === 0) {
                    $this->conn->exec("ALTER TABLE tbl_student_package_requests ADD COLUMN assigned_room VARCHAR(100) NULL AFTER assigned_end_time");
                }
            } catch (PDOException $e) {}
            try { $this->conn->exec("CREATE INDEX idx_student_package_requests_student ON tbl_student_package_requests(student_id)"); } catch (PDOException $e) {}
            try { $this->conn->exec("CREATE INDEX idx_student_package_requests_status ON tbl_student_package_requests(status)"); } catch (PDOException $e) {}
            try { $this->conn->exec("CREATE INDEX idx_student_package_requests_created ON tbl_student_package_requests(created_at)"); } catch (PDOException $e) {}
            try { $this->conn->exec("CREATE INDEX idx_student_package_requests_teacher ON tbl_student_package_requests(assigned_teacher_id)"); } catch (PDOException $e) {}
            try { $this->conn->exec("CREATE INDEX idx_student_package_requests_assigned_date ON tbl_student_package_requests(assigned_date)"); } catch (PDOException $e) {}
        } catch (PDOException $e) {
            // Do not break API
        }
    }

    /**
     * Compatibility guard for DBs with legacy triggers on tbl_enrollments.
     * Those triggers reference split enrollment tables that may be missing.
     */
    private function ensureLegacyEnrollmentTables()
    {
        try {
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS tbl_enrollment_core (
                    enrollment_id INT NOT NULL PRIMARY KEY,
                    student_id INT NOT NULL,
                    package_id INT NOT NULL,
                    instrument_id INT NOT NULL,
                    teacher_id INT NOT NULL,
                    enrollment_date DATE DEFAULT NULL,
                    start_date DATE DEFAULT NULL,
                    end_date DATE DEFAULT NULL,
                    status ENUM('Pending Payment','Ongoing','Completed','Cancelled') NOT NULL DEFAULT 'Pending Payment',
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            ");
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS tbl_enrollment_registration (
                    enrollment_id INT NOT NULL PRIMARY KEY,
                    registration_fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    registration_fee_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    registration_status ENUM('Unpaid','Partial','Paid') NOT NULL DEFAULT 'Unpaid'
                )
            ");
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS tbl_enrollment_financials (
                    enrollment_id INT NOT NULL PRIMARY KEY,
                    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    payment_deadline_session INT NOT NULL DEFAULT 7
                )
            ");
        } catch (PDOException $e) {
            // Do not break API. Trigger references can still fail if DB user lacks DDL permission.
        }
    }

    /**
     * Persist the assigned first-session schedule for student visibility.
     */
    private function upsertFirstSessionSchedule($enrollmentId, $teacherId, $instrumentId, $sessionDate, $startTime, $endTime, $assignedRoom, $branchId)
    {
        if (!$this->tableExists('tbl_sessions')) {
            return;
        }

        $roomId = null;
        $assignedRoom = trim((string)$assignedRoom);
        if ($assignedRoom !== '' && $this->tableExists('tbl_rooms')) {
            try {
                $stmtRoom = $this->conn->prepare("
                    SELECT room_id
                    FROM tbl_rooms
                    WHERE branch_id = ?
                      AND room_name = ?
                    LIMIT 1
                ");
                $stmtRoom->execute([(int)$branchId, $assignedRoom]);
                $roomId = $stmtRoom->fetchColumn();
                if ($roomId !== false) {
                    $roomId = (int)$roomId;
                } else {
                    $roomId = null;
                }
            } catch (PDOException $e) {
                $roomId = null;
            }
        }

        $stmtExisting = $this->conn->prepare("
            SELECT session_id
            FROM tbl_sessions
            WHERE enrollment_id = ?
              AND session_number = 1
            LIMIT 1
        ");
        $stmtExisting->execute([(int)$enrollmentId]);
        $existingSessionId = (int)$stmtExisting->fetchColumn();

        if ($existingSessionId > 0) {
            if ($assignedRoom !== '') {
                $stmtUpdate = $this->conn->prepare("
                    UPDATE tbl_sessions
                    SET teacher_id = ?,
                        instrument_id = ?,
                        session_date = ?,
                        start_time = ?,
                        end_time = ?,
                        room_id = ?,
                        notes = ?,
                        status = 'Scheduled'
                    WHERE session_id = ?
                ");
                $stmtUpdate->execute([
                    (int)$teacherId,
                    (int)$instrumentId,
                    $sessionDate,
                    $startTime,
                    $endTime,
                    $roomId,
                    $assignedRoom,
                    $existingSessionId
                ]);
            } else {
                $stmtUpdate = $this->conn->prepare("
                    UPDATE tbl_sessions
                    SET teacher_id = ?,
                        instrument_id = ?,
                        session_date = ?,
                        start_time = ?,
                        end_time = ?,
                        room_id = ?,
                        status = 'Scheduled'
                    WHERE session_id = ?
                ");
                $stmtUpdate->execute([
                    (int)$teacherId,
                    (int)$instrumentId,
                    $sessionDate,
                    $startTime,
                    $endTime,
                    $roomId,
                    $existingSessionId
                ]);
            }
            return;
        }

        $stmtInsert = $this->conn->prepare("
            INSERT INTO tbl_sessions (
                enrollment_id,
                teacher_id,
                session_number,
                session_date,
                start_time,
                end_time,
                session_type,
                instrument_id,
                room_id,
                status,
                notes
            ) VALUES (?, ?, 1, ?, ?, ?, 'Regular', ?, ?, 'Scheduled', ?)
        ");
        $stmtInsert->execute([
            (int)$enrollmentId,
            (int)$teacherId,
            $sessionDate,
            $startTime,
            $endTime,
            (int)$instrumentId,
            $roomId,
            ($assignedRoom !== '' ? $assignedRoom : null)
        ]);
    }

    private function buildTeacherCandidates($branchId, $instrumentIds = [], $instrumentKeywords = [])
    {
        $candidates = [];
        if (!$this->tableExists('tbl_teachers')) {
            return $candidates;
        }

        try {
            $teacherSql = "
                SELECT t.teacher_id, t.first_name, t.last_name, t.specialization
                FROM tbl_teachers t
                WHERE t.branch_id = ?
                  AND t.status = 'Active'
                ORDER BY t.first_name ASC, t.last_name ASC
            ";
            $stmtTeachers = $this->conn->prepare($teacherSql);
            $stmtTeachers->execute([(int) $branchId]);
            $teachers = $stmtTeachers->fetchAll(PDO::FETCH_ASSOC);

            $instrumentIds = array_values(array_filter(array_map('intval', (array)$instrumentIds), function ($v) { return $v > 0; }));
            $keywordList = [];
            foreach ((array)$instrumentKeywords as $kw) {
                $w = strtolower(trim((string)$kw));
                if ($w !== '') $keywordList[] = $w;
            }
            $keywordList = array_values(array_unique($keywordList));

            $mappedTeacherIds = [];
            if (!empty($instrumentIds) && $this->tableExists('tbl_teacher_instruments')) {
                $placeholders = implode(',', array_fill(0, count($instrumentIds), '?'));
                $stmtMap = $this->conn->prepare("
                    SELECT DISTINCT teacher_id
                    FROM tbl_teacher_instruments
                    WHERE instrument_id IN ({$placeholders})
                ");
                $stmtMap->execute($instrumentIds);
                $mappedTeacherIds = array_map('intval', $stmtMap->fetchAll(PDO::FETCH_COLUMN));
            }
            $mappedSet = array_flip($mappedTeacherIds);

            foreach ($teachers as $t) {
                $teacherId = (int)($t['teacher_id'] ?? 0);
                if ($teacherId < 1) continue;
                $specializationRaw = trim((string)($t['specialization'] ?? ''));
                $specialization = strtolower($specializationRaw);

                $isAllAround = ($specialization !== '') && (
                    strpos($specialization, 'all around') !== false ||
                    strpos($specialization, 'all-around') !== false ||
                    strpos($specialization, 'all instruments') !== false ||
                    strpos($specialization, 'multi') !== false
                );

                $matchedByKeyword = false;
                if (!empty($keywordList)) {
                    foreach ($keywordList as $kw) {
                        if (strpos($specialization, $kw) !== false) {
                            $matchedByKeyword = true;
                            break;
                        }
                    }
                }

                $matchedByMapping = isset($mappedSet[$teacherId]);
                $eligible = empty($instrumentIds) || $matchedByMapping || $matchedByKeyword || $isAllAround;
                if (!$eligible) continue;

                $candidates[] = [
                    'teacher_id' => $teacherId,
                    'teacher_name' => trim(($t['first_name'] ?? '') . ' ' . ($t['last_name'] ?? '')),
                    'specialization' => $specializationRaw !== '' ? $specializationRaw : 'General'
                ];
            }

            // Fallback: if strict filtering yields no match, allow desk/admin to manually choose any active teacher.
            if (empty($candidates) && !empty($teachers)) {
                foreach ($teachers as $t) {
                    $teacherId = (int)($t['teacher_id'] ?? 0);
                    if ($teacherId < 1) continue;
                    $specializationRaw = trim((string)($t['specialization'] ?? ''));
                    $candidates[] = [
                        'teacher_id' => $teacherId,
                        'teacher_name' => trim(($t['first_name'] ?? '') . ' ' . ($t['last_name'] ?? '')),
                        'specialization' => $specializationRaw !== '' ? $specializationRaw : 'General'
                    ];
                }
            }
        } catch (PDOException $e) {
            return [];
        }

        return $candidates;
    }

    private function dayOfWeekFromDate($dateYmd)
    {
        $ts = strtotime((string)$dateYmd);
        if ($ts === false) return '';
        return date('l', $ts);
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

    /** Check whether a table has a specific column */
    private function tableHasColumn($tableName, $columnName)
    {
        if (!preg_match('/^[A-Za-z0-9_]+$/', (string) $tableName)) {
            return false;
        }
        try {
            $stmt = $this->conn->prepare("SHOW COLUMNS FROM `{$tableName}` LIKE ?");
            $stmt->execute([$columnName]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            return false;
        }
    }

    // Get all students for admin_students page
    public function getAllStudents()
    {
        try {
            $this->ensureSessionPackageColumn();

            $hasStudentRegistrationCols = false;
            try {
                $colCheck = $this->conn->query("SHOW COLUMNS FROM tbl_students LIKE 'registration_status'");
                $hasStudentRegistrationCols = $colCheck && $colCheck->rowCount() > 0;
            } catch (PDOException $e) {
                $hasStudentRegistrationCols = false;
            }

            if ($hasStudentRegistrationCols) {
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
            } else {
                $stmt = $this->conn->prepare("
                    SELECT
                        s.student_id,
                        s.first_name,
                        s.last_name,
                        s.email,
                        s.phone,
                        COALESCE(e.registration_fee_amount, 0) AS registration_fee_amount,
                        COALESCE(e.registration_fee_paid, 0) AS registration_fee_paid,
                        COALESCE(e.registration_status, 'Pending') AS registration_status,
                        s.status,
                        s.created_at,
                        s.branch_id,
                        b.branch_name
                    FROM tbl_students s
                    LEFT JOIN tbl_branches b ON s.branch_id = b.branch_id
                    LEFT JOIN (
                        SELECT e1.*
                        FROM tbl_enrollments e1
                        INNER JOIN (
                            SELECT student_id, MAX(enrollment_id) AS max_enrollment_id
                            FROM tbl_enrollments
                            GROUP BY student_id
                        ) latest ON latest.max_enrollment_id = e1.enrollment_id
                    ) e ON e.student_id = s.student_id
                    WHERE COALESCE(e.registration_status, 'Pending') != 'Rejected'
                    ORDER BY s.created_at DESC
                ");
            }

            $stmt->execute();
            $this->sendJSON([
                'success'   => true,
                'students'  => $stmt->fetchAll(PDO::FETCH_ASSOC)
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
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

        $this->ensureStudentInstrumentsTable();

        try {
            $stmtStudent = $this->conn->prepare("
                SELECT
                    s.*,
                    b.branch_name,
                    e.enrollment_id,
                    e.registration_fee_amount,
                    e.registration_fee_paid,
                    e.registration_status,
                    lp.package_name,
                    lp.total_sessions AS package_sessions,
                    1 AS package_max_instruments,
                    COALESCE(lp.price, e.total_amount, 0) AS package_price
                FROM tbl_students s
                LEFT JOIN tbl_branches b ON s.branch_id = b.branch_id
                LEFT JOIN (
                    SELECT e1.*
                    FROM tbl_enrollments e1
                    INNER JOIN (
                        SELECT student_id, MAX(enrollment_id) AS max_enrollment_id
                        FROM tbl_enrollments
                        GROUP BY student_id
                    ) latest ON latest.max_enrollment_id = e1.enrollment_id
                ) e ON s.student_id = e.student_id
                LEFT JOIN tbl_lesson_packages lp ON e.package_id = lp.package_id
                WHERE s.email = ?
                LIMIT 1
            ");
            $stmtStudent->execute([$email]);
            $student = $stmtStudent->fetch(PDO::FETCH_ASSOC);

            if (!$student) {
                $this->sendJSON(['error' => 'Student not found for this email'], 404);
            }

            if (!isset($student['registration_fee_amount'])) $student['registration_fee_amount'] = 0;
            if (!isset($student['registration_fee_paid'])) $student['registration_fee_paid'] = 0;
            if (!isset($student['registration_status'])) $student['registration_status'] = 'Pending';

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

    /** Ensure tbl_session_packages exists for package selection flows */
    private function ensureSessionPackagesTable()
    {
        try {
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS tbl_session_packages (
                    package_id INT AUTO_INCREMENT PRIMARY KEY,
                    package_name VARCHAR(100) NOT NULL,
                    sessions INT NOT NULL,
                    max_instruments TINYINT NOT NULL DEFAULT 1,
                    price DECIMAL(10,2) NOT NULL DEFAULT 0,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ");
            $stmt = $this->conn->query("SELECT COUNT(*) FROM tbl_session_packages");
            if ((int) $stmt->fetchColumn() === 0) {
                $this->conn->exec("
                    INSERT INTO tbl_session_packages (package_name, sessions, max_instruments, price, description) VALUES
                    ('Basic (12 Sessions)', 12, 1, 7450.00, '1 instrument only'),
                    ('Standard (20 Sessions)', 20, 2, 11800.00, '2 instruments')
                ");
            }
        } catch (PDOException $e) {
            // Do not break API
        }
    }

    // Student dashboard meta for package + instrument + teacher availability request flow
    public function getStudentRequestMeta()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $email = trim($_GET['email'] ?? '');
        if ($email === '') {
            $this->sendJSON(['error' => 'Email is required'], 400);
        }

        try {
            $stmtStudent = $this->conn->prepare("
                SELECT
                    s.student_id,
                    s.branch_id,
                    b.branch_name,
                    s.status,
                    s.first_name,
                    s.last_name,
                    COALESCE(s.registration_status, 'Pending') AS registration_status
                FROM tbl_students s
                LEFT JOIN tbl_branches b ON s.branch_id = b.branch_id
                WHERE s.email = ?
                LIMIT 1
            ");
            $stmtStudent->execute([$email]);
            $student = $stmtStudent->fetch(PDO::FETCH_ASSOC);
            if (!$student) {
                $this->sendJSON(['error' => 'Student not found for this email'], 404);
            }

            $studentBranchId = (int) ($student['branch_id'] ?? 0);
            $studentBranchName = trim((string) ($student['branch_name'] ?? ''));
            $packages = [];
            $instruments = [];
            $availabilities = [];
            $latestRequest = null;

            // Packages (session packages first, then lesson packages fallback)
            try {
                if ($this->tableExists('tbl_session_packages')) {
                    $sessionPackagesHasBranch = $this->tableHasColumn('tbl_session_packages', 'branch_id');
                    if ($sessionPackagesHasBranch && $studentBranchId > 0) {
                        $stmtPackages = $this->conn->prepare("
                            SELECT
                                sp.package_id,
                                sp.package_name,
                                sp.sessions,
                                sp.max_instruments,
                                COALESCE(sp.price, 0) AS price,
                                sp.branch_id,
                                COALESCE(b.branch_name, '') AS branch_name
                            FROM tbl_session_packages sp
                            LEFT JOIN tbl_branches b ON sp.branch_id = b.branch_id
                            WHERE sp.branch_id = ?
                            ORDER BY sp.sessions ASC, sp.package_id ASC
                        ");
                        $stmtPackages->execute([$studentBranchId]);
                    } else {
                        $stmtPackages = $this->conn->prepare("
                            SELECT
                                package_id,
                                package_name,
                                sessions,
                                max_instruments,
                                COALESCE(price, 0) AS price,
                                ? AS branch_id,
                                ? AS branch_name
                            FROM tbl_session_packages
                            ORDER BY sessions ASC, package_id ASC
                        ");
                        $stmtPackages->execute([$studentBranchId, $studentBranchName]);
                    }
                    $packages = $stmtPackages->fetchAll(PDO::FETCH_ASSOC);
                }

                if (empty($packages) && $this->tableExists('tbl_lesson_packages')) {
                    $lessonPackagesHasBranch = $this->tableHasColumn('tbl_lesson_packages', 'branch_id');
                    $lessonPackagesHasStatus = $this->tableHasColumn('tbl_lesson_packages', 'status');
                    $lessonSessionsCol = $this->tableHasColumn('tbl_lesson_packages', 'total_sessions') ? 'total_sessions' : 'sessions';

                    if ($lessonPackagesHasBranch && $studentBranchId > 0) {
                        $sqlLesson = "
                            SELECT
                                lp.package_id,
                                lp.package_name,
                                lp.{$lessonSessionsCol} AS sessions,
                                1 AS max_instruments,
                                COALESCE(lp.price, 0) AS price,
                                lp.branch_id,
                                COALESCE(b.branch_name, '') AS branch_name
                            FROM tbl_lesson_packages lp
                            LEFT JOIN tbl_branches b ON lp.branch_id = b.branch_id
                            WHERE lp.branch_id = ?
                        ";
                        if ($lessonPackagesHasStatus) {
                            $sqlLesson .= " AND lp.status = 'Active' ";
                        }
                        $sqlLesson .= " ORDER BY lp.{$lessonSessionsCol} ASC, lp.package_id ASC ";
                        $stmtPackages = $this->conn->prepare($sqlLesson);
                        $stmtPackages->execute([$studentBranchId]);
                    } else {
                        $sqlLesson = "
                            SELECT
                                package_id,
                                package_name,
                                {$lessonSessionsCol} AS sessions,
                                1 AS max_instruments,
                                COALESCE(price, 0) AS price,
                                ? AS branch_id,
                                ? AS branch_name
                            FROM tbl_lesson_packages
                        ";
                        if ($lessonPackagesHasStatus) {
                            $sqlLesson .= " WHERE status = 'Active' ";
                        }
                        $sqlLesson .= " ORDER BY {$lessonSessionsCol} ASC, package_id ASC ";
                        $stmtPackages = $this->conn->prepare($sqlLesson);
                        $stmtPackages->execute([$studentBranchId, $studentBranchName]);
                    }
                    $packages = $stmtPackages->fetchAll(PDO::FETCH_ASSOC);
                }
            } catch (PDOException $e) {
                $packages = [];
            }

            // Instruments for student's branch
            try {
                $stmtInstruments = $this->conn->prepare("
                    SELECT
                        i.instrument_id,
                        i.instrument_name,
                        i.type_id,
                        i.status,
                        it.type_name
                    FROM tbl_instruments i
                    LEFT JOIN tbl_instrument_types it ON i.type_id = it.type_id
                    WHERE i.branch_id = ?
                      AND i.status IN ('Active','Available')
                    ORDER BY it.type_name ASC, i.instrument_name ASC
                ");
                $stmtInstruments->execute([(int) $student['branch_id']]);
                $instruments = $stmtInstruments->fetchAll(PDO::FETCH_ASSOC);
            } catch (PDOException $e) {
                $instruments = [];
            }

            // Teacher availability
            try {
                if ($this->tableExists('tbl_teacher_availability')) {
                    $stmtAvailability = $this->conn->prepare("
                        SELECT DISTINCT
                            ta.day_of_week,
                            ta.start_time,
                            ta.end_time
                        FROM tbl_teacher_availability ta
                        WHERE ta.branch_id = ?
                          AND ta.status = 'Available'
                        ORDER BY
                            FIELD(ta.day_of_week, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'),
                            ta.start_time ASC
                    ");
                    $stmtAvailability->execute([(int) $student['branch_id']]);
                    $availabilities = $stmtAvailability->fetchAll(PDO::FETCH_ASSOC);
                }
            } catch (PDOException $e) {
                $availabilities = [];
            }

            // Latest enrollment request (for status display)
            try {
                $packageNameExpr = "COALESCE(lp.package_name, CONCAT('Package #', e.package_id))";
                $packageJoin = "LEFT JOIN tbl_lesson_packages lp ON e.package_id = lp.package_id";
                if ($this->tableExists('tbl_session_packages')) {
                    $packageNameExpr = "COALESCE(sp.package_name, lp.package_name, CONCAT('Package #', e.package_id))";
                    $packageJoin = "LEFT JOIN tbl_session_packages sp ON e.package_id = sp.package_id LEFT JOIN tbl_lesson_packages lp ON e.package_id = lp.package_id";
                } else if (!$this->tableExists('tbl_lesson_packages')) {
                    $packageNameExpr = "CONCAT('Package #', e.package_id)";
                    $packageJoin = "";
                }

                $sessionJoin = "";
                $assignedDateExpr = "e.start_date";
                $assignedDayExpr = "CASE WHEN e.start_date IS NULL THEN NULL ELSE DAYNAME(e.start_date) END";
                $assignedStartExpr = "NULL";
                $assignedEndExpr = "NULL";
                $assignedRoomExpr = "NULL";
                if ($this->tableExists('tbl_sessions')) {
                    $sessionJoin = "
                        LEFT JOIN (
                            SELECT
                                s.enrollment_id,
                                s.session_date,
                                s.start_time,
                                s.end_time,
                                s.room_id,
                                s.notes
                            FROM tbl_sessions s
                            INNER JOIN (
                                SELECT enrollment_id, MIN(session_number) AS first_session_number
                                FROM tbl_sessions
                                GROUP BY enrollment_id
                            ) sf ON sf.enrollment_id = s.enrollment_id
                                AND sf.first_session_number = s.session_number
                        ) fs ON fs.enrollment_id = e.enrollment_id
                    ";
                    $assignedDateExpr = "COALESCE(fs.session_date, e.start_date)";
                    $assignedDayExpr = "CASE WHEN COALESCE(fs.session_date, e.start_date) IS NULL THEN NULL ELSE DAYNAME(COALESCE(fs.session_date, e.start_date)) END";
                    $assignedStartExpr = "fs.start_time";
                    $assignedEndExpr = "fs.end_time";
                    if ($this->tableExists('tbl_rooms')) {
                        $sessionJoin .= " LEFT JOIN tbl_rooms rm ON fs.room_id = rm.room_id ";
                        $assignedRoomExpr = "COALESCE(NULLIF(TRIM(rm.room_name), ''), NULLIF(TRIM(fs.notes), ''))";
                    } else {
                        $assignedRoomExpr = "NULLIF(TRIM(fs.notes), '')";
                    }
                }

                $stmtLatestRequest = $this->conn->prepare("
                    SELECT
                        e.enrollment_id AS request_id,
                        e.package_id,
                        CONCAT('[', e.instrument_id, ']') AS instrument_ids_json,
                        e.start_date AS preferred_date,
                        CASE
                            WHEN e.start_date IS NULL THEN NULL
                            ELSE DAYNAME(e.start_date)
                        END AS preferred_day_of_week,
                        NULL AS preferred_start_time,
                        NULL AS preferred_end_time,
                        e.teacher_id AS assigned_teacher_id,
                        NULL AS payment_proof_path,
                        {$assignedDateExpr} AS assigned_date,
                        {$assignedDayExpr} AS assigned_day_of_week,
                        {$assignedStartExpr} AS assigned_start_time,
                        {$assignedEndExpr} AS assigned_end_time,
                        {$assignedRoomExpr} AS assigned_room,
                        COALESCE(e.total_amount, 0) AS requested_amount,
                        CASE
                            WHEN e.status = 'Pending Payment' THEN 'Pending'
                            ELSE 'Approved'
                        END AS status,
                        NULL AS admin_notes,
                        e.created_at,
                        {$packageNameExpr} AS package_name,
                        t.first_name AS assigned_teacher_first_name,
                        t.last_name AS assigned_teacher_last_name
                    FROM tbl_enrollments e
                    {$packageJoin}
                    {$sessionJoin}
                    LEFT JOIN tbl_teachers t ON e.teacher_id = t.teacher_id
                    WHERE e.student_id = ?
                    ORDER BY e.enrollment_id DESC
                    LIMIT 1
                ");
                $stmtLatestRequest->execute([(int) $student['student_id']]);
                $latestRequest = $stmtLatestRequest->fetch(PDO::FETCH_ASSOC) ?: null;
                if ($latestRequest && !empty($latestRequest['instrument_ids_json'])) {
                    $decoded = json_decode($latestRequest['instrument_ids_json'], true);
                    $latestRequest['instrument_ids'] = is_array($decoded) ? $decoded : [];
                } else if ($latestRequest) {
                    $latestRequest['instrument_ids'] = [];
                }
            } catch (PDOException $e) {
                $latestRequest = null;
            }

            $this->sendJSON([
                'success' => true,
                'student' => $student,
                'packages' => $packages,
                'instruments' => $instruments,
                'availabilities' => $availabilities,
                'latest_request' => $latestRequest
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    // Student submits package+instrument+preferred schedule request for admin/desk review
    public function submitPackageRequest()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $isMultipart = $this->isMultipartRequest();
        $data = $isMultipart ? ($_POST ?: []) : (json_decode(file_get_contents('php://input'), true) ?: []);
        $studentId = (int) ($data['student_id'] ?? 0);
        $packageId = (int) ($data['package_id'] ?? 0);
        $preferredDate = !empty($data['preferred_date']) ? $data['preferred_date'] : null;
        $preferredDay = trim($data['preferred_day_of_week'] ?? '');
        if (!empty($data['instrument_ids_json'])) {
            $decoded = json_decode((string)$data['instrument_ids_json'], true);
            $instrumentIds = is_array($decoded) ? $decoded : [];
        } else {
            $instrumentIds = is_array($data['instrument_ids'] ?? null) ? $data['instrument_ids'] : [];
        }
        $instrumentIds = array_values(array_unique(array_map('intval', $instrumentIds)));
        $instrumentIds = array_filter($instrumentIds, function ($v) { return $v > 0; });

        if ($studentId < 1 || $packageId < 1) {
            $this->sendJSON(['error' => 'student_id and package_id are required'], 400);
        }
        $validDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
        if (!$preferredDate || !in_array($preferredDay, $validDays, true)) {
            $this->sendJSON(['error' => 'preferred_date and preferred_day_of_week are required'], 400);
        }

        $this->ensureStudentInstrumentsTable();
        $this->ensureLegacyEnrollmentTables();

        $paymentProofPath = null;
        if ($isMultipart && !empty($_FILES['package_payment_proof_file']['name']) && ($_FILES['package_payment_proof_file']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK) {
            try {
                $paymentProofPath = $this->storePaymentProofUpload($_FILES['package_payment_proof_file'], 'package_requests');
            } catch (Exception $e) {
                $this->sendJSON(['error' => $e->getMessage()], 400);
            }
        }

        try {
            $stmtStudent = $this->conn->prepare("
                SELECT
                    s.student_id,
                    s.branch_id,
                    s.status,
                    COALESCE(s.registration_status, 'Pending') AS registration_status
                FROM tbl_students s
                WHERE s.student_id = ?
                LIMIT 1
            ");
            $stmtStudent->execute([$studentId]);
            $student = $stmtStudent->fetch(PDO::FETCH_ASSOC);
            if (!$student) {
                $this->sendJSON(['error' => 'Student not found'], 404);
            }
            if ($student['status'] !== 'Active') {
                $this->sendJSON(['error' => 'Student account is not active yet'], 400);
            }

            $stmtExisting = $this->conn->prepare("
                SELECT enrollment_id
                FROM tbl_enrollments
                WHERE student_id = ? AND status = 'Pending Payment'
                ORDER BY enrollment_id DESC
                LIMIT 1
            ");
            $stmtExisting->execute([$studentId]);
            if ($stmtExisting->fetch()) {
                $this->sendJSON(['error' => 'You already have a pending request. Please wait for desk/admin approval.'], 400);
            }

            $lessonPackagesHasBranch = $this->tableHasColumn('tbl_lesson_packages', 'branch_id');
            if ($lessonPackagesHasBranch) {
                $stmtPackage = $this->conn->prepare("
                    SELECT package_id, 1 AS max_instruments, COALESCE(price, 0) AS price
                    FROM tbl_lesson_packages
                    WHERE package_id = ?
                      AND branch_id = ?
                    LIMIT 1
                ");
                $stmtPackage->execute([$packageId, (int) $student['branch_id']]);
            } else {
                $stmtPackage = $this->conn->prepare("
                    SELECT package_id, 1 AS max_instruments, COALESCE(price, 0) AS price
                    FROM tbl_lesson_packages
                    WHERE package_id = ?
                    LIMIT 1
                ");
                $stmtPackage->execute([$packageId]);
            }
            $package = $stmtPackage->fetch(PDO::FETCH_ASSOC);
            if (!$package && $this->tableExists('tbl_session_packages')) {
                $sessionPackagesHasBranch = $this->tableHasColumn('tbl_session_packages', 'branch_id');
                if ($sessionPackagesHasBranch) {
                    $stmtPackage = $this->conn->prepare("
                        SELECT package_id, package_name, sessions, max_instruments, COALESCE(price, 0) AS price
                        FROM tbl_session_packages
                        WHERE package_id = ?
                          AND branch_id = ?
                        LIMIT 1
                    ");
                    $stmtPackage->execute([$packageId, (int) $student['branch_id']]);
                } else {
                    $stmtPackage = $this->conn->prepare("
                        SELECT package_id, package_name, sessions, max_instruments, COALESCE(price, 0) AS price
                        FROM tbl_session_packages
                        WHERE package_id = ?
                        LIMIT 1
                    ");
                    $stmtPackage->execute([$packageId]);
                }
                $package = $stmtPackage->fetch(PDO::FETCH_ASSOC);
            }
            if (!$package) {
                $this->sendJSON(['error' => 'Selected package was not found'], 404);
            }

            // tbl_enrollments.package_id FK points to tbl_lesson_packages.package_id.
            // If request selected a package from tbl_session_packages, make sure it exists in tbl_lesson_packages.
            if ($this->tableExists('tbl_lesson_packages')) {
                $stmtLessonPackage = $this->conn->prepare("
                    SELECT package_id
                    FROM tbl_lesson_packages
                    WHERE package_id = ?
                    LIMIT 1
                ");
                $stmtLessonPackage->execute([$packageId]);
                $hasLessonPackage = (bool) $stmtLessonPackage->fetch(PDO::FETCH_ASSOC);
                if (!$hasLessonPackage) {
                    $fallbackName = trim((string)($package['package_name'] ?? 'Session Package'));
                    $fallbackSessions = (int)($package['sessions'] ?? 1);
                    if ($fallbackSessions < 1) $fallbackSessions = 1;
                    $fallbackPrice = (float)($package['price'] ?? 0);

                    $stmtCreateLessonPackage = $this->conn->prepare("
                        INSERT INTO tbl_lesson_packages (
                            package_id, package_name, total_sessions, price, description, status
                        ) VALUES (?, ?, ?, ?, ?, 'Active')
                    ");
                    $stmtCreateLessonPackage->execute([
                        $packageId,
                        $fallbackName !== '' ? $fallbackName : 'Session Package',
                        $fallbackSessions,
                        $fallbackPrice,
                        'Auto-created from session package for enrollment request'
                    ]);
                }
            }

            $maxInstruments = (int) ($package['max_instruments'] ?? 1);
            if (count($instrumentIds) < 1) {
                $this->sendJSON(['error' => 'Select at least one instrument'], 400);
            }
            if (count($instrumentIds) > $maxInstruments) {
                $this->sendJSON(['error' => "Selected instruments exceed package limit of {$maxInstruments}"], 400);
            }

            $placeholders = implode(',', array_fill(0, count($instrumentIds), '?'));
            $params = array_merge([(int) $student['branch_id']], $instrumentIds);
            $stmtInstrumentCheck = $this->conn->prepare("
                SELECT instrument_id
                FROM tbl_instruments
                WHERE branch_id = ?
                  AND status IN ('Active','Available')
                  AND instrument_id IN ({$placeholders})
            ");
            $stmtInstrumentCheck->execute($params);
            $validIds = $stmtInstrumentCheck->fetchAll(PDO::FETCH_COLUMN);
            if (count($validIds) !== count($instrumentIds)) {
                $this->sendJSON(['error' => 'One or more selected instruments are not available in your branch'], 400);
            }

            $stmtFallbackTeacher = $this->conn->prepare("
                SELECT teacher_id
                FROM tbl_teachers
                WHERE branch_id = ?
                  AND status = 'Active'
                ORDER BY teacher_id ASC
                LIMIT 1
            ");
            $stmtFallbackTeacher->execute([(int)$student['branch_id']]);
            $fallbackTeacherId = (int)$stmtFallbackTeacher->fetchColumn();
            if ($fallbackTeacherId < 1) {
                $this->sendJSON(['error' => 'No active teacher found in your branch. Please contact admin.'], 400);
            }

            $primaryInstrumentId = (int)reset($instrumentIds);
            if ($primaryInstrumentId < 1) {
                $this->sendJSON(['error' => 'Select at least one instrument'], 400);
            }

            $stmtInsert = $this->conn->prepare("
                INSERT INTO tbl_enrollments (
                    student_id,
                    package_id,
                    instrument_id,
                    teacher_id,
                    enrollment_date,
                    start_date,
                    end_date,
                    total_amount,
                    paid_amount,
                    payment_deadline_session,
                    status
                ) VALUES (?, ?, ?, ?, CURRENT_DATE, ?, NULL, ?, 0, 7, 'Pending Payment')
            ");
            $stmtInsert->execute([
                $studentId,
                $packageId,
                $primaryInstrumentId,
                $fallbackTeacherId,
                $preferredDate,
                (float) $package['price']
            ]);

            $this->sendJSON([
                'success' => true,
                'message' => 'Request submitted. Desk/Admin will review and confirm your package payment.',
                'request_id' => (int) $this->conn->lastInsertId()
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    // Admin/desk view of pending student package requests
    public function getPendingPackageRequests()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $branchId = isset($_GET['branch_id']) ? (int) $_GET['branch_id'] : 0;
        $this->ensureSessionPackagesTable();

        try {
            $lessonSessionsCol = $this->tableHasColumn('tbl_lesson_packages', 'total_sessions') ? 'total_sessions' : 'sessions';
            $packageNameExpr = "COALESCE(sp.package_name, lp.package_name, CONCAT('Package #', e.package_id))";
            $packageSessionsExpr = "COALESCE(sp.sessions, lp.{$lessonSessionsCol}, 0)";
            $packageMaxInstExpr = "COALESCE(sp.max_instruments, 1)";
            $packageJoin = "LEFT JOIN tbl_session_packages sp ON e.package_id = sp.package_id LEFT JOIN tbl_lesson_packages lp ON e.package_id = lp.package_id";
            if (!$this->tableExists('tbl_session_packages') && $this->tableExists('tbl_lesson_packages')) {
                $packageNameExpr = "COALESCE(lp.package_name, CONCAT('Package #', e.package_id))";
                $packageSessionsExpr = "COALESCE(lp.{$lessonSessionsCol}, 0)";
                $packageMaxInstExpr = "1";
                $packageJoin = "LEFT JOIN tbl_lesson_packages lp ON e.package_id = lp.package_id";
            } else if (!$this->tableExists('tbl_session_packages') && !$this->tableExists('tbl_lesson_packages')) {
                $packageNameExpr = "CONCAT('Package #', e.package_id)";
                $packageSessionsExpr = "0";
                $packageMaxInstExpr = "1";
                $packageJoin = "";
            }

            $sql = "
                SELECT
                    e.enrollment_id AS request_id,
                    e.student_id,
                    s.branch_id,
                    e.package_id,
                    CONCAT('[', e.instrument_id, ']') AS instrument_ids_json,
                    e.start_date AS preferred_date,
                    CASE WHEN e.start_date IS NULL THEN NULL ELSE DAYNAME(e.start_date) END AS preferred_day_of_week,
                    NULL AS preferred_start_time,
                    NULL AS preferred_end_time,
                    e.teacher_id AS assigned_teacher_id,
                    NULL AS payment_proof_path,
                    COALESCE(e.total_amount, 0) AS requested_amount,
                    'Pending' AS status,
                    e.created_at,
                    s.first_name,
                    s.last_name,
                    s.email,
                    b.branch_name,
                    {$packageNameExpr} AS package_name,
                    {$packageSessionsExpr} AS sessions,
                    {$packageMaxInstExpr} AS max_instruments
            ";
            $sql .= ",
                NULL AS day_of_week,
                NULL AS start_time,
                NULL AS end_time,
                NULL AS teacher_first_name,
                NULL AS teacher_last_name
            ";
            $sql .= "
                FROM tbl_enrollments e
                INNER JOIN tbl_students s ON e.student_id = s.student_id
                LEFT JOIN tbl_branches b ON s.branch_id = b.branch_id
                {$packageJoin}
            ";
            $sql .= "
                WHERE e.status = 'Pending Payment'
            ";
            $params = [];
            if ($branchId > 0) {
                $sql .= " AND s.branch_id = ?";
                $params[] = $branchId;
            }
            $sql .= " ORDER BY e.created_at DESC";

            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($rows as &$row) {
                $ids = [];
                if (!empty($row['instrument_ids_json'])) {
                    $decoded = json_decode($row['instrument_ids_json'], true);
                    if (is_array($decoded)) $ids = array_values(array_map('intval', $decoded));
                }
                $row['instrument_ids'] = $ids;
                $row['instruments'] = [];
                $instrumentKeywords = [];
                if (!empty($ids)) {
                    $placeholders = implode(',', array_fill(0, count($ids), '?'));
                    $stmtInst = $this->conn->prepare("
                        SELECT i.instrument_id, i.instrument_name, it.type_name
                        FROM tbl_instruments i
                        LEFT JOIN tbl_instrument_types it ON i.type_id = it.type_id
                        WHERE i.instrument_id IN ({$placeholders})
                    ");
                    $stmtInst->execute($ids);
                    $instRows = $stmtInst->fetchAll(PDO::FETCH_ASSOC);
                    $nameById = [];
                    foreach ($instRows as $instRow) {
                        $nameById[(int) $instRow['instrument_id']] = $instRow['instrument_name'];
                        if (!empty($instRow['instrument_name'])) $instrumentKeywords[] = $instRow['instrument_name'];
                        if (!empty($instRow['type_name'])) $instrumentKeywords[] = $instRow['type_name'];
                    }
                    foreach ($ids as $iid) {
                        if (isset($nameById[$iid])) {
                            $row['instruments'][] = ['instrument_id' => $iid, 'instrument_name' => $nameById[$iid]];
                        }
                    }
                }
                $row['teacher_candidates'] = $this->buildTeacherCandidates((int)$row['branch_id'], $ids, $instrumentKeywords);
            }
            unset($row);

            $this->sendJSON(['success' => true, 'requests' => $rows]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    // Admin/desk approves student package request and assigns package + instruments
    public function approvePackageRequest()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $requestId = (int) ($data['request_id'] ?? 0);
        $teacherId = (int) ($data['teacher_id'] ?? 0);
        $assignedDate = trim($data['assigned_date'] ?? '');
        $assignedDay = trim($data['assigned_day_of_week'] ?? '');
        $assignedStart = trim($data['assigned_start_time'] ?? '');
        $assignedEnd = trim($data['assigned_end_time'] ?? '');
        $assignedRoom = trim($data['assigned_room'] ?? '');
        $adminNotes = trim($data['admin_notes'] ?? '');
        if ($requestId < 1) {
            $this->sendJSON(['error' => 'request_id is required'], 400);
        }
        if ($teacherId < 1) {
            $this->sendJSON(['error' => 'teacher_id is required'], 400);
        }
        if ($assignedDate === '' || $assignedStart === '' || $assignedEnd === '') {
            $this->sendJSON(['error' => 'assigned_date, assigned_start_time, and assigned_end_time are required'], 400);
        }
        $computedAssignedDay = $this->dayOfWeekFromDate($assignedDate);
        if ($computedAssignedDay === '') {
            $this->sendJSON(['error' => 'Invalid assigned_date'], 400);
        }
        $assignedDay = $computedAssignedDay;
        $validDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
        if (!in_array($assignedDay, $validDays, true)) {
            $this->sendJSON(['error' => 'Invalid assigned_day_of_week'], 400);
        }
        if (!preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $assignedStart) || !preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $assignedEnd)) {
            $this->sendJSON(['error' => 'Invalid assigned time format'], 400);
        }
        $startTs = strtotime($assignedStart);
        $endTs = strtotime($assignedEnd);
        if ($startTs === false || $endTs === false || $endTs <= $startTs) {
            $this->sendJSON(['error' => 'Assigned end time must be later than start time'], 400);
        }
        // Business rule: 1 hour per session
        if (($endTs - $startTs) !== 3600) {
            $this->sendJSON(['error' => 'Assigned schedule must be exactly 1 hour per session'], 400);
        }

        $this->ensureSessionPackageColumn();
        $this->ensureStudentInstrumentsTable();
        $this->ensureLegacyEnrollmentTables();

        try {
            $this->conn->beginTransaction();

            $stmtReq = $this->conn->prepare("
                SELECT e.enrollment_id AS request_id, e.student_id, s.branch_id, e.package_id, JSON_ARRAY(e.instrument_id) AS instrument_ids_json, e.status
                FROM tbl_enrollments e
                INNER JOIN tbl_students s ON e.student_id = s.student_id
                WHERE e.enrollment_id = ?
                LIMIT 1
                FOR UPDATE
            ");
            $stmtReq->execute([$requestId]);
            $req = $stmtReq->fetch(PDO::FETCH_ASSOC);
            if (!$req) {
                $this->conn->rollBack();
                $this->sendJSON(['error' => 'Request not found'], 404);
            }
            if ($req['status'] !== 'Pending Payment') {
                $this->conn->rollBack();
                $this->sendJSON(['error' => 'Only pending requests can be approved'], 400);
            }

            $instrumentIds = [];
            if (!empty($req['instrument_ids_json'])) {
                $decoded = json_decode($req['instrument_ids_json'], true);
                if (is_array($decoded)) {
                    $instrumentIds = array_values(array_unique(array_map('intval', $decoded)));
                    $instrumentIds = array_filter($instrumentIds, function ($v) { return $v > 0; });
                }
            }

            $instrumentKeywords = [];
            if (!empty($instrumentIds)) {
                $placeholders = implode(',', array_fill(0, count($instrumentIds), '?'));
                $stmtInst = $this->conn->prepare("
                    SELECT i.instrument_name, it.type_name
                    FROM tbl_instruments i
                    LEFT JOIN tbl_instrument_types it ON i.type_id = it.type_id
                    WHERE i.instrument_id IN ({$placeholders})
                ");
                $stmtInst->execute($instrumentIds);
                $instRows = $stmtInst->fetchAll(PDO::FETCH_ASSOC);
                foreach ($instRows as $instRow) {
                    if (!empty($instRow['instrument_name'])) $instrumentKeywords[] = $instRow['instrument_name'];
                    if (!empty($instRow['type_name'])) $instrumentKeywords[] = $instRow['type_name'];
                }
            }

            $candidateTeachers = $this->buildTeacherCandidates((int)$req['branch_id'], $instrumentIds, $instrumentKeywords);
            $candidateIds = array_map(function ($t) { return (int)($t['teacher_id'] ?? 0); }, $candidateTeachers);
            if (!in_array($teacherId, $candidateIds, true)) {
                $this->conn->rollBack();
                $this->sendJSON(['error' => 'Selected teacher is not eligible for this request/instrument specialization'], 400);
            }

            $packagePrice = 0.0;
            $packageSessions = 0;
            $packageName = 'Lesson Package';
            if ($this->tableExists('tbl_session_packages')) {
                $stmtPackage = $this->conn->prepare("
                    SELECT package_name, sessions, COALESCE(price, 0) AS price
                    FROM tbl_session_packages
                    WHERE package_id = ?
                    LIMIT 1
                ");
                $stmtPackage->execute([(int)$req['package_id']]);
                $pkg = $stmtPackage->fetch(PDO::FETCH_ASSOC);
                if ($pkg) {
                    $packagePrice = (float)($pkg['price'] ?? 0);
                    $packageSessions = (int)($pkg['sessions'] ?? 0);
                    $packageName = trim((string)($pkg['package_name'] ?? 'Lesson Package')) ?: 'Lesson Package';
                }
            }

            $stmtUpdateStudent = $this->conn->prepare("
                UPDATE tbl_students
                SET session_package_id = ?
                WHERE student_id = ?
            ");
            $stmtUpdateStudent->execute([(int) $req['package_id'], (int) $req['student_id']]);

            $stmtDelete = $this->conn->prepare("DELETE FROM tbl_student_instruments WHERE student_id = ?");
            $stmtDelete->execute([(int) $req['student_id']]);

            if (!empty($instrumentIds)) {
                $stmtInsertInst = $this->conn->prepare("
                    INSERT INTO tbl_student_instruments (student_id, instrument_id, priority_order)
                    VALUES (?, ?, ?)
                ");
                $priority = 1;
                foreach ($instrumentIds as $iid) {
                    $stmtInsertInst->execute([(int) $req['student_id'], (int) $iid, $priority]);
                    $priority++;
                }
            }

            // Create enrollment record once request is finalized.
            $primaryInstrumentId = !empty($instrumentIds) ? (int)$instrumentIds[0] : 0;
            if ($primaryInstrumentId < 1) {
                $this->conn->rollBack();
                $this->sendJSON(['error' => 'No instrument selected for enrollment'], 400);
            }
            if (!$this->tableExists('tbl_enrollments')) {
                $this->conn->rollBack();
                $this->sendJSON(['error' => 'tbl_enrollments table not found'], 500);
            }
            if ($this->tableExists('tbl_lesson_packages')) {
                $stmtLessonPkg = $this->conn->prepare("
                    SELECT package_id
                    FROM tbl_lesson_packages
                    WHERE package_id = ?
                    LIMIT 1
                ");
                $stmtLessonPkg->execute([(int)$req['package_id']]);
                if (!$stmtLessonPkg->fetch(PDO::FETCH_ASSOC)) {
                    $stmtCreateLessonPkg = $this->conn->prepare("
                        INSERT INTO tbl_lesson_packages (
                            package_id, package_name, total_sessions, price, description, status
                        ) VALUES (?, ?, ?, ?, ?, 'Active')
                    ");
                    $stmtCreateLessonPkg->execute([
                        (int)$req['package_id'],
                        $packageName,
                        max(1, $packageSessions),
                        $packagePrice,
                        'Auto-created from approved student request'
                    ]);
                }
            }

            $stmtExistingEnrollment = $this->conn->prepare("
                SELECT enrollment_id
                FROM tbl_enrollments
                WHERE student_id = ?
                  AND package_id = ?
                  AND instrument_id = ?
                  AND teacher_id = ?
                  AND status IN ('Ongoing', 'Pending Payment')
                ORDER BY enrollment_id DESC
                LIMIT 1
            ");
            $stmtExistingEnrollment->execute([
                (int)$req['student_id'],
                (int)$req['package_id'],
                $primaryInstrumentId,
                $teacherId
            ]);
            $existingEnrollment = $stmtExistingEnrollment->fetch(PDO::FETCH_ASSOC);

            if (!$existingEnrollment) {
                $startDate = $assignedDate;
                $endDate = null;
                if ($packageSessions > 0) {
                    $endDate = date('Y-m-d', strtotime($startDate . ' +' . max(0, ($packageSessions - 1) * 7) . ' days'));
                }

                $stmtInsertEnrollment = $this->conn->prepare("
                    INSERT INTO tbl_enrollments (
                        student_id,
                        package_id,
                        instrument_id,
                        teacher_id,
                        enrollment_date,
                        start_date,
                        end_date,
                        total_amount,
                        paid_amount,
                        payment_deadline_session,
                        status
                    ) VALUES (?, ?, ?, ?, CURRENT_DATE, ?, ?, ?, 0, 7, 'Ongoing')
                ");
                $stmtInsertEnrollment->execute([
                    (int)$req['student_id'],
                    (int)$req['package_id'],
                    $primaryInstrumentId,
                    $teacherId,
                    $startDate,
                    $endDate,
                    $packagePrice
                ]);
            }

            $endDate = null;
            if ($packageSessions > 0) {
                $endDate = date('Y-m-d', strtotime($assignedDate . ' +' . max(0, ($packageSessions - 1) * 7) . ' days'));
            }

            $stmtApprove = $this->conn->prepare("
                UPDATE tbl_enrollments
                SET teacher_id = ?,
                    start_date = ?,
                    end_date = ?,
                    total_amount = ?,
                    status = 'Ongoing'
                WHERE enrollment_id = ?
            ");
            $stmtApprove->execute([
                $teacherId,
                $assignedDate,
                $endDate,
                $packagePrice,
                $requestId
            ]);

            // Keep the assigned first schedule visible to students after approval.
            $this->upsertFirstSessionSchedule(
                (int)$requestId,
                (int)$teacherId,
                (int)$primaryInstrumentId,
                $assignedDate,
                $assignedStart,
                $assignedEnd,
                $assignedRoom,
                (int)$req['branch_id']
            );

            $this->conn->commit();

            $this->sendJSON([
                'success' => true,
                'message' => 'Request approved and moved to enrollment'
            ]);
        } catch (PDOException $e) {
            $this->conn->rollBack();
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    // Admin/desk rejects student package request
    public function rejectPackageRequest()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $requestId = (int) ($data['request_id'] ?? 0);
        $adminNotes = trim($data['admin_notes'] ?? '');
        if ($requestId < 1) {
            $this->sendJSON(['error' => 'request_id is required'], 400);
        }

        try {
            $stmt = $this->conn->prepare("
                DELETE FROM tbl_enrollments
                WHERE enrollment_id = ?
                  AND status = 'Pending Payment'
            ");
            $stmt->execute([$requestId]);
            if ($stmt->rowCount() === 0) {
                $this->sendJSON(['error' => 'Pending request not found'], 404);
            }
            $this->sendJSON(['success' => true, 'message' => 'Request rejected and removed']);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }
}

$studentsApi = new StudentsApi($conn);
$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $action = $_POST['action'] ?? $input['action'] ?? $_GET['action'] ?? '';
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
    case 'get-student-request-meta':
        $studentsApi->getStudentRequestMeta();
        break;
    case 'submit-package-request':
        $studentsApi->submitPackageRequest();
        break;
    case 'get-pending-package-requests':
        $studentsApi->getPendingPackageRequests();
        break;
    case 'approve-package-request':
        $studentsApi->approvePackageRequest();
        break;
    case 'reject-package-request':
        $studentsApi->rejectPackageRequest();
        break;
    default:
        $studentsApi->sendJSON(['error' => 'Invalid action'], 400);
}


