"""Generate the PWA / Android icons with plain geometry (no font needed, fully reproducible).

Mark: a white capital "I" whose dot is the restricted brand red square.
Run:  python3 scripts/make_icons.py     (needs Pillow)
"""
from pathlib import Path
from PIL import Image, ImageDraw

INK = (0x21, 0x23, 0x2E)
PAPER = (0xF0, 0xF0, 0xF0)
RED = (0xFF, 0x2D, 0x2D)

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"


def mark(size: int, content: float) -> Image.Image:
    """Draw at 4x then downsample for crisp edges. `content` = share of the canvas the mark may use."""
    s = size * 4
    img = Image.new("RGB", (s, s), INK)
    d = ImageDraw.Draw(img)
    box = s * content
    # glyph proportions inside a square box: dot (square), gap, stem
    stem_w = box * 0.26
    dot = stem_w
    gap = box * 0.07
    stem_h = box * 0.52
    total_h = dot + gap + stem_h
    x0 = (s - stem_w) / 2
    y0 = (s - total_h) / 2
    d.rectangle([x0, y0, x0 + dot - 1, y0 + dot - 1], fill=RED)
    y1 = y0 + dot + gap
    d.rectangle([x0, y1, x0 + stem_w - 1, y1 + stem_h - 1], fill=PAPER)
    return img.resize((size, size), Image.LANCZOS)


def save(name: str, size: int, content: float) -> None:
    mark(size, content).save(OUT / name, optimize=True)
    print("wrote", name, size)


OUT.mkdir(parents=True, exist_ok=True)
save("icon-192.png", 192, 0.82)
save("icon-512.png", 512, 0.82)
save("icon-maskable-512.png", 512, 0.60)  # keeps the mark inside the 80% safe zone
save("apple-touch-icon.png", 180, 0.80)
save("favicon-32.png", 32, 0.90)
