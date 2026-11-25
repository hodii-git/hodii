#!/usr/bin/env bash
# Backs up the Hodii database to a compressed archive and keeps the newest N.
#   MONGODB_URI=... MONGODB_DB=hodii ./scripts/backup.sh [output-dir] [keep]
# Needs `mongodump` (MongoDB Database Tools). Schedule it (cron, a CI job or a small server). See docs/operations.md.
set -euo pipefail
: "${MONGODB_URI:?Set MONGODB_URI}"
DB="${MONGODB_DB:-hodii}"
OUT="${1:-./backups}"
KEEP="${2:-14}"
mkdir -p "$OUT"
FILE="$OUT/${DB}-$(date -u +%Y%m%dT%H%M%SZ).archive.gz"
# --uri carries the credentials; the archive holds personal data, so keep it private (chmod 600) and store it encrypted.
mongodump --uri="$MONGODB_URI" --db="$DB" --archive="$FILE" --gzip \
  --excludeCollection=userSessions --excludeCollection=adminSessions --excludeCollection=pageViews --excludeCollection=propertyEvents
chmod 600 "$FILE"
echo "Wrote $FILE ($(du -h "$FILE" | cut -f1))"
# Drop all but the newest $KEEP archives.
ls -1t "$OUT"/"${DB}"-*.archive.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm --
