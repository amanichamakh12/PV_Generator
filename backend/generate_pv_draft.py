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
import logging
import os
from typing import Any

import requests

logger = logging.getLogger(__name__)


OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")
LLAMA_MODEL_PATH = os.environ.get("LLAMA_MODEL_PATH", "IA_modeles/qwen2.5-1.5b-instruct-q4_k_m.gguf")
_llama_model = None



SLIDE_PARAGRAPH_SYSTEM = """
Tu es rédacteur de procès-verbaux bancaires. Rédige UN paragraphe en français administratif.

RÈGLES ABSOLUES :
1. Chaque valeur numérique reçue DOIT apparaître dans le paragraphe, 
   rattachée à son libellé exact — aucune donnée ne peut être omise
2. Toute variation (positive ou négative) DOIT être mentionnée et qualifiée
3. Pour un bilan : deux phrases obligatoires — une sur l'actif, une sur le passif
4. Pour un camembert : citer tous les segments du plus grand au plus petit
5. Un risque n'est valide que s'il est justifié par un chiffre extrait
6. Minimum 5 phrases, prose continue, sans listes ni tirets
7. 3ème personne, ton formel
8. Interdit : slide, tableau, graphique, JSON, image, "croits"

EXEMPLE :
Données :
  Passif — Dépôts Clients : 43% / Dettes LT : 26% / Dettes CT : 11% / FP : 15% / Autres : 5%
  Actif  — Crédits Clients : 2 650 M / Titres : 890 M / Trésorerie : 480 M
  KPIs   — Total Actif : 4 820 M (+6,2%) / FP : 712 M (+3,8%) / Dettes LT : 1 240 M (-2,1%)

=> {
  "paragraphe": "Dans le cadre de l'ordre du jour relatif à l'analyse du bilan, 
  les membres du comité ont pris connaissance de la structure financière au titre 
  du premier trimestre 2025. Le total du bilan s'établit à 4 820 M, en progression 
  de 6,2%, porté principalement par les Crédits Clients qui constituent le premier 
  poste de l'actif avec 2 650 M, suivis des Titres (890 M) et de la Trésorerie 
  (480 M). S'agissant de la structure du passif, les Dépôts Clients en constituent 
  la composante dominante avec 43%, suivis des Dettes Long Terme (26%), des Fonds 
  Propres (15%), des Dettes Court Terme (11%) et des Autres postes (5%). Les Fonds 
  Propres atteignent 712 M en hausse de 3,8%, portant le ratio FP/Actif à 14,8%. 
  Le comité a relevé que les Dettes Long Terme s'inscrivent en baisse de 2,1% 
  à 1 240 M, ce qui appelle une vigilance accrue quant au renouvellement des 
  ressources longues.",
  "points_cles": [
    "Total Actif : 4 820 M (+6,2%)",
    "Crédits Clients : 2 650 M (1er poste actif)",
    "Dépôts Clients : 43% du passif",
    "Fonds Propres : 712 M (+3,8%) — ratio 14,8%",
    "Dettes LT : 1 240 M (-2,1%)"
  ],
  "elements_actionnables": [
    "Surveiller le renouvellement des Dettes LT en baisse (-2,1%)",
    "Assurer un suivi de la dynamique des Crédits Clients"
  ]
}

Retourne UNIQUEMENT le JSON, sans texte avant ni après.
""".strip()
AGENDA_ANALYSIS_SYSTEM = """
Tu es analyste risque bancaire senior. Synthétise les slides en JSON strict.

RÈGLES :
- Chiffres exacts uniquement, chaque chiffre rattaché à son libellé source
- Maximum : 3 constats, 2 risques, 2 actions, aucune répétition
- Si tableau Stage : calcule part ECL/encours et signale toute disproportion

PARAGRAPHE PV :
- Minimum 8 phrases, prose administrative continue, 3ème personne
- Structure : présentation → constats chiffrés → risques → recommandations
- Tournures : "Les membres du comité ont pris connaissance...", "Il a été relevé que...", "Le comité a recommandé..."
- Interdit : slide, tableau, graphique, JSON, "données précédentes"
- Période de référence inconnue → écrire "par rapport à la période précédente"

EXEMPLE :
Données : Bilan total 4 820 M (+6,2%) / Fonds Propres 712 M (+3,8%) / Dettes CT 43% / Dettes LT 26%
=> {"analyse": "Le bilan total s'établit à 4 820 M (+6,2%). Les Fonds Propres atteignent 712 M (+3,8%). Les Dettes CT dominent le passif à 43%.", "constats": ["Bilan total : 4 820 M (+6,2%)", "Fonds Propres : 712 M (+3,8%)", "Dettes CT : 43% du passif"], "risques": ["Concentration des Dettes CT à 43%", "Pression sur la liquidité court terme"], "actions_suggerees": ["Renforcer le suivi des Dettes CT", "Analyser la dynamique des Fonds Propres"], "paragraphe_pv": "Dans le cadre de l'ordre du jour relatif à l'analyse du bilan, les membres du comité ont pris connaissance de la structure financière au titre du premier trimestre 2025. La présentation a mis en évidence un bilan total de 4 820 M, en progression de 6,2% par rapport à la période précédente, traduisant une dynamique de croissance notable. S'agissant de la structure du passif, il a été relevé que les Dettes Court Terme représentent la composante dominante avec 43% du total, suivies des Dettes Long Terme à hauteur de 26%. Les Fonds Propres s'établissent à 712 M, en hausse de 3,8%, témoignant d'un renforcement progressif de la base capitalistique. Le comité a noté que cette structure soulève des interrogations quant à la concentration des engagements à court terme et à ses implications en matière de liquidité. Il a été recommandé un renforcement du dispositif de suivi des Dettes CT ainsi qu'une analyse approfondie de la dynamique des Fonds Propres. Le comité a pris acte de ces éléments et invité les équipes concernées à présenter un plan de suivi lors de la prochaine séance."}

Retourne UNIQUEMENT :
{"analyse": "...", "constats": ["..."], "risques": ["..."], "actions_suggerees": ["..."], "paragraphe_pv": "..."}
""".strip()
def _get_llama_model():
    global _llama_model
    if _llama_model is None:
        from llama_cpp import Llama
        logger.info("[LLM] Chargement modèle llama-cpp: %s", LLAMA_MODEL_PATH)
        _llama_model = Llama(
            model_path=LLAMA_MODEL_PATH,
            n_ctx=4096,
            n_threads=os.cpu_count() or 4,
            verbose=False,
        )
        logger.info("[LLM] Modèle llama-cpp chargé ✓")
    return _llama_model
