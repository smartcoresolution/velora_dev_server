# VELORA Work Record - 20260604-112523 KST

## 목적

스마트폰에서 원격 개발 서버의 VELORA 앱을 테스트할 수 있도록 프론트/백엔드 실행, HTTPS 접근, 로그인 DB 저장, 자녀 음성/부모님 통화녹음 업로드 흐름을 개선했다.

## 접속 및 서버 설정

- 개발 프론트 Vite 서버를 원격 서버에서 실행 중이다.
  - 내부: `http://127.0.0.1:5173`
  - 외부 nginx 프록시:
    - `https://175.118.124.67`
    - `https://175.118.124.67:8080`
- 기존 `http://175.118.124.67:8080`도 사용 가능했으나, 파일 탐색기 API 테스트를 위해 HTTPS를 추가했다.
- nginx 설정을 수정했다.
  - `443 ssl` 서버 블록 추가
  - `8080 ssl` 서버 블록으로 변경
  - 둘 다 `127.0.0.1:5173`으로 프록시
  - 임시 self-signed 인증서 사용:
    - `/etc/ssl/certs/ssl-cert-snakeoil.pem`
    - `/etc/ssl/private/ssl-cert-snakeoil.key`
- nginx 설정 백업:
  - `ops/nginx-velora-before-dev-8080.conf`
  - `ops/nginx-velora-before-https-dev.conf`

## 스마트폰 접속 주소

테스트 권장 주소:

```text
https://175.118.124.67
```

기존 포트 주소도 HTTPS로 동작하도록 변경:

```text
https://175.118.124.67:8080
```

주의:

- 현재는 IP + self-signed 인증서라 Chrome 보안 경고가 나올 수 있다.
- 테스트 시 `고급` 또는 `계속 진행`으로 접속해야 한다.
- 운영/장기 개발용으로는 도메인 + 정식 SSL 인증서가 필요하다.

## 로그인/회원가입 변경

기존 문제:

- 로그인 정보가 프론트 `localStorage`에 저장되어 브라우저/세션에 의존했다.
- 백엔드 재시작 또는 테스트 환경 변경 시 로그인 상태가 불안정했다.

변경 내용:

- 테스트 계정용 DB 인증 API 추가:
  - `POST /api/auth/signup`
  - `POST /api/auth/login`
- 비밀번호는 평문 저장이 아니라 PBKDF2 해시로 저장한다.
- 프론트 회원가입/로그인은 백엔드 DB API를 사용한다.

수정 파일:

- `velora-backend/app/routers/auth.py`
- `velora-backend/app/main.py`
- `velora-backend/app/database.py`
- `velora-frontend/src/lib/api.ts`
- `velora-frontend/src/App.tsx`

테스트 계정:

```text
velora-test@example.com / 1234
```

## Chrome 자동 번역/비밀번호 팝업 대응

자동 번역 팝업:

- `index.html`의 `lang="en"` 때문에 Chrome이 번역 팝업을 띄웠다.
- `lang="ko"`와 `meta name="google" content="notranslate"`로 수정했다.

비밀번호 관리자 팝업:

- Chrome의 저장/유출 비밀번호 확인 팝업을 줄이기 위해 비밀번호 필드를 조정했다.
- 테스트 앱에서는 `type="password"` 대신 `type="text"` + `-webkit-text-security: disc`로 마스킹했다.

수정 파일:

- `velora-frontend/index.html`
- `velora-frontend/src/pages/LoginPage.tsx`
- `velora-frontend/src/pages/SignupPage.tsx`
- `velora-frontend/src/pages/AdminLoginPage.tsx`

## 자녀 음성 등록 흐름

기존 문제:

- 브라우저 내장 `MediaRecorder` 방식은 스마트폰에서 녹음 중/종료 상태가 명확하지 않았다.
- Android 파일 선택기가 카메라/음성 녹음/사진 및 동영상 작업 선택 화면을 자주 띄웠다.
- 자녀 음성 샘플 등록을 사용자가 별도로 눌러야 해서, 샘플 ID가 없으면 분석 시작 버튼이 비활성화됐다.

변경 내용:

- 브라우저 내장 녹음 로직을 제거하고 스마트폰 녹음기/capture input 방식으로 변경했다.
- 자녀 음성을 녹음/선택하면 자동으로 `uploadVoiceSample`을 실행한다.
- 자녀 음성 등록 상태 문구를 표시한다.
  - `자녀 음성 샘플을 등록하고 있습니다.`
  - `자녀 음성 샘플 등록이 완료되었습니다.`
- 자녀 샘플 등록 완료 + 부모님 파일 품질 통과 시 자동 분석 진행 또는 버튼 활성화가 가능하도록 수정했다.

