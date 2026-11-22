import {requestDirectPrint} from './print-view.mjs';
import {createLibrary,canonical,identity} from './library.mjs';
import {createSync} from './sync.mjs';
import {sharedPresetsEnabled} from './sync-config.mjs';
import {createOutput} from './output.mjs';
import {presets,suggestions,findPreset,applyPreset,syncIngredients} from './presets.mjs';
import {initializeEngine,staticDesigns} from './engine.mjs';
import {diagnosticRows} from './diagnostics.mjs';
let options=[],active=-1;
const $=id=>document.getElementById(id),key='palmier-tags-v1',fields=['type','title','subtitle','price','ingredients','design'];let metadata={},tags=[],editing=null,side='front',engine,project,output;
function read(){return {...metadata,id:editing||crypto.randomUUID(),...Object.fromEntries(fields.map(k=>[k,$('tag-'+k).value])),vegan:$('tag-vegan').checked,glutenFree:$('tag-gluten-free').checked};}
function fill(t={type:'pastry'}){metadata={titleColor:t.titleColor,presetTitle:t.presetTitle,recipeVerification:t.recipeVerification,ingredientSync:t.ingredientSync===true};for(const k of fields)$('tag-'+k).value=t[k]||(k==='design'?'side':'');$('tag-vegan').checked=!!t.vegan;$('tag-gluten-free').checked=!!t.glutenFree;visibility();updateFieldControls();}
function visibility(){const type=$('tag-type').value,napkin=type==='napkin';for(const id of ['title-field','price-field','front-guidance'])$(id).hidden=napkin;$('napkin-field').hidden=!napkin;$('reset-ingredients').hidden=type!=='pastry'||!findPreset(metadata.presetTitle||'')?.ingredients;$('pastry-fields').hidden=type!=='pastry';$('title-options').hidden=!['pastry','freezer','provisions'].includes(type);if(!['pastry','freezer','provisions'].includes(type))closeSuggestions();$('subtitle-field').hidden=napkin;$('save-tag').textContent=editing?'Save Tag':'Add Tag';$('cancel-edit').hidden=!editing;}
function save(){try{localStorage.setItem(key,JSON.stringify({version:1,tags,draft:read(),editing}));}catch{$('storage-notice').hidden=false;$('storage-notice').textContent='Device storage is unavailable or full. Keep this tab open until you download.';}}
function el(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}

function showErrors(p,draft=false){
  $('form-error').hidden=true;
  const rows=diagnosticRows(p),panel=$('project-errors');panel.replaceChildren();panel.hidden=!rows.length;
  if(rows.length){panel.append(el('strong',draft?'Draft fields need attention before printing:':'Resolve these fields to download the PDF:'));const list=el('ul','');for(const row of rows)list.append(el('li',row));panel.append(list);}
}

