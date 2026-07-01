#!/usr/bin/env python3
"""Create a V0 delivery package skeleton for a selected candidate."""

from __future__ import annotations

import argparse
import csv
import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def find_candidate(output_dir: Path, submission_id: str, selected_candidate: str) -> tuple[Path, dict[str, Any]]:
    candidate_path = output_dir / submission_id / f"candidate_{selected_candidate}_metadata.json"
    if not candidate_path.exists():
        raise FileNotFoundError(
            f"Candidate metadata not found: {candidate_path}. Run scripts/generate_candidates.py first."
        )
    return candidate_path, read_json(candidate_path)


def write_placeholder_color_list(path: Path, brand: str) -> None:
    rows = [
        ["brand", "brand_code", "color_name", "hex", "bead_count", "notes"],
        [brand, "TBD", "待从最终图纸导出", "", "", "用参考工具导出的采购清单替换此文件"],
    ]
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file)
        writer.writerows(rows)


def default_font(size: int) -> ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
    ]
    for candidate in candidates:
        font_path = Path(candidate)
        if font_path.exists():
            return ImageFont.truetype(str(font_path), size=size)
    return ImageFont.load_default()


def write_delivery_card(path: Path, metadata: dict[str, Any]) -> None:
    image = Image.new("RGB", (1200, 1600), "#FFF8F0")
    draw = ImageDraw.Draw(image)
    title_font = default_font(64)
    heading_font = default_font(40)
    body_font = default_font(34)

    draw.rectangle((0, 0, 1200, 180), fill="#263238")
    draw.text((80, 58), "你的专属拼豆图纸", fill="#FFFFFF", font=title_font)

    lines = [
        ("主题", metadata.get("theme", "待补充")),
        ("尺寸", f"{metadata['grid_width']} x {metadata['grid_height']}"),
        ("总豆数", f"{metadata['total_beads']} 颗"),
        ("颜色数", f"{metadata['color_count']} 色"),
        ("难度", metadata.get("difficulty", "待补充")),
        ("预计耗时", metadata.get("estimated_time", "待补充")),
        ("适合做成", metadata.get("target_object", "冰箱贴 / 挂件 / 摆件")),
    ]

    y = 260
    for label, value in lines:
        draw.text((90, y), label, fill="#455A64", font=heading_font)
        draw.text((330, y), str(value), fill="#111111", font=body_font)
        y += 105

    draw.rounded_rectangle((80, 1080, 1120, 1420), radius=24, outline="#D0A85C", width=4, fill="#FFFFFF")
    draw.text((130, 1135), "包含", fill="#455A64", font=heading_font)
    includes = ["1. 拼豆效果预览", "2. 网格图纸", "3. 色号清单", "4. 每色豆子数量"]
    y = 1210
    for item in includes:
        draw.text((150, y), item, fill="#111111", font=body_font)
        y += 58

    image.save(path, format="PNG")


def copy_if_exists(source: Path, destination: Path) -> bool:
    if source.exists():
        shutil.copy2(source, destination)
        return True
    return False


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Package a selected bead pattern candidate.")
    parser.add_argument("--submission-id", required=True, help="Submission id, for example S0001.")
    parser.add_argument("--selected-candidate", required=True, choices=["beginner", "standard", "detail"])
    parser.add_argument("--theme", default="待补充")
    parser.add_argument("--target-object", default="冰箱贴 / 挂件 / 摆件")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "outputs")
    parser.add_argument("--inputs-dir", type=Path, default=ROOT / "inputs")
    parser.add_argument("--processed-dir", type=Path, default=ROOT / "processed")
    return parser.parse_args()


def run_package_delivery(
    submission_id: str,
    selected_candidate: str,
    theme: str = "待补充",
    target_object: str = "冰箱贴 / 挂件 / 摆件",
    output_dir: Path = ROOT / "outputs",
    inputs_dir: Path = ROOT / "inputs",
    processed_dir: Path = ROOT / "processed",
) -> dict[str, Any]:
    submission_dir = output_dir / submission_id
    submission_dir.mkdir(parents=True, exist_ok=True)

    _, candidate = find_candidate(output_dir, submission_id, selected_candidate)
    preset = candidate["preset"]

    original_copied = copy_if_exists(inputs_dir / submission_id / "original.jpg", submission_dir / "00_original.jpg")
    processed_copied = copy_if_exists(processed_dir / submission_id / "processed.png", submission_dir / "01_processed.png")

    preview_name = candidate["expected_outputs"]["preview"]
    pattern_name = candidate["expected_outputs"]["pattern"]
    color_list_name = candidate["expected_outputs"]["color_list"]

    preview_exists = (submission_dir / preview_name).exists()
    pattern_exists = (submission_dir / pattern_name).exists()
    color_list_exists = (submission_dir / color_list_name).exists()

    if preview_exists:
        shutil.copy2(submission_dir / preview_name, submission_dir / f"0{2 if selected_candidate == 'beginner' else 3}_preview_{selected_candidate}.png")
    if pattern_exists:
        shutil.copy2(submission_dir / pattern_name, submission_dir / "final_pattern.png")
    if color_list_exists:
        shutil.copy2(submission_dir / color_list_name, submission_dir / "color_list.csv")
    else:
        write_placeholder_color_list(submission_dir / "color_list.csv", candidate["brand"])

    metadata = {
        "submission_id": submission_id,
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "theme": theme,
        "target_object": target_object,
        "selected_preset": preset["preset_key"],
        "grid_width": preset["grid_width"],
        "grid_height": preset["grid_height"],
        "total_beads": preset["grid_width"] * preset["grid_height"],
        "color_count": candidate["review"].get("color_count") or "待从最终图纸补充",
        "brand": candidate["brand"],
        "difficulty": preset["difficulty"],
        "estimated_time": preset["estimated_time"],
        "files": {
            "original": "00_original.jpg" if original_copied else None,
            "processed": "01_processed.png" if processed_copied else None,
            "preview": preview_name if preview_exists else None,
            "pattern": "final_pattern.png" if pattern_exists else None,
            "color_list": "color_list.csv",
            "delivery_card": "delivery_card.png"
        },
        "operator_notes": "V0 package generated. Replace placeholder files after exporting from the reference tool.",
        "user_feedback": None
    }

    with (submission_dir / "metadata.json").open("w", encoding="utf-8") as file:
        json.dump(metadata, file, ensure_ascii=False, indent=2)
        file.write("\n")

    write_delivery_card(submission_dir / "delivery_card.png", metadata)
    return metadata


def main() -> None:
    args = parse_args()
    metadata = run_package_delivery(
        args.submission_id,
        args.selected_candidate,
        args.theme,
        args.target_object,
        args.output_dir,
        args.inputs_dir,
        args.processed_dir,
    )
    print(f"Delivery package written to {metadata['files']['delivery_card']}")


if __name__ == "__main__":
    main()
