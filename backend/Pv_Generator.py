"""
Génération, fusion et traduction du PV.
Compatible Ollama (modèles locaux) ET API Claude Anthropic.
"""
import json
import re
import os
import requests
from datetime import datetime
from pathlib import Path
from typing import Optional
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH


# ─── Template PV ───────────────────────────────────────────────────────────────

EMPTY_PV_TEMPLATE = {
    "numero": "PV-2025-001",
    "titre": "Procès-Verbal de Réunion",
    "type_reunion": "Comité de Direction",
    "date": "",
    "heure_debut": "",
    "heure_fin": "",
    "lieu": "",
    "president_seance": "",
    "redacteur": "",
    "participants": [],
    "excuses": [],
    "ordre_du_jour": [],
    "points": [],
    "decisions": [],
    "plan_action": [],
    "prochaine_reunion": {
        "date": "",
        "lieu": "",
        "points_previsionnels": []
    },
    "approbation": {
        "date": "",
        "signataire": "",
        "statut": "En attente"
    }
}

POINT_TEMPLATE = {
    "numero": "1",
    "titre": "",
    "expose": "",
    "discussion": "",
    "remarques": [],
    "conclusion": ""
}

ACTION_TEMPLATE = {
    "id": "A01",
    "action": "",
    "responsable": "",
    "echeance": "",
    "statut": "En cours",
    "priorite": "Normale"
}

# ─── Config backend IA ─────────────────────────────────────────────────────────

# Détection automatique : Claude si ANTHROPIC_API_KEY présente, sinon Ollama
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
OLLAMA_URL        = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL      = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")

USE_CLAUDE = bool(ANTHROPIC_API_KEY)

print(f"🤖 Backend IA : {'Claude API' if USE_CLAUDE else f'Ollama ({OLLAMA_MODEL})'}")

EXPORT_DIR = Path(__file__).parent.parent / "exports"
EXPORT_DIR.mkdir(exist_ok=True)


# ─── Extraction JSON robuste ───────────────────────────────────────────────────

def _extract_json(text: str) -> dict | None:
    """
    Tente d'extraire un objet JSON depuis n'importe quelle réponse LLM.
    Gère : JSON pur, ```json ... ```, JSON noyé dans du texte, réponse partielle.
    """
    if not text or not text.strip():
        return None

    text = text.strip()

    # 1. Tentative directe
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 2. Extraire bloc ```json ... ```
    md_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
    if md_match:
        try:
            return json.loads(md_match.group(1))
        except json.JSONDecodeError:
            pass

    # 3. Extraire le premier { ... } de la réponse (même partiel dans du texte)
    brace_match = re.search(r'\{.*\}', text, re.DOTALL)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass

    # 4. Réparer le JSON tronqué (fermer les accolades manquantes)
    if brace_match:
        candidate = brace_match.group(0)
        # Compter les accolades ouvertes/fermées
        opens  = candidate.count('{')
        closes = candidate.count('}')
        if opens > closes:
            candidate = candidate + '}' * (opens - closes)
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass

    return None


def _build_fallback_pv(extracted: dict) -> dict:
    """Construire un PV minimal à partir des données extraites sans LLM."""
    pv = json.loads(json.dumps(EMPTY_PV_TEMPLATE))  # deep copy
    meta = extracted.get("meta", {})

    pv["date"]        = meta.get("date", "")
    pv["heure_debut"] = meta.get("heure_debut", "")
    pv["lieu"]        = meta.get("lieu", "")
    pv["titre"]       = meta.get("titre_reunion", "Réunion de Comité")
    pv["numero"]      = meta.get("numero", "PV-2025-001")

    pv["participants"] = [
        {"nom": p, "fonction": "", "present": True}
        for p in extracted.get("participants", [])
    ]
    pv["ordre_du_jour"] = extracted.get("ordre_du_jour", [])
    pv["decisions"]     = [d.get("decision", d) if isinstance(d, dict) else d
                           for d in extracted.get("decisions", [])]

    pv["points"] = [
        {
            "numero": str(i + 1),
            "titre": pt.get("titre", f"Point {i+1}"),
            "expose": " ".join(pt.get("contenu", [])),
            "discussion": "",
            "remarques": [],
            "conclusion": ""
        }
        for i, pt in enumerate(extracted.get("points_discutes", []))
    ]

    pv["plan_action"] = [
        {
            "id": f"A{str(i+1).zfill(2)}",
            "action": a.get("action", a) if isinstance(a, dict) else a,
            "responsable": "",
            "echeance": "",
            "statut": "En cours",
            "priorite": "Normale"
        }
        for i, a in enumerate(extracted.get("actions", []))
    ]

    return pv


