<?php

function requireContains(string $source, string $needle, string $label): void
{
    if (strpos($source, $needle) === false) {
        fwrite(STDERR, "FAIL: {$label}\n");
        exit(1);
    }
}

$index = file_get_contents(__DIR__ . '/../js/index.js');
$desk = file_get_contents(__DIR__ . '/../js/desk/desk_enrollment.js');
$admin = file_get_contents(__DIR__ . '/../js/admin/admin_enrollments.js');
$manager = file_get_contents(__DIR__ . '/../pages/manager/manager_sessions.html');
$teacherCalendar = file_get_contents(__DIR__ . '/../js/shared/teacher_occupied_calendar.js');
$serverTime = file_get_contents(__DIR__ . '/../api/server_time.php');

requireContains($index, "const FAS_TIME_ZONE = 'Asia/Manila'", 'shared Manila timezone');
requireContains($index, 'server_time.php', 'server clock synchronization');
requireContains($index, 'getCalendarNow()', 'server-adjusted calendar clock');
requireContains($desk, 'window.getManilaYmd()', 'desk scheduling Manila today');
requireContains($admin, 'window.getManilaYmd()', 'admin scheduling Manila today');
requireContains($manager, 'window.getManilaYmd()', 'manager scheduling Manila today');
requireContains($teacherCalendar, "timeZone: 'Asia/Manila'", 'teacher calendar Manila display');
requireContains($serverTime, "new DateTimeZone('Asia/Manila')", 'server time endpoint timezone');

echo "Manila calendar time checks passed.\n";
