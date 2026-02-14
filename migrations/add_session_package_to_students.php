<?php
/**
 * Migration: Add session_package_id column to tbl_students
 * 
 * Run this file directly in browser: http://localhost/FAS_music/migrations/add_session_package_to_students.php
 * Or via CLI: php add_session_package_to_students.php
 */

require_once dirname(__DIR__) . '/api/db_connect.php';

header('Content-Type: text/plain; charset=utf-8');

$errors = [];
$success = [];

try {
    // Check if session_package_id column exists
    $stmt = $conn->query("DESCRIBE tbl_students");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    if (!in_array('session_package_id', $columns)) {
        // Add column
        $conn->exec("ALTER TABLE tbl_students ADD COLUMN session_package_id INT NULL");
        $success[] = "Added session_package_id column to tbl_students";
        
        // Add foreign key if tbl_session_packages exists
        try {
            $conn->exec("
                ALTER TABLE tbl_students 
                ADD CONSTRAINT fk_students_session_package 
                FOREIGN KEY (session_package_id) REFERENCES tbl_session_packages(package_id)
            ");
            $success[] = "Added foreign key constraint for session_package_id";
        } catch (PDOException $e) {
            $success[] = "Foreign key constraint skipped (tbl_session_packages may not exist yet)";
        }
    } else {
        $success[] = "session_package_id column already exists - no migration needed";
    }

} catch (PDOException $e) {
    $errors[] = "Database error: " . $e->getMessage();
}

// Output
echo "=== Session Package Migration ===\n\n";
foreach ($success as $msg) {
    echo "[OK] $msg\n";
}
foreach ($errors as $msg) {
    echo "[ERROR] $msg\n";
}
echo "\n" . (empty($errors) ? "Migration completed successfully!" : "Migration had errors.") . "\n";
