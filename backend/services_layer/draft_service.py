"""Draft generation and agenda analysis service functions."""

from docX import build_pv_docx, build_pv_request_body
from generate_pv_draft import (
    analyze_agenda_group,
    generate_pv_draft_pipeline,
    generate_slide_paragraph,
    generate_slide_paragraph_heuristic,
)
from Graph.pptx_parser_chartLlama import parse_pptx
from Pv_Generator import OLLAMA_MODEL, generate_pv_draft


def generate_slide_paragraph_service(slide: dict) -> dict:
    return generate_slide_paragraph(slide or {})


def analyze_agenda_service(agenda_group: dict, use_llm: bool) -> dict:
    return analyze_agenda_group(agenda_group or {}, use_llm=use_llm)


def analyze_agenda_full_service(ordre_du_jour: str, slides: list[dict], use_llm: bool) -> dict:
    # Injecter l'ordre_du_jour dans chaque slide brute pour que l'analyse
    # produise un texte cohérent (sinon chaque slide dirait "hors ordre du jour").
    # Un seul appel LLM (analyse consolidée) au lieu d'un appel par slide + un appel
    # consolidé : slides_analyses n'est pas consommé par le frontend, generate_slide_paragraph
    # par slide aurait juste re-payé le coût LLM pour un résultat jeté.
    slides_with_odj = [{**s, "ordre_du_jour": ordre_du_jour} for s in slides]
    agenda_group = {
        "ordre_du_jour": ordre_du_jour,
        "slides": slides_with_odj,
    }
    result = analyze_agenda_group(agenda_group, use_llm=use_llm)
    analyzed_slides = [generate_slide_paragraph_heuristic(slide) for slide in slides_with_odj]
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
