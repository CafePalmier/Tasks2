// One cached PDF per saved collection: download and print receive identical bytes.
export function createOutput(engine) {
  let key;const cache=new Map();
  function status(project) {
    if(!project.tags.length)return 'Add and save at least one tag before downloading or printing.';
    if(!engine.typographyStatus.ready)return engine.typographyStatus.message;
    if(project.errors.length)return 'Resolve the saved tag errors shown below before downloading or printing.';
    return '';
  }
  async function bytes(tags,registration=false,flipEdge='short',orientation='landscape') {
    const project=engine.createProject(tags,{flipEdge,orientation}),problem=status(project);
    if(problem)throw Error(problem);
    const next=JSON.stringify(tags);
    if(key!==next){key=next;cache.clear();}
    const mode=project.duplex?flipEdge:'single';
    const variant=`${orientation}:${mode}:${registration}`;
    if(!cache.has(variant))cache.set(variant,engine.exportPdf(project,{registration}));
    const pending=cache.get(variant);
    try{return await pending;}catch(e){if(cache.get(variant)===pending)cache.delete(variant);throw Error('PDF generation failed: '+e.message+' Try again; your saved tags are unchanged.');}
  }
  return {status,bytes};
}
