<?php

function fas_private_config(): array
{
    static $config = null;
    if ($config !== null) return $config;

    $defaultPath = dirname(__DIR__, 3) . DIRECTORY_SEPARATOR . 'fas_music_private.json';
    $path = getenv('FAS_PRIVATE_CONFIG') ?: $defaultPath;
    $contents = is_file($path) ? file_get_contents($path) : false;
    $decoded = $contents !== false ? json_decode($contents, true) : null;
    $config = is_array($decoded) ? $decoded : [];
    return $config;
}

function fas_private_setting(string $key, $default = '')
{
    $environment = getenv($key);
    if ($environment !== false) return $environment;
    return fas_private_config()[$key] ?? $default;
}
