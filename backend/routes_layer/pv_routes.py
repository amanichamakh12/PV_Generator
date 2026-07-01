"""PV API routes split from main module."""

import asyncio
from concurrent.futures import ThreadPoolExecutor
import json
import os
import queue
import requests
import tempfile
import threading
import time
import uuid

from fastapi import APIRouter, Body, Depends, File, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from sqlalchemy.orm import Session

from core_layer.database import get_db
from generate_pv_draft import OLLAMA_URL
from models_layer.orm_models import PvSession
from models_layer.dto_models import (
    AgendaAnalysisRequest,
    AgendaFullRequest,
    AgendaItemUpdateRequest,
    AgendaNotesReformulateRequest,
    DeleteSlideRequest,
    DraftPipelineRequest,
    DraftRequest,
    ExportRequest,
    FinalPvSaveRequest,
    MeetingNoteCreateRequest,
    MergeRequest,
    NoteUpdateRequest,
    SaveTranslationRequest,
    PvDraftCreateRequest,
    ReformulateRequest,
    SessionStatusRequest,
    SlideChartUpdateRequest,
    SlideParagraphRequest,
    SlideTableUpdateRequest,
    SlideUpdateRequest,
    TranslateRequest,
    UpdateExtractionRequest,
)
from Pv_Generator import OLLAMA_MODEL
from Graph.pptx_parser_chartLlama import (
    get_pending_image_blob,
    get_pending_images,
    iter_image_analysis_events,
    parse_pptx_fast,
)
from repository_layer.agenda_repository import agenda_repo
from repository_layer.draft_repository import draft_repo, participant_repo, translation_repo
from repository_layer.note_repository import note_repo
from repository_layer.pv_repository import (
    create_pv_document,
    delete_slide_from_document,
    update_extraction_data,
)
from repository_layer.session_repository import session_repo
from repository_layer.slide_repository import slide_chart_repo, slide_repo, slide_table_repo
from services_layer.pv_service import (
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
from services_layer.extraction_service import persist_image_chart, persist_parsed_slides
from services_layer.reformulate_service import clean_qwen_response

router = APIRouter()


# ---------------------------------------------------------------------------
# PPTX Parsing
# ---------------------------------------------------------------------------

@router.post("/api/parse-pptx/fast")
async def parse_fast(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contents = await file.read()
    token = str(uuid.uuid4())

    with tempfile.NamedTemporaryFile(suffix=".pptx", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        result = parse_pptx_fast(tmp_path, token)
        result["token"] = token

        pv_session = session_repo.create(
            db,
            filename=file.filename or "upload.pptx",
            status="uploaded",
            nb_slides=result.get("nb_slides", 0),
            nb_slides_vides=result.get("nb_slides_vides", 0),
            nb_graphiques_natifs=result.get("nb_graphiques_natifs", 0),
            nb_images_ocr=result.get("nb_images_pending", 0),
        )
        persist_parsed_slides(db, pv_session.id, result)
        result["session_id"] = pv_session.id
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


@router.post("/api/analyze-image/smolvlm")
async def analyze_image_smolvlm(payload: dict = Body(...)):
    """Analyse une image avec le modèle fine-tuné smolvlm-graphes-v2 et persiste en DB."""
    from services_layer.smolvlm_service import analyze_image_bytes
    import logging as _logging
    _log = _logging.getLogger(__name__)

    token = payload.get("token")
    slide_index = payload.get("slide_index")
    image_index = payload.get("image_index")
    session_id = payload.get("session_id")

    async def generate():
        if not token or slide_index is None or image_index is None:
            yield f"data: {json.dumps({'type': 'error', 'erreur': 'token, slide_index et image_index requis'})}\n\n"
            return

        blob = get_pending_image_blob(token, int(slide_index), int(image_index))
        if not blob:
            yield f"data: {json.dumps({'type': 'image_error', 'slide_index': slide_index, 'image_index': image_index, 'error': 'Image introuvable ou session expirée'})}\n\n"
            return

        # Lance l'inférence SmolVLM dans un thread pour ne pas bloquer la boucle asyncio
        result_holder: list = []
        error_holder: list = []
        done_event = threading.Event()

        def worker() -> None:
            try:
                raw = analyze_image_bytes(blob)
                result_holder.append(raw)
            except Exception as exc:
                error_holder.append(str(exc))
            finally:
                done_event.set()

        threading.Thread(target=worker, daemon=True).start()

        # Heartbeat pendant l'inférence (peut prendre 10-60s sur CPU)
        started = time.monotonic()
        while not done_event.is_set():
            elapsed = int(time.monotonic() - started)
            yield f"data: {json.dumps({'type': 'image_status', 'slide_index': slide_index, 'image_index': image_index, 'phase': 'inference', 'message': f'SmolVLM en cours ({elapsed}s)…', 'elapsed_seconds': elapsed}, ensure_ascii=False)}\n\n"
            await asyncio.sleep(2.0)

        if error_holder:
            yield f"data: {json.dumps({'type': 'image_error', 'slide_index': slide_index, 'image_index': image_index, 'error': error_holder[0]})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'done': True})}\n\n"
            return

        raw = result_holder[0] if result_holder else ""

        # Parse le JSON retourné par SmolVLM
        try:
            result = json.loads(raw)
        except json.JSONDecodeError:
            result = {"type": "autre", "titre": None, "data": [], "raw": raw}

        # Normalise : smolvlm-graphes-v2 retourne {type, titre, data:[{category, valeur}]}
        result.setdefault("source", "smolvlm")
        result.setdefault("confidence", 0.9)

        # Chunk intermédiaire (compatibilité frontend)
        yield f"data: {json.dumps({'type': 'image_chunk', 'slide_index': slide_index, 'image_index': image_index, 'delta': raw}, ensure_ascii=False)}\n\n"
        await asyncio.sleep(0)

        # Persistance en DB
        db_id = None
        if session_id:
            try:
                db_id = await asyncio.to_thread(
                    persist_image_chart,
                    int(session_id),
                    int(slide_index),
                    result,
                    "smolvlm",
                )
            except Exception as exc:
                _log.error("persist_image_chart failed: %s", exc)

        done_payload = {
            "type": "image_done",
            "slide_index": slide_index,
            "image_index": image_index,
            "result": result,
        }
        if db_id is not None:
            done_payload["db_id"] = db_id

        yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"
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


# ---------------------------------------------------------------------------
# Session management
# ---------------------------------------------------------------------------

@router.get("/api/sessions")
async def list_sessions(db: Session = Depends(get_db)):
    sessions = (
        db.query(PvSession)
        .order_by(PvSession.created_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "filename": s.filename,
            "status": s.status,
            "nb_slides": s.nb_slides,
            "nb_slides_vides": s.nb_slides_vides,
            "nb_graphiques_natifs": s.nb_graphiques_natifs,
            "nb_images_ocr": s.nb_images_ocr,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        }
        for s in sessions
    ]


@router.get("/api/sessions/{session_id}")
async def get_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(PvSession).filter(PvSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")

    slides_data = []
    for slide in session.slides:
        charts = [
            {
                "id": c.id,
                "chart_type": c.chart_type,
                "chart_title": c.chart_title,
                "chart_data": c.chart_data,
                "confidence_score": c.confidence_score,
                "extraction_method": c.extraction_method,
                "image_path": c.image_path,
            }
            for c in slide.charts
        ]
        tables = [
            {
                "id": t.id,
                "table_data": t.table_data,
                "position_index": t.position_index,
            }
            for t in slide.tables
        ]
        slides_data.append({
            "id": slide.id,
            "slide_number": slide.slide_number,
            "titre": slide.titre,
            "contenu": slide.contenu,
            "is_empty": slide.is_empty,
            "has_native_chart": slide.has_native_chart,
            "is_ocr_candidate": slide.is_ocr_candidate,
            "agenda_item_index": slide.agenda_item_index,
            "charts": charts,
            "tables": tables,
        })

    agenda_data = [
        {
            "id": item.id,
            "ordre": item.ordre,
            "titre": item.titre,
            "analysis": item.analysis,
            "key_findings": item.key_findings,
            "identified_risks": item.identified_risks,
            "suggested_actions": item.suggested_actions,
            "reformulated_notes": item.reformulated_notes,
        }
        for item in session.agenda_items
    ]

    # Participants as strings ("nom — role" or "nom")
    participants_data = [
        f"{p.nom} — {p.role}" if p.role else (p.nom or "")
        for p in session.participants
        if p.nom
    ]

    # Latest non-final draft
    session_drafts = draft_repo.get_by_session(db, session.id)
    non_final_drafts = [d for d in session_drafts if not d.is_final]
    latest_draft = non_final_drafts[0] if non_final_drafts else (session_drafts[0] if session_drafts else None)
    draft_data = None
    if latest_draft:
        draft_data = {
            "id": latest_draft.id,
            "titre": latest_draft.titre,
            "date_reunion": latest_draft.date_reunion.isoformat() if latest_draft.date_reunion else None,
            "comite_type": latest_draft.comite_type,
            "is_final": latest_draft.is_final,
            "draft_content": latest_draft.draft_content,
            "version": latest_draft.version,
        }

    # Final PV content
    final_draft = draft_repo.get_final(db, session.id)
    final_content = final_draft.draft_content if final_draft else None

    # Translations (keyed by frontend lang name: 'arabic', 'english')
    lang_map = {"ar": "arabic", "en": "english"}
    translations_data: dict = {}
    if final_draft:
        for t in final_draft.translations:
            key = lang_map.get(t.target_language, t.target_language)
            translations_data[key] = t.translated_content

    # Meeting notes
    raw_notes = note_repo.get_by_session(db, session.id)
    meeting_notes_data = [
        {
            "id": n.id,
            "participant": n.participant,
            "content": n.content,
            "agenda_item_index": n.agenda_item_index,
            "type": n.type or 'note',
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in raw_notes
    ]

    return {
        "id": session.id,
        "filename": session.filename,
        "status": session.status,
        "nb_slides": session.nb_slides,
        "nb_slides_vides": session.nb_slides_vides,
        "nb_graphiques_natifs": session.nb_graphiques_natifs,
        "nb_images_ocr": session.nb_images_ocr,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "updated_at": session.updated_at.isoformat() if session.updated_at else None,
        "slides": slides_data,
        "agenda_items": agenda_data,
        "participants": participants_data,
        "draft": draft_data,
        "final_content": final_content,
        "translations": translations_data,
        "meeting_notes": meeting_notes_data,
    }


@router.patch("/api/sessions/{session_id}/status")
async def update_session_status(
    session_id: int,
    payload: SessionStatusRequest,
    db: Session = Depends(get_db),
):
    updated = session_repo.update_status(db, session_id, payload.status)
    if not updated:
        raise HTTPException(status_code=404, detail="Session non trouvée")
    return {"id": updated.id, "status": updated.status}


@router.delete("/api/sessions/{session_id}")
async def delete_session(session_id: int, db: Session = Depends(get_db)):
    deleted = session_repo.delete(db, session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session non trouvée")
    return {"success": True, "id": session_id}


@router.post("/api/sessions/{session_id}/final-pv")
async def save_final_pv(
    session_id: int,
    payload: FinalPvSaveRequest,
    db: Session = Depends(get_db),
):
    existing_final = draft_repo.get_final(db, session_id)
    if existing_final:
        draft_repo.update(db, existing_final.id, draft_content=payload.content)
        return {"id": existing_final.id, "is_final": True}
    drafts = draft_repo.get_by_session(db, session_id)
    ref = drafts[0] if drafts else None
    version = draft_repo.get_next_version(db, session_id)
    new_draft = draft_repo.create(
        db,
        session_id=session_id,
        titre=ref.titre if ref else "PROCÈS-VERBAL",
        date_reunion=ref.date_reunion if ref else None,
        comite_type=ref.comite_type if ref else "Comité des Risques",
        language="fr",
        version=version,
        is_final=True,
        draft_content=payload.content,
    )
    return {"id": new_draft.id, "is_final": True}


@router.post("/api/sessions/{session_id}/translations")
async def save_session_translation(
    session_id: int,
    payload: SaveTranslationRequest,
    db: Session = Depends(get_db),
):
    final_draft = draft_repo.get_final(db, session_id)
    if not final_draft:
        drafts = draft_repo.get_by_session(db, session_id)
        if not drafts:
            raise HTTPException(status_code=404, detail="Aucun draft trouvé pour cette session")
        final_draft = drafts[0]
    existing = translation_repo.get_by_draft_and_language(db, final_draft.id, payload.language)
    if existing:
        translation_repo.update(db, existing.id, translated_content=payload.content)
        return {"id": existing.id, "language": payload.language}
    new_trans = translation_repo.create(
        db,
        draft_id=final_draft.id,
        target_language=payload.language,
        translated_content=payload.content,
    )
    return {"id": new_trans.id, "language": payload.language}


# ---------------------------------------------------------------------------
# Slides
# ---------------------------------------------------------------------------

@router.patch("/api/slides/{slide_id}")
async def update_slide(
    slide_id: int,
    payload: SlideUpdateRequest,
    db: Session = Depends(get_db),
):
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")

    updated = slide_repo.update(db, slide_id, **updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Slide non trouvée")

    return {"id": updated.id, "titre": updated.titre, "contenu": updated.contenu}


@router.patch("/api/slide-charts/{chart_id}")
async def update_slide_chart(
    chart_id: int,
    payload: SlideChartUpdateRequest,
    db: Session = Depends(get_db),
):
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")

    updated = slide_chart_repo.update(db, chart_id, **updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Graphique non trouvé")

    return {
        "id": updated.id,
        "chart_type": updated.chart_type,
        "chart_title": updated.chart_title,
        "chart_data": updated.chart_data,
    }


@router.patch("/api/slide-tables/{table_id}")
async def update_slide_table(
    table_id: int,
    payload: SlideTableUpdateRequest,
    db: Session = Depends(get_db),
):
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")

    updated = slide_table_repo.update(db, table_id, **updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Tableau non trouvé")

    return {"id": updated.id, "table_data": updated.table_data}


# ---------------------------------------------------------------------------
# Agenda items
# ---------------------------------------------------------------------------

@router.patch("/api/agenda-items/{item_id}")
async def update_agenda_item(
    item_id: int,
    payload: AgendaItemUpdateRequest,
    db: Session = Depends(get_db),
):
    updates = payload.model_dump(exclude_none=True)
    updated = agenda_repo.update(db, item_id, **updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Point d'ordre du jour non trouvé")
    return {"id": updated.id, "analysis": updated.analysis, "reformulated_notes": updated.reformulated_notes}


# ---------------------------------------------------------------------------
# PV Drafts
# ---------------------------------------------------------------------------

@router.post("/api/pv-drafts")
async def create_pv_draft(payload: PvDraftCreateRequest, db: Session = Depends(get_db)):
    from datetime import date as date_type
    date_val = None
    if payload.date_reunion:
        try:
            date_val = date_type.fromisoformat(payload.date_reunion)
        except ValueError:
            pass

    # Persist participants (replace existing ones for this session)
    if payload.participants:
        participant_repo.delete_by_session(db, payload.session_id)
        for p_str in payload.participants:
            parts = p_str.split(" — ", 1)
            nom = parts[0].strip()
            role = parts[1].strip() if len(parts) > 1 else ""
            participant_repo.create(db, session_id=payload.session_id, nom=nom, role=role, presence="present")

    next_version = draft_repo.get_next_version(db, payload.session_id)
    draft = draft_repo.create(
        db,
        session_id=payload.session_id,
        titre=payload.titre,
        date_reunion=date_val,
        introduction=payload.introduction,
        comite_type=payload.comite_type,
        version=next_version,
        draft_content=payload.draft_content,
    )
    return {
        "id": draft.id,
        "draft_id": draft.id,
        "session_id": draft.session_id,
        "titre": draft.titre,
        "version": draft.version,
        "created_at": draft.created_at.isoformat() if draft.created_at else None,
    }


@router.get("/api/pv-drafts/{session_id}")
async def get_pv_drafts(session_id: int, db: Session = Depends(get_db)):
    drafts = draft_repo.get_by_session(db, session_id)
    return [
        {
            "id": d.id,
            "session_id": d.session_id,
            "titre": d.titre,
            "version": d.version,
            "is_final": d.is_final,
            "draft_content": d.draft_content,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in drafts
    ]


# ---------------------------------------------------------------------------
# Meeting notes
# ---------------------------------------------------------------------------

@router.post("/api/meeting-notes")
async def create_meeting_note(
    payload: MeetingNoteCreateRequest,
    db: Session = Depends(get_db),
):
    note = note_repo.create(
        db,
        session_id=payload.session_id,
        participant=payload.participant,
        content=payload.content,
        agenda_item_index=payload.agenda_item_index,
        type=payload.type or 'note',
    )
    return {
        "id": note.id,
        "session_id": note.session_id,
        "participant": note.participant,
        "content": note.content,
        "agenda_item_index": note.agenda_item_index,
        "type": note.type,
        "created_at": note.created_at.isoformat() if note.created_at else None,
    }


@router.delete("/api/meeting-notes/{note_id}")
async def delete_meeting_note(note_id: int, db: Session = Depends(get_db)):
    deleted = note_repo.delete(db, note_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Note non trouvée")
    return {"success": True, "id": note_id}


@router.patch("/api/meeting-notes/{note_id}")
async def update_meeting_note(
    note_id: int,
    payload: NoteUpdateRequest,
    db: Session = Depends(get_db),
):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updated = note_repo.update(db, note_id, **updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Note non trouvée")
    return {"id": updated.id, "content": updated.content, "type": updated.type}


@router.get("/api/meeting-notes/{session_id}")
async def get_meeting_notes(session_id: int, db: Session = Depends(get_db)):
    notes = note_repo.get_by_session(db, session_id)
    return [
        {
            "id": n.id,
            "session_id": n.session_id,
            "participant": n.participant,
            "content": n.content,
            "agenda_item_index": n.agenda_item_index,
            "type": n.type or 'note',
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notes
    ]


# ---------------------------------------------------------------------------
# Reformulation
# ---------------------------------------------------------------------------

@router.post("/api/reformulate-note")
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



@router.post("/api/reformulate-agenda-notes")
def reformulate_agenda_notes(
    payload: AgendaNotesReformulateRequest,
    db: Session = Depends(get_db),
):
    if not payload.notes:
        raise HTTPException(status_code=400, detail="Aucune note fournie.")

    notes_text = "\n".join(
        f"- {n.get('speaker', 'Participant')}: {n.get('content', '')}"
        for n in payload.notes
        if n.get('content', '').strip()
    )

    if not notes_text.strip():
        raise HTTPException(status_code=400, detail="Les notes sont vides.")

    prompt = f"""Tu es secrétaire de réunion. Synthétise les notes suivantes du point "{payload.agenda_title}" en un paragraphe de procès-verbal professionnel.

Notes:
{notes_text}

Règles:
- Synthétise et reformule les échanges en style procès-verbal officiel.
- Utilise un ton neutre, administratif et objectif (ex. : "Le Comité a examiné...", "Il a été constaté que...").
- Garde tous les points importants et les décisions prises.
- Rédige en paragraphes continus, sans listes ni tirets.
- N'invente aucune information.
- Retourne uniquement le texte du paragraphe, sans titre ni explication."""

    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "stream": False,
                "options": {"temperature": 0.2, "num_predict": 400},
                "messages": [
                    {
                        "role": "system",
                        "content": "Tu es un expert en rédaction de procès-verbaux de réunions de comités.",
                    },
                    {"role": "user", "content": prompt},
                ],
            },
            timeout=90,
        )
        response.raise_for_status()
        data = response.json()
        generated_text = data.get("message", {}).get("content", "")
        generated_text = clean_qwen_response(generated_text)
        if not generated_text:
            raise HTTPException(status_code=500, detail="Aucune synthèse générée.")

        # Persist to AgendaItem.reformulated_notes if caller provides identifiers
        if payload.session_id is not None and payload.agenda_item_index is not None:
            item = agenda_repo.get_by_ordre(db, payload.session_id, payload.agenda_item_index)
            if item:
                agenda_repo.update(db, item.id, reformulated_notes=generated_text)

        return {"text": generated_text}
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail="Impossible de contacter Ollama.")
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Ollama a mis trop de temps à répondre.")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Erreur Ollama: {str(e)}")


# ---------------------------------------------------------------------------
# Final PV assembly from reformulated notes
# ---------------------------------------------------------------------------

@router.post("/api/sessions/{session_id}/assemble-final-pv")
async def assemble_final_pv(session_id: int, db: Session = Depends(get_db)):
    """Assemble the final PV text from reformulated notes and persist it as draft_content."""
    session = session_repo.get_by_id(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")

    items = agenda_repo.get_by_session(db, session_id)
    drafts = draft_repo.get_by_session(db, session_id)
    ref = drafts[0] if drafts else None

    titre = ref.titre if ref else "PROCÈS-VERBAL"
    comite = ref.comite_type if ref else ""
    date_str = ""
    if ref and ref.date_reunion:
        date_str = ref.date_reunion.strftime("%d/%m/%Y")

    participants = participant_repo.get_by_session(db, session_id)
    participants_list = [
        f"{p.nom} — {p.role}" if p.role else p.nom
        for p in participants
        if p.nom
    ]

    lines: list[str] = []
    lines.append(f"# {titre}")
    if comite:
        lines.append(f"\n**Comité :** {comite}")
    if date_str:
        lines.append(f"**Date :** {date_str}")

    if participants_list:
        lines.append("\n## Participants\n")
        for p in participants_list:
            lines.append(f"- {p}")

    if items:
        lines.append("\n## Ordre du jour\n")
        for item in items:
            lines.append(f"{item.ordre}. {item.titre}")

        lines.append("\n## Discussions\n")
        for item in items:
            lines.append(f"\n### {item.ordre}. {item.titre}\n")
            if item.reformulated_notes:
                lines.append(item.reformulated_notes)
            else:
                lines.append("_Aucune note reformulée disponible pour ce point._")

    pv_text = "\n".join(lines)

    existing_final = draft_repo.get_final(db, session_id)
    if existing_final:
        draft_repo.update(db, existing_final.id, draft_content=pv_text)
        draft_id = existing_final.id
    else:
        version = draft_repo.get_next_version(db, session_id)
        new_draft = draft_repo.create(
            db,
            session_id=session_id,
            titre=titre,
            date_reunion=ref.date_reunion if ref else None,
            comite_type=comite,
            language="fr",
            version=version,
            is_final=True,
            draft_content=pv_text,
        )
        draft_id = new_draft.id

    return {"draft_id": draft_id, "content": pv_text}


# ---------------------------------------------------------------------------
# Other endpoints
# ---------------------------------------------------------------------------

@router.post("/api/test-slide-paragraph")
async def test_slide_paragraph(req: SlideParagraphRequest):
    result = generate_slide_paragraph_service(req.slide)
    return {"success": True, "result": result}


@router.post("/api/analyze-agenda-full")
async def analyze_agenda_full(req: AgendaFullRequest):
    result = analyze_agenda_full_service(req.ordre_du_jour, req.slides, req.use_llm)
    return result


@router.post("/api/test-agenda-analysis")
async def test_agenda_analysis(req: AgendaAnalysisRequest):
    result = analyze_agenda_service(req.agenda_group, req.use_llm)
    return {"success": True, "result": result}


@router.post("/api/test-agenda-analysis-stream")
async def test_agenda_analysis_stream(req: AgendaAnalysisRequest):
    result = analyze_agenda_service(req.agenda_group, req.use_llm)

    async def generator():
        text = json.dumps(result, ensure_ascii=False, indent=2)
        for char in text:
            yield char
            await asyncio.sleep(0.01)

    return StreamingResponse(generator(), media_type="text/plain")


@router.post("/api/merge-notes")
async def merge_notes_guarded(req: MergeRequest):
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
