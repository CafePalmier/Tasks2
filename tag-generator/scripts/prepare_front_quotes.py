"""Add the labelled original guillemet outlines without changing other glyphs."""
from pathlib import Path
import json
import statistics
import fitz

root = Path(__file__).resolve().parents[1]


def add_quotes(glyphs, reference, alignment_letters, alignment):
    line_center = statistics.median(
        (glyphs[c]['bounds'][1] + glyphs[c]['bounds'][3]) / 2 for c in alignment_letters
    )
    with fitz.open(root / 'reference' / reference) as document:
        page = document[0]
        drawings = page.get_drawings()
        for char, label in [('«', 'opening'), ('»', 'closing')]:
            labels = page.search_for(label)
            assert len(labels) == 1, f'Expected a unique {label} label in {reference}'
            text = labels[0]
            candidates = [
                d for d in drawings
                if 0 <= text.y0 - d['rect'].y1 < 12
                and abs((d['rect'].x0 + d['rect'].x1 - text.x0 - text.x1) / 2) < 8
            ]
            assert len(candidates) == 1, f'Ambiguous {label} outline in {reference}'
            drawing = candidates[0]
            bounds = drawing['rect']
            baseline = (bounds.y0 + bounds.y1) / 2 - line_center * 12

            def point(p):
                return f'{(p.x - bounds.x0) / 12:.8f} {(p.y - baseline) / 12:.8f}'

            parts = []
            last = None
            for item in drawing['items']:
                assert item[0] in ('l', 'c'), 'Unexpected outline command'
                if last != item[1]:
                    parts.append('M' + point(item[1]))
                parts.append(item[0].upper() + ' '.join(point(p) for p in item[2:]))
                last = item[-1]
            if drawing['closePath']:
                parts.append('Z')
            top, bottom = (bounds.y0 - baseline) / 12, (bounds.y1 - baseline) / 12
            glyphs[char] = {
                'path': ' '.join(parts),
                'advance': (bounds.width + 1) / 12,
                'bounds': [0, top, bounds.width / 12, bottom],
                'ascent': -top,
                'descent': max(0, bottom),
                'metricSource': f'labelled {reference} outline; 12 pt scale, {alignment}, existing 1 pt specimen spacing',
            }


target = root / 'typography/provisional.json'
fonts = json.loads(target.read_text())
add_quotes(fonts['lucidity'], 'lucidity-reference.pdf', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'cap-centred')
add_quotes(fonts['ruddy'], 'ruddy-reference.pdf', 'acemnorsuvwxz', 'lowercase-centred')
target.write_text(json.dumps(fonts))
print('Mapped original Lucidity and Ruddy guillemet outlines.')
