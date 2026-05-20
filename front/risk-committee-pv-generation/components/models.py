from openai import BaseModel


class NoteItem(BaseModel):
    participant: str
    content: str
    ordre_du_jour: str