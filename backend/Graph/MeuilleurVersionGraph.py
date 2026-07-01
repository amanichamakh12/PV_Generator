import base64
import json
import logging
import os
import re
import time

from dotenv import load_dotenv
from groq import Groq

load_dotenv()

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
Tu es un expert en lecture de graphiques.
Tu renvoies UNIQUEMENT un objet JSON valide, sans balises markdown, sans texte avant ou après.

Schéma attendu :
{
  "type": "bar" | "line" | "pie" | "scatter" | "area" | "other",
  "titre": string | null,
  "data": [
    { "category": string, "valeur": number }
  ]
}
"""

QUESTION = "Analyse ce graphique et renvoie son contenu sous forme JSON."

OUTPUT_FILE = r"C:\Users\user\Downloads\PV generator\backend\annotations.json"
GROQ_API_KEYS = [
    os.getenv("GROQ_API_KEY_1"),
    os.getenv("GROQ_API_KEY_2"),
]
_current_key_index = 0

def _get_groq_client():
    global _current_key_index
    return Groq(api_key=GROQ_API_KEYS[_current_key_index])

def describe_image_groq(image_bytes: bytes) -> dict:
    client = _get_groq_client()
    b64 = base64.b64encode(image_bytes).decode()

    result = client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{b64}"},
                    },
                    {
                        "type": "text",
                        "text": QUESTION,
                    },
                ],
            },
        ],
        temperature=0,
        max_tokens=600,
    )

    raw_response = result.choices[0].message.content
    return _parse_json_safe(raw_response)
def _parse_json_safe(raw: str) -> dict:
    """Retire les backticks markdown puis parse le JSON."""
    text = raw.strip()
    # Retire ```json ... ``` ou ``` ... ```
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw_response": raw, "_parse_error": True}


def _wait_for_rate_limit(error_message: str):
    """Extrait le délai d'attente du message Groq et patiente."""
    match = re.search(r"try again in (\d+)m([\d.]+)s", error_message)
    if match:
        minutes = int(match.group(1))
        seconds = float(match.group(2))
        wait = minutes * 60 + seconds + 5  # +5s de marge
    else:
        wait = 65  # fallback : 1 minute
    print(f"  ⏳ Rate limit — attente de {wait:.0f}s...")
    time.sleep(wait)


if __name__ == "__main__":
    from pathlib import Path

    client = _get_groq_client()

    image_folder = Path(r"C:\Users\user\Downloads\datasetHuggingFace\ChartQA\images\ChartQA Dataset\train\png")
    extensions = {".png", ".jpg", ".jpeg", ".webp"}
    images = sorted(p for p in image_folder.iterdir() if p.suffix.lower() in extensions)

    # Charge les annotations existantes pour reprendre où on s'est arrêté
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            annotations = json.load(f)
        already_done = {a["image"] for a in annotations}
        print(f"Reprise : {len(already_done)} images déjà annotées.")
    else:
        annotations = []
        already_done = set()

    for image_path in images:

        if image_path.name in already_done:
            continue

        print(f"Traitement : {image_path.name}")

        retries = 3
        for attempt in range(1, retries + 1):
            try:
                with open(image_path, "rb") as f:
                    b64 = base64.b64encode(f.read()).decode()

                result = client.chat.completions.create(
                    model="meta-llama/llama-4-scout-17b-16e-instruct",
                    messages=[
                        {
                            "role": "system",
                            "content": SYSTEM_PROMPT,
                        },
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image_url",
                                    "image_url": {"url": f"data:image/png;base64,{b64}"},
                                },
                                {
                                    "type": "text",
                                    "text": QUESTION,
                                },
                            ],
                        },
                    ],
                    temperature=0,
                    max_tokens=600,
                )

                raw_response = result.choices[0].message.content
                parsed = _parse_json_safe(raw_response)

                # ✓ append ICI dans le try — toujours exécuté
                annotations.append({
                    "image": image_path.name,
                    "annotation": parsed,
                })

                # Sauvegarde après chaque image
                with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                    json.dump(annotations, f, indent=4, ensure_ascii=False)

                print(f"  ✓ OK : {image_path.name}")
                break  # succès — sort de la boucle retry

            except Exception as e:
                error_str = str(e)
                print(f"  ✗ Erreur (tentative {attempt}/{retries}) : {image_path.name}")
                print(f"  {error_str}")

                if "rate_limit_exceeded" in error_str:
                    _current_key_index += 1
                    if _current_key_index < len(GROQ_API_KEYS):
                        print("  🔄 Bascule sur la clé suivante...")
                        continue  # réessaie avec la nouvelle clé
                    else:
                        _wait_for_rate_limit(error_str)  # toutes les clés épuisées
                if attempt < retries:
                    time.sleep(2 ** attempt)
                else:
                    print(f"  ✗ Abandon après {retries} tentatives : {image_path.name}")

    print(f"\nTerminé : {len(annotations)} annotations sauvegardées.")