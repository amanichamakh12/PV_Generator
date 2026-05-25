"""
chart_ocr_extractor.py
══════════════════════
Pipeline hybride OCR (Tesseract) + LLaVA (structure) pour extraire
les données PRÉCISES des graphiques PowerPoint.

Stratégie :
  - Tesseract lit les chiffres exacts (valeurs sur barres, titre, labels X)
  - LLaVA identifie la structure visuelle (type de chart, couleurs, légende)
  - On fusionne : OCR pour les données, LLaVA pour le contexte

Drop-in replacement pour describe_image() dans pptx_parser.py :
    from chart_ocr_extractor import describe_image
"""

import re
import io
import base64
import logging

import cv2
import numpy as np
import requests
from PIL import Image
import pytesseract

# ── Windows : chemin vers l'exécutable Tesseract ──────────────────────
import os
import platform

if platform.system() == "Windows":
    pytesseract.pytesseract.tesseract_cmd = (
        os.environ.get("TESSERACT_PATH")
        or r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    )
logger = logging.getLogger(__name__)

OLLAMA_URL   = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "llava:13b"


# ══════════════════════════════════════════════════════════════════════
# ÉTAPE 1 — OCR : lit les chiffres et labels EXACTS
# ══════════════════════════════════════════════════════════════════════

def _upscale(img_np: np.ndarray, scale: int = 4) -> np.ndarray:
    h, w = img_np.shape[:2]
    return cv2.resize(img_np, (w * scale, h * scale), interpolation=cv2.INTER_CUBIC)


def _ocr_tokens(img_up: np.ndarray, min_conf: int = 25) -> list:
    """Retourne tous les tokens OCR avec position et confiance."""
    data = pytesseract.image_to_data(
        img_up, lang="eng", output_type=pytesseract.Output.DICT
    )
    tokens = []
    for i in range(len(data["text"])):
        t = data["text"][i].strip()
        conf = int(data["conf"][i])
        if t and conf >= min_conf:
            tokens.append({
                "text": t,
                "conf": conf,
                "x":    data["left"][i],
                "y":    data["top"][i],
                "w":    data["width"][i],
                "h":    data["height"][i],
            })
    return tokens


def _fix_quarter_label(label: str) -> str:
    """
    Corrige les erreurs OCR sur les labels trimestre.
    Ex : "T32 2025" -> "T1 2025"  (OCR lit '1' comme '12' ou '32')
    Règle : si le numéro de trimestre est > 4, garde le dernier chiffre.
    """
    m = re.match(r"T(\d+)\s+(\d{4})", label)
    if not m:
        return label
    q_raw, year = m.group(1), m.group(2)
    q = int(q_raw)
    if q > 4:
        last = q % 10
        q = last if 1 <= last <= 4 else 1
    return f"T{q} {year}"


def _fix_quarter_sequence(labels: list) -> list:
    """
    Correction contextuelle de la séquence de trimestres.
    Si OCR lit ['T2 2025', 'T4 2025', 'T1 2026'] alors que la vraie
    séquence est T1->T4->T1, on corrige le premier label.

    Heuristique : si corriger Q du 1er label à 1 rend la séquence
    arithmétiquement cohérente, on applique la correction.
    """
    if len(labels) < 2:
        return labels

    parsed = []
    for lb in labels:
        m = re.match(r"T(\d)\s+(\d{4})", lb)
        if m:
            parsed.append((int(m.group(1)), int(m.group(2))))
        else:
            return labels  # format inattendu, abandon

    def score(q, y): return y * 4 + q

    scores = [score(q, y) for q, y in parsed]

    # Séquence déjà monotone croissante : rien à faire
    if all(scores[i] < scores[i+1] for i in range(len(scores)-1)):
        q0, y0 = parsed[0]
        if q0 != 1:
            # Teste si q0=1 maintient la cohérence
            new_scores = [score(1, y0)] + scores[1:]
            if all(new_scores[i] < new_scores[i+1] for i in range(len(new_scores)-1)):
                # Vérifie pas régulier (optionnel, améliore la confiance)
                labels[0] = f"T1 {y0}"

    return labels


