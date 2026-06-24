<?php
// Suppress error display for JSON APIs
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once 'db_connect.php';

if (!defined('FAS_USERS_CLASS_ONLY')) {
    header("Content-Type: application/json");
    header("Access-Control-Allow-Origin: *");
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        exit(0);
    }

    if (!isset($conn) || $conn === null) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        exit;
    }
}

class User
{
    private $conn;
    private $phpMailerLoaded = false;
    private $lastMailError = null;

    public function __construct($pdo)
    {
        $this->conn = $pdo;
    }

    private function ensurePhpMailerLoaded()
    {
        if ($this->phpMailerLoaded) {
            return;
        }
        require_once dirname(__DIR__) . '/phpmailer/src/Exception.php';
        require_once dirname(__DIR__) . '/phpmailer/src/PHPMailer.php';
        require_once dirname(__DIR__) . '/phpmailer/src/SMTP.php';
        $this->phpMailerLoaded = true;
    }

    public function sendJSON($data, $statusCode = 200)
    {
        http_response_code($statusCode);
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

    private function calculateAgeFromDateOfBirth($dateOfBirth)
    {
        $dateOfBirth = trim((string) $dateOfBirth);
        if ($dateOfBirth === '') {
            return null;
        }

        try {
            $dob = new DateTime($dateOfBirth);
            $now = new DateTime();
            return (int) $now->diff($dob)->y;
        } catch (Exception $e) {
            return null;
        }
    }

    private function assertMinimumStudentAge($dateOfBirth, $context = 'register or enroll')
    {
        $age = $this->calculateAgeFromDateOfBirth($dateOfBirth);
        if ($age === null) {
            $this->sendJSON(['error' => 'Date of birth is required to verify age.'], 400);
        }
        if ($age < 3) {
            $this->sendJSON(['error' => 'Students must be at least 3 years old to ' . $context . '.'], 400);
        }
        return $age;
    }

    private function ensureUserVerificationColumns()
    {
        if ($this->hasUserColumn('email_verified_at') && $this->hasUserColumn('email_verification_code_hash') && $this->hasUserColumn('email_verification_code_expires_at') && $this->hasUserColumn('email_verification_sent_at')) {
            return;
        }

        try {
            if (!$this->hasUserColumn('email_verified_at')) {
                $this->conn->exec("ALTER TABLE tbl_users ADD COLUMN email_verified_at DATETIME NULL AFTER status");
            }
            if (!$this->hasUserColumn('email_verification_code_hash')) {
                $this->conn->exec("ALTER TABLE tbl_users ADD COLUMN email_verification_code_hash VARCHAR(255) NULL AFTER email_verified_at");
            }
            if (!$this->hasUserColumn('email_verification_code_expires_at')) {
                $this->conn->exec("ALTER TABLE tbl_users ADD COLUMN email_verification_code_expires_at DATETIME NULL AFTER email_verification_code_hash");
            }
            if (!$this->hasUserColumn('email_verification_sent_at')) {
                $this->conn->exec("ALTER TABLE tbl_users ADD COLUMN email_verification_sent_at DATETIME NULL AFTER email_verification_code_expires_at");
            }
            $this->conn->exec("
                UPDATE tbl_users
                SET email_verified_at = COALESCE(email_verified_at, NOW())
                WHERE status = 'Active'
                  AND email_verified_at IS NULL
            ");
            $this->ensureWalkInAccountsSynced();
        } catch (PDOException $e) {
            // Keep API working even if alter fails
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

    private function generateEmailVerificationCode()
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    private function isValidEmailAddress($email)
    {
        return filter_var(trim((string)$email), FILTER_VALIDATE_EMAIL) !== false;
    }

    private function isWalkInSystemEmail($email)
    {
        return preg_match('/@fas\.com$/i', trim((string)$email)) === 1;
    }

    private function resolveWalkInLoginIdentifier($username)
    {
        $username = trim((string)$username);
        if ($username === '' || strpos($username, '@') !== false) {
            return $username;
        }
        return $this->sanitizeWalkInLoginBase($username) . '@fas.com';
    }

    private function ensureWalkInAccountsSynced()
    {
        try {
            $this->ensureStudentRegistrationSourceColumn();
            if ($this->hasUserColumn('email_verified_at')) {
                $this->conn->exec("
                    UPDATE tbl_users u
                    LEFT JOIN tbl_students s ON s.email = u.email OR s.email = u.username
                    SET u.email_verified_at = COALESCE(u.email_verified_at, NOW())
                    WHERE u.email_verified_at IS NULL
                      AND (
                          u.email LIKE '%@fas.com'
                          OR u.username LIKE '%@fas.com'
                          OR COALESCE(s.registration_source, '') = 'walkin'
                      )
                ");
            }
            if ($this->tableExists('tbl_registration_payments') && $this->hasStudentColumn('registration_source')) {
                $this->conn->exec("
                    UPDATE tbl_registration_payments rp
                    INNER JOIN tbl_students s ON s.student_id = rp.student_id
                    SET rp.status = 'Paid',
                        rp.amount = CASE WHEN rp.amount > 0 THEN rp.amount ELSE 1000.00 END,
                        rp.payment_method = CASE
                            WHEN TRIM(COALESCE(rp.payment_method, '')) = '' THEN 'Walk-In'
                            ELSE rp.payment_method
                        END
                    WHERE COALESCE(s.registration_source, '') = 'walkin'
                      AND rp.status = 'Pending'
                      AND rp.receipt_number LIKE 'REG-WALKIN-%'
                ");
            }
        } catch (PDOException $e) {
            // Keep API working even if backfill fails
        }
    }

    private function sanitizeWalkInLoginBase($value, $fallbackParts = [])
    {
        $raw = trim((string)$value);
        if ($raw === '') {
            $fallback = '';
            foreach ((array)$fallbackParts as $part) {
                $part = trim((string)$part);
                if ($part === '') {
                    continue;
                }
                $fallback = $fallback === '' ? $part : ($fallback . ' ' . $part);
            }
            $raw = $fallback;
        }

        if (strpos($raw, '@') !== false) {
            $raw = substr($raw, 0, strpos($raw, '@'));
        }

        $raw = strtolower($raw);
        $raw = preg_replace('/[^a-z0-9]+/', '.', $raw);
        $raw = trim($raw, '.');
        return $raw !== '' ? $raw : 'student';
    }

    private function walkInEmailExists($email)
    {
        $stmt = $this->conn->prepare("SELECT 1 FROM tbl_users WHERE username = ? OR email = ? LIMIT 1");
        $stmt->execute([$email, $email]);
        if ($stmt->fetchColumn()) {
            return true;
        }

        $stmt = $this->conn->prepare("SELECT 1 FROM tbl_students WHERE email = ? LIMIT 1");
        $stmt->execute([$email]);
        return (bool) $stmt->fetchColumn();
    }

    private function buildWalkInLoginEmail($input, $firstName = '', $lastName = '')
    {
        $base = $this->sanitizeWalkInLoginBase($input, [$firstName, $lastName]);
        $email = $base . '@fas.com';
        if ($this->walkInEmailExists($email)) {
            return null;
        }
        return $email;
    }

    private function isPlaceholderMailHost($host)
    {
        $host = strtolower(trim((string)$host));
        if ($host === '') {
            return true;
        }
        $placeholders = ['smtp.example.com', 'example.com', 'localhost', '127.0.0.1'];
        return in_array($host, $placeholders, true);
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
            'debug' => filter_var($fileValue('MAIL_DEBUG', $env('MAIL_DEBUG', 'false')), FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE)
        ];
    }

    private function configurePhpMailer($mailer, array $mail)
    {
        $mailer->CharSet = 'UTF-8';
        $mailer->isHTML(true);
        $mailer->setFrom($mail['from_address'], $mail['from_name']);

        if (!empty($mail['reply_to']) && $this->isValidEmailAddress($mail['reply_to'])) {
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
                'allow_self_signed' => $mail['verify_peer'] === false
            ]
        ];
        if (!empty($mail['debug'])) {
            $mailer->SMTPDebug = 2;
            $mailer->Debugoutput = static function ($str, $level) {
                error_log('PHPMailer SMTP[' . $level . ']: ' . $str);
            };
        }

        if ($mail['encryption'] === 'ssl') {
            $mailer->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
        } elseif ($mail['encryption'] === 'tls') {
            $mailer->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        } else {
            $mailer->SMTPSecure = '';
            $mailer->SMTPAutoTLS = false;
        }
    }

    private function sendVerificationEmail($toEmail, $toName, $verificationCode)
    {
        $this->ensurePhpMailerLoaded();
        $this->lastMailError = null;
        if (!$this->isMailConfigured()) {
            $this->lastMailError = 'SMTP is not configured on the server.';
            return false;
        }

        $mail = $this->getMailSettings();
        if (!$this->isValidEmailAddress($toEmail)) {
            return false;
        }

        try {
            $mailer = new \PHPMailer\PHPMailer\PHPMailer(true);
            $this->configurePhpMailer($mailer, $mail);
            $mailer->addAddress($toEmail, $toName ?: $toEmail);

            $safeName = htmlspecialchars($toName ?: 'Student', ENT_QUOTES, 'UTF-8');
            $safeEmail = htmlspecialchars($toEmail, ENT_QUOTES, 'UTF-8');
            $safeCode = htmlspecialchars($verificationCode, ENT_QUOTES, 'UTF-8');

            $mailer->Subject = 'Your Father & Sons verification code';
            $mailer->Body = '
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
                    <h2 style="margin: 0 0 12px;">Verify your email</h2>
                    <p>Hello ' . $safeName . ',</p>
                    <p>Use this 6-digit verification code to activate your account:</p>
                    <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 16px 0; color: #b8860b;">' . $safeCode . '</p>
                    <p>This code was sent to <strong>' . $safeEmail . '</strong> and expires in 15 minutes.</p>
                    <p>If you did not create this account, you can ignore this message.</p>
                </div>
            ';
            $mailer->AltBody = "Verify your email using code {$verificationCode}. It expires in 15 minutes.";
            $mailer->send();
            return true;
        } catch (\PHPMailer\PHPMailer\Exception $e) {
            $this->lastMailError = trim($e->getMessage() . ' ' . $mailer->ErrorInfo);
            error_log('Verification email failed: ' . $this->lastMailError);
            return false;
        } catch (Exception $e) {
            $this->lastMailError = $e->getMessage();
            error_log('Verification email failed: ' . $this->lastMailError);
            return false;
        }
    }

    // ── Welcome email sent once after successful verification ─────────
    private function sendWelcomeEmail($toEmail, $toName)
    {
        $this->ensurePhpMailerLoaded();
        $this->lastMailError = null;
        if (!$this->isMailConfigured()) {
            return false; // silent — welcome email is non-critical
        }

        $mail = $this->getMailSettings();
        if (!$this->isValidEmailAddress($toEmail)) {
            return false;
        }

        try {
            $mailer = new \PHPMailer\PHPMailer\PHPMailer(true);
            $this->configurePhpMailer($mailer, $mail);
            $mailer->addAddress($toEmail, $toName ?: $toEmail);

            $safeName  = htmlspecialchars($toName  ?: 'Student',  ENT_QUOTES, 'UTF-8');
            $safeEmail = htmlspecialchars($toEmail, ENT_QUOTES, 'UTF-8');
            $year      = date('Y');

            $mailer->Subject = 'Welcome to Father & Sons Music School 🎵';
            $mailer->isHTML(true);
            $mailer->Body = '
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Welcome to Father &amp; Sons Music School</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,.10);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0b0f18 0%,#1a1d23 100%);padding:36px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:11px;letter-spacing:4px;font-weight:700;color:#d4af37;text-transform:uppercase;">Father &amp; Sons Music School</p>
            <h1 style="margin:0;font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Welcome aboard! 🎶</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">

            <p style="margin:0 0 16px;font-size:16px;color:#0f172a;">Hello <strong>' . $safeName . '</strong>,</p>

            <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;">
              Congratulations! Your email has been successfully verified and your
              <strong style="color:#0f172a;">Father &amp; Sons Music School</strong> account is now active.
            </p>

            <!-- Green checkmark box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:14px;padding:20px 24px;">
                  <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#16a34a;">You can now</p>
                  <table cellpadding="0" cellspacing="0">
                    <tr><td style="padding:4px 0;font-size:14px;color:#15803d;">
                      <span style="margin-right:10px;font-size:15px;">✅</span> Log in to your account
                    </td></tr>
                    <tr><td style="padding:4px 0;font-size:14px;color:#15803d;">
                      <span style="margin-right:10px;font-size:15px;">🎸</span> Enroll in music lessons
                    </td></tr>
                    <tr><td style="padding:4px 0;font-size:14px;color:#15803d;">
                      <span style="margin-right:10px;font-size:15px;">📅</span> View your schedule
                    </td></tr>
                    <tr><td style="padding:4px 0;font-size:14px;color:#15803d;">
                      <span style="margin-right:10px;font-size:15px;">🎓</span> Access your student portal
                    </td></tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA button -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td align="center">
                  <a href="http://localhost/FAS_music/index.html"
                     style="display:inline-block;background:linear-gradient(135deg,#d4af37,#b8860b);color:#000000;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:50px;letter-spacing:0.3px;">
                    Go to My Portal →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 6px;font-size:15px;color:#475569;line-height:1.7;">
              Welcome to the <strong style="color:#0f172a;">Father &amp; Sons Music School</strong> family!
              We&rsquo;re excited to be part of your musical journey.
            </p>
            <p style="margin:0;font-size:13px;color:#94a3b8;">
              This email was sent to <span style="color:#0f172a;font-weight:600;">' . $safeEmail . '</span>
            </p>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              &copy; ' . $year . ' Father &amp; Sons Music School. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>';

            $mailer->AltBody = "Hello {$toName},\n\nCongratulations! Your email has been verified and your Father & Sons Music School account is now active.\n\nYou can now:\n✓ Log in to your account\n✓ Enroll in music lessons\n✓ View your schedule\n✓ Access your student portal\n\nWelcome to the Father & Sons Music School family!\n\n© {$year} Father & Sons Music School";

            $mailer->send();
            return true;
        } catch (\PHPMailer\PHPMailer\Exception $e) {
            error_log('Welcome email failed: ' . trim($e->getMessage() . ' ' . $mailer->ErrorInfo));
            return false;
        } catch (Exception $e) {
            error_log('Welcome email failed: ' . $e->getMessage());
            return false;
        }
    }

    private function sendWalkInAccountEmail($toEmail, $toName, $loginEmail, $temporaryPassword)
    {
        $this->ensurePhpMailerLoaded();
        $mail = $this->getMailSettings();
        if (!$this->isValidEmailAddress($mail['from_address'])) {
            throw new Exception('This email is invalid. Please check the address or choose No email account.');
        }
        if (empty($mail['host'])) {
            throw new Exception('Mail service is not configured.');
        }

        $mailer = new \PHPMailer\PHPMailer\PHPMailer(true);
        $mailer->CharSet = 'UTF-8';
        $mailer->isHTML(true);
        $mailer->setFrom($mail['from_address'], $mail['from_name']);
        $mailer->addAddress($toEmail, $toName ?: $toEmail);

        if (!empty($mail['reply_to'])) {
            $mailer->addReplyTo($mail['reply_to'], $mail['from_name']);
        }

        $mailer->isSMTP();
        $mailer->Host = $mail['host'];
        $mailer->Port = $mail['port'] > 0 ? $mail['port'] : 587;
        $mailer->SMTPAuth = $mail['username'] !== '';
        $mailer->Username = $mail['username'];
        $mailer->Password = $mail['password'];

        if ($mail['encryption'] === 'ssl') {
            $mailer->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
        } elseif ($mail['encryption'] === 'tls') {
            $mailer->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        }

        $safeName = htmlspecialchars($toName ?: 'Student', ENT_QUOTES, 'UTF-8');
        $safeLogin = htmlspecialchars($loginEmail, ENT_QUOTES, 'UTF-8');
        $safePassword = htmlspecialchars($temporaryPassword, ENT_QUOTES, 'UTF-8');

        $mailer->Subject = 'Your Father & Sons Walk-In Account';
        $mailer->Body = '
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
                <h2 style="margin: 0 0 12px;">Your walk-in account is ready</h2>
                <p>Hello ' . $safeName . ',</p>
                <p>Your account was created by the branch staff. You can log in using:</p>
                <p style="font-size: 18px; font-weight: 700; margin: 16px 0; color: #b8860b;">' . $safeLogin . '</p>
                <p><strong>Temporary Password:</strong> ' . $safePassword . '</p>
                <p>Please change your password after your first login.</p>
            </div>
        ';
        $mailer->AltBody = "Your walk-in account is ready. Login: {$loginEmail}. Temporary Password: {$temporaryPassword}.";
        $mailer->send();
        return true;
    }

    private function issueEmailVerificationCode($userId, $toEmail, $toName)
    {
        $this->ensureUserVerificationColumns();
        $verificationCode = $this->generateEmailVerificationCode();
        $verificationHash = password_hash($verificationCode, PASSWORD_DEFAULT);
        $expiresAt = date('Y-m-d H:i:s', time() + (15 * 60));

        $stmt = $this->conn->prepare("
            UPDATE tbl_users
            SET email_verification_code_hash = ?,
                email_verification_code_expires_at = ?,
                email_verification_sent_at = NOW(),
                email_verified_at = NULL
            WHERE user_id = ?
        ");
        $stmt->execute([
            $verificationHash,
            $expiresAt,
            (int)$userId
        ]);

        $emailSent = false;
        $mailError = null;
        try {
            $emailSent = $this->sendVerificationEmail($toEmail, $toName, $verificationCode);
        } catch (Exception $e) {
            $mailError = $e->getMessage();
            error_log('issueEmailVerificationCode mail error: ' . $mailError);
        }

        return [
            'verification_code' => $verificationCode,
            'email_sent' => (bool)$emailSent,
            'mail_configured' => $this->isMailConfigured(),
            'mail_error' => $mailError ?: $this->lastMailError
        ];
    }

    private function isMultipartRequest()
    {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? ($_SERVER['HTTP_CONTENT_TYPE'] ?? '');
        return stripos((string)$contentType, 'multipart/form-data') !== false;
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

    private function ensureStudentRegistrationColumns()
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

    private function normalizeRegistrationEmail($email)
    {
        return strtolower(trim((string)$email));
    }

    private function findStudentByRegistrationEmail($email)
    {
        $normalized = $this->normalizeRegistrationEmail($email);
        if ($normalized === '') {
            return null;
        }
        $stmt = $this->conn->prepare("
            SELECT student_id, status, email
            FROM tbl_students
            WHERE LOWER(TRIM(email)) = ?
            LIMIT 1
        ");
        $stmt->execute([$normalized]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private function findUserByRegistrationEmail($email)
    {
        $normalized = $this->normalizeRegistrationEmail($email);
        if ($normalized === '') {
            return null;
        }
        $stmt = $this->conn->prepare("
            SELECT u.user_id, u.username, u.email, u.status, u.email_verified_at, r.role_name
            FROM tbl_users u
            INNER JOIN tbl_roles r ON r.role_id = u.role_id
            WHERE LOWER(TRIM(u.username)) = ?
               OR LOWER(TRIM(COALESCE(u.email, ''))) = ?
            LIMIT 1
        ");
        $stmt->execute([$normalized, $normalized]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private function studentHasEnrollmentRecords($studentId)
    {
        $stmt = $this->conn->prepare("SELECT COUNT(*) FROM tbl_enrollments WHERE student_id = ?");
        $stmt->execute([(int)$studentId]);
        return ((int)$stmt->fetchColumn()) > 0;
    }

    private function canReleaseAbandonedOnlineRegistration($student, $user)
    {
        if (!$student && !$user) {
            return true;
        }

        if ($user) {
            $role = strtolower(trim((string)($user['role_name'] ?? '')));
            if ($role !== 'student') {
                return false;
            }
            if ((string)($user['status'] ?? '') === 'Active' && !empty($user['email_verified_at'])) {
                return false;
            }
        }

        if ($student) {
            if ($this->studentHasEnrollmentRecords((int)$student['student_id'])) {
                return false;
            }
            if ((string)($student['status'] ?? '') === 'Active') {
                $summary = $this->getRegistrationSummary((int)$student['student_id']);
                $paid = (float)($summary['registration_fee_paid'] ?? 0);
                $regStatus = (string)($summary['registration_status'] ?? '');
                if ($paid >= 1000 || in_array($regStatus, ['Approved', 'Fee Paid'], true)) {
                    return false;
                }
            }
        }

        return true;
    }

    private function tryReleaseAbandonedOnlineRegistration($email)
    {
        $student = $this->findStudentByRegistrationEmail($email);
        $user = $this->findUserByRegistrationEmail($email);
        if (!$this->canReleaseAbandonedOnlineRegistration($student, $user)) {
            return false;
        }

        try {
            $this->conn->beginTransaction();
            if ($student) {
                $stmtDeleteStudent = $this->conn->prepare("DELETE FROM tbl_students WHERE student_id = ?");
                $stmtDeleteStudent->execute([(int)$student['student_id']]);
            }
            if ($user) {
                $stmtDeleteUser = $this->conn->prepare("DELETE FROM tbl_users WHERE user_id = ?");
                $stmtDeleteUser->execute([(int)$user['user_id']]);
            }
            $this->conn->commit();
            return true;
        } catch (PDOException $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            error_log('tryReleaseAbandonedOnlineRegistration failed: ' . $e->getMessage());
            return false;
        }
    }

    private function buildRegistrationEmailConflictMessage($email, $student, $user)
    {
        $parts = [];
        if ($student) {
            $parts[] = 'tbl_students (student_id ' . (int)$student['student_id'] . ', status ' . ($student['status'] ?? 'Unknown') . ')';
        }
        if ($user) {
            $role = (string)($user['role_name'] ?? 'User');
            $parts[] = 'tbl_users (user_id ' . (int)$user['user_id'] . ', role ' . $role . ', status ' . ($user['status'] ?? 'Unknown') . ')';
        }

        if ($user && strtolower(trim((string)($user['role_name'] ?? ''))) !== 'student') {
            return 'This email is already used by a ' . ($user['role_name'] ?? 'user') . ' account. Please use a different email address.';
        }

        if ($student && $this->studentHasEnrollmentRecords((int)$student['student_id'])) {
            return 'This email belongs to a student who already has enrollments. Please contact the branch desk for help.';
        }

        $where = $parts ? implode(' and ', $parts) : 'the database';
        return 'This email is still stored in ' . $where . '. Delete the student row and the user row (both must be removed), then try again.';
    }

    private function assertEmailAvailableForOnlineRegistration($email)
    {
        $this->tryReleaseAbandonedOnlineRegistration($email);

        $student = $this->findStudentByRegistrationEmail($email);
        $user = $this->findUserByRegistrationEmail($email);

        if ($student) {
            if ((string)($student['status'] ?? '') === 'Active') {
                $summary = $this->getRegistrationSummary((int)$student['student_id']);
                $alreadySettled = ((float)($summary['registration_fee_paid'] ?? 0) >= 1000)
                    || in_array((string)($summary['registration_status'] ?? ''), ['Approved', 'Fee Paid'], true);
                if ($alreadySettled) {
                    $this->sendJSON([
                        'error' => 'This student is already registered. The ₱1,000 registration fee is one-time only and should not be paid again.'
                    ], 400);
                }
            }

            $this->sendJSON([
                'error' => $this->buildRegistrationEmailConflictMessage($email, $student, $user)
            ], 400);
        }

        if ($user) {
            $this->sendJSON([
                'error' => $this->buildRegistrationEmailConflictMessage($email, $student, $user)
            ], 400);
        }
    }

    private function getRegistrationPaidAmount($studentId)
    {
        $stmt = $this->conn->prepare("
            SELECT COALESCE(SUM(amount), 0) AS paid
            FROM tbl_registration_payments
            WHERE student_id = ?
              AND status = 'Paid'
        ");
        $stmt->execute([(int)$studentId]);
        return (float)($stmt->fetchColumn() ?: 0);
    }

    private function hasAnyRegistrationPayment($studentId)
    {
        $stmt = $this->conn->prepare("
            SELECT COUNT(*)
            FROM tbl_registration_payments
            WHERE student_id = ?
              AND status IN ('Pending', 'Paid')
        ");
        $stmt->execute([(int)$studentId]);
        return ((int)$stmt->fetchColumn()) > 0;
    }

    private function hasPendingRegistrationPayment($studentId)
    {
        $stmt = $this->conn->prepare("
            SELECT COUNT(*) FROM tbl_registration_payments
            WHERE student_id = ?
              AND status = 'Pending'
        ");
        $stmt->execute([(int)$studentId]);
        return ((int)$stmt->fetchColumn()) > 0;
    }

    private function getRegistrationSummary($studentId)
    {
        $paid = $this->getRegistrationPaidAmount($studentId);
        $hasPending = $this->hasPendingRegistrationPayment($studentId);
        $studentStatus = 'Inactive';
        $registrationSource = 'online';
        try {
            $this->ensureStudentRegistrationSourceColumn();
            $sourceSql = $this->hasStudentColumn('registration_source')
                ? ', registration_source'
                : '';
            $stmt = $this->conn->prepare("SELECT status{$sourceSql} FROM tbl_students WHERE student_id = ? LIMIT 1");
            $stmt->execute([(int)$studentId]);
            $studentRow = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
            $studentStatus = (string)($studentRow['status'] ?? 'Inactive');
            $registrationSource = strtolower(trim((string)($studentRow['registration_source'] ?? 'online')));
        } catch (PDOException $e) {
            $studentStatus = 'Inactive';
        }
        if ($registrationSource === 'walkin' && $studentStatus === 'Active') {
            return [
                'registration_fee_amount' => 1000.00,
                'registration_fee_paid' => max($paid, 1000.00),
                'registration_status' => 'Approved'
            ];
        }
        if ($studentStatus === 'Rejected') {
            $status = 'Rejected';
        } elseif ($hasPending) {
            $status = 'Pending';
        } elseif ($paid >= 1000 && $studentStatus === 'Active') {
            $status = 'Approved';
        } elseif ($paid >= 1000) {
            $status = 'Fee Paid';
        } else {
            $status = 'Pending';
        }
        return [
            'registration_fee_amount' => 1000.00,
            'registration_fee_paid' => $paid,
            'registration_status' => $status
        ];
    }

    private function isRegistrationProfileComplete($student)
    {
        if (!$student || !is_array($student)) return false;
        $required = [
            'first_name',
            'last_name',
            'email',
            'phone',
            'branch_id',
            'date_of_birth',
            'address'
        ];
        foreach ($required as $field) {
            $val = $student[$field] ?? null;
            if ($val === null || trim((string)$val) === '') return false;
        }
        return true;
    }
    private function storePaymentProofUpload($file, $scope = 'registration')
    {
        if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            return null;
        }
        if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
            throw new Exception('Failed to upload payment proof file.');
        }

        $maxBytes = 5 * 1024 * 1024; // 5MB
        $size = (int)($file['size'] ?? 0);
        if ($size < 1 || $size > $maxBytes) {
            throw new Exception('Payment proof file must be between 1 byte and 5MB.');
        }

        $tmpName = $file['tmp_name'] ?? '';
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            throw new Exception('Invalid uploaded file.');
        }

        $allowedExt = ['jpg', 'jpeg', 'png', 'pdf', 'webp'];
        $originalName = (string)($file['name'] ?? '');
        $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        if (!in_array($ext, $allowedExt, true)) {
            throw new Exception('Payment proof must be JPG, JPEG, PNG, WEBP, or PDF.');
        }

        $baseDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'payment_proofs' . DIRECTORY_SEPARATOR . $scope;
        if (!is_dir($baseDir) && !mkdir($baseDir, 0777, true) && !is_dir($baseDir)) {
            throw new Exception('Unable to create upload directory.');
        }

        $safeName = date('YmdHis') . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
        $targetPath = $baseDir . DIRECTORY_SEPARATOR . $safeName;
        if (!move_uploaded_file($tmpName, $targetPath)) {
            throw new Exception('Unable to save payment proof file.');
        }

        return 'uploads/payment_proofs/' . $scope . '/' . $safeName;
    }

    private function storeVerificationProofUpload($file, $scope = 'age_verification')
    {
        if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            return null;
        }
        if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
            throw new Exception('Failed to upload ID proof file.');
        }

        $maxBytes = 5 * 1024 * 1024;
        $size = (int)($file['size'] ?? 0);
        if ($size < 1 || $size > $maxBytes) {
            throw new Exception('ID proof file must be between 1 byte and 5MB.');
        }

        $tmpName = $file['tmp_name'] ?? '';
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            throw new Exception('Invalid uploaded ID proof file.');
        }

        $allowedExt = ['jpg', 'jpeg', 'png', 'pdf', 'webp'];
        $originalName = (string)($file['name'] ?? '');
        $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        if (!in_array($ext, $allowedExt, true)) {
            throw new Exception('ID proof must be JPG, JPEG, PNG, WEBP, or PDF.');
        }

        $baseDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'payment_proofs' . DIRECTORY_SEPARATOR . $scope;
        if (!is_dir($baseDir) && !mkdir($baseDir, 0777, true) && !is_dir($baseDir)) {
            throw new Exception('Unable to create upload directory.');
        }

        $safeName = date('YmdHis') . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
        $targetPath = $baseDir . DIRECTORY_SEPARATOR . $safeName;
        if (!move_uploaded_file($tmpName, $targetPath)) {
            throw new Exception('Unable to save ID proof file.');
        }
        return 'uploads/payment_proofs/' . $scope . '/' . $safeName;
    }

    public function login($json)
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }
        $data = json_decode($json, true);
        $username = trim((string) ($data['username'] ?? ''));
        $password = $data['password'] ?? '';

        if ($username === '' || $password === '' || $password === null) {
            $this->sendJSON(['error' => 'Username and password are required'], 400);
        }
        try {
            $this->ensureUserVerificationColumns();
            $this->ensureWalkInAccountsSynced();
            $resolvedUsername = $this->resolveWalkInLoginIdentifier($username);
            $loginCandidates = array_values(array_unique(array_filter([
                $username,
                $resolvedUsername
            ], static function ($value) {
                return trim((string)$value) !== '';
            })));
            $hasUserBranch = $this->hasUserColumn('branch_id');
            $hasVerificationColumns = $this->hasUserColumn('email_verified_at');
            $selectBranch = $hasUserBranch ? ", u.branch_id, b.branch_name" : "";
            $selectVerification = $hasVerificationColumns ? ", u.email_verified_at" : ", NULL AS email_verified_at";
            $joinBranch = $hasUserBranch ? " LEFT JOIN tbl_branches b ON b.branch_id = u.branch_id " : "";
            // First check if user exists and get status
            $stmt = $this->conn->prepare("
                SELECT u.user_id, u.username, u.password, u.first_name, u.last_name,
                       u.email, u.phone, u.status, r.role_name{$selectBranch}{$selectVerification}
                FROM tbl_users u
                INNER JOIN tbl_roles r ON u.role_id = r.role_id
                {$joinBranch}
                WHERE u.username = ? OR u.email = ? OR u.username = ? OR u.email = ?
                LIMIT 1
            ");
            $primaryLogin = $loginCandidates[0];
            $secondaryLogin = $loginCandidates[1] ?? $primaryLogin;
            $stmt->execute([$primaryLogin, $primaryLogin, $secondaryLogin, $secondaryLogin]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                $this->sendJSON(['error' => 'Invalid username or password'], 401);
            }

            // Accept modern hashes and legacy plaintext records.
            $storedPassword = (string) ($user['password'] ?? '');
            $isPasswordValid = password_verify($password, $storedPassword)
                || hash_equals($storedPassword, $password);

            if (!$isPasswordValid) {
                $this->sendJSON(['error' => 'Invalid username or password'], 401);
            }

            $isWalkInAccount = $this->isWalkInSystemEmail($user['email'] ?? '')
                || $this->isWalkInSystemEmail($user['username'] ?? '');
            if (
                empty($user['email_verified_at'])
                && strcasecmp((string)($user['role_name'] ?? ''), 'Admin') !== 0
                && !$isWalkInAccount
            ) {
                $this->sendJSON([
                    'error' => 'Please verify your email address before logging in. Check your inbox for the verification code.',
                    'verification_required' => true,
                    'verification_email' => $user['email'] ?? $username
                ], 403);
            }

            // Check if account is active
            if ($user['status'] !== 'Active') {
                $this->sendJSON(['error' => 'Your account was deactivated. Please contact the administrator.'], 403);
            }

            // Detect default/temporary passwords for non-admin roles (first-login change requirement)
            $mustChangePassword = false;
            $roleName = (string)($user['role_name'] ?? '');
            $defaultPasswords = ['fas@123', 'fasmusic@2020', 'fasmusic2020'];
            $isDefaultPassword = false;
            foreach ($defaultPasswords as $defaultPwd) {
                if (password_verify($defaultPwd, $storedPassword) || hash_equals($storedPassword, $defaultPwd)) {
                    $isDefaultPassword = true;
                    break;
                }
            }
            if ($isDefaultPassword && strcasecmp($roleName, 'Admin') !== 0) {
                $mustChangePassword = true;
            }

            unset($user['password']);
            $this->sendJSON([
                'success' => true,
                'message' => 'Login successful',
                'user' => $user,
                'must_change_password' => $mustChangePassword
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function verifyEmail($json)
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode($json, true);
        if (!is_array($data)) {
            $this->sendJSON(['error' => 'Invalid request data'], 400);
        }

        $email = trim((string)($data['email'] ?? $data['username'] ?? ''));
        $code = trim((string)($data['code'] ?? ''));

        if ($email === '' || $code === '') {
            $this->sendJSON(['error' => 'Email and verification code are required'], 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->sendJSON(['error' => 'Invalid email address format'], 400);
        }

        if (!preg_match('/^\d{6}$/', $code)) {
            $this->sendJSON(['error' => 'Verification code must be a 6-digit number'], 400);
        }

        try {
            $this->ensureUserVerificationColumns();
            $stmt = $this->conn->prepare("
                SELECT user_id, first_name, last_name, email, status,
                       email_verified_at, email_verification_code_hash, email_verification_code_expires_at
                FROM tbl_users
                WHERE email = ? OR username = ?
                LIMIT 1
            ");
            $stmt->execute([$email, $email]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                $this->sendJSON(['error' => 'Account not found'], 404);
            }

            if (!empty($user['email_verified_at'])) {
                $this->sendJSON([
                    'success' => true,
                    'message' => 'Your email is already verified.'
                ]);
            }

            $storedHash = (string)($user['email_verification_code_hash'] ?? '');
            $expiresAt = (string)($user['email_verification_code_expires_at'] ?? '');

            if ($storedHash === '' || $expiresAt === '') {
                $this->sendJSON([
                    'error' => 'No verification code is available for this account. Please resend the code.',
                    'resend_required' => true,
                    'verification_email' => $user['email']
                ], 400);
            }

            if (strtotime($expiresAt) < time()) {
                $this->sendJSON([
                    'error' => 'Your verification code has expired. Please resend a new code.',
                    'resend_required' => true,
                    'verification_email' => $user['email']
                ], 400);
            }

            if (!password_verify($code, $storedHash)) {
                $this->sendJSON([
                    'error' => 'Invalid verification code. Please try again.',
                    'verification_required' => true,
                    'verification_email' => $user['email']
                ], 400);
            }

            $update = $this->conn->prepare("
                UPDATE tbl_users
                SET status = 'Active',
                    email_verified_at = NOW(),
                    email_verification_code_hash = NULL,
                    email_verification_code_expires_at = NULL,
                    email_verification_sent_at = NULL
                WHERE user_id = ?
            ");
            $update->execute([(int)$user['user_id']]);

            // ── Send welcome email (non-blocking — failure doesn't stop success response) ──
            $firstName  = trim((string)($user['first_name'] ?? ''));
            $lastName   = trim((string)($user['last_name']  ?? ''));
            $displayName = trim("$firstName $lastName") ?: ($user['email'] ?? $email);
            $this->sendWelcomeEmail($user['email'] ?? $email, $displayName);

            $this->sendJSON([
                'success' => true,
                'message' => 'Email verified successfully. You can now log in.'
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function resendEmailVerification($json)
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode($json, true);
        if (!is_array($data)) {
            $this->sendJSON(['error' => 'Invalid request data'], 400);
        }

        $email = trim((string)($data['email'] ?? $data['username'] ?? ''));
        if ($email === '') {
            $this->sendJSON(['error' => 'Email is required'], 400);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->sendJSON(['error' => 'Invalid email address format'], 400);
        }

        try {
            $this->ensureUserVerificationColumns();
            $stmt = $this->conn->prepare("
                SELECT user_id, first_name, last_name, email, status, email_verified_at
                FROM tbl_users
                WHERE email = ? OR username = ?
                LIMIT 1
            ");
            $stmt->execute([$email, $email]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                $this->sendJSON(['error' => 'Account not found'], 404);
            }

            if (!empty($user['email_verified_at'])) {
                $this->sendJSON([
                    'success' => true,
                    'message' => 'Your email is already verified.'
                ]);
            }

            $verificationResult = $this->issueEmailVerificationCode(
                (int)$user['user_id'],
                $user['email'],
                trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''))
            );

            $mailConfigured = $this->isMailConfigured();
            $emailSent = (bool)($verificationResult['email_sent'] ?? false);
            $message = $emailSent
                ? 'A new verification code has been sent to your email.'
                : ($mailConfigured
                    ? 'A new code was generated, but email delivery failed. Try again or contact support.'
                    : 'A new verification code is ready. Email is not configured on the server.');

            $this->sendJSON([
                'success' => true,
                'message' => $message,
                'verification_email' => $user['email'],
                'verification_email_sent' => $emailSent,
                'mail_error' => $verificationResult['mail_error'] ?? null
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        } catch (Exception $e) {
            $this->sendJSON(['error' => 'Verification email could not be sent: ' . $e->getMessage()], 500);
        }
    }

    public function resetRejectedRegistration($json)
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode($json, true) ?: [];
        $studentId = (int)($data['student_id'] ?? 0);
        if ($studentId < 1) {
            $this->sendJSON(['error' => 'Student ID is required'], 400);
        }

        try {
            $this->ensureStudentRegistrationProofColumn();
            $this->ensureStudentAgeVerificationProofColumn();
            $this->conn->beginTransaction();

            $stmt = $this->conn->prepare("SELECT student_id, status FROM tbl_students WHERE student_id = ? LIMIT 1");
            $stmt->execute([$studentId]);
            $student = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$student) {
                throw new Exception('Student not found');
            }
            if (($student['status'] ?? '') !== 'Rejected') {
                throw new Exception('This registration is not marked as rejected');
            }

            $stmtDeletePayments = $this->conn->prepare("DELETE FROM tbl_registration_payments WHERE student_id = ?");
            $stmtDeletePayments->execute([$studentId]);

            $updateParts = ["status = 'Inactive'"];
            if ($this->hasStudentColumn('registration_proof_path')) {
                $updateParts[] = "registration_proof_path = NULL";
            }
            if ($this->hasStudentColumn('age_verification_proof_path')) {
                $updateParts[] = "age_verification_proof_path = NULL";
            }
            if ($this->hasStudentColumn('registration_fee_paid')) {
                $updateParts[] = "registration_fee_paid = 0";
            }

            $stmtReset = $this->conn->prepare("
                UPDATE tbl_students
                SET " . implode(', ', $updateParts) . "
                WHERE student_id = ?
            ");
            $stmtReset->execute([$studentId]);

            $this->conn->commit();
            $this->sendJSON([
                'success' => true,
                'message' => 'Registration reset. You can submit your registration again.'
            ]);
        } catch (Exception $e) {
            if ($this->conn && $this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            $this->sendJSON(['error' => $e->getMessage()], 500);
        }
    }

    public function updateSelfProfile($json)
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode($json, true);
        if (!is_array($data)) {
            $this->sendJSON(['error' => 'Invalid payload'], 400);
        }

        $userId = (int)($data['user_id'] ?? 0);
        $firstName = trim((string)($data['first_name'] ?? ''));
        $lastName = trim((string)($data['last_name'] ?? ''));
        $phone = trim((string)($data['phone'] ?? ''));

        if ($userId <= 0 || $firstName === '' || $lastName === '') {
            $this->sendJSON(['error' => 'user_id, first_name, and last_name are required'], 400);
        }

        try {
            $stmt = $this->conn->prepare("
                SELECT u.user_id, u.email, u.username, u.first_name, u.last_name, u.phone, u.status,
                       r.role_name
                FROM tbl_users u
                INNER JOIN tbl_roles r ON u.role_id = r.role_id
                WHERE u.user_id = ?
                LIMIT 1
            ");
            $stmt->execute([$userId]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$existing) {
                $this->sendJSON(['error' => 'User not found'], 404);
            }

            $update = $this->conn->prepare("
                UPDATE tbl_users
                SET first_name = ?, last_name = ?, phone = ?
                WHERE user_id = ?
            ");
            $update->execute([$firstName, $lastName, $phone, $userId]);

            $hasUserBranch = $this->hasUserColumn('branch_id');
            $selectBranch = $hasUserBranch ? ', u.branch_id, b.branch_name' : '';
            $joinBranch = $hasUserBranch ? ' LEFT JOIN tbl_branches b ON b.branch_id = u.branch_id ' : '';
            $stmtUser = $this->conn->prepare("
                SELECT u.user_id, u.username, u.first_name, u.last_name, u.email, u.phone, u.status, r.role_name{$selectBranch}
                FROM tbl_users u
                INNER JOIN tbl_roles r ON u.role_id = r.role_id
                {$joinBranch}
                WHERE u.user_id = ?
                LIMIT 1
            ");
            $stmtUser->execute([$userId]);
            $user = $stmtUser->fetch(PDO::FETCH_ASSOC);

            $this->sendJSON([
                'success' => true,
                'message' => 'Profile updated successfully.',
                'user' => $user
            ]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function changePassword($json)
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode($json, true);
        $userId = $data['user_id'] ?? null;
        $oldPassword = $data['old_password'] ?? '';
        $newPassword = $data['new_password'] ?? '';
        $isAdminOverride = !empty($data['is_admin_override']);

        if (empty($userId) || empty($newPassword) || (!$isAdminOverride && empty($oldPassword))) {
            $this->sendJSON(['error' => 'user_id and new_password are required'], 400);
        }

        try {
            $stmt = $this->conn->prepare("SELECT user_id, password FROM tbl_users WHERE user_id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                $this->sendJSON(['error' => 'User not found'], 404);
            }

            if (!$isAdminOverride) {
                $storedPassword = (string) ($user['password'] ?? '');
                $isOldPasswordValid = password_verify($oldPassword, $storedPassword)
                    || hash_equals($storedPassword, $oldPassword);

                if (!$isOldPasswordValid) {
                    $this->sendJSON(['error' => 'Current password is incorrect'], 400);
                }
            }

            if ($isAdminOverride) {
                if (strlen($newPassword) < 6) {
                    $this->sendJSON(['error' => 'New password must be at least 6 characters long'], 400);
                }
            } else {
                // Validate new password with same strong policy as registration
                if (strlen($newPassword) < 8) {
                    $this->sendJSON(['error' => 'New password must be at least 8 characters long'], 400);
                }
                if (!preg_match('/[A-Z]/', $newPassword)) {
                    $this->sendJSON(['error' => 'New password must contain at least one uppercase letter'], 400);
                }
                if (!preg_match('/[a-z]/', $newPassword)) {
                    $this->sendJSON(['error' => 'New password must contain at least one lowercase letter'], 400);
                }
                if (!preg_match('/[0-9]/', $newPassword)) {
                    $this->sendJSON(['error' => 'New password must contain at least one number'], 400);
                }
                if (!preg_match('/[!@#$%^&*]/', $newPassword)) {
                    $this->sendJSON(['error' => 'New password must contain at least one special character (!@#$%^&*)'], 400);
                }
            }

            $hashed = password_hash($newPassword, PASSWORD_DEFAULT);
            $update = $this->conn->prepare("UPDATE tbl_users SET password = ? WHERE user_id = ?");
            $update->execute([$hashed, $userId]);

            $this->sendJSON(['success' => true, 'message' => 'Password changed successfully']);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function registerBasic($json)
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $data = json_decode($json, true);
        if (!is_array($data)) {
            $this->sendJSON(['error' => 'Invalid request data'], 400);
        }

        foreach (['student_first_name', 'student_last_name', 'student_email', 'student_phone', 'branch_id', 'student_date_of_birth'] as $k) {
            if (isset($data[$k]) && is_string($data[$k])) {
                $data[$k] = trim($data[$k]);
            }
        }

        $required = ['student_first_name', 'student_last_name', 'student_email', 'student_phone', 'branch_id', 'password'];
        $labels = [
            'student_first_name' => 'First Name',
            'student_last_name' => 'Last Name',
            'student_email' => 'Email',
            'student_phone' => 'Phone',
            'branch_id' => 'Branch',
            'password' => 'Password'
        ];
        foreach ($required as $field) {
            $val = $data[$field] ?? '';
            if ($val === '' || $val === null) {
                $label = $labels[$field] ?? $field;
                $this->sendJSON(['error' => ucfirst($label) . ' is required'], 400);
            }
        }

        $email = trim((string)($data['student_email'] ?? ''));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->sendJSON(['error' => 'Invalid email address format'], 400);
        }
        if (strlen($email) > 254) {
            $this->sendJSON(['error' => 'Email address is too long (max 254 characters)'], 400);
        }

        $dateOfBirth = trim((string)($data['student_date_of_birth'] ?? ''));
        $age = $this->calculateAgeFromDateOfBirth($dateOfBirth);

        $password = (string)($data['password'] ?? '');
        if (strlen($password) < 8) {
            $this->sendJSON(['error' => 'Password must be at least 8 characters long'], 400);
        }
        if (!preg_match('/[A-Z]/', $password)) {
            $this->sendJSON(['error' => 'Password must contain at least one uppercase letter'], 400);
        }
        if (!preg_match('/[a-z]/', $password)) {
            $this->sendJSON(['error' => 'Password must contain at least one lowercase letter'], 400);
        }
        if (!preg_match('/[0-9]/', $password)) {
            $this->sendJSON(['error' => 'Password must contain at least one number'], 400);
        }
        if (!preg_match('/[!@#$%^&*]/', $password)) {
            $this->sendJSON(['error' => 'Password must contain at least one special character (!@#$%^&*)'], 400);
        }

        try {
            $this->ensureUserVerificationColumns();
            $this->assertEmailAvailableForOnlineRegistration($email);

            $this->conn->beginTransaction();

            $roleStmt = $this->conn->prepare("SELECT role_id FROM tbl_roles WHERE role_name = 'Student' LIMIT 1");
            $roleStmt->execute();
            $role = $roleStmt->fetch(PDO::FETCH_ASSOC);
            if (!$role) throw new Exception("Student role not found");
            $roleId = (int)$role['role_id'];

            $studentColumns = ['branch_id', 'first_name', 'last_name', 'phone', 'email', 'status'];
            $studentValues = [
                (int)$data['branch_id'],
                $data['student_first_name'],
                $data['student_last_name'],
                $data['student_phone'],
                $email,
                'Inactive'
            ];
            if ($this->hasStudentColumn('date_of_birth')) {
                $studentColumns[] = 'date_of_birth';
                $studentValues[] = $dateOfBirth;
            }
            if ($this->hasStudentColumn('age')) {
                $studentColumns[] = 'age';
                $studentValues[] = $age;
            }

            $studentPlaceholders = implode(', ', array_fill(0, count($studentColumns), '?'));
            $stmtStudent = $this->conn->prepare("
                INSERT INTO tbl_students (" . implode(', ', $studentColumns) . ")
                VALUES ({$studentPlaceholders})
            ");
            $stmtStudent->execute($studentValues);
            $studentId = (int)$this->conn->lastInsertId();

            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
            $stmtUser = $this->conn->prepare("
                INSERT INTO tbl_users (
                    username, password, role_id, first_name, last_name, email, phone, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Inactive')
            ");
            $stmtUser->execute([
                $email,
                $hashedPassword,
                $roleId,
                $data['student_first_name'],
                $data['student_last_name'],
                $email,
                $data['student_phone']
            ]);
            $userId = (int)$this->conn->lastInsertId();

            $verificationResult = $this->issueEmailVerificationCode(
                $userId,
                $email,
                trim(($data['student_first_name'] ?? '') . ' ' . ($data['student_last_name'] ?? ''))
            );

            if (!(bool)($verificationResult['email_sent'] ?? false)) {
                throw new Exception($verificationResult['mail_error'] ?? 'Verification email could not be sent.');
            }

            $this->conn->commit();

            $mailConfigured = $this->isMailConfigured();
            $emailSent = (bool)($verificationResult['email_sent'] ?? false);
            $message = $emailSent
                ? 'Account created successfully. Please check your email for the verification code.'
                : ($mailConfigured
                    ? 'Account created, but the verification email could not be sent. Use Resend code or contact the branch.'
                    : 'Account created successfully. Email is not configured on the server yet.');

            $this->sendJSON([
                'success' => true,
                'message' => $message,
                'student_id' => $studentId,
                'user_id' => $userId,
                'verification_required' => true,
                'verification_email' => $email,
                'verification_email_sent' => $emailSent,
                'mail_error' => $verificationResult['mail_error'] ?? null
            ]);
        } catch (PDOException $e) {
            if ($this->conn && $this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            if ($e->getCode() == 23000 && (strpos($e->getMessage(), 'Duplicate entry') !== false || strpos($e->getMessage(), 'username') !== false || strpos($e->getMessage(), 'email') !== false)) {
                $this->sendJSON(['error' => 'This email is already registered. Please use a different email address.'], 400);
            }
            $this->sendJSON(['error' => 'Registration failed: ' . $e->getMessage()], 500);
        } catch (Exception $e) {
            if ($this->conn && $this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            $this->sendJSON(['error' => 'Registration failed: ' . $e->getMessage()], 500);
        }
    }

    private function isWalkInRegistrationRequest(array $data)
    {
        if (filter_var(($data['is_walkin'] ?? false), FILTER_VALIDATE_BOOLEAN)) {
            return true;
        }
        $registrationSource = strtolower(trim((string)($data['registration_source'] ?? '')));
        return in_array($registrationSource, ['admin', 'walkin', 'staff', 'manager'], true);
    }

    /**
     * Branch walk-in registration only (no PHPMailer / email verification).
     * Called from api/walkin_register.php — not from users.php?action=register.
     */
    public function registerWalkIn($json)
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $isMultipart = $this->isMultipartRequest();
        $data = $isMultipart ? $_POST : json_decode($json, true);
        if (!is_array($data)) {
            $this->sendJSON(['error' => 'Invalid request data'], 400);
        }

        foreach (['student_first_name', 'student_last_name', 'student_email', 'student_phone', 'branch_id',
                  'guardian_first_name', 'guardian_last_name', 'guardian_relationship', 'guardian_phone'] as $k) {
            if (isset($data[$k]) && is_string($data[$k])) {
                $data[$k] = trim($data[$k]);
            }
        }

        $registrationSource = strtolower(trim((string)($data['registration_source'] ?? 'walkin')));
        if (!in_array($registrationSource, ['admin', 'walkin', 'staff', 'manager'], true)) {
            $registrationSource = 'walkin';
        }

        $deskBranchId = (int)($data['desk_branch_id'] ?? 0);
        $managerBranchId = (int)($data['manager_branch_id'] ?? 0);
        $scopedBranchId = $deskBranchId > 0 ? $deskBranchId : $managerBranchId;
        $requestedBranchId = (int)($data['branch_id'] ?? 0);
        if ($scopedBranchId > 0 && $requestedBranchId > 0 && $scopedBranchId !== $requestedBranchId) {
            $this->sendJSON(['error' => 'Selected branch does not belong to your assigned branch'], 403);
        }

        $submittedEmailRaw = trim((string)($data['student_email'] ?? ''));
        if ($submittedEmailRaw === '') {
            $this->sendJSON(['error' => 'Please enter a login name for this walk-in student.'], 400);
        }
        if (strpos($submittedEmailRaw, '@') !== false) {
            $this->sendJSON(['error' => 'Walk-in registrations only accept a name or username, not a real email address.'], 400);
        }

        $loginEmail = $this->buildWalkInLoginEmail(
            $submittedEmailRaw,
            $data['student_first_name'] ?? '',
            $data['student_last_name'] ?? ''
        );
        if ($loginEmail === null) {
            $this->sendJSON(['error' => 'That walk-in name is already in use. Please choose another name.'], 400);
        }
        $data['student_email'] = $loginEmail;

        foreach (['student_first_name', 'student_last_name', 'student_phone', 'branch_id', 'student_date_of_birth'] as $field) {
            if (($data[$field] ?? '') === '') {
                $this->sendJSON(['error' => ucfirst(str_replace('_', ' ', $field)) . ' is required'], 400);
            }
        }

        $dateOfBirth = $data['student_date_of_birth'] ?? null;
        $age = $this->assertMinimumStudentAge($dateOfBirth, 'register or enroll');
        $isMinor = ($age !== null) && ($age <= 18);
        if ($isMinor) {
            foreach (['guardian_first_name', 'guardian_last_name', 'guardian_relationship', 'guardian_phone'] as $field) {
                if (($data[$field] ?? '') === '') {
                    $this->sendJSON(['error' => 'Guardian information is required for students aged 18 and below.'], 400);
                }
            }
        }

        $password = 'fas@123';
        $data['registration_fee_amount'] = 1000;

        try {
            $this->ensureStudentRegistrationProofColumn();
            $this->ensureStudentAgeVerificationProofColumn();
            $this->ensureStudentRegistrationSourceColumn();
            $this->conn->beginTransaction();

            $roleStmt = $this->conn->prepare("SELECT role_id FROM tbl_roles WHERE role_name = 'Student' LIMIT 1");
            $roleStmt->execute();
            $role = $roleStmt->fetch(PDO::FETCH_ASSOC);
            if (!$role) {
                throw new Exception('Student role not found');
            }
            $roleId = (int)$role['role_id'];

            $guardianRoleId = null;
            $guardianRoleStmt = $this->conn->prepare("SELECT role_id FROM tbl_roles WHERE role_name = 'Guardians' LIMIT 1");
            $guardianRoleStmt->execute();
            $guardianRole = $guardianRoleStmt->fetch(PDO::FETCH_ASSOC);
            if ($guardianRole && isset($guardianRole['role_id'])) {
                $guardianRoleId = (int)$guardianRole['role_id'];
            }

            $hasSessionPackageCol = $this->hasStudentColumn('session_package_id');
            $studentColumns = [
                'branch_id', 'first_name', 'last_name', 'middle_name', 'date_of_birth',
                'age', 'phone', 'email', 'address', 'school', 'grade_year', 'health_diagnosis',
                'status'
            ];
            $studentValues = [
                $data['branch_id'],
                $data['student_first_name'],
                $data['student_last_name'],
                $data['student_middle_name'] ?? null,
                $data['student_date_of_birth'] ?? null,
                $age ?? $data['student_age'] ?? null,
                $data['student_phone'],
                $data['student_email'],
                $data['student_address'] ?? null,
                $data['student_school'] ?? null,
                $data['student_grade_year'] ?? null,
                $data['student_health_diagnosis'] ?? null,
                'Active'
            ];
            if ($this->hasStudentColumn('registration_source')) {
                $studentColumns[] = 'registration_source';
                $studentValues[] = 'walkin';
            }
            if ($hasSessionPackageCol) {
                $studentColumns[] = 'session_package_id';
                $studentValues[] = $data['session_package_id'] ?? null;
            }

            $studentPlaceholders = implode(',', array_fill(0, count($studentColumns), '?'));
            $stmtStudent = $this->conn->prepare("
                INSERT INTO tbl_students (" . implode(', ', $studentColumns) . ")
                VALUES ({$studentPlaceholders})
            ");
            $stmtStudent->execute($studentValues);
            $studentId = (int)$this->conn->lastInsertId();

            $stmtRegPayment = $this->conn->prepare("
                INSERT INTO tbl_registration_payments (
                    student_id, payment_date, amount, payment_method, status, receipt_number
                ) VALUES (?, CURRENT_DATE, 1000.00, 'Walk-In', 'Paid', ?)
            ");
            $stmtRegPayment->execute([$studentId, 'REG-WALKIN-' . time()]);

            $guardianId = null;
            $guardianUsername = null;
            $hasGuardianData = !empty($data['guardian_first_name']) && !empty($data['guardian_last_name'])
                && !empty($data['guardian_relationship']) && !empty($data['guardian_phone']);

            if ($hasGuardianData) {
                $stmtGuardian = $this->conn->prepare("
                    INSERT INTO tbl_guardians (
                        first_name, last_name, relationship_type, phone,
                        occupation, email, address, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
                ");
                $stmtGuardian->execute([
                    $data['guardian_first_name'],
                    $data['guardian_last_name'],
                    $data['guardian_relationship'],
                    $data['guardian_phone'],
                    $data['guardian_occupation'] ?? null,
                    $data['guardian_email'] ?? null,
                    $data['guardian_address'] ?? null
                ]);
                $guardianId = (int)$this->conn->lastInsertId();

                $stmtLink = $this->conn->prepare("
                    INSERT INTO tbl_student_guardians (
                        student_id, guardian_id, is_primary_guardian,
                        can_enroll, can_pay, emergency_contact
                    ) VALUES (?, ?, 'Y', 'Y', 'Y', 'Y')
                ");
                $stmtLink->execute([$studentId, $guardianId]);
            }

            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
            $stmtUser = $this->conn->prepare("
                INSERT INTO tbl_users (
                    username, password, role_id, first_name, last_name,
                    email, phone, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
            ");
            $stmtUser->execute([
                $data['student_email'],
                $hashedPassword,
                $roleId,
                $data['student_first_name'],
                $data['student_last_name'],
                $data['student_email'],
                $data['student_phone']
            ]);
            $userId = (int)$this->conn->lastInsertId();

            if ($this->hasUserColumn('email_verified_at')) {
                $stmtVerifyUser = $this->conn->prepare("
                    UPDATE tbl_users
                    SET email_verified_at = NOW(),
                        email_verification_code_hash = NULL,
                        email_verification_code_expires_at = NULL,
                        email_verification_sent_at = NULL
                    WHERE user_id = ?
                ");
                $stmtVerifyUser->execute([$userId]);
            }

            $guardianEmail = trim((string)($data['guardian_email'] ?? ''));
            if ($guardianId && $guardianEmail !== '' && $guardianRoleId) {
                $guardianExistsStmt = $this->conn->prepare("SELECT user_id FROM tbl_users WHERE username = ? OR email = ? LIMIT 1");
                $guardianExistsStmt->execute([$guardianEmail, $guardianEmail]);
                if (!$guardianExistsStmt->fetch()) {
                    $guardianHashedPassword = password_hash('fasmusic@2020', PASSWORD_DEFAULT);
                    $stmtGuardianUser = $this->conn->prepare("
                        INSERT INTO tbl_users (
                            username, password, role_id, first_name, last_name,
                            email, phone, status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
                    ");
                    $stmtGuardianUser->execute([
                        $guardianEmail,
                        $guardianHashedPassword,
                        $guardianRoleId,
                        $data['guardian_first_name'] ?? 'Guardian',
                        $data['guardian_last_name'] ?? '',
                        $guardianEmail,
                        $data['guardian_phone'] ?? null
                    ]);
                    $guardianUserId = (int)$this->conn->lastInsertId();
                    $guardianUsername = $guardianEmail;
                    if ($this->hasUserColumn('email_verified_at')) {
                        $stmtVerifyGuardian = $this->conn->prepare("
                            UPDATE tbl_users
                            SET email_verified_at = NOW(),
                                email_verification_code_hash = NULL,
                                email_verification_code_expires_at = NULL,
                                email_verification_sent_at = NULL
                            WHERE user_id = ?
                        ");
                        $stmtVerifyGuardian->execute([$guardianUserId]);
                    }
                }
            }

            if (!empty($data['instruments']) && is_array($data['instruments'])) {
                $stmtInstrument = $this->conn->prepare("
                    INSERT INTO tbl_student_instruments (student_id, instrument_id, priority_order)
                    VALUES (?, ?, ?)
                ");
                foreach ($data['instruments'] as $index => $instrumentId) {
                    $stmtInstrument->execute([$studentId, $instrumentId, $index + 1]);
                }
            }

            $this->conn->commit();
            $this->ensureWalkInAccountsSynced();

            $this->sendJSON([
                'success' => true,
                'message' => 'Student registered successfully. Account is active and can log in immediately.',
                'student_id' => $studentId,
                'guardian_id' => $guardianId,
                'guardian_username' => $guardianUsername,
                'user_id' => $userId,
                'username' => $data['student_email'],
                'login_email' => $data['student_email'],
                'walkin_login_generated' => true,
                'registration_status' => 'Approved',
                'registration_fee_amount' => $data['registration_fee_amount'],
                'account_status' => 'Active - Can log in'
            ]);
        } catch (PDOException $e) {
            if ($this->conn && $this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            if ($e->getCode() == 23000) {
                $this->sendJSON(['error' => 'That walk-in login name is already in use. Please choose another name.'], 400);
            }
            $this->sendJSON(['error' => 'Walk-in registration failed: ' . $e->getMessage()], 500);
        } catch (Exception $e) {
            if ($this->conn && $this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            $this->sendJSON(['error' => 'Walk-in registration failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Online self-registration only (real email, proofs, PHPMailer verification).
     */
    public function register($json)
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $isMultipart = $this->isMultipartRequest();
        $data = $isMultipart ? $_POST : json_decode($json, true);
        if (!is_array($data)) {
            $this->sendJSON(['error' => 'Invalid request data'], 400);
        }

        // Normalize string fields (trim)
        foreach (['student_first_name', 'student_last_name', 'student_email', 'student_phone', 'branch_id',
                  'guardian_first_name', 'guardian_last_name', 'guardian_relationship', 'guardian_phone'] as $k) {
            if (isset($data[$k]) && is_string($data[$k])) {
                $data[$k] = trim($data[$k]);
            }
        }

        if ($this->isWalkInRegistrationRequest($data)) {
            $this->sendJSON([
                'error' => 'Walk-in registration must use walkin_register.php. Use users.php only for online registration.'
            ], 400);
        }

        $registrationSource = strtolower(trim((string)($data['registration_source'] ?? 'public')));
        if (!in_array($registrationSource, ['public', 'online'], true)) {
            $registrationSource = 'online';
        }
        $studentRegistrationSource = 'online';
        $isAdminRegistration = false;
        $submittedEmail = trim((string)($data['student_email'] ?? ''));

        $required = ['student_first_name', 'student_last_name', 'student_email', 'student_phone', 'branch_id'];
        $fieldLabels = [
            'student_first_name' => 'First Name',
            'student_last_name' => 'Last Name',
            'student_email' => 'Email',
            'student_phone' => 'Phone',
            'branch_id' => 'Branch'
        ];

        foreach ($required as $field) {
            $val = $data[$field] ?? '';
            if ($val === '' || $val === null) {
                $label = $fieldLabels[$field] ?? $field;
                $this->sendJSON(['error' => ucfirst($label) . ' is required'], 400);
            }
        }

        if (!filter_var($submittedEmail, FILTER_VALIDATE_EMAIL)) {
            $this->sendJSON(['error' => 'Invalid email address format'], 400);
        }
        if (strlen($submittedEmail) > 254) {
            $this->sendJSON(['error' => 'Email address is too long (max 254 characters)'], 400);
        }

        // Calculate age from date_of_birth for guardian requirement
        $dateOfBirth = $data['student_date_of_birth'] ?? null;
        $age = null;
        if (!empty($dateOfBirth)) {
            $dob = new DateTime($dateOfBirth);
            $now = new DateTime();
            $age = $now->diff($dob)->y;
        }
        $isMinor = ($age !== null) && ($age <= 18); // Guardian required only for 18 and below

        // Guardian required only for students aged 18 and below
        if ($isMinor) {
            $guardianLabels = [
                'guardian_first_name' => 'Guardian First Name',
                'guardian_last_name' => 'Guardian Last Name',
                'guardian_relationship' => 'Guardian Relationship',
                'guardian_phone' => 'Guardian Phone'
            ];
            foreach (['guardian_first_name', 'guardian_last_name', 'guardian_relationship', 'guardian_phone'] as $field) {
                $val = $data[$field] ?? '';
                if ($val === '' || $val === null) {
                    $label = $guardianLabels[$field] ?? $field;
                    $this->sendJSON(['error' => 'Guardian information is required for students aged 18 and below. Please fill in ' . $label . '.'], 400);
                }
            }
        }

        $email = $submittedEmail;
        $data['student_email'] = $email;
        $this->ensureStudentRegistrationColumns();
        $this->assertEmailAvailableForOnlineRegistration($email);

        if (empty($data['password'])) {
            $this->sendJSON(['error' => 'Password is required'], 400);
        }
        $password = $data['password'];
        if (strlen($password) < 8) {
            $this->sendJSON(['error' => 'Password must be at least 8 characters long'], 400);
        }
        if (!preg_match('/[A-Z]/', $password)) {
            $this->sendJSON(['error' => 'Password must contain at least one uppercase letter'], 400);
        }
        if (!preg_match('/[a-z]/', $password)) {
            $this->sendJSON(['error' => 'Password must contain at least one lowercase letter'], 400);
        }
        if (!preg_match('/[0-9]/', $password)) {
            $this->sendJSON(['error' => 'Password must contain at least one number'], 400);
        }
        if (!preg_match('/[!@#$%^&*]/', $password)) {
            $this->sendJSON(['error' => 'Password must contain at least one special character (!@#$%^&*)'], 400);
        }

        // Initial registration fee is fixed.
        $data['registration_fee_amount'] = 1000;

        $registrationProofPath = null;
        $ageVerificationProofPath = null;
        if ($isMultipart && isset($_FILES['registration_proof_file'])) {
            try {
                $registrationProofPath = $this->storePaymentProofUpload($_FILES['registration_proof_file'], 'registration');
            } catch (Exception $e) {
                $this->sendJSON(['error' => $e->getMessage()], 400);
            }
        }
        if ($isMultipart && isset($_FILES['age_verification_proof_file'])) {
            try {
                $ageVerificationProofPath = $this->storeVerificationProofUpload($_FILES['age_verification_proof_file'], 'age_verification');
            } catch (Exception $e) {
                $this->sendJSON(['error' => $e->getMessage()], 400);
            }
        }
        if (empty($registrationProofPath)) {
            $this->sendJSON(['error' => 'Registration payment proof is required.'], 400);
        }
        if (empty($ageVerificationProofPath)) {
            $this->sendJSON(['error' => 'Proof ID is required for online registration age verification.'], 400);
        }

        try {
            $this->ensureStudentRegistrationProofColumn();
            $this->ensureStudentAgeVerificationProofColumn();
            $this->ensureStudentRegistrationColumns();
            $this->ensureStudentRegistrationSourceColumn();
            $this->conn->beginTransaction();

            // Get default role for students
            $roleStmt = $this->conn->prepare("SELECT role_id FROM tbl_roles WHERE role_name = 'Student' LIMIT 1");
            $roleStmt->execute();
            $role = $roleStmt->fetch(PDO::FETCH_ASSOC);

            if (!$role) throw new Exception("Student role not found");

            $roleId = $role['role_id'];
            $guardianRoleId = null;
            $guardianRoleStmt = $this->conn->prepare("SELECT role_id FROM tbl_roles WHERE role_name = 'Guardians' LIMIT 1");
            $guardianRoleStmt->execute();
            $guardianRole = $guardianRoleStmt->fetch(PDO::FETCH_ASSOC);
            if ($guardianRole && isset($guardianRole['role_id'])) {
                $guardianRoleId = (int) $guardianRole['role_id'];
            }

            // Insert Student (schema-aware)
            $hasSessionPackageCol = $this->hasStudentColumn('session_package_id');

            $regStatus = 'Pending';
            $studentStatus = 'Inactive';

            $studentColumns = [
                'branch_id', 'first_name', 'last_name', 'middle_name', 'date_of_birth',
                'age', 'phone', 'email', 'address', 'school', 'grade_year', 'health_diagnosis',
                'status'
            ];
            $studentValues = [
                $data['branch_id'],
                $data['student_first_name'],
                $data['student_last_name'],
                $data['student_middle_name'] ?? null,
                $data['student_date_of_birth'] ?? null,
                $age ?? $data['student_age'] ?? null,
                $data['student_phone'],
                $data['student_email'],
                $data['student_address'] ?? null,
                $data['student_school'] ?? null,
                $data['student_grade_year'] ?? null,
                $data['student_health_diagnosis'] ?? null,
                $studentStatus
            ];

            if ($this->hasStudentColumn('registration_source')) {
                $studentColumns[] = 'registration_source';
                $studentValues[] = $studentRegistrationSource;
            }

            if ($hasSessionPackageCol) {
                $studentColumns[] = 'session_package_id';
                $studentValues[] = $data['session_package_id'] ?? null;
            }

            $studentPlaceholders = implode(',', array_fill(0, count($studentColumns), '?'));
            $studentColsSql = implode(', ', $studentColumns);
            $stmtStudent = $this->conn->prepare("
                INSERT INTO tbl_students ({$studentColsSql})
                VALUES ({$studentPlaceholders})
            ");
            $stmtStudent->execute($studentValues);

            $studentId = (int)$this->conn->lastInsertId();

            $registrationNotes = $registrationProofPath ? ('Payment proof: ' . $registrationProofPath) : null;
            if ($registrationProofPath && $this->hasStudentColumn('registration_proof_path')) {
                $stmtProof = $this->conn->prepare("
                    UPDATE tbl_students
                    SET registration_proof_path = ?
                    WHERE student_id = ?
                ");
                $stmtProof->execute([$registrationProofPath, $studentId]);
            }
            if ($ageVerificationProofPath && $this->hasStudentColumn('age_verification_proof_path')) {
                $stmtAgeProof = $this->conn->prepare("
                    UPDATE tbl_students
                    SET age_verification_proof_path = ?
                    WHERE student_id = ?
                ");
                $stmtAgeProof->execute([$ageVerificationProofPath, $studentId]);
            }
            if ($registrationNotes) {
                $stmtPendingProof = $this->conn->prepare("
                    INSERT INTO tbl_registration_payments (
                        student_id, payment_date, amount, payment_method, status, receipt_number
                    ) VALUES (?, CURRENT_DATE, 0.00, 'Other', 'Pending', ?)
                ");
                $stmtPendingProof->execute([
                    $studentId,
                    'REG-PROOF-' . time()
                ]);
            }

            // Insert Guardian and link only when guardian info is provided (required for minors, optional for 18+)
            $guardianId = null;
            $guardianUsername = null;
            $hasGuardianData = !empty($data['guardian_first_name']) && !empty($data['guardian_last_name'])
                && !empty($data['guardian_relationship']) && !empty($data['guardian_phone']);

            if ($hasGuardianData) {
                $stmtGuardian = $this->conn->prepare("
                    INSERT INTO tbl_guardians (
                        first_name, last_name, relationship_type, phone,
                        occupation, email, address, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
                ");
                $stmtGuardian->execute([
                    $data['guardian_first_name'],
                    $data['guardian_last_name'],
                    $data['guardian_relationship'],
                    $data['guardian_phone'],
                    $data['guardian_occupation'] ?? null,
                    $data['guardian_email'] ?? null,
                    $data['guardian_address'] ?? null
                ]);
                $guardianId = $this->conn->lastInsertId();

                // Link Student and Guardian
                $stmtLink = $this->conn->prepare("
                    INSERT INTO tbl_student_guardians (
                        student_id, guardian_id, is_primary_guardian,
                        can_enroll, can_pay, emergency_contact
                    ) VALUES (?, ?, 'Y', 'Y', 'Y', 'Y')
                ");
                $stmtLink->execute([$studentId, $guardianId]);
            }

            $userStatus = 'Inactive';
            $username = $data['username'] ?? $data['student_email'];
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

            $stmtUser = $this->conn->prepare("
                INSERT INTO tbl_users (
                    username, password, role_id, first_name, last_name,
                    email, phone, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmtUser->execute([
                $username,
                $hashedPassword,
                $roleId,
                $data['student_first_name'],
                $data['student_last_name'],
                $data['student_email'],
                $data['student_phone'],
                $userStatus
            ]);

            $userId = $this->conn->lastInsertId();

            // Create guardian login (shares the student's password) when guardian email is provided
            $guardianEmail = trim((string)($data['guardian_email'] ?? ''));
            if ($guardianId && $guardianEmail !== '' && $guardianRoleId) {
                $guardianUsername = $guardianEmail;
                $guardianExistsStmt = $this->conn->prepare("SELECT user_id, role_id FROM tbl_users WHERE username = ? OR email = ? LIMIT 1");
                $guardianExistsStmt->execute([$guardianEmail, $guardianEmail]);
                $existingGuardianUser = $guardianExistsStmt->fetch(PDO::FETCH_ASSOC);

                if (!$existingGuardianUser) {
                    $guardianHashedPassword = password_hash($password, PASSWORD_DEFAULT);
                    $stmtGuardianUser = $this->conn->prepare("
                        INSERT INTO tbl_users (
                            username, password, role_id, first_name, last_name,
                            email, phone, status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ");
                    $stmtGuardianUser->execute([
                        $guardianEmail,
                        $guardianHashedPassword,
                        $guardianRoleId,
                        $data['guardian_first_name'] ?? 'Guardian',
                        $data['guardian_last_name'] ?? '',
                        $guardianEmail,
                        $data['guardian_phone'] ?? null,
                        $userStatus
                    ]);
                    $guardianUserId = (int)$this->conn->lastInsertId();
                }
            }

            // Add instruments if provided
            if (!empty($data['instruments']) && is_array($data['instruments'])) {
                $stmtInstrument = $this->conn->prepare("
                    INSERT INTO tbl_student_instruments (student_id, instrument_id, priority_order)
                    VALUES (?, ?, ?)
                ");
                foreach ($data['instruments'] as $index => $instrumentId) {
                    $stmtInstrument->execute([$studentId, $instrumentId, $index + 1]);
                }
            }

            $verificationResult = $this->issueEmailVerificationCode(
                (int)$userId,
                $data['student_email'],
                trim(($data['student_first_name'] ?? '') . ' ' . ($data['student_last_name'] ?? ''))
            );

            if (!(bool)($verificationResult['email_sent'] ?? false)) {
                throw new Exception($verificationResult['mail_error'] ?? 'Verification email could not be sent.');
            }

            $this->conn->commit();

            $emailSent = (bool)($verificationResult['email_sent'] ?? false);
            $onlineMessage = $emailSent
                ? 'Registration submitted successfully. Check your email for the verification code before logging in.'
                : ($this->isMailConfigured()
                    ? 'Registration submitted, but the verification email could not be sent. Use Resend code after signing up.'
                    : 'Registration submitted successfully. Email is not configured on the server yet.');
            $mailConfigured = $this->isMailConfigured();

            $this->sendJSON([
                'success' => true,
                'message' => $onlineMessage,
                'student_id' => $studentId,
                'guardian_id' => $guardianId,
                'guardian_username' => $guardianUsername,
                'user_id' => $userId,
                'username' => $username,
                'login_email' => $data['student_email'],
                'registration_status' => $regStatus,
                'registration_fee_amount' => $data['registration_fee_amount'],
                'registration_proof_path' => $registrationProofPath,
                'age_verification_proof_path' => $ageVerificationProofPath,
                'account_status' => 'Inactive - Pending Admin Approval',
                'verification_required' => true,
                'verification_email' => $data['student_email'],
                'verification_email_sent' => $emailSent,
                'mail_error' => $verificationResult['mail_error'] ?? null
            ]);

        } catch (PDOException $e) {
            if ($this->conn && $this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            // User-friendly message for duplicate email/username
            if ($e->getCode() == 23000 && (strpos($e->getMessage(), 'Duplicate entry') !== false || strpos($e->getMessage(), 'username') !== false || strpos($e->getMessage(), 'email') !== false)) {
                $this->sendJSON(['error' => 'This email is already registered. Please use a different email address.'], 400);
            }
            $this->sendJSON(['error' => 'Registration failed: ' . $e->getMessage()], 500);
        } catch (Exception $e) {
            if ($this->conn && $this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            $this->sendJSON(['error' => 'Registration failed: ' . $e->getMessage()], 500);
        }
    }

    public function checkRegistrationStatus($studentId)
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        if (empty($studentId)) {
            $this->sendJSON(['error' => 'Student ID is required'], 400);
        }

        try {
            $this->ensureStudentRegistrationColumns();
            $stmt = $this->conn->prepare("
                SELECT
                    s.student_id,
                    s.first_name,
                    s.last_name,
                    s.status
                FROM tbl_students s
                WHERE student_id = ?
            ");
            $stmt->execute([$studentId]);
            $student = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$student) $this->sendJSON(['error' => 'Student not found'], 404);
            $summary = $this->getRegistrationSummary((int)$student['student_id']);
            $student = array_merge($student, $summary);

            $this->sendJSON(['success' => true, 'student' => $student]);
        } catch (PDOException $e) {
            $this->sendJSON(['error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function payRegistrationFee($json)
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendJSON(['error' => 'Method not allowed'], 405);
        }

        $isMultipart = $this->isMultipartRequest();
        $data = $isMultipart ? $_POST : json_decode($json, true);
        if (!is_array($data)) {
            $this->sendJSON(['error' => 'Invalid request data'], 400);
        }
        foreach (['student_id', 'amount', 'payment_method'] as $field) {
            if (empty($data[$field])) $this->sendJSON(['error' => "Field $field is required"], 400);
        }

        try {
            $this->ensureStudentAgeVerificationProofColumn();
            $this->ensureStudentRegistrationProofColumn();
            $this->conn->beginTransaction();

            $stmtStudent = $this->conn->prepare("
                SELECT student_id, email, status,
                       first_name, last_name, phone, branch_id, date_of_birth, address,
                       registration_source, age_verification_proof_path
                 FROM tbl_students
                 WHERE student_id = ?
                 LIMIT 1
            ");
            $stmtStudent->execute([(int)$data['student_id']]);
            $student = $stmtStudent->fetch(PDO::FETCH_ASSOC);
            if (!$student) {
                throw new Exception("Student not found");
            }

            if (!$this->isRegistrationProfileComplete($student)) {
                throw new Exception("Please complete your registration details before submitting payment.");
            }

            if ($this->hasAnyRegistrationPayment((int)$data['student_id'])) {
                throw new Exception("A registration payment request already exists. Please wait for admin approval.");
            }

            $registrationProofPath = null;
            if ($isMultipart && isset($_FILES['registration_proof_file'])) {
                try {
                    $registrationProofPath = $this->storePaymentProofUpload($_FILES['registration_proof_file'], 'registration');
                } catch (Exception $e) {
                    $this->sendJSON(['error' => $e->getMessage()], 400);
                }
            }

            $ageVerificationProofPath = null;
            if ($isMultipart && isset($_FILES['age_verification_proof_file'])) {
                try {
                    $ageVerificationProofPath = $this->storeVerificationProofUpload($_FILES['age_verification_proof_file'], 'age_verification');
                } catch (Exception $e) {
                    $this->sendJSON(['error' => $e->getMessage()], 400);
                }
            }

            $paidSoFar = $this->getRegistrationPaidAmount((int)$data['student_id']);
            if ($paidSoFar >= 1000.0) {
                throw new Exception("Registration fee already paid");
            }

            $registrationSource = strtolower(trim((string)($student['registration_source'] ?? 'online')));
            $isWalkInRegistration = $registrationSource === 'walkin';
            $referenceNumber = trim((string)($data['reference_number'] ?? ''));
            if (!$isWalkInRegistration && !$registrationProofPath) {
                throw new Exception("Registration payment proof is required.");
            }
            if (!$isWalkInRegistration && !$ageVerificationProofPath && empty($student['age_verification_proof_path'])) {
                throw new Exception("Proof ID is required for online registration age verification.");
            }
            $hasRegistrationReferenceColumn = $this->tableHasColumn('tbl_registration_payments', 'reference_number');
            if ($referenceNumber !== '' && !$hasRegistrationReferenceColumn) {
                throw new Exception("Database is missing tbl_registration_payments.reference_number. Run add_payment_reference_number.sql first.");
            }

            $newPaid = $paidSoFar + (float)$data['amount'];
            $remaining = 1000.0 - $newPaid;
            $receipt = $data['receipt_number'] ?? 'REG-' . time();
            $notes = $data['notes'] ?? '';

            $paymentStatus = 'Pending';
            $paymentColumns = ['student_id', 'amount', 'payment_method', 'receipt_number', 'status'];
            $paymentValues = [$data['student_id'], $data['amount'], $data['payment_method'], $receipt, $paymentStatus];
            if ($hasRegistrationReferenceColumn) {
                $paymentColumns[] = 'reference_number';
                $paymentValues[] = ($referenceNumber !== '' ? $referenceNumber : null);
            }
            $stmtPayment = $this->conn->prepare("
                INSERT INTO tbl_registration_payments (" . implode(', ', $paymentColumns) . ")
                VALUES (" . implode(', ', array_fill(0, count($paymentColumns), '?')) . ")
            ");
            $stmtPayment->execute($paymentValues);

            $newStatus = 'Pending';

            if ($ageVerificationProofPath) {
                $this->ensureStudentAgeVerificationProofColumn();
                if ($this->hasStudentColumn('age_verification_proof_path')) {
                    $stmtAgeProof = $this->conn->prepare("
                        UPDATE tbl_students
                        SET age_verification_proof_path = ?
                        WHERE student_id = ?
                    ");
                    $stmtAgeProof->execute([$ageVerificationProofPath, (int)$data['student_id']]);
                }
            }

            if ($registrationProofPath && $this->hasStudentColumn('registration_proof_path')) {
                $stmtRegProof = $this->conn->prepare("
                    UPDATE tbl_students
                    SET registration_proof_path = ?
                    WHERE student_id = ?
                ");
                $stmtRegProof->execute([$registrationProofPath, (int)$data['student_id']]);
            }

            $this->conn->commit();

            $this->sendJSON([
                'success' => true,
                'message' => 'Payment submitted. Waiting for admin approval.',
                'paid_amount' => $newPaid,
                'remaining_amount' => max(0, $remaining),
                'registration_status' => $newStatus,
                'receipt_number' => $receipt,
                'reference_number' => $referenceNumber !== '' ? $referenceNumber : null,
                'registration_proof_path' => $registrationProofPath,
                'age_verification_proof_path' => $ageVerificationProofPath
            ]);

        } catch (Exception $e) {
            if ($this->conn && $this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            $this->sendJSON(['error' => $e->getMessage()], 500);
        }
    }
}

// Online / account API router (walk-in uses walkin_register.php)
if (defined('FAS_USERS_CLASS_ONLY')) {
    return;
}

$user = new User($conn);
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'login':
        $user->login(file_get_contents('php://input'));
        break;
    case 'register':
        $user->register(file_get_contents('php://input'));
        break;
    case 'register-basic':
        $user->registerBasic(file_get_contents('php://input'));
        break;
    case 'verify-email':
        $user->verifyEmail(file_get_contents('php://input'));
        break;
    case 'resend-email-verification':
        $user->resendEmailVerification(file_get_contents('php://input'));
        break;
    case 'check-registration-status':
        $user->checkRegistrationStatus($_GET['student_id'] ?? '');
        break;
    case 'pay-registration-fee':
        $user->payRegistrationFee(file_get_contents('php://input'));
        break;
    case 'reset-rejected-registration':
        $user->resetRejectedRegistration(file_get_contents('php://input'));
        break;
    case 'change-password':
        $user->changePassword(file_get_contents('php://input'));
        break;
    case 'update-self-profile':
        $user->updateSelfProfile(file_get_contents('php://input'));
        break;
    default:
        $user->sendJSON(['error' => 'Invalid action'], 400);
}
?>
