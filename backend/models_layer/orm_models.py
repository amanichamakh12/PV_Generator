from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float,
    ForeignKey, Integer, JSON, String, Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core_layer.database import Base


class PvSession(Base):
    __tablename__ = "pv_sessions"

    id = Column(Integer, primary_key=True, index=True)
    
    filename = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="uploaded")
    nb_slides = Column(Integer, default=0)
    nb_slides_vides = Column(Integer, default=0)
    nb_graphiques_natifs = Column(Integer, default=0)
    nb_images_ocr = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    slides = relationship("Slide", back_populates="session", cascade="all, delete-orphan")
    agenda_items = relationship("AgendaItem", back_populates="session", cascade="all, delete-orphan")
    participants = relationship("Participant", back_populates="session", cascade="all, delete-orphan")
    
    meeting_notes = relationship("MeetingNote", back_populates="session", cascade="all, delete-orphan")
    pv_drafts = relationship("PvDraft", back_populates="session", cascade="all, delete-orphan")


class Slide(Base):
    __tablename__ = "slides"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("pv_sessions.id", ondelete="CASCADE"), nullable=False)
    slide_number = Column(Integer, nullable=False)
    titre = Column(Text)
    contenu = Column(Text)
    is_empty = Column(Boolean, default=False)
    has_native_chart = Column(Boolean, default=False)
    is_ocr_candidate = Column(Boolean, default=False)
    agenda_item_index = Column(Integer)

    session = relationship("PvSession", back_populates="slides")
    charts = relationship("SlideChart", back_populates="slide", cascade="all, delete-orphan")
    tables = relationship("SlideTable", back_populates="slide", cascade="all, delete-orphan")


class SlideChart(Base):
    __tablename__ = "slide_charts"

    id = Column(Integer, primary_key=True, index=True)
    slide_id = Column(Integer, ForeignKey("slides.id", ondelete="CASCADE"), nullable=False)
    chart_type = Column(String(50))
    chart_title = Column(Text)
    chart_data = Column(JSON)
    confidence_score = Column(Float)
    extraction_method = Column(String(50))
    image_path = Column(Text)

    slide = relationship("Slide", back_populates="charts")


class SlideTable(Base):
    __tablename__ = "slide_tables"

    id = Column(Integer, primary_key=True, index=True)
    slide_id = Column(Integer, ForeignKey("slides.id", ondelete="CASCADE"), nullable=False)
    table_data = Column(JSON)
    position_index = Column(Integer, default=0)

    slide = relationship("Slide", back_populates="tables")


class AgendaItem(Base):
    __tablename__ = "agenda_items"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("pv_sessions.id", ondelete="CASCADE"), nullable=False)
    ordre = Column(Integer)
    titre = Column(Text)
    analysis = Column(Text)
    key_findings = Column(JSON)
    identified_risks = Column(JSON)
    suggested_actions = Column(JSON)
    reformulated_notes = Column(Text)

    session = relationship("PvSession", back_populates="agenda_items")
    pv_points = relationship("PvPoint", back_populates="agenda_item")


class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("pv_sessions.id", ondelete="CASCADE"), nullable=False)
    nom = Column(String(200))
    role = Column(String(100))
    presence = Column(String(20), default="present")

    session = relationship("PvSession", back_populates="participants")


class MeetingNote(Base):
    __tablename__ = "meeting_notes"

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey('pv_sessions.id', ondelete="CASCADE"), nullable=False)
    agenda_item_index = Column(Integer)
    created_at = Column(DateTime(timezone=True))
    recommandation = Column(String)  
    type = Column(String)
    participant = Column(String)
    content = Column(Text)  
    session = relationship('PvSession', back_populates='meeting_notes')  # ← ajouter

class PvDraft(Base):
    __tablename__ = "pv_drafts"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("pv_sessions.id", ondelete="CASCADE"), nullable=False)
    titre = Column(Text)
    date_reunion = Column(Date)
    introduction = Column(Text)
    comite_type = Column(String(100))
    language = Column(String(10), default="fr")
    version = Column(Integer, default=1)
    is_final = Column(Boolean, default=False)
    draft_content = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("PvSession", back_populates="pv_drafts")
    pv_points = relationship("PvPoint", back_populates="draft", cascade="all, delete-orphan")
    translations = relationship("Translation", back_populates="draft", cascade="all, delete-orphan")
    exports = relationship("Export", back_populates="draft", cascade="all, delete-orphan")


class PvPoint(Base):
    __tablename__ = "pv_points"

    id = Column(Integer, primary_key=True, index=True)
    draft_id = Column(Integer, ForeignKey("pv_drafts.id", ondelete="CASCADE"), nullable=False)
    agenda_item_id = Column(Integer, ForeignKey("agenda_items.id", ondelete="SET NULL"), nullable=True)
    titre = Column(Text)
    discussion = Column(Text)
    conclusion = Column(Text)
    remarques = Column(Text)
    ordre = Column(Integer)

    draft = relationship("PvDraft", back_populates="pv_points")
    agenda_item = relationship("AgendaItem", back_populates="pv_points")
    decisions = relationship("Decision", back_populates="point", cascade="all, delete-orphan")
    action_items = relationship("ActionItem", back_populates="point", cascade="all, delete-orphan")


class Decision(Base):
    __tablename__ = "decisions"

    id = Column(Integer, primary_key=True, index=True)
    point_id = Column(Integer, ForeignKey("pv_points.id", ondelete="CASCADE"), nullable=False)
    contenu = Column(Text)
    responsable = Column(String(200))
    echeance = Column(Date)

    point = relationship("PvPoint", back_populates="decisions")


class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(Integer, primary_key=True, index=True)
    point_id = Column(Integer, ForeignKey("pv_points.id", ondelete="CASCADE"), nullable=False)
    action = Column(Text)
    responsable = Column(String(200))
    echeance = Column(Date)
    statut = Column(String(50), default="pending")

    point = relationship("PvPoint", back_populates="action_items")


class Translation(Base):
    __tablename__ = "translations"

    id = Column(Integer, primary_key=True, index=True)
    draft_id = Column(Integer, ForeignKey("pv_drafts.id", ondelete="CASCADE"), nullable=False)
    target_language = Column(String(10))
    translated_content = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    draft = relationship("PvDraft", back_populates="translations")


class Export(Base):
    __tablename__ = "exports"

    id = Column(Integer, primary_key=True, index=True)
    draft_id = Column(Integer, ForeignKey("pv_drafts.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(Text)
    language = Column(String(10))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    draft = relationship("PvDraft", back_populates="exports")
