#!/usr/bin/env python3
"""Image preprocessing routes."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from scripts.preprocess_image import run_preprocess_image
from web.services import get_submission
from web.templates_config import templates

router = APIRouter(prefix="/preprocess", tags=["preprocess"])

ROOT = Path(__file__).resolve().parents[2]


@router.post("/{submission_id}")
async def preprocess(
    submission_id: str,
    size: int = Form(1024),
    brightness: float = Form(1.04),
    contrast: float = Form(1.08),
) -> RedirectResponse:
    submission = get_submission(submission_id)
    if submission is None:
        return RedirectResponse(url="/submissions/", status_code=303)

    input_path = ROOT / "inputs" / submission_id / "original.jpg"
    output_path = ROOT / "processed" / submission_id / "processed.png"

    if input_path.exists():
        run_preprocess_image(input_path, output_path, size, brightness, contrast)

    return RedirectResponse(url=f"/submissions/{submission_id}", status_code=303)
