from pptx import Presentation
from typing import Optional
from pptx.enum.shapes import MSO_SHAPE_TYPE

def parse_pptx(file_path: str) -> dict:
    """
    Parse un fichier .pptx et retourne un dict structuré.
    Gère : texte, tableaux, notes, slides vides, contenu mixte.
    """
    prs = Presentation(file_path)
    slides_data = []

    for idx, slide in enumerate(prs.slides):
        slide_dict = {
            "index": idx + 1,
            "titre": _extract_title(slide),
            "contenu": _extract_content(slide),
            "tableaux": _extract_tables(slide),
            "notes": _extract_notes(slide),
            "est_vide": False
        }

        # Marquer les slides sans contenu exploitable
        has_content = (
            slide_dict["titre"] or
            slide_dict["contenu"] or
            slide_dict["tableaux"] or
            slide_dict["notes"]
        )
        slide_dict["est_vide"] = not has_content
        slides_data.append(slide_dict)

    return {
        "nb_slides": len(slides_data),
        "nb_slides_vides": sum(1 for s in slides_data if s["est_vide"]),
        "slides": slides_data
    }

def _extract_title(slide) -> Optional[str]:
    """Récupère le titre depuis le placeholder de titre."""
    title_shape = slide.shapes.title
    if title_shape and title_shape.has_text_frame:
        text = title_shape.text_frame.text.strip()
        return text if text else None
    return None

def _extract_content(slide) -> list[str]:
    """
    Extrait tous les blocs de texte hors titre et hors tableaux.
    Préserve l'ordre visuel (approximatif via top/left).
    """
    blocks = []
    shapes_sorted = sorted(
        slide.shapes,
        key=lambda s: (s.top if s.top is not None else 0,
                       s.left if s.left is not None else 0)
    )

    for shape in shapes_sorted:
        # Ignorer le titre (déjà extrait)
        if shape == slide.shapes.title:
            continue
        # Ignorer les tableaux (traités séparément)
        if shape.has_table:
            continue
        # Traiter les zones de texte
        if shape.has_text_frame:
            for para in shape.text_frame.paragraphs:
                text = para.text.strip()
                if text:
                    blocks.append(text)

    return blocks

def _extract_tables(slide) -> list[dict]:
    return _extract_tables_from_shapes(slide.shapes)

def _extract_notes(slide) -> Optional[str]:
    """Récupère les notes du présentateur."""
    if slide.has_notes_slide:
        notes_tf = slide.notes_slide.notes_text_frame
        if notes_tf:
            text = notes_tf.text.strip()
            # Ignorer le placeholder vide par défaut de PowerPoint
            if text and text.lower() not in ("", "click to add notes"):
                return text
    return None



def _extract_tables_from_shapes(shapes):
    tables = []

    for shape in shapes:
        # Cas normal
        if shape.has_table:
            table = shape.table
            rows_data = []

            for row in table.rows:
                row_cells = [cell.text.strip() for cell in row.cells]
                rows_data.append(row_cells)

            if rows_data:
                tables.append({
                    "nb_lignes": len(rows_data),
                    "nb_colonnes": len(rows_data[0]),
                    "lignes": rows_data
                })

        elif shape.shape_type == MSO_SHAPE_TYPE.GROUP:
            tables.extend(_extract_tables_from_shapes(shape.shapes))

    return tables
