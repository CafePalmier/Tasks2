"""Read-only audit of PDF-compatible sources and generated glyph coverage.
Requires PyMuPDF and fontTools; writes only the non-font JSON report.
"""
import io,json
from pathlib import Path
import fitz
from fontTools.cffLib import CFFFontSet
from fontTools.ttLib import TTFont
from fontTools.agl import toUnicode
from fontTools.pens.boundsPen import BoundsPen
root=Path(__file__).resolve().parents[1]
report={'requiredPriceCharacters':'0123456789$.','sourcePriceWhitespace':' ','sources':[],'generated':{}}
price=set()
for folder in ['reference','templates','fonts']:
 for file in sorted((root/folder).iterdir()):
  if file.suffix.lower() not in ['.pdf','.ai']:continue
  doc=fitz.open(file);entry={'file':str(file.relative_to(root)),'fonts':[]};seen=set()
  for page in doc:
   for row in page.get_fonts(full=True):
    xref,ext,_,name,*_=row
    if xref in seen:continue
    seen.add(xref);data=doc.extract_font(xref)[3];chars=set();empty=[]
    if ext=='cff':
     cff=CFFFontSet();cff.decompile(io.BytesIO(data),None);top=cff[cff.fontNames[0]]
     for gn in top.charset:
      char=toUnicode(gn)
      if len(char)!=1:continue
      pen=BoundsPen(None);top.CharStrings[gn].draw(pen)
      if pen.bounds or char==' ':chars.add(char)
      else:empty.append(char)
    elif ext=='ttf':
     font=TTFont(io.BytesIO(data));glyphs=font.getGlyphSet()
     for code,gn in (font.getBestCmap() or {}).items():
      pen=BoundsPen(glyphs);glyphs[gn].draw(pen)
      if pen.bounds or chr(code)==' ':chars.add(chr(code))
      else:empty.append(chr(code))
    entry['fonts'].append({'name':name,'format':ext,'usableCharacters':''.join(sorted(chars)),'mappedWithoutInk':''.join(sorted(empty))})
    if 'Metropolis-MediumItalic' in name:price.update(chars)
  report['sources'].append(entry)
report['priceUnion']=''.join(sorted(price));report['missingPriceCharacters']=''.join(c for c in report['requiredPriceCharacters'] if c not in price)
asset=root/'typography/provisional.json'
if asset.exists():
 for name,glyphs in json.loads(asset.read_text()).items():
  report['generated'][name]={'characters':''.join(sorted(glyphs)),'missingPrintableASCII':''.join(chr(n) for n in range(32,127) if chr(n) not in glyphs),'estimatedMetrics':''.join(c for c,g in glyphs.items() if g.get('metricSource','').startswith('estimated'))}
(root/'glyph-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('Audited',len(report['sources']),'source files. Missing price characters:',report['missingPriceCharacters'])
