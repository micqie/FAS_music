<?php
// CLI only. Run without arguments for a dry run; --apply performs the rotation.
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit;
}

require_once __DIR__ . '/../api/db_connect.php';
require_once __DIR__ . '/../api/auth_session.php';

if (!$conn instanceof PDO) {
    fwrite(STDERR, "Database unavailable.\n");
    exit(1);
}

$apply = in_array('--apply', $argv, true);
$knownDefaults = ['fas@123', 'fasmusic@2020', 'fasmusic2020'];
$rows = $conn->query('SELECT user_id, username, password, status FROM tbl_users')->fetchAll(PDO::FETCH_ASSOC);
$affected = [];
foreach ($rows as $row) {
    foreach ($knownDefaults as $default) {
        if (password_verify($default, (string)$row['password']) || hash_equals((string)$row['password'], $default)) {
            $affected[] = $row;
            break;
        }
    }
}

echo count($affected) . " account(s) use a shared default password.\n";
if (!$apply || !$affected) exit(0);

if (!fas_ensure_password_change_column($conn)) {
    fwrite(STDERR, "Password change flag is unavailable.\n");
    exit(1);
}

$handoffPath = dirname(__DIR__, 3) . DIRECTORY_SEPARATOR
    . 'fas_music_password_rotation_' . date('Ymd_His') . '.json';
$handoff = [];
$conn->beginTransaction();
try {
    $update = $conn->prepare('UPDATE tbl_users SET password = ?, must_change_password = 1,
        active_session_token = NULL, active_session_updated_at = NULL,
        active_browser_token_hash = NULL, active_browser_token_updated_at = NULL
        WHERE user_id = ? AND password = ?');
    foreach ($affected as $row) {
        $temporaryPassword = fas_generate_temporary_password();
        $update->execute([password_hash($temporaryPassword, PASSWORD_DEFAULT), (int)$row['user_id'], $row['password']]);
        if ($update->rowCount() !== 1) throw new RuntimeException('Account changed during rotation.');
        $handoff[] = [
            'user_id' => (int)$row['user_id'],
            'username' => $row['username'],
            'status' => $row['status'],
            'temporary_password' => $temporaryPassword,
        ];
    }
    $handle = fopen($handoffPath, 'x');
    if ($handle === false) throw new RuntimeException('Unable to create private handoff file.');
    try {
        if (fwrite($handle, json_encode($handoff, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR)) === false) {
            throw new RuntimeException('Unable to write private handoff file.');
        }
    } finally {
        fclose($handle);
    }
    @chmod($handoffPath, 0600);
    $conn->commit();
    echo "Passwords rotated. Give each user their temporary password privately.\n";
    echo "Private handoff file: {$handoffPath}\n";
} catch (Throwable $e) {
    if ($conn->inTransaction()) $conn->rollBack();
    if (is_file($handoffPath)) unlink($handoffPath);
    fwrite(STDERR, "Rotation failed without changing accounts: {$e->getMessage()}\n");
    exit(1);
}
