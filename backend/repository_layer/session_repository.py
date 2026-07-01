from typing import List, Optional

from sqlalchemy.orm import Session

from models_layer.orm_models import PvSession
from repository_layer.base_repository import BaseRepository


class SessionRepository(BaseRepository[PvSession]):
    def __init__(self) -> None:
        super().__init__(PvSession)

    def get_by_status(self, db: Session, status: str) -> List[PvSession]:
        return (
            db.query(PvSession)
            .filter(PvSession.status == status)
            .order_by(PvSession.created_at.desc())
            .all()
        )

    def update_status(self, db: Session, session_id: int, status: str) -> Optional[PvSession]:
        return self.update(db, session_id, status=status)


session_repo = SessionRepository()
