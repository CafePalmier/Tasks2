import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import PDFLib from 'pdf-lib';import {createEngine} from '../engine.mjs';import {createTextLayout} from '../text-layout.mjs';import {diagnosticRows} from '../diagnostics.mjs';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root)));const art=await read('assets/artwork.json');let fonts;try{fonts=await read('typography/provisional.json');}catch{}
const check=(name,fn)=>test(name,{skip:!fonts},fn),base={id:'a',type:'pastry',title:'Pain',subtitle:'',price:'4.50',ingredients:'Flour, butter, sugar.'};
test('subtitles wrap at full size when two lines fit in the cream panel',async()=>{
 const approved=await read('typography/approved.json');
 const engine=createEngine(art,approved,PDFLib),layout=createTextLayout(approved);
 for(const [type,subtitle,size,cream] of [
  ['pastry','Canneberges & chocolat blanc',14.5,[10.434,110.653]],
  ['freezer','Canneberges & chocolat blanc & érable',10,[12.197,68.500]],
  ['provisions','Canneberges & chocolat blanc',10,[10.065,89.572]]
 ]){
  const tag={...base,type,title:'Croissant aux amandes',subtitle};
  const project=engine.createProject([tag]);
  assert.deepEqual(project.errors,[]);
  const {title,subtitle:fit}=project.sheets[0].items[0].fits;
  assert.equal(fit.size,size);
  assert.equal(fit.lines.length,2);
  assert.equal(fit.lines.join(' '),subtitle);
  assert.ok(layout.measure('ruddy',subtitle,size).width>fit.box.w);
  assert.ok(fit.width<=fit.box.w && fit.height<=fit.box.h);
  assert.ok(title.visualTop>=cream[0]+4);
  assert.ok(fit.visualTop+fit.height<=cream[1]-4);
  assert.ok(Math.abs(fit.visualTop-title.visualTop-title.height-4)<1e-6);

  const short=engine.createProject([{...tag,subtitle:'Banane'}]).sheets[0].items[0].fits.subtitle;
  assert.equal(short.size,size);
  assert.deepEqual(short.lines,['Banane']);
 }
});
check('reference Ruddy advances, measured ink centring, and subtitle examples',()=>{const text=createTextLayout(fonts);assert.equal(fonts.ruddy.a.advance,.594);assert.equal(fonts.ruddy.B.advance,.638);for(const type of ['pastry','provisions'])for(const subtitle of ['Banane','Citron & Framboises','Canneberges & chocolat blanc']){const p=createEngine(art,fonts,PDFLib).createProject([{...base,type,subtitle}]);assert.deepEqual(p.errors,[]);const f=p.sheets[0].items[0].fits.subtitle;assert(f.size>=8);assert(f.width<=f.box.w);for(const line of f.lines){const run=text.measure('ruddy',line,f.size);assert(run.width<=f.box.w);}}});
check('reference price baselines and physical clearance',()=>{const e=createEngine(art,fonts,PDFLib);for(const [type,baseline] of [['pastry',140.347],['freezer',85.771],['provisions',110.119049]]){const p=e.createProject([{...base,type}]),f=p.sheets[0].items[0].fits.price;assert(Math.abs(f.baseline-baseline)<1e-6);if(type==='provisions'){const r=createTextLayout(fonts).measure('price','$4.50',f.size);assert(f.baseline+r.top>96.154);assert(f.baseline+r.bottom<116.22-2);}}});
check('separate field diagnostics exhaust sizes, retain valid fields, never mutate content',()=>{const e=createEngine(art,fonts,PDFLib),tag={...base,title:'Pain '.repeat(150),subtitle:'Banane '.repeat(150),ingredients:'Flour, butter, sugar. '.repeat(60)},original=JSON.stringify(tag),p=e.createProject([tag]);assert.deepEqual(p.errors.map(x=>x.field),['title','subtitle','ingredients']);assert.equal(JSON.stringify(tag),original);assert(p.sheets[0].items[0].fits.price);assert(p.errors.every(x=>x.measured&&x.available&&x.minSize));const rows=diagnosticRows({...p,errors:[...p.errors,...p.errors]});assert.equal(rows.length,3);assert(rows.every(x=>x.includes('Tag 1')&&x.includes('pt')));});
check('long ingredient words try smaller readable sizes before rejecting',()=>{const t=createTextLayout(fonts);let word='m';while(t.measure('ingredients',word,11).width<=176)word+='m';const f=t.ingredients(word,{x:12,y:16,w:176,h:126.5});assert(f.size<11&&f.size>=8);assert.equal(f.lines.join(''),word);});
check('one and two line titles, exact minimum size, blank subtitle and price boundaries',async()=>{const e=createEngine(art,fonts,PDFLib);for(const type of ['pastry','freezer','provisions']){const short=e.createProject([{...base,type,title:'Pain'}]),long=e.createProject([{...base,type,title:'Croissant aux amandes'}]);assert.equal(short.sheets[0].items[0].fits.title.lines.length,1);assert.equal(long.sheets[0].items[0].fits.title.lines.length,2);assert(!short.sheets[0].items[0].fits.subtitle);assert.equal((await PDFLib.PDFDocument.load(await e.exportPdf(long))).getPageCount(),type==='pastry'?2:1);}const t=createTextLayout(fonts),width=t.measure('ruddy','Banane',8).width;assert.equal(t.fit('ruddy','Banane',{x:0,y:0,w:width,h:20},10,8,1).size,8);assert.equal(e.createProject([{...base,price:'8888888'}]).errors.length,0);const p=e.createProject([{...base,vegan:true,price:'8888888'}]);assert.equal(p.errors[0].field,'price');});
check('preview and PDF use identical path coordinates and scales',async()=>{const calls=[],fake={...PDFLib,PDFDocument:{async create(){return {setTitle(){},catalog:{getOrCreateViewerPreferences:()=>({setPrintScaling(){},setDuplex(){}})},addPage:()=>({drawRectangle(){},drawSvgPath:(path,options)=>calls.push({path,...options})}),save:async()=>new Uint8Array()};}}};const e=createEngine(art,fonts,fake),p=e.createProject([{...base,subtitle:'Citron & Framboises'},{...base,id:'b',type:'provisions'}]);await e.exportPdf(p);let index=0;for(const sheet of p.sheets)for(const side of ['front','back']){const svg=e.renderSheetSvg(p,p.sheets.indexOf(sheet),side);for(const item of sheet.items){const x=side==='back'?792-item.x-item.w:item.x;const ops=side==='front'?[...art[item.tag.type].shapes.map(s=>({...s,x:0,y:0,scale:1})),...item.front]:item.back;for(const op of ops){const call=calls[index++];assert.equal(call.path,op.path);assert.equal(call.x,x+op.x);assert.equal(call.y,612-item.y-op.y);assert.equal(call.scale,op.scale);assert(svg.includes(`translate(${op.x} ${op.y}) scale(${op.scale})`));}}}assert.equal(calls.length,index);});
