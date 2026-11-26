// The output format is always $0.00; comma input is normalized to a decimal point.
export const PRICE_CHARACTERS = '0123456789$.';
export const SOURCE_PRICE_CHARACTERS = PRICE_CHARACTERS + ' ';
export const normalizePrice=v=>{const s=String(v??'').trim().replace(/^\$\s*/,'');return /^\d{1,7}(?:[.,]\d{1,2})?$/.test(s)?'$'+Number(s.replace(',','.')).toFixed(2):null;};
export function priceGlyphIssues(formattedPrice, glyphs) {
  const missing=[], invalidMetrics=[];
  for(const char of new Set(formattedPrice)) {
    const glyph=glyphs?.[char];
    if(!glyph || (char!==' '&&!glyph.path?.trim()))missing.push(char);
    else if(!Number.isFinite(glyph.advance)||glyph.advance<=0)invalidMetrics.push(char);
  }
  return {missing,invalidMetrics};
}
