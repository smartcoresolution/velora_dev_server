import io
import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

CPU_ONLY_ENV = "VELORA_FORCE_CPU"
CPU_ONLY_VALUES = {"1", "true", "yes", "on"}
CPU_ONLY_DEFAULT = "true"
LIGHTWEIGHT_ENV = "VELORA_LIGHTWEIGHT_INFERENCE"
LIGHTWEIGHT_DEFAULT = "false"

os.environ.setdefault("MPLCONFIGDIR", "/tmp/mplconfig")
os.environ.setdefault("NUMBA_CACHE_DIR", "/tmp/numba_cache")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
if os.getenv(CPU_ONLY_ENV, CPU_ONLY_DEFAULT).strip().lower() in CPU_ONLY_VALUES:
    os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
Path(os.environ["MPLCONFIGDIR"]).mkdir(parents=True, exist_ok=True)
Path(os.environ["NUMBA_CACHE_DIR"]).mkdir(parents=True, exist_ok=True)

import librosa
import librosa.display
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image


DEFAULT_CLASS_NAMES = ["Normal", "MCI", "AD"]
LABEL_KO = {
    "Normal": "정상",
    "MCI": "경도인지장애",
    "AD": "알츠하이머성 치매",
}
STAGE_KO = {
    "Normal": "정상 범위에 가까운 음성 패턴",
    "MCI": "경도인지장애 위험 신호",
    "AD": "알츠하이머성 치매 위험 신호",
}
RISK_LEVEL_KO = {
    "low": "낮음",
    "middle": "중간",
    "high": "높음",
}
CLASS_ALIASES = {
    "normal": "Normal",
    "sci": "Normal",
    "mci": "MCI",
    "ad": "AD",
}

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_MODEL_CANDIDATES = [
    REPO_ROOT / "velora-train" / "normal_mci_ad_task_ALL_best.h5",
    REPO_ROOT / "velora-train" / "normal_mci_ad_task-ALL_best.h5",
    REPO_ROOT / "normal_mci_ad_task_ALL_best.h5",
    REPO_ROOT / "normal_mci_ad_task-ALL_best.h5",
]
DEFAULT_METADATA_CANDIDATES = [
    REPO_ROOT / "velora-train" / "normal_mci_ad_task_ALL_metadata.json",
    REPO_ROOT / "velora-train" / "normal_mci_ad_task-ALL_metadata.json",
    REPO_ROOT / "normal_mci_ad_task_ALL_metadata.json",
    REPO_ROOT / "normal_mci_ad_task-ALL_metadata.json",
]


class CognitiveModelUnavailable(RuntimeError):
    pass


def _cpu_only_enabled() -> bool:
    return os.getenv(CPU_ONLY_ENV, CPU_ONLY_DEFAULT).strip().lower() in CPU_ONLY_VALUES


def _lightweight_enabled() -> bool:
    return os.getenv(LIGHTWEIGHT_ENV, LIGHTWEIGHT_DEFAULT).strip().lower() in CPU_ONLY_VALUES


def _configure_tensorflow_runtime(tf: Any) -> dict[str, Any]:
    if _cpu_only_enabled():
        try:
            tf.config.set_visible_devices([], "GPU")
        except RuntimeError:
            pass
        return {
            "inference_device": "CPU",
            "gpu_visible": False,
        }

    gpus = tf.config.list_physical_devices("GPU")
    return {
        "inference_device": "GPU" if gpus else "CPU",
        "gpu_visible": bool(gpus),
    }


def _configured_path(env_name: str) -> Path | None:
    value = os.getenv(env_name, "").strip()
    return Path(value) if value else None


def _first_existing_path(env_name: str, candidates: list[Path], label: str) -> Path:
    configured = _configured_path(env_name)
    if configured:
        if configured.exists():
            return configured
        raise CognitiveModelUnavailable(f"{label} 파일을 찾을 수 없습니다: {configured}")

    for path in candidates:
        if path.exists():
            return path

    checked = ", ".join(str(path) for path in candidates)
    raise CognitiveModelUnavailable(
        f"{label} 파일을 찾을 수 없습니다. {env_name} 환경변수 또는 다음 경로를 확인해 주세요: {checked}"
    )


