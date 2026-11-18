import {createApp} from '../src/server.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const raw={id:42,series:{id:4,name:'Cover Test',volume:1,year_began:2026,series_type:{id:1,name:'Ongoing'}},number:'1',image:null};
const dir=await mkdtemp(join(tmpdir(),'dangerroom-beta-ui-')),calls=[];
const instance=createApp({dataDir:dir,metronOptions:{token:'test',interval:0,fetchImpl:async url=>{calls.push(url);return Response.json(url.includes('issue/42/')?raw:{count:1,next:null,previous:null,results:[raw]});}}});
let browser;
try {
  instance.server.listen(0,'127.0.0.1');await once(instance.server,'listening');
  const origin=`http://127.0.0.1:${instance.server.address().port}`;
  browser=await chromium.launch({headless:true,...(process.env.BETA_BROWSER_EXECUTABLE?{executablePath:process.env.BETA_BROWSER_EXECUTABLE}:{})});
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/#/?q=Cover');
  const read=page.locator('[data-choose="42"] [data-action=read]');await read.click();await page.locator("#read-dialog").waitFor({state:"visible"});
  assert.equal(await page.locator('#read-status').isChecked(),true);assert.equal(await page.locator('#record-reading').isChecked(),false);
  assert.equal(await page.locator('#preserve-label').isVisible(),false);
  await page.locator('#read-log-form button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('[data-choose="42"] [data-action=read]')?.getAttribute('aria-pressed')==='true');
  assert.ok(instance.repo.issue(42).read);assert.equal(instance.repo.issue(42).reading_log_count,0);
  // Lit button opens the same dialog with the same defaults; selecting a date records a rereading.
  await read.click();await page.locator("#read-dialog").waitFor({state:"visible"});assert.equal(await page.locator('#read-status').isChecked(),true);assert.equal(await page.locator('#record-reading').isChecked(),false);
  await page.locator('[data-calendar-date]').first().click();assert.equal(await page.locator('#record-reading').isChecked(),true);
  await page.locator('#read-log-form button[type=submit]').click();
  await page.waitForFunction(()=>!document.querySelector('#read-dialog').open);
  await page.waitForFunction(()=>document.querySelector('[data-choose="42"] [data-action=read]')?.disabled===false);
  assert.equal(instance.repo.issue(42).reading_log_count,1);
  await read.click();await page.locator("#read-dialog").waitFor({state:"visible"});await page.locator('#read-status').uncheck();
  assert.equal(await page.locator('#record-reading').isDisabled(),true);assert.equal(await page.locator('#preserve-journal').isChecked(),true);assert.equal(await page.locator('#preserve-label').isVisible(),true);
  assert.equal(await page.locator('[data-calendar-date]').first().isDisabled(),true);
  await page.locator('#read-log-form button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('[data-choose="42"] [data-action=read]')?.getAttribute('aria-pressed')==='false');
  assert.equal(instance.repo.issue(42).read,null);assert.equal(instance.repo.issue(42).reading_log_count,1);
  await read.click();await page.locator("#read-dialog").waitFor({state:"visible"});await page.locator('#read-status').uncheck();await page.locator('#preserve-journal').uncheck();
  await page.locator('#read-log-form button[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#read-dialog').open);
  await page.waitForFunction(()=>document.querySelector('[data-choose="42"] [data-action=read]')?.disabled===false);
  assert.equal(instance.repo.issue(42).reading_log_count,0);
  await read.click();await page.locator("#read-dialog").waitFor({state:"visible"});await page.locator('#read-dialog [data-cancel]').click();assert.equal(instance.repo.issue(42).read,null);
  assert.equal(await page.locator('a[href="#/image-cover-search"]').count(),0);
  // Exercise the companion bridge and the actual shared result view on a narrow screen.
  const device=instance.devices.add('Browser bridge test');
  await page.addInitScript(({deviceId,token})=>{
    window.DangerRoomAndroid={imageCoverSearch(){window.scanOpened=true;},settings(){},request(path,method,body,id){fetch('/mobile'+path,{method,headers:{'X-Device-Id':deviceId,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body}:{})}).then(async r=>({status:r.status,data:await r.json()})).then(result=>window.dangerroomResponses[id](result));}};
  },{deviceId:device.deviceId,token:device.token});
  await page.setViewportSize({width:390,height:844});await page.goto(origin+'/#/home');await page.reload();
  await page.getByRole('link',{name:'Image Cover Search'}).click();await page.waitForFunction(()=>window.scanOpened);
  await page.goto(origin+'/#/?cover_hash_near=c585eb18bf1e5423&cover_hash_max_distance=16');
  await page.locator('[data-choose="42"]').waitFor();assert.ok(calls.some(url=>url.includes('cover_hash_near=c585eb18bf1e5423&cover_hash_max_distance=16')));
  assert.equal(await page.locator('#results-filter').count(),1);assert.equal(await page.locator('[data-choose="42"] button').count(),3);
  await page.getByRole('button',{name:'Capture another image'}).click();assert.equal(await page.evaluate(()=>window.scanOpened),true);
  assert.deepEqual(errors,[]);
  console.log('Beta browser checks passed: unified read dialogs, defaults, date auto-recording, preserve/delete journal, cancellation, companion-only menu, standard image result cards and filters.');
}finally {await browser?.close();await new Promise(resolve=>instance.server.close(resolve));await rm(dir,{recursive:true,force:true});}
