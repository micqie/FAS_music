<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

if (!ini_get('date.timezone') || ini_get('date.timezone') === 'UTC') {
    date_default_timezone_set('Asia/Manila');
}

require_once 'db_connect.php';
require_once 'instrument_specialization_sync.php';
require_once 'auth_session.php';
require_once 'xss_protection.php';  // XSS Protection utilities

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Send security headers
XSSProtection::sendSecurityHeaders();

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
    private $lastMailError = null;

    public function __construct($pdo)
    {
        $this->conn = $pdo;
        $this->ensureTeacherSchema();
    }

    private function ensureTeacherSchema()
    {
        ensure_specialization_instrument_link($this->conn);
        $this->ensureSessionRescheduleWorkflow();
        $this->ensureStudentProgressTable();
        $this->ensureLearningProgressWorkflow();
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
            $resolvedTeacherId = (int)($stmt->fetchColumn() ?: 0);
            if ($resolvedTeacherId > 0) {
                return $resolvedTeacherId;
            }

            // Fallback for legacy rows where tbl_teachers.user_id was never linked.
            $userStmt = $this->conn->prepare("
                SELECT user_id, first_name, last_name, email, username
                FROM tbl_users
                WHERE user_id = ?
                LIMIT 1
            ");
            $userStmt->execute([$userId]);
            $user = $userStmt->fetch(PDO::FETCH_ASSOC);
            if (!$user) {
                return 0;
            }

            $email = trim((string)($user['email'] ?? ''));
            $username = trim((string)($user['username'] ?? ''));
            $firstName = trim((string)($user['first_name'] ?? ''));
            $lastName = trim((string)($user['last_name'] ?? ''));

            if ($email !== '' || $username !== '') {
                $byEmail = $this->conn->prepare("
                    SELECT teacher_id
                    FROM tbl_teachers
                    WHERE (
                            email IS NOT NULL
                        AND email <> ''
                        AND (
                            LOWER(TRIM(email)) = LOWER(?)
                            OR LOWER(TRIM(email)) = LOWER(?)
                        )
                    )
                    ORDER BY teacher_id ASC
                    LIMIT 1
                ");
                $byEmail->execute([$email, $username]);
                $resolvedTeacherId = (int)($byEmail->fetchColumn() ?: 0);
            }

            if ($resolvedTeacherId < 1 && $firstName !== '' && $lastName !== '') {
                $byName = $this->conn->prepare("
                    SELECT teacher_id
                    FROM tbl_teachers
                    WHERE LOWER(TRIM(first_name)) = LOWER(?)
                      AND LOWER(TRIM(last_name)) = LOWER(?)
                    ORDER BY teacher_id ASC
                    LIMIT 1
                ");
                $byName->execute([$firstName, $lastName]);
                $resolvedTeacherId = (int)($byName->fetchColumn() ?: 0);
            }

            if ($resolvedTeacherId > 0) {
                $linkStmt = $this->conn->prepare("
                    UPDATE tbl_teachers
                    SET user_id = ?
                    WHERE teacher_id = ?
                      AND (user_id IS NULL OR user_id = 0)
                ");
                $linkStmt->execute([$userId, $resolvedTeacherId]);
            }

            return $resolvedTeacherId;
        } catch (PDOException $e) {
            return 0;
        }
    }

    private function normalizeRoleName($roleName)
    {
        return strtolower(trim((string)$roleName));
    }

    private function resolveUserContext($userId)
    {
        $userId = (int)$userId;
        if ($userId < 1 || !$this->tableExists('tbl_users') || !$this->tableExists('tbl_roles')) {
            return null;
        }

        try {
            $stmt = $this->conn->prepare("
                SELECT u.user_id, u.branch_id, u.status, r.role_name
                FROM tbl_users u
                LEFT JOIN tbl_roles r ON r.role_id = u.role_id
                WHERE u.user_id = ?
                LIMIT 1
            ");
            $stmt->execute([$userId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$user) {
                return null;
            }

            return [
                'user_id' => (int)($user['user_id'] ?? 0),
                'branch_id' => (int)($user['branch_id'] ?? 0),
                'status' => (string)($user['status'] ?? ''),
                'role_name' => (string)($user['role_name'] ?? '')
            ];
        } catch (PDOException $e) {
            return null;
        }
    }

    private function isManagerRole($roleName)
    {
        return in_array($this->normalizeRoleName($roleName), ['manager', 'branch manager'], true);
    }

    private function isStaffSchedulerRole($roleName)
    {
        return in_array($this->normalizeRoleName($roleName), [
            'admin',
            'staff',
            'desk',
            'front desk',
            'manager',
            'branch manager'
        ], true);
    }

    private function ensureStudentProgressTable()
    {
        try {
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS tbl_student_progress (
                    progress_id INT AUTO_INCREMENT PRIMARY KEY,
                    student_id INT NOT NULL,
                    session_id INT NOT NULL,
                    instrument_id INT NOT NULL,
                    skill_level VARCHAR(50) DEFAULT NULL,
                    remarks TEXT DEFAULT NULL,
                    assessment_date DATE DEFAULT CURRENT_DATE,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            ");
        } catch (PDOException $e) {
            return;
        }

        $columns = [
            'performance_score' => "ALTER TABLE tbl_student_progress ADD COLUMN performance_score TINYINT UNSIGNED NULL AFTER skill_level",
            'technique_score' => "ALTER TABLE tbl_student_progress ADD COLUMN technique_score TINYINT UNSIGNED NULL AFTER performance_score",
            'rhythm_score' => "ALTER TABLE tbl_student_progress ADD COLUMN rhythm_score TINYINT UNSIGNED NULL AFTER technique_score",
            'focus_score' => "ALTER TABLE tbl_student_progress ADD COLUMN focus_score TINYINT UNSIGNED NULL AFTER rhythm_score",
            'assignment_score' => "ALTER TABLE tbl_student_progress ADD COLUMN assignment_score TINYINT UNSIGNED NULL AFTER focus_score",
            'criteria_scores' => "ALTER TABLE tbl_student_progress ADD COLUMN criteria_scores TEXT NULL AFTER assignment_score",
            'updated_at' => "ALTER TABLE tbl_student_progress ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at"
        ];

        foreach ($columns as $column => $sql) {
            try {
                if (!$this->tableHasColumn('tbl_student_progress', $column)) {
                    $this->conn->exec($sql);
                }
            } catch (PDOException $e) {
                // Ignore per-column failures so the rest of the API can still work.
            }
        }

        try { $this->conn->exec("CREATE INDEX idx_student_progress_session ON tbl_student_progress(session_id)"); } catch (PDOException $e) {}
        try { $this->conn->exec("CREATE INDEX idx_student_progress_student ON tbl_student_progress(student_id)"); } catch (PDOException $e) {}

        try {
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS tbl_teacher_grading_criteria (
                    criterion_id INT AUTO_INCREMENT PRIMARY KEY,
                    teacher_id INT NOT NULL,
                    criterion_name VARCHAR(100) NOT NULL,
                    sort_order INT NOT NULL DEFAULT 0,
                    status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_teacher_grading_criteria (teacher_id, status, sort_order)
                )
            ");
        } catch (PDOException $e) {}
    }

    private function decodeCriteriaScores($value)
    {
        if (is_array($value)) return $value;
        $decoded = json_decode((string)$value, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function normalizeCriteriaScores($value)
    {
        $items = $this->decodeCriteriaScores($value);
        if (count($items) < 1 || count($items) > 20) {
            return [];
        }
        $normalized = [];
        foreach ($items as $item) {
            $name = trim((string)($item['name'] ?? ''));
            $score = $this->normalizeProgressScore($item['score'] ?? null);
            if ($name === '' || mb_strlen($name) > 100 || $score === null) return [];
            $normalized[] = ['name' => $name, 'score' => $score];
        }
        return $normalized;
    }

    public function getTeacherGradingCriteria()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->sendJSON(['error' => 'Method not allowed'], 405);
        $teacherId = $this->resolveLearningWorkflowTeacherId((int)($_GET['teacher_id'] ?? 0), (int)($_GET['user_id'] ?? 0));
        if ($teacherId < 1) $this->sendJSON(['error' => 'Instructor account not found'], 404);
        try {
            $stmt = $this->conn->prepare("SELECT criterion_name FROM tbl_teacher_grading_criteria WHERE teacher_id=? AND status='Active' ORDER BY sort_order, criterion_id");
            $stmt->execute([$teacherId]);
            $criteria = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
            $customized = !empty($criteria);
            if (!$criteria) $criteria = ['Performance','Technique','Rhythm & Timing','Focus & Discipline','Assignment & Practice'];
            $this->sendJSON(['success' => true, 'criteria' => $criteria, 'customized' => $customized]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function saveTeacherGradingCriteria()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->sendJSON(['error' => 'Method not allowed'], 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $teacherId = $this->resolveLearningWorkflowTeacherId((int)($data['teacher_id'] ?? 0), (int)($data['user_id'] ?? 0));
        $criteria = array_values(array_filter(array_map(function ($name) {
            return trim((string)$name);
        }, is_array($data['criteria'] ?? null) ? $data['criteria'] : []), function ($name) {
            return $name !== '';
        }));
        if ($teacherId < 1) $this->sendJSON(['error' => 'Instructor account not found'], 404);
        if (count($criteria) < 1 || count($criteria) > 20) $this->sendJSON(['error' => 'Use between 1 and 20 grading criteria'], 400);
        foreach ($criteria as $name) if (mb_strlen($name) > 100) $this->sendJSON(['error' => 'Criterion names may contain up to 100 characters'], 400);
        $uniqueCriteria = array_unique(array_map(function ($name) { return mb_strtolower($name); }, $criteria));
        if (count($uniqueCriteria) !== count($criteria)) $this->sendJSON(['error' => 'Each grading criterion must have a unique name'], 400);
        try {
            $this->conn->beginTransaction();
            $this->conn->prepare("DELETE FROM tbl_teacher_grading_criteria WHERE teacher_id=?")->execute([$teacherId]);
            $insert = $this->conn->prepare("INSERT INTO tbl_teacher_grading_criteria (teacher_id,criterion_name,sort_order,status) VALUES (?,?,?,'Active')");
            foreach ($criteria as $index => $name) $insert->execute([$teacherId, $name, $index]);
            $this->conn->commit();
            $this->sendJSON(['success' => true, 'criteria' => $criteria, 'message' => 'Grading criteria saved.']);
        } catch (PDOException $e) {
            if ($this->conn->inTransaction()) $this->conn->rollBack();
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    private function resolveLearningWorkflowTeacherId($teacherId, $userId)
    {
        $authenticatedUser = fas_require_authenticated_user($this->conn, ['instructor']);
        $roleCategory = fas_normalize_role_category($authenticatedUser['role_name'] ?? '');

        // Instructors may only manage their own assigned students. Admin users
        // retain their existing API oversight behavior.
        if ($roleCategory === 'instructor') {
            return $this->resolveTeacherId(0, (int)($authenticatedUser['user_id'] ?? 0));
        }

        return $this->resolveTeacherId($teacherId, $userId);
    }

    private function ensureLearningProgressWorkflow()
    {
        try {
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS tbl_student_learning_levels (
                    learning_level_id INT AUTO_INCREMENT PRIMARY KEY,
                    student_id INT NOT NULL,
                    instrument_id INT NOT NULL,
                    teacher_id INT NULL,
                    level_name VARCHAR(100) NOT NULL,
                    book_material VARCHAR(255) NULL,
                    current_topic VARCHAR(255) NULL,
                    instructor_notes TEXT NULL,
                    skills_developing TEXT NULL,
                    areas_for_improvement TEXT NULL,
                    assessment_readiness ENUM('Not Ready','Developing','Improving','Ready for Assessment') NOT NULL DEFAULT 'Not Ready',
                    status ENUM('In Progress','Achieved') NOT NULL DEFAULT 'In Progress',
                    started_at DATE NOT NULL,
                    achieved_at DATE NULL,
                    achieved_exam_id INT NULL,
                    previous_learning_level_id INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            ");
            try { $this->conn->exec("CREATE INDEX idx_learning_levels_student_instrument ON tbl_student_learning_levels(student_id, instrument_id, status)"); } catch (PDOException $e) {}

            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS tbl_promotional_exams (
                    exam_id INT AUTO_INCREMENT PRIMARY KEY,
                    student_id INT NOT NULL,
                    instrument_id INT NOT NULL,
                    learning_level_id INT NOT NULL,
                    teacher_id INT NOT NULL,
                    assessed_level VARCHAR(100) NOT NULL,
                    exam_date DATE NOT NULL,
                    grade_rating VARCHAR(100) NULL,
                    result ENUM('Pending','Passed','Retake') NOT NULL DEFAULT 'Pending',
                    examiner_notes TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            ");
            $examColumns = [
                'learning_level_id' => "ALTER TABLE tbl_promotional_exams ADD COLUMN learning_level_id INT NULL AFTER instrument_id",
                'teacher_id' => "ALTER TABLE tbl_promotional_exams ADD COLUMN teacher_id INT NULL AFTER learning_level_id",
                'grade_rating' => "ALTER TABLE tbl_promotional_exams ADD COLUMN grade_rating VARCHAR(100) NULL AFTER exam_date"
            ];
            foreach ($examColumns as $column => $sql) {
                if (!$this->tableHasColumn('tbl_promotional_exams', $column)) $this->conn->exec($sql);
            }
            try { $this->conn->exec("ALTER TABLE tbl_promotional_exams MODIFY result ENUM('Pending','Passed','Failed','Retake') NOT NULL DEFAULT 'Pending'"); } catch (PDOException $e) {}
            try { $this->conn->exec("UPDATE tbl_promotional_exams SET result = 'Retake' WHERE result = 'Failed'"); } catch (PDOException $e) {}
            try { $this->conn->exec("ALTER TABLE tbl_promotional_exams MODIFY result ENUM('Pending','Passed','Retake') NOT NULL DEFAULT 'Pending'"); } catch (PDOException $e) {}

            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS tbl_student_certificates (
                    certificate_id INT AUTO_INCREMENT PRIMARY KEY,
                    student_id INT NOT NULL,
                    promotional_exam_id INT NOT NULL,
                    learning_level_id INT NULL,
                    instrument_id INT NOT NULL,
                    achieved_level VARCHAR(100) NOT NULL,
                    certificate_number VARCHAR(100) NULL,
                    issued_at DATE NOT NULL,
                    issued_by INT NULL,
                    status ENUM('Issued','Revoked') NOT NULL DEFAULT 'Issued',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ");
            if (!$this->tableHasColumn('tbl_student_certificates', 'learning_level_id')) {
                $this->conn->exec("ALTER TABLE tbl_student_certificates ADD COLUMN learning_level_id INT NULL AFTER promotional_exam_id");
            }

            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS tbl_learning_materials (
                    material_id INT AUTO_INCREMENT PRIMARY KEY,
                    instrument_type VARCHAR(100) NOT NULL,
                    level_name VARCHAR(100) NOT NULL,
                    material_name VARCHAR(255) NOT NULL,
                    description TEXT NULL,
                    file_path VARCHAR(500) NULL,
                    original_filename VARCHAR(255) NULL,
                    status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_learning_material (instrument_type, level_name, material_name),
                    INDEX idx_learning_material_lookup (instrument_type, level_name, status)
                )
            ");
            $materialColumns = [
                'description' => "ALTER TABLE tbl_learning_materials ADD COLUMN description TEXT NULL AFTER material_name",
                'file_path' => "ALTER TABLE tbl_learning_materials ADD COLUMN file_path VARCHAR(500) NULL AFTER description",
                'original_filename' => "ALTER TABLE tbl_learning_materials ADD COLUMN original_filename VARCHAR(255) NULL AFTER file_path",
                'updated_at' => "ALTER TABLE tbl_learning_materials ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at"
            ];
            foreach ($materialColumns as $column => $sql) {
                if (!$this->tableHasColumn('tbl_learning_materials', $column)) $this->conn->exec($sql);
            }
            $this->conn->exec("
                INSERT IGNORE INTO tbl_learning_materials (instrument_type,level_name,material_name) VALUES
                ('Piano','Level 1','John Thompson Book 1'),('Piano','Level 2','John Thompson Book 2'),('Piano','Level 1','Alfred Basic Piano Library Book 1A'),
                ('Guitar','Level 1','Hal Leonard Guitar Method Book 1'),('Guitar','Level 2','Hal Leonard Guitar Method Book 2'),
                ('Bass Guitar','Level 1','Hal Leonard Bass Method Book 1'),('Bass Guitar','Level 2','Hal Leonard Bass Method Book 2'),
                ('Ukulele','Level 1','Hal Leonard Ukulele Method Book 1'),('Ukulele','Level 2','Hal Leonard Ukulele Method Book 2'),
                ('Violin','Level 1','Essential Elements for Strings Book 1'),('Violin','Level 2','Essential Elements for Strings Book 2'),
                ('Voice','Level 1','Contemporary Voice Foundations'),('Voice','Level 2','Intermediate Vocal Technique'),
                ('Drums','Level 1','Alfred Drum Method Book 1'),('Drums','Level 2','Alfred Drum Method Book 2'),
                ('General','Level 1','Academy Level 1 Learning Guide'),('General','Level 2','Academy Level 2 Learning Guide'),
                ('General','Level 3','Academy Level 3 Learning Guide'),('General','Level 4','Academy Level 4 Learning Guide'),
                ('General','Level 5','Academy Level 5 Learning Guide'),('General','Level 6','Academy Level 6 Learning Guide'),
                ('General','Level 7','Academy Level 7 Learning Guide'),('General','Level 8','Academy Level 8 Learning Guide'),
                ('General','Level 9','Academy Level 9 Learning Guide'),('General','Level 10','Academy Level 10 Learning Guide')
            ");
        } catch (PDOException $e) {
            // Keep existing teacher features usable if migration permissions are restricted.
        }
    }

    private function normalizeProgressSkillLevel($value)
    {
        $raw = trim((string)$value);
        if ($raw === '') return '';
        // Keep accepting the legacy evaluation labels while supporting the
        // current instructor grading UI's overall-level choices.
        $allowed = [
            'Beginner', 'Developing', 'Proficient', 'Advanced',
            'Needs Improvement', 'Good', 'Very Good', 'Excellent'
        ];
        foreach ($allowed as $item) {
            if (strcasecmp($raw, $item) === 0) {
                return $item;
            }
        }
        return '';
    }

    private function normalizeProgressScore($value)
    {
        if ($value === '' || $value === null) {
            return null;
        }
        $score = (int)$value;
        if ($score < 1 || $score > 5) {
            return null;
        }
        return $score;
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

    private function validateStrongPassword($password)
    {
        $password = (string)$password;
        if (strlen($password) < 8) {
            $this->sendJSON(['error' => 'New password must be at least 8 characters long'], 400);
        }
        if (!preg_match('/[A-Z]/', $password)) {
            $this->sendJSON(['error' => 'New password must contain at least one uppercase letter'], 400);
        }
        if (!preg_match('/[a-z]/', $password)) {
            $this->sendJSON(['error' => 'New password must contain at least one lowercase letter'], 400);
        }
        if (!preg_match('/[0-9]/', $password)) {
            $this->sendJSON(['error' => 'New password must contain at least one number'], 400);
        }
        if (!preg_match('/[!@#$%^&*]/', $password)) {
            $this->sendJSON(['error' => 'New password must contain at least one special character (!@#$%^&*)'], 400);
        }
    }

    private function isWalkInSystemEmail($email)
    {
        return preg_match('/@fas\.com$/i', trim((string) $email)) === 1;
    }

    private function sanitizeTeacherLoginBase($value, $fallbackParts = [])
    {
        $raw = trim((string) $value);
        if ($raw === '') {
            $fallback = '';
            foreach ((array) $fallbackParts as $part) {
                $part = trim((string) $part);
                if ($part === '') {
                    continue;
                }
                $fallback = $fallback === '' ? $part : ($fallback . ' ' . $part);
            }
            $raw = $fallback;
        }

        if (strpos($raw, '@') !== false) {
            $raw = substr($raw, 0, strpos($raw, '@'));
        }

        $raw = strtolower($raw);
        $raw = preg_replace('/[^a-z0-9]+/', '.', $raw);
        $raw = trim($raw, '.');
        return $raw !== '' ? $raw : 'teacher';
    }

    private function teacherSystemEmailExists($email)
    {
        $stmt = $this->conn->prepare('SELECT 1 FROM tbl_users WHERE username = ? OR email = ? LIMIT 1');
        $stmt->execute([$email, $email]);
        if ($stmt->fetchColumn()) {
            return true;
        }

        $stmt = $this->conn->prepare('SELECT 1 FROM tbl_teachers WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        return (bool) $stmt->fetchColumn();
    }

    private function buildTeacherSystemEmail($input, $firstName = '', $lastName = '')
    {
        $base = $this->sanitizeTeacherLoginBase($input, [$firstName, $lastName]);
        $email = $base . '@fas.com';
        if ($this->teacherSystemEmailExists($email)) {
            return null;
        }
        return $email;
    }

    private function resolveTeacherAccountMode($accountMode, $email)
    {
        $accountMode = strtolower(trim((string) $accountMode));
        if (in_array($accountMode, ['real_email', 'system_account'], true)) {
            return $accountMode;
        }
        if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) && !$this->isWalkInSystemEmail($email)) {
            return 'real_email';
        }
        return 'system_account';
    }

    private function resolveTeacherAccountCredentials($firstName, $lastName, $email, $accountMode, $systemLoginName = '')
    {
        $accountMode = $this->resolveTeacherAccountMode($accountMode, $email);

        if ($accountMode === 'real_email') {
            if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $this->sendJSON(['error' => 'A valid email address is required for a real email account'], 400);
            }
            if ($this->isWalkInSystemEmail($email)) {
                $this->sendJSON(['error' => 'Use the system account option for @fas.com logins'], 400);
            }
            return [
                'username' => $email,
                'email' => $email,
                'account_mode' => 'real_email',
                'send_email' => true,
            ];
        }

        $loginEmail = $this->buildTeacherSystemEmail($systemLoginName, $firstName, $lastName);
        if ($loginEmail === null) {
            $this->sendJSON(['error' => 'That login name is already in use. Please choose another name.'], 400);
        }

        return [
            'username' => $loginEmail,
            'email' => $loginEmail,
            'account_mode' => 'system_account',
            'send_email' => false,
        ];
    }

    private function ensurePhpMailerLoaded()
    {
        static $loaded = false;
        if ($loaded) {
            return;
        }
        require_once dirname(__DIR__) . '/phpmailer/src/Exception.php';
        require_once dirname(__DIR__) . '/phpmailer/src/PHPMailer.php';
        require_once dirname(__DIR__) . '/phpmailer/src/SMTP.php';
        $loaded = true;
    }

    private function isValidEmailAddress($email)
    {
        return filter_var(trim((string) $email), FILTER_VALIDATE_EMAIL) !== false;
    }

    private function isPlaceholderMailHost($host)
    {
        $host = strtolower(trim((string) $host));
        if ($host === '') {
            return true;
        }
        $placeholders = ['smtp.example.com', 'example.com', 'localhost', '127.0.0.1'];
        return in_array($host, $placeholders, true);
    }

    private function getMailSettings()
    {
        $env = static function ($key, $default = '') {
            $value = getenv($key);
            if ($value === false || $value === null || $value === '') {
                $value = $_ENV[$key] ?? $_SERVER[$key] ?? $default;
            }
            return is_string($value) ? trim($value) : $default;
        };

        $fileConfig = [];
        $mailConfigPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'mail_config.php';
        if (is_file($mailConfigPath)) {
            $loadedConfig = include $mailConfigPath;
            if (is_array($loadedConfig)) {
                $fileConfig = $loadedConfig;
            }
        }

        $fileValue = static function ($key, $default = '') use ($fileConfig) {
            $value = $fileConfig[$key] ?? $default;
            return is_string($value) ? trim($value) : $value;
        };

        $username = $fileValue('MAIL_USERNAME', $env('MAIL_USERNAME', ''));
        $fromAddress = $fileValue('MAIL_FROM_ADDRESS', $env('MAIL_FROM_ADDRESS', ''));
        if (!$this->isValidEmailAddress($fromAddress) && $this->isValidEmailAddress($username)) {
            $fromAddress = $username;
        }
        $replyTo = $fileValue('MAIL_REPLY_TO', $env('MAIL_REPLY_TO', ''));
        if (!$this->isValidEmailAddress($replyTo)) {
            $replyTo = $fromAddress;
        }

        return [
            'host' => $fileValue('MAIL_HOST', $env('MAIL_HOST', '')),
            'port' => (int) $fileValue('MAIL_PORT', $env('MAIL_PORT', '587')),
            'username' => $username,
            'password' => preg_replace('/\s+/', '', (string) $fileValue('MAIL_PASSWORD', $env('MAIL_PASSWORD', ''))),
            'encryption' => strtolower($fileValue('MAIL_ENCRYPTION', $env('MAIL_ENCRYPTION', 'tls'))),
            'from_address' => $fromAddress,
            'from_name' => $fileValue('MAIL_FROM_NAME', $env('MAIL_FROM_NAME', 'Father & Sons Music Academy')),
            'reply_to' => $replyTo,
            'verify_peer' => filter_var($fileValue('MAIL_VERIFY_PEER', $env('MAIL_VERIFY_PEER', 'true')), FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE),
            'debug' => filter_var($fileValue('MAIL_DEBUG', $env('MAIL_DEBUG', 'false')), FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE),
        ];
    }

    private function isMailConfigured()
    {
        $mail = $this->getMailSettings();
        if ($this->isPlaceholderMailHost($mail['host'])) {
            return false;
        }
        if (!$this->isValidEmailAddress($mail['from_address'])) {
            return false;
        }
        if ($mail['username'] !== '' && strtolower($mail['password']) === 'password') {
            return false;
        }
        return true;
    }

    private function configurePhpMailer($mailer, array $mail)
    {
        $mailer->CharSet = 'UTF-8';
        $mailer->isHTML(true);
        $mailer->setFrom($mail['from_address'], $mail['from_name']);
        if ($this->isValidEmailAddress($mail['reply_to'])) {
            $mailer->addReplyTo($mail['reply_to'], $mail['from_name']);
        }

        $mailer->isSMTP();
        $mailer->Host = $mail['host'];
        $mailer->Port = $mail['port'] > 0 ? $mail['port'] : 587;
        $mailer->SMTPAuth = true;
        $mailer->Username = $mail['username'];
        $mailer->Password = $mail['password'];
        $mailer->Timeout = 20;
        $mailer->SMTPOptions = [
            'ssl' => [
                'verify_peer' => $mail['verify_peer'] !== false,
                'verify_peer_name' => $mail['verify_peer'] !== false,
                'allow_self_signed' => $mail['verify_peer'] === false,
            ],
        ];

        if ($mail['encryption'] === 'ssl') {
            $mailer->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
        } elseif ($mail['encryption'] === 'tls') {
            $mailer->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        } else {
            $mailer->SMTPSecure = '';
            $mailer->SMTPAutoTLS = false;
        }
    }

    private function sendTeacherCredentialsEmail($toEmail, $toName, $username, $tempPassword)
    {
        $this->ensurePhpMailerLoaded();
        $this->lastMailError = null;
        if (!$this->isMailConfigured() || !$this->isValidEmailAddress($toEmail)) {
            $this->lastMailError = 'SMTP is not configured on the server.';
            return false;
        }

        $mail = $this->getMailSettings();

        try {
            $mailer = new \PHPMailer\PHPMailer\PHPMailer(true);
            $this->configurePhpMailer($mailer, $mail);
            $mailer->addAddress($toEmail, $toName ?: $toEmail);

            $safeName = htmlspecialchars($toName ?: 'Teacher', ENT_QUOTES, 'UTF-8');
            $safeUsername = htmlspecialchars($username, ENT_QUOTES, 'UTF-8');
            $safePassword = htmlspecialchars($tempPassword, ENT_QUOTES, 'UTF-8');

            $mailer->Subject = 'Your Father & Sons instructor portal login';
            $mailer->Body = '
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 560px;">
                    <h2 style="margin: 0 0 12px; color: #0f172a;">Welcome to the instructor portal</h2>
                    <p>Hello ' . $safeName . ',</p>
                    <p>Your teacher account has been created. Use the credentials below to sign in:</p>
                    <div style="background:#fdfaf1;border:1px solid #f9f1d5;border-radius:12px;padding:16px 18px;margin:18px 0;">
                        <p style="margin:0 0 8px;"><strong>Username:</strong> ' . $safeUsername . '</p>
                        <p style="margin:0;"><strong>Temporary password:</strong> ' . $safePassword . '</p>
                    </div>
                    <p>Please change your password after your first login.</p>
                    <p>If you did not expect this email, contact the academy office.</p>
                </div>
            ';
            $mailer->AltBody = "Username: {$username}\nTemporary password: {$tempPassword}\nPlease change your password after first login.";
            $mailer->send();
            return true;
        } catch (\PHPMailer\PHPMailer\Exception $e) {
            $this->lastMailError = trim($e->getMessage() . ' ' . $mailer->ErrorInfo);
            error_log('Teacher credentials email failed: ' . $this->lastMailError);
            return false;
        } catch (Exception $e) {
            $this->lastMailError = $e->getMessage();
            error_log('Teacher credentials email failed: ' . $this->lastMailError);
            return false;
        }
    }

    private function ensureTeacherUserAccount($teacherId, $passwordForNewAccount = null)
    {
        $teacherId = (int)$teacherId;
        if ($teacherId < 1) {
            $this->sendJSON(['error' => 'teacher_id is required'], 400);
        }

        $stmt = $this->conn->prepare("
            SELECT teacher_id, user_id, first_name, last_name, email, phone, status
            FROM tbl_teachers
            WHERE teacher_id = ?
            LIMIT 1
        ");
        $stmt->execute([$teacherId]);
        $teacher = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$teacher) {
            $this->sendJSON(['error' => 'Teacher not found'], 404);
        }

        $linkedUserId = (int)($teacher['user_id'] ?? 0);
        if ($linkedUserId > 0) {
            $check = $this->conn->prepare("SELECT user_id FROM tbl_users WHERE user_id = ? LIMIT 1");
            $check->execute([$linkedUserId]);
            if ((int)$check->fetchColumn() > 0) {
                return ['teacher' => $teacher, 'user_id' => $linkedUserId, 'created' => false];
            }
        }

        $email = trim((string)($teacher['email'] ?? ''));
        $matchedUserId = 0;

        if ($email !== '') {
            $find = $this->conn->prepare("
                SELECT user_id
                FROM tbl_users
                WHERE username = ?
                   OR (email IS NOT NULL AND email <> '' AND email = ?)
                LIMIT 1
            ");
            $find->execute([$email, $email]);
            $matchedUserId = (int)($find->fetchColumn() ?: 0);
        }

        if ($matchedUserId > 0) {
            $link = $this->conn->prepare("UPDATE tbl_teachers SET user_id = ? WHERE teacher_id = ?");
            $link->execute([$matchedUserId, $teacherId]);
            return ['teacher' => $teacher, 'user_id' => $matchedUserId, 'created' => false];
        }

        if ($passwordForNewAccount === null) {
            $this->sendJSON(['error' => 'This teacher does not have a linked user account yet.'], 400);
        }

        $username = $this->generateUsername(
            (string)($teacher['first_name'] ?? ''),
            (string)($teacher['last_name'] ?? ''),
            $email
        );
        $roleId = $this->getTeacherRoleId();
        $hashedPassword = password_hash((string)$passwordForNewAccount, PASSWORD_DEFAULT);
        $userStatus = ((string)($teacher['status'] ?? 'Active')) === 'Inactive' ? 'Inactive' : 'Active';

        $insertUser = $this->conn->prepare("
            INSERT INTO tbl_users (
                username, password, role_id, first_name, last_name, email, phone, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $insertUser->execute([
            $username,
            $hashedPassword,
            $roleId,
            (string)($teacher['first_name'] ?? ''),
            (string)($teacher['last_name'] ?? ''),
            ($email !== '' ? $email : null),
            (($teacher['phone'] ?? '') !== '' ? (string)$teacher['phone'] : null),
            $userStatus
        ]);

        $newUserId = (int)$this->conn->lastInsertId();
        $link = $this->conn->prepare("UPDATE tbl_teachers SET user_id = ? WHERE teacher_id = ?");
        $link->execute([$newUserId, $teacherId]);

        return ['teacher' => $teacher, 'user_id' => $newUserId, 'created' => true];
    }

    public function getSpecializations()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        try {
            ensure_specialization_instrument_link($this->conn);
            $stmt = $this->conn->query("
                SELECT specialization_id, specialization_name, type_id, status, created_at
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

            $stmt = $this->conn->prepare("INSERT INTO tbl_specialization (specialization_name, type_id, status) VALUES (?, ?, ?)");
            $linkedTypeId = null;
            if (instrument_types_table_exists($this->conn)) {
                $typeStmt = $this->conn->prepare("SELECT type_id FROM tbl_instrument_types WHERE LOWER(TRIM(type_name)) = LOWER(TRIM(?)) LIMIT 1");
                $typeStmt->execute([$name]);
                $linkedTypeId = (int) $typeStmt->fetchColumn();
                if ($linkedTypeId < 1) {
                    $linkedTypeId = null;
                }
            }
            $stmt->execute([$name, $linkedTypeId, $status]);

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
        $teacherId = (int)($_GET['teacher_id'] ?? 0);
        $userId = (int)($_GET['user_id'] ?? 0);
        $status = trim((string)($_GET['status'] ?? ''));

        if ($teacherId < 1 && $userId > 0) {
            $teacherId = $this->resolveTeacherId(0, $userId);
        }

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
            if ($teacherId > 0) {
                $sql .= " AND t.teacher_id = ? ";
                $params[] = $teacherId;
            }
            if ($userId > 0 && $teacherId < 1) {
                $sql .= " AND t.user_id = ? ";
                $params[] = $userId;
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
        // week_start: YYYY-MM-DD — if provided, fetch that specific Mon–Sun week
        $weekStartRaw = trim((string)($_GET['week_start'] ?? ''));
        $weekStart = null;
        $weekEnd   = null;
        if ($weekStartRaw !== '') {
            $parsed = \DateTime::createFromFormat('Y-m-d', $weekStartRaw);
            if ($parsed) {
                // Snap to Monday of that week
                $dow = (int)$parsed->format('N'); // 1=Mon … 7=Sun
                $parsed->modify('-' . ($dow - 1) . ' days');
                $weekStart = $parsed->format('Y-m-d');
                $parsed->modify('+6 days');
                $weekEnd   = $parsed->format('Y-m-d');
            }
        }
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
                    COALESCE(inst.instrument_name, CONCAT('Instrument #', COALESCE(ts.instrument_id, e.instrument_id))) AS instrument_name,
                    COALESCE(it.type_name, '') AS instrument_type,
                    COALESCE(rm.room_name, '') AS room_name
                FROM tbl_sessions ts
                INNER JOIN tbl_enrollments e ON e.enrollment_id = ts.enrollment_id
                INNER JOIN tbl_students s ON s.student_id = e.student_id
                LEFT JOIN tbl_instruments inst ON inst.instrument_id = COALESCE(ts.instrument_id, e.instrument_id)
                LEFT JOIN tbl_instrument_types it ON it.type_id = inst.type_id
                LEFT JOIN tbl_rooms rm ON rm.room_id = ts.room_id
                WHERE ts.teacher_id = ?
            ";
            $params = [$teacherId];

            if ($weekStart !== null && $weekEnd !== null) {
                // Specific week range — ignore $filter
                $sql .= " AND ts.session_date BETWEEN ? AND ? ";
                $params[] = $weekStart;
                $params[] = $weekEnd;
            } elseif ($filter === 'today') {
                $sql .= " AND ts.session_date = CURDATE() ";
            } elseif ($filter === 'week') {
                // Current week Mon–Sun
                $sql .= " AND ts.session_date BETWEEN DATE_SUB(CURDATE(), INTERVAL (WEEKDAY(CURDATE())) DAY) AND DATE_ADD(DATE_SUB(CURDATE(), INTERVAL (WEEKDAY(CURDATE())) DAY), INTERVAL 6 DAY) ";
            }

            $sql .= " ORDER BY ts.session_date ASC, ts.start_time ASC, ts.session_id ASC ";

            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);
            $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $this->sendJSON([
                'success'    => true,
                'sessions'   => $sessions,
                'week_start' => $weekStart,
                'week_end'   => $weekEnd,
            ]);
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
        $requestUserId = (int)($_GET['user_id'] ?? 0);
        if ($teacherId < 1) {
            $this->sendJSON(['error' => 'teacher_id or user_id is required'], 400);
        }
        if (!$this->tableExists('tbl_teacher_availability')) {
            $this->sendJSON(['success' => true, 'branch_id' => 0, 'availability' => []]);
        }

        try {
            if ($requestUserId > 0) {
                $requester = $this->resolveUserContext($requestUserId);
                if (!$requester) {
                    $this->sendJSON(['error' => 'Unable to resolve your account'], 404);
                }

                $teacherStmt = $this->conn->prepare("SELECT teacher_id, branch_id FROM tbl_teachers WHERE teacher_id = ? LIMIT 1");
                $teacherStmt->execute([$teacherId]);
                $teacher = $teacherStmt->fetch(PDO::FETCH_ASSOC);
                if (!$teacher) {
                    $this->sendJSON(['error' => 'Teacher not found'], 404);
                }

                $requesterRole = $this->normalizeRoleName($requester['role_name'] ?? '');
                if ($this->isStaffSchedulerRole($requesterRole)) {
                    $requesterBranchId = (int)($requester['branch_id'] ?? 0);
                    $teacherBranchId = (int)($teacher['branch_id'] ?? 0);
                    if ($requesterBranchId > 0 && $teacherBranchId > 0 && $requesterBranchId !== $teacherBranchId) {
                        $this->sendJSON(['error' => 'You can only view teachers in your branch'], 403);
                    }
                } elseif ($requestUserId !== (int)($teacher['teacher_id'] ?? 0)) {
                    $requestTeacherId = $this->resolveTeacherId(0, $requestUserId);
                    if ($requestTeacherId !== (int)($teacher['teacher_id'] ?? 0)) {
                        $this->sendJSON(['error' => 'You can only view your own availability'], 403);
                    }
                }
            }

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
        $requestUserId = (int)($data['user_id'] ?? 0);
        $entries = is_array($data['availability'] ?? null) ? $data['availability'] : [];
        $validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        if ($teacherId < 1) {
            $this->sendJSON(['error' => 'teacher_id or user_id is required'], 400);
        }
        if ($requestUserId < 1) {
            $this->sendJSON(['error' => 'user_id is required'], 400);
        }
        if (!$this->tableExists('tbl_teacher_availability')) {
            $this->sendJSON(['error' => 'tbl_teacher_availability table not found'], 500);
        }

        try {
            $requester = $this->resolveUserContext($requestUserId);
            if (!$requester) {
                $this->sendJSON(['error' => 'Unable to resolve your account'], 404);
            }

            if (!$this->isManagerRole($requester['role_name'] ?? '')) {
                $this->sendJSON(['error' => 'Only branch managers can edit teacher availability'], 403);
            }

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

            $requesterBranchId = (int)($requester['branch_id'] ?? 0);
            $teacherBranchId = (int)($teacher['branch_id'] ?? 0);
            if ($requesterBranchId < 1) {
                $this->sendJSON(['error' => 'Your account is not linked to a branch'], 403);
            }
            if ($teacherBranchId > 0 && $requesterBranchId !== $teacherBranchId) {
                $this->sendJSON(['error' => 'You can only edit teachers in your branch'], 403);
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
        $accountMode = trim((string)($data['account_mode'] ?? ''));
        $systemLoginName = trim((string)($data['system_login_name'] ?? ''));
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
        $resolvedAccountMode = $this->resolveTeacherAccountMode($accountMode, $email);
        if ($resolvedAccountMode === 'real_email' && $email === '') {
            $this->sendJSON(['error' => 'Email is required for a real email account'], 400);
        }

        try {
            $this->conn->beginTransaction();

            $createdUsername = null;
            $tempPassword = null;
            $emailSent = false;
            $storedTeacherEmail = $email;
            if ($userId === null) {
                $account = $this->resolveTeacherAccountCredentials(
                    $firstName,
                    $lastName,
                    $email,
                    $resolvedAccountMode,
                    $systemLoginName
                );
                $username = (string)($account['username'] ?? '');
                $storedTeacherEmail = (string)($account['email'] ?? '');
                $resolvedAccountMode = (string)($account['account_mode'] ?? $resolvedAccountMode);

                if ($this->userExists($username, $storedTeacherEmail)) {
                    $this->conn->rollBack();
                    $this->sendJSON(['error' => 'User account already exists for this username or email'], 400);
                }

                $roleId = $this->getTeacherRoleId();
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
                    $storedTeacherEmail,
                    ($phone !== '' ? $phone : null),
                    $userStatus
                ]);
                $userId = (int)$this->conn->lastInsertId();
                $createdUsername = $username;

                if (!empty($account['send_email'])) {
                    $emailSent = $this->sendTeacherCredentialsEmail(
                        $storedTeacherEmail,
                        trim($firstName . ' ' . $lastName),
                        $username,
                        $tempPassword
                    );
                }
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
                ($storedTeacherEmail !== '' ? $storedTeacherEmail : null),
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
                'login_identifier' => $createdUsername,
                'temp_password' => $tempPassword,
                'account_mode' => $resolvedAccountMode,
                'email_sent' => $emailSent,
                'email_error' => $emailSent ? null : $this->lastMailError
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

            $stmtExisting = $this->conn->prepare("
                SELECT teacher_id, user_id, email
                FROM tbl_teachers
                WHERE teacher_id = ?
                LIMIT 1
                FOR UPDATE
            ");
            $stmtExisting->execute([$teacherId]);
            $existingTeacher = $stmtExisting->fetch(PDO::FETCH_ASSOC);
            if (!$existingTeacher) {
                $this->conn->rollBack();
                $this->sendJSON(['error' => 'Teacher not found'], 404);
            }

            $existingUserId = (int)($existingTeacher['user_id'] ?? 0);
            if ($userId === null || $userId < 1) {
                $userId = $existingUserId > 0 ? $existingUserId : null;
            }

            if ($email !== '') {
                $dupTeacher = $this->conn->prepare("
                    SELECT teacher_id
                    FROM tbl_teachers
                    WHERE email = ?
                      AND teacher_id <> ?
                    LIMIT 1
                ");
                $dupTeacher->execute([$email, $teacherId]);
                if ($dupTeacher->fetchColumn()) {
                    $this->conn->rollBack();
                    $this->sendJSON(['error' => 'Email is already used by another teacher'], 400);
                }
            }

            if ($userId !== null && $userId > 0) {
                $dupUser = $this->conn->prepare("
                    SELECT user_id
                    FROM tbl_users
                    WHERE (
                        (email IS NOT NULL AND email <> '' AND email = ?)
                        OR username = ?
                    )
                      AND user_id <> ?
                    LIMIT 1
                ");
                $dupUser->execute([$email, $email, $userId]);
                if ($email !== '' && $dupUser->fetchColumn()) {
                    $this->conn->rollBack();
                    $this->sendJSON(['error' => 'Email is already used by another user account'], 400);
                }
            }

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

            if ($userId !== null && $userId > 0) {
                $stmtUser = $this->conn->prepare("
                    SELECT user_id, username, email
                    FROM tbl_users
                    WHERE user_id = ?
                    LIMIT 1
                    FOR UPDATE
                ");
                $stmtUser->execute([$userId]);
                $linkedUser = $stmtUser->fetch(PDO::FETCH_ASSOC);
                if ($linkedUser) {
                    $currentUsername = trim((string)($linkedUser['username'] ?? ''));
                    $newUsername = $currentUsername;

                    if ($email !== '') {
                        $newUsername = $email;
                    }

                    if ($newUsername !== $currentUsername && $this->usernameExists($newUsername)) {
                        $this->conn->rollBack();
                        $this->sendJSON(['error' => 'Email is already used by another login account'], 400);
                    }

                    $stmtUpdateUser = $this->conn->prepare("
                        UPDATE tbl_users
                        SET username = ?,
                            first_name = ?,
                            last_name = ?,
                            email = ?,
                            phone = ?,
                            status = ?
                        WHERE user_id = ?
                    ");
                    $stmtUpdateUser->execute([
                        $newUsername,
                        $firstName,
                        $lastName,
                        ($email !== '' ? $email : null),
                        ($phone !== '' ? $phone : null),
                        $status,
                        $userId
                    ]);
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
            $stmtTeacher = $this->conn->prepare("SELECT user_id FROM tbl_teachers WHERE teacher_id = ? LIMIT 1");
            $stmtTeacher->execute([$teacherId]);
            $linkedUserId = (int)($stmtTeacher->fetchColumn() ?: 0);

            $stmt = $this->conn->prepare("UPDATE tbl_teachers SET status = ? WHERE teacher_id = ?");
            $stmt->execute([$status, $teacherId]);
            if ($stmt->rowCount() === 0) {
                $check = $this->conn->prepare("SELECT teacher_id FROM tbl_teachers WHERE teacher_id = ? LIMIT 1");
                $check->execute([$teacherId]);
                if (!$check->fetchColumn()) {
                    $this->sendJSON(['error' => 'Teacher not found'], 404);
                }
            }

            if ($linkedUserId > 0) {
                $stmtUser = $this->conn->prepare("UPDATE tbl_users SET status = ? WHERE user_id = ?");
                $stmtUser->execute([$status, $linkedUserId]);
            }
            $this->sendJSON(['success' => true]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function getTeacherSessionGrades()
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
                    ts.attendance_status,
                    ts.notes,
                    ts.attendance_notes,
                    s.student_id,
                    s.first_name AS student_first_name,
                    s.last_name AS student_last_name,
                    COALESCE(inst.instrument_name, CONCAT('Instrument #', ts.instrument_id)) AS instrument_name,
                    COALESCE(sp.package_name, CONCAT('Package #', e.package_id)) AS package_name,
                    COALESCE(rm.room_name, NULLIF(TRIM(ts.notes), '')) AS room_name,
                    prog.progress_id,
                    prog.skill_level,
                    prog.performance_score,
                    prog.technique_score,
                    prog.rhythm_score,
                    prog.focus_score,
                    prog.assignment_score,
                    prog.criteria_scores,
                    prog.remarks,
                    prog.assessment_date,
                    prog.updated_at
                FROM tbl_sessions ts
                INNER JOIN tbl_enrollments e ON e.enrollment_id = ts.enrollment_id
                INNER JOIN tbl_students s ON s.student_id = e.student_id
                LEFT JOIN tbl_instruments inst ON inst.instrument_id = COALESCE(ts.instrument_id, e.instrument_id)
                LEFT JOIN tbl_session_packages sp ON sp.package_id = e.package_id
                LEFT JOIN tbl_rooms rm ON rm.room_id = ts.room_id
                LEFT JOIN tbl_student_progress prog ON prog.session_id = ts.session_id
                WHERE ts.teacher_id = ?
            ";
            $params = [$teacherId];

            if ($filter === 'completed') {
                $sql .= " AND ts.status = 'Completed' AND COALESCE(ts.attendance_status,'') = 'Present' ";
            } elseif ($filter === 'upcoming') {
                $sql .= " AND ts.session_date >= CURDATE() ";
            } elseif ($filter === 'graded') {
                $sql .= " AND prog.progress_id IS NOT NULL ";
            } elseif ($filter === 'ungraded') {
                $sql .= " AND ts.status = 'Completed' AND COALESCE(ts.attendance_status,'') = 'Present' AND prog.progress_id IS NULL ";
            }

            $sql .= " ORDER BY ts.session_date DESC, ts.start_time DESC, ts.session_id DESC ";

            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            foreach ($rows as &$row) {
                $criteriaScores = $this->decodeCriteriaScores($row['criteria_scores'] ?? null);
                $scores = array_values(array_filter(array_map(function ($item) {
                    return isset($item['score']) ? $this->normalizeProgressScore($item['score']) : null;
                }, $criteriaScores), function ($value) { return $value !== null; }));
                if (!$scores) $scores = [
                    $row['performance_score'] !== null ? (int)$row['performance_score'] : null,
                    $row['technique_score'] !== null ? (int)$row['technique_score'] : null,
                    $row['rhythm_score'] !== null ? (int)$row['rhythm_score'] : null,
                    $row['focus_score'] !== null ? (int)$row['focus_score'] : null,
                    $row['assignment_score'] !== null ? (int)$row['assignment_score'] : null
                ];
                $validScores = array_values(array_filter($scores, function ($value) {
                    return $value !== null;
                }));
                $row['average_score'] = !empty($validScores)
                    ? round(array_sum($validScores) / count($validScores), 2)
                    : null;
                $row['criteria_scores'] = $criteriaScores;
            }
            unset($row);

            $this->sendJSON(['success' => true, 'sessions' => $rows]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function saveTeacherSessionGrade()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $teacherId = $this->resolveTeacherId((int)($data['teacher_id'] ?? 0), (int)($data['user_id'] ?? 0));
        $sessionId = (int)($data['session_id'] ?? 0);
        $skillLevel = $this->normalizeProgressSkillLevel($data['skill_level'] ?? '');
        $performanceScore = $this->normalizeProgressScore($data['performance_score'] ?? null);
        $techniqueScore = $this->normalizeProgressScore($data['technique_score'] ?? null);
        $rhythmScore = $this->normalizeProgressScore($data['rhythm_score'] ?? null);
        $focusScore = $this->normalizeProgressScore($data['focus_score'] ?? null);
        $assignmentScore = $this->normalizeProgressScore($data['assignment_score'] ?? null);
        $criteriaScores = $this->normalizeCriteriaScores($data['criteria_scores'] ?? []);
        $remarks = trim((string)($data['remarks'] ?? ''));
        $assessmentDate = trim((string)($data['assessment_date'] ?? date('Y-m-d')));

        if ($teacherId < 1 || $sessionId < 1) {
            $this->sendJSON(['error' => 'teacher_id/user_id and session_id are required'], 400);
        }
        if ($skillLevel === '') {
            $this->sendJSON(['error' => 'A valid skill level is required'], 400);
        }
        if (!$criteriaScores) {
            $this->sendJSON(['error' => 'Provide between 1 and 20 named criteria with scores from 1 to 5'], 400);
        }
        $legacyScores = array_column($criteriaScores, 'score');
        $performanceScore = $legacyScores[0] ?? null;
        $techniqueScore = $legacyScores[1] ?? null;
        $rhythmScore = $legacyScores[2] ?? null;
        $focusScore = $legacyScores[3] ?? null;
        $assignmentScore = $legacyScores[4] ?? null;
        $criteriaScoresJson = json_encode($criteriaScores, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($assessmentDate === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $assessmentDate)) {
            $this->sendJSON(['error' => 'assessment_date must be in YYYY-MM-DD format'], 400);
        }

        try {
            $stmtSession = $this->conn->prepare("
                SELECT
                    ts.session_id,
                    ts.teacher_id,
                    ts.instrument_id,
                    ts.session_date,
                    e.student_id,
                    e.instrument_id AS enrollment_instrument_id
                FROM tbl_sessions ts
                INNER JOIN tbl_enrollments e ON e.enrollment_id = ts.enrollment_id
                WHERE ts.session_id = ?
                  AND ts.teacher_id = ?
                LIMIT 1
            ");
            $stmtSession->execute([$sessionId, $teacherId]);
            $session = $stmtSession->fetch(PDO::FETCH_ASSOC);
            if (!$session) {
                $this->sendJSON(['error' => 'Session not found for this teacher'], 404);
            }

            $studentId = (int)($session['student_id'] ?? 0);
            $instrumentId = (int)($session['instrument_id'] ?? 0);
            if ($instrumentId < 1) {
                $instrumentId = (int)($session['enrollment_instrument_id'] ?? 0);
            }
            if ($studentId < 1 || $instrumentId < 1) {
                $this->sendJSON(['error' => 'This session is missing required student or instrument data'], 400);
            }

            $stmtExisting = $this->conn->prepare("
                SELECT progress_id
                FROM tbl_student_progress
                WHERE session_id = ?
                LIMIT 1
            ");
            $stmtExisting->execute([$sessionId]);
            $progressId = (int)($stmtExisting->fetchColumn() ?: 0);

            if ($progressId > 0) {
                $stmtUpdate = $this->conn->prepare("
                    UPDATE tbl_student_progress
                    SET student_id = ?,
                        instrument_id = ?,
                        skill_level = ?,
                        performance_score = ?,
                        technique_score = ?,
                        rhythm_score = ?,
                        focus_score = ?,
                        assignment_score = ?,
                        criteria_scores = ?,
                        remarks = ?,
                        assessment_date = ?
                    WHERE progress_id = ?
                ");
                $stmtUpdate->execute([
                    $studentId,
                    $instrumentId,
                    $skillLevel,
                    $performanceScore,
                    $techniqueScore,
                    $rhythmScore,
                    $focusScore,
                    $assignmentScore,
                    $criteriaScoresJson,
                    ($remarks !== '' ? $remarks : null),
                    $assessmentDate,
                    $progressId
                ]);
            } else {
                $stmtInsert = $this->conn->prepare("
                    INSERT INTO tbl_student_progress (
                        student_id,
                        session_id,
                        instrument_id,
                        skill_level,
                        performance_score,
                        technique_score,
                        rhythm_score,
                        focus_score,
                        assignment_score,
                        criteria_scores,
                        remarks,
                        assessment_date
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $stmtInsert->execute([
                    $studentId,
                    $sessionId,
                    $instrumentId,
                    $skillLevel,
                    $performanceScore,
                    $techniqueScore,
                    $rhythmScore,
                    $focusScore,
                    $assignmentScore,
                    $criteriaScoresJson,
                    ($remarks !== '' ? $remarks : null),
                    $assessmentDate
                ]);
                $progressId = (int)$this->conn->lastInsertId();
            }

            $scores = array_column($criteriaScores, 'score');
            $averageScore = round(array_sum($scores) / count($scores), 2);

            $this->sendJSON([
                'success' => true,
                'message' => 'Student performance grade saved successfully.',
                'progress_id' => $progressId,
                'average_score' => $averageScore
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    private function teacherCanManageStudentInstrument($teacherId, $studentId, $instrumentId)
    {
        $stmt = $this->conn->prepare("
            SELECT 1
            FROM tbl_sessions ts
            INNER JOIN tbl_enrollments e ON e.enrollment_id = ts.enrollment_id
            WHERE ts.teacher_id = ?
              AND e.student_id = ?
              AND COALESCE(ts.instrument_id, e.instrument_id) = ?
            LIMIT 1
        ");
        $stmt->execute([(int)$teacherId, (int)$studentId, (int)$instrumentId]);
        return (bool)$stmt->fetchColumn();
    }

    public function getTeacherLearningProgress()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->sendJSON(['error' => 'Method not allowed'], 405);
        $teacherId = $this->resolveLearningWorkflowTeacherId((int)($_GET['teacher_id'] ?? 0), (int)($_GET['user_id'] ?? 0));
        if ($teacherId < 1) $this->sendJSON(['error' => 'teacher_id or user_id is required'], 400);
        $this->ensureLearningProgressWorkflow();

        try {
            $stmt = $this->conn->prepare("
                SELECT DISTINCT s.student_id, s.first_name, s.last_name,
                       i.instrument_id, COALESCE(it.type_name, i.instrument_name) AS instrument_name,
                       ll.learning_level_id, ll.level_name, ll.book_material,
                       ll.current_topic, ll.instructor_notes, ll.skills_developing,
                       ll.areas_for_improvement, ll.assessment_readiness,
                       ll.status, ll.started_at, ll.updated_at
                FROM tbl_sessions ts
                INNER JOIN tbl_enrollments e ON e.enrollment_id = ts.enrollment_id
                INNER JOIN tbl_students s ON s.student_id = e.student_id
                INNER JOIN tbl_instruments i ON i.instrument_id = COALESCE(ts.instrument_id, e.instrument_id)
                LEFT JOIN tbl_instrument_types it ON it.type_id = i.type_id
                LEFT JOIN tbl_student_learning_levels ll
                  ON ll.learning_level_id = (
                      SELECT ll2.learning_level_id
                      FROM tbl_student_learning_levels ll2
                      WHERE ll2.student_id = s.student_id
                        AND ll2.instrument_id = i.instrument_id
                        AND ll2.status = 'In Progress'
                      ORDER BY ll2.started_at DESC, ll2.learning_level_id DESC
                      LIMIT 1
                  )
                WHERE ts.teacher_id = ?
                ORDER BY s.last_name, s.first_name, i.instrument_name
            ");
            $stmt->execute([$teacherId]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $historyStmt = $this->conn->prepare("
                SELECT ll.learning_level_id, ll.level_name, ll.book_material, ll.status,
                       ll.started_at, ll.achieved_at, ll.assessment_readiness,
                       pe.exam_id, pe.exam_date, pe.grade_rating, pe.result,
                       c.certificate_id, c.certificate_number, c.issued_at
                FROM tbl_student_learning_levels ll
                LEFT JOIN tbl_promotional_exams pe ON pe.exam_id = ll.achieved_exam_id
                LEFT JOIN tbl_student_certificates c
                  ON c.learning_level_id = ll.learning_level_id AND c.status = 'Issued'
                WHERE ll.student_id = ? AND ll.instrument_id = ?
                ORDER BY ll.started_at DESC, ll.learning_level_id DESC
            ");
            $evaluationStmt = $this->conn->prepare("
                SELECT ts.session_id, ts.session_number, ts.session_date,
                       ts.notes AS session_notes, ts.attendance_notes,
                       p.progress_id, p.skill_level, p.criteria_scores,
                       p.performance_score, p.technique_score, p.rhythm_score,
                       p.focus_score, p.assignment_score, p.remarks,
                       p.assessment_date
                FROM tbl_sessions ts
                INNER JOIN tbl_enrollments e ON e.enrollment_id = ts.enrollment_id
                LEFT JOIN tbl_student_progress p ON p.session_id = ts.session_id
                WHERE ts.teacher_id = ?
                  AND e.student_id = ?
                  AND COALESCE(ts.instrument_id, e.instrument_id) = ?
                  AND ts.status = 'Completed'
                  AND COALESCE(ts.attendance_status, '') = 'Present'
                ORDER BY ts.session_date DESC, ts.session_number DESC, ts.session_id DESC
            ");
            $materialsStmt = $this->conn->prepare("
                SELECT material_id, level_name, material_name, description, file_path, original_filename
                FROM tbl_learning_materials
                WHERE status = 'Active' AND (instrument_type = ? OR instrument_type = 'General')
                ORDER BY instrument_type = 'General', level_name, material_name
            ");
            foreach ($rows as &$row) {
                $historyStmt->execute([(int)$row['student_id'], (int)$row['instrument_id']]);
                $row['learning_history'] = $historyStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                $evaluationStmt->execute([$teacherId, (int)$row['student_id'], (int)$row['instrument_id']]);
                $evaluations = $evaluationStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                foreach ($evaluations as &$evaluation) {
                    $criteria = $this->decodeCriteriaScores($evaluation['criteria_scores'] ?? null);
                    $scores = [];
                    foreach ($criteria as $criterion) {
                        if (isset($criterion['score']) && is_numeric($criterion['score'])) {
                            $scores[] = (float)$criterion['score'];
                        }
                    }
                    if (!$scores) {
                        foreach (['performance_score','technique_score','rhythm_score','focus_score','assignment_score'] as $scoreColumn) {
                            if ($evaluation[$scoreColumn] !== null && is_numeric($evaluation[$scoreColumn])) {
                                $scores[] = (float)$evaluation[$scoreColumn];
                            }
                        }
                    }
                    $evaluation['criteria_scores'] = $criteria;
                    $evaluation['average_score'] = $scores ? round(array_sum($scores) / count($scores), 2) : null;
                }
                unset($evaluation);
                $row['completed_sessions'] = count($evaluations);
                $row['session_evaluations'] = $evaluations;
                $materialsStmt->execute([(string)$row['instrument_name']]);
                $row['learning_materials'] = $materialsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            }
            unset($row);
            $this->sendJSON(['success' => true, 'learning_progress' => $rows]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function saveTeacherLearningProgress()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->sendJSON(['error' => 'Method not allowed'], 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $teacherId = $this->resolveLearningWorkflowTeacherId((int)($data['teacher_id'] ?? 0), (int)($data['user_id'] ?? 0));
        $studentId = (int)($data['student_id'] ?? 0);
        $instrumentId = (int)($data['instrument_id'] ?? 0);
        $levelName = trim((string)($data['level_name'] ?? ''));
        $bookMaterial = trim((string)($data['book_material'] ?? ''));
        $topic = trim((string)($data['current_topic'] ?? ''));
        $notes = trim((string)($data['instructor_notes'] ?? ''));
        $skills = trim((string)($data['skills_developing'] ?? ''));
        $improvement = trim((string)($data['areas_for_improvement'] ?? ''));
        $readiness = trim((string)($data['assessment_readiness'] ?? 'Not Ready'));
        $readinessReviewed = !empty($data['readiness_reviewed']);
        $validReadiness = ['Not Ready','Developing','Improving','Ready for Assessment'];
        if ($teacherId < 1 || $studentId < 1 || $instrumentId < 1 || $levelName === '') {
            $this->sendJSON(['error' => 'Teacher, student, instrument, and current level are required'], 400);
        }
        if (!in_array($readiness, $validReadiness, true)) $this->sendJSON(['error' => 'Invalid assessment readiness'], 400);
        if ($readiness === 'Ready for Assessment' && !$readinessReviewed) {
            $this->sendJSON(['error' => 'Review the student session evaluations before marking promotional-exam readiness'], 400);
        }
        if (!$this->teacherCanManageStudentInstrument($teacherId, $studentId, $instrumentId)) {
            $this->sendJSON(['error' => 'This student/instrument is not assigned to this instructor'], 403);
        }

        try {
            $this->conn->beginTransaction();
            $stmt = $this->conn->prepare("
                SELECT learning_level_id FROM tbl_student_learning_levels
                WHERE student_id = ? AND instrument_id = ? AND status = 'In Progress'
                ORDER BY learning_level_id DESC LIMIT 1 FOR UPDATE
            ");
            $stmt->execute([$studentId, $instrumentId]);
            $learningId = (int)($stmt->fetchColumn() ?: 0);
            if ($learningId > 0) {
                $update = $this->conn->prepare("
                    UPDATE tbl_student_learning_levels
                    SET teacher_id=?, level_name=?, book_material=?, current_topic=?, instructor_notes=?,
                        skills_developing=?, areas_for_improvement=?, assessment_readiness=?
                    WHERE learning_level_id=? AND status='In Progress'
                ");
                $update->execute([$teacherId, $levelName, $bookMaterial ?: null, $topic ?: null, $notes ?: null, $skills ?: null, $improvement ?: null, $readiness, $learningId]);
            } else {
                $insert = $this->conn->prepare("
                    INSERT INTO tbl_student_learning_levels
                    (student_id,instrument_id,teacher_id,level_name,book_material,current_topic,instructor_notes,skills_developing,areas_for_improvement,assessment_readiness,status,started_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,'In Progress',CURDATE())
                ");
                $insert->execute([$studentId,$instrumentId,$teacherId,$levelName,$bookMaterial ?: null,$topic ?: null,$notes ?: null,$skills ?: null,$improvement ?: null,$readiness]);
                $learningId = (int)$this->conn->lastInsertId();
            }
            $this->conn->commit();
            $this->sendJSON(['success'=>true,'message'=>'Learning progress saved.','learning_level_id'=>$learningId]);
        } catch (PDOException $e) {
            if ($this->conn->inTransaction()) $this->conn->rollBack();
            $this->sendJSON(['error'=>'Database error: '.$e->getMessage()],500);
        }
    }

    public function recordPromotionalExam()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->sendJSON(['error' => 'Method not allowed'], 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $teacherId = $this->resolveLearningWorkflowTeacherId((int)($data['teacher_id'] ?? 0), (int)($data['user_id'] ?? 0));
        $learningId = (int)($data['learning_level_id'] ?? 0);
        $result = trim((string)($data['result'] ?? ''));
        $rating = trim((string)($data['grade_rating'] ?? ''));
        $examDate = trim((string)($data['exam_date'] ?? date('Y-m-d')));
        $notes = trim((string)($data['examiner_notes'] ?? ''));
        $nextLevel = trim((string)($data['next_level_name'] ?? ''));
        $nextBook = trim((string)($data['next_book_material'] ?? ''));
        if ($teacherId < 1 || $learningId < 1 || !in_array($result, ['Passed','Retake'], true)) {
            $this->sendJSON(['error'=>'Teacher, learning record, and a Passed/Retake result are required'],400);
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $examDate)) $this->sendJSON(['error'=>'Invalid exam date'],400);
        if ($rating === '') $this->sendJSON(['error'=>'Record the formal exam grade or rating'],400);
        if ($result === 'Passed' && $nextLevel === '') {
            $this->sendJSON(['error'=>'Next level is required after a passing result'],400);
        }

        try {
            $this->conn->beginTransaction();
            $stmt = $this->conn->prepare("SELECT * FROM tbl_student_learning_levels WHERE learning_level_id=? LIMIT 1 FOR UPDATE");
            $stmt->execute([$learningId]);
            $learning = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$learning || $learning['status'] !== 'In Progress') {
                $this->conn->rollBack();
                $this->sendJSON(['error'=>'Current in-progress learning record not found'],404);
            }
            $studentId = (int)$learning['student_id'];
            $instrumentId = (int)$learning['instrument_id'];
            if (!$this->teacherCanManageStudentInstrument($teacherId,$studentId,$instrumentId)) {
                $this->conn->rollBack();
                $this->sendJSON(['error'=>'This student/instrument is not assigned to this instructor'],403);
            }
            if ($learning['assessment_readiness'] !== 'Ready for Assessment') {
                $this->conn->rollBack();
                $this->sendJSON(['error'=>'Mark the student Ready for Assessment before recording a promotional exam'],400);
            }

            $exam = $this->conn->prepare("
                INSERT INTO tbl_promotional_exams
                (student_id,instrument_id,learning_level_id,teacher_id,assessed_level,exam_date,grade_rating,result,examiner_notes)
                VALUES (?,?,?,?,?,?,?,?,?)
            ");
            $exam->execute([$studentId,$instrumentId,$learningId,$teacherId,$learning['level_name'],$examDate,$rating,$result,$notes ?: null]);
            $examId = (int)$this->conn->lastInsertId();

            if ($result === 'Retake') {
                $this->conn->prepare("UPDATE tbl_student_learning_levels SET assessment_readiness='Developing', instructor_notes=COALESCE(?,instructor_notes) WHERE learning_level_id=?")
                    ->execute([$notes ?: null,$learningId]);
                $this->conn->commit();
                $this->sendJSON(['success'=>true,'message'=>'Retake recorded. The student remains at the current level and book.','exam_id'=>$examId,'result'=>$result]);
            }

            $this->conn->prepare("UPDATE tbl_student_learning_levels SET status='Achieved', achieved_at=?, achieved_exam_id=? WHERE learning_level_id=?")
                ->execute([$examDate,$examId,$learningId]);
            $certificateNumber = 'FAS-' . date('Y', strtotime($examDate)) . '-' . str_pad((string)$studentId, 5, '0', STR_PAD_LEFT) . '-' . str_pad((string)$examId, 5, '0', STR_PAD_LEFT);
            $certificate = $this->conn->prepare("
                INSERT INTO tbl_student_certificates
                (student_id,promotional_exam_id,learning_level_id,instrument_id,achieved_level,certificate_number,issued_at,issued_by,status)
                VALUES (?,?,?,?,?,?,?,?, 'Issued')
            ");
            $certificate->execute([$studentId,$examId,$learningId,$instrumentId,$learning['level_name'],$certificateNumber,$examDate,$teacherId]);
            $certificateId = (int)$this->conn->lastInsertId();

            $next = $this->conn->prepare("
                INSERT INTO tbl_student_learning_levels
                (student_id,instrument_id,teacher_id,level_name,book_material,assessment_readiness,status,started_at,previous_learning_level_id)
                VALUES (?,?,?,?,?,'Not Ready','In Progress',?,?)
            ");
            $next->execute([$studentId,$instrumentId,$teacherId,$nextLevel,$nextBook ?: null,$examDate,$learningId]);
            $nextLearningId = (int)$this->conn->lastInsertId();
            $this->conn->commit();
            $this->sendJSON([
                'success'=>true,
                'message'=>'Passed. Achievement and certificate recorded; the next level is now in progress.',
                'exam_id'=>$examId,'result'=>$result,'certificate_id'=>$certificateId,
                'certificate_number'=>$certificateNumber,'next_learning_level_id'=>$nextLearningId
            ]);
        } catch (PDOException $e) {
            if ($this->conn->inTransaction()) $this->conn->rollBack();
            $this->sendJSON(['error'=>'Database error: '.$e->getMessage()],500);
        }
    }

    public function resetTeacherPassword()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $teacherId = (int)($data['teacher_id'] ?? 0);
        $newPassword = (string)($data['new_password'] ?? '');

        if ($teacherId < 1 || $newPassword === '') {
            $this->sendJSON(['error' => 'teacher_id and new_password are required'], 400);
        }

        $this->validateStrongPassword($newPassword);

        try {
            $this->conn->beginTransaction();

            $account = $this->ensureTeacherUserAccount($teacherId, $newPassword);
            $userId = (int)($account['user_id'] ?? 0);
            if ($userId < 1) {
                $this->conn->rollBack();
                $this->sendJSON(['error' => 'Unable to resolve teacher user account'], 500);
            }

            $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
            $update = $this->conn->prepare("UPDATE tbl_users SET password = ? WHERE user_id = ?");
            $update->execute([$hashedPassword, $userId]);

            $this->conn->commit();
            $this->sendJSON([
                'success' => true,
                'user_id' => $userId,
                'account_created' => !empty($account['created'])
            ]);
        } catch (PDOException $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
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

fas_require_authenticated_user($conn);

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
    case 'get-teacher-session-grades':
        $api->getTeacherSessionGrades();
        break;
    case 'get-teacher-availability':
        $api->getTeacherAvailability();
        break;
    case 'save-teacher-availability':
        $api->saveTeacherAvailability();
        break;
    case 'save-session-grade':
        $api->saveTeacherSessionGrade();
        break;
    case 'get-grading-criteria':
        $api->getTeacherGradingCriteria();
        break;
    case 'save-grading-criteria':
        $api->saveTeacherGradingCriteria();
        break;
    case 'get-learning-progress':
        $api->getTeacherLearningProgress();
        break;
    case 'save-learning-progress':
        $api->saveTeacherLearningProgress();
        break;
    case 'record-promotional-exam':
        $api->recordPromotionalExam();
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
    case 'reset-teacher-password':
        $api->resetTeacherPassword();
        break;
    default:
        $api->sendJSON(['error' => 'Invalid action'], 400);
}
?>
