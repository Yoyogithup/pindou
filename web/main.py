#!/usr/bin/env python3
"""FastAPI web interface for the pindou MVP workflow."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from web.routers import candidates, delivery, preprocess, review, submissions
from web.templates_config import templates

ROOT = Path(__file__).resolve().parents[1]

app = FastAPI(title="拼豆图纸 MVP", version="0.1.0")

app.mount("/static", StaticFiles(directory=ROOT / "web" / "static"), name="static")
app.mount("/inputs", StaticFiles(directory=ROOT / "inputs"), name="inputs")
app.mount("/processed", StaticFiles(directory=ROOT / "processed"), name="processed")
app.mount("/outputs", StaticFiles(directory=ROOT / "outputs"), name="outputs")

app.include_router(submissions.router)
app.include_router(preprocess.router)
app.include_router(candidates.router)
app.include_router(delivery.router)
app.include_router(review.router)


@app.get("/", response_class=HTMLResponse)
async def index(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(request, "index.html", {})
