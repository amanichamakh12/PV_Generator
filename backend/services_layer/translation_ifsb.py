"""Arabic PV translation pipeline with IFRB-aligned Islamic finance glossary."""

import copy
import json
import re
from typing import Any

from Pv_Generator import _call_llm, _extract_json, translate_pv


IFRB_FR_AR_LEXICON: dict[str, str] = {
    "finance islamique": "المالية الإسلامية",
    "charia": "الشريعة",
    "chariatique": "متوافق مع الشريعة",
    "comité charia": "هيئة الرقابة الشرعية",
    "conformité charia": "الامتثال الشرعي",
    "moucharaka": "المشاركة",
    "mudaraba": "المضاربة",
    "mourabaha": "المرابحة",
    "ijara": "الإجارة",
    "salam": "السلم",
    "istisna": "الاستصناع",
    "sukuk": "الصكوك",
    "zakat": "الزكاة",
    "waqf": "الوقف",
    "takaful": "التكافل",
    "qard hassan": "القرض الحسن",
    "qard hasan": "القرض الحسن",
    "banque islamique": "المصرف الإسلامي",
    "comité des risques": "لجنة المخاطر",
    "gouvernance": "الحوكمة",
    "décision": "قرار",
    "délibération": "مداولة",
    "résolution": "مقرر",
    "plan d'action": "خطة العمل",
    "coût du risque": "تكلفة المخاطر",
    "ratio de solvabilité": "نسبة كفاية رأس المال",
    "créances douteuses": "الديون المتعثرة",
    "npl ratio": "نسبة التمويلات المتعثرة",
    "liquidité": "السيولة",
    "lcr": "نسبة تغطية السيولة",
    "nsfr": "نسبة صافي التمويل المستقر",
    "stress test": "اختبار الضغط",
}

NON_TRANSLATABLE_KEYS = {
    "numero",
    "id",
    "date",
    "heure_debut",
    "heure_fin",
    "echeance",
    "_language",
}


def _replace_glossary_terms(text: str) -> str:
    if not text:
        return text

    result = text
    for fr_term, ar_term in sorted(IFRB_FR_AR_LEXICON.items(), key=lambda item: len(item[0]), reverse=True):
        pattern = re.compile(r"(?i)(?<!\w)" + re.escape(fr_term) + r"(?!\w)")
        result = pattern.sub(ar_term, result)
    return result


def _apply_glossary_recursively(data: Any, parent_key: str | None = None) -> Any:
    if isinstance(data, dict):
        out: dict[str, Any] = {}
        for key, value in data.items():
            out[key] = _apply_glossary_recursively(value, key)
        return out

    if isinstance(data, list):
        return [_apply_glossary_recursively(item, parent_key) for item in data]

    if isinstance(data, str):
        if parent_key in NON_TRANSLATABLE_KEYS:
            return data
        return _replace_glossary_terms(data)

    return data


def _coerce_structure(translated: Any, source: Any) -> Any:
    """Keep source JSON shape if LLM returns missing/extra keys."""
    if isinstance(source, dict):
        out: dict[str, Any] = {}
        tr = translated if isinstance(translated, dict) else {}
        for key, source_value in source.items():
            out[key] = _coerce_structure(tr.get(key), source_value)
        return out

    if isinstance(source, list):
        tr_list = translated if isinstance(translated, list) else []
        if not source:
            return tr_list

        out_list: list[Any] = []
        for idx, src_item in enumerate(source):
            candidate = tr_list[idx] if idx < len(tr_list) else src_item
            out_list.append(_coerce_structure(candidate, src_item))
        return out_list

    if translated is None:
        return source
    return translated


def _build_ifrb_prompt(pv: dict) -> str:
    lexicon_lines = "\n".join(f"- {fr} => {ar}" for fr, ar in sorted(IFRB_FR_AR_LEXICON.items()))
    return f"""قم بترجمة محضر الاجتماع التالي إلى العربية الرسمية مع الالتزام الصارم بمصطلحات IFSB للمالية الإسلامية.

النص المصدر (JSON):
{json.dumps(pv, ensure_ascii=False, indent=2)}

تعليمات إلزامية:
1) حافظ على نفس بنية JSON تماما (نفس المفاتيح ونفس الترتيب المنطقي).
2) ترجم جميع الحقول النصية فقط.
3) لا تترجم الرموز والمعرفات والتواريخ والساعات (مثل PV-2025-001 و A01).
4) استخدم المصطلحات التالية كما هي عند ظهور نظيرها الفرنسي:
{lexicon_lines}
5) لا تضف أي شرح أو تعليق.
6) أخرج JSON صالح فقط.
"""


def translate_pv_ar_ifrb(client: str, pv: dict) -> dict:
    """Translate PV to Arabic using IFRB glossary constraints and JSON-shape guarantees."""
    if not isinstance(pv, dict):
        return pv

    system = (
        "أنت مترجم قانوني ومالي متخصص في محاضر اللجان المصرفية الإسلامية. "
        "التزم بالمصطلحات الشرعية والمالية الرسمية، وأخرج JSON صالح فقط دون أي نص إضافي."
    )

    prompt = _build_ifrb_prompt(pv)

    try:
        raw = _call_llm(system, prompt, max_tokens=4500)
        parsed = _extract_json(raw)

        if not parsed:
            fallback = translate_pv(client, pv, "ar")
            parsed = fallback if isinstance(fallback, dict) else copy.deepcopy(pv)

        structured = _coerce_structure(parsed, pv)
        normalized = _apply_glossary_recursively(structured)
        if isinstance(normalized, dict):
            normalized["_language"] = "ar"
            normalized["_translation_profile"] = "ifrb_ar"
        return normalized
    except Exception as exc:
        print(f"⚠️ Traduction IFRB AR en échec: {exc}")
        fallback = translate_pv(client, pv, "ar")
        if isinstance(fallback, dict):
            fallback = _coerce_structure(fallback, pv)
            fallback = _apply_glossary_recursively(fallback)
            fallback["_language"] = "ar"
            fallback["_translation_profile"] = "ifrb_ar_fallback"
            return fallback
        return pv
