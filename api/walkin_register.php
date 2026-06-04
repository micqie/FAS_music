<?php
/**
 * Walk-in / branch registration API only.
 * No PHPMailer — uses @fas.com login names and default password fas@123.
 *
 * Online registration uses users.php?action=register or register-basic instead.
 */
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

define('FAS_USERS_CLASS_ONLY', true);

require_once __DIR__ . '/db_connect.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
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

require_once __DIR__ . '/users.php';

$registrar = new User($conn);
$action = $_GET['action'] ?? 'register';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    $registrar->sendJSON(['error' => 'Method not allowed'], 405);
}

switch ($action) {
    case 'register':
        $registrar->registerWalkIn(file_get_contents('php://input'));
        break;
    default:
        $registrar->sendJSON(['error' => 'Invalid action. Use ?action=register'], 400);
}
