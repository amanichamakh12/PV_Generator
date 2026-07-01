from contextlib import contextmanager
from typing import Generic, List, Optional, Type, TypeVar

from sqlalchemy.orm import Session

from core_layer.database import SessionLocal

ModelType = TypeVar("ModelType")


class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType]) -> None:
        self.model = model

    @contextmanager
    def session_scope(self):
        """Context manager autonome — utile hors FastAPI (scripts, tests)."""
        db = SessionLocal()
        try:
            yield db
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def create(self, db: Session, **kwargs) -> ModelType:
        obj = self.model(**kwargs)
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    def get_by_id(self, db: Session, id: int) -> Optional[ModelType]:
        return db.query(self.model).filter(self.model.id == id).first()

    def list(self, db: Session, skip: int = 0, limit: int = 100) -> List[ModelType]:
        return db.query(self.model).offset(skip).limit(limit).all()

    def update(self, db: Session, id: int, **kwargs) -> Optional[ModelType]:
        obj = self.get_by_id(db, id)
        if not obj:
            return None
        for key, value in kwargs.items():
            setattr(obj, key, value)
        db.commit()
        db.refresh(obj)
        return obj

    def delete(self, db: Session, id: int) -> bool:
        obj = self.get_by_id(db, id)
        if not obj:
            return False
        db.delete(obj)
        db.commit()
        return True
