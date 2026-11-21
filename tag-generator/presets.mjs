const recipes={
Muffin:'Gluten Free flour blend, sugar, baking soda, baking powder, salt, cinnamon, soy milk, lemon juice, canola oil, lemon zest.',
Poptart:'Vegan shortening, flour, sugar, salt, lemon juice, rotating fruit.',
Croissant:'WHEAT flour, Charentes-Poitou PDO butter (MILK) 23%, water, sugar, yeast, whole MILK powder, WHEAT gluten, salt, emulsifier (rape lecithin), flour treatment agents (ascorbic acid, alpha-amylases, hemicellulases). May contain traces of: sesame seeds, soya, nuts, eggs.',
Amandine:'DOUGH (UNBLEACHED ENRICHED WHEAT FLOUR (WHEAT FLOUR, MALTED BARLEY FLOUR, NIACIN, REDUCED IRON, THIAMINE MONONITRATE, RIBOFLAVIN, FOLIC ACID), BUTTER, WATER, FRESH WHOLE MILK, SUGAR, EGGS, YEAST, SALT, INACTIVE DRY YEAST, XANTHAN GUM, ENZYMES AND ASCORBIC ACID), ALMOND FILLING (ALMOND PASTE (ALMONDS, SUGAR, WATER, NATURAL FLAVOR), SUGAR, BUTTER, EGGS, WHEAT FLOUR (WHEAT FLOUR, MALTED BARLEY FLOUR, NIACIN, REDUCED IRON, THIAMINE MONONITRATE, RIBOFLAVIN, FOLIC ACID), NATURAL FLAVOR), ALMONDS. CONTAINS: WHEAT, MILK, EGG AND ALMONDS. MAY CONTAIN: SOY AND OTHER TREE NUTS.',
'Pain au chocolat':'UNBLEACHED ENRICHED FLOUR (WHEAT FLOUR, FERROUS SULPHATE, NICOTINAMIDE, THIAMIN MONONITRATE, RIBOFLAVIN, FOLIC ACID), BUTTER (CREAM), WATER, CHOCOLATE (SUGAR, COCOA MASS, COCOA BUTTER, SOY LECITHIN, NATURAL VANILLA FLAVOR), SUGAR, YEAST, WHOLE MILK POWDER, WHEAT GLUTEN, SALT, EGGS, FOOD ENZYMES (AMYLASES, XYLANASES), ASCORBIC ACID. CONTAINS: WHEAT, MILK, SOY, EGGS. MAY CONTAIN: SESAME, TREE NUTS.',
Scone:'Flour, baking soda, baking powder, salt, sugar, butter, milk, vinegar, mix in bits.',
'Épinard & Feta':'UNBLEACHED ENRICHED FLOUR (WHEAT FLOUR, NIACIN, REDUCED IRON, THIAMIN MONONITRATE, RIBOFLAVIN, FOLIC ACID), SPINACH AND FETA FILLING [BECHAMEL CREAM (WATER, NONFAT DRY MILK, MODIFIED FOOD STARCH, DRIED WHEY (MILK), SALT, WHEY PROTEIN CONCENTRATE), SPINACH, FETA CHEESE (MILK, MILK PROTEIN CONCENTRATE, SALT, CALCIUM CHLORIDE, MICROBIAL ENZYME, LACTIC ACID, BACTERIAL CULTURE, CELLULOSE), EGGS, ONIONS, SPICES], BUTTER (CREAM), WATER, SUGAR, YEAST, EGGS, SALT, WHEAT GLUTEN, FOOD ENZYMES (XYLANASE, AMYLASE), ASCORBIC ACID, DRIED EGGS, SKIM MILK, SOY FLOUR. CONTAINS: WHEAT, MILK, EGGS, SOY.',
'Pépites de chocolat':'Butter, sugar, brown sugar, eggs, vanilla extract, flour, baking soda, salt, chocolate chips.',
'Chocolat salée':'Butter, sugar, brown sugar, eggs, vanilla extract, flour, baking soda, salt, cocoa, salt',
Power:'Gluten free flour blend, oats, sunflower seeds, pumpkin seeds, coconut, flax seeds, brown sugar, cinnamon, salt, chocolate chips, dried cranberries, almond, molasses, canola oil, almond milk.',
'Froot Loop':'Butter, sugar, glucose, eggs, vanilla, flour, skim milk powder, baking soda, cream of tartar, salt, froot loops, sprinkles.',
Gingembre:'Butter, brown sugar, eggs, molasses, ginger, cinnamon, cloves, salt, baking soda, flour.'};
const special=['Pépites de chocolat','Chocolat salée','Power','Froot Loop','Gingembre'];
export const presets=[...new Set(['Carré','Petit pain','Pain','Sablé','Poptart','Scone','Barre','Brownie','Muffin','Galette','Blondie','Cupcake',...Object.keys(recipes)])].map(title=>({title,subtitle:'',ingredients:recipes[title]||'',vegan:['Muffin','Poptart','Power'].includes(title),glutenFree:['Muffin','Power'].includes(title),titleColor:special.includes(title)?'#c68b70':'#376438',aliases:title==='Amandine'?['Amanding']:title==='Scone'?['Scones']:[],recipeVerification:title==='Chocolat salée'}));
const key=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
export const suggestions=(query='')=>presets.filter(p=>[p.title,...p.aliases].some(s=>key(s).includes(key(query))));
export const findPreset=query=>presets.find(p=>[p.title,...p.aliases].some(s=>key(s)===key(query)));
export const presetIngredients=(preset,subtitle='')=>preset.ingredients+(subtitle?"\n"+subtitle:'');
export function syncIngredients(tag,preset,reset=false){
 if(!preset?.ingredients||tag.type!=='pastry'||(!reset&&!tag.ingredientSync))return tag;
 return {...tag,ingredients:presetIngredients(preset,tag.subtitle||''),ingredientSync:true};
}
export function applyPreset(current,preset,previous=null,replace=false){
 const result={...current,title:preset.title,titleColor:preset.titleColor,presetTitle:preset.title,recipeVerification:preset.recipeVerification},conflicts=[];
 for(const field of ['subtitle','ingredients','vegan','glutenFree']){
  const baseline=field==='ingredients'&&previous&&current.ingredientSync?presetIngredients(previous,current.subtitle||''):previous?.[field]??(typeof preset[field]==='boolean'?false:'');
  if(current[field]!==undefined&&current[field]!==baseline&&current[field]!==preset[field])conflicts.push(field);
  if(replace||!conflicts.includes(field))result[field]=preset[field];
 }
 result.ingredientSync=!!preset.ingredients&&(replace||!conflicts.includes('ingredients'));
 if(result.ingredientSync)result.ingredients=presetIngredients(preset,result.subtitle||'');
 return {tag:result,conflicts};
}
