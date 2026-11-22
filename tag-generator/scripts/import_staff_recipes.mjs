import fs from 'node:fs';
import {historical} from '../historical.mjs';
const canonical=s=>String(s||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[’']/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const key=p=>[canonical(p.title),canonical(p.subtitle)].join('|');
const data=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const updates=[],partial=[];
for(const change of data.enrichment_changes){
 const option=data.groups[change.title]?.options.find(p=>canonical(p.subtitle)===canonical(change.subtitle));
 if(!option)throw Error('Missing source option: '+key(change));
 if(change.action==='add_partial_filling_evidence'){partial.push({title:change.title,...option,completeRecipe:false});continue;}
 if(change.action!=='replace_previous_draft_with_explicit_staff_recipe')throw Error('Unknown enrichment action');
 const matches=historical.filter(p=>key(p)===key(change));
 if(matches.length!==1)throw Error('Expected one historical match: '+key(change));
 const allergens=option.allergens_english_from_staff_list||'';
 updates.push({type:'pastry',title:matches[0].title,subtitle:matches[0].subtitle,ingredients:option.ingredients_english_draft+(allergens?'\nContains: '+allergens+'.':''),ingredientEvidence:{source:option.ingredient_source,recipe:option.matched_recipe_name,notes:option.ingredient_notes_from_staff_list,allergens,reviewRequired:option.ingredient_review_required,previousIngredients:matches[0].ingredients}});
}
if(updates.length!==16||partial.length!==1||data.additional_staff_recipes_not_assigned_to_historical_presets.length!==9)throw Error('Unexpected enrichment counts');
fs.writeFileSync(new URL('../staff-recipes.mjs',import.meta.url),'export const staffRecipeUpdates = '+JSON.stringify(updates,null,2)+';\n');
fs.writeFileSync(new URL('../review/staff-recipe-references.json',import.meta.url),JSON.stringify({source:process.argv[2],enrichmentDate:data.enrichment_date,unmatchedRecipes:data.additional_staff_recipes_not_assigned_to_historical_presets,partialEvidence:partial,cautions:data.enrichment_cautions},null,2)+'\n');
console.log('Prepared 16 exact ingredient overlays, 9 unmatched references and 1 partial reference.');
