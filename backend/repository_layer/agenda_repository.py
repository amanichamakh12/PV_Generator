from typing import List, Optional

from sqlalchemy.orm import Session

from models_layer.orm_models import AgendaItem
from repository_layer.base_repository import BaseRepository


class AgendaRepository(BaseRepository[AgendaItem]):
    def __init__(self) -> None:
        super().__init__(AgendaItem)

    def get_by_session(self, db: Session, session_id: int) -> List[AgendaItem]:
        return (
            db.query(AgendaItem)
            .filter(AgendaItem.session_id == session_id)
            .order_by(AgendaItem.ordre)
            .all()
        )

    def get_by_ordre(self, db: Session, session_id: int, ordre: int) -> Optional[AgendaItem]:
        return (
            db.query(AgendaItem)
            .filter(AgendaItem.session_id == session_id, AgendaItem.ordre == ordre)
            .first()
        )

    def update_analysis(
        self,
        db: Session,
        agenda_id: int,
        analysis: str,
        key_findings: list,
        identified_risks: list,
        suggested_actions: list,
    ) -> Optional[AgendaItem]:
        return self.update(
            db,
            agenda_id,
            analysis=analysis,
            key_findings=key_findings,
            identified_risks=identified_risks,
            suggested_actions=suggested_actions,
        )


agenda_repo = AgendaRepository()
