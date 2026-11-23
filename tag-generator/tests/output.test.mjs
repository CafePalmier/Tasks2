import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import PDFLib from 'pdf-lib';import {createEngine,initializeEngine,validateGeometry,CUT_GAP,mirrored} from '../engine.mjs';import {createOutput,openPrintContext,showPdf} from '../output.mjs';import {createTextLayout} from '../text-layout.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));const art=read('../assets/artwork.json');let fonts;try{fonts=read('../typography/provisional.json');}catch{}
const base={id:'1',type:'pastry',title:'Carré & café',price:'9.50',ingredients:'Flour, butter, sugar.'};
test('print context opens synchronously; blocked/closed viewer provides fallback',()=>{assert.equal(openPrintContext({open:()=>null}),null);assert.equal(showPdf(null,'blob:x'),false);let target;const viewer={document:{body:{}},location:{replace:u=>target=u}};assert.equal(openPrintContext({open:()=>viewer}),viewer);assert.equal(showPdf(viewer,'blob:pdf'),true);assert.equal(target,'blob:pdf');viewer.closed=true;assert.equal(showPdf(viewer,'blob:pdf'),false);});
test('status distinguishes empty collection and public font gate',()=>{const e=createEngine(art,null,PDFLib),o=createOutput(e);assert.match(o.status(e.createProject([])),/save at least/);assert.match(o.status(e.createProject([base])),/approved typography/);});

test('GitHub Pages uses the public bundle for tag preview and PDF export',async t=>{
  const requests=[];
  t.mock.method(globalThis,'fetch',async url=>{
    const file=url.pathname.split('/').at(-1);
    requests.push(file);
    const data=file==='artwork.json'?art:publicBundle;
    return {ok:data!==undefined,json:async()=>data};
  });
  const location=Object.getOwnPropertyDescriptor(globalThis,'location');
  const pdfLib=Object.getOwnPropertyDescriptor(globalThis,'PDFLib');
  Object.defineProperty(globalThis,'location',{configurable:true,value:{hostname:'cafepalmier.github.io'}});
  Object.defineProperty(globalThis,'PDFLib',{configurable:true,value:PDFLib});
  t.after(()=>{
    for(const [name,descriptor] of [['location',location],['PDFLib',pdfLib]]){
      if(descriptor)Object.defineProperty(globalThis,name,descriptor);
      else delete globalThis[name];
    }
  });
  let publicBundle;
  const missing=await initializeEngine();
  assert.equal(missing.typographyStatus.ready,false);
  publicBundle={lucidity:{},ruddy:{},price:{},ingredients:{}};
  assert.equal((await initializeEngine()).typographyStatus.ready,false);

  publicBundle=read('../typography/approved.json');
  const engine=await initializeEngine();
  assert.equal(engine.typographyStatus.provisional,false);
  const tag={id:'soya',type:'provisions',title:'Lait de soya',price:'6.50'};
  const project=engine.createProject([tag]);
  assert.deepEqual(project.errors,[]);
  assert.ok(project.sheets[0].items[0].fits.title.ops.length);
  assert.doesNotMatch(engine.renderSheetSvg(project,0),/Typography unavailable/);
  const pdf=await PDFLib.PDFDocument.load(await createOutput(engine).bytes([tag]));
  assert.equal(pdf.getPageCount(),1);
  const pastry={...base,ingredients:'Flour, butter, 1 egg.'};
  const duplex=await PDFLib.PDFDocument.load(await createOutput(engine).bytes([pastry]));
  assert.equal(duplex.getPageCount(),2);
  assert.deepEqual(requests,['artwork.json','approved.json','artwork.json','approved.json','artwork.json','approved.json']);
});
test('saved collection download and print bytes identical, including after registration export',{skip:!fonts},async()=>{const e=createEngine(art,fonts,PDFLib),o=createOutput(e);const a=await o.bytes([base]);await o.bytes([base],true);const b=await o.bytes([base]);assert.strictEqual(a,b);const c=await o.bytes([{...base,price:'8'}]);assert.notDeepEqual(a,c);await assert.rejects(o.bytes([{...base,price:'-1'}]),/saved tag errors/);await assert.rejects(o.bytes([{...base,ingredients:'Flour '.repeat(500)}]),/saved tag errors/);});
test('PDF pages, all price digits, mirrored backs, exact geometry and unprinted cutting gaps',{skip:!fonts},async()=>{const e=createEngine(art,fonts,PDFLib);for(const tags of [[base],Array.from({length:9},(_,i)=>({...base,id:String(i)})),Array.from({length:10},(_,i)=>({...base,id:String(i),price:String(i)})),[base,{...base,id:'f',type:'freezer'},{...base,id:'p',type:'provisions'}],[{...base,type:'freezer',ingredients:''}]]){const p=e.createProject(tags);assert.deepEqual(p.errors,[]);const d=await PDFLib.PDFDocument.load(await createOutput(e).bytes(tags));assert.equal(d.getPageCount(),p.sheets.length*(p.duplex?2:1));for(const pg of d.getPages())assert.deepEqual(pg.getSize(),{width:792,height:612});for(const s of p.sheets)for(const item of s.items)assert(Math.abs(mirrored(item).x+item.x+item.w-792)<1e-6);assert(!e.renderSheetSvg(p,0).includes('stroke-width='));}assert.equal(CUT_GAP,1);const bad=e.createProject([base]);bad.sheets[0].items[0].x=790;assert(validateGeometry(bad).length);await assert.rejects(e.exportPdf(bad));});
test('title ink gap is halved without overlap',{skip:!fonts},()=>{const t=createTextLayout(fonts),f=t.fit('lucidity','Pain au chocolat',{x:0,y:0,w:160,h:80},36,14,2);assert.equal(f.lines.length,2);const runs=f.lines.map(l=>t.measure('lucidity',l,f.size)),ink=Math.max(...runs.map(r=>-r.top))+Math.max(...runs.map(r=>r.bottom)),oldStep=Math.max(f.size*1.05,ink+f.size*.15);assert(Math.abs(f.height-(2*ink+(oldStep-ink)/2))<1e-6);});
