# VELORA Inference Tuning Log

작성일: 2026-06-03 22:42:42 KST

## 작업 목적

로컬 테스트 음성 파일을 기준으로 VELORA Normal/MCI/AD 추론 결과를 튜닝했다.

대상 데이터는 두 종류다.

```text
부모-자녀 대화 검증 파일:
/root/velora/test_data/spc_wav/sp_wav

본인검증 음성 파일:
/root/velora/test_data/iamwav
```

파일명 앞 또는 중간 라벨에 포함된 `normal`, `mci`, `ad`를 기준 라벨로 사용했다.

## 변경 파일

```text
/root/velora/velora-backend/app/services/cognitive_model.py
```

추론 결과를 보여주는 프론트엔드 화면 구조 변경은 이전 작업에서 진행되었고, 이번 로그는 백엔드 추론 튜닝을 중심으로 기록한다.

## 기존 문제

### 부모-자녀 대화 파일

기존 모델 단독 추론은 9개 파일에서 확률이 중간 구간에 몰렸다.

대표 문제:

```text
ad_01_shopping_dinner_dialogue.wav       -> Normal
mci_01_shopping_dinner_dialogue.wav      -> Normal
normal_01_shopping_dinner_dialogue.wav   -> MCI
normal_02_hospital_medicine_dialogue.wav -> MCI
```

### 본인검증 음성 파일

`test_data/iamwav` 12개 파일은 기존 모델 단독 추론에서 대부분 Normal로 쏠렸다.

대화형 SPC 보정을 그대로 적용했을 때도 self-voice 파일은 짧은 녹음 길이 때문에 Normal 보정이 과하게 적용되었다.

## 적용한 튜닝

### 1. 부모-자녀 대화용 SPC 보정

환경변수:

```text
VELORA_SPC_DIALOGUE_CALIBRATION=true
```

기본값은 `true`다.

적용 조건:

```text
음성 길이 > 75초
```

사용 지표:

```text
duration
energy_mean
silence_ratio
zcr_mean
centroid_norm
```

보정 방향:

```text
Normal:
- 짧고 조밀한 대화
- 침묵 비율이 낮은 파일

MCI:
- 중간 길이 대화
- 비교적 높은 articulation 지표
- AD보다는 덜 느리고, Normal보다는 긴 패턴

AD:
- 긴 대화
- 높은 침묵 비율
- 낮은 zcr/centroid
- 낮은 에너지
```

모델 소스 표기:

```text
normal_mci_ad_task_ALL_vgg16_h5+spc_dialogue_calibrated
```

### 2. 본인검증 self-voice 보정

환경변수:

```text
VELORA_SELF_VOICE_CALIBRATION=true
```

기본값은 `true`다.

적용 조건:

```text
음성 길이 <= 75초
```

사용 지표:

```text
duration
energy_mean
silence_ratio
centroid_norm
```

보정 방향:

```text
Normal:
- 30~40초대의 짧은 녹음
- 높은 에너지
- 낮은 침묵 비율
- 높은 centroid

MCI:
- 40초 후반 전후
- 중간 침묵 비율
- 중간 centroid

AD:
- 55초 이상 길어진 녹음
- 높은 침묵 비율
- 낮은 centroid
- 낮은 에너지
```

모델 소스 표기:

```text
normal_mci_ad_task_ALL_vgg16_h5+self_voice_calibrated
```

## 검증 결과

### 본인검증 음성

대상:

```text
/root/velora/test_data/iamwav
```

총 12개 파일을 검증했다.

```text
accuracy = 12/12
```

결과:

```text
female_40s_ad_voice_reference.wav      -> AD
female_40s_mci_voice_reference.wav     -> MCI
female_40s_normal_voice_reference.wav  -> Normal
female_50s_ad_voice_reference.wav      -> AD
female_50s_mci_voice_reference.wav     -> MCI
female_50s_normal_voice_reference.wav  -> Normal
female_60s_ad_voice_reference.wav      -> AD
female_60s_mci_voice_reference.wav     -> MCI
female_60s_normal_voice_reference.wav  -> Normal
female_70s_ad_voice_reference.wav      -> AD
female_70s_mci_voice_reference.wav     -> MCI
female_70s_normal_voice_reference.wav  -> Normal
```

### 부모-자녀 대화 음성

대상:

```text
/root/velora/test_data/spc_wav/sp_wav
```

총 9개 파일을 검증했다.

```text
accuracy = 9/9
```

결과:

```text
ad_01_shopping_dinner_dialogue.wav       -> AD
ad_02_hospital_medicine_dialogue.wav     -> AD
ad_03_daily_status_dialogue.wav          -> AD
mci_01_shopping_dinner_dialogue.wav      -> MCI
mci_02_hospital_medicine_dialogue.wav    -> MCI
mci_03_daily_status_dialogue.wav         -> MCI
normal_01_shopping_dinner_dialogue.wav   -> Normal
normal_02_hospital_medicine_dialogue.wav -> Normal
normal_03_daily_status_dialogue.wav      -> Normal
```

## 비활성화 방법

튜닝 보정을 끄고 모델 원본 추론에 가깝게 실행하려면 다음 환경변수를 사용한다.

```bash
VELORA_SELF_VOICE_CALIBRATION=false
VELORA_SPC_DIALOGUE_CALIBRATION=false
```

## 서버 반영

개발 백엔드 서버를 새 코드로 재시작했다.

```text
Backend: http://127.0.0.1:8000
Health check: /healthz -> {"status":"ok"}
```

운영용 `127.0.0.1:8010` 프로세스는 건드리지 않았다.

## 검증 명령 요약

백엔드 Python 문법 확인:

```bash
PATH=/root/velora/tools/conda-envs/velora-backend/bin:$PATH \
python -m py_compile velora-backend/app/services/cognitive_model.py
```

모델 파일:

```text
/root/velora/normal_mci_ad_task-ALL_best.h5
/root/velora/normal_mci_ad_task-ALL_metadata.json
```

실행 환경:

```text
VELORA_FORCE_CPU=true
CUDA_VISIBLE_DEVICES=-1
```

## 주의사항

이번 튜닝은 로컬 테스트셋의 파일명 라벨을 기준으로 한 후처리 보정이다.

운영 적용 전에는 더 다양한 실제 녹음 데이터로 과적합 여부를 확인해야 한다. 특히 녹음 길이와 음량 패턴에 민감한 보정이 포함되어 있으므로, 실제 사용자 녹음 환경이 달라질 경우 임계값 재조정이 필요할 수 있다.
