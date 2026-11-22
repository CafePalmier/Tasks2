export const LIBRARY_KEY='palmier-preset-library-v1';
const CACHE_KEY='palmier-preset-sync-v1';
export function sharedPayload(state){
 const records=state.records.map(p=>({type:p.type,title:p.title,subtitle:p.subtitle||'',price:p.price,ingredients:p.ingredients||'',vegan:!!p.vegan,glutenFree:!!p.glutenFree,individualPrice:!!p.individualPrice,titleColor:p.titleColor||'#376438'}));
 return {records,prices:state.prices,deleted:state.deleted||[]};
}
export function createSync(storage,config,{fetcher=fetch,onChange=()=>{},onStatus=()=>{}}={}){
 let cache=JSON.parse(storage.getItem(CACHE_KEY)||'null')||{revision:null,pending:false},busy=false,conflict=null;
 const persist=()=>storage.setItem(CACHE_KEY,JSON.stringify(cache));
 const local=()=>sharedPayload(JSON.parse(storage.getItem(LIBRARY_KEY)||'{"records":[],"prices":{},"deleted":[]}'));
 const adapter={getItem:k=>storage.getItem(k),setItem(k,v){storage.setItem(k,v);if(k===LIBRARY_KEY){cache.pending=true;persist();}}};
 async function request(path,options={}){
  const response=await fetcher(config.url+'/rest/v1/'+path,{...options,headers:{apikey:config.publishableKey,'Content-Type':'application/json',Prefer:'return=representation',...options.headers},signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('Sync unavailable ('+response.status+'). Local presets and printing remain available.');return response.json();
 }
 function accept(remote){storage.setItem(LIBRARY_KEY,JSON.stringify(remote.payload));cache={revision:remote.revision,pending:false};persist();conflict=null;onChange();onStatus('Synced');}
 async function tick(){
  if(!config.enabled||busy||conflict)return;busy=true;
  try{
   const [remote]=await request('tag_generator_library?id=eq.1&select=revision,payload');if(!remote)throw Error('Apply the Tag Generator migration before enabling sync.');
   const current=local();
   // Never silently discard pre-sync device presets or concurrent device edits.
   if(cache.revision===null&&(current.records.length||Object.keys(current.prices).length||current.deleted.length))cache.pending=true;
   if(cache.pending){
    if(JSON.stringify(current)===JSON.stringify(remote.payload)){accept(remote);return;}
    if(remote.revision!==(cache.revision??0)){conflict=remote;onStatus('Another device changed presets. Choose which version to keep.',true);return;}
    const sent=JSON.stringify(current);
    const rows=await request('tag_generator_library?id=eq.1&revision=eq.'+remote.revision,{method:'PATCH',body:JSON.stringify({payload:current})});
    if(!rows.length){onStatus('Concurrent edit detected. Retrying comparison.');return;}
    if(JSON.stringify(local())!==sent){cache.revision=rows[0].revision;cache.pending=true;persist();return;}
    accept(rows[0]);
   }else if(cache.revision!==remote.revision)accept(remote);else onStatus('Synced');
  }catch(error){onStatus(error.message);}finally{busy=false;}
 }
 async function resolve(useLocal){if(!conflict)return;storage.setItem(CACHE_KEY+'-conflict-backup',JSON.stringify({local:local(),remote:conflict}));if(useLocal){cache.revision=conflict.revision;cache.pending=true;persist();conflict=null;await tick();}else accept(conflict);}
 async function history(){return request('tag_generator_history?select=revision,saved_at&order=revision.desc&limit=30');}
 async function restore(revision){const [entry]=await request('tag_generator_history?revision=eq.'+Number(revision)+'&select=payload');if(!entry)throw Error('History version unavailable.');adapter.setItem(LIBRARY_KEY,JSON.stringify(entry.payload));onChange();await tick();}
 return {storage:adapter,tick,resolve,history,restore};
}
