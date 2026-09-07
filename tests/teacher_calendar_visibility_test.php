<?php
declare(strict_types=1);

function calendarCheck(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$shared = file_get_contents(__DIR__ . '/../js/shared/teacher_occupied_calendar.js');
$adminJs = file_get_contents(__DIR__ . '/../js/admin/admin_teachers.js');
$adminPage = file_get_contents(__DIR__ . '/../pages/admin/admin_teachers.html');
$managerPage = file_get_contents(__DIR__ . '/../pages/manager/manager_teachers.html');

calendarCheck($shared !== false && $adminJs !== false && $adminPage !== false && $managerPage !== false, 'Teacher calendar sources could not be read.');
calendarCheck(str_contains($shared, 'occupied_slots'), 'Teacher calendar must load occupied sessions.');
calendarCheck(str_contains($shared, 'pending reservation'), 'Teacher calendar must show pending reservations.');
calendarCheck(str_contains($shared, 'Red: occupied by a scheduled session'), 'Teacher calendar must explain occupied dates.');
calendarCheck(str_contains($adminJs, 'openAdminTeacherCalendar'), 'Admin teacher list must expose the calendar action.');
calendarCheck(str_contains($adminPage, 'teacher_occupied_calendar.js'), 'Admin teachers page must load the calendar component.');
calendarCheck(str_contains($managerPage, 'openManagerTeacherCalendar'), 'Manager teacher list must expose the calendar action.');
calendarCheck(str_contains($managerPage, 'teacher_occupied_calendar.js'), 'Manager teachers page must load the calendar component.');

echo "teacher calendar visibility tests: OK\n";
