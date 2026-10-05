<?php
require_once __DIR__ . '/private_config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$value = strtolower(trim((string)fas_private_setting('DEMO_MODE', 'false')));
echo json_encode([
    'success' => true,
    'demo_mode' => in_array($value, ['1', 'true', 'yes', 'on'], true),
], JSON_UNESCAPED_SLASHES);
