<?php
/**
 * Online registration API only.
 * Uses PHPMailer verification and must send to a real email address.
 */
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

define('FAS_USERS_CLASS_ONLY', true);

require_once __DIR__ . '/db_connect.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
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

$api = new User($conn);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    $api->sendJSON(['error' => 'Method not allowed'], 405);
}

$action = $_GET['action'] ?? 'register';
if ($action !== 'register') {
    $api->sendJSON(['error' => 'Invalid action. Use ?action=register'], 400);
}

$api->registerBasic(file_get_contents('php://input'));
