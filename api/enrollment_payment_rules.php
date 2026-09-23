<?php

/** The session at which a package balance must already be settled. */
function fas_balance_deadline_session(int $sessions): int
{
    $deadlines = [12 => 7, 20 => 11, 50 => 30];
    return $deadlines[$sessions] ?? max(1, (int)ceil($sessions * 0.6));
}

function fas_enrollment_payment_status(float $total, float $paid, bool $pending, int $used, int $deadline): string
{
    if ($total > 0 && $paid >= $total - 0.005) return 'Fully Paid';
    if ($pending) return 'Pending Online Payment';
    if ($used >= $deadline && $total > $paid) return 'Payment Overdue';
    return $paid > 0 ? 'Partial' : 'Unpaid';
}

function fas_balance_payment_allowed(float $amount, float $balance): bool
{
    return is_finite($amount) && $amount > 0 && round($amount, 2) === $amount
        && $balance > 0 && $amount <= $balance + 0.005;
}
