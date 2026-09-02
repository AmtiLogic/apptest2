#!/usr/bin/env python3
"""Generate the app icons.

A playing card standing on a dark ground with one accent colour, drawn at a
large size and downsampled so the edges stay clean.

Usage: python3 scripts/make-icons.py
Requires Pillow: pip install Pillow
"""

import os
from PIL import Image, ImageDraw

BG = (13, 20, 18)
CARD = (246, 244, 238)
ACCENT = (55, 201, 138)
ACCENT_DARK = (29, 107, 75)

SUPERSAMPLE = 8
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")


def rounded(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def draw_icon(size, padding_ratio=0.16):
    s = size * SUPERSAMPLE
    img = Image.new("RGB", (s, s), BG)
    d = ImageDraw.Draw(img)

    # Rounded dark plate so the mark reads on any home screen wallpaper.
    rounded(d, (0, 0, s - 1, s - 1), radius=int(s * 0.22), fill=BG)

    pad = s * padding_ratio
    card_w = s - pad * 2
    card_h = card_w * 1.38
    if card_h > s - pad * 2:
        card_h = s - pad * 2
        card_w = card_h / 1.38
    left = (s - card_w) / 2
    top = (s - card_h) / 2

    # Back card, tilted, in the accent colour.
    back = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    bd = ImageDraw.Draw(back)
    bd.rounded_rectangle(
        (left, top, left + card_w, top + card_h),
        radius=int(card_w * 0.12),
        fill=ACCENT_DARK + (255,),
    )
    back = back.rotate(-13, resample=Image.BICUBIC, center=(s / 2, s / 2))
    img.paste(back, (0, 0), back)

    # Front card.
    d = ImageDraw.Draw(img)
    shift = card_w * 0.06
    fl, ft = left + shift, top + shift * 0.4
    d.rounded_rectangle(
        (fl, ft, fl + card_w, ft + card_h),
        radius=int(card_w * 0.12),
        fill=CARD,
    )

    # A spade pip, built from two circles and a triangle plus a stem.
    cx = fl + card_w / 2
    cy = ft + card_h * 0.46
    r = card_w * 0.20
    d.ellipse((cx - r * 1.02, cy - r * 0.30, cx + r * 0.02, cy + r * 1.10), fill=ACCENT)
    d.ellipse((cx - r * 0.02, cy - r * 0.30, cx + r * 1.02, cy + r * 1.10), fill=ACCENT)
    d.polygon(
        [(cx, cy - r * 1.35), (cx - r * 1.02, cy + r * 0.42), (cx + r * 1.02, cy + r * 0.42)],
        fill=ACCENT,
    )
    stem_w = r * 0.20
    stem_top = cy + r * 0.70
    stem_bottom = cy + r * 1.55
    d.polygon(
        [
            (cx - stem_w, stem_top),
            (cx + stem_w, stem_top),
            (cx + stem_w * 3.0, stem_bottom),
            (cx - stem_w * 3.0, stem_bottom),
        ],
        fill=ACCENT,
    )

    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    targets = [
        ("icon-192.png", 192, 0.16),
        ("icon-512.png", 512, 0.16),
        # The Apple touch icon is masked to a rounded square by iOS, so it gets
        # a little more breathing room and no transparency.
        ("apple-touch-icon.png", 180, 0.20),
    ]
    for name, size, padding in targets:
        icon = draw_icon(size, padding)
        path = os.path.join(OUTPUT_DIR, name)
        icon.save(path, "PNG", optimize=True)
        print("wrote " + path + " (" + str(size) + "x" + str(size) + ")")


if __name__ == "__main__":
    main()
