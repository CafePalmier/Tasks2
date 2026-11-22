import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pack, tagSize, validateGeometry, SHEET_MARGIN, CUT_GAP} from '../engine.mjs';

const tagsOf = (...formats) => formats.map((format, index) =>
  format === 'qr' || format === 'side'
    ? {id: index, type: 'napkin', design: format}
    : {id: index, type: format});

function checkLayout(tags, sheets, layout) {
  const placed = sheets.flatMap(sheet => sheet.items);
  assert.deepEqual(placed.map(item => item.tag.id).sort(), tags.map(tag => tag.id).sort());
  for (const {w, h, tag} of placed) assert.deepEqual([w, h], tagSize(tag));
  assert.deepEqual(validateGeometry({sheets, layout}), []);
}

test('two QR holders pair with two Side holders regardless of which are added first', () => {
  for (const order of [
    ['side', 'side', 'qr', 'qr'],
    ['qr', 'qr', 'side', 'side'],
    ['side', 'qr', 'qr', 'side']
  ]) {
    const tags = tagsOf(...order);
    const sheets = pack(tags);
    assert.equal(sheets.length, 2);
    for (const sheet of sheets)
      assert.deepEqual(sheet.items.map(item => item.tag.design).sort(), ['qr', 'side']);
    checkLayout(tags, sheets, {margin: SHEET_MARGIN, gap: CUT_GAP});
  }
});

test('all five formats share one sheet by filling gaps around larger tags', () => {
  const tags = tagsOf('provisions', 'provisions', 'qr', 'side', 'freezer', 'pastry');
  const sheets = pack(tags);
  assert.equal(sheets.length, 1);
  checkLayout(tags, sheets, {margin: SHEET_MARGIN, gap: CUT_GAP});
});

test('reordering reduces a mixed job even at the original printer margin', () => {
  const tags = tagsOf('freezer', 'pastry', 'freezer', 'freezer', 'provisions', 'freezer', 'qr');
  const layout = {margin: 36, gap: 2};
  const sheets = pack(tags, layout);
  assert.equal(sheets.length, 1);
  assert.deepEqual(pack(tags, layout), sheets);
  checkLayout(tags, sheets, layout);
  const left = sheets[0].items.reduce((a, b) => a.x < b.x ? a : b);
  left.x = layout.margin - 0.5;
  assert(validateGeometry({sheets, layout}).some(error => error.id === left.tag.id));
});

test('configured cutting gap is enforced between exact cut boundaries', () => {
  const tags = tagsOf('qr', 'side');
  const layout = {margin: 40, gap: 3};
  const sheets = pack(tags, layout);
  checkLayout(tags, sheets, layout);
  const [qr, side] = sheets[0].items;
  assert(Math.abs(side.x - qr.x - qr.w - layout.gap) < 1e-7);
  side.x -= 1;
  assert(validateGeometry({sheets, layout}).some(error => error.message.includes('3 pt')));
});
