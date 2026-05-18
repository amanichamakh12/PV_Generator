import base64, json, requests

OLLAMA_URL = "http://localhost:11434"
OLLAMA_MODEL = "llava-llama3"  # ou qwen2-vl:7b

PROMPT = """Analyse ce graphique. Retourne UNIQUEMENT ce JSON valide :
{
  "type": "column|bar|line|pie",
  "titre": "...",
  "categories": ["..."],
  "series": [{"nom": "...", "valeurs": [0.0]}],
  "observations": ["constat 1", "constat 2"]
}
Ne retourne rien d'autre que le JSON."""

def analyze_chart_image_ollama(image_bytes: bytes) -> dict:
    b64 = base64.b64encode(image_bytes).decode()

    resp = requests.post(f"{OLLAMA_URL}/api/generate", json={
        "model":  OLLAMA_MODEL,
        "prompt": PROMPT,
        "images": [b64],
        "stream": False,
        "options": {"temperature": 0.1, "num_predict": 500}
    }, timeout=120)

    raw = resp.json().get("response", "").strip()
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end == -1:
        return {"error": "JSON non trouvé", "raw": raw}
    return json.loads(raw[start:end+1])


# Test direct
if __name__ == "__main__":
    with open(r"C:\Users\user\Downloads\RepartitionCatégorie.png", "rb") as f:
        result = analyze_chart_image_ollama(f.read())
    print(json.dumps(result, ensure_ascii=False, indent=2))