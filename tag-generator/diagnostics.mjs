const labels={title:'Title',subtitle:'Subtitle',ingredients:'Ingredients',price:'Price',type:'Format',vegan:'V badge',glutenFree:'SG badge'};
export function diagnosticRows(project) {
  const unique=new Map();
  for(const error of project.errors) {
    const index=project.tags.findIndex(t=>t.id===error.id),tag=project.tags[index];
    unique.set(`${error.id}:${error.field}`,`Tag ${index+1}${tag?.title?` “${tag.title}”`:''} · ${labels[error.field]||error.field}: ${error.message}`);
  }
  return [...unique.values()];
}
