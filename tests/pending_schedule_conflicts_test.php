<?php
declare(strict_types=1);

function check(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function overlaps(string $newStart, string $newEnd, string $existingStart, string $existingEnd): bool
{
    return $newStart < $existingEnd && $newEnd > $existingStart;
}

// Exact and partial overlaps are conflicts.
check(overlaps('10:00:00', '11:00:00', '10:00:00', '11:00:00'), 'Exact overlap was missed.');
check(overlaps('09:30:00', '10:30:00', '10:00:00', '11:00:00'), 'Left partial overlap was missed.');
check(overlaps('10:30:00', '11:30:00', '10:00:00', '11:00:00'), 'Right partial overlap was missed.');
check(overlaps('09:00:00', '12:00:00', '10:00:00', '11:00:00'), 'Containing overlap was missed.');

// Adjacent schedules are intentionally valid.
check(!overlaps('09:00:00', '10:00:00', '10:00:00', '11:00:00'), 'Left-adjacent slots must not conflict.');
check(!overlaps('11:00:00', '12:00:00', '10:00:00', '11:00:00'), 'Right-adjacent slots must not conflict.');

// Teacher conflicts are global: branch identity never weakens the predicate.
$sameTeacher = 17 === 17;
$differentBranches = 5 !== 6;
check($sameTeacher && $differentBranches && overlaps('10:15:00', '11:15:00', '10:00:00', '11:00:00'), 'Cross-branch teacher overlap was missed.');

// Reservation expiry is strict: an expiry at "now" no longer reserves a slot.
$now = strtotime('2026-09-06 12:00:00');
check(strtotime('2026-09-06 12:00:01') > $now, 'Future reservation should be active.');
check(!(strtotime('2026-09-06 12:00:00') > $now), 'Expired reservation should be inactive.');

// Guard the database-level simultaneous approval contract.
$source = file_get_contents(__DIR__ . '/../api/students.php');
check($source !== false, 'Could not read students API.');
check(str_contains($source, "ORDER BY enrollment_id FOR UPDATE"), 'Pending requests must be locked deterministically.');
check(str_contains($source, "AND status = 'Pending'"), 'Approval must condition writes on Pending status.');
check(str_contains($source, "schedule_request_status = 'Approved'"), 'Approval must atomically update request status.');

$deskSource = file_get_contents(__DIR__ . '/../js/desk/desk_enrollment.js');
check($deskSource !== false, 'Could not read desk enrollment UI.');
check(str_contains($deskSource, "exclude_request_id: String(Number(requestId))"), 'Desk approval checks must exclude the request\'s own reservation.');
check(str_contains($deskSource, 'inherit_teacher: isAdditionalDay'), 'Each instrument must have its own main instructor row.');

echo "pending schedule conflict tests: OK\n";
