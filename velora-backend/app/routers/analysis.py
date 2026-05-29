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
from app.services.risk_model import compute_confidence_score
from app.services.cognitive_model import (
    CognitiveModelUnavailable,
    get_model_status,
    predict_cognitive_status,
)

router = APIRouter()

# In-memory analysis store
analysis_store: dict[str, dict] = {}

TARGET_SR = 16000


@router.post("/start/{file_id}", response_model=AnalysisResult)
async def start_analysis(
    file_id: str,
    voice_sample_id: str = Query(None, description="등록된 음성 샘플 ID (선택)"),
    transcript_text: str = Query(None, description="선택 입력: 전사 텍스트가 있으면 언어 특징을 함께 산출"),
):
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

    # Step 1: Speaker Diarization
    diarization_result = perform_speaker_diarization(wav_path, voice_embedding)

    # Step 2: Extract target speaker audio
    target_audio = extract_target_audio(wav_path, diarization_result["target_segments"])
    target_audio_path = f"/tmp/velora_processed/{analysis_id}_target.wav"
    sf.write(target_audio_path, target_audio, TARGET_SR)

    # Step 3: Extract speech statistics
    speech_stats = extract_speech_statistics(target_audio, TARGET_SR)

    # Step 4: Extract acoustic features
    acoustic_features = extract_acoustic_features(target_audio, TARGET_SR)

    # Step 5: Extract linguistic features when transcript text is provided
    linguistic_features = extract_linguistic_features(transcript_text)

    # Step 6: Compute feature quality
    feature_quality = compute_feature_quality(acoustic_features, speech_stats)

    # Step 7: Run trained Normal/MCI/AD model
    try:
        cognitive_result = predict_cognitive_status(target_audio_path)
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
