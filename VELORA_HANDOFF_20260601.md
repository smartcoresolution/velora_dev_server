# VELORA 작업 인수인계 메모

작성 시각: 2026-06-01 00:11 KST

## 오늘까지 정리한 서비스 방향

- VELORA는 치매 진단 앱이 아니라, 통화 음성 또는 본인 음성을 통해 인지기능 변화 관련 위험 신호를 비의료적으로 참고하는 서비스로 정리했다.
- 현재 우선 흐름은 `부모님 통화 검증`이다.
- 향후 추가 후보로 `50~60대 여성 본인검증` 모드를 논의했다.
  - 다음 작업에서 `서비스 시작` 화면에 `부모님 통화 검증`, `내 목소리 검증`, `지난 검증 이력`을 나누는 방향이 좋다.

## 프론트엔드 주요 수정

수정 위치: `/root/velora/velora-frontend`

### 회원가입

- 회원가입에서 `자녀 연령대` 제거.
- 회원가입에서 `자녀 이름` 제거.
- 현재 회원가입 필수 항목:
  - 이메일
  - 비밀번호
  - 비밀번호 확인
- 개인정보 최소 수집 원칙에 맞게 정리했다.
- 관련 파일:
  - `src/pages/SignupPage.tsx`
  - `src/App.tsx`

### 동의 절차

- 동의 화면에서 `자녀 이름`, `자녀 연령대` 표시 제거.
- 백엔드 API가 내부적으로 `age_group`을 요구하므로 화면에는 보이지 않게 기본값 `other`를 전달한다.
- `user_name`은 `undefined`로 전달한다.
- 관련 파일:
  - `src/pages/ConsentPage.tsx`
  - `src/App.tsx`

### 화면 흐름

- 신규 회원:
  - `회원가입 → 동의 절차 → 새 검증`
- 기존 회원:
  - `로그인 → 서비스 시작 → 새 검증 시작 → 동의 절차 → 새 검증`
- 같은 세션에서 이미 동의 토큰이 있으면 새 검증으로 바로 이동한다.
- 지난 검증 결과에서 뒤로 가면 새 검증이 아니라 지난 검증 이력으로 돌아가도록 수정했다.
- 로그인하지 않은 계정으로 로그인되지 않도록 수정했다.
- 검증 이력은 로그인한 이메일별로 분리 저장되도록 수정했다.
- 중복 저장되는 검증 이력은 `analysis_id`와 결과 signature 기준으로 제거한다.

### 자녀 음성 녹음

- 안내 문장을 20초 이상 읽을 수 있도록 더 길게 수정했다.
- 녹음 중 컨트롤 추가:
  - `녹음 멈춤`
  - `다시 녹음`
  - `녹음 끝내기`
- 녹음한 자녀 음성 다운로드 버튼 유지.
- 관련 파일:
  - `src/pages/UploadPage.tsx`

### 결과 화면

- `Normal / MCI / AD` 직접 표시 대신 사용자용 문구로 표시:
  - `인지기능 위험 낮음`
  - `인지기능 변화 가능성 있음`
  - `치매 관련 위험 신호 높음`
- 결과 첫 카드에는 가장 가까운 패턴만 크게 표시.
- 불필요한 중복 카드와 경고 아이콘 제거.
- `결과 신뢰도 보기`에는 상세 수치를 설명형 카드로 정리.
- 관련 파일:
  - `src/pages/ResultsPage.tsx`
  - `src/pages/ReliabilityPage.tsx`

### 지난 검증 이력

- 이력 목록에는 검증 날짜와 결과 신뢰도 요약 중심으로 표시.
- 삭제 기능 추가.
- 상단에 최근 검증 요약 카드와 날짜별 막대 그래프 추가.
- `검증 이후 후속 대응`, `변화 추적 이력보기` 같은 불필요 버튼은 제거.
- 관련 파일:
  - `src/pages/HistoryPage.tsx`

## 백엔드 주요 수정

수정 위치: `/root/velora/velora-backend`

### DB 없는 테스트 환경 대응

- `DATABASE_URL`이 없을 때 500 오류가 나지 않도록 보완.
- 테스트 환경에서는 DB 저장을 건너뛰고 메모리 저장소로 동의, 업로드, 분석 흐름을 진행한다.
- 관련 파일:
  - `app/database.py`
  - `app/routers/consent.py`

### 데모값 반복 문제 해결

- 프론트에서 API 실패 시 조용히 데모 결과 `48 / 36 / 16`으로 넘어가던 로직 제거.
- 이제 API 실패 시 오류를 표시한다.
- 기존 데모 이력은 지난 검증 이력에서 제외되도록 처리.
- 관련 파일:
  - `velora-frontend/src/lib/api.ts`
  - `velora-frontend/src/App.tsx`

### 분석 서버 종료 문제 대응

- 분석 중 백엔드가 무거운 음향 특징 추출에서 종료되는 문제를 확인했다.
- 원인 위치:
  - `extract_acoustic_features()`의 무거운 pitch/tempo 계산 구간.
