<?php
require_once __DIR__ . '/../api/auth_session.php';

function assertAllowed(bool $actual, bool $expected, string $case): void
{
    if ($actual !== $expected) throw new RuntimeException($case);
}

$student = ['user_id' => 11, 'role_name' => 'Student'];
$admin = ['user_id' => 1, 'role_name' => 'Admin'];
assertAllowed(fas_can_change_user_password($student, 11, false), true, 'Self change denied');
assertAllowed(fas_can_change_user_password($student, 12, false), false, 'Another account accepted');
assertAllowed(fas_can_change_user_password($student, 12, true), false, 'Non-admin override accepted');
assertAllowed(fas_can_change_user_password($admin, 12, true), true, 'Admin override denied');
assertAllowed(fas_can_change_user_password($admin, 12, false), false, 'Admin bypassed override requirement');
$first = fas_generate_temporary_password();
$second = fas_generate_temporary_password();
assertAllowed($first !== $second && strlen($first) >= 20, true, 'Temporary passwords are not random');
assertAllowed((bool)preg_match('/[A-Z]/', $first) && (bool)preg_match('/[a-z]/', $first)
    && (bool)preg_match('/[0-9]/', $first) && (bool)preg_match('/[!@#$%^&*]/', $first), true, 'Temporary password misses policy');
echo "Authorization checks passed.\n";
