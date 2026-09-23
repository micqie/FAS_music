# Private database and mail settings

The application reads database and mail settings from environment variables or a JSON file outside the web root. Environment variables take precedence.

For the default XAMPP layout, place the JSON file at `C:\xampp\fas_music_private.json`. Set `FAS_PRIVATE_CONFIG` to an absolute path to use another location. Do not place the file under `htdocs` or commit it to Git.

Example (replace the placeholders with your own values):

```json
{
  "DB_HOST": "localhost",
  "DB_USER": "database-user",
  "DB_PASSWORD": "database-password",
  "DB_NAME": "music_db",
  "MAIL_HOST": "smtp.example.com",
  "MAIL_PORT": 587,
  "MAIL_ENCRYPTION": "tls",
  "MAIL_USERNAME": "sender@example.com",
  "MAIL_PASSWORD": "mail-app-password",
  "MAIL_FROM_ADDRESS": "sender@example.com",
  "MAIL_FROM_NAME": "Father & Sons Music School",
  "MAIL_REPLY_TO": "sender@example.com"
}
```

SMTP certificate verification remains enabled. Rotate any database or mail passwords that were previously committed to the repository; removing them from current files does not remove them from Git history.
