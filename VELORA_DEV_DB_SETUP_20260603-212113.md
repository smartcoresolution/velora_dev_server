# VELORA Development DB Setup Log

작성일: 2026-06-03 21:21:13 KST

## 작업 목적

개발환경에서 사용자 로그인, 이메일 기반 계정/비밀번호 관리, 안내문 서명 기록, 음성파일 관리, 분석 이력, 보안 감사 로그를 저장할 PostgreSQL DB를 구성했다.

전화번호는 개인정보 최소수집 원칙에 따라 DB 설계에서 제외했다.

## 개발 DB 구성

```text
DBMS: PostgreSQL
Host: 127.0.0.1
Port: 5432
Database: velora_dev
Application user: velora_app
Password file: /root/velora/ops/generated-dev-db-password.txt
```

백엔드 연결 문자열은 다음 형식이다.

```text
DATABASE_URL=postgresql+psycopg://velora_app:<password>@127.0.0.1:5432/velora_dev
```

비밀번호 원문은 코드나 문서에 기록하지 않고 `/root/velora/ops/generated-dev-db-password.txt`에서 읽도록 구성했다.

## 추가한 파일

```text
/root/velora/ops/dev_schema.sql
/root/velora/ops/setup_dev_db.sh
/root/velora/ops/run_dev_backend.sh
```

### dev_schema.sql

개발 DB 전체 스키마 파일이다. 운영 기본 스키마와 호환되는 컬럼을 유지하면서 로그인/보안/서명/분석 job 관련 테이블을 추가했다.

### setup_dev_db.sh

개발 DB를 재생성 또는 재적용할 때 사용하는 스크립트다.

```bash
/root/velora/ops/setup_dev_db.sh
```

수행 내용:

```text
1. PostgreSQL 서비스 시작 시도
2. dev DB 비밀번호 파일 생성 또는 재사용
3. velora_app role 생성 또는 비밀번호 갱신
4. velora_dev database 생성
5. ops/dev_schema.sql 적용
6. velora_app 권한 부여
7. 테이블 목록 검증
```

### run_dev_backend.sh

개발 백엔드 실행 시 DB 환경변수와 업로드 경로, 모델 경로를 함께 설정하는 스크립트다.

```bash
/root/velora/ops/run_dev_backend.sh
```

기본 실행 주소:

```text
http://127.0.0.1:8000
```

## 생성된 테이블

총 14개 테이블을 생성했다.

```text
users
auth_sessions
email_verification_tokens
password_reset_tokens
email_change_tokens
consents
signed_notices
audio_files
voice_samples
analysis_jobs
analysis_results
notices
board_posts
audit_logs
```

## 주요 설계 내용

### 사용자 계정

`users` 테이블은 로그인 계정과 권한 상태를 관리한다.

주요 필드:

```text
email
password_hash
user_name
age_group
role
status
email_verified_at
last_login_at
failed_login_count
locked_until
password_changed_at
withdrawn_at
```

전화번호 필드는 추가하지 않았다.

### 이메일 기반 계정 관리

아래 테이블로 이메일 인증, 비밀번호 재설정, 이메일 변경을 관리한다.

```text
email_verification_tokens
password_reset_tokens
email_change_tokens
```

토큰 원문은 DB에 저장하지 않고 `token_hash`만 저장하는 구조로 설계했다.

### 로그인 세션

`auth_sessions` 테이블은 refresh token hash, 만료 시각, 폐기 시각, 접속 IP, user-agent를 관리한다.

비밀번호 변경 또는 계정 잠금 시 기존 세션을 폐기할 수 있는 구조다.

### 동의와 서명

`consents`는 개인정보 처리, 데이터 수집, 비의료 고지, 제3자 음성 포함 가능성에 대한 체크 동의를 저장한다.

`signed_notices`는 사용자가 실제로 본 안내문과 서명 기록을 저장한다.

주요 필드:

```text
notice_type
notice_version
title
body_snapshot
signer_name
signature_text
signed_at
ip_address
user_agent
```

`body_snapshot`을 저장해 안내문이 나중에 바뀌더라도 사용자가 당시 어떤 문구에 서명했는지 보존할 수 있게 했다.

### 음성파일 관리

`audio_files`는 사용자가 업로드한 통화 음성 파일의 메타데이터와 상태를 저장한다.

실제 파일은 파일시스템에 저장하고, DB에는 경로와 품질검사 결과, 보관/삭제 상태를 기록한다.

상태값:

```text
uploaded
converted
rejected
analyzed
raw_deleted
deleted
```

### 음성 샘플 관리

`voice_samples`는 자녀 음성 샘플을 저장한다. 화자 구분용 embedding, 파일 경로, 삭제 상태를 관리한다.

상태값:

```text
active
replaced
deleted
```

### 분석 이력

`analysis_jobs`는 분석 요청의 진행 상태를 관리한다.

상태값:

```text
queued
processing
completed
failed
```

`analysis_results`는 분석 완료 결과, 위험도, 모델 확률값, 전체 결과 payload를 저장한다.

### 감사 로그

`audit_logs`는 로그인 성공/실패, 파일 업로드/삭제, 결과 조회, 관리자 접근 등 보안상 중요한 이벤트를 기록한다.

## 검증 결과

`velora_app` 계정으로 `velora_dev` 접속을 확인했다.

```text
db: velora_dev
app_user: velora_app
table_count: 14
```

백엔드 SQLAlchemy 경로에서도 조회를 확인했다.

```text
from app.database import fetch_one
fetch_one('select count(*) as users from users')

결과: {'users': 0}
```

## 실행 방법

개발 DB 재설정:

```bash
/root/velora/ops/setup_dev_db.sh
```

백엔드 개발 서버 실행:

```bash
/root/velora/ops/run_dev_backend.sh
```

프론트엔드 개발 서버 실행:

```bash
cd /root/velora/velora-frontend
npm run dev
```

프론트엔드의 `/api` 요청은 `velora-frontend/vite.config.ts` 설정에 따라 `http://localhost:8000`으로 프록시된다.

## 참고

생성 비밀번호 파일은 `.gitignore`의 `ops/generated-*-password.txt` 규칙에 의해 제외된다.

개발 DB 스키마는 운영 스키마와 분리되어 있으며, 운영 적용 전에는 별도 migration 검토가 필요하다.