- 웹 테스트 안정화를 위해 `VELORA_LIGHTWEIGHT_INFERENCE=1` 경량 분석 모드를 추가했다.
- 경량 모드에서는:
  - 최대 30초 음성 기준
  - 무거운 화자분리/KMeans 일부 우회
  - 무거운 pitch/tempo 계산 대신 MFCC, RMS, spectral centroid, bandwidth, ZCR 중심의 가벼운 특징 사용
  - 결과는 `lightweight_acoustic_screening` 소스로 표시
- 관련 파일:
  - `app/routers/analysis.py`
  - `app/services/cognitive_model.py`

### 실제 API 검증 결과

샘플 API 흐름:

- 동의 생성
- 자녀 음성 업로드
- 통화 파일 업로드
- 분석 시작

검증 완료 예시:

```text
analysis_id: 35f0c5d0-386a-4d0b-9eb2-fc35ac2ba936
model_source: lightweight_acoustic_screening
model_probabilities:
  Normal: 0.554266
  MCI: 0.26986
  AD: 0.175874
confidence_score: 0.6741
```

## 현재 실행 상태와 실행 명령

프론트 dev 서버:

```bash
cd /root/velora/velora-frontend
PATH=/root/velora/tools/conda-envs/velora-frontend/bin:$PATH npm run dev -- --host 0.0.0.0
```

백엔드 테스트 서버:

```bash
cd /root/velora/velora-backend
PATH=/root/velora/tools/conda-envs/velora-backend/bin:$PATH \
OMP_NUM_THREADS=1 \
OPENBLAS_NUM_THREADS=1 \
MKL_NUM_THREADS=1 \
NUMEXPR_NUM_THREADS=1 \
TF_NUM_INTRAOP_THREADS=1 \
TF_NUM_INTEROP_THREADS=1 \
VELORA_LIGHTWEIGHT_INFERENCE=1 \
VELORA_COGNITIVE_MODEL_PATH=/root/velora/normal_mci_ad_task-ALL_best.h5 \
VELORA_COGNITIVE_METADATA_PATH=/root/velora/normal_mci_ad_task-ALL_metadata.json \
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

접속:

```text
http://175.118.124.67:5174/
```

외부에서 5174 포트가 막히면 Windows PowerShell에서 SSH 터널:

```bash
ssh -L 5174:127.0.0.1:5174 root@175.118.124.67
```

그 뒤 브라우저:

```text
http://localhost:5174/
```

## 오늘 확인한 빌드

프론트 빌드 성공:

```bash
cd /root/velora/velora-frontend
PATH=/root/velora/tools/conda-envs/velora-frontend/bin:$PATH npm run build
```

백엔드 문법 확인:

```bash
PATH=/root/velora/tools/conda-envs/velora-backend/bin:$PATH python -m py_compile ...
```

## 다음에 이어서 할 일

1. 부모님 음성 STT 전사 및 언어 특징 추론 추가
   - 현재 웹 검증 흐름은 음성 파일을 텍스트로 변환하지 않는다.
   - 현재 결과는 음향 특징 기반 참고 분석이다.
   - 내일 추가할 방향:
     - 부모 음성 분리
     - STT로 텍스트 전사
     - 전사 텍스트 기반 언어 특징 추출
     - 음향 특징 + 언어 특징을 함께 결과 신뢰도 또는 추론 보조 신호에 반영
   - 추가 가능한 언어 특징:
     - 말 끊김
     - 반복 표현
     - 평균 문장 길이
     - 단어 다양성
     - 대명사/지시어 사용
     - `그거`, `저거`, `음`, `어` 같은 표현 빈도
     - 회상 흐름의 일관성
   - 기존 백엔드에는 `transcript_text`가 있으면 언어 특징을 계산하는 구조가 일부 있다.
   - 아직 자동 STT는 연결되어 있지 않다.
   - 관련 파일:
     - `velora-backend/app/routers/analysis.py`
     - `velora-backend/app/services/language_processor.py`
     - 추후 STT 서비스 파일 추가 필요

2. `본인검증` 모드 설계 및 화면 추가
   - 서비스 시작 화면에 모드 선택 추가:
     - 부모님 통화 검증
     - 내 목소리 검증
     - 지난 검증 이력
   - 본인검증은 자녀 음성 샘플이 필요 없다.
   - 본인 음성 30초~1분 녹음/업로드 후 바로 분석.

3. 이력 데이터에 검증 유형 저장
   - `parent_call`
   - `self_voice`

4. 본인검증용 읽기 문장 별도 작성
   - 50~60대 여성이 자연스럽게 읽을 수 있는 문장
   - 개인정보가 포함되지 않는 문장

5. 경량 분석 모드는 웹 테스트용임을 명확히 표시하거나 운영 추론 구조를 따로 정리
   - 장기적으로는 무거운 Keras 추론을 API 요청과 분리하거나 별도 worker로 실행하는 것이 안전하다.

6. 백엔드 DB 연결 운영 설정
   - 현재 테스트 환경은 `DATABASE_URL` 없이 메모리 저장소로 동작한다.
   - 운영에서는 PostgreSQL 등 DB 연결 필요.
