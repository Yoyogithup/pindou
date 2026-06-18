#!/usr/bin/env python3
"""Preprocess a user image into a square PNG for the bead pattern workflow."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps, UnidentifiedImageError


def center_crop_square(image: Image.Image) -> Image.Image:
    width, height = image.size
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    return image.crop((left, top, left + side, top + side))


def preprocess_image(input_path: Path, output_path: Path, size: int, brightness: float, contrast: float) -> None:
    if not input_path.exists():
        raise FileNotFoundError(f"Input image not found: {input_path}")

    try:
        with Image.open(input_path) as source:
            image = ImageOps.exif_transpose(source)
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
    except UnidentifiedImageError as exc:
        raise ValueError(f"Unsupported or broken image file: {input_path}") from exc

    image = center_crop_square(image)
    image = ImageOps.fit(image, (size, size), method=Image.Resampling.LANCZOS)

    if image.mode == "RGBA":
        rgb = image.convert("RGB")
        alpha = image.getchannel("A")
        rgb = ImageEnhance.Brightness(rgb).enhance(brightness)
        rgb = ImageEnhance.Contrast(rgb).enhance(contrast)
        image = rgb.convert("RGBA")
        image.putalpha(alpha)
    else:
        image = ImageEnhance.Brightness(image).enhance(brightness)
        image = ImageEnhance.Contrast(image).enhance(contrast)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, format="PNG", optimize=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Preprocess an image for the pindou MVP workflow.")
    parser.add_argument("--input", required=True, type=Path, help="Path to the original image.")
    parser.add_argument("--output", required=True, type=Path, help="Path to write the processed PNG.")
    parser.add_argument("--size", type=int, default=1024, help="Square output size in pixels.")
    parser.add_argument("--brightness", type=float, default=1.04, help="Brightness multiplier.")
    parser.add_argument("--contrast", type=float, default=1.08, help="Contrast multiplier.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    preprocess_image(args.input, args.output, args.size, args.brightness, args.contrast)
    print(f"Processed image written to {args.output}")


if __name__ == "__main__":
    main()
