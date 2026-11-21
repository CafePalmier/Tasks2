import fs from 'node:fs/promises';import PDFLib from 'pdf-lib';import {createEngine} from '../engine.mjs';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await fs.readFile(new URL(p,root)));
const fonts=await read('typography/provisional.json'),engine=createEngine(await read('assets/artwork.json'),fonts,PDFLib);
const base={title:'Pain',price:'4.50',ingredients:'Flour, butter, sugar. Contains: milk.'};
const records=[],samples=[];let id=0;
for(const type of ['pastry','freezer','provisions'])for(const title of ['Pain','Muffin','Brownie','Pain doré','Chocolat noir','Croissant','Confiture de fraises','Pain au chocolat','Croissant aux amandes','Pain au chocolat et noisettes','Chocolat blanc et canneberges','Mélange de céréales et fruits séchés','Pain au chocolat et noisettes et canneberges']) {
 const tag={...base,type,title,id:String(++id)},p=engine.createProject([tag]),f=p.sheets[0].items[0].fits.title;
 records.push({type,field:'title',text:title,size:f?.size,lines:f?.lines,width:f?.width,height:f?.height,errors:p.errors});
 if(f&&['Pain','Pain au chocolat','Pain au chocolat et noisettes'].includes(title))samples.push(tag);
}
for(const type of ['pastry','provisions'])for(const subtitle of ['Banane','Citron & Framboises','Canneberges & chocolat blanc']) {
 const tag={...base,type,subtitle,id:String(++id)},p=engine.createProject([tag]),f=p.sheets[0].items[0].fits.subtitle;
 records.push({type,field:'subtitle',text:subtitle,size:f?.size,lines:f?.lines,width:f?.width,height:f?.height,errors:p.errors});if(!p.errors.length)samples.push(tag);
}
for(const n of [1,5,10,15,20,25]){const tag={...base,type:'pastry',id:String(++id),ingredients:Array(n).fill('Flour, butter, sugar.').join(' ')},p=engine.createProject([tag]),f=p.sheets[0].items[0].fits.ingredients;records.push({type:'pastry',field:'ingredients',repetitions:n,characters:tag.ingredients.length,size:f?.size,lines:f?.lines.length,height:f?.height,errors:p.errors});if(f&&[1,10].includes(n))samples.push(tag);}
await fs.mkdir(new URL('samples/',root),{recursive:true});await fs.writeFile(new URL('samples/fitting-report.json',root),JSON.stringify(records,null,2));
const p=engine.createProject(samples);if(p.errors.length)throw Error(JSON.stringify(p.errors));await fs.writeFile(new URL('samples/fitting-review.pdf',root),await engine.exportPdf(p));
await fs.writeFile(new URL('samples/fitting-review-model.json',root),JSON.stringify(p));
for(let i=0;i<p.sheets.length;i++)for(const side of ['front','back'])await fs.writeFile(new URL(`samples/fitting-${i}-${side}.svg`,root),engine.renderSheetSvg(p,i,side));
for(const r of records)console.log(r.type,r.field,r.text||`${r.characters} characters`,r.errors.length?r.errors.map(e=>e.field+': '+e.message).join('; '):`${r.size} pt, ${Array.isArray(r.lines)?r.lines.length:r.lines} lines, ${r.width?.toFixed(1)||'—'} × ${r.height?.toFixed(1)} pt`);
for(const font of ['ruddy','price','ingredients'])console.log(font,'estimated:',Object.entries(fonts[font]).filter(([,g])=>g.metricSource?.startsWith('estimated')).map(([c])=>c).join(''),'missing ASCII:',Array.from({length:95},(_,i)=>String.fromCharCode(32+i)).filter(c=>!fonts[font][c]).join(''));
