# Café Palmier Tag Generator

Open `http://localhost:8000/tag-generator/index.html` after `npm start`, or use the Tag Generator on GitHub Pages at `tag-generator/index.html`. GitHub Pages serves the same lettering outlines and ingredient fallback used on localhost.

## Staff workflow

Choose a format, enter French front text and a real price, and add the tag. Pastries require English ingredients and offer independent V/SG checkboxes. Edit, duplicate, move or delete collection items. Clear All asks for confirmation. The collection and unfinished form are saved in this browser. Download the collection as vector PDF sheets. Front/back previews use the same measured path operations and placements as export.

Print US Letter landscape at **Actual size / 100%**. For a pastry job, match **Double-sided flip** in the editor to the printer's duplex setting. **Long edge** is the editor default for Safari's standard double-sided setting. Select **Short edge** in the editor if your printer is set to flip on the short edge. Print a registration test before the batch. Long-edge output turns the entire back artwork 180° so it aligns after the printer flips the sheet. Every front is followed by a back, including blank backs when a sheet has no pastry. Jobs without pastries print single-sided.

To print outside Safari on a Mac, download the PDF and open it in Preview. Select the printer, paper size, scale, and duplex setting in Preview's print dialog. If both apps use the same printer queue, the duplex options may be the same.

On iPad and iPhone, **Print Tags** opens the landscape PDF with one page per printed side. Use **Share → Print** in the PDF viewer. If the browser blocks the viewer, the PDF downloads and can be opened from Files.

## Files and maintenance

- `index.html`, `editor.css`, `editor.mjs`: touch editor, local persistence, collection, preview, download.
- `engine.mjs`: validation, measured vector lettering, deterministic MaxRects packing, pastry 3 × 3 layout, shared preview/PDF model, duplex export.
- `assets/artwork.json`: original background curves and badge shapes; no approximated decorations.
- `scripts/prepare_assets.py`: reproducible extraction from untouched supplied PDFs. Development tool only; requires PyMuPDF and fontTools.
- `typography/provisional.json` and `typography/ingredient-fallback.json`: **ignored local development assets**. Public hosts never request them.
- `typography/approved.json`: the glyph bundle served by GitHub Pages. It contains the `lucidity`, `ruddy`, `price`, and `ingredients` glyph maps from the local typography and the `ingredientFallback` map. Each glyph has an SVG path, an advance, and bounds in em units.
- `vendor/pdf-lib.min.js`: pinned pdf-lib 1.17.1; bundled locally with its MIT license. `npm ci` restores the matching development test dependency.
- `tests/engine.test.mjs`: `npm test`.
- `scripts/samples.mjs`: `npm run samples`; output in ignored `samples/`.

To regenerate local assets: install `pymupdf fonttools` in a Python environment, then run `python tag-generator/scripts/prepare_assets.py`. Neither Python nor npm is required on staff devices. GitHub Pages loads `typography/approved.json` relative to the Tag Generator. If the file cannot be loaded, staff can still edit and save tags while lettering, printing, and PDF downloads are unavailable.

The development notes below record earlier milestones, including the original localhost restriction.

## Asset audit

All source pages are 792 × 612 PDF points, 72 points/inch. Actual first pink rectangle bounds give:

| Format | Width | Height |
| --- | ---: | ---: |
| Pastry | 199.9674 | 154.5202 |
| Freezer | 212.234 | 101.503 |
| Provisions | 141.732 | 116.220 |

Pastry uses the specified high precision dimension. The source stream rounds to 199.967 × 154.520. Pastry-only jobs use a centered 3 × 3 grid. Other jobs use each format's upright cut dimensions, including both Napkin Holder designs.

Background paths come directly from PDF drawing commands, including original cream curves and shadows. Source CMYK conversion differs slightly from the requested RGB colors; the derivative artwork uses exactly #eae0d3, #c68b70, #376438 and #eed2c4 while retaining the curves. Originals remain unchanged.