TARGET_PV_STRUCTURE = {
    "points": [
        {
            "numero": "1",
            "titre": "",
            "type": "constat | deliberation | decision",
            "texte_pv": ""
        }
    ],
    "decisions": ["..."],
    "plan_action": [
        {
            "id": "A01",
            "action": "",
            "responsable": "",
            "echeance": "",
            "statut": "En cours"
        }
    ]
}


def export_pv_to_docx(pv: dict, output_path: Optional[str] = None, language: str = "fr") -> str:
    """Exporter un PV structuré en fichier Word (.docx)."""
    if not isinstance(pv, dict):
        raise ValueError("PV doit être un dictionnaire JSON structuré.")

    if "pv" in pv and isinstance(pv["pv"], dict):
        pv = pv["pv"]

    if output_path is None:
        title = pv.get("titre") or pv.get("numero") or "PV"
        safe = re.sub(r"[^\w\-]", "_", str(title))
        output_path = str(EXPORT_DIR / f"{safe}.docx")

    doc = Document()
    section = doc.sections[0]
    section.page_width = Inches(8.27)
    section.page_height = Inches(11.69)
    section.left_margin = section.right_margin = Inches(1.0)
    section.top_margin = section.bottom_margin = Inches(0.9)

    def h(text, size=14, bold=True, align=WD_ALIGN_PARAGRAPH.LEFT):
        p = doc.add_paragraph()
        p.alignment = align
        r = p.add_run(text)
        r.bold = bold
        r.font.size = Pt(size)
        return p

    def para(text, size=11, bold=False):
        p = doc.add_paragraph()
        r = p.add_run(text or "")
        r.bold = bold
        r.font.size = Pt(size)
        return p

    h("PROCÈS-VERBAL DE RÉUNION", size=18, align=WD_ALIGN_PARAGRAPH.CENTER)
    if pv.get("titre"):
        h(pv["titre"], size=14, align=WD_ALIGN_PARAGRAPH.CENTER)
    metadata = []
    for label, key in [("Date", "date"), ("Heure début", "heure_debut"), ("Heure fin", "heure_fin"), ("Lieu", "lieu"), ("Président", "president_seance"), ("Rédacteur", "redacteur")]:
        if pv.get(key):
            metadata.append(f"{label} : {pv.get(key)}")
    for line in metadata:
        para(line, size=11)
    doc.add_paragraph()

    if pv.get("points"):
        h("POINTS DU PV", size=14)
        for point in pv["points"]:
            h(f"Point {point.get('numero','?')} – {point.get('titre','')}", size=12, bold=True)
            para(point.get("texte_pv", ""), size=11)
            if point.get("type"):
                para(f"Type : {point.get('type')}", size=10, bold=True)
            doc.add_paragraph()

    if pv.get("decisions"):
        h("DÉCISIONS", size=14)
        for decision in pv["decisions"]:
            para(decision, size=11)
        doc.add_paragraph()

    if pv.get("plan_action"):
        h("PLAN D'ACTION", size=14)
        for action in pv["plan_action"]:
            para(f"{action.get('id','')} – {action.get('action','')}", size=11, bold=True)
            details = []
            if action.get("responsable"): details.append(f"Responsable : {action.get('responsable')}")
            if action.get("echeance"): details.append(f"Échéance : {action.get('echeance')}")
            if action.get("statut"): details.append(f"Statut : {action.get('statut')}")
            if details:
                para("; ".join(details), size=10)
            doc.add_paragraph()

    doc.save(output_path)
    return output_path


# ─── Appels LLM ───────────────────────────────────────────────────────────────

SYSTEM_PV = """Tu es un rédacteur administratif expert en procès-verbaux de réunion officiels.

TON RÔLE : transformer des slides de présentation en paragraphes de PV rédigés.

RÈGLE DE TRANSFORMATION PAR TYPE DE SLIDE :

1. SLIDE DE CONSTAT / BILAN → rédige un CONSTAT
   Formules d'ouverture : 
   "La séance débute par l'analyse de...", 
   "Le [titre] présente le bilan de la période...",
   "La Direction prend acte de..."
   → Habille les chiffres avec leur contexte et leur signification.

2. SLIDE DE PLAN / MESURES → rédige une DÉLIBÉRATION  
   Formules d'ouverture :
   "Pour pallier [problème identifié], [le responsable / le Comité] propose...",
   "Il est proposé de mettre en œuvre les mesures suivantes...",
   "Face à ce constat, la Direction envisage..."
   → Chaque mesure devient une proposition argumentée (pas juste une liste).

3. SLIDE DE BUDGET / VOTE → rédige une DÉCISION
   Formules d'ouverture :
   "Après examen et échanges, [le budget / la mesure] est validé(e)...",
   "La Direction approuve à l'unanimité...",
   "Il est décidé de..."
   → Inclure le montant, la date, le résultat du vote.

STYLE OBLIGATOIRE :
- 3ème personne du singulier ou pluriel ("La Direction note", "Le responsable propose")
- Temps : présent de narration ou passé composé
- Jamais de bullet points dans la sortie — uniquement des paragraphes rédigés
- Ton neutre, factuel, administratif
- Chaque slide = 3 à 6 phrases minimum
- Connecteurs logiques entre les idées : "À cet égard,", "En conséquence,", "Il convient de noter que,"

STRUCTURE DE RÉPONSE (JSON) :
{
  "points": [
    {
      "numero": "1",
      "titre": "...",
      "type": "constat | deliberation | decision",
      "texte_pv": "Paragraphe rédigé complet..."
    }
  ],
  "decisions": ["Décision 1 rédigée...", "..."],
  "plan_action": [
    {
      "id": "A01",
      "action": "...",
      "responsable": "...",
      "echeance": "...",
      "statut": "..."
    }
  ]
}
"""


