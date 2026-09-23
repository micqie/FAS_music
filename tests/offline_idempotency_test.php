<?php
require_once __DIR__ . '/../api/db_connect.php';
require_once __DIR__ . '/../api/offline_idempotency.php';

$transactionId = 'offline-test-' . bin2hex(random_bytes(12));
$payload = [
    'client_transaction_id' => $transactionId,
    'user_id' => 987654,
    'branch_id' => 987654,
    'value' => 'idempotency-probe'
];
$_SERVER['HTTP_X_IDEMPOTENCY_KEY'] = $transactionId;

register_shutdown_function(function () use ($conn, $transactionId) {
    try {
        $conn->prepare('DELETE FROM tbl_offline_transactions WHERE transaction_id = ?')->execute([$transactionId]);
    } catch (Throwable $ignored) {
    }
});

fas_idempotency_begin($conn, 'offline-test', $payload);
fas_idempotency_finalize(['success' => true, 'probe' => $transactionId], 200);

// A replay must return the stored response and exit before the failure below.
fas_idempotency_begin($conn, 'offline-test', $payload);
fwrite(STDERR, "Replay was not intercepted.\n");
exit(1);
