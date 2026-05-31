"""PV API routes split from main module."""

import asyncio
from concurrent.futures import ThreadPoolExecutor
import json
import os
import queue
import tempfile
import threading
import time
import uuid

from fastapi import APIRouter, Body, File, HTTPException, Response, UploadFile, requests
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

from backend.Pv_Generator import OLLAMA_MODEL
from backend.generate_pv_draft import OLLAMA_URL
from backend.models_layer.models import (
    AgendaAnalysisRequest,
    AgendaFullRequest,
    DeleteSlideRequest,
    DraftPipelineRequest,
    DraftRequest,
    ExportRequest,
    MergeRequest,
    ReformulateRequest,
    ReformulateResponse,
    SlideParagraphRequest,
    TranslateRequest,
    UpdateExtractionRequest,
)
from backend.pptx_parser_chartLlama import (
    get_pending_image_blob,
    get_pending_images,
    iter_image_analysis_events,
    parse_pptx_fast,
)
from backend.repository_layer.pv_repository import (
    create_pv_document,
    delete_slide_from_document,
    update_extraction_data,
)
from backend.services_layer.pv_service import (
    analyze_agenda_full_service,
    analyze_agenda_service,
    build_health_status_service,
    build_pipeline_docx_service,
    export_docx_service,
    generate_draft_service,
    generate_pv_from_pptx_service,
    generate_slide_paragraph_service,
    merge_notes_with_guard_service,
    merge_service,
    parse_pptx_file,
    remove_temp_file,
    translate_service,
    validate_uploaded_pptx,
)
from backend.services_layer.reformulate_service import clean_qwen_response

router = APIRouter()

@router.post("/api/parse-pptx/fast")
async def parse_fast(file: UploadFile = File(...)):
    contents = await file.read()
    token = str(uuid.uuid4())  # généré ici, pas besoin de DB

    with tempfile.NamedTemporaryFile(suffix=".pptx", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        result = parse_pptx_fast(tmp_path, token)  # stocke les blobs en mémoire
        result["token"] = token                     # retourné au frontend
    finally:
        os.unlink(tmp_path)

    return JSONResponse(content=result)


@router.post("/api/parse-pptx/images-stream")
async def stream_images(payload: dict = Body(...)):
    token = payload.get("token")

    def _stream_single_image(img_meta: dict, event_queue: queue.Queue) -> None:
        for event in iter_image_analysis_events(
            img_meta["slide_index"],
            img_meta["image_index"],
            img_meta["blob"],
        ):
            event_queue.put(event)

    async def generate():
        if not token:
            yield f"data: {json.dumps({'type': 'error', 'erreur': 'token manquant'})}\n\n"
            return

        images = get_pending_images(token)

        if not images:
            yield f"data: {json.dumps({'type': 'done', 'done': True, 'reason': 'no_images'})}\n\n"
            return

        event_queue: queue.Queue = queue.Queue()
        total = len(images)
        finished = 0

        with ThreadPoolExecutor(max_workers=min(4, total)) as executor:
            for img in images:
                executor.submit(_stream_single_image, img, event_queue)

            while finished < total:
                event = await asyncio.to_thread(event_queue.get)
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

                if event.get("type") in ("image_done", "image_error"):
                    finished += 1

        yield f"data: {json.dumps({'type': 'done', 'done': True})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/api/parse-pptx/analyze-image-stream")
async def analyze_image_stream(payload: dict = Body(...)):
    token = payload.get("token")
    slide_index = payload.get("slide_index")
    image_index = payload.get("image_index")

    async def generate():
        if not token:
            yield f"data: {json.dumps({'type': 'error', 'erreur': 'token manquant'})}\n\n"
            return

        if slide_index is None or image_index is None:
            yield f"data: {json.dumps({'type': 'error', 'erreur': 'slide_index et image_index requis'})}\n\n"
            return

        blob = get_pending_image_blob(token, int(slide_index), int(image_index))
        if not blob:
            yield f"data: {json.dumps({'type': 'image_error', 'slide_index': slide_index, 'image_index': image_index, 'error': 'Image introuvable ou session expirée'})}\n\n"
            return

        event_queue: queue.Queue = queue.Queue()
        worker_done = threading.Event()

        def worker() -> None:
            try:
                for event in iter_image_analysis_events(int(slide_index), int(image_index), blob):
                    event_queue.put(event)
            finally:
                event_queue.put(None)
                worker_done.set()

        threading.Thread(target=worker, daemon=True).start()

        started = time.monotonic()
        got_chunk = False

        while True:
            try:
                event = await asyncio.wait_for(
                    asyncio.to_thread(event_queue.get),
                    timeout=2.0,
                )
            except asyncio.TimeoutError:
                if not got_chunk and not worker_done.is_set():
                    elapsed = int(time.monotonic() - started)
                    heartbeat = {
                        "type": "image_status",
                        "slide_index": slide_index,
                        "image_index": image_index,
                        "phase": "waiting",
                        "message": (
                            f"Ollama en cours ({elapsed}s) — "
                            "chargement modèle ou pré-analyse vision sur CPU"
                        ),
                        "elapsed_seconds": elapsed,
                    }
                    yield f"data: {json.dumps(heartbeat, ensure_ascii=False)}\n\n"
                    await asyncio.sleep(0)
                continue

            if event is None:
                break

            if event.get("type") == "image_chunk":
                got_chunk = True

            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0)

        yield f"data: {json.dumps({'type': 'done', 'done': True})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/api/parse-pptx")
