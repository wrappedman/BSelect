/*!
 * BSelect - a dependency-free, style-in-JS custom <select>
 * ---------------------------------------------------------------------------
 * • Single or multiple selection (with checkboxes)
 * • Optional search (toggleable at runtime)
 * • Optional grouping + collapsible groups
 * • Optional pagination (client side)
 * • Data can be injected from: JS array/objects, existing <select> markup,
 *   JSON file/URL, HTML string, a <template>, or a remote callback.
 * • Every CSS class is prefixed with "B" to stay collision free.
 *
 * No external modules, no build step, no network requests except the ones you
 * explicitly ask for (data-url / data-src / asyncData).
 *
 * @license GPL-3.0-or-later
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.BSelect = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ========================================================================
   * 1. Small helpers
   * ===================================================================== */

  var INSTANCE_SEQ = 0;
  var OPEN_INSTANCES = [];
  var STYLE_ID = 'BSelect-styles';

  var DEFAULTS = {
    data: null,             // array | {groups:[...]} | JSON string | JSON URL | HTML string | template id
    dataUrl: null,          // json file / endpoint (GET)
    dataType: null,         // 'json' (default when url is used) | 'html'
    asyncData: null,        // function (done, fail) => void
    fetchOptions: null,     // options passed to fetch()
    value: null,            // initial value (string or array)
    multiple: false,
    searchable: false,
    searchPlaceholder: null,
    groups: true,           // allow group rendering
    groupsCollapsed: false, // true => every group starts collapsed
    groupCollapsible: true, // false => group headers are not toggleable
    pagination: false,
    pageSize: 10,
    placeholder: null,
    disabled: false,
    closeOnSelect: null,    // default: true for single, false for multiple
    maxSelected: 0,         // 0 = unlimited (multiple mode)
    name: null,             // hidden input(s) name
    zIndex: 60,
    rtl: true,              // false => left-to-right rendering
    ariaLabel: null,
    emptyText: null,
    noResultsText: null,
    loadingText: null,
    selectAllText: null,
    clearAllText: null,
    selectedCountText: null,
    totalCountText: null,
    pageInfoText: null,
    onChange: null,
    onSelect: null,
    onDeselect: null,
    onOpen: null,
    onClose: null,
    onSearch: null,
    onPageChange: null,
    onLoad: null,
    onMaxSelected: null,
    groupSelectable: true,  // group headers get a "select whole group" button
    groupSelectText: null,
    groupClearText: null,
    onClear: null,
    onToggle: null,
    onError: null
  };

  // event name -> callback option name (avoids camelCase guessing bugs)
  var EVENT_CALLBACKS = {
    change: 'onChange',
    select: 'onSelect',
    deselect: 'onDeselect',
    open: 'onOpen',
    close: 'onClose',
    search: 'onSearch',
    pagechange: 'onPageChange',
    load: 'onLoad',
    maxselected: 'onMaxSelected',
    clear: 'onClear',
    toggle: 'onToggle',
    error: 'onError'
  };

  var TEXTS = {
    placeholder: 'انتخاب کنید…',
    searchPlaceholder: 'جستجو…',
    emptyText: 'گزینه‌ای برای نمایش وجود ندارد',
    noResultsText: 'نتیجه‌ای پیدا نشد',
    loadingText: 'در حال بارگذاری…',
    selectAllText: 'انتخاب همه',
    clearAllText: 'حذف همه',
    selectedCountText: '{n} مورد انتخاب شده',
    totalCountText: '{n} مورد',
    pageInfoText: 'نمایش {from} تا {to} از {total}',
    groupToggleText: 'باز و بستن گروه',
    groupSelectText: 'انتخاب گروه',
    removeText: 'حذف',
    groupClearText: 'حذف گروه'
  };

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      if (!src) continue;
      for (var key in src) {
        if (hasOwn(src, key)) target[key] = src[key];
      }
    }
    return target;
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escAttr(value) {
    return esc(value).replace(/`/g, '&#96;');
  }

  /** Normalises Persian/Arabic characters so "ي" and "ی" match. */
  function normChars(str) {
    return String(str == null ? '' : str)
      .replace(/[\u064A\u0649]/g, '\u06CC')  // ي/ى -> ی
      .replace(/\u0643/g, '\u06A9')          // ك -> ک
      .replace(/[\u200C\u200D\u200E\u200F\uFEFF]/g, ' ')
      .replace(/[\u064B-\u0652]/g, '')
      .replace(/\s+/g, ' ');
  }

  function norm(str) {
    return normChars(str).toLowerCase().trim();
  }

  /**
   * Builds a normalised string plus a map from normalised index to the index
   * in the original string, so a match can be highlighted on the original text
   * (Persian chars, ZWNJ, diacritics and repeated spaces are all handled).
   */
  function normalizeWithMap(value) {
    var str = String(value == null ? '' : value);
    var out = '';
    var map = [];
    var previousSpace = false;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charAt(i);
      var code = str.charCodeAt(i);
      if (code >= 0x064b && code <= 0x0652) continue;      // diacritics
      if (ch === '\u064A' || ch === '\u0649') ch = '\u06CC'; // ي / ى -> ی
      else if (ch === '\u0643') ch = '\u06A9';              // ك -> ک
      else if (ch === '\u200C' || ch === '\u200D' || ch === '\u200E' || ch === '\u200F' || ch === '\uFEFF') ch = ' ';
      if (ch === ' ') {
        if (previousSpace) continue;
        previousSpace = true;
      } else {
        previousSpace = false;
      }
      out += ch.toLowerCase();
      map.push(i);
    }
    return { text: out, map: map };
  }

  function highlight(label, term) {
    var source = esc(label);
    var needle = normChars(term || '').toLowerCase().trim();
    if (!needle) return source;
    var normalized = normalizeWithMap(label);
    var index = normalized.text.indexOf(needle);
    if (index === -1) return source;
    var start = normalized.map[index];
    var end = normalized.map[index + needle.length - 1];
    if (start == null || end == null) return source;
    end += 1;
    return esc(String(label).slice(0, start)) +
      '<mark class="BSelect__mark">' + esc(String(label).slice(start, end)) + '</mark>' +
      esc(String(label).slice(end));
  }

  function fmt(template, values) {
    return String(template == null ? '' : template).replace(/\{(\w+)\}/g, function (match, key) {
      return hasOwn(values, key) ? values[key] : match;
    });
  }

  function closest(node, selector) {
    while (node && node.nodeType === 1) {
      if (node.matches && node.matches(selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  function toArray(value) {
    return Array.prototype.slice.call(value || []);
  }

  function uniqueId() {
    INSTANCE_SEQ += 1;
    return 'bselect-' + INSTANCE_SEQ;
  }

  function isElement(value) {
    return !!value && value.nodeType === 1;
  }

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value) && !isElement(value);
  }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      var self = this;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(self, args);
      }, wait);
    };
  }

  /* ========================================================================
   * 2. CSS (everything lives here, nothing external)
   * ===================================================================== */

  var CSS = [
    /* --- root / wrapper ------------------------------------------------- */
    '.BSelect,',
    '.BSelect * {',
    '  box-sizing: border-box;',
    '}',
    '.BSelect {',
    '  --B-primary: #2f6fed;',
    '  --B-primary-soft: rgba(47, 111, 237, 0.12);',
    '  --B-border: #dfe3ea;',
    '  --B-border-strong: #c6ccd8;',
    '  --B-text: #1f2937;',
    '  --B-muted: #8a93a5;',
    '  --B-bg: #ffffff;',
    '  --B-bg-soft: #f6f8fb;',
    '  --B-danger: #e5484d;',
    '  --B-radius: 10px;',
    '  --B-shadow: 0 14px 40px -12px rgba(17, 24, 39, 0.28), 0 2px 8px rgba(17, 24, 39, 0.06);',
    '  position: relative;',
    '  width: 100%;',
    '  min-width: 0;',
    '  font-family: inherit;',
    '  font-size: 14px;',
    '  line-height: 1.5;',
    '  color: var(--B-text);',
    '  direction: rtl;',
    '  text-align: right;',
    '}',
    '.BSelect--ltr { direction: ltr; text-align: left; }',
    '.BSelect--ltr .BSelect__groupToggle { text-align: left; }',
    '.BSelect--ltr .BSelect__search { padding: 0 10px 0 32px; }',
    '.BSelect--ltr .BSelect__searchIcon { right: auto; left: 10px; }',
    '.BSelect[hidden] { display: none !important; }',
    '.BSelect *,',
    '.BSelect *::before,',
    '.BSelect *::after { box-sizing: border-box; }',
    '.BSelect__nativeWrap { display: none; }',

    /* --- control -------------------------------------------------------- */
    '.BSelect__control {',
    '  position: relative;',
    '  display: flex;',
    '  align-items: center;',
    '  gap: 8px;',
    '  width: 100%;',
    '  min-height: 44px;',
    '  padding: 6px 12px;',
    '  background: var(--B-bg);',
    '  border: 1px solid var(--B-border);',
    '  border-radius: var(--B-radius);',
    '  cursor: pointer;',
    '  outline: none;',
    '  user-select: none;',
    '  transition: border-color 0.15s ease, box-shadow 0.15s ease;',
    '}',
    '.BSelect__control:hover { border-color: var(--B-border-strong); }',
    '.BSelect__control:focus-visible,',
    '.BSelect--focused .BSelect__control,',
    '.BSelect--open .BSelect__control {',
    '  border-color: var(--B-primary);',
    '  box-shadow: 0 0 0 3px var(--B-primary-soft);',
    '}',
    '.BSelect--disabled .BSelect__control {',
    '  cursor: not-allowed;',
    '  background: #f2f4f8;',
    '  color: var(--B-muted);',
    '}',
    '.BSelect--disabled .BSelect__control:hover { border-color: var(--B-border); }',
    '.BSelect__value {',
    '  flex: 1 1 auto;',
    '  min-width: 0;',
    '  overflow: hidden;',
    '  text-overflow: ellipsis;',
    '  white-space: nowrap;',
    '}',
    '.BSelect__value--placeholder { color: var(--B-muted); }',
    '.BSelect__chips {',
    '  display: flex;',
    '  flex-wrap: wrap;',
    '  align-items: center;',
    '  gap: 4px;',
    '  max-height: 74px;',
    '  overflow-y: auto;',
    '  padding: 1px 0;',
    '}',
    '.BSelect__chip {',
    '  display: inline-flex;',
    '  align-items: center;',
    '  gap: 4px;',
    '  max-width: 100%;',
    '  padding: 1px 8px;',
    '  background: var(--B-primary-soft);',
    '  color: var(--B-primary);',
    '  border-radius: 999px;',
    '  font-size: 12px;',
    '  line-height: 22px;',
    '}',
    '.BSelect__chipText {',
    '  overflow: hidden;',
    '  text-overflow: ellipsis;',
    '  white-space: nowrap;',
    '  max-width: 150px;',
    '}',
    '.BSelect__chipX {',
    '  display: inline-flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  width: 16px;',
    '  height: 16px;',
    '  padding: 0;',
    '  border: 0;',
    '  border-radius: 50%;',
    '  background: transparent;',
    '  color: inherit;',
    '  cursor: pointer;',
    '  opacity: 0.7;',
    '}',
    '.BSelect__chipX svg { display: block; width: 9px; height: 9px; }',
    '.BSelect__chipX:hover { background: rgba(47, 111, 237, 0.2); opacity: 1; }',
    '.BSelect__chipMore {',
    '  padding: 1px 6px;',
    '  color: var(--B-muted);',
    '  font-size: 12px;',
    '  white-space: nowrap;',
    '}',
    '.BSelect__arrow {',
    '  flex: 0 0 auto;',
    '  display: inline-flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  width: 18px;',
    '  height: 18px;',
    '  color: var(--B-muted);',
    '  transition: transform 0.18s ease;',
    '}',
    '.BSelect--open .BSelect__arrow { transform: rotate(180deg); color: var(--B-primary); }',
    '.BSelect__spinner {',
    '  display: none;',
    '  flex: 0 0 auto;',
    '  width: 16px;',
    '  height: 16px;',
    '  border: 2px solid var(--B-border);',
    '  border-top-color: var(--B-primary);',
    '  border-radius: 50%;',
    '  animation: BSelect-spin 0.7s linear infinite;',
    '}',
    '.BSelect--loading .BSelect__spinner { display: inline-block; }',
    '.BSelect--loading .BSelect__arrow { display: none; }',

    /* --- dropdown ------------------------------------------------------ */
    '.BSelect__dropdown {',
    '  position: absolute;',
    '  top: calc(100% + 6px);',
    '  right: 0;',
    '  left: 0;',
    '  z-index: var(--B-z, 60);',
    '  display: flex;',
    '  flex-direction: column;',
    '  max-height: min(360px, 62vh);',
    '  overflow: hidden;',
    '  background: var(--B-bg);',
    '  border: 1px solid var(--B-border);',
    '  border-radius: 12px;',
    '  box-shadow: var(--B-shadow);',
    '  animation: BSelect-in 0.13s ease-out;',
    '}',
    '.BSelect--dropup .BSelect__dropdown {',
    '  top: auto;',
    '  bottom: calc(100% + 6px);',
    '  animation-name: BSelect-in-up;',
    '}',
    '.BSelect__dropdown[hidden] { display: none; }',

    /* --- search -------------------------------------------------------- */
    '.BSelect__header {',
    '  flex: 0 0 auto;',
    '  padding: 8px 8px 0;',
    '  background: var(--B-bg);',
    '}',
    '.BSelect__header[hidden],',
    '.BSelect__search[hidden],',
    '.BSelect__toolbar[hidden],',
    '.BSelect__footer[hidden],',
    '.BSelect__empty[hidden] { display: none; }',
    '.BSelect__searchWrap { position: relative; }',
    '.BSelect__searchWrap[hidden] { display: none; }',
    '.BSelect__search {',
    '  width: 100%;',
    '  height: 36px;',
    '  padding: 0 32px 0 10px;',
    '  color: var(--B-text);',
    '  background: var(--B-bg-soft);',
    '  border: 1px solid var(--B-border);',
    '  border-radius: 8px;',
    '  outline: none;',
    '  font: inherit;',
    '  transition: border-color 0.15s ease, background 0.15s ease;',
    '}',
    '.BSelect__search:focus { border-color: var(--B-primary); background: var(--B-bg); }',
    '.BSelect__searchIcon {',
    '  position: absolute;',
    '  top: 50%;',
    '  right: 10px;',
    '  width: 15px;',
    '  height: 15px;',
    '  margin-top: -7.5px;',
    '  color: var(--B-muted);',
    '  pointer-events: none;',
    '}',
    '.BSelect__toolbar {',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: space-between;',
    '  gap: 8px;',
    '  padding: 8px 2px 2px;',
    '}',
    '.BSelect__selectAll {',
    '  display: inline-flex;',
    '  align-items: center;',
    '  gap: 8px;',
    '  padding: 4px 6px;',
    '  color: var(--B-text);',
    '  background: transparent;',
    '  border: 0;',
    '  border-radius: 6px;',
    '  font: inherit;',
    '  font-size: 12px;',
    '  cursor: pointer;',
    '}',
    '.BSelect__selectAll:hover { background: var(--B-bg-soft); }',
    '.BSelect__count {',
    '  color: var(--B-muted);',
    '  font-size: 12px;',
    '  white-space: nowrap;',
    '}',

    /* --- checkbox ------------------------------------------------------ */
    '.BSelect__checkbox {',
    '  flex: 0 0 auto;',
    '  position: relative;',
    '  display: inline-block;',
    '  width: 17px;',
    '  height: 17px;',
    '  border: 1.5px solid var(--B-border-strong);',
    '  border-radius: 4px;',
    '  background: var(--B-bg);',
    '  transition: background 0.12s ease, border-color 0.12s ease;',
    '}',
    '.BSelect__checkbox--checked,',
    '.BSelect__checkbox--indeterminate {',
    '  border-color: var(--B-primary);',
    '  background: var(--B-primary);',
    '}',
    '.BSelect__checkbox--checked::after {',
    '  content: "";',
    '  position: absolute;',
    '  top: 2px;',
    '  left: 5px;',
    '  width: 4px;',
    '  height: 8px;',
    '  border: solid #fff;',
    '  border-width: 0 2px 2px 0;',
    '  transform: rotate(43deg);',
    '}',
    '.BSelect__checkbox--indeterminate::after {',
    '  content: "";',
    '  position: absolute;',
    '  top: 7px;',
    '  left: 3px;',
    '  width: 8px;',
    '  height: 2px;',
    '  border-radius: 1px;',
    '  background: #fff;',
    '}',
    '.BSelect__option--disabled .BSelect__checkbox {',
    '  background: #eef0f4;',
    '  border-color: var(--B-border);',
    '}',

    /* --- list / options ------------------------------------------------ */
    '.BSelect__list {',
    '  flex: 1 1 auto;',
    '  min-height: 84px;',
    '  overflow-y: auto;',
    '  overscroll-behavior: contain;',
    '  padding: 6px;',
    '  scrollbar-width: thin;',
    '}',
    '.BSelect__list::-webkit-scrollbar { width: 8px; }',
    '.BSelect__list::-webkit-scrollbar-thumb {',
    '  background: #d5dae3;',
    '  border-radius: 8px;',
    '}',
    '.BSelect__group { padding: 0; }',
    '.BSelect__group + .BSelect__group { margin-top: 2px; }',
    '.BSelect__groupHead {',
    '  display: flex;',
    '  align-items: center;',
    '  gap: 4px;',
    '  padding: 1px 2px;',
    '}',
    '.BSelect__groupToggle {',
    '  flex: 1 1 auto;',
    '  display: flex;',
    '  align-items: center;',
    '  gap: 6px;',
    '  min-width: 0;',
    '  padding: 5px 6px;',
    '  border: 0;',
    '  border-radius: 6px;',
    '  background: transparent;',
    '  color: var(--B-muted);',
    '  font: inherit;',
    '  font-size: 12px;',
    '  font-weight: 700;',
    '  text-align: right;',
    '  cursor: pointer;',
    '}',
    '.BSelect__groupToggle:hover { background: var(--B-bg-soft); color: var(--B-text); }',
    '.BSelect__groupToggle:focus-visible { outline: 2px solid var(--B-primary); outline-offset: -2px; }',
    '.BSelect__groupHead--static .BSelect__groupToggle { cursor: default; }',
    '.BSelect__groupHead--static .BSelect__groupToggle:hover { background: transparent; color: var(--B-muted); }',
    '.BSelect__groupTitle {',
    '  flex: 1 1 auto;',
    '  overflow: hidden;',
    '  text-overflow: ellipsis;',
    '  white-space: nowrap;',
    '}',
    '.BSelect__groupBadge {',
    '  flex: 0 0 auto;',
    '  min-width: 20px;',
    '  padding: 0 5px;',
    '  border-radius: 999px;',
    '  background: var(--B-bg-soft);',
    '  color: var(--B-muted);',
    '  font-size: 11px;',
    '  font-weight: 400;',
    '  line-height: 18px;',
    '  text-align: center;',
    '}',
    '.BSelect__groupCaret {',
    '  flex: 0 0 auto;',
    '  display: inline-flex;',
    '  width: 14px;',
    '  height: 14px;',
    '  color: var(--B-muted);',
    '  transition: transform 0.15s ease;',
    '}',
    '.BSelect__groupToggle[aria-expanded="false"] .BSelect__groupCaret { transform: rotate(-90deg); }',
    '.BSelect__groupAction {',
    '  flex: 0 0 auto;',
    '  padding: 1px 9px;',
    '  border: 1px solid var(--B-border);',
    '  border-radius: 999px;',
    '  background: var(--B-bg);',
    '  color: var(--B-primary);',
    '  font: inherit;',
    '  font-size: 10.5px;',
    '  line-height: 18px;',
    '  white-space: nowrap;',
    '  cursor: pointer;',
    '  transition: background 0.12s ease, border-color 0.12s ease;',
    '}',
    '.BSelect__groupAction:hover { background: var(--B-primary-soft); border-color: var(--B-primary); }',
    '.BSelect__groupAction:focus-visible { outline: 2px solid var(--B-primary); outline-offset: 1px; }',
    '.BSelect__groupAction:disabled { opacity: 0.45; cursor: default; }',
    '.BSelect__groupBody { display: block; }',
    '.BSelect__option {',
    '  position: relative;',
    '  display: flex;',
    '  align-items: center;',
    '  gap: 8px;',
    '  padding: 8px 9px;',
    '  border-radius: 7px;',
    '  cursor: pointer;',
    '  transition: background 0.1s ease;',
    '}',
    '.BSelect__option:hover { background: var(--B-bg-soft); }',
    '.BSelect__option--active { background: var(--B-primary-soft); }',
    '.BSelect__option--selected { color: var(--B-primary); }',
    '.BSelect__option--selected .BSelect__label { font-weight: 600; }',
    '.BSelect__option--disabled {',
    '  cursor: not-allowed;',
    '  opacity: 0.5;',
    '}',
    '.BSelect__option--disabled:hover { background: transparent; }',
    '.BSelect__option .BSelect__checkbox { margin-top: 1px; }',
    '.BSelect__optionText {',
    '  flex: 1 1 auto;',
    '  min-width: 0;',
    '  display: flex;',
    '  flex-direction: column;',
    '}',
    '.BSelect__label {',
    '  overflow: hidden;',
    '  text-overflow: ellipsis;',
    '  white-space: nowrap;',
    '}',
    '.BSelect__desc {',
    '  color: var(--B-muted);',
    '  font-size: 11px;',
    '  line-height: 1.45;',
    '  overflow: hidden;',
    '  text-overflow: ellipsis;',
    '  white-space: nowrap;',
    '}',
    '.BSelect__mark {',
    '  padding: 0 1px;',
    '  border-radius: 3px;',
    '  background: #ffe9a8;',
    '  color: inherit;',
    '}',
    '.BSelect__tick {',
    '  flex: 0 0 auto;',
    '  width: 16px;',
    '  height: 16px;',
    '  color: var(--B-primary);',
    '  opacity: 0;',
    '  transition: opacity 0.1s ease;',
    '}',
    '.BSelect__option--selected .BSelect__tick { opacity: 1; }',
    '.BSelect__empty {',
    '  padding: 18px 10px;',
    '  color: var(--B-muted);',
    '  font-size: 12px;',
    '  text-align: center;',
    '}',

    /* --- footer / pagination ------------------------------------------ */
    '.BSelect__footer {',
    '  flex: 0 0 auto;',
    '  display: flex;',
    '  flex-wrap: wrap;',
    '  align-items: center;',
    '  justify-content: center;',
    '  gap: 4px;',
    '  padding: 6px 8px;',
    '  border-top: 1px solid var(--B-border);',
    '  background: var(--B-bg-soft);',
    '}',
    '.BSelect__pageInfo {',
    '  flex: 1 1 100%;',
    '  color: var(--B-muted);',
    '  font-size: 11px;',
    '  text-align: center;',
    '}',
    '.BSelect__pages {',
    '  display: flex;',
    '  flex-wrap: wrap;',
    '  align-items: center;',
    '  justify-content: center;',
    '  gap: 3px;',
    '}',
    '.BSelect__pageBtn,',
    '.BSelect__nav {',
    '  min-width: 26px;',
    '  height: 26px;',
    '  padding: 0 6px;',
    '  border: 1px solid transparent;',
    '  border-radius: 6px;',
    '  background: transparent;',
    '  color: var(--B-text);',
    '  font: inherit;',
    '  font-size: 12px;',
    '  cursor: pointer;',
    '}',
    '.BSelect__pageBtn:hover:not(:disabled),',
    '.BSelect__nav:hover:not(:disabled) { background: #e9eefb; }',
    '.BSelect__pageBtn--active {',
    '  border-color: var(--B-primary);',
    '  background: var(--B-primary);',
    '  color: #fff;',
    '}',
    '.BSelect__pageBtn:disabled,',
    '.BSelect__nav:disabled { opacity: 0.4; cursor: not-allowed; }',
    '.BSelect__pageDots { padding: 0 2px; color: var(--B-muted); }',

    /* --- misc ---------------------------------------------------------- */
    '.BSelect__sr {',
    '  position: absolute;',
    '  width: 1px;',
    '  height: 1px;',
    '  padding: 0;',
    '  margin: -1px;',
    '  overflow: hidden;',
    '  clip: rect(0 0 0 0);',
    '  white-space: nowrap;',
    '  border: 0;',
    '}',
    '.BSelect__live {',
    '  position: absolute;',
    '  width: 1px;',
    '  height: 1px;',
    '  overflow: hidden;',
    '  clip: rect(0 0 0 0);',
    '}',
    '.BSelect--shake { animation: BSelect-shake 0.35s ease; }',
    '@keyframes BSelect-spin { to { transform: rotate(360deg); } }',
    '@keyframes BSelect-in {',
    '  from { opacity: 0; transform: translateY(-4px); }',
    '  to { opacity: 1; transform: translateY(0); }',
    '}',
    '@keyframes BSelect-in-up {',
    '  from { opacity: 0; transform: translateY(4px); }',
    '  to { opacity: 1; transform: translateY(0); }',
    '}',
    '@keyframes BSelect-shake {',
    '  0%, 100% { transform: translateX(0); }',
    '  25% { transform: translateX(-4px); }',
    '  50% { transform: translateX(4px); }',
    '  75% { transform: translateX(-2px); }',
    '}',
    '@media (prefers-reduced-motion: reduce) {',
    '  .BSelect__dropdown, .BSelect__arrow, .BSelect__groupCaret, .BSelect--shake { animation: none; transition: none; }',
    '}'
  ].join('\n');

  function injectStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function removeStylesIfUnused() {
    if (typeof document === 'undefined') return;
    if (BSelect._liveInstances > 0) return;
    var style = document.getElementById(STYLE_ID);
    if (style && style.parentNode) style.parentNode.removeChild(style);
  }

  /* ========================================================================
   * 3. Data parsing (array / JSON / HTML / <select> / <template>)
   * ===================================================================== */

  /**
   * Turns any supported description of a group/option into a normalised list:
   * [{ key, label, items: [{ value, label, description, disabled, selected, raw }] }]
   */
  function readNodeOptions(selectEl, opts) {
    var groups = [];
    var flat = { key: 'g0', label: null, items: [], _flat: true };
    var groupIndex = 0;

    function pushOption(item, group) {
      var value = item.value;
      var label = item.label == null || item.label === '' ? value : item.label;
      var opt = {
        value: String(value == null ? '' : value),
        label: String(label == null ? '' : label),
        description: item.description == null ? '' : String(item.description),
        disabled: !!item.disabled,
        selected: !!item.selected,
        raw: item.raw
      };
      if (group) {
        group.items.push(opt);
      } else {
        flat.items.push(opt);
      }
    }

    function readOptions(parent, group) {
      toArray(parent.children).forEach(function (node) {
        if (node.tagName === 'OPTGROUP') {
          groupIndex += 1;
          var g = {
            key: 'g' + groupIndex,
            label: node.getAttribute('label') || '',
            items: [],
            disabled: node.disabled
          };
          groups.push(g);
          readOptions(node, g);
        } else if (node.tagName === 'OPTION') {
          var text = node.textContent;
          var desc = node.getAttribute('data-description') || node.getAttribute('data-desc') || '';
          pushOption({
            value: node.value != null ? node.value : text,
            label: node.getAttribute('data-label') || text,
            description: desc,
            disabled: node.disabled || node.getAttribute('aria-disabled') === 'true',
            selected: node.defaultSelected || node.hasAttribute('selected'),
            raw: node
          }, group);
        }
      });
    }

    readOptions(selectEl, null);

    if (flat.items.length) groups.unshift(flat);
    return groups.map(function (g, index) {
      return {
        key: g._flat ? 'flat' : 'node-' + index + '-' + g.key,
        label: g._flat ? null : g.label,
        items: g.items,
        collapsed: !!g.collapsed,
        disabled: !!g.disabled
      };
    }).filter(function (g) { return g.items.length > 0; });
  }

  function readHtmlOptions(html, opts) {
    var holder = document.createElement('div');
    holder.innerHTML = html;

    var select = holder.querySelector('select');
    if (select) return readNodeOptions(select, opts);

    // Bare <option> / <optgroup> markup without a <select> wrapper.
    if (holder.querySelector('option')) {
      var fakeSelect = document.createElement('select');
      toArray(holder.children).forEach(function (child) {
        if (child.tagName === 'OPTGROUP' || child.tagName === 'OPTION') fakeSelect.appendChild(child);
      });
      return readNodeOptions(fakeSelect, opts);
    }

    var scope = holder;
    var candidateGroups = Array.prototype.filter.call(holder.children, function (node) {
      return node.tagName === 'UL' || node.tagName === 'OL';
    });
    if (candidateGroups.length === 1) scope = candidateGroups[0];

    var groups = [];
    var flat = { key: 'flat', label: null, items: [] };
    var groupIndex = 0;

    function buttonToItem(btn) {
      var value = btn.getAttribute('data-value');
      if (value == null) value = btn.getAttribute('value');
      if (value == null) value = (btn.textContent || '').trim();
      return {
        value: value,
        label: btn.getAttribute('data-label') || (btn.textContent || '').trim(),
        description: btn.getAttribute('data-description') || btn.getAttribute('data-desc') || '',
        disabled: btn.disabled || btn.getAttribute('aria-disabled') === 'true',
        selected: btn.getAttribute('data-selected') === 'true' || btn.hasAttribute('selected'),
        raw: btn
      };
    }

    // Supports grouping from the template idea:
    // <div class="demo-x-groups">
    //   <div class="demo-x-group">or use data-group="..."</div>
    //   <ul>...</ul>
    // </div>
    function walk(parent, group) {
      toArray(parent.children).forEach(function (node) {
        var tag = node.tagName;
        if ((tag === 'DIV' || tag === 'SECTION' || tag === 'DETAILS') && node.hasAttribute('data-group')) {
          groupIndex += 1;
          var wrapGroup = {
            key: 'html-' + groupIndex,
            label: node.getAttribute('data-group'),
            items: []
          };
          groups.push(wrapGroup);
          var innerList = node.querySelector('ul, ol');
          walk(innerList || node, wrapGroup);
          return;
        }
        if (tag === 'LI') {
          var gnode = null;
          var directLabel = '';
          // <li data-group="..."><span>Group</span><ul>...</ul></li>
          toArray(node.children).forEach(function (child) {
            if (child.tagName === 'UL' || child.tagName === 'OL') gnode = child;
            else if (child.tagName !== 'BUTTON') directLabel += child.textContent;
          });
          if (gnode) {
            groupIndex += 1;
            var g = {
              key: 'html-' + groupIndex,
              label: node.getAttribute('data-group') || directLabel.trim() || '',
              items: []
            };
            groups.push(g);
            walk(gnode, g);
          } else {
            var target = group || flat;
            if (node.tagName === 'LI' && (node.querySelector('button, option, [data-value]'))) {
              var inner = node.querySelector('button, [data-value]');
              target.items.push(buttonToItem(inner));
            } else {
              target.items.push({
                value: node.getAttribute('data-value') || (node.textContent || '').trim(),
                label: node.getAttribute('data-label') || (node.textContent || '').trim(),
                description: node.getAttribute('data-description') || '',
                disabled: node.getAttribute('aria-disabled') === 'true',
                selected: node.getAttribute('data-selected') === 'true',
                raw: node
              });
            }
          }
        } else if (tag === 'UL' || tag === 'OL') {
          walk(node, group);
        } else if (tag === 'BUTTON' || tag === 'DIV' || tag === 'SPAN') {
          if (node.hasAttribute('data-value') || node.getAttribute('role') === 'option' || tag === 'BUTTON') {
            var item = buttonToItem(node);
            if (!group) flat.items.push(item);
            else group.items.push(item);
          }
        }
      });
    }

    walk(scope, null);
    if (flat.items.length) groups.unshift(flat);
    return groups.filter(function (g) { return g.items.length > 0; });
  }

  /**
   * Reads a JS structure. Accepted shapes:
   *   ['a', 'b']
   *   [{ value, label, description?, disabled?, selected?, group? }]
   *   [{ label: 'Group', options: [...] }]
   *   { groups: [{ label, options }] }
   *   { value, label, description, options: [...] }  (nested groups)
   */
  function readJsData(input, opts, depth) {
    depth = depth || 0;
    var groups = [];

    function makeOption(entry) {
      if (entry == null) return null;
      if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
        return { value: String(entry), label: String(entry) };
      }
      if (isElement(entry)) {
        return {
          value: entry.getAttribute('data-value') || entry.value || (entry.textContent || '').trim(),
          label: entry.getAttribute('data-label') || (entry.textContent || '').trim(),
          description: entry.getAttribute('data-description') || '',
          disabled: entry.disabled === true || entry.getAttribute('aria-disabled') === 'true',
          selected: entry.selected === true || entry.getAttribute('data-selected') === 'true',
          raw: entry
        };
      }
      if (typeof entry === 'object') {
        var value = entry.value != null ? entry.value : (entry.id != null ? entry.id : entry.label);
        return {
          value: String(value == null ? '' : value),
          label: String(entry.label != null ? entry.label : (entry.title != null ? entry.title : value)),
          description: entry.description != null ? entry.description : (entry.desc != null ? entry.desc : ''),
          disabled: !!entry.disabled,
          selected: !!entry.selected,
          raw: entry
        };
      }
      return null;
    }

    function isGroupEntry(entry) {
      if (!isPlainObject(entry)) return false;
      var list = entry.options || entry.items || entry.children;
      return Array.isArray(list) && list.some(function (child) { return isGroupEntry(child); });
    }

    function pushGroup(label, items, collapsed) {
      groups.push({
        key: 'grp-' + groups.length,
        label: label == null ? null : String(label),
        items: items,
        collapsed: !!collapsed
      });
    }

    function readGroupLike(source, inheritedLabel) {
      if (!source) return;
      var label = source.label != null ? source.label : (source.title != null ? source.title : inheritedLabel);
      var options = source.options || source.items || source.children || source.values;
      if (options && Array.isArray(options)) {
        var nested = [];
        var plain = [];
        options.forEach(function (entry) {
          if (isGroupEntry(entry)) nested.push(entry);
          else plain.push(entry);
        });
        var items = plain.map(makeOption).filter(Boolean);
        if (items.length) pushGroup(label, items, source.collapsed);
        nested.forEach(function (sub) { readGroupLike(sub, label); });
        return;
      }
      pushGroup(label, Array.isArray(source) ? source.map(makeOption).filter(Boolean) : []);
    }

    if (Array.isArray(input)) {
      var groupObjects = input.filter(function (entry) {
        return isPlainObject(entry) && Array.isArray(entry.options || entry.items || entry.children);
      });
      var plainEntries = input.filter(function (entry) {
        return !(isPlainObject(entry) && Array.isArray(entry.options || entry.items || entry.children));
      });
      if (groupObjects.length) {
        if (plainEntries.length) {
          groups.push({
            key: 'grp-' + groups.length,
            label: null,
            items: plainEntries.map(makeOption).filter(Boolean)
          });
        }
        groupObjects.forEach(function (entry) { readGroupLike(entry); });
      } else {
        groups.push({
          key: 'grp-0',
          label: null,
          items: input.map(function (entry) {
            var item = makeOption(entry);
            if (item && isPlainObject(entry) && entry.group != null && opts.groups !== false) {
              item.group = String(entry.group);
            }
            return item;
          }).filter(Boolean)
        });
        if (opts.groups !== false) groups = regroupByField(groups);
      }
    } else if (isPlainObject(input)) {
      if (Array.isArray(input.groups)) {
        input.groups.forEach(function (group) {
          if (isPlainObject(group) && Array.isArray(group.options || group.items)) {
            readGroupLike(group);
          } else if (Array.isArray(group)) {
            groups.push({ key: 'grp-' + groups.length, label: null, items: group.map(makeOption).filter(Boolean) });
          }
        });
      } else {
        readGroupLike(input);
      }
    }

    if (depth > 4) return [];
    return groups.filter(function (g) { return g.items.length > 0; });
  }

  function regroupByField(groups) {
    var flat = [];
    groups.forEach(function (group) { flat = flat.concat(group.items); });
    if (!flat.some(function (item) { return item.group; })) return groups;
    var order = [];
    var map = Object.create(null);
    flat.forEach(function (item) {
      var key = item.group || '__ungrouped__';
      if (!map[key]) {
        map[key] = { key: 'field-' + order.length, label: item.group || null, items: [] };
        order.push(key);
      }
      map[key].items.push(item);
    });
    return order.map(function (key) { return map[key]; });
  }

  /** Detects and parses whatever the caller passed in `data`. */
  function normalizeData(data, opts) {
    if (typeof data === 'string') {
      var trimmed = data.trim();
      if (!trimmed) return [];
      if (trimmed.charAt(0) === '<') return readHtmlOptions(trimmed, opts);
      if (/^[\[{]/.test(trimmed)) {
        try {
          return readJsData(JSON.parse(trimmed), opts);
        } catch (err) {
          if (typeof console !== 'undefined') console.warn('[BSelect] Invalid JSON string was ignored.', err);
          return [];
        }
      }
      var template = document.getElementById(trimmed);
      if (template) {
        var html = template.tagName === 'TEMPLATE' ? template.innerHTML : template.outerHTML;
        return readHtmlOptions(html, opts);
      }
      return [];
    }
    if (Array.isArray(data)) return readJsData(data, opts);
    if (isPlainObject(data)) return readJsData(data, opts);
    return [];
  }

  /* ========================================================================
   * 4. The component
   * ===================================================================== */

  function BSelect(target, options) {
    if (!(this instanceof BSelect)) return new BSelect(target, options);
    if (!isElement(target)) {
      throw new Error('[BSelect] The first argument must be a DOM element.');
    }
    if (target.__bselect) target.__bselect.destroy();

    this.el = target;
    this.opts = assign({}, DEFAULTS, options || {});
    this.opts.texts = assign({}, TEXTS, this.opts.texts || {});
    this.disabled = !!this.opts.disabled;
    this._uid = uniqueId();
    this._open = false;
    this._term = '';
    this._page = 1;
    this._active = -1;
    this._items = [];
    this._groups = [];
    this._itemMap = Object.create(null);
    this._valueMap = Object.create(null);
    this._groupMap = Object.create(null);
    this._selectedIds = {};
    this._collapsed = {};
    this._visibleItems = [];
    this._rendered = [];
    this._matchCounts = Object.create(null);
    this._destroyed = false;
    this._pendingValues = null;
    this._loading = false;
    this._hiddenInputs = [];

    this.nativeSelect = target.tagName === 'SELECT' ? target : null;
    this.multiple = this.nativeSelect ? this.nativeSelect.multiple : !!this.opts.multiple;
    if (this.nativeSelect && this.nativeSelect.name && !this.opts.name) {
      this.opts.name = this.nativeSelect.name;
    }
    this.el.__bselect = this;
    BSelect._liveInstances += 1;
    injectStyles();

    this._willLoadAsync = !!(this.opts.asyncData || this.opts.dataUrl);
    if (this.opts.value != null) {
      var initial = Array.isArray(this.opts.value) ? this.opts.value : [this.opts.value];
      this._pendingValues = initial.map(function (value) { return String(value); });
    }

    this._initData();
    this._buildDom();
    this._bind();
    this._renderAll();
    this._syncNative(true);
    this._applyInitialSelection();
    if (this.opts.value != null) {
      this.setValues(this.opts.value, { reason: 'init', silent: true });
    }
    // async / remote data sources
    if (this._willLoadAsync) this._loadAsync();
  }

  BSelect._liveInstances = 0;
  BSelect.version = '1.0.0';
  BSelect.injectStyles = injectStyles;
  BSelect.removeStyles = function () {
    var style = document.getElementById(STYLE_ID);
    if (style && style.parentNode) style.parentNode.removeChild(style);
  };
  BSelect.defaults = DEFAULTS;
  BSelect.texts = TEXTS;

  /* ---------------------------------------------------------------- init */

  BSelect.prototype._initData = function () {
    var opts = this.opts;
    var groups = [];
    var initialValues = [];

    if (this.nativeSelect) {
      groups = readNodeOptions(this.nativeSelect, opts);
      toArray(this.nativeSelect.options).forEach(function (option) {
        if (option.selected) initialValues.push(String(option.value));
      });
      this.nativeSelect.setAttribute('data-bselect-hidden', '1');
      this.nativeSelect.style.display = 'none';
      this.nativeSelect.setAttribute('aria-hidden', 'true');
      if (this.nativeSelect.disabled) this.disabled = true;
    } else if (opts.data != null) {
      groups = normalizeData(opts.data, opts);
    }

    var pending = (this._pendingValues || []).slice();
    if (initialValues.length) pending = pending.concat(initialValues);
    this._pendingValues = pending.length ? pending : null;
    this._applyGroups(groups);
    this._rebuildMaps();
    if (opts.groupsCollapsed) {
      this._groups.forEach(function (group) {
        if (group.label != null) this._collapsed[group.key] = true;
      }, this);
    }
  };

  BSelect.prototype._applyGroups = function (groups) {
    var hideGroups = this.opts.groups === false;
    this._groups = groups.map(function (group, index) {
      var key = group.key || 'group-' + index;
      var label = hideGroups ? null : (group.label == null ? null : String(group.label));
      var items = group.items.map(function (item, i) {
        return {
          id: String(index) + '-' + i,
          value: item.value,
          label: item.label,
          description: item.description || '',
          disabled: !!item.disabled || !!group.disabled,
          selected: !!item.selected,
          groupKey: key,
          groupLabel: label,
          raw: item.raw
        };
      });
      return {
        key: key,
        label: label,
        items: items,
        collapsed: !!group.collapsed
      };
    }).filter(function (group) { return group.items.length > 0; });
  };

  BSelect.prototype._rebuildMaps = function () {
    var self = this;
    this._items = [];
    this._itemMap = Object.create(null);
    this._groupMap = Object.create(null);
    this._valueMap = Object.create(null);
    this._groups.forEach(function (group) {
      self._groupMap[group.key] = group;
      group.items.forEach(function (item) {
        self._items.push(item);
        self._itemMap[item.id] = item;
        if (!(item.value in self._valueMap)) self._valueMap[item.value] = item;
      });
    });
  };

  /* ----------------------------------------------------------------- dom */

  BSelect.prototype._buildDom = function () {
    var opts = this.opts;
    var texts = opts.texts;
    var uid = this._uid;
    var multiple = this.multiple;
    var nativeWrap = this.el.parentNode;

    // Hide the original element (select or empty placeholder div)
    if (!this.nativeSelect) {
      this._originalDisplay = this.el.style.display;
      this.el.style.display = 'none';
      this.el.setAttribute('data-bselect-hidden', '1');
    }

    var wrapper = document.createElement('div');
    wrapper.className = 'BSelect' + (multiple ? ' BSelect--multiple' : '') +
      (this.disabled ? ' BSelect--disabled' : '') +
      (opts.rtl === false ? ' BSelect--ltr' : '');
    wrapper.setAttribute('data-bselect-root', this._uid);
    wrapper.style.setProperty('--B-z', String(opts.zIndex));

    wrapper.innerHTML = [
      '<div class="BSelect__control" role="combobox" tabindex="0" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + uid + '-list" aria-label="' + escAttr(opts.ariaLabel || texts.placeholder) + '">',
      '  <span class="BSelect__value BSelect__value--placeholder">' + esc(texts.placeholder) + '</span>',
      '  <span class="BSelect__spinner" aria-hidden="true"></span>',
      '  <span class="BSelect__arrow" aria-hidden="true">',
      '    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>',
      '  </span>',
      '</div>',
      '<div class="BSelect__dropdown" id="' + uid + '-drop" hidden>',
      '  <div class="BSelect__header">',
      '    <div class="BSelect__searchWrap">',
      '      <input type="search" class="BSelect__search" id="' + uid + '-search" placeholder="' + escAttr(opts.searchPlaceholder || texts.searchPlaceholder) + '" autocomplete="off" aria-label="' + escAttr(texts.searchPlaceholder) + '" aria-controls="' + uid + '-list">',
      '      <svg class="BSelect__searchIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
      '    </div>',
      '    <div class="BSelect__toolbar" hidden>',
      '      <button type="button" class="BSelect__selectAll" role="checkbox" aria-checked="false">',
      '        <span class="BSelect__checkbox" aria-hidden="true"></span>',
      '        <span class="BSelect__selectAllText">' + esc(texts.selectAllText) + '</span>',
      '      </button>',
      '      <span class="BSelect__count" aria-live="polite"></span>',
      '    </div>',
      '  </div>',
      '  <div class="BSelect__list" id="' + uid + '-list" role="listbox" aria-multiselectable="' + (multiple ? 'true' : 'false') + '" aria-label="' + escAttr(opts.ariaLabel || texts.placeholder) + '"></div>',
      '  <div class="BSelect__empty" role="status" hidden></div>',
      '  <div class="BSelect__footer" hidden>',
      '    <span class="BSelect__pageInfo"></span>',
      '    <div class="BSelect__pages"></div>',
      '  </div>',
      '</div>',
      '<span class="BSelect__live" aria-live="polite"></span>'
    ].join('');

    // Insert the wrapper right after the original element
    this.el.parentNode.insertBefore(wrapper, this.el.nextSibling);

    this.wrapper = wrapper;
    this._controlEl = wrapper.querySelector('.BSelect__control');
    this._valueEl = wrapper.querySelector('.BSelect__value');
    this._dropdownEl = wrapper.querySelector('.BSelect__dropdown');
    this._headerEl = wrapper.querySelector('.BSelect__header');
    this._searchEl = wrapper.querySelector('.BSelect__search');
    this._searchWrap = wrapper.querySelector('.BSelect__searchWrap');
    this._toolbarEl = wrapper.querySelector('.BSelect__toolbar');
    this._selectAllEl = wrapper.querySelector('.BSelect__selectAll');
    this._selectAllTextEl = wrapper.querySelector('.BSelect__selectAllText');
    this._selectAllCheck = wrapper.querySelector('.BSelect__selectAll .BSelect__checkbox');
    this._countEl = wrapper.querySelector('.BSelect__count');
    this._listEl = wrapper.querySelector('.BSelect__list');
    this._emptyEl = wrapper.querySelector('.BSelect__empty');
    this._footerEl = wrapper.querySelector('.BSelect__footer');
    this._pagesEl = wrapper.querySelector('.BSelect__pages');
    this._pageInfoEl = wrapper.querySelector('.BSelect__pageInfo');
    this._liveEl = wrapper.querySelector('.BSelect__live');

    this._controlEl.setAttribute('aria-disabled', this.disabled ? 'true' : 'false');
    if (this.disabled) {
      this._controlEl.setAttribute('tabindex', '-1');
    }
    this._updateSearchVisibility();

    if (nativeWrap && this.nativeSelect) {
      var nativeHolder = document.createElement('div');
      nativeHolder.className = 'BSelect__nativeWrap';
      nativeWrap.insertBefore(nativeHolder, this.nativeSelect);
      nativeHolder.appendChild(this.nativeSelect);
      this._nativeHolder = nativeHolder;
      wrapper.parentNode.insertBefore(nativeHolder, wrapper);
    }
  };

  BSelect.prototype._updateSearchVisibility = function () {
    var showSearch = !!this.opts.searchable;
    var showToolbar = !!this.multiple;
    this._searchWrap.hidden = !showSearch;
    this._toolbarEl.hidden = !showToolbar;
    // hide the whole header when it would render as an empty band
    this._headerEl.hidden = !showSearch && !showToolbar;
    this._headerEl.classList.toggle('BSelect__header--empty', !showSearch && !showToolbar);
    if (!showSearch) {
      this._term = '';
      if (this._searchEl) this._searchEl.value = '';
    }
    this._listEl.setAttribute('aria-label', this.opts.ariaLabel || this.opts.texts.placeholder);
  };

  BSelect.prototype._bind = function () {
    var self = this;
    this._handlers = {
      controlClick: function (event) { self._onControlClick(event); },
      controlKey: function (event) { self._onKeyDown(event); },
      wrapperKey: function (event) {
        if ((event.key === 'Escape' || event.key === 'Esc') && self._open) {
          event.preventDefault();
          self.close(true);
        }
      },
      listClick: function (event) { self._onListClick(event); },
      headerClick: function (event) { self._onHeaderClick(event); },
      footerClick: function (event) { self._onFooterClick(event); },
      searchInput: function () { self._onSearchInput(); },
      chipClick: function (event) { self._onChipClick(event); },
      docDown: function (event) { self._onDocPointerDown(event); },
      winResize: debounce(function () { if (self._open) self._position(); }, 80),
      winScroll: function () {
        if (!self._open) return;
        if (self._scrollFrame) return;
        var raf = typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame
          : function (fn) { return setTimeout(fn, 16); };
        self._scrollFrame = raf(function () {
          self._scrollFrame = 0;
          if (self._open) self._position();
        });
      },
      focusIn: function () { self.wrapper.classList.add('BSelect--focused'); },
      focusOut: function (event) {
        if (!self.wrapper.contains(event.relatedTarget)) self.wrapper.classList.remove('BSelect--focused');
      }
    };
    this._controlEl.addEventListener('click', this._handlers.controlClick);
    this._controlEl.addEventListener('keydown', this._handlers.controlKey);
    this._searchEl.addEventListener('keydown', this._handlers.controlKey);
    this._searchEl.addEventListener('input', this._handlers.searchInput);
    this._listEl.addEventListener('click', this._handlers.listClick);
    this._headerEl.addEventListener('click', this._handlers.headerClick);
    this._footerEl.addEventListener('click', this._handlers.footerClick);
    this.wrapper.addEventListener('click', this._handlers.chipClick);
    this.wrapper.addEventListener('focusin', this._handlers.focusIn);
    this.wrapper.addEventListener('focusout', this._handlers.focusOut);
    this.wrapper.addEventListener('keydown', this._handlers.wrapperKey);
    document.addEventListener('mousedown', this._handlers.docDown);
    document.addEventListener('touchstart', this._handlers.docDown, { passive: true });
    window.addEventListener('resize', this._handlers.winResize);
    window.addEventListener('scroll', this._handlers.winScroll, true);
  };

  BSelect.prototype._unbind = function () {
    if (!this._handlers || !this.wrapper) return;
    this._controlEl.removeEventListener('click', this._handlers.controlClick);
    this._controlEl.removeEventListener('keydown', this._handlers.controlKey);
    this._searchEl.removeEventListener('keydown', this._handlers.controlKey);
    this._searchEl.removeEventListener('input', this._handlers.searchInput);
    this._listEl.removeEventListener('click', this._handlers.listClick);
    this._headerEl.removeEventListener('click', this._handlers.headerClick);
    this._footerEl.removeEventListener('click', this._handlers.footerClick);
    this.wrapper.removeEventListener('click', this._handlers.chipClick);
    this.wrapper.removeEventListener('focusin', this._handlers.focusIn);
    this.wrapper.removeEventListener('focusout', this._handlers.focusOut);
    this.wrapper.removeEventListener('keydown', this._handlers.wrapperKey);
    document.removeEventListener('mousedown', this._handlers.docDown);
    document.removeEventListener('touchstart', this._handlers.docDown);
    window.removeEventListener('resize', this._handlers.winResize);
    window.removeEventListener('scroll', this._handlers.winScroll, true);
  };

  /* -------------------------------------------------------------- events */

  BSelect.prototype._onControlClick = function (event) {
    if (this.disabled) return;
    var chipX = closest(event.target, '.BSelect__chipX');
    if (chipX) {
      event.stopPropagation();
      var id = chipX.getAttribute('data-id');
      var item = this._itemMap[id];
      if (item) this._removeItem(item, 'chip');
      return;
    }
    if (this._open) this.close(true);
    else this.open();
  };

  BSelect.prototype._onChipClick = function (event) {
    var chipX = closest(event.target, '.BSelect__chipX');
    if (!chipX) return;
    event.preventDefault();
    var item = this._itemMap[chipX.getAttribute('data-id')];
    if (item) this._removeItem(item, 'chip');
  };

  BSelect.prototype._onSearchInput = function () {
    this._term = this._searchEl.value;
    this._page = 1;
    this._renderList({ resetScroll: true });
    this._setActive(this._firstEnabled());
    this._emit('search', {
      term: this._term,
      count: this._visibleItems.length,
      matched: this._visibleItems.length
    });
  };

  BSelect.prototype._onListClick = function (event) {
    var head = closest(event.target, '.BSelect__groupHead');
    if (head) {
      event.preventDefault();
      var groupKey = head.getAttribute('data-group-key');
      if (closest(event.target, '[data-group-check]')) {
        this._toggleGroupSelection(groupKey);
      } else if (closest(event.target, '[data-group-toggle]')) {
        this._toggleGroupCollapse(groupKey);
      }
      return;
    }
    var optionEl = closest(event.target, '.BSelect__option');
    if (!optionEl) return;
    event.preventDefault();
    var item = this._itemMap[optionEl.getAttribute('data-id')];
    if (!item) return;
    this._selectFromUser(item);
  };

  BSelect.prototype._onHeaderClick = function (event) {
    var selectAll = closest(event.target, '.BSelect__selectAll');
    if (selectAll) {
      event.preventDefault();
      this._toggleSelectAll();
    }
  };

  BSelect.prototype._onFooterClick = function (event) {
    var button = closest(event.target, '.BSelect__pageBtn, .BSelect__nav');
    if (!button || button.disabled) return;
    event.preventDefault();
    var page = button.getAttribute('data-page');
    if (page === 'prev') this._page = Math.max(1, this._page - 1);
    else if (page === 'next') this._page = Math.min(this._pageCount(), this._page + 1);
    else this._page = Math.max(1, parseInt(page, 10) || 1);
    this._renderList({ resetScroll: true });
    this._emit('pagechange', {
      page: this._page,
      pages: this._pageCount(),
      pageSize: this._pageSize(),
      total: this._visibleItems.length
    });
  };

  BSelect.prototype._onDocPointerDown = function (event) {
    if (!this._open) return;
    if (!this.wrapper.contains(event.target)) this.close();
  };

  BSelect.prototype._onKeyDown = function (event) {
    if (this.disabled) return;
    var target = event.target;
    var isSearch = target === this._searchEl;
    var key = event.key;
    var isControl = target === this._controlEl;

    if (!this._open) {
      var opensOn = key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ' || key === 'Spacebar';
      if (isControl && opensOn) {
        event.preventDefault();
        this.open();
        return;
      }
      if (isControl && this.opts.searchable && key && key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        this.open();
        if (this._searchEl) {
          this._searchEl.value = key;
          this._onSearchInput();
        }
      }
      return;
    }

    if (key === 'Escape' || key === 'Esc') {
      event.preventDefault();
      this.close(true);
      return;
    }
    if (key === 'ArrowDown') {
      event.preventDefault();
      this._moveActive(1);
      return;
    }
    if (key === 'ArrowUp') {
      event.preventDefault();
      this._moveActive(-1);
      return;
    }
    if (key === 'Home' && !isSearch) {
      event.preventDefault();
      this._setActive(this._firstEnabled());
      return;
    }
    if (key === 'End' && !isSearch) {
      event.preventDefault();
      this._setActive(this._lastEnabled());
      return;
    }
    if (key === 'Enter' && (isSearch || isControl)) {
      event.preventDefault();
      this._selectActive();
      return;
    }
    if ((key === ' ' || key === 'Spacebar') && isControl) {
      event.preventDefault();
      this._selectActive();
      return;
    }
    if (key === 'Tab') {
      this.close();
      return;
    }
    if (key === 'Backspace' && isControl && this.multiple) {
      var selected = this._selectedItems();
      if (selected.length) {
        event.preventDefault();
        this._removeItem(selected[selected.length - 1], 'backspace');
      }
    }
  };

  /* ------------------------------------------------------------- helpers */

  BSelect.prototype._pageSize = function () {
    return Math.max(1, parseInt(this.opts.pageSize, 10) || 10);
  };

  BSelect.prototype._pageCount = function () {
    if (!this.opts.pagination) return 1;
    var total = (this._visibleItems || []).length;
    return Math.max(1, Math.ceil(total / this._pageSize()));
  };

  BSelect.prototype._selectedItems = function () {
    var self = this;
    return this._items.filter(function (item) {
      return !!self._selectedIds[item.id];
    });
  };

  BSelect.prototype._itemByValue = function (value) {
    var key = String(value);
    return this._valueMap[key] || null;
  };

  BSelect.prototype._publicItem = function (item) {
    if (!item) return null;
    return {
      value: item.value,
      label: item.label,
      description: item.description,
      disabled: item.disabled,
      group: item.groupLabel,
      data: item.raw
    };
  };

  BSelect.prototype._payload = function (reason, focusItem) {
    var self = this;
    var items = this._selectedItems().map(function (item) { return self._publicItem(item); });
    var values = items.map(function (item) { return item.value; });
    return {
      multiple: this.multiple,
      values: values.slice(),
      value: this.multiple ? values.slice() : (values.length ? values[0] : null),
      item: focusItem ? this._publicItem(focusItem) : (this.multiple ? null : (items[0] || null)),
      items: items,
      reason: reason || ''
    };
  };

  BSelect.prototype._emit = function (type, detail) {
    var callback = this.opts[EVENT_CALLBACKS[type] || ('on' + type.charAt(0).toUpperCase() + type.slice(1))];
    if (typeof callback === 'function') {
      try {
        callback.call(this, detail, this);
      } catch (error) {
        console.error('[BSelect] callback error for "' + type + '"', error);
      }
    }
    [this.wrapper, this.el].forEach(function (target) {
      if (!target) return;
      var event;
      try {
        event = new CustomEvent('bselect:' + type, { bubbles: true, cancelable: true, detail: detail });
      } catch (err) {
        event = document.createEvent('CustomEvent');
        event.initCustomEvent('bselect:' + type, true, true, detail);
      }
      target.dispatchEvent(event);
    });
  };

  BSelect.prototype._emitChange = function (reason) {
    this._emit('change', this._payload(reason));
  };

  BSelect.prototype._shake = function () {
    var self = this;
    this.wrapper.classList.remove('BSelect--shake');
    void this.wrapper.offsetWidth;
    this.wrapper.classList.add('BSelect--shake');
    clearTimeout(this._shakeTimer);
    this._shakeTimer = setTimeout(function () {
      self.wrapper.classList.remove('BSelect--shake');
    }, 400);
  };

  /* -------------------------------------------------------------- render */

  BSelect.prototype._renderAll = function () {
    if (this._destroyed) return;
    this.wrapper.classList.toggle('BSelect--multiple', this.multiple);
    this.wrapper.classList.toggle('BSelect--disabled', this.disabled);
    this.wrapper.classList.toggle('BSelect--ltr', this.opts.rtl === false);
    this._controlEl.setAttribute('aria-disabled', this.disabled ? 'true' : 'false');
    this._controlEl.setAttribute('tabindex', this.disabled ? '-1' : '0');
    if (this.disabled && this._open) this.close();
    this._listEl.setAttribute('aria-multiselectable', this.multiple ? 'true' : 'false');
    this._updateSearchVisibility();
    this._renderControl();
    this._renderList();
  };

  BSelect.prototype._renderControl = function () {
    var selected = this._selectedItems();
    var control = this._controlEl;
    var chipsNodes = control.querySelectorAll('.BSelect__chips');
    for (var c = chipsNodes.length - 1; c >= 0; c--) {
      if (chipsNodes[c].parentNode) chipsNodes[c].parentNode.removeChild(chipsNodes[c]);
    }

    if (this.multiple) {
      var valueSpan = this._valueEl;
      valueSpan.classList.remove('BSelect__value--placeholder');
      if (!selected.length) {
        valueSpan.classList.add('BSelect__value--placeholder');
        valueSpan.textContent = this.opts.placeholder || this.opts.texts.placeholder;
        return;
      }
      valueSpan.textContent = '';
      var chips = document.createElement('span');
      chips.className = 'BSelect__chips';
      var max = 3;
      var self = this;
      selected.slice(0, max).forEach(function (item) {
        var chip = document.createElement('span');
        chip.className = 'BSelect__chip';
        chip.innerHTML = '<span class="BSelect__chipText" title="' + escAttr(item.label) + '">' + esc(item.label) +
          '</span><button type="button" class="BSelect__chipX" data-id="' + escAttr(item.id) + '" aria-label="' +
          escAttr(self.opts.texts.removeText + ' ' + item.label) + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">' +
          '<line x1="5" y1="5" x2="19" y2="19"></line><line x1="19" y1="5" x2="5" y2="19"></line></svg></button>';
        chips.appendChild(chip);
      });
      if (selected.length > max) {
        var more = document.createElement('span');
        more.className = 'BSelect__chipMore';
        more.textContent = '+' + (selected.length - max);
        chips.appendChild(more);
      }
      valueSpan.appendChild(chips);
      control.insertBefore(valueSpan, control.firstChild);
      return;
    }

    var item = selected[0];
    if (item) {
      this._valueEl.classList.remove('BSelect__value--placeholder');
      this._valueEl.textContent = item.label;
      this._valueEl.setAttribute('title', item.label);
    } else {
      this._valueEl.classList.add('BSelect__value--placeholder');
      this._valueEl.textContent = this.opts.placeholder || this.opts.texts.placeholder;
      this._valueEl.removeAttribute('title');
    }
  };

  BSelect.prototype._applyFilter = function () {
    var term = norm(this._term);
    var self = this;
    var visible = [];
    var matches = Object.create(null);
    var collapsedKeys = [];

    this._groups.forEach(function (group) {
      // A collapsed group keeps its header (and its badge / group action) but
      // contributes no navigable items to the visible list.
      var isCollapsed = !!self._collapsed[group.key] && !term;
      if (isCollapsed) collapsedKeys.push(group.key);
      var groupMatches = matches[group.key] = [];
      group.items.forEach(function (item) {
        if (!isCollapsed) {
          var haystack = norm(item.label + ' ' + item.value + ' ' + item.description + ' ' + (item.groupLabel || ''));
          if (term && haystack.indexOf(term) === -1) return;
          visible.push(item);
        }
        // collapsed groups keep their full item list so the header badge and the
        // "select whole group" action stay correct while the group is closed.
        groupMatches.push(item);
      });
    });

    this._visibleItems = visible;
    this._matchCounts = matches;
    this._collapsedKeys = collapsedKeys;
  };

  BSelect.prototype._groupHeadHtml = function (group) {
    var matched = this._matchCounts[group.key] || [];
    var allItems = group.items;
    var self = this;
    var selectable = 0;
    var selected = 0;
    matched.forEach(function (item) {
      if (item.disabled) return;
      selectable += 1;
      if (self._selectedIds[item.id]) selected += 1;
    });
    var collapsible = !!this.opts.groupCollapsible;
    var collapsed = !!this._collapsed[group.key] && !norm(this._term);
    var allSelected = selectable > 0 && selected === selectable;
    var textCount = matched.length !== allItems.length
      ? matched.length + '/' + allItems.length
      : String(allItems.length);
    var texts = this.opts.texts;
    var canGroupSelect = this.multiple && this.opts.groupSelectable !== false && selectable > 0;

    var toggleTag = collapsible ? 'button' : 'div';
    var toggleAttrs = collapsible
      ? ' type="button" class="BSelect__groupToggle" data-group-toggle="1"' +
        ' aria-expanded="' + (collapsed ? 'false' : 'true') + '"' +
        ' aria-label="' + escAttr((group.label || this.opts.texts.selectAllText) + ' — ' + texts.groupToggleText) + '"'
      : ' class="BSelect__groupToggle"';

    var html = '<div class="BSelect__groupHead' + (collapsible ? '' : ' BSelect__groupHead--static') +
      '" data-group-key="' + escAttr(group.key) + '">';
    html += '<' + toggleTag + toggleAttrs + '>';
    if (collapsible) {
      html += '<span class="BSelect__groupCaret" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span>';
    }
    html += '<span class="BSelect__groupTitle">' + esc(group.label) + '</span>';
    html += '<span class="BSelect__groupBadge">' + textCount + '</span>';
    html += '</' + toggleTag + '>';
    if (canGroupSelect) {
      html += '<button type="button" class="BSelect__groupAction" data-group-check="1" aria-pressed="' +
        (allSelected ? 'true' : 'false') + '">' +
        esc(allSelected ? (this.opts.groupClearText || texts.groupClearText)
          : (this.opts.groupSelectText || texts.groupSelectText)) +
        '</button>';
    }
    html += '</div>';
    return html;
  };

  BSelect.prototype._optionHtml = function (item) {
    var selected = !!this._selectedIds[item.id];
    var term = this.opts.searchable ? this._term : '';
    var label = term ? highlight(item.label, term) : esc(item.label);
    var cls = 'BSelect__option' +
      (selected ? ' BSelect__option--selected' : '') +
      (item.disabled ? ' BSelect__option--disabled' : '');
    var html = '<div class="' + cls + '" role="option" id="' + this._uid + '-opt-' + escAttr(item.id) +
      '" data-id="' + escAttr(item.id) + '" aria-selected="' + (selected ? 'true' : 'false') + '"' +
      (item.disabled ? ' aria-disabled="true"' : '') + '>';
    if (this.multiple) {
      html += '<span class="BSelect__checkbox' + (selected ? ' BSelect__checkbox--checked' : '') + '" aria-hidden="true"></span>';
    }
    html += '<span class="BSelect__optionText">';
    html += '<span class="BSelect__label">' + label + '</span>';
    if (item.description) html += '<span class="BSelect__desc">' + esc(item.description) + '</span>';
    html += '</span>';
    if (!this.multiple) {
      html += '<span class="BSelect__tick" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>';
    }
    html += '</div>';
    return html;
  };

  BSelect.prototype._renderList = function (options) {
    if (this._destroyed) return;
    options = options || {};
    var prevActiveItem = this._active >= 0 ? this._rendered[this._active] : null;

    this._applyFilter();
    var items = this._visibleItems;
    var total = items.length;
    var pagination = !!this.opts.pagination;
    var pageSize = pagination ? this._pageSize() : Math.max(1, total);
    var pages = pagination ? Math.max(1, Math.ceil(total / pageSize)) : 1;
    if (this._page > pages) this._page = pages;
    if (this._page < 1) this._page = 1;
    var start = (this._page - 1) * pageSize;
    var slice = items.slice(start, start + pageSize);
    this._rendered = slice;

    var html = '';
    var term = norm(this._term);
    var self = this;
    var pageEnd = start + slice.length;
    var cursor = 0;
    var collapsedCount = 0;

    // Walk the groups in their original order so a collapsed group renders its
    // header (instead of disappearing), while its options are hidden.
    this._groups.forEach(function (group) {
      var isCollapsed = !!self._collapsed[group.key] && !term;
      var groupItems = isCollapsed ? [] : (self._matchCounts[group.key] || []);
      var groupStart = cursor;
      var groupEnd = cursor + groupItems.length;
      cursor = groupEnd;

      var run = [];
      if (isCollapsed) {
        if (!group.items.length) return;
        collapsedCount += 1;
      } else {
        var from = Math.max(start, groupStart);
        var to = Math.min(pageEnd, groupEnd);
        if (from >= to) return;
        run = groupItems.slice(from - groupStart, to - groupStart);
      }

      var runHtml = '';
      for (var r = 0; r < run.length; r++) runHtml += self._optionHtml(run[r]);
      var hasGlobalGroup = group.label != null && self.opts.groups !== false;
      if (hasGlobalGroup) {
        html += '<div class="BSelect__group" data-group-key="' + escAttr(group.key) + '">' +
          self._groupHeadHtml(group) +
          '<div class="BSelect__groupBody">' + runHtml + '</div></div>';
      } else {
        html += runHtml;
      }
    });

    this._listEl.innerHTML = html;
    var hasContent = total > 0 || collapsedCount > 0;
    this._emptyEl.hidden = hasContent;
    if (!hasContent) {
      this._emptyEl.textContent = this._items.length ? this.opts.noResultsText || this.opts.texts.noResultsText
        : this.opts.emptyText || this.opts.texts.emptyText;
    }
    this._footerEl.hidden = !pagination || total === 0;
    if (pagination) this._updatePagination(total, start, slice.length, pages);
    this._updateHeader();

    // restore active option when possible
    this._active = -1;
    this._clearActiveDom();
    if (prevActiveItem) {
      for (var a = 0; a < slice.length; a++) {
        if (slice[a].id === prevActiveItem.id) {
          this._setActive(a, true);
          break;
        }
      }
    }
    if (options.resetScroll) this._listEl.scrollTop = 0;
  };

  BSelect.prototype._updatePagination = function (total, start, count, pages) {
    this._pageInfoEl.textContent = total
      ? fmt(this.opts.pageInfoText || this.opts.texts.pageInfoText, {
        from: start + 1,
        to: start + count,
        total: total,
        pages: pages,
        page: this._page
      })
      : '';
    this._pagesEl.innerHTML = this._pageButtonsHtml(pages);
    var prev = this._prevButton();
    var next = this._nextButton();
    if (prev) prev.disabled = this._page <= 1;
    if (next) next.disabled = this._page >= pages;
  };

  BSelect.prototype._prevButton = function () {
    return this._footerEl.querySelector('.BSelect__nav[data-page="prev"]');
  };

  BSelect.prototype._nextButton = function () {
    return this._footerEl.querySelector('.BSelect__nav[data-page="next"]');
  };

  BSelect.prototype._pageButtonsHtml = function (pages) {
    var self = this;
    var out = [];
    function button(page) {
      var active = page === self._page;
      out.push('<button type="button" class="BSelect__pageBtn' + (active ? ' BSelect__pageBtn--active' : '') +
        '" data-page="' + page + '"' + (active ? ' aria-current="page"' : '') +
        ' aria-label="' + escAttr('صفحه ' + page) + '">' + page + '</button>');
    }
    out.push('<button type="button" class="BSelect__nav" data-page="prev" aria-label="' +
      escAttr('صفحه قبل') + '">‹</button>');
    if (pages <= 7) {
      for (var i = 1; i <= pages; i++) button(i);
    } else {
      button(1);
      if (this._page > 4) out.push('<span class="BSelect__pageDots">…</span>');
      var from = Math.max(2, this._page - 1);
      var to = Math.min(pages - 1, this._page + 1);
      for (var p = from; p <= to; p++) button(p);
      if (this._page < pages - 3) out.push('<span class="BSelect__pageDots">…</span>');
      button(pages);
    }
    out.push('<button type="button" class="BSelect__nav" data-page="next" aria-label="' +
      escAttr('صفحه بعد') + '">›</button>');
    return out.join('');
  };

  BSelect.prototype._updateHeader = function () {
    if (!this.multiple) {
      this._toolbarEl.hidden = true;
      return;
    }
    this._toolbarEl.hidden = false;
    var matched = (this._visibleItems || []).filter(function (item) { return !item.disabled; });
    var self = this;
    var selected = matched.filter(function (item) { return !!self._selectedIds[item.id]; });
    var allSelected = matched.length > 0 && selected.length === matched.length;
    var someSelected = selected.length > 0 && !allSelected;
    this._selectAllCheck.className = 'BSelect__checkbox' +
      (allSelected ? ' BSelect__checkbox--checked' : someSelected ? ' BSelect__checkbox--indeterminate' : '');
    this._selectAllEl.setAttribute('aria-checked', allSelected ? 'true' : someSelected ? 'mixed' : 'false');
    this._selectAllTextEl.textContent = allSelected ? this.opts.clearAllText || this.opts.texts.clearAllText
      : this.opts.selectAllText || this.opts.texts.selectAllText;

    var totalSelected = this._selectedItems().length;
    this._countEl.textContent = totalSelected
      ? fmt(this.opts.selectedCountText || this.opts.texts.selectedCountText, { n: totalSelected })
      : (this._items.length ? fmt(this.opts.totalCountText || this.opts.texts.totalCountText, { n: this._items.length }) : '');
  };

  BSelect.prototype._clearActiveDom = function () {
    var active = this._listEl.querySelectorAll('.BSelect__option--active');
    for (var i = 0; i < active.length; i++) active[i].classList.remove('BSelect__option--active');
    this._controlEl.removeAttribute('aria-activedescendant');
    if (this._searchEl) this._searchEl.removeAttribute('aria-activedescendant');
  };

  BSelect.prototype._setActive = function (index, silent) {
    var items = this._rendered;
    if (!items.length) {
      this._active = -1;
      this._clearActiveDom();
      return;
    }
    if (index < 0) index = 0;
    if (index > items.length - 1) index = items.length - 1;
    this._active = index;
    var item = items[index];
    var optionEl = document.getElementById(this._uid + '-opt-' + item.id);
    this._clearActiveDom();
    if (!optionEl) return;
    optionEl.classList.add('BSelect__option--active');
    if (!silent) {
      if (optionEl.scrollIntoView) {
        try {
          optionEl.scrollIntoView({ block: 'nearest' });
        } catch (err) {
          optionEl.scrollIntoView(false);
        }
      }
    }
    this._controlEl.setAttribute('aria-activedescendant', optionEl.id);
    if (this._searchEl) this._searchEl.setAttribute('aria-activedescendant', optionEl.id);
  };

  BSelect.prototype._firstEnabled = function () {
    for (var i = 0; i < this._rendered.length; i++) {
      if (!this._rendered[i].disabled) return i;
    }
    return -1;
  };

  BSelect.prototype._lastEnabled = function () {
    for (var i = this._rendered.length - 1; i >= 0; i--) {
      if (!this._rendered[i].disabled) return i;
    }
    return -1;
  };

  BSelect.prototype._moveActive = function (direction) {
    var enabled = [];
    for (var i = 0; i < this._rendered.length; i++) {
      if (!this._rendered[i].disabled) enabled.push(i);
    }
    if (!enabled.length) return;
    var target = null;
    if (direction > 0) {
      for (var a = 0; a < enabled.length; a++) {
        if (enabled[a] > this._active) { target = enabled[a]; break; }
      }
      if (target == null) {
        if (this.opts.pagination && this._page < this._pageCount()) {
          this._goToPage(this._page + 1, 'first');
        }
        return;
      }
    } else {
      for (var b = enabled.length - 1; b >= 0; b--) {
        if (enabled[b] < this._active) { target = enabled[b]; break; }
      }
      if (target == null) {
        if (this.opts.pagination && this._page > 1) {
          this._goToPage(this._page - 1, 'last');
        }
        return;
      }
    }
    this._setActive(target);
  };

  BSelect.prototype._goToPage = function (page, where) {
    this._page = page;
    this._renderList();
    var index = where === 'last' ? this._lastEnabled() : this._firstEnabled();
    if (index >= 0) this._setActive(index);
    this._emit('pagechange', {
      page: this._page,
      pages: this._pageCount(),
      pageSize: this._pageSize(),
      total: this._visibleItems.length
    });
  };

  /* ------------------------------------------------------------ selection */

  BSelect.prototype._selectActive = function () {
    var item = this._rendered[this._active];
    if (!item) {
      var first = this._firstEnabled();
      item = first >= 0 ? this._rendered[first] : null;
    }
    if (item && !item.disabled) this._selectFromUser(item);
  };

  BSelect.prototype._selectFromUser = function (item) {
    if (item.disabled) return;
    if (this.multiple) {
      var changed = this._selectedIds[item.id]
        ? this._removeItem(item, 'deselect')
        : this._addItem(item, 'select');
      if (changed && this.opts.closeOnSelect === true) this.close(true);
      return;
    }
    var previous = this._selectedItems()[0];
    if (previous && previous.id === item.id) {
      this.close(true);
      return;
    }
    if (previous) delete this._selectedIds[previous.id];
    this._selectedIds[item.id] = true;
    this._commit('select', {
      added: [item],
      removed: previous ? [previous] : []
    });
    var closeOnSelect = this.opts.closeOnSelect == null ? true : !!this.opts.closeOnSelect;
    if (closeOnSelect) this.close(true);
  };

  BSelect.prototype._addItem = function (item, reason) {
    if (this._selectedIds[item.id]) return false;
    if (this.multiple) {
      var max = parseInt(this.opts.maxSelected, 10) || 0;
      if (max > 0) {
        var selectedCount = this._selectedItems().length;
        if (selectedCount >= max) {
          this._shake();
          this._emit('maxselected', {
            max: max,
            count: selectedCount,
            item: this._publicItem(item),
            values: this.getValues()
          });
          return false;
        }
      }
      this._selectedIds[item.id] = true;
      this._commit(reason || 'select', { added: [item] });
      return true;
    }
    var previous = this._selectedItems()[0];
    if (previous) delete this._selectedIds[previous.id];
    this._selectedIds[item.id] = true;
    this._commit(reason || 'select', { added: [item], removed: previous ? [previous] : [] });
    return true;
  };

  BSelect.prototype._removeItem = function (item, reason) {
    if (!this._selectedIds[item.id]) return false;
    delete this._selectedIds[item.id];
    this._commit(reason || 'deselect', { removed: [item] });
    return true;
  };

  BSelect.prototype._commit = function (reason, options) {
    options = options || {};
    var added = options.added || [];
    var removed = options.removed || [];
    var self = this;
    this._syncNative();
    this._renderControl();
    this._renderList({ resetScroll: !!options.resetScroll });
    this._updateHeader();
    if (this._liveEl) {
      var payload = this._payload(reason);
      this._liveEl.textContent = payload.values.length
        ? fmt(this.opts.selectedCountText || this.opts.texts.selectedCountText, { n: payload.values.length })
        : '';
    }
    if (options.silent) return;
    added.forEach(function (item) {
      self._emit('select', self._payload(reason, item));
    });
    removed.forEach(function (item) {
      self._emit('deselect', self._payload(reason, item));
    });
    this._emitChange(reason);
  };

  BSelect.prototype._toggleSelectAll = function () {
    if (!this.multiple) return;
    var self = this;
    var selectable = (this._visibleItems || []).filter(function (item) { return !item.disabled; });
    if (!selectable.length) return;
    var allSelected = selectable.every(function (item) { return !!self._selectedIds[item.id]; });
    var added = [];
    var removed = [];
    if (allSelected) {
      selectable.forEach(function (item) {
        if (self._selectedIds[item.id]) {
          delete self._selectedIds[item.id];
          removed.push(item);
        }
      });
    } else {
      var max = parseInt(this.opts.maxSelected, 10) || 0;
      for (var i = 0; i < selectable.length; i++) {
        var item = selectable[i];
        if (self._selectedIds[item.id]) continue;
        if (max > 0 && self._selectedItems().length >= max) {
          self._emit('maxselected', {
            max: max,
            count: self._selectedItems().length,
            item: self._publicItem(item),
            values: self.getValues()
          });
          self._shake();
          break;
        }
        self._selectedIds[item.id] = true;
        added.push(item);
      }
    }
    if (!added.length && !removed.length) return;
    this._commit('selectAll', { added: added, removed: removed });
  };

  BSelect.prototype._toggleGroupSelection = function (groupKey) {
    if (!this.multiple) return;
    var self = this;
    var items = (this._matchCounts[groupKey] || []).filter(function (item) { return !item.disabled; });
    if (!items.length) return;
    var allSelected = items.every(function (item) { return !!self._selectedIds[item.id]; });
    var added = [];
    var removed = [];
    if (allSelected) {
      items.forEach(function (item) {
        if (self._selectedIds[item.id]) {
          delete self._selectedIds[item.id];
          removed.push(item);
        }
      });
    } else {
      var max = parseInt(this.opts.maxSelected, 10) || 0;
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (self._selectedIds[item.id]) continue;
        if (max > 0 && self._selectedItems().length >= max) {
          self._emit('maxselected', {
            max: max,
            count: self._selectedItems().length,
            item: self._publicItem(item),
            values: self.getValues()
          });
          self._shake();
          break;
        }
        self._selectedIds[item.id] = true;
        added.push(item);
      }
    }
    if (!added.length && !removed.length) return;
    this._commit('selectGroup', { added: added, removed: removed });
  };

  BSelect.prototype._toggleGroupCollapse = function (groupKey) {
    if (!this.opts.groupCollapsible) return;
    var group = this._groupMap[groupKey];
    if (!group) return;
    if (this._collapsed[groupKey]) delete this._collapsed[groupKey];
    else this._collapsed[groupKey] = true;
    this._renderList();
    this._emit('toggle', {
      type: 'group',
      group: { key: group.key, label: group.label },
      collapsed: !!this._collapsed[groupKey]
    });
  };

  BSelect.prototype._syncNative = function (silentEvent) {
    if (this._destroyed) return;
    var values = this.getValues();
    var i;
    if (this.nativeSelect) {
      var nativeOptions = this.nativeSelect.options;
      for (i = 0; i < nativeOptions.length; i++) {
        nativeOptions[i].selected = values.indexOf(nativeOptions[i].value) !== -1;
      }
      if (!silentEvent) {
        try {
          this.nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (err) {
          var legacy = document.createEvent('HTMLEvents');
          legacy.initEvent('change', true, false);
          this.nativeSelect.dispatchEvent(legacy);
        }
      }
    }
    // hidden inputs for non-select targets
    this._hiddenInputs.forEach(function (input) {
      if (input.parentNode) input.parentNode.removeChild(input);
    });
    this._hiddenInputs = [];
    if (!this.nativeSelect && this.opts.name && !this.disabled) {
      var self = this;
      values.forEach(function (value) {
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = self.opts.name;
        input.value = value;
        input.className = 'BSelect__native';
        self.wrapper.appendChild(input);
        self._hiddenInputs.push(input);
      });
    }
  };

  /* --------------------------------------------------------------- public */

  BSelect.prototype.open = function () {
    if (this._open || this.disabled || this._destroyed) return this;
    this._open = true;
    OPEN_INSTANCES.forEach(function (instance) {
      if (instance !== this) instance.close();
    }, this);
    this._dropdownEl.hidden = false;
    this.wrapper.classList.add('BSelect--open');
    this._controlEl.setAttribute('aria-expanded', 'true');
    this._position();
    this._term = '';
    if (this._searchEl) this._searchEl.value = '';
    this._page = 1;
    this._renderList({ resetScroll: true });
    this._emit('open', { value: this.getValue(), values: this.getValues() });
    if (this.opts.searchable) {
      var self = this;
      setTimeout(function () {
        if (self._open && self._searchEl) {
          self._searchEl.focus({ preventScroll: true });
        }
      }, 0);
    }
    if (OPEN_INSTANCES.indexOf(this) === -1) OPEN_INSTANCES.push(this);
    return this;
  };

  BSelect.prototype.close = function (returnFocus) {
    if (!this._open) return this;
    this._open = false;
    this._dropdownEl.hidden = true;
    this.wrapper.classList.remove('BSelect--open', 'BSelect--dropup');
    this._controlEl.setAttribute('aria-expanded', 'false');
    this._clearActiveDom();
    this._active = -1;
    this._term = '';
    if (this._searchEl) this._searchEl.value = '';
    var index = OPEN_INSTANCES.indexOf(this);
    if (index !== -1) OPEN_INSTANCES.splice(index, 1);
    if (returnFocus) {
      try {
        this._controlEl.focus({ preventScroll: true });
      } catch (err) {
        this._controlEl.focus();
      }
    }
    this._emit('close', { value: this.getValue(), values: this.getValues() });
    return this;
  };

  BSelect.prototype.toggle = function () {
    return this._open ? this.close(true) : this.open();
  };

  /**
   * Decides whether the list opens downwards or upwards and limits its height
   * to the space that is actually available, so it never gets clipped.
   */
  BSelect.prototype._position = function () {
    if (!this._controlEl || !this.wrapper) return;
    var rect = this._controlEl.getBoundingClientRect();
    var viewport = window.innerHeight || document.documentElement.clientHeight || 0;
    var gap = 12;
    var preferred = Math.min(360, Math.max(240, viewport * 0.62));
    var spaceBelow = viewport - rect.bottom - gap;
    var spaceAbove = rect.top - gap;
    var useUp = spaceBelow < preferred && spaceAbove > spaceBelow;
    var available = useUp ? spaceAbove : spaceBelow;
    // keep a usable list even when the viewport is short (the page can scroll)
    var height = Math.max(240, Math.min(preferred, available));
    this.wrapper.classList.toggle('BSelect--dropup', useUp);
    this._dropdownEl.style.maxHeight = height + 'px';
  };

  BSelect.prototype.getValue = function () {
    var values = this.getValues();
    return this.multiple ? values : (values.length ? values[0] : null);
  };

  BSelect.prototype.getValues = function () {
    var selected = this._selectedItems();
    return selected.map(function (item) { return item.value; });
  };

  BSelect.prototype.getSelectedItems = function () {
    var self = this;
    return this._selectedItems().map(function (item) { return self._publicItem(item); });
  };

  BSelect.prototype.getOptions = function () {
    var self = this;
    return this._items.map(function (item) { return self._publicItem(item); });
  };

  BSelect.prototype.isOpen = function () {
    return this._open;
  };

  BSelect.prototype.getDropdownElement = function () {
    return this._dropdownEl;
  };

  BSelect.prototype.setValues = function (values, options) {
    options = options || {};
    var list = values == null ? [] : (Array.isArray(values) ? values : [values]);
    var self = this;
    var wanted = list.map(function (value) { return String(value); });
    var current = this._selectedItems();
    var added = [];
    var removed = [];
    current.forEach(function (item) {
      if (wanted.indexOf(item.value) === -1) removed.push(item);
    });
    this._selectedIds = {};
    var max = this.multiple ? (parseInt(this.opts.maxSelected, 10) || 0) : 1;
    var selectedNow = 0;
    this._items.forEach(function (item) {
      if (item.disabled) return;
      if (wanted.indexOf(item.value) === -1) return;
      if (max > 0 && selectedNow >= max) return;
      self._selectedIds[item.id] = true;
      selectedNow += 1;
      var exists = current.some(function (entry) { return entry.id === item.id; });
      if (!exists) added.push(item);
    });
    if (!added.length && !removed.length) {
      this._renderControl();
      this._renderList();
      return this;
    }
    this._commit(options.reason || 'set', {
      added: added,
      removed: removed,
      silent: !!options.silent
    });
    return this;
  };

  BSelect.prototype.setValue = function (value, options) {
    return this.setValues(value, options);
  };

  BSelect.prototype.select = function (value) {
    var item = this._itemByValue(value);
    if (item) this._addItem(item, 'select');
    return this;
  };

  BSelect.prototype.deselect = function (value) {
    var item = this._itemByValue(value);
    if (item) this._removeItem(item, 'deselect');
    return this;
  };

  BSelect.prototype.toggleValue = function (value) {
    var item = this._itemByValue(value);
    if (!item) return this;
    if (this._selectedIds[item.id]) this._removeItem(item, 'deselect');
    else this._addItem(item, 'select');
    return this;
  };

  BSelect.prototype.clear = function (options) {
    options = options || {};
    if (!this._selectedItems().length) return this;
    var removed = this._selectedItems();
    this._selectedIds = {};
    this._commit('clear', { removed: removed, silent: !!options.silent });
    if (!options.silent) this._emit('clear', this._payload('clear'));
    return this;
  };

  BSelect.prototype.selectAll = function () {
    if (!this.multiple) return this;
    var self = this;
    var added = [];
    var max = parseInt(this.opts.maxSelected, 10) || 0;
    this._visibleItems.forEach(function (item) {
      if (item.disabled || self._selectedIds[item.id]) return;
      if (max > 0 && self._selectedItems().length >= max) return;
      self._selectedIds[item.id] = true;
      added.push(item);
    });
    if (added.length) this._commit('selectAll', { added: added });
    return this;
  };

  BSelect.prototype.setOption = function (name, value) {
    if (name === 'disabled') return this.setDisabled(value);
    if (name === 'multiple') return this.setMultiple(value);
    if (name === 'searchable') return this.setSearchable(value);
    if (name === 'texts') this.opts.texts = assign({}, this.opts.texts, value);
    else this.opts[name] = value;
    if (name === 'zIndex') this.wrapper.style.setProperty('--B-z', String(value));
    this._renderAll();
    return this;
  };

  BSelect.prototype.getOption = function (name) {
    return this.opts[name];
  };

  BSelect.prototype.setSearchable = function (enabled) {
    this.opts.searchable = !!enabled;
    if (!enabled && this._open) this.close();
    this._renderAll();
    return this;
  };

  BSelect.prototype.setMultiple = function (enabled) {
    var next = !!enabled;
    if (next === this.multiple) return this;
    var before = this.getValues();
    this.multiple = next;
    if (this.nativeSelect) this.nativeSelect.multiple = next;
    if (!next) {
      var selected = this._selectedItems();
      var keep = selected[0];
      this._selectedIds = {};
      if (keep) this._selectedIds[keep.id] = true;
    }
    this._renderAll();
    this._syncNative();
    if (before.join('\u0000') !== this.getValues().join('\u0000')) {
      this._emitChange('multiple');
    }
    return this;
  };

  BSelect.prototype.setDisabled = function (disabled) {
    this.disabled = !!disabled;
    this.opts.disabled = this.disabled;
    if (this.nativeSelect) this.nativeSelect.disabled = this.disabled;
    if (this.disabled) this.close();
    this._renderAll();
    this._syncNative(true);
    return this;
  };

  BSelect.prototype.enable = function () {
    return this.setDisabled(false);
  };

  BSelect.prototype.disable = function () {
    return this.setDisabled(true);
  };

  BSelect.prototype.focus = function () {
    if (!this.disabled) this._controlEl.focus();
    return this;
  };

  BSelect.prototype.setData = function (data, options) {
    options = options || {};
    var keepSelection = options.keepSelection !== false;
    var keepValues = keepSelection ? this.getValues() : [];
    var groups = normalizeData(data, this.opts);
    this._applyGroups(groups);
    this._rebuildMaps();
    this._groups.forEach(function (group) {
      if (group.collapsed) this._collapsed[group.key] = true;
    }, this);
    this._selectedIds = {};
    var self = this;
    var preserve = keepValues.concat(this._pendingValues || []);
    this._pendingValues = null;
    if (options.keepSelection !== false && preserve.length) {
      var max = this.multiple ? (parseInt(this.opts.maxSelected, 10) || 0) : 1;
      var selectedCount = 0;
      this._items.forEach(function (item) {
        if (item.disabled || preserve.indexOf(item.value) === -1) return;
        if (max > 0 && selectedCount >= max) return;
        self._selectedIds[item.id] = true;
        selectedCount += 1;
      });
    }
    this._term = '';
    if (this._searchEl) this._searchEl.value = '';
    this._page = 1;
    this._active = -1;
    this._renderAll();
    this._syncNative();
    if (!options.silent) {
      this._emit('load', {
        count: this._items.length,
        groups: this._groups.length,
        value: this.getValue(),
        values: this.getValues()
      });
      this._emitChange('data');
    }
    return this;
  };

  BSelect.prototype.addOptions = function (items, groupLabel) {
    var existing = this._groups.map(function (group) {
      return {
        key: group.key,
        label: group.label,
        items: group.items.map(function (item) {
          return {
            value: item.value,
            label: item.label,
            description: item.description,
            disabled: item.disabled
          };
        })
      };
    });
    var normalized = normalizeData(items, this.opts);
    var extra = [];
    normalized.forEach(function (group) {
      group.items.forEach(function (item) {
        extra.push({
          value: item.value,
          label: item.label,
          description: item.description,
          disabled: item.disabled,
          group: group.label || groupLabel
        });
      });
    });
    if (groupLabel && this._groups.some(function (group) { return group.label === groupLabel; })) {
      var target = existing.filter(function (group) { return group.label === groupLabel; })[0];
      extra.forEach(function (item) { target.items.push(item); });
    } else {
      existing = existing.concat(normalized.map(function (group) {
        return {
          key: 'added-' + group.key + '-' + Math.random().toString(36).slice(2, 6),
          label: group.label || groupLabel || null,
          items: group.items
        };
      }));
    }
    return this.setData({ groups: existing }, { keepSelection: true });
  };

  BSelect.prototype.removeOption = function (value) {
    var keep = this._selectedItems().filter(function (item) { return item.value !== String(value); });
    var remaining = this._items.filter(function (item) { return item.value !== String(value); });
    var self = this;
    var groups = this._groups.map(function (group) {
      return {
        key: group.key,
        label: group.label,
        items: group.items.filter(function (item) { return item.value !== String(value); })
          .map(function (item) {
            return { value: item.value, label: item.label, description: item.description, disabled: item.disabled };
          })
      };
    });
    this._applyGroups(groups);
    this._rebuildMaps();
    this._selectedIds = {};
    keep.forEach(function (item) {
      var match = self._itemByValue(item.value);
      if (match) self._selectedIds[match.id] = true;
    });
    void remaining;
    this._renderAll();
    this._syncNative();
    this._emitChange('remove');
    return this;
  };

  BSelect.prototype.refresh = function () {
    this._renderAll();
    return this;
  };

  /** Re-runs asyncData / dataUrl and replaces the options. */
  BSelect.prototype.reload = function () {
    if (!this.opts.asyncData && !this.opts.dataUrl) return this;
    if (this._searchEl) this._searchEl.value = '';
    this._term = '';
    this._loadAsync();
    return this;
  };

  BSelect.prototype._eventName = function (type) {
    return String(type).indexOf('bselect:') === 0 ? type : 'bselect:' + type;
  };

  /**
   * Subscribes to a component event. The handler receives the same payload as
   * the matching option callback: `handler(detail, instance, event)`.
   */
  BSelect.prototype.on = function (type, handler) {
    if (typeof handler !== 'function') return this;
    var name = this._eventName(type);
    this._listeners = this._listeners || [];
    for (var i = 0; i < this._listeners.length; i++) {
      var entry = this._listeners[i];
      if (entry.name === name && entry.handler === handler) return this;
    }
    var self = this;
    var wrapped = function (event) {
      handler.call(self, event.detail, self, event);
    };
    this._listeners.push({ name: name, handler: handler, wrapped: wrapped });
    this.wrapper.addEventListener(name, wrapped);
    return this;
  };

  BSelect.prototype.off = function (type, handler) {
    var name = this._eventName(type);
    this._listeners = this._listeners || [];
    for (var i = this._listeners.length - 1; i >= 0; i--) {
      var entry = this._listeners[i];
      if (entry.name !== name) continue;
      if (handler && entry.handler !== handler) continue;
      this.wrapper.removeEventListener(name, entry.wrapped);
      this._listeners.splice(i, 1);
    }
    return this;
  };

  BSelect.prototype._applyInitialSelection = function () {
    var keep = (this._pendingValues || []).slice();
    var self = this;
    var max = this.multiple ? (parseInt(this.opts.maxSelected, 10) || 0) : 1;
    var count = 0;
    this._items.forEach(function (item) {
      if (item.disabled) return;
      var wanted = item.selected || keep.indexOf(item.value) !== -1;
      if (!wanted) return;
      if (max > 0 && count >= max) return;
      self._selectedIds[item.id] = true;
      count += 1;
    });
    if (!this._willLoadAsync) this._pendingValues = null;
    this._renderControl();
    this._renderList();
    this._syncNative(true);
  };

  BSelect.prototype._loadAsync = function () {
    var self = this;
    this._loading = true;
    this.wrapper.classList.add('BSelect--loading');
    this._showStatus(this.opts.loadingText || this.opts.texts.loadingText);
    var done = function (data) {
      if (self._destroyed) return;
      self._loading = false;
      self.wrapper.classList.remove('BSelect--loading');
      self.setData(data, { keepSelection: true });
    };
    var fail = function (error) {
      if (self._destroyed) return;
      self._loading = false;
      self.wrapper.classList.remove('BSelect--loading');
      self._showStatus(self.opts.texts.emptyText);
      self._emit('error', { error: error });
      if (typeof console !== 'undefined') console.warn('[BSelect] data loading failed', error);
    };

    if (typeof this.opts.asyncData === 'function') {
      this.opts.asyncData(done, fail);
      return;
    }
    if (typeof fetch !== 'function') {
      fail(new Error('fetch is not available'));
      return;
    }
    var type = this.opts.dataType || 'json';
    fetch(this.opts.dataUrl, this.opts.fetchOptions || {})
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return type === 'html' ? response.text() : response.json();
      })
      .then(done)
      .catch(fail);
  };

  BSelect.prototype._showStatus = function (message) {
    if (!this._listEl) return;
    this._listEl.innerHTML = '';
    this._emptyEl.hidden = !message;
    this._emptyEl.textContent = message || '';
  };

  BSelect.prototype.destroy = function () {
    if (this._destroyed) return;
    clearTimeout(this._shakeTimer);
    this.close();
    this._unbind();
    if (this._nativeHolder && this.el.parentNode === this._nativeHolder) {
      this._nativeHolder.parentNode.insertBefore(this.el, this._nativeHolder);
      this._nativeHolder.parentNode.removeChild(this._nativeHolder);
    }
    if (this.nativeSelect) {
      this.el.style.display = '';
      this.el.removeAttribute('aria-hidden');
      this.el.removeAttribute('data-bselect-hidden');
    } else {
      this.el.style.display = this._originalDisplay || '';
      this.el.removeAttribute('data-bselect-hidden');
    }
    if (this.wrapper && this.wrapper.parentNode) this.wrapper.parentNode.removeChild(this.wrapper);
    delete this.el.__bselect;
    this._destroyed = true;
    BSelect._liveInstances = Math.max(0, BSelect._liveInstances - 1);
    removeStylesIfUnused();
    var index = OPEN_INSTANCES.indexOf(this);
    if (index !== -1) OPEN_INSTANCES.splice(index, 1);
  };

  BSelect.create = function (target, options) {
    return new BSelect(target, options);
  };

  return BSelect;
});
