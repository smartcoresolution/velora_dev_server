import os
import uuid
import tempfile
import subprocess
from pathlib import Path
import numpy as np
import librosa
import soundfile as sf
from typing import Optional


UPLOAD_DIR = os.getenv("VELORA_UPLOAD_DIR", "/tmp/velora_uploads")
PROCESSED_DIR = os.getenv("VELORA_PROCESSED_DIR", "/tmp/velora_processed")
VOICE_SAMPLES_DIR = os.getenv("VELORA_VOICE_SAMPLES_DIR", "/tmp/velora_voice_samples")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)
os.makedirs(VOICE_SAMPLES_DIR, exist_ok=True)

TARGET_SR = 16000
MIN_DURATION = float(os.getenv("VELORA_MIN_AUDIO_DURATION", "30.0"))
MAX_SILENCE_RATIO = float(os.getenv("VELORA_MAX_SILENCE_RATIO", "0.85"))
MIN_SNR_DB = float(os.getenv("VELORA_MIN_SNR_DB", "5.0"))


def save_uploaded_file(file_bytes: bytes, original_filename: str) -> tuple[str, str]:
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(original_filename)[1].lower() or ".wav"
    filepath = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
    with open(filepath, "wb") as f:
        f.write(file_bytes)
    return file_id, filepath


def save_voice_sample(file_bytes: bytes, original_filename: str) -> tuple[str, str]:
    sample_id = str(uuid.uuid4())
    ext = os.path.splitext(original_filename)[1].lower() or ".wav"
    filepath = os.path.join(VOICE_SAMPLES_DIR, f"{sample_id}{ext}")
    with open(filepath, "wb") as f:
        f.write(file_bytes)
    return sample_id, filepath


def convert_to_standard_wav(input_path: str, file_id: str) -> str:
    output_path = os.path.join(PROCESSED_DIR, f"{file_id}_std.wav")
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-ar", str(TARGET_SR),
        "-ac", "1",
        "-sample_fmt", "s16",
        output_path
    ]
    try:
        subprocess.run(cmd, capture_output=True, check=True)
    except FileNotFoundError:
        _convert_with_librosa(input_path, output_path)
    return output_path


def _convert_with_librosa(input_path: str, output_path: str) -> None:
    y, _ = librosa.load(input_path, sr=TARGET_SR, mono=True)
    sf.write(output_path, y, TARGET_SR, subtype="PCM_16")


def compute_snr(y: np.ndarray) -> float:
    frame_length = 2048
    hop_length = 512
    energy = np.array([
        np.sum(y[i:i + frame_length] ** 2)
        for i in range(0, len(y) - frame_length, hop_length)
    ])
    energy = np.maximum(energy, 1e-10)
    threshold = np.percentile(energy, 15)
    signal_energy = energy[energy > threshold]
    noise_energy = energy[energy <= threshold]
    if len(noise_energy) == 0 or np.mean(noise_energy) < 1e-10:
        return 40.0
    snr = 10 * np.log10(np.mean(signal_energy) / np.mean(noise_energy))
    return float(np.clip(snr, 0, 60))


def compute_silence_ratio(y: np.ndarray, sr: int) -> float:
    frame_length = 2048
    hop_length = 512
    energy = np.array([
        np.sum(np.abs(y[i:i + frame_length]))
        for i in range(0, len(y) - frame_length, hop_length)
    ])
    threshold = np.percentile(energy, 20) * 1.5
    silence_frames = np.sum(energy < threshold)
    return float(silence_frames / len(energy)) if len(energy) > 0 else 0.0


def quality_check(wav_path: str) -> dict:
    y, sr = librosa.load(wav_path, sr=TARGET_SR)
    duration = len(y) / sr
    snr = compute_snr(y)
    silence_ratio = compute_silence_ratio(y, sr)

    info = sf.info(wav_path)

    quality_pass = True
    rejection_reason = None

    if duration < MIN_DURATION:
        quality_pass = False
        rejection_reason = f"음성 길이가 {duration:.1f}초로 최소 {MIN_DURATION}초 미만입니다. 더 긴 녹음을 업로드해 주세요."
    elif silence_ratio > MAX_SILENCE_RATIO:
        quality_pass = False
        rejection_reason = f"무음 비율이 {silence_ratio*100:.1f}%로 너무 높습니다. 발화가 충분히 포함된 녹음을 업로드해 주세요."
    elif snr < MIN_SNR_DB:
        quality_pass = False
        rejection_reason = f"SNR이 {snr:.1f}dB로 너무 낮습니다. 잡음이 적은 환경에서 녹음해 주세요."

    return {
        "duration_seconds": round(duration, 2),
        "snr_db": round(snr, 2),
        "silence_ratio": round(silence_ratio, 4),
        "sample_rate": info.samplerate,
        "channels": info.channels,
        "quality_pass": quality_pass,
        "rejection_reason": rejection_reason,
    }


def get_voice_sample_embedding(sample_path: str) -> Optional[np.ndarray]:
    try:
        wav_path = sample_path
        if Path(sample_path).suffix.lower() != ".wav":
            wav_path = sample_path.rsplit(".", 1)[0] + "_std.wav"
            cmd = [
                "ffmpeg", "-y", "-i", sample_path,
                "-ar", str(TARGET_SR), "-ac", "1", "-sample_fmt", "s16",
                wav_path
            ]
            try:
                subprocess.run(cmd, capture_output=True, check=True)
            except FileNotFoundError:
                _convert_with_librosa(sample_path, wav_path)

        y, sr = librosa.load(wav_path, sr=TARGET_SR)
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
        embedding = np.mean(mfcc, axis=1)
        return embedding
    except Exception:
        return None
