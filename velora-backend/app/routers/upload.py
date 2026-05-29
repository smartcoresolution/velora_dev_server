import json
import os
from fastapi import APIRouter, UploadFile, File, Header, HTTPException
from app.database import execute, get_audio_file, get_consent_by_token, get_voice_sample
from app.models.schemas import UploadResponse, QualityReport, VoiceSampleResponse
from app.services.audio_processor import (
    save_uploaded_file,
    save_voice_sample,
    convert_to_standard_wav,
    quality_check,
    get_voice_sample_embedding,
)
from app.routers.consent import consent_store

router = APIRouter()

# In-memory file store
file_store: dict[str, dict] = {}
voice_sample_store: dict[str, dict] = {}

ALLOWED_EXTENSIONS = {".m4a", ".mp3", ".wav", ".flac", ".ogg", ".aac", ".wma", ".webm", ".mp4"}


def _validate_consent(consent_token: str) -> None:
    if not consent_token:
        raise HTTPException(
            status_code=403,
            detail="유효한 동의 토큰이 필요합니다. 먼저 동의 절차를 완료해 주세요.",
        )
    if consent_token in consent_store:
        return
    consent = get_consent_by_token(consent_token)
    if not consent:
        raise HTTPException(
            status_code=403,
            detail="유효한 동의 토큰이 필요합니다. 먼저 동의 절차를 완료해 주세요.",
        )
    consent_store[consent_token] = {
        "db_id": str(consent["id"]),
        "user_id": str(consent["user_id"]),
        "user_name": consent["user_name"],
        "age_group": consent["age_group"],
        "agreed_at": consent["agreed_at"].isoformat(),
        "policy_version": consent["policy_version"],
    }


def _validate_extension(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다. 지원 형식: {', '.join(ALLOWED_EXTENSIONS)}",
        )
    return ext


@router.post("/audio", response_model=UploadResponse)
async def upload_audio(
    file: UploadFile = File(...),
    x_consent_token: str = Header(..., alias="X-Consent-Token"),
):
    _validate_consent(x_consent_token)
    _validate_extension(file.filename or "audio.wav")

    file_bytes = await file.read()
    if len(file_bytes) > 100 * 1024 * 1024:  # 100MB limit
        raise HTTPException(status_code=400, detail="파일 크기가 100MB를 초과합니다.")

    file_id, raw_path = save_uploaded_file(file_bytes, file.filename or "audio.wav")

    try:
        wav_path = convert_to_standard_wav(raw_path, file_id)
    except Exception as e:
        os.remove(raw_path)
        raise HTTPException(
            status_code=400,
            detail=f"오디오 변환 중 오류가 발생했습니다: {str(e)}",
        )

    qc = quality_check(wav_path)

    original_ext = os.path.splitext(file.filename or "audio.wav")[1].lower()
    qc["format_original"] = original_ext.lstrip(".")

    file_store[file_id] = {
        "raw_path": raw_path,
        "wav_path": wav_path,
        "consent_token": x_consent_token,
        "quality": qc,
    }
    consent = get_consent_by_token(x_consent_token)
    execute(
        """
        INSERT INTO audio_files (
            id, user_id, consent_id, original_filename, original_format,
            storage_path, wav_path, file_size_bytes, duration_seconds,
            snr_db, silence_ratio, sample_rate, channels, quality_pass, rejection_reason
        )
        VALUES (
            CAST(:id AS uuid), CAST(:user_id AS uuid), CAST(:consent_id AS uuid),
            :original_filename, :original_format, :storage_path, :wav_path,
            :file_size_bytes, :duration_seconds, :snr_db, :silence_ratio,
            :sample_rate, :channels, :quality_pass, :rejection_reason
        )
        """,
        {
            "id": file_id,
            "user_id": str(consent["user_id"]) if consent else None,
            "consent_id": str(consent["id"]) if consent else None,
            "original_filename": file.filename or "audio.wav",
            "original_format": qc["format_original"],
            "storage_path": raw_path,
            "wav_path": wav_path,
            "file_size_bytes": len(file_bytes),
            "duration_seconds": qc["duration_seconds"],
            "snr_db": qc["snr_db"],
            "silence_ratio": qc["silence_ratio"],
            "sample_rate": qc["sample_rate"],
            "channels": qc["channels"],
            "quality_pass": qc["quality_pass"],
            "rejection_reason": qc["rejection_reason"],
        },
    )

    quality_report = QualityReport(**qc)

    if not qc["quality_pass"]:
        msg = f"품질 검증 실패: {qc['rejection_reason']}"
    else:
        msg = "업로드 및 품질 검증이 완료되었습니다. 분석을 시작할 수 있습니다."

    return UploadResponse(
        file_id=file_id,
        quality_report=quality_report,
        message=msg,
    )


@router.post("/voice-sample", response_model=VoiceSampleResponse)
async def upload_voice_sample(
    file: UploadFile = File(...),
    x_consent_token: str = Header(..., alias="X-Consent-Token"),
):
    _validate_consent(x_consent_token)
    _validate_extension(file.filename or "sample.wav")

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="음성 샘플 파일 크기가 10MB를 초과합니다.")

    sample_id, sample_path = save_voice_sample(file_bytes, file.filename or "sample.wav")

    try:
        embedding = get_voice_sample_embedding(sample_path)
    except Exception:
        embedding = None

    import librosa
    y, sr = librosa.load(sample_path, sr=16000)
    duration = len(y) / sr

    if duration < 3.0:
        raise HTTPException(status_code=400, detail="음성 샘플은 최소 3초 이상이어야 합니다.")
    if duration > 30.0:
        raise HTTPException(status_code=400, detail="음성 샘플은 30초를 초과할 수 없습니다.")

    voice_sample_store[sample_id] = {
        "path": sample_path,
        "consent_token": x_consent_token,
        "duration": duration,
        "embedding": embedding.tolist() if embedding is not None else None,
    }
    consent = get_consent_by_token(x_consent_token)
    execute(
        """
        INSERT INTO voice_samples (
            id, user_id, consent_id, original_filename, storage_path, duration_seconds, embedding
        )
        VALUES (
            CAST(:id AS uuid), CAST(:user_id AS uuid), CAST(:consent_id AS uuid),
            :original_filename, :storage_path, :duration_seconds, CAST(:embedding AS jsonb)
        )
        """,
        {
            "id": sample_id,
            "user_id": str(consent["user_id"]) if consent else None,
            "consent_id": str(consent["id"]) if consent else None,
            "original_filename": file.filename or "sample.wav",
            "storage_path": sample_path,
            "duration_seconds": round(duration, 2),
            "embedding": json.dumps(embedding.tolist() if embedding is not None else None),
        },
    )

    return VoiceSampleResponse(
        sample_id=sample_id,
        duration_seconds=round(duration, 2),
        message=f"음성 샘플이 등록되었습니다. ({duration:.1f}초)",
    )


@router.get("/files/{file_id}")
async def get_file_info(file_id: str):
    if file_id in file_store:
        info = file_store[file_id]
        return {
            "file_id": file_id,
            "quality": info["quality"],
        }
    db_file = get_audio_file(file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return {
        "file_id": file_id,
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
