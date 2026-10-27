'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true
});

global.window = dom.window;
global.document = dom.window.document;
global.CustomEvent = dom.window.CustomEvent;
global.Event = dom.window.Event;
global.MouseEvent = dom.window.MouseEvent;
global.HTMLElement = dom.window.HTMLElement;
global.Node = dom.window.Node;
global.getComputedStyle = dom.window.getComputedStyle;

const BSelect = require(path.join(__dirname, '..', 'bselect.js'));

function mount(html) {
  document.body.innerHTML = html;
  return document.body.firstElementChild;
}

function click(el) {
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

function type(input, value) {
  input.value = value;
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
}

function wrap(el) {
  return el.nextElementSibling;
}

function optionEls(instance) {
  return Array.from(instance._listEl.querySelectorAll('.BSelect__option'));
}

test('renders options from a JS array of strings', () => {
  const el = mount('<div id="s"></div>');
  const select = new BSelect(el, { data: ['تهران', 'شیراز', 'تبریز'] });
  const root = wrap(el);

  assert.ok(root.classList.contains('BSelect'));
  assert.strictEqual(optionEls(select).length, 3);
  assert.strictEqual(optionEls(select)[0].textContent.trim(), 'تهران');
  assert.strictEqual(select.getValue(), null);
  assert.strictEqual(select.getValues().length, 0);
  select.destroy();
});

test('opens the dropdown and selects a single option', () => {
  const el = mount('<div></div>');
  const changes = [];
  const select = new BSelect(el, {
    data: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
    onChange: (payload) => changes.push(payload)
  });

  click(select._controlEl);
  assert.strictEqual(select._open, true);
  assert.strictEqual(select._dropdownEl.hidden, false);

  click(optionEls(select)[1]);
  assert.strictEqual(select.getValue(), 'b');
  assert.strictEqual(select._open, false, 'single select closes after choosing');
  assert.strictEqual(changes.length, 1);
  assert.strictEqual(changes[0].value, 'b');
  assert.strictEqual(changes[0].item.label, 'B');
  assert.ok(select._controlEl.textContent.includes('B'));
  select.destroy();
});

test('fires select and change events on the original element', () => {
  const el = mount('<div></div>');
  const select = new BSelect(el, { data: ['x', 'y'] });
  let selects = 0;
  let changes = 0;
  el.addEventListener('bselect:select', () => { selects += 1; });
  el.addEventListener('bselect:change', () => { changes += 1; });

  select.select('x');
  assert.strictEqual(selects, 1);
  assert.strictEqual(changes, 1);
  assert.strictEqual(select.getValue(), 'x');
  select.destroy();
});

test('search can be toggled at runtime and filters options', () => {
  const el = mount('<div></div>');
  const select = new BSelect(el, {
    data: ['تهران', 'شیراز', 'تبریز', 'مشهد', 'کرمان'],
    searchable: false
  });
  const search = select._searchEl;

  assert.strictEqual(select._searchWrap.hidden, true);

  select.setSearchable(true);
  select.open();
  assert.strictEqual(select._searchWrap.hidden, false);

  type(search, 'تبر');
  assert.deepStrictEqual(optionEls(select).map((node) => node.textContent.trim()), ['تبریز']);
  assert.ok(select._listEl.innerHTML.includes('BSelect__mark'));

  type(search, 'zzz');
  assert.strictEqual(optionEls(select).length, 0);
  assert.strictEqual(select._emptyEl.hidden, false);

  select.setSearchable(false);
  assert.strictEqual(select._searchWrap.hidden, true);
  assert.strictEqual(optionEls(select).length, 5);
  select.destroy();
});

test('multiple mode renders checkboxes and supports select all / maxSelected', () => {
  const el = mount('<div></div>');
  const select = new BSelect(el, {
    data: ['one', 'two', 'three', 'four'],
    multiple: true,
    maxSelected: 2
  });

  assert.strictEqual(select.wrapper.classList.contains('BSelect--multiple'), true);
  select.open();
  const options = optionEls(select);
  assert.strictEqual(options[0].querySelectorAll('.BSelect__checkbox').length, 1);

  click(optionEls(select)[0]);
  click(optionEls(select)[1]);
  assert.deepStrictEqual(select.getValues(), ['one', 'two']);

  // maxSelected blocks a third option
  let maxEvents = 0;
  select.on('bselect:maxselected', () => { maxEvents += 1; });
  click(optionEls(select)[2]);
  assert.strictEqual(maxEvents, 1);
  assert.deepStrictEqual(select.getValues(), ['one', 'two']);

  // deselecting then select all respects the limit
  select.clear();
  click(select._selectAllEl);
  assert.deepStrictEqual(select.getValues(), ['one', 'two']);
  assert.strictEqual(select._open, true, 'multiple stays open');

  assert.strictEqual(select.wrapper.querySelectorAll('.BSelect__chip').length, 2);
  select.destroy();
});

test('groups are read from native <select> markup with optgroups', () => {
  const el = mount(
    '<select id="native">' +
      '<optgroup label="گروه الف"><option value="1">یک</option><option value="2" selected>دو</option></optgroup>' +
      '<optgroup label="گروه ب"><option value="3">سه</option></optgroup>' +
    '</select>'
  );
  const select = new BSelect(el, { searchable: true });

  assert.strictEqual(select.getValue(), '2');
  assert.strictEqual(el.style.display, 'none');
  select.open();
  const heads = select._listEl.querySelectorAll('.BSelect__groupHead');
  assert.strictEqual(heads.length, 2);
  assert.strictEqual(select._listEl.querySelectorAll('.BSelect__group').length, 2);
  assert.ok(heads[0].textContent.includes('گروه الف'));

  // collapse the first group from its toggle button: the group must stay
  // visible (header only), never disappear from the list
  click(heads[0].querySelector('[data-group-toggle]'));
  const groupsAfterCollapse = select._listEl.querySelectorAll('.BSelect__group');
  assert.strictEqual(groupsAfterCollapse.length, 2, 'the collapsed group keeps its header');
  assert.ok(select._listEl.textContent.includes('گروه الف'));
  assert.strictEqual(groupsAfterCollapse[0].querySelectorAll('.BSelect__option').length, 0);
  assert.strictEqual(groupsAfterCollapse[1].querySelectorAll('.BSelect__option').length, 1);
  assert.strictEqual(
    groupsAfterCollapse[0].querySelector('[data-group-toggle]').getAttribute('aria-expanded'),
    'false'
  );
  assert.strictEqual(select.getValues().length, 1, 'collapsing never changes the selection');
  select.destroy();
  assert.strictEqual(el.style.display, '');
});

test('pagination limits rendered options and changes pages', () => {
  const el = mount('<div></div>');
  const data = Array.from({ length: 9 }, (_, i) => ({ value: i, label: 'آیتم ' + i }));
  const select = new BSelect(el, { data, pagination: true, pageSize: 4 });
  select.open();

  assert.strictEqual(optionEls(select).length, 4);
  assert.strictEqual(select._footerEl.hidden, false);
  assert.ok(select._pageInfoEl.textContent.includes('1'));

  const next = select._footerEl.querySelector('.BSelect__nav[data-page="next"]');
  click(next);
  assert.strictEqual(select._page, 2);
  assert.strictEqual(optionEls(select).length, 4);
  assert.strictEqual(optionEls(select)[0].textContent.trim(), 'آیتم 4');

  click(select._footerEl.querySelectorAll('.BSelect__pageBtn')[2]);
  assert.strictEqual(select._page, 3);
  assert.strictEqual(optionEls(select).length, 1);
  select.destroy();
});

test('accepts JSON strings, HTML strings and template ids as data', () => {
  const jsonEl = mount('<div></div>');
  const fromJson = new BSelect(jsonEl, {
    data: '[{"value":"fa","label":"فارسی"},{"value":"en","label":"English"}]',
    searchable: true
  });
  assert.strictEqual(optionEls(fromJson).length, 2);

  const htmlEl = mount('<div></div>');
  const fromHtml = new BSelect(htmlEl, {
    data: '<select><option value="r">قرمز</option><option value="g" data-description="سبز روشن">سبز</option></select>'
  });
  assert.strictEqual(optionEls(fromHtml).length, 2);
  assert.ok(fromHtml._listEl.textContent.includes('سبز روشن'));

  document.body.insertAdjacentHTML('beforeend', '<template id="tpl"><option value="1">یک</option><option value="2">دو</option></template>');
  const tplEl = document.createElement('div');
  document.body.appendChild(tplEl);
  const fromTemplate = new BSelect(tplEl, { data: 'tpl' });
  assert.strictEqual(optionEls(fromTemplate).length, 2);
  assert.strictEqual(fromTemplate.getValue(), null);

  [fromJson, fromHtml, fromTemplate].forEach((instance) => instance.destroy());
});

test('grouped JSON structure and asyncData callback work', async () => {
  const el = mount('<div></div>');
  const select = new BSelect(el, {
    asyncData(done) {
      setTimeout(() => {
        done({
          groups: [
            { label: 'میوه', options: [{ value: 'apple', label: 'سیب' }, { value: 'pear', label: 'گلابی' }] },
            { label: 'سبزی', options: [{ value: 'mint', label: 'نعنا' }] }
          ]
        });
      }, 5);
    },
    searchable: true,
    pagination: true,
    pageSize: 2
  });

  assert.strictEqual(select.wrapper.classList.contains('BSelect--loading'), true);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.strictEqual(select.wrapper.classList.contains('BSelect--loading'), false);
  assert.strictEqual(select._items.length, 3);
  assert.strictEqual(select._groups.length, 2);
  select.open();
  assert.strictEqual(optionEls(select).length, 2);
  assert.strictEqual(select._footerEl.hidden, false);
  select.destroy();
});

test('setValues, toggleValue, deselect and clear keep state in sync', () => {
  const el = mount('<div></div>');
  const select = new BSelect(el, { data: ['a', 'b', 'c'], multiple: true, name: 'letters' });

  select.setValues(['a', 'c']);
  assert.deepStrictEqual(select.getValues(), ['a', 'c']);
  assert.strictEqual(select.getSelectedItems().length, 2);
  assert.strictEqual(select.wrapper.querySelectorAll('input[type="hidden"]').length, 2);

  select.toggleValue('b');
  assert.deepStrictEqual(select.getValues(), ['a', 'b', 'c']);
  select.toggleValue('b');
  assert.deepStrictEqual(select.getValues(), ['a', 'c']);

  select.select('b');
  select.deselect('a');
  assert.deepStrictEqual(select.getValues(), ['b', 'c']);

  select.clear();
  assert.deepStrictEqual(select.getValues(), []);
  assert.strictEqual(select.wrapper.querySelectorAll('input[type="hidden"]').length, 0);
  select.destroy();
});

test('setData keeps selection, addOptions and removeOption update the list', () => {
  const el = mount('<div></div>');
  const select = new BSelect(el, { data: ['a', 'b'], multiple: true, searchable: true });
  select.setValues(['a']);

  select.setData(['a', 'b', 'c'], { keepSelection: true });
  assert.deepStrictEqual(select.getValues(), ['a']);
  assert.strictEqual(select._items.length, 3);

  select.addOptions(['d', 'e'], 'گروه جدید');
  assert.strictEqual(select._items.length, 5);
  assert.deepStrictEqual(select.getValues(), ['a']);

  select.removeOption('b');
  assert.strictEqual(select._items.length, 4);
  assert.deepStrictEqual(select.getValues(), ['a']);
  select.destroy();
});

test('setMultiple switches to checkboxes and trims selection', () => {
  const el = mount('<div></div>');
  const select = new BSelect(el, { data: ['a', 'b', 'c'] });
  select.setValues(['a']);
  select.setMultiple(true);
  assert.strictEqual(select.multiple, true);
  select.setValues(['a', 'b']);
  assert.deepStrictEqual(select.getValues(), ['a', 'b']);
  select.setMultiple(false);
  assert.deepStrictEqual(select.getValues(), ['a']);
  select.destroy();
});

test('disable/enable and destroy restore the original element', () => {
  const el = mount('<div class="host"></div>');
  const select = new BSelect(el, { data: ['a'], disabled: true, searchable: true });
  assert.strictEqual(select._controlEl.getAttribute('tabindex'), '-1');
  select.enable();
  assert.strictEqual(select._controlEl.getAttribute('tabindex'), '0');
  assert.strictEqual(select._open, false);

  select.disable();
  assert.strictEqual(select._controlEl.getAttribute('aria-disabled'), 'true');

  const root = wrap(el);
  select.destroy();
  assert.strictEqual(root.parentNode, null);
  assert.strictEqual(el.style.display, '');
  assert.strictEqual(el.__bselect, undefined);
});

test('keyboard navigation and Enter selection work', () => {
  const el = mount('<div></div>');
  const select = new BSelect(el, { data: ['a', 'b', 'c'] });
  select.focus();

  const key = (target, keyName) => target.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
    key: keyName,
    bubbles: true,
    cancelable: true
  }));

  key(select._controlEl, 'ArrowDown');
  assert.strictEqual(select._open, true);
  assert.strictEqual(select._active, -1, 'nothing is highlighted before the first arrow key');
  key(select._controlEl, 'ArrowDown');
  assert.strictEqual(select._active, 0);
  key(select._controlEl, 'ArrowDown');
  assert.strictEqual(select._active, 1);
  key(select._controlEl, 'Enter');
  assert.strictEqual(select.getValue(), 'b');
  assert.strictEqual(select._open, false);

  key(select._controlEl, 'ArrowDown');
  key(select._controlEl, 'Escape');
  assert.strictEqual(select._open, false);
  select.destroy();
});

