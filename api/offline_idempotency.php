<?php

/**
 * Idempotency support for mutations that may be replayed from the offline queue.
 * The table contains only replay metadata and the already returned JSON response.
 */
function fas_idempotency_ensure_table(PDO $pdo): void
{
    static $ready = false;
    if ($ready) return;
    $pdo->exec("CREATE TABLE IF NOT EXISTS tbl_offline_transactions (
        transaction_id VARCHAR(80) NOT NULL PRIMARY KEY,
        action_name VARCHAR(80) NOT NULL,
        user_id INT NULL,
        branch_id INT NULL,
        payload_hash CHAR(64) NOT NULL,
        status ENUM('processing','complete') NOT NULL DEFAULT 'processing',
        response_json MEDIUMTEXT NULL,
        response_status SMALLINT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME NULL,
        INDEX idx_offline_transaction_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $ready = true;
}

function fas_idempotency_key(array $payload): string
{
    $header = trim((string)($_SERVER['HTTP_X_IDEMPOTENCY_KEY'] ?? ''));
    return $header !== '' ? $header : trim((string)($payload['client_transaction_id'] ?? ''));
}

function fas_idempotency_begin(PDO $pdo, string $action, array $payload): void
{
    $key = fas_idempotency_key($payload);
    if ($key === '') return;
    if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._:-]{15,79}$/', $key)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid client transaction ID.']);
        exit;
    }
    fas_idempotency_ensure_table($pdo);
    $hashPayload = $payload;
    unset($hashPayload['client_transaction_id']);
    $hash = hash('sha256', json_encode($hashPayload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    $userId = (int)($payload['user_id'] ?? 0) ?: null;
    $branchId = (int)($payload['branch_id'] ?? 0) ?: null;
    try {
        $insert = $pdo->prepare("INSERT INTO tbl_offline_transactions
            (transaction_id, action_name, user_id, branch_id, payload_hash)
            VALUES (?, ?, ?, ?, ?)");
        $insert->execute([$key, $action, $userId, $branchId, $hash]);
        $GLOBALS['fas_idempotency_context'] = ['pdo' => $pdo, 'key' => $key];
    } catch (PDOException $e) {
        if ((string)$e->getCode() !== '23000') throw $e;
        $find = $pdo->prepare("SELECT action_name, user_id, branch_id, payload_hash, status, response_json, response_status, created_at
            FROM tbl_offline_transactions WHERE transaction_id = ? LIMIT 1");
        $find->execute([$key]);
        $existing = $find->fetch(PDO::FETCH_ASSOC);
        $sameIdentity = $existing
            && hash_equals((string)$existing['payload_hash'], $hash)
            && (string)$existing['action_name'] === $action
            && (int)($existing['user_id'] ?? 0) === (int)($userId ?? 0)
            && (int)($existing['branch_id'] ?? 0) === (int)($branchId ?? 0);
        if (!$sameIdentity) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'Transaction ID was already used for a different request.']);
            exit;
        }
        if ($existing['status'] === 'complete' && $existing['response_json'] !== null) {
            http_response_code((int)($existing['response_status'] ?: 200));
            echo $existing['response_json'];
            exit;
        }
        if (strtotime((string)$existing['created_at']) < time() - 120) {
            $pdo->prepare("DELETE FROM tbl_offline_transactions WHERE transaction_id = ? AND status = 'processing'")->execute([$key]);
            fas_idempotency_begin($pdo, $action, $payload);
            return;
        }
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'This offline record is already being synchronized.']);
        exit;
    }
}

function fas_idempotency_finalize(array $data, int $status): void
{
    $context = $GLOBALS['fas_idempotency_context'] ?? null;
    if (!$context || !isset($context['pdo'], $context['key'])) return;
    /** @var PDO $pdo */
    $pdo = $context['pdo'];
    if ($status >= 200 && $status < 300 && !empty($data['success'])) {
        $json = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $stmt = $pdo->prepare("UPDATE tbl_offline_transactions
            SET status='complete', response_json=?, response_status=?, completed_at=NOW()
            WHERE transaction_id=?");
        $stmt->execute([$json, $status, $context['key']]);
    } else {
        $pdo->prepare("DELETE FROM tbl_offline_transactions WHERE transaction_id=? AND status='processing'")->execute([$context['key']]);
    }
    unset($GLOBALS['fas_idempotency_context']);
}
