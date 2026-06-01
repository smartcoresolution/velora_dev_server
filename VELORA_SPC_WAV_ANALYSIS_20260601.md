# VELORA SPC WAV Analysis - 2026-06-01

## Purpose

`/root/velora/test_data/spc_wav/` 데이터셋에 대해 부모-자녀 대화 음성의 Normal/MCI/AD 분류 성능을 확인했다.

이 문서는 다음 작업에서 이어서 튜닝할 수 있도록 현재 검증 방식, 결과, 오분류 원인, 다음 수정 방향을 기록한다.

## Dataset

Child voice sample:

```text
/root/velora/test_data/spc_wav/sc_wav/child_01.wav
```

Parent-child dialogue files:

```text
/root/velora/test_data/spc_wav/sp_wav/ad_01_repeated_call_dialogue.wav
/root/velora/test_data/spc_wav/sp_wav/ad_02_place_confusion_dialogue.wav
/root/velora/test_data/spc_wav/sp_wav/ad_03_name_confusion_dialogue.wav
/root/velora/test_data/spc_wav/sp_wav/ad_04_meal_confusion_dialogue.wav
/root/velora/test_data/spc_wav/sp_wav/ad_05_time_confusion_dialogue.wav
/root/velora/test_data/spc_wav/sp_wav/mci_01_medication_check_dialogue.wav
/root/velora/test_data/spc_wav/sp_wav/mci_02_grocery_forgetfulness_dialogue.wav
/root/velora/test_data/spc_wav/sp_wav/mci_03_schedule_confusion_dialogue.wav
/root/velora/test_data/spc_wav/sp_wav/mci_04_word_finding_dialogue.wav
/root/velora/test_data/spc_wav/sp_wav/mci_05_repeated_checking_dialogue.wav
/root/velora/test_data/spc_wav/sp_wav/normal_01_daily_recording_dialogue.wav
/root/velora/test_data/spc_wav/sp_wav/normal_02_meal_preparation_dialogue.wav
/root/velora/test_data/spc_wav/sp_wav/normal_03_hospital_appointment_dialogue.wav
/root/velora/test_data/spc_wav/sp_wav/normal_04_family_memory_dialogue.wav
/root/velora/test_data/spc_wav/sp_wav/normal_05_outdoor_plan_dialogue.wav
```

Label convention:

- `ad_*.wav` -> AD
- `mci_*.wav` -> MCI
- `normal_*.wav` -> Normal

## Test Method

The validation was run through the production API flow:

1. Submit consent.
2. Upload child voice sample from `sc_wav/child_01.wav`.
3. Upload each parent-child dialogue file from `sp_wav/`.
4. Start analysis with:

```text
voice_sample_id=<uploaded child sample id>
voice_sample_role=exclude
```

The model response used:

```text
normal_mci_ad_task_ALL_vgg16_h5_lightweight_pipeline+stt_linguistic
```

## Current Result

Production API validation result:

```text
Overall: 8/15

Normal: 2/5
MCI:    3/5
AD:     3/5
```

Detailed result:

```text
ad_01_repeated_call_dialogue.wav       true=AD      pred=Normal
ad_02_place_confusion_dialogue.wav     true=AD      pred=Normal
ad_03_name_confusion_dialogue.wav      true=AD      pred=AD
ad_04_meal_confusion_dialogue.wav      true=AD      pred=AD
ad_05_time_confusion_dialogue.wav      true=AD      pred=AD

mci_01_medication_check_dialogue.wav   true=MCI     pred=MCI
mci_02_grocery_forgetfulness_dialogue.wav true=MCI  pred=MCI
mci_03_schedule_confusion_dialogue.wav true=MCI     pred=Normal
mci_04_word_finding_dialogue.wav       true=MCI     pred=MCI
mci_05_repeated_checking_dialogue.wav  true=MCI     pred=Normal

normal_01_daily_recording_dialogue.wav true=Normal  pred=MCI
normal_02_meal_preparation_dialogue.wav true=Normal pred=MCI
normal_03_hospital_appointment_dialogue.wav true=Normal pred=Normal
normal_04_family_memory_dialogue.wav   true=Normal  pred=Normal
normal_05_outdoor_plan_dialogue.wav    true=Normal  pred=MCI
```

