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
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:0.6b")

SLIDE_PARAGRAPH_SYSTEM = """
Tu es un rédacteur de procès-verbaux officiels pour un comité bancaire.

Ta tâche : rédiger UN SEUL paragraphe de compte rendu à partir des données d'une slide.

RÈGLES ABSOLUES :
- Rédige en français administratif, style factuel et neutre
- N'utilise QUE les données fournies, sans invention
- Intègre les chiffres des tableaux et graphiques dans la prose
- Le paragraphe doit être continu, sans tirets, sans puces, sans listes
- N'écris JAMAIS de JSON, de tableau, de symbole | dans ta réponse
- N'écris JAMAIS les mots "slide", "tableau", "colonne", "JSON", "graphique" dans le paragraphe
- Commence directement par le contenu, pas par une introduction méta

STYLE ATTENDU (exemple) :
"Au cours de ce point, le Comité a examiné l'évolution des engagements sur la période T1 2025.
Le portefeuille global affiche une progression de +3.6%, atteignant 4 512 MMAD. Les Grandes
Entreprises demeurent le segment dominant avec 2 078 MMAD, en hausse de +4.6% par rapport
au trimestre précédent. Le segment Immobilier enregistre également une progression notable
de +3.7%, portant l'exposition à 477 MMAD."

FORMAT DE SORTIE — JSON strict, rien d'autre :
{
  "paragraphe": "texte rédigé en prose continue, chiffres intégrés naturellement",
  "points_cles": ["constat factuel 1", "constat factuel 2", "constat factuel 3"],
  "elements_actionnables": ["action concrète si mentionnée dans les données"]
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
  "analyse": "paragraphe d analyse consolidee sur l ensemble des slides de cet ordre du jour. Met en avant les constats, tendances, alertes, decisions implicites et suites a donner.",
  "constats": ["constat 1", "constat 2"],
  "risques": ["risque 1", "risque 2"],
  "actions_suggerees": ["action 1", "action 2"]
}
""".strip()

def _post_ollama_json(system: str, prompt: str, max_tokens: int = 1200) -> dict[str, Any] | None:
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": (
            f"[INST] <<SYS>>\n{system}\n<</SYS>>\n\n"
            f"{prompt}\n\n"
            "Retourne UNIQUEMENT le JSON demandé, sans texte avant ni après. [/INST]"
        ),
        "stream": False,
        "format": "json",  # ← force Ollama à sortir du JSON
        "options": {
            "temperature": 0.1,
            "num_predict": max_tokens,
        },
    }

    try:
        response = requests.post(f"{OLLAMA_URL}/api/generate", json=payload)
        response.raise_for_status()
        raw = response.json().get("response", "").strip()
        print(f"[LLM RAW] {raw[:200]}")   # ← ajoute ça
        if not raw:
            print("[LLM] Réponse vide")   # ← et ça
            return None
        result = _extract_json_object(raw)
        print(f"[LLM PARSED] {result}")   # ← et ça
        return result
    except Exception as e:
        print(f"[LLM ERROR] {e}")          # ← et ça
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
        "index":        slide.get("index"),
        "titre":        slide.get("titre"),
        "ordre_du_jour": slide.get("ordre du jour") or slide.get("ordre_du_jour"),
        "contenu":      _compact_text_list(slide.get("contenu") or []),
        "tableaux":     [_format_table(t) for t in slide.get("tableaux") or [] if _format_table(t)],
        "graphiques":   [_format_chart(c) for c in slide.get("graphiques") or []],
        "images":       [_format_image(i) for i in slide.get("images") or []],  # ← corrigé
        "notes":        _compact_text_list(
                            slide.get("notes") or [] if isinstance(slide.get("notes"), list)
                            else [slide.get("notes")] if slide.get("notes") else []
                        ),
    }

def _format_image(image: Any) -> str:
    """Parse une image Groq/OCR et retourne un résumé texte lisible."""
    if isinstance(image, str):
        raw = image
    elif isinstance(image, dict):
        # Image analysée par Groq : extraire la description JSON
        description = image.get("description") or ""
        raw = description
    else:
        return str(image)

    # Nettoie les backticks markdown ```json ... ```
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    # Tente de parser le JSON extrait par Groq
    try:
        data = json.loads(raw)
        titre      = data.get("titre") or data.get("title") or "Graphique"
        categories = data.get("categories") or []
        series     = data.get("series") or []
        observations = data.get("observations") or []

        parts = [f"Graphique : {titre}"]
        for serie in series:
            nom     = serie.get("nom", "")
            valeurs = serie.get("valeurs", [])
            for cat, val in zip(categories, valeurs):
                parts.append(f"  {cat} : {val}")
        if observations:
            parts.append("Observations : " + " ; ".join(observations))

        return "\n".join(parts)
    except (json.JSONDecodeError, Exception):
        # Si pas du JSON, retourne le texte brut nettoyé
        return raw[:300] if raw else ""

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


def generate_slide_paragraph(slide: dict[str, Any]) -> dict[str, Any]:
    payload = _build_slide_payload(slide)
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


