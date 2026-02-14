<?php
require_once 'db_connect.php';

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

class Instruments
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

    // Get all instrument types
    public function getInstrumentTypes()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        try {
            $stmt = $this->conn->prepare("
                SELECT type_id, type_name, description
                FROM tbl_instrument_types
                ORDER BY type_name ASC
            ");
            $stmt->execute();
            $types = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $this->sendJSON([
                'success' => true,
                'types' => $types
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    // Add instrument type
    public function addInstrumentType()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['type_name'])) {
            $this->sendJSON(['error' => 'Instrument type name is required'], 400);
        }

        try {
            $stmt = $this->conn->prepare("
                INSERT INTO tbl_instrument_types (type_name, description)
                VALUES (?, ?)
            ");
            $stmt->execute([
                $data['type_name'],
                $data['description'] ?? null
            ]);

            $typeId = $this->conn->lastInsertId();

            $this->sendJSON([
                'success' => true,
                'message' => 'Instrument type added successfully',
                'type_id' => $typeId
            ]);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) {
                $this->sendJSON(['error' => 'Instrument type already exists'], 400);
            } else {
                $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
            }
        }
    }

    // Get all instruments
    public function getInstruments()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        try {
            $branchId = $_GET['branch_id'] ?? null;
            $typeId = $_GET['type_id'] ?? null;

            $sql = "
                SELECT 
                    i.instrument_id,
                    i.branch_id,
                    i.instrument_name,
                    i.type_id,
                    i.serial_number,
                    i.`condition`,
                    i.status,
                    b.branch_name,
                    it.type_name
                FROM tbl_instruments i
                LEFT JOIN tbl_branches b ON i.branch_id = b.branch_id
                LEFT JOIN tbl_instrument_types it ON i.type_id = it.type_id
                WHERE 1=1
            ";

            $params = [];

            if ($branchId) {
                $sql .= " AND i.branch_id = ?";
                $params[] = $branchId;
            }

            if ($typeId) {
                $sql .= " AND i.type_id = ?";
                $params[] = $typeId;
            }

            $sql .= " ORDER BY i.instrument_name ASC";

            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);
            $instruments = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $this->sendJSON([
                'success' => true,
                'instruments' => $instruments
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    // Get single instrument type
    public function getInstrumentType()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $typeId = $_GET['type_id'] ?? null;
        if (empty($typeId)) {
            $this->sendJSON(['error' => 'Type ID is required'], 400);
        }

        try {
            $stmt = $this->conn->prepare("
                SELECT type_id, type_name, description
                FROM tbl_instrument_types
                WHERE type_id = ?
            ");
            $stmt->execute([$typeId]);
            $type = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$type) {
                $this->sendJSON(['error' => 'Instrument type not found'], 404);
            }

            $this->sendJSON([
                'success' => true,
                'type' => $type
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    // Update instrument type
    public function updateInstrumentType()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'PUT' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['type_id']) || empty($data['type_name'])) {
            $this->sendJSON(['error' => 'Type ID and type name are required'], 400);
        }

        try {
            // Check if type exists
            $checkStmt = $this->conn->prepare("SELECT type_id FROM tbl_instrument_types WHERE type_id = ?");
            $checkStmt->execute([$data['type_id']]);
            if (!$checkStmt->fetch()) {
                $this->sendJSON(['error' => 'Instrument type not found'], 404);
            }

            $stmt = $this->conn->prepare("
                UPDATE tbl_instrument_types
                SET type_name = ?, description = ?
                WHERE type_id = ?
            ");
            $stmt->execute([
                $data['type_name'],
                $data['description'] ?? null,
                $data['type_id']
            ]);

            $this->sendJSON([
                'success' => true,
                'message' => 'Instrument type updated successfully'
            ]);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) {
                $this->sendJSON(['error' => 'Instrument type name already exists'], 400);
            } else {
                $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
            }
        }
    }

    // Delete instrument type
    public function deleteInstrumentType()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'DELETE' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $typeId = $_GET['type_id'] ?? json_decode(file_get_contents('php://input'), true)['type_id'] ?? null;
        
        if (empty($typeId)) {
            $this->sendJSON(['error' => 'Type ID is required'], 400);
        }

        try {
            // Check if type exists
            $checkStmt = $this->conn->prepare("SELECT type_id FROM tbl_instrument_types WHERE type_id = ?");
            $checkStmt->execute([$typeId]);
            if (!$checkStmt->fetch()) {
                $this->sendJSON(['error' => 'Instrument type not found'], 404);
            }

            // Check if type is being used by any instruments
            $usageStmt = $this->conn->prepare("SELECT COUNT(*) as count FROM tbl_instruments WHERE type_id = ?");
            $usageStmt->execute([$typeId]);
            $usage = $usageStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($usage['count'] > 0) {
                $this->sendJSON([
                    'error' => 'Cannot delete instrument type. It is being used by ' . $usage['count'] . ' instrument(s)'
                ], 400);
            }

            $stmt = $this->conn->prepare("DELETE FROM tbl_instrument_types WHERE type_id = ?");
            $stmt->execute([$typeId]);

            $this->sendJSON([
                'success' => true,
                'message' => 'Instrument type deleted successfully'
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    // Get single instrument
    public function getInstrument()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $instrumentId = $_GET['instrument_id'] ?? null;
        if (empty($instrumentId)) {
            $this->sendJSON(['error' => 'Instrument ID is required'], 400);
        }

        try {
            $stmt = $this->conn->prepare("
                SELECT 
                    i.instrument_id,
                    i.branch_id,
                    i.instrument_name,
                    i.type_id,
                    i.serial_number,
                    i.`condition`,
                    i.status,
                    b.branch_name,
                    it.type_name
                FROM tbl_instruments i
                LEFT JOIN tbl_branches b ON i.branch_id = b.branch_id
                LEFT JOIN tbl_instrument_types it ON i.type_id = it.type_id
                WHERE i.instrument_id = ?
            ");
            $stmt->execute([$instrumentId]);
            $instrument = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$instrument) {
                $this->sendJSON(['error' => 'Instrument not found'], 404);
            }

            $this->sendJSON([
                'success' => true,
                'instrument' => $instrument
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    // Add instrument
    public function addInstrument()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true);

        // Validate required fields based on database schema
        if (empty($data['branch_id']) || empty($data['instrument_name']) || empty($data['type_id'])) {
            $this->sendJSON(['error' => 'Branch, instrument name, and type are required'], 400);
        }

        // Default for new instruments: status=Active, condition=Available
        $validStatuses = ['Active', 'Available', 'In Use', 'Under Repair', 'Inactive'];
        $status = $data['status'] ?? 'Active';
        if (!in_array($status, $validStatuses)) {
            $this->sendJSON(['error' => 'Invalid status. Must be one of: ' . implode(', ', $validStatuses)], 400);
        }

        try {
            // Verify branch exists
            $branchCheck = $this->conn->prepare("SELECT branch_id FROM tbl_branches WHERE branch_id = ?");
            $branchCheck->execute([$data['branch_id']]);
            if (!$branchCheck->fetch()) {
                $this->sendJSON(['error' => 'Branch not found'], 400);
            }

            // Verify instrument type exists
            $typeCheck = $this->conn->prepare("SELECT type_id FROM tbl_instrument_types WHERE type_id = ?");
            $typeCheck->execute([$data['type_id']]);
            if (!$typeCheck->fetch()) {
                $this->sendJSON(['error' => 'Instrument type not found'], 400);
            }

            $stmt = $this->conn->prepare("
                INSERT INTO tbl_instruments (
                    branch_id, instrument_name, type_id, serial_number, 
                    `condition`, status
                )
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $data['branch_id'],
                $data['instrument_name'],
                $data['type_id'],
                $data['serial_number'] ?? null,
                $data['condition'] ?? 'Available',
                $status
            ]);

            $instrumentId = $this->conn->lastInsertId();

            $this->sendJSON([
                'success' => true,
                'message' => 'Instrument added successfully',
                'instrument_id' => $instrumentId
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    // Update instrument
    public function updateInstrument()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'PUT' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['instrument_id'])) {
            $this->sendJSON(['error' => 'Instrument ID is required'], 400);
        }

        // Validate status if provided
        if (isset($data['status'])) {
            $validStatuses = ['Active', 'Available', 'In Use', 'Under Repair', 'Inactive'];
            if (!in_array($data['status'], $validStatuses)) {
                $this->sendJSON(['error' => 'Invalid status. Must be one of: ' . implode(', ', $validStatuses)], 400);
            }
        }

        try {
            // Check if instrument exists
            $checkStmt = $this->conn->prepare("SELECT instrument_id FROM tbl_instruments WHERE instrument_id = ?");
            $checkStmt->execute([$data['instrument_id']]);
            if (!$checkStmt->fetch()) {
                $this->sendJSON(['error' => 'Instrument not found'], 404);
            }

            // Verify branch if provided
            if (!empty($data['branch_id'])) {
                $branchCheck = $this->conn->prepare("SELECT branch_id FROM tbl_branches WHERE branch_id = ?");
                $branchCheck->execute([$data['branch_id']]);
                if (!$branchCheck->fetch()) {
                    $this->sendJSON(['error' => 'Branch not found'], 400);
                }
            }

            // Verify instrument type if provided
            if (!empty($data['type_id'])) {
                $typeCheck = $this->conn->prepare("SELECT type_id FROM tbl_instrument_types WHERE type_id = ?");
                $typeCheck->execute([$data['type_id']]);
                if (!$typeCheck->fetch()) {
                    $this->sendJSON(['error' => 'Instrument type not found'], 400);
                }
            }

            // Build update query dynamically based on provided fields
            $updateFields = [];
            $params = [];

            if (isset($data['branch_id'])) {
                $updateFields[] = "branch_id = ?";
                $params[] = $data['branch_id'];
            }
            if (isset($data['instrument_name'])) {
                $updateFields[] = "instrument_name = ?";
                $params[] = $data['instrument_name'];
            }
            if (isset($data['type_id'])) {
                $updateFields[] = "type_id = ?";
                $params[] = $data['type_id'];
            }
            if (isset($data['serial_number'])) {
                $updateFields[] = "serial_number = ?";
                $params[] = $data['serial_number'] ?: null;
            }
            if (isset($data['condition'])) {
                $updateFields[] = "`condition` = ?";
                $params[] = $data['condition'] ?: null;
            }
            if (isset($data['status'])) {
                $updateFields[] = "status = ?";
                $params[] = $data['status'];
            }

            if (empty($updateFields)) {
                $this->sendJSON(['error' => 'No fields to update'], 400);
            }

            $params[] = $data['instrument_id'];

            $sql = "UPDATE tbl_instruments SET " . implode(", ", $updateFields) . " WHERE instrument_id = ?";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);

            $this->sendJSON([
                'success' => true,
                'message' => 'Instrument updated successfully'
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    // Delete instrument
    public function deleteInstrument()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'DELETE' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $instrumentId = $_GET['instrument_id'] ?? json_decode(file_get_contents('php://input'), true)['instrument_id'] ?? null;
        
        if (empty($instrumentId)) {
            $this->sendJSON(['error' => 'Instrument ID is required'], 400);
        }

        try {
            // Check if instrument exists
            $checkStmt = $this->conn->prepare("SELECT instrument_id FROM tbl_instruments WHERE instrument_id = ?");
            $checkStmt->execute([$instrumentId]);
            if (!$checkStmt->fetch()) {
                $this->sendJSON(['error' => 'Instrument not found'], 404);
            }

            // Check if instrument is being used in enrollments
            $enrollmentCheck = $this->conn->prepare("SELECT COUNT(*) as count FROM tbl_enrollments WHERE instrument_id = ?");
            $enrollmentCheck->execute([$instrumentId]);
            $enrollmentUsage = $enrollmentCheck->fetch(PDO::FETCH_ASSOC);
            
            if ($enrollmentUsage['count'] > 0) {
                $this->sendJSON([
                    'error' => 'Cannot delete instrument. It is being used in ' . $enrollmentUsage['count'] . ' enrollment(s)'
                ], 400);
            }

            // Check if instrument is being used in student preferences
            $studentCheck = $this->conn->prepare("SELECT COUNT(*) as count FROM tbl_student_instruments WHERE instrument_id = ?");
            $studentCheck->execute([$instrumentId]);
            $studentUsage = $studentCheck->fetch(PDO::FETCH_ASSOC);
            
            if ($studentUsage['count'] > 0) {
                $this->sendJSON([
                    'error' => 'Cannot delete instrument. It is preferred by ' . $studentUsage['count'] . ' student(s)'
                ], 400);
            }

            // Check if instrument is being used by teachers
            $teacherCheck = $this->conn->prepare("SELECT COUNT(*) as count FROM tbl_teacher_instruments WHERE instrument_id = ?");
            $teacherCheck->execute([$instrumentId]);
            $teacherUsage = $teacherCheck->fetch(PDO::FETCH_ASSOC);
            
            if ($teacherUsage['count'] > 0) {
                $this->sendJSON([
                    'error' => 'Cannot delete instrument. It is taught by ' . $teacherUsage['count'] . ' teacher(s)'
                ], 400);
            }

            $stmt = $this->conn->prepare("DELETE FROM tbl_instruments WHERE instrument_id = ?");
            $stmt->execute([$instrumentId]);

            $this->sendJSON([
                'success' => true,
                'message' => 'Instrument deleted successfully'
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }
}

// Initialize Instruments class
$instruments = new Instruments($conn);
$action = $_GET['action'] ?? '';

switch ($action) {
    // Instrument Types
    case 'get-types':
        $instruments->getInstrumentTypes();
        break;
    case 'get-type':
        $instruments->getInstrumentType();
        break;
    case 'add-type':
        $instruments->addInstrumentType();
        break;
    case 'update-type':
        $instruments->updateInstrumentType();
        break;
    case 'delete-type':
        $instruments->deleteInstrumentType();
        break;
    
    // Instruments
    case 'get-instruments':
        $instruments->getInstruments();
        break;
    case 'get-instrument':
        $instruments->getInstrument();
        break;
    case 'add-instrument':
        $instruments->addInstrument();
        break;
    case 'update-instrument':
        $instruments->updateInstrument();
        break;
    case 'delete-instrument':
        $instruments->deleteInstrument();
        break;
    
    default:
        $instruments->sendJSON(['error' => 'Invalid action'], 400);
}
?>

