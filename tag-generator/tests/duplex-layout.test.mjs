import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import PDFLib from 'pdf-lib';
import {createEngine} from '../engine.mjs';
import {printSheets} from '../print-view.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const artwork = read('../assets/artwork.json');
let fonts;
try { fonts = read('../typography/provisional.json'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const {PDFDocument, Duplex, PrintScaling, rgb, decodePDFRawStream} = PDFLib;

function pageCommands(pdf, index) {
  const streams = pdf.getPage(index).node.Contents();
  if (!streams) return '';
  return streams.asArray().map(ref =>
    new TextDecoder().decode(decodePDFRawStream(pdf.context.lookup(ref)).decode())
  ).join('');
}

const pastries = ['Flour, butter.', 'Sugar, eggs.', 'Milk, salt.'].map((ingredients, index) => ({
  type: 'pastry', id: 'pastry-' + index, title: ['Scone', 'Muffin', 'Pain'][index], ingredients, price: '4'
}));

test('asymmetric mixed sheets export matching short-edge fronts and backs in order', {skip: !fonts}, async () => {
  const engine = createEngine(artwork, fonts, PDFLib);
  const singles = [
    {type: 'freezer', id: 'f', title: 'Tarte', price: '12'},
    {type: 'provisions', id: 'p', title: 'Kinto', price: '32'},
    ...Array.from({length: 5}, (_, i) => ({type: 'napkin', design: i % 2 ? 'side' : 'qr', id: 'n' + i}))
  ];
  const tags = [singles[0], pastries[0], ...singles.slice(1, 4), ...pastries.slice(1), ...singles.slice(4)];
  const project = engine.createProject(tags);
  assert.deepEqual(project.errors, []);
  assert(project.sheets.length > 1);
  assert(project.sheets.some(sheet => sheet.items.some(p => p.tag.type === 'pastry') &&
    sheet.items.some(p => p.tag.type !== 'pastry')));

  const pdf = await PDFDocument.load(await engine.exportPdf(project));
  const prefs = pdf.catalog.getOrCreateViewerPreferences();
  assert.equal(prefs.getDuplex(), Duplex.DuplexFlipShortEdge);
  assert.equal(prefs.getPrintScaling(), PrintScaling.None);
  assert.equal(pdf.getPageCount(), project.sheets.length * 2);
  const markup = printSheets(engine, project);
  const expected = await PDFDocument.create();
  let previousSection = -1;

  for (const [index, {items}] of project.sheets.entries()) {
    const front = pageCommands(pdf, index * 2);
    const back = expected.addPage([792, 612]);
    const backSvg = engine.renderSheetSvg(project, index, 'back');
    for (const side of ['front', 'back']) {
      const section = markup.indexOf(`data-sheet="${index + 1}" data-side="${side}"`);
      assert(section > previousSection);
      previousSection = section;
    }
    for (const item of items) {
      const {x, y, w, tag} = item;
      const backX = 792 - x - w;
      if (tag.type === 'napkin') continue;
      assert(front.includes(`1 0 0 1 ${x} ${612 - y} cm`), 'front artwork at packed position');
      if (tag.type !== 'pastry') {
        assert.deepEqual(item.back, []);
        continue;
      }
      assert.notEqual(backX, x, 'fixture exercises actual reflection');
      const source = pastries.find(p => p.id === tag.id);
      const isolated = engine.createProject([source]).sheets[0].items[0];
      assert.deepEqual(item.back, isolated.back, 'ingredients follow their own tag');
      assert(backSvg.includes(`translate(${backX} ${y})`));
      for (const op of isolated.back) {
        const color = op.color.slice(1).match(/../g).map(v => parseInt(v, 16) / 255);
        back.drawSvgPath(op.path, {
          x: backX + op.x, y: 612 - y - op.y, scale: op.scale, color: rgb(...color)
        });
      }
    }
  }

  const reference = await PDFDocument.load(await expected.save());
  for (const [index] of project.sheets.entries()) {
    assert.deepEqual(pdf.getPage(index * 2).getSize(), {width: 792, height: 612});
    assert.deepEqual(pdf.getPage(index * 2 + 1).getSize(), {width: 792, height: 612});
    assert.equal(pageCommands(pdf, index * 2 + 1), pageCommands(reference, index),
      'back has only the expected upright pastry ingredients in mirrored positions');
  }
});
