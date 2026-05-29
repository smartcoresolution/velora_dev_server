# VELORA Backend

FastAPI backend for voice upload, quality checks, trained Normal/MCI/AD model inference, and non-medical risk guidance.

## Model Configuration

By default the API loads the trained VGG16 `.h5` model and metadata from these locations, in order:

- `../velora-train/normal_mci_ad_task_ALL_best.h5`
- `../velora-train/normal_mci_ad_task-ALL_best.h5`
- `../normal_mci_ad_task_ALL_best.h5`
- `../normal_mci_ad_task-ALL_best.h5`

The metadata file is discovered with the same naming pattern using `_metadata.json`.
You can override the discovered paths:

```bash
export VELORA_COGNITIVE_MODEL_PATH=/data/models/normal_mci_ad_task-ALL_best.h5
export VELORA_COGNITIVE_METADATA_PATH=/data/models/normal_mci_ad_task-ALL_metadata.json
export VELORA_COGNITIVE_MODEL_SAMPLE_RATE=48000
export VELORA_COGNITIVE_MODEL_SECONDS=30
export VELORA_FORCE_CPU=true
```

The metadata class order is used for model output interpretation. `Normal`, `MCI`, and `AD` are returned to the API as probabilities.
`VELORA_FORCE_CPU` defaults to `true`, so inference runs without requiring a GPU or CUDA runtime.

## Run

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Main Flow

- `POST /api/upload/audio`: upload or receive smartphone-recorded audio.
- `POST /api/analysis/start/{file_id}`: run speaker extraction, trained model inference, and risk message generation.
- `GET /api/results/{analysis_id}`: return cognitive status, risk level, probabilities, and guidance.
- `GET /api/analysis/model-status`: verify model configuration.
