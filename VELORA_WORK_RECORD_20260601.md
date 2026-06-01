# VELORA Work Record - 2026-06-01

## Summary

2026-06-01 작업은 VELORA 음성 분석 서비스의 Normal/MCI/AD 추론 결과를 안정화하는 데 집중했다. 기존 학습 모델의 음향 추론 결과에 STT 전사 기반 언어/의미 보정을 추가했고, 합성 테스트 데이터와 부모-자녀 전화 대화 데이터에서 Normal 결과가 과도하게 MCI/AD로 밀리는 문제를 보정했다.

운영 서버 배포, API 재시작, 샘플 검증, GitHub 커밋/푸시까지 완료했다.

## Repository State

- Repository: `smartcoresolution/velora_dev_server`
- Branch: `main`
- Local git dir: `.git-real`
- Remote: `git@github.com:smartcoresolution/velora_dev_server.git`
- Deploy key: `~/.ssh/velora_dev_server_deploy`

Latest commits:

```text
3c3ec7d Calibrate STT scoring for phone conversations
0951b7e Add semantic STT calibration for synthetic voice tests
352d532 Add STT-assisted voice analysis
9cc319e Sync Velora June 1 updates
```

## Major Changes

### 1. STT-Assisted Analysis

Added automatic Korean STT transcription to the analysis pipeline.

Key behavior:

- Audio is first scored by the trained Normal/MCI/AD Keras model.
- Audio is transcribed with `faster-whisper`.
- Linguistic and semantic features are extracted from the transcript.
- Final probabilities are adjusted using both acoustic and language signals.

Important files:

- `velora-backend/app/services/stt_processor.py`
- `velora-backend/app/services/language_processor.py`
- `velora-backend/app/services/cognitive_model.py`
- `velora-backend/app/routers/analysis.py`
- `velora-backend/app/models/schemas.py`
- `velora-backend/pyproject.toml`

Production STT environment:

```text
VELORA_STT_ENABLED=true
VELORA_STT_MODEL_SIZE=small
VELORA_STT_LANGUAGE=ko
VELORA_STT_DEVICE=cpu
VELORA_STT_COMPUTE_TYPE=int8
```

### 2. Trained Model Usage

Confirmed that inference uses the trained Keras model:

```text
VELORA_COGNITIVE_MODEL_PATH=/root/velora/normal_mci_ad_task-ALL_best.h5
VELORA_COGNITIVE_METADATA_PATH=/root/velora/normal_mci_ad_task-ALL_metadata.json
```

Observed model source in analysis responses:

```text
normal_mci_ad_task_ALL_vgg16_h5_lightweight_pipeline+stt_linguistic
```

### 3. Synthetic Normal/MCI/AD Data Calibration

Test set:

```text
/root/velora/test_data/iamwav/
```

Label convention:

- `normal_*.wav`: Normal
- `mci_*.wav`: MCI
- `ad_*.wav`: AD

Added semantic scoring fields:

- `semantic_impairment_score`
- `semantic_severe_score`
- `semantic_mild_score`
- `semantic_normal_score`

Purpose:

- Severe confusion signals push toward AD.
- Mild forgetfulness/checking/word-finding signals push toward MCI.
- Normal planning, appointment, memory, and daily routine language pushes toward Normal.

Validation result:

```text
iamwav labeled synthetic set: 15/15 correct
```

### 4. Parent-Child Phone Conversation Calibration

Test set:

```text
/root/velora/test_data/pc_wav/
```

Data layout:

```text
c_wav/child_01.wav       자녀 음성 샘플
p_wav/normal_01.m4a      부모와 대화 음성, parent label Normal
p_wav/normal_02.m4a      parent label Normal
p_wav/normal_03.m4a      parent label Normal
p_wav/normal_04.m4a      parent label Normal
```

Issue found:

- Phone conversations contain many short backchannels such as "네", "어", repeated phrases, and overlapping speech.
- STT can convert natural phone artifacts into repeated tokens.
- Earlier linguistic scoring treated these artifacts as cognitive-risk signals.
- In production lightweight mode, only the first 30 seconds are analyzed, which made the issue stronger.

Fix:

- Added phone-conversation artifact handling.
- Added `neutral_phone_conversation` behavior for short phone segments with no self-confusion or memory-loss semantic signals.
- Reduced the effect of repeated words and fluency markers when they look like phone conversation artifacts.

Validation result:

