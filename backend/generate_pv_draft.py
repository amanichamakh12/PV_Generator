"""
Pipeline de brouillon PV en 2 etapes :
1. chaque slide devient un paragraphe formule ;
2. les paragraphes sont regroupes par ordre du jour pour servir
   d'entree a un second LLM d'analyse.

Le module reste autonome :
- mode heuristique par defaut (robuste, sans dependance LLM) ;
- mode LLM optionnel pour enrichir la formulation slide par slide
  et/ou generer une analyse consolidee par ordre du jour.
"""

from __future__ import annotations

import json
import os
from typing import Any

import requests


OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")


SLIDE_PARAGRAPH_SYSTEM = """
Tu rediges un paragraphe de proces-verbal a partir d'une slide.
Contraintes :
- style administratif, factuel, sans invention ;
- utiliser uniquement les informations fournies ;
- integrer texte, tableaux, graphiques, images et notes si presents ;
- sortie JSON stricte ;
- jamais de puces dans le paragraphe.

Format attendu :
{
  "paragraphe": "paragraphe redige",
  "points_cles": ["point 1", "point 2"],
  "elements_actionnables": ["action 1"]
}
""".strip()


AGENDA_ANALYSIS_SYSTEM = """
Tu produis une analyse par ordre du jour a partir d'un ensemble de paragraphes
de slides deja rediges.
Contraintes :
- ne rien inventer ;
- relier les informations entre slides ;
- mettre en avant constats, tendances, alertes, decisions implicites et suites a donner ;
- style administratif et analytique ;
- sortie JSON stricte.

Format attendu :
{
  "analyse": "analyse consolidee",
  "constats": ["..."],
  "risques": ["..."],
  "actions_suggerees": ["..."]
}
""".strip()


def _post_ollama_json(system: str, prompt: str, max_tokens: int = 1200) -> dict[str, Any] | None:
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": (
            f"[INST] <<SYS>>\n{system}\n<</SYS>>\n\n"
            f"{prompt}\n\n"
            "Reponds uniquement en JSON valide. [/INST]"
        ),
        "stream": False,
        "options": {
            "temperature": 0.1,
            "num_predict": max_tokens,
        },
    }

    try:
        response = requests.post(f"{OLLAMA_URL}/api/generate", json=payload, timeout=120)
        response.raise_for_status()
        raw = response.json().get("response", "").strip()
        if not raw:
            return None
        return _extract_json_object(raw)
    except Exception:
        return None


def _extract_json_object(raw: str) -> dict[str, Any] | None:
    raw = (raw or "").strip()
    if not raw:
        return None

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None

    try:
        return json.loads(raw[start : end + 1])
    except json.JSONDecodeError:
        return None


def _compact_text_list(items: list[Any]) -> list[str]:
    result: list[str] = []
    for item in items or []:
        if isinstance(item, str):
            text = item.strip()
        else:
            text = str(item).strip()
        if text:
            result.append(text)
    return result


def _format_table(table: dict[str, Any]) -> str:
    rows = table.get("lignes") or []
    if not rows:
        return ""

    rendered = []
    for row in rows:
        rendered.append(" | ".join(str(cell).strip() for cell in row))
    return "\n".join(rendered)


def _format_chart(chart: dict[str, Any]) -> str:
    title = chart.get("titre") or chart.get("title") or chart.get("type") or "Graphique"
    summary = chart.get("resume_pv") or ""
    categories = chart.get("categories") or []

    parts = [f"{title}"]
    if categories:
        parts.append("Categories: " + ", ".join(str(cat) for cat in categories[:8]))
    if summary:
        parts.append(summary)
    return " | ".join(parts)