def group_slide_paragraphs_by_agenda(slide_paragraphs: list[dict[str, any]]) -> list[dict[str, any]]:
    grouped: dict[str, dict[str, any]] = {}

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


def build_agenda_analysis_input(agenda_group: dict[str, any]) -> str:
    slides_list = agenda_group.get("slides", [])
    if isinstance(slides_list, dict):
        slides_list = [slides_list]

    slides = ", ".join(
        f"{slide.get('index')}:{slide.get('titre') or 'Sans titre'}"
        for slide in slides_list
    )
    images_text = "\n".join(
    f"- Graphique type={img.get('type', 'inconnu')} titre={img.get('titre', '')} "
    f"categories={img.get('categories', [])} "
    f"series={img.get('series', [])} "
    f"observations={img.get('observations', [])}"
    for slide in slides_list
    for img in slide.get("images", [])
    if img.get("titre") or img.get("observations") or img.get("series")
)
    # Contenu textuel des slides
    paragraphes = "\n\n".join(
        "\n".join(slide.get("contenu", []))
        for slide in slides_list
        if slide.get("contenu")
    )

    # Tableaux formatés
    tableaux_text = ""
    for slide in slides_list:
        for table in slide.get("tableaux", []):
            lignes = table.get("lignes", [])
            if lignes:
                tableaux_text += "\n" + "\n".join(
                    " | ".join(str(cell) for cell in row)
                    for row in lignes
                )

    # Points clés et actions (si présents)
    points_cles = "\n".join(
        f"- {item}"
        for slide in slides_list
        for item in slide.get("points_cles", [])
    )

    actions = "\n".join(
        f"- {item}"
        for slide in slides_list
        for item in slide.get("elements_actionnables", [])
    )

    return (
        f"Ordre du jour: {agenda_group.get('ordre_du_jour')}\n"
        f"Slides couvertes: {slides or 'aucune'}\n\n"
        f"Contenu:\n{paragraphes or 'Aucun contenu'}\n\n"
        f"Tableaux:\n{tableaux_text or 'Aucun tableau'}\n\n"
        f"Graphiques analysés:\n{images_text or 'Aucun graphique analysé'}\n\n"
        f"Points cles:\n{points_cles or '- Aucun'}\n\n"
        f"Elements actionnables:\n{actions or '- Aucun'}"
    )
def analyze_agenda_group(agenda_group: dict[str, any], use_llm: bool = True) -> dict[str, any]:
    analysis_input = build_agenda_analysis_input(agenda_group)
    slides_list = agenda_group.get("slides", [])

    print("\n" + "="*60)
    print(f"📋 ORDRE DU JOUR: {agenda_group.get('ordre_du_jour')}")
    print(f"📊 SLIDES: {len(slides_list)}")
    print(f"🤖 USE_LLM: {use_llm}")
    print(f"\n📝 INPUT ANALYSE:\n{analysis_input}")
    print("="*60)

    if use_llm:
        print("🚀 Appel LLM...")
        llm_result = _post_ollama_json(AGENDA_ANALYSIS_SYSTEM, analysis_input, max_tokens=1400)
        
        print(f"\n📤 RÉPONSE LLM RAW: {llm_result}")
        print(f"📤 TYPE: {type(llm_result)}")
        
        if llm_result:
            print(f"📤 CLÉS: {llm_result.keys() if isinstance(llm_result, dict) else 'pas un dict'}")
            print(f"📤 'analyse' présent: {'analyse' in llm_result if isinstance(llm_result, dict) else 'N/A'}")
            print(f"📤 VALEUR 'analyse': {llm_result.get('analyse') if isinstance(llm_result, dict) else 'N/A'}")
        else:
            print("❌ LLM a retourné None/vide")

        if llm_result and llm_result.get("analyse"):
            print("✅ Utilisation résultat LLM")
            return {
                "ordre_du_jour": agenda_group.get("ordre_du_jour"),
                "input_analyse": analysis_input,
                "analyse": llm_result.get("analyse", ""),
                "constats": [
                    item
                    for slide in slides_list
                    for item in slide.get("points_cles", [])
                ][:8],
                "risques": llm_result.get("risques", []),
                "actions_suggerees": [
                    item
                    for slide in slides_list
                    for item in slide.get("elements_actionnables", [])
                ][:8],
                "generation_mode": "llm",
            }
        else:
            print("⚠️ Fallback heuristique")

    return {
        "ordre_du_jour": agenda_group.get("ordre_du_jour"),
        "input_analyse": analysis_input,
        "analyse": (
            "Les paragraphes rattaches a cet ordre du jour ont ete consolides "
            "pour alimenter une analyse transverse."
        ),
        "constats": agenda_group.get("points_cles", [])[:8],
        "risques": [],
        "actions_suggerees": agenda_group.get("elements_actionnables", [])[:8],
        "generation_mode": "heuristic",
    }





def generate_pv_draft_pipeline(extracted: dict[str, any], use_llm_for_slides: bool = False, use_llm_for_analysis: bool = False) -> dict[str, any]:
    slides = extracted.get("slides") or []
    slide_paragraphs = [generate_slide_paragraph(slide) for slide in slides]
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
