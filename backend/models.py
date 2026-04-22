# ── Models ────────────────────────────────────────────────────────────────────
from pydantic import BaseModel


class Note(BaseModel):
    participant: str
    content: str

class MergeRequest(BaseModel):
    pv_draft: dict
    notes: list[Note]

class TranslateRequest(BaseModel):
    pv: dict
    target_language: str

class ExportRequest(BaseModel):
    pv: dict
    language: str = "fr"

class DraftRequest(BaseModel):
    pv_data: dict

class ParseRequest(BaseModel):
    session_info: dict  

