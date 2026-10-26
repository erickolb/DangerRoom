import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { openDatabase, Repository } from '../src/database.mjs';
import { createApp } from '../src/server.mjs';
import { editionsFor, essentialIssue, searchFilters } from '../src/metron.mjs';
import { Covers } from '../src/covers.mjs';

const original = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ2kAAAAASUVORK5CYII=', 'base64');
const raw = { id: 42, series: { id: 4, name: 'Test Heroes', volume: 2, year_began: 2024, language: 'en' },
  number: '1', title: 'First light', cover_date: '2024-01-01', store_date: '2023-11-22',
  publisher: { id: 1, name: 'Test Press' }, imprint: null, page: 32, price: '3.99', price_currency: 'USD',
  upc: '12345678901200111', sku: 'BASE', isbn: '', image: 'https://static.metron.cloud/media/base.png',
  resource_url: 'https://metron.cloud/issue/test-heroes-2024-1/', modified: '2026-01-01T12:00:00Z',
  variants: [{ name: 'Cover B — Artist Edition', upc: '12345678901200121', sku: 'VAR', price: '4.99', image: 'https://static.metron.cloud/media/variant.png' }],
  desc: 'Not permanently imported by the MVP.', credits: [], attribution: [] };
async function harness(t, overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'dangerroom-test-'));
  let lookups = 0, downloads = 0;
  const options = { dataDir: dir, metronOptions: { token: 'test-only', interval: 0, fetchImpl: async url => {
    lookups++;
    if (url.includes('issue/42/')) return Response.json(raw);
    return Response.json({ count: 1, next: null, previous: null, results: [{ ...raw, issue: 'Test Heroes (2024) #1' }] });
  } }, imageFetch: async () => { downloads++; return new Response(original, { headers: { 'content-type': 'image/png' } }); }, ...overrides };
  const app = createApp(options); app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const base = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => { await new Promise(resolve => app.server.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  async function request(path, method = 'GET', data, headers = {}) {
    const response = await fetch(`${base}${path}`, { method, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: data ? JSON.stringify(data) : undefined });
    return { status: response.status, headers: response.headers, data: await response.json() };
  }
  return { ...app, base, dir, options, request, counts: () => ({ lookups, downloads }) };
}
const add = (edition_key, owned = true, read = false) => ({ issue_id: 42, edition_key, owned, read });

test('same-variant copies remain separate; read status and removing copies stay independent', async t => {
  const h = await harness(t);
  const details = (await h.request('/api/metron/issues/42')).data;
  const variant = details.editions[1];
  assert.notEqual(variant.key, 'standard');
  const a = await h.request('/api/entries', 'POST', add(variant.key, true, true));
  const b = await h.request('/api/entries', 'POST', add(variant.key));
  assert.equal(a.status, 201); assert.equal(b.status, 201); assert.notEqual(a.data.copy_id, b.data.copy_id);
  assert.equal((await h.request('/api/collection')).data.items.length, 2);
  assert.equal((await h.request('/api/collection?view=read')).data.items.length, 1);
  const issue = (await h.request('/api/issues/42')).data;
  assert.equal(issue.editions[0].upc, raw.variants[0].upc);
  assert.equal(issue.editions[0].sku, 'VAR'); assert.equal(issue.page_count, 32);
  assert.equal(issue.desc, undefined); assert.equal(issue.copies.length, 2);
  assert.deepEqual(h.counts(), { lookups: 1, downloads: 1 });
  const stored = await readFile(join(h.dir, 'covers', issue.editions[0].cover_file));
  assert.deepEqual(stored, original);
  await h.request(`/api/copies/${a.data.copy_id}`, 'DELETE');
  assert.equal((await h.request('/api/collection')).data.items.length, 1);
  assert.equal((await h.request('/api/collection?view=read')).data.items.length, 1);
  await h.request('/api/issues/42/read', 'PATCH', { read: false });
  assert.equal((await h.request('/api/collection')).data.items.length, 1);
  assert.equal((await h.request('/api/collection?view=read')).data.items.length, 0);
});
test('read-only saves are idempotent; later ownership does not replace read cover', async t => {
  const h = await harness(t);
  await h.request('/api/entries', 'POST', add('standard', false, true));
  const before = (await h.request('/api/issues/42')).data.read;
  await h.request('/api/entries', 'POST', add('standard', false, true));
  assert.equal((await h.request('/api/collection')).data.items.length, 0);
  assert.equal((await h.request('/api/collection?view=read')).data.items.length, 1);
  assert.deepEqual((await h.request('/api/issues/42')).data.read, before);
  const variantKey = editionsFor(raw)[1].key;
  await h.request('/api/entries', 'POST', add(variantKey));
  assert.equal((await h.request('/api/collection')).data.items[0].edition.key, variantKey);
  assert.equal((await h.request('/api/collection?view=read')).data.items[0].edition.key, 'standard');
  assert.equal((await h.request('/api/collection?q=Artist')).data.items.length, 1);
  assert.equal((await h.request('/api/collection?q=Nope')).data.items.length, 0);
});
test('cached search, validation, exact cover selection, and server origin guards', async t => {
  const h = await harness(t);
  assert.equal((await h.request('/api/search?q=Test&number=1&year=2024')).status, 200);
  await h.request('/api/search?q=Test&number=1&year=2024');
  assert.equal(h.counts().lookups, 1);
  assert.equal((await h.request('/api/search')).status, 400);
  assert.equal((await h.request('/api/search?q=Test&year=no')).status, 400);
  assert.equal((await h.request('/api/entries', 'POST', add('forged'))).status, 400);
  assert.equal((await h.request('/api/entries', 'POST', add('standard', false, false))).status, 400);
  assert.equal((await h.request('/api/entries', 'POST', add('standard'), { Origin: 'https://other.test' })).status, 403);
  assert.equal(await new Promise((resolve, reject) => { const r = httpRequest(h.base + '/api/health', { headers: { Host: 'other.test' } }, response => { response.resume(); resolve(response.statusCode); }); r.on('error', reject); r.end(); }), 403);
  assert.equal((await h.request('/api/issues/999')).status, 404);
  assert.equal((await fetch(`${h.base}/.env`)).status, 404);
  assert.equal((await fetch(`${h.base}/box-add.png`)).status, 200);
  assert.equal((await fetch(`${h.base}/book-check.png`)).status, 200);
});
test('failed cover download does not create an inventory entry', async t => {
  const h = await harness(t, { imageFetch: async () => new Response('unavailable', { status: 503 }) });
  assert.equal((await h.request('/api/entries', 'POST', add('standard'))).status, 502);
  assert.equal((await h.request('/api/collection')).data.items.length, 0);
  assert.equal((await h.request('/api/issues/42')).status, 404);
});
test('missing artwork can be saved honestly; hostile image URLs cannot be fetched', async t => {
  const h = await harness(t);
  const noImage = { ...essentialIssue(raw), id: 43 };
  h.repo.save(noImage, { ...editionsFor(raw)[0], source_image: null }, null, { owned: true, read: false });
  assert.equal(h.repo.issue(43).editions[0].cover_file, null);
  await assert.rejects(h.covers.save('http://127.0.0.1/secret'), /not from Metron/);
  await assert.rejects(h.covers.save('https://static.metron.cloud.evil.test/media/cover.png'), /not from Metron/);
});
test('saved collection and metadata survive a database reopen', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dangerroom-reopen-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const db = openDatabase(dir), repo = new Repository(db);
  repo.save(essentialIssue(raw), editionsFor(raw)[0], null, { owned: true, read: true });
  db.close();
  const next = openDatabase(dir), reopened = new Repository(next);
  try { assert.equal(reopened.collection('owned').length, 1); assert.equal(reopened.collection('read').length, 1); }
  finally { next.close(); }
});
test('rate-limit headers and Retry-After block further calls, but not cached reads', async t => {
  let calls = 0;
  const h = await harness(t, { metronOptions: { token: 'test-only', interval: 0, fetchImpl: async () => {
    calls++;
    if (calls === 1) return Response.json(raw);
    return Response.json({ detail: 'slow down' }, { status: 429, headers: { 'Retry-After': '120' } });
  } } });
  await h.request('/api/metron/issues/42');
  const rate = await h.request('/api/search?q=Other');
  assert.equal(rate.status, 429); assert.ok(Number(rate.headers.get('retry-after')) >= 119);
  assert.equal((await h.request('/api/search?q=Another')).status, 429);
  assert.equal(calls, 2);
  assert.equal((await h.request('/api/metron/issues/42')).status, 200);
  assert.equal(calls, 2);
});
test('exhausted quota on a successful response prevents the next uncached request', async t => {
  let calls = 0;
  const h = await harness(t, { metronOptions: { token: 'test-only', interval: 0, fetchImpl: async () => {
    calls++;
    return Response.json(raw, { headers: { 'X-RateLimit-Sustained-Remaining': '0', 'X-RateLimit-Sustained-Reset': String(Math.ceil(Date.now() / 1000) + 600) } });
  } } });
  assert.equal((await h.request('/api/metron/issues/42')).status, 200);
  assert.equal((await h.request('/api/search?q=Test')).status, 429);
  assert.equal(calls, 1);
});
test('concurrent identical lookups are coalesced', async t => {
  const h = await harness(t);
  await Promise.all([h.metron.issue(42), h.metron.issue(42), h.metron.issue(42)]);
  assert.equal(h.counts().lookups, 1);
});
test('token is server-only; missing credentials give an actionable error', async t => {
  const h = await harness(t, { metronOptions: { token: '', username: '', password: '' } });
  assert.equal((await h.request('/api/health')).data.metron_configured, false);
  const r = await h.request('/api/search?q=Batman');
  assert.equal(r.status, 503); assert.match(r.data.error, /METRON_API_TOKEN/);
});
test('variant identity does not depend on ordering; price currency is not invented', () => {
  const second = { name: 'Cover C', sku: 'C', image: 'https://static.metron.cloud/media/c.png' };
  const a = editionsFor({ ...raw, variants: [raw.variants[0], second] });
  const b = editionsFor({ ...raw, variants: [second, raw.variants[0]] });
  assert.equal(a[1].key, b[2].key); assert.equal(a[1].price_currency, '');
  assert.equal(searchFilters(new URLSearchParams('upc=123456789012')).get('upc'), '123456789012');
});
test('cover MIME is validated from bytes; content-identical artwork shares storage', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dangerroom-covers-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const bad = new Covers(dir, async () => new Response('<svg>malicious</svg>', { headers: { 'content-type': 'image/png' } }));
  await assert.rejects(bad.save(raw.image), /supported cover/);
  const good = new Covers(dir, async () => new Response(original));
  const a = await good.save(raw.image), b = await good.save(raw.variants[0].image);
  assert.equal(a, b);
});