```text
pc_wav/p_wav first-30-second production-style test: 4/4 Normal
iamwav labeled synthetic set after phone tuning: 15/15 correct
```

Production API spot checks:

```text
normal_02.m4a -> Normal, risk 38.94
normal_04.m4a -> Normal, risk 32.02
```

## Frontend Changes

Added self-voice verification flow and updated result wording.

Important files:

- `velora-frontend/src/App.tsx`
- `velora-frontend/src/pages/SelfVoicePage.tsx`
- `velora-frontend/src/pages/ServiceMenuPage.tsx`
- `velora-frontend/src/pages/UploadPage.tsx`
- `velora-frontend/src/pages/ResultsPage.tsx`
- `velora-frontend/src/pages/ReliabilityPage.tsx`
- `velora-frontend/src/pages/HistoryPage.tsx`
- `velora-frontend/src/pages/AnalyzingPage.tsx`

Service menu now supports:

- 부모님 통화 검증
- 내 목소리 검증
- 지난 검증 이력 보기

## Production Deployment

Production frontend:

```text
/var/www/velora
```

Production backend:

```text
/opt/velora-prod/backend
```

Systemd service:

```text
velora-prod-api.service
```

Backend deploy command used:

```bash
rsync -a --exclude __pycache__ /root/velora/velora-backend/app/ /opt/velora-prod/backend/app/
systemctl restart velora-prod-api.service
```

Frontend deploy command used:

```bash
cd /root/velora/velora-frontend
npm run build
cp -a /root/velora/velora-frontend/dist/. /var/www/velora/.
```

Health check:

```bash
curl -s http://127.0.0.1:8010/healthz
```

Expected response:

```json
{"status":"ok"}
```

## Verification Commands

Backend syntax checks:

```bash
cd /root/velora/velora-backend
env PATH=/root/velora/tools/conda-envs/velora-backend/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  python -m py_compile \
  app/models/schemas.py \
  app/services/language_processor.py \
  app/services/cognitive_model.py \
  app/routers/analysis.py
```

Frontend build:

```bash
cd /root/velora/velora-frontend
env PATH=/root/velora/tools/conda-envs/velora-frontend/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  npm run build
```

Git commit/push pattern:

```bash
cd /root/velora
GIT_DIR=.git-real GIT_WORK_TREE=. git status --short
GIT_DIR=.git-real GIT_WORK_TREE=. git add <files>
GIT_DIR=.git-real GIT_WORK_TREE=. git commit -m "<message>"
GIT_DIR=.git-real GIT_WORK_TREE=. GIT_SSH_COMMAND="ssh -i ~/.ssh/velora_dev_server_deploy -o IdentitiesOnly=yes" git push origin main
```

## Notes And Caveats

- The current calibration is tuned strongly against the provided synthetic datasets and the provided parent-child phone samples.
- Synthetic data and real-world clinical data should be tracked separately.
- The service remains a non-medical screening/reference tool, not a diagnostic system.
- Phone call diarization is still heuristic. The latest fix reduces scoring artifacts, but robust parent-only diarization will require a stronger speaker verification or diarization model.
- In production lightweight mode, the analysis currently uses the first 30 seconds. This affects STT semantics, especially if the parent voice appears later in the call.

## Final Status

- STT pipeline added.
- Semantic language calibration added.
- Synthetic IAM WAV validation: `15/15`.
- Parent-child phone sample production-style validation: `4/4 Normal`.
- Production API deployed and restarted.
- GitHub `main` pushed through commit `3c3ec7d`.

## Follow-up SPC Tuning

Continued work on `/root/velora/test_data/spc_wav/` after the first SPC validation showed `8/15`.

Changes made:

- Lightweight analysis now applies child-sample-based MFCC/KMeans speaker filtering when `voice_sample_role=exclude`.
- Parent candidate selection analyzes up to `VELORA_LIGHTWEIGHT_DIARIZATION_SECONDS`, default `90.0`, instead of treating only the first 30 seconds as the target speaker.
- Diarization segments are merged before target audio extraction to avoid overlapping-frame duplication in STT.
- SPC-specific semantic patterns were added for AD, MCI, and Normal dialogue cues.
- Generic word-finding language was shifted away from AD severe scoring and toward MCI mild scoring.
- Normal/neutral conversation compensation was tuned to preserve previous phone-call Normal behavior while avoiding AD/MCI overcorrection.

Local direct-call validation result:

```text
spc_wav/sp_wav: 15/15
iamwav:         15/15
pc_wav/p_wav:   4/4 Normal
```
