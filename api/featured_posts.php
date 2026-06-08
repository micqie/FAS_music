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

class FeaturedPosts
{
    private $conn;

    public function __construct($pdo)
    {
        $this->conn = $pdo;
    }

    public function sendJSON($data, $statusCode = 200)
    {
        http_response_code($statusCode);
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

    private function hasColumn($tableName, $columnName)
    {
        try {
            $stmt = $this->conn->prepare("SHOW COLUMNS FROM {$tableName} LIKE ?");
            $stmt->execute([$columnName]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            return false;
        }
    }

    private function ensureSchema()
    {
        try {
            if (!$this->tableExists('tbl_featured_posts')) {
                $this->conn->exec("
                    CREATE TABLE tbl_featured_posts (
                        featured_post_id INT NOT NULL AUTO_INCREMENT,
                        branch_id INT NULL,
                        title VARCHAR(180) NOT NULL,
                        category VARCHAR(80) NOT NULL,
                        content TEXT NOT NULL,
                        media_type ENUM('Image','Video') NOT NULL DEFAULT 'Image',
                        media_path VARCHAR(255) NOT NULL,
                        status ENUM('Draft','Published','Archived') NOT NULL DEFAULT 'Draft',
                        published_at DATETIME NULL,
                        created_by_user_id INT NULL,
                        updated_by_user_id INT NULL,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        PRIMARY KEY (featured_post_id),
                        KEY idx_featured_posts_status (status),
                        KEY idx_featured_posts_branch (branch_id),
                        KEY idx_featured_posts_published (published_at)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
                ");
                return;
            }

            $columns = [
                'branch_id' => "ALTER TABLE tbl_featured_posts ADD COLUMN branch_id INT NULL AFTER featured_post_id",
                'title' => "ALTER TABLE tbl_featured_posts ADD COLUMN title VARCHAR(180) NOT NULL AFTER branch_id",
                'category' => "ALTER TABLE tbl_featured_posts ADD COLUMN category VARCHAR(80) NOT NULL AFTER title",
                'content' => "ALTER TABLE tbl_featured_posts ADD COLUMN content TEXT NOT NULL AFTER category",
                'media_type' => "ALTER TABLE tbl_featured_posts ADD COLUMN media_type ENUM('Image','Video') NOT NULL DEFAULT 'Image' AFTER content",
                'media_path' => "ALTER TABLE tbl_featured_posts ADD COLUMN media_path VARCHAR(255) NOT NULL AFTER media_type",
                'status' => "ALTER TABLE tbl_featured_posts ADD COLUMN status ENUM('Draft','Published','Archived') NOT NULL DEFAULT 'Draft' AFTER media_path",
                'published_at' => "ALTER TABLE tbl_featured_posts ADD COLUMN published_at DATETIME NULL AFTER status",
                'created_by_user_id' => "ALTER TABLE tbl_featured_posts ADD COLUMN created_by_user_id INT NULL AFTER published_at",
                'updated_by_user_id' => "ALTER TABLE tbl_featured_posts ADD COLUMN updated_by_user_id INT NULL AFTER created_by_user_id",
                'created_at' => "ALTER TABLE tbl_featured_posts ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER updated_by_user_id",
                'updated_at' => "ALTER TABLE tbl_featured_posts ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
            ];

            foreach ($columns as $column => $sql) {
                if (!$this->hasColumn('tbl_featured_posts', $column)) {
                    $this->conn->exec($sql);
                }
            }
        } catch (PDOException $e) {
            // Keep endpoint available even if schema migration fails.
        }
    }

    private function normalizeRole($role)
    {
        return strtolower(trim((string)$role));
    }

    private function canManagePosts($roleName)
    {
        $role = $this->normalizeRole($roleName);
        return in_array($role, ['admin', 'manager', 'branch manager', 'staff', 'desk', 'front desk'], true);
    }

    private function getEditorContext($userId)
    {
        $stmt = $this->conn->prepare("
            SELECT u.user_id, u.branch_id, u.status, r.role_name, u.first_name, u.last_name, u.email
            FROM tbl_users u
            INNER JOIN tbl_roles r ON r.role_id = u.role_id
            WHERE u.user_id = ?
            LIMIT 1
        ");
        $stmt->execute([(int)$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            $this->sendJSON(['error' => 'User not found'], 404);
        }
        if (($user['status'] ?? '') !== 'Active') {
            $this->sendJSON(['error' => 'Your account is inactive'], 403);
        }
        if (!$this->canManagePosts((string)($user['role_name'] ?? ''))) {
            $this->sendJSON(['error' => 'You do not have permission to manage featured posts'], 403);
        }

        return $user;
    }

    private function normalizeMediaType($mediaType, $fileName = '')
    {
        $value = strtolower(trim((string)$mediaType));
        if (in_array($value, ['image', 'photo', 'photos'], true)) {
            return 'Image';
        }
        if (in_array($value, ['video', 'videos'], true)) {
            return 'Video';
        }

        $extension = strtolower(pathinfo((string)$fileName, PATHINFO_EXTENSION));
        if (in_array($extension, ['mp4', 'webm', 'ogv'], true)) {
            return 'Video';
        }
        return 'Image';
    }

    private function normalizeStatus($status)
    {
        $value = ucfirst(strtolower(trim((string)$status)));
        if (!in_array($value, ['Draft', 'Published', 'Archived'], true)) {
            return 'Draft';
        }
        return $value;
    }

    private function safeTrim($value)
    {
        return trim((string)$value);
    }

    private function getUploadBaseDir()
    {
        return dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'featured_posts';
    }

    private function deleteLocalFile($publicPath)
    {
        $publicPath = trim((string)$publicPath);
        if ($publicPath === '' || strpos($publicPath, 'uploads/featured_posts/') !== 0) {
            return;
        }

        $absolutePath = dirname(__DIR__) . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $publicPath);
        if (is_file($absolutePath)) {
            @unlink($absolutePath);
        }
    }

    private function storeMediaUpload($file, $mediaType)
    {
        if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            return null;
        }
        if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
            throw new Exception('Failed to upload media file.');
        }

        $isVideo = ($mediaType === 'Video');
        $maxBytes = $isVideo ? (80 * 1024 * 1024) : (10 * 1024 * 1024);
        $size = (int)($file['size'] ?? 0);
        if ($size < 1 || $size > $maxBytes) {
            throw new Exception($isVideo ? 'Video must be between 1 byte and 80MB.' : 'Image must be between 1 byte and 10MB.');
        }

        $tmpName = $file['tmp_name'] ?? '';
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            throw new Exception('Invalid uploaded media file.');
        }

        $originalName = (string)($file['name'] ?? '');
        $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        $allowedImageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
        $allowedVideoExtensions = ['mp4', 'webm', 'ogv'];
        $allowed = $isVideo ? $allowedVideoExtensions : $allowedImageExtensions;
        if (!in_array($extension, $allowed, true)) {
            throw new Exception($isVideo ? 'Video must be MP4, WEBM, or OGV.' : 'Image must be JPG, JPEG, PNG, WEBP, or GIF.');
        }

        $scope = $isVideo ? 'videos' : 'images';
        $baseDir = $this->getUploadBaseDir() . DIRECTORY_SEPARATOR . $scope;
        if (!is_dir($baseDir) && !mkdir($baseDir, 0777, true) && !is_dir($baseDir)) {
            throw new Exception('Unable to create upload directory.');
        }

        $safeName = date('YmdHis') . '_' . bin2hex(random_bytes(8)) . '.' . $extension;
        $targetPath = $baseDir . DIRECTORY_SEPARATOR . $safeName;
        if (!move_uploaded_file($tmpName, $targetPath)) {
            throw new Exception('Unable to save uploaded media file.');
        }

        return 'uploads/featured_posts/' . $scope . '/' . $safeName;
    }

    private function formatPostRow(array $row)
    {
        return [
            'featured_post_id' => (int)($row['featured_post_id'] ?? 0),
            'branch_id' => isset($row['branch_id']) ? (int)$row['branch_id'] : null,
            'branch_name' => $row['branch_name'] ?? null,
            'created_by_role_name' => trim((string)($row['created_by_role_name'] ?? '')),
            'title' => $row['title'] ?? '',
            'category' => $row['category'] ?? '',
            'content' => $row['content'] ?? '',
            'media_type' => $row['media_type'] ?? 'Image',
            'media_path' => $row['media_path'] ?? '',
            'status' => $row['status'] ?? 'Draft',
            'published_at' => $row['published_at'] ?? null,
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
            'created_by_user_id' => isset($row['created_by_user_id']) ? (int)$row['created_by_user_id'] : null,
            'updated_by_user_id' => isset($row['updated_by_user_id']) ? (int)$row['updated_by_user_id'] : null,
            'created_by_name' => trim((string)($row['created_by_name'] ?? '')),
        ];
    }

    private function listPublicPosts()
    {
        $this->ensureSchema();
        $limit = isset($_GET['limit']) ? max(1, min(24, (int)$_GET['limit'])) : 12;
        $stmt = $this->conn->prepare("
            SELECT fp.*, b.branch_name,
                   CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS created_by_name
            FROM tbl_featured_posts fp
            LEFT JOIN tbl_branches b ON b.branch_id = fp.branch_id
            LEFT JOIN tbl_users u ON u.user_id = fp.created_by_user_id
            WHERE fp.status = 'Published'
            ORDER BY fp.published_at DESC, fp.created_at DESC
            LIMIT {$limit}
        ");
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $posts = array_map([$this, 'formatPostRow'], $rows);
        $this->sendJSON(['success' => true, 'posts' => $posts]);
    }

    private function listEditorPosts($userId)
    {
        $editor = $this->getEditorContext($userId);
        $isAdmin = $this->normalizeRole($editor['role_name'] ?? '') === 'admin';
        $scope = $this->normalizeRole($_GET['scope'] ?? '');
        $params = [];
        $where = [];
        if (!$isAdmin) {
            $where[] = 'fp.branch_id = ?';
            $params[] = (int)($editor['branch_id'] ?? 0);
        }
        if ($scope === 'desk') {
            $where[] = "LOWER(r_creator.role_name) IN ('staff', 'desk', 'front desk')";
        } elseif ($scope === 'manager') {
            $where[] = "LOWER(r_creator.role_name) IN ('manager', 'branch manager', 'admin')";
        }
        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';
        $stmt = $this->conn->prepare("
            SELECT fp.*, b.branch_name,
                   r_creator.role_name AS created_by_role_name,
                   CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS created_by_name
            FROM tbl_featured_posts fp
            LEFT JOIN tbl_branches b ON b.branch_id = fp.branch_id
            LEFT JOIN tbl_users u ON u.user_id = fp.created_by_user_id
            LEFT JOIN tbl_roles r_creator ON r_creator.role_id = u.role_id
            {$whereSql}
            ORDER BY fp.created_at DESC, fp.featured_post_id DESC
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $posts = array_map([$this, 'formatPostRow'], $rows);
        $this->sendJSON([
            'success' => true,
            'posts' => $posts,
            'branch_id' => $editor['branch_id'] ?? null,
            'role_name' => $editor['role_name'] ?? ''
        ]);
    }

    private function savePost($json)
    {
        $isMultipart = stripos((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'multipart/form-data') !== false;
        $data = $isMultipart ? $_POST : json_decode($json, true);
        if (!is_array($data)) {
            $this->sendJSON(['error' => 'Invalid request data'], 400);
        }

        $userId = (int)($data['user_id'] ?? 0);
        if ($userId < 1) {
            $this->sendJSON(['error' => 'User ID is required'], 400);
        }

        $editor = $this->getEditorContext($userId);
        $isAdmin = $this->normalizeRole($editor['role_name'] ?? '') === 'admin';
        $postId = (int)($data['featured_post_id'] ?? 0);

        $title = $this->safeTrim($data['title'] ?? '');
        $category = $this->safeTrim($data['category'] ?? '');
        $content = $this->safeTrim($data['content'] ?? '');
        $status = $this->normalizeStatus($data['status'] ?? 'Draft');
        $mediaType = $this->normalizeMediaType($data['media_type'] ?? '', $_FILES['media_file']['name'] ?? '');
        $branchId = $isAdmin ? ((int)($data['branch_id'] ?? 0) ?: null) : (int)($editor['branch_id'] ?? 0);

        if ($title === '' || $category === '' || $content === '') {
            $this->sendJSON(['error' => 'Title, category, and content are required'], 400);
        }

        $this->ensureSchema();

        $existingPost = null;
        if ($postId > 0) {
            $stmtExisting = $this->conn->prepare("SELECT * FROM tbl_featured_posts WHERE featured_post_id = ? LIMIT 1");
            $stmtExisting->execute([$postId]);
            $existingPost = $stmtExisting->fetch(PDO::FETCH_ASSOC);
            if (!$existingPost) {
                $this->sendJSON(['error' => 'Post not found'], 404);
            }

            if (!$isAdmin && (int)($existingPost['branch_id'] ?? 0) !== (int)($editor['branch_id'] ?? 0)) {
                $this->sendJSON(['error' => 'You can only edit posts from your branch'], 403);
            }
        }

        $uploadedPath = null;
        if ($isMultipart && isset($_FILES['media_file']) && ($_FILES['media_file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
            $uploadedPath = $this->storeMediaUpload($_FILES['media_file'], $mediaType);
        }

        try {
            $this->conn->beginTransaction();

            if ($postId > 0) {
                $mediaPath = $existingPost['media_path'];
                if ($uploadedPath !== null) {
                    $mediaPath = $uploadedPath;
                }
                $publishedAt = $status === 'Published'
                    ? ($existingPost['published_at'] ?: date('Y-m-d H:i:s'))
                    : null;

                $stmt = $this->conn->prepare("
                    UPDATE tbl_featured_posts
                    SET branch_id = ?,
                        title = ?,
                        category = ?,
                        content = ?,
                        media_type = ?,
                        media_path = ?,
                        status = ?,
                        published_at = ?,
                        updated_by_user_id = ?
                    WHERE featured_post_id = ?
                ");
                $stmt->execute([
                    $branchId,
                    $title,
                    $category,
                    $content,
                    $mediaType,
                    $mediaPath,
                    $status,
                    $publishedAt,
                    $userId,
                    $postId
                ]);

                if ($uploadedPath !== null && !empty($existingPost['media_path']) && $existingPost['media_path'] !== $uploadedPath) {
                    $this->deleteLocalFile($existingPost['media_path']);
                }
            } else {
                if ($uploadedPath === null) {
                    $this->sendJSON(['error' => 'Please upload a photo or video for the post'], 400);
                }

                $publishedAt = $status === 'Published' ? date('Y-m-d H:i:s') : null;
                $stmt = $this->conn->prepare("
                    INSERT INTO tbl_featured_posts (
                        branch_id, title, category, content, media_type, media_path,
                        status, published_at, created_by_user_id, updated_by_user_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([
                    $branchId,
                    $title,
                    $category,
                    $content,
                    $mediaType,
                    $uploadedPath,
                    $status,
                    $publishedAt,
                    $userId,
                    $userId
                ]);
                $postId = (int)$this->conn->lastInsertId();
            }

            $this->conn->commit();

            $stmtPost = $this->conn->prepare("
                SELECT fp.*, b.branch_name,
                       CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS created_by_name
                FROM tbl_featured_posts fp
                LEFT JOIN tbl_branches b ON b.branch_id = fp.branch_id
                LEFT JOIN tbl_users u ON u.user_id = fp.created_by_user_id
                WHERE fp.featured_post_id = ?
                LIMIT 1
            ");
            $stmtPost->execute([$postId]);
            $savedPost = $stmtPost->fetch(PDO::FETCH_ASSOC);

            $this->sendJSON([
                'success' => true,
                'message' => $postId > 0 ? 'Featured post saved successfully.' : 'Featured post created successfully.',
                'post' => $savedPost ? $this->formatPostRow($savedPost) : null
            ]);
        } catch (PDOException $e) {
            if ($this->conn && $this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        } catch (Exception $e) {
            if ($this->conn && $this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            $this->sendJSON(['error' => 'Unable to save featured post: ' . $e->getMessage()], 500);
        }
    }

    private function toggleStatus($json)
    {
        $data = json_decode($json, true);
        if (!is_array($data)) {
            $this->sendJSON(['error' => 'Invalid request data'], 400);
        }

        $userId = (int)($data['user_id'] ?? 0);
        $postId = (int)($data['featured_post_id'] ?? 0);
        if ($userId < 1 || $postId < 1) {
            $this->sendJSON(['error' => 'User ID and post ID are required'], 400);
        }

        $editor = $this->getEditorContext($userId);
        $isAdmin = $this->normalizeRole($editor['role_name'] ?? '') === 'admin';

        $stmt = $this->conn->prepare("SELECT * FROM tbl_featured_posts WHERE featured_post_id = ? LIMIT 1");
        $stmt->execute([$postId]);
        $post = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$post) {
            $this->sendJSON(['error' => 'Post not found'], 404);
        }
        if (!$isAdmin && (int)($post['branch_id'] ?? 0) !== (int)($editor['branch_id'] ?? 0)) {
            $this->sendJSON(['error' => 'You can only manage posts from your branch'], 403);
        }

        $status = $this->normalizeStatus($data['status'] ?? 'Draft');
        $publishedAt = $status === 'Published' ? ($post['published_at'] ?: date('Y-m-d H:i:s')) : null;

        $update = $this->conn->prepare("
            UPDATE tbl_featured_posts
            SET status = ?,
                published_at = ?,
                updated_by_user_id = ?
            WHERE featured_post_id = ?
        ");
        $update->execute([$status, $publishedAt, $userId, $postId]);

        $this->sendJSON([
            'success' => true,
            'message' => 'Post status updated successfully.'
        ]);
    }

    private function deletePost($json)
    {
        $data = json_decode($json, true);
        if (!is_array($data)) {
            $this->sendJSON(['error' => 'Invalid request data'], 400);
        }

        $userId = (int)($data['user_id'] ?? 0);
        $postId = (int)($data['featured_post_id'] ?? 0);
        if ($userId < 1 || $postId < 1) {
            $this->sendJSON(['error' => 'User ID and post ID are required'], 400);
        }

        $editor = $this->getEditorContext($userId);
        $isAdmin = $this->normalizeRole($editor['role_name'] ?? '') === 'admin';

        $stmt = $this->conn->prepare("SELECT * FROM tbl_featured_posts WHERE featured_post_id = ? LIMIT 1");
        $stmt->execute([$postId]);
        $post = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$post) {
            $this->sendJSON(['error' => 'Post not found'], 404);
        }
        if (!$isAdmin && (int)($post['branch_id'] ?? 0) !== (int)($editor['branch_id'] ?? 0)) {
            $this->sendJSON(['error' => 'You can only delete posts from your branch'], 403);
        }

        try {
            $this->conn->beginTransaction();
            $delete = $this->conn->prepare("DELETE FROM tbl_featured_posts WHERE featured_post_id = ?");
            $delete->execute([$postId]);
            $this->conn->commit();

            if (!empty($post['media_path'])) {
                $this->deleteLocalFile($post['media_path']);
            }

            $this->sendJSON([
                'success' => true,
                'message' => 'Post deleted successfully.'
            ]);
        } catch (PDOException $e) {
            if ($this->conn && $this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function handle($action)
    {
        switch ($action) {
            case 'list-public':
            case '':
                $this->listPublicPosts();
                break;
            case 'list-editor':
                if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
                    $this->sendJSON(['error' => 'Method not allowed'], 405);
                }
                $this->listEditorPosts($_GET['user_id'] ?? 0);
                break;
            case 'save':
                if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                    $this->sendJSON(['error' => 'Method not allowed'], 405);
                }
                $this->savePost(file_get_contents('php://input'));
                break;
            case 'toggle-status':
                if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                    $this->sendJSON(['error' => 'Method not allowed'], 405);
                }
                $this->toggleStatus(file_get_contents('php://input'));
                break;
            case 'delete':
                if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                    $this->sendJSON(['error' => 'Method not allowed'], 405);
                }
                $this->deletePost(file_get_contents('php://input'));
                break;
            default:
                $this->sendJSON(['error' => 'Invalid action'], 400);
        }
    }
}

$featuredPosts = new FeaturedPosts($conn);
$featuredPosts->handle($_GET['action'] ?? 'list-public');
