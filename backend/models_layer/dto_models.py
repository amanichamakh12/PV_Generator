"""Pydantic request models and SQLAlchemy ORM models for PV documents."""

from pydantic import BaseModel
from sqlalchemy import Column, Integer, DateTime, Text
from sqlalchemy.sql import func
from core_layer.database import Base
from typing import List, Optional


class Point(BaseModel):
    id: str
    titre: str
    discussion: str
    conclusion: str


class PV(BaseModel):
    titre: str
    date: str
    introduction: str
    ordreJour: List[str]
    points: List[Point]


class Note(BaseModel):
    participant: str
    content: str
    ordre_du_jour: str | None = None


class MergeRequest(BaseModel):
    pv_draft: dict
    notes: list[Note]


class TranslateRequest(BaseModel):
    pv: str
    target_language: str


class ExportRequest(BaseModel):
    pv: dict
    language: str = "fr"


class DraftRequest(BaseModel):
    pv_data: dict


class SlideParagraphRequest(BaseModel):
    slide: dict


class AgendaFullRequest(BaseModel):
    ordre_du_jour: str
    slides: list[dict]
    use_llm: bool = True


class AgendaAnalysisRequest(BaseModel):
    agenda_group: dict
    use_llm: bool = True


class DraftPipelineRequest(BaseModel):
    extracted: dict
    use_llm_for_slides: bool = True
    use_llm_for_analysis: bool = True


class UpdateExtractionRequest(BaseModel):
    id: int
    data: dict


class DeleteSlideRequest(BaseModel):
    id: int
    slideIndex: int


class ParseRequest(BaseModel):
    session_info: dict


class SlideUpdateRequest(BaseModel):
    titre: Optional[str] = None
    contenu: Optional[str] = None
    is_empty: Optional[bool] = None
    agenda_item_index: Optional[int] = None


class AgendaItemUpdateRequest(BaseModel):
    analysis: Optional[str] = None
    key_findings: Optional[list] = None
    identified_risks: Optional[list] = None
    suggested_actions: Optional[list] = None
    reformulated_notes: Optional[str] = None


class AgendaNotesReformulateRequest(BaseModel):
    notes: List[dict]
    agenda_title: str
    session_id: Optional[int] = None
    agenda_item_index: Optional[int] = None


class SessionStatusRequest(BaseModel):
    status: str


class SlideChartUpdateRequest(BaseModel):
    chart_data: Optional[dict] = None
    chart_title: Optional[str] = None
    chart_type: Optional[str] = None
    slide_id: Optional[int] = None


class SlideTableUpdateRequest(BaseModel):
    table_data: Optional[dict] = None


class PvDraftCreateRequest(BaseModel):
    session_id: int
    titre: str = "PROCÈS-VERBAL"
    date_reunion: Optional[str] = None
    introduction: Optional[str] = None
    comite_type: str = "Comité des Risques"
    participants: Optional[List[str]] = []
    points: Optional[List[dict]] = []
    plan_action: Optional[List[dict]] = []
    draft_content: Optional[str] = None


class MeetingNoteCreateRequest(BaseModel):
    session_id: int
    participant: str
    content: str
    agenda_item_index: Optional[int] = None
    type: Optional[str] = 'note'


class FinalPvSaveRequest(BaseModel):
    content: str


class SaveTranslationRequest(BaseModel):
    language: str
    content: str


class PVDocument(Base):
    __tablename__ = "pv_documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(Text)
    nb_slides = Column(Integer)
    nb_slides_vides = Column(Integer)
    nb_graphiques_natifs = Column(Integer)
    nb_images_ocr = Column(Integer)
    data = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    tableaux = Column(Text)


class NoteUpdateRequest(BaseModel):
    content: Optional[str] = None
    type: Optional[str] = None


class ReformulateRequest(BaseModel):
    content: str


class ReformulateResponse(BaseModel):
    administratif: str
    synthetique: str
    action: str
