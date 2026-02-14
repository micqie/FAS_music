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

    private function sendJSON($data, $status = 200)
    {
        http_response_code($status);
        echo json_encode($data);
        exit;
    }

    // Get all students for admin_students page
    public function getAllStudents()
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
                s.status,
                s.created_at,
                s.branch_id,
                b.branch_name
            FROM tbl_students s
            LEFT JOIN tbl_branches b ON s.branch_id = b.branch_id
            ORDER BY s.created_at DESC
        ");
        $stmt->execute();

        $this->sendJSON([
            'success'   => true,
            'students'  => $stmt->fetchAll(PDO::FETCH_ASSOC)
        ]);
    }

    // Get active students with session package info for admin_package page
    public function getActiveStudents()
    {
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
                WHERE s.status = 'Active' AND s.registration_status = 'Fee Paid'
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
                WHERE s.status = 'Active' AND s.registration_status = 'Fee Paid'
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
    case 'get-active-students':
        $studentsApi->getActiveStudents();
        break;
    case 'assign-package':
        $studentsApi->assignPackage();
        break;
    default:
        $studentsApi->sendJSON(['error' => 'Invalid action'], 400);
}

