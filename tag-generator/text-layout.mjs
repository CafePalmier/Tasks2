// All measurements and drawing operations use the same vector ink bounds, in PDF points.
export class FitError extends Error {
  constructor(message, details={}) { super(message); Object.assign(this, details); }
}
export function createTextLayout(fonts) {
  function measure(font, text, size) {
    let cursor=0, left=Infinity, right=-Infinity, top=Infinity, bottom=-Infinity;
    const glyphs=[];
    for (const char of text) {
      const g=fonts[font]?.[char];
      if (!g) throw new FitError(`The supplied ${font} font lacks “${char}”. An authorized complete font is needed.`, {code:'missing-glyph'});
      if (!Number.isFinite(g.advance)) throw new FitError(`The ${font} glyph “${char}” lacks usable spacing metrics.`, {code:'missing-metrics'});
      const x=cursor+(g.offsetX||0)*size;
      if(g.path) {
        const b=g.bounds||[0,-g.ascent,g.advance,g.descent];
        left=Math.min(left,x+b[0]*size);right=Math.max(right,x+b[2]*size);
        top=Math.min(top,b[1]*size);bottom=Math.max(bottom,b[3]*size);
        glyphs.push({path:g.path,x,y:0,scale:size});
      }
      cursor+=g.advance*size;
    }
    if(!glyphs.length)left=right=top=bottom=0;
    return {width:right-left,height:bottom-top,left,right,top,bottom,advance:cursor,glyphs};
  }
  function draw(run,x,baseline,color) {return run.glyphs.map(g=>({...g,x:g.x+x,y:baseline,color}));}
  function overflow(field,box,measured,min,lines) {
    throw new FitError(`${field} needs ${measured.width.toFixed(1)} × ${measured.height.toFixed(1)} pt at ${min} pt (${lines} line${lines===1?'':'s'}); available space is ${box.w.toFixed(1)} × ${box.h.toFixed(1)} pt. Please shorten this field.`, {code:'overflow',measured,available:box,minSize:min});
  }
  function fit(font,text,box,max,min,maxLines=2,field='Text') {
    const candidates=[[text]], words=text.split(/\s+/);
    if(maxLines===2)for(let i=1;i<words.length;i++)candidates.push([words.slice(0,i).join(' '),words.slice(i).join(' ')]);
    let best;
    const sizes=[];for(let s=max;s>min;s-=.5)sizes.push(s);sizes.push(min);
    for(const size of sizes) {
      const options=candidates.map(lines=>{
        const runs=lines.map(l=>measure(font,l,size));
        const ascent=Math.max(...runs.map(r=>-r.top)),descent=Math.max(...runs.map(r=>r.bottom));
        const originalStep=Math.max(size*1.05,ascent+descent+size*.15);
        const step=font==='lucidity'?ascent+descent+(originalStep-ascent-descent)/2:originalStep;
        return {lines,runs,ascent,descent,step,width:Math.max(...runs.map(r=>r.width)),height:ascent+descent+(lines.length-1)*step};
      }).sort((a,b)=>a.lines.length-b.lines.length||a.width-b.width);
      for(const o of options)if(o.width<=box.w&&o.height<=box.h) {
        const baseline=box.y+(box.h-o.height)/2+o.ascent;
        return {size,lines:o.lines,width:o.width,height:o.height,box,ops:o.runs.flatMap((r,i)=>draw(r,box.x+(box.w-r.width)/2-r.left,baseline+i*o.step,font==='ruddy'?'#c68b70':'#376438'))};
      }
      if(size===min)best=options.sort((a,b)=>Math.max(a.width/box.w,a.height/box.h)-Math.max(b.width/box.w,b.height/box.h))[0];
    }
    overflow(field,box,{width:best.width,height:best.height},min,best.lines.length);
  }
  function ingredients(text,box) {
    const original=fonts.ingredients;
    const needsFallback=[...text].some(c=>!['\n','\r'].includes(c)&&!original?.[c]);
    if(needsFallback&&fonts.ingredientFallback)fonts={...fonts,ingredients:fonts.ingredientFallback};
    try{return fitIngredients(text,box);}finally{fonts={...fonts,ingredients:original};}
  }
  function fitIngredients(text,box) {
    let best;
    for(let size=11;size>=8;size-=.5) {
      const lines=[];let widestWord=0;
      for(const paragraph of text.split('\n')) {
        let line='';
        for(const word of paragraph.split(' ')) {
          widestWord=Math.max(widestWord,measure('ingredients',word,size).width);
          const next=line?line+' '+word:word;
          if(line&&measure('ingredients',next,size).width>box.w){lines.push(line);line=word;}else line=next;
        }
        lines.push(line);
      }
      const runs=lines.map(l=>measure('ingredients',l,size));
      const ascent=Math.max(size*.7,...runs.map(r=>-r.top)),descent=Math.max(0,...runs.map(r=>r.bottom));
      const step=Math.max(size*1.3,ascent+descent+size*.15),height=ascent+descent+(lines.length-1)*step;
      best={width:Math.max(widestWord,...runs.map(r=>r.width)),height};
      if(best.width<=box.w&&height<=box.h)return {size,lines,width:best.width,height,box,ops:runs.flatMap((r,i)=>draw(r,box.x-r.left,box.y+ascent+i*step,'#aaa69e'))};
    }
    overflow('Ingredients',box,best,8,Math.ceil(best.height/(8*1.3)));
  }
  return {measure,draw,fit,ingredients};
}
