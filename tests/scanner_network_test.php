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
scannerCheck(str_contains($scanner, 'navigator.mediaDevices.getUserMedia'), 'Scanner must use the native browser camera API.');
scannerCheck(str_contains($scanner, "facingMode: { ideal: 'environment' }"), 'Scanner should prefer the rear camera.');
scannerCheck(str_contains($scanner, 'scanVideoLoop'), 'Scanner must continuously decode live camera frames.');
scannerCheck(!str_contains($page, 'instascan'), 'Scanner page must not load the obsolete Instascan camera library.');
scannerCheck(str_contains($scanner, 'decodeQrImageFile'), 'Scanner must provide an image QR fallback.');
scannerCheck(str_contains($scanner, 'URL.createObjectURL'), 'Scanner image fallback must work without createImageBitmap.');
scannerCheck(str_contains($scanner, 'getScannerMixedContentError'), 'Scanner must explain HTTPS-to-HTTP API mixed content.');
scannerCheck(str_contains($scanner, 'NotReadableError'), 'Scanner must explain when another app is using the camera.');
scannerCheck(str_contains($page, 'retryCameraBtn'), 'Scanner must provide a camera retry control.');
scannerCheck(str_contains($scanner, 'localhost login cannot be shared'), 'Scanner must explain IP-origin login isolation.');
scannerCheck(str_contains($page, 'capture="environment"'), 'Scanner photo input should prefer the rear camera.');
scannerCheck(str_contains($page, 'jsqr@1.4.0'), 'Scanner must load the image QR decoder.');
scannerCheck(str_contains($htaccess, 'Permissions-Policy "camera=(self)"'), 'Camera permission policy must allow this origin.');

echo "scanner network tests: OK\n";
