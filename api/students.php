<?php
require_once 'db_connect.php';

header("Content-Type: application/json");

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
}

$studentsApi = new StudentsApi($conn);
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get-all-students':
        $studentsApi->getAllStudents();
        break;
    default:
        $studentsApi->sendJSON(['error' => 'Invalid action'], 400);
}

