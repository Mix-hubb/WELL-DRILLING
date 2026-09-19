#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

for migration in supabase/migrations/0001_init.sql \
  supabase/migrations/0002_well_detail_and_pump_catalog.sql \
  supabase/migrations/0003_password_reset.sql; do
  echo "Applying ${migration}"
  psql "$DATABASE_URL" --set ON_ERROR_STOP=1 --file "$migration"
done

echo "Applying backend/src/db/migration_multi_tenant.sql"
psql "$DATABASE_URL" --set ON_ERROR_STOP=1 --file backend/src/db/migration_multi_tenant.sql

echo "Applying supabase/migrations/0004_payment_slips_and_line_bot_user_id.sql"
psql "$DATABASE_URL" --set ON_ERROR_STOP=1 --file supabase/migrations/0004_payment_slips_and_line_bot_user_id.sql

echo "Applying backend/src/db/migration_indexes.sql"
psql "$DATABASE_URL" --set ON_ERROR_STOP=1 --file backend/src/db/migration_indexes.sql

if [ "${APPLY_LEGACY_LINE_MIGRATION:-}" = "true" ]; then
  echo "Applying backend/src/db/migration_line_bot_user_id.sql"
  psql "$DATABASE_URL" --set ON_ERROR_STOP=1 --file backend/src/db/migration_line_bot_user_id.sql
fi

echo "All migrations applied."
