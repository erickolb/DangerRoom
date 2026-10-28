import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../src/server.mjs';
import { chooseCovers } from '../public/slideshow.js';

async function app(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'dangerroom-mobile-'));
  const instance = createApp({ dataDir, ...options });
  instance.server.listen(0, '127.0.0.1'); await once(instance.server, 'listening');
  t.after(async () => { await new Promise(resolve => instance.server.close(resolve)); await rm(dataDir, { recursive: true, force: true }); });
  const origin = `http://127.0.0.1:${instance.server.address().port}`;
  return { ...instance, request: (path, init = {}) => fetch(origin + path, init) };
}
const credentials = device => ({ 'X-Device-Id': device.deviceId, Authorization: `Bearer ${device.token}` });
test('mobile requires a live allowlisted credential and revocation covers both route prefixes', async t => {
  const h = await app(t), device = h.devices.add('Tablet');
  assert.equal((await h.request('/mobile/api/collection')).status, 401);
  assert.equal((await h.request('/mobile/')).status, 401);
  assert.equal((await h.request('/mobile/api/health', { headers: credentials(device) })).status, 200);
  assert.equal((await h.request('/mobile/api/collection', { headers: credentials(device) })).status, 200);
  assert.equal((await h.request('/api/collection', { headers: { ...credentials(device), Authorization: 'Bearer wrong' } })).status, 401);
  const row = h.repo.db.prepare('SELECT * FROM devices').get();
  assert.notEqual(row.token_hash, device.token);
  assert.ok(!JSON.stringify(h.devices.list()).includes(device.token));
  h.devices.revoke(device.deviceId);
  for (const path of ['/mobile/api/collection','/api/collection','/mobile/covers/missing.png']) assert.equal((await h.request(path, { headers: credentials(device) })).status, 401);
});
test('public API and covers require browser session or device when lockdown is enabled', async t => {
  const adminToken = 'test-admin-secret-'.repeat(4), h = await app(t, { requireAuth: true, adminToken });
  for (const path of ['/api/collection','/api/search?q=Batman','/api/reading-log?month=2026-10','/covers/missing.png']) assert.equal((await h.request(path)).status, 401);
  assert.equal((await h.request('/api/health')).status, 200);
  const login = await h.request('/api/session', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token:adminToken}) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);
  assert.equal((await h.request('/api/collection',{headers:{Cookie:cookie.split(';')[0]}})).status,200);
  assert.equal((await h.request('/mobile/api/collection',{headers:{Cookie:cookie.split(';')[0]}})).status,401);
  await h.request('/api/session',{method:'DELETE',headers:{Cookie:cookie.split(';')[0]}});
  assert.equal((await h.request('/api/collection',{headers:{Cookie:cookie.split(';')[0]}})).status,401);
  const device=h.devices.add('Phone');
  assert.equal((await h.request('/api/collection',{headers:credentials(device)})).status,200);
  const bad = await h.request('/api/session', { method:'POST', headers:{'Content-Type':'application/json',Origin:'https://elsewhere.example'}, body:JSON.stringify({token:adminToken}) });
  assert.equal(bad.status,403);
});
test('browser sign-in limits guessing and rejects missing keys at startup', async t => {
  const h=await app(t,{requireAuth:true,adminToken:'x'.repeat(64)});
  for(let i=0;i<10;i++)assert.equal((await h.request('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"token":"wrong"}'})).status,401);
  assert.equal((await h.request('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"token":"wrong"}'})).status,429);
});
test('slideshow uses unique owned editions, never wants or read-only covers',async t=>{
  const h=await app(t), edition={key:'standard',name:'Standard',source_image:null},issue={id:42,series:{id:4,name:'Heroes',year_began:2024},number:'1'};
  const file='a'.repeat(64)+'.png';
  h.repo.save(issue,edition,file,{owned:true,read:false});h.repo.save(issue,edition,file,{owned:true,read:false});
  h.repo.save({...issue,id:43},edition,file,{owned:false,read:true});
  const result=await (await h.request('/api/slideshow')).json();
  assert.equal(result.items.length,1);assert.equal(result.items[0].issue.id,42);assert.equal(result.items[0].edition.cover_file,file);
});
test('camera lookup preserves variants and places exact UPC first, with title fallback and bounded detail calls',async t=>{
  const calls=[],issue={id:42,series:{id:4,name:'Heroes'},number:'1',editions:[{key:'standard',upc:'123456789012'},{key:'variant-'+ 'a'.repeat(64),name:'Cover B',upc:'12345678901200121'}]};
  const metron={configured:true,search:async params=>{calls.push(params.toString());return{count:1,page:1,next:false,results:params.get('upc')==='99999999'?[]:[{id:42}]};},issue:async()=>issue};
  const h=await app(t,{metron});
  const result=await(await h.request('/api/camera-search?upc=12345678901200121&q=Heroes')).json();
  assert.equal(result.items[0].edition.name,'Cover B');assert.equal(result.items[0].barcode_match,true);assert.equal(result.items[1].barcode_match,false);
  await h.request('/api/camera-search?upc=99999999&q=Heroes');assert.equal(calls.at(-1),'q=Heroes');
});
test('gallery selection retains eligible remembered covers, fills gaps, excludes covers, and respects maximum',()=>{
  const items=Array.from({length:6},(_,i)=>({issue:{id:i+1},edition:{key:'standard'}}));
  const result=chooseCovers(items,{maximum:3,remember:true,randomSelection:false,shuffle:false},['2:standard'],['2:standard','4:standard']);
  assert.deepEqual(result.selected,['4:standard','1:standard','3:standard']);
  assert.equal(chooseCovers(items,{maximum:1,remember:false,randomSelection:true,shuffle:true},[],[],()=>0).rows.length,1);
});
test('camera pagination expands five issues at a time without dropping remaining provider results',async t=>{
  const fetched=[];
  const h=await app(t,{metron:{configured:true,search:async()=>({count:12,page:1,next:false,results:Array.from({length:12},(_,i)=>({id:i+1}))}),issue:async id=>{fetched.push(id);return{id,editions:[{key:'standard'}]};}}});
  const first=await(await h.request('/api/camera-search?q=Heroes')).json();
  assert.deepEqual(fetched,[1,2,3,4,5]);assert.equal(first.next_page,1);assert.equal(first.next_cover_page,2);
  const second=await(await h.request('/api/camera-search?q=Heroes&cover_page=2')).json();
  assert.deepEqual(second.items.map(r=>r.issue.id),[6,7,8,9,10]);
  const third=await(await h.request('/api/camera-search?q=Heroes&cover_page=3')).json();
  assert.deepEqual(third.items.map(r=>r.issue.id),[11,12]);assert.equal(third.next,false);
});
