<?php
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/auth_session.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'], true)) {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

if (!$conn) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection failed']);
    exit;
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $actor = fas_require_authenticated_user($conn);
        $role = fas_normalize_role_category($actor['role_name'] ?? '');
        if (!in_array($role, ['admin', 'owner'], true)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Only administrators can update payment destinations']);
            exit;
        }

        $values = [
            'payment_gcash_number' => trim((string)($_POST['gcash_number'] ?? '')),
            'payment_bank_name' => trim((string)($_POST['bank_name'] ?? '')),
            'payment_bank_account_name' => trim((string)($_POST['bank_account_name'] ?? '')),
            'payment_bank_account_number' => trim((string)($_POST['bank_account_number'] ?? ''))
        ];
        if ($values['payment_gcash_number'] !== '' && !preg_match('/^[0-9+() -]{7,24}$/', $values['payment_gcash_number'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Enter a valid GCash number']);
            exit;
        }

        if (!empty($_FILES['gcash_qr']['name'])) {
            $file = $_FILES['gcash_qr'];
            if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || (int)($file['size'] ?? 0) > 3 * 1024 * 1024) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'QR image must be 3 MB or smaller']);
                exit;
            }
            $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
            $extensions = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'];
            if (!isset($extensions[$mime])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Upload a PNG, JPG, or WebP QR image']);
                exit;
            }
            $uploadDir = dirname(__DIR__) . '/uploads/payment_qr';
            if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
                throw new RuntimeException('Unable to create QR upload directory');
            }
            $filename = 'gcash_' . date('YmdHis') . '_' . bin2hex(random_bytes(5)) . '.' . $extensions[$mime];
            if (!move_uploaded_file($file['tmp_name'], $uploadDir . '/' . $filename)) {
                throw new RuntimeException('Unable to save QR image');
            }
            $values['payment_gcash_qr_path'] = 'uploads/payment_qr/' . $filename;
        }

        $stmtSave = $conn->prepare("INSERT INTO tbl_settings (setting_key, setting_value, setting_type, description, updated_by)
            VALUES (?, ?, 'String', ?, ?)
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)");
        foreach ($values as $key => $value) {
            $stmtSave->execute([$key, $value, 'Online payment destination', (int)($actor['user_id'] ?? 0)]);
        }
        echo json_encode(['success' => true, 'message' => 'Payment destination saved']);
        exit;
    }

    $settings = [];
    $keys = [
        'payment_contact_number',
        'payment_gcash_number',
        'payment_bank_name',
        'payment_bank_account_name',
        'payment_bank_account_number',
        'payment_gcash_qr_path'
    ];
    $placeholders = implode(',', array_fill(0, count($keys), '?'));
    $stmtSettings = $conn->prepare("SELECT setting_key, setting_value FROM tbl_settings WHERE setting_key IN ({$placeholders})");
    $stmtSettings->execute($keys);
    foreach ($stmtSettings->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $settings[(string)$row['setting_key']] = trim((string)$row['setting_value']);
    }

    $admin = [];
    $stmtAdmin = $conn->query("
        SELECT u.phone
        FROM tbl_users u
        INNER JOIN tbl_roles r ON r.role_id = u.role_id
        WHERE u.status = 'Active'
          AND TRIM(COALESCE(u.phone, '')) <> ''
          AND (LOWER(r.role_name) = 'admin' OR LOWER(r.role_name) = 'owner' OR LOWER(r.role_name) = 'super admin')
        ORDER BY u.user_id ASC
        LIMIT 1
    ");
    $admin = $stmtAdmin->fetch(PDO::FETCH_ASSOC) ?: [];

    $adminPhone = trim((string)($admin['phone'] ?? ''));
    $contactNumber = $settings['payment_contact_number'] ?? $adminPhone;
    $gcashNumber = $settings['payment_gcash_number'] ?? $contactNumber;

    echo json_encode([
        'success' => true,
        'recipient' => [
            'contact_number' => $contactNumber,
            'gcash_number' => $gcashNumber,
            'gcash_qr_path' => $settings['payment_gcash_qr_path'] ?? '',
            'bank_name' => $settings['payment_bank_name'] ?? '',
            'bank_account_name' => $settings['payment_bank_account_name'] ?? '',
            'bank_account_number' => $settings['payment_bank_account_number'] ?? ''
        ]
    ], JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to load payment destination']);
}
