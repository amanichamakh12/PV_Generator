"""Minimal chart extraction pipeline (OCR + optional Ollama/SmolVLM helpers)."""

import base64
import io
import json
import logging
import os
import time
from urllib.parse import urljoin

import requests
from PIL import Image

logger = logging.getLogger(__name__)

from ocr import (
    detect_chart_type,
    extract_axis_labels,
    extract_bar_values,
    extract_legend_labels,
    extract_pie_values,
    extract_title,
    get_ocr_tokens,
    map_by_position,
    split_zones,
    validate,
)

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434").rstrip("/")
OLLAMA_VISION_MODEL = os.environ.get("OLLAMA_VISION_MODEL", "qwen2.5vl:3b")
OLLAMA_VISION_IMAGE_SIZE = int(os.environ.get("OLLAMA_VISION_IMAGE_SIZE", "512"))
OLLAMA_VISION_NUM_CTX = int(os.environ.get("OLLAMA_VISION_NUM_CTX", "1024"))
OLLAMA_VISION_NUM_BATCH = int(os.environ.get("OLLAMA_VISION_NUM_BATCH", "64"))
OLLAMA_VISION_TIMEOUT = int(os.environ.get("OLLAMA_VISION_TIMEOUT", "600"))

QWEN_MODEL = os.environ.get("QWEN_MODEL", "qwen2.5vl:3b")

# Schema JSON canonique attendu de tous les modèles vision
_CHART_JSON_SCHEMA = (
    '{\n'
    '  "chart_type": "bar|pie|line|area|autre",\n'
    '  "title": "le titre exact, ou null si absent",\n'
    '  "data": [ {"category": "<texte>", "value": <nombre>} ],\n'
    '  "confidence": <entier de 0 a 100>\n'
    '}'
)

_CHART_PROMPT = (
    "Tu analyses un graphique et tu renvoies UNIQUEMENT un objet JSON valide, sans texte autour. "
    "Return ONLY valid JSON. "
    "Respecte EXACTEMENT ce schema :\n"
    + _CHART_JSON_SCHEMA + "\n"
    "Regles strictes :\n"
    "- Utilise TOUJOURS les cles \"category\" et \"value\" (jamais day, name, year, region...).\n"
    "- \"value\" est un nombre (pas de %, pas d'unite, pas de texte).\n"
    "- Pour un graphe a series multiples ou empile, cree une entree par segment, "
    "ex: \"category\": \"T1 - Produit A\".\n"
    "- Ne mets aucune cle en dehors du schema."
)

_ALLOWED_CHART_TYPES = frozenset({
    "bar", "pie", "line", "area", "radar", "scatter",
    "column", "doughnut", "bubble", "autre", "unknown",
})
_ALLOWED_KEYS = frozenset({"chart_type", "title", "data", "confidence", "source"})


def _ollama_endpoint(path: str) -> str:
    return urljoin(f"{OLLAMA_URL}/", path.lstrip("/"))


# ──────────────────────────────────────────────────────────────────────────────
# Utilitaires JSON robustes
# ──────────────────────────────────────────────────────────────────────────────

def _parse_percent(val) -> float:
    """Convertit '42%', 42, '42.5' etc. en float."""
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        clean = val.strip().rstrip("%").replace(",", ".").strip()
        try:
            return float(clean)
        except ValueError:
            pass
    return 0.0


def _validate_and_fix_chart_json(result: dict) -> dict:
    """
    Normalise la réponse d'un modèle vision vers le schéma canonique.
    - Vérifie chart_type, data (liste de {category, value}), confidence.
    - Convertit les pourcentages en nombres.
    - Supprime les clés non autorisées.
    - Ne lève une exception que si result n'est pas un dict.
    """
    if not isinstance(result, dict):
        raise ValueError(f"Résultat attendu dict, obtenu {type(result).__name__}")

    # 1. chart_type
    ct = str(result.get("chart_type") or "unknown").lower().strip()
    if ct not in _ALLOWED_CHART_TYPES:
        logger.warning("chart_type inconnu %r, remplacé par 'unknown'", ct)
        ct = "unknown"
    result["chart_type"] = ct

    # 2. title — accepte l'alias "titre"
    if "title" not in result:
        result["title"] = result.pop("titre", None)

    # 3. data doit être une liste de {category, value}
    raw_data = result.get("data")
    if not isinstance(raw_data, list):
        logger.warning("'data' absent ou non-liste (%s), réinitialisé à []", type(raw_data).__name__)
        raw_data = []

    fixed_data = []
    for item in raw_data:
        if not isinstance(item, dict):
            continue
        category = (
            item.get("category")
            or item.get("label")
            or item.get("name")
            or item.get("x")
            or item.get("key")
            or ""
        )
        value = (
            item["value"]
            if item.get("value") is not None
            else item.get("y") or item.get("count") or item.get("v") or 0
        )
        if str(category).strip():
            fixed_data.append({"category": str(category).strip(), "value": _parse_percent(value)})
    result["data"] = fixed_data

    # 4. confidence
    conf = result.get("confidence", 50)
    try:
        conf = max(0, min(100, int(_parse_percent(conf))))
    except (TypeError, ValueError):
        conf = 50
    result["confidence"] = conf

    # 5. Supprimer les clés non autorisées
    for key in list(result.keys()):
        if key not in _ALLOWED_KEYS:
            del result[key]

    return result