function render(){$('draft-notice').hidden=true;project=engine.createProject(tags);$('tag-collection').replaceChildren();tags.forEach((t,i)=>{const li=el('li','','tg-collection-item');li.append(el('div',t.type,'tg-tag-type'),el('strong',t.type==='napkin'?staticDesigns[t.design]?.label:t.title+' · '+t.price),el('div',t.type!=='napkin'?t.subtitle:''));const actions=el('div','','tg-item-actions');for(const [name,fn] of [['Edit',()=>{editing=t.id;fill(t);$(t.type==='napkin'?'tag-design':'tag-title').focus();}],['Duplicate',()=>tags.splice(i+1,0,{...t,id:crypto.randomUUID()})],['Delete',()=>{tags.splice(i,1);if(editing===t.id){editing=null;fill();}}]]){const b=el('button',name,'tg-button');b.type='button';b.onclick=()=>{fn();save();render();};actions.append(b);}li.append(actions);$('tag-collection').append(li);});$('collection-count').textContent=tags.length;$('collection-empty').hidden=!!tags.length;$('clear-all').disabled=!tags.length;$('sheet-count').textContent=`${tags.length} tags · ${project.sheets.length} sheets`;$('sheet-previews').replaceChildren();project.sheets.forEach((_,i)=>{const f=el('figure','','tg-sheet');f.append(el('figcaption',`Sheet ${i+1} · ${side}`));const surface=el('div','','tg-sheet-surface');surface.innerHTML=engine.renderSheetSvg(project,i,side);f.append(surface);$('sheet-previews').append(f);});showErrors(project);$('project-warnings').textContent=project.warnings.join(' ');$('project-warnings').hidden=!project.warnings.length;for(const id of ['download-pdf','download-test','print-tags'])$(id).disabled=!tags.length||!!project.errors.length||!engine.typographyStatus.ready;$('duplex-settings').textContent=project.duplex?'Print double-sided, flip on short edge. Every sheet has a paired back, including blank backs. Test registration first.':'Print single-sided. No reverse pages are included.';}
$('tag-type').onchange=()=>{closeSuggestions();visibility();save();if(engine)renderDraft();};let draftTimer; $('tag-form').oninput=event=>{if(event.target===$('tag-title'))openSuggestions();if(event.target===$('tag-ingredients'))metadata.ingredientSync=false;if(event.target===$('tag-subtitle')){const t=syncIngredients(read(),findPreset(metadata.presetTitle||''));$('tag-ingredients').value=t.ingredients;}save();clearTimeout(draftTimer);draftTimer=setTimeout(()=>{if(engine)renderDraft();},180);};
function renderDraft(force=false){const draft=read();if(!force&&draft.type!=='napkin'&&!draft.title&&!draft.price&&!draft.ingredients&&!draft.subtitle){render();return;}const list=tags.filter(t=>t.id!==editing);list.push(draft);const p=engine.createProject(list);$('draft-notice').hidden=false;$('draft-notice').textContent='Preview includes your unsaved draft. Add or Save Tag to include it in the PDF.';$('sheet-previews').replaceChildren();p.sheets.forEach((_,i)=>{const f=el('figure','','tg-sheet');f.append(el('figcaption',`Sheet ${i+1} · ${side} · draft preview`));const surface=el('div','','tg-sheet-surface');surface.innerHTML=engine.renderSheetSvg(p,i,side);f.append(surface);$('sheet-previews').append(f);});showErrors(p,true);}

$('tag-form').onsubmit=e=>{e.preventDefault();const match=$('tag-type').value==='pastry'?findPreset($('tag-title').value):null;if(match&&match.title!==metadata.presetTitle)selectPreset(match);const t=read(),errors=engine.validateTag(t);if(errors.length){renderDraft(true);return;}if(t.type==='napkin'){for(const field of ['title','subtitle','price','ingredients'])delete t[field];delete t.presetTitle;delete t.ingredientSync;delete t.titleColor;delete t.recipeVerification;}else{t.title=engine.normalizeFrontText(t.title);t.subtitle=t.subtitle;t.price=engine.normalizePrice(t.price);}if(t.type!=='pastry'){t.ingredients='';t.vegan=t.glutenFree=false;}const i=tags.findIndex(x=>x.id===editing);if(i>=0)tags[i]=t;else tags.push(t);editing=null;fill();save();render();};
$('cancel-edit').onclick=()=>{editing=null;fill();save();render();};$('clear-all').onclick=()=>{if(confirm('Clear all tags and the current draft on this device?')){tags=[];editing=null;fill();save();render();}};
for(const s of ['front','back'])$('view-'+s).onclick=()=>{side=s;for(const v of ['front','back'])$('view-'+v).setAttribute('aria-pressed',String(s===v));render();};
function showAppError(message){$('app-status').textContent=message;$('app-status').hidden=false;}
async function download(registration){try{$('app-status').hidden=true;const bytes=await output.bytes(tags,registration);const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;const now=new Date(),date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');a.download=`Cafe_Palmier_${registration?'Registration':'Tags'}_${date}.pdf`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){showAppError(e.message);}}
$('download-pdf').onclick=()=>download(false);$('download-test').onclick=()=>download(true);
try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.version===1&&Array.isArray(saved.tags)){tags=saved.tags.filter(t=>t&&typeof t.id==='string'&&['pastry','freezer','provisions','napkin'].includes(t.type));editing=saved.editing;fill(saved.draft);}}catch{$('storage-notice').hidden=false;$('storage-notice').textContent='Saved work could not be read. The stored copy has not been deleted.';}
try{engine=await initializeEngine();output=createOutput(engine);visibility();render();}catch(e){showAppError('Could not load the generator: '+e.message);$('save-tag').disabled=true;}


