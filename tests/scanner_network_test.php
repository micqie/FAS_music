<?php
declare(strict_types=1);

function scannerCheck(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$scanner = file_get_contents(__DIR__ . '/../js/desk/desk_scan.js');
$page = file_get_contents(__DIR__ . '/../pages/desk/desk_scanner.html');
$htaccess = file_get_contents(__DIR__ . '/../.htaccess');

scannerCheck($scanner !== false && $page !== false && $htaccess !== false, 'Scanner sources could not be read.');
scannerCheck(str_contains($scanner, 'window.isSecureContext'), 'Scanner must detect whether live camera access is permitted.');
scannerCheck(str_contains($scanner, 'decodeQrImageFile'), 'Scanner must provide an image QR fallback.');
scannerCheck(str_contains($scanner, 'localhost login cannot be shared'), 'Scanner must explain IP-origin login isolation.');
scannerCheck(str_contains($page, 'capture="environment"'), 'Scanner photo input should prefer the rear camera.');
scannerCheck(str_contains($page, 'jsqr@1.4.0'), 'Scanner must load the image QR decoder.');
scannerCheck(str_contains($htaccess, 'Permissions-Policy "camera=(self)"'), 'Camera permission policy must allow this origin.');

echo "scanner network tests: OK\n";
