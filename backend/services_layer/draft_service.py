"""Draft generation and agenda analysis service functions."""

from backend.docX import build_pv_docx, build_pv_request_body
from backend.generate_pv_draft import (
    analyze_agenda_group,
    generate_pv_draft_pipeline,
    generate_slide_paragraph,
)
from backend.pptx_parser_chartLlama import parse_pptx
from backend.Pv_Generator import OLLAMA_MODEL, generate_pv_draft


def generate_slide_paragraph_service(slide: dict) -> dict:
    return generate_slide_paragraph(slide or {})


def analyze_agenda_service(agenda_group: dict, use_llm: bool) -> dict:
    return analyze_agenda_group(agenda_group or {}, use_llm=use_llm)


def analyze_agenda_full_service(ordre_du_jour: str, slides: list[dict], use_llm: bool) -> dict:
    analyzed_slides = [generate_slide_paragraph(slide) for slide in slides]
    agenda_group = {
        "ordre_du_jour": ordre_du_jour,
        "slides": analyzed_slides,
    }
    result = analyze_agenda_group(agenda_group, use_llm=use_llm)
    return {
        "success": True,
        "slides_analyses": analyzed_slides,
        "result": result,
    }


def generate_pv_from_pptx_service(
    tmp_path: str,
    use_llm_for_slides: bool,
    use_llm_for_analysis: bool,
) -> dict:
    extracted = parse_pptx(tmp_path)

    result = generate_pv_draft_pipeline(
        extracted,
        use_llm_for_slides=use_llm_for_slides,
        use_llm_for_analysis=use_llm_for_analysis,
    )
    return {
        "success": True,
        "pipeline_mode": {
            "slides": "llm" if use_llm_for_slides else "heuristic",
            "analysis": "llm" if use_llm_for_analysis else "heuristic",
        },
        "result": result,
    }


def generate_draft_service(extracted: dict) -> dict:
    draft = generate_pv_draft(OLLAMA_MODEL, extracted or {})
    return {
        "success": True,
        "draft": draft,
    }


def build_pipeline_docx_service(extracted: dict, use_llm_for_slides: bool, use_llm_for_analysis: bool) -> bytes:
    if "analyses_par_ordre_du_jour" in (extracted or {}):
        pipeline_result = extracted
    else:
        body = build_pv_request_body(
            extracted or {},
            use_llm_for_slides=use_llm_for_slides,
            use_llm_for_analysis=use_llm_for_analysis,
        )
        pipeline_result = body["extracted"]

    return build_pv_docx(pipeline_result)
