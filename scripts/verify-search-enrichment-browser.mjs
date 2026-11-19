import {createApp} from '../src/server.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const dir=await mkdtemp(join(tmpdir(),'dangerroom-enrichment-ui-')),calls=[];
let releaseFirst,releaseSecond,browser;
const rows=[100,200,300].map((id,i)=>({id:i+11,series:{id,name:`Cover Series ${i+1}`,volume:1},number:'1',image:null}));
const instance=createApp({dataDir:dir,metronOptions:{token:'test',interval:0,fetchImpl:async url=>{
  calls.push(url);
  if(url.includes('issue/?'))return Response.json({count:3,next:null,previous:null,results:rows});
  if(url.includes('series/100/')){await new Promise(resolve=>releaseFirst=resolve);return Response.json({id:100,series_type:{id:10,name:'Trade Paperback'}},{headers:{'X-RateLimit-Burst-Remaining':'0','X-RateLimit-Burst-Reset':String(Math.ceil(Date.now()/1000)+60)}});}
  if(url.includes('series/200/')){await new Promise(resolve=>releaseSecond=resolve);return Response.json({id:200,series_type:{id:9,name:'Hardcover'}});}
  if(url.includes('series/300/'))return Response.json({id:300,series_type:{id:1,name:'Ongoing'}});
  if(url.includes('series_type/?'))return Response.json({results:[{id:10,name:'Trade Paperback'}],next:null});
  throw Error(`Unexpected request ${url}`);
}}});
try{
  instance.server.listen(0,'127.0.0.1');await once(instance.server,'listening');
  const origin=`http://127.0.0.1:${instance.server.address().port}`;
  browser=await chromium.launch({headless:true,...(process.env.BETA_BROWSER_EXECUTABLE?{executablePath:process.env.BETA_BROWSER_EXECUTABLE}:{})});
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/#/?q=Cover');
  await page.locator('[data-result-issue="11"]').waitFor();
  assert.equal(await page.locator('.comic-card:visible').count(),3,'all cards display while first optional lookup is held');
  assert.match(await page.locator('#search-enrichment-status').innerText(),/Loading/);
  await page.locator('#results-filter summary').click();
  await page.locator('#series-type-options input[value="0"]').check();
  await page.locator('#series-type-options input[value="0"]').focus();
  assert.equal(typeof releaseFirst,'function');releaseFirst();
  await page.waitForFunction(()=>document.querySelector('#search-enrichment-status')?.textContent.includes('Some series types unavailable'));
  assert.equal(await page.locator('[data-result-issue="11"] .format-badge').getAttribute('alt'),'Trade Paperback');
  assert.equal(await page.locator('.comic-card:visible').count(),3);
  assert.equal(await page.locator('#series-type-options input[value="0"]').isChecked(),true,'unapplied checkbox survives enrichment');
  assert.equal(await page.locator('#results-filter').evaluate(node=>node.open),true);
  assert.equal(calls.filter(url=>url.includes('/series/')).length,1,'no further series requests once the successful lookup exhausts quota');
  assert.equal(await page.locator('#notice').innerText(),'');
  await page.goto(origin+'/#/?q=Cover&series_types=10');
  await page.waitForFunction(()=>document.querySelector('#search-enrichment-status')?.textContent.includes('Matches with unknown types remain visible'));
  assert.equal(await page.locator('.comic-card:visible').count(),3,'explicit filters retain marked unresolved matches');
  assert.equal(calls.filter(url=>url.includes('/series/')).length,1);
  instance.repo.statePut('blocked_until',0);instance.repo.statePut('burst_until',0);
  await page.goto(origin+'/#/?q=Another');
  await page.waitForFunction(()=>document.querySelector('#search-enrichment-status')?.textContent.includes('Loading'));
  // Let the next optional request reach the held provider response.
  for(let i=0;i<100 && !releaseSecond;i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(typeof releaseSecond,'function');
  await page.evaluate(()=>document.dispatchEvent(new Event('dangerroompause')));
  assert.match(await page.locator('#search-enrichment-status').innerText(),/Some series types unavailable/,'companion pause stops enrichment without waiting for the in-flight lookup');
  await page.goto(origin+'/#/collection');await page.locator('#collection-search').waitFor();releaseSecond();
  await page.waitForLoadState('networkidle');
  assert.equal(calls.some(url=>url.includes('series/300/')),false,'leaving the page stops future scheduling');
  assert.equal(instance.repo.cacheGet('series/200/').series_type.name,'Hardcover','the single in-flight lookup may finish into cache');
  assert.deepEqual(errors,[]);
  console.log('Enrichment browser checks passed: early cards, progressive badges, preserved filter edits, quota stop without blanking results, marked unknown matches under filters, and navigation stops subsequent requests.');
}finally{releaseFirst?.();releaseSecond?.();await browser?.close();await new Promise(resolve=>instance.server.close(resolve));await rm(dir,{recursive:true,force:true});}
