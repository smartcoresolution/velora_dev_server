# VELORA 작업 로그

작성 시각: 2026-05-07 22:47:39 KST
작업 위치: `/root/velora`

## 1. 학습 모델 연동

- `velora_train/02-Result-VGG16MODEL` 안의 학습 완료 모델을 확인했습니다.
- 모델 구조는 2단계 분류 방식입니다.
  - `SCIvsOTHERS`: SCI와 기타 그룹 구분
  - `MCIvsAD`: MCI와 AD 구분
- `velora-backend/app/services/cognitive_model.py`를 수정해 `.h5` 모델을 자동 탐색하고 앙상블 예측하도록 변경했습니다.
- 기본 양성 클래스 설정은 다음과 같습니다.
  - `VELORA_SCI_MODEL_POSITIVE_CLASS=SCI`
  - `VELORA_MCI_AD_MODEL_POSITIVE_CLASS=MCI`
- 필요 시 다음 환경 변수로 모델 경로를 직접 지정할 수 있게 했습니다.
  - `VELORA_SCI_MODEL_PATHS`
  - `VELORA_MCI_AD_MODEL_PATHS`
- 모델 상태 확인 결과:
  - `SCIvsOTHERS` 모델 4개 탐지
  - `MCIvsAD` 모델 5개 탐지
  - `/api/analysis/model-status`에서 `available: true` 확인

## 2. 백엔드 코드 수정

- `velora-backend/app/models/schemas.py`
  - 인지 상태 enum을 `SCI`, `MCI`, `AD` 기준으로 변경했습니다.
  - 모델 확률 응답도 `SCI`, `MCI`, `AD` 구조로 변경했습니다.
- `velora-backend/app/routers/analysis.py`
  - 모델 상태 메시지를 `SCI/MCI/AD` 2단계 모델 기준으로 수정했습니다.
- `velora-backend/README.md`
  - `velora_train` 학습 모델 경로와 환경 변수 설정 문서를 갱신했습니다.

## 3. 프론트엔드 모바일 앱 화면 보완

- 첨부 이미지 `velora-frontend/화면그림.jpg`를 참고해 스마트폰 앱 형태의 UI로 재구성했습니다.
- `velora-frontend/src/App.tsx`
  - `home`, `consent`, `upload`, `analyzing`, `results` 흐름으로 변경했습니다.
- `velora-frontend/src/pages/ConsentPage.tsx`
  - 계정 만들기 및 동의 화면으로 재구성했습니다.
- `velora-frontend/src/pages/UploadPage.tsx`
  - 진단 스크립트 선택, 녹음 화면, 파일 업로드 카드, 음성 샘플 입력 UI를 보완했습니다.
- `velora-frontend/src/pages/AnalyzingPage.tsx`
  - 모바일 분석 진행 화면으로 변경했습니다.
- `velora-frontend/src/pages/ResultsPage.tsx`
  - 원형 점수 게이지, 확률 막대, 추천 액션 목록 중심으로 개선했습니다.
- `velora-frontend/src/index.css`
  - 전체 모바일 앱 스타일과 기본 레이아웃을 정리했습니다.
- 프론트엔드 빌드 확인:
  - `npm run build` 성공

## 4. 실행 환경 구성

- Miniconda를 `/root/velora/tools/miniconda3`에 설치했습니다.
- Conda 환경을 다음과 같이 구성했습니다.
  - 백엔드: `/root/velora/tools/conda-envs/velora-backend`
  - 학습: `/root/velora/tools/conda-envs/velora-train`
  - 프론트엔드: `/root/velora/tools/conda-envs/velora-frontend`
- 백엔드 환경:
  - Python 3.11.15
  - FastAPI, TensorFlow 2.15.1, librosa 등 설치
- 학습 환경:
  - Python 3.10.20
  - TensorFlow 2.15.1, Keras 2.15.0, librosa, pandas, matplotlib, scikit-learn 등 설치
- 프론트엔드 환경:
  - Node.js v20.17.0
  - npm 10.8.2
  - `npm ci` 완료

## 5. 실행 중인 서버

- 백엔드 서버를 실행했습니다.
  - 명령: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
  - 주소: `http://localhost:8000`
  - 헬스 체크: `/health` 응답 `{"status":"ok"}` 확인
- 프론트엔드 개발 서버를 실행했습니다.
  - 주소: `http://localhost:5174/`
  - 네트워크 주소: `http://175.118.124.67:5174/`
- `velora-frontend/vite.config.ts`의 `/api` 프록시는 `http://localhost:8000`으로 연결됩니다.

