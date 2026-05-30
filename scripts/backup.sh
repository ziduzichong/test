#!/bin/bash
set -e
BACKUP_BASE="backups"
DB_DIR="$BACKUP_BASE/$(date +%Y%m%d-%H%M)-db"
mkdir -p "$DB_DIR"

cp data/db.sqlite3 "$DB_DIR/" 2>/dev/null || true
cp data/db.sqlite3-wal "$DB_DIR/" 2>/dev/null || true
cp data/db.sqlite3-shm "$DB_DIR/" 2>/dev/null || true

rsync -a --delete media/uploads/ "$BACKUP_BASE/latest/uploads/" 2>/dev/null || true

if [ "$(date +%u)" = "7" ]; then
    SNAPSHOT="$BACKUP_BASE/weekly-$(date +%Y%m%d)"
    mkdir -p "$SNAPSHOT/uploads"
    cp data/db.sqlite3 "$SNAPSHOT/"
    rsync -a media/uploads/ "$SNAPSHOT/uploads/"
fi

find "$BACKUP_BASE" -name "*-db" -mtime +30 -exec rm -rf {} \; 2>/dev/null || true
find "$BACKUP_BASE" -name "weekly-*" -mtime +56 -exec rm -rf {} \; 2>/dev/null || true

echo "[$(date)] Backup complete: $DB_DIR"
