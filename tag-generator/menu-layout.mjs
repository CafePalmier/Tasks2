import {normalizePrice} from './price-glyphs.mjs';
import {createTextLayout, FitError} from './text-layout.mjs';

export const menus = {
  cocktails: {
    label: 'Cocktails',
    itemLabel: 'Cocktail',
    maxRows: 5,
    rows: [
      {title: 'Mimosa', price: '8'},
      {title: 'Aperol Spritz', price: '12'},
      {title: 'Espresso Martini au gin', price: '15'},
    ],
  },
  drinks: {
    label: 'Cold Drinks',
    itemLabel: 'Drink',
    maxRows: 5,
    rows: [
      {title: '«Cold Bru»', description: 'Café infusé à froid', price: '4.25'},
      {title: 'Citromarin', description: 'Thé glacé aux citron, romarin & thé pu’er', price: '4.25'},
    ],
  },
  tea: {
    label: 'Tea',
    rows: [
      {label: 'Caffeine', price: '4.50'},
      {label: 'Herbal', price: '4.50'},
      {label: 'Tea latte', price: '7.00'},
    ],
  },
  soup: {
    label: 'Soup',
    rows: [{label: 'Soup', price: '12'}],
  },
};

const cream = '#e9decb';
const beige = '#eae1d3';
const green = '#345a36';
const copper = '#bb846a';
const paperInk = [0.068, 0.087, 0.15, 0.004];
const ink = {
  [cream]: paperInk,
  [beige]: paperInk,
  [green]: [0.784, 0.38, 0.911, 0.296],
  [copper]: [0.176, 0.473, 0.541, 0.053],
};

// Blank template coordinates. The first palm starts just below the last safe line.
const coldDrinksRayTop = 160.68;
const coldDrinksPanelBottom = 216;

export function validateMenu({design, rows}) {
  if (!Object.hasOwn(menus, design)) return [{field: 'design', message: 'Choose a menu design.'}];
  const {rows: defaults, maxRows} = menus[design];
  if (!Array.isArray(rows) || (maxRows ? rows.length > maxRows : rows.length !== defaults.length)) {
    return [{field: 'rows', message: 'The menu has an invalid number of rows.'}];
  }
  const errors = [];
  rows.forEach((row, index) => {
    if (!normalizePrice(row?.price)) errors.push({field: 'price-' + index, message: 'Enter a valid non-negative price.'});
    if (maxRows && !(typeof row?.title === 'string' && row.title.trim())) {
      errors.push({field: 'title-' + index, message: 'Enter an item name.'});
    }
    if (row?.description != null && typeof row.description !== 'string') {
      errors.push({field: 'description-' + index, message: 'Enter the description as text.'});
    }
  });
  return errors;
}

function mapOutline(path, point) {
  return path.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) =>
    point(Number(x), Number(y)).map(value => value.toFixed(6)).join(' '));
}

function uprightRuddy(glyphs) {
  // The approved Ruddy outlines lean 20° (measured on the vertical stem of I).
  // Restore upright spacing from the new ink edges. Italic bearings can overlap
  // after the shear, especially for narrow digits and capitals.
  const slant = Math.tan(Math.PI / 9);
  const upright = Object.fromEntries(Object.entries(glyphs).map(([char, glyph]) => {
    if (!glyph.path) return [char, glyph];
    let left = Infinity;
    let right = -Infinity;
    const path = mapOutline(glyph.path, (x, y) => {
      const uprightX = x + slant * y;
      left = Math.min(left, uprightX);
      right = Math.max(right, uprightX);
      return [uprightX, y];
    });
    const [, top, , bottom] = glyph.bounds;
    const width = right - left;
    return [char, {...glyph, path, advance: width + .06, offsetX: -left, bounds: [left, top, right, bottom]}];
  }));

  // Use the separate tilde contour from the supplied ñ in all-caps names.
  const n = upright.N;
  const tilde = upright['ñ']?.path.split(/(?=M)/)[0];
  if (n && tilde) {
    let left = Infinity;
    let right = -Infinity;
    mapOutline(tilde, (x, y) => {
      left = Math.min(left, x);
      right = Math.max(right, x);
      return [x, y];
    });
    const dx = (n.bounds[0] + n.bounds[2] - left - right) / 2;
    const dy = -.07;
    upright['Ñ'] = {
      ...n,
      path: n.path + ' Z ' + mapOutline(tilde, (x, y) => [x + dx, y + dy]),
      bounds: [n.bounds[0], upright['ñ'].bounds[1] + dy, n.bounds[2], n.bounds[3]],
    };
  }
  return upright;
}

function menuPrice(price, id) {
  const normalized = normalizePrice(price);
  if (!normalized) throw new FitError('Enter a valid non-negative price.', {code: 'invalid-price'});
  if (id === 'tea' || id === 'drinks') return normalized.slice(1);
  const compact = normalized.replace(/\.00$/, '');
  return id === 'soup' ? compact : compact.slice(1);
}

const menuText = value => typeof value === 'string'
  ? value.normalize('NFC').trim().replace(/\s+/g, ' ').toUpperCase()
  : '';

// Tea positions are measured in the upright preview coordinates. Each price is
// right-aligned to its language's column and shares the baseline of its heading.
const teaAnchors = [
  [[271.3, 194.65], [550.5, 194.65]],
  [[272.9, 397.14], [551.4, 397.14]],
  [[270.3, 559.31], [549.4, 559.88]],
];

