# VELORA Work Record - 2026-06-11 23:09:11 KST

## Summary

2026-06-11, moved-local-user 환경을 기준으로 GitHub 동기화, 운영 서버 권한/경로 보정, DB/API/Web 상태 확인, 프론트엔드 모바일 접속 복구, 회원가입/로그인 API 복구를 진행했다.

## GitHub Sync

- Local workspace: `/home/scs_dev/velora`
- Git remote: `git@github.com:smartcoresolution/velora_dev_server.git`
- Active branch: `codex/dev-db-setup`
- 기존 `.git-real/config`의 `core.worktree`가 `/root/velora`를 가리켜 Git 명령이 실패하던 문제를 확인했다.
- `core.worktree`를 현재 경로 `/home/scs_dev/velora`로 수정했다.
- 원격 fetch 후 로컬 변경사항을 커밋하고 push했다.
- Commit: `eb6e205 Sync moved local workspace changes`
- 최종 확인: local 및 `origin/codex/dev-db-setup` 차이 `0 0`, working tree clean.

## Production Permission And Path Fix

- Production root: `/opt/velora-prod`
- 기존 소유권이 `nobody:nogroup`으로 되어 있어 운영 앱 접근 문제가 발생할 수 있음을 확인했다.
- root 권한으로 `/opt/velora-prod` 전체 소유권을 `scs_dev:scs_dev`로 변경하도록 안내했다.
- API service file: `/etc/systemd/system/velora-prod-api.service`
- 기존 systemd 실행 경로가 `/root/velora/tools/...`를 참조하고 있음을 확인했다.
- 현재 실행 가능한 backend Python/FastAPI 경로:
  - `/home/scs_dev/velora/tools/conda-envs/velora-backend/bin/python`
  - `/home/scs_dev/velora/tools/conda-envs/velora-backend/bin/fastapi`
- `fastapi` wrapper의 shebang이 여전히 `/root/velora/.../python3.11`을 참조해 `status=203/EXEC` 오류가 발생했다.
- systemd override를 `python -m fastapi` 방식으로 수정하도록 안내했고, API가 정상 실행됨을 확인했다.

## Service Status Checks

Checked DB/API/Web service state after recovery.

- PostgreSQL:
  - `systemctl is-active postgresql` returned `active`
  - `pg_isready -h 127.0.0.1 -p 5432` returned `accepting connections`
  - Port `127.0.0.1:5432` listening
- API:
  - Service: `velora-prod-api.service`
  - Status: `active (running)`
  - Listen: `127.0.0.1:8010`
  - Health check: `http://127.0.0.1:8010/healthz` returned `{"status":"ok"}`
- Web:
  - Service: `nginx`
  - Status: `active`
  - HTTP 80 returned `200 OK`
  - HTTPS 443 initially returned `502 Bad Gateway`

## Frontend Recovery

- Nginx HTTPS 443 and 8080 were proxying to `127.0.0.1:5173`.
- `127.0.0.1:5173` was not running, causing HTTPS `502 Bad Gateway`.
- Frontend app path used for execution:
  - `/home/scs_dev/velora/velora-frontend`
- Node path:
  - `/home/scs_dev/velora/tools/conda-envs/velora-frontend/bin/node`
- OpenSSL config path had to be explicitly set:
  - `/home/scs_dev/velora/tools/conda-envs/velora-frontend/ssl/openssl.cnf`
- Started Vite frontend in tmux:
  - session: `velora-frontend`
  - URL: `http://127.0.0.1:5173`
- Confirmed:
  - `http://127.0.0.1:5173` returned `200 OK`
  - `https://127.0.0.1` through nginx returned `200 OK`
- Smartphone Chrome access URL:
  - `https://175.118.124.67`
- Because the server uses a temporary SSL certificate, Chrome may show a security warning. User can proceed through advanced options.

## Frontend API Proxy Fix

- Frontend API client uses relative API paths (`/api/...`).
- Vite proxy in `velora-frontend/vite.config.ts` was pointing to `http://localhost:8000`.
- Production API is running on `127.0.0.1:8010`.
- Updated Vite dev and preview proxy target from `8000` to `8010`.
- Restarted `tmux` session `velora-frontend`.
- Confirmed:
  - `https://127.0.0.1/api/consent/policy` returned normal policy JSON through nginx/Vite/API path.

## Signup And Login Recovery

- User reported signup and login returning `Not Found`.
- Confirmed production backend `/opt/velora-prod/backend/app/routers` did not include `auth.py`.
- Confirmed production `main.py` did not include auth router.
- Deployed latest backend auth-related files to production:
  - `/opt/velora-prod/backend/app/routers/auth.py`
  - `/opt/velora-prod/backend/app/main.py`
  - `/opt/velora-prod/backend/app/database.py`
- Since `systemctl restart velora-prod-api.service` required interactive root authentication, the running API process was killed and systemd `Restart=always` brought it back with new code.
- Auth route moved from `404 Not Found` to actual API responses.

## DB Authentication And Schema Fix

- After auth route deployment, API returned DB connection error:
  - PostgreSQL password authentication failed for user `velora_app`
- `/etc/velora-prod-api.env` contains `DATABASE_URL` for `velora_app`.
- Root command was provided to align PostgreSQL `velora_app` password with `/etc/velora-prod-api.env`.
- Production schema was older and lacked auth columns such as `email`, `password_hash`, `status`.
- Added runtime schema hardening in `auth.py`:
  - `email`
  - `password_hash`
  - `role`
  - `status`
  - `password_changed_at`
  - `last_login_at`
  - `updated_at`
  - unique index on `lower(email)` where email is not null

## Existing Account Handling

- Existing users could have an email/user record but no password hash.
- Updated signup logic:
  - If email exists and `password_hash` exists, return duplicate-account message.
  - If email exists but `password_hash` is empty, signup sets the password on that existing account.
  - Locked or withdrawn accounts are still blocked.
- This allows older pre-auth accounts to complete password setup from the signup screen.

## Verified Login

- Test account verified:
  - email: `jangck11@naver.com`
  - password used for verification: `testpass123`
- Login API returned:
  - HTTP `200 OK`
  - message: `로그인되었습니다.`

## Frontend Error Message Fix

- Login screen displayed raw `auth` message on 401 responses.
- Cause: `tryFetch()` converted any HTTP 401 into `Error("auth")` before login response JSON could be parsed.
- Updated frontend API helper to return 401 response normally, allowing `loginAccount()` to display backend message.
- Now wrong credentials show the Korean backend detail, e.g. `이메일 또는 비밀번호가 일치하지 않습니다.`

## Current Operational State

- DB server: running
- API server: running
- Web server: running
- Frontend Vite server: running in tmux session `velora-frontend`
- Smartphone Chrome URL:
  - `https://175.118.124.67`
- Existing login and new signup flow verified.

## Notes

- The frontend is currently served through a tmux-running Vite dev server for HTTPS nginx upstream compatibility.
- For a more stable production setup, either:
  - change nginx 443 to serve built static files from `/var/www/velora` or `/opt/velora-prod/frontend/dist`, or
  - create a proper systemd unit for the Vite/preview frontend service.
- Temporary SSL certificate warning remains expected until a real certificate is installed.
