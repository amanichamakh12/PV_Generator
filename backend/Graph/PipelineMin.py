"""Minimal chart extraction pipeline (OCR + optional Ollama helper)."""

import base64
import json

import requests

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


def extract_chart_with_ollama(image_path: str) -> dict:
    with open(image_path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode("utf-8")

    payload = {
        "model": "qwen2.5vl:7b",
        "messages": [
            {
                "role": "user",
                "content": "Analyse ce graphique et retourne uniquement un JSON valide avec chart_type, title, data, confidence.",
                "images": [image_b64],
            }
        ],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0}
    }

    response = requests.post(
        "http://localhost:11434/api/chat",
        json=payload,
        timeout=120
    )
    response.raise_for_status()

    content = response.json()["message"]["content"]
    return json.loads(content)