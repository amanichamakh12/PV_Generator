"""Translation service functions."""




from backend.Pv_Generator import translate_pv
from backend.generate_pv_draft import OLLAMA_MODEL
from backend.services_layer.translation_ifsb import translate_pv_ar_ifrb


def translate_service(pv: dict, target_language: str) -> dict:
    if (target_language or "").lower() == "ar":
        translated = translate_pv_ar_ifrb(OLLAMA_MODEL, pv)
    else:
        translated = translate_pv(OLLAMA_MODEL, pv, target_language)
    return {"success": True, "pv": translated, "language": target_language}
