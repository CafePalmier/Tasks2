import {menus} from './menu-layout.mjs?v=2';

const storageKey = 'palmier-menus-v1';

function element(tag, text = '', className = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}

function normalizeRows(id, saved) {
  const {rows: defaults, maxRows} = menus[id];
  if (!Array.isArray(saved)) return defaults.map(row => ({...row}));
  if (maxRows) {
    const fields = Object.keys(defaults[0]);
    return saved.slice(0, maxRows).map(row => Object.fromEntries(fields.map(field =>
      [field, typeof row?.[field] === 'string' ? row[field] : ''],
    )));
  }
  return defaults.map((row, index) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key, key !== 'label' && typeof saved[index]?.[key] === 'string' ? saved[index][key] : value,
    ]),
  ));
}

export function createMenuEditor({select, container, add, teaHelp, onChange}) {
  let saved = {};
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    if (stored && typeof stored === 'object') saved = stored;
  } catch {
    // The shared Tag Generator store still saves the active draft.
  }
  let rows;

  function remember() {
    saved[select.value] = rows;
    try {
      localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch {
      // The parent form reports device storage errors.
    }
  }
  function changed() {
    remember();
    onChange();
  }

  function field(key, text, row, index, className = '') {
    const label = element('label', '', 'tg-field ' + className);
    const input = element('input');
    input.id = 'menu-' + key + '-' + index;
    input.type = 'text';
    input.value = row[key];
    input.autocomplete = 'off';
    input.required = key !== 'description';
    if (key === 'price') input.inputMode = 'decimal';
    label.append(element('span', text), input);
    input.addEventListener('input', () => {
      row[key] = input.value;
      changed();
    });
    return label;
  }

  function render() {
    const design = select.value;
    const {itemLabel, maxRows} = menus[design];
    teaHelp.hidden = design !== 'tea';
    add.hidden = !maxRows;
    add.disabled = !maxRows || rows.length >= maxRows;
    if (itemLabel) add.textContent = 'Add ' + itemLabel.toLowerCase() + ' row';
    container.replaceChildren();

    rows.forEach((row, index) => {
      if (row.label) {
        container.append(field('price', row.label + ' price', row, index, 'menu-price-field'));
        return;
      }
      const group = element('fieldset', '', 'menu-row');
      const name = itemLabel + ' ' + (index + 1);
      group.append(element('legend', name));
      const pair = element('div', '', 'menu-pair');
      pair.append(field('title', 'Name', row, index), field('price', 'Price', row, index));
      group.append(pair);
      if (design === 'drinks') group.append(field('description', 'Description', row, index, 'menu-description'));
      if (maxRows) {
        const remove = element('button', 'Remove', 'tg-button tg-quiet menu-remove');
        remove.type = 'button';
        remove.setAttribute('aria-label', 'Remove ' + name.toLowerCase());
        remove.onclick = () => {
          rows.splice(index, 1);
          render();
          changed();
          (container.querySelector('#menu-title-' + index) ?? add).focus();
        };
        group.append(remove);
      }
      container.append(group);
    });
  }

  function fill(design = select.value, draft) {
    select.value = Object.hasOwn(menus, design) ? design : 'cocktails';
    rows = normalizeRows(select.value, draft ?? saved[select.value]);
    render();
  }

  for (const [id, menu] of Object.entries(menus)) {
    const option = element('option', menu.label);
    option.value = id;
    select.append(option);
  }
  select.onchange = () => {
    fill();
    changed();
  };
  add.onclick = () => {
    const menu = menus[select.value];
    if (!menu.maxRows || rows.length >= menu.maxRows) return;
    rows.push(Object.fromEntries(Object.keys(menu.rows[0]).map(field => [field, ''])));
    render();
    changed();
    container.querySelector('#menu-title-' + (rows.length - 1)).focus();
  };
  fill();
  return {
    fill,
    reset() {
      fill(select.value, menus[select.value].rows);
      remember();
    },
    read: () => ({design: select.value, rows: rows.map(row => ({...row}))}),
  };
}
