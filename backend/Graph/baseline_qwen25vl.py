"""Chart extraction baseline using Qwen2.5VL via Ollama."""

import base64
import json
import sys
from pathlib import Path

import requests


OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "qwen2.5vl:7b"


PROMPT = """
Tu es un extracteur de donnees de graphiques.

Analyse l'image fournie et retourne uniquement un JSON valide.

Schema exact:
{
  "chart_type": "pie" | "bar" | "line" | "unknown",
  "title": string,
  "data": [
    {"label": string, "value": number | null}
  ],
  "confidence": number
}

Regles:
- N'invente jamais de titre, label ou valeur.
- Pour un camembert, les valeurs sont des pourcentages.
- Associe les valeurs aux labels via la legende et les couleurs.
- confidence doit etre entre 0 et 1.
- Si une valeur est illisible, mets null.
- Retourne uniquement le JSON, sans markdown, sans commentaire.
""".strip()


def image_to_base64(image_path: str) -> str:
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def extract_chart(image_path: str) -> dict:
    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "user",
                "content": PROMPT,
                "images": [image_to_base64(image_path)],
            }
        ],
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0,
            "num_predict": 800,
        },
    }

    response = requests.post(OLLAMA_URL, json=payload, timeout=180)
    response.raise_for_status()

    raw_content = response.json()["message"]["content"]
    return json.loads(raw_content)


def main() -> None:
    image_path = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\user\Downloads\circular.png"
    if not Path(image_path).exists():
        raise FileNotFoundError(image_path)

    result = extract_chart(image_path)
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
