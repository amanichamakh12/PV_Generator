from datetime import datetime
from fastapi import FastAPI, Form, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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
from extract import build_extracted_from_slides, extract_text_from_pptx, generate_pv
from models import DraftRequest, ExportRequest, MergeRequest, TranslateRequest

app = FastAPI(title="PV Automation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/parse-pptx")
async def parse_pptx(
    file: UploadFile = File(...),
    session_info: str = Form(default="{}")  # ← default "{}" pour éviter l'erreur si absent
):
    try:
        session = json.loads(session_info)
    except json.JSONDecodeError:
        session = {}

    with tempfile.NamedTemporaryFile(suffix=".pptx", delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        slides = extract_text_from_pptx(tmp_path)
        extracted = build_extracted_from_slides(slides, session)
    finally:
        os.unlink(tmp_path)  # nettoyage fichier temp

    return {"extracted": extracted}


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


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "backend": "Claude" if USE_CLAUDE else f"Ollama ({OLLAMA_MODEL})",
        "ollama_url": OLLAMA_URL,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)