import {presets,freezerPresets} from './presets.mjs';
import {productHistory} from './product-history.mjs';
import {historical} from './historical.mjs';
import {staffRecipeUpdates} from './staff-recipes.mjs';
export const canonical=s=>String(s||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[’']/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export const identity=p=>[p.type||'pastry',canonical(p.title),canonical(p.subtitle)].join('|');
const categories=new Set(['muffin','scone','poptart','sable','barre']);
export function createLibrary(storage){
 const key='palmier-preset-library-v1';
 let state={records:[],prices:{},deleted:[]};
 const saved=storage.getItem(key);if(saved){const parsed=JSON.parse(saved);if(!Array.isArray(parsed.records)||!parsed.prices)throw Error('Preset storage is invalid.');state=parsed;}
 const all=()=>{
  const map=new Map();
  for(const p of [...presets.map(p=>({...p,type:'pastry'})),...freezerPresets.map(p=>({...p,type:'freezer'})),...historical])map.set(identity(p),p);
  for(const p of productHistory){const id=identity(p),old=map.get(id);const prices=[...new Set([...(old?.historicalPrices||[]),...(old?.price?[old.price]:[]),p.price])];map.set(id,{...p,historicalPrices:prices,price:prices.length>1?'':p.price,priceConflict:prices.length>1,historicalVariants:[...(old?.historicalVariants||[]),p],sources:[...(old?.sources||[]),{source:p.source,page:p.source_page,locations:p.source_locations}]});}
  // Ingredient-only source improvements sit below every saved staff correction.
  for(const update of staffRecipeUpdates){const id=identity(update),old=map.get(id);if(old)map.set(id,{...old,ingredients:update.ingredients,ingredientEvidence:update.ingredientEvidence});}
  for(const p of state.records)map.set(identity(p),{...map.get(identity(p)),...p,priceConflict:false});
  return [...map.values()].filter(p=>!(state.deleted||[]).includes(identity(p))).map(p=>({...p,price:p.type==='pastry'&&!p.individualPrice?state.prices[canonical(p.title)]||p.price:p.price}));
 };
 function remember(tag,confirm){
  const old=all().find(p=>identity(p)===identity(tag));
  if(old&&tag.type==='pastry'&&(old.ingredients!==tag.ingredients||!!old.vegan!==!!tag.vegan||!!old.glutenFree!==!!tag.glutenFree)&&!confirm('Update the saved ingredients and dietary settings for '+tag.title+(tag.subtitle?' — '+tag.subtitle:'')+'?'))return false;
  const next=structuredClone(state),category=canonical(tag.title);let individualPrice=old?.individualPrice||false;
  if(tag.type==='pastry'&&categories.has(category)){
   const prior=next.prices[category]||old?.price;
   if(prior!==tag.price){if(confirm('Update all '+tag.title+' prices to '+tag.price+'?')){next.prices[category]=tag.price;individualPrice=false;}else individualPrice=true;}
  }
  const record={...tag,origin:'staff',individualPrice,previous:old?{...old,previous:undefined}:undefined};
  next.records=next.records.filter(p=>identity(p)!==identity(tag));next.records.push(record);
  next.deleted=(next.deleted||[]).filter(id=>id!==identity(tag));
  storage.setItem(key,JSON.stringify(next));state=next;return true;
 }
 function remove(tag){const next=structuredClone(state),id=identity(tag);next.records=next.records.filter(p=>identity(p)!==id);next.deleted=[...new Set([...(next.deleted||[]),id])];storage.setItem(key,JSON.stringify(next));state=next;}
 return {all,remember,remove};
}
