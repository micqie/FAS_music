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

    $privateConfig = fas_private_config();
    if (array_key_exists($key, $privateConfig)) return $privateConfig[$key];

    static $dotenv = null;
    if ($dotenv === null) {
        $dotenv = [];
        $envPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env';
        $lines = is_file($envPath) ? file($envPath, FILE_IGNORE_NEW_LINES) : false;
        foreach ($lines ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
            [$name, $value] = explode('=', $line, 2);
            $name = trim($name);
            if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $name)) continue;
            $value = trim($value);
            if (strlen($value) >= 2 && (($value[0] === '"' && str_ends_with($value, '"')) || ($value[0] === "'" && str_ends_with($value, "'")))) {
                $value = substr($value, 1, -1);
            } else {
                $value = preg_replace('/\s+#.*$/', '', $value) ?? $value;
            }
            $dotenv[$name] = $value;
        }
    }
    if (array_key_exists($key, $dotenv)) return $dotenv[$key];

    return $default;
}