function closeSuggestions(){$('title-suggestions').hidden=true;$('tag-title').setAttribute('aria-expanded','false');$('tag-title').removeAttribute('aria-activedescendant');active=-1;}
function openSuggestions(all=false){const type=$('tag-type').value;if(!['pastry','freezer','provisions'].includes(type))return;options=library?libraryTitles(all?'':$('tag-title').value):suggestions(all?'':$('tag-title').value,type);active=-1;const list=$('title-suggestions');list.replaceChildren();list.hidden=false;$('tag-title').setAttribute('aria-expanded','true');options.forEach((p,i)=>{const b=el('div',p.title,'tg-option');b.id='preset-'+i;b.setAttribute('role','option');b.setAttribute('aria-selected','false');b.onpointerdown=e=>e.preventDefault();b.onclick=()=>selectPreset(p);list.append(b);});if(!options.length)list.append(el('div','Use your custom title.','tg-help'));}
function selectPreset(p){if(p.origin){selectLibraryPreset(p);return;}const current=read();if(current.type==='freezer'){fill({...current,title:p.title,presetTitle:undefined,titleColor:undefined,recipeVerification:undefined,ingredientSync:false});closeSuggestions();save();if(engine)renderDraft();return;}const previous=presets.find(x=>x.title===metadata.presetTitle),proposal=applyPreset(current,p,previous);let tag=proposal.tag;if(proposal.conflicts.length){if(!confirm('Replace your edited '+proposal.conflicts.join(', ')+' with this preset’s defaults? Cancel keeps your edits.'))tag=proposal.tag;else tag=applyPreset(current,p,previous,true).tag;}fill(tag);closeSuggestions();save();if(engine)renderDraft();}
$('title-options').onclick=()=>{$('tag-title').focus();openSuggestions(true);};
$('tag-title').onkeydown=e=>{if(e.key==='Escape'){closeSuggestions();return;}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();if($('title-suggestions').hidden)openSuggestions(true);active=(active+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;for(const [i,node]of [...$('title-suggestions').children].entries())node.setAttribute('aria-selected',String(i===active));if(active>=0&&options[active]){$('tag-title').setAttribute('aria-activedescendant','preset-'+active);$('preset-'+active).scrollIntoView({block:'nearest'});}}if(e.key==='Enter'&&!$('title-suggestions').hidden&&options[active]){e.preventDefault();selectPreset(options[active]);}};
$('tag-title').onchange=()=>{const type=$('tag-type').value,p=findPreset($('tag-title').value,type);if(p&&(type==='freezer'||p.title!==metadata.presetTitle))selectPreset(p);};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('[for="tag-title"]'))closeSuggestions();});

$('print-tags').onclick=()=>{
  const p=engine.createProject(structuredClone(tags)),problem=output.status(p);
  if(problem){showAppError(problem);return;}
  $('app-status').hidden=true;
  try{requestDirectPrint(engine,p,$('tag-print-root'));}catch(error){showAppError(error.message);}
};

$('reset-ingredients').onclick=()=>{const tag=syncIngredients(read(),findPreset(metadata.presetTitle||''),true);fill(tag);save();if(engine)renderDraft();};