Confusion summary:

```text
AD -> AD:       3
AD -> Normal:   2
MCI -> MCI:     3
MCI -> Normal:  2
Normal -> Normal: 2
Normal -> MCI:    3
```

## Observed STT Issues

The first 30 seconds often contain mixed child/parent dialogue, opening questions, and noisy STT fragments.

Examples from misclassified files:

### `ad_01_repeated_call_dialogue.wav`

The first 30 seconds included both child prompts and parent confusion:

```text
엄마, 저 지금 회사에 있어요. 미안, 안 와. 무슨 일 있으세요?
너 지금 어디야? 아까 온다고 했지? 아니, 내가 물어봤나.
오늘 오는 날 아니었어?
밥을 해놔야 하는데 밥솥을 켰는지 모르겠네.
```

Expected: AD  
Actual: Normal

Problem:

- AD semantic cues are present, but current production scoring still treated this as neutral phone conversation because the first-30-second STT and speaker mixing reduced severe semantic scores.

### `ad_02_place_confusion_dialogue.wav`

The first 30 seconds included place confusion:

```text
나 지금 집에 있는데 이상하게 집이 났어요.
이 방이 우리 집방 맞지?
커튼 색깔이 원래 이랬나 모르겠네.
```

Expected: AD  
Actual: Normal

Problem:

- Severe place-confusion cues were present but not strong enough in the current semantic extraction/scoring.

### `mci_03_schedule_confusion_dialogue.wav`

The first 30 seconds included schedule confusion:

```text
이번 주에 제가 언제 간다고 했죠?
금요일이라고 했나? 아니, 잠깐만.
내가 달력에 적어둔 것 같은데?
토요일 오후 셋이라고 적혀있다.
```

Expected: MCI  
Actual: Normal

Problem:

- Mild compensation behavior such as calendar checking was not strong enough in the current first-30-second scoring.

### `mci_05_repeated_checking_dialogue.wav`

The first 30 seconds included repeated checking:

```text
내가 아까도 물어본 것 같은데 한 번만 더 확인할게.
일반 쓰레기는 화요일 밤이고 분리 수건은 수요일 맞지?
```

Expected: MCI  
Actual: Normal

Problem:

- Repeated-checking cues exist, but neutral phone-conversation compensation can overcorrect toward Normal.

### Normal Files

Some Normal files were misclassified as MCI because STT generated noisy fragments and repeated tokens.

Example:

```text
잘 켜도 길다 들. 길이 자체 놀아 덜 덥니다.
기회 난 너 왜인가? 내가 모르는 이놈...
```

Expected: Normal  
Actual: MCI

Problem:

- STT noise in dialogue audio can look like disfluency or semantic abnormality.
- Existing correction for neutral phone conversation helped `pc_wav`, but `spc_wav` has more mixed and noisy segments.

## Key Finding

The current production lightweight path still behaves mostly like:

```text
first 30 seconds of mixed parent-child dialogue
```

instead of:

```text
parent-only target speech
```

Even though `voice_sample_role=exclude` is passed, the lightweight route does not robustly remove child speech. This is the biggest blocker for reliable `spc_wav` classification.

## Recommended Next Work

### Priority 1: Improve Parent-Only Extraction

The next tuning should focus on making `voice_sample_role=exclude` actually select parent candidate speech in lightweight mode.

Options:

1. Use existing MFCC/KMeans diarization even when `VELORA_LIGHTWEIGHT_INFERENCE=1`.
2. Add a lightweight child-similarity filter using the uploaded child voice embedding.
3. Analyze more than the first 30 seconds, then choose parent-like segments with the clearest target speech.

Expected benefit:

- AD/MCI semantic cues from the parent should become stronger.
- Child prompts and noisy overlap should affect STT less.

### Priority 2: Add SPC-Specific Semantic Patterns

Add or strengthen patterns in `language_processor.py` for:

AD severe cues:

```text
집이 낯설
우리 집방 맞지
어디야
오늘 오는 날
밥솥을 켰는지 모르
이름이 생각이 안
누구였는지
밥을 먹었는지
오늘이 며칠
```