Lucidity and Ruddy references each contain 112 mapped outline objects, not embedded fonts. Mapping is based on inspected specimen rows: A–Z, a–z, French accented forms, digits and punctuation. Lucidity intentionally renders lower-case input as uppercase letterforms. Font paths remain vectors. Lucidity retains specimen-derived advances; Ruddy now uses embedded CFF advances where available and documented estimates elsewhere. Original pair kerning is unavailable, so **exact typography fidelity is not claimed**. Source examples also apply nonuniform text transformations; the engine deliberately keeps letterforms uniformly scaled.

Prices use original Metropolis Medium Italic outlines (pastry 16.9392 pt; freezer 12.4887; provisions 11.9155). English backs use original Metropolis Regular at 8–11 pt and preserve wording and line breaks. Source embedded Metropolis subsets are incomplete: price digit 9 has now been recovered from the updated pastry source; several ingredient letters/numerals/punctuation remain unavailable. Missing glyphs block export with an explicit error. Supply licensed complete fonts to finish production coverage; no unrelated substitute is used. Empty subtitles consume no space.

## Verification and remaining release work

`npm test` checks validation, prices, French normalization, 1/9/10 pastries, single other formats, 80 mixed tags, no overlaps, gaps, immutable dimensions, mirror geometry, PDFs opening and page counts, independent badges and long text rejection. Typography/PDF checks run when local provisional assets exist and otherwise are explicitly skipped. Generated PDFs were opened and rasterized with PyMuPDF for visual review. Eight automated tests passed locally. HTTP checks returned 200 with correct HTML/JavaScript MIME types. Browser automation detached before the editor could be inspected, so no browser/iPad acceptance result is claimed. No automated pixel regression baseline is established yet.

Before release:

1. Confirm rights to distribute reusable Lucidity/Ruddy assets; install licensed complete Metropolis and validate every supported glyph, advances and kerning.
2. Review the rendered samples with the café's original artwork, especially price anchors, subtitle sizes and line composition. Current spacing is provisional.
3. Run browser/iPad acceptance testing, including reload persistence, touch form, Safari downloads and narrow screens.
4. Print `samples/registration.pdf` short-edge duplex at 100%. Measure the 72 pt ruler (one inch). Hold the sheet to light: asymmetric crosses must coincide at corresponding front/back locations. Check legible upright text, cut sizes and printer margins. Repeat with nine pastry tags and multiple mixed sheets, including blank paired backs. Printer registration has **not** been physically proven.
5. Deploy through the existing GitHub Pages workflow only after those gates. No commit, push, Sites deployment or modification of the older `dist/` snapshot was performed.

Local samples are `samples/mixed.pdf`, `samples/pastry-nine.pdf`, and `samples/registration.pdf`; they are development proofs, not approved production artwork.

## Typography and fitting refinement (2026-11-20)

The subtitle spacing issue came from using `(ink width + 1 pt) / 12` as every glyph's advance. Ruddy now uses the original embedded CFF advances and left bearings when present, with a 0.25 em word space. This preserves the supplied outline paths. For example, `a` advances 0.594 em and `B` 0.638 em even though their italic ink extends farther. Missing advances are explicitly marked as estimates based on the median advance/ink-width ratio of the available CFF glyphs. No additional tracking is applied. Pair kerning remains unavailable, so exact font fidelity is still provisional.

At 14.5 pt, measured subtitle widths changed as follows (old advance-based width versus new visible ink width):

| Subtitle | Before | Now |
| --- | ---: | ---: |
| Banane | 64.03 pt | 53.92 pt |
| Citron & Framboises | 182.89 pt | 145.75 pt |
| Canneberges & chocolat blanc | 264.36 pt | 216.94 pt |

`text-layout.mjs` now measures actual vector bounds and uses those same positions for drawing. Italic overhangs and accents participate in fitting and centring. `engine.mjs` supplies field safe zones; `diagnostics.mjs` produces one identified message per tag/field. An oversized title no longer hides a valid price, subtitle or ingredient back in the preview.

