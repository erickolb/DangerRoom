import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCoverTransition } from '../public/cover-transition.js';

class ImageLayer {
  style = {};
  animations = [];
  srcValue = null;
  set src(value) { this.srcValue = value; }
  get src() { return this.srcValue; }
  hasAttribute(name) { return name === 'src' && this.srcValue !== null; }
  removeAttribute(name) { if (name === 'src') this.srcValue = null; }
  decode() { return new Promise(resolve => { this.decoded = resolve; }); }
  async load() { const loading = this.onload(); this.decoded(); await loading; }
  animate(frames, options) {
    const animation = { frames, options, cancel() { this.cancelled = true; this.oncancel?.(); } };
    this.animations.push(animation);
    return animation;
  }
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('cover transitions keep the outgoing source visible until the hidden cover is decoded and faded', async () => {
  const a = new ImageLayer(), b = new ImageLayer(), transition = createCoverTransition(a, b);
  const first = transition.show('red-cover', 'Red', true);
  assert.equal(b.style.opacity, '0');
  await b.load(); assert.equal(await first, true);
  assert.equal(b.style.opacity, '1'); assert.equal(b.src, 'red-cover');
  const second = transition.show('blue-cover', 'Blue', true);
  assert.equal(b.src, 'red-cover'); assert.equal(b.style.opacity, '1');
  assert.equal(a.src, 'blue-cover'); assert.equal(a.style.opacity, '0');
  await a.load(); await tick();
  assert.deepEqual(a.animations[0].frames, [{ opacity: 0 }, { opacity: 1 }]);
  assert.deepEqual(b.animations[0].frames, [{ opacity: 1 }, { opacity: 0 }]);
  a.animations[0].onfinish(); b.animations[0].onfinish();
  assert.equal(await second, true);
  assert.equal(a.style.opacity, '1'); assert.equal(b.style.opacity, '0');
  assert.ok(a.animations[0].cancelled && b.animations[0].cancelled);
  const third = transition.show('green-cover', 'Green', true);
  assert.equal(a.src, 'blue-cover'); assert.equal(a.style.opacity, '1');
  assert.equal(b.style.opacity, '0');
  await b.load(); await tick();
  a.animations[1].onfinish(); b.animations[1].onfinish();
  assert.equal(await third, true); assert.equal(b.style.opacity, '1');
});

test('rapid navigation cancels pending loads, cuts skip animation, and clearing cancels active fades', async () => {
  const a = new ImageLayer(), b = new ImageLayer(), transition = createCoverTransition(a, b);
  const first = transition.show('one', 'One', false); await b.load(); await first;
  const skipped = transition.show('two', 'Two', true);
  const latest = transition.show('three', 'Three', false);
  assert.equal(await skipped, false);
  assert.equal(b.src, 'one'); assert.equal(b.style.opacity, '1');
  await a.load(); assert.equal(await latest, true);
  assert.equal(a.src, 'three'); assert.equal(a.animations.length, 0);
  const fade = transition.show('four', 'Four', true); await b.load(); await tick();
  transition.clear(); assert.equal(await fade, false);
  assert.equal(a.src, null); assert.equal(b.src, null);
  assert.equal(a.style.opacity, '0'); assert.equal(b.style.opacity, '0');
});
