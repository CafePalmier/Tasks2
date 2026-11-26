import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import PDFLib from 'pdf-lib';import {createEngine,pack,validateGeometry,SIZES,mirrored} from '../engine.mjs';import {AIRPRINT_LAYOUT,printSheets,requestDirectPrint,requiresPrintPdf,usesPortraitPrint} from '../print-view.mjs';import {createOutput} from '../output.mjs';
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


test('iPad opens print settings directly with one guarded front and back for the mixed Scone job', async () => {
  const engine = createEngine(art,read('../typography/approved.json'),PDFLib,AIRPRINT_LAYOUT);
  const output = createOutput(engine);
  const tags = [
    {id:'scone',type:'pastry',title:'Scone',subtitle:'Ciboulettes & Fromage',price:'4.50',ingredients:'Flour, butter, cheese, chives.'},
    {id:'cookies',type:'freezer',title:'Biscuits',subtitle:'Froot Loops',price:'18'},
    {id:'scale',type:'provisions',title:'Balance à café',subtitle:'Timemore Black Mirror Basic 2',price:'85'},
  ];
  const project = engine.createProject(tags,{orientation:'portrait',flipEdge:'long'});
  assert.deepEqual(project.errors,[]);
  const properties = new Map();
  const root = {innerHTML:'',style:{setProperty(key,value){properties.set(key,value);}}};
  let calls = 0;
  requestDirectPrint(engine,project,root,{
    open(){assert.fail('iPad printing should stay in the editor');},
    print(){
      calls++;
      assert.deepEqual([...root.innerHTML.matchAll(/viewBox="([^"]*)"/g)].map(match=>match[1]),[
        '72 108 468 576','72 108 468 576',
      ]);
      assert.match(root.innerHTML,/data-side="front"[\s\S]*data-side="back"/);
      assert.ok(Math.abs(parseFloat(properties.get('--tag-print-width'))*5.32-468)<1e-9);
      assert.ok(Math.abs(parseFloat(properties.get('--tag-print-top'))*5.32-68)<1e-9);
    },
  });
  assert.equal(calls,1);
  const [{items}] = project.sheets;
  assert.deepEqual(items.map(item=>item.back.length>0),[true,false,false]);
  const pdf = await PDFLib.PDFDocument.load(await output.bytes(tags,false,'long','portrait'));
  assert.equal(pdf.getPageCount(),2);
  for(const page of pdf.getPages())assert.deepEqual(page.getSize(),{width:612,height:792});
  const prefs = pdf.catalog.getOrCreateViewerPreferences();
  assert.equal(prefs.getDuplex(),PDFLib.Duplex.DuplexFlipLongEdge);
  assert.equal(prefs.getPrintScaling(),PDFLib.PrintScaling.None);
});

test('direct iPad printing refuses artwork outside its frame and preserves blank duplex backs', () => {
  const fonts = read('../typography/approved.json');
  const unrestricted = createEngine(art,fonts,PDFLib);
  const unsafe = unrestricted.createProject([{...base,type:'freezer',ingredients:''}],{orientation:'portrait'});
  const browser = {print(){assert.fail('The job must not reach the print dialog');}};
  assert.throws(()=>requestDirectPrint(unrestricted,unsafe,{},browser),/does not fit/);

  const engine = createEngine(art,fonts,PDFLib,AIRPRINT_LAYOUT);
  const job = engine.createProject([
    base,
    ...Array.from({length:12},(_,i)=>({id:'freezer-'+i,type:'freezer',title:'Pain',price:'9'})),
  ],{orientation:'portrait',flipEdge:'short'});
  assert.deepEqual(job.errors,[]);
  const sides = [...printSheets(engine,job,{airPrint:true}).matchAll(/data-sheet="(\d+)" data-side="(front|back)"/g)];
  assert.equal(sides.length,job.sheets.length*2);
  assert.ok(job.sheets.some(sheet=>sheet.items.every(item=>!item.back.length)));
  sides.forEach((match,index)=>{
    assert.equal(Number(match[1]),Math.floor(index/2)+1);
    assert.equal(match[2],index%2?'back':'front');
  });
  const tea={id:'tea',type:'menu',design:'tea',rows:[
    {price:'4.50'},{price:'4.50'},{price:'7.00'},
  ]};
  const teaJob=engine.createProject([base,tea],{orientation:'portrait'});
  assert.equal(requiresPrintPdf(teaJob),true);
  assert.throws(()=>requestDirectPrint(engine,teaJob,{},browser),/Download PDF/);
});
