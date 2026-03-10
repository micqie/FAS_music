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
                $stmt = $this->conn->prepare("
                    SELECT
                        ts.session_id AS attendance_id,
                        te.student_id,
                        TIMESTAMP(ts.session_date, COALESCE(ts.start_time, '00:00:00')) AS attended_at,
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
                    WHERE te.student_id = ?
                    ORDER BY ts.session_date DESC, ts.session_id DESC
                    LIMIT $limit
                ");
            } else {
                $stmt = $this->conn->prepare("
                    SELECT attendance_id, student_id, attended_at, source, notes, status
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
            if (!$this->tableExists('tbl_attendance')) {
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
        if ($studentId < 1 || $email === '') return null;
        return ['student_id' => $studentId, 'email' => $email];
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

        try {
            $stmt = $this->conn->prepare("SELECT student_id, first_name, last_name, email FROM tbl_students WHERE student_id = ? LIMIT 1");
            $stmt->execute([$studentId]);
            $student = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$student || strcasecmp(trim($student['email'] ?? ''), $email) !== 0) {
                $this->sendJSON(['error' => 'Student not found for this QR'], 404);
            }

            if (!$this->tableExists('tbl_attendance')) {
                $this->sendJSON(['error' => 'Attendance write endpoint is unavailable on this schema'], 400);
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
                        'email' => $student['email']
                    ]
                ]);
            }

            $status = 'Present';
            $source = 'QR';
            $stmt = $this->conn->prepare("
                INSERT INTO tbl_attendance (student_id, status, source, notes)
                VALUES (?, ?, ?, ?)
            ");
            $stmt->execute([$studentId, $status, $source, null]);

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
                    'email' => $student['email']
                ]
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function getDeskSummary()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        try {
            if (!$this->tableExists('tbl_attendance')) {
                $this->sendJSON(['error' => 'Attendance data is unavailable on this schema'], 400);
            }

            $stmt = $this->conn->prepare("
                SELECT
                    COUNT(*) AS total_count,
                    SUM(status = 'Present') AS present_count,
                    SUM(status = 'Late') AS late_count
                FROM tbl_attendance
                WHERE DATE(attended_at) = CURDATE()
            ");
            $stmt->execute();
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
            if (!$this->tableExists('tbl_attendance')) {
                $this->sendJSON(['error' => 'Attendance data is unavailable on this schema'], 400);
            }
            $stmt = $this->conn->prepare("
                SELECT
                    a.attendance_id,
                    a.attended_at,
                    a.status,
                    s.first_name,
                    s.last_name
                FROM tbl_attendance a
                INNER JOIN tbl_students s ON s.student_id = a.student_id
                WHERE DATE(a.attended_at) = CURDATE()
                ORDER BY a.attended_at DESC, a.attendance_id DESC
                LIMIT $limit
            ");
            $stmt->execute();
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
        $api->scanQr();
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

