
<?php
// Suppress error display for JSON APIs
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
date_default_timezone_set('Asia/Manila');

require_once __DIR__ . '/private_config.php';
require_once __DIR__ . '/db_compat.php';

$databaseUrl = trim((string)(getenv('DATABASE_URL') ?: ''));
$dbDriver = strtolower(trim((string)fas_private_setting('DB_DRIVER', $databaseUrl !== '' ? 'pgsql' : 'mysql')));
$dbUsername = (string)fas_private_setting('DB_USER', 'root');
$dbPassword = (string)fas_private_setting('DB_PASSWORD', 'Micah');
$dbName = (string)fas_private_setting('DB_NAME', 'music_db');
$dbHost = (string)fas_private_setting('DB_HOST', 'localhost');
$dbPort = (int)fas_private_setting('DB_PORT', $dbDriver === 'pgsql' ? '5432' : '3306');

try {
    if (!in_array($dbDriver, ['mysql', 'pgsql'], true)) {
        throw new RuntimeException('DB_DRIVER must be either mysql or pgsql.');
    }

    if ($databaseUrl !== '' && $dbDriver === 'pgsql') {
        $parts = parse_url($databaseUrl);
        if (!is_array($parts) || empty($parts['host']) || empty($parts['path'])) {
            throw new RuntimeException('DATABASE_URL is not a valid PostgreSQL connection URL.');
        }

        parse_str($parts['query'] ?? '', $urlOptions);
        $dbHost = $parts['host'];
        $dbPort = (int)($parts['port'] ?? 5432);
        $dbName = ltrim($parts['path'], '/');
        $dbUsername = rawurldecode($parts['user'] ?? '');
        $dbPassword = rawurldecode($parts['pass'] ?? '');
        $sslMode = isset($urlOptions['sslmode']) ? (string)$urlOptions['sslmode'] : (string)fas_private_setting('DB_SSLMODE', '');
    } elseif ($dbDriver === 'pgsql') {
        $sslMode = (string)fas_private_setting('DB_SSLMODE', '');
    }

    if ($dbDriver === 'pgsql') {
        $dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s', $dbHost, $dbPort, $dbName);
        if ($sslMode !== '') $dsn .= ';sslmode=' . $sslMode;
    } else {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $dbHost, $dbPort, $dbName);
    }

    $conn = new FasPDO($dsn, $dbUsername, $dbPassword, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

} catch (Throwable $e) {
    // Don't output HTML errors - let API files handle JSON errors
    error_log('FAS database connection failed (' . ($dbDriver ?? 'unknown') . '): ' . $e->getMessage());
    $conn = null;
}
?>

