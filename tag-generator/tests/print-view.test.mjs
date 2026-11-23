import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import PDFLib from 'pdf-lib';import {createEngine,pack,validateGeometry,SIZES,mirrored} from '../engine.mjs';import {printSheets,requestDirectPrint,usesPortraitPrint} from '../print-view.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));let fonts;try{fonts=read('../typography/provisional.json');}catch{}const art=read('../assets/artwork.json');const base={id:'one',type:'pastry',title:'Pain au chocolat',subtitle:'Banane',price:'9',ingredients:'Flour, butter, sugar.'};
test('centred 3 by 3 grid has precisely 1 pt background gaps',()=>{const s=pack(Array.from({length:9},(_,i)=>({...base,id:String(i)})))[0];assert.equal(s.items.length,9);for(let i=0;i<9;i++){const p=s.items[i];if(i%3<2)assert(Math.abs(s.items[i+1].x-p.x-p.w-1)<1e-6);if(i<6)assert(Math.abs(s.items[i+3].y-p.y-p.h-1)<1e-6);}assert(Math.abs(s.items[0].x-(792-s.items[8].x-s.items[8].w))<1e-6);});
test('mixed and multischeet minimum gaps, immutable sizes, mirrored separation',()=>{const tags=Array.from({length:90},(_,i)=>({...base,id:String(i),type:['pastry','freezer','provisions'][i%3]}));const sheets=pack(tags);assert(sheets.length>1);assert.deepEqual(validateGeometry({sheets}),[]);assert.deepEqual(validateGeometry({sheets:sheets.map(s=>({items:s.items.map(mirrored)}))}),[]);for(const s of sheets)for(const p of s.items)assert.deepEqual([p.w,p.h],SIZES[p.tag.type]);sheets[0].items[1].x=sheets[0].items[0].x+sheets[0].items[0].w+.5;assert(validateGeometry({sheets}).length);});
test('print CSS requests exact points, no margins, no editor, and no final blank page',()=>{const css=fs.readFileSync(new URL('../print.css',import.meta.url),'utf8');assert.match(css,/@page\s*{ size: 792pt 612pt; margin: 0/);assert.match(css,/body > :not\(#tag-print-root\)/);assert.match(css,/:last-child.*break-after: auto/);assert.match(css,/width: 792pt; height: 612pt/);assert(!css.includes('scale('));});
test('direct print stays synchronous and uses exactly shared preview geometry',{skip:!fonts},()=>{const e=createEngine(art,fonts,PDFLib),p=e.createProject(Array.from({length:10},(_,i)=>({...base,id:String(i)}))),html=printSheets(e,p);assert.equal((html.match(/class="tag-print-sheet"/g)||[]).length,4);for(let i=0;i<2;i++)for(const side of ['front','back'])assert(html.includes(e.renderSheetSvg(p,i,side)));assert(!html.includes('stroke-width'));assert(!html.includes('<img'));let calls=0;const root={innerHTML:''};const result=requestDirectPrint(e,p,root,{print(){calls++;assert.equal(root.innerHTML,html);},open(){throw Error('Primary path must not open a popup');}});assert.equal(result,undefined);assert.equal(calls,1);assert.throws(()=>requestDirectPrint(e,p,root,{}),/Download the PDF/);assert.throws(()=>requestDirectPrint(e,p,root,{print(){throw Error('PWA printing unavailable');}}),/PWA/);});
test('validation and licensing prevent native print; no pastry gives only fronts',{skip:!fonts},()=>{const e=createEngine(art,fonts,PDFLib),root={innerHTML:''};let count=0;assert.throws(()=>requestDirectPrint(e,e.createProject([{...base,price:'-9'}]),root,{print(){count++;}}));assert.equal(count,0);const locked=createEngine(art,null,PDFLib);assert.throws(()=>printSheets(locked,locked.createProject([base])),/approved typography/);const p=e.createProject([{...base,type:'freezer',ingredients:''}]);assert.equal((printSheets(e,p).match(/class="tag-print-sheet"/g)||[]).length,1);});

test('iPad and iPhone use portrait printing, including iPad desktop mode',()=>{
  assert.equal(usesPortraitPrint({userAgent:'iPhone Safari'}),true);
  assert.equal(usesPortraitPrint({userAgent:'iPad Safari'}),true);
  assert.equal(usesPortraitPrint({userAgent:'Macintosh Safari',platform:'MacIntel',maxTouchPoints:5}),true);
  assert.equal(usesPortraitPrint({userAgent:'Macintosh Safari',platform:'MacIntel',maxTouchPoints:0}),false);
  assert.equal(usesPortraitPrint({userAgent:'Android Chrome',platform:'Linux armv8l',maxTouchPoints:5}),false);
});

test('direct portrait printing sends a rotated front and back to the print dialog',()=>{
 const engine=createEngine(art,read('../typography/approved.json'),PDFLib);
 const project=engine.createProject([base],{orientation:'portrait',flipEdge:'long'});
 const [{x}]=project.sheets[0].items;
 const printableHeight=Math.ceil(792-x-24);
 const root={innerHTML:''};
 let calls=0;
 requestDirectPrint(engine,project,root,{
  print(){
   calls++;
   const viewBoxes=Array.from(root.innerHTML.matchAll(/viewBox="([^"]*)"/g),match=>match[1]);
   assert.deepEqual(viewBoxes,[`24 24 564 ${printableHeight}`,`24 24 564 ${printableHeight}`]);
   assert.ok(printableHeight<744);
   assert.equal((root.innerHTML.match(/matrix\(0 -1 1 0 0 792\)/g)||[]).length,2);
   assert.match(root.innerHTML, /data-side="back"[^]*matrix\(0 -1 1 0 0 792\) translate\(792 612\) rotate\(180\)/);
   assert.ok(root.innerHTML.indexOf('data-side="front"')<root.innerHTML.indexOf('data-side="back"'));
  },
  open(){throw Error('Print Tags should open the print dialog directly');}
 });
 assert.equal(calls,1);
});