## 6. 계정 정보와 음성 파일 저장 위치 확인

- 현재 프론트엔드의 이메일/비밀번호 입력값은 UI 상태로만 존재하며 백엔드로 저장되지 않습니다.
- 동의 정보는 백엔드 메모리 저장소에 보관됩니다.
  - 관련 파일: `velora-backend/app/routers/consent.py`
  - 저장소: `consent_store`
- 업로드된 원본 음성 파일은 임시 폴더에 저장됩니다.
  - `/tmp/velora_uploads`
- 변환 또는 처리된 WAV 파일은 다음 위치에 저장됩니다.
  - `/tmp/velora_processed`
- 음성 샘플 파일은 다음 위치에 저장됩니다.
  - `/tmp/velora_voice_samples`
- 파일 메타데이터와 분석 결과는 현재 메모리 저장 방식입니다.
  - `file_store`
  - `voice_sample_store`
  - `analysis_store`

## 7. 관련 없는 파일 분석 및 삭제

- 프로젝트 내 관련 없는 파일 후보를 분석했습니다.
- Windows 메타데이터 파일 `*Zone.Identifier`를 모두 삭제했습니다.
  - 삭제 후 남은 파일 없음 확인
- `.zip` 파일 삭제 요청에 따라 학습 결과 압축 파일을 삭제했습니다.
  - 삭제 파일: `velora_train/02-Result-VGG16MODEL.zip`
- Conda 환경 내부 패키지용 `.zip` 파일은 실행 환경에 필요할 수 있어 삭제하지 않았습니다.

## 8. 확인된 검증 결과

- 백엔드 헬스 체크 성공
- 백엔드 모델 상태 API 성공
- 프론트엔드 빌드 성공
- 학습 모델 자동 탐지 성공
- `velora_train` 내 `.zip` 삭제 확인
- `*Zone.Identifier` 파일 삭제 확인

## 9. 남은 주의 사항

- 현재 계정 정보는 실제 DB에 저장되지 않습니다.
- 음성 파일은 `/tmp` 아래에 저장되므로 서버 재시작 또는 시스템 정리 정책에 따라 사라질 수 있습니다.
- 운영용으로 사용하려면 다음 보완이 필요합니다.
  - 사용자 계정 DB 저장
  - 업로드 파일 영구 저장 위치 결정
  - 분석 결과 DB 저장
  - 개인정보 및 음성 데이터 암호화/보관 정책 적용
  - 프론트엔드 npm audit 취약점 검토

## 10. 개발사양 PDF 검토 및 반영 점검

작업 시각: 2026-05-07 23:17:37 KST

- 첨부 개발사양 PDF `/root/velora/개발사양.pdf`를 검토했습니다.
- PDF는 텍스트 추출형 문서가 아니라 이미지 기반 페이지로 구성되어 있어, 내부 JPEG 스트림 11개를 `/tmp/velora_pdf_images`에 추출해 페이지별 요구사항을 확인했습니다.
- 확인한 주요 사양 항목은 다음과 같습니다.
  - 모바일 인지 건강 서비스 화면
  - 동의/개인정보 마스킹/데이터 거버넌스
  - 모바일 음성 수집, 품질 검사, 암호화
  - 화자 처리, VAD, 샘플레이트 통일, 발화 정보 산출
  - 음향 특징 및 전사 언어 특징 추출
  - 정상/인지저하 위험군 경향성 선별
  - 결과 요약, 생활 가이드, 추이/이력 보기
  - 서버 및 AI 인프라 관리자 콘솔
  - B2B/B2G 라이선스 및 추후 B2C 확장 가능 구조

## 11. 백엔드 보완 사항

- `velora-backend/app/services/language_processor.py`를 추가했습니다.
  - 전사 텍스트가 제공되는 경우 어휘 다양성, 평균 문장 길이, 반복 단어 비율, 명사/동사 추정 비율, 유창성 표지, 비유 표현 수, 언어 품질 점수를 산출합니다.
  - 전사 텍스트가 없을 경우 `transcript_available: false`와 사유 메시지를 명확히 반환합니다.
- `velora-backend/app/models/schemas.py`를 확장했습니다.
  - `LinguisticFeatures` 스키마를 추가했습니다.
  - `FeatureExtractionResult`에 `linguistic_features`를 포함했습니다.
  - `AnalysisResult`에 `governance` 필드를 추가했습니다.
