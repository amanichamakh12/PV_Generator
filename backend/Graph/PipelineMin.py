"""Minimal chart extraction pipeline (OCR + optional Ollama helper)."""

import base64
import json
import os
<<<<<<< HEAD
from urllib.parse import urljoin
=======
>>>>>>> 6069a5aa2c36e900a6bf0e5b141825480666f695

import requests

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
OLLAMA_MODEL = os.environ.get("OLLAMA_VISION_MODEL", os.environ.get("OLLAMA_MODEL", "qwen2.5vl:3b"))


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


if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\user\Downloads\test2.png"

    with open(path, "rb") as f:
        img = f.read()

    result = extract_chart(img)
    print("\n" + json.dumps(result, indent=2, ensure_ascii=False))


def extract_chart_with_ollama(image_input: str | bytes) -> dict:
    """
    Accepts either a file path (str) or raw image bytes.
    """
    if isinstance(image_input, bytes):
        image_b64 = base64.b64encode(image_input).decode("utf-8")
    else:
        with open(image_input, "rb") as f:
            image_b64 = base64.b64encode(f.read()).decode("utf-8")

    payload = {
        "model": OLLAMA_MODEL,
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
        "stream": False,
        "format": "json",
        "options": {"temperature": 0}
    }

<<<<<<< HEAD
    try:
        response = requests.post(
            _ollama_endpoint("/api/chat"),
            json=payload,
            timeout=120
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        try:
            if isinstance(image_input, bytes):
                fallback = extract_chart(image_input)
            else:
                with open(image_input, "rb") as f:
                    fallback = extract_chart(f.read())
        except Exception:
            fallback = {
                "chart_type": "unknown",
                "title": "",
                "data": [],
                "confidence": 0.0,
            }
        fallback["source"] = "ocr_fallback"
        fallback["ollama_status"] = "offline"
        fallback["message"] = (
            f"Ollama indisponible sur {_ollama_endpoint('/api/chat')}. "
            "Demarrez Ollama ou configurez OLLAMA_URL."
        )
        return fallback
=======
    ollama_chat_url = os.environ.get("OLLAMA_URL", "http://localhost:11434").rstrip("/") + "/api/chat"

    response = requests.post(
        ollama_chat_url,
        json=payload,
        timeout=120
    )
    response.raise_for_status()
>>>>>>> 6069a5aa2c36e900a6bf0e5b141825480666f695

    data = response.json()
    content = data["message"]["content"]

    result = json.loads(content)
    if isinstance(result, dict):
        result.setdefault("source", "ollama")
    return result
