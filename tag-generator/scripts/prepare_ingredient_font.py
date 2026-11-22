"""Prepare a local ingredient-only fallback from an installed TrueType font."""
import json, sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
font=TTFont(sys.argv[1]); glyphs=font.getGlyphSet(); unit=font['head'].unitsPerEm
result={}
for code,name in font.getBestCmap().items():
    if code>0x20ff:continue
    glyph=glyphs[name]; path=SVGPathPen(glyphs); bounds=BoundsPen(glyphs)
    transform=(1/unit,0,0,-1/unit,0,0)
    glyph.draw(TransformPen(path,transform));glyph.draw(TransformPen(bounds,transform))
    result[chr(code)]={'path':path.getCommands(),'advance':glyph.width/unit,'bounds':bounds.bounds or [0,0,0,0]}
Path(__file__).resolve().parents[1].joinpath('typography/ingredient-fallback.json').write_text(json.dumps(result))
