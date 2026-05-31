"""Minimal chart extraction pipeline (OCR + optional Ollama helper)."""

import base64
import io
import json
import logging
import os
import time
from PIL import Image
from urllib.parse import urljoin

import requests

logger = logging.getLogger(__name__)

from backend.Graph.MeuilleurVersionGraph import describe_image_groq
from backend.ocr import (
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
# Modèle vision dédié — ne pas retomber sur OLLAMA_MODEL (souvent un 7b trop lourd pour la RAM).
OLLAMA_VISION_MODEL = os.environ.get("OLLAMA_VISION_MODEL", "moondream:latest")
OLLAMA_VISION_IMAGE_SIZE = int(os.environ.get("OLLAMA_VISION_IMAGE_SIZE", "512"))
OLLAMA_VISION_NUM_CTX = int(os.environ.get("OLLAMA_VISION_NUM_CTX", "1024"))
OLLAMA_VISION_NUM_BATCH = int(os.environ.get("OLLAMA_VISION_NUM_BATCH", "64"))
OLLAMA_VISION_TIMEOUT = int(os.environ.get("OLLAMA_VISION_TIMEOUT", "600"))
GROQ_VISION_MODEL = os.environ.get("GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")

def _ollama_endpoint(path: str) -> str:
    return urljoin(f"{OLLAMA_URL}/", path.lstrip("/"))


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
        "confidence": confidence
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

def extract_chart_with_ollama(image_input: str | bytes) -> dict:
    """
    Accepts either a file path (str) or raw image bytes.
    """
    content = "".join(stream_chart_with_ollama(image_input))
    result = json.loads(content)
    if isinstance(result, dict):
        result.setdefault("source", "ollama")
    return result
def extract_chart_with_groq(image_input: str | bytes) -> dict:
    if isinstance(image_input, bytes):
        image_bytes = image_input
    else:
        with open(image_input, "rb") as f:
            image_bytes = f.read()

    image_bytes = _resize_image(image_bytes)

    logger.info(
        "Groq vision start model=%s image_kb=%.0f",
        GROQ_VISION_MODEL,
        len(image_bytes) / 1024,
    )
    started = time.monotonic()

    content = describe_image_groq(image_bytes)

    logger.info("Groq vision done in %.1fs", time.monotonic() - started)

    # Nettoyer les backticks si le modèle en ajoute
    clean = content.strip().removeprefix("```json").removesuffix("```").strip()

    result = json.loads(clean)
    result.setdefault("source", "groq")
    return result

def _build_ollama_vision_payload(image_b64: str, stream: bool) -> dict:
    payload = {
        "model": OLLAMA_VISION_MODEL,
        "messages": [
            {
                "role": "user",
                "content": (
                    "Analyse ce graphique et retourne uniquement un JSON valide avec "
                    "chart_type, title, data, confidence."
                ),
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


def _read_image_bytes(image_input: str | bytes) -> bytes:
    if isinstance(image_input, bytes):
        image_bytes = image_input
    else:
        with open(image_input, "rb") as f:
            image_bytes = f.read()
    return _resize_image(image_bytes)


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
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(f"Erreur connexion Ollama ({OLLAMA_VISION_MODEL}) : {exc}") from exc

    logger.info(
        "Ollama vision stream done in %.1fs",
        time.monotonic() - started,
    )


if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\user\Downloads\staging.png"

    with open(path, "rb") as f:
        img = f.read()

    result = extract_chart(img)
    print("\n" + json.dumps(result, indent=2, ensure_ascii=False))


