"""Document export and health-check service functions."""

import re

from backend.Pv_Generator import EXPORT_DIR, export_pv_to_docx



def build_health_status_service() -> dict:
    try:
        from pptx_parser import TESSERACT_AVAILABLE, chart_detector

        ml_status = {
            "yolo_loaded": chart_detector.yolo_model is not None,
            "opencv_available": True,
            "tesseract_available": TESSERACT_AVAILABLE,
            "models_status": "ready" if chart_detector.yolo_model else "partial",
        }

        installation_guide = ""
        if not TESSERACT_AVAILABLE:
            installation_guide = (
                "Pour activer l'OCR, installez Tesseract-OCR depuis: "
                "https://github.com/UB-Mannheim/tesseract/wiki "
                "ou via Chocolatey: choco install tesseract"
            )

        return {
            "status": "healthy",
            "ml_services": ml_status,
            "version": "2.0.0",
            "features": [
                "PPTX parsing",
                "Chart detection (YOLO)",
                "Image analysis (CNN)",
                "Axis detection",
                "Data extraction",
                "OCR extraction (si Tesseract installé)",
            ],
            "installation_note": installation_guide,
        }
    except Exception as exc:
        return {
            "status": "degraded",
            "error": str(exc),
            "ml_services": {"status": "error"},
        }


def export_docx_service(pv: dict, language: str) -> tuple[str, str]:
    numero = pv.get("numero", "PV")
    safe = re.sub(r"[^\w\-]", "_", numero)
    out = str(EXPORT_DIR / f"{safe}_{language}.docx")
    export_pv_to_docx(pv, out, language)
    return out, safe
