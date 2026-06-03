#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/root/velora}"
BACKEND_ROOT="${BACKEND_ROOT:-${APP_ROOT}/velora-backend}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-velora_dev}"
DB_USER="${DB_USER:-velora_app}"
DB_PASSWORD_FILE="${DB_PASSWORD_FILE:-${APP_ROOT}/ops/generated-dev-db-password.txt}"
BACKEND_ENV="${BACKEND_ENV:-${APP_ROOT}/tools/conda-envs/velora-backend}"

if [[ ! -s "${DB_PASSWORD_FILE}" ]]; then
  echo "Missing dev DB password file: ${DB_PASSWORD_FILE}" >&2
  echo "Run the dev DB setup first." >&2
  exit 1
fi

DB_PASSWORD="$(tr -d '\r\n' < "${DB_PASSWORD_FILE}")"

export DATABASE_URL="postgresql+psycopg://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
export VELORA_FORCE_CPU="${VELORA_FORCE_CPU:-true}"
export CUDA_VISIBLE_DEVICES="${CUDA_VISIBLE_DEVICES:--1}"
export VELORA_LIGHTWEIGHT_INFERENCE="${VELORA_LIGHTWEIGHT_INFERENCE:-1}"
export VELORA_COGNITIVE_MODEL_PATH="${VELORA_COGNITIVE_MODEL_PATH:-${APP_ROOT}/normal_mci_ad_task-ALL_best.h5}"
export VELORA_COGNITIVE_METADATA_PATH="${VELORA_COGNITIVE_METADATA_PATH:-${APP_ROOT}/normal_mci_ad_task-ALL_metadata.json}"
export VELORA_UPLOAD_DIR="${VELORA_UPLOAD_DIR:-/tmp/velora_uploads}"
export VELORA_PROCESSED_DIR="${VELORA_PROCESSED_DIR:-/tmp/velora_processed}"
export VELORA_VOICE_SAMPLES_DIR="${VELORA_VOICE_SAMPLES_DIR:-/tmp/velora_voice_samples}"

cd "${BACKEND_ROOT}"

if [[ -x "${BACKEND_ENV}/bin/uvicorn" ]]; then
  exec "${BACKEND_ENV}/bin/uvicorn" app.main:app --host 127.0.0.1 --port 8000
fi

exec uvicorn app.main:app --host 127.0.0.1 --port 8000
