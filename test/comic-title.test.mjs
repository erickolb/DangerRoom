import test from 'node:test';import assert from 'node:assert/strict';
import {comicTitle,comicTitleText,formatBadge} from '../public/comic-title.js';
test('comic titles place badges between title and number with expanded alt text',()=>{
  const issue={series:{name:'Absolute Superman',year_began:2025,series_type:{id:10,name:'Trade Paperback'}},number:'1'};
  const title=comicTitle(issue);assert.match(title,/Absolute Superman <img[^>]+alt="Trade Paperback"> <span[^>]+>#1<\/span>/);
  assert.equal(comicTitleText(issue),'Absolute Superman Trade Paperback #1');
  issue.series.series_type={id:9,name:'Hardcover'};assert.match(comicTitle(issue),/format-hc.png" alt="Hardcover"/);
  issue.series.series_type={name:'Omnibus'};assert.match(comicTitle(issue),/format-omni.png" alt="Omnibus"/);assert.equal(comicTitleText(issue),'Absolute Superman Omnibus');assert.doesNotMatch(comicTitle(issue),/comic-number|#1/);
  issue.series.series_type={id:11,name:'Limited Series'};assert.doesNotMatch(comicTitle(issue),/<img/);
  assert.deepEqual(formatBadge('HC'),{asset:'hc',label:'Hardcover'});assert.deepEqual(formatBadge('TPB'),{asset:'tpb',label:'Trade Paperback'});
});
test('title text is escaped and reading-log titles can retain the series year',()=>{
  const issue={series:{name:'<script> & "Series"',year_began:2025,series_type:{name:'Trade Paperback'}},number:'<1>'};
  const title=comicTitle(issue,{year:true});assert.match(title,/&lt;script&gt; &amp; &quot;Series&quot; \(2025\)/);assert.match(title,/#&lt;1&gt;/);assert.doesNotMatch(title,/<script>/);
});

test('Graphic Novel badges replace trailing GN only on Graphic Novel series',()=>{
  const issue={series:{name:'White Sand GN',series_type:{name:'Graphic Novel'}},number:'1'};
  assert.deepEqual(formatBadge('GN'),{asset:'gn',label:'Graphic Novel'});
  assert.match(comicTitle(issue),/White Sand <img[^>]+format-gn.png" alt="Graphic Novel"> <span[^>]+>#1/);
  assert.equal(comicTitleText(issue),'White Sand Graphic Novel #1');
  issue.series.name='White Sand';assert.equal(comicTitleText(issue),'White Sand Graphic Novel #1');
  issue.series.series_type={name:'Limited Series'};issue.series.name='White Sand GN';
  assert.equal(comicTitleText(issue),'White Sand GN #1');
});
