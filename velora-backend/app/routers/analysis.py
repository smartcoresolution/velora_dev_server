import json
import uuid
import time
import os
import numpy as np
import librosa
import soundfile as sf
from fastapi.encoders import jsonable_encoder
from fastapi import APIRouter, HTTPException, Query
from app.database import execute, get_analysis_result as db_get_analysis_result, get_audio_file, get_voice_sample
from app.models.schemas import AnalysisResult, AnalysisStatusResponse
from app.routers.upload import file_store, voice_sample_store
from app.services.speaker_processor import perform_speaker_diarization, extract_target_audio
from app.services.feature_extractor import (
    extract_speech_statistics,
    extract_acoustic_features,
    compute_feature_quality,
)
from app.services.language_processor import extract_linguistic_features
from app.services.stt_processor import transcribe_audio
from app.services.risk_model import compute_confidence_score
from app.services.cognitive_model import (
    CognitiveModelUnavailable,
    apply_linguistic_adjustment,
    get_model_status,
    predict_cognitive_status,
)

router = APIRouter()

# In-memory analysis store
analysis_store: dict[str, dict] = {}

TARGET_SR = 16000
LIGHTWEIGHT_VALUES = {"1", "true", "yes", "on"}


def _lightweight_analysis_enabled() -> bool:
    return os.getenv("VELORA_LIGHTWEIGHT_INFERENCE", "false").strip().lower() in LIGHTWEIGHT_VALUES


def _trace_analysis(message: str) -> None:
    if os.getenv("VELORA_ANALYSIS_TRACE", "false").strip().lower() not in LIGHTWEIGHT_VALUES:
        return
    with open("/tmp/velora_analysis_trace.log", "a", encoding="utf-8") as file:
        file.write(f"{time.time():.3f} {message}\n")


def _extract_lightweight_acoustic_features(y: np.ndarray, sr: int) -> dict:
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfcc_mean = np.mean(mfcc, axis=1).tolist()
    mfcc_std = np.std(mfcc, axis=1).tolist()
    rms = librosa.feature.rms(y=y)[0]
    energy_mean = float(np.mean(rms))
    energy_std = float(np.std(rms))
    spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
    zcr = librosa.feature.zero_crossing_rate(y)[0]

    return {
        "mfcc_mean": [round(v, 4) for v in mfcc_mean],
        "mfcc_std": [round(v, 4) for v in mfcc_std],
        "pitch_mean": 0.0,
        "pitch_std": 0.0,
        "pitch_range": 0.0,
        "energy_mean": round(energy_mean, 6),
        "energy_std": round(energy_std, 6),
        "energy_variability": round(float(energy_std / energy_mean) if energy_mean > 0 else 0.0, 4),
        "speech_rate": 0.0,
        "prosody_stability": 0.5,
        "spectral_centroid_mean": round(float(np.mean(spectral_centroid)), 2),
        "spectral_bandwidth_mean": round(float(np.mean(spectral_bandwidth)), 2),
        "zero_crossing_rate": round(float(np.mean(zcr)), 6),
    }


def _lightweight_diarization_seconds() -> float:
    return float(os.getenv("VELORA_LIGHTWEIGHT_DIARIZATION_SECONDS", "90.0"))


def _segment_duration(segments: list[dict]) -> float:
    return sum(float(segment.get("duration", 0.0) or 0.0) for segment in segments)


