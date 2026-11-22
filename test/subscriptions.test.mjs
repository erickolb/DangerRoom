import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {openDatabase,Repository} from '../src/database.mjs';
import {createApp} from '../src/server.mjs';
import {subscriptionWeek,subscriptionIssues,subscriptionThumbnail} from '../public/subscription-dates.js';

test('Sunday–Saturday boundaries include Sunday and Saturday, across months and leap years',()=>{
  assert.deepEqual(subscriptionWeek('2026-11-22'),{start:'2026-11-22',end:'2026-11-28'});
  assert.deepEqual(subscriptionWeek('2026-11-28'),{start:'2026-11-22',end:'2026-11-28'});
  assert.deepEqual(subscriptionWeek('2027-01-01'),{start:'2026-12-27',end:'2027-01-02'});
  assert.deepEqual(subscriptionWeek('2024-02-29'),{start:'2024-02-25',end:'2024-03-02'});
  assert.throws(()=>subscriptionWeek('2026-02-30'));
  const rows=[['2026-11-21',false],['2026-11-22',false],['2026-11-28',true],['2026-11-29',false],[null,false],['2026-11-20',true]]
    .map(([store_date,owned],id)=>({id,store_date,owned,series:{name:'Series'}}));
  assert.deepEqual(subscriptionIssues(rows,'week','2026-11-25').map(r=>r.id),[1,2]);
  assert.deepEqual(subscriptionIssues(rows,'upcoming','2026-11-25').map(r=>r.id),[3]);
  assert.deepEqual(subscriptionIssues(rows,'missing','2026-11-25').map(r=>r.id),[0]);
  assert.equal(subscriptionThumbnail(rows,'2026-11-25').id,2);
  assert.equal(subscriptionThumbnail(rows,'2026-12-01').id,3);
});

test('series subscription is independent, persistent, and prefers first wanted then collected variant',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'dangerroom-subs-repo-'));let db=openDatabase(dir);
  t.after(async()=>{db.close();await rm(dir,{recursive:true,force:true});});
  let repo=new Repository(db);
  const series={id:8,name:'Heroes',volume:1,year_began:2026};
  const issue={id:5,series,number:'1',cover_date:'2027-01-01'};
  const cover=key=>({key,name:key,source_image:null});
  repo.save(issue,cover('variant-owned'),'owned.png',{owned:true,read:false});
  repo.addWant(issue,cover('standard'),null);
  repo.subscribe(series);repo.subscribe(series);
  assert.equal(repo.subscriptions().length,1);
  assert.equal(repo.issue(5).subscribed,true);
  assert.equal(repo.subscriptionCover(5),null,'release cards use standard unless a variant is wanted');
  assert.equal(repo.subscriptionCover(5,{collected:true}).key,'variant-owned');
  repo.addWant(issue,cover('variant-first'),'first.png');repo.addWant(issue,cover('variant-second'),'second.png');
  assert.equal(repo.subscriptionCover(5).key,'variant-first');
  assert.equal(repo.subscriptionCover(5,{collected:true}).key,'variant-first');
  db.close();db=openDatabase(dir);repo=new Repository(db);
  assert.equal(repo.isSubscribed(8),true);repo.unsubscribe(8);
  assert.equal(repo.issue(5).subscribed,false);
  assert.equal(repo.issue(5).copies.length,1);assert.equal(repo.wantList().length,3);
});

test('subscription API decorates search and paginated releases without importing inventory; invalid status fails',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'dangerroom-subs-api-')),calls=[];
  const series={id:8,name:'Heroes',volume:1,year_began:2026};
  const item={id:5,series,number:'1',store_date:'2026-11-25',cover_date:'2027-01-01',image:null};
  const app=createApp({dataDir:dir,metronOptions:{token:'test',interval:0,fetchImpl:async input=>{
    const url=new URL(input);calls.push(url);
    if(url.pathname==='/api/series/8/')return Response.json(series);
    if(url.pathname==='/api/issue/')return Response.json({count:2,next:url.searchParams.get('page')==='2'?null:'https://metron.cloud/api/issue/?page=2',results:[item]});
    throw Error('Unexpected provider call');
  }}});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));await rm(dir,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${app.server.address().port}/api`;
  const device=app.devices.add('Subscription API test');
  const mobileBase=base.replace('/api','/mobile/api');
  const headers={'Content-Type':'application/json','X-Device-Id':device.deviceId,Authorization:`Bearer ${device.token}`};
  assert.equal((await fetch(mobileBase+'/subscriptions')).status,401);
  assert.equal((await fetch(mobileBase+'/subscriptions/8',{method:'PUT',headers,body:JSON.stringify({subscribed:true})})).status,200);
  assert.equal((await fetch(mobileBase+'/subscriptions/8/issues',{headers})).status,200);
  const put=body=>fetch(base+'/subscriptions/8',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await put({subscribed:'yes'})).status,400);
  assert.equal((await put({subscribed:true})).status,200);
  const search=await (await fetch(base+'/search?q=Heroes')).json();assert.equal(search.results[0].subscribed,true);
  const first=await (await fetch(base+'/subscriptions/8/issues')).json();assert.equal(first.next,true);assert.equal(first.results[0].edition.key,'standard');
  const second=await (await fetch(base+'/subscriptions/8/issues?page=2')).json();assert.equal(second.next,false);
  assert.equal(calls.at(-1).searchParams.get('series_id'),'8');assert.equal(calls.at(-1).searchParams.get('page'),'2');
  assert.equal(app.repo.issue(5),null);assert.equal(app.repo.wantList().length,0);
  const before=calls.length;await fetch(base+'/subscriptions/8/issues');assert.equal(calls.length,before,'reuse cached pages');
  await fetch(base+'/subscriptions/8/issues?view=week&today=2026-11-25');
  assert.equal(calls.at(-1).searchParams.get('store_date_range_after'),'2026-11-22');
  assert.equal(calls.at(-1).searchParams.get('store_date_range_before'),'2026-11-28');
  await fetch(base+'/subscriptions/8/issues?view=upcoming&today=2026-11-25');
  assert.equal(calls.at(-1).searchParams.get('store_date_range_after'),'2026-11-29');
  await fetch(base+'/subscriptions/8/issues?view=missing&today=2026-11-25');
  assert.equal(calls.at(-1).searchParams.get('store_date_range_before'),'2026-11-21');
  assert.equal((await fetch(base+'/subscriptions/8/issues?view=week&today=2026-02-30')).status,400);
  app.repo.statePut('blocked_until',Date.now()+60000);
  assert.equal((await fetch(base+'/subscriptions/8/issues?page=3')).status,429);
  assert.equal((await put({subscribed:false})).status,200,'unsubscribe remains available at quota exhaustion');
  assert.equal((await fetch(base+'/subscriptions/8/issues')).status,404);
});
