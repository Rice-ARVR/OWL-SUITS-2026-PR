"""
Generate a PNG showing the exclusion zone overlaid on a reference frame.

Usage:
    python visualize_exclusion_zone.py [--width W] [--height H] [--out path.png]

Defaults: 1280x720, saved to exclusion_zone.png next to this script.
"""

import argparse
from pathlib import Path

import cv2
import numpy as np


def _exclusion_zone(img_w: int, img_h: int) -> tuple[int, int, int, int]:
    return (
        int(img_w * 0.25),
        int(img_h * 0.80),
        int(img_w * 0.75),
        img_h,
    )


def generate(width: int, height: int, out: Path) -> None:
    img = np.full((height, width, 3), 30, dtype=np.uint8)  # dark background

    # Draw a light grid to give spatial reference
    grid_color = (60, 60, 60)
    for x in range(0, width, width // 10):
        cv2.line(img, (x, 0), (x, height), grid_color, 1)
    for y in range(0, height, height // 10):
        cv2.line(img, (0, y), (width, y), grid_color, 1)

    # Mark the image centre
    cv2.drawMarker(img, (width // 2, height // 2), (80, 80, 80), cv2.MARKER_CROSS, 30, 1)

    ex1, ey1, ex2, ey2 = _exclusion_zone(width, height)

    # Shaded exclusion zone
    overlay = img.copy()
    cv2.rectangle(overlay, (ex1, ey1), (ex2, ey2), (0, 0, 180), -1)
    cv2.addWeighted(overlay, 0.45, img, 0.55, 0, img)

    # Border
    cv2.rectangle(img, (ex1, ey1), (ex2, ey2), (0, 0, 255), 2)

    # Dimension annotations
    zone_w = ex2 - ex1
    zone_h = ey2 - ey1
    cx = (ex1 + ex2) // 2
    cy = (ey1 + ey2) // 2

    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(img, "EXCLUSION ZONE", (cx - 130, cy - 10), font, 0.8, (255, 255, 255), 2)
    cv2.putText(
        img,
        f"{zone_w}px wide x {zone_h}px tall  ({zone_w/width*100:.0f}% x {zone_h/height*100:.0f}%)",
        (cx - 180, cy + 25),
        font,
        0.55,
        (200, 200, 200),
        1,
    )

    # Top edge label
    cv2.putText(
        img,
        f"y={ey1}  ({ey1/height*100:.0f}% from top)",
        (ex1 + 6, ey1 - 8),
        font,
        0.5,
        (255, 200, 0),
        1,
    )

    # Horizontal extent labels
    cv2.putText(img, f"x={ex1}", (ex1 + 4, ey1 + 20), font, 0.45, (255, 200, 0), 1)
    cv2.putText(img, f"x={ex2}", (ex2 - 70, ey1 + 20), font, 0.45, (255, 200, 0), 1)

    # Corner ticks
    tick = 12
    tick_color = (0, 255, 255)
    for px, py in [(ex1, ey1), (ex2, ey1), (ex1, ey2), (ex2, ey2)]:
        dx = tick if px == ex1 else -tick
        dy = tick if py == ey1 else -tick
        cv2.line(img, (px, py), (px + dx, py), tick_color, 2)
        cv2.line(img, (px, py), (px, py + dy), tick_color, 2)

    # Title bar
    cv2.putText(img, f"Frame: {width}x{height}", (10, 24), font, 0.6, (180, 180, 180), 1)

    cv2.imwrite(str(out), img)
    print(f"Saved → {out}  ({width}x{height})")
    print(f"  Exclusion zone: x=[{ex1}, {ex2}], y=[{ey1}, {ey2}]")
    print(f"  Width {zone_w}px ({zone_w/width*100:.0f}%), Height {zone_h}px ({zone_h/height*100:.0f}%)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).parent / "exclusion_zone.png",
    )
    args = parser.parse_args()
    generate(args.width, args.height, args.out)
