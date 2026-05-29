const API_URL = import.meta.env.VITE_API_URL || "";

// ---------- fallback demo data ----------
const DEMO_POLICY = {
  version: "1.0.0",
  title: "VELORA 데이터 처리 및 개인정보 보호 정책",
  sections: [
    { title: "서비스 목적", content: "VELORA는 통화 음성을 분석하여 인지기능 변화와 연관될 수 있는 위험 신호를 비의료적으로 선별하는 참고용 서비스입니다. 본 서비스는 의료 진단을 목적으로 하지 않습니다." },
    { title: "데이터 수집 범위", content: "통화 녹음 파일, 연령대 정보를 수집합니다. 음성 내 개인식별정보(PII)는 자동으로 마스킹 처리됩니다." },
    { title: "데이터 보관 및 삭제", content: "원본 음성 파일은 분석 완료 후 즉시 삭제되며, 익명화된 특징 데이터는 최대 90일간 보관 후 자동 삭제됩니다." },
    { title: "제3자 음성 안내", content: "통화 녹음에는 상대방의 음성이 포함될 수 있습니다. 상대방 음성은 분석에서 자동으로 분리 및 제외되며, 별도로 저장되지 않습니다." },
    { title: "비의료적 서비스 고지", content: "본 서비스의 분석 결과는 의료적 진단이나 치료 판단이 아닌, 인지기능 변화와 연관될 수 있는 위험 신호를 참고용으로 제공하는 비의료적 정보입니다." },
  ],
  consent_items: [
    { key: "data_collection", label: "데이터 수집 및 분석에 동의합니다.", required: true },
    { key: "privacy_policy", label: "개인정보 처리 방침에 동의합니다.", required: true },
    { key: "non_medical_disclaimer", label: "비의료적 서비스임을 이해하고 동의합니다.", required: true },
    { key: "third_party_voice", label: "제3자 음성 포함 가능성을 이해하고 동의합니다.", required: true },
  ],
};

let demoMode = false;
const uid = () => crypto.randomUUID();

async function tryFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(url, init);
    if (res.status === 401) throw new Error("auth");
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) throw new Error("not-json");
    return res;
  } catch {
    demoMode = true;
    throw new Error("offline");
  }
}

// ---------- public API ----------

export async function fetchPolicy() {
  if (demoMode) return DEMO_POLICY;
  try {
    const res = await tryFetch(`${API_URL}/api/consent/policy`);
    if (!res.ok) throw new Error("Failed to fetch policy");
    return res.json();
  } catch {
    demoMode = true;
    return DEMO_POLICY;
  }
}

export async function submitConsent(data: {
  user_name?: string;
  age_group: string;
  data_collection_agreed: boolean;
  privacy_policy_agreed: boolean;
  non_medical_disclaimer_agreed: boolean;
  third_party_voice_agreed: boolean;
}) {
  if (demoMode) return { consent_token: `demo-${uid()}`, message: "동의가 완료되었습니다." };
  const res = await tryFetch(`${API_URL}/api/consent/agree`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Consent failed");
  }
  return res.json();
}

