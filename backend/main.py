from datetime import datetime
from fastapi import FastAPI, Form, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pptx import Presentation
from pathlib import Path
import tempfile, json, os, requests, re

from Pv_Generator import (
    generate_pv_draft,
    merge_notes_with_pv,
    translate_pv,
    export_pv_to_docx,
    OLLAMA_URL,
    OLLAMA_MODEL,
    EXPORT_DIR,
)
from pptx_parser import parse_pptx
from extract import build_extracted_from_slides, extract_text_from_pptx, generate_pv
from models import DraftRequest, ExportRequest, MergeRequest, TranslateRequest

# Initialisation des modèles ML au démarrage
try:
    from pptx_parser import chart_detector
    print("🤖 Modèles IA chargés avec succès")
except Exception as e:
    print(f"⚠️  Erreur lors du chargement des modèles IA: {e}")
    chart_detector = None

app = FastAPI(
    title="PV Automation API - Version IA Avancée",
    description="""
    API pour l'automatisation des procès-verbaux avec analyse IA avancée.
    
    ## Fonctionnalités principales:
    - **Parsing PowerPoint** avec détection de graphiques (YOLO/CNN)
    - **Extraction de texte, tableaux, images et graphiques**
    - **Analyse d'images** pour détecter les graphiques et extraire des données
    - **Génération de PV** via LLM (Ollama)
    - **Traduction** multilingue
    - **Export DOCX**
    
    ## Nouvelles fonctionnalités IA:
    - Détection de barres dans les graphiques
    - Lecture d'axes avec Computer Vision
    - Reconstruction de données relatives
    - Analyse hybride YOLO + OpenCV
    """,
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
MAX_SIZE_MB = 20


@app.post("/api/parse-pptx")
async def parse_pptx_endpoint(file: UploadFile = File(...)):

    if file.content_type not in (
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.ms-powerpoint"
    ):
        raise HTTPException(status_code=415, detail="Format non supporté. Utilisez un fichier .pptx")

    contents = await file.read()

    if len(contents) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Fichier trop volumineux (max {MAX_SIZE_MB}MB)")

    with tempfile.NamedTemporaryFile(suffix=".pptx", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        result = parse_pptx(tmp_path)  # ✅ Utilise le parser amélioré avec YOLO/CNN
        
        # Ajouter des métadonnées sur l'analyse IA
        result["metadata"] = {
            "ai_analysis": {
                "chart_detection": "enabled",  # YOLO + OpenCV
                "image_analysis": "enabled",   # Détection de graphiques dans images
                "axis_detection": "enabled",   # Détection d'axes
                "data_extraction": "enabled"   # Extraction de données relatives
            },
            "processing_time": "estimated",
            "file_size_mb": round(len(contents) / (1024 * 1024), 2)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=422, 
            detail=f"Erreur de parsing du fichier PowerPoint : {str(e)}. Vérifiez que le fichier n'est pas corrompu."
        )
    finally:
        os.unlink(tmp_path)

    return JSONResponse(content=result)


@app.post("/api/analyze-chart")
async def analyze_chart_endpoint(file: UploadFile = File(...)):
    """
    Endpoint spécialisé pour analyser une image de graphique avec YOLO/CNN.
    Utile pour tester la détection de graphiques ou analyser des images individuelles.
    """
    if not chart_detector:
        raise HTTPException(
            status_code=503, 
            detail="Service d'analyse IA non disponible. Modèles ML non chargés."
        )
    
    if file.content_type not in ("image/png", "image/jpeg", "image/jpg", "image/webp"):
        raise HTTPException(
            status_code=415, 
            detail="Format non supporté. Utilisez PNG, JPEG ou WebP"
        )

    contents = await file.read()
    
    if len(contents) > 5 * 1024 * 1024:  # 5MB max pour les images
        raise HTTPException(status_code=413, detail="Image trop volumineuse (max 5MB)")

    try:
        from pptx_parser import _detect_chart_in_image, _extract_chart_data_from_image, TESSERACT_AVAILABLE
        
        # Analyser l'image
        is_chart = _detect_chart_in_image(contents)
        chart_data = _extract_chart_data_from_image(contents) if is_chart else None
        
        result = {
            "is_chart": is_chart,
            "chart_data": chart_data,
            "analysis_method": "YOLO + OpenCV + OCR hybrid" if TESSERACT_AVAILABLE else "YOLO + OpenCV",
            "confidence_note": "Avec OCR: résultats incluent labels et valeurs textuelles" if TESSERACT_AVAILABLE else "Sans OCR: données structurales uniquement",
            "processing_status": "success",
            "features": {
                "chart_detection": is_chart,
                "bar_detection": is_chart and chart_data and "detected_bars" in chart_data,
                "reconstruction": is_chart and chart_data and "bars_reconstruction" in chart_data,
                "text_regions": is_chart and chart_data and "text_regions" in chart_data,
                "ocr_extraction": TESSERACT_AVAILABLE
            }
        }
        
    except Exception as e:
        result = {
            "error": str(e),
            "processing_status": "failed",
            "fallback_available": True
        }

    return JSONResponse(content=result)


@app.get("/api/health")
async def health_check():
    """Vérifier l'état des services et modèles ML."""
    try:
        from pptx_parser import chart_detector, TESSERACT_AVAILABLE
        
        ml_status = {
            "yolo_loaded": chart_detector.yolo_model is not None,
            "opencv_available": True,
            "tesseract_available": TESSERACT_AVAILABLE,
            "models_status": "ready" if chart_detector.yolo_model else "partial"
        }
        
        installation_guide = ""
        if not TESSERACT_AVAILABLE:
            installation_guide = "Pour activer l'OCR, installez Tesseract-OCR depuis: https://github.com/UB-Mannheim/tesseract/wiki ou via Chocolatey: choco install tesseract"
        
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
                "OCR extraction (si Tesseract installé)"
            ],
            "installation_note": installation_guide
        }
    except Exception as e:
        return {
            "status": "degraded",
            "error": str(e),
            "ml_services": {"status": "error"}
        }