let library;
let presetSync;
try{presetSync=createSync(localStorage,{...window.SUPABASE_CONFIG,enabled:sharedPresetsEnabled},{onChange:()=>{library=createLibrary(presetSync.storage);refreshSubtitles();},onStatus:(message,conflict)=>{const status=$('preset-sync-status');if(status)status.textContent=message;const controls=$('preset-conflict');if(controls)controls.hidden=!conflict;}});library=createLibrary(presetSync.storage);}catch(error){showAppError('Preset library could not load: '+error.message);}
const subtitleList=document.createElement('datalist');subtitleList.id='saved-subtitles';document.body.append(subtitleList);$('tag-subtitle').setAttribute('list',subtitleList.id);
function libraryTitles(query=''){
 const grouped=new Map();for(const p of library.all().filter(p=>p.type===$('tag-type').value)){const k=canonical(p.title);if(!grouped.has(k)||!p.subtitle)grouped.set(k,p);}
 return [...grouped.values()].filter(p=>canonical(p.title).includes(canonical(query))).map(p=>({...p,origin:p.origin||'builtin'}));
}
function refreshSubtitles(){subtitleList.replaceChildren();if(!library)return;for(const p of library.all().filter(p=>p.type===$('tag-type').value&&canonical(p.title)===canonical($('tag-title').value)&&p.subtitle)){const o=document.createElement('option');o.value=p.subtitle;subtitleList.append(o);}}
function selectLibraryPreset(p){
 const current=read();let ingredients=p.ingredients;
 if(current.type==='pastry'&&current.ingredients&&current.ingredients!==ingredients&&!metadata.ingredientSync&&!confirm('Replace the ingredients currently entered with this preset?'))ingredients=current.ingredients;
 fill({...current,...p,ingredients,presetTitle:p.title,recipeVerification:false,ingredientSync:false});
 if(p.type==='pastry'&&canonical(p.title)==='muffin'&&ingredients===p.ingredients)metadata.ingredientSync=true;
 closeSuggestions();refreshSubtitles();showHistoricalPrices(p);save();if(engine)renderDraft();
}
const oldTitleChange=$('tag-title').onchange;
$('tag-title').onchange=()=>{if(library&&$('tag-type').value!=='napkin'){const p=libraryTitles().find(p=>canonical(p.title)===canonical($('tag-title').value));if(p)selectLibraryPreset(p);}else oldTitleChange();refreshSubtitles();};
$('tag-subtitle').onchange=()=>{const p=library?.all().find(p=>identity(p)===identity(read()));if(p)selectLibraryPreset(p);};
const oldSubmit=$('tag-form').onsubmit;
$('tag-form').onsubmit=e=>{const before=read();if(engine.validateTag(before).length){oldSubmit(e);return;}if(before.type==='pastry'&&library)metadata.presetTitle=before.title;oldSubmit(e);const saved=tags.find(t=>t.id===before.id)||tags.at(-1);if(saved&&saved.type!=='napkin'&&identity(saved)===identity(before)&&!engine.validateTag(saved).length){try{library?.remember(saved,confirm);}catch(error){showAppError('Tag saved, but preset storage failed: '+error.message);}}refreshSubtitles();};
$('ingredients-help').textContent='Please verify ingredients and allergens before printing.';
refreshSubtitles();

function updateFieldControls(){for(const field of ['title','subtitle']){const button=$('control-'+field);if(button){const empty=!$('tag-'+field).value;button.textContent=empty?'⌄':'×';button.setAttribute('aria-label',empty?'Show '+field+' suggestions':'Clear '+field);}}}
for(const field of ['title','subtitle','price','ingredients']){
 const input=$('tag-'+field),button=el('button','×','search-clear-button tg-field-clear');
 button.type='button';button.setAttribute('aria-label','Clear '+field);
 button.id='control-'+field;
 const wrap=el('div','','tg-input-wrap');input.before(wrap);wrap.append(input,button);
 input.addEventListener('input',updateFieldControls);
 button.onclick=()=>{
  if(!input.value&&field==='title'){input.focus();openSuggestions(true);return;}
  if(!input.value&&field==='subtitle'){
   refreshSubtitles();$('subtitle-options-list')?.remove();
   const list=el('div','','tg-subtitle-options');list.id='subtitle-options-list';
   for(const option of subtitleList.options){const choice=el('button',option.value,'tg-option');choice.type='button';choice.onclick=()=>{input.value=option.value;list.remove();input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));input.focus();};list.append(choice);}
   if(!list.children.length)list.append(el('span','No saved subtitles for this title.','tg-help'));
   wrap.after(list);input.focus();return;
  }
  input.value='';if(field==='title'){metadata.presetTitle=undefined;closeSuggestions();refreshSubtitles();}$('subtitle-options-list')?.remove();input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();
 };
}
updateFieldControls();
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#subtitle-field'))$('subtitle-options-list')?.remove();});
const clearDraft=el('button','Clear tag','tg-button');clearDraft.type='button';$('save-tag').after(clearDraft);
clearDraft.onclick=()=>{clearTimeout(draftTimer);const type=$('tag-type').value;editing=null;fill({type});closeSuggestions();refreshSubtitles();if($('historical-price-options'))$('historical-price-options').hidden=true;$('app-status').hidden=true;save();render();};

