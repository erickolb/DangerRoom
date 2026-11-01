import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mountSlideshow } from '../public/slideshow.js';

test('slideshow recovers after every cover fails during a restart and cancels retries on exit', async t => {
  const saved = new Map();
  function global(name, value) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  t.after(() => { for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  } });
  const timers = new Map(); let timerId = 0, active = true, available = false, requests = 0;
  global('setTimeout', (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; });
  global('clearTimeout', id => timers.delete(id));
  const listeners = new Map();
  const element = () => ({ style: {}, classList: { add() {}, remove() {} }, focus() {},
    removeAttribute() {}, hasAttribute() { return false; },
    set src(value) { queueMicrotask(() => available ? this.onload?.() : this.onerror?.()); } });
  const elements = new Map();
  const app = { set innerHTML(value) {}, querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector);
  } };
  global('window', { addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); } });
  global('document', { hidden: false, addEventListener() {}, removeEventListener() {} });
  global('location', { origin: 'https://test.example' });
  global('localStorage', { getItem() { return null; }, setItem() {} });
  const items = [{ issue: { id: 1, series: { name: 'Heroes' }, number: '1' }, edition: { key: 'standard', name: 'Standard', cover_file: 'cover.png' } }];
  const api = async () => {
    requests++;
    if (requests === 1) throw Error('Server unavailable.');
    if (requests === 2) return { items: [] };
    return { items };
  };
  const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  const runRetry = async () => {
    const [id, timer] = [...timers].find(([, timer]) => timer.ms === 15000);
    timers.delete(id); await timer.fn(); await settle();
  };
  await mountSlideshow(app, api, () => active); await settle();
  const caption = elements.get('#gallery-caption');
  assert.match(caption.textContent, /Server unavailable.*Retrying/);
  await runRetry();
  assert.match(caption.textContent, /No eligible owned covers/);
  await runRetry();
  assert.match(caption.textContent, /temporarily unavailable/);
  assert.doesNotMatch(caption.textContent, /No eligible/);
  available = true; await runRetry();
  assert.equal(requests, 4);
  assert.match(caption.textContent, /1 \/ 1/);
  assert.notEqual(elements.get('#play-covers').textContent, 'Play');
  assert.ok([...timers.values()].some(timer => timer.ms === 15000)); // Normal playback timer.
  active = false; listeners.get('hashchange')();
  assert.equal(timers.size, 0);
  assert.equal(listeners.has('online'), false);
});