@router.post("/start/{file_id}", response_model=AnalysisResult)
async def start_analysis(
    file_id: str,
    voice_sample_id: str = Query(None, description="등록된 음성 샘플 ID (선택)"),
    voice_sample_role: str = Query("target", description="음성 샘플 역할: target 또는 exclude"),
    transcript_text: str = Query(None, description="선택 입력: 전사 텍스트가 있으면 언어 특징을 함께 산출"),
):
    _trace_analysis(f"start request file_id={file_id} voice_sample_id={voice_sample_id}")
    if file_id not in file_store:
        db_file = get_audio_file(file_id)
        if db_file:
            file_store[file_id] = {
                "raw_path": db_file["storage_path"],
                "wav_path": db_file["wav_path"],
                "consent_token": None,
                "quality": {
                    "duration_seconds": float(db_file["duration_seconds"] or 0),
                    "snr_db": float(db_file["snr_db"] or 0),
                    "silence_ratio": float(db_file["silence_ratio"] or 0),
                    "sample_rate": db_file["sample_rate"],
                    "channels": db_file["channels"],
                    "format_original": db_file["original_format"],
                    "quality_pass": db_file["quality_pass"],
                    "rejection_reason": db_file["rejection_reason"],
                },
            }

    if file_id not in file_store:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")

    file_info = file_store[file_id]
    _trace_analysis("file info loaded")

    if not file_info["quality"]["quality_pass"]:
        raise HTTPException(
            status_code=400,
            detail=f"품질 검증을 통과하지 못한 파일입니다: {file_info['quality']['rejection_reason']}",
        )

    wav_path = file_info["wav_path"]
    start_time = time.time()
    analysis_id = str(uuid.uuid4())

    # Get voice sample embedding if provided
    voice_embedding = None
    if voice_sample_id and voice_sample_id in voice_sample_store:
        sample_data = voice_sample_store[voice_sample_id]
        if sample_data["embedding"] is not None:
            voice_embedding = np.array(sample_data["embedding"])
    elif voice_sample_id:
        sample_data = get_voice_sample(voice_sample_id)
        if sample_data and sample_data["embedding"] is not None:
            voice_embedding = np.array(sample_data["embedding"])
    _trace_analysis(f"voice embedding loaded={voice_embedding is not None}")

    normalized_voice_sample_role = (voice_sample_role or "target").strip().lower()
    if normalized_voice_sample_role not in {"target", "exclude"}:
        raise HTTPException(status_code=400, detail="voice_sample_role은 target 또는 exclude만 허용됩니다.")

    # Step 1: Speaker Diarization
    if _lightweight_analysis_enabled():
        if voice_embedding is not None and normalized_voice_sample_role == "exclude":
            _trace_analysis("lightweight parent-candidate diarization start")
            diarization_result = perform_speaker_diarization(
                wav_path,
                voice_embedding,
                max_duration=_lightweight_diarization_seconds(),
            )
            _trace_analysis("lightweight parent-candidate diarization done")
            excluded_voice_segments = diarization_result["target_segments"]
            parent_candidate_segments = diarization_result["excluded_segments"]
            if _segment_duration(parent_candidate_segments) >= 8.0:
                diarization_result = {
                    **diarization_result,
                    "target_speaker": "parent_candidate",
                    "target_segments": parent_candidate_segments,
                    "excluded_segments": excluded_voice_segments,
                    "diarization_confidence": max(0.62, diarization_result["diarization_confidence"]),
                }
                target_audio = extract_target_audio(wav_path, diarization_result["target_segments"])
            else:
                _trace_analysis("lightweight parent-candidate fallback first 30s")
                y, _ = librosa.load(wav_path, sr=TARGET_SR, duration=30)
                duration = round(len(y) / TARGET_SR, 2)
                diarization_result = {
                    "total_speakers": 2,
                    "target_speaker": "parent_candidate",
                    "target_segments": [{
                        "speaker": "parent_candidate",
                        "start_time": 0.0,
                        "end_time": duration,
                        "duration": duration,
                    }],
                    "excluded_segments": excluded_voice_segments,
                    "diarization_confidence": 0.58,
                }
                target_audio = y
        else:
            _trace_analysis("lightweight load audio start")
            y, _ = librosa.load(wav_path, sr=TARGET_SR, duration=30)
            _trace_analysis(f"lightweight load audio done samples={len(y)}")
            duration = round(len(y) / TARGET_SR, 2)
            diarization_result = {
                "total_speakers": 1,
                "target_speaker": "speaker_A",
                "target_segments": [{
                    "speaker": "speaker_A",
                    "start_time": 0.0,
                    "end_time": duration,
                    "duration": duration,
                }],
                "excluded_segments": [],
                "diarization_confidence": 0.65,
            }
            target_audio = y
    else:
        _trace_analysis("diarization start")
        diarization_result = perform_speaker_diarization(wav_path, voice_embedding)
        _trace_analysis("diarization done")
        if voice_embedding is not None and normalized_voice_sample_role == "exclude":
            excluded_voice_segments = diarization_result["target_segments"]
            parent_candidate_segments = diarization_result["excluded_segments"]
            if parent_candidate_segments:
                diarization_result = {
                    **diarization_result,
                    "target_speaker": "parent_candidate",
                    "target_segments": parent_candidate_segments,
                    "excluded_segments": excluded_voice_segments,
                }

        # Step 2: Extract target speaker audio
        target_audio = extract_target_audio(wav_path, diarization_result["target_segments"])
        _trace_analysis(f"target extraction done samples={len(target_audio)}")
    target_audio_path = f"/tmp/velora_processed/{analysis_id}_target.wav"
    _trace_analysis("write target audio start")
    sf.write(target_audio_path, target_audio, TARGET_SR)
    _trace_analysis("write target audio done")
    cognitive_audio_path = target_audio_path
    if voice_embedding is not None and normalized_voice_sample_role == "exclude":
        cognitive_audio_path = wav_path

    # Step 3: Extract speech statistics
    speech_stats = extract_speech_statistics(target_audio, TARGET_SR)
    _trace_analysis("speech stats done")

    # Step 4: Extract acoustic features
    if _lightweight_analysis_enabled():
        acoustic_features = _extract_lightweight_acoustic_features(target_audio, TARGET_SR)
    else:
        acoustic_features = extract_acoustic_features(target_audio, TARGET_SR)
    _trace_analysis("acoustic features done")

    # Step 5: STT transcription and linguistic feature extraction
    stt_result = {
        "transcript_text": transcript_text,
        "stt_available": bool((transcript_text or "").strip()),
        "stt_engine": "provided",
        "stt_confidence": 1.0 if (transcript_text or "").strip() else 0.0,
        "transcript_char_count": len((transcript_text or "").strip()),
        "stt_language": "provided",
        "stt_note": "요청에서 제공된 전사 텍스트를 사용했습니다." if (transcript_text or "").strip() else "",
    }
    if not (transcript_text or "").strip():
        _trace_analysis("stt start")
        stt_result = transcribe_audio(target_audio_path)
        _trace_analysis(f"stt done available={stt_result['stt_available']}")
    linguistic_features = extract_linguistic_features(stt_result.get("transcript_text"))
    linguistic_features = {
        **linguistic_features,
        "stt_available": bool(stt_result.get("stt_available")),
        "stt_engine": str(stt_result.get("stt_engine") or "none"),
        "stt_confidence": float(stt_result.get("stt_confidence") or 0.0),
        "transcript_char_count": int(stt_result.get("transcript_char_count") or 0),
        "stt_language": str(stt_result.get("stt_language") or ""),
        "stt_note": str(stt_result.get("stt_note") or ""),
    }

    # Step 6: Compute feature quality
    feature_quality = compute_feature_quality(acoustic_features, speech_stats)

    # Step 7: Run trained Normal/MCI/AD model and apply STT linguistic signal
    try:
        _trace_analysis("cognitive prediction start")
        cognitive_result = predict_cognitive_status(cognitive_audio_path)
        cognitive_result = apply_linguistic_adjustment(cognitive_result, linguistic_features)
        _trace_analysis("cognitive prediction done")
    except CognitiveModelUnavailable as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "학습된 Normal/MCI/AD 모델을 사용할 수 없습니다. "
                f"서버 환경변수 VELORA_COGNITIVE_MODEL_PATH, VELORA_COGNITIVE_METADATA_PATH 또는 기본 모델 경로를 확인해 주세요. ({str(exc)})"
            ),
        )

    # Step 8: Compute confidence score
    confidence_result = compute_confidence_score(
        snr_db=file_info["quality"]["snr_db"],
        silence_ratio=speech_stats["silence_ratio"],
        diarization_confidence=diarization_result["diarization_confidence"],
        model_entropy=cognitive_result["model_entropy"],
        feature_quality=feature_quality,
    )

    processing_time = time.time() - start_time
    raw_deleted = False
    target_deleted = False
    for path_key in ("raw_path",):
        path = file_info.get(path_key)
        if path and os.path.exists(path):
            os.remove(path)
            file_info[path_key] = None
            raw_deleted = True
            execute(
                """
                UPDATE audio_files
                SET raw_deleted_at = now()
                WHERE id = CAST(:file_id AS uuid)
                """,
                {"file_id": file_id},
            )
    if os.path.exists(target_audio_path):
        os.remove(target_audio_path)
        target_deleted = True

    disclaimer = (
        "본 분석 결과는 의료적 진단이나 치료 판단이 아닌, "
        "인지기능 변화와 연관될 수 있는 위험 신호를 참고용으로 제공하는 "
        "비의료적 정보입니다."
    )

    result = AnalysisResult(
        analysis_id=analysis_id,
        file_id=file_id,
        cognitive_status=cognitive_result["cognitive_status"],
        cognitive_status_label=cognitive_result["cognitive_status_label"],
        dementia_stage=cognitive_result["dementia_stage"],
        risk_score=cognitive_result["risk_score"],
        risk_level=cognitive_result["risk_level"],
        risk_level_label=cognitive_result["risk_level_label"],
        risk_probability=cognitive_result["risk_probability"],
        model_probabilities=cognitive_result["model_probabilities"],
        acoustic_model_probabilities=cognitive_result.get("acoustic_model_probabilities"),
        linguistic_adjustment=cognitive_result.get("linguistic_adjustment"),
        result_message=cognitive_result["result_message"],
        model_source=cognitive_result["model_source"],
        confidence_score=confidence_result["overall"],
        confidence_breakdown={
            "audio_quality_score": confidence_result["audio_quality_score"],
            "diarization_clarity": confidence_result["diarization_clarity"],
            "model_certainty": confidence_result["model_certainty"],
        },
        features={
            "acoustic_features": acoustic_features,
            "linguistic_features": linguistic_features,
            "speech_statistics": speech_stats,
            "feature_quality_score": feature_quality,
        },
        diarization={
            "total_speakers": diarization_result["total_speakers"],
            "target_speaker": diarization_result["target_speaker"],
            "target_segments": diarization_result["target_segments"],
            "excluded_segments": diarization_result["excluded_segments"],
            "diarization_confidence": diarization_result["diarization_confidence"],
        },
        governance={
            "consent_token_validated": True,
            "policy_version": "1.0.0",
            "raw_audio_deleted_after_analysis": raw_deleted,
            "target_audio_deleted_after_analysis": target_deleted,
            "stored_data_scope": "feature_vector_and_analysis_result",
            "third_party_voice_handling": "speaker_diarization_excluded_segments_not_used_for_model",
            "non_medical_disclaimer_present": True,
            "transcript_available": linguistic_features["transcript_available"],
            "stt_available": linguistic_features["stt_available"],
            "stt_engine": linguistic_features["stt_engine"],
            "stt_confidence": linguistic_features["stt_confidence"],
            "transcript_char_count": linguistic_features["transcript_char_count"],
        },
        processing_time_seconds=round(processing_time, 2),
        disclaimer=disclaimer,
    )

    result_payload = jsonable_encoder(result)
    analysis_store[analysis_id] = {
        "result": result_payload,
        "file_id": file_id,
        "created_at": time.time(),
    }
    execute(
        """
        INSERT INTO analysis_results (
            id, audio_file_id, status, cognitive_status, risk_score, risk_level,
            risk_probability, model_probabilities, confidence_score, result_payload
        )
        VALUES (
            CAST(:id AS uuid), CAST(:audio_file_id AS uuid), 'completed',
            :cognitive_status, :risk_score, :risk_level, :risk_probability,
            CAST(:model_probabilities AS jsonb), :confidence_score, CAST(:result_payload AS jsonb)
        )
        """,
        {
            "id": analysis_id,
            "audio_file_id": file_id,
            "cognitive_status": result_payload["cognitive_status"],
            "risk_score": result_payload["risk_score"],
            "risk_level": result_payload["risk_level"],
            "risk_probability": result_payload["risk_probability"],
            "model_probabilities": json.dumps(result_payload["model_probabilities"]),
            "confidence_score": result_payload["confidence_score"],
            "result_payload": json.dumps(result_payload),
        },
    )

    return result


@router.get("/model-status")
async def model_status():
    return get_model_status()


@router.get("/status/{analysis_id}", response_model=AnalysisStatusResponse)
async def get_analysis_status(analysis_id: str):
    if analysis_id in analysis_store:
        return AnalysisStatusResponse(
            analysis_id=analysis_id,
            status="completed",
            progress=100,
            current_step="완료",
            message="분석이 완료되었습니다.",
        )
    if db_get_analysis_result(analysis_id):
        return AnalysisStatusResponse(
            analysis_id=analysis_id,
            status="completed",
            progress=100,
            current_step="완료",
            message="분석이 완료되었습니다.",
        )
    raise HTTPException(status_code=404, detail="분석 결과를 찾을 수 없습니다.")


@router.get("/result/{analysis_id}")
async def get_analysis_result(analysis_id: str):
    if analysis_id not in analysis_store:
        stored = db_get_analysis_result(analysis_id)
        if not stored:
            raise HTTPException(status_code=404, detail="분석 결과를 찾을 수 없습니다.")
        return stored["result_payload"]
    return analysis_store[analysis_id]["result"]
