import re
import io
import numpy as np
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# ── Constantes ────────────────────────────────────────────────
X_AXIS_MAX        = 40     # tokens axe Y (x trop petit → ignorer)
VALUE_MIN_CONF    = 70     # confiance min pour les valeurs de barres
LABEL_MIN_CONF    = 30     # confiance min pour les labels
LINE_GROUP_TOL    = 15     # tolérance Y pour grouper tokens en ligne
CLUSTER_TOL_X     = 80     # tolérance X pour grouper tokens en colonne
LABEL_ZONE_RATIO  = 0.92   # seuil Y : en dessous = valeurs, au-dessus = labels
TITLE_ZONE_RATIO  = 0.12   # seuil Y : au-dessus = titre
PIE_SUM_TOL       = 10     # tolérance somme pourcentages
MIN_BAR_VALUE     = 100    # valeur min pour être une barre
MAX_BAR_VALUE     = 9_999_999

QUARTER_FUSED = re.compile(r"^[T1]?([1-4])(\d{4})$")
QUARTER_CLEAN = re.compile(r"^(T[1-4])\s*(\d{4})$")
YEAR_RE       = re.compile(r"^\d{4}$")
QUARTER_RE    = re.compile(r"^T[1-4]$")


# ════════════════════════════════════════════════════════════════
# 1. PRÉTRAITEMENT + OCR
# ════════════════════════════════════════════════════════════════

