import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enrichSearchSeries} from '../public/search-enrichment.js';
import {filterSearchResults} from '../public/search-filters.js';
const rows=()=>[1,1,2,3].map((id,index)=>({id:index+1,series:{id,name:`Series ${id}`,series_type:null},series_type_pending:true}));

test('background enrichment deduplicates series, updates duplicate matches together and stops after quota is consumed',async()=>{
  const data=rows(),calls=[],states=[];let updates=0;
  await enrichSearchSeries(data,{current:()=>true,request:async path=>{calls.push(path);return {series_id:1,series_type:{id:10,name:'Trade Paperback'},quota_exhausted:true};},onUpdate:()=>updates++,onState:state=>states.push(state)});
  assert.equal(calls.length,1);assert.equal(updates,1);assert.deepEqual(states,['loading','stopped']);
  assert.ok(data.slice(0,2).every(row=>row.series.series_type.id===10&&!row.series_type_pending));
  assert.ok(data.slice(2).every(row=>row.series_type_pending));
  assert.equal(filterSearchResults(data,{seriesTypes:new Set([99])}).length,2,'unresolved matches remain visible under an explicit type filter');
});
test('optional request failures preserve matches and stop without attempting another series',async()=>{
  const data=rows(),states=[];let calls=0;
  await enrichSearchSeries(data,{current:()=>true,request:async()=>{calls++;throw Error('Rate limit');},onState:state=>states.push(state)});
  assert.equal(calls,1);assert.equal(data.length,4);assert.ok(data.every(row=>row.series_type_pending));assert.deepEqual(states,['loading','stopped']);
});
test('leaving a results page while one lookup is in flight prevents updates and any further requests',async()=>{
  const data=rows();let active=true,calls=0,resolveLookup,updates=0;
  const job=enrichSearchSeries(data,{current:()=>active,request:()=>{calls++;return new Promise(resolve=>resolveLookup=resolve);},onUpdate:()=>updates++});
  active=false;resolveLookup({series_id:1,series_type:{id:10,name:'Trade Paperback'}});await job;
  assert.equal(calls,1);assert.equal(updates,0);assert.ok(data.every(row=>row.series_type_pending));
});
test('a later search enriches only what remains missing, and a supplied null is resolved rather than retried',async()=>{
  const data=rows();data[0].series_type_pending=false;data[1].series_type_pending=false;let calls=0;const states=[];
  await enrichSearchSeries(data,{current:()=>true,request:async path=>{calls++;return {series_id:Number(path.split('/')[3]),series_type:null,quota_exhausted:false};},onState:state=>states.push(state)});
  assert.equal(calls,2);assert.ok(data.every(row=>!row.series_type_pending));assert.deepEqual(states,['loading','complete']);
});
