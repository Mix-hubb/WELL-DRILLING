#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_FILE:?BACKUP_FILE is required}"
: "${CONFIRM_RESTORE:?Set CONFIRM_RESTORE=YES to restore a backup}"

if [ "$CONFIRM_RESTORE" != "YES" ]; then
  echo "Refusing restore: set CONFIRM_RESTORE=YES explicitly." >&2
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

if [ -f "${BACKUP_FILE}.sha256" ]; then
  sha256sum --check "${BACKUP_FILE}.sha256"
fi

pg_restore "$DATABASE_URL" --clean --if-exists --no-owner --exit-on-error "$BACKUP_FILE"
echo "Restore completed from: ${BACKUP_FILE}"