### Price correction

Inspection of `reference/Provisions-original.pdf` locates the price baseline at **110.119049 pt below the tag's top edge**. The previous shared bottom offset put it at 100.488 pt. The correction moves it down 9.631049 pt, retains its 11.9155 pt size and horizontal advance centring, and leaves it inside the 116.220 pt cut height. The `$4.50` regression sample clears the shadow's bottom (96.154 pt) by more than 4 pt and the cut edge by more than 2 pt. Pastry and Freezer price coordinates remain unchanged (140.347 and 85.771 pt from their respective top edges).

### Fitting policy and measured examples

These are geometric limits, **not character limits**. Sizes step down by 0.5 pt, including the exact minimum. At each size, titles try one line and all word-boundary two-line splits, choosing a balanced split. A one-line candidate wins when both fit at the same size. No staff content is shortened or rewritten to make it fit. Ingredient wording and explicit paragraphs remain intact; automatic wrapping changes only visual line breaks.

| Field | Available width × height | Size range | Lines |
| --- | --- | --- | --- |
| Pastry title, no subtitle | 159.9674 × 78 pt | 36–14 pt | 1–2 |
| Pastry title, with subtitle | 159.9674 × 54 pt | 36–14 pt | 1–2 |
| Freezer title | 160.234 × 38 pt | 24–14 pt | 1–2 |
| Provisions title, no subtitle | 101.732 × 64 pt | 24–14 pt | 1–2 |
| Provisions title, with subtitle | 101.732 × 40 pt | 24–14 pt | 1–2 |
| Pastry subtitle | 159.9674 × 34 pt | 14.5–8 pt | 1–2 |
| Freezer subtitle | 172.234 × 27 pt | 10–8 pt | 1–2 |
| Provisions subtitle | 101.732 × 27 pt | 10–8 pt | 1–2 |
| Pastry ingredients | 175.9674 × 126.5202 pt | 11–8 pt | wrapped, 1.3 em leading |

Freezer title padding was tightened to x=26, y=22 after visual inspection showed that very wide two-line titles approached the rounded cream corners. Backgrounds, cut sizes, packing and prices are unchanged. Title/subtitle safe zones have a 4 pt vertical cushion. The original Provisions reference itself has a two-line Ruddy subtitle, which is now supported.

Among the representative titles tested without subtitles:

- Pastry: `Croissant` fits one line at 36 pt (149.8 pt wide); `Pain doré` also fits at 36 pt (154.7 pt). `Pain au chocolat` wraps at 36 pt; `Croissant aux amandes` wraps at 30.5 pt. `Mélange de céréales et fruits séchés` fits two lines at 18.5 pt.
- Freezer: `Chocolat noir` fits one line at 24 pt (158.9 pt). `Pain au chocolat` fits one line at 21 pt (158.7 pt); `Croissant aux amandes` uses two lines at 21 pt.
- Provisions: `Croissant` fits one line at 24 pt (99.9 pt). `Pain au chocolat` uses two lines at 23.5 pt; `Croissant aux amandes` at 19.5 pt. `Pain au chocolat et noisettes` does not fit: the best two-line split still needs 105.8 pt at the 14 pt floor, versus 101.7 pt available. `Chocolat blanc et canneberges` fits at 14.5 pt.

Subtitle comparisons:

| Subtitle | Pastry | Provisions |
| --- | --- | --- |
| Banane | 14.5 pt, 1 line | 10 pt, 1 line |
| Citron & Framboises | 14.5 pt, 1 line | 10 pt, 1 line |
| Canneberges & chocolat blanc | 14.5 pt, 2 lines | 10 pt, 2 lines |

Subtitles try two lines at each size before stepping down. The minimum subtitle size is **8 pt**. Capacity depends on italic overhangs, letter widths, accents and line breaks.

