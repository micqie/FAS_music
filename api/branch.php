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

    // Get all branches (including inactive) for admin
    public function getBranchesAll()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        try {
            $stmt = $this->conn->query("
                SELECT branch_id, branch_name, address, phone, email, status
                FROM tbl_branches
                ORDER BY branch_name ASC
            ");
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
                WHERE branch_id = ?
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

    // Create branch
    public function addBranch()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $name = trim($data['branch_name'] ?? '');
        $address = trim($data['address'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $email = trim($data['email'] ?? '');
        $status = isset($data['status']) && in_array($data['status'], ['Active', 'Inactive'], true) ? $data['status'] : 'Active';

        if ($name === '') {
            $this->sendJSON(['error' => 'Branch name is required'], 400);
        }

        try {
            $stmt = $this->conn->prepare("
                INSERT INTO tbl_branches (branch_name, address, phone, email, status)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([$name, $address ?: null, $phone ?: null, $email ?: null, $status]);
            $this->sendJSON(['success' => true, 'branch_id' => (int) $this->conn->lastInsertId()]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    // Update branch
    public function updateBranch()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $id = (int) ($data['branch_id'] ?? 0);
        $name = trim($data['branch_name'] ?? '');
        $address = trim($data['address'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $email = trim($data['email'] ?? '');
        $status = isset($data['status']) && in_array($data['status'], ['Active', 'Inactive'], true) ? $data['status'] : 'Active';

        if ($id < 1) {
            $this->sendJSON(['error' => 'Branch ID is required'], 400);
        }
        if ($name === '') {
            $this->sendJSON(['error' => 'Branch name is required'], 400);
        }

        try {
            $stmt = $this->conn->prepare("
                UPDATE tbl_branches
                SET branch_name = ?, address = ?, phone = ?, email = ?, status = ?
                WHERE branch_id = ?
            ");
            $stmt->execute([$name, $address ?: null, $phone ?: null, $email ?: null, $status, $id]);
            if ($stmt->rowCount() === 0) {
                $this->sendJSON(['error' => 'Branch not found'], 404);
            }
            $this->sendJSON(['success' => true]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    // Delete branch (soft delete: set status to Inactive to preserve references)
    public function deleteBranch()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $id = (int) ($data['branch_id'] ?? 0);

        if ($id < 1) {
            $this->sendJSON(['error' => 'Branch ID is required'], 400);
        }

        try {
            $stmt = $this->conn->prepare("UPDATE tbl_branches SET status = 'Inactive' WHERE branch_id = ?");
            $stmt->execute([$id]);
            if ($stmt->rowCount() === 0) {
                $this->sendJSON(['error' => 'Branch not found'], 404);
            }
            $this->sendJSON(['success' => true]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }
}

// Initialize Branch class
$branch = new Branch($conn);
$action = $_GET['action'] ?? '';

// POST body may override action for create/update/delete
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $action = $input['action'] ?? $action;
}

switch ($action) {
    case 'get-branches':
    case '':
        $branch->getBranches();
        break;
    case 'get-branches-all':
        $branch->getBranchesAll();
        break;
    case 'get-branch':
        $branch->getBranch($_GET['branch_id'] ?? '');
        break;
    case 'add-branch':
        $branch->addBranch();
        break;
    case 'update-branch':
        $branch->updateBranch();
        break;
    case 'delete-branch':
        $branch->deleteBranch();
        break;
    default:
        $branch->sendJSON(['error' => 'Invalid action'], 400);
}
?>