def _post_llama_cpp_json(system: str, prompt: str, max_tokens: int = 1200) -> dict[str, Any] | None:
    try:
        llm = _get_llama_model()
        response = llm.create_chat_completion(
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            max_tokens=max_tokens,
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        raw = response["choices"][0]["message"]["content"].strip()
        logger.debug("[LLM llama_cpp RAW] %s", raw[:300])
        if not raw:
            logger.warning("[LLM llama_cpp] Réponse vide")
            return None
        return _extract_json_object(raw)
    except Exception as exc:
        logger.error("[LLM llama_cpp] Erreur: %s", exc)
        return None
def _post_ollama_json(system: str, prompt: str, max_tokens: int = 1200) -> dict[str, Any] | None:
    # /no_think désactive le mode thinking de Qwen3 (sans effet sur Qwen2.5)
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": f"{prompt}\n\n/no_think"},
        ],
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.0,
            "num_predict": max_tokens,
        },
    }

    logger.debug("[LLM] Prompt envoyé (extrait): %s", prompt[:300])

    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json=payload,
        )
        response.raise_for_status()
        raw = response.json().get("message", {}).get("content", "").strip()
        done_reason = response.json().get("done_reason", "?")
        print(f"[LLM RAW] done_reason={done_reason}  raw[:500]={raw[:500]}")
        if not raw:
            print("[LLM] Réponse vide")
            return None
        result = _extract_json_object(raw)
        if result is None:
            print(f"[LLM] JSON parse échoué. Raw complet:\n{raw}")
        return result
    except requests.exceptions.ConnectionError as exc:
        logger.error("[LLM] Ollama inaccessible: %s", exc)
        return None
    except requests.exceptions.RequestException as exc:
        logger.error("[LLM] Erreur HTTP Ollama: %s", exc)
        return None
    except json.JSONDecodeError as exc:
        logger.error("[LLM] Erreur parsing JSON réponse Ollama: %s", exc)
        return None

