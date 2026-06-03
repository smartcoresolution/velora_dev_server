#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/root/velora}"
DB_NAME="${DB_NAME:-velora_dev}"
DB_USER="${DB_USER:-velora_app}"
DB_PASSWORD_FILE="${DB_PASSWORD_FILE:-${APP_ROOT}/ops/generated-dev-db-password.txt}"
SCHEMA_FILE="${SCHEMA_FILE:-${APP_ROOT}/ops/dev_schema.sql}"

if [[ ! -s "${SCHEMA_FILE}" ]]; then
  echo "Missing schema file: ${SCHEMA_FILE}" >&2
  exit 1
fi

if [[ -s "${DB_PASSWORD_FILE}" ]]; then
  DB_PASSWORD="$(tr -d '\r\n' < "${DB_PASSWORD_FILE}")"
else
  DB_PASSWORD="$(openssl rand -hex 24)"
  old_umask="$(umask)"
  umask 077
  printf '%s\n' "${DB_PASSWORD}" > "${DB_PASSWORD_FILE}"
  umask "${old_umask}"
  echo "Generated dev DB password at ${DB_PASSWORD_FILE}"
fi

if command -v systemctl >/dev/null 2>&1; then
  systemctl start postgresql
fi

run_as_postgres() {
  if command -v sudo >/dev/null 2>&1; then
    sudo -u postgres "$@"
  else
    su -s /bin/sh postgres -c "$(printf '%q ' "$@")"
  fi
}

run_as_postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
SQL

install -m 0644 "${SCHEMA_FILE}" /tmp/velora-dev-schema.sql
run_as_postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f /tmp/velora-dev-schema.sql
run_as_postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};"
run_as_postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};"

PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -p 5432 -U "${DB_USER}" -d "${DB_NAME}" -c '\dt'
