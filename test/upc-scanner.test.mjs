import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createUPCScanner, matchingEdition} from '../public/upc-scanner.js';
import {searchFilters} from '../src/metron.mjs';
const key=(key,extra={})=>({type:'keydown',key,ctrlKey:false,metaKey:false,altKey:false,...extra});
function harness(){
 const scans=[],errors=[];let starts=0,expire;
 const scanner=createUPCScanner({onStart:()=>starts++,onScan:v=>scans.push(v),onError:e=>errors.push(e),schedule:fn=>(expire=fn,1),unschedule:()=>{}});
 return {scanner,scans,errors,get starts(){return starts;},timeout:()=>expire()};
}
test('UPC search splits at 12 digits, preserving zeros and excluding title filters in UPC mode',()=>{
 for(const value of ['0','001234','759606215607'])assert.equal(searchFilters(new URLSearchParams({upc:value})).get('upc_starts_with'),value);
 for(const value of ['0123456789012','75960621560700111'])assert.equal(searchFilters(new URLSearchParams({upc:value})).get('upc'),value);
 const filters=searchFilters(new URLSearchParams({mode:'upc',upc:'75960621560700111',q:'ignored',number:'2',year:'2026'}));
 assert.equal(filters.has('series_name'),false);assert.equal(filters.has('number'),false);assert.equal(filters.has('series_year_began'),false);
 for(const upc of ['123x','1'.repeat(19),'12 34'])assert.throws(()=>searchFilters(new URLSearchParams({mode:'upc',upc})));
 assert.throws(()=>searchFilters(new URLSearchParams({mode:'upc',q:'title'})));
});
test('scan framing handles literal STX and Ctrl+B, Enter release, repeated scans and ordinary typing',()=>{
 const h=harness();assert.equal(h.scanner.handle(key('a')),false);
 for(const prefix of [key('\u0002'),key('b',{ctrlKey:true})]){
  assert.equal(h.scanner.handle(prefix),true);
  for(const digit of '00123456789000111')h.scanner.handle(key(digit));
  h.scanner.handle(key('Enter'));
  assert.equal(h.scanner.handle({...key('Enter'),type:'keyup'}),true);
 }
 assert.equal(h.starts,2);assert.deepEqual(h.scans,['00123456789000111','00123456789000111']);
 assert.equal(h.scanner.handle(key('Enter')),false);
});
test('invalid frames cannot search; timeout, cancellation and a fresh prefix recover',()=>{
 const h=harness();
 for(const value of ['','123x','1'.repeat(19)]){h.scanner.handle(key('\u0002'));for(const d of value)h.scanner.handle(key(d));h.scanner.handle(key('Enter'));}
 assert.equal(h.scans.length,0);assert.equal(h.errors.length,3);
 h.scanner.handle(key('\u0002'));h.scanner.handle(key('1'));h.timeout();assert.equal(h.scanner.active,false);
 h.scanner.handle(key('\u0002'));h.scanner.handle(key('1'));h.scanner.handle(key('\u0002'));h.scanner.handle(key('2'));h.scanner.handle(key('Enter'));assert.deepEqual(h.scans,['2']);
 h.scanner.handle(key('\u0002'));h.scanner.handle(key('Escape'));assert.equal(h.scanner.active,false);
});
test('only a unique exact UPC selects an edition, never a partial prefix',()=>{
 const editions=[{key:'standard',upc:'75960621560700111'},{key:'variant',upc:'75960621560700121'}];
 assert.equal(matchingEdition(editions,'75960621560700121'),'variant');assert.equal(matchingEdition(editions,'759606215607'),null);
 assert.equal(matchingEdition([...editions,{key:'duplicate',upc:editions[1].upc}],editions[1].upc),null);
});
