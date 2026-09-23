<?php
require_once __DIR__ . '/../api/auth_session.php';

function check(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$key = bin2hex(random_bytes(32));
$now = 1700000000;
$jwt = fas_jwt_issue(42, $key, $now);
check(fas_jwt_verify($jwt, $key, $now + 1)['sub'] === '42', 'Valid JWT rejected');
check(fas_jwt_verify($jwt, $key, $now + 43200) === null, 'Expired JWT accepted');
check(fas_jwt_verify($jwt, bin2hex(random_bytes(32)), $now + 1) === null, 'Rotated key accepted');

$parts = explode('.', $jwt);
$claims = json_decode(fas_jwt_base64url_decode($parts[1]), true);
$claims['sub'] = '43';
$tampered = $parts[0] . '.' . fas_jwt_base64url_encode(json_encode($claims)) . '.' . $parts[2];
check(fas_jwt_verify($tampered, $key, $now + 1) === null, 'Tampered subject accepted');

$noneHeader = fas_jwt_base64url_encode(json_encode(['typ' => 'JWT', 'alg' => 'none']));
$none = $noneHeader . '.' . $parts[1] . '.';
check(fas_jwt_verify($none, $key, $now + 1) === null, 'Unsigned JWT accepted');

$wrongAudience = $claims;
$wrongAudience['sub'] = '42';
$wrongAudience['aud'] = 'another-app';
$body = $parts[0] . '.' . fas_jwt_base64url_encode(json_encode($wrongAudience));
$wrongAudienceJwt = $body . '.' . fas_jwt_base64url_encode(hash_hmac('sha256', $body, $key, true));
check(fas_jwt_verify($wrongAudienceJwt, $key, $now + 1) === null, 'Wrong audience accepted');

echo "JWT authentication checks passed.\n";