@app.post("/api/generate-draft")
async def generate_draft(req: DraftRequest):
    extracted = req.pv_data or {}
    draft = generate_pv_draft(OLLAMA_MODEL, extracted)
    return {
        "success": True,
        "draft": draft
    }

           
@app.post("/api/merge-notes")
async def merge_notes(req: MergeRequest):
    """Fusionner les notes des participants dans le PV via LLM."""
    notes = [{"participant": n.participant, "content": n.content} for n in req.notes]
    merged = merge_notes_with_pv(OLLAMA_MODEL, req.pv_draft, notes)
    return {"success": True, "pv": merged}


@app.post("/api/translate")
async def translate(req: TranslateRequest):
    """Traduire le PV (fr / en / ar)."""
    translated = translate_pv(OLLAMA_MODEL, req.pv, req.target_language)
    return {"success": True, "pv": translated, "language": req.target_language}


@app.post("/api/export-docx")
async def export_docx(req: ExportRequest):
    """Générer et télécharger le .docx."""
    try:
        numero = req.pv.get("numero", "PV")
        safe = re.sub(r"[^\w\-]", "_", numero)
        out = str(EXPORT_DIR / f"{safe}_{req.language}.docx")
        export_pv_to_docx(req.pv, out, req.language)
        return FileResponse(
            path=out,
            filename=f"{safe}.docx",
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    except Exception as e:
        raise HTTPException(500, str(e))



@app.post("/api/merge")
async def merge(req: MergeRequest):
    notes = [{"participant": n.participant, "content": n.content} for n in req.notes]
    merged = merge_notes_with_pv(OLLAMA_MODEL, req.pv_draft, notes)
    return {
        "success": True,
        "pv": merged
    }


@app.post("/api/export")
async def export_alias(req: ExportRequest):
    return await export_docx(req)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)