test('per-instance CSS is injected exactly once and removed after the last destroy', () => {
  document.body.innerHTML = '<div></div><div></div>';
  const first = new BSelect(document.body.children[0], { data: ['a'] });
  const second = new BSelect(document.body.children[1], { data: ['b'] });
  assert.strictEqual(document.querySelectorAll('#BSelect-styles').length, 1);
  assert.ok(document.getElementById('BSelect-styles').textContent.includes('.BSelect__option'));

  first.destroy();
  assert.strictEqual(document.querySelectorAll('#BSelect-styles').length, 1);
  second.destroy();
  assert.strictEqual(document.querySelectorAll('#BSelect-styles').length, 0);
});

test('every generated class name starts with BSelect', () => {
  const el = mount('<div></div>');
  const select = new BSelect(el, {
    data: [{ group: 'g1', label: 'one', value: 1 }, { group: 'g1', label: 'two', value: 2 }],
    multiple: true,
    searchable: true,
    pagination: true,
    pageSize: 1
  });
  select.open();
  const root = wrap(el);
  root.querySelectorAll('*').forEach((node) => {
    Array.from(node.classList).forEach((name) => {
      assert.ok(name.indexOf('BSelect') === 0, 'unprefixed class: ' + name);
    });
  });
  const css = document.getElementById('BSelect-styles').textContent;
  const classNames = css.match(/\.[A-Za-z][A-Za-z0-9_-]*/g) || [];
  classNames.forEach((name) => {
    assert.ok(name.indexOf('.BSelect') === 0, 'unprefixed CSS class: ' + name);
  });
  select.destroy();
});

