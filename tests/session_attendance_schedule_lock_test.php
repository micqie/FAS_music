<?php

function attendanceLockCheck($condition, $message)
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$source = file_get_contents(__DIR__ . '/../api/students.php');
attendanceLockCheck($source !== false, 'Could not read students API source.');

attendanceLockCheck(
    str_contains($source, 'private function sessionHasRecordedAttendance'),
    'Session scheduling must define an attendance lock check.'
);
attendanceLockCheck(
    str_contains($source, "attendanceStatus !== '' && \$attendanceStatus !== 'pending'"),
    'Non-pending session attendance must lock schedule changes.'
);
attendanceLockCheck(
    str_contains($source, 'FROM tbl_attendance') && str_contains($source, 'attended_at >= CONCAT'),
    'Attendance rows must be used as a legacy/check-in backstop.'
);
attendanceLockCheck(
    substr_count($source, 'SESSION_ATTENDANCE_LOCKED') >= 2,
    'Both direct editing and rescheduling must return the attendance-lock error.'
);
attendanceLockCheck(
    str_contains($source, "if (\$existingSessionId > 0 && !\$this->canEditScheduledSession"),
    'Existing sessions must be validated even when edit_existing is false.'
);

echo "session attendance schedule lock tests: OK\n";
