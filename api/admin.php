<?php
// Suppress error display for JSON APIs
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once 'db_connect.php';
require_once 'audit_logs.php'; // ← Audit logging

header("Content-Type: application/json");

// Check if database connection exists
if (!isset($conn) || $conn === null) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

class Admin
{
    private $conn;
    private $lastMailError = null;

    public function __construct($pdo)
    {
        $this->conn = $pdo;
    }

    public function sendJSON($data, $status = 200)
    {
        http_response_code($status);
        echo json_encode($data);
        exit;
    }

    private function hasStudentColumn($columnName)
    {
        try {
            $stmt = $this->conn->prepare("SHOW COLUMNS FROM tbl_students LIKE ?");
            $stmt->execute([$columnName]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            return false;
        }
    }

    private function isWalkInSystemEmail($email)
    {
        return preg_match('/@fas\.com$/i', trim((string)$email)) === 1;
    }

    private function walkInRegistrationApprovedCaseSql($studentAlias = 's')
    {
        if ($this->hasStudentColumn('registration_source')) {
            return "WHEN COALESCE({$studentAlias}.registration_source, 'online') = 'walkin'
                         AND {$studentAlias}.status = 'Active' THEN 'Approved'";
        }
        return "WHEN {$studentAlias}.email LIKE '%@fas.com'
                     AND {$studentAlias}.status = 'Active' THEN 'Approved'";
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

    private function hasUserColumn($columnName)
    {
        try {
            $stmt = $this->conn->prepare("SHOW COLUMNS FROM tbl_users LIKE ?");
            $stmt->execute([$columnName]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            return false;
        }
    }

    private function sanitizeAdminLoginBase($input, array $fallbackParts = [])
    {
        $base = strtolower(trim((string)$input));
        if ($base !== '') {
            $base = preg_replace('/[^a-z0-9._-]+/i', '.', $base);
        }

        if ($base === '') {
            $parts = array_filter(array_map(static function ($part) {
                return trim((string)$part);
            }, $fallbackParts), static function ($part) {
                return $part !== '';
            });
            $base = strtolower(implode('.', $parts));
            $base = preg_replace('/[^a-z0-9._-]+/i', '.', $base);
        }

        $base = preg_replace('/[.]{2,}/', '.', (string)$base);
        $base = trim((string)$base, ".-_");

        return $base !== '' ? $base : 'user';
    }

    private function ensurePhpMailerLoaded()
    {
        static $loaded = false;
        if ($loaded) {
            return;
        }

        require_once dirname(__DIR__) . '/phpmailer/src/Exception.php';
        require_once dirname(__DIR__) . '/phpmailer/src/PHPMailer.php';
        require_once dirname(__DIR__) . '/phpmailer/src/SMTP.php';
        $loaded = true;
    }

    private function isValidEmailAddress($email)
    {
        return filter_var(trim((string) $email), FILTER_VALIDATE_EMAIL) !== false;
    }

    private function isPlaceholderMailHost($host)
    {
        $host = strtolower(trim((string) $host));
        if ($host === '') {
            return true;
        }

        return in_array($host, ['smtp.example.com', 'example.com', 'localhost', '127.0.0.1'], true);
    }

    private function getMailSettings()
    {
        $env = static function ($key, $default = '') {
            $value = getenv($key);
            if ($value === false || $value === null || $value === '') {
                $value = $_ENV[$key] ?? $_SERVER[$key] ?? $default;
            }
            return is_string($value) ? trim($value) : $default;
        };

        $fileConfig = [];
        $mailConfigPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'mail_config.php';
        if (is_file($mailConfigPath)) {
            $loadedConfig = include $mailConfigPath;
            if (is_array($loadedConfig)) {
                $fileConfig = $loadedConfig;
            }
        }

        $fileValue = static function ($key, $default = '') use ($fileConfig) {
            $value = $fileConfig[$key] ?? $default;
            return is_string($value) ? trim($value) : $value;
        };

        $username = $fileValue('MAIL_USERNAME', $env('MAIL_USERNAME', ''));
        $fromAddress = $fileValue('MAIL_FROM_ADDRESS', $env('MAIL_FROM_ADDRESS', ''));
        if (!$this->isValidEmailAddress($fromAddress) && $this->isValidEmailAddress($username)) {
            $fromAddress = $username;
        }

        $replyTo = $fileValue('MAIL_REPLY_TO', $env('MAIL_REPLY_TO', ''));
        if (!$this->isValidEmailAddress($replyTo)) {
            $replyTo = $fromAddress;
        }

        return [
            'host' => $fileValue('MAIL_HOST', $env('MAIL_HOST', '')),
            'port' => (int) $fileValue('MAIL_PORT', $env('MAIL_PORT', '587')),
            'username' => $username,
            'password' => preg_replace('/\s+/', '', (string) $fileValue('MAIL_PASSWORD', $env('MAIL_PASSWORD', ''))),
            'encryption' => strtolower($fileValue('MAIL_ENCRYPTION', $env('MAIL_ENCRYPTION', 'tls'))),
            'from_address' => $fromAddress,
            'from_name' => $fileValue('MAIL_FROM_NAME', $env('MAIL_FROM_NAME', 'Father & Sons Music Academy')),
            'reply_to' => $replyTo,
            'verify_peer' => filter_var($fileValue('MAIL_VERIFY_PEER', $env('MAIL_VERIFY_PEER', 'true')), FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE),
            'debug' => filter_var($fileValue('MAIL_DEBUG', $env('MAIL_DEBUG', 'false')), FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE),
        ];
    }

    private function isMailConfigured()
    {
        $mail = $this->getMailSettings();
        if ($this->isPlaceholderMailHost($mail['host'])) {
            return false;
        }
        if (!$this->isValidEmailAddress($mail['from_address'])) {
            return false;
        }
        if ($mail['username'] !== '' && strtolower($mail['password']) === 'password') {
            return false;
        }
        return true;
    }

    private function configurePhpMailer($mailer, array $mail)
    {
        $mailer->CharSet = 'UTF-8';
        $mailer->isHTML(true);
        $mailer->setFrom($mail['from_address'], $mail['from_name']);
        if ($this->isValidEmailAddress($mail['reply_to'])) {
            $mailer->addReplyTo($mail['reply_to'], $mail['from_name']);
        }

        $mailer->isSMTP();
        $mailer->Host = $mail['host'];
        $mailer->Port = $mail['port'] > 0 ? $mail['port'] : 587;
        $mailer->SMTPAuth = true;
        $mailer->Username = $mail['username'];
        $mailer->Password = $mail['password'];
        $mailer->Timeout = 20;
        $mailer->SMTPOptions = [
            'ssl' => [
                'verify_peer' => $mail['verify_peer'] !== false,
                'verify_peer_name' => $mail['verify_peer'] !== false,
                'allow_self_signed' => $mail['verify_peer'] === false,
            ],
        ];

        if ($mail['encryption'] === 'ssl') {
            $mailer->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
        } elseif ($mail['encryption'] === 'tls') {
            $mailer->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        } else {
            $mailer->SMTPSecure = '';
            $mailer->SMTPAutoTLS = false;
        }
    }

    private function adminSystemEmailExists($email)
    {
        $stmt = $this->conn->prepare("
            SELECT user_id
            FROM tbl_users
            WHERE LOWER(username) = LOWER(?)
               OR LOWER(email) = LOWER(?)
            LIMIT 1
        ");
        $stmt->execute([$email, $email]);
        return (int)($stmt->fetchColumn() ?: 0) > 0;
    }

    private function buildAdminSystemEmail($roleName, $firstName = '', $lastName = '', $systemLoginName = '')
    {
        $roleKey = strtolower(trim((string) $roleName));
        $rolePrefix = 'user';
        if (in_array($roleKey, ['manager', 'branch manager'], true)) {
            $rolePrefix = 'manager';
        } elseif ($roleKey === 'staff') {
            $rolePrefix = 'staff';
        }

        $fallbackBase = $systemLoginName !== ''
            ? $systemLoginName
            : "{$rolePrefix}.{$firstName}.{$lastName}";
        $base = $this->sanitizeAdminLoginBase($fallbackBase, [$rolePrefix, $firstName, $lastName]);

        for ($i = 0; $i < 100; $i++) {
            $candidateBase = $i === 0 ? $base : $base . $i;
            $candidateEmail = $candidateBase . '@fas.com';
            if (!$this->adminSystemEmailExists($candidateEmail)) {
                return $candidateEmail;
            }
        }

        return null;
    }

    private function resolveAdminAccountMode($accountMode, $email)
    {
        $accountMode = strtolower(trim((string) $accountMode));
        if (in_array($accountMode, ['real_email', 'system_account'], true)) {
            return $accountMode;
        }

        if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) && !$this->isWalkInSystemEmail($email)) {
            return 'real_email';
        }

        return 'system_account';
    }

    private function resolveAdminAccountCredentials($firstName, $lastName, $email, $roleName, $accountMode, $systemLoginName = '')
    {
        $accountMode = $this->resolveAdminAccountMode($accountMode, $email);

        if ($accountMode === 'real_email') {
            if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $this->sendJSON(['error' => 'A valid email address is required for a real email account'], 400);
            }
            if ($this->isWalkInSystemEmail($email)) {
                $this->sendJSON(['error' => 'Use the school login option for @fas.com accounts'], 400);
            }

            return [
                'username' => $email,
                'email' => $email,
                'account_mode' => 'real_email',
                'send_email' => true,
            ];
        }

        $loginEmail = $this->buildAdminSystemEmail($roleName, $firstName, $lastName, $systemLoginName);
        if ($loginEmail === null) {
            $this->sendJSON(['error' => 'That school login is already in use. Please choose another name.'], 400);
        }

        return [
            'username' => $loginEmail,
            'email' => $loginEmail,
            'account_mode' => 'system_account',
            'send_email' => false,
        ];
    }

    private function sendAdminCredentialsEmail($toEmail, $toName, $username, $tempPassword, $roleLabel)
    {
        $this->ensurePhpMailerLoaded();
        $this->lastMailError = null;
        if (!$this->isMailConfigured() || !$this->isValidEmailAddress($toEmail)) {
            $this->lastMailError = 'SMTP is not configured on the server.';
            return false;
        }

        $mail = $this->getMailSettings();

        try {
            $mailer = new \PHPMailer\PHPMailer\PHPMailer(true);
            $this->configurePhpMailer($mailer, $mail);
            $mailer->addAddress($toEmail, $toName ?: $toEmail);

            $safeName = htmlspecialchars($toName ?: 'User', ENT_QUOTES, 'UTF-8');
            $safeUsername = htmlspecialchars($username, ENT_QUOTES, 'UTF-8');
            $safePassword = htmlspecialchars($tempPassword, ENT_QUOTES, 'UTF-8');
            $safeRole = htmlspecialchars($roleLabel ?: 'account', ENT_QUOTES, 'UTF-8');

            $mailer->Subject = 'Your Father & Sons ' . $safeRole . ' login';
            $mailer->Body = '
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 560px;">
                    <h2 style="margin: 0 0 12px; color: #0f172a;">Welcome to Father & Sons Music Academy</h2>
                    <p>Hello ' . $safeName . ',</p>
                    <p>Your ' . $safeRole . ' account has been created. Use the credentials below to sign in:</p>
                    <div style="background:#fdfaf1;border:1px solid #f9f1d5;border-radius:12px;padding:16px 18px;margin:18px 0;">
                        <p style="margin:0 0 8px;"><strong>Username:</strong> ' . $safeUsername . '</p>
                        <p style="margin:0;"><strong>Temporary password:</strong> ' . $safePassword . '</p>
                    </div>
                    <p>Please change your password after your first login.</p>
                    <p>If you did not expect this email, contact the academy office.</p>
                </div>
            ';
            $mailer->AltBody = "Username: {$username}\nTemporary password: {$tempPassword}\nPlease change your password after first login.";
            $mailer->send();
            return true;
        } catch (\PHPMailer\PHPMailer\Exception $e) {
            $this->lastMailError = trim($e->getMessage() . ' ' . $mailer->ErrorInfo);
            error_log('Admin credentials email failed: ' . $this->lastMailError);
            return false;
        } catch (Exception $e) {
            $this->lastMailError = $e->getMessage();
            error_log('Admin credentials email failed: ' . $this->lastMailError);
            return false;
        }
    }

    private function getRegistrationPaymentPrimaryKeyColumn()
    {
        try {
            $stmt = $this->conn->query("SHOW COLUMNS FROM tbl_registration_payments");
            if (!$stmt) {
                return 'registration_payment_id';
            }
            $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
            if (in_array('registration_payment_id', $columns, true)) {
                return 'registration_payment_id';
            }
            if (in_array('payment_id', $columns, true)) {
                return 'payment_id';
            }
        } catch (PDOException $e) {
            // fall through
        }

        return 'registration_payment_id';
    }

    private function ensureUserBranchColumn()
    {
        if ($this->hasUserColumn('branch_id')) return;
        try {
            $this->conn->exec("ALTER TABLE tbl_users ADD COLUMN branch_id INT NULL AFTER role_id");
        } catch (PDOException $e) {
            // Keep API working even if alter fails
        }
    }

    private function ensureStudentRegistrationFeesTable()
    {
        // Registration fee state now comes from tbl_registration_payments.
        return;
    }

    private function ensureStudentRegistrationSourceColumn()
    {
        if ($this->hasStudentColumn('registration_source')) return;
        try {
            $this->conn->exec("ALTER TABLE tbl_students ADD COLUMN registration_source VARCHAR(20) NOT NULL DEFAULT 'online' AFTER status");
        } catch (PDOException $e) {
            // Keep API working even if alter fails
        }
    }

    private function getRegistrationPaidAmount($studentId)
    {
        $stmt = $this->conn->prepare("
            SELECT COALESCE(SUM(amount), 0)
            FROM tbl_registration_payments
            WHERE student_id = ?
              AND status = 'Paid'
        ");
        $stmt->execute([(int)$studentId]);
        return (float)($stmt->fetchColumn() ?: 0);
    }

    private function getLatestEnrollmentIdByStudent($studentId, $statuses = [])
    {
        if (!$this->tableExists('tbl_enrollments')) {
            return 0;
        }

        $params = [(int)$studentId];
        $sql = "
            SELECT e.enrollment_id
            FROM tbl_enrollments e
            WHERE e.student_id = ?
        ";
        if (!empty($statuses)) {
            $placeholders = implode(',', array_fill(0, count($statuses), '?'));
            $sql .= " AND e.status IN ({$placeholders})";
            foreach ($statuses as $status) {
                $params[] = $status;
            }
        }
        $sql .= " ORDER BY e.created_at DESC, e.enrollment_id DESC LIMIT 1";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);
        return (int)($stmt->fetchColumn() ?: 0);
    }

    private function ensureStudentRegistrationProofColumn()
    {
        if ($this->hasStudentColumn('registration_proof_path')) return;
        try {
            if ($this->hasStudentColumn('registration_fee_paid')) {
                $this->conn->exec("ALTER TABLE tbl_students ADD COLUMN registration_proof_path VARCHAR(255) NULL AFTER registration_fee_paid");
            } else {
                $this->conn->exec("ALTER TABLE tbl_students ADD COLUMN registration_proof_path VARCHAR(255) NULL");
            }
        } catch (PDOException $e) {
            // Keep API working even if alter fails
        }
    }

    private function ensureStudentAgeVerificationProofColumn()
    {
        if ($this->hasStudentColumn('age_verification_proof_path')) return;
        try {
            if ($this->hasStudentColumn('registration_proof_path')) {
                $this->conn->exec("ALTER TABLE tbl_students ADD COLUMN age_verification_proof_path VARCHAR(255) NULL AFTER registration_proof_path");
            } else {
                $this->conn->exec("ALTER TABLE tbl_students ADD COLUMN age_verification_proof_path VARCHAR(255) NULL");
            }
        } catch (PDOException $e) {
            // Keep API working even if alter fails
        }
    }

    private function extractRegistrationProofPathFromNotes($notes)
    {
        $raw = trim((string)($notes ?? ''));
        if ($raw === '') return null;

        $prefix = 'Payment proof:';
        if (stripos($raw, $prefix) === 0) {
            $path = trim(substr($raw, strlen($prefix)));
            return $path !== '' ? $path : null;
        }

        if (preg_match('/uploads\/payment_proofs\/registration\/[^\s]+/i', $raw, $m)) {
            return $m[0];
        }

        return null;
    }

    // 🔍 View pending students
    public function getPendingStudents()
    {
        $stmt = $this->conn->prepare("
            SELECT
                s.student_id,
                s.branch_id,
                s.first_name,
                s.last_name,
                s.email,
                s.phone,
                1000.00 AS registration_fee_amount,
                COALESCE((
                    SELECT SUM(rp.amount)
                    FROM tbl_registration_payments rp
                    WHERE rp.student_id = s.student_id
                      AND rp.status = 'Paid'
                ), 0.00) AS registration_fee_paid,
                'Pending' AS registration_status
            FROM tbl_students s
            WHERE s.status = 'Inactive'
        ");
        $stmt->execute();

        $this->sendJSON([
            'success' => true,
            'students' => $stmt->fetchAll(PDO::FETCH_ASSOC)
        ]);
    }

    // 🔍 Get pending registrations with guardian and branch info
    public function getPendingRegistrations()
    {
        $this->ensureStudentRegistrationProofColumn();
        $this->ensureStudentAgeVerificationProofColumn();
        $this->ensureStudentRegistrationSourceColumn();
        $hasProofCol = $this->hasStudentColumn('registration_proof_path');
        $hasAgeProofCol = $this->hasStudentColumn('age_verification_proof_path');
        $hasSourceCol = $this->hasStudentColumn('registration_source');
        $branchId = isset($_GET['branch_id']) ? (int) $_GET['branch_id'] : 0;
        $branchSql = $branchId > 0 ? " AND s.branch_id = ?" : "";
        $stmt = $this->conn->prepare("
            SELECT
                s.student_id,
                s.branch_id,
                s.first_name,
                s.last_name,
                s.email,
                s.phone,
                1000.00 AS registration_fee_amount,
                COALESCE((
                    SELECT SUM(rp.amount)
                    FROM tbl_registration_payments rp
                    WHERE rp.student_id = s.student_id
                      AND rp.status = 'Paid'
                ), 0.00) AS registration_fee_paid,
                " . ($hasProofCol ? "s.registration_proof_path" : "NULL") . " AS registration_proof_path,
                " . ($hasAgeProofCol ? "s.age_verification_proof_path" : "NULL") . " AS age_verification_proof_path,
                " . ($hasSourceCol ? "s.registration_source" : "'online'") . " AS registration_source,
                'Pending' AS registration_status,
                s.created_at AS created_at,
                b.branch_name,
                g.first_name as guardian_first_name,
                g.last_name as guardian_last_name,
                g.phone as guardian_phone
            FROM tbl_students s
            LEFT JOIN tbl_branches b ON s.branch_id = b.branch_id
            LEFT JOIN tbl_student_guardians sg ON s.student_id = sg.student_id AND sg.is_primary_guardian = 'Y'
            LEFT JOIN tbl_guardians g ON sg.guardian_id = g.guardian_id
            WHERE EXISTS (
                  SELECT 1
                  FROM tbl_registration_payments rp0
                  WHERE rp0.student_id = s.student_id
                    AND rp0.status = 'Pending'
              )
              AND COALESCE(" . ($hasSourceCol ? "s.registration_source" : "'online'") . ", 'online') <> 'walkin'" . $branchSql . "
            ORDER BY s.created_at DESC
        ");
        if ($branchId > 0) {
            $stmt->execute([$branchId]);
        } else {
            $stmt->execute();
        }

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $this->sendJSON([
            'success' => true,
            'registrations' => $rows
        ]);
    }

    // 🔍 Get all registrations with guardian and branch info (excludes Rejected - they are removed/counted separately)
    public function getAllRegistrations()
    {
        $this->ensureStudentRegistrationProofColumn();
        $this->ensureStudentAgeVerificationProofColumn();
        $this->ensureStudentRegistrationSourceColumn();
        $hasProofCol = $this->hasStudentColumn('registration_proof_path');
        $hasAgeProofCol = $this->hasStudentColumn('age_verification_proof_path');
        $hasSourceCol = $this->hasStudentColumn('registration_source');
        $branchId = isset($_GET['branch_id']) ? (int) $_GET['branch_id'] : 0;
        $branchSql = $branchId > 0 ? " AND s.branch_id = ?" : "";
        $stmt = $this->conn->prepare("
            SELECT
                s.student_id,
                s.branch_id,
                s.first_name,
                s.last_name,
                s.email,
                s.phone,
                1000.00 AS registration_fee_amount,
                COALESCE((
                    SELECT SUM(rp.amount)
                    FROM tbl_registration_payments rp
                    WHERE rp.student_id = s.student_id
                      AND rp.status = 'Paid'
                ), 0.00) AS registration_fee_paid,
                " . ($hasProofCol ? "s.registration_proof_path" : "NULL") . " AS registration_proof_path,
                " . ($hasAgeProofCol ? "s.age_verification_proof_path" : "NULL") . " AS age_verification_proof_path,
                " . ($hasSourceCol ? "s.registration_source" : "'online'") . " AS registration_source,
                CASE
                    " . $this->walkInRegistrationApprovedCaseSql('s') . "
                    WHEN EXISTS (
                        SELECT 1
                        FROM tbl_registration_payments rp2
                        WHERE rp2.student_id = s.student_id
                          AND rp2.status = 'Pending'
                    ) THEN 'Pending'
                    WHEN COALESCE((
                        SELECT SUM(rp3.amount)
                        FROM tbl_registration_payments rp3
                        WHERE rp3.student_id = s.student_id
                          AND rp3.status = 'Paid'
                    ), 0.00) >= 1000 AND s.status = 'Active' THEN 'Approved'
                    WHEN COALESCE((
                        SELECT SUM(rp3.amount)
                        FROM tbl_registration_payments rp3
                        WHERE rp3.student_id = s.student_id
                          AND rp3.status = 'Paid'
                    ), 0.00) >= 1000 THEN 'Fee Paid'
                    ELSE 'Pending'
                END AS registration_status,
                s.created_at AS created_at,
                b.branch_name,
                g.first_name as guardian_first_name,
                g.last_name as guardian_last_name,
                g.phone as guardian_phone
            FROM tbl_students s
            LEFT JOIN tbl_branches b ON s.branch_id = b.branch_id
            LEFT JOIN tbl_student_guardians sg ON s.student_id = sg.student_id AND sg.is_primary_guardian = 'Y'
            LEFT JOIN tbl_guardians g ON sg.guardian_id = g.guardian_id
            WHERE (
                (
                    EXISTS (
                        SELECT 1
                        FROM tbl_registration_payments rp0
                        WHERE rp0.student_id = s.student_id
                          AND rp0.status = 'Pending'
                    )
                    AND COALESCE(" . ($hasSourceCol ? "s.registration_source" : "'online'") . ", 'online') <> 'walkin'
                )
                OR (
                    s.status = 'Active'
                    AND EXISTS (
                        SELECT 1
                        FROM tbl_registration_payments rp4
                        WHERE rp4.student_id = s.student_id
                    )
                )
                OR (
                    COALESCE(" . ($hasSourceCol ? "s.registration_source" : "'online'") . ", 'online') = 'walkin'
                    AND s.status = 'Active'
                )
            )" . $branchSql . "
            ORDER BY s.created_at DESC
        ");
        if ($branchId > 0) {
            $stmt->execute([$branchId]);
        } else {
            $stmt->execute();
        }

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $this->sendJSON([
            'success' => true,
            'registrations' => $rows
        ]);
    }

    // 💰 Get total revenue summary (registration payments + lesson/enrollment payments)
    public function getRevenueSummary()
    {
        try {
            // Check if registration_payments uses student_id or enrollment_id
            $checkCol = $this->conn->query("SHOW COLUMNS FROM tbl_registration_payments LIKE 'student_id'");
            $hasStudentId = $checkCol && $checkCol->rowCount() > 0;

            if ($hasStudentId) {
                $stmtRegistration = $this->conn->prepare("
                    SELECT COALESCE(SUM(amount), 0) AS total
                    FROM tbl_registration_payments
                    WHERE status = 'Paid'
                ");
            } else {
                // fas_db.sql structure - uses enrollment_id
                $stmtRegistration = $this->conn->prepare("
                    SELECT COALESCE(SUM(amount), 0) AS total
                    FROM tbl_registration_payments
                    WHERE status = 'Paid'
                ");
            }
            $stmtRegistration->execute();
            $registrationRevenue = (float)($stmtRegistration->fetch(PDO::FETCH_ASSOC)['total'] ?? 0);

            $stmtLesson = $this->conn->prepare("
                SELECT COALESCE(SUM(amount), 0) AS total
                FROM tbl_payments
                WHERE status = 'Paid'
            ");
            $stmtLesson->execute();
            $lessonRevenue = (float)($stmtLesson->fetch(PDO::FETCH_ASSOC)['total'] ?? 0);

            $this->sendJSON([
                'success' => true,
                'registration_revenue' => $registrationRevenue,
                'lesson_revenue' => $lessonRevenue,
                'total_revenue' => $registrationRevenue + $lessonRevenue
            ]);
        } catch (Exception $e) {
            $this->sendJSON(['error' => 'Failed to load revenue summary: ' . $e->getMessage()], 500);
        }
    }


    // ✅ Approve student
    public function approveStudent($json)
    {
        $data = json_decode($json, true);

        if (empty($data['student_id'])) {
            $this->sendJSON(['error' => 'student_id required'], 400);
        }

        try {
            $this->conn->beginTransaction();

            // Get student email to find associated user account
            $stmtStudent = $this->conn->prepare("
                SELECT email FROM tbl_students WHERE student_id = ?
            ");
            $stmtStudent->execute([$data['student_id']]);
            $student = $stmtStudent->fetch(PDO::FETCH_ASSOC);

            if (!$student) {
                $this->conn->rollBack();
                $this->sendJSON(['error' => 'Student not found'], 404);
            }

            $paid = $this->getRegistrationPaidAmount((int)$data['student_id']);
            if ($paid < 1000.0) {
                $stmtReg = $this->conn->prepare("
                    INSERT INTO tbl_registration_payments (
                        student_id, payment_date, amount, payment_method, status, receipt_number
                    ) VALUES (?, CURRENT_DATE, ?, 'Other', 'Paid', ?)
                ");
                $stmtReg->execute([
                    (int)$data['student_id'],
                    1000.0 - $paid,
                    'REG-APPROVE-' . time()
                ]);
            }

            $stmt = $this->conn->prepare("
                UPDATE tbl_students
                SET status = 'Active'
                WHERE student_id = ?
            ");
            $stmt->execute([$data['student_id']]);

            // Activate user account if it exists (linked by email)
            if (!empty($student['email'])) {
                $stmtUser = $this->conn->prepare("
                    UPDATE tbl_users
                    SET status = 'Active'
                    WHERE email = ? AND status = 'Inactive'
                ");
                $stmtUser->execute([$student['email']]);
            }

            // Activate guardian user accounts linked to this student (by guardian email)
            $stmtGuardianEmails = $this->conn->prepare("
                SELECT g.email
                FROM tbl_guardians g
                INNER JOIN tbl_student_guardians sg ON g.guardian_id = sg.guardian_id
                WHERE sg.student_id = ?
                  AND g.email IS NOT NULL
                  AND TRIM(g.email) <> ''
            ");
            $stmtGuardianEmails->execute([(int)$data['student_id']]);
            $guardianEmails = $stmtGuardianEmails->fetchAll(PDO::FETCH_COLUMN);
            if (!empty($guardianEmails)) {
                $placeholders = implode(',', array_fill(0, count($guardianEmails), '?'));
                $stmtGuardianUsers = $this->conn->prepare("
                    UPDATE tbl_users
                    SET status = 'Active'
                    WHERE email IN ({$placeholders}) AND status = 'Inactive'
                ");
                $stmtGuardianUsers->execute($guardianEmails);
            }

            $this->conn->commit();

            AuditLogs::record(
                $this->conn,
                'Student Approved',
                'Registrations',
                "Registration approved for student ID {$data['student_id']}.",
                'student', (int)$data['student_id'], $student['email'] ?? null,
                'info', ['status' => 'Pending'], ['status' => 'Active']
            );

            $this->sendJSON([
                'success' => true,
                'message' => 'Student approved successfully. User account has been activated.'
            ]);
        } catch (Exception $e) {
            $this->conn->rollBack();
            $this->sendJSON(['error' => 'Failed to approve student: ' . $e->getMessage()], 500);
        }
    }

    // ❌ Reject student registration but keep the student/login account
    public function rejectStudent($json)
    {
        $data = json_decode($json, true);

        if (empty($data['student_id'])) {
            $this->sendJSON(['error' => 'student_id required'], 400);
        }

        $studentId = (int) $data['student_id'];
        $branchId = isset($data['branch_id']) ? (int) $data['branch_id'] : 0;

        try {
            $this->conn->beginTransaction();

            $stmtStudent = $this->conn->prepare("
                SELECT student_id, email, branch_id
                FROM tbl_students
                WHERE student_id = ?
            ");
            $stmtStudent->execute([$studentId]);
            $student = $stmtStudent->fetch(PDO::FETCH_ASSOC);

            if (!$student) {
                $this->conn->rollBack();
                $this->sendJSON(['error' => 'Student not found'], 404);
            }

            if ($branchId > 0 && (int)($student['branch_id'] ?? 0) !== $branchId) {
                $this->conn->rollBack();
                $this->sendJSON(['error' => 'Student does not belong to your branch'], 403);
            }

            // Preserve the account, but mark the registration itself as rejected.
            $stmtFailPayments = $this->conn->prepare("
                UPDATE tbl_registration_payments
                SET status = 'Failed'
                WHERE student_id = ?
                  AND status = 'Pending'
            ");
            $stmtFailPayments->execute([$studentId]);

            $stmtResetStudent = $this->conn->prepare("
                UPDATE tbl_students
                SET status = 'Rejected'
                WHERE student_id = ?
            ");
            $stmtResetStudent->execute([$studentId]);

            // Keep the user account active so the student can log in and redo registration.
            $email = trim((string)($student['email'] ?? ''));
            if ($email !== '') {
                $stmtUser = $this->conn->prepare("
                    UPDATE tbl_users
                    SET status = 'Active'
                    WHERE email = ?
                ");
                $stmtUser->execute([$email]);
            }

            $this->conn->commit();

            AuditLogs::record(
                $this->conn,
                'Student Rejected',
                'Registrations',
                "Registration rejected for student ID {$studentId}.",
                'student', $studentId, $student['email'] ?? null,
                'warning', ['status' => 'Pending'], ['status' => 'Rejected']
            );

            $this->sendJSON([
                'success' => true,
                'message' => 'Registration rejected. The student account was kept.'
            ]);
        } catch (Exception $e) {
            $this->conn->rollBack();
            $this->sendJSON([
                'error' => 'Failed to reject registration: ' . $e->getMessage()
            ]);
        }
    }

    // 💰 Confirm Payment
    public function confirmPayment($json)
    {
        $data = json_decode($json, true);

        if (empty($data['student_id'])) {
            $this->sendJSON(['error' => 'student_id is required'], 400);
        }

        $branchId = isset($data['branch_id']) ? (int) $data['branch_id'] : 0;

        try {
            $this->conn->beginTransaction();
            $stmtStudent = $this->conn->prepare("SELECT student_id, email, branch_id FROM tbl_students WHERE student_id = ? LIMIT 1");
            $stmtStudent->execute([(int)$data['student_id']]);
            $student = $stmtStudent->fetch(PDO::FETCH_ASSOC);
            if (!$student) {
                $this->conn->rollBack();
                $this->sendJSON(['error' => 'Student not found'], 404);
            }

            if ($branchId > 0 && (int)($student['branch_id'] ?? 0) !== $branchId) {
                $this->conn->rollBack();
                $this->sendJSON(['error' => 'Student does not belong to your branch'], 403);
            }

            $requestedAmount = isset($data['amount']) ? (float)$data['amount'] : 0.0;
            $receipt = $data['receipt_number'] ?? 'REG-' . time();
            $paymentMethod = trim((string)($data['payment_method'] ?? ''));
            $registrationPaymentPk = $this->getRegistrationPaymentPrimaryKeyColumn();

            $stmtPending = $this->conn->prepare("
                SELECT {$registrationPaymentPk} AS registration_payment_pk, amount, payment_method, receipt_number, status
                FROM tbl_registration_payments
                WHERE student_id = ?
                ORDER BY
                    CASE
                        WHEN status = 'Pending' THEN 0
                        WHEN status = 'Paid' THEN 2
                        ELSE 1
                    END,
                    {$registrationPaymentPk} DESC
                LIMIT 1
            ");
            $stmtPending->execute([(int)$data['student_id']]);
            $pendingPayment = $stmtPending->fetch(PDO::FETCH_ASSOC);

            $pendingAmount = $pendingPayment ? (float)($pendingPayment['amount'] ?? 0) : 0.0;
            $paymentAmount = $pendingAmount > 0 ? $pendingAmount : $requestedAmount;
            if ($paymentAmount <= 0) {
                $this->conn->rollBack();
                $this->sendJSON(['error' => 'No submitted payment amount was found for this registration'], 400);
            }

            if ($paymentMethod === '' && $pendingPayment) {
                $paymentMethod = trim((string)($pendingPayment['payment_method'] ?? ''));
            }
            if ($paymentMethod === '') {
                $this->conn->rollBack();
                $this->sendJSON(['error' => 'No submitted payment method was found for this registration'], 400);
            }

            $currentPaid = $this->getRegistrationPaidAmount((int)$data['student_id']);
            $newPaid = $currentPaid + $paymentAmount;
            $remaining = 1000.0 - $newPaid;

            // Insert payment record - check if table uses student_id or enrollment_id
            $checkCol = $this->conn->query("SHOW COLUMNS FROM tbl_registration_payments LIKE 'student_id'");
            $hasStudentId = $checkCol && $checkCol->rowCount() > 0;

            if ($hasStudentId && $pendingPayment && strcasecmp((string)($pendingPayment['status'] ?? ''), 'Paid') !== 0) {
                $receipt = trim((string)($pendingPayment['receipt_number'] ?? '')) ?: $receipt;
                $stmtPayment = $this->conn->prepare("
                    UPDATE tbl_registration_payments
                    SET amount = ?, payment_method = ?, receipt_number = ?, status = 'Paid', payment_date = CURRENT_DATE
                    WHERE {$registrationPaymentPk} = ?
                ");
                $stmtPayment->execute([
                    $paymentAmount,
                    $paymentMethod,
                    $receipt,
                    (int)$pendingPayment['registration_payment_pk']
                ]);
            } elseif ($hasStudentId) {
                $stmtPayment = $this->conn->prepare("
                    INSERT INTO tbl_registration_payments (
                        student_id, amount, payment_method, receipt_number, status, payment_date
                    ) VALUES (?, ?, ?, ?, 'Paid', CURRENT_DATE)
                ");
                $stmtPayment->execute([
                    $data['student_id'],
                    $paymentAmount,
                    $paymentMethod,
                    $receipt
                ]);
            } else {
                // fas_db.sql structure - record against target enrollment row
                $targetEnrollmentId = (int)($student['enrollment_id'] ?? 0);
                if ($targetEnrollmentId > 0) {
                    $stmtPayment = $this->conn->prepare("
                        INSERT INTO tbl_registration_payments (
                            enrollment_id, amount, payment_method, receipt_number, status, payment_date
                        ) VALUES (?, ?, ?, ?, 'Paid', CURRENT_DATE)
                    ");
                    $stmtPayment->execute([
                        $targetEnrollmentId,
                        $paymentAmount,
                        $paymentMethod,
                        $receipt
                    ]);
                }
            }

            $newStatus = ($remaining <= 0) ? 'Approved' : 'Pending';

            // When approved, activate both student profile and login account.
            if ($newStatus === 'Approved') {
                $stmtActivateStudent = $this->conn->prepare("
                    UPDATE tbl_students
                    SET status = 'Active'
                    WHERE student_id = ?
                ");
                $stmtActivateStudent->execute([$data['student_id']]);

                if (!empty($student['email'])) {
                    $stmtActivateUser = $this->conn->prepare("
                        UPDATE tbl_users
                        SET status = 'Active'
                        WHERE email = ?
                    ");
                    $stmtActivateUser->execute([$student['email']]);
                }

                // Activate guardian user accounts linked to this student (by guardian email)
                $stmtGuardianEmails = $this->conn->prepare("
                    SELECT g.email
                    FROM tbl_guardians g
                    INNER JOIN tbl_student_guardians sg ON g.guardian_id = sg.guardian_id
                    WHERE sg.student_id = ?
                      AND g.email IS NOT NULL
                      AND TRIM(g.email) <> ''
                ");
                $stmtGuardianEmails->execute([(int)$data['student_id']]);
                $guardianEmails = $stmtGuardianEmails->fetchAll(PDO::FETCH_COLUMN);
                if (!empty($guardianEmails)) {
                    $placeholders = implode(',', array_fill(0, count($guardianEmails), '?'));
                    $stmtGuardianUsers = $this->conn->prepare("
                        UPDATE tbl_users
                        SET status = 'Active'
                        WHERE email IN ({$placeholders})
                    ");
                    $stmtGuardianUsers->execute($guardianEmails);
                }
            }

            $this->conn->commit();

            AuditLogs::record(
                $this->conn,
                'Payment Confirmed',
                'Payments',
                "Registration payment of ₱{$paymentAmount} confirmed for student ID {$data['student_id']} via {$paymentMethod}.",
                'student', (int)$data['student_id'], $student['email'] ?? null,
                'info', null, ['amount' => $paymentAmount, 'method' => $paymentMethod, 'status' => $newStatus]
            );

            $this->sendJSON([
                'success' => true,
                'message' => 'Payment recorded successfully',
                'paid_amount' => $newPaid,
                'remaining_amount' => max(0, $remaining),
                'registration_status' => $newStatus
            ]);
        } catch (Exception $e) {
            if ($this->conn && $this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            $this->sendJSON(['error' => 'Failed to record payment: ' . $e->getMessage()], 500);
        }
    }

    // 🔍 Get Registration Details
    public function getRegistrationDetails($studentId)
    {
        if (empty($studentId)) {
            $this->sendJSON(['error' => 'Student ID is required'], 400);
        }

        $branchId = isset($_GET['branch_id']) ? (int) $_GET['branch_id'] : 0;

        try {
            $this->ensureStudentRegistrationProofColumn();
            $this->ensureStudentAgeVerificationProofColumn();
            $this->ensureStudentRegistrationSourceColumn();
            $hasProofCol = $this->hasStudentColumn('registration_proof_path');
            $hasAgeProofCol = $this->hasStudentColumn('age_verification_proof_path');
            $hasSourceCol = $this->hasStudentColumn('registration_source');
            $branchSql = $branchId > 0 ? " AND s.branch_id = ?" : "";
            $stmt = $this->conn->prepare("
                SELECT
                    s.*,
                    s.branch_id,
                    b.branch_name,
                    1000.00 AS registration_fee_amount,
                    COALESCE((
                        SELECT SUM(rp.amount)
                        FROM tbl_registration_payments rp
                        WHERE rp.student_id = s.student_id
                          AND rp.status = 'Paid'
                    ), 0.00) AS registration_fee_paid,
                    GREATEST(0, 1000.00 - COALESCE((
                        SELECT SUM(rp.amount)
                        FROM tbl_registration_payments rp
                        WHERE rp.student_id = s.student_id
                          AND rp.status = 'Paid'
                    ), 0.00)) AS registration_fee_due,
                    " . ($hasSourceCol ? "s.registration_source" : "'online'") . " AS registration_source,
                    CASE
                        " . $this->walkInRegistrationApprovedCaseSql('s') . "
                        WHEN EXISTS (
                            SELECT 1
                            FROM tbl_registration_payments rp1
                            WHERE rp1.student_id = s.student_id
                              AND rp1.status = 'Pending'
                        ) THEN 'Pending'
                        WHEN COALESCE((
                            SELECT SUM(rp2.amount)
                            FROM tbl_registration_payments rp2
                            WHERE rp2.student_id = s.student_id
                              AND rp2.status = 'Paid'
                        ), 0.00) >= 1000 AND s.status = 'Active' THEN 'Approved'
                        WHEN COALESCE((
                            SELECT SUM(rp2.amount)
                            FROM tbl_registration_payments rp2
                            WHERE rp2.student_id = s.student_id
                              AND rp2.status = 'Paid'
                        ), 0.00) >= 1000 THEN 'Fee Paid'
                        ELSE 'Pending'
                    END AS registration_status
                FROM tbl_students s
                LEFT JOIN tbl_branches b ON s.branch_id = b.branch_id
                WHERE s.student_id = ?" . $branchSql . "
            ");
            if ($branchId > 0) {
                $stmt->execute([$studentId, $branchId]);
            } else {
                $stmt->execute([$studentId]);
            }
            $student = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$student) {
                $this->sendJSON(['error' => 'Student not found'], 404);
            }
            if (!$hasProofCol) $student['registration_proof_path'] = null;
            if (!$hasAgeProofCol) $student['age_verification_proof_path'] = null;

            // Get guardians
            $stmtGuardians = $this->conn->prepare("
                SELECT g.*
                FROM tbl_guardians g
                INNER JOIN tbl_student_guardians sg ON g.guardian_id = sg.guardian_id
                WHERE sg.student_id = ?
            ");
            $stmtGuardians->execute([$studentId]);
            $guardians = $stmtGuardians->fetchAll(PDO::FETCH_ASSOC);

            // Get payments
            $checkCol = $this->conn->query("SHOW COLUMNS FROM tbl_registration_payments LIKE 'student_id'");
            $hasStudentId = $checkCol && $checkCol->rowCount() > 0;

            if ($hasStudentId) {
                $stmtPayments = $this->conn->prepare("
                    SELECT * FROM tbl_registration_payments
                    WHERE student_id = ?
                    ORDER BY payment_date DESC
                ");
                $stmtPayments->execute([$studentId]);
            } else {
                // fas_db.sql structure - get via enrollments
                $stmtPayments = $this->conn->prepare("
                    SELECT rp.* FROM tbl_registration_payments rp
                    INNER JOIN tbl_enrollments e ON rp.enrollment_id = e.enrollment_id
                    WHERE e.student_id = ?
                    ORDER BY rp.payment_date DESC
                ");
                $stmtPayments->execute([$studentId]);
            }
            $payments = $stmtPayments->fetchAll(PDO::FETCH_ASSOC);

            // Get user account
            $stmtUser = $this->conn->prepare("
                SELECT username, email, status
                FROM tbl_users
                WHERE email = ?
                LIMIT 1
            ");
            $stmtUser->execute([$student['email']]);
            $userAccount = $stmtUser->fetch(PDO::FETCH_ASSOC);

            $this->sendJSON([
                'success' => true,
                'student' => $student,
                'guardians' => $guardians,
                'payments' => $payments,
                'user_account' => $userAccount
            ]);
        } catch (Exception $e) {
            $this->sendJSON(['error' => 'Failed to load details: ' . $e->getMessage()], 500);
        }
    }

    // 👥 List all user accounts with roles (and optional branch if linked)
    public function getUsers()
    {
        try {
            $hasUserBranch = $this->hasUserColumn('branch_id');
            $userBranchIdSql = $hasUserBranch ? "u.branch_id" : "NULL";
            $userBranchJoinSql = $hasUserBranch ? "LEFT JOIN tbl_branches bu ON u.branch_id = bu.branch_id" : "";
            $userBranchNameSql = $hasUserBranch ? "bu.branch_name," : "";

            $sql = "
                SELECT
                    u.user_id,
                    u.username,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.phone,
                    u.status,
                    COALESCE({$userBranchIdSql}, t.branch_id, s.branch_id, gb.branch_id) AS branch_id,
                    CASE
                        WHEN LOWER(TRIM(r.role_name)) = 'manager' THEN 'Branch Manager'
                        WHEN LOWER(TRIM(r.role_name)) = 'staff' THEN 'Staff'
                        WHEN LOWER(TRIM(r.role_name)) IN ('guardian', 'guardians') THEN 'Guardian'
                        ELSE r.role_name
                    END AS role_name,
                    COALESCE({$userBranchNameSql} bt.branch_name, bs.branch_name, gb.branch_name, '') AS branch_name
                FROM tbl_users u
                INNER JOIN tbl_roles r ON u.role_id = r.role_id
                LEFT JOIN tbl_teachers t ON t.user_id = u.user_id
                LEFT JOIN tbl_branches bt ON t.branch_id = bt.branch_id
                {$userBranchJoinSql}
                LEFT JOIN tbl_students s ON s.email = u.email
                LEFT JOIN tbl_branches bs ON s.branch_id = bs.branch_id
                LEFT JOIN (
                    SELECT
                        g.email,
                        MIN(sgs.branch_id) AS branch_id,
                        GROUP_CONCAT(DISTINCT bg.branch_name ORDER BY bg.branch_name SEPARATOR ', ') AS branch_name
                    FROM tbl_guardians g
                    LEFT JOIN tbl_student_guardians sg ON g.guardian_id = sg.guardian_id
                    LEFT JOIN tbl_students sgs ON sgs.student_id = sg.student_id
                    LEFT JOIN tbl_branches bg ON sgs.branch_id = bg.branch_id
                    GROUP BY g.email
                ) gb ON gb.email = u.email
                ORDER BY r.role_name, u.first_name, u.last_name, u.user_id
            ";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $this->sendJSON([
                'success' => true,
                'users' => $rows
            ]);
        } catch (Exception $e) {
            $this->sendJSON(['error' => 'Failed to load users: ' . $e->getMessage()], 500);
        }
    }

    public function getRoles()
    {
        try {
            $stmt = $this->conn->prepare("
                SELECT role_id, role_name
                FROM tbl_roles
                ORDER BY role_name ASC
            ");
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $roles = array_map(function ($row) {
                $rawName = trim((string)($row['role_name'] ?? ''));
                $displayName = $rawName;
                if (strcasecmp($rawName, 'Manager') === 0) {
                    $displayName = 'Branch Manager';
                } elseif (strcasecmp($rawName, 'Guardians') === 0 || strcasecmp($rawName, 'Guardian') === 0) {
                    $displayName = 'Guardian';
                }

                return [
                    'role_id' => (int)($row['role_id'] ?? 0),
                    'role_name' => $rawName,
                    'display_name' => $displayName
                ];
            }, $rows);

            $this->sendJSON([
                'success' => true,
                'roles' => $roles
            ]);
        } catch (Exception $e) {
            $this->sendJSON(['error' => 'Failed to load roles: ' . $e->getMessage()], 500);
        }
    }

    // ➕ Create a new user account (admin-created staff / branch manager / student)
    public function createUser($json)
    {
        $data = json_decode($json, true);
        if (!is_array($data)) {
            $this->sendJSON(['error' => 'Invalid payload'], 400);
        }

        $firstName = trim((string)($data['first_name'] ?? ''));
        $lastName  = trim((string)($data['last_name'] ?? ''));
        $email     = trim((string)($data['email'] ?? ''));
        $phone     = trim((string)($data['phone'] ?? ''));
        $roleName  = trim((string)($data['role'] ?? ''));
        $password  = (string)($data['password'] ?? '');
        $branchId  = isset($data['branch_id']) ? (int) $data['branch_id'] : 0;
        $accountMode = trim((string)($data['account_mode'] ?? ''));
        $systemLoginName = trim((string)($data['system_login_name'] ?? ''));

        if ($firstName === '' || $lastName === '' || $roleName === '' || $password === '') {
            $this->sendJSON(['error' => 'first_name, last_name, role and password are required'], 400);
        }

        $resolvedAccountMode = $this->resolveAdminAccountMode($accountMode, $email);
        if ($resolvedAccountMode === 'real_email') {
            if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $this->sendJSON(['error' => 'A valid real email address is required'], 400);
            }
            if ($this->isWalkInSystemEmail($email)) {
                $this->sendJSON(['error' => 'Use the school login option for @fas.com accounts'], 400);
            }
        }

        try {
            // Normalize UI role labels to database role_name values
            $lookupRoleName = $roleName;
            if (strcasecmp($roleName, 'Branch Manager') === 0) {
                $lookupRoleName = 'Manager';
            } elseif (strcasecmp($roleName, 'Staff') === 0) {
                $lookupRoleName = 'Staff';
            }

            // Find role_id by role_name
            $stmtRole = $this->conn->prepare("SELECT role_id FROM tbl_roles WHERE role_name = ? LIMIT 1");
            $stmtRole->execute([$lookupRoleName]);
            $role = $stmtRole->fetch(PDO::FETCH_ASSOC);
            if (!$role) {
                $this->sendJSON(['error' => 'Role not found: ' . $roleName], 400);
            }
            $roleId = (int)$role['role_id'];

            $account = $this->resolveAdminAccountCredentials(
                $firstName,
                $lastName,
                $email,
                $roleName,
                $resolvedAccountMode,
                $systemLoginName
            );
            $username = (string)($account['username'] ?? '');
            $storedEmail = (string)($account['email'] ?? '');
            $resolvedAccountMode = (string)($account['account_mode'] ?? $resolvedAccountMode);

            // Prevent duplicate username/email
            $dupCheck = $this->conn->prepare("
                SELECT user_id FROM tbl_users
                WHERE username = ? OR email = ?
                LIMIT 1
            ");
            $dupCheck->execute([$username, $storedEmail]);
            if ($dupCheck->fetch()) {
                $this->sendJSON(['error' => 'This login or email is already registered. Please use a different value.'], 400);
            }

            $hashed = password_hash($password, PASSWORD_DEFAULT);
            $needsBranch = in_array(strtolower($lookupRoleName), ['staff', 'manager'], true);
            if ($needsBranch && $branchId < 1) {
                $this->sendJSON(['error' => 'Branch is required for Staff/Manager accounts'], 400);
            }

            $this->ensureUserBranchColumn();
            $hasBranchCol = $this->hasUserColumn('branch_id');

            if ($hasBranchCol) {
                $stmt = $this->conn->prepare("
                    INSERT INTO tbl_users (
                        username, password, role_id, branch_id, first_name, last_name,
                        email, phone, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')
                ");
                $stmt->execute([
                    $username,
                    $hashed,
                    $roleId,
                    $branchId > 0 ? $branchId : null,
                    $firstName,
                    $lastName,
                    $storedEmail,
                    $phone
                ]);
            } else {
                $stmt = $this->conn->prepare("
                    INSERT INTO tbl_users (
                        username, password, role_id, first_name, last_name,
                        email, phone, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
                ");
                $stmt->execute([
                    $username,
                    $hashed,
                    $roleId,
                    $firstName,
                    $lastName,
                    $storedEmail,
                    $phone
                ]);
            }

            $userId = (int)$this->conn->lastInsertId();
            $emailSent = false;
            if (!empty($account['send_email'])) {
                $emailSent = $this->sendAdminCredentialsEmail(
                    $storedEmail,
                    trim($firstName . ' ' . $lastName),
                    $username,
                    $password,
                    $roleName
                );
            }

            AuditLogs::record(
                $this->conn,
                'User Created',
                'Users',
                "New user account created: {$username} with role {$roleName}.",
                'user', $userId, $username,
                'info', null, ['name' => "{$firstName} {$lastName}", 'email' => $storedEmail, 'username' => $username, 'role' => $roleName]
            );

            $this->sendJSON([
                'success' => true,
                'message' => 'User created successfully.',
                'user_id' => $userId,
                'username' => $username,
                'email' => $storedEmail,
                'account_mode' => $resolvedAccountMode,
                'send_email' => !empty($account['send_email']),
                'email_sent' => $emailSent,
                'email_error' => $emailSent ? null : $this->lastMailError
            ]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                $this->sendJSON(['error' => 'This login or email is already registered. Please use a different value.'], 400);
            }
            $this->sendJSON(['error' => 'Failed to create user: ' . $e->getMessage()], 500);
        }
    }

    // ✏️ Update a user's profile (admin-only)
    public function updateUser($json)
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode($json, true);
        if (!is_array($data)) {
            $this->sendJSON(['error' => 'Invalid payload'], 400);
        }

        $userId = isset($data['user_id']) ? (int)$data['user_id'] : 0;
        $firstName = trim((string)($data['first_name'] ?? ''));
        $lastName = trim((string)($data['last_name'] ?? ''));
        $email = trim((string)($data['email'] ?? ''));
        $phone = trim((string)($data['phone'] ?? ''));
        $branchId = isset($data['branch_id']) && $data['branch_id'] !== '' ? (int)$data['branch_id'] : 0;

        if ($userId <= 0 || $firstName === '' || $lastName === '') {
            $this->sendJSON(['error' => 'user_id, first_name and last_name are required'], 400);
        }

        try {
            $stmtCurrent = $this->conn->prepare("SELECT username, email FROM tbl_users WHERE user_id = ? LIMIT 1");
            $stmtCurrent->execute([$userId]);
            $currentUser = $stmtCurrent->fetch(PDO::FETCH_ASSOC) ?: [];
            if ($email === '' && $this->isWalkInSystemEmail($currentUser['username'] ?? '')) {
                $email = (string)($currentUser['username'] ?? '');
            }
            if ($email === '' && $this->isWalkInSystemEmail($currentUser['email'] ?? '')) {
                $email = (string)($currentUser['email'] ?? '');
            }

            if ($email === '') {
                $this->sendJSON(['error' => 'Email or walk-in login is required'], 400);
            }

            if (!filter_var($email, FILTER_VALIDATE_EMAIL) && !$this->isWalkInSystemEmail($email)) {
                $this->sendJSON(['error' => 'Invalid email address'], 400);
            }

            // Prevent duplicate username/email (exclude current user)
            $stmtCheck = $this->conn->prepare("
                SELECT user_id FROM tbl_users
                WHERE (username = ? OR email = ?) AND user_id <> ?
                LIMIT 1
            ");
            $stmtCheck->execute([$email, $email, $userId]);
            $exists = $stmtCheck->fetch(PDO::FETCH_ASSOC);
            if ($exists) {
                $this->sendJSON(['error' => 'Email already exists'], 409);
            }

            $hasBranchCol = $this->hasUserColumn('branch_id');
            if ($hasBranchCol) {
                $stmt = $this->conn->prepare("
                    UPDATE tbl_users
                    SET first_name = ?, last_name = ?, email = ?, phone = ?, username = ?, branch_id = ?
                    WHERE user_id = ?
                ");
                $stmt->execute([
                    $firstName,
                    $lastName,
                    $email,
                    $phone,
                    $email,
                    $branchId > 0 ? $branchId : null,
                    $userId
                ]);
            } else {
                $stmt = $this->conn->prepare("
                    UPDATE tbl_users
                    SET first_name = ?, last_name = ?, email = ?, phone = ?, username = ?
                    WHERE user_id = ?
                ");
                $stmt->execute([
                    $firstName,
                    $lastName,
                    $email,
                    $phone,
                    $email,
                    $userId
                ]);
            }

            AuditLogs::record(
                $this->conn,
                'User Updated',
                'Users',
                "User profile updated for user ID {$userId} ({$email}).",
                'user', $userId, $email,
                'info', ['email' => $currentUser['email'] ?? ''], ['first_name' => $firstName, 'last_name' => $lastName, 'email' => $email]
            );

            $this->sendJSON([
                'success' => true,
                'message' => 'User profile updated successfully.'
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Failed to update user: ' . $e->getMessage()], 500);
        }
    }

    // 🔒 Activate/deactivate user account
    public function setUserStatus($json)
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode($json, true);
        if (!is_array($data)) {
            $this->sendJSON(['error' => 'Invalid payload'], 400);
        }

        $userId = isset($data['user_id']) ? (int)$data['user_id'] : 0;
        $status = trim((string)($data['status'] ?? ''));
        $normalized = strcasecmp($status, 'Active') === 0 ? 'Active' : (strcasecmp($status, 'Inactive') === 0 ? 'Inactive' : '');

        if ($userId <= 0 || $normalized === '') {
            $this->sendJSON(['error' => 'user_id and valid status are required'], 400);
        }

        try {
            $stmt = $this->conn->prepare("UPDATE tbl_users SET status = ? WHERE user_id = ?");
            $stmt->execute([$normalized, $userId]);
            $this->sendJSON([
                'success' => true,
                'message' => 'User status updated successfully.'
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Failed to update status: ' . $e->getMessage()], 500);
        }
    }
}

// Router
$admin = new Admin($conn);
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get-pending-students':
        $admin->getPendingStudents();
        break;
    case 'get-pending-registrations':
        $admin->getPendingRegistrations();
        break;
    case 'get-all-registrations':
        $admin->getAllRegistrations();
        break;
    case 'get-revenue-summary':
        $admin->getRevenueSummary();
        break;
    case 'get-registration-details':
        $admin->getRegistrationDetails($_GET['student_id'] ?? '');
        break;
    case 'approve-student':
        $admin->approveStudent(file_get_contents('php://input'));
        break;
    case 'reject-student':
    case 'reject-registration':
        $admin->rejectStudent(file_get_contents('php://input'));
        break;
    case 'confirm-payment':
        $admin->confirmPayment(file_get_contents('php://input'));
        break;
    case 'get-users':
        $admin->getUsers();
        break;
    case 'get-roles':
        $admin->getRoles();
        break;
    case 'create-user':
        $admin->createUser(file_get_contents('php://input'));
        break;
    case 'update-user':
        $admin->updateUser(file_get_contents('php://input'));
        break;
    case 'set-user-status':
        $admin->setUserStatus(file_get_contents('php://input'));
        break;
    default:
        $admin->sendJSON(['error' => 'Invalid action'], 400);
}
?>
