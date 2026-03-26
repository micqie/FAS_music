<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once 'db_connect.php';

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if (!isset($conn) || $conn === null) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

class TeachersApi
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

    private function branchExists($branchId)
    {
        $stmt = $this->conn->prepare("SELECT branch_id FROM tbl_branches WHERE branch_id = ? LIMIT 1");
        $stmt->execute([(int)$branchId]);
        return (bool)$stmt->fetchColumn();
    }

    private function normalizeSpecializationIds($rawValue)
    {
        $values = is_array($rawValue) ? $rawValue : [$rawValue];
        $ids = [];
        foreach ($values as $v) {
            $id = (int)$v;
            if ($id > 0) {
                $ids[] = $id;
            }
        }
        $ids = array_values(array_unique($ids));
        sort($ids);
        return $ids;
    }

    private function allSpecializationsExist($specializationIds)
    {
        $ids = $this->normalizeSpecializationIds($specializationIds);
        if (empty($ids)) {
            return false;
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $this->conn->prepare("SELECT COUNT(*) FROM tbl_specialization WHERE specialization_id IN ({$placeholders})");
        $stmt->execute($ids);
        return ((int)$stmt->fetchColumn()) === count($ids);
    }

    private function getTeacherRoleId()
    {
        $roleNames = ['Instructor', 'Teacher'];
        foreach ($roleNames as $roleName) {
            $stmt = $this->conn->prepare("SELECT role_id FROM tbl_roles WHERE role_name = ? LIMIT 1");
            $stmt->execute([$roleName]);
            $roleId = (int)$stmt->fetchColumn();
            if ($roleId > 0) {
                return $roleId;
            }
        }

        // Create Instructor role if it doesn't exist yet
        $insert = $this->conn->prepare("INSERT INTO tbl_roles (role_name) VALUES ('Instructor')");
        $insert->execute();
        return (int)$this->conn->lastInsertId();
    }

    private function userExists($username, $email)
    {
        $stmt = $this->conn->prepare("
            SELECT user_id
            FROM tbl_users
            WHERE username = ?
               OR (email IS NOT NULL AND email <> '' AND email = ?)
            LIMIT 1
        ");
        $stmt->execute([$username, $email]);
        return (int)$stmt->fetchColumn() > 0;
    }

    private function usernameExists($username)
    {
        $stmt = $this->conn->prepare("SELECT user_id FROM tbl_users WHERE username = ? LIMIT 1");
        $stmt->execute([$username]);
        return (int)$stmt->fetchColumn() > 0;
    }

    private function generateUsername($firstName, $lastName, $email)
    {
        if ($email !== '') {
            return $email;
        }
        $base = strtolower(preg_replace('/[^a-z0-9]+/i', '', $firstName . $lastName));
        if ($base === '') {
            $base = 'teacher';
        }
        $candidate = $base;
        $suffix = 1;
        while ($this->usernameExists($candidate)) {
            $candidate = $base . $suffix;
            $suffix++;
        }
        return $candidate;
    }

    public function getSpecializations()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        try {
            $stmt = $this->conn->query("
                SELECT specialization_id, specialization_name, status, created_at
                FROM tbl_specialization
                ORDER BY specialization_name ASC
            ");
            $this->sendJSON(['success' => true, 'specializations' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function addSpecialization()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $name = trim((string)($data['specialization_name'] ?? ''));
        $status = trim((string)($data['status'] ?? 'Active'));

        if ($name === '') {
            $this->sendJSON(['error' => 'specialization_name is required'], 400);
        }
        if (!in_array($status, ['Active', 'Inactive'], true)) {
            $this->sendJSON(['error' => 'Invalid status'], 400);
        }

        try {
            $check = $this->conn->prepare("SELECT specialization_id FROM tbl_specialization WHERE specialization_name = ? LIMIT 1");
            $check->execute([$name]);
            $existingId = (int)$check->fetchColumn();
            if ($existingId > 0) {
                $this->sendJSON(['success' => true, 'specialization_id' => $existingId, 'message' => 'Specialization already exists']);
            }

            $stmt = $this->conn->prepare("INSERT INTO tbl_specialization (specialization_name, status) VALUES (?, ?)");
            $stmt->execute([$name, $status]);

            $this->sendJSON(['success' => true, 'specialization_id' => (int)$this->conn->lastInsertId()]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function setSpecializationStatus()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $specializationId = (int)($data['specialization_id'] ?? 0);
        $status = trim((string)($data['status'] ?? 'Inactive'));

        if ($specializationId < 1) {
            $this->sendJSON(['error' => 'specialization_id is required'], 400);
        }
        if (!in_array($status, ['Active', 'Inactive'], true)) {
            $this->sendJSON(['error' => 'Invalid status'], 400);
        }

        try {
            $stmt = $this->conn->prepare("UPDATE tbl_specialization SET status = ? WHERE specialization_id = ?");
            $stmt->execute([$status, $specializationId]);
            if ($stmt->rowCount() === 0) {
                $check = $this->conn->prepare("SELECT specialization_id FROM tbl_specialization WHERE specialization_id = ? LIMIT 1");
                $check->execute([$specializationId]);
                if (!$check->fetchColumn()) {
                    $this->sendJSON(['error' => 'Specialization not found'], 404);
                }
            }
            $this->sendJSON(['success' => true]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function getTeachers()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $branchId = (int)($_GET['branch_id'] ?? 0);
        $status = trim((string)($_GET['status'] ?? ''));

        try {
            $sql = "
                SELECT
                    t.teacher_id,
                    t.user_id,
                    t.branch_id,
                    t.first_name,
                    t.last_name,
                    t.email,
                    t.phone,
                    t.employment_type,
                    t.status,
                    t.created_at,
                    COALESCE(b.branch_name, '') AS branch_name,
                    COALESCE(GROUP_CONCAT(DISTINCT s.specialization_name ORDER BY s.specialization_name SEPARATOR ', '), 'General') AS specialization,
                    COALESCE(GROUP_CONCAT(DISTINCT ts.specialization_id ORDER BY ts.specialization_id SEPARATOR ','), '') AS specialization_ids_csv
                FROM tbl_teachers t
                LEFT JOIN tbl_branches b ON b.branch_id = t.branch_id
                LEFT JOIN tbl_teacher_specializations ts ON ts.teacher_id = t.teacher_id
                LEFT JOIN tbl_specialization s ON s.specialization_id = ts.specialization_id
                WHERE 1=1
            ";
            $params = [];

            if ($branchId > 0) {
                $sql .= " AND t.branch_id = ? ";
                $params[] = $branchId;
            }
            if ($status !== '' && in_array($status, ['Active', 'Inactive'], true)) {
                $sql .= " AND t.status = ? ";
                $params[] = $status;
            }

            $sql .= " GROUP BY t.teacher_id ORDER BY t.status ASC, t.last_name ASC, t.first_name ASC, t.teacher_id ASC ";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $teachers = [];
            foreach ($rows as $r) {
                $csv = trim((string)($r['specialization_ids_csv'] ?? ''));
                $ids = [];
                if ($csv !== '') {
                    foreach (explode(',', $csv) as $piece) {
                        $v = (int)trim($piece);
                        if ($v > 0) {
                            $ids[] = $v;
                        }
                    }
                }
                $r['specialization_ids'] = array_values(array_unique($ids));
                unset($r['specialization_ids_csv']);
                $teachers[] = $r;
            }

            $this->sendJSON(['success' => true, 'teachers' => $teachers]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function addTeacher()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $firstName = trim((string)($data['first_name'] ?? ''));
        $lastName = trim((string)($data['last_name'] ?? ''));
        $branchId = (int)($data['branch_id'] ?? 0);
        $specializationIds = $this->normalizeSpecializationIds($data['specialization_ids'] ?? []);
        $email = trim((string)($data['email'] ?? ''));
        $phone = trim((string)($data['phone'] ?? ''));
        $employmentType = trim((string)($data['employment_type'] ?? 'Full-time'));
        $status = trim((string)($data['status'] ?? 'Active'));
        $userId = isset($data['user_id']) && (int)$data['user_id'] > 0 ? (int)$data['user_id'] : null;

        if ($firstName === '' || $lastName === '') {
            $this->sendJSON(['error' => 'First name and last name are required'], 400);
        }
        if ($branchId < 1 || !$this->branchExists($branchId)) {
            $this->sendJSON(['error' => 'Valid branch is required'], 400);
        }
        if (empty($specializationIds)) {
            $this->sendJSON(['error' => 'At least one specialization is required'], 400);
        }
        if (!$this->allSpecializationsExist($specializationIds)) {
            $this->sendJSON(['error' => 'One or more specialization values are invalid'], 400);
        }
        if (!in_array($employmentType, ['Full-time', 'Part-time', 'Contract'], true)) {
            $this->sendJSON(['error' => 'Invalid employment_type'], 400);
        }
        if (!in_array($status, ['Active', 'Inactive'], true)) {
            $this->sendJSON(['error' => 'Invalid status'], 400);
        }
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->sendJSON(['error' => 'Invalid email format'], 400);
        }

        try {
            $this->conn->beginTransaction();

            $createdUsername = null;
            $tempPassword = null;
            if ($userId === null) {
                $roleId = $this->getTeacherRoleId();
                $username = $this->generateUsername($firstName, $lastName, $email);
                if ($this->userExists($username, $email)) {
                    $this->conn->rollBack();
                    $this->sendJSON(['error' => 'User account already exists for this username or email'], 400);
                }

                $tempPassword = 'fasmusic@2020';
                $hashedPassword = password_hash($tempPassword, PASSWORD_DEFAULT);
                $userStatus = $status === 'Active' ? 'Active' : 'Inactive';

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
                    $firstName,
                    $lastName,
                    ($email !== '' ? $email : null),
                    ($phone !== '' ? $phone : null),
                    $userStatus
                ]);
                $userId = (int)$this->conn->lastInsertId();
                $createdUsername = $username;
            }

            $stmt = $this->conn->prepare("
                INSERT INTO tbl_teachers (
                    user_id, branch_id, first_name, last_name, email, phone, employment_type, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $userId,
                $branchId,
                $firstName,
                $lastName,
                ($email !== '' ? $email : null),
                ($phone !== '' ? $phone : null),
                $employmentType,
                $status
            ]);

            $teacherId = (int)$this->conn->lastInsertId();
            $stmtMap = $this->conn->prepare("
                INSERT INTO tbl_teacher_specializations (teacher_id, specialization_id)
                VALUES (?, ?)
            ");
            foreach ($specializationIds as $specId) {
                $stmtMap->execute([$teacherId, $specId]);
            }

            $this->conn->commit();
            $this->sendJSON([
                'success' => true,
                'teacher_id' => $teacherId,
                'user_id' => $userId,
                'username' => $createdUsername,
                'temp_password' => $tempPassword
            ]);
        } catch (PDOException $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function updateTeacher()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $teacherId = (int)($data['teacher_id'] ?? 0);
        $firstName = trim((string)($data['first_name'] ?? ''));
        $lastName = trim((string)($data['last_name'] ?? ''));
        $branchId = (int)($data['branch_id'] ?? 0);
        $specializationIds = $this->normalizeSpecializationIds($data['specialization_ids'] ?? []);
        $email = trim((string)($data['email'] ?? ''));
        $phone = trim((string)($data['phone'] ?? ''));
        $employmentType = trim((string)($data['employment_type'] ?? 'Full-time'));
        $status = trim((string)($data['status'] ?? 'Active'));
        $userId = isset($data['user_id']) && (int)$data['user_id'] > 0 ? (int)$data['user_id'] : null;

        if ($teacherId < 1) {
            $this->sendJSON(['error' => 'teacher_id is required'], 400);
        }
        if ($firstName === '' || $lastName === '') {
            $this->sendJSON(['error' => 'First name and last name are required'], 400);
        }
        if ($branchId < 1 || !$this->branchExists($branchId)) {
            $this->sendJSON(['error' => 'Valid branch is required'], 400);
        }
        if (empty($specializationIds)) {
            $this->sendJSON(['error' => 'At least one specialization is required'], 400);
        }
        if (!$this->allSpecializationsExist($specializationIds)) {
            $this->sendJSON(['error' => 'One or more specialization values are invalid'], 400);
        }
        if (!in_array($employmentType, ['Full-time', 'Part-time', 'Contract'], true)) {
            $this->sendJSON(['error' => 'Invalid employment_type'], 400);
        }
        if (!in_array($status, ['Active', 'Inactive'], true)) {
            $this->sendJSON(['error' => 'Invalid status'], 400);
        }
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->sendJSON(['error' => 'Invalid email format'], 400);
        }

        try {
            $this->conn->beginTransaction();

            $stmt = $this->conn->prepare("
                UPDATE tbl_teachers
                SET user_id = ?, branch_id = ?, first_name = ?, last_name = ?,
                    email = ?, phone = ?, employment_type = ?, status = ?
                WHERE teacher_id = ?
            ");
            $stmt->execute([
                $userId,
                $branchId,
                $firstName,
                $lastName,
                ($email !== '' ? $email : null),
                ($phone !== '' ? $phone : null),
                $employmentType,
                $status,
                $teacherId
            ]);

            if ($stmt->rowCount() === 0) {
                $check = $this->conn->prepare("SELECT teacher_id FROM tbl_teachers WHERE teacher_id = ? LIMIT 1");
                $check->execute([$teacherId]);
                if (!$check->fetchColumn()) {
                    $this->conn->rollBack();
                    $this->sendJSON(['error' => 'Teacher not found'], 404);
                }
            }

            $stmtDeleteMap = $this->conn->prepare("DELETE FROM tbl_teacher_specializations WHERE teacher_id = ?");
            $stmtDeleteMap->execute([$teacherId]);

            $stmtMap = $this->conn->prepare("
                INSERT INTO tbl_teacher_specializations (teacher_id, specialization_id)
                VALUES (?, ?)
            ");
            foreach ($specializationIds as $specId) {
                $stmtMap->execute([$teacherId, $specId]);
            }

            $this->conn->commit();
            $this->sendJSON(['success' => true]);
        } catch (PDOException $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function setTeacherStatus()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $teacherId = (int)($data['teacher_id'] ?? 0);
        $status = trim((string)($data['status'] ?? 'Inactive'));

        if ($teacherId < 1) {
            $this->sendJSON(['error' => 'teacher_id is required'], 400);
        }
        if (!in_array($status, ['Active', 'Inactive'], true)) {
            $this->sendJSON(['error' => 'Invalid status'], 400);
        }

        try {
            $stmt = $this->conn->prepare("UPDATE tbl_teachers SET status = ? WHERE teacher_id = ?");
            $stmt->execute([$status, $teacherId]);
            if ($stmt->rowCount() === 0) {
                $check = $this->conn->prepare("SELECT teacher_id FROM tbl_teachers WHERE teacher_id = ? LIMIT 1");
                $check->execute([$teacherId]);
                if (!$check->fetchColumn()) {
                    $this->sendJSON(['error' => 'Teacher not found'], 404);
                }
            }
            $this->sendJSON(['success' => true]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }
}

$api = new TeachersApi($conn);
$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $action = $input['action'] ?? $action;
}

switch ($action) {
    case 'get-specializations':
        $api->getSpecializations();
        break;
    case 'add-specialization':
        $api->addSpecialization();
        break;
    case 'set-specialization-status':
        $api->setSpecializationStatus();
        break;
    case 'get-teachers':
    case '':
        $api->getTeachers();
        break;
    case 'add-teacher':
        $api->addTeacher();
        break;
    case 'update-teacher':
        $api->updateTeacher();
        break;
    case 'set-teacher-status':
        $api->setTeacherStatus();
        break;
    default:
        $api->sendJSON(['error' => 'Invalid action'], 400);
}
?>
