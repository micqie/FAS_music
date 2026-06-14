<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Only require db_connect when running standalone (not included by another API)
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    require_once 'db_connect.php';
}

class AuditLogs
{
    private $conn;

    public function __construct($pdo)
    {
        $this->conn = $pdo;
        $this->ensureTable();
    }

    public function sendJSON($data, $status = 200)
    {
        http_response_code($status);
        echo json_encode($data);
        exit;
    }

    // ── Auto-create / migrate the audit log table ────────────────────
    private function ensureTable()
    {
        try {
            // Create table with the minimal schema if it doesn't exist
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS tbl_audit_logs (
                    log_id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    user_id       INT          NULL,
                    user_email    VARCHAR(255) NULL,
                    action        VARCHAR(100) NOT NULL,
                    target_table  VARCHAR(100) NULL,
                    target_id     INT          NULL,
                    description   TEXT         NULL,
                    ip_address    VARCHAR(45)  NULL,
                    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_user_id   (user_id),
                    INDEX idx_action    (action),
                    INDEX idx_created_at(created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
        } catch (\PDOException $e) { /* already exists — fine */ }

        // ── ADD missing columns if they don't exist yet ──
        $addColumns = [
            'user_name'    => "ALTER TABLE tbl_audit_logs ADD COLUMN user_name    VARCHAR(120) NULL AFTER user_id",
            'user_role'    => "ALTER TABLE tbl_audit_logs ADD COLUMN user_role    VARCHAR(60)  NULL AFTER user_name",
            'module'       => "ALTER TABLE tbl_audit_logs ADD COLUMN module       VARCHAR(80)  NOT NULL DEFAULT 'General' AFTER action",
            'target_type'  => "ALTER TABLE tbl_audit_logs ADD COLUMN target_type  VARCHAR(80)  NULL AFTER module",
            'target_label' => "ALTER TABLE tbl_audit_logs ADD COLUMN target_label VARCHAR(255) NULL AFTER target_id",
            'severity'     => "ALTER TABLE tbl_audit_logs ADD COLUMN severity     ENUM('info','warning','critical') NOT NULL DEFAULT 'info' AFTER description",
            'old_value'    => "ALTER TABLE tbl_audit_logs ADD COLUMN old_value    JSON NULL AFTER severity",
            'new_value'    => "ALTER TABLE tbl_audit_logs ADD COLUMN new_value    JSON NULL AFTER old_value",
            'user_agent'   => "ALTER TABLE tbl_audit_logs ADD COLUMN user_agent   VARCHAR(512) NULL AFTER ip_address",
        ];

        foreach ($addColumns as $col => $sql) {
            if (!$this->columnExists('tbl_audit_logs', $col)) {
                try { $this->conn->exec($sql); } catch (\PDOException $e) { /* skip */ }
            }
        }

        // Add module index if missing
        try { $this->conn->exec("ALTER TABLE tbl_audit_logs ADD INDEX idx_audit_module (module)");   } catch (\PDOException $e) {}
        try { $this->conn->exec("ALTER TABLE tbl_audit_logs ADD INDEX idx_audit_severity (severity)"); } catch (\PDOException $e) {}
    }

    private function columnExists($table, $column)
    {
        try {
            $stmt = $this->conn->prepare("SHOW COLUMNS FROM `{$table}` LIKE ?");
            $stmt->execute([$column]);
            return $stmt->rowCount() > 0;
        } catch (\PDOException $e) {
            return false;
        }
    }

    // ── Write a log entry (called internally or from other APIs) ──────
    public static function record(
        $pdo,
        $action,
        $module         = 'General',
        $description    = null,
        $targetType     = null,
        $targetId       = null,
        $targetLabel    = null,
        $severity       = 'info',
        $oldValue       = null,
        $newValue       = null,
        $userId         = null,
        $userName       = null,
        $userRole       = null,
        $userEmail      = null
    ) {
        try {
            // Ensure table exists before writing (safe no-op if already present)
            static $tableReady = false;
            if (!$tableReady) {
                try {
                    $pdo->exec("CREATE TABLE IF NOT EXISTS tbl_audit_logs (
                        log_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NULL, user_email VARCHAR(255) NULL,
                        user_name VARCHAR(120) NULL, user_role VARCHAR(60) NULL,
                        action VARCHAR(100) NOT NULL,
                        module VARCHAR(80) NOT NULL DEFAULT 'General',
                        target_type VARCHAR(80) NULL, target_table VARCHAR(100) NULL,
                        target_id INT NULL, target_label VARCHAR(255) NULL,
                        description TEXT NULL, ip_address VARCHAR(45) NULL,
                        user_agent VARCHAR(512) NULL,
                        severity ENUM('info','warning','critical') NOT NULL DEFAULT 'info',
                        old_value JSON NULL, new_value JSON NULL,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_action(action), INDEX idx_created_at(created_at)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
                } catch (\PDOException $e) { /* already exists */ }
                $tableReady = true;
            }

            $ip      = $_SERVER['REMOTE_ADDR']     ?? null;
            $ua      = $_SERVER['HTTP_USER_AGENT'] ?? null;
            $oldJson = $oldValue !== null ? json_encode($oldValue) : null;
            $newJson = $newValue !== null ? json_encode($newValue) : null;

            $stmt = $pdo->prepare("
                INSERT INTO tbl_audit_logs
                    (user_id, user_email, user_name, user_role,
                     action, module,
                     target_type, target_table, target_id, target_label,
                     description, ip_address, user_agent,
                     severity, old_value, new_value)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ");
            $stmt->execute([
                $userId, $userEmail, $userName, $userRole,
                $action, $module,
                $targetType, $targetType,
                $targetId, $targetLabel,
                $description,
                $ip, $ua ? substr($ua, 0, 512) : null,
                $severity, $oldJson, $newJson
            ]);
        } catch (\PDOException $e) {
            // Silent — audit failure must never break the main request
        }
    }

    // ── GET /api/audit_logs.php?action=get-logs ───────────────────────
    public function getLogs()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $module    = trim((string)($_GET['module']   ?? ''));
        $severity  = strtolower(trim((string)($_GET['severity'] ?? '')));
        $search    = trim((string)($_GET['search']   ?? ''));
        $dateFrom  = trim((string)($_GET['date_from'] ?? ''));
        $dateTo    = trim((string)($_GET['date_to']   ?? ''));
        $userId    = (int)($_GET['user_id'] ?? 0);
        $page      = max(1, (int)($_GET['page']  ?? 1));
        $perPage   = min(200, max(10, (int)($_GET['per_page'] ?? 50)));
        $offset    = ($page - 1) * $perPage;

        $where  = ['1=1'];
        $params = [];

        if ($module !== '') {
            if ($this->columnExists('tbl_audit_logs', 'module')) {
                $where[]  = 'module = ?';
                $params[] = $module;
            }
        }
        if (in_array($severity, ['info','warning','critical'], true)) {
            if ($this->columnExists('tbl_audit_logs', 'severity')) {
                $where[]  = 'severity = ?';
                $params[] = $severity;
            }
        }
        if ($userId > 0) {
            $where[]  = 'user_id = ?';
            $params[] = $userId;
        }
        if ($dateFrom !== '') {
            $where[]  = 'DATE(created_at) >= ?';
            $params[] = $dateFrom;
        }
        if ($dateTo !== '') {
            $where[]  = 'DATE(created_at) <= ?';
            $params[] = $dateTo;
        }
        if ($search !== '') {
            $hasUserName   = $this->columnExists('tbl_audit_logs', 'user_name');
            $hasTargetLabel = $this->columnExists('tbl_audit_logs', 'target_label');
            $userCol   = $hasUserName    ? 'user_name'   : 'user_email';
            $targetCol = $hasTargetLabel ? 'target_label' : 'description';
            $where[]  = "(action LIKE ? OR description LIKE ? OR {$userCol} LIKE ? OR {$targetCol} LIKE ?)";
            $like     = '%' . $search . '%';
            $params   = array_merge($params, [$like, $like, $like, $like]);
        }

        $whereClause = implode(' AND ', $where);

        try {
            // Total count
            $countStmt = $this->conn->prepare("SELECT COUNT(*) FROM tbl_audit_logs WHERE {$whereClause}");
            $countStmt->execute($params);
            $total = (int)$countStmt->fetchColumn();

            // Rows
            $stmt = $this->conn->prepare("
                SELECT log_id, user_id,
                       COALESCE(NULLIF(TRIM(COALESCE(user_name,'')), ''), user_email) AS user_name,
                       user_email,
                       user_role,
                       action,
                       COALESCE(module, 'General') AS module,
                       COALESCE(target_type, target_table) AS target_type,
                       target_id,
                       target_label,
                       description,
                       ip_address,
                       COALESCE(severity, 'info') AS severity,
                       old_value, new_value, created_at
                FROM tbl_audit_logs
                WHERE {$whereClause}
                ORDER BY created_at DESC, log_id DESC
                LIMIT ? OFFSET ?
            ");

            // Bind filter params first, then LIMIT/OFFSET as explicit integers
            $paramIndex = 1;
            foreach ($params as $val) {
                $stmt->bindValue($paramIndex++, $val);
            }
            $stmt->bindValue($paramIndex++, $perPage, \PDO::PARAM_INT);
            $stmt->bindValue($paramIndex++, $offset,  \PDO::PARAM_INT);
            $stmt->execute();
            $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];

            // Decode JSON snapshots
            foreach ($rows as &$row) {
                if ($row['old_value'] !== null) {
                    $row['old_value'] = json_decode($row['old_value'], true);
                }
                if ($row['new_value'] !== null) {
                    $row['new_value'] = json_decode($row['new_value'], true);
                }
            }
            unset($row);

            $this->sendJSON([
                'success'    => true,
                'total'      => $total,
                'page'       => $page,
                'per_page'   => $perPage,
                'total_pages'=> (int)ceil($total / $perPage),
                'logs'       => $rows
            ]);
        } catch (\PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    // ── GET ?action=get-modules  (for filter dropdown) ────────────────
    public function getModules()
    {
        try {
            // Guard: module column might not exist on very first call before migration
            if (!$this->columnExists('tbl_audit_logs', 'module')) {
                $this->sendJSON(['success' => true, 'modules' => []]);
            }
            $stmt = $this->conn->query("
                SELECT DISTINCT module FROM tbl_audit_logs
                WHERE module IS NOT NULL AND TRIM(module) <> ''
                ORDER BY module ASC
            ");
            $modules = $stmt->fetchAll(\PDO::FETCH_COLUMN) ?: [];
            $this->sendJSON(['success' => true, 'modules' => $modules]);
        } catch (\PDOException $e) {
            $this->sendJSON(['success' => true, 'modules' => []]);
        }
    }

    // ── GET ?action=get-stats  (summary cards) ────────────────────────
    public function getStats()
    {
        try {
            $hasSeverity = $this->columnExists('tbl_audit_logs', 'severity');
            if ($hasSeverity) {
                $stmt = $this->conn->query("
                    SELECT
                        COUNT(*) AS total_logs,
                        SUM(severity = 'info')     AS info_count,
                        SUM(severity = 'warning')  AS warning_count,
                        SUM(severity = 'critical') AS critical_count,
                        SUM(DATE(created_at) = CURDATE()) AS today_count
                    FROM tbl_audit_logs
                ");
            } else {
                $stmt = $this->conn->query("
                    SELECT
                        COUNT(*) AS total_logs,
                        COUNT(*) AS info_count,
                        0 AS warning_count,
                        0 AS critical_count,
                        SUM(DATE(created_at) = CURDATE()) AS today_count
                    FROM tbl_audit_logs
                ");
            }
            $row = $stmt->fetch(\PDO::FETCH_ASSOC) ?: [];
            $this->sendJSON(['success' => true, 'stats' => $row]);
        } catch (\PDOException $e) {
            $this->sendJSON(['success' => true, 'stats' => [
                'total_logs' => 0, 'info_count' => 0,
                'warning_count' => 0, 'critical_count' => 0, 'today_count' => 0
            ]]);
        }
    }

    // ── GET ?action=seed  (insert sample data for testing) ───────────
    public function seedTestData()
    {
        $samples = [
            ['Admin Login',            'Users',         'info',     'Administrator logged in successfully.',                    'user',     1,  'admin@fas.com',      null, null],
            ['Student Approved',       'Registrations', 'info',     'Registration approved for Juan dela Cruz.',                'student',  5,  'Juan dela Cruz',     ['status'=>'Pending'], ['status'=>'Active']],
            ['Payment Confirmed',      'Payments',      'info',     'Payment of ₱7,450.00 confirmed for Maria Santos.',        'payment',  12, 'Maria Santos',       null, ['amount'=>7450,'method'=>'GCash']],
            ['Session Cancelled',      'Sessions',      'warning',  'Session #34 cancelled by teacher — needs rescheduling.',  'session',  34, 'Session #34',        ['status'=>'Scheduled'], ['status'=>'Cancelled']],
            ['User Role Changed',      'Users',         'warning',  'User role updated from Staff to Manager.',                 'user',     8,  'desk.staff@fas.com', ['role'=>'Staff'], ['role'=>'Manager']],
            ['Student Rejected',       'Registrations', 'warning',  'Registration rejected — incomplete documents submitted.',  'student',  7,  'Pedro Reyes',        null, null],
            ['Unauthorized Access',    'General',       'critical', 'Failed login attempt detected from IP 192.168.1.100.',    null,       null, null,                null, null],
            ['Bulk Session Generated', 'Sessions',      'info',     '12 sessions generated for enrollment #88.',               'enrollment',88, 'Enrollment #88',    null, null],
            ['Teacher Assigned',       'Teachers',      'info',     'Teacher Messi Hersomach assigned to enrollment #91.',     'enrollment',91, 'Enrollment #91',    ['teacher'=>null], ['teacher'=>'Messi Hersomach']],
            ['Package Created',        'Packages',      'info',     'New package "12 Session Premium" created.',               'package',  3,  '12 Session Premium', null, ['sessions'=>12,'price'=>7450]],
            ['Enrollment Activated',   'Enrollments',   'info',     'Enrollment activated for Ana Garcia — Guitar package.',   'enrollment',45, 'Ana Garcia',        ['status'=>'Pending'], ['status'=>'Active']],
            ['Password Reset',         'Users',         'warning',  'Password reset triggered for user desk.staff@fas.com.',  'user',     8,  'desk.staff@fas.com', null, null],
            ['Branch Created',         'Branches',      'info',     'New branch "SM Uptown" created successfully.',            'branch',   2,  'SM Uptown',          null, ['branch_name'=>'SM Uptown']],
            ['Critical DB Error',      'General',       'critical', 'Database backup failed — storage quota exceeded.',       null,       null, null,                null, null],
            ['Report Exported',        'Reports',       'info',     'Monthly revenue report exported to CSV.',                 null,       null, null,                null, null],
        ];

        $users = [
            [1, 'admin@fas.com',         'Super Admin',    'admin'],
            [2, 'manager@fas.com',        'Branch Manager', 'manager'],
            [3, 'desk.staff@fas.com',     'Desk Staff 1',   'staff'],
        ];

        $inserted = 0;
        foreach ($samples as $i => $s) {
            [$action, $module, $severity, $desc, $targetType, $targetId, $targetLabel, $old, $new] = $s;
            $u = $users[$i % count($users)];
            self::record(
                $this->conn, $action, $module, $desc,
                $targetType, $targetId, $targetLabel,
                $severity, $old, $new,
                $u[0], $u[1], $u[3], $u[1]
            );
            $inserted++;
        }

        $this->sendJSON(['success' => true, 'message' => "{$inserted} sample audit log entries inserted. Refresh the page to see them."]);
    }
    public function logEntry()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $action      = trim((string)($data['action_name']  ?? ''));
        $module      = trim((string)($data['module']       ?? 'General'));
        $description = trim((string)($data['description']  ?? ''));
        $targetType  = trim((string)($data['target_type']  ?? '')) ?: null;
        $targetId    = isset($data['target_id'])   ? (int)$data['target_id']   : null;
        $targetLabel = trim((string)($data['target_label'] ?? '')) ?: null;
        $severity    = in_array($data['severity'] ?? '', ['info','warning','critical'], true)
                       ? $data['severity'] : 'info';
        $userId      = isset($data['user_id'])   ? (int)$data['user_id']   : null;
        $userName    = trim((string)($data['user_name']  ?? '')) ?: null;
        $userRole    = trim((string)($data['user_role']  ?? '')) ?: null;
        $oldValue    = $data['old_value'] ?? null;
        $newValue    = $data['new_value'] ?? null;

        if ($action === '') {
            $this->sendJSON(['error' => 'action_name is required'], 400);
        }

        self::record(
            $this->conn, $action, $module, $description ?: null,
            $targetType, $targetId, $targetLabel,
            $severity, $oldValue, $newValue,
            $userId, $userName, $userRole
        );

        $this->sendJSON(['success' => true, 'message' => 'Log entry recorded.']);
    }
}

// ── Router (only runs when this file is the entry point) ────────────
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    // Only send headers and run router when called directly
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

    if (!isset($conn) || $conn === null) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        exit;
    }

    $api    = new AuditLogs($conn);
    $action = strtolower(trim((string)($_GET['action'] ?? '')));

    switch ($action) {
        case 'get-logs':
            $api->getLogs();
            break;
        case 'get-modules':
            $api->getModules();
            break;
        case 'get-stats':
            $api->getStats();
            break;
        case 'log':
            $api->logEntry();
            break;
        case 'seed':
            $api->seedTestData();
            break;
        default:
            $api->sendJSON(['error' => 'Invalid action'], 400);
    }
}
?>
