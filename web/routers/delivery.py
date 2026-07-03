#!/usr/bin/env python3
"""Delivery package routes."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from scripts.package_delivery import run_package_delivery
from web.services import get_submission
from web.templates_config import templates

router = APIRouter(prefix="/delivery", tags=["delivery"])

ROOT = Path(__file__).resolve().parents[2]


@router.post("/{submission_id}")
async def create_delivery(
    submission_id: str,
    selected_candidate: str = Form(...),
    theme: str = Form(""),
    target_object: str = Form(""),
) -> RedirectResponse:
    submission = get_submission(submission_id)
    if submission is None:
        return RedirectResponse(url="/submissions/", status_code=303)

    theme = theme or submission.get("theme", "待补充")
    target_object = target_object or submission.get("target_object", "冰箱贴 / 挂件 / 摆件")

    run_package_delivery(
        submission_id=submission_id,
        selected_candidate=selected_candidate,
        theme=theme,
        target_object=target_object,
    )

    return RedirectResponse(url=f"/submissions/{submission_id}", status_code=303)
