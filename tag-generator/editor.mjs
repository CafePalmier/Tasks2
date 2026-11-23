import {requestDirectPrint} from './print-view.mjs';
import {createLibrary,canonical,identity} from './library.mjs';
import {createSync} from './sync.mjs';
import {sharedPresetsEnabled} from './sync-config.mjs';
import {createOutput} from './output.mjs';
import {presets,suggestions,findPreset,applyPreset,syncIngredients} from './presets.mjs';
import {initializeEngine,staticDesigns} from './engine.mjs';
import {diagnosticRows} from './diagnostics.mjs';
import {titleCaseIngredients} from './ingredient-case.mjs';
const $=id=>document.getElementById(id),key='palmier-tags-v1',fields=['type','title','subtitle','price','ingredients','design'];let metadata={},tags=[],editing=null,side='front',engine,project,output,library,presetSync;
function formatIngredients(tag){
  return tag.type==='pastry'&&typeof tag.ingredients==='string'
    ? {...tag,ingredients:titleCaseIngredients(tag.ingredients)}
    : tag;
}
function read(){return formatIngredients({...metadata,id:editing||crypto.randomUUID(),...Object.fromEntries(fields.map(k=>[k,$('tag-'+k).value])),vegan:$('tag-vegan').checked,glutenFree:$('tag-gluten-free').checked});}
function fill(t={type:'pastry'}){titleSuggestions.close();subtitleSuggestions.close();t=formatIngredients(t);metadata={titleColor:t.titleColor,presetTitle:t.presetTitle,recipeVerification:t.recipeVerification,ingredientSync:t.ingredientSync===true};for(const k of fields)$('tag-'+k).value=t[k]||(k==='design'?'side':'');$('tag-vegan').checked=!!t.vegan;$('tag-gluten-free').checked=!!t.glutenFree;visibility();updateFieldControls();}
function visibility(){const type=$('tag-type').value,napkin=type==='napkin';for(const id of ['title-field','price-field','front-guidance'])$(id).hidden=napkin;$('napkin-field').hidden=!napkin;$('reset-ingredients').hidden=type!=='pastry'||!findPreset(metadata.presetTitle||'')?.ingredients;$('pastry-fields').hidden=type!=='pastry';$('subtitle-field').hidden=napkin;$('save-tag').textContent=editing?'Save Tag':'Add Tag';$('cancel-edit').hidden=!editing;}
function save(){try{localStorage.setItem(key,JSON.stringify({version:1,tags,draft:read(),editing}));}catch{$('storage-notice').hidden=false;$('storage-notice').textContent='Device storage is unavailable or full. Keep this tab open until you download.';}}
function el(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}

function showErrors(p,draft=false){
  $('form-error').hidden=true;
  const rows=diagnosticRows(p),panel=$('project-errors');panel.replaceChildren();panel.hidden=!rows.length;
  if(rows.length){panel.append(el('strong',draft?'Draft fields need attention before printing:':'Resolve these fields to download the PDF:'));const list=el('ul','');for(const row of rows)list.append(el('li',row));panel.append(list);}
}