test('group checkbox selects every option of that group', () => {
  const el = mount('<div></div>');
  const select = new BSelect(el, {
    data: [
      { label: 'گروه یک', options: ['a1', 'a2'] },
      { label: 'گروه دو', options: ['b1', 'b2'] }
    ],
    multiple: true
  });
  select.open();
  const firstGroup = select._listEl.querySelector('.BSelect__group');
  click(firstGroup.querySelector('[data-group-check]'));
  assert.deepStrictEqual(select.getValues(), ['a1', 'a2']);
  assert.strictEqual(
    select._listEl.querySelector('.BSelect__group [data-group-check]').textContent,
    'حذف گروه'
  );

  click(select._listEl.querySelector('.BSelect__group [data-group-check]'));
  assert.deepStrictEqual(select.getValues(), []);
  assert.strictEqual(select._open, true, 'clicking the group checkbox must not collapse the group');
  select.destroy();
});

test('typing while the control is focused opens search with the typed text', () => {
  const el = mount('<div></div>');
  const select = new BSelect(el, {
    data: ['alpha', 'beta', 'gamma'],
    searchable: true
  });
  select.focus();
  select._controlEl.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
    key: 'b',
    bubbles: true,
    cancelable: true
  }));
  assert.strictEqual(select._open, true);
  assert.strictEqual(select._searchEl.value, 'b');
  assert.deepStrictEqual(optionEls(select).map((node) => node.textContent.trim()), ['beta']);
  select.destroy();
});

