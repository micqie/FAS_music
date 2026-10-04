
<?php
// Suppress error display for JSON APIs
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
date_default_timezone_set('Asia/Manila');

require_once __DIR__ . '/private_config.php';

$servername = (string)fas_private_setting('DB_HOST', 'localhost');
$dbusername = (string)fas_private_setting('DB_USER', 'root');
$dbpassword = (string)fas_private_setting('DB_PASSWORD', 'Micah');
$dbname = (string)fas_private_setting('DB_NAME', 'music_db');
$dbport = (int)fas_private_setting('DB_PORT', '3306');

try {
    $conn = new PDO(
        "mysql:host=$servername;port=$dbport;dbname=$dbname;charset=utf8mb4",
        $dbusername,
        $dbpassword
    );

    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

} catch (PDOException $e) {
    // Don't output HTML errors - let API files handle JSON errors
    $conn = null;
}
?>

