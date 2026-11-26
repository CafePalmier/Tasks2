import {isFullLetterMenu,validateGeometry} from './engine.mjs?v=8';

// Keep the artwork clear of Safari's headers/footers and center both sides on Letter.
// Packing works in landscape coordinates, so the two insets swap axes.
export const AIRPRINT_LAYOUT = Object.freeze({marginX:108,marginY:72});
const safariLetterMargin = 40;
const viewport = [AIRPRINT_LAYOUT.marginY,AIRPRINT_LAYOUT.marginX,
  612-2*AIRPRINT_LAYOUT.marginY,792-2*AIRPRINT_LAYOUT.marginX];
const printableWidth = 612-2*safariLetterMargin;

export function requiresPrintPdf(project) {
  return project.orientation==='portrait'&&project.tags.some(isFullLetterMenu);
}

export function usesPortraitPrint(device=navigator) {
  return /iPad|iPhone|iPod/.test(device.userAgent) ||
    (device.platform==='MacIntel' && device.maxTouchPoints>1);
}

// Reuse the PDF engine's sheet model and SVG vectors; no additional placement logic.
export function printSheets(engine,project,{airPrint=false}={}) {
  if(!engine.typographyStatus.ready)throw Error(engine.typographyStatus.message);
  if(!project.tags.length||project.errors.length||validateGeometry(project).length)throw Error('Resolve saved tag errors before printing.');
  if(airPrint){
    if(requiresPrintPdf(project))throw Error('Download PDF to print full-sheet Tea menus at actual size.');
    if(validateGeometry({...project,layout:{...project.layout,...AIRPRINT_LAYOUT}}).length)
      throw Error('The job does not fit the AirPrint area. Reload the Tag Generator.');
  }
  const sides=project.duplex?['front','back']:['front'];
  return project.sheets.flatMap((_,index)=>sides.map(side=>
    `<section class="tag-print-sheet" data-sheet="${index+1}" data-side="${side}">${engine.renderSheetSvg(project,index,side,{idPrefix:'print',viewport:airPrint?viewport:undefined})}</section>`
  )).join('');
}
export function requestDirectPrint(engine,project,root,browser=window) {
  const airPrint=project.orientation==='portrait';
  const markup=printSheets(engine,project,{airPrint});
  if(airPrint){
    root.style.setProperty('--tag-print-width',`${100*viewport[2]/printableWidth}%`);
    root.style.setProperty('--tag-print-top',`${100*(viewport[1]-safariLetterMargin)/printableWidth}%`);
  }
  root.innerHTML=markup;
  if(typeof browser.print!=='function')throw Error('Direct printing is unavailable here. Download the PDF and open it in your print app.');
  // No await, popup, iframe, PDF plugin, external image or font load between tap and print.
  browser.print();
}
