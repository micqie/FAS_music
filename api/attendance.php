<?php
require_once 'db_connect.php';

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

class AttendanceApi
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

    private function tableHasColumn($tableName, $columnName)
    {
        try {
            $stmt = $this->conn->prepare("SHOW COLUMNS FROM {$tableName} LIKE ?");
            $stmt->execute([$columnName]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            return false;
        }
    }

    private function ensureAttendanceTable()
    {
        if ($this->tableExists('tbl_attendance')) {
            if (!$this->tableHasColumn('tbl_attendance', 'branch_id')) {
                try {
                    $this->conn->exec("ALTER TABLE tbl_attendance ADD COLUMN branch_id INT NULL AFTER student_id");
                    try { $this->conn->exec("CREATE INDEX idx_attendance_branch ON tbl_attendance(branch_id)"); } catch (PDOException $e) {}
                } catch (PDOException $e) {
                    // Ignore schema upgrades
                }
            }
            return true;
        }
        try {
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS tbl_attendance (
                    attendance_id INT AUTO_INCREMENT PRIMARY KEY,
                    student_id INT NOT NULL,
                    branch_id INT NULL,
                    attended_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    status ENUM('Present','Absent','Late','Excused') NOT NULL DEFAULT 'Present',
                    source VARCHAR(30) NULL,
                    notes VARCHAR(255) NULL
                )
            ");
            try { $this->conn->exec("CREATE INDEX idx_attendance_student ON tbl_attendance(student_id)"); } catch (PDOException $e) {}
            try { $this->conn->exec("CREATE INDEX idx_attendance_date ON tbl_attendance(attended_at)"); } catch (PDOException $e) {}
            try { $this->conn->exec("CREATE INDEX idx_attendance_branch ON tbl_attendance(branch_id)"); } catch (PDOException $e) {}
        } catch (PDOException $e) {
            return false;
        }
        return $this->tableExists('tbl_attendance');
    }

    public function getSummary()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $studentId = (int) ($_GET['student_id'] ?? 0);
        if ($studentId < 1) {
            $this->sendJSON(['error' => 'student_id is required'], 400);
        }

        try {
            if ($this->tableExists('tbl_sessions') && $this->tableExists('tbl_enrollments')) {
                $stmt = $this->conn->prepare("
                    SELECT
                        COUNT(*) AS total_records,
                        SUM(ts.status = 'Completed') AS present_count,
                        SUM(ts.status = 'Late') AS late_count,
                        0 AS excused_count,
                        SUM(ts.status IN ('Cancelled', 'No Show')) AS absent_count,
                        MAX(
                            CASE
                                WHEN ts.status IN ('Completed', 'Late')
                                    THEN TIMESTAMP(ts.session_date, COALESCE(ts.end_time, ts.start_time, '00:00:00'))
                                ELSE NULL
                            END
                        ) AS last_attended_at
                    FROM tbl_sessions ts
                    INNER JOIN tbl_enrollments te ON te.enrollment_id = ts.enrollment_id
                    WHERE te.student_id = ?
                ");
            } else {
                $stmt = $this->conn->prepare("
                    SELECT
                        COUNT(*) AS total_records,
                        SUM(status = 'Present') AS present_count,
                        SUM(status = 'Late') AS late_count,
                        SUM(status = 'Excused') AS excused_count,
                        SUM(status = 'Absent') AS absent_count,
                        MAX(attended_at) AS last_attended_at
                    FROM tbl_attendance
                    WHERE student_id = ?
                ");
            }
            $stmt->execute([$studentId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

            // Normalize nulls
            foreach (['total_records','present_count','late_count','excused_count','absent_count'] as $k) {
                $row[$k] = (int) ($row[$k] ?? 0);
            }

            $this->sendJSON(['success' => true, 'summary' => $row]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function getStudentAttendance()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $studentId = (int) ($_GET['student_id'] ?? 0);
        if ($studentId < 1) {
            $this->sendJSON(['error' => 'student_id is required'], 400);
        }

        $limit = (int) ($_GET['limit'] ?? 50);
        if ($limit < 1) $limit = 50;
        if ($limit > 200) $limit = 200;

        try {
            if ($this->tableExists('tbl_sessions') && $this->tableExists('tbl_enrollments')) {
                $roomJoin = "";
                $roomExpr = "NULL";
                if ($this->tableExists('tbl_rooms')) {
                    $roomJoin = " LEFT JOIN tbl_rooms rm ON ts.room_id = rm.room_id ";
                    $roomExpr = "rm.room_name";
                }
                $stmt = $this->conn->prepare("
                    SELECT
                        ts.session_id AS attendance_id,
                        te.student_id,
                        TIMESTAMP(ts.session_date, COALESCE(ts.start_time, '00:00:00')) AS attended_at,
                        ts.session_date,
                        ts.start_time,
                        ts.end_time,
                        {$roomExpr} AS room_name,
                        ts.session_type AS source,
                        COALESCE(ts.attendance_notes, ts.notes) AS notes,
                        CASE
                            WHEN ts.status = 'Completed' THEN 'Present'
                            WHEN ts.status = 'Late' THEN 'Late'
                            WHEN ts.status IN ('Cancelled', 'No Show') THEN 'Absent'
                            ELSE ts.status
                        END AS status
                    FROM tbl_sessions ts
                    INNER JOIN tbl_enrollments te ON te.enrollment_id = ts.enrollment_id
                    {$roomJoin}
                    WHERE te.student_id = ?
                    ORDER BY ts.session_date DESC, ts.session_id DESC
                    LIMIT $limit
                ");
            } else {
                $stmt = $this->conn->prepare("
                    SELECT attendance_id, student_id, attended_at, DATE(attended_at) AS session_date, TIME(attended_at) AS start_time, NULL AS end_time, NULL AS room_name, source, notes, status
                    FROM tbl_attendance
                    WHERE student_id = ?
                    ORDER BY attended_at DESC, attendance_id DESC
                    LIMIT $limit
                ");
            }
            $stmt->execute([$studentId]);
            $this->sendJSON(['success' => true, 'attendance' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Record attendance (optional utility endpoint).
     * POST body: { student_id, status?, source?, notes? }
     */
    public function record()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $studentId = (int) ($data['student_id'] ?? 0);
        if ($studentId < 1) {
            $this->sendJSON(['error' => 'student_id is required'], 400);
        }

        $status = $data['status'] ?? 'Present';
        $allowed = ['Present','Absent','Late','Excused'];
        if (!in_array($status, $allowed, true)) {
            $this->sendJSON(['error' => 'Invalid status'], 400);
        }

        $source = isset($data['source']) ? substr(trim((string)$data['source']), 0, 30) : null;
        $notes = isset($data['notes']) ? substr(trim((string)$data['notes']), 0, 255) : null;

        try {
            if (!$this->ensureAttendanceTable()) {
                $this->sendJSON(['error' => 'Attendance write endpoint is unavailable on this schema'], 400);
            }
            $stmt = $this->conn->prepare("
                INSERT INTO tbl_attendance (student_id, status, source, notes)
                VALUES (?, ?, ?, ?)
            ");
            $stmt->execute([$studentId, $status, $source ?: null, $notes ?: null]);

            $this->sendJSON(['success' => true, 'attendance_id' => (int)$this->conn->lastInsertId()]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    private function parseQrPayload($payload)
    {
        $raw = trim((string) $payload);
        if ($raw === '') return null;
        $parts = explode('|', $raw);
        if (count($parts) < 4) return null;
        if ($parts[0] !== 'FAS_ATTENDANCE' || $parts[1] !== 'STUDENT') return null;
        $studentId = (int) ($parts[2] ?? 0);
        $email = trim((string) ($parts[3] ?? ''));
        $branchId = isset($parts[4]) ? (int) $parts[4] : null;
        if ($studentId < 1 || $email === '') return null;
        return ['student_id' => $studentId, 'email' => $email, 'branch_id' => $branchId];
    }

    public function scanQr()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $payload = $data['payload'] ?? $data['qr_payload'] ?? '';
        $parsed = $this->parseQrPayload($payload);
        if (!$parsed) {
            $this->sendJSON(['error' => 'Invalid QR payload'], 400);
        }

        $studentId = (int) $parsed['student_id'];
        $email = $parsed['email'];
        $deskBranchId = (int) ($data['desk_branch_id'] ?? 0);

        try {
            $stmt = $this->conn->prepare("
                SELECT s.student_id, s.first_name, s.last_name, s.email, s.branch_id, b.branch_name
                FROM tbl_students s
                LEFT JOIN tbl_branches b ON b.branch_id = s.branch_id
                WHERE s.student_id = ?
                LIMIT 1
            ");
            $stmt->execute([$studentId]);
            $student = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$student || strcasecmp(trim($student['email'] ?? ''), $email) !== 0) {
                $this->sendJSON(['error' => 'Student not found for this QR'], 404);
            }

            if (!$this->ensureAttendanceTable()) {
                $this->sendJSON(['error' => 'Attendance write endpoint is unavailable on this schema'], 400);
            }

            $studentBranchId = (int) ($student['branch_id'] ?? 0);
            if ($studentBranchId > 0 && $deskBranchId <= 0) {
                $this->sendJSON([
                    'success' => false,
                    'error_code' => 'DESK_BRANCH_REQUIRED',
                    'error' => 'Desk staff account has no branch assigned. Please contact the administrator.',
                    'student_branch_id' => $studentBranchId,
                    'student_branch_name' => $student['branch_name'] ?? null,
                    'desk_branch_id' => $deskBranchId
                ], 400);
            }
            if ($studentBranchId > 0 && $deskBranchId !== $studentBranchId) {
                $studentBranchName = trim($student['branch_name'] ?? '') ?: 'their enrolled branch';
                $deskBranchName = null;
                try {
                    $branchStmt = $this->conn->prepare("SELECT branch_name FROM tbl_branches WHERE branch_id = ? LIMIT 1");
                    $branchStmt->execute([$deskBranchId]);
                    $deskBranchName = $branchStmt->fetchColumn() ?: 'this branch';
                } catch (PDOException $e) {
                    $deskBranchName = 'this branch';
                }
                $this->sendJSON([
                    'success' => false,
                    'error_code' => 'BRANCH_MISMATCH',
                    'error' => "This student is enrolled at {$studentBranchName}. Attendance must be recorded at {$studentBranchName}. You are currently at {$deskBranchName}. Uptown=Uptown, Downtown=Downtown only.",
                    'student_branch_id' => $studentBranchId,
                    'student_branch_name' => $student['branch_name'] ?? null,
                    'desk_branch_id' => $deskBranchId,
                    'desk_branch_name' => $deskBranchName
                ], 400);
            }

            $dupStmt = $this->conn->prepare("
                SELECT attendance_id, attended_at, status
                FROM tbl_attendance
                WHERE student_id = ? AND DATE(attended_at) = CURDATE()
                ORDER BY attended_at DESC, attendance_id DESC
                LIMIT 1
            ");
            $dupStmt->execute([$studentId]);
            $existing = $dupStmt->fetch(PDO::FETCH_ASSOC);
            if ($existing) {
                $this->sendJSON([
                    'success' => true,
                    'already_checked_in' => true,
                    'attendance' => $existing,
                    'student' => [
                        'student_id' => (int) $student['student_id'],
                        'first_name' => $student['first_name'],
                        'last_name' => $student['last_name'],
                        'email' => $student['email'],
                        'branch_id' => $studentBranchId,
                        'branch_name' => $student['branch_name'] ?? null
                    ]
                ]);
            }

            $status = 'Present';
            $source = 'QR';
            $stmt = $this->conn->prepare("
                INSERT INTO tbl_attendance (student_id, branch_id, status, source, notes)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([$studentId, $studentBranchId > 0 ? $studentBranchId : null, $status, $source, null]);

            $id = (int) $this->conn->lastInsertId();
            $fetch = $this->conn->prepare("SELECT attendance_id, attended_at, status FROM tbl_attendance WHERE attendance_id = ? LIMIT 1");
            $fetch->execute([$id]);
            $attendance = $fetch->fetch(PDO::FETCH_ASSOC);

            $this->sendJSON([
                'success' => true,
                'already_checked_in' => false,
                'attendance' => $attendance,
                'student' => [
                    'student_id' => (int) $student['student_id'],
                    'first_name' => $student['first_name'],
                    'last_name' => $student['last_name'],
                    'email' => $student['email'],
                    'branch_id' => $studentBranchId,
                    'branch_name' => $student['branch_name'] ?? null
                ]
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Record attendance by student email (manual entry).
     * POST body: { email, desk_branch_id? }
     */
    public function recordByEmail()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $email = trim((string) ($data['email'] ?? ''));
        $deskBranchId = (int) ($data['desk_branch_id'] ?? 0);

        if ($email === '') {
            $this->sendJSON(['success' => false, 'error' => 'Email is required.'], 400);
        }

        try {
            $stmt = $this->conn->prepare("
                SELECT s.student_id, s.first_name, s.last_name, s.email, s.branch_id, b.branch_name
                FROM tbl_students s
                LEFT JOIN tbl_branches b ON b.branch_id = s.branch_id
                WHERE LOWER(TRIM(s.email)) = LOWER(?)
                LIMIT 1
            ");
            $stmt->execute([$email]);
            $student = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$student) {
                $this->sendJSON(['success' => false, 'error' => 'Student not found for this email.'], 404);
            }

            if (!$this->ensureAttendanceTable()) {
                $this->sendJSON(['success' => false, 'error' => 'Attendance unavailable.'], 400);
            }

            $studentBranchId = (int) ($student['branch_id'] ?? 0);
            if ($studentBranchId > 0 && $deskBranchId <= 0) {
                $this->sendJSON([
                    'success' => false,
                    'error_code' => 'DESK_BRANCH_REQUIRED',
                    'error' => 'Desk staff account has no branch assigned. Please contact the administrator.',
                    'student_branch_id' => $studentBranchId,
                    'student_branch_name' => $student['branch_name'] ?? null,
                    'desk_branch_id' => $deskBranchId
                ], 400);
            }
            if ($studentBranchId > 0 && $deskBranchId > 0 && $deskBranchId !== $studentBranchId) {
                $studentBranchName = trim($student['branch_name'] ?? '') ?: 'their enrolled branch';
                $deskBranchName = null;
                try {
                    $branchStmt = $this->conn->prepare("SELECT branch_name FROM tbl_branches WHERE branch_id = ? LIMIT 1");
                    $branchStmt->execute([$deskBranchId]);
                    $deskBranchName = $branchStmt->fetchColumn() ?: 'this branch';
                } catch (PDOException $e) {
                    $deskBranchName = 'this branch';
                }
                $this->sendJSON([
                    'success' => false,
                    'error_code' => 'BRANCH_MISMATCH',
                    'error' => "Student is enrolled at {$studentBranchName}. Attendance at {$deskBranchName} not allowed. Uptown=Uptown, Downtown=Downtown only.",
                    'student_branch_name' => $student['branch_name'] ?? null,
                    'desk_branch_name' => $deskBranchName
                ], 400);
            }

            $dupStmt = $this->conn->prepare("
                SELECT attendance_id, attended_at, status
                FROM tbl_attendance
                WHERE student_id = ? AND DATE(attended_at) = CURDATE()
                ORDER BY attended_at DESC LIMIT 1
            ");
            $dupStmt->execute([$student['student_id']]);
            $existing = $dupStmt->fetch(PDO::FETCH_ASSOC);
            if ($existing) {
                $this->sendJSON([
                    'success' => true,
                    'already_checked_in' => true,
                    'attendance' => $existing,
                    'student' => [
                        'student_id' => (int) $student['student_id'],
                        'first_name' => $student['first_name'],
                        'last_name' => $student['last_name'],
                        'email' => $student['email'],
                        'branch_name' => $student['branch_name'] ?? null
                    ]
                ]);
            }

            $stmt = $this->conn->prepare("
                INSERT INTO tbl_attendance (student_id, branch_id, status, source, notes)
                VALUES (?, ?, 'Present', 'Manual', ?)
            ");
            $stmt->execute([$student['student_id'], $studentBranchId > 0 ? $studentBranchId : null, null]);

            $id = (int) $this->conn->lastInsertId();
            $fetch = $this->conn->prepare("SELECT attendance_id, attended_at, status FROM tbl_attendance WHERE attendance_id = ? LIMIT 1");
            $fetch->execute([$id]);
            $attendance = $fetch->fetch(PDO::FETCH_ASSOC);

            $this->sendJSON([
                'success' => true,
                'already_checked_in' => false,
                'attendance' => $attendance,
                'student' => [
                    'student_id' => (int) $student['student_id'],
                    'first_name' => $student['first_name'],
                    'last_name' => $student['last_name'],
                    'email' => $student['email'],
                    'branch_id' => $studentBranchId,
                    'branch_name' => $student['branch_name'] ?? null
                ]
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['success' => false, 'error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function getDeskSummary()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        try {
            if (!$this->ensureAttendanceTable()) {
                $this->sendJSON(['error' => 'Attendance data is unavailable on this schema'], 400);
            }

            $branchId = (int) ($_GET['branch_id'] ?? 0);
            $sql = "
                SELECT
                    COUNT(*) AS total_count,
                    SUM(status = 'Present') AS present_count,
                    SUM(status = 'Late') AS late_count
                FROM tbl_attendance
                WHERE DATE(attended_at) = CURDATE()
            ";
            $params = [];
            if ($branchId > 0) {
                $sql .= " AND branch_id = ? ";
                $params[] = $branchId;
            }
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);
            $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
            $this->sendJSON([
                'success' => true,
                'summary' => [
                    'total' => (int) ($row['total_count'] ?? 0),
                    'present' => (int) ($row['present_count'] ?? 0),
                    'late' => (int) ($row['late_count'] ?? 0)
                ]
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function getDeskRecent()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $limit = (int) ($_GET['limit'] ?? 8);
        if ($limit < 1) $limit = 8;
        if ($limit > 50) $limit = 50;

        try {
            if (!$this->ensureAttendanceTable()) {
                $this->sendJSON(['error' => 'Attendance data is unavailable on this schema'], 400);
            }
            $branchId = (int) ($_GET['branch_id'] ?? 0);
            $sql = "
                SELECT
                    a.attendance_id,
                    a.attended_at,
                    a.status,
                    s.first_name,
                    s.last_name
                FROM tbl_attendance a
                INNER JOIN tbl_students s ON s.student_id = a.student_id
                WHERE DATE(a.attended_at) = CURDATE()
            ";
            $params = [];
            if ($branchId > 0) {
                $sql .= " AND a.branch_id = ? ";
                $params[] = $branchId;
            }
            $sql .= " ORDER BY a.attended_at DESC, a.attendance_id DESC LIMIT $limit ";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $this->sendJSON(['success' => true, 'scans' => $rows]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }
}

$api = new AttendanceApi($conn);
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get-summary':
        $api->getSummary();
        break;
    case 'get-student-attendance':
        $api->getStudentAttendance();
        break;
    case 'record':
        $api->record();
        break;
    case 'scan-qr':
    case 'record-attendance':
        $api->scanQr();
        break;
    case 'record-by-email':
        $api->recordByEmail();
        break;
    case 'desk-summary':
        $api->getDeskSummary();
        break;
    case 'desk-recent':
        $api->getDeskRecent();
        break;
    default:
        $api->sendJSON(['error' => 'Invalid action'], 400);
}

