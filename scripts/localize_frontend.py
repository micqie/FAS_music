from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
HTML = [ROOT / 'index.html', ROOT / 'featured.html', *sorted((ROOT / 'pages').rglob('*.html'))]

REMOTE_TO_LOCAL = {
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css': 'assets/vendor/bootstrap/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js': 'assets/vendor/bootstrap/js/bootstrap.bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css': 'assets/vendor/fontawesome/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css': 'assets/vendor/flatpickr/flatpickr.min.css',
    'https://cdn.jsdelivr.net/npm/flatpickr': 'assets/vendor/flatpickr/flatpickr.min.js',
    'https://cdn.jsdelivr.net/npm/intl-tel-input@18.1.1/build/css/intlTelInput.css': 'assets/vendor/intl-tel-input/css/intlTelInput.css',
    'https://cdn.jsdelivr.net/npm/intl-tel-input@18.1.1/build/js/intlTelInput.min.js': 'assets/vendor/intl-tel-input/js/intlTelInput.min.js',
    'https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js': 'assets/vendor/js/axios.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js': 'assets/vendor/js/chart.umd.min.js',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11': 'assets/vendor/js/sweetalert2.min.js',
    'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js': 'assets/vendor/qrcode/qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js': 'assets/vendor/jsqr/jsQR.js',
    'https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js': 'assets/vendor/lottie/lottie-player.js',
}

def web_prefix(path: Path) -> str:
    return '' if path.parent == ROOT else '../../'

for path in HTML:
    if not path.exists():
        continue
    text = path.read_text(encoding='utf-8')
    prefix = web_prefix(path)
    for remote, local in REMOTE_TO_LOCAL.items():
        text = text.replace(remote, prefix + local)
    text = text.replace(
        '<script src="https://cdn.tailwindcss.com"></script>',
        f'<link rel="stylesheet" href="{prefix}css/tailwind.min.css?v=20260919001">'
    )
    # Runtime Tailwind configuration is now represented by tailwind.config.js.
    text = re.sub(
        r'<script>\s*(?:(?!</script>).)*?tailwind\.config\s*=.*?</script>\s*',
        '', text, flags=re.S
    )
    text = re.sub(r"\s*@import\s+url\([^)]*fonts\.googleapis\.com[^)]*\);", '', text)
    if 'rel="manifest"' not in text:
        text = text.replace('</title>', f'</title>\n    <link rel="manifest" href="{prefix}manifest.webmanifest">\n    <link rel="stylesheet" href="{prefix}assets/fonts/google-fonts.css">', 1)
    offline_tag = f'<script src="{prefix}js/offline.js?v=20260919001"></script>'
    if 'js/offline.js' not in text:
        axios_pattern = re.compile(r'(<script\s+src="[^"]*assets/vendor/js/axios\.min\.js"[^>]*></script>)')
        if axios_pattern.search(text):
            text = axios_pattern.sub(r'\1\n' + offline_tag, text, count=1)
        else:
            text = text.replace('</body>', f'    {offline_tag}\n</body>')
    if path.name in ('index.html', 'featured.html'):
        text = text.replace('https://images.unsplash.com/photo-1514119412350-e174d90d280e?q=80&w=1000', 'assets/images/about-music.jpg')
    path.write_text(text, encoding='utf-8', newline='')

# Local data replaces runtime GitHub dependencies.
for rel in ('js/index.js', 'pages/admin/admin_registration.html', 'pages/desk/desk_registration.html'):
    path = ROOT / rel
    text = path.read_text(encoding='utf-8')
    prefix = '' if rel.startswith('js/') else '../../'
    text = text.replace('https://raw.githubusercontent.com/darklight721/philippines/master/provinces.json', prefix + 'assets/data/philippines-provinces.json')
    text = text.replace('https://raw.githubusercontent.com/darklight721/philippines/master/cities.json', prefix + 'assets/data/philippines-cities.json')
    path.write_text(text, encoding='utf-8', newline='')

phone = ROOT / 'js/intl-phone-input.js'
if phone.exists():
    text = phone.read_text(encoding='utf-8')
    text = text.replace('https://cdn.jsdelivr.net/npm/intl-tel-input@18.1.1/build/js/utils.js', 'assets/vendor/intl-tel-input/js/utils.js')
    phone.write_text(text, encoding='utf-8', newline='')
