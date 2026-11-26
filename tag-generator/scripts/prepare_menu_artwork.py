"""Copy the blank menu PDFs and SVG outlines at their original print sizes."""
import base64
import json
from pathlib import Path

import fitz

root = Path(__file__).resolve().parents[1]
# Coordinates enclose the outside of the printed artwork, including the border stroke.
bounds = {
    'cocktails': [20.58, 20.85, 311.32, 311.08],
    'drinks': [26.62, 24.18, 323.63, 321.16],
    'soup': [27.10, 29.98, 329.73, 331.55],
    'tea': [0, 0, 792, 612],
}

assets = {}
for design, box in bounds.items():
    crop = fitz.Rect(box)
    with fitz.open(root / 'templates' / f'{design}-blank.pdf') as source, fitz.open() as output:
        page = output.new_page(width=crop.width, height=crop.height)
        page.show_pdf_page(page.rect, source, 0, clip=crop)
        assets[design] = {
            'width': page.rect.width,
            'height': page.rect.height,
            'bounds': box,
            'svg': page.get_svg_image(text_as_path=True),
            'pdf': base64.b64encode(output.tobytes(garbage=4, deflate=True, no_new_id=True)).decode('ascii'),
        }
(root / 'assets' / 'menu-artwork.mjs').write_text(
    'export const menuArtwork = ' + json.dumps(assets, separators=(',', ':')) + ';\n'
)
