import asyncio
from datetime import datetime
from fastapi import FastAPI, Form, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pptx import Presentation
from pathlib import Path
import tempfile, json, os, requests, re
from fastapi import Response
import json

from Pv_Generator import (
    generate_pv_draft,
    merge_notes_with_pv,
    translate_pv,
    export_pv_to_docx,
    OLLAMA_MODEL,
    EXPORT_DIR,
)
from db_connection import SessionLocal, engine
from docX import build_pv_docx, build_pv_request_body
from generate_pv_draft import analyze_agenda_group, generate_pv_draft_pipeline, generate_slide_paragraph
from pptx_parser_chartLlama import parse_pptx
from models import AgendaAnalysisRequest, AgendaFullRequest, DraftPipelineRequest, DraftRequest, ExportRequest, MergeRequest, PVDocument, SlideParagraphRequest, TranslateRequest, UpdateExtractionRequest, DeleteSlideRequest

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
    allow_methods=["*"],
    allow_headers=["*"],
)
MAX_SIZE_MB = 20

#ETAPE1: parse pptx -> JSON structuré
@app.post("/api/parse-pptx")
async def parse_pptx_endpoint(
    file: UploadFile = File(...)
):

    if file.content_type not in (
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.ms-powerpoint"
    ):
        raise HTTPException(
            status_code=415,
            detail="Format non supporté"
        )

    contents = await file.read()

    if len(contents) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Fichier trop volumineux"
        )

    with tempfile.NamedTemporaryFile(
        suffix=".pptx",
        delete=False
    ) as tmp:

        tmp.write(contents)
        tmp_path = tmp.name


        try:
            # EXTRACTION
            result = parse_pptx(tmp_path)

            # SESSION DB
            db = SessionLocal()

            # INSERT DB
            pv_document = PVDocument(
                filename=file.filename,
                
                nb_slides=result.get("nb_slides", 0),
                nb_slides_vides=result.get("nb_slides_vides", 0),
                nb_graphiques_natifs=result.get("nb_graphiques_natifs", 0),
                nb_images_ocr=result.get("nb_images_ocr", 0),
                tableaux=result.get("tableaux", []),
                data=json.dumps(result["slides"], ensure_ascii=False)            )

            db.add(pv_document)
            db.commit()
            db.refresh(pv_document)

            # AJOUT ID AU RESULTAT
            result["db_id"] = pv_document.id

        except Exception as e:
            db.rollback()   # 🔥 important
            print("ERREUR DB:", e)
            raise

        finally:
            db.close()

       
 
    return JSONResponse(content=result)

#ETAPE2: analyse par slide
@app.post("/api/test-slide-paragraph")
async def test_slide_paragraph(req: SlideParagraphRequest):
    result = generate_slide_paragraph(req.slide or {})
    return {
        "success": True,
        "result": result,
    }


#ETAPE3: Analyse par ordre de jour (analyse des analyses de chaque slide)
@app.post("/api/test-agenda-analysis")
async def test_agenda_analysis(req: AgendaAnalysisRequest):
    result = analyze_agenda_group(req.agenda_group or {}, use_llm=req.use_llm)
    return {
        "success": True,
        "result": result,
    }


#fusion etape 2 et 3
@app.post("/api/analyze-agenda-full")
async def analyze_agenda_full(req: AgendaFullRequest):
    # Étape 2 : analyser chaque slide
    analyzed_slides = [generate_slide_paragraph(slide) for slide in req.slides]

    # Étape 3 : analyser l'ensemble
    agenda_group = {
        "ordre_du_jour": req.ordre_du_jour,
        "slides": analyzed_slides,
    }
    result = analyze_agenda_group(agenda_group, use_llm=req.use_llm)

    return {
        "success": True,
        "slides_analyses": analyzed_slides,
        "result": result,
    }


@app.post("/api/merge-notes")
async def merge_notes(req: MergeRequest):

    pv_draft = req.pv_draft

    # ── Détection : pv_draft est un wrapper markdown ? ──
    if "content" in pv_draft and "points" not in pv_draft:
        print("⚠️ pv_draft reçu en markdown string — merge impossible")
        print("   Clés reçues :", list(pv_draft.keys()))
        return {
            "success": False,
            "error": "pv_draft doit contenir 'points', pas 'content'. Le frontend envoie du markdown au lieu du JSON structuré.",
            "pv": pv_draft  # retourne tel quel sans merger
        }

    notes = [
        {
            "participant": n.participant,
            "content": n.content,
            "ordre_du_jour": n.ordre_du_jour
        }
        for n in req.notes
    ]

    merged = merge_notes_with_pv(OLLAMA_MODEL, pv_draft, notes)

    return {"success": True, "pv": merged}







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



# Route de test pour générer un .docx à partir du résultat du pipeline
@app.post("/api/test-draft-pipeline")
async def test_draft_pipeline(req: DraftPipelineRequest):

    # ── Option A : req.extracted contient déjà le JSON mappé ──────────
    # (body construit par build_pv_request_body côté client ou autre route)
    if "analyses_par_ordre_du_jour" in (req.extracted or {}):
        pipeline_result = req.extracted

    # ── Option B : req.extracted est la sortie brute de parse_pptx ────
    else:
        body = build_pv_request_body(
            req.extracted or {},
            use_llm_for_slides=req.use_llm_for_slides,
            use_llm_for_analysis=req.use_llm_for_analysis,
        )
        pipeline_result = body["extracted"]

    docx_bytes = build_pv_docx(pipeline_result)

    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": 'attachment; filename="proces_verbal.docx"'},
    )

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


@app.put("/api/update-extraction")
async def update_extraction(req: UpdateExtractionRequest):
    db = SessionLocal()
    try:
        # Récupérer le document par ID
        pv_document = db.query(PVDocument).filter(PVDocument.id == req.id).first()
        if not pv_document:
            raise HTTPException(status_code=404, detail="Document non trouvé")
        
        # Mettre à jour le champ data
        pv_document.data = json.dumps(req.data, ensure_ascii=False)
        
        # Commit les changements
        db.commit()
        
        return {"success": True, "message": "Extraction mise à jour avec succès"}
    
    except Exception as e:
        db.rollback()
        print("ERREUR UPDATE:", e)
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        db.close()


@app.delete("/api/delete-slide")
async def delete_slide(req: DeleteSlideRequest):
    db = SessionLocal()
    try:
        # Récupérer le document par ID
        pv_document = db.query(PVDocument).filter(PVDocument.id == req.id).first()
        if not pv_document:
            raise HTTPException(status_code=404, detail="Document non trouvé")
        
        # Parser les données JSON
        data = json.loads(pv_document.data)
        
        # Supprimer le slide par index
        if "slides" in data:
            data["slides"] = [s for s in data["slides"] if s.get("index") != req.slideIndex]
        
        # Mettre à jour le champ data
        pv_document.data = json.dumps(data, ensure_ascii=False)
        
        # Commit les changements
        db.commit()
        
        return {"success": True, "message": "Slide supprimé avec succès", "data": data}
    
    except Exception as e:
        db.rollback()
        print("ERREUR DELETE:", e)
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        db.close()



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)