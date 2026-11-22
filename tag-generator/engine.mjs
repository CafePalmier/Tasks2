import {staticDesigns} from './assets/static-designs.mjs';
export {staticDesigns};
export const isStatic=t=>t.type==='napkin';
export const tagSize=t=>isStatic(t)?[staticDesigns[t.design]?.width,staticDesigns[t.design]?.height]:SIZES[t.type];
import {priceGlyphIssues} from './price-glyphs.mjs';
import {createTextLayout, FitError} from './text-layout.mjs';
export const SIZES={pastry:[199.9674,154.5202],freezer:[212.234,101.503],provisions:[141.732,116.220]};
export const normalizePrice=v=>{const s=String(v??'').trim().replace(/^\$\s*/,'');return /^\d{1,7}(?:[.,]\d{1,2})?$/.test(s)?'$'+Number(s.replace(',','.')).toFixed(2):null;};
export const normalizeFrontText=v=>String(v??'').normalize('NFC').replace(/(?<![\p{L}\p{N}])et(?![\p{L}\p{N}])/gu,'&').trim();
export function normalizeTitleText(value){
 let opening=true;
 return normalizeFrontText(value).replace(/["“”]/g,char=>{const left=char==='“'||(char==='"'&&opening);opening=!left;return left?'«':'»';}).replace(/«\s*/g,'«\u00a0').replace(/\s*»/g,'\u00a0»');
}
export function validateTag(t){const e=[];if(isStatic(t))return staticDesigns[t.design]?[]:[{field:'design',message:'Choose a Napkin Holder design.'}];if(!SIZES[t.type])e.push({field:'type',message:'Choose a tag format.'});if(!String(t.title??'').trim())e.push({field:'title',message:'Enter a French title.'});if(!normalizePrice(t.price))e.push({field:'price',code:'invalid-price',message:'Enter a valid non-negative price.'});if(t.type==='pastry'&&!String(t.ingredients??'').trim())e.push({field:'ingredients',message:'Enter the English ingredients.'});return e;}
export const CUT_GAP=1;
export function pack(tags){if(!tags.length)return [];if(tags.every(t=>t.type==='pastry'))return Array.from({length:Math.ceil(tags.length/9)},(_,s)=>({items:tags.slice(s*9,s*9+9).map((tag,i)=>({tag,x:(792-3*SIZES.pastry[0]-2*CUT_GAP)/2+(i%3)*(SIZES.pastry[0]+CUT_GAP),y:(612-3*SIZES.pastry[1]-2*CUT_GAP)/2+Math.floor(i/3)*(SIZES.pastry[1]+CUT_GAP),w:SIZES[tag.type][0],h:SIZES[tag.type][1]}))}));
// Maximal free rectangles retain space spanning the old guillotine strip boundaries.
const sheets=[];
for(const tag of tags){
 const [w,h]=tagSize(tag);let sheet,slot;
 for(const candidate of sheets){slot=candidate.free.filter(r=>r.w>=w&&r.h>=h).sort((a,b)=>a.y-b.y||a.x-b.x||a.w*a.h-b.w*b.h)[0];if(slot){sheet=candidate;break;}}
 if(!sheet){sheet={items:[],free:[{x:36,y:36,w:720,h:540}]};sheets.push(sheet);slot=sheet.free[0];}
 const placed={tag,x:slot.x,y:slot.y,w,h};sheet.items.push(placed);
 // Reserve a one-point halo; overlapping free rectangles are alternatives, not slots.
 const left=placed.x-CUT_GAP,top=placed.y-CUT_GAP,right=placed.x+w+CUT_GAP,bottom=placed.y+h+CUT_GAP;
 const free=[];
 for(const r of sheet.free){const rx=r.x+r.w,ry=r.y+r.h;
  if(right<=r.x||left>=rx||bottom<=r.y||top>=ry){free.push(r);continue;}
  if(left>r.x)free.push({...r,w:left-r.x});
  if(right<rx)free.push({...r,x:right,w:rx-right});
  if(top>r.y)free.push({...r,h:top-r.y});
  if(bottom<ry)free.push({...r,y:bottom,h:ry-bottom});
 }
 sheet.free=free.filter((r,i)=>!free.some((q,j)=>i!==j&&q.x<=r.x&&q.y<=r.y&&q.x+q.w>=r.x+r.w&&q.y+q.h>=r.y+r.h&&(j<i||q.x!==r.x||q.y!==r.y||q.w!==r.w||q.h!==r.h)));
}
return sheets;
}
export const mirrored=p=>({...p,x:792-p.x-p.w});
export function validateGeometry(project) {
 const errors=[];
 for(const sheet of project.sheets)for(const [i,p] of sheet.items.entries()) {
  const size=tagSize(p.tag),back=mirrored(p);
  if(!size||![p.x,p.y,p.w,p.h].every(Number.isFinite)||p.w!==size[0]||p.h!==size[1]||p.x<0||p.y<0||p.x+p.w>792||p.y+p.h>612||Math.abs(back.x+p.x+p.w-792)>1e-6)
   errors.push({id:p.tag.id,field:'geometry',code:'geometry',message:'Tag or reverse placement is outside the exact Letter sheet geometry. Reload the generator before exporting.'});
  for(const q of sheet.items.slice(i+1))if(p.x<q.x+q.w+CUT_GAP-1e-7&&q.x<p.x+p.w+CUT_GAP-1e-7&&p.y<q.y+q.h+CUT_GAP-1e-7&&q.y<p.y+p.h+CUT_GAP-1e-7)errors.push({id:p.tag.id,field:'geometry',code:'geometry',message:'Tags overlap or have less than the 1 pt cutting gap. Reload the generator before exporting.'});
 }
 return errors;
}
export function createEngine(artwork,fonts,PDFLib){
 const ready=!!fonts;
 const text=createTextLayout(fonts);
 function content(t) {
   if(isStatic(t))return {front:[],back:[],fits:{},errors:[]};
   const [w,h]=SIZES[t.type], sub=normalizeFrontText(t.subtitle);
   const top=t.type==='pastry'?24:t.type==='freezer'?22:18, bottom=t.type==='pastry'?102:t.type==='freezer'?60:82;
   const titleInset=t.type==='freezer'?26:20;
   const result={front:[],back:[],fits:{},errors:[]};
   function field(name,fn,side='front') {
     if(validateTag(t).some(e=>e.field===name))return;
     try {const fit=fn();result.fits[name]=fit;result[side].push(...fit.ops);}
     catch(e){if(!(e instanceof FitError))throw e;result.errors.push({field:name,message:e.message,code:e.code,measured:e.measured,available:e.available,minSize:e.minSize,missingGlyphs:e.missingGlyphs});}
   }
   field('title',()=>text.fit('lucidity',normalizeTitleText(t.title),{x:titleInset,y:top,w:w-titleInset*2,h:bottom-top-(sub?24:0)},t.type==='pastry'?36:24,14,2,'Title'));
   if(sub)field('subtitle',()=>text.fit('ruddy',sub,{x:20,y:bottom-20,w:w-40,h:20},t.type==='pastry'?14.5:10,8,t.type==='provisions'?2:1,'Subtitle'));
   // Reposition the measured ink blocks as a single composition inside the cream.
   const title=result.fits.title, subtitle=result.fits.subtitle;
   if(title&&(!sub||subtitle)) {
     const cream=t.type==='pastry'?[10.434,110.653]:t.type==='freezer'?[12.197,68.500]:[10.065,89.572];
     const gap=subtitle?4:0, total=title.height+(subtitle?.height||0)+gap;
     let y=(cream[0]+cream[1]-total)/2;
     for(const f of [title,subtitle].filter(Boolean)) {
       const oldTop=f.box.y+(f.box.h-f.height)/2, shift=y-oldTop;
       for(const op of f.ops)op.y+=shift;
       f.visualTop=y;y+=f.height+gap;
     }
   }
   if(t.titleColor==='#c68b70'&&title)for(const op of title.ops)op.color='#c68b70';
   field('price',()=>{
     const size=t.type==='pastry'?16.9392:t.type==='freezer'?12.4887:11.9155;
     // Source baselines relative to the pink cut rectangle. Preserve pastry/freezer.
     const baseline=t.type==='provisions'?110.119049:h-(t.type==='pastry'?14.1732:15.732);
     const formatted=normalizePrice(t.price), issues=priceGlyphIssues(formatted,fonts.price);
     if(issues.missing.length)throw new FitError(`${formatted} is a valid price, but Metropolis Medium Italic is missing ${issues.missing.map(c=>'“'+c+'”').join(', ')}. The price is saved; PDF export requires these original font glyphs.`,{code:'missing-glyph',missingGlyphs:issues.missing});
     if(issues.invalidMetrics.length)throw new FitError(`${formatted} is a valid price, but Metropolis Medium Italic lacks usable spacing metrics for ${issues.invalidMetrics.join(', ')}. PDF export requires complete font metrics.`,{code:'missing-metrics'});
     const run=text.measure('price',formatted,size);
     const x=(w-run.advance)/2;
     const right=t.type==='pastry'&&t.vegan?130.08:t.type==='pastry'&&t.glutenFree?151.65:w-8;
     if(x+run.left<8||x+run.right>right||baseline+run.bottom>h-2)
       throw new FitError(`Price needs ${run.width.toFixed(1)} pt; it does not fit the price area without crossing a badge or cut boundary.`,{code:'overflow'});
     return {size,baseline,width:run.width,height:run.height,ops:text.draw(run,x,baseline,'#376438')};
   });
   for(const key of ['vegan','glutenFree'])if(t.type==='pastry'&&t[key]) {
     if(!artwork.badges?.[key])result.errors.push({field:key,message:'Original dietary badge asset unavailable.',code:'missing-asset'});
     else result.front.push(...artwork.badges[key]);
   }
   if(t.type==='pastry')field('ingredients',()=>text.ingredients(t.ingredients,{x:12,y:16,w:w-24,h:h-28}),'back');
   return result;
 }
 function createProject(tags) {
   const errors=[],clean=tags.filter(t=>isStatic(t)?!!staticDesigns[t.design]:SIZES[t.type]).map(t=>({...t}));
   for(const t of tags)errors.push(...validateTag(t).map(e=>({...e,id:t.id})));
   const sheets=pack(clean);
   for(const s of sheets)for(const p of s.items) {
     p.front=[];p.back=[];p.fits={};
     if(ready){const c=content(p.tag);p.front=c.front;p.back=c.back;p.fits=c.fits;errors.push(...c.errors.map(e=>({...e,id:p.tag.id})));}
   }
   errors.push(...validateGeometry({sheets}));
   const unique=[...new Map(errors.map(e=>[`${e.id}:${e.field}`,e])).values()];
   return {tags:clean,sheets,errors:unique,warnings:clean.some(t=>t.recipeVerification)?['Recipe verification required for Chocolat salée: supplied note mentions apple filling while the supplied recipe lists cocoa. Confirm before printing.']:clean.some(t=>t.type!=='pastry')?['Mixed sheets use a minimum 1 pt unprinted gap; later tags may fill earlier spaces.']:[],duplex:clean.some(t=>t.type==='pastry')};
 }
 function shapes(p,side){if(isStatic(p.tag))return [];return side==='front'?[...artwork[p.tag.type].shapes.map(s=>({...s,x:0,y:0,scale:1})),...p.front]:p.back;}
 function renderSheetSvg(project,index,side='front'){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 792 612" role="img" aria-label="Sheet ${index+1} ${side}"><rect width="792" height="612" fill="white"/>`+project.sheets[index].items.map(item=>{const p=side==='back'?mirrored(item):item;return `<g transform="translate(${p.x} ${p.y})">`+(isStatic(item.tag)&&side==='front'?staticDesigns[item.tag.design].svg.replace(/\bid="([^"]+)"/g,`id="n${index}_${project.sheets[index].items.indexOf(item)}_$1"`).replace(/#(font_[^" )]+|clip_[^" )]+)/g,`#n${index}_${project.sheets[index].items.indexOf(item)}_$1`):'')+shapes(item,side).map(s=>`<path d="${s.path}" fill="${s.color}" transform="translate(${s.x} ${s.y}) scale(${s.scale})"/>`).join('')+(!ready&&side==='front'?`<text x="20" y="50" font-size="10">Typography unavailable</text>`:'')+`</g>`;}).join('')+'</svg>';}
 async function exportPdf(project,{registration=false}={}){if(!ready||project.errors.length||validateGeometry(project).length||!project.tags.length)throw Error('Resolve the tag errors before exporting.');const {PDFDocument,rgb,PrintScaling,Duplex}=PDFLib;const pdf=await PDFDocument.create();const embedded={};for(const design of new Set(project.tags.filter(isStatic).map(t=>t.design))){const bytes=Uint8Array.from(atob(staticDesigns[design].pdf),c=>c.charCodeAt(0));[embedded[design]]=await pdf.embedPdf(bytes,[0]);}pdf.setTitle('Café Palmier Tags');const prefs=pdf.catalog.getOrCreateViewerPreferences();prefs.setPrintScaling(PrintScaling.None);if(project.duplex)prefs.setDuplex(Duplex.DuplexFlipShortEdge);for(const sheet of project.sheets)for(const side of project.duplex?['front','back']:['front']){const page=pdf.addPage([792,612]);for(const item of sheet.items){const p=side==='back'?mirrored(item):item;if(isStatic(item.tag)&&side==='front')page.drawPage(embedded[item.tag.design],{x:p.x,y:612-p.y-p.h,width:p.w,height:p.h});for(const s of shapes(item,side)){const color=s.color.match(/\w\w/g).map(v=>parseInt(v,16)/255);page.drawSvgPath(s.path,{x:p.x+s.x,y:612-p.y-s.y,scale:s.scale,color:rgb(...color)});}if(registration){const x=side==='back'?p.x+p.w-8:p.x+8;page.drawLine({start:{x:x-3,y:612-p.y-8},end:{x:x+3,y:612-p.y-8},thickness:.5});page.drawLine({start:{x,y:612-p.y-5},end:{x,y:612-p.y-11},thickness:.5});}}if(registration){page.drawLine({start:{x:36,y:20},end:{x:108,y:20},thickness:1});page.drawText(`${side} - 1 inch - SHORT EDGE - 100%`,{x:120,y:16,size:9});}}return pdf.save();}
 return {normalizePrice,normalizeFrontText,validateTag,createProject,renderSheetSvg,exportPdf,typographyStatus:{ready,provisional:true,message:ready?'Development typography: source outlines, provisional spacing; permission and physical print validation pending.':'Public PDF export is restricted pending typography permission. For local generation, open this project on localhost with its prepared typography assets. Editing and saving remain available.'}};
}
export async function initializeEngine(){const get=async p=>{const r=await fetch(new URL(p,import.meta.url));if(!r.ok)throw Error('Missing '+p);return r.json();};const art=await get('./assets/artwork.json');let fonts=null;if(['localhost','127.0.0.1','[::1]'].includes(location.hostname))try{fonts=await get('./typography/provisional.json');try{fonts.ingredientFallback=await get('./typography/ingredient-fallback.json');}catch{};}catch(error){throw Error('Local typography assets could not be loaded. Run the asset preparation script, then reload. '+error.message);}await import('./vendor/pdf-lib.min.js');return createEngine(art,fonts,globalThis.PDFLib);}
