"""Reproducible local audit assets. Never publish typography/provisional.json without permission.
Requires PyMuPDF and fontTools. Originals are read-only.
"""
from pathlib import Path
import fitz,json,io,statistics
from fontTools.cffLib import CFFFontSet
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from fontTools.agl import toUnicode
ROOT=Path(__file__).resolve().parents[1]
def path(d,ox=0,oy=0,scale=1):
 out=[];last=None
 def pt(p):return f'{(p.x-ox)*scale:.6f} {(p.y-oy)*scale:.6f}'
 for i in d['items']:
  if i[0]=='re':
   r=i[1];out.append(f'M{pt(r.tl)} L{pt(r.tr)} L{pt(r.br)} L{pt(r.bl)} Z');last=None
  else:
   if last!=i[1]:out.append('M'+pt(i[1]))
   if i[0]=='l':out.append('L'+pt(i[2]));last=i[2]
   elif i[0]=='c':out.append('C'+' '.join(pt(p) for p in i[2:]));last=i[-1]
 if d['closePath']:out.append('Z')
 return ' '.join(out)
assets={}
for kind,filename,w,h in [('pastry','pastry-blank.pdf',199.9674,154.5202),('freezer','freezer-blank.pdf',212.234,101.503),('provisions','Provisions-blank.pdf',141.732,116.220)]:
 doc=fitz.open(ROOT/'templates'/filename);draws=doc[0].get_drawings();r=draws[0]['rect']; shapes=[]
 for d,color in zip(draws[:3],['#eed2c4','#c68b70','#eae0d3']):shapes.append({'path':path(d,r.x0,r.y0),'color':color})
 assets[kind]={'width':w,'height':h,'shapes':shapes}
(ROOT/'assets/artwork.json').write_text(json.dumps(assets))
fonts={}
chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸàâäçéèêëîïôöùûüÿ0123456789&\'-,./():;%$!?œŒæÆ'
assert len(chars)==112
for name,file in [('lucidity','Cafe_Palmier_Lucidity_Source.pdf'),('ruddy','Cafe_Palmier_Ruddy_Source.pdf')]:
 doc=fitz.open(ROOT/'fonts'/file);ds=doc[0].get_drawings();glyphs={}; starts=[0,26,52,68,84,94,112]
 for a,b in zip(starts,starts[1:]):
  baseline=statistics.median(d['rect'].y1 for d in ds[a:b] if d['rect'].height>4)
  for c,d in zip(chars[a:b],ds[a:b]):
   r=d['rect'];glyphs[c]={'path':path(d,r.x0,baseline,1/12),'advance':(r.width+1)/12,'ascent':(baseline-r.y0)/12,'descent':max(0,(r.y1-baseline)/12),'bounds':[0,(r.y0-baseline)/12,r.width/12,(r.y1-baseline)/12]}
 glyphs[' ']={'path':'','advance':.3,'ascent':0,'descent':0};fonts[name]=glyphs
for filename in ['pastry-original.pdf','freezer-original copy.pdf','Provisions-original.pdf']:
 doc=fitz.open(ROOT/'reference'/filename)
 for page in doc:
  for xref,ext,typ,fullname,*_ in page.get_fonts():
   if not any(f in fullname for f in ['Metropolis','Ruddy']):continue
   name='ruddy' if 'Ruddy' in fullname else 'price' if 'MediumItalic' in fullname else 'bold' if 'Bold' in fullname else 'ingredients'
   glyphs=fonts.setdefault(name,{})
   cff=CFFFontSet();cff.decompile(io.BytesIO(doc.extract_font(xref)[3]),None);top=cff[cff.fontNames[0]]
   for gn in top.charset:
    ch=toUnicode(gn)
    if len(ch)!=1:continue
    cs=top.CharStrings[gn];pen=SVGPathPen(None);cs.draw(TransformPen(pen,(.001,0,0,-.001,0,0)))
    bp=BoundsPen(None);cs.draw(bp);bounds=bp.bounds
    if name=='ruddy':
     if ch in glyphs:
      glyphs[ch]['advance']=cs.width/1000;glyphs[ch]['offsetX']=bounds[0]/1000 if bounds else 0;glyphs[ch]['metricSource']='embedded CFF'
    else:
     ink=[bounds[0]/1000,-bounds[3]/1000,bounds[2]/1000,-bounds[1]/1000] if bounds else [0,0,0,0]
     glyphs[ch]={'path':pen.getCommands(),'advance':cs.width/1000,'ascent':max(0,-ink[1]),'descent':max(0,ink[3]),'bounds':ink}
   glyphs[' ']={'path':'','advance':.25 if name=='ruddy' else .3,'ascent':0,'descent':0}
# Missing Ruddy advances use a documented proportion inferred from available CFF metrics.
ratios=[g['advance']/(g['bounds'][2]-g['bounds'][0]) for g in fonts['ruddy'].values() if g.get('metricSource') and g.get('bounds') and g['bounds'][2]>g['bounds'][0]]
ratio=statistics.median(ratios)
for g in fonts['ruddy'].values():
 if g.get('path') and not g.get('metricSource'):
  g['advance']=(g['bounds'][2]-g['bounds'][0])*ratio;g['metricSource']='estimated from CFF width ratio'
(ROOT/'typography/provisional.json').write_text(json.dumps(fonts))
print('Prepared vector shapes and provisional lettering. Missing glyphs will be blocked, never substituted.')
# Preserve original badges, including original text positions and glyphs.
p=fitz.open(ROOT/'reference/pastry-original.pdf')[0];badges={'vegan':[],'glutenFree':[]}
for d in p.get_drawings():
 r=d['rect']
 if 190<r.y0 and r.y1<225 and r.x1<296:
  key='vegan' if r.x0<250 else 'glutenFree';badges[key].append({'path':path(d,95.686,73.413),'x':0,'y':0,'scale':1,'color':'#376438' if key=='vegan' else '#c68b70'})
for b in p.get_text('rawdict')['blocks']:
 for l in b.get('lines',[]):
  for s in l['spans']:
   if 'Bold' in s['font'] and s['origin'][0]<296 and 190<s['origin'][1]<225:
    for c in s['chars']:
     if c['c'] not in 'VSG':continue
     key='vegan' if c['c']=='V' else 'glutenFree';badges[key].append({'path':fonts['bold'][c['c']]['path'],'x':c['origin'][0]-95.686,'y':c['origin'][1]-73.413,'scale':s['size'],'color':'#eae0d3'})
assets['badges']=badges
(ROOT/'assets/artwork.json').write_text(json.dumps(assets))
