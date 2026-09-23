<?php
require_once __DIR__ . '/private_config.php';

return [
    'MAIL_HOST' => fas_private_setting('MAIL_HOST', 'smtp.gmail.com'),
    'MAIL_PORT' => fas_private_setting('MAIL_PORT', 587),
    'MAIL_ENCRYPTION' => fas_private_setting('MAIL_ENCRYPTION', 'tls'),
    'MAIL_USERNAME' => fas_private_setting('MAIL_USERNAME', 'midu.lago.coc@phinmaed.com'),
    'MAIL_PASSWORD' => fas_private_setting('MAIL_PASSWORD', 'qyowrffidqmsutfot'),
    'MAIL_FROM_ADDRESS' => fas_private_setting('MAIL_FROM_ADDRESS', 'midu.lago.coc@phinmaed.com'),
    'MAIL_FROM_NAME' => fas_private_setting('MAIL_FROM_NAME', 'Father & Sons Music School'),
    'MAIL_REPLY_TO' => fas_private_setting('MAIL_REPLY_TO', ''),
    'MAIL_VERIFY_PEER' => true,
];