def _build_slide_payload(slide: dict[str, Any]) -> dict[str, Any]:
    return {
        "index": slide.get("index"),
        "titre": slide.get("titre"),
        "ordre_du_jour": slide.get("ordre du jour") or slide.get("ordre_du_jour"),
        "contenu": _compact_text_list(slide.get("contenu") or []),
        "tableaux": [_format_table(table) for table in slide.get("tableaux") or [] if _format_table(table)],
        "graphiques": [_format_chart(chart) for chart in slide.get("graphiques") or slide.get("graphes") or []],
        "images": _compact_text_list(slide.get("images") or []),
        "notes": _compact_text_list(slide.get("notes") or [] if isinstance(slide.get("notes"), list) else [slide.get("notes")] if slide.get("notes") else []),
    }


def _heuristic_slide_paragraph(payload: dict[str, Any]) -> dict[str, Any]:
    title = payload.get("titre") or f"Slide {payload.get('index', '?')}"
    agenda = payload.get("ordre_du_jour") or "hors ordre du jour"
    text_bits = payload.get("contenu") or []
    table_bits = payload.get("tableaux") or []
    chart_bits = payload.get("graphiques") or []
    image_bits = payload.get("images") or []
    note_bits = payload.get("notes") or []

    paragraph_parts = [
        f"Au titre de la slide \"{title}\", rattachee a l'ordre du jour \"{agenda}\", les elements presentes font ressortir les constats suivants."
    ]

    if text_bits:
        paragraph_parts.append("Les informations textuelles relevent notamment " + "; ".join(text_bits[:4]) + ".")
    if table_bits:
        paragraph_parts.append("Les tableaux consolident ces constats avec les donnees suivantes : " + " ; ".join(table_bits[:2]) + ".")
    if chart_bits:
        paragraph_parts.append("Les graphiques mettent en evidence : " + " ; ".join(chart_bits[:2]) + ".")
    if image_bits:
        paragraph_parts.append("Les images analysees apportent le complement suivant : " + " ; ".join(image_bits[:2]) + ".")
    if note_bits:
        paragraph_parts.append("Les notes de slide ajoutent egalement : " + " ; ".join(note_bits[:3]) + ".")

    if len(paragraph_parts) == 1:
        paragraph_parts.append("Aucun contenu exploitable supplementaire n'a ete extrait de cette slide.")

    return {
        "paragraphe": " ".join(paragraph_parts),
        "points_cles": text_bits[:3] + chart_bits[:2],
        "elements_actionnables": note_bits[:2],
    }


def generate_slide_paragraph(slide: dict[str, Any], use_llm: bool = False) -> dict[str, Any]:
    payload = _build_slide_payload(slide)

    if use_llm:
        llm_result = _post_ollama_json(
            SLIDE_PARAGRAPH_SYSTEM,
            "Donnees slide:\n" + json.dumps(payload, ensure_ascii=False, indent=2),
        )
        if llm_result and llm_result.get("paragraphe"):
            return {
                "slide_index": payload.get("index"),
                "slide_title": payload.get("titre"),
                "ordre_du_jour": payload.get("ordre_du_jour"),
                "sources": payload,
                "paragraphe": llm_result.get("paragraphe", ""),
                "points_cles": llm_result.get("points_cles", []),
                "elements_actionnables": llm_result.get("elements_actionnables", []),
                "generation_mode": "llm",
            }

    heuristic = _heuristic_slide_paragraph(payload)
    return {
        "slide_index": payload.get("index"),
        "slide_title": payload.get("titre"),
        "ordre_du_jour": payload.get("ordre_du_jour"),
        "sources": payload,
        "paragraphe": heuristic["paragraphe"],
        "points_cles": heuristic["points_cles"],
        "elements_actionnables": heuristic["elements_actionnables"],
        "generation_mode": "heuristic",
    }