export async function uploadAudio(file: File, consentToken: string) {
  if (demoMode) {
    return {
      file_id: `demo-file-${uid()}`,
      quality_report: { quality_pass: true, duration_seconds: 45.2, snr_db: 18.5, silence_ratio: 0.15, sample_rate: 16000, channels: 1, format_original: "wav", rejection_reason: null },
      message: "업로드 및 품질 검증이 완료되었습니다.",
    };
  }
  const formData = new FormData();
  formData.append("file", file);
  const res = await tryFetch(`${API_URL}/api/upload/audio`, {
    method: "POST",
    headers: { "X-Consent-Token": consentToken },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export async function uploadVoiceSample(file: File, consentToken: string) {
  if (demoMode) return { sample_id: `demo-vs-${uid()}`, duration_seconds: 7.5 };
  const formData = new FormData();
  formData.append("file", file);
  const res = await tryFetch(`${API_URL}/api/upload/voice-sample`, {
    method: "POST",
    headers: { "X-Consent-Token": consentToken },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Voice sample upload failed");
  }
  return res.json();
}

export async function startAnalysis(fileId: string, voiceSampleId?: string) {
  if (demoMode) return { analysis_id: `demo-analysis-${uid()}`, status: "processing" };
  let url = `${API_URL}/api/analysis/start/${fileId}`;
  if (voiceSampleId) url += `?voice_sample_id=${voiceSampleId}`;
  const res = await tryFetch(url, { method: "POST" });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Analysis failed");
  }
  return res.json();
}

export async function getAdminDashboard() {
  if (demoMode) {
    return {
      system: { status: "stable", cpu_load_1m: 0.65, cpu_load_5m: 0.72, cpu_load_15m: 0.58, active_ai_nodes: 1, max_ai_nodes: 1, requests_completed: 1250 },
      pipeline: {
        mobile_capture: { status: "live", queue: 3 },
        data_processing: { status: "ready", quality_passed: 18 },
        feature_engine: { status: "ready", feature_vectors: 18 },
        model_layer: {
          status: "ready",
          model_source: "normal_mci_ad_task_ALL_vgg16_h5",
          classes: ["Normal", "MCI", "AD"],
          accuracy: 1,
          epochs_trained: 11,
          runtime: { inference_device: "CPU", gpu_visible: false },
        },
      },
      storage: { raw_audio_retained_count: 0, feature_result_count: 18, upload_temp_bytes: 0, processed_temp_bytes: 0, voice_sample_count: 4 },
      governance: { consent_required: true, non_medical_notice_enabled: true, original_audio_cleanup_enabled: true, feature_vector_storage_only_after_analysis: true },
      alerts: [],
    };
  }
  const res = await tryFetch(`${API_URL}/api/admin/dashboard`);
  if (!res.ok) throw new Error("Failed to fetch admin dashboard");
  return res.json();
}

export async function getResults(analysisId: string) {
  if (demoMode) {
    return {
      analysis: {
        analysis_id: analysisId,
        file_id: "demo-file",
        cognitive_status: "Normal",
        cognitive_status_label: "정상",
        dementia_stage: "정상 범위에 가까운 음성 패턴",
        risk_score: 28.5,
        risk_level: "low",
        risk_level_label: "낮음",
        risk_probability: 0.18,
        model_probabilities: { Normal: 0.82, MCI: 0.14, AD: 0.04 },
        result_message: "현재 음성 패턴은 학습 모델 기준 정상군에 가장 가깝고, 위험 정도는 낮음으로 산출되었습니다.",
        model_source: "demo",
        confidence_score: 0.82,
        confidence_breakdown: { audio_quality_score: 0.85, diarization_clarity: 0.78, model_certainty: 0.83 },
        features: {
          acoustic_features: {
            mfcc_mean: [], mfcc_std: [], pitch_mean: 185.3, pitch_std: 42.1, pitch_range: 120,
            energy_mean: 0.65, energy_std: 0.12, energy_variability: 0.18, speech_rate: 118,
            prosody_stability: 0.72, spectral_centroid_mean: 2100, spectral_bandwidth_mean: 1500,
            zero_crossing_rate: 0.08,
          },
          linguistic_features: {
            transcript_available: false,
            vocabulary_diversity: 0,
            average_sentence_length: 0,
            repeated_word_ratio: 0,
            noun_verb_ratio: 0,
            fluency_marker_count: 0,
            figurative_expression_count: 0,
            language_quality_score: 0,
            extraction_note: "전사 텍스트가 제공되지 않아 언어 특징은 산출하지 않았습니다.",
          },
          speech_statistics: {
            total_speech_duration: 38.4, silence_ratio: 0.15, speech_density: 0.85,
            mean_utterance_length: 2.4, utterance_count: 16,
          },
          feature_quality_score: 0.82,
        },
        diarization: {
          total_speakers: 1, target_speaker: "speaker_A", target_segments: [], excluded_segments: [],
          diarization_confidence: 0.78,
        },
        governance: {
          consent_token_validated: true,
          raw_audio_deleted_after_analysis: true,
          target_audio_deleted_after_analysis: true,
          stored_data_scope: "feature_vector_and_analysis_result",
          third_party_voice_handling: "speaker_diarization_excluded_segments_not_used_for_model",
          non_medical_disclaimer_present: true,
          transcript_available: false,
        },
        processing_time_seconds: 12.4,
        disclaimer: "본 결과는 의료 진단이 아닌 비의료적 참고 정보입니다.",
      },
      guidance: [
        { category: "self_care", title: "건강한 생활 습관 유지", description: "규칙적인 수면과 활동을 유지하세요.", priority: 1 },
        { category: "monitoring", title: "정기적 모니터링", description: "3~6개월 후 다시 분석하여 변화를 추적하세요.", priority: 2 },
      ],
      risk_explanation: "분석 결과, 현재 음성 패턴은 학습 모델 기준 정상군에 가장 가깝게 분류되었습니다.",
      next_steps: ["현재 상태를 유지하며 건강한 생활 습관을 지속하세요.", "3~6개월 후 다시 분석하여 변화를 추적하세요."],
      legal_notice: "본 결과는 의료 진단이 아닌 비의료적 참고 정보입니다.",
    };
  }
  const res = await tryFetch(`${API_URL}/api/results/${analysisId}`);
  if (!res.ok) throw new Error("Failed to fetch results");
  return res.json();
}

export async function getResultsSummary(analysisId: string) {
  if (demoMode) {
    return {
      analysis_id: analysisId,
      cognitive_status: "Normal",
      cognitive_status_label: "정상",
      dementia_stage: "정상 범위에 가까운 음성 패턴",
      risk_level: "low",
      risk_level_label: "낮음",
      risk_score: 28.5,
      model_probabilities: { Normal: 0.82, MCI: 0.14, AD: 0.04 },
      result_message: "현재 음성 패턴은 학습 모델 기준 정상군에 가장 가깝고, 위험 정도는 낮음으로 산출되었습니다.",
      confidence_score: 0.82,
      risk_explanation: "분석 결과, 현재 음성 패턴은 학습 모델 기준 정상군에 가장 가깝게 분류되었습니다.",
      recommendations: [
        "현재 음성 패턴은 정상군에 가장 가깝게 분류되었습니다.",
        "6개월 후 재검사를 권장합니다.",
        "건강한 생활습관을 유지해 주세요.",
      ],
      disclaimer: "본 결과는 의료 진단이 아닌 비의료적 참고 정보입니다. 건강 관련 결정은 반드시 전문 의료기관과 상담하시기 바랍니다.",
    };
  }
  const res = await tryFetch(`${API_URL}/api/results/${analysisId}/summary`);
  if (!res.ok) throw new Error("Failed to fetch summary");
  return res.json();
}