def _parse_robust_json(raw: str, source_label: str = "") -> dict:
    """
    Extrait un objet JSON depuis la sortie brute d'un modèle.
    Stratégies : parse direct → strip markdown → rfind({}) → réparation accolades.
    Lève RuntimeError avec contexte si toutes les stratégies échouent.
    """
    if not raw or not raw.strip():
        raise RuntimeError(f"[{source_label}] Réponse vide du modèle")

    text = raw.strip()

    # Stratégie 1 : parse direct
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    # Stratégie 2 : strip blocs markdown ```json ... ```
    for fence in ("```json", "```JSON", "```"):
        if text.startswith(fence):
            text = text[len(fence):]
            break
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    # Stratégie 3 : trouver le dernier bloc {...} dans la chaîne
    start = raw.rfind("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = raw[start:end + 1]
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError as exc:
            logger.debug("[%s] Extraction partielle échouée: %s", source_label, exc)
            # Stratégie 4 : réparer les accolades manquantes
            n_open = candidate.count("{")
            n_close = candidate.count("}")
            if n_open > n_close:
                repaired = candidate + "}" * (n_open - n_close)
                try:
                    parsed = json.loads(repaired)
                    if isinstance(parsed, dict):
                        logger.info("[%s] JSON réparé (accolades fermantes ajoutées)", source_label)
                        return parsed
                except json.JSONDecodeError:
                    pass

    logger.error("[%s] Aucun JSON valide extrait. Réponse brute: %r", source_label, raw[:500])
    raise RuntimeError(
        f"[{source_label}] Aucun JSON valide dans la réponse du modèle. "
        f"Premiers 300 chars : {raw[:300]!r}"
    )


# ──────────────────────────────────────────────────────────────────────────────
# Extraction OCR (sans LLM)
# ──────────────────────────────────────────────────────────────────────────────

def extract_chart(image_bytes: bytes) -> dict:
    tokens = get_ocr_tokens(image_bytes)

    print("\n🔍 OCR TOKENS:")
    for t in tokens:
        print(f"  '{t['text']}' x={t['x']} y={t['y']} conf={t['conf']}")

    title_tokens, value_tokens, label_tokens = split_zones(tokens)
    chart_type = detect_chart_type(tokens)
    title      = extract_title(title_tokens)

    print(f"\n📊 Type : {chart_type}")
    print(f"📝 Titre : {title}")

    if chart_type == "pie":
        values     = extract_pie_values(tokens)
        labels     = extract_legend_labels(tokens)
        values_raw = [v[0] for v in sorted(values, key=lambda x: x[1])]
        data       = [{"label": labels[i], "value": values_raw[i]}
                      for i in range(min(len(labels), len(values_raw)))]
        confidence = 0.90 if abs(sum(values_raw) - 100) <= 5 else 0.50

    elif chart_type == "bar":
        values = extract_bar_values(value_tokens)
        labels = extract_axis_labels(label_tokens)

        print(f"  → valeurs : {[v[0] for v in values]}")
        print(f"  → labels  : {[l['label'] for l in labels]}")

        data       = map_by_position(labels, values)
        confidence = 0.95 if validate(data) else 0.50

    else:
        data, confidence = [], 0.0

    return {
        "chart_type": chart_type,
        "title":      title,
        "data":       data,
        "confidence": confidence,
    }


def _resize_image(image_bytes: bytes, max_size: int | None = None) -> bytes:
    """Réduit l'image — 512px suffit pour les graphes et réduit la charge vision."""
    limit = max_size if max_size is not None else OLLAMA_VISION_IMAGE_SIZE
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    w, h = img.size
    if max(w, h) > limit:
        ratio = limit / max(w, h)
        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def _read_image_bytes(image_input: str | bytes) -> bytes:
    if isinstance(image_input, bytes):
        image_bytes = image_input
    else:
        with open(image_input, "rb") as f:
            image_bytes = f.read()
    return _resize_image(image_bytes)


# ──────────────────────────────────────────────────────────────────────────────
# Extraction via Ollama (streaming)
# ──────────────────────────────────────────────────────────────────────────────

def _build_ollama_vision_payload(image_b64: str, stream: bool) -> dict:
    payload = {
        "model": OLLAMA_VISION_MODEL,
        "messages": [
            {
                "role": "user",
                "content": _CHART_PROMPT,
                "images": [image_b64],
            }
        ],
        "stream": stream,
        "keep_alive": "10m",
        "options": {
            "temperature": 0,
            "num_ctx": OLLAMA_VISION_NUM_CTX,
            "num_gpu": 0,
            "num_thread": 8,
            "num_batch": OLLAMA_VISION_NUM_BATCH,
        },
    }
    if not stream:
        payload["format"] = "json"
    return payload


def stream_chart_with_ollama(image_input: str | bytes):
    """Yield token deltas from Ollama vision model (stream=True)."""
    image_bytes = _read_image_bytes(image_input)
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    payload = _build_ollama_vision_payload(image_b64, stream=True)
    ollama_chat_url = _ollama_endpoint("api/chat")

    logger.info(
        "Ollama vision stream start model=%s url=%s image_kb=%.0f",
        OLLAMA_VISION_MODEL,
        ollama_chat_url,
        len(image_bytes) / 1024,
    )
    started = time.monotonic()
    first_token_at: float | None = None

    try:
        with requests.post(
            ollama_chat_url,
            json=payload,
            stream=True,
            timeout=(30, OLLAMA_VISION_TIMEOUT),
        ) as response:
            response.raise_for_status()
            for line in response.iter_lines(decode_unicode=True):
                if not line:
                    continue
                try:
                    chunk = json.loads(line)
                except json.JSONDecodeError:
                    continue

                if chunk.get("error"):
                    raise RuntimeError(str(chunk["error"]))

                if chunk.get("done"):
                    break

                delta = chunk.get("message", {}).get("content", "")
                if not delta:
                    delta = chunk.get("response", "")
                if delta:
                    if first_token_at is None:
                        first_token_at = time.monotonic()
                        logger.info(
                            "Ollama first token after %.1fs",
                            first_token_at - started,
                        )
                    yield delta
    except requests.exceptions.ReadTimeout as exc:
        elapsed = time.monotonic() - started
        raise RuntimeError(
            f"Ollama n'a pas répondu après {int(elapsed)}s "
            f"(modèle {OLLAMA_VISION_MODEL}). "
            "Sur CPU avec ~12 Go RAM, utilisez qwen2.5vl:3b-q4_K_M — "
            "le 7b requiert ~13 Go et peut bloquer indéfiniment. "
            "Redémarrez Ollama si le modèle est coincé : docker restart pv-ollama"
        ) from exc
    except requests.exceptions.ConnectionError as exc:
        raise RuntimeError(f"Connexion Ollama impossible ({OLLAMA_VISION_MODEL}) : {exc}") from exc
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(f"Erreur connexion Ollama ({OLLAMA_VISION_MODEL}) : {exc}") from exc

    logger.info("Ollama vision stream done in %.1fs", time.monotonic() - started)


def extract_chart_with_ollama(image_input: str | bytes) -> dict:
    """Accepts either a file path (str) or raw image bytes."""
    raw = "".join(stream_chart_with_ollama(image_input))
    logger.info("Ollama vision raw response: %r", raw[:300])
    result = _parse_robust_json(raw, source_label="ollama")
    result = _validate_and_fix_chart_json(result)
    result.setdefault("source", "ollama")
    return result


# ──────────────────────────────────────────────────────────────────────────────
# Extraction via Ollama Qwen
# ──────────────────────────────────────────────────────────────────────────────

def extract_chart_with_qwen(image_input: str | bytes) -> dict:
    """Analyse une image via Ollama avec le modèle qwen2.5vl."""
    image_bytes = _read_image_bytes(image_input)
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    payload = {
        "model": QWEN_MODEL,
        "messages": [
            {
                "role": "user",
                "content": _CHART_PROMPT,
                "images": [image_b64],
            }
        ],
        "stream": False,
        "format": "json",
        "keep_alive": "10m",
        "options": {
            "temperature": 0,
            "num_ctx": OLLAMA_VISION_NUM_CTX,
            "num_batch": OLLAMA_VISION_NUM_BATCH,
        },
    }

    ollama_chat_url = _ollama_endpoint("api/chat")

    logger.info(
        "Qwen vision start model=%s image_kb=%.0f",
        QWEN_MODEL,
        len(image_bytes) / 1024,
    )
    started = time.monotonic()

    try:
        response = requests.post(
            ollama_chat_url,
            json=payload,
            timeout=(30, OLLAMA_VISION_TIMEOUT),
        )
        response.raise_for_status()
        data = response.json()
        content = data.get("message", {}).get("content", "")
    except requests.exceptions.ConnectionError as exc:
        raise RuntimeError(f"Connexion Ollama impossible ({QWEN_MODEL}) : {exc}") from exc
    except requests.exceptions.Timeout as exc:
        raise RuntimeError(f"Timeout Ollama ({QWEN_MODEL}) : {exc}") from exc
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(f"Erreur connexion Ollama ({QWEN_MODEL}) : {exc}") from exc

    logger.info(
        "Qwen vision done in %.1fs raw_response=%r",
        time.monotonic() - started,
        content[:300],
    )

    result = _parse_robust_json(content, source_label="qwen")
    result = _validate_and_fix_chart_json(result)
    result.setdefault("source", "qwen")
    return result


# ──────────────────────────────────────────────────────────────────────────────
# Extraction via SmolVLM local (CPU)
# ──────────────────────────────────────────────────────────────────────────────

SMOLVLM_MODEL_ID = "HuggingFaceTB/SmolVLM-500M-Instruct"

_smolvlm_processor = None
_smolvlm_model = None


def _load_smolvlm():
    """Charge SmolVLM une seule fois (lazy loading)."""
    global _smolvlm_processor, _smolvlm_model
    if _smolvlm_model is None:
        try:
            import torch
        except ImportError:
            raise RuntimeError(
                "torch n'est pas installé. Exécutez : pip install torch --index-url https://download.pytorch.org/whl/cpu"
            )
        try:
            from transformers import AutoProcessor, AutoModelForImageTextToText
        except (ImportError, Exception) as exc:
            raise RuntimeError(
                f"transformers n'est pas installé ou version trop ancienne (>=4.40.0 requis). "
                f"Exécutez : pip install 'transformers>=4.40.0'. Détail : {exc}"
            )
        logger.info("Chargement SmolVLM (première fois, ~1 Go)...")
        _smolvlm_processor = AutoProcessor.from_pretrained(SMOLVLM_MODEL_ID)
        _smolvlm_model = AutoModelForImageTextToText.from_pretrained(
            SMOLVLM_MODEL_ID,
            torch_dtype=torch.float32,
        )
        _smolvlm_model.to("cpu")
        logger.info("SmolVLM chargé.")
    return _smolvlm_processor, _smolvlm_model


def extract_chart_with_smolvlm(image_input: str | bytes) -> dict:
    """Analyse une image via SmolVLM 500M (local CPU, sans Ollama)."""
    import torch

    image_bytes = _read_image_bytes(image_input)
    smolvlm_processor, smolvlm_model = _load_smolvlm()

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    logger.info("SmolVLM inference start image_kb=%.0f", len(image_bytes) / 1024)

    messages = [
        {"role": "user", "content": [
            {"type": "image"},
            {"type": "text", "text": _CHART_PROMPT},
        ]},
    ]

    prompt = smolvlm_processor.apply_chat_template(messages, add_generation_prompt=True)
    inputs = smolvlm_processor(text=prompt, images=[image], return_tensors="pt").to("cpu")

    started = time.monotonic()

    with torch.no_grad():
        generated_ids = smolvlm_model.generate(**inputs, max_new_tokens=512, do_sample=False)

    sortie = smolvlm_processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
    logger.info("SmolVLM done in %.1fs raw_response=%r", time.monotonic() - started, sortie[:300])

    result = _parse_robust_json(sortie, source_label="smolvlm")
    result = _validate_and_fix_chart_json(result)
    return result


if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\user\Downloads\staging.png"

    with open(path, "rb") as f:
        img = f.read()

    result = extract_chart(img)
    print("\n" + json.dumps(result, indent=2, ensure_ascii=False))
