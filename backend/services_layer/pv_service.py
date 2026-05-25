"""Compatibility facade for service functions.

This module keeps stable imports while implementation is split by domain.
"""

from backend.services_layer.document_service import build_health_status_service, export_docx_service
from backend.services_layer.draft_service import (
    analyze_agenda_full_service,
    analyze_agenda_service,
    build_pipeline_docx_service,
    generate_draft_service,
    generate_pv_from_pptx_service,
    generate_slide_paragraph_service,
)
from backend.services_layer.merge_service import merge_notes_service, merge_notes_with_guard_service, merge_service
from backend.services_layer.parsing_service import parse_pptx_file, remove_temp_file, validate_uploaded_pptx
from backend.services_layer.translation_service import translate_service

__all__ = [
    "analyze_agenda_full_service",
    "analyze_agenda_service",
    "build_health_status_service",
    "build_pipeline_docx_service",
    "export_docx_service",
    "generate_draft_service",
    "generate_pv_from_pptx_service",
    "generate_slide_paragraph_service",
    "merge_notes_service",
    "merge_notes_with_guard_service",
    "merge_service",
    "parse_pptx_file",
    "remove_temp_file",
    "translate_service",
    "validate_uploaded_pptx",
]
