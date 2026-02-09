<?php
require_once 'db_connect.php';

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

class Branch
{
    private $conn;

    public function __construct($pdo)
    {
        $this->conn = $pdo;
    }

    private function sendJSON($data, $statusCode = 200)
    {
        http_response_code($statusCode);
        echo json_encode($data);
        exit;
    }

    // Get all active branches
    public function getBranches()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        try {
            $stmt = $this->conn->prepare("
                SELECT branch_id, branch_name, address, phone, email
                FROM tbl_branches
                WHERE status = 'Active'
                ORDER BY branch_name ASC
            ");
            $stmt->execute();
            $branches = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $this->sendJSON([
                'success' => true,
                'branches' => $branches
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    // Get single branch by ID
    public function getBranch($branchId)
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        if (empty($branchId)) {
            $this->sendJSON(['error' => 'Branch ID is required'], 400);
        }

        try {
            $stmt = $this->conn->prepare("
                SELECT branch_id, branch_name, address, phone, email, status
                FROM tbl_branches
                WHERE branch_id = ? AND status = 'Active'
            ");
            $stmt->execute([$branchId]);
            $branch = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$branch) {
                $this->sendJSON(['error' => 'Branch not found'], 404);
            }

            $this->sendJSON([
                'success' => true,
                'branch' => $branch
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }
}

// Initialize Branch class
$branch = new Branch($conn);
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get-branches':
    case '':
        $branch->getBranches();
        break;
    case 'get-branch':
        $branch->getBranch($_GET['branch_id'] ?? '');
        break;
    default:
        $branch->sendJSON(['error' => 'Invalid action'], 400);
}
?>