For the reproducible ingredient phrase `Flour, butter, sugar.` separated by spaces: 219 characters fit in 7 lines at 11 pt; 329 fit in 9 lines at 10.5 pt; 439 fit in 10 lines at 9 pt; 527 fit in 12 lines at 8 pt. The next repetition (549 characters) needs 13 lines / 131.8 pt and is rejected against the 126.5 pt height. These counts describe that test phrase only. A long unbroken word now tries every readable size before failing; previously a word too wide at 11 pt was immediately rejected even when it fit at 8 pt.

### Errors and remaining font limitations

Previously all title/subtitle failures threw the same generic exception, were assigned `field: layout`, and the draft panel joined messages without identifying tags. Two overflowing tags therefore appeared as duplicated generic warnings. Validation now catches fields independently, deduplicates by tag ID and field, and lists tag number, title, field, measured dimensions and available space. Required-field messages use the same panel rather than appearing again beside a form summary. Informational typography, draft and packing notices use neutral green styling and do not block downloads. The saved collection's errors control its download; a draft is explicitly labelled as unsaved.

Missing source glyphs remain a separate blocking error for ingredient lowercase `q`, capitals `J Q R X Y Z`, numerals other than `2` and `3`, and punctuation such as apostrophe and ampersand are absent from supplied subsets. Ruddy covers the specimen repertoire, but some advances (including `f`, `g`, `j`, `q`, `v`, `w`, `x`, `y`, `z` and many accents) are estimated, not original kerning metrics. Supplied glyph bounds now come from actual outlines instead of fixed 0.8/0.22 em ingredient/price height estimates. The existing local-only asset/permission gate is unchanged.

### Reproduce the targeted verification

1. Regenerate provisional assets with `scripts/prepare_assets.py` in the documented Python environment.
2. Run `npm test`: **14 tests pass**, including field deduplication, minimum sizes, long-word shrinking, price clearance and identical SVG/PDF path coordinates.
3. Run `node tag-generator/scripts/fitting-report.mjs`: creates `samples/fitting-report.json`, the four-page `samples/fitting-review.pdf`, its model and per-side SVG previews. The report covers all formats with short, medium and long titles/subtitles and ingredient lengths.
4. Render and compare the SVG previews and PDF with PyMuPDF. All four pages were rendered at 108 dpi and visually inspected. Mean pixel-channel differences were below 0.003 on a 0–255 scale, consistent with renderer rounding; the coordinate test verifies exact shared positions.

No deployment was performed. Browser/iPad and physical printer acceptance remain separate release checks.

## Editable presets and combined composition

`presets.mjs` preserves all 12 previous categories and adds Croissant, Amandine (alias Amanding), Pain au chocolat, Épinard & Feta, Pépites de chocolat, Chocolat salée, Power, Froot Loop and Gingembre. Scones resolves to Scone. Accent/case-insensitive filtering returns canonical options without duplicates. Recipes are exactly the supplied English text; none supplies a price. Muffin/Power default to V+SG, Poptart to V only; all remain editable.

The single Title combobox opens all options with its arrow, filters on typing and supports touch/click, Up/Down, Enter and Escape. Custom text remains valid. Preset application preserves price and prompts before replacing ingredients, subtitle or dietary values that differ from the previous defaults. Cancel keeps edited values while applying the selected title and untouched defaults. Preset identity and optional title colour survive local saving, editing and duplication. Older saved tags need no migration. The five special product titles alone use terracotta; price and badge colours are unchanged.

Title and subtitle ink heights are combined with a 4 pt gap and centred between the original cream area's top and bottom. Titles without subtitles centre independently. The same moved vector operations feed preview and PDF; original shapes and packing are unchanged.

Chocolat salée carries a persistent recipe-verification notice: the provided note mentions apple filling, whereas the exact provided recipe includes cocoa. No ingredients were invented or removed.

