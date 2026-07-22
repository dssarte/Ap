-- FCG HelpDesk: export every row from every table in the public schema
--
-- HOW TO USE
--   1. Open the Supabase SQL Editor and run this entire file.
--   2. In the final results grid, click Download CSV.
--   3. Store the downloaded file securely; it contains production data.
--
-- IMPORTANT LIMITATIONS
--   - This is an application-data snapshot, not a full PostgreSQL backup.
--   - It does not include table definitions, functions, RLS policies, roles,
--     Auth users, Storage objects, or the uploaded attachment files themselves.
--   - Use Supabase CLI `db dump` for a complete restorable database backup.
--   - The temporary table is session-only and does not modify application data.

DROP TABLE IF EXISTS pg_temp.fcg_public_data_export;

CREATE TEMP TABLE fcg_public_data_export (
  schema_name text NOT NULL,
  table_name text NOT NULL,
  row_number bigint NOT NULL,
  row_data jsonb
);

DO $$
DECLARE
  source_table record;
BEGIN
  FOR source_table IN
    SELECT tables.table_schema, tables.table_name
    FROM information_schema.tables
    WHERE tables.table_schema = 'public'
      AND tables.table_type = 'BASE TABLE'
    ORDER BY tables.table_name
  LOOP
    EXECUTE format(
      'INSERT INTO pg_temp.fcg_public_data_export '
      || '(schema_name, table_name, row_number, row_data) '
      || 'SELECT %L, %L, row_number() OVER (), to_jsonb(source_row) '
      || 'FROM %I.%I AS source_row',
      source_table.table_schema,
      source_table.table_name,
      source_table.table_schema,
      source_table.table_name
    );
  END LOOP;
END;
$$;

-- Download this final result as CSV. Each row_data value is one complete table
-- row represented as JSON, preserving JSON columns and null values.
SELECT
  schema_name,
  table_name,
  row_number,
  row_data::text AS row_json
FROM pg_temp.fcg_public_data_export
ORDER BY table_name, row_number;
