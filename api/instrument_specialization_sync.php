<?php

/**
 * Keeps tbl_specialization aligned with tbl_instrument_types so teacher
 * assignments and scheduling use the same instrument categories.
 */
function specialization_table_exists(PDO $conn)
{
    try {
        $stmt = $conn->prepare('SHOW TABLES LIKE ?');
        $stmt->execute(['tbl_specialization']);
        return $stmt->rowCount() > 0;
    } catch (PDOException $e) {
        return false;
    }
}

function specialization_table_has_column(PDO $conn, $columnName)
{
    if (!preg_match('/^[A-Za-z0-9_]+$/', (string) $columnName)) {
        return false;
    }
    try {
        $stmt = $conn->prepare('SHOW COLUMNS FROM `tbl_specialization` LIKE ?');
        $stmt->execute([$columnName]);
        return $stmt->rowCount() > 0;
    } catch (PDOException $e) {
        return false;
    }
}

function instrument_types_table_exists(PDO $conn)
{
    try {
        $stmt = $conn->prepare('SHOW TABLES LIKE ?');
        $stmt->execute(['tbl_instrument_types']);
        return $stmt->rowCount() > 0;
    } catch (PDOException $e) {
        return false;
    }
}

function ensure_specialization_instrument_link(PDO $conn)
{
    if (!specialization_table_exists($conn)) {
        return;
    }

    try {
        if (!specialization_table_has_column($conn, 'type_id')) {
            $conn->exec('ALTER TABLE tbl_specialization ADD COLUMN type_id INT NULL DEFAULT NULL AFTER specialization_name');
            try {
                $conn->exec('ALTER TABLE tbl_specialization ADD KEY idx_spec_type_id (type_id)');
            } catch (PDOException $e) {
                // Index may already exist.
            }
        }
    } catch (PDOException $e) {
        // Schema may already be up to date.
    }

    sync_specializations_from_instrument_types($conn);
}

function sync_specializations_from_instrument_types(PDO $conn)
{
    if (!specialization_table_exists($conn) || !instrument_types_table_exists($conn)) {
        return;
    }

    try {
        $stmt = $conn->query("
            SELECT type_id, type_name
            FROM tbl_instrument_types
            WHERE TRIM(type_name) <> ''
              AND LOWER(TRIM(type_name)) <> 'other'
            ORDER BY type_name ASC
        ");
        $types = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
        foreach ($types as $type) {
            upsert_specialization_for_instrument_type(
                $conn,
                (int) ($type['type_id'] ?? 0),
                (string) ($type['type_name'] ?? '')
            );
        }
    } catch (PDOException $e) {
        // Do not break API callers when sync fails.
    }
}

function upsert_specialization_for_instrument_type(PDO $conn, $typeId, $typeName)
{
    $typeId = (int) $typeId;
    $typeName = trim((string) $typeName);
    if ($typeId < 1 || $typeName === '' || strtolower($typeName) === 'other') {
        return null;
    }
    if (!specialization_table_exists($conn)) {
        return null;
    }

    try {
        $findByType = $conn->prepare('SELECT specialization_id FROM tbl_specialization WHERE type_id = ? LIMIT 1');
        $findByType->execute([$typeId]);
        $existingByType = (int) $findByType->fetchColumn();

        $findByName = $conn->prepare('SELECT specialization_id FROM tbl_specialization WHERE LOWER(TRIM(specialization_name)) = LOWER(TRIM(?)) LIMIT 1');
        $findByName->execute([$typeName]);
        $existingByName = (int) $findByName->fetchColumn();

        if ($existingByType > 0) {
            $stmt = $conn->prepare('UPDATE tbl_specialization SET specialization_name = ?, type_id = ? WHERE specialization_id = ?');
            $stmt->execute([$typeName, $typeId, $existingByType]);
            return $existingByType;
        }

        if ($existingByName > 0) {
            $stmt = $conn->prepare('UPDATE tbl_specialization SET specialization_name = ?, type_id = ? WHERE specialization_id = ?');
            $stmt->execute([$typeName, $typeId, $existingByName]);
            return $existingByName;
        }

        $insert = $conn->prepare("INSERT INTO tbl_specialization (specialization_name, type_id, status) VALUES (?, ?, 'Active')");
        $insert->execute([$typeName, $typeId]);
        return (int) $conn->lastInsertId();
    } catch (PDOException $e) {
        return null;
    }
}

function rename_specialization_for_instrument_type(PDO $conn, $typeId, $oldTypeName, $newTypeName)
{
    $typeId = (int) $typeId;
    $oldTypeName = trim((string) $oldTypeName);
    $newTypeName = trim((string) $newTypeName);
    if ($typeId < 1 || $newTypeName === '' || strtolower($newTypeName) === 'other') {
        return;
    }
    if (!specialization_table_exists($conn)) {
        return;
    }

    try {
        if ($oldTypeName !== '' && strcasecmp($oldTypeName, $newTypeName) !== 0) {
            $stmt = $conn->prepare('
                UPDATE tbl_specialization
                SET specialization_name = ?, type_id = ?
                WHERE type_id = ?
                   OR LOWER(TRIM(specialization_name)) = LOWER(TRIM(?))
                LIMIT 1
            ');
            $stmt->execute([$newTypeName, $typeId, $typeId, $oldTypeName]);
            if ($stmt->rowCount() > 0) {
                return;
            }
        }
        upsert_specialization_for_instrument_type($conn, $typeId, $newTypeName);
    } catch (PDOException $e) {
        // Ignore rename failures.
    }
}