- `velora-backend/app/routers/analysis.py`를 수정했습니다.
  - `POST /api/analysis/start/{file_id}`에서 선택 입력 `transcript_text`를 받을 수 있게 했습니다.
  - 분석 결과에 음향 특징, 언어 특징, 발화 통계가 함께 포함되도록 했습니다.
  - 분석 완료 후 원본 업로드 파일과 대상 화자 임시 WAV 파일 삭제 상태를 `governance`에 기록합니다.
  - 저장 범위를 `feature_vector_and_analysis_result`로 명시했습니다.
- `velora-backend/app/routers/admin.py`를 추가했습니다.
  - `/api/admin/dashboard` API를 제공합니다.
  - 시스템 상태, 파이프라인 상태, 모델 레이어 상태, 임시 저장소 상태, 거버넌스 상태, 운영 알림을 반환합니다.
- `velora-backend/app/main.py`에 관리자 라우터를 등록했습니다.

## 12. 프론트엔드 보완 사항

- `velora-frontend/src/pages/AdminPage.tsx`를 추가했습니다.
  - 개발사양의 관리자 콘솔 이미지를 반영해 서버 상태, AI 노드, 파이프라인, 저장소, 운영 알림 화면을 제공합니다.
- `velora-frontend/src/pages/HistoryPage.tsx`를 추가했습니다.
  - 분석 완료 리포트를 브라우저 로컬 이력에 저장하고 다시 열람할 수 있게 했습니다.
- `velora-frontend/src/App.tsx`를 수정했습니다.
  - 앱 단계에 `history`, `admin`을 추가했습니다.
  - 홈 화면에서 이력 보기와 관리자 콘솔로 진입할 수 있게 했습니다.
  - 분석 완료 시 결과를 최대 10개까지 `localStorage`에 저장합니다.
- `velora-frontend/src/pages/ResultsPage.tsx`를 수정했습니다.
  - 상세 결과 토글을 추가했습니다.
  - 언어 특징 제공 여부, 어휘 다양성, 원본 음성 삭제 상태, 저장 범위를 표시합니다.
  - 맞춤 인지 케어 추천 버튼이 실제 추천 영역 표시와 연결되도록 했습니다.
- `velora-frontend/src/pages/UploadPage.tsx`를 수정했습니다.
  - 프론트 안내 문구의 업로드 제한을 백엔드 정책과 일치하도록 `최대 100MB`로 변경했습니다.
  - 지원 포맷 안내를 `.m4a, .mp3, .wav, .webm 등`으로 확장했습니다.
  - 업로드 전 표시되던 고정 길이 예시를 서버 품질 검사 기준 안내로 변경했습니다.
- `velora-frontend/src/lib/api.ts`를 수정했습니다.
  - `/api/admin/dashboard` 호출 함수를 추가했습니다.
  - 데모 모드 결과 데이터에도 언어 특징과 거버넌스 필드를 추가했습니다.

## 13. 추가 검증 결과

- 백엔드 문법 검사:
  - `tools/conda-envs/velora-backend/bin/python -m py_compile ...` 성공
- 백엔드 라우터 등록 확인:
  - `/api/admin/dashboard`
  - `/healthz`
- 프론트엔드 타입 검사:
  - `tools/conda-envs/velora-frontend/bin/node node_modules/typescript/bin/tsc -b` 성공
- 프론트엔드 프로덕션 빌드:
  - `tools/conda-envs/velora-frontend/bin/node node_modules/vite/bin/vite.js build` 성공
  - 생성 결과:
    - `dist/index.html`
    - `dist/assets/index-BEKAZdi5.css`
    - `dist/assets/index-5wbvL6Wx.js`

## 14. 이번 검토 후 남은 주의 사항

- 실제 STT 엔진은 아직 연결되어 있지 않습니다.
  - 현재는 `transcript_text`가 제공될 때만 언어 특징을 산출합니다.
- 관리자 콘솔의 CPU/GPU/메모리 지표는 운영용 정밀 계측이 아니라 현재 서버에서 확인 가능한 경량 상태값 중심입니다.
- 계정, 분석 결과, 이력은 아직 운영 DB에 영구 저장되지 않습니다.
  - 프론트 이력은 브라우저 `localStorage` 기반입니다.
  - 백엔드 분석 저장소는 메모리 기반입니다.
- 사양 수준의 운영 전환을 위해서는 다음 보완이 필요합니다.
  - STT 또는 전사 파이프라인 연동
  - 사용자/기관/라이선스 DB 설계
  - 분석 결과 및 특징 벡터 영구 저장소 구축
  - 실제 암호화 저장 및 삭제 정책 자동화
  - 실시간 인프라 메트릭 수집 연동
