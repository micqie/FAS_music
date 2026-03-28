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
        $this->ensureSessionRescheduleWorkflow();
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
        if (!preg_match('/^[A-Za-z0-9_]+$/', (string)$tableName)) {
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

    private function ensureSessionRescheduleWorkflow()
    {
        if (!$this->tableExists('tbl_sessions')) {
            return;
        }

        try {
            $this->conn->exec("
                ALTER TABLE tbl_sessions
                MODIFY COLUMN status ENUM('Scheduled','Completed','Cancelled','No Show','Late','cancelled_by_teacher','rescheduled')
                NOT NULL DEFAULT 'Scheduled'
            ");
        } catch (PDOException $e) {
            // Ignore enum differences.
        }

        $columns = [
            'rescheduled_from_session_id' => "ALTER TABLE tbl_sessions ADD COLUMN rescheduled_from_session_id INT NULL AFTER notes",
            'rescheduled_to_session_id' => "ALTER TABLE tbl_sessions ADD COLUMN rescheduled_to_session_id INT NULL AFTER rescheduled_from_session_id",
            'needs_rescheduling' => "ALTER TABLE tbl_sessions ADD COLUMN needs_rescheduling TINYINT(1) NOT NULL DEFAULT 0 AFTER rescheduled_to_session_id",
            'cancellation_reason' => "ALTER TABLE tbl_sessions ADD COLUMN cancellation_reason TEXT NULL AFTER needs_rescheduling",
            'cancelled_by_teacher_at' => "ALTER TABLE tbl_sessions ADD COLUMN cancelled_by_teacher_at DATETIME NULL AFTER cancellation_reason",
            'rescheduled_at' => "ALTER TABLE tbl_sessions ADD COLUMN rescheduled_at DATETIME NULL AFTER cancelled_by_teacher_at"
        ];
        foreach ($columns as $column => $sql) {
            try {
                if (!$this->tableHasColumn('tbl_sessions', $column)) {
                    $this->conn->exec($sql);
                }
            } catch (PDOException $e) {
                // Ignore per-column failures.
            }
        }
    }

    private function resolveTeacherId($teacherId, $userId)
    {
        $teacherId = (int)$teacherId;
        $userId = (int)$userId;
        if ($teacherId > 0) {
            return $teacherId;
        }
        if ($userId < 1 || !$this->tableExists('tbl_teachers')) {
            return 0;
        }

        try {
            $stmt = $this->conn->prepare("
                SELECT teacher_id
                FROM tbl_teachers
                WHERE user_id = ?
                LIMIT 1
            ");
            $stmt->execute([$userId]);
            return (int)($stmt->fetchColumn() ?: 0);
        } catch (PDOException $e) {
            return 0;
        }
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

    public function getTeacherSessions()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $teacherId = $this->resolveTeacherId((int)($_GET['teacher_id'] ?? 0), (int)($_GET['user_id'] ?? 0));
        $filter = strtolower(trim((string)($_GET['filter'] ?? 'all')));
        if ($teacherId < 1) {
            $this->sendJSON(['error' => 'teacher_id or user_id is required'], 400);
        }
        if (!$this->tableExists('tbl_sessions')) {
            $this->sendJSON(['success' => true, 'sessions' => []]);
        }

        try {
            $sql = "
                SELECT
                    ts.session_id,
                    ts.enrollment_id,
                    ts.session_number,
                    ts.session_date,
                    ts.start_time,
                    ts.end_time,
                    ts.status,
                    ts.notes,
                    ts.needs_rescheduling,
                    ts.cancellation_reason,
                    ts.cancelled_by_teacher_at,
                    ts.rescheduled_from_session_id,
                    ts.rescheduled_to_session_id,
                    s.student_id,
                    s.first_name AS student_first_name,
                    s.last_name AS student_last_name,
                    COALESCE(rm.room_name, NULLIF(TRIM(ts.notes), '')) AS room_name
                FROM tbl_sessions ts
                INNER JOIN tbl_enrollments e ON e.enrollment_id = ts.enrollment_id
                INNER JOIN tbl_students s ON s.student_id = e.student_id
                LEFT JOIN tbl_rooms rm ON rm.room_id = ts.room_id
                WHERE ts.teacher_id = ?
            ";
            $params = [$teacherId];

            if ($filter === 'today') {
                $sql .= " AND ts.session_date = CURDATE() ";
            } elseif ($filter === 'week') {
                $sql .= " AND ts.session_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) ";
            }

            $sql .= " ORDER BY ts.session_date ASC, ts.start_time ASC, ts.session_id ASC ";

            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);
            $this->sendJSON(['success' => true, 'sessions' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function getTeacherAvailability()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $teacherId = $this->resolveTeacherId((int)($_GET['teacher_id'] ?? 0), (int)($_GET['user_id'] ?? 0));
        if ($teacherId < 1) {
            $this->sendJSON(['error' => 'teacher_id or user_id is required'], 400);
        }
        if (!$this->tableExists('tbl_teacher_availability')) {
            $this->sendJSON(['success' => true, 'branch_id' => 0, 'availability' => []]);
        }

        try {
            $branchStmt = $this->conn->prepare("SELECT branch_id FROM tbl_teachers WHERE teacher_id = ? LIMIT 1");
            $branchStmt->execute([$teacherId]);
            $branchId = (int)($branchStmt->fetchColumn() ?: 0);

            $stmt = $this->conn->prepare("
                SELECT availability_id, teacher_id, branch_id, day_of_week, start_time, end_time, status
                FROM tbl_teacher_availability
                WHERE teacher_id = ?
                ORDER BY FIELD(day_of_week, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'),
                         start_time ASC,
                         availability_id ASC
            ");
            $stmt->execute([$teacherId]);

            $this->sendJSON([
                'success' => true,
                'branch_id' => $branchId,
                'availability' => $stmt->fetchAll(PDO::FETCH_ASSOC)
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function saveTeacherAvailability()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $teacherId = $this->resolveTeacherId((int)($data['teacher_id'] ?? 0), (int)($data['user_id'] ?? 0));
        $entries = is_array($data['availability'] ?? null) ? $data['availability'] : [];
        $validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        if ($teacherId < 1) {
            $this->sendJSON(['error' => 'teacher_id or user_id is required'], 400);
        }
        if (!$this->tableExists('tbl_teacher_availability')) {
            $this->sendJSON(['error' => 'tbl_teacher_availability table not found'], 500);
        }

        try {
            $teacherStmt = $this->conn->prepare("
                SELECT teacher_id, branch_id
                FROM tbl_teachers
                WHERE teacher_id = ?
                LIMIT 1
            ");
            $teacherStmt->execute([$teacherId]);
            $teacher = $teacherStmt->fetch(PDO::FETCH_ASSOC);
            if (!$teacher) {
                $this->sendJSON(['error' => 'Teacher not found'], 404);
            }

            $normalized = [];
            foreach ($entries as $entry) {
                $enabled = !empty($entry['enabled']);
                $day = trim((string)($entry['day_of_week'] ?? ''));
                $start = trim((string)($entry['start_time'] ?? ''));
                $end = trim((string)($entry['end_time'] ?? ''));

                if (!$enabled) {
                    continue;
                }
                if (!in_array($day, $validDays, true)) {
                    $this->sendJSON(['error' => "Invalid day: {$day}"], 400);
                }
                if (!preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $start) || !preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $end)) {
                    $this->sendJSON(['error' => "Invalid time format for {$day}"], 400);
                }
                $startTs = strtotime($start);
                $endTs = strtotime($end);
                if ($startTs === false || $endTs === false || $endTs <= $startTs) {
                    $this->sendJSON(['error' => "End time must be later than start time for {$day}"], 400);
                }

                $normalized[] = [
                    'day_of_week' => $day,
                    'start_time' => strlen($start) === 5 ? $start . ':00' : $start,
                    'end_time' => strlen($end) === 5 ? $end . ':00' : $end
                ];
            }

            $this->conn->beginTransaction();

            $deleteStmt = $this->conn->prepare("DELETE FROM tbl_teacher_availability WHERE teacher_id = ?");
            $deleteStmt->execute([$teacherId]);

            if (!empty($normalized)) {
                $insertStmt = $this->conn->prepare("
                    INSERT INTO tbl_teacher_availability (teacher_id, branch_id, day_of_week, start_time, end_time, status)
                    VALUES (?, ?, ?, ?, ?, 'Available')
                ");
                foreach ($normalized as $row) {
                    $insertStmt->execute([
                        $teacherId,
                        (int)($teacher['branch_id'] ?? 0),
                        $row['day_of_week'],
                        $row['start_time'],
                        $row['end_time']
                    ]);
                }
            }

            $this->conn->commit();
            $this->sendJSON(['success' => true, 'message' => 'Availability saved successfully']);
        } catch (PDOException $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function cancelSessionByTeacher()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $teacherId = $this->resolveTeacherId((int)($data['teacher_id'] ?? 0), (int)($data['user_id'] ?? 0));
        $sessionId = (int)($data['session_id'] ?? 0);
        $reason = trim((string)($data['reason'] ?? ''));

        if ($teacherId < 1 || $sessionId < 1) {
            $this->sendJSON(['error' => 'teacher_id/user_id and session_id are required'], 400);
        }

        try {
            $stmt = $this->conn->prepare("
                UPDATE tbl_sessions
                SET status = 'cancelled_by_teacher',
                    needs_rescheduling = 1,
                    cancellation_reason = ?,
                    cancelled_by_teacher_at = NOW(),
                    rescheduled_to_session_id = NULL
                WHERE session_id = ?
                  AND teacher_id = ?
                  AND status NOT IN ('Completed', 'cancelled_by_teacher')
            ");
            $stmt->execute([
                ($reason !== '' ? $reason : null),
                $sessionId,
                $teacherId
            ]);

            if ($stmt->rowCount() === 0) {
                $check = $this->conn->prepare("
                    SELECT session_id
                    FROM tbl_sessions
                    WHERE session_id = ?
                      AND teacher_id = ?
                    LIMIT 1
                ");
                $check->execute([$sessionId, $teacherId]);
                if (!$check->fetchColumn()) {
                    $this->sendJSON(['error' => 'Session not found for this teacher'], 404);
                }
                $this->sendJSON(['error' => 'Only upcoming non-completed sessions can be cancelled'], 400);
            }

            $this->sendJSON(['success' => true, 'message' => 'Session cancelled and queued for admin rescheduling.']);
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
    case 'get-teacher-sessions':
        $api->getTeacherSessions();
        break;
    case 'get-teacher-availability':
        $api->getTeacherAvailability();
        break;
    case 'save-teacher-availability':
        $api->saveTeacherAvailability();
        break;
    case 'cancel-session':
        $api->cancelSessionByTeacher();
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
