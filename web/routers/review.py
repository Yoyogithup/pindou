#!/usr/bin/env python3
"""Customer review page routes."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from web.services import (
    add_feedback,
    get_candidate_metadata,
    get_submission,
    load_presets,
)

from web.templates_config import templates

router = APIRouter(prefix="/review", tags=["review"])

ROOT = Path(__file__).resolve().parents[2]


@router.get("/{submission_id}", response_class=HTMLResponse)
async def review_page(request: Request, submission_id: str) -> HTMLResponse:
    submission = get_submission(submission_id)
    if submission is None:
        return templates.TemplateResponse(
            request,
            "index.html",
            {"error": f"Submission {submission_id} not found."},
        )

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

    return templates.TemplateResponse(
        request,
        "review.html",
        {
            "submission": submission,
            "candidates": candidates,
        },
    )


@router.post("/{submission_id}")
async def submit_review(
    submission_id: str,
    selected_candidate: str = Form(...),
    user_satisfaction: str = Form(""),
    looks_like_original: str = Form(""),
    will_make_it: str = Form(""),
    main_problem: str = Form(""),
    requested_revision: str = Form(""),
    willing_to_pay: str = Form(""),
    public_case_permission: str = Form(""),
    notes: str = Form(""),
) -> RedirectResponse:
    feedback = {
        "submission_id": submission_id,
        "user_satisfaction": user_satisfaction,
        "looks_like_original": looks_like_original,
        "will_make_it": will_make_it,
        "main_problem": main_problem,
        "requested_revision": requested_revision,
        "willing_to_pay": willing_to_pay,
        "public_case_permission": public_case_permission,
        "notes": notes,
    }
    add_feedback(feedback)
    return RedirectResponse(url=f"/review/{submission_id}?submitted=1", status_code=303)
