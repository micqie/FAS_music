<?php
require_once 'db_connect.php';

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

class AttendanceApi
{
    private $conn;

    public function __construct($pdo)
    {
        $this->conn = $pdo;
        $this->ensureSessionPolicyColumns();
    }

    public function sendJSON($data, $status = 200)
    {
        http_response_code($status);
        echo json_encode($data);
        exit;
    }

    private function tableExists($tableName)
    {
        try {
            $stmt = $this->conn->prepare("SHOW TABLES LIKE ?");
            $stmt->execute([$tableName]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            return false;
        }
    }

    private function tableHasColumn($tableName, $columnName)
    {
        try {
            $stmt = $this->conn->prepare("SHOW COLUMNS FROM {$tableName} LIKE ?");
            $stmt->execute([$columnName]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            return false;
        }
    }

    private function ensureAttendanceTable()
    {
        if ($this->tableExists('tbl_attendance')) {
            if (!$this->tableHasColumn('tbl_attendance', 'branch_id')) {
                try {
                    $this->conn->exec("ALTER TABLE tbl_attendance ADD COLUMN branch_id INT NULL AFTER student_id");
                    try { $this->conn->exec("CREATE INDEX idx_attendance_branch ON tbl_attendance(branch_id)"); } catch (PDOException $e) {}
                } catch (PDOException $e) {
                    // Ignore schema upgrades
                }
            }
            return true;
        }
        try {
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS tbl_attendance (
                    attendance_id INT AUTO_INCREMENT PRIMARY KEY,
                    student_id INT NOT NULL,
                    branch_id INT NULL,
                    attended_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    status ENUM('Present','Absent','Late','Excused') NOT NULL DEFAULT 'Present',
                    source VARCHAR(30) NULL,
                    notes VARCHAR(255) NULL
                )
            ");
            try { $this->conn->exec("CREATE INDEX idx_attendance_student ON tbl_attendance(student_id)"); } catch (PDOException $e) {}
            try { $this->conn->exec("CREATE INDEX idx_attendance_date ON tbl_attendance(attended_at)"); } catch (PDOException $e) {}
            try { $this->conn->exec("CREATE INDEX idx_attendance_branch ON tbl_attendance(branch_id)"); } catch (PDOException $e) {}
        } catch (PDOException $e) {
            return false;
        }
        return $this->tableExists('tbl_attendance');
    }

    private function ensureSessionPolicyColumns()
    {
        if ($this->tableExists('tbl_enrollments')) {
            $enrollmentColumns = [
                'allowed_absences' => "ALTER TABLE tbl_enrollments ADD COLUMN allowed_absences INT NOT NULL DEFAULT 0 AFTER total_sessions",
                'used_absences' => "ALTER TABLE tbl_enrollments ADD COLUMN used_absences INT NOT NULL DEFAULT 0 AFTER allowed_absences",
                'consecutive_absences' => "ALTER TABLE tbl_enrollments ADD COLUMN consecutive_absences INT NOT NULL DEFAULT 0 AFTER used_absences",
                'schedule_status' => "ALTER TABLE tbl_enrollments ADD COLUMN schedule_status ENUM('Active','Frozen','Ended') NOT NULL DEFAULT 'Active' AFTER status",
                'current_operation_id' => "ALTER TABLE tbl_enrollments ADD COLUMN current_operation_id INT NULL AFTER fixed_schedule_locked"
            ];
            foreach ($enrollmentColumns as $column => $sql) {
                try {
                    if (!$this->tableHasColumn('tbl_enrollments', $column)) {
                        $this->conn->exec($sql);
                    }
                } catch (PDOException $e) {
                    // Keep API working even if migrations fail.
                }
            }
        }

        if ($this->tableExists('tbl_sessions')) {
            $sessionColumns = [
                'operation_id' => "ALTER TABLE tbl_sessions ADD COLUMN operation_id INT NULL AFTER room_id",
                'attendance_status' => "ALTER TABLE tbl_sessions ADD COLUMN attendance_status ENUM('Pending','Present','Absent','Late','Excused','CI','Teacher Absent') NOT NULL DEFAULT 'Pending' AFTER status",
                'absence_notice' => "ALTER TABLE tbl_sessions ADD COLUMN absence_notice ENUM('None','Prior','NoNotice','Teacher') NOT NULL DEFAULT 'None' AFTER attendance_status",
                'counted_in' => "ALTER TABLE tbl_sessions ADD COLUMN counted_in TINYINT(1) NOT NULL DEFAULT 0 AFTER absence_notice",
                'makeup_eligible' => "ALTER TABLE tbl_sessions ADD COLUMN makeup_eligible TINYINT(1) NOT NULL DEFAULT 0 AFTER counted_in",
                'makeup_required' => "ALTER TABLE tbl_sessions ADD COLUMN makeup_required TINYINT(1) NOT NULL DEFAULT 0 AFTER makeup_eligible"
            ];
            foreach ($sessionColumns as $column => $sql) {
                try {
                    if (!$this->tableHasColumn('tbl_sessions', $column)) {
                        $this->conn->exec($sql);
                    }
                } catch (PDOException $e) {
                    // Ignore schema upgrade failures.
                }
            }
        }
    }

    private function formatLongDate($dateYmd)
    {
        $timestamp = strtotime((string)$dateYmd);
        return $timestamp ? date('F j, Y', $timestamp) : (string)$dateYmd;
    }

    private function getBranchNameById($branchId)
    {
        $branchId = (int)$branchId;
        if ($branchId < 1 || !$this->tableExists('tbl_branches')) {
            return null;
        }
        try {
            $stmt = $this->conn->prepare("SELECT branch_name FROM tbl_branches WHERE branch_id = ? LIMIT 1");
            $stmt->execute([$branchId]);
            $name = $stmt->fetchColumn();
            return $name !== false ? $name : null;
        } catch (PDOException $e) {
            return null;
        }
    }

    private function getStudentById($studentId)
    {
        $stmt = $this->conn->prepare("
            SELECT s.student_id, s.first_name, s.last_name, s.email, s.branch_id, b.branch_name
            FROM tbl_students s
            LEFT JOIN tbl_branches b ON b.branch_id = s.branch_id
            WHERE s.student_id = ?
            LIMIT 1
        ");
        $stmt->execute([(int)$studentId]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    private function getStudentByEmail($email)
    {
        $stmt = $this->conn->prepare("
            SELECT s.student_id, s.first_name, s.last_name, s.email, s.branch_id, b.branch_name
            FROM tbl_students s
            LEFT JOIN tbl_branches b ON b.branch_id = s.branch_id
            WHERE LOWER(TRIM(s.email)) = LOWER(?)
            LIMIT 1
        ");
        $stmt->execute([trim((string)$email)]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    private function getStudentAttendanceForDate($studentId, $dateYmd)
    {
        if (!$this->ensureAttendanceTable()) {
            return null;
        }
        $stmt = $this->conn->prepare("
            SELECT attendance_id, attended_at, status, source, notes
            FROM tbl_attendance
            WHERE student_id = ?
              AND DATE(attended_at) = ?
              AND status IN ('Present', 'Late', 'Excused')
            ORDER BY attended_at DESC, attendance_id DESC
            LIMIT 1
        ");
        $stmt->execute([(int)$studentId, $dateYmd]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    private function getStudentSessionRows($studentId)
    {
        if (!$this->tableExists('tbl_sessions') || !$this->tableExists('tbl_enrollments')) {
            return [];
        }
        $stmt = $this->conn->prepare("
            SELECT
                ts.session_id,
                ts.enrollment_id,
                ts.session_number,
                ts.session_date,
                ts.start_time,
                ts.end_time,
                ts.status,
                ts.attendance_status,
                ts.absence_notice,
                ts.counted_in,
                ts.makeup_eligible,
                ts.makeup_required,
                ts.notes,
                ts.attendance_notes,
                e.status AS enrollment_status
            FROM tbl_sessions ts
            INNER JOIN tbl_enrollments e ON e.enrollment_id = ts.enrollment_id
            WHERE e.student_id = ?
              AND e.status = 'Active'
              AND ts.status <> 'cancelled_by_teacher'
            ORDER BY ts.session_date ASC, ts.session_number ASC, ts.session_id ASC
        ");
        $stmt->execute([(int)$studentId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    private function getAllowedAbsencesForEnrollment($enrollment)
    {
        $allowed = (int)($enrollment['allowed_absences'] ?? 0);
        if ($allowed > 0) {
            return $allowed;
        }

        $totalSessions = max(0, (int)($enrollment['total_sessions'] ?? 0));
        if ($totalSessions === 12) return 2;
        if ($totalSessions === 20) return 3;
        if ($totalSessions > 20) return 3;
        return 0;
    }

    private function getScheduleOperationIdByCode($operationCode)
    {
        $operationCode = trim((string)$operationCode);
        if ($operationCode === '' || !$this->tableExists('tbl_schedule_operation_lookup')) {
            return null;
        }

        try {
            $stmt = $this->conn->prepare("
                SELECT operation_id
                FROM tbl_schedule_operation_lookup
                WHERE operation_code = ?
                  AND status = 'Active'
                LIMIT 1
            ");
            $stmt->execute([$operationCode]);
            $value = $stmt->fetchColumn();
            return $value !== false ? (int)$value : null;
        } catch (PDOException $e) {
            return null;
        }
    }

    private function getStudentSessionForDate($studentId, $dateYmd, $forUpdate = false)
    {
        if (!$this->tableExists('tbl_sessions') || !$this->tableExists('tbl_enrollments')) {
            return null;
        }

        $sql = "
            SELECT
                ts.*,
                te.student_id,
                te.total_sessions,
                te.allowed_absences,
                te.used_absences,
                te.consecutive_absences,
                te.schedule_status
            FROM tbl_sessions ts
            INNER JOIN tbl_enrollments te ON te.enrollment_id = ts.enrollment_id
            WHERE te.student_id = ?
              AND te.status = 'Active'
              AND ts.session_date = ?
              AND ts.status NOT IN ('cancelled_by_teacher', 'rescheduled')
            ORDER BY ts.session_number ASC, ts.session_id ASC
            LIMIT 1
        ";
        if ($forUpdate) {
            $sql .= " FOR UPDATE";
        }

        $stmt = $this->conn->prepare($sql);
        $stmt->execute([(int)$studentId, $dateYmd]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    private function countStudentAbsencesBeforeSession($enrollmentId, $excludeSessionId = 0)
    {
        if (!$this->tableExists('tbl_sessions')) {
            return 0;
        }

        $sql = "
            SELECT COUNT(*)
            FROM tbl_sessions
            WHERE enrollment_id = ?
              AND (
                  attendance_status IN ('Absent', 'CI')
                  OR status IN ('No Show', 'Cancelled')
              )
        ";
        $params = [(int)$enrollmentId];
        if ($excludeSessionId > 0) {
            $sql .= " AND session_id <> ? ";
            $params[] = (int)$excludeSessionId;
        }

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);
        return (int)($stmt->fetchColumn() ?: 0);
    }

    private function syncEnrollmentPolicyState($enrollmentId)
    {
        $enrollmentId = (int)$enrollmentId;
        if ($enrollmentId < 1 || !$this->tableExists('tbl_enrollments') || !$this->tableExists('tbl_sessions')) {
            return;
        }

        $stmtEnrollment = $this->conn->prepare("
            SELECT enrollment_id, total_sessions, allowed_absences, status
            FROM tbl_enrollments
            WHERE enrollment_id = ?
            LIMIT 1
        ");
        $stmtEnrollment->execute([$enrollmentId]);
        $enrollment = $stmtEnrollment->fetch(PDO::FETCH_ASSOC);
        if (!$enrollment) {
            return;
        }

        $allowedAbsences = $this->getAllowedAbsencesForEnrollment($enrollment);
        $freezeThreshold = 3;
        $freezeTriggered = false;
        $currentStreak = 0;
        $usedAbsences = 0;

        $stmtSessions = $this->conn->prepare("
            SELECT session_date, session_number, status, attendance_status, absence_notice
            FROM tbl_sessions
            WHERE enrollment_id = ?
            ORDER BY session_date ASC, session_number ASC, session_id ASC
        ");
        $stmtSessions->execute([$enrollmentId]);
        $sessions = $stmtSessions->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $todayYmd = date('Y-m-d');

        foreach ($sessions as $session) {
            $sessionDate = (string)($session['session_date'] ?? '');
            if ($sessionDate === '' || $sessionDate > $todayYmd) {
                continue;
            }

            $status = strtolower(trim((string)($session['status'] ?? '')));
            $attendanceStatus = strtolower(trim((string)($session['attendance_status'] ?? '')));

            $isTeacherAbsent = ($status === 'cancelled_by_teacher') || ($attendanceStatus === 'teacher absent');
            if ($isTeacherAbsent) {
                continue;
            }

            $isStudentAbsent = in_array($attendanceStatus, ['absent', 'ci'], true) || in_array($status, ['no show', 'cancelled'], true);
            $isPresent = in_array($attendanceStatus, ['present', 'late', 'excused'], true) || in_array($status, ['completed', 'late'], true);

            if ($isStudentAbsent) {
                $usedAbsences++;
                $currentStreak++;
                if ($currentStreak >= $freezeThreshold) {
                    $freezeTriggered = true;
                }
                continue;
            }

            if ($isPresent) {
                $currentStreak = 0;
            }
        }

        $currentOperationId = $freezeTriggered ? $this->getScheduleOperationIdByCode('SCHEDULE_FREEZE') : null;
        $scheduleStatus = $freezeTriggered ? 'Frozen' : 'Active';

        $stmtUpdate = $this->conn->prepare("
            UPDATE tbl_enrollments
            SET allowed_absences = ?,
                used_absences = ?,
                consecutive_absences = ?,
                schedule_status = ?,
                current_operation_id = ?
            WHERE enrollment_id = ?
        ");
        $stmtUpdate->execute([
            $allowedAbsences,
            $usedAbsences,
            $currentStreak,
            $scheduleStatus,
            $currentOperationId,
            $enrollmentId
        ]);
    }

    private function ensureMakeupSessionLink($session, $teacherId)
    {
        if (!$this->tableExists('tbl_makeup_sessions')) {
            return;
        }

        $sessionId = (int)($session['session_id'] ?? 0);
        if ($sessionId < 1) {
            return;
        }

        try {
            $stmt = $this->conn->prepare("
                INSERT INTO tbl_makeup_sessions (original_session_id, teacher_id, status)
                VALUES (?, ?, 'Scheduled')
                ON DUPLICATE KEY UPDATE teacher_id = VALUES(teacher_id), status = VALUES(status)
            ");
            $stmt->execute([$sessionId, (int)$teacherId]);
        } catch (PDOException $e) {
            // Ignore if the table does not yet have a unique constraint.
        }
    }

    private function applySessionAttendanceOutcome($studentId, $dateYmd, $mode, $options = [])
    {
        $studentId = (int)$studentId;
        if ($studentId < 1) {
            return null;
        }

        $session = $this->getStudentSessionForDate($studentId, $dateYmd, true);
        if (!$session) {
            return null;
        }

        $sessionId = (int)($session['session_id'] ?? 0);
        $enrollmentId = (int)($session['enrollment_id'] ?? 0);
        $teacherId = (int)($session['teacher_id'] ?? 0);
        $allowedAbsences = $this->getAllowedAbsencesForEnrollment($session);
        $note = trim((string)($options['note'] ?? ''));

        $status = 'Scheduled';
        $attendanceStatus = 'Pending';
        $absenceNotice = 'None';
        $countedIn = 0;
        $makeupEligible = 0;
        $makeupRequired = 0;
        $operationCode = 'REGULAR_SESSION';

        if ($mode === 'present') {
            $status = 'Completed';
            $attendanceStatus = 'Present';
            $countedIn = 1;
        } elseif ($mode === 'late') {
            $status = 'Late';
            $attendanceStatus = 'Late';
            $countedIn = 1;
        } elseif ($mode === 'student_absent_notice') {
            $priorAbsences = $this->countStudentAbsencesBeforeSession($enrollmentId, $sessionId);
            $withinLimit = ($priorAbsences + 1) <= $allowedAbsences;
            $status = 'Cancelled';
            $attendanceStatus = 'Absent';
            $absenceNotice = 'Prior';
            $countedIn = $withinLimit ? 0 : 1;
            $makeupEligible = $withinLimit ? 1 : 0;
            $makeupRequired = $withinLimit ? 1 : 0;
            $operationCode = 'STUDENT_ABSENT_NOTICE';
        } elseif ($mode === 'student_absent_no_notice') {
            $status = 'No Show';
            $attendanceStatus = 'CI';
            $absenceNotice = 'NoNotice';
            $countedIn = 1;
            $operationCode = 'STUDENT_ABSENT_NO_NOTICE';
        } elseif ($mode === 'teacher_absent') {
            $status = 'cancelled_by_teacher';
            $attendanceStatus = 'Teacher Absent';
            $absenceNotice = 'Teacher';
            $countedIn = 0;
            $makeupEligible = 1;
            $makeupRequired = 1;
            $operationCode = 'TEACHER_ABSENT';
        } else {
            return null;
        }

        $operationId = $this->getScheduleOperationIdByCode($operationCode);
        $stmtUpdate = $this->conn->prepare("
            UPDATE tbl_sessions
            SET status = ?,
                attendance_status = ?,
                absence_notice = ?,
                counted_in = ?,
                makeup_eligible = ?,
                makeup_required = ?,
                operation_id = ?,
                attendance_notes = CASE
                    WHEN ? = '' THEN attendance_notes
                    WHEN attendance_notes IS NULL OR TRIM(attendance_notes) = '' THEN ?
                    ELSE CONCAT(attendance_notes, ' | ', ?)
                END
            WHERE session_id = ?
        ");
        $stmtUpdate->execute([
            $status,
            $attendanceStatus,
            $absenceNotice,
            $countedIn,
            $makeupEligible,
            $makeupRequired,
            $operationId,
            $note,
            $note,
            $note,
            $sessionId
        ]);

        if ($mode === 'teacher_absent') {
            $needsRescheduling = $this->tableHasColumn('tbl_sessions', 'needs_rescheduling');
            if ($needsRescheduling) {
                $stmtReschedule = $this->conn->prepare("
                    UPDATE tbl_sessions
                    SET needs_rescheduling = 1,
                        cancellation_reason = CASE
                            WHEN ? = '' THEN COALESCE(cancellation_reason, 'Teacher absent')
                            ELSE ?
                        END,
                        cancelled_by_teacher_at = NOW()
                    WHERE session_id = ?
                ");
                $stmtReschedule->execute([$note, $note, $sessionId]);
            }
            $this->ensureMakeupSessionLink($session, $teacherId);
        }

        $this->syncEnrollmentPolicyState($enrollmentId);
        return $this->getStudentSessionForDate($studentId, $dateYmd, false);
    }

    private function markPastScheduledSessionsAsMissed($studentId, $todayYmd)
    {
        if (!$this->tableExists('tbl_sessions') || !$this->tableExists('tbl_enrollments')) {
            return;
        }
        $stmt = $this->conn->prepare("
            SELECT ts.session_date
            FROM tbl_sessions ts
            INNER JOIN tbl_enrollments te ON te.enrollment_id = ts.enrollment_id
            WHERE te.student_id = ?
              AND te.status = 'Active'
              AND ts.session_date < ?
              AND ts.status = 'Scheduled'
              AND NOT EXISTS (
                  SELECT 1
                  FROM tbl_attendance ta
                  WHERE ta.student_id = te.student_id
                    AND DATE(ta.attended_at) = ts.session_date
                    AND ta.status IN ('Present', 'Late', 'Excused')
              )
            ORDER BY ts.session_date ASC, ts.session_number ASC, ts.session_id ASC
        ");
        $stmt->execute([(int)$studentId, $todayYmd]);
        $missedDates = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
        foreach ($missedDates as $missedDate) {
            $this->applySessionAttendanceOutcome(
                (int)$studentId,
                (string)$missedDate,
                'student_absent_no_notice',
                ['note' => 'Automatically marked missed based on scheduled date.']
            );
        }
    }

    private function markScheduledSessionCompleted($studentId, $dateYmd, $sourceLabel = 'Attendance recorded')
    {
        if (!$this->tableExists('tbl_sessions') || !$this->tableExists('tbl_enrollments')) {
            return;
        }
        $note = trim((string)$sourceLabel) !== '' ? trim((string)$sourceLabel) : 'Attendance recorded';
        $this->applySessionAttendanceOutcome((int)$studentId, $dateYmd, 'present', ['note' => $note]);
    }

    private function buildQrStatus($studentId, $todayYmd = null)
    {
        $todayYmd = $todayYmd ?: date('Y-m-d');
        $this->markPastScheduledSessionsAsMissed($studentId, $todayYmd);

        $sessions = $this->getStudentSessionRows($studentId);
        $attendanceToday = $this->getStudentAttendanceForDate($studentId, $todayYmd);
        if ($attendanceToday) {
            $this->markScheduledSessionCompleted($studentId, $todayYmd, 'Completed from attendance check-in');
            $sessions = $this->getStudentSessionRows($studentId);
        }

        $todaySessions = array_values(array_filter($sessions, function ($row) use ($todayYmd) {
            return (string)($row['session_date'] ?? '') === $todayYmd;
        }));
        $futureSessions = array_values(array_filter($sessions, function ($row) use ($todayYmd) {
            return (string)($row['session_date'] ?? '') > $todayYmd
                && !in_array((string)($row['status'] ?? ''), ['Completed', 'Late', 'Cancelled', 'No Show', 'cancelled_by_teacher', 'rescheduled'], true);
        }));
        $missedSessions = array_values(array_filter($sessions, function ($row) use ($todayYmd) {
            return (string)($row['session_date'] ?? '') < $todayYmd
                && in_array((string)($row['status'] ?? ''), ['No Show', 'Cancelled'], true);
        }));

        $todaySession = $todaySessions[0] ?? null;
        $nextSession = $futureSessions[0] ?? null;
        $latestMissed = !empty($missedSessions) ? $missedSessions[count($missedSessions) - 1] : null;

        if ($attendanceToday || array_filter($todaySessions, function ($row) {
            return in_array((string)($row['status'] ?? ''), ['Completed', 'Late'], true);
        })) {
            return [
                'code' => 'completed',
                'allow_attendance' => false,
                'message' => 'You have already completed your session.',
                'scheduled_date' => $todayYmd,
                'next_session_date' => $nextSession['session_date'] ?? null,
                'attendance' => $attendanceToday
            ];
        }

        if ($todaySession && in_array((string)($todaySession['status'] ?? ''), ['Scheduled'], true)) {
            return [
                'code' => 'valid_today',
                'allow_attendance' => true,
                'message' => 'QR is valid for today. Attendance may be recorded.',
                'scheduled_date' => $todayYmd,
                'next_session_date' => $nextSession['session_date'] ?? null,
                'attendance' => $attendanceToday
            ];
        }

        if ($latestMissed) {
            $missedDate = (string)$latestMissed['session_date'];
            return [
                'code' => 'missed',
                'allow_attendance' => false,
                'message' => 'You missed your session scheduled on ' . $this->formatLongDate($missedDate) . '. Please wait for a make-up schedule.',
                'scheduled_date' => $missedDate,
                'next_session_date' => $nextSession['session_date'] ?? null,
                'attendance' => $attendanceToday
            ];
        }

        if ($nextSession) {
            $nextDate = (string)$nextSession['session_date'];
            return [
                'code' => 'early',
                'allow_attendance' => false,
                'message' => 'Your session is on ' . $this->formatLongDate($nextDate) . '. Please return on your scheduled date. You do not have a session today.',
                'scheduled_date' => $nextDate,
                'next_session_date' => $nextDate,
                'attendance' => $attendanceToday
            ];
        }

        return [
            'code' => 'no_session',
            'allow_attendance' => false,
            'message' => 'You do not have a session today.',
            'scheduled_date' => null,
            'next_session_date' => null,
            'attendance' => $attendanceToday
        ];
    }

    public function getSummary()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $studentId = (int) ($_GET['student_id'] ?? 0);
        if ($studentId < 1) {
            $this->sendJSON(['error' => 'student_id is required'], 400);
        }

        try {
            $hasSessions = $this->tableExists('tbl_sessions') && $this->tableExists('tbl_enrollments');
            $hasAttendance = $this->tableExists('tbl_attendance');

            if ($hasSessions && $hasAttendance) {
                $stmt = $this->conn->prepare("
                    SELECT
                        COALESCE(sess.total_records, 0) + COALESCE(att.total_records, 0) AS total_records,
                        COALESCE(sess.present_count, 0) + COALESCE(att.present_count, 0) AS present_count,
                        COALESCE(sess.late_count, 0) + COALESCE(att.late_count, 0) AS late_count,
                        COALESCE(sess.excused_count, 0) + COALESCE(att.excused_count, 0) AS excused_count,
                        COALESCE(sess.absent_count, 0) + COALESCE(att.absent_count, 0) AS absent_count,
                        CASE
                            WHEN sess.last_attended_at IS NULL THEN att.last_attended_at
                            WHEN att.last_attended_at IS NULL THEN sess.last_attended_at
                            WHEN sess.last_attended_at >= att.last_attended_at THEN sess.last_attended_at
                            ELSE att.last_attended_at
                        END AS last_attended_at
                    FROM (
                        SELECT
                            COUNT(*) AS total_records,
                            SUM(ts.status = 'Completed') AS present_count,
                            SUM(ts.status = 'Late') AS late_count,
                            0 AS excused_count,
                            SUM(ts.status IN ('Cancelled', 'No Show') AND COALESCE(ts.attendance_status, '') <> 'Teacher Absent') AS absent_count,
                            MAX(
                                CASE
                                    WHEN ts.status IN ('Completed', 'Late')
                                        THEN TIMESTAMP(ts.session_date, COALESCE(ts.end_time, ts.start_time, '00:00:00'))
                                    ELSE NULL
                                END
                            ) AS last_attended_at
                        FROM tbl_sessions ts
                        INNER JOIN tbl_enrollments te ON te.enrollment_id = ts.enrollment_id
                        WHERE te.student_id = ?
                    ) AS sess
                    CROSS JOIN (
                        SELECT
                            COUNT(*) AS total_records,
                            SUM(ta.status = 'Present') AS present_count,
                            SUM(ta.status = 'Late') AS late_count,
                            SUM(ta.status = 'Excused') AS excused_count,
                            SUM(ta.status = 'Absent') AS absent_count,
                            MAX(ta.attended_at) AS last_attended_at
                        FROM tbl_attendance ta
                        WHERE ta.student_id = ?
                          AND NOT EXISTS (
                              SELECT 1
                              FROM tbl_sessions ts
                              INNER JOIN tbl_enrollments te ON te.enrollment_id = ts.enrollment_id
                              WHERE te.student_id = ta.student_id
                                AND ts.session_date = DATE(ta.attended_at)
                                AND ts.status IN ('Completed', 'Late', 'Cancelled', 'No Show')
                          )
                    ) AS att
                ");
                $stmt->execute([$studentId, $studentId]);
            } elseif ($hasSessions) {
                $stmt = $this->conn->prepare("
                        SELECT
                            COUNT(*) AS total_records,
                            SUM(ts.status = 'Completed') AS present_count,
                            SUM(ts.status = 'Late') AS late_count,
                            0 AS excused_count,
                            SUM(ts.status IN ('Cancelled', 'No Show') AND COALESCE(ts.attendance_status, '') <> 'Teacher Absent') AS absent_count,
                        MAX(
                            CASE
                                WHEN ts.status IN ('Completed', 'Late')
                                    THEN TIMESTAMP(ts.session_date, COALESCE(ts.end_time, ts.start_time, '00:00:00'))
                                ELSE NULL
                            END
                        ) AS last_attended_at
                    FROM tbl_sessions ts
                    INNER JOIN tbl_enrollments te ON te.enrollment_id = ts.enrollment_id
                    WHERE te.student_id = ?
                ");
                $stmt->execute([$studentId]);
            } else {
                $stmt = $this->conn->prepare("
                    SELECT
                        COUNT(*) AS total_records,
                        SUM(status = 'Present') AS present_count,
                        SUM(status = 'Late') AS late_count,
                        SUM(status = 'Excused') AS excused_count,
                        SUM(status = 'Absent') AS absent_count,
                        MAX(attended_at) AS last_attended_at
                    FROM tbl_attendance
                    WHERE student_id = ?
                ");
                $stmt->execute([$studentId]);
            }
            $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

            // Normalize nulls
            foreach (['total_records','present_count','late_count','excused_count','absent_count'] as $k) {
                $row[$k] = (int) ($row[$k] ?? 0);
            }

            $this->sendJSON(['success' => true, 'summary' => $row]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function getStudentAttendance()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $studentId = (int) ($_GET['student_id'] ?? 0);
        if ($studentId < 1) {
            $this->sendJSON(['error' => 'student_id is required'], 400);
        }

        $limit = (int) ($_GET['limit'] ?? 50);
        if ($limit < 1) $limit = 50;
        if ($limit > 200) $limit = 200;

        try {
            $hasSessions = $this->tableExists('tbl_sessions') && $this->tableExists('tbl_enrollments');
            $hasAttendance = $this->tableExists('tbl_attendance');

            if ($hasSessions && $hasAttendance) {
                $roomJoin = "";
                $roomExpr = "NULL";
                if ($this->tableExists('tbl_rooms')) {
                    $roomJoin = " LEFT JOIN tbl_rooms rm ON ts.room_id = rm.room_id ";
                    $roomExpr = "rm.room_name";
                }
                $stmt = $this->conn->prepare("
                    SELECT *
                    FROM (
                        SELECT
                            ts.session_id AS attendance_id,
                            te.student_id,
                            TIMESTAMP(ts.session_date, COALESCE(ts.start_time, '00:00:00')) AS attended_at,
                            ts.session_date,
                            ts.start_time,
                            ts.end_time,
                            {$roomExpr} AS room_name,
                            ts.session_type AS source,
                            COALESCE(ts.attendance_notes, ts.notes) AS notes,
                            CASE
                                WHEN ts.attendance_status = 'Teacher Absent' THEN 'Teacher Absent'
                                WHEN ts.attendance_status = 'CI' THEN 'CI'
                                WHEN ts.status = 'Completed' THEN 'Present'
                                WHEN ts.status = 'Late' THEN 'Late'
                                WHEN ts.status IN ('Cancelled', 'No Show') THEN 'Absent'
                                ELSE ts.status
                            END AS status
                        FROM tbl_sessions ts
                        INNER JOIN tbl_enrollments te ON te.enrollment_id = ts.enrollment_id
                        {$roomJoin}
                        WHERE te.student_id = ?

                        UNION ALL

                        SELECT
                            ta.attendance_id,
                            ta.student_id,
                            ta.attended_at,
                            DATE(ta.attended_at) AS session_date,
                            TIME(ta.attended_at) AS start_time,
                            NULL AS end_time,
                            NULL AS room_name,
                            ta.source,
                            ta.notes,
                            ta.status
                        FROM tbl_attendance ta
                        WHERE ta.student_id = ?
                          AND NOT EXISTS (
                              SELECT 1
                              FROM tbl_sessions ts
                              INNER JOIN tbl_enrollments te ON te.enrollment_id = ts.enrollment_id
                              WHERE te.student_id = ta.student_id
                                AND ts.session_date = DATE(ta.attended_at)
                                AND ts.status IN ('Completed', 'Late', 'Cancelled', 'No Show')
                          )
                    ) AS combined_attendance
                    ORDER BY attended_at DESC, attendance_id DESC
                    LIMIT $limit
                ");
                $stmt->execute([$studentId, $studentId]);
            } elseif ($hasSessions) {
                $roomJoin = "";
                $roomExpr = "NULL";
                if ($this->tableExists('tbl_rooms')) {
                    $roomJoin = " LEFT JOIN tbl_rooms rm ON ts.room_id = rm.room_id ";
                    $roomExpr = "rm.room_name";
                }
                $stmt = $this->conn->prepare("
                    SELECT
                        ts.session_id AS attendance_id,
                        te.student_id,
                        TIMESTAMP(ts.session_date, COALESCE(ts.start_time, '00:00:00')) AS attended_at,
                        ts.session_date,
                        ts.start_time,
                        ts.end_time,
                        {$roomExpr} AS room_name,
                        ts.session_type AS source,
                        COALESCE(ts.attendance_notes, ts.notes) AS notes,
                        CASE
                            WHEN ts.attendance_status = 'Teacher Absent' THEN 'Teacher Absent'
                            WHEN ts.attendance_status = 'CI' THEN 'CI'
                            WHEN ts.status = 'Completed' THEN 'Present'
                            WHEN ts.status = 'Late' THEN 'Late'
                            WHEN ts.status IN ('Cancelled', 'No Show') THEN 'Absent'
                            ELSE ts.status
                        END AS status
                    FROM tbl_sessions ts
                    INNER JOIN tbl_enrollments te ON te.enrollment_id = ts.enrollment_id
                    {$roomJoin}
                    WHERE te.student_id = ?
                    ORDER BY ts.session_date DESC, ts.session_id DESC
                    LIMIT $limit
                ");
                $stmt->execute([$studentId]);
            } else {
                $stmt = $this->conn->prepare("
                    SELECT attendance_id, student_id, attended_at, DATE(attended_at) AS session_date, TIME(attended_at) AS start_time, NULL AS end_time, NULL AS room_name, source, notes, status
                    FROM tbl_attendance
                    WHERE student_id = ?
                    ORDER BY attended_at DESC, attendance_id DESC
                    LIMIT $limit
                ");
                $stmt->execute([$studentId]);
            }
            $this->sendJSON(['success' => true, 'attendance' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Record attendance (optional utility endpoint).
     * POST body: { student_id, status?, source?, notes? }
     */
    public function record()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $studentId = (int) ($data['student_id'] ?? 0);
        if ($studentId < 1) {
            $this->sendJSON(['error' => 'student_id is required'], 400);
        }

        $status = $data['status'] ?? 'Present';
        $allowed = ['Present','Absent','Late','Excused','CI','Teacher Absent'];
        if (!in_array($status, $allowed, true)) {
            $this->sendJSON(['error' => 'Invalid status'], 400);
        }

        $source = isset($data['source']) ? substr(trim((string)$data['source']), 0, 30) : null;
        $notes = isset($data['notes']) ? substr(trim((string)$data['notes']), 0, 255) : null;
        $dateYmd = trim((string)($data['session_date'] ?? date('Y-m-d')));
        $priorNotice = !empty($data['prior_notice']);

        try {
            if (!$this->ensureAttendanceTable()) {
                $this->sendJSON(['error' => 'Attendance write endpoint is unavailable on this schema'], 400);
            }

            $this->conn->beginTransaction();

            $attendanceId = null;
            if (in_array($status, ['Present', 'Late', 'Excused'], true)) {
                $stmt = $this->conn->prepare("
                    INSERT INTO tbl_attendance (student_id, status, source, notes)
                    VALUES (?, ?, ?, ?)
                ");
                $stmt->execute([$studentId, $status, $source ?: null, $notes ?: null]);
                $attendanceId = (int)$this->conn->lastInsertId();
            }

            if ($status === 'Present') {
                $this->applySessionAttendanceOutcome($studentId, $dateYmd, 'present', ['note' => $notes ?: 'Attendance recorded']);
            } elseif ($status === 'Late') {
                $this->applySessionAttendanceOutcome($studentId, $dateYmd, 'late', ['note' => $notes ?: 'Marked late']);
            } elseif ($status === 'Absent') {
                $mode = $priorNotice ? 'student_absent_notice' : 'student_absent_no_notice';
                $this->applySessionAttendanceOutcome($studentId, $dateYmd, $mode, ['note' => $notes ?: ($priorNotice ? 'Marked absent with prior notice' : 'Marked absent without prior notice')]);
            } elseif ($status === 'CI') {
                $this->applySessionAttendanceOutcome($studentId, $dateYmd, 'student_absent_no_notice', ['note' => $notes ?: 'Marked counted-in']);
            } elseif ($status === 'Teacher Absent') {
                $this->applySessionAttendanceOutcome($studentId, $dateYmd, 'teacher_absent', ['note' => $notes ?: 'Teacher absent']);
            } elseif ($status === 'Excused') {
                $this->applySessionAttendanceOutcome($studentId, $dateYmd, 'student_absent_notice', ['note' => $notes ?: 'Excused absence']);
            }

            $this->conn->commit();
            $this->sendJSON(['success' => true, 'attendance_id' => $attendanceId]);
        } catch (PDOException $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    private function parseQrPayload($payload)
    {
        $raw = trim((string) $payload);
        if ($raw === '') return null;
        $parts = explode('|', $raw);
        if (count($parts) < 4) return null;
        if ($parts[0] !== 'FAS_ATTENDANCE' || $parts[1] !== 'STUDENT') return null;
        $studentId = (int) ($parts[2] ?? 0);
        $email = trim((string) ($parts[3] ?? ''));
        $branchId = isset($parts[4]) ? (int) $parts[4] : null;
        if ($studentId < 1 || $email === '') return null;
        return ['student_id' => $studentId, 'email' => $email, 'branch_id' => $branchId];
    }

    public function scanQr()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $payload = $data['payload'] ?? $data['qr_payload'] ?? '';
        $parsed = $this->parseQrPayload($payload);
        if (!$parsed) {
            $this->sendJSON(['error' => 'Invalid QR payload'], 400);
        }

        $studentId = (int) $parsed['student_id'];
        $email = $parsed['email'];
        $deskBranchId = (int) ($data['desk_branch_id'] ?? 0);

        try {
            $student = $this->getStudentById($studentId);
            if (!$student || strcasecmp(trim($student['email'] ?? ''), $email) !== 0) {
                $this->sendJSON(['error' => 'Student not found for this QR'], 404);
            }

            if (!$this->ensureAttendanceTable()) {
                $this->sendJSON(['error' => 'Attendance write endpoint is unavailable on this schema'], 400);
            }

            $studentBranchId = (int) ($student['branch_id'] ?? 0);
            if ($studentBranchId > 0 && $deskBranchId <= 0) {
                $this->sendJSON([
                    'success' => false,
                    'error_code' => 'DESK_BRANCH_REQUIRED',
                    'error' => 'Desk staff account has no branch assigned. Please contact the administrator.',
                    'student_branch_id' => $studentBranchId,
                    'student_branch_name' => $student['branch_name'] ?? null,
                    'desk_branch_id' => $deskBranchId
                ], 400);
            }
            if ($studentBranchId > 0 && $deskBranchId !== $studentBranchId) {
                $studentBranchName = trim($student['branch_name'] ?? '') ?: 'their enrolled branch';
                $deskBranchName = $this->getBranchNameById($deskBranchId) ?: 'this branch';
                $this->sendJSON([
                    'success' => false,
                    'error_code' => 'BRANCH_MISMATCH',
                    'error' => "This student is enrolled at {$studentBranchName}. Attendance must be recorded at {$studentBranchName}. You are currently at {$deskBranchName}. Uptown=Uptown, Downtown=Downtown only.",
                    'student_branch_id' => $studentBranchId,
                    'student_branch_name' => $student['branch_name'] ?? null,
                    'desk_branch_id' => $deskBranchId,
                    'desk_branch_name' => $deskBranchName
                ], 400);
            }

            $todayYmd = date('Y-m-d');
            $qrStatus = $this->buildQrStatus($studentId, $todayYmd);
            if (($qrStatus['code'] ?? '') === 'completed') {
                $existing = $this->getStudentAttendanceForDate($studentId, $todayYmd);
                $this->sendJSON([
                    'success' => true,
                    'already_checked_in' => true,
                    'attendance' => $existing,
                    'qr_status' => $qrStatus,
                    'student' => [
                        'student_id' => (int) $student['student_id'],
                        'first_name' => $student['first_name'],
                        'last_name' => $student['last_name'],
                        'email' => $student['email'],
                        'branch_id' => $studentBranchId,
                        'branch_name' => $student['branch_name'] ?? null
                    ]
                ]);
            }
            if (($qrStatus['code'] ?? '') !== 'valid_today') {
                $this->sendJSON([
                    'success' => false,
                    'error_code' => strtoupper((string)($qrStatus['code'] ?? 'NO_SESSION')),
                    'error' => $qrStatus['message'] ?? 'You do not have a session today.',
                    'qr_status' => $qrStatus,
                    'student' => [
                        'student_id' => (int) $student['student_id'],
                        'first_name' => $student['first_name'],
                        'last_name' => $student['last_name'],
                        'email' => $student['email'],
                        'branch_id' => $studentBranchId,
                        'branch_name' => $student['branch_name'] ?? null
                    ]
                ], 400);
            }

            $status = 'Present';
            $source = 'QR';
            $stmt = $this->conn->prepare("
                INSERT INTO tbl_attendance (student_id, branch_id, status, source, notes)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([$studentId, $studentBranchId > 0 ? $studentBranchId : null, $status, $source, null]);
            $this->markScheduledSessionCompleted($studentId, $todayYmd, 'Completed from QR attendance');

            $id = (int) $this->conn->lastInsertId();
            $fetch = $this->conn->prepare("SELECT attendance_id, attended_at, status FROM tbl_attendance WHERE attendance_id = ? LIMIT 1");
            $fetch->execute([$id]);
            $attendance = $fetch->fetch(PDO::FETCH_ASSOC);

            $this->sendJSON([
                'success' => true,
                'already_checked_in' => false,
                'attendance' => $attendance,
                'qr_status' => $this->buildQrStatus($studentId, $todayYmd),
                'student' => [
                    'student_id' => (int) $student['student_id'],
                    'first_name' => $student['first_name'],
                    'last_name' => $student['last_name'],
                    'email' => $student['email'],
                    'branch_id' => $studentBranchId,
                    'branch_name' => $student['branch_name'] ?? null
                ]
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Record attendance by student email (manual entry).
     * POST body: { email, desk_branch_id? }
     */
    public function recordByEmail()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $email = trim((string) ($data['email'] ?? ''));
        $deskBranchId = (int) ($data['desk_branch_id'] ?? 0);

        if ($email === '') {
            $this->sendJSON(['success' => false, 'error' => 'Email is required.'], 400);
        }

        try {
            $student = $this->getStudentByEmail($email);
            if (!$student) {
                $this->sendJSON(['success' => false, 'error' => 'Student not found for this email.'], 404);
            }

            if (!$this->ensureAttendanceTable()) {
                $this->sendJSON(['success' => false, 'error' => 'Attendance unavailable.'], 400);
            }

            $studentBranchId = (int) ($student['branch_id'] ?? 0);
            if ($studentBranchId > 0 && $deskBranchId <= 0) {
                $this->sendJSON([
                    'success' => false,
                    'error_code' => 'DESK_BRANCH_REQUIRED',
                    'error' => 'Desk staff account has no branch assigned. Please contact the administrator.',
                    'student_branch_id' => $studentBranchId,
                    'student_branch_name' => $student['branch_name'] ?? null,
                    'desk_branch_id' => $deskBranchId
                ], 400);
            }
            if ($studentBranchId > 0 && $deskBranchId > 0 && $deskBranchId !== $studentBranchId) {
                $studentBranchName = trim($student['branch_name'] ?? '') ?: 'their enrolled branch';
                $deskBranchName = $this->getBranchNameById($deskBranchId) ?: 'this branch';
                $this->sendJSON([
                    'success' => false,
                    'error_code' => 'BRANCH_MISMATCH',
                    'error' => "Student is enrolled at {$studentBranchName}. Attendance at {$deskBranchName} not allowed. Uptown=Uptown, Downtown=Downtown only.",
                    'student_branch_name' => $student['branch_name'] ?? null,
                    'desk_branch_name' => $deskBranchName
                ], 400);
            }

            $todayYmd = date('Y-m-d');
            $studentId = (int)$student['student_id'];
            $qrStatus = $this->buildQrStatus($studentId, $todayYmd);
            if (($qrStatus['code'] ?? '') === 'completed') {
                $existing = $this->getStudentAttendanceForDate($studentId, $todayYmd);
                $this->sendJSON([
                    'success' => true,
                    'already_checked_in' => true,
                    'attendance' => $existing,
                    'qr_status' => $qrStatus,
                    'student' => [
                        'student_id' => $studentId,
                        'first_name' => $student['first_name'],
                        'last_name' => $student['last_name'],
                        'email' => $student['email'],
                        'branch_name' => $student['branch_name'] ?? null
                    ]
                ]);
            }
            if (($qrStatus['code'] ?? '') !== 'valid_today') {
                $this->sendJSON([
                    'success' => false,
                    'error_code' => strtoupper((string)($qrStatus['code'] ?? 'NO_SESSION')),
                    'error' => $qrStatus['message'] ?? 'You do not have a session today.',
                    'qr_status' => $qrStatus,
                    'student' => [
                        'student_id' => $studentId,
                        'first_name' => $student['first_name'],
                        'last_name' => $student['last_name'],
                        'email' => $student['email'],
                        'branch_id' => $studentBranchId,
                        'branch_name' => $student['branch_name'] ?? null
                    ]
                ], 400);
            }

            $stmt = $this->conn->prepare("
                INSERT INTO tbl_attendance (student_id, branch_id, status, source, notes)
                VALUES (?, ?, 'Present', 'Manual', ?)
            ");
            $stmt->execute([$studentId, $studentBranchId > 0 ? $studentBranchId : null, null]);
            $this->markScheduledSessionCompleted($studentId, $todayYmd, 'Completed from manual attendance');

            $id = (int) $this->conn->lastInsertId();
            $fetch = $this->conn->prepare("SELECT attendance_id, attended_at, status FROM tbl_attendance WHERE attendance_id = ? LIMIT 1");
            $fetch->execute([$id]);
            $attendance = $fetch->fetch(PDO::FETCH_ASSOC);

            $this->sendJSON([
                'success' => true,
                'already_checked_in' => false,
                'attendance' => $attendance,
                'qr_status' => $this->buildQrStatus($studentId, $todayYmd),
                'student' => [
                    'student_id' => $studentId,
                    'first_name' => $student['first_name'],
                    'last_name' => $student['last_name'],
                    'email' => $student['email'],
                    'branch_id' => $studentBranchId,
                    'branch_name' => $student['branch_name'] ?? null
                ]
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['success' => false, 'error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function getQrStatus()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $studentId = (int)($_GET['student_id'] ?? 0);
        $email = trim((string)($_GET['email'] ?? ''));

        try {
            $student = null;
            if ($studentId > 0) {
                $student = $this->getStudentById($studentId);
            } elseif ($email !== '') {
                $student = $this->getStudentByEmail($email);
            }

            if (!$student) {
                $this->sendJSON(['error' => 'Student not found.'], 404);
            }

            $todayYmd = date('Y-m-d');
            $status = $this->buildQrStatus((int)$student['student_id'], $todayYmd);

            $this->sendJSON([
                'success' => true,
                'today' => $todayYmd,
                'qr_status' => $status,
                'student' => [
                    'student_id' => (int)$student['student_id'],
                    'first_name' => $student['first_name'],
                    'last_name' => $student['last_name'],
                    'email' => $student['email'],
                    'branch_id' => (int)($student['branch_id'] ?? 0),
                    'branch_name' => $student['branch_name'] ?? null
                ]
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function getDeskSummary()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        try {
            if (!$this->ensureAttendanceTable()) {
                $this->sendJSON(['error' => 'Attendance data is unavailable on this schema'], 400);
            }

            $branchId = (int) ($_GET['branch_id'] ?? 0);
            $sql = "
                SELECT
                    COUNT(*) AS total_count,
                    SUM(status = 'Present') AS present_count,
                    SUM(status = 'Late') AS late_count
                FROM tbl_attendance
                WHERE DATE(attended_at) = CURDATE()
            ";
            $params = [];
            if ($branchId > 0) {
                $sql .= " AND branch_id = ? ";
                $params[] = $branchId;
            }
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);
            $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
            $this->sendJSON([
                'success' => true,
                'summary' => [
                    'total' => (int) ($row['total_count'] ?? 0),
                    'present' => (int) ($row['present_count'] ?? 0),
                    'late' => (int) ($row['late_count'] ?? 0)
                ]
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function getDeskRecent()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $limit = (int) ($_GET['limit'] ?? 8);
        if ($limit < 1) $limit = 8;
        if ($limit > 50) $limit = 50;

        try {
            if (!$this->ensureAttendanceTable()) {
                $this->sendJSON(['error' => 'Attendance data is unavailable on this schema'], 400);
            }
            $branchId = (int) ($_GET['branch_id'] ?? 0);
            $sql = "
                SELECT
                    a.attendance_id,
                    a.attended_at,
                    a.status,
                    s.first_name,
                    s.last_name
                FROM tbl_attendance a
                INNER JOIN tbl_students s ON s.student_id = a.student_id
                WHERE DATE(a.attended_at) = CURDATE()
            ";
            $params = [];
            if ($branchId > 0) {
                $sql .= " AND a.branch_id = ? ";
                $params[] = $branchId;
            }
            $sql .= " ORDER BY a.attended_at DESC, a.attendance_id DESC LIMIT $limit ";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $this->sendJSON(['success' => true, 'scans' => $rows]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }
}

$api = new AttendanceApi($conn);
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get-summary':
        $api->getSummary();
        break;
    case 'get-student-attendance':
        $api->getStudentAttendance();
        break;
    case 'record':
        $api->record();
        break;
    case 'scan-qr':
    case 'record-attendance':
        $api->scanQr();
        break;
    case 'record-by-email':
        $api->recordByEmail();
        break;
    case 'qr-status':
        $api->getQrStatus();
        break;
    case 'desk-summary':
        $api->getDeskSummary();
        break;
    case 'desk-recent':
        $api->getDeskRecent();
        break;
    default:
        $api->sendJSON(['error' => 'Invalid action'], 400);
}