def _call_llm(system: str, user: str, max_tokens: int = 4000) -> str:
    """Appel FORCÉ vers Ollama uniquement."""

    forced_user = (
        user
        + "\n\n⚠️ IMPORTANT: Réponds UNIQUEMENT avec le JSON brut. "
        "Commence par { et termine par }. Aucun autre texte."
    )

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": f"[INST] <<SYS>>\n{system}\n<</SYS>>\n\n{forced_user} [/INST]",
        "stream": False,
        "options": {
            "temperature": 0.1,
            "num_predict": max_tokens,
            "stop": ["\n\n\n"]
        }
    }

    try:
        print("🚀 Appel Ollama...")
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json=payload        )

        resp.raise_for_status()

        result = resp.json().get("response", "").strip()

        if not result:
            raise ValueError("Réponse vide Ollama")

        return result

    except Exception as e:
        print(f"❌ Erreur Ollama: {e}")
        raise RuntimeError("Ollama indisponible")
# ─── Fonctions principales ────────────────────────────────────────────────────
SYSTEM_PV = """Tu es un expert en gouvernance bancaire et en rédaction de procès-verbaux de comités de direction.
Tu rédiges des PV en français administratif de haut niveau, avec un registre analytique et financier rigoureux.

LEXIQUE OBLIGATOIRE À UTILISER :
- Financier : ratio de solvabilité, covenant, EBITDA, RAROC, NIM (Net Interest Margin), 
  coût du risque, provisions pour créances douteuses, NPL ratio, LCR, NSFR, tier 1, 
  ROE, ROA, cost-to-income, spread de taux, duration, VAR, back-testing, stress test,
  encours de crédit, pipeline commercial, taux de transformation, effet de levier
- Gouvernance : délibération, résolution, quorum, approbation collégiale, mandat,
  pouvoir de décision, habilitation, reporting, escalade, dispositif de contrôle interne
- Analytique : décomposition, ventilation, écart favorable/défavorable, variance,
  glissement annuel, variation trimestrielle, contribution nette, effet prix/volume/mix,
  benchmark sectoriel, trajectoire cible, indicateur avancé

STYLE IMPOSÉ :
- 3ème personne du pluriel impersonnelle ("Le Comité a examiné", "Il a été relevé que")
- Connecteurs analytiques : "L'analyse fait ressortir que", "Il ressort de l'examen que",
  "À l'aune des indicateurs présentés", "Au regard des données probantes",
  "La revue analytique indique", "Les éléments de benchmark confirment"
- Chiffres avec unités précises (M€, pb, %, bps)
- Formulations décisionnelles : "Le Comité a arrêté", "Il a été résolu que",
  "La délibération acte", "Une résolution a été adoptée à l'unanimité"
"""