test('closeOnSelect:false keeps a single select open after choosing', () => {
  const el = mount('<div></div>');
  const select = new BSelect(el, { data: ['a', 'b'], closeOnSelect: false });
  select.open();
  click(optionEls(select)[0]);
  assert.strictEqual(select.getValue(), 'a');
  assert.strictEqual(select._open, true);
  select.destroy();
});

test('search also finds options inside collapsed groups and space can be typed in search', () => {
  const el = mount('<div></div>');
  const select = new BSelect(el, {
    data: [
      { label: 'شهرها', options: [{ value: 'tehran', label: 'تهران' }, { value: 'shiraz', label: 'شیراز' }] },
      { label: 'روستاها', options: [{ value: 'varamin', label: 'ورامین' }] }
    ],
    searchable: true,
    groupsCollapsed: true
  });

  select.open();
  assert.strictEqual(optionEls(select).length, 0, 'all groups start collapsed');

  type(select._searchEl, 'شیراز');
  assert.deepStrictEqual(optionEls(select).map((node) => node.textContent.trim()), ['شیراز']);

  // Space inside the search input must be a normal character, not a selection
  type(select._searchEl, 'شیراز ');
  assert.strictEqual(select.getValues().length, 0);
  assert.strictEqual(select._searchEl.value, 'شیراز ');

  type(select._searchEl, '');
  select.close();
  select.open();
  assert.strictEqual(optionEls(select).length, 0, 'collapsed state is back after clearing search');
  select.destroy();
});

