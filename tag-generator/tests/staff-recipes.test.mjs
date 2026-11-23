import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createLibrary,identity} from '../library.mjs';
import {historical} from '../historical.mjs';
import {staffRecipeUpdates} from '../staff-recipes.mjs';
test('16 exact ingredient merges preserve all historical non-ingredient fields',()=>{
 const records=createLibrary({getItem:()=>null}).all();
 assert.equal(staffRecipeUpdates.length,16);
 assert.equal(new Set(records.map(identity)).size,records.length);
 for(const update of staffRecipeUpdates){
  const original=historical.find(p=>identity(p)===identity(update));
  const merged=records.find(p=>identity(p)===identity(update));
  assert.equal(merged.ingredients,update.ingredients);
  for(const [key,value] of Object.entries(original))if(key!=='ingredients')assert.deepEqual(merged[key],value,key);
  assert(merged.ingredients.includes(update.ingredientEvidence.allergens));
 }
 for(const original of historical.filter(p=>!staffRecipeUpdates.some(u=>identity(u)===identity(p))))assert.equal(records.find(p=>identity(p)===identity(original)).ingredients?.toLowerCase(),original.ingredients?.toLowerCase());
});
test('saved staff corrections and prices win after reload without storage mutation',()=>{
 const update=staffRecipeUpdates[0],record={...update,ingredients:'Staff-confirmed corrected ingredients. CONTAINS: MILK.',price:'$99.00',vegan:true,glutenFree:false,origin:'staff'};
 const saved=JSON.stringify({records:[record],prices:{}});
 let writes=0;const storage={getItem:()=>saved,setItem:()=>writes++};
 for(let i=0;i<2;i++){
  const merged=createLibrary(storage).all().find(p=>identity(p)===identity(record));
  assert.equal(merged.ingredients,'Staff-confirmed corrected ingredients. Contains: Milk.');assert.equal(merged.price,record.price);assert.equal(merged.vegan,true);
 }
 assert.equal(writes,0);
});
test('nine unmatched recipes and partial Fruit Galette remain reference-only',()=>{
 const references=JSON.parse(fs.readFileSync(new URL('../review/staff-recipe-references.json',import.meta.url)));
 assert.equal(references.unmatchedRecipes.length,9);assert.equal(references.partialEvidence.length,1);
 assert.equal(references.partialEvidence[0].completeRecipe,false);
 const partial=references.partialEvidence[0];assert(!staffRecipeUpdates.some(p=>identity(p)===identity(partial)));
 const records=createLibrary({getItem:()=>null}).all();
 for(const r of references.unmatchedRecipes)assert(!records.some(p=>p.title===r.name));
});
