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


test('rating is shared across duplicate copies and variants and atomically marks the issue read', async t => {
  const h = await harness(t);
  const standard = await h.request('/api/entries', 'POST', add('standard'));
  const key = editionsFor(raw)[1].key;
  await h.request('/api/entries', 'POST', add(key));
  await h.request('/api/entries', 'POST', add(key));
  const before = h.counts();
  assert.equal(standard.data.issue.user_rating, null);
  const rated = await h.request('/api/issues/42/rating', 'PATCH', { rating: 3.5, edition_key: key });
  assert.equal(rated.status, 200); assert.equal(rated.data.user_rating, 3.5); assert.ok(rated.data.read);
  assert.equal(rated.data.read.edition_key, key);
  assert.equal(rated.data.copies.length, 3);
  const owned = (await h.request('/api/collection')).data.items;
  assert.equal(owned.length, 3);
  assert.ok(owned.every(row => row.issue.user_rating === 3.5 && row.issue.read));
  assert.equal((await h.request('/api/collection?view=read')).data.items.length, 1);
  const originalRead = rated.data.read;
  await h.request('/api/issues/42/rating', 'PATCH', { rating: 5, edition_key: 'standard' });
  assert.deepEqual((await h.request('/api/issues/42')).data.read, originalRead);
  assert.equal((await h.request('/api/issues/42')).data.user_rating, 5);
  assert.deepEqual(h.counts(), before);
});
test('rating on import works without owning or separately checking read; later copies inherit it', async t => {
  const h = await harness(t);
  const rated = await h.request('/api/entries', 'POST', { ...add('standard', false, false), rating: 0.5 });
  assert.equal(rated.status, 201); assert.equal(rated.data.issue.user_rating, 0.5); assert.ok(rated.data.issue.read);
  assert.equal((await h.request('/api/collection')).data.items.length, 0);
  assert.equal((await h.request('/api/collection?view=read')).data.items[0].issue.user_rating, 0.5);
  const added = await h.request('/api/entries', 'POST', add(editionsFor(raw)[1].key));
  assert.equal(added.data.issue.user_rating, 0.5);
  assert.equal(added.data.issue.copies.length, 1);
});
test('invalid ratings and invalid editions do not alter rating or read status', async t => {
  const h = await harness(t);
  await h.request('/api/entries', 'POST', add('standard'));
  for (const rating of [-1, 0, 0.25, 1.1, 5.5, '3.5', true, {}, []]) {
    assert.equal((await h.request('/api/issues/42/rating', 'PATCH', { rating, edition_key: 'standard' })).status, 400);
    assert.equal((await h.request('/api/entries', 'POST', { ...add('standard'), rating })).status, 400);
  }
  assert.equal((await h.request('/api/issues/42/rating', 'PATCH', { edition_key: 'standard' })).status, 400);
  assert.equal((await h.request('/api/issues/42/rating', 'PATCH', { rating: 4, edition_key: 'unknown' })).status, 400);
  assert.equal((await h.request('/api/issues/999/rating', 'PATCH', { rating: 4, edition_key: 'standard' })).status, 404);
  const issue = (await h.request('/api/issues/42')).data;
  assert.equal(issue.user_rating, null); assert.equal(issue.read, null); assert.equal(issue.copies.length, 1);
});
test('clearing a rating keeps read status; manual unread keeps the rating; other issues are independent', async t => {
  const h = await harness(t);
  await h.request('/api/entries', 'POST', { ...add('standard'), rating: 4.5 });
  h.repo.save({ ...essentialIssue(raw), id: 43 }, editionsFor(raw)[0], null, { owned: true, read: false });
  const firstRead = (await h.request('/api/issues/42')).data.read;
  assert.equal(h.repo.issue(43).user_rating, null); assert.equal(h.repo.issue(43).read, null);
  const cleared = await h.request('/api/issues/42/rating', 'PATCH', { rating: null });
  assert.equal(cleared.data.user_rating, null); assert.deepEqual(cleared.data.read, firstRead);
  await h.request('/api/issues/42/rating', 'PATCH', { rating: 4.5, edition_key: 'standard' });
  await h.request('/api/issues/42/read', 'PATCH', { read: false });
  assert.equal((await h.request('/api/issues/42')).data.user_rating, 4.5);
  assert.equal((await h.request('/api/issues/42')).data.read, null);
  await h.request('/api/issues/42/rating', 'PATCH', { rating: 4.5, edition_key: 'standard' });
  assert.ok((await h.request('/api/issues/42')).data.read);
});
test('ratings migration preserves old inventory, starts unrated, and persists half-stars across restarts', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dangerroom-rating-migration-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let db = openDatabase(dir), repo = new Repository(db);
  repo.save(essentialIssue(raw), editionsFor(raw)[0], null, { owned: true, read: false });
  db.exec('DROP TABLE issue_ratings; PRAGMA user_version=1;'); db.close();
  db = openDatabase(dir); repo = new Repository(db);
  assert.equal(repo.issue(42).user_rating, null); assert.equal(repo.collection('owned').length, 1);
  repo.setRating(42, 2.5, 'standard'); db.close();
  db = openDatabase(dir); repo = new Repository(db);
  try {
    assert.equal(repo.issue(42).user_rating, 2.5); assert.ok(repo.issue(42).read);
    assert.equal(repo.collection('owned').length, 1); assert.equal(db.prepare('PRAGMA user_version').get().user_version, 5);
  } finally { db.close(); }
});

