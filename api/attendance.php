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
        $this->ensureTables();
    }

    public function sendJSON($data, $status = 200)
    {
        http_response_code($status);
        echo json_encode($data);
        exit;
    }

    private function ensureTables()
    {
        try {
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS tbl_attendance (
                    attendance_id INT AUTO_INCREMENT PRIMARY KEY,
                    student_id INT NOT NULL,
                    attended_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    source VARCHAR(30) NULL,
                    notes VARCHAR(255) NULL,
                    status ENUM('Present','Absent','Late','Excused') NOT NULL DEFAULT 'Present'
                )
            ");
            try { $this->conn->exec("CREATE INDEX idx_attendance_student ON tbl_attendance(student_id)"); } catch (PDOException $e) {}
            try { $this->conn->exec("CREATE INDEX idx_attendance_date ON tbl_attendance(attended_at)"); } catch (PDOException $e) {}
        } catch (PDOException $e) {
            // Do not break API if schema fails
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
            $stmt = $this->conn->prepare("
                SELECT attendance_id, student_id, attended_at, source, notes, status
                FROM tbl_attendance
                WHERE student_id = ?
                ORDER BY attended_at DESC, attendance_id DESC
                LIMIT $limit
            ");
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
    default:
        $api->sendJSON(['error' => 'Invalid action'], 400);
}