def _load_metadata(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as file:
            return json.load(file)
    except (OSError, json.JSONDecodeError) as exc:
        raise CognitiveModelUnavailable(f"모델 메타데이터를 읽을 수 없습니다: {path} ({exc})") from exc


def _canonical_class_name(name: str) -> str:
    key = str(name).strip().lower()
    if key not in CLASS_ALIASES:
        raise CognitiveModelUnavailable(f"지원하지 않는 학습 클래스입니다: {name}")
    return CLASS_ALIASES[key]


def _class_names_from_metadata(metadata: dict[str, Any]) -> list[str]:
    class_indices = metadata.get("class_indices")
    if isinstance(class_indices, dict) and class_indices:
        try:
            ordered = sorted(class_indices.items(), key=lambda item: int(item[1]))
            return [_canonical_class_name(name) for name, _ in ordered]
        except (TypeError, ValueError) as exc:
            raise CognitiveModelUnavailable(f"class_indices 형식이 올바르지 않습니다: {class_indices}") from exc

    class_names = metadata.get("class_names") or DEFAULT_CLASS_NAMES
    if not isinstance(class_names, list) or not class_names:
        raise CognitiveModelUnavailable("metadata.class_names 값이 비어 있습니다.")
    return [_canonical_class_name(name) for name in class_names]


def _preprocessing_from_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    preprocessing = metadata.get("preprocessing") if isinstance(metadata.get("preprocessing"), dict) else {}
    image_size = metadata.get("image_size") or preprocessing.get("image_size") or [100, 100]
    if not isinstance(image_size, list | tuple) or len(image_size) != 2:
        raise CognitiveModelUnavailable(f"image_size 형식이 올바르지 않습니다: {image_size}")

    return {
        "sample_rate": int(os.getenv("VELORA_COGNITIVE_MODEL_SAMPLE_RATE", preprocessing.get("sample_rate", 48000))),
        "seconds": int(os.getenv("VELORA_COGNITIVE_MODEL_SECONDS", preprocessing.get("seconds", 30))),
        "dpi": int(os.getenv("VELORA_COGNITIVE_MODEL_DPI", preprocessing.get("dpi", 100))),
        "image_size": (int(image_size[0]), int(image_size[1])),
    }


@lru_cache(maxsize=1)
def _load_model_bundle():
    model_path = _first_existing_path("VELORA_COGNITIVE_MODEL_PATH", DEFAULT_MODEL_CANDIDATES, "Keras H5 모델")
    metadata_path = _first_existing_path("VELORA_COGNITIVE_METADATA_PATH", DEFAULT_METADATA_CANDIDATES, "모델 메타데이터")
    metadata = _load_metadata(metadata_path)
    class_names = _class_names_from_metadata(metadata)
    preprocessing = _preprocessing_from_metadata(metadata)

    try:
        import tensorflow as tf
        runtime = _configure_tensorflow_runtime(tf)
        model = tf.keras.models.load_model(str(model_path), compile=False)
    except Exception as exc:
        raise CognitiveModelUnavailable(f"Keras 모델을 로드할 수 없습니다: {model_path} ({exc})") from exc

    return {
        "model": model,
        "model_path": str(model_path),
        "metadata_path": str(metadata_path),
        "metadata": metadata,
        "class_names": class_names,
        "runtime": runtime,
        **preprocessing,
    }


def _audio_to_array(audio_path: str, sample_rate: int, seconds: int, image_size: tuple[int, int], dpi: int) -> np.ndarray:
    y, sr = librosa.load(audio_path, sr=sample_rate)
    max_samples = sr * seconds
    y_segment = y[:max_samples] if len(y) > max_samples else y

    mel = librosa.feature.melspectrogram(y=y_segment, sr=sr)
    fig = plt.figure(figsize=(image_size[1] / dpi, image_size[0] / dpi), dpi=dpi)
    librosa.display.specshow(librosa.power_to_db(mel, ref=np.max))
    plt.axis("off")
    plt.xticks([])
    plt.yticks([])
    plt.tight_layout()
    plt.subplots_adjust(left=0, bottom=0, right=1, top=1, hspace=0, wspace=0)

    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", dpi=dpi)
    plt.close(fig)
    buffer.seek(0)

    image = Image.open(buffer).convert("RGB").resize((image_size[1], image_size[0]))
    array = np.asarray(image, dtype=np.float32) / 255.0
    return np.expand_dims(array, axis=0)


def _predict_probabilities(model: Any, array: np.ndarray, class_names: list[str]) -> dict[str, float]:
    prediction = np.asarray(model.predict(array, verbose=0), dtype=np.float64).reshape(-1)
    if len(prediction) != len(class_names):
        raise CognitiveModelUnavailable(
            f"모델 출력 수({len(prediction)})와 메타데이터 클래스 수({len(class_names)})가 다릅니다."
        )

    if np.any(prediction < 0) or not np.isclose(float(np.sum(prediction)), 1.0, atol=1e-3):
        exp = np.exp(prediction - np.max(prediction))
        prediction = exp / np.sum(exp)

    probability_map = {name: float(value) for name, value in zip(class_names, prediction)}
    merged = {name: 0.0 for name in DEFAULT_CLASS_NAMES}
    for name, value in probability_map.items():
        merged[name] = merged.get(name, 0.0) + value

    total = sum(merged.values())
    if total <= 0:
        raise CognitiveModelUnavailable("모델 확률 합계가 0입니다.")
    return {name: float(value / total) for name, value in merged.items()}


def _normalized_entropy(probabilities: np.ndarray) -> float:
    clipped = np.clip(probabilities, 1e-8, 1.0)
    entropy = -float(np.sum(clipped * np.log(clipped)))
    return float(np.clip(entropy / np.log(len(clipped)), 0.0, 1.0))


def _risk_level_from_prediction(predicted_label: str, risk_score: float) -> str:
    if predicted_label == "AD" or risk_score >= 65:
        return "high"
    if predicted_label == "MCI" or risk_score >= 35:
        return "middle"
    return "low"


def _message_for(predicted_label: str, risk_level: str) -> str:
    risk_label = RISK_LEVEL_KO[risk_level]
    if predicted_label == "Normal":
        return (
            f"현재 음성 패턴은 학습 모델 기준 정상군에 가장 가깝고, 위험 정도는 {risk_label}으로 산출되었습니다. "
            "정기적인 재측정으로 변화를 확인해 주세요."
        )
    if predicted_label == "MCI":
        return (
            f"현재 음성 패턴은 학습 모델 기준 MCI 군에 가장 가깝고, 위험 정도는 {risk_label}입니다. "
            "컨디션, 녹음 품질, 발화 상황의 영향을 받을 수 있으므로 반복 측정과 전문가 상담을 권장합니다."
        )
    return (
        f"현재 음성 패턴은 학습 모델 기준 AD 군에 가장 가깝고, 위험 정도는 {risk_label}입니다. "
        "이 결과는 진단이 아니며, 가능한 한 전문 의료기관 상담을 권장합니다."
    )


def _probabilities_from_audio_features(audio_path: str) -> dict[str, float]:
    y, sr = librosa.load(audio_path, sr=16000, duration=30)
    if len(y) == 0:
        raise CognitiveModelUnavailable("분석할 음성 데이터가 비어 있습니다.")

    rms = librosa.feature.rms(y=y)[0]
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]

    energy_mean = float(np.mean(rms))
    energy_std = float(np.std(rms))
    silence_ratio = float(np.mean(rms < max(0.005, energy_mean * 0.35)))
    zcr_mean = float(np.mean(zcr))
    centroid_mean = float(np.mean(centroid) / max(sr / 2, 1))
    variability = energy_std / max(energy_mean, 1e-6)

    change_signal = np.clip(
        0.22
        + silence_ratio * 0.28
        + variability * 0.12
        + max(0.0, 0.08 - zcr_mean) * 1.6
        + max(0.0, 0.28 - centroid_mean) * 0.35,
        0.05,
        0.9,
    )
    ad_share = np.clip(
        0.10
        + silence_ratio * 0.20
        + max(0.0, 0.20 - centroid_mean) * 0.30,
        0.03,
        0.45,
    )
    mci_share = np.clip(change_signal - ad_share, 0.05, 0.7)
    normal = np.clip(1.0 - mci_share - ad_share, 0.05, 0.92)

    total = normal + mci_share + ad_share
    return {
        "Normal": float(normal / total),
        "MCI": float(mci_share / total),
        "AD": float(ad_share / total),
    }


