import base64
import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()  # ← charge le .env dans l'environnement

def _get_groq_client():
    return 1 #Groq(api_key=os.getenv("GROQ_API_KEY"))


def describe_image_groq(image_bytes: bytes, model: str = "meta-llama/llama-4-scout-17b-16e-instruct") -> str:
    """Analyse une image de graphique via Groq et retourne le texte de réponse."""
    client = _get_groq_client()
    b64 = base64.b64encode(image_bytes).decode()
    result = client.chat.completions.create(
        model=model,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                {"type": "text", "text": """Analyse ce graphique. Retourne UNIQUEMENT ce JSON :
{
  \"type\": \"column|bar|line|pie\",
  \"titre\": \"...\",
  \"categories\": [\"...\"],
  \"series\": [{\"nom\": \"...\", \"valeurs\": [0.0]}],
  \"observations\": [\"...\"]
}"""}
            ]
        }],
        max_tokens=500,
    )
    return result.choices[0].message.content


if __name__ == "__main__":
    client = _get_groq_client()

    with open(r"C:\Users\user\Downloads\RepartitionCatégorie.png", "rb") as f:
        b64 = base64.b64encode(f.read()).decode()

    result = client.chat.completions.create(
    model="meta-llama/llama-4-scout-17b-16e-instruct",  
    messages=[{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
            {"type": "text", "text": """Analyse ce graphique. Retourne UNIQUEMENT ce JSON :
{
  "type": "column|bar|line|pie",
  "titre": "...",
  "categories": ["..."],
  "series": [{"nom": "...", "valeurs": [0.0]}],
  "observations": ["..."]
}"""}
        ]
    }],
    max_tokens=500
)
    print(result.choices[0].message.content)