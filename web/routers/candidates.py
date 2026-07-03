#!/usr/bin/env python3
"""Candidate generation routes."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from scripts.generate_candidates import run_generate_candidates
from web.services import get_submission
from web.templates_config import templates

router = APIRouter(prefix="/candidates", tags=["candidates"])

ROOT = Path(__file__).resolve().parents[2]


@router.post("/{submission_id}")
async def generate_candidates(submission_id: str) -> RedirectResponse:
    submission = get_submission(submission_id)
    if submission is None:
        return RedirectResponse(url="/submissions/", status_code=303)

    image_path = ROOT / "processed" / submission_id / "processed.png"
    brand = submission.get("preferred_brand", "MARD") or "MARD"

    if image_path.exists():
        run_generate_candidates(submission_id, image_path, brand)

    return RedirectResponse(url=f"/submissions/{submission_id}", status_code=303)
