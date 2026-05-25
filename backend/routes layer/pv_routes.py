"""PV API routes split from main module."""

import tempfile

from fastapi import APIRouter, File, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from PV_Generator.backend.models.models import (
    AgendaAnalysisRequest,
    AgendaFullRequest,
    DeleteSlideRequest,
    DraftPipelineRequest,
    DraftRequest,
    ExportRequest,
    MergeRequest,
    SlideParagraphRequest,
    TranslateRequest,
    UpdateExtractionRequest,
)
from repository_layer.pv_repository import (
    create_pv_document,
    delete_slide_from_document,
    update_extraction_data,
)
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

router = APIRouter()


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


@router.post("/api/analyze-agenda-full")
async def analyze_agenda_full(req: AgendaFullRequest):
    return analyze_agenda_full_service(req.ordre_du_jour, req.slides, req.use_llm)


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
    return merge_notes_with_guard_service(req.pv_draft, notes)


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
