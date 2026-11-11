#!/usr/bin/env python3
"""
Generate the synthetic PDF fixtures used by tests/pdf.test.ts.
All content is invented. Requires reportlab (and Pillow for the image-only case).
Run:  python3 scripts/make_test_pdfs.py
"""
import io
import os
import sys

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

OUT = os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures", "pdf")
os.makedirs(OUT, exist_ok=True)
W, H = A4

SINGLE = [
    "Alex Sample",
    "alex.sample@example.com",
    "Experience",
    "Senior Data Engineer, Northwind Logistics 03/2021 - Present",
    "Built Airflow pipelines on AWS that load 40 million rows per day.",
    "Reduced average query time by 62% after redesigning SQL models.",
    "Education",
    "BSc Computer Science, Example University 2014 - 2018",
    "Skills",
    "SQL, Python, Airflow, AWS, Kafka",
]
LEFT = [f"Left column line {i}: experience with python and sql" for i in range(1, 11)]
RIGHT = [f"Right column line {i}: skills airflow aws kafka docker" for i in range(1, 11)]


def single():
    c = canvas.Canvas(os.path.join(OUT, "single-column.pdf"), pagesize=A4)
    y = H - 60
    for line in SINGLE:
        c.setFont("Helvetica-Bold" if line in ("Experience", "Education", "Skills") else "Helvetica", 11)
        c.drawString(50, y, line)
        y -= 18
    c.save()


def two_col(name, interleaved):
    c = canvas.Canvas(os.path.join(OUT, name), pagesize=A4)
    c.setFont("Helvetica", 10)
    top = H - 80
    if interleaved:
        # content-stream order alternates left/right row by row
        for i in range(10):
            c.drawString(40, top - i * 16, LEFT[i])
            c.drawString(320, top - i * 16, RIGHT[i])
    else:
        for i in range(10):
            c.drawString(40, top - i * 16, LEFT[i])
        for i in range(10):
            c.drawString(320, top - i * 16, RIGHT[i])
    c.save()


def multipage():
    c = canvas.Canvas(os.path.join(OUT, "multi-page.pdf"), pagesize=A4)
    for p in range(1, 4):
        c.setFont("Helvetica", 11)
        c.drawString(50, H - 60, f"Page {p} heading")
        c.drawString(50, H - 80, f"Content of page {p} mentions python and kubernetes")
        c.showPage()
    c.save()


def blank():
    c = canvas.Canvas(os.path.join(OUT, "blank.pdf"), pagesize=A4)
    c.showPage()
    c.save()


def image_only():
    from PIL import Image, ImageDraw

    img = Image.new("RGB", (800, 400), "white")
    d = ImageDraw.Draw(img)
    for i, line in enumerate(SINGLE):
        d.text((20, 20 + i * 30), line, fill="black")
    buf = io.BytesIO()
    img.save(buf, "PNG")
    buf.seek(0)
    from reportlab.lib.utils import ImageReader

    c = canvas.Canvas(os.path.join(OUT, "image-only.pdf"), pagesize=A4)
    c.drawImage(ImageReader(buf), 40, H - 460, width=500, height=250)
    c.save()


def encrypted():
    c = canvas.Canvas(
        os.path.join(OUT, "encrypted.pdf"),
        pagesize=A4,
        encrypt=__import__("reportlab.lib.pdfencrypt", fromlist=["StandardEncryption"]).StandardEncryption(
            "userpass", ownerPassword="ownerpass"
        ),
    )
    c.drawString(50, H - 60, "secret content")
    c.save()


def turkish():
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    pdfmetrics.registerFont(TTFont("DejaVu", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
    c = canvas.Canvas(os.path.join(OUT, "turkish.pdf"), pagesize=A4)
    c.setFont("DejaVu", 11)
    c.drawString(50, H - 60, "Ayşe Örnek — Veri Mühendisi")
    c.drawString(50, H - 80, "Şirket: Örnek Lojistik, İstanbul. Çözüm odaklı, ığüşöç")
    c.save()


def not_a_pdf():
    with open(os.path.join(OUT, "not-a-pdf.pdf"), "wb") as f:
        f.write(b"This is just a text file renamed to .pdf\n" * 5)
    with open(os.path.join(OUT, "empty.pdf"), "wb"):
        pass
    with open(os.path.join(OUT, "corrupt.pdf"), "wb") as f:
        f.write(b"%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ngarbage garbage garbage\n")


if __name__ == "__main__":
    single()
    two_col("two-column-ordered.pdf", False)
    two_col("two-column-interleaved.pdf", True)
    multipage()
    blank()
    try:
        image_only()
    except Exception as e:  # pragma: no cover
        print("image-only skipped:", e, file=sys.stderr)
    try:
        encrypted()
    except Exception as e:  # pragma: no cover
        print("encrypted skipped:", e, file=sys.stderr)
    turkish()
    not_a_pdf()
    print("wrote", sorted(os.listdir(OUT)))
