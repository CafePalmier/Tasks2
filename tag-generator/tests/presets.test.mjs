import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import PDFLib from 'pdf-lib';import {presets,freezerPresets,suggestions,findPreset,applyPreset} from '../presets.mjs';import {createEngine} from '../engine.mjs';
import {createLibrary,identity} from '../library.mjs';
test('Amandine can fit the full ingredient list at 7.5 pt and export both sides',async()=>{
 const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
 const engine=createEngine(read('../assets/artwork.json'),read('../typography/approved.json'),PDFLib);
 const recipe=createLibrary({getItem:()=>null}).all().find(p=>p.title==='Amandine'&&!p.subtitle);
 const tag={...recipe,id:'amandine',price:'4'};
 const project=engine.createProject([tag]);
 assert.deepEqual(project.errors,[]);
 const fit=project.sheets[0].items[0].fits.ingredients;
 assert.equal(fit.size,7.5);
 assert.equal(fit.lines.join(' '),recipe.ingredients.replace(/\s+/g,' '));
 const pdf=await PDFLib.PDFDocument.load(await engine.exportPdf(project));
 assert.equal(pdf.getPageCount(),2);

 const short=engine.createProject([{...tag,ingredients:'Flour, butter, sugar.'}]);
 assert.equal(short.sheets[0].items[0].fits.ingredients.size,11);
 const other=engine.createProject([{...tag,title:'Croissant'}]);
 assert.equal(other.errors.find(error=>error.field==='ingredients').minSize,8);
});
test('all-caps ingredients use title case in built-in and historical presets',()=>{
 const library=createLibrary({getItem:()=>null}).all();
 for(const [title,expected] of [
  ['Croissant',/Wheat flour, Charentes-Poitou PDO butter \(Milk\) 23%/],
  ['Pain au chocolat',/Contains: Wheat, Milk, Soy, Eggs\. May Contain: Sesame, Tree Nuts\./],
  ['Amandine',/^Dough \(Unbleached Enriched Wheat Flour/],
  ['Épinard & Feta',/Spinach And Feta Filling/],
 ]){
  const preset=findPreset(title);
  assert.match(preset.ingredients,expected);
  assert.match(library.find(record=>identity(record)===identity(preset)).ingredients,expected);
 }
});
test('dropdown lists all presets, filters accents and aliases without duplicate options',()=>{assert.equal(suggestions().length,presets.length);assert.equal(new Set(presets.map(p=>p.title)).size,presets.length);assert.equal(findPreset('Amanding').title,'Amandine');assert.equal(findPreset('Scones').title,'Scone');assert.equal(suggestions('epinard')[0].title,'Épinard & Feta');assert.equal(suggestions('unlisted').length,0);});
test('freezer title dropdown provides saved titles and still filters',()=>{assert.deepEqual(freezerPresets.map(p=>p.title),['Tarte','Lasagna','Buscuits']);assert.deepEqual(suggestions('', 'freezer').map(p=>p.title),['Tarte','Lasagna','Buscuits']);assert.equal(suggestions('las','freezer')[0].title,'Lasagna');assert.equal(findPreset('buscuits','freezer').title,'Buscuits');assert.equal(findPreset('custom freezer title','freezer'),undefined);});
test('defaults remain editable and prices independent; conflicts preserve edited data',()=>{for(const [name,v,g]of [['Muffin',true,true],['Poptart',true,false],['Power',true,true]]){const p=findPreset(name),r=applyPreset({price:'6.50'},p).tag;assert.equal(r.vegan,v);assert.equal(r.glutenFree,g);assert.equal(r.ingredients,p.ingredients);assert.equal(r.price,'6.50');}const old=findPreset('Muffin'),current={...old,ingredients:old.ingredients+' Added fruit.',vegan:false,price:'4'},next=findPreset('Poptart'),r=applyPreset(current,next,old);assert(r.conflicts.includes('ingredients'));assert.equal(r.tag.ingredients,current.ingredients);assert.equal(r.tag.vegan,false);assert.equal(applyPreset(current,next,old,true).tag.ingredients,next.ingredients);assert.equal(applyPreset({...old,price:'5'},next,old).tag.ingredients,next.ingredients);assert(!('price'in next));});
let fonts;try{fonts=JSON.parse(fs.readFileSync(new URL('../typography/provisional.json',import.meta.url)));}catch{}
test('combined measured group centred, per-tag colours, and saved compatibility',{skip:!fonts},()=>{const e=createEngine(JSON.parse(fs.readFileSync(new URL('../assets/artwork.json',import.meta.url))),fonts,PDFLib);for(const title of ['Pain','Pain au chocolat']){const p=e.createProject([{id:'x',type:'pastry',title,subtitle:'The Motherboard',price:'4',ingredients:'Flour, butter, sugar.'}]),f=p.sheets[0].items[0].fits;assert.deepEqual(p.errors,[]);assert(Math.abs((f.title.visualTop+f.subtitle.visualTop+f.subtitle.height)/2-(10.434+110.653)/2)<1e-6);assert(Math.abs(f.subtitle.visualTop-f.title.visualTop-f.title.height-4)<1e-6);}for(const title of ['Muffin','Power','Pépites de chocolat']){const preset=findPreset(title),p=e.createProject([{...preset,id:title,type:'pastry',price:'4'}]);assert.deepEqual(p.errors,[]);assert(p.sheets[0].items[0].fits.title.ops.every(o=>o.color===preset.titleColor));}});
