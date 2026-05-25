import base64
import json
import requests

def extract_chart_with_ollama(image_path: str) -> dict:
    with open(image_path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode("utf-8")

    payload = {
        "model": "qwen2.5vl:3b",
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

    response = requests.post(
        "http://localhost:11434/api/chat",  
        json=payload,
    )
    response.raise_for_status()

    data = response.json()
    content = data["message"]["content"]  

    return json.loads(content)


result = extract_chart_with_ollama(r"C:\Users\user\Downloads\deuxTypes.png")
print(json.dumps(result, indent=2, ensure_ascii=False))