test('group headers respect groupCollapsible / groupSelectable options', () => {
  const el = mount('<div></div>');
  const staticGroups = new BSelect(el, {
    data: [{ label: 'G', options: ['x', 'y'] }],
    multiple: true,
    groupCollapsible: false
  });
  staticGroups.open();
  assert.strictEqual(staticGroups._listEl.querySelectorAll('[data-group-toggle]').length, 0);
  assert.ok(staticGroups._listEl.querySelector('.BSelect__groupHead--static'));
  click(staticGroups._listEl.querySelector('[data-group-check]'));
  assert.deepStrictEqual(staticGroups.getValues(), ['x', 'y']);
  assert.strictEqual(staticGroups._open, true);
  staticGroups.destroy();

  const el2 = mount('<div></div>');
  const noGroupSelect = new BSelect(el2, {
    data: [{ label: 'G', options: ['x', 'y'] }],
    multiple: true,
    groupSelectable: false
  });
  noGroupSelect.open();
  assert.strictEqual(noGroupSelect._listEl.querySelectorAll('[data-group-check]').length, 0);
  assert.strictEqual(noGroupSelect._listEl.querySelectorAll('[data-group-toggle]').length, 1);
  noGroupSelect.destroy();
});

test('the dropdown flips up and limits its height near the bottom of the viewport', () => {
  const el = mount('<div></div>');
  const select = new BSelect(el, { data: ['a', 'b', 'c'] });
  // simulate a control that sits low in a 800px viewport
  select._controlEl.getBoundingClientRect = () => ({ top: 780, bottom: 824, left: 0, right: 200, width: 200, height: 44 });
  select.open();
  assert.strictEqual(select.wrapper.classList.contains('BSelect--dropup'), true);
  assert.ok(parseFloat(select._dropdownEl.style.maxHeight) >= 240);

  select._controlEl.getBoundingClientRect = () => ({ top: 20, bottom: 64, left: 0, right: 200, width: 200, height: 44 });
  select._position();
  assert.strictEqual(select.wrapper.classList.contains('BSelect--dropup'), false);
  assert.ok(parseFloat(select._dropdownEl.style.maxHeight) > 0);
  select.destroy();
});