function showHistoricalPrices(p){
 let panel=$('historical-price-options');if(!panel){panel=document.createElement('label');panel.id='historical-price-options';panel.className='tg-field';$('tag-price').closest('label').after(panel);}
 panel.replaceChildren();panel.hidden=!p.priceConflict;if(!p.priceConflict)return;
 panel.append(el('span','Historical prices differ. Choose a price or enter your current price.'));
 const select=document.createElement('select');select.setAttribute('aria-label','Historical price');const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose historical price';select.append(placeholder);
 for(const price of p.historicalPrices){const option=document.createElement('option');option.value=price;option.textContent=price;select.append(option);}
 select.onchange=()=>{if(select.value){$('tag-price').value=select.value;save();if(engine)renderDraft();}};panel.append(select);
}

const management=el('details','','tg-print-check');management.append(el('summary','Manage shared presets'));
const syncStatus=el('p',sharedPresetsEnabled?'Connecting…':'Shared sync is not enabled yet. Presets are saved on this device.','tg-help');syncStatus.id='preset-sync-status';management.append(syncStatus);
const conflictControls=el('div','');conflictControls.id='preset-conflict';conflictControls.hidden=true;
for(const [label,local]of [['Keep this device’s version',true],['Use shared version',false]]){const b=el('button',label,'tg-button');b.type='button';b.onclick=()=>{if(confirm('Resolve this conflict using '+(local?'this device’s':'the shared')+' version? The other version is backed up.'))presetSync.resolve(local);};conflictControls.append(b);}management.append(conflictControls);
const presetSearch=document.createElement('input');presetSearch.type='search';presetSearch.placeholder='Search presets';presetSearch.setAttribute('aria-label','Search presets');management.append(presetSearch);
const presetRows=el('div','');management.append(presetRows);
function listManagedPresets(){presetRows.replaceChildren();for(const p of (library?.all()||[]).filter(p=>canonical(p.title+' '+(p.subtitle||'')).includes(canonical(presetSearch.value)))){const row=el('div','','tg-item-actions');row.append(el('span',p.type+' · '+p.title+(p.subtitle?' — '+p.subtitle:'')));for(const [label,action]of [['Edit',()=>{editing=null;fill(p);refreshSubtitles();renderDraft();$('tag-title').focus();}],['Delete',()=>{if(confirm('Delete preset '+p.title+(p.subtitle?' — '+p.subtitle:'')+'?')){try{library.remove(p);listManagedPresets();refreshSubtitles();presetSync?.tick();}catch(error){showAppError(error.message);}}}]]){const b=el('button',label,'tg-button');b.type='button';b.onclick=action;row.append(b);}presetRows.append(row);}}
presetSearch.oninput=listManagedPresets;management.ontoggle=()=>{if(management.open)listManagedPresets();};
const historyButton=el('button','Restore shared version','tg-button');historyButton.type='button';historyButton.disabled=!sharedPresetsEnabled;
historyButton.onclick=async()=>{try{const versions=await presetSync.history();const choice=prompt('Available versions:\n'+versions.map(v=>v.revision+' — '+v.saved_at).join('\n')+'\nEnter a revision to restore:');if(choice===null)return;const revision=Number(choice);if(!versions.some(v=>v.revision===revision))throw Error('Choose a listed revision.');if(confirm('Restore the entire preset library to revision '+revision+'?')){await presetSync.restore(revision);listManagedPresets();}}catch(error){showAppError(error.message);}};management.append(historyButton);$('tag-form').after(management);
if(sharedPresetsEnabled&&presetSync){presetSync.tick();setInterval(()=>presetSync.tick(),10000);window.addEventListener('online',()=>presetSync.tick());}
