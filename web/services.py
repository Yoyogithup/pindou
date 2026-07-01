#!/usr/bin/env python3
"""Shared data services for the web interface."""

from __future__ import annotations

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]

SUBMISSIONS_CSV = ROOT / "data" / "submissions.csv"
FEEDBACK_CSV = ROOT / "data" / "feedback.csv"
PRESETS_PATH = ROOT / "data" / "presets.json"


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        return list(reader)


def write_csv(path: Path, rows: list[dict[str, str]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def get_submissions() -> list[dict[str, str]]:
    return read_csv(SUBMISSIONS_CSV)


def get_submission(submission_id: str) -> dict[str, str] | None:
    for row in get_submissions():
        if row["submission_id"] == submission_id:
            return row
    return None


def add_submission(submission: dict[str, str]) -> dict[str, str]:
    submissions = get_submissions()
    if not submissions:
        fieldnames = list(submission.keys())
    else:
        fieldnames = list(submissions[0].keys())

    submissions.append(submission)
    write_csv(SUBMISSIONS_CSV, submissions, fieldnames)
    return submission


def next_submission_id() -> str:
    submissions = get_submissions()
    if not submissions:
        return "S0001"
    max_num = 0
    for row in submissions:
        sid = row.get("submission_id", "")
        if sid.startswith("S") and sid[1:].isdigit():
            max_num = max(max_num, int(sid[1:]))
    return f"S{max_num + 1:04d}"


def get_feedback() -> list[dict[str, str]]:
    return read_csv(FEEDBACK_CSV)


def add_feedback(feedback: dict[str, str]) -> dict[str, str]:
    feedback_rows = get_feedback()
    if not feedback_rows:
        fieldnames = list(feedback.keys())
    else:
        fieldnames = list(feedback_rows[0].keys())

    feedback_rows.append(feedback)
    write_csv(FEEDBACK_CSV, feedback_rows, fieldnames)
    return feedback


def load_presets() -> list[dict[str, Any]]:
    with PRESETS_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def get_candidate_metadata(submission_id: str, slug: str) -> dict[str, Any] | None:
    path = ROOT / "outputs" / submission_id / f"candidate_{slug}_metadata.json"
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def get_delivery_metadata(submission_id: str) -> dict[str, Any] | None:
    path = ROOT / "outputs" / submission_id / "metadata.json"
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def submission_status(submission_id: str) -> dict[str, Any]:
    inputs_dir = ROOT / "inputs" / submission_id
    processed_dir = ROOT / "processed" / submission_id
    outputs_dir = ROOT / "outputs" / submission_id

    return {
        "has_original": (inputs_dir / "original.jpg").exists(),
        "has_processed": (processed_dir / "processed.png").exists(),
        "has_candidates": (outputs_dir / "candidate_manifest.json").exists(),
        "has_delivery": (outputs_dir / "metadata.json").exists(),
    }


def ensure_dirs(submission_id: str) -> None:
    (ROOT / "inputs" / submission_id).mkdir(parents=True, exist_ok=True)
    (ROOT / "processed" / submission_id).mkdir(parents=True, exist_ok=True)
    (ROOT / "outputs" / submission_id).mkdir(parents=True, exist_ok=True)
