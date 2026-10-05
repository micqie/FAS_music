<?php

/**
 * PDO connection that translates the small set of MySQL SQL constructs used by
 * the application when the configured backend is PostgreSQL.
 *
 * Keep application queries portable where possible. This adapter exists for
 * remaining legacy syntax and is not a general-purpose SQL translator.
 */
class FasPDO extends PDO
{
    private string $fasDriver;

    public function __construct(string $dsn, ?string $username = null, ?string $password = null, array $options = [])
    {
        parent::__construct($dsn, $username, $password, $options);
        $this->fasDriver = (string)$this->getAttribute(PDO::ATTR_DRIVER_NAME);
    }

    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        return parent::prepare($this->translate($query), $options);
    }

    public function query(string $query, ?int $fetchMode = null, mixed ...$fetchModeArgs): PDOStatement|false
    {
        $query = $this->translate($query);
        if ($fetchMode === null) return parent::query($query);
        return parent::query($query, $fetchMode, ...$fetchModeArgs);
    }

    public function exec(string $statement): int|false
    {
        [$statement, $indexes] = $this->translateDdl($this->translate($statement));
        $result = parent::exec($statement);
        if ($result === false) return false;

        foreach ($indexes as $indexSql) parent::exec($indexSql);
        return $result;
    }

    public function lastInsertId(?string $name = null): string|false
    {
        if ($this->fasDriver === 'pgsql') {
            $value = parent::query('SELECT LASTVAL()');
            return $value ? (string)$value->fetchColumn() : false;
        }
        return parent::lastInsertId($name);
    }

    private function translate(string $sql): string
    {
        if ($this->fasDriver !== 'pgsql') return $sql;

        // Translate metadata checks used by legacy schema helpers.
        if (preg_match('/^\s*SHOW\s+TABLES\s+LIKE\s+\?\s*;?\s*$/i', $sql)) {
            return "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name LIKE ?";
        }
        if (preg_match('/^\s*SHOW\s+TABLES\s+LIKE\s+\'([a-zA-Z0-9_]+)\'\s*;?\s*$/i', $sql, $m)) {
            return "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = '" . $m[1] . "'";
        }
        if (preg_match('/^\s*SHOW\s+COLUMNS\s+FROM\s+[`"]?([a-zA-Z0-9_]+)[`"]?\s+LIKE\s+\?\s*;?\s*$/i', $sql, $m)) {
            return "SELECT column_name AS \"Field\", data_type AS \"Type\", is_nullable AS \"Null\", column_default AS \"Default\" FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = '" . $m[1] . "' AND column_name LIKE ?";
        }
        if (preg_match('/^\s*SHOW\s+COLUMNS\s+FROM\s+[`"]?([a-zA-Z0-9_]+)[`"]?\s+LIKE\s+\'([a-zA-Z0-9_]+)\'\s*;?\s*$/i', $sql, $m)) {
            return "SELECT column_name AS \"Field\", data_type AS \"Type\", is_nullable AS \"Null\", column_default AS \"Default\" FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = '" . $m[1] . "' AND column_name = '" . $m[2] . "'";
        }
        if (preg_match('/^\s*(?:SHOW\s+COLUMNS\s+FROM|DESCRIBE)\s+[`"]?([a-zA-Z0-9_]+)[`"]?\s*;?\s*$/i', $sql, $m)) {
            return "SELECT column_name AS \"Field\", data_type AS \"Type\", is_nullable AS \"Null\", column_default AS \"Default\" FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = '" . $m[1] . "' ORDER BY ordinal_position";
        }

        $sql = str_replace('`', '"', $sql);
        $sql = preg_replace('/\bIFNULL\s*\(/i', 'COALESCE(', $sql) ?? $sql;
        $sql = preg_replace('/\bCURDATE\s*\(\s*\)/i', 'CURRENT_DATE', $sql) ?? $sql;
        $sql = preg_replace('/DATE_SUB\(\s*CURRENT_DATE\s*,\s*INTERVAL\s*\(\s*WEEKDAY\(\s*CURRENT_DATE\s*\)\s*\)\s*DAY\s*\)/i', "DATE_TRUNC('week', CURRENT_DATE)::date", $sql) ?? $sql;
        $sql = preg_replace('/DATE_ADD\(\s*DATE_TRUNC\(\'week\',\s*CURRENT_DATE\)::date\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/i', "(DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '$1 days')", $sql) ?? $sql;
        $sql = preg_replace('/DATE_ADD\(\s*CONCAT\(\s*\?\s*,\s*\' 00:00:00\'\s*\)\s*,\s*INTERVAL\s+1\s+DAY\s*\)/i', "(CAST(? AS DATE) + INTERVAL '1 day')", $sql) ?? $sql;
        $sql = preg_replace('/\bBINARY\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s*=\s*BINARY\s+(\?)/i', '$1 COLLATE "C" = $2 COLLATE "C"', $sql) ?? $sql;

        // MySQL permits SUM(boolean); PostgreSQL needs a numeric expression.
        $sql = preg_replace_callback(
            '/SUM\(\s*(DATE\s*\(\s*[a-zA-Z_][a-zA-Z0-9_.]*\s*\)|[a-zA-Z_][a-zA-Z0-9_.]*)\s*=\s*(CURRENT_DATE|\'[^\']*\')\s*\)/i',
            static fn(array $m): string => 'SUM(CASE WHEN ' . $m[1] . ' = ' . $m[2] . ' THEN 1 ELSE 0 END)',
            $sql
        ) ?? $sql;

        // MySQL's FIELD() returns the sort position of a value in a list.
        $sql = preg_replace_callback(
            '/FIELD\(\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*,\s*((?:\'[^\']*\'\s*,?\s*)+)\)/i',
            static function (array $m): string {
                $values = array_values(array_filter(array_map('trim', explode(',', $m[2])), static fn(string $value): bool => $value !== ''));
                $cases = [];
                foreach ($values as $index => $value) $cases[] = 'WHEN ' . $value . ' THEN ' . ($index + 1);
                return '(CASE ' . $m[1] . ' ' . implode(' ', $cases) . ' ELSE 0 END)';
            },
            $sql
        ) ?? $sql;

        // MySQL accepts SUM(flag = value), while PostgreSQL does not.
        $sql = preg_replace_callback(
            '/SUM\(\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*=\s*(\'[^\']*\'|\d+)\s*\)/i',
            static fn(array $m): string => 'SUM(CASE WHEN ' . $m[1] . ' = ' . $m[2] . ' THEN 1 ELSE 0 END)',
            $sql
        ) ?? $sql;

        // The app only uses this ordered aggregate shape for payment summaries.
        $sql = preg_replace_callback(
            '/SUBSTRING_INDEX\(\s*GROUP_CONCAT\(\s*(p\.payment_type)\s+ORDER\s+BY\s+(p\.payment_date\s+DESC\s*,\s*p\.payment_id\s+DESC)\s*\)\s*,\s*\'[, ]*\'\s*,\s*1\s*\)/i',
            static fn(array $m): string => '(ARRAY_AGG(' . $m[1] . ' ORDER BY ' . $m[2] . '))[1]',
            $sql
        ) ?? $sql;

        // MySQL's string aggregate syntax used by roster/report queries.
        $sql = preg_replace_callback(
            '/GROUP_CONCAT\(\s*(DISTINCT\s+)?([^()]*?)\s*\)/i',
            static function (array $m): string {
                $body = trim($m[2]);
                $separator = ',';
                if (preg_match("/^(.*?)\\s+SEPARATOR\\s+'((?:''|[^'])*)'$/is", $body, $parts)) {
                    $body = trim($parts[1]);
                    $separator = str_replace("''", "'", $parts[2]);
                }
                $order = '';
                if (preg_match('/^(.*?)\s+ORDER\s+BY\s+(.*)$/is', $body, $parts)) {
                    $body = trim($parts[1]);
                    $order = ' ORDER BY ' . trim($parts[2]);
                }
                if (preg_match('/^(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?(?:type_id|specialization_id)$/i', $body)) {
                    $body = 'CAST(' . $body . ' AS TEXT)';
                    $order = preg_replace('/(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?(?:type_id|specialization_id)/i', 'CAST($0 AS TEXT)', $order) ?? $order;
                }
                return 'STRING_AGG(' . ($m[1] ?? '') . trim($body) . ", '" . $separator . "'" . $order . ')';
            },
            $sql
        ) ?? $sql;

        // INSERT IGNORE is used only for seed rows where duplicate rows are safe to skip.
        $ignoredInsert = preg_match('/\bINSERT\s+IGNORE\s+INTO\b/i', $sql) === 1;
        if ($ignoredInsert) $sql = preg_replace('/\bINSERT\s+IGNORE\s+INTO\b/i', 'INSERT INTO', $sql, 1) ?? $sql;

        $sql = preg_replace('/\bVALUES\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)/i', 'EXCLUDED.$1', $sql) ?? $sql;
        if (preg_match('/\bON\s+DUPLICATE\s+KEY\s+UPDATE\b/i', $sql)) {
            $conflictColumns = [
                'tbl_settings' => 'setting_key',
                'tbl_schedule_operation_lookup' => 'operation_code',
                'tbl_enrollment_financials' => 'enrollment_id',
            ];
            $table = '';
            if (preg_match('/\bINSERT\s+INTO\s+([a-zA-Z0-9_]+)/i', $sql, $m)) $table = $m[1];
            $conflict = $conflictColumns[$table] ?? null;
            if ($conflict !== null) {
                $sql = preg_replace('/\bON\s+DUPLICATE\s+KEY\s+UPDATE\b/i', 'ON CONFLICT (' . $conflict . ') DO UPDATE SET', $sql, 1) ?? $sql;
            }
        }
        if ($ignoredInsert && !preg_match('/\bON\s+CONFLICT\b/i', $sql)) {
            $sql = rtrim($sql, " ;\t\r\n") . ' ON CONFLICT DO NOTHING';
        }

        return $sql;
    }

    /** @return array{string, list<string>} */
    private function translateDdl(string $sql): array
    {
        if ($this->fasDriver !== 'pgsql') return [$sql, []];

        if (preg_match('/^\s*ALTER\s+TABLE\s+[`"]?([a-zA-Z0-9_]+)[`"]?\s+ADD\s+(UNIQUE\s+)?(?:KEY|INDEX)\s+[`"]?([a-zA-Z0-9_]+)[`"]?\s*\(([^()]*)\)\s*;?\s*$/i', $sql, $m)) {
            $unique = trim($m[2] ?? '') !== '' ? 'UNIQUE ' : '';
            $columns = preg_replace('/[`"]/', '', trim($m[4])) ?? trim($m[4]);
            return ['CREATE ' . $unique . 'INDEX IF NOT EXISTS "' . $m[3] . '" ON "' . $m[1] . '" (' . $columns . ')', []];
        }
        if (preg_match('/^\s*ALTER\s+TABLE\s+[`"]?([a-zA-Z0-9_]+)[`"]?\s+DROP\s+INDEX\s+[`"]?([a-zA-Z0-9_]+)[`"]?\s*;?\s*$/i', $sql, $m)) {
            return ['DROP INDEX IF EXISTS "' . $m[2] . '"', []];
        }

        $indexes = [];
        $tableName = '';
        if (preg_match('/^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?([a-zA-Z0-9_]+)/i', $sql, $tableMatch)) {
            $tableName = $tableMatch[1];
            $hasAutoUpdatedAt = preg_match('/\bON\s+UPDATE\s+CURRENT_TIMESTAMP(?:\(\))?/i', $sql) === 1;
            $sql = preg_replace_callback(
                '/,?\s*(UNIQUE\s+)?(?:KEY|INDEX)\s+[`"]?([a-zA-Z0-9_]+)[`"]?\s*\(([^()]*)\)/i',
                static function (array $m) use (&$indexes, $tableName): string {
                    $unique = trim($m[1] ?? '') !== '' ? 'UNIQUE ' : '';
                    $name = $m[2];
                    $columns = preg_replace('/[`"]/', '', trim($m[3])) ?? trim($m[3]);
                    $indexes[] = 'CREATE ' . $unique . 'INDEX IF NOT EXISTS "' . $name . '" ON "' . $tableName . '" (' . $columns . ')';
                    return '';
                },
                $sql
            ) ?? $sql;
            $sql = preg_replace('/,\s*\)/', ')', $sql) ?? $sql;
            if ($hasAutoUpdatedAt) {
                $trigger = 'trg_uat_' . $tableName;
                $indexes[] = 'CREATE OR REPLACE FUNCTION fas_touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := CURRENT_TIMESTAMP; RETURN NEW; END; $$';
                $indexes[] = "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = '" . $trigger . "' AND tgrelid = '\"" . $tableName . "\"'::regclass) THEN EXECUTE 'CREATE TRIGGER \"" . $trigger . "\" BEFORE UPDATE ON \"" . $tableName . "\" FOR EACH ROW EXECUTE FUNCTION fas_touch_updated_at()'; END IF; END \$\$";
            }
        }
        if ($tableName === '' && preg_match('/^\s*ALTER\s+TABLE\s+[`"]?([a-zA-Z0-9_]+)/i', $sql, $tableMatch)) {
            $tableName = $tableMatch[1];
            if (preg_match('/\bON\s+UPDATE\s+CURRENT_TIMESTAMP(?:\(\))?/i', $sql)) {
                $trigger = 'trg_uat_' . $tableName;
                $indexes[] = 'CREATE OR REPLACE FUNCTION fas_touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := CURRENT_TIMESTAMP; RETURN NEW; END; $$';
                $indexes[] = "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = '" . $trigger . "' AND tgrelid = '\"" . $tableName . "\"'::regclass) THEN EXECUTE 'CREATE TRIGGER \"" . $trigger . "\" BEFORE UPDATE ON \"" . $tableName . "\" FOR EACH ROW EXECUTE FUNCTION fas_touch_updated_at()'; END IF; END \$\$";
            }
        }

        $sql = preg_replace('/\bAUTO_INCREMENT\b/i', 'GENERATED BY DEFAULT AS IDENTITY', $sql) ?? $sql;
        $sql = preg_replace('/\bTINYINT\s*\(\s*1\s*\)/i', 'SMALLINT', $sql) ?? $sql;
        $sql = preg_replace('/\b(?:TINYINT|SMALLINT|MEDIUMINT|INT|INTEGER)\s*\(\s*\d+\s*\)/i', 'INT', $sql) ?? $sql;
        $sql = preg_replace('/\bBIGINT\s*\(\s*\d+\s*\)/i', 'BIGINT', $sql) ?? $sql;
        $sql = preg_replace('/\bTINYINT\b/i', 'SMALLINT', $sql) ?? $sql;
        $sql = preg_replace('/\bSMALLINT\s+UNSIGNED\b/i', 'INTEGER', $sql) ?? $sql;
        $sql = preg_replace('/\bINT\s+UNSIGNED\b/i', 'BIGINT', $sql) ?? $sql;
        $sql = preg_replace('/\bBIGINT\s+UNSIGNED\b/i', 'NUMERIC(20)', $sql) ?? $sql;
        $sql = preg_replace_callback('/\bENUM\s*\(([^()]*)\)/i', static function (array $m): string {
            preg_match_all("/'((?:''|[^'])*)'/", $m[1], $values);
            $max = 1;
            foreach ($values[1] as $value) $max = max($max, strlen(str_replace("''", "'", $value)));
            return 'VARCHAR(' . $max . ')';
        }, $sql) ?? $sql;
        $sql = preg_replace('/\bLONGTEXT\b/i', 'TEXT', $sql) ?? $sql;
        $sql = preg_replace('/\bDATETIME\b/i', 'TIMESTAMP', $sql) ?? $sql;
        $sql = preg_replace('/\bCURRENT_TIMESTAMP\s*\(\s*\)/i', 'CURRENT_TIMESTAMP', $sql) ?? $sql;
        $sql = preg_replace('/\bJSON\b/i', 'JSONB', $sql) ?? $sql;
        $sql = preg_replace('/\s+CHARACTER\s+SET\s+[a-zA-Z0-9_]+/i', '', $sql) ?? $sql;
        $sql = preg_replace('/\s+COLLATE\s+[a-zA-Z0-9_]+/i', '', $sql) ?? $sql;
        $sql = preg_replace('/\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP(?:\(\))?/i', '', $sql) ?? $sql;
        $sql = preg_replace('/\s+AFTER\s+[`"]?[a-zA-Z0-9_]+[`"]?/i', '', $sql) ?? $sql;
        $sql = preg_replace('/\s+ENGINE\s*=\s*InnoDB\b[^;]*/i', '', $sql) ?? $sql;
        $sql = preg_replace('/\s+DEFAULT\s+CHARSET\s*=\s*[a-zA-Z0-9_]+/i', '', $sql) ?? $sql;
        $sql = preg_replace('/\s+COLLATE\s*=\s*[a-zA-Z0-9_]+/i', '', $sql) ?? $sql;

        // PostgreSQL spells MySQL's MODIFY COLUMN as ALTER COLUMN TYPE.
        $sql = preg_replace_callback(
            '/ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+MODIFY\s+(?:COLUMN\s+)?([a-zA-Z0-9_]+)\s+([^;]+)(;?)/i',
            static function (array $m) use (&$indexes): string {
                $definition = trim($m[3]);
                $type = trim(preg_split('/\s+(?:NOT\s+NULL|NULL|DEFAULT)\b/i', $definition)[0] ?? 'TEXT');
                if (preg_match('/\bNOT\s+NULL\b/i', $definition)) {
                    $indexes[] = 'ALTER TABLE ' . $m[1] . ' ALTER COLUMN ' . $m[2] . ' SET NOT NULL';
                } elseif (preg_match('/\bNULL\b/i', $definition)) {
                    $indexes[] = 'ALTER TABLE ' . $m[1] . ' ALTER COLUMN ' . $m[2] . ' DROP NOT NULL';
                }
                if (preg_match('/\bDEFAULT\s+(.+)$/i', $definition, $defaultMatch)) {
                    $indexes[] = 'ALTER TABLE ' . $m[1] . ' ALTER COLUMN ' . $m[2] . ' SET DEFAULT ' . trim($defaultMatch[1]);
                }
                return 'ALTER TABLE ' . $m[1] . ' ALTER COLUMN ' . $m[2] . ' TYPE ' . $type . $m[4];
            },
            $sql
        ) ?? $sql;

        return [$sql, $indexes];
    }
}