def _result_from_probabilities(probability_map: dict[str, float], model_source: str, model_path: str | None = None, metadata_path: str | None = None) -> dict:
    predicted_label = max(probability_map, key=probability_map.get)
    impairment_probability = probability_map["MCI"] + probability_map["AD"]
    risk_score = float(np.clip(probability_map["MCI"] * 55.0 + probability_map["AD"] * 100.0, 0.0, 100.0))
    risk_level = _risk_level_from_prediction(predicted_label, risk_score)
    entropy = _normalized_entropy(np.array([probability_map[name] for name in DEFAULT_CLASS_NAMES]))
    model_certainty = 1.0 - entropy

    return {
        "cognitive_status": predicted_label,
        "cognitive_status_label": LABEL_KO[predicted_label],
        "dementia_stage": STAGE_KO[predicted_label],
        "risk_score": round(risk_score, 2),
        "risk_level": risk_level,
        "risk_level_label": RISK_LEVEL_KO[risk_level],
        "risk_probability": round(float(impairment_probability), 4),
        "model_probabilities": {
            "Normal": round(float(probability_map["Normal"]), 6),
            "MCI": round(float(probability_map["MCI"]), 6),
            "AD": round(float(probability_map["AD"]), 6),
        },
        "model_entropy": round(entropy, 4),
        "model_certainty": round(model_certainty, 4),
        "result_message": _message_for(predicted_label, risk_level),
        "model_source": model_source,
        "model_path": model_path,
        "metadata_path": metadata_path,
    }


