import fs from 'node:fs';
const records=[];
for(const type of ['provisions','freezer']){
 const data=JSON.parse(fs.readFileSync(process.argv[type==='provisions'?2:3],'utf8'));
 for(const r of data.records){
  let subtitle=r.subtitle,price=Number(r.price);
  if(type==='freezer'&&r.title==='Soup')price=14;
  if(type==='provisions'){
   if(r.title==='« Dripper »'&&subtitle==='Hario Céramique')price=45;
   if(r.title==='« Trail Tumbler »'&&subtitle==='Kinto')subtitle+=' '+({55:'580ml',79:'1080ml'}[price]||'');
   if(r.title==='Tasse de voyage'&&subtitle==='Fellow')subtitle+=' '+({45:'12oz',50:'16oz'}[price]||'');
   if(r.title==='Bouteille d’eau'&&subtitle==='Kinto')subtitle+=' '+({23:'500ml',32:'950ml'}[price]||'');
  }
  records.push({...r,type,subtitle,price:'$'+price.toFixed(2),originalSubtitle:r.subtitle,originalPrice:r.price,ingredients:'',vegan:false,glutenFree:false,origin:'historical',source:data.source});
 }
}
fs.writeFileSync(new URL('../product-history.mjs',import.meta.url),'export const productHistory = '+JSON.stringify(records,null,2)+';\n');
