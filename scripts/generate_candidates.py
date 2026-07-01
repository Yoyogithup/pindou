#!/usr/bin/env python3
"""Create candidate generation task files for the internal bead workflow."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PRESETS_PATH = ROOT / "data" / "presets.json"


def load_presets() -> list[dict[str, Any]]:
    with PRESETS_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def build_candidate(submission_id: str, image_path: Path, brand: str, preset: dict[str, Any]) -> dict[str, Any]:
    grid_width = int(preset["grid_width"])
    grid_height = int(preset["grid_height"])
    return {
        "candidate_id": f"{submission_id}_{preset['slug']}",
        "submission_id": submission_id,
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "status": "manual_generation_required",
        "source_image": str(image_path),
        "brand": brand,
        "preset": preset,
        "expected_outputs": {
            "preview": f"candidate_{preset['slug']}_preview.png",
            "pattern": f"candidate_{preset['slug']}_pattern.png",
            "color_list": f"candidate_{preset['slug']}_color_list.csv"
        },
        "operator_steps": [
            "Open the reference perler-beads tool.",
            "Upload the processed image.",
            f"Set grid size to {grid_width}x{grid_height}.",
            f"Use target color count {preset['target_color_count']}.",
            f"Use brand palette {brand}.",
            "Export preview, pattern, and color list into this output folder.",
            "Record visual score and manual edit time."
        ],
        "review": {
            "looks_like_original": None,
            "visual_cuteness": None,
            "bead_difficulty": None,
            "color_count": None,
            "total_beads": grid_width * grid_height,
            "manual_edit_time_minutes": None,
            "operator_notes": ""
        }
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate candidate task metadata for a submission.")
    parser.add_argument("--submission-id", required=True, help="Submission id, for example S0001.")
    parser.add_argument("--image", required=True, type=Path, help="Processed image path.")
    parser.add_argument("--brand", default="MARD", help="Preferred bead brand.")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "outputs", help="Base output directory.")
    return parser.parse_args()


def run_generate_candidates(
    submission_id: str,
    image: Path,
    brand: str = "MARD",
    output_dir: Path = ROOT / "outputs",
) -> Path:
    if not image.exists():
        raise FileNotFoundError(f"Processed image not found: {image}")

    submission_dir = output_dir / submission_id
    submission_dir.mkdir(parents=True, exist_ok=True)

    manifest = []
    for preset in load_presets():
        candidate = build_candidate(submission_id, image, brand, preset)
        candidate_path = submission_dir / f"candidate_{preset['slug']}_metadata.json"
        with candidate_path.open("w", encoding="utf-8") as file:
            json.dump(candidate, file, ensure_ascii=False, indent=2)
            file.write("\n")
        manifest.append(candidate_path.name)

    manifest_path = submission_dir / "candidate_manifest.json"
    with manifest_path.open("w", encoding="utf-8") as file:
        json.dump(
            {
                "submission_id": submission_id,
                "created_at": datetime.now().isoformat(timespec="seconds"),
                "candidate_files": manifest
            },
            file,
            ensure_ascii=False,
            indent=2,
        )
        file.write("\n")

    return submission_dir


def main() -> None:
    args = parse_args()
    submission_dir = run_generate_candidates(
        args.submission_id, args.image, args.brand, args.output_dir
    )
    print(f"Candidate task files written to {submission_dir}")


if __name__ == "__main__":
    main()
