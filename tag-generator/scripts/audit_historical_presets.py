"""Read-only source comparison. Outputs quarantined evidence, never live presets."""
import csv, json, re, sys, unicodedata
from pathlib import Path
import fitz

def norm(text):
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode().lower())

def boxes(page):
    result=[]
    for d in page.get_drawings():
        r=d['rect']
        if 198<r.width<202 and 153<r.height<157 and not any(abs(r.x0-q.x0)<2 and abs(r.y0-q.y0)<2 for q in result):
            result.append(r)
    return sorted(result,key=lambda r:(round(r.y0/10),r.x0))

def lines(page,rect):
    out=[]; seen=set()
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines',[]):
            r=fitz.Rect(line['bbox']);center=(r.tl+r.br)/2
            if center not in rect: continue
            text=''.join(s['text'] for s in line['spans']).strip()
            key=(round(r.x0),round(r.y0),text)
            if text and key not in seen:out.append((r.y0,r.x0,text));seen.add(key)
    return [t for _,_,t in sorted(out)]

def audit(pdf,csv_path,out):
    doc=fitz.open(pdf); records=list(csv.DictReader(open(csv_path,encoding='utf-8-sig'))); results=[]
    for n,row in enumerate(records,2):
        front=doc[int(row['source_front_page'])-1];back=doc[int(row['source_back_page'])-1]
        candidates=boxes(front); title=norm(row['title']);subtitle=norm(row['subtitle'])
        matches=[r for r in candidates if title and title in norm(' '.join(lines(front,r))) and (not subtitle or subtitle in norm(' '.join(lines(front,r))))]
        issues=[]
        if len(matches)!=1:
            issues.append('front_identity_ambiguous' if matches else 'front_identity_not_found')
            col=int(row['source_col']);rnum=int(row['source_row'])
            target=fitz.Point(96+(col-.5)*200,74+(rnum-.5)*155)
            r=min(candidates,key=lambda r:abs((r.x0+r.x1)/2-target.x)+abs((r.y0+r.y1)/2-target.y)) if candidates else front.rect
        else:r=matches[0]
        mirrored=fitz.Rect(front.rect.width-r.x1,r.y0,front.rect.width-r.x0,r.y1)
        backs=boxes(back)
        br=min(backs,key=lambda q:abs(q.x0-mirrored.x0)+abs(q.y0-mirrored.y0)) if backs else mirrored
        offset=max(abs(br.x0-mirrored.x0),abs(br.y0-mirrored.y0))
        if offset>15:issues.append('reverse_geometry_mismatch')
        fl=lines(front,r);bl=lines(back,br);ft=' '.join(fl);bt=' '.join(bl)
        prices=re.findall(r'\$\s*(\d+[.,]\d{2})',ft)
        if row['price'] not in prices:issues.append('price_mismatch')
        badges={'vegan':bool(re.search(r'\bV\b',ft)),'gluten_free':bool(re.search(r'\bSG\b',ft))}
        for field,value in badges.items():
            if value!=(row[field].lower()=='true'):issues.append(field+'_mismatch')
        candidate=norm(row['english_ingredients_candidate'])
        ingredient_match=bool(candidate and candidate in norm(bt))
        if not ingredient_match:issues.append('ingredient_candidate_not_verbatim_on_mirrored_back')
        if 'inferred' in row['ingredient_provenance']:issues.append('inferred_ingredient_additions')
        # Source agreement does not approve recipes or resolve historical flags.
        results.append({'csv_line':n,'title':row['title'],'subtitle':row['subtitle'],'source_front_page':row['source_front_page'],'source_back_page':row['source_back_page'],'original_record':row,'front_bounds':list(r),'mirrored_expected_bounds':list(mirrored),'back_bounds':list(br),'reverse_offset_pt':round(offset,2),'front_lines':fl,'back_lines_bilingual':bl,'source_prices':prices,'source_badges':badges,'candidate_verbatim_match':ingredient_match,'audit_issues':issues,'review_status':'source_comparison_passed_pending_recipe_review' if not issues else 'needs_review','approved':False})
    Path(out).write_text(json.dumps({'source_pdf':str(pdf),'page_count':len(doc),'record_count':len(results),'method':'Match front identity within original tag rectangles, mirror horizontally, select corresponding back rectangle. Duplicate positioned text removed. Bilingual back evidence retained without translation. All original flags preserved; no recipe approvals inferred.','records':results},ensure_ascii=False,indent=2))
    from collections import Counter
    print(json.dumps({'records':len(results),'statuses':dict(Counter(r['review_status'] for r in results)),'issues':dict(Counter(i for r in results for i in r['audit_issues']))},indent=2))

if __name__=='__main__':audit(*sys.argv[1:])
