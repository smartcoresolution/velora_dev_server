import json
import os
import time
from fastapi import APIRouter, UploadFile, File, Header, HTTPException
from app.database import execute, get_audio_file, get_consent_by_token, get_voice_sample
from app.models.schemas import UploadResponse, QualityReport, VoiceSampleResponse
from app.services.audio_processor import (
    MAX_DURATION as MAX_AUDIO_DURATION,
    save_uploaded_file,
    save_voice_sample,
    convert_to_standard_wav,
    quality_check,
    get_voice_sample_embedding,
    trim_wav_to_duration,
)
from app.routers.consent import consent_store

router = APIRouter()

# In-memory file store
file_store: dict[str, dict] = {}
voice_sample_store: dict[str, dict] = {}

ALLOWED_EXTENSIONS = {
    ".m4a",
    ".mp3",
    ".wav",
    ".flac",
    ".ogg",
    ".aac",
    ".wma",
    ".webm",
    ".mp4",
    ".3gp",
    ".3ga",
    ".amr",
}
ALLOWED_CONTENT_TYPE_PREFIXES = ("audio/",)
ALLOWED_CONTENT_TYPES = {
    "application/octet-stream",
    "video/mp4",
}
MIN_VOICE_SAMPLE_DURATION = float(os.getenv("VELORA_MIN_VOICE_SAMPLE_DURATION", "20.0"))
MAX_VOICE_SAMPLE_DURATION = float(os.getenv("VELORA_MAX_VOICE_SAMPLE_DURATION", "30.0"))


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


def _validate_audio_file(filename: str, content_type: str | None) -> str:
    ext = os.path.splitext(filename)[1].lower()
    normalized_content_type = (content_type or "").split(";")[0].strip().lower()
    content_type_allowed = (
        normalized_content_type in ALLOWED_CONTENT_TYPES
        or any(normalized_content_type.startswith(prefix) for prefix in ALLOWED_CONTENT_TYPE_PREFIXES)
    )
    if ext in ALLOWED_EXTENSIONS:
        return ext
    if not ext and content_type_allowed:
        return ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다. 지원 형식: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    return ext


@router.post("/audio", response_model=UploadResponse)
async def upload_audio(
    file: UploadFile = File(...),
    x_consent_token: str = Header(..., alias="X-Consent-Token"),
):
    started_at = time.perf_counter()
    _validate_consent(x_consent_token)
    _validate_audio_file(file.filename or "audio", file.content_type)

    file_bytes = await file.read()
    read_at = time.perf_counter()
    if len(file_bytes) > 100 * 1024 * 1024:  # 100MB limit
        raise HTTPException(status_code=400, detail="파일 크기가 100MB를 초과합니다.")

    file_id, raw_path = save_uploaded_file(file_bytes, file.filename or "audio.wav")
    saved_at = time.perf_counter()

    try:
        wav_path = convert_to_standard_wav(raw_path, file_id)
    except Exception as e:
        os.remove(raw_path)
        raise HTTPException(
            status_code=400,
            detail=f"오디오 변환 중 오류가 발생했습니다: {str(e)}",
        )
    converted_at = time.perf_counter()

    original_duration, was_trimmed = trim_wav_to_duration(wav_path, MAX_AUDIO_DURATION)

    qc = quality_check(wav_path)
    checked_at = time.perf_counter()

    original_ext = os.path.splitext(file.filename or "audio.wav")[1].lower()
    qc["format_original"] = original_ext.lstrip(".")
    qc["original_duration_seconds"] = round(original_duration, 2)
    qc["trimmed_to_seconds"] = round(MAX_AUDIO_DURATION, 2) if was_trimmed else None
    qc["was_trimmed"] = was_trimmed

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
    finished_at = time.perf_counter()
    print(
        "[upload_audio] "
        f"file={file.filename or 'audio.wav'} content_type={file.content_type or '-'} bytes={len(file_bytes)} "
        f"read={read_at - started_at:.2f}s save={saved_at - read_at:.2f}s "
        f"convert={converted_at - saved_at:.2f}s quality={checked_at - converted_at:.2f}s "
        f"db={finished_at - checked_at:.2f}s total={finished_at - started_at:.2f}s",
        flush=True,
    )

    quality_report = QualityReport(**qc)

    if not qc["quality_pass"]:
        msg = f"품질 검증 실패: {qc['rejection_reason']}"
    elif was_trimmed:
        msg = f"업로드 및 품질 검증이 완료되었습니다. 긴 통화 파일은 분석용으로 앞부분 {MAX_AUDIO_DURATION:.0f}초만 사용합니다."
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
    _validate_audio_file(file.filename or "sample", file.content_type)

    file_bytes = await file.read()
    if len(file_bytes) > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(status_code=400, detail="음성 샘플 파일 크기가 50MB를 초과합니다.")

    sample_id, sample_path = save_voice_sample(file_bytes, file.filename or "sample.wav")

    try:
        sample_wav_path = convert_to_standard_wav(sample_path, sample_id)
    except Exception as e:
        os.remove(sample_path)
        raise HTTPException(
            status_code=400,
            detail=f"자녀 음성 변환 중 오류가 발생했습니다: {str(e)}",
        )

    original_duration, was_trimmed = trim_wav_to_duration(sample_wav_path, MAX_VOICE_SAMPLE_DURATION)

    if original_duration < MIN_VOICE_SAMPLE_DURATION:
        raise HTTPException(status_code=400, detail=f"음성 샘플은 최소 {MIN_VOICE_SAMPLE_DURATION:.0f}초 이상이어야 합니다.")

    duration = min(original_duration, MAX_VOICE_SAMPLE_DURATION)

    try:
        embedding = get_voice_sample_embedding(sample_wav_path)
    except Exception:
        embedding = None

    voice_sample_store[sample_id] = {
        "path": sample_wav_path,
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
            "storage_path": sample_wav_path,
            "duration_seconds": round(duration, 2),
            "embedding": json.dumps(embedding.tolist() if embedding is not None else None),
        },
    )

    if was_trimmed:
        message = f"음성 샘플이 등록되었습니다. 긴 녹음은 앞부분 {MAX_VOICE_SAMPLE_DURATION:.0f}초만 사용합니다."
    else:
        message = f"음성 샘플이 등록되었습니다. ({duration:.1f}초)"

    return VoiceSampleResponse(
        sample_id=sample_id,
        duration_seconds=round(duration, 2),
        original_duration_seconds=round(original_duration, 2),
        trimmed_to_seconds=round(MAX_VOICE_SAMPLE_DURATION, 2) if was_trimmed else None,
        was_trimmed=was_trimmed,
        message=message,
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