test('on()/off() deliver the same payload as the option callbacks', () => {
  const el = mount('<div></div>');
  const select = new BSelect(el, { data: ['a', 'b'] });
  const fromOption = [];
  const fromOn = [];
  select.setOption('onChange', (payload) => fromOption.push(payload.values.slice()));
  const handler = (detail, instance, event) => {
    assert.strictEqual(instance, select);
    assert.ok(event instanceof dom.window.Event);
    fromOn.push(detail.values.slice());
  };
  select.on('change', handler);
  select.on('bselect:change', handler); // must not register twice

  select.select('a');
  assert.deepStrictEqual(fromOption, [['a']]);
  assert.deepStrictEqual(fromOn, [['a']]);

  select.off('change', handler);
  select.select('b');
  assert.deepStrictEqual(fromOn, [['a']]);
  assert.deepStrictEqual(fromOption, [['a'], ['b']]); // single select replaces the value
  select.destroy();
});

test('collapsing a group only hides its options, never the group itself', () => {
  const el = mount('<div></div>');
  const select = new BSelect(el, {
    data: [
      { label: 'گروه الف', options: ['a1', 'a2'] },
      { label: 'گروه ب', options: ['b1', 'b2'] }
    ],
    multiple: true,
    searchable: true
  });
  select.open();
  select.setValues(['a1']);

  const toggle = () => select._listEl.querySelector('.BSelect__group [data-group-toggle]');
  const groups = () => Array.from(select._listEl.querySelectorAll('.BSelect__group'));

  click(toggle());
  assert.strictEqual(groups().length, 2);
  assert.ok(groups()[0].textContent.includes('گروه الف'));
  assert.strictEqual(groups()[0].querySelectorAll('.BSelect__option').length, 0);
  assert.strictEqual(groups()[1].querySelectorAll('.BSelect__option').length, 2);
  assert.strictEqual(select._open, true, 'collapsing must not close the dropdown');
  assert.deepStrictEqual(select.getValues(), ['a1']);

  // badge / group action still reflect the hidden items
  assert.ok(groups()[0].querySelector('.BSelect__groupBadge').textContent.includes('2'));
  assert.strictEqual(groups()[0].querySelector('[data-group-check]').textContent, 'انتخاب گروه');

  // the group action works even while the group is collapsed (selects hidden items)
  click(groups()[0].querySelector('[data-group-check]'));
  assert.deepStrictEqual(select.getValues(), ['a1', 'a2']);
  assert.strictEqual(groups()[0].querySelector('[data-group-check]').textContent, 'حذف گروه');
  click(groups()[0].querySelector('[data-group-check]'));
  assert.deepStrictEqual(select.getValues(), []);

  // collapsing every group keeps all headers and shows no "empty" message
  click(groups()[1].querySelector('[data-group-toggle]'));
  assert.strictEqual(groups().length, 2);
  assert.strictEqual(select._listEl.querySelectorAll('.BSelect__option').length, 0);
  assert.strictEqual(select._emptyEl.hidden, true);

  // expanding again brings the options back
  click(groups()[0].querySelector('[data-group-toggle]'));
  assert.strictEqual(groups()[0].querySelectorAll('.BSelect__option').length, 2);

  // searching ignores the collapsed state (finds hidden items and shows them)
  click(groups()[0].querySelector('[data-group-toggle]')); // collapse group الف again
  type(select._searchEl, 'a1');
  assert.deepStrictEqual(optionEls(select).map((n) => n.textContent.trim()), ['a1']);
  type(select._searchEl, '');
  assert.strictEqual(select._listEl.querySelectorAll('.BSelect__group').length, 2, 'headers stay');
  assert.strictEqual(select._listEl.querySelectorAll('.BSelect__option').length, 0,
    'both groups are collapsed again after clearing the search');
  click(groups()[1].querySelector('[data-group-toggle]'));
  assert.strictEqual(select._listEl.querySelectorAll('.BSelect__option').length, 2,
    'expanding a group brings its options back');
  select.destroy();
});

