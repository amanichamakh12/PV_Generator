"""Pydantic request models and SQLAlchemy ORM models for PV documents."""

from pydantic import BaseModel
from sqlalchemy import Column, Integer, DateTime, Text
from sqlalchemy.sql import func
from backend.db_connection import Base
from pydantic import BaseModel
from typing import List

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
    ordre_du_jour: str | None = None  # ← add this

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
    slides: list[dict]  # slides bruts (input étape 2)
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


class PVDocument(Base):
    __tablename__ = "pv_documents"

    id = Column(Integer, primary_key=True, index=True)

    filename = Column(Text)

    nb_slides = Column(Integer)
    nb_slides_vides = Column(Integer)
    nb_graphiques_natifs = Column(Integer)
    nb_images_ocr = Column(Integer)

    data = Column(Text)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )
    tableaux = Column(Text)


class ReformulateRequest(BaseModel):
    content: str


class ReformulateResponse(BaseModel):
    text: str

