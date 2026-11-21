"""Extract static source artwork without changing originals. Requires PyMuPDF."""
from pathlib import Path
import fitz, json, base64, hashlib
root=Path(__file__).resolve().parents[1]
assets={}
for key,name,label in [('side','napkin_holder_side','Side'),('qr','QR-original','QR')]:
 source=root/'reference'/f'{name}.pdf'
 doc=fitz.open(source); page=doc[0]; bounds=fitz.Rect()
 for _,rect in page.get_bboxlog(): bounds |= fitz.Rect(rect)
 # Keep complete painted bounds, including the original background stroke.
 cropped=fitz.open(); dest=cropped.new_page(width=bounds.width,height=bounds.height)
 dest.show_pdf_page(dest.rect,doc,0,clip=bounds)
 svg=dest.get_svg_image(text_as_path=True)
 assets[key]={'label':f'Napkin Holder — {label}','width':dest.rect.width,'height':dest.rect.height,'source':source.name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'bounds':list(bounds),'svg':svg,'pdf':base64.b64encode(cropped.tobytes(garbage=4,deflate=True)).decode()}
(root/'assets/static-designs.mjs').write_text('export const staticDesigns = '+json.dumps(assets)+';\n')