test('want list stores only high-level cover metadata and a local image without inventory or read records', async t => {
  const h = await harness(t), key = editionsFor(raw)[1].key;
  const result = await h.request('/api/wants','POST',{issue_id:42,edition_key:key});
  assert.equal(result.status,200); assert.equal(result.data.added,true);
  const wanted = (await h.request('/api/wants')).data.items;
  assert.equal(wanted.length,1); assert.equal(wanted[0].edition.name,raw.variants[0].name);
  assert.equal(wanted[0].resource_url,raw.resource_url); assert.ok(wanted[0].cover_file);
  assert.deepEqual(await readFile(join(h.dir,'covers',wanted[0].cover_file)),original);
  assert.deepEqual(Object.keys(wanted[0]).sort(),['issue_id','display_name','series','number','cover_date','resource_url','edition','cover_file','added_at'].sort());
  assert.deepEqual(Object.keys(wanted[0].edition).sort(),['key','name','source_image'].sort());
  assert.equal((await h.request('/api/collection')).data.items.length,0);
  assert.equal((await h.request('/api/collection?view=read')).data.items.length,0);
  assert.equal((await h.request('/api/issues/42')).status,404);
  assert.equal(h.repo.db.prepare('SELECT count(*) AS n FROM issues').get().n,0);
  assert.equal(h.repo.db.prepare('SELECT count(*) AS n FROM editions').get().n,0);
});
test('wanting duplicate covers is idempotent; standard and variant are distinct; owned exact cover is a silent no-op', async t => {
  const h = await harness(t), key = editionsFor(raw)[1].key;
  await h.request('/api/entries','POST',add('standard'));
  const before = h.counts();
  const ignored = await h.request('/api/wants','POST',{issue_id:42,edition_key:'standard'});
  assert.deepEqual(ignored.data,{added:false,owned:true,wanted:false}); assert.equal(ignored.status,200);
  assert.deepEqual(h.counts(),before);
  assert.equal((await h.request('/api/wants','POST',{issue_id:42,edition_key:key})).data.added,true);
  const downloaded = h.counts();
  assert.equal((await h.request('/api/wants','POST',{issue_id:42,edition_key:key})).data.added,false);
  assert.deepEqual(h.counts(),downloaded);
  const details=(await h.request('/api/metron/issues/42')).data;
  assert.equal(details.editions[0].owned,true); assert.equal(details.editions[0].wanted,false);
  assert.equal(details.editions[1].owned,false); assert.equal(details.editions[1].wanted,true);
  assert.equal((await h.request('/api/wants')).data.items.length,1);
});
test('acquiring one exact cover removes only that wanted cover and reuses its local image', async t => {
  const h = await harness(t), key = editionsFor(raw)[1].key;
  await h.request('/api/wants','POST',{issue_id:42,edition_key:'standard'});
  await h.request('/api/wants','POST',{issue_id:42,edition_key:key});
  const before=h.counts();
  const result=await h.request('/api/entries','POST',add(key));
  assert.equal(result.status,201);
  const wanted=(await h.request('/api/wants')).data.items;
  assert.equal(wanted.length,1); assert.equal(wanted[0].edition.key,'standard');
  assert.deepEqual(h.counts(),before);
  const again=await h.request('/api/wants','POST',{issue_id:42,edition_key:key});
  assert.equal(again.data.added,false);assert.equal(again.data.owned,true);
});
test('reading and rating a wanted cover does not claim ownership or remove it; want-list removal preserves collection', async t => {
  const h = await harness(t);
  await h.request('/api/wants','POST',{issue_id:42,edition_key:'standard'});
  await h.request('/api/entries','POST',{...add('standard',false,false),rating:4.5});
  assert.equal((await h.request('/api/wants')).data.items.length,1);
  assert.equal((await h.request('/api/collection')).data.items.length,0);
  const before=h.counts();
  assert.equal((await h.request('/api/wants/42/standard','DELETE')).status,200);
  assert.equal((await h.request('/api/wants/42/standard','DELETE')).status,200);
  assert.equal((await h.request('/api/wants')).data.items.length,0);
  const issue=(await h.request('/api/issues/42')).data;
  assert.equal(issue.user_rating,4.5);assert.ok(issue.read);
  assert.deepEqual(h.counts(),before);
});
test('want-list search and validation; failed artwork download does not save a wanted record', async t => {
  const h = await harness(t);
  assert.equal((await h.request('/api/wants','POST',{issue_id:42,edition_key:'forged'})).status,400);
  const forged='variant-'+ 'a'.repeat(64);
  assert.equal((await h.request('/api/wants','POST',{issue_id:42,edition_key:forged})).status,400);
  await h.request('/api/wants','POST',{issue_id:42,edition_key:editionsFor(raw)[1].key});
  assert.equal((await h.request('/api/wants?q=Artist')).data.items.length,1);
  assert.equal((await h.request('/api/wants?q=Batman')).data.items.length,0);
  const bad=await harness(t,{imageFetch:async()=>new Response('Unavailable',{status:503})});
  assert.equal((await bad.request('/api/wants','POST',{issue_id:42,edition_key:'standard'})).status,502);
  assert.equal((await bad.request('/api/wants')).data.items.length,0);
});
test('want-list migration preserves inventory and ratings and persists wants through restart', async t => {
  const dir=await mkdtemp(join(tmpdir(),'dangerroom-wants-migration-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  let db=openDatabase(dir),repo=new Repository(db);
  repo.save(essentialIssue(raw),editionsFor(raw)[0],null,{owned:true,read:true,rating:3.5});
  db.exec('DROP TABLE wants; PRAGMA user_version=2;');db.close();
  db=openDatabase(dir);repo=new Repository(db);
  assert.equal(repo.wantList().length,0);assert.equal(repo.issue(42).user_rating,3.5);assert.equal(repo.collection('owned').length,1);
  repo.addWant(essentialIssue(raw),editionsFor(raw)[1],null);db.close();
  db=openDatabase(dir);repo=new Repository(db);
  try{assert.equal(repo.wantList().length,1);assert.equal(repo.issue(42).user_rating,3.5);assert.equal(repo.db.prepare('PRAGMA user_version').get().user_version,5);}finally{db.close();}
});
test('ownership wins a want-list race, even when a stale cover selection is submitted', async t => {
  const h=await harness(t), issue=essentialIssue(raw),edition=editionsFor(raw)[0];
  h.repo.save(issue,edition,null,{owned:true,read:false});
  assert.deepEqual(h.repo.addWant(issue,edition,null),{added:false,owned:true,wanted:false});
  assert.equal(h.repo.wantList().length,0);
});

test('un-toggling the last copy preserves reading and rating and can restore ownership entirely locally',async t=>{
  const h=await harness(t);
  const added=await h.request('/api/entries','POST',{...add('standard'),rating:4.5});
  const before=h.counts(),oldId=added.data.copy_id;
  await h.request(`/api/copies/${oldId}`,'DELETE');
  assert.equal((await h.request('/api/collection')).data.items.length,0);
  let issue=(await h.request('/api/issues/42')).data;
  assert.ok(issue.read);assert.equal(issue.user_rating,4.5);assert.equal(issue.editions[0].owned,false);
  const restored=await h.request('/api/entries','POST',add('standard'));
  assert.equal(restored.status,201);assert.notEqual(restored.data.copy_id,oldId);
  assert.equal(restored.data.issue.copies.length,1);assert.ok(restored.data.issue.read);assert.equal(restored.data.issue.user_rating,4.5);
  assert.deepEqual(h.counts(),before);
});
test('search and picker states reflect live shared reading and exact-cover ownership after toggles',async t=>{
  const h=await harness(t),key=editionsFor(raw)[1].key;
  const added=await h.request('/api/entries','POST',add('standard'));
  await h.request('/api/issues/42/read','PATCH',{read:true,edition_key:'standard'});
  await h.request('/api/wants','POST',{issue_id:42,edition_key:key});
  const search=(await h.request('/api/search?q=Test')).data.results[0];
  assert.equal(search.owned,true);assert.equal(search.read,true);assert.equal(search.wanted,true);
  let picker=(await h.request('/api/metron/issues/42')).data;
  assert.equal(picker.saved,true);assert.ok(picker.read);assert.equal(picker.copies[0].id,added.data.copy_id);
  assert.equal(picker.editions[0].owned,true);assert.equal(picker.editions[1].wanted,true);
  await h.request('/api/issues/42/read','PATCH',{read:false});
  assert.equal((await h.request('/api/search?q=Test')).data.results[0].read,false);
  await h.request(`/api/copies/${added.data.copy_id}`,'DELETE');
  picker=(await h.request('/api/metron/issues/42')).data;
  assert.equal(picker.editions[0].owned,false);assert.equal(picker.editions[1].wanted,true);assert.equal(picker.copies.length,0);
});

test('search tile status includes variant-only ownership and wants without changing picker cover states', async t => {
  const h=await harness(t), key=editionsFor(raw)[1].key;
  await h.request('/api/entries','POST',add(key));
  let row=(await h.request('/api/search?q=Test')).data.results[0];
  assert.equal(row.owned,true);assert.equal(row.wanted,false);assert.equal(row.read,false);
  await h.request('/api/wants','POST',{issue_id:42,edition_key:'standard'});
  row=(await h.request('/api/search?q=Test')).data.results[0];
  assert.equal(row.owned,true);assert.equal(row.wanted,true);
  const picker=(await h.request('/api/metron/issues/42')).data;
  assert.equal(picker.editions[0].owned,false);assert.equal(picker.editions[0].wanted,true);
  assert.equal(picker.editions[1].owned,true);assert.equal(picker.editions[1].wanted,false);
  const issue=(await h.request('/api/issues/42')).data;
  await h.request(`/api/copies/${issue.copies[0].id}`,'DELETE');
  await h.request('/api/wants/42/standard','DELETE');
  row=(await h.request('/api/search?q=Test')).data.results[0];
  assert.equal(row.owned,false);assert.equal(row.wanted,false);
});

test('search thumbnails prefer owned variant artwork and fall back when its last copy is removed', async t => {
  const h=await harness(t),key=editionsFor(raw)[1].key;
  const search=async()=>(await h.request('/api/search?q=Test')).data.results[0];
  assert.equal((await search()).cover_file,null);
  const standard=(await h.request('/api/entries','POST',add('standard'))).data;
  const variant=(await h.request('/api/entries','POST',add(key))).data;
  const variantFile=variant.issue.editions.find(e=>e.key===key).cover_file;
  assert.equal((await search()).cover_file,variantFile);
  const duplicate=(await h.request('/api/entries','POST',add(key))).data;
  await h.request(`/api/copies/${variant.copy_id}`,'DELETE');
  assert.equal((await search()).cover_file,variantFile);
  await h.request(`/api/copies/${duplicate.copy_id}`,'DELETE');
  assert.equal((await search()).cover_file,standard.issue.editions[0].cover_file);
  await h.request(`/api/copies/${standard.copy_id}`,'DELETE');
  const row=await search();assert.equal(row.cover_file,null);assert.equal(row.image,raw.image);
});

test('collection defaults to series, start year, and numeric issue order with duplicates grouped', async t => {
  const h=await harness(t);
  const save=(id,name,year,number,key='standard')=>h.repo.save({id,series:{id:year,name,year_began:year,volume:1},number:String(number),display_name:`${name} #${number}`},{key,name:key},null,{owned:true,read:true});
  save(101,'Absolute Green Arrow',2026,6);save(102,'Absolute Green Arrow',2026,2);
  save(103,'Absolute Green Arrow',2026,10);save(104,'Absolute Green Arrow',2026,1);
  save(105,'Absolute Green Arrow',2026,4);save(106,'Absolute Green Arrow',2026,5);save(107,'Absolute Green Arrow',2026,3);
  save(102,'Absolute Green Arrow',2026,2);save(102,'Absolute Green Arrow',2026,2,'variant-z');
  save(108,'Absolute Green Arrow',2025,12);save(109,'Batman',2024,1);
  save(110,'Absolute Green Arrow',2026,'2.5');save(111,'Absolute Green Arrow',2026,'½');
  for(const view of ['owned','read']){
    const rows=(await h.request(`/api/collection?view=${view}`)).data.items;
    assert.equal(rows[0].issue.id,108);assert.equal(rows.at(-1).issue.id,109);
    const numbers=rows.filter(r=>r.issue.series.year_began===2026).map(r=>r.issue.number);
    assert.deepEqual(numbers,view==='owned'?['½','1','2','2','2','2.5','3','4','5','6','10']:['½','1','2','2.5','3','4','5','6','10']);
  }
});

test('owned-series lists owned issues across title runs in year/volume/numeric order, grouping copies and excluding read-only issues', async t => {
  const h=await harness(t);
  function save(id,seriesId,year,volume,number,{name='Test Heroes',key='standard',owned=true}={}){
    return h.repo.save({id,series:{id:seriesId,name,year_began:year,volume},number:String(number),display_name:`${name} #${number}`},{key,name:key},key==='standard'?null:'a'.repeat(64)+'.png',{owned,read:true});
  }
  save(201,1,2024,2,10);save(202,1,2024,2,2);save(203,2,2023,1,8);
  save(204,3,2024,1,12);save(205,4,2024,3,1);save(206,5,2022,1,1,{name:'Other Series'});
  save(207,1,2024,2,3,{owned:false});save(202,1,2024,2,2);save(202,1,2024,2,2,{key:'variant-test'});
  const response=await h.request('/api/issues/201/owned-series');assert.equal(response.status,200);
  assert.deepEqual(response.data.items.map(row=>row.issue.id),[203,204,202,201,205]);
  const duplicate=response.data.items.find(row=>row.issue.id===202);assert.equal(duplicate.copy_count,3);assert.equal(duplicate.edition.key,'variant-test');
  assert.equal((await h.request('/api/issues/207/owned-series')).data.items.length,5);
  assert.equal((await h.request('/api/issues/999/owned-series')).status,404);
  const copies=h.repo.issue(202).copies;for(const copy of copies)h.repo.removeCopy(copy.id);
  assert.equal((await h.request('/api/issues/201/owned-series')).data.items.some(row=>row.issue.id===202),false);
});

test('series ratings use saved issues, separate runs, include read-only ratings, and update after clearing',async t=>{
  const h=await harness(t);
  const save=(id,number,rating,seriesId=4)=>h.repo.save({id,series:{id:seriesId,name:'Test Heroes',year_began:2024,volume:1},number:String(number)},{key:'standard',name:'Standard cover'},null,{owned:false,read:true,...(rating!=null?{rating}:{})});
  save(301,2,4);save(302,5,2);save(303,6,null);save(304,20,5,99);
  let response=await h.request('/api/issues/301/series-ratings');assert.equal(response.status,200);
  assert.deepEqual(response.data,{max_issue:6,points:[{number:2,rating:4},{number:5,rating:2}]});
  await h.request('/api/issues/302/rating','PATCH',{rating:null});
  response=await h.request('/api/issues/301/series-ratings');assert.equal(response.data.points.length,1);assert.equal(response.data.max_issue,6);
  assert.equal((await h.request('/api/issues/999/series-ratings')).status,404);
  assert.deepEqual(h.counts(),{lookups:0,downloads:0});
});

test('dated reading imports are atomic, repeatable, and issue-wide across variants without claiming ownership',async t=>{
  const h=await harness(t),variant=editionsFor(raw)[1].key;
  let result=await h.request('/api/entries','POST',{...add('standard',false,true),log_date:'2026-10-27'});
  assert.equal(result.status,201);assert.equal(result.data.issue.reading_log_count,1);assert.equal(result.data.issue.copies.length,0);
  result=await h.request('/api/entries','POST',{...add(variant,false,true),log_date:'2026-10-27'});
  assert.equal(result.data.issue.reading_log_count,2);
  await h.request('/api/issues/42/reading-log','POST',{edition_key:variant,log_date:'2026-10-27'});
  const entries=(await h.request('/api/issues/42/reading-log')).data.items;
  assert.equal(entries.length,3);assert.equal(new Set(entries.map(row=>row.id)).size,3);
  assert.deepEqual(new Set(entries.map(row=>row.edition_key)),new Set(['standard',variant]));
  const monthly=(await h.request('/api/reading-log?month=2026-10')).data.items;
  assert.equal(monthly.length,3);assert.equal(monthly[0].issue.display_name,'Test Heroes (2024) #1');assert.ok(monthly[0].edition.cover_file);
});
test('individual log removal keeps read status, rating, ownership and other log entries',async t=>{
  const h=await harness(t);
  await h.request('/api/entries','POST',{...add('standard'),rating:4,log_date:'2026-10-27'});
  await h.request('/api/issues/42/reading-log','POST',{edition_key:'standard',log_date:'2026-10-26'});
  const entries=(await h.request('/api/issues/42/reading-log')).data.items;
  assert.equal((await h.request(`/api/reading-log/${entries[0].id}`,'DELETE')).status,200);
  const issue=(await h.request('/api/issues/42')).data;
  assert.ok(issue.read);assert.equal(issue.user_rating,4);assert.equal(issue.copies.length,1);assert.equal(issue.reading_log_count,1);
  assert.equal((await h.request(`/api/reading-log/${entries[0].id}`,'DELETE')).status,404);
});
test('mark unread can keep or remove all issue log entries while preserving ratings and other issues',async t=>{
  const h=await harness(t),variant=editionsFor(raw)[1].key;
  await h.request('/api/entries','POST',{...add('standard'),rating:4.5,log_date:'2026-10-27'});
  await h.request('/api/entries','POST',{...add(variant),log_date:'2026-09-30'});
  const other={...essentialIssue(raw),id:43};h.repo.save(other,editionsFor(raw)[0],null,{read:true,owned:false,log_date:'2026-10-27'});
  let result=await h.request('/api/issues/42/read','PATCH',{read:false,remove_log_entries:false});
  assert.equal(result.data.read,null);assert.equal(result.data.reading_log_count,2);assert.equal(result.data.user_rating,4.5);
  await h.request('/api/issues/42/read','PATCH',{read:true,edition_key:variant});
  result=await h.request('/api/issues/42/read','PATCH',{read:false,remove_log_entries:true});
  assert.equal(result.data.read,null);assert.equal(result.data.reading_log_count,0);assert.equal(result.data.user_rating,4.5);assert.equal(result.data.copies.length,2);
  assert.equal(h.repo.issue(43).reading_log_count,1);assert.ok(h.repo.issue(43).read);
});
test('reading log month pages preserve calendar dates and sort newest first across year and leap boundaries',async t=>{
  const h=await harness(t);await h.request('/api/entries','POST',add('standard',false,true));
  for(const day of ['2026-01-01','2025-12-31','2026-01-31','2024-02-29','2026-02-01'])await h.request('/api/issues/42/reading-log','POST',{edition_key:'standard',log_date:day});
  assert.deepEqual((await h.request('/api/reading-log?month=2026-01')).data.items.map(e=>e.read_date),['2026-01-31','2026-01-01']);
  assert.deepEqual((await h.request('/api/reading-log?month=2025-12')).data.items.map(e=>e.read_date),['2025-12-31']);
  assert.equal((await h.request('/api/reading-log?month=2024-02')).data.items[0].read_date,'2024-02-29');
  assert.equal((await h.request('/api/reading-log?month=2026-03')).data.items.length,0);
});
test('invalid reading dates and months fail before provider calls or state changes',async t=>{
  const h=await harness(t);
  for(const log_date of ['2026-02-29','2026-02-30','2026-13-01','2026-10-27T00:00:00Z',null,42,'0000-01-01']){
    assert.equal((await h.request('/api/entries','POST',{...add('standard'),log_date})).status,400);
  }
  assert.deepEqual(h.counts(),{lookups:0,downloads:0});assert.equal(h.repo.collection('owned').length,0);
  for(const month of ['2026-13','2026-2','nope'])assert.equal((await h.request('/api/reading-log?month='+month)).status,400);
  await h.request('/api/entries','POST',add('standard'));
  assert.equal((await h.request('/api/issues/42/read','PATCH',{read:true,edition_key:'standard',log_date:'2026-02-29'})).status,400);
  assert.equal((await h.request('/api/issues/42/read','PATCH',{read:false,log_date:'2026-10-27'})).status,400);
  assert.equal((await h.request('/api/issues/42/read','PATCH',{read:false,remove_log_entries:'yes'})).status,400);
  assert.equal(h.repo.issue(42).read,null);assert.equal(h.repo.issue(42).reading_log_count,0);
});
test('marking read and rating never create log entries implicitly; log write failures roll back read and import',async t=>{
  const h=await harness(t);
  await h.request('/api/entries','POST',add('standard',false,true));
  await h.request('/api/issues/42/rating','PATCH',{rating:5,edition_key:'standard'});
  assert.equal(h.repo.issue(42).reading_log_count,0);
  await h.request('/api/issues/42/read','PATCH',{read:false});
  h.repo.db.exec("CREATE TRIGGER reject_log BEFORE INSERT ON reading_log BEGIN SELECT RAISE(ABORT,'test failure'); END;");
  assert.equal((await h.request('/api/issues/42/read','PATCH',{read:true,edition_key:'standard',log_date:'2026-10-27'})).status,500);
  assert.equal(h.repo.issue(42).read,null);
  assert.throws(()=>h.repo.save({...essentialIssue(raw),id:43},editionsFor(raw)[0],null,{read:true,owned:true,log_date:'2026-10-27'}));
  assert.equal(h.repo.issue(43),null);
});
test('reading-log schema migration preserves old collection and logs persist after reopen',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'dangerroom-log-migration-'));let db=openDatabase(dir);
  const repo=new Repository(db);repo.save(essentialIssue(raw),editionsFor(raw)[0],null,{owned:true,read:true,rating:3});
  db.exec('DROP TABLE reading_log; PRAGMA user_version=4;');db.close();db=openDatabase(dir);
  try{
    const migrated=new Repository(db);assert.equal(migrated.issue(42).reading_log_count,0);assert.equal(migrated.issue(42).copies.length,1);assert.equal(migrated.issue(42).user_rating,3);
    migrated.setRead(42,true,'standard',{log_date:'2026-10-27'});db.close();db=openDatabase(dir);
    assert.equal(new Repository(db).issueLog(42)[0].read_date,'2026-10-27');assert.equal(db.prepare('PRAGMA user_version').get().user_version,5);
  }finally{db.close();await rm(dir,{recursive:true,force:true});}
});

