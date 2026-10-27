import test from 'node:test';
import assert from 'node:assert/strict';
import { ratingSegments,seriesRatingChart } from '../public/series-ratings.js';
test('series rating gaps step to the next score immediately after a rated band',()=>{
  assert.deepEqual(ratingSegments([{number:2,rating:4},{number:5,rating:2}],6.5),[
    {from:0,to:1.5,rating:4,solid:false},{from:1.5,to:2.5,rating:4,solid:true},
    {from:2.5,to:4.5,rating:2,solid:false},{from:4.5,to:5.5,rating:2,solid:true},
    {from:5.5,to:6.5,rating:2,solid:false}]);
});
test('series chart requires two ratings and labels recorded points and half-star scale',()=>{
  assert.equal(seriesRatingChart({max_issue:6,points:[{number:2,rating:4}]}),'');
  const svg=seriesRatingChart({max_issue:6,points:[{number:2,rating:4},{number:5,rating:2}]});
  assert.equal((svg.match(/class="rating-dot"/g)||[]).length,2);
  assert.match(svg,/Issue #2: 4 \/ 5/);assert.match(svg,/>0.0<|>0.5</);assert.match(svg,/>5.0</);
  assert.deepEqual(ratingSegments([{number:1,rating:3},{number:2,rating:5}],2.5).filter(s=>s.solid).map(s=>[s.from,s.to]),[[0.5,1.5],[1.5,2.5]]);
});
