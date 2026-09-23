<?php
require_once __DIR__ . '/../api/enrollment_payment_rules.php';

function assertSameValue($expected, $actual, string $label): void
{
    if ($expected !== $actual) throw new RuntimeException($label . ': expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
}

foreach ([12 => 7, 20 => 11, 50 => 30] as $sessions => $deadline) {
    assertSameValue($deadline, fas_balance_deadline_session($sessions), "{$sessions} session deadline");
}
assertSameValue('Fully Paid', fas_enrollment_payment_status(6000, 6000, false, 0, 7), 'full payment');
assertSameValue('Partial', fas_enrollment_payment_status(6000, 3000, false, 3, 7), 'partial payment');
assertSameValue('Partial', fas_enrollment_payment_status(6000, 3000, false, 6, 7), 'deadline reminder');
assertSameValue('Payment Overdue', fas_enrollment_payment_status(6000, 3000, false, 7, 7), 'deadline reached');
assertSameValue('Pending Online Payment', fas_enrollment_payment_status(6000, 3000, true, 7, 7), 'pending approval');
assertSameValue('Unpaid', fas_enrollment_payment_status(6000, 0, false, 0, 7), 'unpaid');
assertSameValue(true, fas_balance_payment_allowed(1500, 3000), 'smaller desk installment');
assertSameValue(true, fas_balance_payment_allowed(3000, 3000), 'full remaining balance');
assertSameValue(false, fas_balance_payment_allowed(3000.01, 3000), 'overpayment');
assertSameValue(false, fas_balance_payment_allowed(0, 3000), 'zero payment');
assertSameValue(false, fas_balance_payment_allowed(1500.001, 3000), 'fractional cent');
echo "Enrollment payment rules passed.\n";