async def parse_pptx_endpoint(file: UploadFile = File(...)):
    validate_uploaded_pptx(file.content_type, 0)

    contents = await file.read()
    validate_uploaded_pptx(file.content_type, len(contents))

    with tempfile.NamedTemporaryFile(suffix=".pptx", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        result = parse_pptx_file(tmp_path)
        doc_id = create_pv_document(file.filename, result)
        result["db_id"] = doc_id
    finally:
        remove_temp_file(tmp_path)

    return JSONResponse(content=result)


@router.post("/api/test-slide-paragraph")
async def test_slide_paragraph(req: SlideParagraphRequest):
    result = generate_slide_paragraph_service(req.slide)
    return {
        "success": True,
        "result": result,
    }


@router.post("/api/test-agenda-analysis")
async def test_agenda_analysis(req: AgendaAnalysisRequest):
    result = analyze_agenda_service(req.agenda_group, req.use_llm)
    return {
        "success": True,
        "result": result,
    }

@router.post("/api/reformulate-note", response_model=ReformulateResponse)
def reformulate_note(payload: ReformulateRequest):
    content = payload.content.strip()

    if not content:
        raise HTTPException(status_code=400, detail="Le contenu de la note est obligatoire.")

    prompt = f"""
Reformule cette note en français professionnel pour un procès-verbal de réunion.

Règles:
- Corrige les fautes de français.
- Garde le sens original.
- N'invente aucune information.
- Utilise un ton neutre, administratif et professionnel.
- Retourne uniquement la phrase reformulée, sans explication.

Note brute:
"{content}"
""".strip()

    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "stream": False,
                "options": {
                    "temperature": 0.2,
                    "num_predict": 180,
                },
                "messages": [
                    {
                        "role": "system",
                        "content": "Tu es un assistant spécialisé dans la rédaction professionnelle de procès-verbaux de réunion.",
                    },
                    {
                        "role": "user",
                        "content": prompt,
                    },
                ],
            },
            timeout=60,
        )

        response.raise_for_status()
        data = response.json()

        generated_text = data.get("message", {}).get("content", "")
        generated_text = clean_qwen_response(generated_text)

        if not generated_text:
            raise HTTPException(status_code=500, detail="Aucune reformulation générée.")

        return {"text": generated_text}

    except requests.exceptions.ConnectionError:
        raise HTTPException(
            status_code=503,
            detail="Impossible de contacter Ollama. Vérifiez que Ollama est lancé.",
        )
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Ollama a mis trop de temps à répondre.",
        )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de l'appel à Ollama: {str(e)}",
        )
@router.post("/api/test-agenda-analysis-stream")
async def test_agenda_analysis_stream(req: AgendaAnalysisRequest):

    result = analyze_agenda_service(req.agenda_group, req.use_llm)

    async def generator():
        text = json.dumps(result, ensure_ascii=False, indent=2)

        buffer = ""

        for char in text:
            buffer += char
            yield char
            await asyncio.sleep(0.01)  # 👈 slow typing effect

    return StreamingResponse(generator(), media_type="text/plain")

@router.post("/api/merge-notes")
async def merge_notes_guarded(req: MergeRequest):
    notes = [
        {
            "participant": n.participant,
            "content": n.content,
            "ordre_du_jour": n.ordre_du_jour,
        }
        for n in req.notes
    ]
    return merge_service(req.notes, req.pv_draft)



@router.post("/api/generate-pv-from-pptx")
async def generate_pv_from_pptx(
    file: UploadFile = File(...),
    use_llm_for_slides: bool = False,
    use_llm_for_analysis: bool = True,
):
    validate_uploaded_pptx(file.content_type, 0)

    contents = await file.read()
    validate_uploaded_pptx(file.content_type, len(contents))

    with tempfile.NamedTemporaryFile(suffix=".pptx", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        return generate_pv_from_pptx_service(
            tmp_path,
            use_llm_for_slides=use_llm_for_slides,
            use_llm_for_analysis=use_llm_for_analysis,
        )
    except Exception as exc:
        print("ERREUR PIPELINE:", exc)
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        remove_temp_file(tmp_path)


@router.post("/api/generate-draft")
async def generate_draft(req: DraftRequest):
    return generate_draft_service(req.pv_data)


@router.post("/api/test-draft-pipeline")
async def test_draft_pipeline(req: DraftPipelineRequest):
    docx_bytes = build_pipeline_docx_service(
        req.extracted,
        use_llm_for_slides=req.use_llm_for_slides,
        use_llm_for_analysis=req.use_llm_for_analysis,
    )

    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": 'attachment; filename="proces_verbal.docx"'},
    )


@router.get("/api/health")
async def health_check():
    return build_health_status_service()


@router.post("/api/translate")
async def translate(req: TranslateRequest):
    return translate_service(req.pv, req.target_language)

@router.post("/api/export-docx")
async def export_docx(req: ExportRequest):
    try:
        out, safe = export_docx_service(req.pv, req.language)
        return FileResponse(
            path=out,
            filename=f"{safe}.docx",
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    except Exception as exc:
        raise HTTPException(500, str(exc))


@router.post("/api/merge")
async def merge(req: MergeRequest):
    return merge_service(req.notes, req.pv_draft)


@router.put("/api/update-extraction")
async def update_extraction(req: UpdateExtractionRequest):
    try:
        updated = update_extraction_data(req.id, req.data)
        if not updated:
            raise HTTPException(status_code=404, detail="Document non trouvé")

        return {"success": True, "message": "Extraction mise à jour avec succès"}
    except Exception as exc:
        print("ERREUR UPDATE:", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/api/delete-slide")
async def delete_slide(req: DeleteSlideRequest):
    try:
        data = delete_slide_from_document(req.id, req.slideIndex)
        if data is None:
            raise HTTPException(status_code=404, detail="Document non trouvé")

        return {"success": True, "message": "Slide supprimé avec succès", "data": data}
    except Exception as exc:
        print("ERREUR DELETE:", exc)
        raise HTTPException(status_code=500, detail=str(exc))
