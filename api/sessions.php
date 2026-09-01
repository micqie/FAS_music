<?php
// Suppress error display for JSON APIs
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once 'db_connect.php';
require_once 'auth_session.php';
require_once 'xss_protection.php';  // XSS Protection utilities

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Send security headers
XSSProtection::sendSecurityHeaders();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

// Check if database connection exists
if (!isset($conn) || $conn === null) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

class SessionPackages
{
    private $conn;

    public function __construct($pdo)
    {
        $this->conn = $pdo;
        $this->ensureTable();
    }

    private function ensureTable()
    {
        $this->conn->exec("
            CREATE TABLE IF NOT EXISTS tbl_session_packages (
                package_id INT AUTO_INCREMENT PRIMARY KEY,
                branch_id INT NULL,
                package_name VARCHAR(100) NOT NULL,
                sessions INT NOT NULL,
                max_instruments TINYINT NOT NULL DEFAULT 1,
                price DECIMAL(10,2) NOT NULL DEFAULT 0,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ");
        $this->ensureBranchColumn();
        $this->ensurePriceColumn();
        $stmt = $this->conn->query("SELECT COUNT(*) FROM tbl_session_packages");
        if ((int) $stmt->fetchColumn() === 0) {
            $defaultBranchId = $this->getDefaultBranchId();
            if ($defaultBranchId > 0) {
                $stmtInsert = $this->conn->prepare("
                    INSERT INTO tbl_session_packages (branch_id, package_name, sessions, max_instruments, price, description) VALUES
                    (?, 'Basic (12 Sessions)', 12, 1, 7450.00, '1 instrument only'),
                    (?, 'Standard (20 Sessions)', 20, 2, 11800.00, '2 instruments'),
                    (?, 'Premium (50 Sessions)', 50, 3, 29500.00, 'Up to 3 instruments')
                ");
                $stmtInsert->execute([$defaultBranchId, $defaultBranchId, $defaultBranchId]);
            } else {
                $this->conn->exec("
                    INSERT INTO tbl_session_packages (package_name, sessions, max_instruments, price, description) VALUES
                    ('Basic (12 Sessions)', 12, 1, 7450.00, '1 instrument only'),
                    ('Standard (20 Sessions)', 20, 2, 11800.00, '2 instruments'),
                    ('Premium (50 Sessions)', 50, 3, 29500.00, 'Up to 3 instruments')
                ");
            }
        }
    }

    private function ensureBranchColumn()
    {
        try {
            $stmt = $this->conn->query("SHOW COLUMNS FROM tbl_session_packages LIKE 'branch_id'");
            if ($stmt->rowCount() === 0) {
                $this->conn->exec("ALTER TABLE tbl_session_packages ADD COLUMN branch_id INT NULL AFTER package_id");
            }
        } catch (PDOException $e) {
            // Column may already exist
        }

        try {
            $defaultBranchId = $this->getDefaultBranchId();
            if ($defaultBranchId > 0) {
                $stmt = $this->conn->prepare("
                    UPDATE tbl_session_packages
                    SET branch_id = ?
                    WHERE branch_id IS NULL OR branch_id = 0
                ");
                $stmt->execute([$defaultBranchId]);
            }
        } catch (PDOException $e) {
            // Backfill best effort only
        }

        try {
            $this->conn->exec("CREATE INDEX idx_session_packages_branch ON tbl_session_packages(branch_id)");
        } catch (PDOException $e) {
            // Index may already exist
        }
    }

    private function ensurePriceColumn()
    {
        try {
            $stmt = $this->conn->query("SHOW COLUMNS FROM tbl_session_packages LIKE 'price'");
            if ($stmt->rowCount() === 0) {
                $this->conn->exec("ALTER TABLE tbl_session_packages ADD COLUMN price DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER max_instruments");
            }
        } catch (PDOException $e) {
            // Column may already exist
        }
    }

    private function getDefaultBranchId()
    {
        try {
            $stmt = $this->conn->query("SELECT branch_id FROM tbl_branches WHERE status = 'Active' ORDER BY branch_name ASC LIMIT 1");
            $id = (int) $stmt->fetchColumn();
            if ($id > 0) return $id;
        } catch (PDOException $e) {
            // Ignore and try fallback
        }

        try {
            $stmt = $this->conn->query("SELECT branch_id FROM tbl_branches ORDER BY branch_name ASC LIMIT 1");
            return (int) $stmt->fetchColumn();
        } catch (PDOException $e) {
            return 0;
        }
    }

    private function branchExists($branchId)
    {
        try {
            $stmt = $this->conn->prepare("SELECT branch_id FROM tbl_branches WHERE branch_id = ? LIMIT 1");
            $stmt->execute([(int) $branchId]);
            return (bool) $stmt->fetchColumn();
        } catch (PDOException $e) {
            return false;
        }
    }

    private function normalizeName($value): string
    {
        return preg_replace('/\s+/', ' ', trim((string)$value));
    }

    private function packageNameExists(int $branchId, string $name, int $excludeId = 0): bool
    {
        $sql = "SELECT package_id FROM tbl_session_packages
                WHERE branch_id = ? AND LOWER(TRIM(package_name)) = LOWER(?)";
        $params = [$branchId, $name];
        if ($excludeId > 0) {
            $sql .= " AND package_id <> ?";
            $params[] = $excludeId;
        }
        $sql .= " LIMIT 1";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);
        return (bool)$stmt->fetchColumn();
    }

    public function sendJSON($data, $statusCode = 200)
    {
        http_response_code($statusCode);
        echo json_encode($data);
        exit;
    }

    public function getPackages()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }
        $branchId = isset($_GET['branch_id']) ? (int) $_GET['branch_id'] : 0;
        try {
            $sql = "
                SELECT
                    sp.package_id,
                    sp.branch_id,
                    COALESCE(b.branch_name, '') AS branch_name,
                    sp.package_name,
                    sp.sessions,
                    sp.max_instruments,
                    COALESCE(sp.price, 0) AS price,
                    sp.description
                FROM tbl_session_packages sp
                LEFT JOIN tbl_branches b ON sp.branch_id = b.branch_id
            ";
            $params = [];
            if ($branchId > 0) {
                $sql .= " WHERE sp.branch_id = ? ";
                $params[] = $branchId;
            }
            $sql .= " ORDER BY b.branch_name ASC, sp.sessions ASC, sp.package_id ASC ";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);
            $packages = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $this->sendJSON(['success' => true, 'packages' => $packages]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function addPackage()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $name = $this->normalizeName($data['package_name'] ?? '');
        $branchId = (int) ($data['branch_id'] ?? 0);
        $sessions = (int) ($data['sessions'] ?? 0);
        $maxInstruments = (int) ($data['max_instruments'] ?? 1);
        $price = isset($data['price']) ? (float) $data['price'] : 0;
        $description = trim($data['description'] ?? '');

        if ($branchId < 1) {
            $this->sendJSON(['error' => 'Branch is required'], 400);
        }
        if (!$this->branchExists($branchId)) {
            $this->sendJSON(['error' => 'Selected branch was not found'], 400);
        }
        if ($name === '') {
            $this->sendJSON(['error' => 'Package name is required'], 400);
        }
        if ($sessions < 1) {
            $this->sendJSON(['error' => 'Sessions must be at least 1'], 400);
        }
        if ($maxInstruments < 1 || $maxInstruments > 3) {
            $this->sendJSON(['error' => 'Max instruments must be 1, 2, or 3'], 400);
        }

        try {
            if ($this->packageNameExists($branchId, $name)) {
                $this->sendJSON(['error' => 'Package name already exists in this branch (names are checked without regard to capitalization)'], 409);
            }

            $stmt = $this->conn->prepare("
                INSERT INTO tbl_session_packages (branch_id, package_name, sessions, max_instruments, price, description)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$branchId, $name, $sessions, $maxInstruments, $price, $description ?: null]);
            $this->sendJSON(['success' => true, 'package_id' => (int) $this->conn->lastInsertId()]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function updatePackage()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $id = (int) ($data['package_id'] ?? 0);
        $branchId = (int) ($data['branch_id'] ?? 0);
        $name = $this->normalizeName($data['package_name'] ?? '');
        $sessions = (int) ($data['sessions'] ?? 0);
        $maxInstruments = (int) ($data['max_instruments'] ?? 1);
        $price = isset($data['price']) ? (float) $data['price'] : 0;
        $description = trim($data['description'] ?? '');

        if ($id < 1) {
            $this->sendJSON(['error' => 'Package ID is required'], 400);
        }
        if ($branchId < 1) {
            $this->sendJSON(['error' => 'Branch is required'], 400);
        }
        if (!$this->branchExists($branchId)) {
            $this->sendJSON(['error' => 'Selected branch was not found'], 400);
        }
        if ($name === '') {
            $this->sendJSON(['error' => 'Package name is required'], 400);
        }
        if ($sessions < 1) {
            $this->sendJSON(['error' => 'Sessions must be at least 1'], 400);
        }
        if ($maxInstruments < 1 || $maxInstruments > 3) {
            $this->sendJSON(['error' => 'Max instruments must be 1, 2, or 3'], 400);
        }

        try {
            if ($this->packageNameExists($branchId, $name, $id)) {
                $this->sendJSON(['error' => 'Package name already exists in this branch (names are checked without regard to capitalization)'], 409);
            }

            $stmt = $this->conn->prepare("
                UPDATE tbl_session_packages
                SET branch_id = ?, package_name = ?, sessions = ?, max_instruments = ?, price = ?, description = ?
                WHERE package_id = ?
            ");
            $stmt->execute([$branchId, $name, $sessions, $maxInstruments, $price, $description ?: null, $id]);
            if ($stmt->rowCount() === 0) {
                $this->sendJSON(['error' => 'Package not found'], 404);
            }
            $this->sendJSON(['success' => true]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function deletePackage()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $id = (int) ($data['package_id'] ?? 0);
        if ($id < 1) {
            $this->sendJSON(['error' => 'Package ID is required'], 400);
        }
        try {
            $stmt = $this->conn->prepare("DELETE FROM tbl_session_packages WHERE package_id = ?");
            $stmt->execute([$id]);
            if ($stmt->rowCount() === 0) {
                $this->sendJSON(['error' => 'Package not found'], 404);
            }
            $this->sendJSON(['success' => true]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }
}

$packages = new SessionPackages($conn);
$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get-packages') {
    $packages->getPackages();
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $input['action'] ?? $_GET['action'] ?? '';

fas_require_authenticated_user($conn);

switch ($action) {
    case 'get-packages':
        $packages->getPackages();
        break;
    case 'add-package':
        $packages->addPackage();
        break;
    case 'update-package':
        $packages->updatePackage();
        break;
    case 'delete-package':
        $packages->deletePackage();
        break;
    default:
        $packages->sendJSON(['error' => 'Invalid action'], 400);
}