def predict_cognitive_status(audio_path: str) -> dict:
    if _lightweight_enabled():
        probability_map = _probabilities_from_audio_features(audio_path)
        return _result_from_probabilities(
            probability_map,
            model_source="lightweight_acoustic_screening",
        )

    bundle = _load_model_bundle()
    array = _audio_to_array(
        audio_path,
        bundle["sample_rate"],
        bundle["seconds"],
        bundle["image_size"],
        bundle["dpi"],
    )

    probability_map = _predict_probabilities(bundle["model"], array, bundle["class_names"])
    return _result_from_probabilities(
        probability_map,
        model_source="normal_mci_ad_task_ALL_vgg16_h5",
        model_path=bundle["model_path"],
        metadata_path=bundle["metadata_path"],
    )


def get_model_status() -> dict:
    try:
        bundle = _load_model_bundle()
        metadata = bundle["metadata"]
        return {
            "available": True,
            "model_source": "normal_mci_ad_task_ALL_vgg16_h5",
            "model_path": bundle["model_path"],
            "metadata_path": bundle["metadata_path"],
            "task": metadata.get("task", "ALL"),
            "class_names": bundle["class_names"],
            "image_size": list(bundle["image_size"]),
            "sample_rate": bundle["sample_rate"],
            "seconds": bundle["seconds"],
            "runtime": bundle["runtime"],
            "test_metrics": metadata.get("test_metrics", {}),
            "epochs_trained": metadata.get("epochs_trained"),
        }
    except CognitiveModelUnavailable as exc:
        return {
            "available": False,
            "message": str(exc),
        }
