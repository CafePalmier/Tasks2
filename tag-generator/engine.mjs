import {staticDesigns} from './assets/static-designs.mjs';
import {menuArtwork} from './assets/menu-artwork.mjs';
import {createMenuLayout, menuFront, validateMenu} from './menu-layout.mjs?v=2';
import {PRICE_CHARACTERS,normalizePrice,priceGlyphIssues} from './price-glyphs.mjs';
export {staticDesigns};
export {normalizePrice};
export const isStatic=t=>t.type==='napkin';
export const isMenu=t=>t.type==='menu';
export const isFullLetterMenu=t=>isMenu(t)&&t.design==='tea';
const itemArtwork=t=>{
 const assets=isMenu(t)?menuArtwork:isStatic(t)?staticDesigns:null;
 return assets&&Object.hasOwn(assets,t.design)?assets[t.design]:undefined;
};
export const tagSize=t=>{
 const asset=itemArtwork(t);
 return asset?[asset.width,asset.height]:Object.hasOwn(SIZES,t.type)?SIZES[t.type]:undefined;
};
import {createTextLayout, FitError} from './text-layout.mjs';
import {findPreset} from './presets.mjs';
export const SIZES={pastry:[199.9674,154.5202],freezer:[212.234,101.503],provisions:[141.732,116.220]};
export const normalizeFrontText=v=>String(v??'').normalize('NFC').replace(/(?<![\p{L}\p{N}])et(?![\p{L}\p{N}])/gu,'&').trim();
function normalizeQuotedText(value){
 let opening=true;
 return normalizeFrontText(value).replace(/["“”]/g,char=>{const left=char==='“'||(char==='"'&&opening);opening=!left;return left?'«':'»';}).replace(/«\s*/g,'«\u00a0').replace(/\s*»/g,'\u00a0»');
}
export const normalizeTitleText=normalizeQuotedText;
export function validateTag(t){const e=[];if(isMenu(t))return validateMenu(t);if(isStatic(t))return staticDesigns[t.design]?[]:[{field:'design',message:'Choose a Napkin Holder design.'}];if(!SIZES[t.type])e.push({field:'type',message:'Choose a tag format.'});if(!String(t.title??'').trim())e.push({field:'title',message:'Enter a French title.'});if(!normalizePrice(t.price))e.push({field:'price',code:'invalid-price',message:'Enter a valid non-negative price.'});if(t.type==='pastry'&&!String(t.ingredients??'').trim())e.push({field:'ingredients',message:'Enter the English ingredients.'});return e;}
export const CUT_GAP=1;
export const SHEET_MARGIN=10*72/25.4;
const EPSILON=1e-7;
const HANDWRITTEN_SUBTITLE_TITLES=new Set(['Muffin','Scone','Sablé']);

function removeOccupiedSpace(rectangles, {x, y, w, h}) {
 const right=x+w, bottom=y+h, free=[];
 for(const r of rectangles){
  const rx=r.x+r.w, ry=r.y+r.h;
  if(right<=r.x||x>=rx||bottom<=r.y||y>=ry){free.push(r);continue;}
  if(x>r.x)free.push({...r,w:x-r.x});
  if(right<rx)free.push({...r,x:right,w:rx-right});
  if(y>r.y)free.push({...r,h:y-r.y});
  if(bottom<ry)free.push({...r,y:bottom,h:ry-bottom});
 }
 // Free rectangles may overlap. Drop duplicates and rectangles enclosed by another.
 return free.filter((r,i)=>!free.some((q,j)=>i!==j&&q.x<=r.x&&q.y<=r.y&&
  q.x+q.w>=r.x+r.w&&q.y+q.h>=r.y+r.h&&
  (j<i||q.x!==r.x||q.y!==r.y||q.w!==r.w||q.h!==r.h)));
}

function packOrder(items, area, gap, bestFit) {
 const sheets=[];
 for(const item of items){
  const w=item.w+gap, h=item.h+gap;
  const topLeft=(a,b)=>a.y-b.y||a.x-b.x;
  const shortSide=r=>Math.min(r.w-w,r.h-h);
  const compare=bestFit
   ? (a,b)=>shortSide(a)-shortSide(b)||a.w*a.h-b.w*b.h||topLeft(a,b)
   : topLeft;
  let sheet, slot;
  for(const candidate of sheets){
   for(const r of candidate.free){
    if(r.w+EPSILON<w||r.h+EPSILON<h)continue;
    if(!slot||compare(r,slot)<0){sheet=candidate;slot=r;}
   }
   if(slot&&!bestFit)break;
  }
  if(!sheet){sheet={items:[],free:[area]};sheets.push(sheet);slot=area;}
  const {x,y}=slot;
  sheet.items.push({...item,x,y});
  sheet.free=removeOccupiedSpace(sheet.free,{x,y,w,h});
 }
 return sheets.map(({items})=>({items}));
}

export function pack(tags, {margin=SHEET_MARGIN, marginX=margin, marginY=margin, gap=CUT_GAP}={}) {
 if(!Number.isFinite(marginX)||marginX<0||marginX>=396||
    !Number.isFinite(marginY)||marginY<0||marginY>=306||!Number.isFinite(gap)||gap<0)
  throw new RangeError('Sheet margin and cutting gap must fit within Letter paper.');
 if(!tags.length)return [];
 const fullSheets=tags.filter(isFullLetterMenu);
 if(fullSheets.length){
  const packed=pack(tags.filter(t=>!isFullLetterMenu(t)),{marginX,marginY,gap});
  return [...packed,...fullSheets.map(tag=>({items:[{tag,x:0,y:0,w:792,h:612}]}))];
 }
 const width=792-2*marginX, height=612-2*marginY;
 const [pw,ph]=SIZES.pastry;
 // Preserve the centered pastry-only grid when it fits. Its nine slots are
 // already the maximum for upright pastries on Letter with the default margins.
 if(tags.every(t=>t.type==='pastry')&&3*pw+2*gap<=width&&3*ph+2*gap<=height){
  const x=(792-3*pw-2*gap)/2, y=(612-3*ph-2*gap)/2;
  return Array.from({length:Math.ceil(tags.length/9)},(_,s)=>({
   items:tags.slice(s*9,s*9+9).map((tag,i)=>({
    tag,x:x+(i%3)*(pw+gap),y:y+Math.floor(i/3)*(ph+gap),w:pw,h:ph
   }))
  }));
 }
 const items=tags.map(tag=>{
  const [w,h]=tagSize(tag)||[];
  if(!Number.isFinite(w)||!Number.isFinite(h)||w>width+EPSILON||h>height+EPSILON)
   throw new RangeError('A tag exceeds the printable area at these margins.');
  return {tag,w,h};
 });
 // Pad each rectangle, and extend the packing area by the same gap. This
 // reserves space between cuts without adding a gap to the paper margins.
 const area={x:marginX,y:marginY,w:width+gap,h:height+gap};
 const total=items.reduce((sum,p)=>sum+(p.w+gap)*(p.h+gap),0);
 const minimum=Math.ceil(total/(area.w*area.h)-EPSILON);
 let best=packOrder(items,area,gap,false);
 for(const compare of [(a,b)=>b.w*b.h-a.w*a.h,(a,b)=>b.h-a.h||b.w-a.w,(a,b)=>b.w-a.w||b.h-a.h]){
  if(best.length===minimum)break;
  const sorted=[...items].sort(compare);
  for(const bestFit of [true,false]){
   const candidate=packOrder(sorted,area,gap,bestFit);
   if(candidate.length<best.length)best=candidate;
   if(best.length===minimum)break;
  }
 }
 return best;
}
export const mirrored=p=>({...p,x:792-p.x-p.w});
export function validateGeometry(project) {
 const {margin=0,marginX=margin,marginY=margin,gap=CUT_GAP}=project.layout||{};
 const errors=[];
 for(const sheet of project.sheets)for(const [i,p] of sheet.items.entries()) {
  const size=tagSize(p.tag),back=mirrored(p);
  const fullPage=isFullLetterMenu(p.tag),insetX=fullPage?0:marginX,insetY=fullPage?0:marginY;
  if(!size||![p.x,p.y,p.w,p.h].every(Number.isFinite)||p.w!==size[0]||p.h!==size[1]||p.x<insetX-EPSILON||p.y<insetY-EPSILON||p.x+p.w>792-insetX+EPSILON||p.y+p.h>612-insetY+EPSILON||Math.abs(back.x+p.x+p.w-792)>1e-6)
   errors.push({id:p.tag.id,field:'geometry',code:'geometry',message:'Tag or reverse placement exceeds the printable area. Reload the generator before exporting.'});
  for(const q of sheet.items.slice(i+1))if(p.x<q.x+q.w+gap-EPSILON&&q.x<p.x+p.w+gap-EPSILON&&p.y<q.y+q.h+gap-EPSILON&&q.y<p.y+p.h+gap-EPSILON)errors.push({id:p.tag.id,field:'geometry',code:'geometry',message:`Tags overlap or have less than the ${gap} pt cutting gap. Reload the generator before exporting.`});
 }
 return errors;
}
export function createEngine(artwork,fonts,PDFLib,{margin=SHEET_MARGIN,marginX=margin,marginY=margin,gap=CUT_GAP,publicTypography=false}={}){
 const layout=Object.freeze({margin,marginX,marginY,gap});
 const ready=!!fonts;
 const text=createTextLayout(fonts);
 let layoutMenu;
 function content(t) {
   if(isStatic(t))return {front:[],back:[],fits:{},errors:[]};
   if(isMenu(t)){
     const invalidRows=validateMenu(t).some(error=>error.field==='rows');
     if(invalidRows)return {front:[],back:[],fits:{},errors:[]};
     layoutMenu??=createMenuLayout(fonts);
     const fitted=layoutMenu(t.design,t.rows);
     return {front:menuFront(t.design,fitted,menuArtwork[t.design].bounds),back:[],fits:{},errors:fitted.errors};
   }
   const [w,h]=SIZES[t.type], sub=normalizeQuotedText(t.subtitle);
   const subtitleSize=t.type==='pastry'?14.5:10;
   const reserveSubtitle=t.type==='pastry'&&!sub&&
     HANDWRITTEN_SUBTITLE_TITLES.has(findPreset(String(t.title??''))?.title);
   const handwritingSpace=reserveSubtitle?subtitleSize:0;
   const top=t.type==='pastry'?24:t.type==='freezer'?22:18, bottom=t.type==='pastry'?102:t.type==='freezer'?60:82;
   const titleInset=t.type==='freezer'?26:20;
   const result={front:[],back:[],fits:{},errors:[]};
   function field(name,fn,side='front') {
     if(validateTag(t).some(e=>e.field===name))return;
     try {const fit=fn();result.fits[name]=fit;result[side].push(...fit.ops);}
     catch(e){if(!(e instanceof FitError))throw e;result.errors.push({field:name,message:e.message,code:e.code,measured:e.measured,available:e.available,minSize:e.minSize,missingGlyphs:e.missingGlyphs});}
   }
   field('title',()=>text.fit('lucidity',normalizeTitleText(t.title),{x:titleInset,y:top,w:w-titleInset*2,h:bottom-top-(sub||reserveSubtitle?24:0)},t.type==='pastry'?36:24,14,2,'Title'));
   if(sub)field('subtitle',()=>{
     // Allow two lines near the reference size while leaving room for the title and its gap.
     const height=t.type==='pastry'?34:27;
     return text.fit('ruddy',sub,{x:20,y:bottom-height,w:w-40,h:height},subtitleSize,8,2,'Subtitle');
   });
   // Reposition the measured ink blocks as a single composition inside the cream.
   const title=result.fits.title, subtitle=result.fits.subtitle;
   if(title&&(!sub||subtitle)) {
     const cream=t.type==='pastry'?[10.434,110.653]:t.type==='freezer'?[12.197,68.500]:[10.065,89.572];
     const subtitleHeight=subtitle?.height??handwritingSpace;
     const gap=subtitleHeight?4:0, total=title.height+subtitleHeight+gap;
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
   if(t.type==='pastry')field('ingredients',()=>{
     const minSize=findPreset(t.title)?.title==='Amandine'?7.5:8;
     return text.ingredients(t.ingredients,{x:12,y:16,w:w-24,h:h-28},minSize);
   },'back');
   return result;
 }
 function createProject(tags,{flipEdge='short',orientation='landscape'}={}) {
   const errors=[],clean=tags.filter(t=>tagSize(t)?.every(Number.isFinite)).map(t=>({...t}));
   for(const t of tags)errors.push(...validateTag(t).map(e=>({...e,id:t.id})));
   const sheets=pack(clean,layout);
   for(const s of sheets)for(const p of s.items) {
     p.front=[];p.back=[];p.fits={};
     if(ready){const c=content(p.tag);p.front=c.front;p.back=c.back;p.fits=c.fits;errors.push(...c.errors.map(e=>({...e,id:p.tag.id})));}
   }
   errors.push(...validateGeometry({sheets,layout}));
   const unique=[...new Map(errors.map(e=>[`${e.id}:${e.field}`,e])).values()];
   return {tags:clean,sheets,layout,errors:unique,warnings:clean.some(t=>t.recipeVerification)?['Recipe verification required for Chocolat salée: supplied note mentions apple filling while the supplied recipe lists cocoa. Confirm before printing.']:clean.some(t=>t.type!=='pastry')?[`Tags may be rearranged to save paper. The cutting gap is at least ${gap} pt.`]:[],duplex:clean.some(t=>t.type==='pastry'),flipEdge,orientation};
 }
 function shapes(p,side){
   if(side==='back')return p.back;
   if(itemArtwork(p.tag))return p.front;
   return [...artwork[p.tag.type].shapes.map(s=>({...s,x:0,y:0,scale:1})),...p.front];
 }
 // The quarter-turn rotates the paper and artwork together, preserving their physical edges.
 const rotateBack=(project,side)=>project.duplex&&side==='back'&&project.flipEdge==='long';
 const rotateSheet=(project,sheet,side)=>rotateBack(project,side)||
   (project.orientation==='portrait'&&side==='front'&&sheet.items.some(item=>isFullLetterMenu(item.tag)));
 function renderSheetSvg(project,index,side='front',{idPrefix='preview',viewport}={}) {
   const sheet=project.sheets[index];
   const portrait=project.orientation==='portrait',rotate=rotateSheet(project,sheet,side);
   const [width,height]=portrait?[612,792]:[792,612];
   const {items}=sheet;
   const transforms=[
     ...(portrait?['matrix(0 -1 1 0 0 792)']:[]),
     ...(rotate?['translate(792 612) rotate(180)']:[])
   ];
   const sheetArtwork=items.map((item,i)=>{
     const p=side==='back'?mirrored(item):item;
     const prefix=isMenu(item.tag)?`${idPrefix}_${index}_${i}_`:`n${index}_${i}_`;
     const staticFront=side==='front'
       ? itemArtwork(item.tag)?.svg.replace(/\bid="([^"]+)"/g,`id="${prefix}$1"`).replace(/#(font_[^" )]+|clip_[^" )]+)/g,`#${prefix}$1`) ?? ''
       : '';
     const vectors=shapes(item,side).map(s=>`<path d="${s.path}" fill="${s.color}" transform="translate(${s.x} ${s.y})${s.rotation?` rotate(${-s.rotation})`:''} scale(${s.scale})"/>`).join('');
     const notice=!ready&&side==='front'?'<text x="20" y="50" font-size="10">Typography unavailable</text>':'';
     return `<g transform="translate(${p.x} ${p.y})">${staticFront}${vectors}${notice}</g>`;
   }).join('');
   const content=transforms.length?`<g transform="${transforms.join(' ')}">${sheetArtwork}</g>`:sheetArtwork;
   return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(viewport??[0,0,width,height]).join(' ')}" role="img" aria-label="Sheet ${index+1} ${side}"><rect width="${width}" height="${height}" fill="white"/>${content}</svg>`;
 }
 async function exportPdf(project,{registration=false}={}) {
   if(!ready||project.errors.length||validateGeometry(project).length||!project.tags.length)
     throw Error('Resolve the tag errors before exporting.');
   const {PDFDocument,rgb,cmyk,degrees,PrintScaling,Duplex,pushGraphicsState,popGraphicsState,concatTransformationMatrix}=PDFLib;
   const pdf=await PDFDocument.create(),embedded=new Map();
   for(const asset of new Set(project.tags.map(itemArtwork).filter(Boolean))) {
     const bytes=Uint8Array.from(atob(asset.pdf),c=>c.charCodeAt(0));
     const [page]=await pdf.embedPdf(bytes,[0]);
     embedded.set(asset,page);
   }
   pdf.setTitle('Café Palmier Tags');
   const prefs=pdf.catalog.getOrCreateViewerPreferences();
   prefs.setPrintScaling(PrintScaling.None);
   if(project.duplex) prefs.setDuplex(project.flipEdge==='long'?Duplex.DuplexFlipLongEdge:Duplex.DuplexFlipShortEdge);
   for(const sheet of project.sheets)for(const side of project.duplex?['front','back']:['front']) {
     const portrait=project.orientation==='portrait',rotate=rotateSheet(project,sheet,side);
     const page=pdf.addPage(portrait?[612,792]:[792,612]);
     // Rotate the vectors inside the page so AirPrint sees a plain portrait Letter page.
     if(portrait||rotate)page.pushOperators(pushGraphicsState());
     if(portrait)page.pushOperators(concatTransformationMatrix(0,1,-1,0,612,0));
     if(rotate)page.pushOperators(concatTransformationMatrix(-1,0,0,-1,792,612));
     for(const item of sheet.items) {
       const p=side==='back'?mirrored(item):item;
       const background=embedded.get(itemArtwork(item.tag));
       if(background&&side==='front')page.drawPage(background,{x:p.x,y:612-p.y-p.h,width:p.w,height:p.h});
       for(const s of shapes(item,side)) {
         const color=s.cmyk?cmyk(...s.cmyk):rgb(...s.color.match(/\w\w/g).map(v=>parseInt(v,16)/255));
         page.drawSvgPath(s.path,{x:p.x+s.x,y:612-p.y-s.y,scale:s.scale,color,...(s.rotation?{rotate:degrees(s.rotation)}:{})});
       }
       if(registration) {
         const x=side==='back'?p.x+p.w-8:p.x+8;
         page.drawLine({start:{x:x-3,y:612-p.y-8},end:{x:x+3,y:612-p.y-8},thickness:.5});
         page.drawLine({start:{x,y:612-p.y-5},end:{x,y:612-p.y-11},thickness:.5});
       }
     }
     if(registration) {
       const mode=project.duplex?(project.flipEdge==='long'?'LONG EDGE':'SHORT EDGE'):'SINGLE SIDED';
       page.drawLine({start:{x:36,y:20},end:{x:108,y:20},thickness:1});
       page.drawText(`${side} - 1 inch - ${mode} - 100%`,{x:120,y:16,size:9});
     }
     if(portrait||rotate)page.pushOperators(popGraphicsState());
   }
   return pdf.save();
 }
 const message=!ready
  ? 'This site could not load approved typography. You can still edit and save tags. Preview lettering, PDF download, and printing require the approved font assets.'
  : publicTypography ? '' : 'Development typography uses source outlines and provisional spacing.';
 return {normalizePrice,normalizeFrontText,validateTag,createProject,renderSheetSvg,exportPdf,typographyStatus:{ready,provisional:ready&&!publicTypography,message}};
}
export async function initializeEngine(layoutOptions){
 const get=async path=>{
  const response=await fetch(new URL(path,import.meta.url));
  if(!response.ok)throw Error('Could not load '+path);
  return response.json();
 };
 const art=await get('./assets/artwork.json');
 const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
 let fonts=null;
 if(local){
  try{
   fonts=await get('./typography/provisional.json');
  }catch(error){
   throw Error('Local typography assets could not be loaded. Run the asset preparation script, then reload. '+error.message);
  }
  try{fonts.ingredientFallback=await get('./typography/ingredient-fallback.json');}catch{}
 }else{
  try{
   const approved=await get('./typography/approved.json');
   const hasGlyphs=['lucidity','ruddy','ingredients'].every(name=>
    Object.values(approved[name]??{}).some(glyph=>typeof glyph?.path==='string'&&glyph.path&&Number.isFinite(glyph.advance))
   );
   const price=priceGlyphIssues(PRICE_CHARACTERS,approved.price);
   if(hasGlyphs&&!price.missing.length&&!price.invalidMetrics.length)fonts=approved;
  }catch{
   // A missing or unreadable public bundle should leave editing and saving available.
  }
 }
 await import('./vendor/pdf-lib.min.js');
 return createEngine(art,fonts,globalThis.PDFLib,{...layoutOptions,publicTypography:!local});
}
