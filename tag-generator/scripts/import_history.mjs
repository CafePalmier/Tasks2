import fs from 'node:fs';
import {presets} from '../presets.mjs';
const rows=JSON.parse(fs.readFileSync(new URL('../review/historical-source-audit.json',import.meta.url))).records;
const normalize=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const records=rows.map(a=>{
 const r=a.original_record;let title=r.title,subtitle=r.subtitle;
 if(title==='SONE')title='SCONE';
 if(subtitle==='SCONE Herbes & Fromage Herbes & Fromage')subtitle='Herbes & Fromage';
 const base=presets.find(p=>normalize(p.title)===normalize(title));
 title=base?.title||title||'Produit historique sans titre';
 let ingredients=r.english_ingredients_candidate,provenance=r.ingredient_provenance;
 if(['muffin','scone','poptart'].includes(normalize(title))&&base?.ingredients){ingredients=base.ingredients+(subtitle?'\n'+subtitle:'');provenance='existing_base_plus_verbatim_subtitle';}
 else if(!a.candidate_verbatim_match&&base?.ingredients){ingredients=base.ingredients;provenance='existing_recipe';}
 if(normalize(title)==='barre'&&normalize(subtitle)==='dattes'){ingredients='Dates, oats, flour, brown sugar, butter, baking soda, salt.';provenance='inferred_date_bar_recipe';}
 if(!ingredients&&normalize(title)==='petit pain'){ingredients='Flour, bananas, almonds, sugar, eggs, butter, baking powder, salt.';provenance='inferred_banana_almond_recipe';}
 return {type:'pastry',title,subtitle,price:'$'+Number(r.price).toFixed(2),ingredients,vegan:r.vegan==='True',glutenFree:r.gluten_free==='True',titleColor:base?.titleColor||'#376438',origin:'historical',provenance,sourceLine:a.csv_line,reviewFlags:r.review_flags,sourcePages:[r.source_front_page,r.source_back_page]};
});
fs.writeFileSync(new URL('../historical.mjs',import.meta.url),'export const historical = '+JSON.stringify(records,null,2)+';\n');
console.log('Imported',records.length,'historical records');
