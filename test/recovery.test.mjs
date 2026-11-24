import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodeRecovery,safeRoute,createRecovery,captureFields,restoreFields,MAX_RECOVERY_BYTES} from '../public/recovery.js';
const now=Date.now(),scope='device-a';
const snapshot=(overrides={})=>({version:1,scope,at:now,route:'#/?mode=upc&upc=001234567890',scroll:125,fields:[],...overrides});
test('completed barcode and leading zeros survive decoding',()=>assert.equal(decodeRecovery(JSON.stringify(snapshot()),scope,now).route,snapshot().route));
test('playback snapshots round trip both playing and paused, rejecting nonboolean state',async()=>{
  for(const playing of [true,false]){
    const f=fixture(JSON.stringify(snapshot({route:'#/slideshow',gallery:'2:standard',galleryPlaying:playing})));
    assert.deepEqual(f.recovery.restoredGallery,{cover:'2:standard',playing});
    f.recovery.begin();f.recovery.gallery({cover:'2:standard',playing});await f.recovery.complete(()=>true);
    assert.equal(f.read().galleryPlaying,playing);
  }
  assert.equal(decodeRecovery(JSON.stringify(snapshot({galleryPlaying:'true'})),scope,now),null);
});
for(const [name,overrides] of [
  ['unknown version',{version:2}],['different device',{scope:'device-b'}],['expired state',{at:now-8*86400000}],
  ['future timestamp',{at:now+120000}],['external route',{route:'https://example.com'}],['protocol relative route',{route:'#//example.com'}],
  ['unsupported destination',{route:'#/admin'}],['invalid scroll',{scroll:-1}],['oversized field',{fields:[{key:'q',value:'a'.repeat(4097),checked:false}]}],
  ['malformed field',{fields:[null]}],['invalid issue',{read:{id:-1,edition:'standard',logOnly:true}}],['invalid gallery',{gallery:{}}],
])test(`rejects ${name}`,()=>assert.equal(decodeRecovery(JSON.stringify(snapshot(overrides)),scope,now),null));
test('corrupt, null and oversized storage fail closed',()=>{for(const raw of ['{','null','x'.repeat(MAX_RECOVERY_BYTES+1)])assert.equal(decodeRecovery(raw,scope,now),null);});
test('all supported destinations accept query strings',()=>{for(const route of ['#/home','#/collection?q=Heroes','#/wants','#/subscriptions?view=missing','#/reading-log?month=2026-11','#/issues/12?edition=standard','#/slideshow','#/image-cover-search'])assert.ok(safeRoute(route),route);});
function fixture(raw,{hash='#/home',throwStorage=false,enabled=true}={}) {
  const stored=new Map(raw?[['dangerroom-recovery:'+scope,raw]]:[]);
  const document=new EventTarget();document.querySelectorAll=()=>[];document.querySelector=()=>null;
  const window=new EventTarget();window.Event=Event;window.location={hash};window.scrollY=0;window.setTimeout=setTimeout;
  window.scrollTo=(_,y)=>{window.scrollY=y;};window.requestAnimationFrame=fn=>fn();
  window.history={replaceState(_,__,value){window.location.hash=value;}};
  window.localStorage={getItem:key=>stored.get(key),setItem(key,value){if(throwStorage)throw Error('full');stored.set(key,value);}};
  const dialogs=[];
  const recovery=createRecovery({window,document,scope,enabled,restoreDialogs:async value=>dialogs.push(value)});
  return {window,document,recovery,stored,dialogs,read:()=>JSON.parse(stored.get('dangerroom-recovery:'+scope))};
}
test('native startup restores destination and scroll after fresh rendering',async()=>{
  const f=fixture(JSON.stringify(snapshot()));assert.equal(f.window.location.hash,snapshot().route);
  f.recovery.begin();await f.recovery.complete(()=>true);assert.equal(f.window.scrollY,125);assert.equal(f.dialogs.length,1);
});
test('an explicit different deep link wins over recovery',async()=>{
  const f=fixture(JSON.stringify(snapshot()),{hash:'#/issues/99'});f.recovery.begin();await f.recovery.complete(()=>true);
  assert.equal(f.window.location.hash,'#/issues/99');assert.equal(f.dialogs.length,0);
});
test('persists submitted destination before its network request finishes',()=>{
  const f=fixture();f.window.location.hash='#/?mode=upc&upc=00123';f.recovery.begin();assert.equal(f.read().route,f.window.location.hash);
});
test('in-flight scanner input does not replace the last completed checkpoint',async()=>{
  const f=fixture();f.recovery.begin();await f.recovery.complete(()=>true);f.recovery.begin();
  const saved=f.read();f.window.location.hash='#/?mode=upc';f.recovery.save();assert.deepEqual(f.read(),saved);
});
test('storage failures do not prevent navigation or rendering',async()=>{
  const f=fixture(null,{throwStorage:true});f.recovery.begin();await f.recovery.complete(()=>true);assert.doesNotThrow(()=>f.recovery.save());
});
test('ordinary browser sessions do not opt into companion recovery',async()=>{
  const f=fixture(null,{enabled:false});f.recovery.begin();await f.recovery.complete(()=>true);assert.equal(f.stored.size,0);
});
test('stale render completion cannot overwrite the newer route',async()=>{
  const f=fixture();f.recovery.begin();f.window.location.hash='#/collection';f.recovery.begin();await f.recovery.complete(()=>false);
  assert.equal(f.read().route,'#/collection');
});
test('reading draft is removed before a submitted mutation can be replayed',async()=>{
  const f=fixture();f.recovery.begin();await f.recovery.complete(()=>true);f.recovery.read({id:1,edition:'standard',logOnly:true});
  assert.equal(f.read().read.id,1);f.recovery.read(null);assert.equal(f.read().read,null);
});
test('interrupted native capture returns to a safe home screen',()=>{
  const f=fixture(JSON.stringify(snapshot({route:'#/image-cover-search'})));assert.equal(f.window.location.hash,'#/home');
});
test('field restoration changes values without firing input or submit events',()=>{
  const inputs=[{name:'q',type:'search',value:'draft',checked:false},{id:'record-reading',type:'checkbox',value:'on',checked:true},{name:'secret',type:'password',value:'private'},{name:'photo',type:'file',value:'image'}];
  const form={id:'search-form',querySelectorAll:()=>inputs};const document={querySelectorAll:()=>[form]};
  const fields=captureFields(document);assert.equal(fields.length,2);assert.ok(!JSON.stringify(fields).includes('private'));
  inputs[0].value='';inputs[1].checked=false;restoreFields(document,fields);assert.equal(inputs[0].value,'draft');assert.equal(inputs[1].checked,true);
});
test('failed fresh-data request preserves the pending recovery for retry',async()=>{
  const f=fixture(JSON.stringify(snapshot()));f.recovery.begin();f.recovery.fail();f.recovery.save();assert.equal(f.read().scroll,125);
  f.recovery.begin();await f.recovery.complete(()=>true);assert.equal(f.window.scrollY,125);
});
test('leaving an unavailable recovered destination replaces the old checkpoint',async()=>{
  const f=fixture(JSON.stringify(snapshot()));f.recovery.begin();f.recovery.fail();f.window.location.hash='#/collection';f.recovery.begin();
  await f.recovery.complete(()=>true);assert.equal(f.read().route,'#/collection');assert.equal(f.dialogs.length,0);
});
