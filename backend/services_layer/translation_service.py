"""Translation service functions."""




from deep_translator import GoogleTranslator

from backend.Pv_Generator import translate_pv
from backend.generate_pv_draft import OLLAMA_MODEL
from backend.services_layer.translation_ifsb import translate_pv_ar_ifrb, translate_pv_en

def translate_service(pv: str, target_language: str) -> dict:
    translated = GoogleTranslator(source='fr', target=target_language).translate(pv)

    return {
        "success": True,
        "language": target_language,
        "pv": translated
    }


