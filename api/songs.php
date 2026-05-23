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

class SongsApi
{
    private $conn;

    public function __construct($pdo)
    {
        $this->conn = $pdo;
        $this->ensureSongModuleTables();
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

    private function isMultipartRequest()
    {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? ($_SERVER['HTTP_CONTENT_TYPE'] ?? '');
        return stripos((string)$contentType, 'multipart/form-data') !== false;
    }

    private function ensureSongModuleTables()
    {
        try {
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS tbl_song_library (
                    song_id INT AUTO_INCREMENT PRIMARY KEY,
                    teacher_id INT NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    artist VARCHAR(255) NULL,
                    genre VARCHAR(100) NULL,
                    category VARCHAR(100) NOT NULL DEFAULT 'voice',
                    difficulty_level VARCHAR(100) NULL,
                    vocal_range VARCHAR(100) NULL,
                    tags TEXT NULL,
                    youtube_link VARCHAR(500) NULL,
                    spotify_link VARCHAR(500) NULL,
                    sheet_music_path VARCHAR(255) NULL,
                    accompaniment_audio_path VARCHAR(255) NULL,
                    notes TEXT NULL,
                    status ENUM('Active','Archived') NOT NULL DEFAULT 'Active',
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            ");

            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS tbl_student_song_assignments (
                    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
                    song_id INT NOT NULL,
                    student_id INT NOT NULL,
                    teacher_id INT NOT NULL,
                    enrollment_id INT NULL,
                    progress_status ENUM('assigned','practicing','polishing','completed') NOT NULL DEFAULT 'assigned',
                    assigned_notes TEXT NULL,
                    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            ");

            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS tbl_song_lesson_history (
                    history_id INT AUTO_INCREMENT PRIMARY KEY,
                    assignment_id INT NOT NULL,
                    session_id INT NULL,
                    teacher_id INT NOT NULL,
                    lesson_date DATE NOT NULL,
                    progress_status ENUM('assigned','practicing','polishing','completed') NOT NULL DEFAULT 'assigned',
                    lesson_notes TEXT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            ");
        } catch (PDOException $e) {
            return;
        }

        try {
            if ($this->tableHasColumn('tbl_song_library', 'category')) {
                $this->conn->exec("ALTER TABLE tbl_song_library MODIFY COLUMN category VARCHAR(100) NOT NULL DEFAULT 'voice'");
            }
        } catch (PDOException $e) {}

        try { $this->conn->exec("CREATE INDEX idx_song_library_teacher ON tbl_song_library(teacher_id)"); } catch (PDOException $e) {}
        try { $this->conn->exec("CREATE INDEX idx_song_library_category ON tbl_song_library(category)"); } catch (PDOException $e) {}
        try { $this->conn->exec("CREATE INDEX idx_song_assignments_teacher ON tbl_student_song_assignments(teacher_id)"); } catch (PDOException $e) {}
        try { $this->conn->exec("CREATE INDEX idx_song_assignments_student ON tbl_student_song_assignments(student_id)"); } catch (PDOException $e) {}
        try { $this->conn->exec("CREATE INDEX idx_song_assignments_song ON tbl_student_song_assignments(song_id)"); } catch (PDOException $e) {}
        try { $this->conn->exec("CREATE INDEX idx_song_history_assignment ON tbl_song_lesson_history(assignment_id)"); } catch (PDOException $e) {}
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
            $resolved = (int)($stmt->fetchColumn() ?: 0);
            if ($resolved > 0) {
                return $resolved;
            }

            $userStmt = $this->conn->prepare("
                SELECT email, username, first_name, last_name
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
                    LIMIT 1
                ");
                $byEmail->execute([$email, $username]);
                $resolved = (int)($byEmail->fetchColumn() ?: 0);
            }

            if ($resolved < 1 && $firstName !== '' && $lastName !== '') {
                $byName = $this->conn->prepare("
                    SELECT teacher_id
                    FROM tbl_teachers
                    WHERE LOWER(TRIM(first_name)) = LOWER(?)
                      AND LOWER(TRIM(last_name)) = LOWER(?)
                    LIMIT 1
                ");
                $byName->execute([$firstName, $lastName]);
                $resolved = (int)($byName->fetchColumn() ?: 0);
            }

            return $resolved;
        } catch (PDOException $e) {
            return 0;
        }
    }

    private function resolveStudentId($studentId, $email)
    {
        $studentId = (int)$studentId;
        if ($studentId > 0) {
            return $studentId;
        }

        $email = trim((string)$email);
        if ($email === '' || !$this->tableExists('tbl_students')) {
            return 0;
        }

        try {
            $stmt = $this->conn->prepare("
                SELECT student_id
                FROM tbl_students
                WHERE LOWER(TRIM(email)) = LOWER(?)
                LIMIT 1
            ");
            $stmt->execute([$email]);
            return (int)($stmt->fetchColumn() ?: 0);
        } catch (PDOException $e) {
            return 0;
        }
    }

    private function normalizeSongCategory($value)
    {
        return strtolower(trim((string)$value));
    }

    private function normalizeProgressStatus($value)
    {
        $value = strtolower(trim((string)$value));
        $allowed = ['assigned', 'practicing', 'polishing', 'completed'];
        return in_array($value, $allowed, true) ? $value : '';
    }

    private function storeSongAssetUpload($file, $scope, array $allowedExt, $errorLabel)
    {
        if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            return null;
        }
        if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
            throw new Exception("Failed to upload {$errorLabel}.");
        }

        $maxBytes = 15 * 1024 * 1024;
        $size = (int)($file['size'] ?? 0);
        if ($size < 1 || $size > $maxBytes) {
            throw new Exception(ucfirst($errorLabel) . ' must be between 1 byte and 15MB.');
        }

        $tmpName = $file['tmp_name'] ?? '';
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            throw new Exception('Invalid uploaded file.');
        }

        $originalName = (string)($file['name'] ?? '');
        $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        if (!in_array($ext, $allowedExt, true)) {
            throw new Exception('Invalid ' . $errorLabel . ' format.');
        }

        $baseDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'song_library' . DIRECTORY_SEPARATOR . $scope;
        if (!is_dir($baseDir) && !mkdir($baseDir, 0777, true) && !is_dir($baseDir)) {
            throw new Exception('Unable to create upload directory.');
        }

        $safeName = date('YmdHis') . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
        $targetPath = $baseDir . DIRECTORY_SEPARATOR . $safeName;
        if (!move_uploaded_file($tmpName, $targetPath)) {
            throw new Exception('Unable to save uploaded file.');
        }

        return 'uploads/song_library/' . $scope . '/' . $safeName;
    }

    private function fetchAssignmentHistoryMap(array $assignmentIds)
    {
        $map = [];
        $assignmentIds = array_values(array_filter(array_map('intval', $assignmentIds), function ($value) {
            return $value > 0;
        }));
        if (empty($assignmentIds)) {
            return $map;
        }

        $placeholders = implode(',', array_fill(0, count($assignmentIds), '?'));
        try {
            $stmt = $this->conn->prepare("
                SELECT
                    h.history_id,
                    h.assignment_id,
                    h.session_id,
                    h.lesson_date,
                    h.progress_status,
                    h.lesson_notes,
                    h.created_at,
                    CONCAT_WS(' ', t.first_name, t.last_name) AS teacher_name
                FROM tbl_song_lesson_history h
                LEFT JOIN tbl_teachers t ON t.teacher_id = h.teacher_id
                WHERE h.assignment_id IN ({$placeholders})
                ORDER BY h.lesson_date DESC, h.history_id DESC
            ");
            $stmt->execute($assignmentIds);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($rows as $row) {
                $assignmentId = (int)($row['assignment_id'] ?? 0);
                if (!isset($map[$assignmentId])) {
                    $map[$assignmentId] = [];
                }
                $map[$assignmentId][] = $row;
            }
        } catch (PDOException $e) {
            return [];
        }

        return $map;
    }

    private function getAvailableSongCategories()
    {
        $categories = [];
        try {
            if ($this->tableExists('tbl_instrument_types')) {
                $stmt = $this->conn->prepare("
                    SELECT type_name
                    FROM tbl_instrument_types
                    WHERE type_name IS NOT NULL
                      AND TRIM(type_name) <> ''
                    ORDER BY type_name ASC
                ");
                $stmt->execute();
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                foreach ($rows as $row) {
                    $label = trim((string)($row['type_name'] ?? ''));
                    $value = strtolower($label);
                    if ($label === '' || isset($categories[$value])) {
                        continue;
                    }
                    $categories[$value] = [
                        'value' => $value,
                        'label' => $label
                    ];
                }
            }
        } catch (PDOException $e) {
            $categories = [];
        }

        if (!isset($categories['combined'])) {
            $categories['combined'] = [
                'value' => 'combined',
                'label' => 'Combined'
            ];
        }

        return array_values($categories);
    }

    private function isKnownSongCategory($category)
    {
        $category = $this->normalizeSongCategory($category);
        if ($category === '') {
            return false;
        }
        foreach ($this->getAvailableSongCategories() as $item) {
            if (($item['value'] ?? '') === $category) {
                return true;
            }
        }
        return false;
    }

    private function getStudentSongEligibility($studentId)
    {
        $studentId = (int)$studentId;
        $instrumentRows = [];
        $typeMap = [];
        $maxInstruments = 1;

        if ($studentId < 1) {
            return [
                'max_instruments' => 1,
                'instrument_types' => [],
                'instruments' => [],
                'allowed_categories' => []
            ];
        }

        try {
            if ($this->tableExists('tbl_enrollments') && $this->tableExists('tbl_session_packages')) {
                $stmtPackage = $this->conn->prepare("
                    SELECT COALESCE(sp.max_instruments, 1) AS max_instruments
                    FROM tbl_enrollments e
                    LEFT JOIN tbl_session_packages sp ON sp.package_id = e.package_id
                    WHERE e.student_id = ?
                    ORDER BY e.enrollment_id DESC
                    LIMIT 1
                ");
                $stmtPackage->execute([$studentId]);
                $maxInstruments = max(1, (int)($stmtPackage->fetchColumn() ?: 1));
            }
        } catch (PDOException $e) {
            $maxInstruments = 1;
        }

        try {
            if ($this->tableExists('tbl_student_instruments')) {
                $stmtInst = $this->conn->prepare("
                    SELECT
                        i.instrument_id,
                        i.instrument_name,
                        it.type_name
                    FROM tbl_student_instruments si
                    INNER JOIN tbl_instruments i ON i.instrument_id = si.instrument_id
                    LEFT JOIN tbl_instrument_types it ON it.type_id = i.type_id
                    WHERE si.student_id = ?
                    ORDER BY si.priority_order ASC, si.student_instrument_id ASC
                ");
                $stmtInst->execute([$studentId]);
                $instrumentRows = $stmtInst->fetchAll(PDO::FETCH_ASSOC) ?: [];
            }
        } catch (PDOException $e) {
            $instrumentRows = [];
        }

        foreach ($instrumentRows as $row) {
            $label = trim((string)($row['type_name'] ?? ''));
            $value = strtolower($label);
            if ($label !== '' && !isset($typeMap[$value])) {
                $typeMap[$value] = [
                    'value' => $value,
                    'label' => $label
                ];
            }
        }

        $allowedCategories = array_values($typeMap);
        if ($maxInstruments > 1 && count($allowedCategories) > 1) {
            $allowedCategories[] = [
                'value' => 'combined',
                'label' => 'Combined'
            ];
        }

        return [
            'max_instruments' => $maxInstruments,
            'instrument_types' => array_values($typeMap),
            'instruments' => $instrumentRows,
            'allowed_categories' => $allowedCategories
        ];
    }

    public function getSongCategories()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $this->sendJSON([
            'success' => true,
            'categories' => $this->getAvailableSongCategories()
        ]);
    }

    public function createSong()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        if (!$this->isMultipartRequest()) {
            $this->sendJSON(['error' => 'Song creation requires multipart form data'], 400);
        }

        $teacherId = $this->resolveTeacherId((int)($_POST['teacher_id'] ?? 0), (int)($_POST['user_id'] ?? 0));
        $title = trim((string)($_POST['title'] ?? ''));
        $artist = trim((string)($_POST['artist'] ?? ''));
        $genre = trim((string)($_POST['genre'] ?? ''));
        $category = $this->normalizeSongCategory($_POST['category'] ?? '');
        $difficultyLevel = trim((string)($_POST['difficulty_level'] ?? ''));
        $vocalRange = trim((string)($_POST['vocal_range'] ?? ''));
        $tags = trim((string)($_POST['tags'] ?? ''));
        $youtubeLink = trim((string)($_POST['youtube_link'] ?? ''));
        $spotifyLink = trim((string)($_POST['spotify_link'] ?? ''));
        $notes = trim((string)($_POST['notes'] ?? ''));

        if ($teacherId < 1) {
            $this->sendJSON(['error' => 'teacher_id or user_id is required'], 400);
        }
        if ($title === '') {
            $this->sendJSON(['error' => 'Song title is required'], 400);
        }
        if (!$this->isKnownSongCategory($category)) {
            $this->sendJSON(['error' => 'Category must match one of the current instrument types in the database.'], 400);
        }

        try {
            $sheetPath = $this->storeSongAssetUpload($_FILES['sheet_music_file'] ?? null, 'sheets', ['pdf'], 'sheet music');
            $audioPath = $this->storeSongAssetUpload($_FILES['accompaniment_audio_file'] ?? null, 'audio', ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'webm'], 'accompaniment audio');

            $stmt = $this->conn->prepare("
                INSERT INTO tbl_song_library (
                    teacher_id, title, artist, genre, category, difficulty_level, vocal_range,
                    tags, youtube_link, spotify_link, sheet_music_path, accompaniment_audio_path, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $teacherId,
                $title,
                ($artist !== '' ? $artist : null),
                ($genre !== '' ? $genre : null),
                $category,
                ($difficultyLevel !== '' ? $difficultyLevel : null),
                ($vocalRange !== '' ? $vocalRange : null),
                ($tags !== '' ? $tags : null),
                ($youtubeLink !== '' ? $youtubeLink : null),
                ($spotifyLink !== '' ? $spotifyLink : null),
                $sheetPath,
                $audioPath,
                ($notes !== '' ? $notes : null)
            ]);

            $this->sendJSON([
                'success' => true,
                'message' => 'Song added to the library.',
                'song_id' => (int)$this->conn->lastInsertId()
            ]);
        } catch (Exception $e) {
            $this->sendJSON(['error' => $e->getMessage()], 400);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function getSongs()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $teacherId = $this->resolveTeacherId((int)($_GET['teacher_id'] ?? 0), (int)($_GET['user_id'] ?? 0));
        $search = strtolower(trim((string)($_GET['search'] ?? '')));
        $category = $this->normalizeSongCategory($_GET['category'] ?? '');

        try {
            $sql = "
                SELECT
                    s.song_id,
                    s.teacher_id,
                    s.title,
                    s.artist,
                    s.genre,
                    s.category,
                    s.difficulty_level,
                    s.vocal_range,
                    s.tags,
                    s.youtube_link,
                    s.spotify_link,
                    s.sheet_music_path,
                    s.accompaniment_audio_path,
                    s.notes,
                    s.created_at,
                    s.updated_at,
                    CONCAT_WS(' ', t.first_name, t.last_name) AS teacher_name
                FROM tbl_song_library s
                LEFT JOIN tbl_teachers t ON t.teacher_id = s.teacher_id
                WHERE s.status = 'Active'
            ";
            $params = [];

            if ($teacherId > 0) {
                $sql .= " AND s.teacher_id = ? ";
                $params[] = $teacherId;
            }
            if ($category !== '') {
                $sql .= " AND s.category = ? ";
                $params[] = $category;
            }
            if ($search !== '') {
                $sql .= " AND LOWER(CONCAT_WS(' ', s.title, s.artist, s.genre, s.tags, s.notes)) LIKE ? ";
                $params[] = '%' . $search . '%';
            }

            $sql .= " ORDER BY s.title ASC, s.song_id DESC ";

            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $this->sendJSON(['success' => true, 'songs' => $rows]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function getTeacherStudents()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $teacherId = $this->resolveTeacherId((int)($_GET['teacher_id'] ?? 0), (int)($_GET['user_id'] ?? 0));
        if ($teacherId < 1) {
            $this->sendJSON(['error' => 'teacher_id or user_id is required'], 400);
        }

        try {
            $sql = "
                SELECT
                    s.student_id,
                    CONCAT_WS(' ', s.first_name, s.last_name) AS student_name,
                    s.email,
                    b.branch_name,
                    COALESCE(sp.package_name, CONCAT('Package #', e.package_id)) AS package_name,
                    COALESCE(inst.instrument_name, 'Unassigned Instrument') AS instrument_name,
                    COALESCE(sp.max_instruments, 1) AS max_instruments,
                    MAX(ts.session_date) AS latest_session_date
                FROM tbl_enrollments e
                INNER JOIN tbl_students s ON s.student_id = e.student_id
                LEFT JOIN tbl_branches b ON b.branch_id = s.branch_id
                LEFT JOIN tbl_session_packages sp ON sp.package_id = e.package_id
                LEFT JOIN tbl_instruments inst ON inst.instrument_id = e.instrument_id
                LEFT JOIN tbl_sessions ts ON ts.enrollment_id = e.enrollment_id AND ts.teacher_id = ?
                WHERE (e.assigned_teacher_id = ? OR ts.teacher_id = ?)
                GROUP BY s.student_id, s.first_name, s.last_name, s.email, b.branch_name, sp.package_name, e.package_id, inst.instrument_name, sp.max_instruments
                ORDER BY student_name ASC
            ";

            $stmt = $this->conn->prepare($sql);
            $stmt->execute([$teacherId, $teacherId, $teacherId]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($rows as &$row) {
                $eligibility = $this->getStudentSongEligibility((int)($row['student_id'] ?? 0));
                $row['song_eligibility'] = $eligibility;
            }
            unset($row);

            $this->sendJSON(['success' => true, 'students' => $rows]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function assignSong()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $teacherId = $this->resolveTeacherId((int)($data['teacher_id'] ?? 0), (int)($data['user_id'] ?? 0));
        $songId = (int)($data['song_id'] ?? 0);
        $studentId = (int)($data['student_id'] ?? 0);
        $progressStatus = $this->normalizeProgressStatus($data['progress_status'] ?? 'assigned');
        $assignedNotes = trim((string)($data['assigned_notes'] ?? ''));

        if ($teacherId < 1 || $songId < 1 || $studentId < 1) {
            $this->sendJSON(['error' => 'teacher_id/user_id, song_id, and student_id are required'], 400);
        }
        if ($progressStatus === '') {
            $progressStatus = 'assigned';
        }

        try {
            $stmtSong = $this->conn->prepare("
                SELECT category
                FROM tbl_song_library
                WHERE song_id = ?
                LIMIT 1
            ");
            $stmtSong->execute([$songId]);
            $songCategory = $this->normalizeSongCategory($stmtSong->fetchColumn() ?: '');
            if ($songCategory === '') {
                $this->sendJSON(['error' => 'Song not found or song category is invalid.'], 404);
            }

            $eligibility = $this->getStudentSongEligibility($studentId);
            $allowedCategoryValues = array_map(function ($item) {
                return strtolower((string)($item['value'] ?? ''));
            }, $eligibility['allowed_categories'] ?? []);

            if (empty($allowedCategoryValues)) {
                $this->sendJSON(['error' => 'This student has no instrument categories configured yet.'], 400);
            }

            if (!in_array($songCategory, $allowedCategoryValues, true)) {
                $allowedLabels = array_map(function ($item) {
                    return (string)($item['label'] ?? $item['value'] ?? '');
                }, $eligibility['allowed_categories'] ?? []);
                $this->sendJSON([
                    'error' => 'This song category does not match the student package/instrument setup. Allowed categories: ' . implode(', ', array_filter($allowedLabels))
                ], 400);
            }

            $stmtCheck = $this->conn->prepare("
                SELECT assignment_id
                FROM tbl_student_song_assignments
                WHERE teacher_id = ?
                  AND song_id = ?
                  AND student_id = ?
                LIMIT 1
            ");
            $stmtCheck->execute([$teacherId, $songId, $studentId]);
            $assignmentId = (int)($stmtCheck->fetchColumn() ?: 0);

            if ($assignmentId > 0) {
                $stmt = $this->conn->prepare("
                    UPDATE tbl_student_song_assignments
                    SET progress_status = ?,
                        assigned_notes = ?
                    WHERE assignment_id = ?
                ");
                $stmt->execute([
                    $progressStatus,
                    ($assignedNotes !== '' ? $assignedNotes : null),
                    $assignmentId
                ]);
            } else {
                $enrollmentId = 0;
                if ($this->tableExists('tbl_enrollments')) {
                    $stmtEnrollment = $this->conn->prepare("
                        SELECT enrollment_id
                        FROM tbl_enrollments
                        WHERE student_id = ?
                        ORDER BY enrollment_id DESC
                        LIMIT 1
                    ");
                    $stmtEnrollment->execute([$studentId]);
                    $enrollmentId = (int)($stmtEnrollment->fetchColumn() ?: 0);
                }

                $stmt = $this->conn->prepare("
                    INSERT INTO tbl_student_song_assignments (
                        song_id, student_id, teacher_id, enrollment_id, progress_status, assigned_notes
                    ) VALUES (?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([
                    $songId,
                    $studentId,
                    $teacherId,
                    ($enrollmentId > 0 ? $enrollmentId : null),
                    $progressStatus,
                    ($assignedNotes !== '' ? $assignedNotes : null)
                ]);
                $assignmentId = (int)$this->conn->lastInsertId();
            }

            $this->sendJSON([
                'success' => true,
                'message' => 'Song assigned successfully.',
                'assignment_id' => $assignmentId
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function getTeacherAssignments()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $teacherId = $this->resolveTeacherId((int)($_GET['teacher_id'] ?? 0), (int)($_GET['user_id'] ?? 0));
        $studentId = (int)($_GET['student_id'] ?? 0);
        $status = $this->normalizeProgressStatus($_GET['progress_status'] ?? '');

        if ($teacherId < 1) {
            $this->sendJSON(['error' => 'teacher_id or user_id is required'], 400);
        }

        try {
            $sql = "
                SELECT
                    a.assignment_id,
                    a.song_id,
                    a.student_id,
                    a.teacher_id,
                    a.enrollment_id,
                    a.progress_status,
                    a.assigned_notes,
                    a.assigned_at,
                    a.updated_at,
                    sl.title,
                    sl.artist,
                    sl.genre,
                    sl.category,
                    sl.difficulty_level,
                    sl.vocal_range,
                    sl.tags,
                    sl.youtube_link,
                    sl.spotify_link,
                    sl.sheet_music_path,
                    sl.accompaniment_audio_path,
                    sl.notes AS song_notes,
                    CONCAT_WS(' ', st.first_name, st.last_name) AS student_name,
                    st.email AS student_email
                FROM tbl_student_song_assignments a
                INNER JOIN tbl_song_library sl ON sl.song_id = a.song_id
                INNER JOIN tbl_students st ON st.student_id = a.student_id
                WHERE a.teacher_id = ?
            ";
            $params = [$teacherId];

            if ($studentId > 0) {
                $sql .= " AND a.student_id = ? ";
                $params[] = $studentId;
            }
            if ($status !== '') {
                $sql .= " AND a.progress_status = ? ";
                $params[] = $status;
            }

            $sql .= " ORDER BY a.updated_at DESC, a.assignment_id DESC ";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $historyMap = $this->fetchAssignmentHistoryMap(array_column($rows, 'assignment_id'));
            foreach ($rows as &$row) {
                $assignmentId = (int)($row['assignment_id'] ?? 0);
                $row['history'] = $historyMap[$assignmentId] ?? [];
            }
            unset($row);

            $this->sendJSON(['success' => true, 'assignments' => $rows]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function updateAssignmentProgress()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $teacherId = $this->resolveTeacherId((int)($data['teacher_id'] ?? 0), (int)($data['user_id'] ?? 0));
        $assignmentId = (int)($data['assignment_id'] ?? 0);
        $progressStatus = $this->normalizeProgressStatus($data['progress_status'] ?? '');
        $assignedNotes = trim((string)($data['assigned_notes'] ?? ''));

        if ($teacherId < 1 || $assignmentId < 1 || $progressStatus === '') {
            $this->sendJSON(['error' => 'teacher_id/user_id, assignment_id, and a valid progress_status are required'], 400);
        }

        try {
            $stmt = $this->conn->prepare("
                UPDATE tbl_student_song_assignments
                SET progress_status = ?,
                    assigned_notes = ?
                WHERE assignment_id = ?
                  AND teacher_id = ?
            ");
            $stmt->execute([
                $progressStatus,
                ($assignedNotes !== '' ? $assignedNotes : null),
                $assignmentId,
                $teacherId
            ]);

            $this->sendJSON([
                'success' => true,
                'message' => 'Song progress updated successfully.'
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function addLessonHistory()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $teacherId = $this->resolveTeacherId((int)($data['teacher_id'] ?? 0), (int)($data['user_id'] ?? 0));
        $assignmentId = (int)($data['assignment_id'] ?? 0);
        $lessonDate = trim((string)($data['lesson_date'] ?? date('Y-m-d')));
        $progressStatus = $this->normalizeProgressStatus($data['progress_status'] ?? '');
        $lessonNotes = trim((string)($data['lesson_notes'] ?? ''));
        $sessionId = (int)($data['session_id'] ?? 0);

        if ($teacherId < 1 || $assignmentId < 1 || $progressStatus === '') {
            $this->sendJSON(['error' => 'teacher_id/user_id, assignment_id, and progress_status are required'], 400);
        }
        if ($lessonDate === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $lessonDate)) {
            $this->sendJSON(['error' => 'lesson_date must be in YYYY-MM-DD format'], 400);
        }

        try {
            $stmtCheck = $this->conn->prepare("
                SELECT assignment_id
                FROM tbl_student_song_assignments
                WHERE assignment_id = ?
                  AND teacher_id = ?
                LIMIT 1
            ");
            $stmtCheck->execute([$assignmentId, $teacherId]);
            if (!(int)$stmtCheck->fetchColumn()) {
                $this->sendJSON(['error' => 'Assignment not found for this teacher'], 404);
            }

            $stmt = $this->conn->prepare("
                INSERT INTO tbl_song_lesson_history (
                    assignment_id, session_id, teacher_id, lesson_date, progress_status, lesson_notes
                ) VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $assignmentId,
                ($sessionId > 0 ? $sessionId : null),
                $teacherId,
                $lessonDate,
                $progressStatus,
                ($lessonNotes !== '' ? $lessonNotes : null)
            ]);

            $stmtUpdate = $this->conn->prepare("
                UPDATE tbl_student_song_assignments
                SET progress_status = ?
                WHERE assignment_id = ?
                  AND teacher_id = ?
            ");
            $stmtUpdate->execute([$progressStatus, $assignmentId, $teacherId]);

            $this->sendJSON([
                'success' => true,
                'message' => 'Lesson history saved successfully.'
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function getStudentAssignedSongs()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $studentId = $this->resolveStudentId((int)($_GET['student_id'] ?? 0), $_GET['email'] ?? '');
        if ($studentId < 1) {
            $this->sendJSON(['error' => 'student_id or email is required'], 400);
        }

        try {
            $stmt = $this->conn->prepare("
                SELECT
                    a.assignment_id,
                    a.song_id,
                    a.student_id,
                    a.teacher_id,
                    a.progress_status,
                    a.assigned_notes,
                    a.assigned_at,
                    a.updated_at,
                    sl.title,
                    sl.artist,
                    sl.genre,
                    sl.category,
                    sl.difficulty_level,
                    sl.vocal_range,
                    sl.tags,
                    sl.youtube_link,
                    sl.spotify_link,
                    sl.sheet_music_path,
                    sl.accompaniment_audio_path,
                    sl.notes AS song_notes,
                    CONCAT_WS(' ', t.first_name, t.last_name) AS teacher_name
                FROM tbl_student_song_assignments a
                INNER JOIN tbl_song_library sl ON sl.song_id = a.song_id
                LEFT JOIN tbl_teachers t ON t.teacher_id = a.teacher_id
                WHERE a.student_id = ?
                ORDER BY a.updated_at DESC, a.assignment_id DESC
            ");
            $stmt->execute([$studentId]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $historyMap = $this->fetchAssignmentHistoryMap(array_column($rows, 'assignment_id'));
            foreach ($rows as &$row) {
                $assignmentId = (int)($row['assignment_id'] ?? 0);
                $row['history'] = $historyMap[$assignmentId] ?? [];
            }
            unset($row);

            $this->sendJSON(['success' => true, 'songs' => $rows]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }
}

$api = new SongsApi($conn);
$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['action'])) {
        $action = (string)$_POST['action'];
    } else {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $action = $input['action'] ?? $action;
    }
}

switch ($action) {
    case 'get-song-categories':
        $api->getSongCategories();
        break;
    case 'create-song':
        $api->createSong();
        break;
    case 'get-songs':
        $api->getSongs();
        break;
    case 'get-teacher-students':
        $api->getTeacherStudents();
        break;
    case 'assign-song':
        $api->assignSong();
        break;
    case 'get-teacher-assignments':
        $api->getTeacherAssignments();
        break;
    case 'update-assignment-progress':
        $api->updateAssignmentProgress();
        break;
    case 'add-lesson-history':
        $api->addLessonHistory();
        break;
    case 'get-student-assigned-songs':
        $api->getStudentAssignedSongs();
        break;
    default:
        $api->sendJSON(['error' => 'Invalid action'], 400);
}
?>
