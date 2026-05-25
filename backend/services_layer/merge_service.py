"""Merge-related service functions."""



from backend.Pv_Generator import merge_notes_with_pv
from backend.generate_pv_draft import OLLAMA_MODEL


def merge_notes_with_guard_service(pv_draft: dict, notes: list) -> dict:
    if "content" in pv_draft and "points" not in pv_draft:
        print("⚠️ pv_draft reçu en markdown string — merge impossible")
        print("   Clés reçues :", list(pv_draft.keys()))
        return {
            "success": False,
            "error": "pv_draft doit contenir 'points', pas 'content'. Le frontend envoie du markdown au lieu du JSON structuré.",
            "pv": pv_draft,
        }

    merged = merge_notes_with_pv(OLLAMA_MODEL, pv_draft, notes)
    return {"success": True, "pv": merged}


def merge_notes_service(req_notes: list, pv_draft: dict) -> dict:
    notes = [{"participant": n.participant, "content": n.content} for n in req_notes]
    merged = merge_notes_with_pv(OLLAMA_MODEL, pv_draft, notes)
    return {"success": True, "pv": merged}


def merge_service(req_notes: list, pv_draft: dict) -> dict:
    notes = [{"participant": n.participant, "content": n.content} for n in req_notes]
    merged = merge_notes_with_pv(OLLAMA_MODEL, pv_draft, notes)
    return {
        "success": True,
        "pv": merged,
    }
