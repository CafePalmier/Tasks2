import {validateGeometry} from './engine.mjs?v=3';

export const PORTRAIT_PRINT_MARGIN=24;

export function usesPortraitPrint(device=navigator) {
  return /iPad|iPhone|iPod/.test(device.userAgent) ||
    (device.platform==='MacIntel' && device.maxTouchPoints>1);
}

// Reuse the PDF engine's sheet model and SVG vectors; no additional placement logic.
export function printSheets(engine,project) {
  if(!engine.typographyStatus.ready)throw Error(engine.typographyStatus.message);
  if(!project.tags.length||project.errors.length||validateGeometry(project).length)throw Error('Resolve saved tag errors before printing.');
  const printInset=project.orientation==='portrait'?PORTRAIT_PRINT_MARGIN:0;
  const sides=project.duplex?['front','back']:['front'];
  return project.sheets.flatMap((_,index)=>sides.map(side=>
    `<section class="tag-print-sheet" data-sheet="${index+1}" data-side="${side}">${engine.renderSheetSvg(project,index,side,{printInset})}</section>`
  )).join('');
}
export function requestDirectPrint(engine,project,root,browser=window) {
  const markup=printSheets(engine,project);
  root.innerHTML=markup;
  if(typeof browser.print!=='function')throw Error('Direct printing is unavailable here. Download the PDF and open it in your print app.');
  // No await, popup, iframe, PDF plugin, external image or font load between tap and print.
  browser.print();
}