def preprocess_image(image_bytes: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    w, h = img.size
    img = img.resize((w * 2, h * 2), Image.LANCZOS)
    img = img.filter(ImageFilter.SHARPEN)
    img = ImageEnhance.Contrast(img).enhance(1.5)
    return img


def get_ocr_tokens(image_bytes: bytes) -> list[dict]:
    img     = preprocess_image(image_bytes)
    img_np  = np.array(img)
    data    = pytesseract.image_to_data(
        img_np,
        output_type=pytesseract.Output.DICT,
        config="--psm 11 --oem 3"
    )
    tokens = []
    for i in range(len(data["text"])):
        txt = data["text"][i].strip()
        if txt:
            tokens.append({
                "text": txt,
                "x":    data["left"][i],
                "y":    data["top"][i],
                "w":    data["width"][i],
                "h":    data["height"][i],
                "conf": data["conf"][i],
            })
    return tokens


# ════════════════════════════════════════════════════════════════
# 2. ZONES
# ════════════════════════════════════════════════════════════════

def split_zones(tokens: list[dict]) -> tuple[list, list, list]:
    """
    Retourne (title_tokens, value_tokens, label_tokens).
    Zones : titre = haut 12%, labels = bas 8%, valeurs = milieu.
    """
    if not tokens:
        return [], [], []

    max_y = max(t["y"] for t in tokens)

    title_cut  = max_y * TITLE_ZONE_RATIO
    label_cut  = max_y * LABEL_ZONE_RATIO

    title_tokens = [t for t in tokens if t["y"] <= title_cut]
    label_tokens = [t for t in tokens if t["y"] >  label_cut]
    value_tokens = [t for t in tokens
                    if t["y"] > title_cut and t["y"] <= label_cut]

    return title_tokens, value_tokens, label_tokens


# ════════════════════════════════════════════════════════════════
# 3. DÉTECTION DU TYPE DE GRAPHE (OCR pur)
# ════════════════════════════════════════════════════════════════

def detect_chart_type(tokens: list[dict]) -> str:
    """
    Heuristique pure OCR — aucun modèle ML.

    Règles de décision (dans l'ordre) :
    1. Au moins 2 tokens '%'        → pie
    2. Valeurs entre 0 et 100 seulement, somme ≈ 100 → pie
    3. Grandes valeurs absolues (>100, non multiples de 100) → bar
    4. Sinon                        → unknown
    """
    _, value_tokens, _ = split_zones(tokens)

    # ── Règle 1 : tokens % explicites ─────────────────────────
    pct_tokens = [
        t for t in tokens
        if re.match(r"^\d{1,3}%$", t["text"].strip())
    ]
    if len(pct_tokens) >= 2:
        return "pie"

    # ── Règle 2 : valeurs entre 1 et 99, somme ≈ 100 ──────────
    small_vals = []
    for t in tokens:
        m = re.match(r"^(\d{1,3})%?$", t["text"].strip())
        if m:
            v = int(m.group(1))
            if 1 <= v <= 99:
                small_vals.append(v)

    if len(small_vals) >= 2:
        total = sum(small_vals)
        if abs(total - 100) <= PIE_SUM_TOL:
            return "pie"

    # ── Règle 3 : grandes valeurs absolues → bar/line ──────────
    bar_vals = _scan_bar_values(value_tokens)
    if len(bar_vals) >= 2:
        return "bar"

    return "unknown"


def _scan_bar_values(tokens: list[dict]) -> list[int]:
    """Extrait les valeurs candidates de barres (pour détection)."""
    vals = []
    for t in tokens:
        if t["conf"] < VALUE_MIN_CONF:
            continue
        if t["x"] < X_AXIS_MAX:
            continue
        txt = re.sub(r"[\s\u202f]", "", t["text"])
        txt = re.sub(r"\D", "", txt)
        if not txt:
            continue
        v = int(txt)
        if v % 100 == 0:
            continue
        if MIN_BAR_VALUE <= v <= MAX_BAR_VALUE:
            vals.append(v)
    return vals


# ════════════════════════════════════════════════════════════════
# 4. EXTRACTION — TITRE
# ════════════════════════════════════════════════════════════════

def extract_title(title_tokens: list[dict]) -> str:
    filtered = [t for t in title_tokens if t["conf"] > 60]
    filtered = sorted(filtered, key=lambda t: t["x"])
    return " ".join(t["text"] for t in filtered).strip()


# ════════════════════════════════════════════════════════════════
# 5. EXTRACTION — BAR CHART
# ════════════════════════════════════════════════════════════════

def extract_bar_values(value_tokens: list[dict]) -> list[tuple]:
    """
    Retourne [(valeur, x_centre, y), ...] triés par x.
    Filtre : axe Y (x<40), graduations (multiple 100), conf faible.
    """
    vals = []
    for t in value_tokens:
        if t["conf"] < VALUE_MIN_CONF:
            continue
        if t["x"] < X_AXIS_MAX:
            continue
        txt = re.sub(r"[\s\u202f]", "", t["text"])
        txt = re.sub(r"\D", "", txt)
        if not txt:
            continue
        v = int(txt)
        if v % 100 == 0:
            continue
        if not (MIN_BAR_VALUE <= v <= MAX_BAR_VALUE):
            continue
        x_centre = t["x"] + t["w"] // 2
        vals.append((v, x_centre, t["y"]))

    return sorted(vals, key=lambda x: x[1])


def extract_axis_labels(label_tokens: list[dict]) -> list[dict]:
    """
    Retourne [{"label": "T2 2024", "x": 142}, ...] triés par x.
    Gère : tokens séparés, tokens fusionnés (132024), conf faible.
    """
    # Filtrer conf trop basse
    filtered = [t for t in label_tokens if t["conf"] >= LABEL_MIN_CONF]

    # Grouper par proximité X → un cluster = un label de barre
    clusters: list[list[dict]] = []
    for t in sorted(filtered, key=lambda t: t["x"]):
        placed = False
        for cl in clusters:
            if abs(t["x"] - cl[-1]["x"]) < CLUSTER_TOL_X:
                cl.append(t)
                placed = True
                break
        if not placed:
            clusters.append([t])

    labels = []
    for cl in clusters:
        # Trier les tokens du cluster par Y (ligne 1 au-dessus de ligne 2)
        tokens_sorted = sorted(cl, key=lambda t: t["y"])
        text     = " ".join(t["text"] for t in tokens_sorted)
        x_centre = int(np.mean([t["x"] + t["w"] // 2 for t in cl]))

        parsed = _parse_label(text)
        labels.append({"label": parsed, "x": x_centre})

    labels = sorted(labels, key=lambda l: l["x"])

    # Combler les labels manquants (ex : T4 2024 avec conf=22)
    labels = _fill_missing_labels(labels)

    return labels


def _parse_label(text: str) -> str:
    """
    Tente de normaliser un label en trimestre.
    Exemples :
      'T2 2024'  → 'T2 2024'
      'T2 2024'  → 'T2 2024'
      '132024'   → 'T3 2024'
      'T3 2024'  → 'T3 2024'
    Retourne le texte brut si aucun pattern ne correspond.
    """
    text = text.strip()

    # Déjà propre : "T2 2024"
    m = QUARTER_CLEAN.match(text)
    if m:
        return f"{m.group(1)} {m.group(2)}"

    # Tokens séparés collés : "T22024"
    text_nospace = text.replace(" ", "")
    m = QUARTER_FUSED.match(text_nospace)
    if m:
        return f"T{m.group(1)} {m.group(2)}"

    # Deux tokens collés "T2" + "2024" → "T2 2024"
    parts = text.split()
    if len(parts) == 2 and QUARTER_RE.match(parts[0]) and YEAR_RE.match(parts[1]):
        return f"{parts[0]} {parts[1]}"

    return text


def _next_quarter(label: str) -> str | None:
    """T2 2024 → T3 2024, T4 2024 → T1 2025."""
    m = re.match(r"T([1-4])\s+(\d{4})", label)
    if not m:
        return None
    q, y = int(m.group(1)), int(m.group(2))
    return f"T1 {y+1}" if q == 4 else f"T{q+1} {y}"


def _fill_missing_labels(labels: list[dict]) -> list[dict]:
    """
    Parcourt les labels trimestriels connus et insère les manquants
    par logique arithmétique (aucune hallucination possible).
    """
    if len(labels) < 2:
        return labels

    filled = [labels[0]]
    for curr in labels[1:]:
        expected = _next_quarter(filled[-1]["label"])
        if expected and expected != curr["label"]:
            mid_x = (filled[-1]["x"] + curr["x"]) // 2
            filled.append({
                "label":        expected,
                "x":            mid_x,
                "interpolated": True
            })
            print(f"  ↪ Label interpolé : {expected} à x≈{mid_x}")
        filled.append(curr)

    return filled


def map_by_position(labels: list[dict], values: list[tuple]) -> list[dict]:
    """
    Associe chaque valeur au label le plus proche en X.
    Robuste aux mismatches de comptage.
    """
    result     = []
    used_labels = set()

    for val, vx, _ in values:
        best_idx  = None
        best_dist = float("inf")
        for i, lbl in enumerate(labels):
            if i in used_labels:
                continue
            dist = abs(lbl["x"] - vx)
            if dist < best_dist:
                best_dist = dist
                best_idx  = i
        if best_idx is not None:
            used_labels.add(best_idx)
            result.append({
                "label": labels[best_idx]["label"],
                "value": val
            })

    return sorted(result, key=lambda r: r["label"])


# ════════════════════════════════════════════════════════════════
# 6. EXTRACTION — PIE CHART
# ════════════════════════════════════════════════════════════════

def extract_pie_values(tokens: list[dict]) -> list[tuple]:
    """Retourne [(valeur_pct, x, y), ...] pour un camembert."""
    vals = []
    for t in tokens:
        m = re.match(r"^(\d{1,3})%?$", t["text"].strip())
        if m:
            v = int(m.group(1))
            if 1 <= v <= 99:
                vals.append((v, t["x"], t["y"]))

    total = sum(v[0] for v in vals)
    if abs(total - 100) > PIE_SUM_TOL:
        print(f"  ⚠ Somme pourcentages = {total} (attendu 100±{PIE_SUM_TOL})")

    return sorted(vals, key=lambda x: x[1])  # trié par X


def extract_legend_labels(tokens: list[dict]) -> list[str]:
    """Extrait les labels de la légende (zone basse)."""
    all_ys = [t["y"] for t in tokens]
    if not all_ys:
        return []

    max_y      = max(all_ys)
    threshold  = max_y * 0.65
    leg_tokens = [t for t in tokens
                  if t["y"] > threshold and t["conf"] > LABEL_MIN_CONF]
    sorted_t   = sorted(leg_tokens, key=lambda t: t["y"])

    lines, used = [], set()
    for i, t in enumerate(sorted_t):
        if i in used:
            continue
        line = [t]
        used.add(i)
        for j, t2 in enumerate(sorted_t):
            if j not in used and abs(t2["y"] - t["y"]) < LINE_GROUP_TOL:
                line.append(t2)
                used.add(j)
        text = " ".join(tok["text"] for tok in sorted(line, key=lambda x: x["x"]))
        if text.strip():
            lines.append(text.strip())

    # Filtrer les lignes parasites (titre, unités)
    stopwords = {"répartition", "catégorie", "par", "total", "source"}
    lines = [l for l in lines
             if not any(s in l.lower() for s in stopwords)]

    return lines


# ════════════════════════════════════════════════════════════════
# 7. VALIDATE
# ════════════════════════════════════════════════════════════════

def validate(data: list[dict]) -> bool:
    values = [d["value"] for d in data]
    if len(values) < 2:
        return False
    if len(set(values)) == 1:
        return False
    if all(v % 100 == 0 for v in values):
        return False
    return True