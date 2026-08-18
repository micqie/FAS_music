<?php

if (!function_exists('fas_session_start')) {
    function fas_session_start(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        $isSecure = (
            (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (int)($_SERVER['SERVER_PORT'] ?? 0) === 443
        );

        if (PHP_VERSION_ID >= 70300) {
            session_set_cookie_params([
                'lifetime' => 0,
                'path' => '/',
                'domain' => '',
                'secure' => $isSecure,
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
        } else {
            session_set_cookie_params(0, '/; samesite=Lax', '', $isSecure, true);
        }

        session_name('FASSESSID');
        session_start();
    }
}

if (!function_exists('fas_send_auth_json')) {
    function fas_send_auth_json(array $payload, int $statusCode = 401): void
    {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode($payload);
        exit;
    }
}

if (!function_exists('fas_has_user_column')) {
    function fas_has_user_column(PDO $conn, string $columnName): bool
    {
        try {
            $stmt = $conn->prepare("SHOW COLUMNS FROM tbl_users LIKE ?");
            $stmt->execute([$columnName]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            return false;
        }
    }
}

if (!function_exists('fas_ensure_session_columns')) {
    function fas_ensure_session_columns(PDO $conn): void
    {
        static $checked = false;
        if ($checked) {
            return;
        }
        $checked = true;

        try {
            if (!fas_has_user_column($conn, 'active_session_token')) {
                $conn->exec("ALTER TABLE tbl_users ADD COLUMN active_session_token VARCHAR(128) NULL AFTER status");
            }
            if (!fas_has_user_column($conn, 'active_session_updated_at')) {
                $conn->exec("ALTER TABLE tbl_users ADD COLUMN active_session_updated_at DATETIME NULL AFTER active_session_token");
            }
        } catch (PDOException $e) {
            // Keep the API working even if schema changes fail.
        }
    }
}

if (!function_exists('fas_normalize_role_category')) {
    function fas_normalize_role_category(?string $roleName): string
    {
        $normalized = strtolower(trim((string)$roleName));
        $normalized = preg_replace('/\s+/', ' ', $normalized);

        if (in_array($normalized, ['admin', 'superadmin', 'super admin', 'administrator'], true)) {
            return 'admin';
        }
        if (in_array($normalized, ['manager', 'branch manager'], true)) {
            return 'manager';
        }
        if (in_array($normalized, ['staff', 'desk', 'front desk'], true)) {
            return 'staff';
        }
        if (in_array($normalized, ['instructor', 'instructors', 'teacher', 'teachers'], true)) {
            return 'instructor';
        }
        if ($normalized === 'student') {
            return 'student';
        }
        if (in_array($normalized, ['guardian', 'guardians'], true)) {
            return 'guardian';
        }

        return $normalized;
    }
}

if (!function_exists('fas_fetch_user_auth_record')) {
    function fas_fetch_user_auth_record(PDO $conn, int $userId): ?array
    {
        fas_ensure_session_columns($conn);

        $stmt = $conn->prepare("
            SELECT
                u.user_id,
                u.username,
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                u.status,
                u.active_session_token,
                u.active_session_updated_at,
                r.role_name
            FROM tbl_users u
            INNER JOIN tbl_roles r ON u.role_id = r.role_id
            WHERE u.user_id = ?
            LIMIT 1
        ");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        return $user ?: null;
    }
}

if (!function_exists('fas_is_session_timestamp_stale')) {
    function fas_is_session_timestamp_stale(?string $timestamp, int $maxIdleSeconds = 2700): bool
    {
        $timestamp = trim((string)$timestamp);
        if ($timestamp === '') {
            return false;
        }

        $unix = strtotime($timestamp);
        if ($unix === false) {
            return false;
        }

        return (time() - $unix) > $maxIdleSeconds;
    }
}

if (!function_exists('fas_store_authenticated_user_session')) {
    function fas_store_authenticated_user_session(array $user, string $sessionToken): void
    {
        $_SESSION['fas_auth'] = [
            'user_id' => (int)($user['user_id'] ?? 0),
            'role_name' => (string)($user['role_name'] ?? ''),
            'role_category' => fas_normalize_role_category($user['role_name'] ?? ''),
            'session_token' => $sessionToken,
            'logged_in_at' => date('c'),
        ];
    }
}

if (!function_exists('fas_release_user_session_if_matches')) {
    function fas_release_user_session_if_matches(PDO $conn, int $userId, string $sessionToken): void
    {
        if ($userId < 1 || trim($sessionToken) === '') {
            return;
        }

        fas_ensure_session_columns($conn);

        try {
            $stmt = $conn->prepare("
                UPDATE tbl_users
                SET active_session_token = NULL,
                    active_session_updated_at = NULL
                WHERE user_id = ?
                  AND active_session_token = ?
            ");
            $stmt->execute([$userId, $sessionToken]);
        } catch (PDOException $e) {
            // Ignore logout cleanup failures to avoid breaking navigation.
        }
    }
}

if (!function_exists('fas_get_session_context')) {
    function fas_get_session_context(): ?array
    {
        fas_session_start();
        $context = $_SESSION['fas_auth'] ?? null;
        return is_array($context) ? $context : null;
    }
}

if (!function_exists('fas_login_user')) {
    function fas_login_user(PDO $conn, array $user): array
    {
        fas_session_start();
        fas_ensure_session_columns($conn);

        $userId = (int)($user['user_id'] ?? 0);
        if ($userId < 1) {
            return [
                'success' => false,
                'status' => 500,
                'error' => 'Unable to start a session for this account.',
                'auth_code' => 'SESSION_START_FAILED',
            ];
        }

        $currentContext = fas_get_session_context();
        if ($currentContext && (int)($currentContext['user_id'] ?? 0) !== $userId) {
            fas_release_user_session_if_matches(
                $conn,
                (int)($currentContext['user_id'] ?? 0),
                (string)($currentContext['session_token'] ?? '')
            );
        }

        $dbUser = fas_fetch_user_auth_record($conn, $userId);
        if (!$dbUser || strcasecmp((string)($dbUser['status'] ?? ''), 'Active') !== 0) {
            return [
                'success' => false,
                'status' => 403,
                'error' => 'Your account is not active.',
                'auth_code' => 'ACCOUNT_INACTIVE',
            ];
        }

        $currentToken = (string)($currentContext['session_token'] ?? '');
        $activeToken = trim((string)($dbUser['active_session_token'] ?? ''));
        if ($activeToken !== '' && fas_is_session_timestamp_stale($dbUser['active_session_updated_at'] ?? null)) {
            fas_release_user_session_if_matches($conn, $userId, $activeToken);
            $activeToken = '';
        }
        if ($activeToken !== '' && ($currentToken === '' || !hash_equals($activeToken, $currentToken))) {
            return [
                'success' => false,
                'status' => 409,
                'error' => 'This account is already logged in on another device or browser.',
                'auth_code' => 'ACCOUNT_ALREADY_ACTIVE',
                'session_invalidated' => false,
            ];
        }

        session_regenerate_id(true);

        $newToken = bin2hex(random_bytes(32));
        $update = $conn->prepare("
            UPDATE tbl_users
            SET active_session_token = ?,
                active_session_updated_at = NOW()
            WHERE user_id = ?
        ");
        $update->execute([$newToken, $userId]);

        fas_store_authenticated_user_session($dbUser, $newToken);

        return [
            'success' => true,
            'session_token' => $newToken,
            'user' => $dbUser,
        ];
    }
}

if (!function_exists('fas_resolve_authenticated_user')) {
    function fas_resolve_authenticated_user(PDO $conn): array
    {
        $context = fas_get_session_context();
        if (!$context) {
            return [
                'ok' => false,
                'status' => 401,
                'error' => 'Please log in to continue.',
                'auth_code' => 'AUTH_REQUIRED',
                'session_invalidated' => true,
            ];
        }

        $userId = (int)($context['user_id'] ?? 0);
        $sessionToken = (string)($context['session_token'] ?? '');
        if ($userId < 1 || trim($sessionToken) === '') {
            return [
                'ok' => false,
                'status' => 401,
                'error' => 'Your session is incomplete. Please log in again.',
                'auth_code' => 'SESSION_INVALID',
                'session_invalidated' => true,
            ];
        }

        $dbUser = fas_fetch_user_auth_record($conn, $userId);
        if (!$dbUser || strcasecmp((string)($dbUser['status'] ?? ''), 'Active') !== 0) {
            return [
                'ok' => false,
                'status' => 401,
                'error' => 'Your session is no longer active. Please log in again.',
                'auth_code' => 'ACCOUNT_INACTIVE',
                'session_invalidated' => true,
            ];
        }

        $activeToken = trim((string)($dbUser['active_session_token'] ?? ''));
        if ($activeToken === '' || !hash_equals($activeToken, $sessionToken)) {
            return [
                'ok' => false,
                'status' => 401,
                'error' => 'Your session has expired or was replaced. Please log in again.',
                'auth_code' => 'SESSION_INVALID',
                'session_invalidated' => true,
            ];
        }

        try {
            $touch = $conn->prepare("
                UPDATE tbl_users
                SET active_session_updated_at = NOW()
                WHERE user_id = ?
                  AND active_session_token = ?
            ");
            $touch->execute([$userId, $sessionToken]);
        } catch (PDOException $e) {
            // Ignore heartbeat updates.
        }

        $clientUserId = isset($_SERVER['HTTP_X_FAS_CLIENT_USER_ID'])
            ? (int)$_SERVER['HTTP_X_FAS_CLIENT_USER_ID']
            : 0;
        if ($clientUserId > 0 && $clientUserId !== $userId) {
            return [
                'ok' => false,
                'status' => 409,
                'error' => 'Your session was replaced by another login in this browser. Please log in again.',
                'auth_code' => 'CLIENT_SESSION_MISMATCH',
                'session_invalidated' => true,
            ];
        }

        return [
            'ok' => true,
            'user' => $dbUser,
            'context' => $context,
        ];
    }
}

if (!function_exists('fas_require_authenticated_user')) {
    function fas_require_authenticated_user(PDO $conn, ?array $allowedRoleCategories = null): array
    {
        $resolved = fas_resolve_authenticated_user($conn);
        if (empty($resolved['ok'])) {
            fas_send_auth_json([
                'error' => $resolved['error'] ?? 'Authentication required.',
                'auth_code' => $resolved['auth_code'] ?? 'AUTH_REQUIRED',
                'authentication_required' => true,
                'session_invalidated' => !empty($resolved['session_invalidated']),
            ], (int)($resolved['status'] ?? 401));
        }

        $user = $resolved['user'];
        $roleCategory = fas_normalize_role_category($user['role_name'] ?? '');
        if (is_array($allowedRoleCategories) && !empty($allowedRoleCategories)) {
            $allowed = array_map('strval', $allowedRoleCategories);
            if ($roleCategory !== 'admin' && !in_array($roleCategory, $allowed, true)) {
                fas_send_auth_json([
                    'error' => 'You do not have permission to access this resource.',
                    'auth_code' => 'FORBIDDEN',
                    'authentication_required' => true,
                    'session_invalidated' => false,
                ], 403);
            }
        }

        return $user;
    }
}

if (!function_exists('fas_logout_current_user')) {
    function fas_logout_current_user(PDO $conn): void
    {
        $context = fas_get_session_context();
        if ($context) {
            fas_release_user_session_if_matches(
                $conn,
                (int)($context['user_id'] ?? 0),
                (string)($context['session_token'] ?? '')
            );
        }

        $_SESSION = [];

        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params['path'] ?? '/',
                $params['domain'] ?? '',
                !empty($params['secure']),
                !empty($params['httponly'])
            );
        }

        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
    }
}
?>
