from typing import List

from sqlalchemy.orm import Session

from models_layer.orm_models import MeetingNote, Participant
from repository_layer.base_repository import BaseRepository


class MeetingNoteRepository(BaseRepository[MeetingNote]):
    def __init__(self) -> None:
        super().__init__(MeetingNote)

    def get_by_session(self, db: Session, session_id: int) -> List[MeetingNote]:
        return (
            db.query(MeetingNote)
            .filter(MeetingNote.session_id == session_id)
            .order_by(MeetingNote.created_at)
            .all()
        )

    def get_by_agenda_item(
        self, db: Session, session_id: int, agenda_item_index: int
    ) -> List[MeetingNote]:
        return (
            db.query(MeetingNote)
            .filter(
                MeetingNote.session_id == session_id,
                MeetingNote.agenda_item_index == agenda_item_index,
            )
            .order_by(MeetingNote.created_at)
            .all()
        )


class ParticipantRepository(BaseRepository[Participant]):
    def __init__(self) -> None:
        super().__init__(Participant)

    def get_by_session(self, db: Session, session_id: int) -> List[Participant]:
        return db.query(Participant).filter(Participant.session_id == session_id).all()

    def get_present(self, db: Session, session_id: int) -> List[Participant]:
        return (
            db.query(Participant)
            .filter(
                Participant.session_id == session_id,
                Participant.presence == "present",
            )
            .all()
        )


note_repo = MeetingNoteRepository()
participant_repo = ParticipantRepository()