def _extract_json_object(raw: str) -> dict[str, Any] | None:
    raw = (raw or "").strip()
    if not raw:
        return None

    # Stratégie 1 : parse direct
    try:
        result = json.loads(raw)
        return result if isinstance(result, dict) else None
    except json.JSONDecodeError:
        pass

    # Stratégie 2 : strip blocs markdown ```json ... ```
    text = raw
    for fence in ("```json", "```JSON", "```"):
        if text.startswith(fence):
            text = text[len(fence):]
            break
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()
    try:
        result = json.loads(text)
        return result if isinstance(result, dict) else None
    except json.JSONDecodeError:
        pass

    # Stratégie 3 : trouver le dernier bloc {...}
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None

    candidate = raw[start:end + 1]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass

    # Stratégie 4 : réparer les accolades manquantes
    n_open = candidate.count("{")
    n_close = candidate.count("}")
    if n_open > n_close:
        repaired = candidate + "}" * (n_open - n_close)
        try:
            result = json.loads(repaired)
            logger.info("[LLM] JSON réparé (accolades manquantes ajoutées)")
            return result if isinstance(result, dict) else None
        except json.JSONDecodeError:
            pass

    logger.warning("[LLM] Impossible d'extraire un JSON valide. Brut: %r", raw[:300])
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
    """Parse une image SmolVLM/Groq/OCR et retourne un résumé texte lisible."""
    if isinstance(image, str):
        raw = image
    elif isinstance(image, dict):
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

    try:
        data = json.loads(raw)
        titre        = data.get("titre") or data.get("title") or "Graphique"
        categories   = data.get("categories") or []
        series       = data.get("series") or []
        observations = data.get("observations") or []
        # Format SmolVLM : data = [{category, valeur}]
        smolvlm_data = data.get("data") or []

        parts = [f"Graphique : {titre}"]

        # Format natif (categories + series)
        for serie in series:
            valeurs = serie.get("valeurs", [])
            for cat, val in zip(categories, valeurs):
                parts.append(f"  {cat} : {val}")

        # Format SmolVLM
        for point in smolvlm_data:
            cat = point.get("category") or point.get("categorie") or ""
            val = point.get("valeur") or point.get("value") or ""
            if cat:
                parts.append(f"  {cat} : {val}")

        if observations:
            parts.append("Observations : " + " ; ".join(observations))

        return "\n".join(parts)
    except (json.JSONDecodeError, Exception):
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


def generate_slide_paragraph_heuristic(slide: dict[str, Any]) -> dict[str, Any]:
    """Paragraphe par slide sans appel LLM (templates), coût quasi nul."""
    payload = _build_slide_payload(slide)
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


