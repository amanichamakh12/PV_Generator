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

class SlideParagraphRequest(BaseModel):
    slide: dict
    use_llm: bool = False

class AgendaAnalysisRequest(BaseModel):
    agenda_group: dict
    use_llm: bool = False

class DraftPipelineRequest(BaseModel):
    extracted: dict
    use_llm_for_slides: bool = False
    use_llm_for_analysis: bool = False

class ParseRequest(BaseModel):
    session_info: dict  

