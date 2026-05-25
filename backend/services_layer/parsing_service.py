"""Parsing and file-handling service functions."""

import os

from fastapi import HTTPException

from backend.pptx_parser_chartLlama import parse_pptx


MAX_SIZE_MB = 20
SUPPORTED_PPT_MIME_TYPES = (
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
)


def validate_uploaded_pptx(content_type: str | None, size_bytes: int) -> None:
    if content_type not in SUPPORTED_PPT_MIME_TYPES:
        raise HTTPException(status_code=415, detail="Format non supporté")

    if size_bytes > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux")


def parse_pptx_file(tmp_path: str) -> dict:
    return parse_pptx(tmp_path)


def remove_temp_file(path: str) -> None:
    if path and os.path.exists(path):
        os.unlink(path)
