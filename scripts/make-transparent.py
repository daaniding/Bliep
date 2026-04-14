#!/usr/bin/env python3
"""
Convert JPG sprite assets to transparent PNGs.

Strategy: flood-fill the background from all 4 corners. Only pixels
that are (a) near-white AND (b) reachable from a corner via near-white
neighbors get marked transparent. White pixels INSIDE the sprite (e.g.
helmet visor) stay opaque.

JPG compression introduces noise around the sprite edge, so the
"near-white" tolerance is generous and we apply a 1-px alpha feather
on the boundary.

Run from project root:
    python3 scripts/make-transparent.py
"""

import sys
from collections import deque
from pathlib import Path
from PIL import Image

ASSET_DIR = Path(__file__).parent.parent / "public" / "assets" / "ui"

SPRITES = [
    "knight.jpeg",
    "dragon.jpeg",
    "peasants.jpeg",
    "hourglass.jpeg",
    "padlock.jpeg",
    "gems.jpeg",
    "coins-stack.jpeg",
    "scroll-banner.jpeg",
    "scroll-speech.jpeg",
    "ribbon-red.jpeg",
    "button-gold-ruby.jpeg",
    "label-gold-rubies.jpeg",
    "profile-card.jpeg",
    "frame-gold-gem.jpg",
    "frame-wood-square.jpeg",
    "panel-wood-plank.jpeg",
]

# A pixel counts as "background" if its luminance is above this AND
# the channel spread is small (i.e. neutral, not coloured highlight).
LUMA_MIN = 215
SPREAD_MAX = 30  # max-min channel diff


def is_bgish(px):
    r, g, b = px[0], px[1], px[2]
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    spread = max(r, g, b) - min(r, g, b)
    return luma >= LUMA_MIN and spread <= SPREAD_MAX


def flood_fill_alpha(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()

    # Start from each corner and BFS outward. Mark visited pixels
    # transparent.
    visited = bytearray(w * h)
    queue = deque()

    for sx, sy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if is_bgish(px[sx, sy]):
            queue.append((sx, sy))
            visited[sy * w + sx] = 1

    # Also seed a 2-px border ring so we catch the entire frame
    for x in range(w):
        for y in (0, 1, h - 2, h - 1):
            if not visited[y * w + x] and is_bgish(px[x, y]):
                queue.append((x, y))
                visited[y * w + x] = 1
    for y in range(h):
        for x in (0, 1, w - 2, w - 1):
            if not visited[y * w + x] and is_bgish(px[x, y]):
                queue.append((x, y))
                visited[y * w + x] = 1

    while queue:
        x, y = queue.popleft()
        px[x, y] = (255, 255, 255, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                idx = ny * w + nx
                if not visited[idx] and is_bgish(px[nx, ny]):
                    visited[idx] = 1
                    queue.append((nx, ny))

    # Soft 1-px alpha feather on the new edge: any opaque pixel
    # neighbouring a transparent one gets alpha 200 to soften aliasing.
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h:
                    if px[nx, ny][3] == 0:
                        px[x, y] = (r, g, b, 215)
                        break

    return im


def main():
    print(f"Asset dir: {ASSET_DIR}")
    if not ASSET_DIR.exists():
        sys.exit(f"Missing: {ASSET_DIR}")

    for name in SPRITES:
        src = ASSET_DIR / name
        if not src.exists():
            print(f"  skip (missing): {name}")
            continue
        dst = ASSET_DIR / (src.stem + ".png")
        with Image.open(src) as im:
            out = flood_fill_alpha(im)
            out.save(dst, "PNG", optimize=True)
        print(f"  ok: {name} -> {dst.name}  ({dst.stat().st_size // 1024}KB)")


if __name__ == "__main__":
    main()
