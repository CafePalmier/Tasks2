import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import PDFLib from 'pdf-lib';
import {createMenuLayout, menus} from '../menu-layout.mjs';
import {createEngine, tagSize, validateGeometry} from '../engine.mjs';
import {printSheets} from '../print-view.mjs';

const read = file => readFile(new URL('../' + file, import.meta.url));
const fonts = JSON.parse(await read('typography/approved.json'));
const layout = createMenuLayout(fonts);
const engine = createEngine(JSON.parse(await read('assets/artwork.json')), fonts, PDFLib);
const menu = design => ({id: design, type: 'menu', design, rows: menus[design].rows});

test('each menu uses the existing Letter project and exports at its source size', async () => {
  for (const id of Object.keys(menus)) {
    const item = menu(id);
    const project = engine.createProject([item]);
    assert.deepEqual(project.errors, []);
    const [placed] = project.sheets[0].items;
    assert.ok(placed.front.length);
    assert.deepEqual([placed.w, placed.h], tagSize(item));
    const pdf = await PDFLib.PDFDocument.load(await engine.exportPdf(project));
    assert.equal(pdf.getPageCount(), 1);
    assert.deepEqual(pdf.getPage(0).getSize(), {width: 792, height: 612});
  }
});

test('menus pack beside tags while Tea gets a full Letter front and a paired back', async () => {
  const pastry = {id: 'pastry', type: 'pastry', title: 'Muffin', price: '4.50', ingredients: 'Flour, butter, sugar.'};
  const freezer = {id: 'freezer', type: 'freezer', title: 'Croissant', price: '6'};
  const project = engine.createProject([pastry, menu('cocktails'), menu('tea'), freezer], {orientation: 'portrait'});
  assert.deepEqual(project.errors, []);
  assert.deepEqual(validateGeometry(project), []);
  assert.deepEqual(project.sheets[0].items.map(item => item.tag.id), ['pastry', 'cocktails', 'freezer']);
  assert.equal(project.sheets[1].items.length, 1);
  const [tea] = project.sheets[1].items;
  assert.deepEqual([tea.x, tea.y, tea.w, tea.h], [0, 0, 792, 612]);
  assert.ok(tea.front.every(op => op.rotation === 90));
  assert.deepEqual(tea.back, []);
  const markup = printSheets(engine, project);
  assert.equal((markup.match(/viewBox="0 0 612 792"/g) || []).length, 4);
  assert.match(markup, /data-sheet="2" data-side="front"[^]*?translate\(792 612\) rotate\(180\)/);
  const pdf = await PDFLib.PDFDocument.load(await engine.exportPdf(project));
  assert.equal(pdf.getPageCount(), 4);
  for (const page of pdf.getPages()) assert.deepEqual(page.getSize(), {width: 612, height: 792});
});

test('five cocktails fit above the artwork with smaller type and a wrapped name', () => {
  const three = layout('cocktails', menus.cocktails.rows);
  const rows = [
    ...menus.cocktails.rows,
    {title: 'Piña Colada', price: '14,75'},
    {title: 'Cocktail de fleurs de sureau, pamplemousse, romarin et citron', price: '16'},
  ];
  const five = layout('cocktails', rows);
  assert.deepEqual(five.errors, []);
  assert.equal(five.rules.length, 5);
  assert.ok(Math.abs(five.rules.at(-1).y - three.rules.at(-1).y) < 0.001);
  assert.ok(Math.max(...five.ops.map(op => op.scale)) < Math.max(...three.ops.map(op => op.scale)));
  const lastRowName = five.ops.filter(op => op.y > five.rules[3].y && op.x < 250);
  assert.equal(new Set(lastRowName.map(op => op.y)).size, 2);
  assert.ok(lastRowName.every(op => op.y < five.rules[4].y));
});

test('one Tea price refreshes its two languages and only its own category', () => {
  const rows = menus.tea.rows.map(row => ({...row}));
  const original = layout('tea', rows);
  rows[0].price = '9,75';
  const changed = layout('tea', rows);
  assert.deepEqual(changed.errors, []);
  const french = changed.ops.slice(0, 4);
  const english = changed.ops.slice(4, 8);
  assert.deepEqual(french.map(op => op.path), english.map(op => op.path));
  assert.notDeepEqual(french, original.ops.slice(0, 4));
  assert.notDeepEqual(english, original.ops.slice(4, 8));
  assert.ok(english[0].x - french[0].x > 270);
  assert.deepEqual(changed.ops.slice(8), original.ops.slice(8));
});

test('extra Cold Drinks rows extend the beige panel below the text at the original cut size', async () => {
  const item = menu('drinks');
  const rows = [
    ...item.rows,
    {title: 'Limonade au gingembre', description: 'Citron frais et gingembre', price: '5.25'},
    {title: 'Hibiscus glacé', description: 'Hibiscus, lime et menthe', price: '5.50'},
    {title: 'Thé à la pêche', description: 'Thé noir, pêche blanche et vanille', price: '5.75'},
  ];
  const normal = layout('drinks', item.rows);
  const extended = [3, 4, 5].map(count => layout('drinks', rows.slice(0, count)));
  assert.equal(normal.cover, undefined);
  for (const [index, fitted] of extended.entries()) {
    assert.deepEqual(fitted.errors, []);
    assert.equal(fitted.rules.length, index + 3);
    assert.ok(fitted.cover.bottom > fitted.rules.at(-1).y);
    assert.ok(fitted.cover.bottom <= 216);
    assert.ok(fitted.ops.some(op => op.y > 160.68));
  }
  assert.ok(extended[0].cover.bottom < extended[1].cover.bottom);
  const project = engine.createProject([{...item, rows}]);
  assert.deepEqual(project.errors, []);
  const [placed] = project.sheets[0].items;
  assert.deepEqual([placed.w, placed.h], tagSize(item));
  assert.equal(placed.front[0].color, '#eae1d3');
  assert.deepEqual(placed.front[0].cmyk, [0.068, 0.087, 0.15, 0.004]);
  assert.ok(printSheets(engine, project).includes(`d="${placed.front[0].path}"`));
  assert.equal((await PDFLib.PDFDocument.load(await engine.exportPdf(project))).getPageCount(), 1);
});

test('removing original drink or cocktail rows saves the shorter menu without a background extension', () => {
  for (const id of ['cocktails', 'drinks']) {
    const item = menu(id);
    for (const rows of [item.rows.slice(1), []]) {
      const project = engine.createProject([{...item, rows}]);
      assert.deepEqual(project.errors, []);
      assert.deepEqual(project.tags[0].rows, rows);
      assert.equal(layout(id, rows).rules.length, rows.length);
      assert.equal(layout(id, rows).cover, undefined);
    }
  }
});
