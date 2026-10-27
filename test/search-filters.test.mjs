import test from 'node:test';import assert from 'node:assert/strict';
import {selectedSeriesNames,seriesNameOptions,selectedSeriesTypes,filterSearchResults,seriesTypeOptions} from '../public/search-filters.js';
const rows=[{owned:true,series:{series_type:{id:10,name:'Trade Paperback'}}},{owned:false,series:{series_type:{id:13,name:'Single Issue'}}},{owned:false,series:{series_type:{id:10,name:'Trade Paperback'}}},{owned:false,series:{series_type:null}}];
test('series-type filters are OR selections, combine with hide-owned, and an empty selection shows all types',()=>{
 assert.equal(filterSearchResults(rows).length,4);
 assert.deepEqual(filterSearchResults(rows,{seriesTypes:new Set([10])}),[rows[0],rows[2]]);
 assert.deepEqual(filterSearchResults(rows,{seriesTypes:new Set([10]),hideOwned:true}),[rows[2]]);
 assert.equal(filterSearchResults(rows,{seriesTypes:new Set([10,13])}).length,3);
 assert.deepEqual(filterSearchResults(rows,{seriesTypes:new Set([0])}),[rows[3]]);
});
test('series filter options include catalog types absent on this page and preserve selected IDs',()=>{
 const selection=selectedSeriesTypes(new URLSearchParams('q=Test&series_types=10,13,10,bad,-1&hide_owned=1'));
 assert.deepEqual([...selection],[10,13]);
 const options=seriesTypeOptions(rows,[{id:9,name:'Hardcover'}],new Set([99]));
 assert.ok(options.some(type=>type.id===9&&type.name==='Hardcover'));assert.ok(options.some(type=>type.id===99));assert.equal(options.filter(type=>type.id===10).length,1);
});

test('series names match whole titles, OR together, and combine with other filters',()=>{
 const rows=[{owned:false,series:{name:'The Darkness',series_type:{id:13}}},{owned:true,series:{name:'The Darkness',series_type:{id:13}}},{owned:false,series:{name:'Army of the Darkness',series_type:{id:13}}}];
 const params=new URLSearchParams();params.append('series_name_filter','The Darkness');params.append('series_name_filter','Name, with comma & symbols');
 const names=selectedSeriesNames(params);assert.equal(names.size,2);
 assert.deepEqual(filterSearchResults(rows,{seriesNames:names,hideOwned:true,seriesTypes:new Set([13])}),[rows[0]]);
 assert.deepEqual(seriesNameOptions(rows,names),['Army of the Darkness','Name, with comma & symbols','The Darkness']);
 assert.equal(filterSearchResults(rows,{seriesNames:new Set(['The Darkness','Army of the Darkness'])}).length,3);
});
