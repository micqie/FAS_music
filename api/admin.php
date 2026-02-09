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
}
