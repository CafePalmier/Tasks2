import {validateGeometry} from './engine.mjs';
// Reuse the PDF engine's sheet model and SVG vectors; no additional placement logic.
export function printSheets(engine,project) {
  if(!engine.typographyStatus.ready)throw Error(engine.typographyStatus.message);
  if(!project.tags.length||project.errors.length||validateGeometry(project).length)throw Error('Resolve saved tag errors before printing.');
  return project.sheets.flatMap((_,index)=>(project.duplex?['front','back']:['front']).map(side=>`<section class="tag-print-sheet" data-sheet="${index+1}" data-side="${side}">${engine.renderSheetSvg(project,index,side)}</section>`)).join('');
}
export function requestDirectPrint(engine,project,root,browser=window) {
  const markup=printSheets(engine,project);
  root.innerHTML=markup;
  if(typeof browser.print!=='function')throw Error('Direct printing is unavailable here. Use Print PDF instead.');
  // No await, popup, iframe, PDF plugin, external image or font load between tap and print.
  browser.print();
}