def group_slide_paragraphs_by_agenda(slide_paragraphs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}

    for item in slide_paragraphs:
        agenda = (item.get("ordre_du_jour") or "hors ordre du jour").strip()
        if agenda not in grouped:
            grouped[agenda] = {
                "ordre_du_jour": agenda,
                "slides": [],
                "paragraphes": [],
                "points_cles": [],
                "elements_actionnables": [],
            }

        grouped_item = grouped[agenda]
        grouped_item["slides"].append(
            {
                "slide_index": item.get("slide_index"),
                "slide_title": item.get("slide_title"),
            }
        )
        grouped_item["paragraphes"].append(item.get("paragraphe", ""))
        grouped_item["points_cles"].extend(item.get("points_cles") or [])
        grouped_item["elements_actionnables"].extend(item.get("elements_actionnables") or [])

    return list(grouped.values())


def build_agenda_analysis_input(agenda_group: dict[str, Any]) -> str:
    slides = ", ".join(
        f"{slide.get('slide_index')}:{slide.get('slide_title') or 'Sans titre'}"
        for slide in agenda_group.get("slides", [])
    )
    paragraphes = "\n\n".join(agenda_group.get("paragraphes", []))
    points_cles = "\n".join(f"- {item}" for item in agenda_group.get("points_cles", [])[:12])
    actions = "\n".join(f"- {item}" for item in agenda_group.get("elements_actionnables", [])[:12])

    return (
        f"Ordre du jour: {agenda_group.get('ordre_du_jour')}\n"
        f"Slides couvertes: {slides or 'aucune'}\n\n"
        f"Paragraphes consolides:\n{paragraphes or 'Aucun paragraphe'}\n\n"
        f"Points cles:\n{points_cles or '- Aucun'}\n\n"
        f"Elements actionnables:\n{actions or '- Aucun'}"
    )


def analyze_agenda_group(agenda_group: dict[str, Any], use_llm: bool = False) -> dict[str, Any]:
    analysis_input = build_agenda_analysis_input(agenda_group)

    if use_llm:
        llm_result = _post_ollama_json(AGENDA_ANALYSIS_SYSTEM, analysis_input, max_tokens=1400)
        if llm_result and llm_result.get("analyse"):
            return {
                "ordre_du_jour": agenda_group.get("ordre_du_jour"),
                "input_analyse": analysis_input,
                "analyse": llm_result.get("analyse", ""),
                "constats": llm_result.get("constats", []),
                "risques": llm_result.get("risques", []),
                "actions_suggerees": llm_result.get("actions_suggerees", []),
                "generation_mode": "llm",
            }

    return {
        "ordre_du_jour": agenda_group.get("ordre_du_jour"),
        "input_analyse": analysis_input,
        "analyse": (
            "Les paragraphes rattaches a cet ordre du jour ont ete consolides "
            "pour alimenter une analyse transverse. Les constats, risques et suites "
            "a donner peuvent desormais etre traites par un second moteur analytique."
        ),
        "constats": agenda_group.get("points_cles", [])[:8],
        "risques": [],
        "actions_suggerees": agenda_group.get("elements_actionnables", [])[:8],
        "generation_mode": "heuristic",
    }


def generate_pv_draft_pipeline(extracted: dict[str, Any], use_llm_for_slides: bool = False, use_llm_for_analysis: bool = False) -> dict[str, Any]:
    slides = extracted.get("slides") or []
    slide_paragraphs = [generate_slide_paragraph(slide, use_llm=use_llm_for_slides) for slide in slides]
    agenda_groups = group_slide_paragraphs_by_agenda(slide_paragraphs)
    agenda_analyses = [analyze_agenda_group(group, use_llm=use_llm_for_analysis) for group in agenda_groups]

    return {
        "modele_ollama": OLLAMA_MODEL,
        "pipeline": {
            "slide_to_paragraph": "llm" if use_llm_for_slides else "heuristic",
            "agenda_to_analysis": "llm" if use_llm_for_analysis else "heuristic",
        },
        "slides_redigees": slide_paragraphs,
        "groupes_ordre_du_jour": agenda_groups,
        "analyses_par_ordre_du_jour": agenda_analyses,
    }
