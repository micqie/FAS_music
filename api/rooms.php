<?php
require_once 'db_connect.php';

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

class Room
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

    private function getPayload()
    {
        return json_decode(file_get_contents('php://input'), true) ?: [];
    }

    public function getRooms()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        try {
            $stmt = $this->conn->query("
                SELECT
                    r.room_id,
                    r.branch_id,
                    r.room_name,
                    r.capacity,
                    r.room_type,
                    r.status,
                    r.created_at,
                    b.branch_name
                FROM tbl_rooms r
                INNER JOIN tbl_branches b ON b.branch_id = r.branch_id
                ORDER BY
                    CASE WHEN r.status = 'Inactive' THEN 1 ELSE 0 END,
                    b.branch_name ASC,
                    r.room_name ASC
            ");
            $rooms = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $summaryStmt = $this->conn->query("
                SELECT
                    COUNT(*) AS total_rooms,
                    SUM(CASE WHEN status <> 'Inactive' THEN 1 ELSE 0 END) AS current_rooms,
                    SUM(CASE WHEN status = 'Available' THEN 1 ELSE 0 END) AS available_rooms,
                    SUM(CASE WHEN status = 'Under Maintenance' THEN 1 ELSE 0 END) AS maintenance_rooms
                FROM tbl_rooms
            ");
            $summary = $summaryStmt->fetch(PDO::FETCH_ASSOC) ?: [];

            $branchStmt = $this->conn->query("
                SELECT
                    b.branch_id,
                    b.branch_name,
                    SUM(CASE WHEN r.status <> 'Inactive' THEN 1 ELSE 0 END) AS current_rooms
                FROM tbl_branches b
                LEFT JOIN tbl_rooms r ON r.branch_id = b.branch_id
                WHERE b.status = 'Active'
                GROUP BY b.branch_id, b.branch_name
                ORDER BY b.branch_name ASC
            ");
            $branchTotals = $branchStmt->fetchAll(PDO::FETCH_ASSOC);

            $this->sendJSON([
                'success' => true,
                'rooms' => $rooms,
                'summary' => [
                    'total_rooms' => (int) ($summary['total_rooms'] ?? 0),
                    'current_rooms' => (int) ($summary['current_rooms'] ?? 0),
                    'available_rooms' => (int) ($summary['available_rooms'] ?? 0),
                    'maintenance_rooms' => (int) ($summary['maintenance_rooms'] ?? 0)
                ],
                'branch_totals' => array_map(function ($row) {
                    return [
                        'branch_id' => (int) $row['branch_id'],
                        'branch_name' => $row['branch_name'],
                        'current_rooms' => (int) ($row['current_rooms'] ?? 0)
                    ];
                }, $branchTotals)
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function addRoom()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = $this->getPayload();
        $roomName = trim($data['room_name'] ?? '');
        $branchId = (int) ($data['branch_id'] ?? 0);
        $capacity = (int) ($data['capacity'] ?? 1);
        $roomType = trim($data['room_type'] ?? 'Private Lesson');
        $status = trim($data['status'] ?? 'Available');

        $this->validateRoomPayload($roomName, $branchId, $capacity, $roomType, $status);

        try {
            $duplicateStmt = $this->conn->prepare("
                SELECT room_id
                FROM tbl_rooms
                WHERE branch_id = ? AND room_name = ?
                LIMIT 1
            ");
            $duplicateStmt->execute([$branchId, $roomName]);
            if ($duplicateStmt->fetch()) {
                $this->sendJSON(['error' => 'Room name already exists in this branch'], 409);
            }

            $stmt = $this->conn->prepare("
                INSERT INTO tbl_rooms (branch_id, room_name, capacity, room_type, status)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([$branchId, $roomName, $capacity, $roomType, $status]);

            $this->sendJSON([
                'success' => true,
                'room_id' => (int) $this->conn->lastInsertId()
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function updateRoom()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = $this->getPayload();
        $roomId = (int) ($data['room_id'] ?? 0);
        $roomName = trim($data['room_name'] ?? '');
        $branchId = (int) ($data['branch_id'] ?? 0);
        $capacity = (int) ($data['capacity'] ?? 1);
        $roomType = trim($data['room_type'] ?? 'Private Lesson');
        $status = trim($data['status'] ?? 'Available');

        if ($roomId < 1) {
            $this->sendJSON(['error' => 'Room ID is required'], 400);
        }

        $this->validateRoomPayload($roomName, $branchId, $capacity, $roomType, $status);

        try {
            $duplicateStmt = $this->conn->prepare("
                SELECT room_id
                FROM tbl_rooms
                WHERE branch_id = ? AND room_name = ? AND room_id <> ?
                LIMIT 1
            ");
            $duplicateStmt->execute([$branchId, $roomName, $roomId]);
            if ($duplicateStmt->fetch()) {
                $this->sendJSON(['error' => 'Room name already exists in this branch'], 409);
            }

            $stmt = $this->conn->prepare("
                UPDATE tbl_rooms
                SET branch_id = ?, room_name = ?, capacity = ?, room_type = ?, status = ?
                WHERE room_id = ?
            ");
            $stmt->execute([$branchId, $roomName, $capacity, $roomType, $status, $roomId]);

            if ($stmt->rowCount() === 0) {
                $checkStmt = $this->conn->prepare("SELECT room_id FROM tbl_rooms WHERE room_id = ?");
                $checkStmt->execute([$roomId]);
                if (!$checkStmt->fetch()) {
                    $this->sendJSON(['error' => 'Room not found'], 404);
                }
            }

            $this->sendJSON(['success' => true]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function deleteRoom()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = $this->getPayload();
        $roomId = (int) ($data['room_id'] ?? 0);

        if ($roomId < 1) {
            $this->sendJSON(['error' => 'Room ID is required'], 400);
        }

        try {
            $stmt = $this->conn->prepare("
                UPDATE tbl_rooms
                SET status = 'Inactive'
                WHERE room_id = ?
            ");
            $stmt->execute([$roomId]);

            if ($stmt->rowCount() === 0) {
                $checkStmt = $this->conn->prepare("SELECT room_id FROM tbl_rooms WHERE room_id = ?");
                $checkStmt->execute([$roomId]);
                if (!$checkStmt->fetch()) {
                    $this->sendJSON(['error' => 'Room not found'], 404);
                }
            }

            $this->sendJSON(['success' => true]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function activateRoom()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = $this->getPayload();
        $roomId = (int) ($data['room_id'] ?? 0);

        if ($roomId < 1) {
            $this->sendJSON(['error' => 'Room ID is required'], 400);
        }

        try {
            $stmt = $this->conn->prepare("
                UPDATE tbl_rooms
                SET status = 'Available'
                WHERE room_id = ?
            ");
            $stmt->execute([$roomId]);

            if ($stmt->rowCount() === 0) {
                $checkStmt = $this->conn->prepare("SELECT room_id FROM tbl_rooms WHERE room_id = ?");
                $checkStmt->execute([$roomId]);
                if (!$checkStmt->fetch()) {
                    $this->sendJSON(['error' => 'Room not found'], 404);
                }
            }

            $this->sendJSON(['success' => true]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    private function validateRoomPayload($roomName, $branchId, $capacity, $roomType, $status)
    {
        $validTypes = ['Private Lesson', 'Group Room', 'Recital Hall', 'Other'];
        $validStatuses = ['Available', 'Under Maintenance', 'Inactive'];

        if ($roomName === '') {
            $this->sendJSON(['error' => 'Room name is required'], 400);
        }
        if ($branchId < 1) {
            $this->sendJSON(['error' => 'Branch is required'], 400);
        }
        if ($capacity < 1) {
            $this->sendJSON(['error' => 'Capacity must be at least 1'], 400);
        }
        if (!in_array($roomType, $validTypes, true)) {
            $this->sendJSON(['error' => 'Invalid room type'], 400);
        }
        if (!in_array($status, $validStatuses, true)) {
            $this->sendJSON(['error' => 'Invalid room status'], 400);
        }

        $branchStmt = $this->conn->prepare("
            SELECT branch_id
            FROM tbl_branches
            WHERE branch_id = ? AND status = 'Active'
            LIMIT 1
        ");
        $branchStmt->execute([$branchId]);
        if (!$branchStmt->fetch()) {
            $this->sendJSON(['error' => 'Selected branch is not available'], 400);
        }
    }
}

$room = new Room($conn);
$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $action = $input['action'] ?? $action;
}

switch ($action) {
    case 'get-rooms':
    case '':
        $room->getRooms();
        break;
    case 'add-room':
        $room->addRoom();
        break;
    case 'update-room':
        $room->updateRoom();
        break;
    case 'delete-room':
        $room->deleteRoom();
        break;
    case 'activate-room':
        $room->activateRoom();
        break;
    default:
        http_response_code(404);
        echo json_encode(['error' => 'Invalid action']);
        break;
}
