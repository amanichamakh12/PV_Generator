import asyncio
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
    OLLAMA_MODEL,
    EXPORT_DIR,
)
from generate_pv_draft import analyze_agenda_group, generate_pv_draft_pipeline, generate_slide_paragraph
from pptx_parser_chartLlama import parse_pptx
from models import AgendaAnalysisRequest, DraftPipelineRequest, DraftRequest, ExportRequest, MergeRequest, SlideParagraphRequest, TranslateRequest

# Initialisation des modèles ML au démarrage
try:
    from pptx_parser import chart_detector
    print("🤖 Modèles IA chargés avec succès")
except Exception as e:
    print(f"⚠️  Erreur lors du chargement des modèles IA: {e}")
    chart_detector = None

app = FastAPI(
    title="PV Automation API - Version IA Avancée"
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
        raise HTTPException(status_code=415, detail="Format non supporté")

    contents = await file.read()

    if len(contents) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux")

    with tempfile.NamedTemporaryFile(suffix=".pptx", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        result = parse_pptx(tmp_path)  
        
    except Exception as e:
        print("ERREUR PARSING:", e)
        raise
    finally:
        os.unlink(tmp_path)
    return JSONResponse(content=result)
@app.post("/api/generate-pv-from-pptx")
async def generate_pv_from_pptx(
    file: UploadFile = File(...),
    use_llm_for_slides: bool = False,
    use_llm_for_analysis: bool = True
):
    # 1. Validation fichier
    if file.content_type not in (
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.ms-powerpoint"
    ):
        raise HTTPException(status_code=415, detail="Format non supporté")

    contents = await file.read()

    if len(contents) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux")

    # 2. Sauvegarde temporaire
    with tempfile.NamedTemporaryFile(suffix=".pptx", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        # 3. STEP 1 — extraction PPTX
        extracted = parse_pptx(tmp_path)

        # 4. STEP 2 — génération PV pipeline
        result = generate_pv_draft_pipeline(
            extracted,
            use_llm_for_slides=use_llm_for_slides,
            use_llm_for_analysis=use_llm_for_analysis,
        )

        return {
            "success": True,
            "pipeline_mode": {
                "slides": "llm" if use_llm_for_slides else "heuristic",
                "analysis": "llm" if use_llm_for_analysis else "heuristic"
            },
            "result": result
        }

    except Exception as e:
        print("ERREUR PIPELINE:", e)
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        os.unlink(tmp_path)

@app.post("/api/generate-draft")
async def generate_draft(req: DraftRequest):
    extracted = req.pv_data or {}
    draft = generate_pv_draft(OLLAMA_MODEL, extracted)
    return {
        "success": True,
        "draft": draft
    }


@app.post("/api/test-slide-paragraph")
async def test_slide_paragraph(req: SlideParagraphRequest):
    result = generate_slide_paragraph(req.slide or {}, use_llm=req.use_llm)
    return {
        "success": True,
        "result": result,
    }


@app.post("/api/test-agenda-analysis")
async def test_agenda_analysis(req: AgendaAnalysisRequest):
    result = analyze_agenda_group(req.agenda_group or {}, use_llm=req.use_llm)
    return {
        "success": True,
        "result": result,
    }


@app.post("/api/test-draft-pipeline")
async def test_draft_pipeline(req: DraftPipelineRequest):
    result = generate_pv_draft_pipeline(
        req.extracted or {},
        use_llm_for_slides=req.use_llm_for_slides,
        use_llm_for_analysis=req.use_llm_for_analysis,
    )
    return {
        "success": True,
        "result": result,
    }


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