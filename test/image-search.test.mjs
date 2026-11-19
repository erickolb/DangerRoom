import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchFilters} from '../src/metron.mjs';
import {createApp} from '../src/server.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';

test('image search validates exact hashes, camera distances and page bounds',()=>{
  assert.equal(searchFilters(new URLSearchParams({cover_hash_near:'C585EB18BF1E5423'})).toString(),'cover_hash_near=c585eb18bf1e5423&cover_hash_max_distance=14&page=1');
  for(const distance of ['10','16','20'])assert.equal(searchFilters(new URLSearchParams({cover_hash_near:'c585eb18bf1e5423',cover_hash_max_distance:distance,page:'2'})).get('page'),'2');
  for(const options of [{cover_hash_near:'nope'},{cover_hash_max_distance:'9'},{cover_hash_max_distance:'21'},{cover_hash_max_distance:'16.5'},{page:'0'},{page:'10001'}])assert.throws(()=>searchFilters(new URLSearchParams({cover_hash_near:'c585eb18bf1e5423',...options})));
});

test('successful image matches survive exhausted quota, partial enrichment is cached, and later searches reuse it',async t=>{
  const calls=[],dir=await mkdtemp(join(tmpdir(),'dangerroom-image-quota-'));
  let exhaust=false;
  const instance=createApp({dataDir:dir,metronOptions:{token:'test',interval:0,fetchImpl:async url=>{
    calls.push(url);
    const headers=exhaust?{'X-RateLimit-Burst-Remaining':'0','X-RateLimit-Burst-Reset':String(Math.ceil(Date.now()/1000)+60)}:{};
    if(url.includes('issue/?'))return Response.json({count:3,next:null,previous:null,results:[1,2,3].map(id=>({id,series:{id,name:`Series ${id}`},number:'1'}))},{headers});
    const id=Number(url.match(/series\/(\d+)\//)[1]);return Response.json({id,series_type:{id:10,name:'Trade Paperback'}},{headers});
  }}});
  instance.server.listen(0,'127.0.0.1');await once(instance.server,'listening');
  t.after(async()=>{await new Promise(r=>instance.server.close(r));await rm(dir,{recursive:true,force:true});});
  const origin=`http://127.0.0.1:${instance.server.address().port}`,path='/mobile/api/search?cover_hash_near=c585eb18bf1e5423';
  const device=instance.devices.add('Quota test'),headers={'X-Device-Id':device.deviceId,Authorization:`Bearer ${device.token}`};
  let response=await fetch(origin+path,{headers});let data=await response.json();
  assert.equal(response.status,200);assert.equal(data.results.length,3);assert.equal(calls.length,1);assert.ok(data.results.every(row=>row.series_type_pending));
  exhaust=true;
  response=await fetch(origin+'/mobile/api/metron/series/1/type',{headers});data=await response.json();
  assert.equal(response.status,200);assert.equal(data.quota_exhausted,true);assert.equal(calls.length,2);
  assert.equal((await fetch(origin+'/mobile/api/metron/series/2/type',{headers})).status,429);assert.equal(calls.length,2);
  // Simulate a later visit after quota reset. No timer resumes the previous enrichment.
  instance.repo.statePut('blocked_until',0);exhaust=false;
  data=await (await fetch(origin+path,{headers})).json();assert.equal(calls.length,3);
  assert.equal(data.results[0].series.series_type.name,'Trade Paperback');assert.equal(data.results[0].series_type_pending,false);
  assert.ok(data.results.slice(1).every(row=>row.series_type_pending));
  await fetch(origin+'/mobile/api/metron/series/1/type',{headers});assert.equal(calls.length,3,'successful earlier lookup stays cached');
  // The last available request can be the initial search itself; matches still return.
  exhaust=true;response=await fetch(origin+path,{headers});assert.equal(response.status,200);assert.equal((await response.json()).results.length,3);
});
test('only authenticated companion search can query image hashes, preserving provider ordering and paging without caching scans',async t=>{
  const calls=[],dir=await mkdtemp(join(tmpdir(),'dangerroom-image-test-'));
  const instance=createApp({dataDir:dir,metronOptions:{token:'test',interval:0,fetchImpl:async url=>{
    calls.push(url);
    return Response.json({count:3,next:'page3',previous:'page1',results:[8,3].map(id=>({id,series:{id:1,name:'Covers',volume:1,series_type:{id:1,name:'Ongoing'}},number:String(id),image:null}))});
  }}});
  instance.server.listen(0,'127.0.0.1');await once(instance.server,'listening');
  t.after(async()=>{await new Promise(r=>instance.server.close(r));await rm(dir,{recursive:true,force:true});});
  const origin=`http://127.0.0.1:${instance.server.address().port}`,path='/api/search?cover_hash_near=c585eb18bf1e5423&cover_hash_max_distance=20&page=2';
  assert.equal((await fetch(origin+path)).status,403);
  assert.equal((await fetch(origin+'/mobile'+path)).status,401);
  assert.equal(calls.length,0);
  const device=instance.devices.add('Beta scanner'),headers={'X-Device-Id':device.deviceId,Authorization:`Bearer ${device.token}`};
  const data=await (await fetch(origin+'/mobile'+path,{headers})).json();
  assert.deepEqual(data.results.map(r=>r.id),[8,3]);assert.equal(data.page,2);assert.equal(data.next,true);assert.equal(data.previous,true);
  assert.ok(calls[0].includes('issue/?cover_hash_near=c585eb18bf1e5423&cover_hash_max_distance=20&page=2'));
  await fetch(origin+'/mobile'+path,{headers});assert.equal(calls.length,2);
  assert.equal(instance.repo.db.prepare("SELECT COUNT(*) AS n FROM cache WHERE key LIKE '%cover_hash_near%'").get().n,0);
});
