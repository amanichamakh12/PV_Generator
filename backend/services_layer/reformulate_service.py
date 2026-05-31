import re

from pydantic import BaseModel


def clean_qwen_response(text: str) -> str:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = text.strip()
    text = text.strip('"').strip("'").strip("«").strip("»").strip()
    return text