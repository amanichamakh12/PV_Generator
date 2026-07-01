from typing import List, Optional

from sqlalchemy.orm import Session

from models_layer.orm_models import Slide, SlideChart, SlideTable
from repository_layer.base_repository import BaseRepository


class SlideRepository(BaseRepository[Slide]):
    def __init__(self) -> None:
        super().__init__(Slide)

    def get_by_session(self, db: Session, session_id: int) -> List[Slide]:
        return (
            db.query(Slide)
            .filter(Slide.session_id == session_id)
            .order_by(Slide.slide_number)
            .all()
        )

    def get_non_empty(self, db: Session, session_id: int) -> List[Slide]:
        return (
            db.query(Slide)
            .filter(Slide.session_id == session_id, Slide.is_empty == False)  # noqa: E712
            .order_by(Slide.slide_number)
            .all()
        )

    def get_by_session_and_number(
        self, db: Session, session_id: int, slide_number: int
    ) -> Optional[Slide]:
        return (
            db.query(Slide)
            .filter(Slide.session_id == session_id, Slide.slide_number == slide_number)
            .first()
        )

    def delete_by_session(self, db: Session, session_id: int) -> int:
        count = db.query(Slide).filter(Slide.session_id == session_id).delete()
        db.commit()
        return count


class SlideChartRepository(BaseRepository[SlideChart]):
    def __init__(self) -> None:
        super().__init__(SlideChart)

    def get_by_slide(self, db: Session, slide_id: int) -> List[SlideChart]:
        return db.query(SlideChart).filter(SlideChart.slide_id == slide_id).all()


class SlideTableRepository(BaseRepository[SlideTable]):
    def __init__(self) -> None:
        super().__init__(SlideTable)

    def get_by_slide(self, db: Session, slide_id: int) -> List[SlideTable]:
        return (
            db.query(SlideTable)
            .filter(SlideTable.slide_id == slide_id)
            .order_by(SlideTable.position_index)
            .all()
        )


slide_repo = SlideRepository()
slide_chart_repo = SlideChartRepository()
slide_table_repo = SlideTableRepository()
