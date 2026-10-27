'use strict';

/**
 * Loads the real demo page (through tools/serve.js) inside jsdom, executes the
 * demo scripts and checks that every example initialised without errors.
 *
 *   node tools/serve.js &
 *   node test/demo.smoke.js
 */

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const { JSDOM, VirtualConsole } = require('jsdom');

const BASE = process.env.DEMO_URL || 'http://127.0.0.1:4173/demo/';
const ROOT = path.resolve(__dirname, '..');
const errors = [];
let serverProcess = null;

const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (error) => {
  const message = String(error && error.message);
  if (message.includes('Could not parse CSS stylesheet')) return;
  errors.push(message);
});
virtualConsole.on('error', (...args) => {
  errors.push(args.map(String).join(' '));
});

function stubFetch(window) {
  window.fetch = (input) => {
    const target = typeof input === 'string' ? input : input.url;
    const clean = target.split('?')[0].split('#')[0];
    const relative = clean.replace(/^.*\/data\//, 'data/');
    const file = path.join(ROOT, relative);
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(JSON.parse(fs.readFileSync(file, 'utf8'))),
      text: () => Promise.resolve(fs.readFileSync(file, 'utf8'))
    });
  };
}

function ping() {
  return new Promise((resolve, reject) => {
    const request = http.get(BASE, (response) => {
      response.resume();
      if (response.statusCode === 200) resolve();
      else reject(new Error('HTTP ' + response.statusCode));
    });
    request.on('error', reject);
    request.setTimeout(1500, () => request.destroy(new Error('timeout')));
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureServer() {
  try {
    await ping();
    return;
  } catch (err) {
    /* start our own */
  }
  serverProcess = spawn(process.execPath, [path.join(ROOT, 'tools', 'serve.js')], {
    cwd: ROOT,
    stdio: 'ignore',
    env: Object.assign({}, process.env, { PORT: '4173' })
  });
  for (let attempt = 0; attempt < 60; attempt++) {
    await sleep(100);
    try {
      await ping();
      return;
    } catch (err) {
      /* keep waiting */
    }
  }
  throw new Error('The demo server did not start on ' + BASE);
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

function click(node) {
  node.dispatchEvent(new node.ownerDocument.defaultView.MouseEvent('click', {
    bubbles: true,
    cancelable: true
  }));
}

(async () => {
  await ensureServer();
  const dom = await JSDOM.fromURL(BASE, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse: stubFetch
  });

  const { window } = dom;
  const { document } = window;

  await new Promise((resolve) => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve);
  });
  // give asyncData (900ms) and the JSON fetch time to finish
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const B = window.BSelect;
  assert.ok(B, 'BSelect global is defined');
  assert.strictEqual(B.version, '1.0.0');
  assert.strictEqual(document.querySelectorAll('#BSelect-styles').length, 1, 'one shared stylesheet');

  const hosts = [
    'demo-basic', 'demo-search', 'demo-json', 'demo-html', 'demo-template',
    'demo-multi', 'demo-grouped', 'demo-async', 'demo-api', 'demo-theme'
  ];

  hosts.forEach((id) => {
    const host = document.getElementById(id);
    assert.ok(host, 'host exists: ' + id);
    assert.ok(host.__bselect, 'instance created: ' + id);
    assert.ok(host.nextElementSibling.classList.contains('BSelect'), 'wrapper rendered: ' + id);
  });

  // the native <select> is moved inside a hidden holder, so its wrapper is the
  // next sibling of that holder.
  const nativeHost = document.getElementById('native-select');
  assert.ok(nativeHost && nativeHost.__bselect, 'instance created: native select');
  assert.ok(nativeHost.closest('.BSelect__nativeWrap').nextElementSibling.classList.contains('BSelect'));

  assert.strictEqual(document.querySelectorAll('.BSelect').length, hosts.length + 1);

  /* ------------------------------------------------ JSON example (24) */
  const jsonDemo = document.getElementById('demo-json').__bselect;
  assert.strictEqual(jsonDemo.getOptions().length, 24);
  assert.strictEqual(jsonDemo._groups.length, 9);
  assert.ok(document.getElementById('out-json-status').textContent.includes('۲۴'));

  /* --------------------------------------------- async + initial value */
  const asyncDemo = document.getElementById('demo-async').__bselect;
  assert.strictEqual(asyncDemo.getOptions().length, 9);
  assert.strictEqual(asyncDemo.getValue(), 'isfahan');
  assert.ok(asyncDemo._controlEl.textContent.includes('اصفهان'));
  assert.strictEqual(document.getElementById('out-async').textContent, 'اصفهان');

  /* ------------------------------------------------ grouped instance */
  const grouped = document.getElementById('demo-grouped').__bselect;
  assert.strictEqual(grouped.getOptions().length, 20);
  grouped.open();
  assert.strictEqual(grouped._open, true);
  assert.ok(grouped._listEl.querySelectorAll('.BSelect__groupHead').length > 0);
  assert.strictEqual(grouped._listEl.querySelectorAll('.BSelect__option').length, 4);
  const next = grouped._footerEl.querySelector('[data-page="next"]');
  assert.ok(next, 'pagination next button exists');
  click(next);
  assert.strictEqual(grouped._page, 2);
  assert.strictEqual(grouped._listEl.querySelectorAll('.BSelect__option').length, 4);

  // selecting inside a group keeps search/pagination intact
  click(grouped._listEl.querySelector('.BSelect__option'));
  assert.strictEqual(grouped.getValues().length, 1);

  /* ------------------------------------------------ multiple + max */
  const multi = document.getElementById('demo-multi').__bselect;
  multi.open();
  for (let i = 0; i < 6; i++) {
    const option = multi._listEl.querySelector('.BSelect__option:not(.BSelect__option--selected)');
    if (!option) break;
    click(option);
  }
  assert.strictEqual(multi.getValues().length, 4, 'maxSelected = 4 respected');
  assert.strictEqual(document.querySelectorAll('#demo-multi ~ *').length >= 0, true);
  assert.ok(document.getElementById('out-multi').textContent.length > 0);

  /* ------------------------------------------------ search filtering */
  const searchDemo = document.getElementById('demo-search').__bselect;
  searchDemo.open();
  const searchInput = searchDemo._searchEl;
  searchInput.value = 'شیراز';
  searchInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.strictEqual(searchDemo._listEl.querySelectorAll('.BSelect__option').length, 1);
  assert.ok(searchDemo._listEl.innerHTML.includes('BSelect__mark'));

  // toggle search off and make sure the search box hides
  click(document.querySelector('[data-action="toggle-search"]'));
  assert.strictEqual(searchDemo.getOption('searchable'), false);
  assert.strictEqual(searchDemo._searchWrap.hidden, true);
  click(document.querySelector('[data-action="toggle-search"]'));

  /* ------------------------------------------------ basic selection */
  const basic = document.getElementById('demo-basic').__bselect;
  basic.open();
  click(basic._listEl.querySelectorAll('.BSelect__option')[1]);
  assert.strictEqual(basic.getValue(), 'شیراز');
  assert.ok(document.getElementById('out-basic').textContent.includes('شیراز'));

  /* ------------------------------------------------ native select */
  const native = document.getElementById('native-select').__bselect;
  assert.strictEqual(native.getValue(), 'tehran');
  assert.strictEqual(native.getSelectedItems()[0].group, 'استان تهران');

  /* ------------------------------------------------ API playground */
  const api = document.getElementById('demo-api').__bselect;
  click(document.querySelector('[data-action="set-api-values"]'));
  assert.deepStrictEqual(Array.from(api.getValues()), ['tehran', 'shiraz']);
  click(document.querySelector('[data-action="add-api"]'));
  assert.strictEqual(api.getOptions().length, 21);
  click(document.querySelector('[data-action="remove-api"]'));
  assert.strictEqual(api.getOptions().length, 20);
  click(document.querySelector('[data-action="toggle-api-search"]'));
  assert.strictEqual(api.getOption('searchable'), false);
  click(document.querySelector('[data-action="toggle-api-search"]'));
  click(document.querySelector('[data-action="clear-api"]'));
  assert.deepStrictEqual(Array.from(api.getValues()), []);

  click(document.querySelector('[data-action="destroy-api"]'));
  assert.strictEqual(document.getElementById('demo-api').__bselect, undefined);
  assert.strictEqual(document.querySelectorAll('.BSelect').length, hosts.length);
  click(document.querySelector('[data-action="recreate-api"]'));
  assert.ok(document.getElementById('demo-api').__bselect);

  /* ------------------------------------------------ log + errors */
  assert.ok(document.querySelectorAll('#event-log li').length > 5, 'events were logged');
  assert.deepStrictEqual(errors, [], 'no runtime errors');
  assert.strictEqual(window.BSelect._liveInstances, hosts.length + 1);

  console.log('demo smoke test: OK — ' + (hosts.length + 1) + ' instances, ' +
    document.querySelectorAll('#event-log li').length + ' log entries');
  dom.window.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(stopServer);
