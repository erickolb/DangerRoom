import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createApp} from '../src/server.mjs';
import {openDatabase,Repository} from '../src/database.mjs';

test('upgrade removes retained scan data and hash-search cache while preserving collection data',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'dangerroom-retire-'));
  let db;
  try{
    db=openDatabase(dir);const repo=new Repository(db);
    repo.save({id:42,series:{id:4,name:'Heroes',year_began:2024},number:'1'},{key:'standard',name:'Standard',source_image:null},null,{owned:true,read:true,rating:4});
    db.exec('CREATE TABLE scan_captures (id INTEGER PRIMARY KEY,image BLOB);PRAGMA user_version=6');
    db.prepare('INSERT INTO scan_captures VALUES (1,?)').run(Buffer.from('retired photograph'));
    repo.cachePut('issue/?cover_hash=a8c2de64d3cf1a2a&page=1',{results:[]},60000);
    repo.cachePut('issue/42/',{id:42},60000);db.close();
    db=openDatabase(dir);const upgraded=new Repository(db);
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='scan_captures'").get(),undefined);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version,7);
    assert.equal(upgraded.cacheGet('issue/?cover_hash=a8c2de64d3cf1a2a&page=1'),null);
    assert.equal(upgraded.cacheGet('issue/42/').id,42);
    assert.equal(upgraded.issue(42).copies.length,1);assert.equal(upgraded.issue(42).user_rating,4);assert.ok(upgraded.issue(42).read);
  }finally{db?.close();await rm(dir,{recursive:true,force:true});}
});
test('retired capture routes and assets return 404 and the mobile menu has five working sections',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'dangerroom-no-camera-'));let instance;
  try{
    instance=createApp({dataDir:dir,metron:{configured:true,search:async()=>{throw Error('Retired routes must not call Metron');}}});
    instance.server.listen(0,'127.0.0.1');await once(instance.server,'listening');
    const device=instance.devices.add('Upgraded Hardlight');
    const headers={'X-Device-Id':device.deviceId,Authorization:`Bearer ${device.token}`};
    const origin=`http://127.0.0.1:${instance.server.address().port}`;
    for(const path of ['/api/camera-search?upc=76194138788800621','/api/scan-captures','/api/scan-captures/1/image','/camera.svg']){
      assert.equal((await fetch(origin+path,{headers})).status,404);
      assert.equal((await fetch(origin+'/mobile'+path,{headers})).status,404);
    }
    assert.equal((await fetch(origin+'/mobile/api/scan-captures',{method:'POST',headers:{...headers,'Content-Type':'image/png'},body:'old upload'})).status,404);
    const mobile=await readFile(new URL('../public/mobile.js',import.meta.url),'utf8');
    assert.doesNotMatch(mobile,/camera|scanOcrEnabled|scanSettings/);
    for(const label of ['Want List','My Collection','Search Metron','Cover Slideshow','Reading Log'])assert.ok(mobile.includes(label));
    const manifest=await readFile(new URL('../android/app/src/main/AndroidManifest.xml',import.meta.url),'utf8');
    assert.doesNotMatch(manifest,/camera|IMAGE_CAPTURE|FileProvider|photos/);
  }finally{if(instance)await new Promise(resolve=>instance.server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
