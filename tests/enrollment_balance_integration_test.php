<?php
/** Exercises payment recording against temporary copies of real schema and one partial fixture. */
require_once __DIR__ . '/../api/db_connect.php';
require_once __DIR__ . '/../api/enrollment_payment_rules.php';

class PaymentTestResponse extends RuntimeException
{
    public array $body;
    public int $status;
    public function __construct(array $body, int $status) {
        parent::__construct($body['error'] ?? $body['message'] ?? 'Response');
        $this->body = $body;
        $this->status = $status;
    }
}
function fas_require_authenticated_user(PDO $conn, ?array $allowedRoleCategories = null): array {
    return $GLOBALS['paymentTestActor'];
}
function fas_normalize_role_category(?string $role): string { return strtolower((string)$role); }

$source = file_get_contents(__DIR__ . '/../api/students.php');
$start = strpos($source, 'class StudentsApi');
$end = strpos($source, '$studentsApi = new StudentsApi');
$classCode = substr($source, $start, $end - $start);
$classCode = str_replace("file_get_contents('php://input')", '$GLOBALS[\'paymentTestInput\']', $classCode);
// sendJSON exits in production; the test exception must bypass broad error handlers.
$classCode = str_replace('catch (Throwable $e)', 'catch (PDOException $e)', $classCode);
eval($classCode);
class TestStudentsApi extends StudentsApi {
    public function sendJSON($data, $status = 200) { throw new PaymentTestResponse($data, $status); }
}
function paymentAssert(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
function paymentResponse(TestStudentsApi $api, string $method, array $data): PaymentTestResponse {
    $GLOBALS['paymentTestInput'] = json_encode($data);
    try { $api->$method(); } catch (PaymentTestResponse $response) { return $response; }
    throw new RuntimeException('No API response from ' . $method);
}
function copyFixture(PDO $conn, string $table, array $rows): void {
    $shadow = 'payment_test_shadow_' . $table;
    $conn->exec("CREATE TEMPORARY TABLE {$shadow} LIKE {$table}");
    $conn->exec("ALTER TABLE {$shadow} RENAME TO {$table}");
    foreach ($rows as $row) {
        $columns = array_keys($row);
        $quoted = array_map(static fn($column) => '`' . $column . '`', $columns);
        $sql = "INSERT INTO {$table} (" . implode(',', $quoted) . ') VALUES (' . implode(',', array_fill(0, count($columns), '?')) . ')';
        $conn->prepare($sql)->execute(array_values($row));
    }
}

$candidate = $conn->query("SELECT e.* FROM tbl_enrollments e WHERE e.status = 'Active' AND e.enrollment_id IN (SELECT p.enrollment_id FROM tbl_payments p WHERE p.status = 'Paid') ORDER BY e.enrollment_id DESC")->fetchAll(PDO::FETCH_ASSOC);
$fixture = null;
foreach ($candidate as $row) {
    $meta = json_decode((string)($row['request_notes'] ?? ''), true) ?: [];
    $priceStmt = $conn->prepare('SELECT price FROM tbl_session_packages WHERE package_id = ?');
    $priceStmt->execute([$row['package_id']]);
    $total = (float)($meta['package_total_amount'] ?? $priceStmt->fetchColumn());
    $paidStmt = $conn->prepare("SELECT COALESCE(SUM(amount),0) FROM tbl_payments WHERE enrollment_id = ? AND status = 'Paid'");
    $paidStmt->execute([$row['enrollment_id']]);
    $paid = (float)$paidStmt->fetchColumn();
    if ($total > $paid && $paid > 0) { $fixture = $row; break; }
}
if (!$fixture) throw new RuntimeException('A partial enrollment fixture is required for this integration test.');
$id = (int)$fixture['enrollment_id'];
$student = $conn->prepare('SELECT * FROM tbl_students WHERE student_id = ?');
$student->execute([$fixture['student_id']]);
$studentRow = $student->fetch(PDO::FETCH_ASSOC);
$package = $conn->prepare('SELECT * FROM tbl_session_packages WHERE package_id = ?');
$package->execute([$fixture['package_id']]);
$packageRow = $package->fetch(PDO::FETCH_ASSOC);
$payments = $conn->prepare('SELECT * FROM tbl_payments WHERE enrollment_id = ?');
$payments->execute([$id]);
$paymentRows = $payments->fetchAll(PDO::FETCH_ASSOC);
$sessions = $conn->prepare('SELECT * FROM tbl_sessions WHERE enrollment_id = ?');
$sessions->execute([$id]);
$sessionRows = $sessions->fetchAll(PDO::FETCH_ASSOC);
copyFixture($conn, 'tbl_students', [$studentRow]);
copyFixture($conn, 'tbl_session_packages', [$packageRow]);
copyFixture($conn, 'tbl_enrollments', [$fixture]);
copyFixture($conn, 'tbl_payments', $paymentRows);
copyFixture($conn, 'tbl_sessions', $sessionRows);

$GLOBALS['paymentTestActor'] = ['role_name' => 'staff', 'branch_id' => $studentRow['branch_id'], 'email' => ''];
$_SERVER['REQUEST_METHOD'] = 'POST';
$api = (new ReflectionClass(TestStudentsApi::class))->newInstanceWithoutConstructor();
$property = new ReflectionProperty(StudentsApi::class, 'conn');
$property->setAccessible(true);
$property->setValue($api, $conn);
$balanceMethod = new ReflectionMethod(StudentsApi::class, 'balanceEnrollment');
$balanceMethod->setAccessible(true);
$balance = static fn() => $balanceMethod->invoke($api, $id, false);
$original = $balance();
paymentAssert($original['payment_status'] === 'Partial', 'Fixture should start partial');
paymentAssert($original['balance_amount'] > 0, 'Fixture should have a balance');

$overpay = paymentResponse($api, 'recordEnrollmentPayment', ['enrollment_id' => $id, 'amount' => $original['balance_amount'] + 1, 'payment_method' => 'Cash']);
paymentAssert($overpay->status === 400, 'Overpayment should be rejected');
if ($conn->inTransaction()) $conn->rollBack();
$firstAmount = round($original['balance_amount'] / 2, 2);
$first = paymentResponse($api, 'recordEnrollmentPayment', ['enrollment_id' => $id, 'amount' => $firstAmount, 'payment_method' => 'Cash', 'receipt_number' => 'TEST-FIRST']);
paymentAssert($first->body['success'] === true, 'First desk installment should succeed');
$afterFirst = $balance();
paymentAssert($afterFirst['payment_status'] === 'Partial', 'First installment remains partial');
paymentAssert(abs($afterFirst['balance_amount'] - ($original['balance_amount'] - $firstAmount)) < .01, 'First installment balance');
$duplicate = paymentResponse($api, 'recordEnrollmentPayment', ['enrollment_id' => $id, 'amount' => $firstAmount, 'payment_method' => 'Cash', 'receipt_number' => 'TEST-FIRST']);
paymentAssert($duplicate->status === 409, 'Duplicate receipt should be rejected');
if ($conn->inTransaction()) $conn->rollBack();
$second = paymentResponse($api, 'recordEnrollmentPayment', ['enrollment_id' => $id, 'amount' => $afterFirst['balance_amount'], 'payment_method' => 'GCash', 'receipt_number' => 'TEST-SECOND']);
paymentAssert($second->body['success'] === true && $balance()['payment_status'] === 'Fully Paid', 'Second installment should settle balance');
paymentAssert($balance()['balance_amount'] === 0.0, 'Settled balance should be zero');

$conn->prepare("DELETE FROM tbl_payments WHERE enrollment_id = ? AND receipt_number IN ('TEST-FIRST','TEST-SECOND')")->execute([$id]);
$pending = $conn->prepare("INSERT INTO tbl_payments (enrollment_id, amount, payment_method, payment_type, payment_date, status, reference_number, notes) VALUES (?, ?, 'GCash', 'Installment', CURDATE(), 'Pending', 'TEST-ONLINE', ?)");
$pending->execute([$id, $original['balance_amount'], json_encode(['kind' => 'balance_online', 'proof_path' => 'uploads/payment_proofs/enrollment_balances/test.jpg'])]);
$pendingId = (int)$conn->lastInsertId();
paymentAssert($balance()['payment_status'] === 'Pending Online Payment', 'Pending online payment must not credit balance');
$queue = paymentResponse($api, 'getPendingEnrollmentBalancePayments', []);
paymentAssert(count($queue->body['payments'] ?? []) === 1, 'Staff review queue should include pending balance payment');
$rejected = paymentResponse($api, 'reviewEnrollmentBalancePayment', ['payment_id' => $pendingId, 'decision' => 'reject']);
paymentAssert($rejected->body['status'] === 'Failed', 'Rejected online payment should fail');
paymentAssert($balance()['payment_status'] === 'Partial', 'Rejection should preserve balance');
$pending->execute([$id, $original['balance_amount'], json_encode(['kind' => 'balance_online', 'proof_path' => 'uploads/payment_proofs/enrollment_balances/test.jpg'])]);
$pendingId = (int)$conn->lastInsertId();
$approved = paymentResponse($api, 'reviewEnrollmentBalancePayment', ['payment_id' => $pendingId, 'decision' => 'approve']);
paymentAssert($approved->body['status'] === 'Paid', 'Online review should approve payment');
paymentAssert($balance()['payment_status'] === 'Fully Paid', 'Approval should settle balance');
$repeat = paymentResponse($api, 'reviewEnrollmentBalancePayment', ['payment_id' => $pendingId, 'decision' => 'approve']);
paymentAssert($repeat->status === 404, 'Approved online payment cannot be approved twice');
if ($conn->inTransaction()) $conn->rollBack();
echo "Enrollment balance integration passed using temporary tables.\n";
