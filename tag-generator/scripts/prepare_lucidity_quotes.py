"""Add the labelled original guillemet outlines without changing other glyphs."""
from pathlib import Path
import json, statistics
import fitz

root=Path(__file__).resolve().parents[1]
page=fitz.open(root/'reference/lucidity-reference.pdf')[0]
drawings=page.get_drawings()
target=root/'typography/provisional.json'
fonts=json.loads(target.read_text())
caps=[fonts['lucidity'][c]['bounds'] for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ']
center=statistics.median((b[1]+b[3])/2 for b in caps)
for char,label in [('«','opening'),('»','closing')]:
    labels=page.search_for(label)
    assert len(labels)==1, 'Expected a unique '+label+' label'
    text=labels[0]
    candidates=[d for d in drawings if d['rect'].y1<=text.y0 and text.y0-d['rect'].y1<12 and abs((d['rect'].x0+d['rect'].x1-text.x0-text.x1)/2)<8]
    assert len(candidates)==1, 'Ambiguous '+label+' outline'
    d=candidates[0];r=d['rect'];baseline=(r.y0+r.y1)/2-center*12
    def point(p):return f'{(p.x-r.x0)/12:.8f} {(p.y-baseline)/12:.8f}'
    parts=[];last=None
    for item in d['items']:
        assert item[0] in ('l','c'), 'Unexpected outline command'
        if last!=item[1]:parts.append('M'+point(item[1]))
        if item[0]=='l':parts.append('L'+point(item[2]));last=item[2]
        else:parts.append('C'+' '.join(point(p) for p in item[2:]));last=item[-1]
    if d['closePath']:parts.append('Z')
    bounds=[0,(r.y0-baseline)/12,r.width/12,(r.y1-baseline)/12]
    fonts['lucidity'][char]={'path':' '.join(parts),'advance':(r.width+1)/12,'bounds':bounds,'ascent':-bounds[1],'descent':max(0,bounds[3]),'metricSource':'labelled lucidity-reference.pdf outline; 12 pt scale, cap-centred, existing 1 pt specimen spacing'}
target.write_text(json.dumps(fonts))
print('Mapped original opening/closing outlines to U+00AB and U+00BB.')
