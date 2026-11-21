// One cached PDF per saved collection: download and print receive identical bytes.
export function createOutput(engine) {
  let key;const cache=new Map();
  function status(project) {
    if(!project.tags.length)return 'Add and save at least one tag before downloading or printing.';
    if(!engine.typographyStatus.ready)return engine.typographyStatus.message;
    if(project.errors.length)return 'Resolve the saved tag errors shown below before downloading or printing.';
    return '';
  }
  async function bytes(tags,registration=false) {
    const project=engine.createProject(tags),problem=status(project);
    if(problem)throw Error(problem);
    const next=JSON.stringify(tags);
    if(key!==next){key=next;cache.clear();}
    if(!cache.has(registration))cache.set(registration,engine.exportPdf(project,{registration}));
    const pending=cache.get(registration);
    try{return await pending;}catch(e){if(cache.get(registration)===pending)cache.delete(registration);throw Error('PDF generation failed: '+e.message+' Try again; your saved tags are unchanged.');}
  }
  return {status,bytes};
}
export function openPrintContext(browser=window) {
  // Must run synchronously inside the click gesture (particularly Safari).
  const viewer=browser.open('about:blank','_blank');
  if(viewer){viewer.document.title='Preparing Café Palmier PDF';viewer.document.body.textContent='Preparing your validated PDF…';}
  return viewer;
}
export function showPdf(viewer,url) {
  if(!viewer||viewer.closed)return false;
  viewer.location.replace(url);return true;
}