function render(){$('draft-notice').hidden=true;project=engine.createProject(tags);$('tag-collection').replaceChildren();tags.forEach((t,i)=>{const li=el('li','','tg-collection-item');li.append(el('div',t.type,'tg-tag-type'),el('strong',t.type==='napkin'?staticDesigns[t.design]?.label:t.title+' · '+t.price),el('div',t.type!=='napkin'?t.subtitle:''));const actions=el('div','','tg-item-actions');for(const [name,fn] of [['Edit',()=>{editing=t.id;fill(t);$(t.type==='napkin'?'tag-design':'tag-title').focus();}],['Duplicate',()=>tags.splice(i+1,0,{...t,id:crypto.randomUUID()})],['Delete',()=>{tags.splice(i,1);if(editing===t.id){editing=null;fill();}}]]){const b=el('button',name,'tg-button');b.type='button';b.onclick=()=>{fn();save();render();};actions.append(b);}li.append(actions);$('tag-collection').append(li);});$('collection-count').textContent=tags.length;$('collection-empty').hidden=!!tags.length;$('clear-all').disabled=!tags.length;$('sheet-count').textContent=`${tags.length} tags · ${project.sheets.length} sheets`;$('sheet-previews').replaceChildren();project.sheets.forEach((_,i)=>{const f=el('figure','','tg-sheet');f.append(el('figcaption',`Sheet ${i+1} · ${side}`));const surface=el('div','','tg-sheet-surface');surface.innerHTML=engine.renderSheetSvg(project,i,side);f.append(surface);$('sheet-previews').append(f);});showErrors(project);$('project-warnings').textContent=project.warnings.join(' ');$('project-warnings').hidden=!project.warnings.length;for(const id of ['download-pdf','download-test','print-tags'])$(id).disabled=!tags.length||!!project.errors.length||!engine.typographyStatus.ready;$('duplex-settings').textContent=project.duplex?'Print double-sided, flip on short edge. Every sheet has a paired back, including blank backs. Test registration first.':'Print single-sided. No reverse pages are included.';}
$('tag-type').onchange=()=>{const type=$('tag-type').value;editing=null;fill({type});if($('historical-price-options'))$('historical-price-options').hidden=true;save();render();};let draftTimer; $('tag-form').oninput=event=>{if(event.target===$('tag-ingredients'))metadata.ingredientSync=false;if(event.target===$('tag-subtitle')){const t=syncIngredients(read(),findPreset(metadata.presetTitle||''));$('tag-ingredients').value=t.ingredients;}save();clearTimeout(draftTimer);draftTimer=setTimeout(()=>{if(engine)renderDraft();},180);};
function renderDraft(force=false){const draft=read();if(!force&&draft.type!=='napkin'&&!draft.title&&!draft.price&&!draft.ingredients&&!draft.subtitle){render();return;}const list=tags.filter(t=>t.id!==editing);list.push(draft);const p=engine.createProject(list);$('draft-notice').hidden=false;$('draft-notice').textContent='Preview includes your unsaved draft. Add or Save Tag to include it in the PDF.';$('sheet-previews').replaceChildren();p.sheets.forEach((_,i)=>{const f=el('figure','','tg-sheet');f.append(el('figcaption',`Sheet ${i+1} · ${side} · draft preview`));const surface=el('div','','tg-sheet-surface');surface.innerHTML=engine.renderSheetSvg(p,i,side);f.append(surface);$('sheet-previews').append(f);});showErrors(p,true);}