test('collapsed groups do not break pagination or the page counters', () => {
  const el = mount('<div></div>');
  const select = new BSelect(el, {
    data: [
      { label: 'G1', options: ['1', '2', '3'] },
      { label: 'G2', options: ['4', '5', '6'] },
      { label: 'G3', options: ['7', '8', '9'] }
    ],
    pagination: true,
    pageSize: 3
  });
  select.open();
  assert.strictEqual(select._listEl.querySelectorAll('.BSelect__option').length, 3);
  assert.strictEqual(select._pageCount(), 3);

  click(select._listEl.querySelector('[data-group-toggle]')); // collapse G1
  assert.strictEqual(select._listEl.querySelectorAll('.BSelect__group').length, 2, 'G1 header still rendered');
  assert.strictEqual(select._listEl.querySelectorAll('.BSelect__option').length, 3);
  assert.strictEqual(select._pageCount(), 2, 'pagination counts only the visible options');

  click(select._footerEl.querySelector('[data-page="next"]'));
  assert.strictEqual(select._page, 2);
  assert.strictEqual(select._listEl.querySelectorAll('.BSelect__option').length, 3);
  assert.ok(select._pageInfoEl.textContent.includes('6'));

  // collapse the group that is showing on the last page: the page is clamped
  // instead of leaving an empty page behind
  const lastPageSelect = new BSelect(mount('<div></div>'), {
    data: [
      { label: 'G1', options: ['1', '2', '3'] },
      { label: 'G2', options: ['4', '5', '6'] },
      { label: 'G3', options: ['7', '8', '9'] }
    ],
    pagination: true,
    pageSize: 3
  });
  lastPageSelect.open();
  click(lastPageSelect._footerEl.querySelector('[data-page="next"]'));
  click(lastPageSelect._footerEl.querySelector('[data-page="next"]'));
  assert.strictEqual(lastPageSelect._page, 3);
  assert.deepStrictEqual(optionEls(lastPageSelect).map((n) => n.textContent.trim()), ['7', '8', '9']);

  click(lastPageSelect._listEl.querySelector('[data-group-toggle]')); // collapse G3
  assert.strictEqual(lastPageSelect._pageCount(), 2);
  assert.strictEqual(lastPageSelect._page, 2, 'the page is clamped instead of becoming empty');
  assert.strictEqual(lastPageSelect._listEl.querySelectorAll('.BSelect__option').length, 3);
  assert.ok(lastPageSelect._listEl.textContent.includes('G3'),
    'the collapsed group keeps its header on the clamped page');
  assert.strictEqual(lastPageSelect._emptyEl.hidden, true);
  lastPageSelect.destroy();

  select.destroy();
});
