import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import PDFLib from 'pdf-lib';
import {pack,createEngine,validateGeometry,mirrored,staticDesigns,validateTag} from '../engine.mjs';
import {findPreset,applyPreset,syncIngredients,presetIngredients} from '../presets.mjs';
const types=['freezer','pastry','freezer','provisions','pastry','pastry','pastry','pastry'];
const tag=(type,i)=>({id:String(i),type,title:'Pain',subtitle:'Banane',price:'9',ingredients:'Flour, butter.'});
test('seven mixed tags plus pastry fit upright on one sheet; small tags exceed nine',()=>{
 const tags=types.map(tag),sheets=pack(tags);assert.equal(sheets.length,1);assert.equal(sheets[0].items.length,8);assert.deepEqual(validateGeometry({sheets}),[]);assert.deepEqual(pack(tags),sheets);
 assert.equal(pack(Array.from({length:20},(_,i)=>tag('provisions',i))).length,1);
 const many=pack(Array.from({length:100},(_,i)=>tag(types[i%8],i)));assert.deepEqual(validateGeometry({sheets:many}),[]);
 assert.deepEqual(validateGeometry({sheets:sheets.map(s=>({items:s.items.map(mirrored)}))}),[]);
 assert.equal(sheets[0].items[1].x-sheets[0].items[0].x-sheets[0].items[0].w,1);
});
test('subtitle sync preserves literal terms, edits and dietary settings; reset is explicit',()=>{
 for(const [title,subtitle]of [['Muffin','Bleuets'],['Muffin','Framboises & Chocolat blanc'],['Scone','Chocolat blanc'],['Muffin','Étrange et INCONNU & xyz']]){
  const preset=findPreset(title);let t=applyPreset({type:'pastry',price:'5'},preset).tag;
  t=syncIngredients({...t,subtitle},preset);assert.equal(t.ingredients,preset.ingredients+'\n'+subtitle);
  assert.equal(syncIngredients(t,preset).ingredients,t.ingredients);
  t=syncIngredients({...t,subtitle:'Citron'},preset);assert.equal(t.ingredients,presetIngredients(preset,'Citron'));
  const manual={...t,ingredientSync:false,ingredients:'Staff text',subtitle:'Fraise',vegan:false};
  assert.equal(syncIngredients(manual,preset).ingredients,'Staff text');
  assert.equal(syncIngredients(manual,preset,true).ingredients,presetIngredients(preset,'Fraise'));
  assert.equal(syncIngredients(manual,preset,true).vegan,false);
  assert.equal(syncIngredients({...t,subtitle:''},preset).ingredients,preset.ingredients);
  assert.equal(syncIngredients({...manual,ingredientSync:undefined},preset).ingredients,'Staff text');
 }
});
const art=JSON.parse(fs.readFileSync(new URL('../assets/artwork.json',import.meta.url)));
let fonts;try{fonts=JSON.parse(fs.readFileSync(new URL('../typography/provisional.json',import.meta.url)));}catch{}
test('static designs keep vectors, source geometry and all copies; no fields or backs',{skip:!fonts},async()=>{
 const engine=createEngine(art,fonts,PDFLib),tags=[{id:'side',type:'napkin',design:'side'},{id:'qr',type:'napkin',design:'qr'}];
 for(const t of tags)assert.deepEqual(validateTag(t),[]);
 assert(validateTag({...tags[0],design:'missing'}).length);
 const p=engine.createProject(tags);assert.deepEqual(p.errors,[]);assert.equal(p.sheets.length,1);assert.equal(p.duplex,false);
 const svg=engine.renderSheetSvg(p,0);assert(!svg.includes('<image'));assert(svg.includes('n0_0_clip_1'));assert(svg.includes('n0_1_clip_1'));assert(svg.includes('xlink:href="#n0_1_font_'));
 assert.equal((await PDFLib.PDFDocument.load(await engine.exportPdf(p))).getPageCount(),1);
 const mixed=engine.createProject([...tags,tag('pastry','p'),{...tags[0],id:'copy'}]);assert.deepEqual(mixed.errors,[]);assert.equal(mixed.duplex,true);
 assert.equal((await PDFLib.PDFDocument.load(await engine.exportPdf(mixed))).getPageCount(),mixed.sheets.length*2);
 for(const item of mixed.sheets.flatMap(s=>s.items).filter(i=>i.tag.type==='napkin')){assert.deepEqual(item.back,[]);assert.equal(item.w,staticDesigns[item.tag.design].width);assert.equal(item.h,staticDesigns[item.tag.design].height);}
 const locked=createEngine(art,null,PDFLib);await assert.rejects(()=>locked.exportPdf(locked.createProject(tags)));
});

test('sheet CSS does not resize nested static artwork',()=>{
 const screen=fs.readFileSync(new URL('../editor.css',import.meta.url),'utf8');
 const print=fs.readFileSync(new URL('../print.css',import.meta.url),'utf8');
 assert(screen.includes('.tg-sheet-surface > svg {'));
 assert(print.includes('#tag-print-root .tag-print-sheet > svg {'));
 assert(!screen.includes('.tg-sheet-surface svg {'));
 assert(!print.includes('#tag-print-root svg {'));
});