export function createMenuLayout(fonts) {
  const layout = createTextLayout({...fonts, ruddy: uprightRuddy(fonts.ruddy)});

  function priceRun(text, font, width, max, min) {
    for (let size = max; size >= min; size -= .5) {
      const run = layout.measure(font, text, size);
      if (run.width <= width) return run;
    }
    throw new FitError('Price is too long for this menu.', {code: 'overflow'});
  }

  return function layoutMenu(id, rows) {
    const errors = [];
    const ops = [];
    const rules = [];
    const isCocktails = id === 'cocktails';
    const menu = menus[id];

    function field(name, index, render) {
      try {
        ops.push(...render());
      } catch (error) {
        if (!(error instanceof FitError)) throw error;
        const label = menu.rows[index]?.label || menu.itemLabel + ' ' + (index + 1);
        errors.push({field: name + '-' + index, message: label + ' ' + (name === 'title' ? 'name' : name) + ' — ' + error.message});
      }
    }

    if (id === 'tea' || id === 'soup') {
      rows.forEach((row, i) => field('price', i, () => {
        const text = menuPrice(row?.price, id);
        const tea = id === 'tea';
        const run = priceRun(text, tea ? 'lucidity' : 'ruddy', tea ? 115 : 124, tea ? 23.5 : 13.5, 9);
        const anchors = tea ? teaAnchors[i] : [[259.4, 98.3]];
        return anchors.flatMap(([right, baseline]) => layout.draw(run, right - run.right, baseline, green));
      }));
      return {ops, rules, errors};
    }

    if (!rows.length) return {ops, rules, errors};
    const color = isCocktails ? cream : green;
    const x = isCocktails ? 44.5 : 52;
    const right = isCocktails ? 286 : 293.5;
    const top = isCocktails ? 89 : 89.5;
    const rayGap = 1.25;
    const equalHeight = isCocktails
      ? 73.5 / Math.max(rows.length, menu.rows.length)
      : Math.min(35.2, (coldDrinksPanelBottom - rayGap - top) / rows.length);
    const maxSize = isCocktails ? Math.min(16.5, equalHeight - 2) : 15.5;
    const priceWidth = 60;

    const tallRows = rows.map(row => {
      if (!isCocktails || rows.length <= menu.rows.length) return false;
      try {
        return layout.measure('ruddy', menuText(row?.title), maxSize * .8).width > right - x - 32;
      } catch (error) {
        // Field validation below reports any unsupported lettering.
        if (!(error instanceof FitError)) throw error;
        return false;
      }
    });
    const tallCount = tallRows.filter(Boolean).length;
    const shortCount = rows.length - tallCount;
    // Give wrapped names extra leading by borrowing up to 2 pt from each short row.
    const extra = tallCount ? Math.min(6, 2 * shortCount / tallCount) : 0;
    const reduction = shortCount ? extra * tallCount / shortCount : 0;
    let y = top;

    rows.forEach((row, i) => {
      const rowHeight = equalHeight + (tallRows[i] ? extra : -reduction);
      const description = menuText(row?.description);
      const descriptionHeight = Math.min(11.2, rowHeight * .37);
      const titleHeight = isCocktails
        ? rowHeight - 1.7
        : description ? Math.min(21, rowHeight - descriptionHeight - 3) : rowHeight - 4;
      const priceCenter = isCocktails || !description ? y + rowHeight / 2 : y + titleHeight / 2 + 2.5;
      let titleRight = right - 24;
      field('price', i, () => {
        const text = menuPrice(row?.price, id);
        const run = priceRun(text, 'ruddy', priceWidth, maxSize, 8);
        titleRight = Math.min(titleRight, right - run.width - 10);
        return layout.draw(run, right - run.right, priceCenter - (run.top + run.bottom) / 2, color);
      });

      field('title', i, () => {
        const text = menuText(row?.title);
        if (!text) throw new FitError('Enter an item name.');
        const box = {x, y: y + .8, w: titleRight - x, h: titleHeight};
        const minSize = isCocktails && rows.length === menu.maxRows ? 6.5 : 7.5;
        return layout.fit('ruddy', text, box, maxSize, minSize, 2, 'Name', {align: 'left', color, lineGap: .09}).ops;
      });
      if (description) field('description', i, () => {
        const box = {x, y: y + titleHeight + 1, w: right - x, h: rowHeight - titleHeight - 3};
        return layout.fit('ruddy', description, box, 7.7, 5.5, 2, 'Description', {align: 'left', color: copper, lineGap: .09}).ops;
      });

      y += rowHeight;
      rules.push({x, right, y, color});
    });
    const cover = id === 'drinks' && y > coldDrinksRayTop
      ? {x: 48, y: coldDrinksRayTop - 1, right: 300, bottom: Math.min(coldDrinksPanelBottom, y + rayGap)}
      : undefined;
    return {ops, rules, errors, cover};
  };
}

export function menuFront(design, {ops, rules, cover}, [left, top]) {
  const background = cover ? [{
    path: `M0 0 H${cover.right - cover.x} V${cover.bottom - cover.y} H0 Z`,
    x: cover.x, y: cover.y, scale: 1, color: beige,
  }] : [];
  const dividers = rules.map(({x, right, y, color}) => ({
    path: `M0 -0.25 L${right - x} -0.25 L${right - x} 0.25 L0 0.25 Z`,
    x, y, scale: 1, color,
  }));
  return [...background, ...dividers, ...ops].map(op => {
    // Tea lettering is measured upright. Turn it to match the Letter template.
    const placed = design === 'tea'
      ? {x: op.y, y: 612 - op.x, rotation: 90}
      : {x: op.x - left, y: op.y - top};
    return {...op, ...placed, cmyk: ink[op.color]};
  });
}