def generate_pv_draft(client, extracted: dict) -> dict:
    """Générer un PV draft analytique et financier à partir du contenu extrait."""

    prompt = f"""À partir de cette extraction de présentation de comité bancaire, génère un PV analytique structuré.

DONNÉES EXTRAITES :
{json.dumps(extracted, ensure_ascii=False, indent=2)}

STRUCTURE DE RÉPONSE EXACTE :
{json.dumps(TARGET_PV_STRUCTURE, ensure_ascii=False, indent=2)}

RÈGLES DE RÉDACTION ANALYTIQUE :

1. EXPOSÉ (champ "expose") :
   - Présente le contexte chiffré : "M. X a soumis à l'examen du Comité les indicateurs 
     relatifs à [sujet], faisant état d'un [ratio/indicateur] de [valeur] au [date]."
   - Inclure systématiquement une référence comparative (N-1, budget, benchmark)

2. DISCUSSION (champ "discussion") :
   - Décompose les drivers de performance : effet volume, effet prix, effet mix
   - Formule les risques en termes quantifiés : "Un glissement de +15 bps du coût 
     du risque a été relevé, portant le NPL ratio à X%"
   - Mentionne les ratios prudentiels si pertinent (LCR, tier 1, NSFR)
   - Cite les écarts vs plan : "L'écart défavorable de X M€ par rapport au budget 
     s'explique principalement par..."
   - 4 à 7 phrases avec connecteurs analytiques

3. CONCLUSION (champ "conclusion") :
   - Formulation décisionnelle ferme : "Le Comité a arrêté / résolu / acté"
   - Inclure les seuils et conditions : "sous réserve que le ratio [X] demeure 
     supérieur à [seuil]", "conditionné à l'atteinte de [KPI]"
   - Mentionner le niveau de priorité et l'horizon temporel

4. DÉCISIONS (champ "decisions") :
   - Format : "[Verbe décisionnel] + [objet précis] + [condition/seuil si applicable]"
   - Exemples : 
     "Validation de l'enveloppe de crédit de X M€ assortie d'un covenant 
      de maintien du DSCR au-dessus de 1,25x"
     "Autorisation du provisionnement additionnel de X M€ sur le portefeuille NPL 
      conformément aux exigences IFRS 9"

5. PLAN D'ACTION (champ "plan_action") :
   - Action : verbe d'action + livrable précis (ex: "Produire le rapport de back-testing 
     VAR à 99% sur l'horizon 10 jours")
   - Inclure la métrique de succès dans l'intitulé si possible

RÈGLES GÉNÉRALES :
- Aucun bullet point dans les champs texte
- Tous les chiffres en format européen (1 234,56 M€)
- Abréviations financières en majuscules (NPL, LCR, NSFR, RAROC, NIM)
- Si un champ numérique est absent des données, extrapoler de façon cohérente 
  avec le contexte ou laisser ""
- RÉPONSE = JSON UNIQUEMENT, commence par {{"""

    raw = _call_llm(SYSTEM_PV, prompt, max_tokens=4000)
    print(f"📨 Réponse LLM (200 chars): {raw[:200]}")

    parsed = _extract_json(raw)
    if parsed:
        print("✅ JSON extrait avec succès")
        return parsed

    print("⚠️ JSON non extrait — utilisation du fallback structurel")
    return _build_fallback_pv(extracted)
def merge_notes_with_pv(client, pv_draft: dict, notes: list) -> dict:
    """Fusionner les notes des participants avec le PV et reformuler via LLM."""

    if not notes:
        return pv_draft

    notes_text = "\n".join(
        f"- {n['participant']}: {n['content']}"
        for n in notes
        if n.get("participant") and n.get("content")
    )

    if not notes_text.strip():
        return pv_draft

    prompt = f"""Fusionne ces notes de réunion dans le PV draft et reformule en langage administratif.

PV DRAFT:
{json.dumps(pv_draft, ensure_ascii=False, indent=2)}

NOTES DES PARTICIPANTS:
{notes_text}

RÈGLES:
1. Intègre chaque note dans le point approprié du PV
2. Reformule en langage administratif formel (3ème personne)
3. Enrichis "discussion" et "remarques" de chaque point concerné
4. Ajoute les décisions/actions détectées dans les notes
5. Préserve TOUTE la structure JSON existante
6. RÉPONSE = JSON UNIQUEMENT, commence par {{"""

    raw = _call_llm(SYSTEM_PV, prompt, max_tokens=4000)
    parsed = _extract_json(raw)

    if parsed:
        return parsed

    print("⚠️ Merge JSON non extrait — retour du draft original")
    return pv_draft


def translate_pv(client, pv: dict, target_language: str) -> dict:
    """Traduire le PV dans la langue cible."""

    lang_names = {
        "fr": "français",
        "en": "English (formal administrative register)",
        "ar": "arabe (registre administratif officiel, écriture RTL)"
    }
    lang_name = lang_names.get(target_language, target_language)

    prompt = f"""Traduis ce PV en {lang_name}.

PV:
{json.dumps(pv, ensure_ascii=False, indent=2)}

RÈGLES:
- Traduis tous les champs textuels (titre, expose, discussion, remarques, conclusion, decisions, actions...)
- Conserve les dates, numéros, codes (PV-2025-001, A01...) tels quels
- Maintiens le registre formel et administratif
- Conserve EXACTEMENT la même structure JSON
- RÉPONSE = JSON UNIQUEMENT, commence par {{"""

    raw = _call_llm(SYSTEM_PV, prompt, max_tokens=4000)
    parsed = _extract_json(raw)

    if parsed:
        parsed["_language"] = target_language
        return parsed

    print("⚠️ Traduction JSON non extraite — retour de l'original")
    return pv