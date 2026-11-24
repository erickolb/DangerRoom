import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coverArtwork,coverPlaceholder,installCoverStates} from '../public/cover-art.js';

test('cover image events and cached insertion settle without changing unrelated images',()=>{
  const listeners=new Map();let notify,disconnected=false;
  const image=(complete,naturalWidth)=>({complete,naturalWidth,outerHTML:'',
    matches:selector=>selector==='img.cover-loading',classList:new Set(['cover','cover-loading','thumbnail']),
  });
  const cached=image(true,100),pending=image(false,0),broken=image(true,0);
  for(const img of [cached,pending,broken])img.classList.remove=name=>img.classList.delete(name);
  const doc={documentElement:{},querySelectorAll:()=>[cached],
    addEventListener:(name,fn,capture)=>{assert.equal(capture,true);listeners.set(name,fn);},
    removeEventListener:name=>listeners.delete(name),
  };
  class Observer{constructor(fn){notify=fn;}observe(){}disconnect(){disconnected=true;}}
  const stop=installCoverStates(doc,Observer);
  assert.equal(cached.classList.has('cover-loading'),false);
  notify([{addedNodes:[pending]}]);assert.equal(pending.outerHTML,'');
  pending.complete=true;pending.naturalWidth=100;
  listeners.get('load')({target:pending});assert.equal(pending.classList.has('cover-loading'),false);
  listeners.get('error')({target:broken});assert.match(broken.outerHTML,/missing-cover thumbnail/);
  assert.match(broken.outerHTML,/aria-label="Cover unavailable"/);
  assert.doesNotThrow(()=>listeners.get('error')({target:{}}));
  const insertedFailure=image(true,0);notify([{addedNodes:[insertedFailure]}]);assert.match(insertedFailure.outerHTML,/missing-cover/);
  stop();assert.equal(listeners.size,0);assert.equal(disconnected,true);
});

test('pending and paused cover states remain distinct from known missing artwork',()=>{
  assert.match(coverPlaceholder('loading'),/aria-label="Cover loading"/);
  assert.match(coverPlaceholder('paused'),/aria-label="Cover loading paused"/);
  assert.match(coverArtwork(null),/missing-cover/);
  assert.match(coverArtwork('/image?x="','<Cover>'),/src="\/image\?x=&quot;"/);
  assert.match(coverArtwork('/image','<Cover>'),/alt="&lt;Cover&gt;"/);
});

test('subscription list waits for final pagination and pauses unknown covers on provider failure',async()=>{
  const oldWindow=globalThis.window,oldDocument=globalThis.document;
  globalThis.window={addEventListener(){}};
  globalThis.document={addEventListener(){},removeEventListener(){},querySelectorAll:()=>[]};
  try{
    const {subscriptionsPage}=await import('../public/subscriptions.js');
    const target={innerHTML:'',querySelectorAll:()=>[]},status={textContent:''};
    const app={innerHTML:'',querySelector:selector=>selector==='#subscription-results'?target:status};
    const requests=[];
    const api=async path=>path==='/subscriptions'?{items:[{id:1,name:'One'},{id:2,name:'Two'}]}:new Promise((resolve,reject)=>requests.push({resolve,reject}));
    const task=subscriptionsPage(app,new URLSearchParams('view=list'),api,()=>true,()=>{},()=>{},()=> '');
    const tick=()=>new Promise(resolve=>setImmediate(resolve));await tick();
    assert.equal((target.innerHTML.match(/loading-cover/g)||[]).length,2);
    requests.shift().resolve({results:[],next:'page2'});await tick();
    assert.equal((target.innerHTML.match(/loading-cover/g)||[]).length,2);
    requests.shift().resolve({results:[],next:null});await tick();
    assert.equal((target.innerHTML.match(/missing-cover/g)||[]).length,1);
    assert.equal((target.innerHTML.match(/loading-cover/g)||[]).length,1);
    requests.shift().reject(Error('Quota exhausted'));await task;
    assert.equal((target.innerHTML.match(/missing-cover/g)||[]).length,1);
    assert.equal((target.innerHTML.match(/paused-cover/g)||[]).length,1);
    assert.doesNotMatch(target.innerHTML,/loading-cover/);
  }finally{globalThis.window=oldWindow;globalThis.document=oldDocument;}
});