$('tag-form').onsubmit=e=>{e.preventDefault();const match=$('tag-type').value==='pastry'?findPreset($('tag-title').value):null;if(match&&match.title!==metadata.presetTitle)selectPreset(match);const t=read(),errors=engine.validateTag(t);if(errors.length){renderDraft(true);return;}if(t.type==='napkin'){for(const field of ['title','subtitle','price','ingredients'])delete t[field];delete t.presetTitle;delete t.ingredientSync;delete t.titleColor;delete t.recipeVerification;}else{t.subtitle=t.subtitle;t.price=engine.normalizePrice(t.price);}if(t.type!=='pastry'){t.ingredients='';t.vegan=t.glutenFree=false;}const i=tags.findIndex(x=>x.id===editing);if(i>=0)tags[i]=t;else tags.push(t);editing=null;fill({type:t.type});save();render();};
$('cancel-edit').onclick=()=>{editing=null;fill();save();render();};$('clear-all').onclick=()=>{if(confirm('Clear all tags and the current draft on this device?')){tags=[];editing=null;fill();save();render();}};
for(const s of ['front','back'])$('view-'+s).onclick=()=>{side=s;for(const v of ['front','back'])$('view-'+v).setAttribute('aria-pressed',String(s===v));render();};
function showAppError(message){$('app-status').textContent=message;$('app-status').hidden=false;}
async function download(registration){try{$('app-status').hidden=true;const bytes=await output.bytes(tags,registration);const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;const now=new Date(),date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');a.download=`Cafe_Palmier_${registration?'Registration':'Tags'}_${date}.pdf`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){showAppError(e.message);}}
$('download-pdf').onclick=()=>download(false);$('download-test').onclick=()=>download(true);
function selectPreset(p){if(p.origin){selectLibraryPreset(p);return;}const current=read();if(current.type==='freezer'){fill({...current,title:p.title,presetTitle:undefined,titleColor:undefined,recipeVerification:undefined,ingredientSync:false});save();if(engine)renderDraft();return;}const previous=presets.find(x=>x.title===metadata.presetTitle),proposal=applyPreset(current,p,previous);let tag=proposal.tag;if(proposal.conflicts.length){if(!confirm('Replace your edited '+proposal.conflicts.join(', ')+' with this preset’s defaults? Cancel keeps your edits.'))tag=proposal.tag;else tag=applyPreset(current,p,previous,true).tag;}fill(tag);save();if(engine)renderDraft();}
$('print-tags').onclick=()=>{
  const p=engine.createProject(structuredClone(tags)),problem=output.status(p);
  if(problem){showAppError(problem);return;}
  $('app-status').hidden=true;
  try{requestDirectPrint(engine,p,$('tag-print-root'));}catch(error){showAppError(error.message);}
};

$('reset-ingredients').onclick=()=>{const tag=syncIngredients(read(),findPreset(metadata.presetTitle||''),true);fill(tag);save();if(engine)renderDraft();};

try {
  presetSync = createSync(localStorage, {...window.SUPABASE_CONFIG, enabled:sharedPresetsEnabled}, {
    onChange: () => {
      library = createLibrary(presetSync.storage);
      titleSuggestions.refresh();
      subtitleSuggestions.refresh();
    },
    onStatus: (message, conflict) => {
      const status = $('preset-sync-status');
      if (status) status.textContent = message;
      const controls = $('preset-conflict');
      if (controls) controls.hidden = !conflict;
    }
  });
  library = createLibrary(presetSync.storage);
} catch (error) {
  showAppError('Preset library could not load: ' + error.message);
}
function libraryTitles(query=''){
 const filter=canonical(query);
 const grouped=new Map();for(const p of library.all().filter(p=>p.type===$('tag-type').value)){const k=canonical(p.title);if(!grouped.has(k)||!p.subtitle)grouped.set(k,p);}
 return [...grouped.entries()].filter(([key])=>key.includes(filter)).map(([,p])=>({...p,origin:p.origin||'builtin'}));
}
function librarySubtitles(query) {
  const type = $('tag-type').value;
  const title = canonical($('tag-title').value);
  const filter = canonical(query);
  return library?.all().filter(p => p.type === type && canonical(p.title) === title &&
    p.subtitle && canonical(p.subtitle).includes(filter)) || [];
}
function selectLibraryPreset(p){
 const current=read();let ingredients=p.ingredients;
 if(current.type==='pastry'&&current.ingredients&&current.ingredients!==ingredients&&!metadata.ingredientSync&&!confirm('Replace the ingredients currently entered with this preset?'))ingredients=current.ingredients;
 fill({...current,...p,ingredients,presetTitle:p.title,recipeVerification:false,ingredientSync:false});
 if(p.type==='pastry'&&canonical(p.title)==='muffin'&&ingredients===p.ingredients)metadata.ingredientSync=true;
 showHistoricalPrices(p);save();if(engine)renderDraft();
}
$('tag-title').onchange = () => {
  const type = $('tag-type').value;
  const title = $('tag-title').value;
  if (type === 'napkin' || canonical(title) === canonical(metadata.presetTitle)) return;
  const preset = library ? libraryTitles(title).find(p => canonical(p.title) === canonical(title))
    : findPreset(title, type);
  if (preset) selectPreset(preset);
};
$('tag-subtitle').onchange = () => {
  const tag = read();
  const preset = library?.all().find(p => identity(p) === identity(tag));
  if (preset) selectLibraryPreset(preset);
};
const oldSubmit=$('tag-form').onsubmit;
$('tag-form').onsubmit=e=>{const before=read();if(engine.validateTag(before).length){oldSubmit(e);return;}if(before.type==='pastry'&&library)metadata.presetTitle=before.title;oldSubmit(e);const saved=tags.find(t=>t.id===before.id)||tags.at(-1);if(saved&&saved.type!=='napkin'&&identity(saved)===identity(before)&&!engine.validateTag(saved).length){try{library?.remember(saved,confirm);}catch(error){showAppError('Tag saved, but preset storage failed: '+error.message);}}};
$('ingredients-help').textContent='Please verify ingredients and allergens before printing.';
function updateFieldControls() {
  for (const field of ['title', 'subtitle']) {
    const button = $('control-' + field);
    const empty = !$('tag-' + field).value;
    button.textContent = empty ? '⌄' : '×';
    button.setAttribute('aria-label', empty ? 'Show ' + field + ' suggestions' : 'Clear ' + field);
  }
}

const titleSuggestions = setupSuggestions('title', query => {
  return library ? libraryTitles(query) : suggestions(query, $('tag-type').value);
}, selectPreset);
const subtitleSuggestions = setupSuggestions('subtitle', librarySubtitles, preset => {
  const input = $('tag-subtitle');
  input.value = preset.subtitle;
  input.dispatchEvent(new Event('input', {bubbles:true}));
  selectLibraryPreset(preset);
});

function setupSuggestions(field, findOptions, select) {
  const input = $('tag-' + field);
  const button = $('control-' + field);
  const list = $(field + '-suggestions');
  const container = $(field + '-field');
  let options = [], active = -1, showAll = false;

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function choose(index) {
    close();
    select(options[index]);
  }

  function open(all = false) {
    close();
    showAll = all;
    options = findOptions(all ? '' : input.value);
    if (!options.length && !all) return;
    list.replaceChildren();
    options.forEach((preset, index) => {
      const option = el('div', preset[field], 'tg-option');
      option.id = list.id + '-' + index;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.onclick = () => choose(index);
      list.append(option);
    });
    if (!options.length) {
      const message = el('div', field === 'subtitle' ? 'No saved subtitles for this title.' : 'No saved titles.', 'tg-help tg-option');
      message.setAttribute('role', 'option');
      message.setAttribute('aria-disabled', 'true');
      list.append(message);
    }
    list.scrollTop = 0;
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  input.addEventListener('input', () => {
    updateFieldControls();
    open();
  });
  input.addEventListener('click', () => {
    if (list.hidden) open();
    else close();
  });
  input.addEventListener('blur', close);
  // Keep focus on the input when tapping or scrolling the options.
  list.addEventListener('pointerdown', event => event.preventDefault());
  button.addEventListener('pointerdown', event => event.preventDefault());
  document.addEventListener('pointerdown', event => {
    if (!container.contains(event.target)) close();
  });

  input.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape' && !list.hidden) {
      event.preventDefault();
      close();
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (list.hidden) open();
      if (!options.length) return;
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      active = active < 0 ? (step > 0 ? 0 : options.length - 1) :
        (active + step + options.length) % options.length;
      for (const [index, option] of Array.from(list.children).entries()) {
        option.setAttribute('aria-selected', String(index === active));
      }
      const option = list.children[active];
      input.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({block:'nearest'});
    }
    if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      choose(active);
    }
  });

  button.onclick = () => {
    input.focus();
    if (!input.value) {
      open(true);
      return;
    }
    input.value = '';
    if (field === 'title') metadata.presetTitle = undefined;
    input.dispatchEvent(new Event('input', {bubbles:true}));
  };
  return {close, refresh: () => { if (!list.hidden) open(showAll); }};
}

