#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/root/velora/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="${BACKUP_ROOT}/${STAMP}"

mkdir -p "${DEST}"
chmod 700 "${BACKUP_ROOT}" "${DEST}"

run_as_postgres() {
  if command -v sudo >/dev/null 2>&1; then
    sudo -u postgres "$@"
  else
    su -s /bin/sh postgres -c "$(printf '%q ' "$@")"
  fi
}

run_as_postgres pg_dump -Fc velora_prod > "${DEST}/velora_prod.dump"
run_as_postgres pg_dump -s velora_prod > "${DEST}/velora_prod_schema.sql"

tar -czf "${DEST}/velora_prod_config.tgz" \
  /etc/nginx/sites-available/velora \
  /etc/systemd/system/velora-prod-api.service \
  /etc/velora-prod-api.env \
  /root/velora/ops/prod_schema.sql \
  /root/velora/ops/rebuild_prod.sh

sha256sum "${DEST}"/* > "${DEST}/SHA256SUMS"
find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime +"${RETENTION_DAYS}" -exec rm -rf {} +

echo "Backup complete: ${DEST}"
