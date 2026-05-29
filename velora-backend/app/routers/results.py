from fastapi import APIRouter, HTTPException
from app.database import get_analysis_result as db_get_analysis_result
from app.models.schemas import ResultsResponse
from app.routers.analysis import analysis_store
from app.services.risk_model import generate_guidance

router = APIRouter()


@router.get("/{analysis_id}", response_model=ResultsResponse)
async def get_results(analysis_id: str):
    if analysis_id in analysis_store:
        stored = analysis_store[analysis_id]["result"]
    else:
        db_result = db_get_analysis_result(analysis_id)
        if db_result:
            stored = db_result["result_payload"]
        else:
            stored = None

    if not stored:
        raise HTTPException(status_code=404, detail="분석 결과를 찾을 수 없습니다.")

    risk_level = getattr(stored["risk_level"], "value", stored["risk_level"])

    guidance_data = generate_guidance(
        risk_level=risk_level,
        risk_score=stored["risk_score"],
        confidence_score=stored["confidence_score"],
    )

    return ResultsResponse(
        analysis=stored,
        guidance=guidance_data["guidance"],
        risk_explanation=guidance_data["risk_explanation"],
        next_steps=guidance_data["next_steps"],
        legal_notice=guidance_data["legal_notice"],
    )


@router.get("/{analysis_id}/summary")
async def get_results_summary(analysis_id: str):
    if analysis_id in analysis_store:
        stored = analysis_store[analysis_id]["result"]
    else:
        db_result = db_get_analysis_result(analysis_id)
        if db_result:
            stored = db_result["result_payload"]
        else:
            stored = None

    if not stored:
        raise HTTPException(status_code=404, detail="분석 결과를 찾을 수 없습니다.")

    risk_level = getattr(stored["risk_level"], "value", stored["risk_level"])

    guidance_data = generate_guidance(
        risk_level=risk_level,
        risk_score=stored["risk_score"],
        confidence_score=stored["confidence_score"],
    )

    risk_level_kr = {
        "low": "낮음",
        "middle": "중간",
        "high": "높음",
    }

    return {
        "analysis_id": analysis_id,
        "cognitive_status": stored["cognitive_status"],
        "cognitive_status_label": stored["cognitive_status_label"],
        "dementia_stage": stored["dementia_stage"],
        "risk_score": stored["risk_score"],
        "risk_level": risk_level,
        "risk_level_label": risk_level_kr.get(risk_level, risk_level),
        "model_probabilities": stored["model_probabilities"],
        "result_message": stored["result_message"],
        "confidence_score": stored["confidence_score"],
        "processing_time_seconds": stored["processing_time_seconds"],
        "risk_explanation": guidance_data["risk_explanation"],
        "top_guidance": guidance_data["guidance"][:3] if guidance_data["guidance"] else [],
        "disclaimer": stored["disclaimer"],
    }
