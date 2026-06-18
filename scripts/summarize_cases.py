#!/usr/bin/env python3
"""Summarize V0 production cases from metadata files."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = ROOT / "outputs"


def main() -> None:
    metadata_files = sorted(OUTPUTS.glob("*/metadata.json"))
    if not metadata_files:
        print("No completed delivery metadata found yet.")
        return

    print("submission_id,theme,target_object,preset,total_beads,color_count,difficulty,brand")
    for path in metadata_files:
        with path.open("r", encoding="utf-8") as file:
            metadata = json.load(file)
        print(
            ",".join(
                str(metadata.get(key, ""))
                for key in [
                    "submission_id",
                    "theme",
                    "target_object",
                    "selected_preset",
                    "total_beads",
                    "color_count",
                    "difficulty",
                    "brand",
                ]
            )
        )


if __name__ == "__main__":
    main()
