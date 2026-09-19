#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT="${BACKUP_DIR}/well-drilling-${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"
pg_dump "$DATABASE_URL" --format=custom --no-owner --file "$OUTPUT"
sha256sum "$OUTPUT" > "${OUTPUT}.sha256"
echo "Backup created: ${OUTPUT}"
