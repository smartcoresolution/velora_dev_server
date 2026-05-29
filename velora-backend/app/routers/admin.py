import os
import time
from pathlib import Path

from fastapi import APIRouter

from app.database import fetch_one
from app.routers.analysis import analysis_store
from app.routers.upload import file_store, voice_sample_store
from app.services.cognitive_model import get_model_status

router = APIRouter()


def _dir_size(path: str) -> int:
    total = 0
    root = Path(path)
    if not root.exists():
        return 0
    for item in root.rglob("*"):
        if item.is_file():
            total += item.stat().st_size
    return total


@router.get("/dashboard")
async def get_admin_dashboard():
    model_status = get_model_status()
    stats = fetch_one(
        """
        SELECT
          (SELECT count(*) FROM analysis_results) AS completed,
          (SELECT count(*) FROM audio_files) AS uploaded,
          (SELECT count(*) FROM audio_files WHERE quality_pass IS true) AS quality_passed,
          (SELECT count(*) FROM audio_files WHERE raw_deleted_at IS NULL) AS raw_retained,
          (SELECT count(*) FROM voice_samples) AS voice_sample_count,
          (SELECT extract(epoch FROM max(created_at)) FROM analysis_results) AS latest_analysis
        """
    ) or {}
    completed = int(stats.get("completed") or len(analysis_store))
    uploaded = int(stats.get("uploaded") or len(file_store))
    quality_passed = int(
        stats.get("quality_passed")
        or sum(1 for item in file_store.values() if item["quality"].get("quality_pass"))
    )
    raw_retained = int(stats.get("raw_retained") or sum(1 for item in file_store.values() if item.get("raw_path")))
    latest_analysis = stats.get("latest_analysis") or max((item["created_at"] for item in analysis_store.values()), default=None)

    try:
        load_1m, load_5m, load_15m = os.getloadavg()
    except OSError:
        load_1m, load_5m, load_15m = 0.0, 0.0, 0.0

    return {
        "system": {
            "status": "stable",
            "cpu_load_1m": round(load_1m, 2),
            "cpu_load_5m": round(load_5m, 2),
            "cpu_load_15m": round(load_15m, 2),
            "active_ai_nodes": 1 if model_status.get("available") else 0,
            "max_ai_nodes": 1,
            "requests_completed": completed,
        },
        "pipeline": {
            "mobile_capture": {"status": "live", "queue": uploaded},
            "data_processing": {"status": "ready", "quality_passed": quality_passed},
            "feature_engine": {"status": "ready", "feature_vectors": completed},
            "model_layer": {
                "status": "ready" if model_status.get("available") else "unavailable",
                "model_source": model_status.get("model_source"),
                "classes": model_status.get("class_names", []),
                "accuracy": model_status.get("test_metrics", {}).get("accuracy"),
                "epochs_trained": model_status.get("epochs_trained"),
                "model_path": model_status.get("model_path"),
                "runtime": model_status.get("runtime", {}),
            },
        },
        "storage": {
            "raw_audio_retained_count": raw_retained,
            "feature_result_count": completed,
            "upload_temp_bytes": _dir_size(os.getenv("VELORA_UPLOAD_DIR", "/tmp/velora_uploads")),
            "processed_temp_bytes": _dir_size(os.getenv("VELORA_PROCESSED_DIR", "/tmp/velora_processed")),
            "voice_sample_count": int(stats.get("voice_sample_count") or len(voice_sample_store)),
        },
        "governance": {
            "consent_required": True,
            "non_medical_notice_enabled": True,
            "original_audio_cleanup_enabled": True,
            "feature_vector_storage_only_after_analysis": True,
        },
        "alerts": [
            {
                "level": "warning",
                "message": "학습 모델을 사용할 수 없습니다. 모델 경로를 확인해 주세요.",
                "created_at": time.time(),
            }
        ] if not model_status.get("available") else [],
        "latest_analysis_at": latest_analysis,
    }