Run `npm test` (17 tests) and `node tag-generator/scripts/preset-samples.mjs`. `samples/presets-review.pdf` includes green and terracotta titles, a mixed Freezer tag, measured title/subtitle groups, and complete Power and Croissant ingredient backs. `samples/preset-validation.json` records every recipe's current fitting result. Amandine, Pain au chocolat and Épinard & Feta remain blocked by missing characters in the supplied Metropolis subset; their complete recipes are retained. Their final capacity cannot be certified until a complete licensed font is installed. No allergens are truncated and no substitute font is used. Combobox filtering/preset logic is tested automatically; live Safari/iPad interaction still needs device acceptance. Licensing gate and local-only deployment status are unchanged.

Files changed for this refinement: `engine.mjs`, `editor.mjs`, `editor.css`, `index.html`, this README; added `presets.mjs`, `tests/presets.test.mjs`, `scripts/preset-samples.mjs`.

## Price glyph audit

Audited all **13** supplied PDF/PDF-compatible AI files under `reference/`, `fonts/` and `templates/`, including embedded font character maps and nonempty glyph outlines. `glyph-audit.json` records each file/font, its usable characters, empty mapped glyphs, generated coverage and missing printable ASCII. Reproduce with `python tag-generator/scripts/audit_glyphs.py` using the existing PyMuPDF/fontTools environment. No original files or glyph assets are changed by this audit.

Metropolis Medium Italic coverage:

| Source | Available price digits |
| --- | --- |
| pastry-original.pdf and pastry-original.ai | 0, 3, 4, 5, 6, 7, 9 |
| freezer-original copy.pdf and freezer-original.ai | 1, 2, 5, 6 |
| Provisions-original.pdf and Provisions-original.ai | 0, 5, 8 |

Each also contains `$`, `.`, and space. The updated union contains **all digits 0–9, dollar sign, decimal point and space**. Blank templates contain no embedded fonts. Lucidity/Ruddy specimen PDFs contain outlined glyphs, not a hidden Metropolis font. Their digit 9 is a different typeface and is not reused. The updated pastry PDF and AI now contain identical original Metropolis Medium Italic `nine` outlines and metrics (advance 0.630 em; bounds 0.047, −0.699, 0.608, 0.012 em in the engine coordinate system). Only this glyph was added to the local provisional asset; all other glyphs and artwork were preserved.

`price-glyphs.mjs` declares the complete output contract `0123456789$.` and separately the source's whitespace. Prices normalize comma input to a decimal point; comma, minus, slash and other punctuation are not emitted by the template. Validation accepts a valid numeric price containing 9. Syntax failures use `invalid-price`; valid prices lacking renderable outlines use `missing-glyph` and list the exact characters; unusable advances use `missing-metrics`. The missing-glyph message is now regression-tested using an intentionally incomplete test fixture; normal `$9.00` prices render successfully. The price remains editable and stored; only its PDF rendering is blocked. Missing paths are checked as well as missing mappings, preventing silent invisible digits.

Other font sets:

- Lucidity Condensed and Ruddy Bold Italic: all 112 explicitly mapped specimen characters plus space, including 0–9 and `$`/`.`. They cover the current French specimen repertoire, not arbitrary Unicode. Ruddy still has estimated advances for some characters, detailed in the audit; no new estimates or outlines were introduced by this change.
- Metropolis Bold: all required badge characters `V`, `S`, `G` are available. It is an incomplete general-purpose alphabet, but has no missing current badge characters.
- Metropolis Regular: lowercase `q`, uppercase `J Q R X Y Z`, and digits `0 1 4 5 6 7 8 9` are unavailable. Missing printable ASCII punctuation is `! " # $ & ' * / ; < = > ? @ [ \\ ] ^ _` plus backtick and `{ | } ~`. The audit's exact `missingPrintableASCII` string is authoritative. Non-ASCII characters not listed in its `characters` field are also unavailable.

Resource status after the updated-source audit:

