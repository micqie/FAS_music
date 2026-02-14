# Migrations

Schema and column setup that used to live here has been moved into the API so the app self-initializes when endpoints are called:

- **Instruments** (`api/instruments.php`): `ensureInstrumentSchema()` in constructor — creates `tbl_instrument_types`, adds `type_id`, `serial_number`, `condition`, `status` on `tbl_instruments` when missing.
- **Students** (`api/students.php`): `ensureSessionPackageColumn()` — adds `session_package_id` to `tbl_students` when missing (called from `getAllStudents` and `getActiveStudents`).
- **Sessions/Packages** (`api/sessions.php`): `ensureTable()` and `ensurePriceColumn()` — create `tbl_session_packages` and add `price` when missing.

No manual migration scripts are required. Use `fas_db.sql` for initial database creation.