for (const field of ['price', 'ingredients']) {
  const input = $('tag-' + field), button = el('button', '×', 'search-clear-button tg-field-clear');
  button.type = 'button';
  button.setAttribute('aria-label', 'Clear ' + field);
  const wrap = el('div', '', 'tg-input-wrap');
  input.before(wrap);
  wrap.append(input, button);
  button.onclick = () => {
    input.value = '';
    input.dispatchEvent(new Event('input', {bubbles:true}));
    input.focus();
  };
}
updateFieldControls();
const clearDraft=el('button','Clear tag','tg-button');clearDraft.type='button';$('save-tag').after(clearDraft);
clearDraft.onclick=()=>{clearTimeout(draftTimer);const type=$('tag-type').value;editing=null;fill({type});if($('historical-price-options'))$('historical-price-options').hidden=true;$('app-status').hidden=true;save();render();};

function showHistoricalPrices(p){
 let panel=$('historical-price-options');if(!panel){panel=document.createElement('label');panel.id='historical-price-options';panel.className='tg-field';$('tag-price').closest('label').after(panel);}
 panel.replaceChildren();panel.hidden=!p.priceConflict;if(!p.priceConflict)return;
 panel.append(el('span','Historical prices differ. Choose a price or enter your current price.'));
 const select=document.createElement('select');select.setAttribute('aria-label','Historical price');const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose historical price';select.append(placeholder);
 for(const price of p.historicalPrices){const option=document.createElement('option');option.value=price;option.textContent=price;select.append(option);}
 select.onchange=()=>{if(select.value){$('tag-price').value=select.value;save();if(engine)renderDraft();}};panel.append(select);
}

const conflictControls=el('div','');conflictControls.id='preset-conflict';conflictControls.hidden=true;conflictControls.append(el('p','Another device changed presets. Choose which version to keep.'));
for(const [label,local]of [['Keep this device’s version',true],['Use shared version',false]]){const b=el('button',label,'tg-button');b.type='button';b.onclick=()=>{if(confirm('Resolve this conflict using '+(local?'this device’s':'the shared')+' version?'))presetSync.resolve(local);};conflictControls.append(b);} $('tag-form').after(conflictControls);
try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.version===1&&Array.isArray(saved.tags)){tags=saved.tags.filter(t=>t&&typeof t.id==='string'&&['pastry','freezer','provisions','napkin'].includes(t.type)).map(formatIngredients);editing=saved.editing;fill(saved.draft);}}catch{$('storage-notice').hidden=false;$('storage-notice').textContent='Saved work could not be read. The stored copy has not been deleted.';}
$('tag-ingredients').onchange=event=>{event.target.value=titleCaseIngredients(event.target.value);};
try{
  engine=await initializeEngine();
  output=createOutput(engine);
  if(!engine.typographyStatus.ready){
    const notice=$('typography-notice');
    notice.textContent=engine.typographyStatus.message;
    notice.hidden=false;
  }
  visibility();
  render();
}catch(e){showAppError('Could not load the generator: '+e.message);$('save-tag').disabled=true;}

if(sharedPresetsEnabled&&presetSync){presetSync.tick();setInterval(()=>presetSync.tick(),10000);window.addEventListener('online',()=>presetSync.tick());}
