import re
from collections import Counter


KOREAN_PARTICLE_HINTS = ("은", "는", "이", "가", "을", "를", "의")
KOREAN_VERB_ENDINGS = ("다", "요", "죠", "네요", "습니다", "해요", "했어요")
FLUENCY_MARKERS = {"음", "어", "아", "그", "저", "그러니까", "뭐", "막"}
FIGURATIVE_MARKERS = {"처럼", "같이", "듯", "비유", "마치"}


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[0-9A-Za-z가-힣]+", text.lower())


def _sentences(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"[.!?\n。！？]+", text) if part.strip()]


def extract_linguistic_features(transcript_text: str | None) -> dict:
    normalized = (transcript_text or "").strip()
    if not normalized:
        return {
            "transcript_available": False,
            "vocabulary_diversity": 0.0,
            "average_sentence_length": 0.0,
            "repeated_word_ratio": 0.0,
            "noun_verb_ratio": 0.0,
            "fluency_marker_count": 0,
            "figurative_expression_count": 0,
            "language_quality_score": 0.0,
            "extraction_note": "전사 텍스트가 제공되지 않아 언어 특징은 산출하지 않았습니다.",
        }

    tokens = _tokenize(normalized)
    sentence_list = _sentences(normalized)
    token_count = len(tokens)
    unique_count = len(set(tokens))
    counts = Counter(tokens)
    repeated_count = sum(count - 1 for count in counts.values() if count > 1)

    noun_like = sum(1 for token in tokens if token.endswith(KOREAN_PARTICLE_HINTS))
    verb_like = sum(1 for token in tokens if token.endswith(KOREAN_VERB_ENDINGS))
    if noun_like == 0:
        noun_like = max(0, token_count - verb_like)

    vocabulary_diversity = unique_count / token_count if token_count else 0.0
    average_sentence_length = token_count / len(sentence_list) if sentence_list else float(token_count)
    repeated_word_ratio = repeated_count / token_count if token_count else 0.0
    noun_verb_ratio = noun_like / max(verb_like, 1)
    fluency_marker_count = sum(counts.get(marker, 0) for marker in FLUENCY_MARKERS)
    figurative_expression_count = sum(normalized.count(marker) for marker in FIGURATIVE_MARKERS)

    diversity_score = min(vocabulary_diversity / 0.65, 1.0)
    sentence_score = 1.0 if 4 <= average_sentence_length <= 18 else 0.65
    repetition_score = max(0.0, 1.0 - repeated_word_ratio * 2.5)
    language_quality_score = (diversity_score * 0.45) + (sentence_score * 0.25) + (repetition_score * 0.30)

    return {
        "transcript_available": True,
        "vocabulary_diversity": round(float(vocabulary_diversity), 4),
        "average_sentence_length": round(float(average_sentence_length), 2),
        "repeated_word_ratio": round(float(repeated_word_ratio), 4),
        "noun_verb_ratio": round(float(noun_verb_ratio), 4),
        "fluency_marker_count": int(fluency_marker_count),
        "figurative_expression_count": int(figurative_expression_count),
        "language_quality_score": round(float(language_quality_score), 4),
        "extraction_note": "제공된 전사 텍스트에서 휴리스틱 언어 특징을 산출했습니다.",
    }
