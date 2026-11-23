"""Copy the outlined lowercase ñ from the bottom of the Ruddy specimen."""
import json
from pathlib import Path
import sys

import fitz


ROOT = Path(__file__).resolve().parents[1]


def add_ruddy_ntilde(glyphs):
    with fitz.open(ROOT / 'reference/ruddy-reference.pdf') as document:
        # The new ñ is the sole outlined glyph below both guillemet labels.
        page = document[0]
        labels = page.search_for('opening') + page.search_for('closing')
        if len(labels) != 2:
            raise ValueError('Expected both guillemet labels in the Ruddy specimen')
        drawings = [d for d in page.get_drawings() if d['rect'].y0 > max(r.y1 for r in labels)]
        if len(drawings) != 1:
            raise ValueError('Expected one Ruddy ñ outline below the guillemet labels')
        drawing = drawings[0]

    bounds = drawing['rect']
    n = glyphs['n']
    # The 12 pt outline has the same n body as the specimen's plain n.
    # Align the bottoms and retain the original CFF advance and left bearing.
    baseline = bounds.y1 - n['bounds'][3] * 12

    def point(p):
        return f'{(p.x - bounds.x0) / 12:.8f} {(p.y - baseline) / 12:.8f}'

    parts = []
    last = None
    for item in drawing['items']:
        if item[0] not in ('l', 'c'):
            raise ValueError('Unexpected Ruddy ñ outline command')
        if last != item[1]:
            if parts:
                parts.append('Z')
            parts.append('M' + point(item[1]))
        parts.append(item[0].upper() + ' '.join(point(p) for p in item[2:]))
        last = item[-1]
    parts.append('Z')

    top, bottom = (bounds.y0 - baseline) / 12, n['bounds'][3]
    glyphs['ñ'] = {
        'path': ' '.join(parts),
        'advance': n['advance'],
        'offsetX': n['offsetX'],
        'bounds': [0, top, bounds.width / 12, bottom],
        'ascent': -top,
        'descent': max(0, bottom),
        'metricSource': 'Ruddy reference ñ outline with the embedded CFF n advance and bearing',
    }


if __name__ == '__main__':
    targets = list(map(Path, sys.argv[1:])) or [ROOT / 'typography/provisional.json']
    for target in targets:
        data = json.loads(target.read_text())
        add_ruddy_ntilde(data['ruddy'])
        compact = target.name == 'approved.json'
        target.write_text(json.dumps(data, ensure_ascii=not compact, separators=(',', ':') if compact else None)
                          + ('\n' if compact else ''))
