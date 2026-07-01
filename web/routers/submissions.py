#!/usr/bin/env python3
"""Submission management routes."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse

from web.services import (
    add_submission,
    ensure_dirs,
    get_candidate_metadata,
    get_delivery_metadata,
    get_submission,
    get_submissions,
    load_presets,
    next_submission_id,
    submission_status,
)

from web.templates_config import templates

router = APIRouter(prefix="/submissions", tags=["submissions"])

ROOT = Path(__file__).resolve().parents[2]


@router.get("/", response_class=HTMLResponse)
async def list_submissions(request: Request) -> HTMLResponse:
    submissions = get_submissions()
    for row in submissions:
        row["_status"] = submission_status(row["submission_id"])
    return templates.TemplateResponse(
        request, "index.html", {"submissions": submissions}
    )


@router.post("/")
async def create_submission(
    theme: str = Form(...),
    target_object: str = Form(...),
    preferred_brand: str = Form("MARD"),
    style_preference: str = Form("you_decide"),
    difficulty_preference: str = Form("you_decide"),
    color_preference: str = Form("balanced"),
    source_channel: str = Form("xiaohongshu"),
    notes: str = Form(""),
    image: UploadFile = File(...),
) -> RedirectResponse:
    submission_id = next_submission_id()
    ensure_dirs(submission_id)

    image_path = ROOT / "inputs" / submission_id / "original.jpg"
    with image_path.open("wb") as buffer:
        buffer.write(await image.read())

    submission = {
        "submission_id": submission_id,
        "user_nickname": "",
        "source_channel": source_channel,
        "theme": theme,
        "image_path": f"inputs/{submission_id}/original.jpg",
        "target_object": target_object,
        "style_preference": style_preference,
        "difficulty_preference": difficulty_preference,
        "color_preference": color_preference,
        "preferred_brand": preferred_brand,
        "allow_public_case": "masked",
        "notes": notes,
    }
    add_submission(submission)
    return RedirectResponse(url=f"/submissions/{submission_id}", status_code=303)


@router.get("/{submission_id}", response_class=HTMLResponse)
async def submission_detail(request: Request, submission_id: str) -> HTMLResponse:
    submission = get_submission(submission_id)
    if submission is None:
        return templates.TemplateResponse(
            request,
            "index.html",
            {"error": f"Submission {submission_id} not found."},
        )

    status = submission_status(submission_id)
    candidates = []
    for preset in load_presets():
        slug = preset["slug"]
        meta = get_candidate_metadata(submission_id, slug)
        preview_url = None
        if meta:
            preview_path = ROOT / "outputs" / submission_id / meta["expected_outputs"]["preview"]
            if preview_path.exists():
                preview_url = f"/outputs/{submission_id}/{meta['expected_outputs']['preview']}"
        candidates.append(
            {
                "slug": slug,
                "preset": preset,
                "metadata": meta,
                "preview_url": preview_url,
            }
        )

    delivery = get_delivery_metadata(submission_id)

    return templates.TemplateResponse(
        request,
        "submission.html",
        {
            "submission": submission,
            "status": status,
            "candidates": candidates,
            "delivery": delivery,
        },
    )

