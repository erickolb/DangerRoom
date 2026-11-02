import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mountSlideshow } from '../public/slideshow.js';

async function gallery(t, ids = [1, 2, 3], apiOverride) {
  const saved = new Map();
  function global(name, value) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  t.after(() => { for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  } });
  const timers = new Map(), listeners = new Map(), attempts = [], cacheConfigurations = [];
  let timerId = 0, clock = 0, active = true, requests = 0;
  const failures = new Set(ids);
  global('setTimeout', (fn, ms) => { timers.set(++timerId, { fn, at: clock + ms }); return timerId; });
  global('clearTimeout', id => timers.delete(id));
  const element = () => ({ style: {}, hidden: false, classList: { add() {}, remove() {} }, focus() {}, append() {}, setAttribute() {},
    removeAttribute() {}, hasAttribute() { return false; },
    set src(value) {
      const id = Number(value.match(/(\d+)\.png/)[1]); attempts.push(id);
      queueMicrotask(() => failures.has(id) ? this.onerror?.() : this.onload?.());
    } });
  const elements = new Map(), spinner = element();
  const app = { set innerHTML(value) {}, querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector);
  } };
  global('window', { DangerRoomAndroid: { fullscreen() {}, keepAwake() {}, configureCoverCache(...args) { cacheConfigurations.push(args); } }, addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); } });
  global('document', { hidden: false, createElement() { return spinner; }, addEventListener() {}, removeEventListener() {} });
  global('location', { origin: 'https://test.example' });
  global('localStorage', { getItem() { return JSON.stringify({ settings: { shuffle: false, seconds: 3, fade: false } }); }, setItem() {} });
  const items = ids.map(id => ({ issue: { id, series: { name: 'Heroes' }, number: String(id) }, edition: { key: 'standard', name: 'Standard', cover_file: `${id}.png` } }));
  const api = async () => { requests++; return apiOverride ? apiOverride(requests, items) : { items }; };
  const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
  const run = async ms => {
    const target = clock + ms;
    while (true) {
      const entry = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      const [id, timer] = entry; timers.delete(id); clock = timer.at;
      timer.fn(); await settle();
    }
    clock = target;
  };
  await mountSlideshow(app, api, () => active); await settle();
  return { attempts, failures, spinner, run, elements, timers, cacheConfigurations, get requests() { return requests; },
    exit() { active = false; listeners.get('hashchange')(); } };
}

test('three failed cycles remove covers individually, then wait ten minutes and rebuild from scratch', async t => {
  const h = await gallery(t);
  assert.deepEqual(h.attempts, [1]);
  await h.run(2999); assert.deepEqual(h.attempts, [1]);
  await h.run(21001);
  assert.deepEqual(h.attempts, [1,2,3,1,2,3,1,2,3]);
  assert.equal(h.spinner.hidden, false);
  assert.match(h.elements.get('#gallery-caption').textContent, /10 minutes/);
  await h.run(599999); assert.equal(h.requests, 1);
  h.failures.clear(); await h.run(1);
  assert.equal(h.requests, 2); assert.equal(h.attempts.at(-1), 1);
  assert.equal(h.spinner.hidden, true);
  assert.match(h.elements.get('#gallery-caption').textContent, /1 \/ 3/);
  h.exit(); assert.equal(h.timers.size, 0);
});

test('success on a previously failed image resets every strike, keeping the whole lineup', async t => {
  const h = await gallery(t);
  await h.run(15000); // Two strikes each, before the third attempt for image 1.
  h.failures.delete(1);
  await h.run(3000); // Image 1 recovers and clears all strikes.
  h.failures.clear(); await h.run(6000);
  assert.match(h.elements.get('#gallery-caption').textContent, /3 \/ 3/);
  assert.equal(h.requests, 1);
  h.exit();
});

test('a healthy image does not reset a broken neighbor; the broken image drops on strike three', async t => {
  const h = await gallery(t, [1,2]);
  h.failures.delete(2);
  await h.run(12000);
  assert.deepEqual(h.attempts, [1,2,1,2,1]);
  await h.run(9000);
  assert.deepEqual(h.attempts, [1,2,1,2,1,2,2,2]);
  assert.match(h.elements.get('#gallery-caption').textContent, /1 \/ 1/);
  h.exit();
});

test('inventory errors and empty inventory wait ten minutes; exit cancels reinitialization', async t => {
  const h = await gallery(t, [1], (request, items) => {
    if (request === 1) throw Error('Server unavailable.');
    return { items: request === 2 ? [] : items };
  });
  assert.equal(h.spinner.hidden, false);
  await h.run(600000); assert.equal(h.requests, 2);
  assert.equal(h.spinner.hidden, false);
  h.exit(); await h.run(600000);
  assert.equal(h.requests, 2); assert.equal(h.timers.size, 0);
});

test('slideshow initializes native cache with entire eligible playlist and default 300 MB limit', async t => {
  const h = await gallery(t, [1, 2]);
  assert.deepEqual(h.cacheConfigurations, [[JSON.stringify(['1.png', '2.png']), true, 300]]);
  h.exit();
});
