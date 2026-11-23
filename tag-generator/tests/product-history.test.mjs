import {test} from 'node:test';
import assert from 'node:assert/strict';
import {productHistory} from '../product-history.mjs';
import {createLibrary,identity} from '../library.mjs';
test('imports both formats and retains every conflict variant',()=>{
 const library=createLibrary({getItem:()=>null});
 assert.equal(productHistory.filter(p=>p.type==='freezer').length,16);
 assert.equal(productHistory.filter(p=>p.type==='provisions').length,70);
 const soup=library.all().find(p=>p.type==='freezer'&&p.title==='Soup');
 assert.equal(soup.price,'$14.00');
 assert.equal(library.all().filter(p=>p.priceConflict).length,1);
 for(const [title,subtitle,price] of [
  ['« Dripper »','Hario Céramique','$45.00'],
  ['« Trail Tumbler »','Kinto 580ml','$55.00'],['« Trail Tumbler »','Kinto 1080ml','$79.00'],
  ['Tasse de voyage','Fellow 12oz','$45.00'],['Tasse de voyage','Fellow 16oz','$50.00'],
  ['Bouteille d’eau','Kinto 500ml','$23.00'],['Bouteille d’eau','Kinto 950ml','$32.00']
 ])assert.equal(library.all().find(p=>p.title===title&&p.subtitle===subtitle)?.price,price);
 assert.equal(library.all().filter(p=>p.historicalVariants).reduce((n,p)=>n+p.historicalVariants.length,0),86);
});
test('product pricing persists independently of categories and minor punctuation',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 let library=createLibrary(storage);
 const biscuits=library.all().filter(p=>p.type==='freezer'&&p.title==='Biscuits'&&p.subtitle);
 assert.equal(biscuits.length,4);
 const selected=biscuits[0];library.remember({...selected,price:'$99.00'},()=>true);
 library=createLibrary(storage);
 assert.equal(library.all().find(p=>identity(p)===identity(selected)).price,'$99.00');
 for(const other of biscuits.slice(1))assert.equal(library.all().find(p=>identity(p)===identity(other)).price,other.price);
 const pastry={type:'pastry',title:'Muffin',subtitle:'Test',price:'$4.50',ingredients:'Flour',vegan:false,glutenFree:false};
 library.remember(pastry,()=>true);library.remember({...pastry,type:'freezer',price:'$20.00'},()=>true);
 assert.equal(library.all().find(p=>p.type==='freezer'&&p.title==='Muffin').price,'$20.00');
 assert.equal(identity({type:'provisions',title:'Bouteille d’eau',subtitle:'KINTO'}),identity({type:'provisions',title:"Bouteille d'eau",subtitle:' kinto '}));
});
test('legacy freezer biscuit presets use Biscuits and keep saved prices',()=>{
 const records=[
  {type:'freezer',title:'Buscuits',subtitle:'',price:'$6.00'},
  {type:'freezer',title:'Biscuit',subtitle:'Gingembre',price:'$8.00'},
  {type:'pastry',title:'Biscuit',subtitle:'',price:'$4.00'}
 ];
 const library=createLibrary({getItem:()=>JSON.stringify({records,prices:{}})});
 const freezer=library.all().filter(p=>p.type==='freezer');
 assert.ok(!freezer.some(p=>['Buscuits','Biscuit'].includes(p.title)));
 assert.deepEqual(freezer.filter(p=>p.title==='Biscuits'&&!p.subtitle).map(p=>p.price),['$6.00']);
 assert.deepEqual(freezer.filter(p=>p.title==='Biscuits'&&p.subtitle==='Gingembre').map(p=>p.price),['$8.00']);
 assert.ok(library.all().some(p=>p.type==='pastry'&&p.title==='Biscuit'));
});