1. **Metropolis-MediumItalic.otf or Metropolis-MediumItalic.ttf**, a complete legitimately usable copy of the exact original family/style. Alternatively, an original-font reference PDF with a correctly mapped `0123456789$.` specimen, font size/baseline and advance metrics; an embedded original font is preferable to outlines. A lone unlabelled shape or a 9 from another font is insufficient. **This resource is no longer needed to complete price character coverage**, because the updated pastry files supply the original 9. A complete licensed font remains an optional future typography asset.
2. Separately, **Metropolis-Regular.otf/.ttf**, or an embedded-font reference PDF covering complete ingredient text, is needed to resolve the previously documented ingredient coverage limitations. Full approved Lucidity Condensed/Ruddy Bold Italic font resources remain useful for exact metrics, but are not a price-glyph dependency. No additional Bold resource is needed for V/SG badges.

Distribution permission remains required; no fonts were downloaded, substituted or fabricated, and nothing was deployed. `npm test`: **21 tests pass**, including valid 9-containing prices, invalid syntax, missing/empty glyphs, metric failures and blocked export without data loss. Layout, packing, artwork, navigation and other rendering are unchanged.

Price-9 verification: **22 tests pass**, including 9, 9.99 and 19.90 in all three formats. `samples/price-nine-review.pdf` was generated and visually inspected. No additional price glyph resources are needed. The local-only typography distribution permission gate remains unchanged; no deployment was performed.

## Download PDF and Print Tags (2026-11-21)

Both prominent actions operate on **saved tags only** and use the existing engine's vector sheet model. Download PDF and the Print PDF fallback share `output.mjs`'s cached PDF bytes; direct printing uses the same sheet model through SVG (see below). An intervening registration download does not change the cached normal PDF. Adding/editing saved tags invalidates the cache. Draft previews do not alter exported content.

Why export was unavailable: the previous UI silently disabled Download when there were no saved tags, any saved-field error, or no loaded typography. The loader deliberately only reads provisional glyphs on localhost/127.0.0.1/[::1]; public hosts (and LAN IPs) remain restricted. A missing local asset now gives a preparation/reload error rather than being confused with public permission. An output status beside the actions explains empty collections, saved validation errors or the permission gate. Runtime generation failures have a separate retry message. The updated original Metropolis price reference provides all digits 0–9, `$` and `.`; 9 is not an invalid-price condition. Ingredient glyph omissions and genuine overflow still block output.

For local use, run `npm start` and visit `http://localhost:8000/tag-generator/index.html` with the prepared ignored `typography/provisional.json` present. The running server was checked: editor HTML, output module and glyph JSON all return HTTP 200. Public export is intentionally unavailable until font distribution permission and approved assets are settled.

The **Print PDF instead** fallback reserves a new tab synchronously during the click, generates the validated PDF, then opens its Blob URL in the browser's native PDF viewer. Staff use the viewer's Print control; on Safari/iPad use the viewer's Print or Share → Print action. The fallback does not print the editor DOM. A blocked/closed popup exposes an explicit Open generated PDF link and Download remains available. This avoids relying on embedded PDF iframe printing. This gesture-based approach follows [Window.open guidance](https://developer.mozilla.org/en-US/docs/Web/API/Window/open).

Select **US Letter, Landscape, Actual size / 100%** in the print dialog. Pastry jobs require **double-sided, short-edge flip**; every front has a paired back, including blank backs. Jobs without pastries are single-sided. PDF viewer preferences request no scaling and short-edge duplex, but browser/printer settings must be checked manually. Closing an opened viewer, pressing Finished with print PDF, or leaving the editor releases its Blob URL. Blocked-popup links remain valid until staff finish or leave. Downloads release their URL after 60 seconds. URL cleanup uses [revokeObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static).

The former 0.15 pt cutting outlines have been removed. Tag boundaries now have a minimum 1 pt unprinted gap, with no added border in preview or PDF. Exact tag sizes and source artwork are preserved. Lucidity title-line **ink gaps** are half the previous gap; letterforms and font sizes are not squashed, and line spacing remains measured to prevent collisions. Subtitle and ingredient leading are unchanged.

