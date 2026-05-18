import base64
import requests
import json
import re

from ocr import extract_legend_labels, extract_pie_values, extract_values, get_ocr_tokens, map_data, validate

from ocr import validate

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "llava:13b"

def call_llava(prompt, image_bytes):
    import base64
    import requests

    b64 = base64.b64encode(image_bytes).decode()
    print("📡 Envoi requête à Ollama...")

    payload = {
        "model": MODEL,
        "stream": False,
        "options": {"temperature": 0.0},
        "messages": [
            {"role": "user", "content": prompt, "images": [b64]}
        ]
    }
    
    r = requests.post(OLLAMA_URL, json=payload)
    print("✅ Réponse reçue")
    try:
        data = r.json()
    except Exception:
        print("❌ Response not JSON")
        print(r.text)
        print("RAW:", r.text[:500])
        return None

    # 🔍 debug complet
    if "message" in data:
        return data["message"]["content"]

    elif "response" in data:
        return data["response"]

    elif "error" in data:
        print("❌ Ollama error:", data["error"])
        return None

    else:
        print("❌ Unknown response format:")
        print(data)
        return None
def clean_json(raw):
    if not raw:
        return None

    # enlever ```json ... ```
    raw = re.sub(r"```json", "", raw)
    raw = re.sub(r"```", "", raw)

    return raw.strip()
def extract_chart(image_bytes):
    prompt = """
Extract the data from this chart.

Return ONLY valid JSON:

{
  "chart_type": "bar|line|pie|other",
  "labels": ["..."],
  "series_count": number
}

Do not explain anything.
"""
    raw = call_llava(prompt, image_bytes)

    cleaned = clean_json(raw)

    try:
        data = json.loads(cleaned)
    except Exception as e:
        print("❌ JSON parsing failed")
        print("RAW:", raw)
        print("CLEANED:", cleaned)
        return None

    return data
def extract_chart_hybrid(image_bytes, ocr_tokens):
    llava_data = extract_chart(image_bytes)

    if not llava_data:
        print("❌ LLaVA failed")
        return None

    chart_type = llava_data.get("chart_type", "bar")

    if chart_type == "pie":
        # Use dedicated pie extractors
        ocr_values = extract_pie_values(ocr_tokens)
        labels = extract_legend_labels(ocr_tokens)

        print(f"🥧 Pie chart — {len(labels)} labels, {len(ocr_values)} values")

        # Sort values by Y position (top-to-bottom roughly matches legend order)
        ocr_values_sorted = sorted(ocr_values, key=lambda x: x[1])  # sort by X
        values_only = [v[0] for v in ocr_values_sorted]

        # Filter out non-label lines (title, etc.)
        labels = [l for l in labels if not any(
            skip in l.lower() for skip in ["répartition", "catégorie", "par"]
        )]

        data = map_data(labels, [(v, 0, 0) for v in values_only])
        confidence = 0.75 if len(labels) == len(values_only) else 0.4

    else:
        # Original bar chart pipeline
        ocr_values = extract_values(ocr_tokens)
        labels = llava_data.get("labels", [])
        data = map_data(labels, ocr_values)
        confidence = 0.9 if validate(data) else 0.5

    return {
        "chart_type": chart_type,
        "data": data,
        "confidence": confidence
    }

if __name__ == "__main__":
    with open(r"c:\Users\user\Downloads\Engagement.PNG", "rb") as f:
        img = f.read()

    # OCR
    tokens = get_ocr_tokens(img)

    print("\n🔍 ALL OCR TOKENS:")
    for t in tokens:
        print(f"  text='{t['text']}' x={t['x']} y={t['y']} conf={t['conf']}")

    # Pipeline OCR+LLM
    result = extract_chart_hybrid(img, tokens)

    print(json.dumps(result, indent=2))