def generate_slide_paragraph(slide: dict[str, Any]) -> dict[str, Any]:
    payload = _build_slide_payload(slide)
    llm_result = _post_ollama_json(
        SLIDE_PARAGRAPH_SYSTEM,
        "Donnees slide:\n" + json.dumps(payload, ensure_ascii=False, indent=2),
        max_tokens=500,
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

    return generate_slide_paragraph_heuristic(slide)


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


def _format_image_for_prompt(img: dict) -> str:
    """
    Formate une image analysée en texte lisible pour le prompt LLM.
    Gère deux formats :
      - SmolVLM  : {"type", "titre", "data": [{"category": ..., "valeur": ...}]}
      - Groq/OCR : {"type", "titre", "categories": [...], "series": [...], "observations": [...]}
    """
    type_  = img.get("type", "inconnu")
    titre  = img.get("titre", "")

    # Format SmolVLM — données dans "data": [{category, valeur}]
    data = img.get("data") or []
    if data and isinstance(data, list) and isinstance(data[0], dict) and "category" in data[0]:
        data_text = ", ".join(
            f"{d.get('category')}: {d.get('valeur')}"
            for d in data[:12]
            if d.get("category") is not None
        )
        return f"- Graphique {type_} « {titre} » : {data_text}"

    # Format Groq / OCR — categories + series + observations
    categories   = img.get("categories") or []
    series       = img.get("series") or []
    observations = img.get("observations") or []

    parts = [f"- Graphique type={type_} titre={titre}"]
    if categories:
        parts.append(f"  catégories={categories}")
    for serie in series:
        nom     = serie.get("nom", "")
        valeurs = serie.get("valeurs", [])
        pairs   = ", ".join(f"{c}: {v}" for c, v in zip(categories, valeurs))
        parts.append(f"  série {nom}=[{pairs}]")
    if observations:
        parts.append("  observations=" + " ; ".join(observations))

    return "\n".join(parts)


def build_agenda_analysis_input(agenda_group: dict[str, any]) -> str:
    slides_list = agenda_group.get("slides", [])
    if isinstance(slides_list, dict):
        slides_list = [slides_list]

    ordre_du_jour = agenda_group.get("ordre_du_jour") or "Non défini"
    lines = [
        f"Ordre du jour: {ordre_du_jour}",
        f"Nombre de slides: {len(slides_list)}",
        "",
    ]

    for slide in slides_list:
        slide_index = slide.get("index") or slide.get("slide_index", "?")
        slide_titre = slide.get("titre") or slide.get("slide_title") or "Sans titre"

        lines.append("=" * 50)
        lines.append(f"SLIDE {slide_index}: {slide_titre}")
        lines.append("=" * 50)

        # Contenu texte
        contenu = slide.get("contenu") or []
        if isinstance(contenu, str):
            contenu = [contenu]
        if contenu:
            lines.append("Contenu:")
            lines.extend(f"  {c}" for c in contenu if c)

        # Tableaux
        tableaux = slide.get("tableaux") or []
        if tableaux:
            lines.append("Tableaux:")
            for table in tableaux:
                if isinstance(table, str):
                    lines.append(f"  {table}")
                elif isinstance(table, dict):
                    lignes = table.get("lignes") or []
                    if lignes:
                        for row in lignes:
                            lines.append("  " + " | ".join(str(cell) for cell in row))

        # Graphiques natifs
        graphiques = slide.get("graphiques") or []
        if graphiques:
            lines.append("Graphiques:")
            for g in graphiques:
                if isinstance(g, str):
                    lines.append(f"  {g}")
                elif isinstance(g, dict):
                    lines.append(f"  {_format_chart(g)}")

        # Images analysées (Groq/SmolVLM)
        # Fallback: analysed slides store raw payload under "sources"
        images = slide.get("images") or slide.get("sources", {}).get("images") or []

        formatted_images = []
        for img in images:
            if isinstance(img, str) and img.strip():
                formatted_images.append(img)
            elif isinstance(img, dict) and (
                img.get("titre") or img.get("data") or
                img.get("observations") or img.get("series")
            ):
                formatted_images.append(_format_image_for_prompt(img))

        if formatted_images:
            lines.append("Images analysées:")
            for img in formatted_images:
                lines.append(f"  {img}")

        # Paragraphe déjà rédigé (si slide_paragraph a été appelé avant)
        paragraphe = slide.get("paragraphe") or ""
        if paragraphe:
            lines.append("Paragraphe rédigé:")
            lines.append(f"  {paragraphe}")

        # Points clés / actions (si présents)
        points_cles = slide.get("points_cles") or []
        if points_cles:
            lines.append("Points clés:")
            lines.extend(f"  - {item}" for item in points_cles)

        elements_actionnables = slide.get("elements_actionnables") or []
        if elements_actionnables:
            lines.append("Éléments actionnables:")
            lines.extend(f"  - {item}" for item in elements_actionnables)

        lines.append("")

    return "\n".join(lines)
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
        llm_result = _post_ollama_json(AGENDA_ANALYSIS_SYSTEM, analysis_input, max_tokens=1200)
        
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
            print(f"\n📄 PARAGRAPHE PV:\n{llm_result.get('paragraphe_pv') or llm_result.get('analyse', '')}")
            print(f"\n📌 CONSTATS: {llm_result.get('constats', [])}")
            print(f"\n⚠️  RISQUES: {llm_result.get('risques', [])}")
            return {
                "ordre_du_jour": agenda_group.get("ordre_du_jour"),
                "input_analyse": analysis_input,
                "analyse": llm_result.get("analyse", ""),
                "paragraphe_pv": llm_result.get("paragraphe_pv", ""),
                "constats": llm_result.get("constats") or [
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

    # Points clés/actions peuvent être au niveau racine (pipeline) ou dans chaque slide (full service)
    fallback_constats = agenda_group.get("points_cles") or [
        item for slide in slides_list for item in slide.get("points_cles", [])
    ]
    fallback_actions = agenda_group.get("elements_actionnables") or [
        item for slide in slides_list for item in slide.get("elements_actionnables", [])
    ]
    return {
        "ordre_du_jour": agenda_group.get("ordre_du_jour"),
        "input_analyse": analysis_input,
        "analyse": (
            "Les paragraphes rattaches a cet ordre du jour ont ete consolides "
            "pour alimenter une analyse transverse."
        ),
        "constats": fallback_constats[:8],
        "risques": [],
        "actions_suggerees": fallback_actions[:8],
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