MCI mild cues:

```text
언제 간다고 했지
금요일이라고 했나
달력에 적어둔
한 번만 더 확인
아까도 물어본
메모도 보세요
요일 맞지
```

Normal cues:

```text
계획이에요
다녀오려고
예약 확인
재료는 다 사셨어요
사진 정리
편하게 말씀
녹음 시작
```

### Priority 3: Make Neutral Phone Compensation Safer

Current `neutral_phone_conversation` helped the earlier `pc_wav` Normal set, but it can overcorrect AD/MCI dialogue to Normal when severe/mild cues are under-detected.

Suggested rule:

- Only apply strong neutral-phone Normal boost when both:
  - semantic severe/mild scores are zero
  - transcript has no known confusion/checking keywords
  - acoustic model is not strongly MCI/AD

### Priority 4: Validate Against Both Sets

After each change, validate both:

```text
/root/velora/test_data/iamwav/       expected 15/15
/root/velora/test_data/pc_wav/p_wav  expected 4/4 Normal
/root/velora/test_data/spc_wav/sp_wav expected improvement from 8/15
```

Do not tune `spc_wav` in a way that breaks the previous passing sets.

## Useful Commands

Check service:

```bash
curl -s http://127.0.0.1:8010/healthz
```

Restart production API:

```bash
systemctl restart velora-prod-api.service
```

Deploy backend app:

```bash
rsync -a --exclude __pycache__ /root/velora/velora-backend/app/ /opt/velora-prod/backend/app/
systemctl restart velora-prod-api.service
```

Git commands:

```bash
GIT_DIR=.git-real GIT_WORK_TREE=. git status --short
GIT_DIR=.git-real GIT_WORK_TREE=. git add <files>
GIT_DIR=.git-real GIT_WORK_TREE=. git commit -m "<message>"
GIT_DIR=.git-real GIT_WORK_TREE=. GIT_SSH_COMMAND="ssh -i ~/.ssh/velora_dev_server_deploy -o IdentitiesOnly=yes" git push origin main
```

## Current Git Note

Before this document was created, there was already one untracked work-record file:

```text
VELORA_WORK_RECORD_20260601.md
```

This document is also a new untracked file unless committed:

```text
VELORA_SPC_WAV_ANALYSIS_20260601.md
```

## Current Status

- `spc_wav` validation is complete.
- Current production API result is not yet acceptable for this dataset: `8/15`.
- No code change was made during this `spc_wav` validation pass.
- Next recommended work is parent-only extraction in lightweight mode, followed by targeted semantic pattern tuning.

## Follow-up Implementation Result

Implemented after the initial validation pass:

- Lightweight `voice_sample_role=exclude` now runs MFCC/KMeans speaker clustering over a configurable early window, default `VELORA_LIGHTWEIGHT_DIARIZATION_SECONDS=90.0`, and selects the cluster farthest from the uploaded child voice sample as the parent candidate.
- Speaker diarization now merges overlapping 1-second frame segments before extracting target audio, reducing duplicated audio that can create repeated STT tokens.
- SPC-specific severe, mild, and normal semantic patterns were added.
- Generic word-finding phrases such as `생각이 안 나` were moved toward MCI mild handling instead of AD severe handling.
- Neutral/normal STT compensation was made safer around acoustic certainty and stronger when high-quality normal semantic context is present.

Local direct-call validation with production-like lightweight/STT environment:

```text
spc_wav/sp_wav: 15/15
iamwav:         15/15
pc_wav/p_wav:   4/4 Normal
```

Validation environment:

```text
VELORA_LIGHTWEIGHT_INFERENCE=1
VELORA_USE_TRAINED_MODEL_IN_LIGHTWEIGHT=true
VELORA_STT_ENABLED=true
VELORA_STT_MODEL_SIZE=small
VELORA_STT_LANGUAGE=ko
VELORA_STT_DEVICE=cpu
VELORA_STT_COMPUTE_TYPE=int8
VELORA_COGNITIVE_MODEL_PATH=/root/velora/normal_mci_ad_task-ALL_best.h5
VELORA_COGNITIVE_METADATA_PATH=/root/velora/normal_mci_ad_task-ALL_metadata.json
```
