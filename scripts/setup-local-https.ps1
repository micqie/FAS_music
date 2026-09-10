[CmdletBinding()]
param(
    [string]$LocalIPv4,
    [ValidateRange(1, 65535)]
    [int]$HttpsPort = 443,
    [string]$XamppRoot = 'C:\xampp'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$apacheDirectory = Join-Path $XamppRoot 'apache'
$certificateDirectory = Join-Path $apacheDirectory 'conf\fas-music-dev-certs'
$apacheSslConfig = Join-Path $apacheDirectory 'conf\extra\httpd-ssl.conf'
$apacheExecutable = Join-Path $apacheDirectory 'bin\httpd.exe'

if (-not $LocalIPv4) {
    $defaultRoutes = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -AddressFamily IPv4 |
        Where-Object { $_.State -eq 'Alive' } |
        Sort-Object @{ Expression = { $_.RouteMetric + $_.InterfaceMetric } }

    foreach ($route in $defaultRoutes) {
        $candidate = Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 |
            Where-Object {
                $_.AddressState -eq 'Preferred' -and
                $_.IPAddress -notlike '127.*' -and
                $_.IPAddress -notlike '169.254.*'
            } |
            Select-Object -First 1
        if ($candidate) {
            $LocalIPv4 = $candidate.IPAddress
            break
        }
    }
}

if (-not $LocalIPv4 -or $LocalIPv4 -notmatch '^(?:\d{1,3}\.){3}\d{1,3}$') {
    throw 'No local IPv4 address was found. Run again with -LocalIPv4 192.168.x.x.'
}

$mkcertCommand = Get-Command mkcert -ErrorAction SilentlyContinue
if (-not $mkcertCommand) {
    $wingetLink = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\mkcert.exe'
    if (Test-Path -LiteralPath $wingetLink) {
        $mkcertPath = $wingetLink
    } else {
        throw 'mkcert was not found. Install it with: winget install --id FiloSottile.mkcert --exact'
    }
} else {
    $mkcertPath = $mkcertCommand.Source
}

if (-not (Test-Path -LiteralPath $apacheSslConfig) -or -not (Test-Path -LiteralPath $apacheExecutable)) {
    throw "XAMPP Apache was not found under $XamppRoot. Pass the correct path with -XamppRoot."
}

New-Item -ItemType Directory -Path $certificateDirectory -Force | Out-Null
$certificateFile = Join-Path $certificateDirectory 'fas-music-local.pem'
$privateKeyFile = Join-Path $certificateDirectory 'fas-music-local-key.pem'

Write-Host 'Installing the mkcert development CA in the Windows trust store...'
& $mkcertPath -install
if ($LASTEXITCODE -ne 0) { throw 'mkcert could not install its local CA.' }

Write-Host "Generating a certificate for localhost, 127.0.0.1, and $LocalIPv4..."
& $mkcertPath -cert-file $certificateFile -key-file $privateKeyFile localhost 127.0.0.1 $LocalIPv4
if ($LASTEXITCODE -ne 0) { throw 'mkcert could not generate the local certificate.' }

$apacheCertificateFile = $certificateFile.Replace('\', '/')
$apachePrivateKeyFile = $privateKeyFile.Replace('\', '/')
$sslConfig = Get-Content -LiteralPath $apacheSslConfig -Raw
$updatedConfig = $sslConfig
$updatedConfig = ([regex]::new('^Listen\s+(?:(?:0\.0\.0\.0:)?\d+)\s*$', 'Multiline')).Replace($updatedConfig, "Listen 0.0.0.0:$HttpsPort", 1)
$updatedConfig = ([regex]::new('^<VirtualHost\s+(?:_default_|0\.0\.0\.0):\d+>\s*$', 'Multiline')).Replace($updatedConfig, "<VirtualHost 0.0.0.0:$HttpsPort>", 1)
$updatedConfig = ([regex]::new('^ServerName\s+[^\r\n]+:\d+\s*$', 'Multiline')).Replace($updatedConfig, "ServerName $LocalIPv4`:$HttpsPort", 1)
$updatedConfig = ([regex]::new('^SSLCertificateFile\s+[^\r\n]+$', 'Multiline')).Replace($updatedConfig, "SSLCertificateFile `"$apacheCertificateFile`"", 1)
$updatedConfig = ([regex]::new('^SSLCertificateKeyFile\s+[^\r\n]+$', 'Multiline')).Replace($updatedConfig, "SSLCertificateKeyFile `"$apachePrivateKeyFile`"", 1)

if ($updatedConfig -eq $sslConfig) {
    throw "No supported SSL virtual host was found in $apacheSslConfig."
}

$backupFile = "$apacheSslConfig.fas-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -LiteralPath $apacheSslConfig -Destination $backupFile
Set-Content -LiteralPath $apacheSslConfig -Value $updatedConfig -Encoding UTF8

& $apacheExecutable -t
if ($LASTEXITCODE -ne 0) {
    Copy-Item -LiteralPath $backupFile -Destination $apacheSslConfig -Force
    throw "Apache rejected the HTTPS configuration. The original was restored from $backupFile."
}

Write-Host ''
Write-Host 'HTTPS setup is ready.' -ForegroundColor Green
Write-Host "Restart Apache from the XAMPP Control Panel, then open:"
$portSuffix = if ($HttpsPort -eq 443) { '' } else { ":$HttpsPort" }
Write-Host "https://$LocalIPv4$portSuffix/FAS_music/pages/desk/desk_scanner.html" -ForegroundColor Cyan
Write-Host "Certificate: $certificateFile"
Write-Host "Private key: $privateKeyFile"
Write-Host "Apache backup: $backupFile"
Write-Host "CA folder for phone installation: $(& $mkcertPath -CAROOT)"
