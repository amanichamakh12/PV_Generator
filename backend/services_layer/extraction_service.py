"""
Service de persistance des données extraites du PPTX.
Mappe le résultat brut du parser vers :
  pv_sessions -> slides -> slide_charts / slide_tables
                        -> agenda_items
"""
import logging

from sqlalchemy.orm import Session

from core_layer.database import SessionLocal
from repository_layer.agenda_repository import agenda_repo
from repository_layer.slide_repository import slide_chart_repo, slide_repo, slide_table_repo

logger = logging.getLogger(__name__)


def persist_image_chart(
    session_id: int,
    slide_number: int,
    chart_result: dict,
    extraction_method: str = "smolvlm",
) -> int | None:
    """
    Persiste un graphique analysé par un modèle vision (SmolVLM, Ollama, Groq)
    dans la table slide_charts.

    chart_result attendu :
        {"type": "bar|pie|line|...", "titre": "...", "data": [{"category": ..., "valeur": ...}]}

    Retourne l'id du SlideChart créé, ou None si la slide est introuvable.
    """
    db = SessionLocal()
    try:
        slide = slide_repo.get_by_session_and_number(db, session_id, slide_number)
        if not slide:
            logger.warning(
                "persist_image_chart : slide introuvable session_id=%s slide_number=%s",
                session_id,
                slide_number,
            )
            return None

        chart = slide_chart_repo.create(
            db,
            slide_id=slide.id,
            chart_type=chart_result.get("type"),
            chart_title=chart_result.get("titre"),
            chart_data=chart_result,
            confidence_score=chart_result.get("confidence", 0.8),
            extraction_method=extraction_method,
            image_path=None,
        )

        slide_repo.update(db, slide.id, is_ocr_candidate=True)

        logger.info(
            "Chart OCR persisté : session=%s slide=%s method=%s type=%s chart_id=%s",
            session_id,
            slide_number,
            extraction_method,
            chart_result.get("type"),
            chart.id,
        )
        return chart.id

    except Exception as exc:
        db.rollback()
        logger.error("Erreur persist_image_chart: %s", exc, exc_info=True)
        raise
    finally:
        db.close()


def _build_agenda_map(db: Session, session_id: int, slides_data: list) -> dict:
    """
    Crée un AgendaItem par point d'ordre du jour unique (dans l'ordre d'apparition).
    Retourne un mapping { texte_odj -> agenda_item.id } pour lier les slides.
    """
    seen: dict = {}
    ordre = 1

    for slide in slides_data:
        odj = slide.get("ordre du jour")
        if not odj or odj in seen:
            continue

        item = agenda_repo.create(
            db,
            session_id=session_id,
            ordre=ordre,
            titre=odj,
        )
        seen[odj] = item.id
        ordre += 1
        logger.debug("AgendaItem créé : ordre=%d titre='%s' id=%d", ordre - 1, odj, item.id)

    logger.info("Session %s — %d agenda_items créés.", session_id, len(seen))
    return seen


def persist_parsed_slides(db: Session, session_id: int, result: dict) -> int:
    """
    Persiste l'intégralité des données extraites du PPTX :
      - agenda_items  (points de l'ordre du jour)
      - slides        (une ligne par diapositive)
      - slide_charts  (graphiques natifs PowerPoint)
      - slide_tables  (tableaux)

    Retourne le nombre de slides insérées.
    """
    slides_data = result.get("slides", [])

    # 1. Agenda items
    agenda_map = _build_agenda_map(db, session_id, slides_data)

    # 2. Slides + charts + tables
    inserted = 0
    for slide_data in slides_data:
        contenu_raw = slide_data.get("contenu", [])
        contenu_text = (
            "\n".join(contenu_raw)
            if isinstance(contenu_raw, list)
            else str(contenu_raw or "")
        )

        odj = slide_data.get("ordre du jour")
        graphiques = slide_data.get("graphiques", [])
        images = slide_data.get("images", [])

        slide = slide_repo.create(
            db,
            session_id=session_id,
            slide_number=slide_data.get("index", 0),
            titre=slide_data.get("titre"),
            contenu=contenu_text,
            is_empty=slide_data.get("est_vide", False),
            has_native_chart=len(graphiques) > 0,
            is_ocr_candidate=len(images) > 0,
            agenda_item_index=agenda_map.get(odj) if odj else None,
        )

        # Injecte les ids DB dans le dict de la slide — récupérables côté frontend
        slide_data["db_id"] = slide.id
        slide_data["agenda_item_db_id"] = agenda_map.get(odj) if odj else None

        for chart_data in graphiques:
            chart = slide_chart_repo.create(
                db,
                slide_id=slide.id,
                chart_type=chart_data.get("type"),
                chart_title=chart_data.get("titre"),
                chart_data=chart_data,
                confidence_score=1.0,
                extraction_method="native",
                image_path=None,
            )
            chart_data["db_id"] = chart.id

        for pos, table_data in enumerate(slide_data.get("tableaux", [])):
            table = slide_table_repo.create(
                db,
                slide_id=slide.id,
                table_data=table_data,
                position_index=pos,
            )
            table_data["db_id"] = table.id

        inserted += 1
        logger.debug("Slide %s persistée (id=%s)", slide_data.get("index"), slide.id)

    logger.info(
        "Session %s — %d slides, %d graphiques natifs persistés.",
        session_id,
        inserted,
        result.get("nb_graphiques_natifs", 0),
    )
    return inserted
