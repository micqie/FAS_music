# MySQL locally and PostgreSQL on Render

The app selects one database driver per running instance. The local XAMPP
instance can use MySQL while the Render service uses PostgreSQL; the two
databases do not synchronize automatically.

## Local XAMPP

Keep the local `.env` values on MySQL and set `DB_DRIVER=mysql`. PHP checks
process environment variables first, then the existing private JSON config,
then the workspace `.env` file. The `.env` file is ignored by Git and excluded
from the Docker build context.

## Render

Use the Docker runtime. Set `DB_DRIVER=pgsql` and add the PostgreSQL
`DATABASE_URL` to the web service environment. Use Render's **Internal
Database URL** for a Render service in the same region. The connection code
reads the URL's host, database, username, password, port, and optional
`sslmode`. Render's internal URL does not require TLS; its external URL
includes `sslmode=require`. For individual connection fields, set `DB_SSLMODE`
to the mode required by your database provider.

The Docker image installs both PDO drivers (`pdo_mysql` and `pdo_pgsql`).

## Create an empty PostgreSQL database

The checked-in `database/postgresql_schema.sql` creates the base tables,
indexes, foreign keys, identity columns, and update-time triggers. It contains
no application or user data. Import it into a newly created PostgreSQL
database, then import `database/postgresql_seed.sql` for the minimum role rows.
Do not run the schema file over an already-populated database: primary keys and
constraints are added without `IF NOT EXISTS`.

The schema generator reads `database/current_database.sql` and intentionally
omits all `INSERT` statements. Run `python scripts/convert_mysql_schema_to_postgres.py`
after updating the MySQL schema dump.

To deploy the existing local records, migrate those records separately from
MySQL into PostgreSQL. The two databases are independent and the schema
conversion does not copy records or uploaded files.
