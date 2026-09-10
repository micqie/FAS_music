# Trusted local HTTPS (XAMPP + mkcert)

This project is served by XAMPP Apache because its API endpoints are PHP files. Apache already supports HTTPS, so no Node framework or proxy is needed. HTTP remains available on port 80; trusted HTTPS uses Apache's existing port 443 and listens on all IPv4 interfaces.

## One-time Windows setup

Open PowerShell (Administrator is recommended for Apache/firewall changes), then run:

```powershell
cd C:\xampp\htdocs\FAS_music
winget install --id FiloSottile.mkcert --exact --source winget
.\scripts\setup-local-https.ps1 -LocalIPv4 192.168.x.x
```

Replace `192.168.x.x` with the computer's Wi-Fi IPv4 address. To find it:

```powershell
ipconfig
```

Under the active **Wireless LAN adapter Wi-Fi**, copy **IPv4 Address**. You can omit `-LocalIPv4`; the script normally selects the address used by the default network route automatically.

The script installs mkcert's local development CA in Windows, creates the certificate and key under `C:\xampp\apache\conf\fas-music-dev-certs` (outside the public web root), and updates `C:\xampp\apache\conf\extra\httpd-ssl.conf`. It makes a timestamped backup and runs `httpd.exe -t` before asking you to restart Apache. The repository's `dev-certs/` path is also ignored by Git as a defense against accidentally placing certificates in the project.

Restart Apache in the XAMPP Control Panel. With an address of `192.168.1.25`, open:

```text
https://192.168.1.25/FAS_music/pages/desk/desk_scanner.html
```

Port 443 is omitted because it is the standard HTTPS port. If you intentionally configure another HTTPS port, include it in the URL and firewall rule.

## Trust the CA on a phone

Run `mkcert -CAROOT` on the computer. Securely copy only `rootCA.pem` from that folder to your phone. Never copy `rootCA-key.pem` or the project's `*-key.pem` file.

### Android

The exact labels vary by manufacturer. Usually open **Settings > Security > Encryption & credentials > Install a certificate > CA certificate**, select `rootCA.pem`, and confirm. A screen lock may be required. Fully close and reopen Chrome afterward. Remove the user CA when local testing is finished.

### iPhone/iPad

Send `rootCA.pem` to the device and open it to install the downloaded profile under **Settings > General > VPN & Device Management**. Then enable it under **Settings > General > About > Certificate Trust Settings > Enable Full Trust for Root Certificates**. Fully close and reopen Safari afterward. Remove the profile when local testing is finished.

## Windows Firewall

If the phone cannot connect, allow inbound TCP 443 on Private networks from an elevated PowerShell:

```powershell
New-NetFirewallRule -DisplayName "FAS Music local HTTPS" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443 -Profile Private
```

Both devices must be on the same Wi-Fi, the Windows network profile should be **Private**, and client/AP isolation must be disabled on the router. To remove the rule later:

```powershell
Remove-NetFirewallRule -DisplayName "FAS Music local HTTPS"
```

## When the computer's IP changes

Run the setup script again with the new IPv4 address, restart Apache, and use the new HTTPS URL. The root CA normally does not need to be reinstalled on the phone; mkcert signs the replacement certificate with the same local CA.