test('Mark As Read can atomically save an optional half-star rating with or without a log entry',async t=>{
  const h=await harness(t);await h.request('/api/entries','POST',add('standard'));
  let response=await h.request('/api/issues/42/read','PATCH',{read:true,edition_key:'standard',rating:3.5,log_date:'2026-10-27'});
  assert.equal(response.status,200);assert.equal(response.data.user_rating,3.5);assert.ok(response.data.read);assert.equal(response.data.reading_log_count,1);assert.equal(response.data.copies.length,1);
  await h.request('/api/issues/42/read','PATCH',{read:false});
  response=await h.request('/api/issues/42/read','PATCH',{read:true,edition_key:'standard'});
  assert.equal(response.data.user_rating,3.5);assert.equal(response.data.reading_log_count,1);
  await h.request('/api/issues/42/read','PATCH',{read:false});
  for(const rating of [0,5.5,2.2,'4'])assert.equal((await h.request('/api/issues/42/read','PATCH',{read:true,edition_key:'standard',rating})).status,400);
  assert.equal(h.repo.issue(42).read,null);assert.equal(h.repo.issue(42).user_rating,3.5);
  assert.equal((await h.request('/api/issues/42/read','PATCH',{read:false,rating:4})).status,400);
  h.repo.db.exec("CREATE TRIGGER fail_read_rating_log BEFORE INSERT ON reading_log BEGIN SELECT RAISE(ABORT,'test failure'); END;");
  assert.equal((await h.request('/api/issues/42/read','PATCH',{read:true,edition_key:'standard',rating:5,log_date:'2026-10-27'})).status,500);
  assert.equal(h.repo.issue(42).read,null);assert.equal(h.repo.issue(42).user_rating,3.5);assert.equal(h.repo.issue(42).reading_log_count,1);
});
