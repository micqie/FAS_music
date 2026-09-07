<?php
require_once 'db_connect.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$now = new DateTimeImmutable('now', new DateTimeZone('Asia/Manila'));
echo json_encode([
    'success' => true,
    'now' => $now->format(DateTimeInterface::ATOM),
    'timezone' => 'Asia/Manila'
]);