수정 파일:

- `velora-frontend/src/pages/UploadPage.tsx`

## 부모님 통화녹음 업로드 흐름

기존 문제:

- 파일 선택 시 Android 작업 선택 화면이 계속 표시됐다.
- 부모님 통화녹음 업로드 후 품질 통과가 되어도 분석 시작 버튼이 활성화되지 않는 경우가 있었다.
- 업로드가 오래 걸리는 것처럼 보였으나, 서버 처리 시간과 전송 시간을 구분하기 어려웠다.

변경 내용:

- 버튼 문구 변경:
  - `내 파일에서 통화녹음 선택`
- 부모님 통화녹음 fallback input은 `.m4a`만 허용하도록 축소했다.
- HTTPS에서 `showOpenFilePicker`를 우선 사용하도록 시도한다.
- 부모님 통화녹음 품질 통과 + 자녀 샘플 ID 존재 시 자동 분석으로 진행한다.
- 프론트 업로드 상태 문구 추가:
  - `파일을 서버로 전송하고 있습니다.`
  - `전송 및 품질 검사 중...`
  - `서버 품질 검사가 완료되었습니다.`

수정 파일:

- `velora-frontend/src/pages/UploadPage.tsx`

## 백엔드 업로드 시간 로깅

부모님 통화녹음 업로드 병목 확인을 위해 단계별 시간 로그를 추가했다.

로그 예:

```text
[upload_audio] file=... bytes=... read=... save=... convert=... quality=... db=... total=...
```

최근 확인된 서버 처리:

```text
normal_02_hospital_medicine_dialogue.wav
bytes=2595418
read=0.00~0.17s
convert=0.07~0.09s
quality=0.04~2.21s
total=0.14~2.46s
```

서버 처리 자체는 빠른 편이며, 느림은 주로 스마트폰 → 서버 전송 또는 파일 선택/브라우저 UX 구간일 가능성이 높다.

수정 파일:

- `velora-backend/app/routers/upload.py`

## 최근 확인된 DB 상태

부모님 통화녹음 파일:

```text
normal_02_hospital_medicine_dialogue.wav
duration_seconds: 81.11
quality_pass: true
```

자녀 음성 샘플:

```text
음성 260604_105448.m4a
duration_seconds: 3.14

음성 260604_104425.m4a
duration_seconds: 11.14
```

주의:

- 자녀 샘플이 3초 미만이면 백엔드에서 `400 Bad Request`가 난다.
- 자녀 샘플은 현재 최소 3초, 최대 30초 제한이다.

## 검증한 명령

프론트 빌드:

```bash
PATH=/root/velora/tools/conda-envs/velora-frontend/bin:$PATH npm run build
```

백엔드 컴파일:

```bash
PATH=/root/velora/tools/conda-envs/velora-backend/bin:$PATH python -m compileall velora-backend/app
```

백엔드 실행:

```bash
./ops/run_dev_backend.sh
```

헬스체크:

```bash
curl -sS http://127.0.0.1:8000/healthz
```

HTTPS 확인:

```bash
curl -k -I https://175.118.124.67
curl -k -I https://175.118.124.67:8080
curl -k -sS https://175.118.124.67:8080/api/consent/policy
```

## 현재 실행 중인 주요 서비스

- Vite dev frontend:
  - `0.0.0.0:5173`
- Backend:
  - `127.0.0.1:8000`
- Existing production-ish backend:
  - `127.0.0.1:8010`
- nginx:
  - `80`
  - `443 ssl`
  - `8080 ssl`

## 남은 이슈 / 다음에 이어서 볼 것

1. Android Chrome 파일 선택 UX
   - HTTPS 적용 후에도 기기 정책에 따라 작업 선택 화면이 남을 수 있다.
   - `showOpenFilePicker`가 실제 스마트폰 Chrome에서 동작하는지 확인 필요.

2. self-signed 인증서
   - 현재는 테스트용 임시 인증서라 Chrome 경고가 뜬다.
   - 장기 사용에는 도메인 + 정식 SSL 인증서 필요.

3. 자녀 음성 샘플 길이
   - 최소 3초 제한 때문에 짧은 녹음은 실패한다.
   - 화면에서 더 명확하게 안내하거나, 최소 길이를 늘려 UI와 맞출지 결정 필요.

4. 분석 시작 버튼
   - 현재 조건: `fileId && quality.quality_pass && voiceSampleId`
   - 자동 자녀 샘플 등록 후에도 버튼이 비활성화되면 `voiceSampleId` 상태가 실제로 들어오는지 확인해야 한다.

5. 업로드 병목
   - 새 업로드 후 백엔드 로그의 `[upload_audio]` 값을 확인하면 병목 단계 파악 가능.

