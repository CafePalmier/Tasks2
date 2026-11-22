import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSync,LIBRARY_KEY} from '../sync.mjs';
const empty=()=>({records:[],prices:{},deleted:[]});
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
test('disabled sync makes no requests',async()=>{const s=createSync(memory(),{enabled:false},{fetcher:()=>{throw Error('Unexpected request');}});await s.tick();});
test('offline queue persists, revision conflicts preserve both versions, restore uses normal writes',async()=>{
 let remote={revision:0,payload:empty()},offline=false;const storage=memory(),history=[];
 const fetcher=async(url,options)=>{
  if(offline)throw Error('Offline');
  if(url.includes('tag_generator_history'))return {ok:true,json:async()=>history};
  if(options.method==='PATCH'){
   const revision=Number(url.split('revision=eq.')[1]);
   if(revision!==remote.revision)return {ok:true,json:async()=>[]};
   history.push(structuredClone(remote));remote={revision:remote.revision+1,payload:JSON.parse(options.body).payload};
  }
  return {ok:true,json:async()=>[structuredClone(remote)]};
 };
 const config={url:'https://example.test',publishableKey:'public',enabled:true};let conflict=false;
 let sync=createSync(storage,config,{fetcher,onStatus:(_,c)=>{if(c)conflict=true;}});await sync.tick();
 offline=true;sync.storage.setItem(LIBRARY_KEY,JSON.stringify({...empty(),prices:{muffin:'$4.50'}}));await sync.tick();assert.equal(remote.revision,0);
 offline=false;sync=createSync(storage,config,{fetcher,onStatus:(_,c)=>{if(c)conflict=true;}});await sync.tick();assert.equal(remote.payload.prices.muffin,'$4.50');
 sync.storage.setItem(LIBRARY_KEY,JSON.stringify({...empty(),prices:{muffin:'$5.00'}}));remote={revision:2,payload:{...empty(),prices:{scone:'$6.00'}}};await sync.tick();assert(conflict);assert.equal(remote.revision,2);
 await sync.resolve(false);assert.equal(JSON.parse(storage.getItem(LIBRARY_KEY)).prices.scone,'$6.00');assert(storage.getItem('palmier-preset-sync-v1-conflict-backup'));
 await sync.restore(0);assert.equal(remote.revision,3);assert.deepEqual(remote.payload,empty());
});