def _extract_x_labels_from_psm6(img_up: np.ndarray) -> list:
    """
    Utilise PSM 6 pour récupérer les labels de l'axe X.
    Cherche les patterns trimestre : T1 2025, T4 2026, etc.
    """
    full_text = pytesseract.image_to_string(img_up, lang="eng", config="--psm 6")
    lines = [l.strip() for l in full_text.splitlines() if l.strip()]

    # Cherche la ligne la plus basse contenant des labels Tx YYYY
    for line in reversed(lines):
        raw = re.findall(r"T\d+\s+\d{4}", line)
        if raw:
            fixed = [_fix_quarter_label(l) for l in raw]
            return _fix_quarter_sequence(fixed)

    # Fallback : années seules
    for line in reversed(lines):
        years = re.findall(r"\b20\d{2}\b", line)
        if years:
            return years

    return []


def _extract_bar_values(tokens: list, img_h: int) -> list:
    """
    Valeurs numériques affichées SUR les barres (zone milieu, >= 3 chiffres).
    Triées par X (gauche -> droite = ordre des barres).
    """
    mid = [t for t in tokens if img_h * 0.10 <= t["y"] <= img_h * 0.85]
    bar_vals = [
        t for t in mid
        if re.match(r"^\d{3,}([,.']\d+)?$", t["text"].replace(" ", ""))
    ]
    return sorted(bar_vals, key=lambda t: t["x"])


def _extract_title(tokens: list, img_h: int) -> str:
    """Titre = tokens dans le bandeau haut (< 12% hauteur)."""
    top = [t for t in tokens if t["y"] < img_h * 0.12]
    return " ".join(t["text"] for t in sorted(top, key=lambda t: t["x"])).strip()


def ocr_extract(img_np: np.ndarray) -> dict:
    """
    Extraction complète via Tesseract.
    Retourne : title, bar_values (list[str]), x_labels (list[str]), full_text.
    """
    img_up = _upscale(img_np, scale=4)
    h_up   = img_up.shape[0]

    tokens     = _ocr_tokens(img_up)
    title      = _extract_title(tokens, h_up)
    bar_values = _extract_bar_values(tokens, h_up)
    x_labels   = _extract_x_labels_from_psm6(img_up)
    full_text  = pytesseract.image_to_string(img_up, lang="eng", config="--psm 6").strip()

    # Si on a moins de labels que de valeurs, infère le label manquant
    # (le 1er label est souvent mal lu car sa barre est plus basse sur le graphique)
    if x_labels and len(x_labels) < len(bar_values):
        m = re.match(r"T(\d+)\s+(\d{4})", x_labels[0])
        if m:
            q, year = int(m.group(1)), int(m.group(2))
            prev_q    = q - 1 if q > 1 else 4
            prev_year = year if q > 1 else year - 1
            x_labels.insert(0, f"T{prev_q} {prev_year}")
            logger.debug(f"Label X inféré (manquant) : T{prev_q} {prev_year}")

    return {
        "title":      title,
        "bar_values": [t["text"] for t in bar_values],
        "x_labels":   x_labels,
        "full_text":  full_text,
    }


# ══════════════════════════════════════════════════════════════════════
# ÉTAPE 2 — LLaVA : structure visuelle (type, couleurs, légende)
# ══════════════════════════════════════════════════════════════════════

LLAVA_STRUCTURE_PROMPT = """Look at this chart image. Do NOT read or guess any numbers.
Answer ONLY these structural questions in this exact format:

CHART_TYPE: selon votre interpretation
SERIES_COUNT: <number of distinct colored bars/lines/slices>
COLORS: <color of each series from left to right, comma separated>
LEGEND_LABELS: <exact text labels from the legend, or "none">
X_AXIS_LABEL: <label of the X axis or "none">
Y_AXIS_LABEL: <label of the Y axis or "none">"""


def llava_structure(image_bytes: bytes) -> dict:
    """
    Interroge LLaVA sur la structure visuelle uniquement.
    Ne lui demande PAS de lire des chiffres — c'est le rôle de l'OCR.
    """
    b64 = base64.b64encode(image_bytes).decode()
    payload = {
        "model":   OLLAMA_MODEL,
        "stream":  False,
        "options": {"temperature": 0.0, "num_predict": 200, "top_p": 0.1},
        "messages": [
            {"role": "user", "content": LLAVA_STRUCTURE_PROMPT, "images": [b64]}
        ],
    }
    try:
        r = requests.post(OLLAMA_URL, json=payload)
        r.raise_for_status()
        content = r.json()["message"]["content"]
        result = {}
        for line in content.splitlines():
            if ":" in line:
                k, _, v = line.partition(":")
                result[k.strip().lower()] = v.strip()
        return result
    except requests.exceptions.ConnectionError:
        logger.warning("Ollama non disponible — structure visuelle ignorée")
        return {"chart_type": "unknown (ollama offline)"}
    except Exception as e:
        logger.warning(f"LLaVA call failed: {e}")
        return {"chart_type": "unknown", "error": str(e)}


