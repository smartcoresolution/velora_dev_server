import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from app.database import get_consent_by_token, insert_returning
from app.models.schemas import ConsentRequest, ConsentResponse

router = APIRouter()

# In-memory consent store
consent_store: dict[str, dict] = {}

POLICY_VERSION = "1.0.0"
RETENTION_PERIOD_DAYS = 90


@router.post("/agree", response_model=ConsentResponse)
async def submit_consent(request: ConsentRequest):
    if not all([
        request.data_collection_agreed,
        request.privacy_policy_agreed,
        request.non_medical_disclaimer_agreed,
        request.third_party_voice_agreed,
    ]):
        raise HTTPException(
            status_code=400,
            detail="모든 동의 항목에 동의해야 서비스를 이용할 수 있습니다."
        )

    normalized_name = (request.user_name or "").strip() or None

    consent_token = str(uuid.uuid4())
    consent_data = {
        "user_name": normalized_name,
        "age_group": request.age_group,
        "agreed_at": datetime.now(timezone.utc).isoformat(),
        "policy_version": POLICY_VERSION,
        "items": {
            "data_collection": request.data_collection_agreed,
            "privacy_policy": request.privacy_policy_agreed,
            "non_medical_disclaimer": request.non_medical_disclaimer_agreed,
            "third_party_voice": request.third_party_voice_agreed,
        },
    }
    try:
        db_row = insert_returning(
            """
            WITH new_user AS (
                INSERT INTO users (user_name, age_group)
                VALUES (:user_name, :age_group)
                RETURNING id
            )
            INSERT INTO consents (
                user_id,
                consent_token,
                policy_version,
                data_collection_agreed,
                privacy_policy_agreed,
                non_medical_disclaimer_agreed,
                third_party_voice_agreed
            )
            SELECT
                id,
                CAST(:consent_token AS uuid),
                :policy_version,
                :data_collection_agreed,
                :privacy_policy_agreed,
                :non_medical_disclaimer_agreed,
                :third_party_voice_agreed
            FROM new_user
            RETURNING id, user_id
            """,
            {
                "user_name": normalized_name,
                "age_group": request.age_group.value,
                "consent_token": consent_token,
                "policy_version": POLICY_VERSION,
                "data_collection_agreed": request.data_collection_agreed,
                "privacy_policy_agreed": request.privacy_policy_agreed,
                "non_medical_disclaimer_agreed": request.non_medical_disclaimer_agreed,
                "third_party_voice_agreed": request.third_party_voice_agreed,
            },
        )
        consent_data["db_id"] = str(db_row["id"])
        consent_data["user_id"] = str(db_row["user_id"])
    except RuntimeError:
        consent_data["db_id"] = None
        consent_data["user_id"] = str(uuid.uuid4())
    consent_store[consent_token] = consent_data

    return ConsentResponse(
        consent_token=consent_token,
        policy_version=POLICY_VERSION,
        retention_period_days=RETENTION_PERIOD_DAYS,
        message="동의가 완료되었습니다. 이 토큰을 사용하여 서비스를 이용하세요.",
    )


@router.get("/verify/{consent_token}")
async def verify_consent(consent_token: str):
    consent = consent_store.get(consent_token)
    if not consent:
        row = get_consent_by_token(consent_token)
        if row:
            consent = {
                "db_id": str(row["id"]),
                "user_id": str(row["user_id"]),
                "user_name": row["user_name"],
                "age_group": row["age_group"],
                "agreed_at": row["agreed_at"].isoformat(),
                "policy_version": row["policy_version"],
                "items": {
                    "data_collection": row["data_collection_agreed"],
                    "privacy_policy": row["privacy_policy_agreed"],
                    "non_medical_disclaimer": row["non_medical_disclaimer_agreed"],
                    "third_party_voice": row["third_party_voice_agreed"],
                },
            }
            consent_store[consent_token] = consent

    if not consent:
        raise HTTPException(status_code=404, detail="유효하지 않은 동의 토큰입니다.")
    return {"valid": True, "consent": consent}


@router.get("/policy")
async def get_policy():
    return {
        "version": POLICY_VERSION,
        "title": "VELORA 데이터 처리 및 개인정보 보호 정책",
        "sections": [
            {
                "title": "서비스 목적",
                "content": (
                    "VELORA는 통화 음성을 분석하여 인지기능 변화와 연관될 수 있는 "
                    "위험 신호를 비의료적으로 선별하는 참고용 서비스입니다. "
                    "본 서비스는 의료 진단을 목적으로 하지 않습니다."
                ),
            },
            {
                "title": "데이터 수집 범위",
                "content": (
                    "통화 녹음 파일, 연령대 정보를 수집합니다. "
                    "음성 내 개인식별정보(PII)는 자동으로 마스킹 처리됩니다."
                ),
            },
            {
                "title": "데이터 보관 및 삭제",
                "content": (
                    f"원본 음성 파일은 분석 완료 후 즉시 삭제되며, "
                    f"익명화된 특징 데이터는 최대 {RETENTION_PERIOD_DAYS}일간 보관 후 자동 삭제됩니다. "
                    "사용자는 언제든지 데이터 삭제를 요청할 수 있습니다."
                ),
            },
            {
                "title": "제3자 음성 안내",
                "content": (
                    "통화 녹음에는 상대방의 음성이 포함될 수 있습니다. "
                    "상대방 음성은 분석에서 자동으로 분리 및 제외되며, 별도로 저장되지 않습니다."
                ),
            },
            {
                "title": "비의료적 서비스 고지",
                "content": (
                    "본 서비스의 분석 결과는 의료적 진단이나 치료 판단이 아닌, "
                    "인지기능 변화와 연관될 수 있는 위험 신호를 참고용으로 제공하는 "
                    "비의료적 정보입니다. 건강 관련 결정은 반드시 전문 의료기관과 상담하시기 바랍니다."
                ),
            },
        ],
        "consent_items": [
            {"key": "data_collection", "label": "데이터 수집 및 분석에 동의합니다.", "required": True},
            {"key": "privacy_policy", "label": "개인정보 처리 방침에 동의합니다.", "required": True},
            {"key": "non_medical_disclaimer", "label": "비의료적 서비스임을 이해하고 동의합니다.", "required": True},
            {"key": "third_party_voice", "label": "제3자 음성 포함 가능성을 이해하고 동의합니다.", "required": True},
        ],
    }
