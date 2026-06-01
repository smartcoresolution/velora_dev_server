const API_URL = import.meta.env.VITE_API_URL || "";

// ---------- fallback demo data ----------
const DEMO_POLICY = {
  version: "1.0.0",
  title: "VELORA 데이터 처리 및 개인정보 보호 정책",
  sections: [
    { title: "서비스 목적", content: "VELORA는 자녀가 업로드한 부모님과의 자연스러운 통화 음성을 분석하여 인지기능 변화와 연관될 수 있는 위험 신호를 비의료적으로 선별하는 참고용 서비스입니다. 본 서비스는 의료 진단을 목적으로 하지 않습니다." },
    { title: "데이터 수집 범위", content: "자녀 음성 샘플과 통화 녹음 파일을 수집합니다. 자녀 음성은 통화 속 자녀 화자를 구분하는 데 사용됩니다." },
    { title: "데이터 보관 및 삭제", content: "원본 음성 파일은 분석 완료 후 즉시 삭제되며, 익명화된 특징 데이터는 최대 90일간 보관 후 자동 삭제됩니다." },
    { title: "화자 분리 안내", content: "통화 녹음에는 자녀와 부모님의 음성이 함께 포함될 수 있습니다. 등록된 자녀 음성과 일치하는 화자는 분석에서 제외하고, 부모님 음성을 분석합니다." },
    { title: "비의료적 서비스 고지", content: "본 서비스의 분석 결과는 의료적 진단이나 치료 판단이 아닌, 인지기능 변화와 연관될 수 있는 위험 신호를 참고용으로 제공하는 비의료적 정보입니다." },
  ],
  consent_items: [
    { key: "data_collection", label: "자녀 음성 샘플과 통화 녹음 파일의 분석 처리에 동의합니다.", required: true },
    { key: "privacy_policy", label: "개인정보 처리 방침에 동의합니다.", required: true },
    { key: "non_medical_disclaimer", label: "비의료적 서비스임을 이해하고 동의합니다.", required: true },
    { key: "third_party_voice", label: "통화에 부모님 음성이 포함되며 자녀 음성을 제외한 뒤 분석함을 이해합니다.", required: true },
  ],
};

async function tryFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(url, init);
    if (res.status === 401) throw new Error("auth");
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) throw new Error("not-json");
    return res;
  } catch (error) {
    if (error instanceof Error && error.message === "auth") {
      throw error;
    }
    throw new Error("서버와 연결할 수 없습니다. 백엔드 실행 상태와 API 주소를 확인해 주세요.");
  }
}

// ---------- public API ----------

export async function fetchPolicy() {
  try {
    const res = await tryFetch(`${API_URL}/api/consent/policy`);
    if (!res.ok) throw new Error("Failed to fetch policy");
    return res.json();
  } catch {
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
  try {
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
  } catch (error) {
    throw error instanceof Error ? error : new Error("동의 처리 중 오류가 발생했습니다.");
  }
}

export async function uploadAudio(file: File, consentToken: string) {
  const formData = new FormData();
  formData.append("file", file);
  try {
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
  } catch (error) {
    throw error instanceof Error ? error : new Error("통화 파일 업로드 중 오류가 발생했습니다.");
  }
}

export async function uploadVoiceSample(file: File, consentToken: string) {
  const formData = new FormData();
  formData.append("file", file);
  try {
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
  } catch (error) {
    throw error instanceof Error ? error : new Error("자녀 음성 등록 중 오류가 발생했습니다.");
  }
}

export async function startAnalysis(fileId: string, voiceSampleId?: string) {
  let url = `${API_URL}/api/analysis/start/${fileId}`;
  if (voiceSampleId) url += `?voice_sample_id=${voiceSampleId}&voice_sample_role=exclude`;
  try {
    const res = await tryFetch(url, { method: "POST" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Analysis failed");
    }
    return res.json();
  } catch (error) {
    throw error instanceof Error ? error : new Error("분석 시작 중 오류가 발생했습니다.");
  }
}

export async function getAdminDashboard() {
  try {
    const res = await tryFetch(`${API_URL}/api/admin/dashboard`);
    if (!res.ok) throw new Error("Failed to fetch admin dashboard");
    return res.json();
  } catch (error) {
    throw error instanceof Error ? error : new Error("관리자 정보를 불러오지 못했습니다.");
  }
}

export async function getResults(analysisId: string) {
  try {
    const res = await tryFetch(`${API_URL}/api/results/${analysisId}`);
    if (!res.ok) throw new Error("Failed to fetch results");
    return res.json();
  } catch (error) {
    throw error instanceof Error ? error : new Error("결과를 불러오지 못했습니다.");
  }
}

export async function getResultsSummary(analysisId: string) {
  const res = await tryFetch(`${API_URL}/api/results/${analysisId}/summary`);
  if (!res.ok) throw new Error("Failed to fetch summary");
  return res.json();
}
