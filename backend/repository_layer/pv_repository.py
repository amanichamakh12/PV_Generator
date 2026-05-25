"""Repository helpers for PV document persistence."""

import json

from backend.db_connection import SessionLocal
from backend.models_layer.models import PVDocument


def create_pv_document(filename: str, result: dict) -> int:
    """Create a PV document record from parsed PPTX result and return its ID."""
    db = SessionLocal()
    try:
        pv_document = PVDocument(
            filename=filename,
            nb_slides=result.get("nb_slides", 0),
            nb_slides_vides=result.get("nb_slides_vides", 0),
            nb_graphiques_natifs=result.get("nb_graphiques_natifs", 0),
            nb_images_ocr=result.get("nb_images_ocr", 0),
            tableaux=json.dumps(result.get("tableaux", []), ensure_ascii=False),
            data=json.dumps(result["slides"], ensure_ascii=False),
        )

        db.add(pv_document)
        db.commit()
        db.refresh(pv_document)
        return pv_document.id
    except Exception as exc:
        db.rollback()
        print("ERREUR DB:", exc)
        raise
    finally:
        db.close()


def update_extraction_data(document_id: int, data: dict) -> bool:
    """Update extracted JSON payload for a document ID."""
    db = SessionLocal()
    try:
        pv_document = db.query(PVDocument).filter(PVDocument.id == document_id).first()
        if not pv_document:
            return False

        pv_document.data = json.dumps(data, ensure_ascii=False)
        db.commit()
        return True
    except Exception as exc:
        db.rollback()
        print("ERREUR UPDATE:", exc)
        raise
    finally:
        db.close()


def delete_slide_from_document(document_id: int, slide_index: int) -> dict | None:
    """Delete one slide from persisted extracted data and return updated payload."""
    db = SessionLocal()
    try:
        pv_document = db.query(PVDocument).filter(PVDocument.id == document_id).first()
        if not pv_document:
            return None

        data = json.loads(pv_document.data)
        if "slides" in data:
            data["slides"] = [s for s in data["slides"] if s.get("index") != slide_index]

        pv_document.data = json.dumps(data, ensure_ascii=False)
        db.commit()
        return data
    except Exception as exc:
        db.rollback()
        print("ERREUR DELETE:", exc)
        raise
    finally:
        db.close()
