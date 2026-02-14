<?php

require_once dirname(__DIR__) . '/api/db_connect.php';

header('Content-Type: text/plain; charset=utf-8');

$errors = [];
$success = [];

try {
    // 1. Create tbl_instrument_types if not exists
    $conn->exec("
        CREATE TABLE IF NOT EXISTS tbl_instrument_types (
            type_id INT AUTO_INCREMENT PRIMARY KEY,
            type_name VARCHAR(50) NOT NULL UNIQUE,
            description TEXT
        )
    ");
    $success[] = "tbl_instrument_types table ready";

    // 2. Insert default type if empty
    $conn->exec("
        INSERT IGNORE INTO tbl_instrument_types (type_name, description) 
        VALUES ('Other', 'General/uncategorized instrument type')
    ");
    $success[] = "Default instrument type ensured";

    // 3. Check if type_id column exists in tbl_instruments
    $stmt = $conn->query("DESCRIBE tbl_instruments");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    if (!in_array('type_id', $columns)) {
        // Add column as nullable
        $conn->exec("ALTER TABLE tbl_instruments ADD COLUMN type_id INT NULL");
        $success[] = "Added type_id column";

        // Set default for existing rows
        $defaultTypeId = $conn->query("SELECT type_id FROM tbl_instrument_types WHERE type_name = 'Other' LIMIT 1")->fetchColumn();
        if ($defaultTypeId) {
            $conn->exec("UPDATE tbl_instruments SET type_id = $defaultTypeId WHERE type_id IS NULL");
            $success[] = "Updated existing instruments with default type";
        }

        // Make NOT NULL
        $conn->exec("ALTER TABLE tbl_instruments MODIFY COLUMN type_id INT NOT NULL");
        $success[] = "Set type_id as NOT NULL";

        // Add foreign key
        $conn->exec("
            ALTER TABLE tbl_instruments 
            ADD CONSTRAINT fk_instruments_type 
            FOREIGN KEY (type_id) REFERENCES tbl_instrument_types(type_id)
        ");
        $success[] = "Added foreign key constraint";
    } else {
        $success[] = "type_id column already exists - no migration needed";
    }

    // 4. Add serial_number and condition columns if missing
    $stmt = $conn->query("DESCRIBE tbl_instruments");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (!in_array('serial_number', $columns)) {
        $conn->exec("ALTER TABLE tbl_instruments ADD COLUMN serial_number VARCHAR(50) NULL");
        $success[] = "Added serial_number column";
    } else {
        $success[] = "serial_number column already exists";
    }

    if (!in_array('condition', $columns)) {
        $conn->exec("ALTER TABLE tbl_instruments ADD COLUMN `condition` VARCHAR(50) NULL");
        $success[] = "Added condition column";
    } else {
        $success[] = "condition column already exists";
    }

    // 5. Add/update status column - add 'Active' to enum, set as default
    $stmt = $conn->query("DESCRIBE tbl_instruments");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
    if (in_array('status', $columns)) {
        $conn->exec("
            ALTER TABLE tbl_instruments 
            MODIFY COLUMN status ENUM('Active','Available','In Use','Under Repair','Inactive') DEFAULT 'Active'
        ");
        $success[] = "Status enum updated: Active is default for new instruments";
        $conn->exec("UPDATE tbl_instruments SET status = 'Active' WHERE status IS NULL OR status = ''");
    } else {
        $conn->exec("
            ALTER TABLE tbl_instruments 
            ADD COLUMN status ENUM('Active','Available','In Use','Under Repair','Inactive') DEFAULT 'Active'
        ");
        $success[] = "Added status column with Active as default";
    }

    // 6. Fix existing instruments with NULL condition - set to Available
    $conn->exec("UPDATE tbl_instruments SET `condition` = 'Available' WHERE (`condition` IS NULL OR `condition` = '')");
    $success[] = "Updated existing instruments with NULL condition to Available";

} catch (PDOException $e) {
    $errors[] = "Database error: " . $e->getMessage();
}

// Output
echo "=== Instrument Migration ===\n\n";
foreach ($success as $msg) {
    echo "[OK] $msg\n";
}
foreach ($errors as $msg) {
    echo "[ERROR] $msg\n";
}
echo "\n" . (empty($errors) ? "Migration completed successfully!" : "Migration had errors.") . "\n";
