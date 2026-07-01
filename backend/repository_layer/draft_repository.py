from typing import List, Optional

from sqlalchemy.orm import Session

from models_layer.orm_models import ActionItem, Decision, Export, Participant, PvDraft, PvPoint, Translation
from repository_layer.base_repository import BaseRepository


class PvDraftRepository(BaseRepository[PvDraft]):
    def __init__(self) -> None:
        super().__init__(PvDraft)

    def get_by_session(self, db: Session, session_id: int) -> List[PvDraft]:
        return (
            db.query(PvDraft)
            .filter(PvDraft.session_id == session_id)
            .order_by(PvDraft.version.desc())
            .all()
        )

    def get_final(self, db: Session, session_id: int) -> Optional[PvDraft]:
        return (
            db.query(PvDraft)
            .filter(PvDraft.session_id == session_id, PvDraft.is_final == True)  # noqa: E712
            .first()
        )

    def get_next_version(self, db: Session, session_id: int) -> int:
        latest = (
            db.query(PvDraft.version)
            .filter(PvDraft.session_id == session_id)
            .order_by(PvDraft.version.desc())
            .first()
        )
        return (latest[0] + 1) if latest else 1

    def mark_as_final(self, db: Session, draft_id: int) -> Optional[PvDraft]:
        return self.update(db, draft_id, is_final=True)


class PvPointRepository(BaseRepository[PvPoint]):
    def __init__(self) -> None:
        super().__init__(PvPoint)

    def get_by_draft(self, db: Session, draft_id: int) -> List[PvPoint]:
        return (
            db.query(PvPoint)
            .filter(PvPoint.draft_id == draft_id)
            .order_by(PvPoint.ordre)
            .all()
        )

    def update_remarques(self, db: Session, point_id: int, remarques: str) -> Optional[PvPoint]:
        return self.update(db, point_id, remarques=remarques)


class DecisionRepository(BaseRepository[Decision]):
    def __init__(self) -> None:
        super().__init__(Decision)

    def get_by_point(self, db: Session, point_id: int) -> List[Decision]:
        return db.query(Decision).filter(Decision.point_id == point_id).all()


class ActionItemRepository(BaseRepository[ActionItem]):
    def __init__(self) -> None:
        super().__init__(ActionItem)

    def get_by_point(self, db: Session, point_id: int) -> List[ActionItem]:
        return db.query(ActionItem).filter(ActionItem.point_id == point_id).all()

    def get_pending(self, db: Session) -> List[ActionItem]:
        return (
            db.query(ActionItem)
            .filter(ActionItem.statut == "pending")
            .order_by(ActionItem.echeance)
            .all()
        )

    def update_statut(self, db: Session, action_id: int, statut: str) -> Optional[ActionItem]:
        return self.update(db, action_id, statut=statut)


class TranslationRepository(BaseRepository[Translation]):
    def __init__(self) -> None:
        super().__init__(Translation)

    def get_by_draft(self, db: Session, draft_id: int) -> List[Translation]:
        return db.query(Translation).filter(Translation.draft_id == draft_id).all()

    def get_by_draft_and_language(
        self, db: Session, draft_id: int, language: str
    ) -> Optional[Translation]:
        return (
            db.query(Translation)
            .filter(
                Translation.draft_id == draft_id,
                Translation.target_language == language,
            )
            .first()
        )


class ExportRepository(BaseRepository[Export]):
    def __init__(self) -> None:
        super().__init__(Export)

    def get_by_draft(self, db: Session, draft_id: int) -> List[Export]:
        return (
            db.query(Export)
            .filter(Export.draft_id == draft_id)
            .order_by(Export.created_at.desc())
            .all()
        )


class ParticipantRepository(BaseRepository[Participant]):
    def __init__(self) -> None:
        super().__init__(Participant)

    def get_by_session(self, db: Session, session_id: int) -> List[Participant]:
        return db.query(Participant).filter(Participant.session_id == session_id).all()

    def delete_by_session(self, db: Session, session_id: int) -> int:
        count = db.query(Participant).filter(Participant.session_id == session_id).delete()
        db.commit()
        return count


draft_repo = PvDraftRepository()
pv_point_repo = PvPointRepository()
decision_repo = DecisionRepository()
action_item_repo = ActionItemRepository()
translation_repo = TranslationRepository()
export_repo = ExportRepository()
participant_repo = ParticipantRepository()