`npm test`: **27 pass**. Tests cover empty/public/invalid states, price digits, accents and ampersands, one/nine/ten pastry tags, mixed formats, single-sided jobs, mirrored backs, long ingredient errors, exact PDF sizes, geometry rejection, compact title leading, identical cached bytes and mocked popup/closed-viewer fallback. `samples/presets-review.pdf` was regenerated and both pages rendered and visually inspected, including full Croissant ingredients, compact two-line titles and hairline guides.

Live-browser limitation: Chrome automation detached before interaction, and Safari/iPad are unavailable in this session. Native viewer opening and print-dialog settings still need device acceptance; no physical print job was sent. The browser printing branches were unit-tested, not certified on devices. Deployment remains local only.


## Direct printing and 1 pt cutting gaps

Print Tags now builds a print-only HTML view from `engine.renderSheetSvg` and calls `window.print()` synchronously in the button handler. It uses the existing packing, glyph paths and mirrored back coordinates, with no new layout algorithm, font download, rasterization, iframe or popup. `print.css` hides the editor/navigation and specifies 792 × 612 pt pages with zero margins and one SVG per page. Every duplex front/back pair is included. Download PDF remains separate and unchanged.

The direct path requests the browser's native print interface; it cannot detect whether iPadOS actually displayed AirPrint. **Print PDF instead** becomes available after the attempt, including when `window.print()` is absent, throws or silently does nothing. On iPad use the PDF viewer's Share → Print; if a Home Screen app does not print, open the editor in Safari. Popup blocking affects only the fallback, which offers an explicit PDF link. Temporary PDF URLs retain the existing cleanup behavior. Browser JavaScript cannot enforce paper, scaling or duplex settings: select US Letter, Landscape, 100% / Actual Size, and short-edge duplex when ingredient backs are present. See [window.print](https://developer.mozilla.org/en-US/docs/Web/API/Window/print) and [@page](https://developer.mozilla.org/en-US/docs/Web/CSS/@page).

Packing defaults to a 10 mm paper margin and a 1 pt unprinted cutting gap. Both are configurable in points via the `{margin, gap}` engine options. For mixed sheets, MaxRects compares entry order with descending area, height and width, and keeps the result that uses the fewest sheets. All artwork stays upright at its original cut dimensions. A batch containing pastry emits a back page after each front, including blank backs for sheets with only single-sided tags. The back coordinates reflect the front across the sheet width and ingredient lettering stays upright. Use the existing actual-size, short-edge duplex settings. The 10 mm margin must fall within the printer's printable area.

Validation: `npm test` passes **32 tests**, including 90-tag mixed/multiple-sheet packing, minimum-gap rejection, exact dimensions, mirrored separation, synchronous print activation, full front/back SVG reuse, absent/throwing print functions, and validation/licensing blocks. Fallback popup behavior is covered by unit tests. Regenerated `samples/pastry-nine.pdf`, `samples/mixed.pdf`, `samples/registration.pdf`, and `samples/presets-review.pdf`. Pastry-nine and presets-review PDFs were rendered and inspected, including a 600% gap close-up; PDF inspection found vector fills, no raster images and no added border strokes.

Live verification limitation: the updated editor and compact preview were observed in Chrome, but browser automation could not activate the print button (input timeouts/native window access failure), so the actual desktop print dialog is **not verified**. No iPad or Safari device was available. Physical acceptance still requires Safari and Home Screen/PWA taps, fallback Share → Print, all pages at actual size, background colors, short-edge duplex registration and cutter clearance. No physical print job was sent. The typography permission gate is unchanged and nothing was deployed.

Files for this refinement: `engine.mjs`, `editor.mjs`, `index.html`, new `print-view.mjs` and `print.css`, `tests/engine.test.mjs`, `tests/output.test.mjs`, new `tests/print-view.test.mjs`, and this README.