# ══════════════════════════════════════════════════════════════════════
# ÉTAPE 3 — Fusion OCR + LLaVA
# ══════════════════════════════════════════════════════════════════════

def _pair_values_labels(bar_values: list, x_labels: list) -> list:
    """Associe chaque valeur à son label (même ordre gauche -> droite)."""
    n = max(len(bar_values), len(x_labels))
    return [
        {
            "label": x_labels[i] if i < len(x_labels) else f"Point {i+1}",
            "value": bar_values[i] if i < len(bar_values) else "non lisible",
        }
        for i in range(n)
    ]


def _format_for_pv(title, chart_type, data_points, colors, legend,
                   x_axis, y_axis, full_text) -> str:
    """Formate le résultat en texte structuré pour rédiger un PV."""
    lines = [
        f"TYPE DE GRAPHIQUE : {chart_type}",
        f"TITRE : {title or 'non visible'}",
        f"AXE X : {x_axis or 'non visible'}",
        f"AXE Y : {y_axis or 'non visible'}",
        "",
        "DONNÉES :",
    ]
    for pt in data_points:
        lines.append(f"  {pt['label']} → {pt['value']}")

    if colors:
        lines.append(f"\nCOULEURS/SÉRIES : {colors}")
    if legend and legend.lower() not in ("none", ""):
        lines.append(f"LÉGENDE : {legend}")
    if full_text:
        lines.append(f"\nTEXTE BRUT OCR :\n{full_text}")

    return "\n".join(lines)


# ══════════════════════════════════════════════════════════════════════
# API PUBLIQUE — remplace describe_image() dans pptx_parser.py
# ══════════════════════════════════════════════════════════════════════

def describe_image(image_bytes: bytes) -> str:
    """
    Pipeline hybride OCR + LLaVA.
    Retourne une STRING structurée (compatible avec parse_pptx existant).

    Dans pptx_parser.py, remplace l'import :
        from chart_ocr_extractor import describe_image
    """
    img    = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img_np = np.array(img)

    ocr   = ocr_extract(img_np)
    llava = llava_structure(image_bytes)
    pts   = _pair_values_labels(ocr["bar_values"], ocr["x_labels"])

    return _format_for_pv(
        title       = ocr["title"],
        chart_type  = llava.get("chart_type", "unknown"),
        data_points = pts,
        colors      = llava.get("colors", ""),
        legend      = llava.get("legend_labels", ""),
        x_axis      = llava.get("x_axis_label", ""),
        y_axis      = llava.get("y_axis_label", ""),
        full_text   = ocr["full_text"],
    )


def describe_image_structured(image_bytes: bytes) -> dict:
    """
    Même pipeline — retourne un DICT.
    Pour /api/parse-pptx-chartllama ou tout usage JSON.
    """
    img    = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img_np = np.array(img)

    ocr   = ocr_extract(img_np)
    llava = llava_structure(image_bytes)

    return {
        "title":         ocr["title"],
        "chart_type":    llava.get("chart_type", "unknown"),
        "series_count":  llava.get("series_count", "?"),
        "colors":        llava.get("colors", ""),
        "legend_labels": llava.get("legend_labels", "none"),
        "x_axis_label":  llava.get("x_axis_label", ""),
        "y_axis_label":  llava.get("y_axis_label", ""),
        "data_points":   _pair_values_labels(ocr["bar_values"], ocr["x_labels"]),
        "ocr_full_text": ocr["full_text"],
        "ocr_confidence":"high" if ocr["bar_values"] else "low",
        "llava_raw":     llava,
    }


# ══════════════════════════════════════════════════════════════════════
# TEST LOCAL  →  python chart_ocr_extractor.py image.png
# ══════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import sys, json
    path = sys.argv[1] if len(sys.argv) > 1 else "Engagement.PNG"
    with open(path, "rb") as f:
        raw = f.read()
    print("=== describe_image() — string pour PV ===")
    print(describe_image(raw))
    print("\n=== describe_image_structured() — dict pour API ===")
    print(json.dumps(describe_image_structured(raw), indent=2, ensure_ascii=False))