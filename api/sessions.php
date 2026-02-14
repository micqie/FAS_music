<?php
require_once 'db_connect.php';

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

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
                package_name VARCHAR(100) NOT NULL,
                sessions INT NOT NULL,
                max_instruments TINYINT NOT NULL DEFAULT 1,
                price DECIMAL(10,2) NOT NULL DEFAULT 0,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ");
        $this->ensurePriceColumn();
        $stmt = $this->conn->query("SELECT COUNT(*) FROM tbl_session_packages");
        if ((int) $stmt->fetchColumn() === 0) {
            $this->conn->exec("
                INSERT INTO tbl_session_packages (package_name, sessions, max_instruments, price, description) VALUES
                ('Basic (12 Sessions)', 12, 1, 7450.00, '1 instrument only'),
                ('Standard (20 Sessions)', 20, 2, 11800.00, '2 instruments'),
                ('Premium (20+ Sessions)', 24, 3, 14200.00, '3 instruments')
            ");
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

    private function sendJSON($data, $statusCode = 200)
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
        try {
            $stmt = $this->conn->query("
                SELECT package_id, package_name, sessions, max_instruments, COALESCE(price, 0) AS price, description
                FROM tbl_session_packages
                ORDER BY sessions ASC, package_id ASC
            ");
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
        $name = trim($data['package_name'] ?? '');
        $sessions = (int) ($data['sessions'] ?? 0);
        $maxInstruments = (int) ($data['max_instruments'] ?? 1);
        $price = isset($data['price']) ? (float) $data['price'] : 0;
        $description = trim($data['description'] ?? '');

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
            $stmt = $this->conn->prepare("
                INSERT INTO tbl_session_packages (package_name, sessions, max_instruments, price, description)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([$name, $sessions, $maxInstruments, $price, $description ?: null]);
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
        $name = trim($data['package_name'] ?? '');
        $sessions = (int) ($data['sessions'] ?? 0);
        $maxInstruments = (int) ($data['max_instruments'] ?? 1);
        $price = isset($data['price']) ? (float) $data['price'] : 0;
        $description = trim($data['description'] ?? '');

        if ($id < 1) {
            $this->sendJSON(['error' => 'Package ID is required'], 400);
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
            $stmt = $this->conn->prepare("
                UPDATE tbl_session_packages
                SET package_name = ?, sessions = ?, max_instruments = ?, price = ?, description = ?
                WHERE package_id = ?
            ");
            $stmt->execute([$name, $sessions, $maxInstruments, $price, $description ?: null, $id]);
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
