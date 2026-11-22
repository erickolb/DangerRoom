import {createApp} from '../src/server.mjs';
import {essentialIssue,editionsFor} from '../src/metron.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {subscriptionWeek} from '../public/subscription-dates.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const directory=await mkdtemp(join(tmpdir(),'dangerroom-subscriptions-ui-'));
const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
const {start,end}=subscriptionWeek(today);
const offset=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const dates=[offset(start,-1),start,end,offset(end,1),null,offset(start,-3)];
const image='https://static.metron.cloud/media/issue/2018/11/15/6594966-01.jpg';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ2kAAAAASUVORK5CYII=', 'base64');
const series={id:44,name:'Preview Heroes',year_began:2026,volume:1,series_type:{id:1,name:'Ongoing'}};
const rows=dates.map((store_date,index)=>({id:301+index,series,number:String(index+1),store_date,cover_date:'2027-06-01',image,
  resource_url:`https://metron.cloud/issue/preview-${index}/`,variants:[{name:'Cover B',image:'https://static.metron.cloud/media/variant.png'},{name:'Cover C',image:'https://static.metron.cloud/media/variant-c.png'}]}));
let calls=0,failPage=false;
const fixture=createApp({dataDir:directory,imageFetch:async()=>new Response(png,{headers:{'Content-Type':'image/png'}}),metronOptions:{token:'fixture',interval:0,fetchImpl:async input=>{
  const url=new URL(input);calls++;
  if(url.pathname==='/api/series/44/')return Response.json(series);
  if(url.pathname==='/api/issue/'){
    const page=Number(url.searchParams.get('page')||1);
    if(url.searchParams.has('series_id')){
      if(failPage&&page===2)return Response.json({}, {status:429});
      return Response.json({results:page===1?rows.slice(0,3):rows.slice(3),next:page===1?'https://metron.cloud/api/issue/?page=2':null,count:rows.length});
    }
    return Response.json({results:rows,next:null,count:rows.length});
  }
  const match=url.pathname.match(/\/issue\/(\d+)\//);if(match)return Response.json(rows.find(row=>row.id===Number(match[1])));
  throw Error('Unexpected fixture provider request: '+url);
}}});
fixture.repo.addWant(essentialIssue(rows[1]),editionsFor(rows[1])[1],null);
fixture.repo.addWant(essentialIssue(rows[1]),editionsFor(rows[1])[2],null);
fixture.repo.save(essentialIssue(rows[5]),editionsFor(rows[5])[0],null,{owned:true,read:false});
fixture.repo.save(essentialIssue(rows[0]),editionsFor(rows[0])[0],null,{owned:false,read:true});
let browser;
try{
  fixture.server.listen(0,'127.0.0.1');await once(fixture.server,'listening');const origin=`http://127.0.0.1:${fixture.server.address().port}`;
  browser=await chromium.launch({headless:true,...(process.env.BETA_BROWSER_EXECUTABLE?{executablePath:process.env.BETA_BROWSER_EXECUTABLE}:{})});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://static.metron.cloud/**',route=>route.fulfill({body:png,contentType:'image/png'}));
  await page.goto(origin+'/#/');assert.equal(await page.locator('.search-welcome').isVisible(),true);
  await page.locator('[name=q]').fill('Preview');await page.locator('#search-form button[type=submit]').click();
  await page.locator('[data-result-issue="301"]').waitFor();await page.waitForFunction(()=>document.querySelector('.search-welcome').getBoundingClientRect().height<1);
  assert.equal(await page.locator('.hero>.eyebrow').textContent(),'Metron Comics Search');
  await page.locator('[data-result-issue="301"] [data-subscription]').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-subscription="44"]')].every(b=>b.getAttribute('aria-pressed')==='true'&&!b.disabled));
  assert.equal(await page.locator('dialog[open]').count(),0,'subscribe has no modal');
  await page.locator('[data-result-issue="302"] [data-subscription]').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-subscription="44"]')].every(b=>b.getAttribute('aria-pressed')==='false'&&!b.disabled));
  await page.locator('[data-result-issue="301"] [data-subscription]').click();
  await page.waitForFunction(()=>document.querySelector('[data-subscription="44"]').getAttribute('aria-pressed')==='true');
  for(const width of [1280,390,320]){
    await page.setViewportSize({width,height:900});
    const fits=await page.locator('[data-choose="301"]').evaluate(group=>{
      const buttons=[...group.children].map(b=>b.getBoundingClientRect());return buttons.every(b=>Math.abs(b.top-buttons[0].top)<1&&b.right<=group.getBoundingClientRect().right+1);
    });assert.equal(fits,true,`controls fit at ${width}px`);
  }
  for(const [view,ids] of [['week',[302,303]],['upcoming',[304]],['missing',[301]]]){
    await page.goto(origin+`/#/subscriptions?view=${view}`);
    await page.waitForFunction(()=>document.querySelector('#subscription-status')?.textContent==='');
    assert.deepEqual(await page.locator('[data-subscription-issue]').evaluateAll(cards=>cards.map(c=>Number(c.dataset.subscriptionIssue))),ids);
    if(view==='week')assert.match(await page.locator('[data-subscription-issue="302"]').innerText(),/Cover B/);
  }
  await page.goto(origin+'/#/wants');await page.locator('.want-card').first().waitFor();assert.equal(await page.locator('.want-cover-date').count(),2);
  await page.goto(origin+'/#/issues/301');await page.locator('#detail-actions').waitFor();assert.equal(await page.locator('#detail-actions [data-action="black_bag"]').count(),0,'read-only issue has no slideshow hide button');
  await page.goto(origin+'/#/issues/306');await page.locator('#detail-actions').waitFor();assert.equal(await page.locator('#detail-actions [data-action="black_bag"]').count(),1);
  await page.goto(origin+'/#/subscriptions?view=list');await page.waitForFunction(()=>document.querySelector('#subscription-status')?.textContent==='');
  assert.equal(await page.locator('.subscription-list>li').count(),1);await page.locator('.subscription-remove').click();await page.waitForFunction(()=>!document.querySelector('.subscription-list>li'));
  assert.equal(fixture.repo.isSubscribed(44),false);assert.equal(fixture.repo.wantList().length,2);assert.equal(fixture.repo.issue(306).copies.length,1);
  // Cold load with an active query has no welcome text or introductory transition.
  await page.goto(origin+'/#/?q=Preview');await page.locator('[data-result-issue="301"]').waitFor();
  assert.equal(await page.locator('.search-welcome').evaluate(el=>el.getBoundingClientRect().height),0);
  // A partial catalog survives a quota stop, including its working unsubscribe control.
  fixture.repo.subscribe(series);fixture.metron.flushQueryCache();failPage=true;
  await page.reload();await page.goto(origin+'/#/subscriptions?view=week');
  await page.waitForFunction(()=>document.querySelector('#subscription-status')?.textContent.includes('Loaded results remain available'));
  assert.equal(await page.locator('[data-subscription-issue]').count(),2);
  await page.locator('[data-subscription-issue="302"] [data-subscription]').click();
  await page.waitForFunction(()=>document.querySelector('#subscription-results')?.textContent.includes('No subscribed series yet'));
  // Native subscriptions require the new capability; older Android/iOS bridges retain their stable menu.
  failPage=false;fixture.metron.flushQueryCache();fixture.repo.statePut('blocked_until',0);fixture.repo.statePut('burst_until',0);
  const device=fixture.devices.add('Subscriptions companion browser test');
  for(const enabled of [false,true]){
    const nativeContext=await browser.newContext({viewport:{width:390,height:844}});
    await nativeContext.addInitScript(({deviceId,token,enabled})=>{
      window.DangerRoomAndroid={settings(){},imageCoverSearch(){},request(path,method,body,id){
        fetch('/mobile'+path,{method,headers:{'X-Device-Id':deviceId,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body}:{})})
          .then(async response=>({status:response.status,data:await response.json()})).then(result=>window.dangerroomResponses[id](result));
      }};
      if(enabled)window.DangerRoomAndroid.supportsSubscriptions=()=>true;
    },{deviceId:device.deviceId,token:device.token,enabled});
    const native=await nativeContext.newPage();native.on('pageerror',e=>errors.push(e.message));
    await native.route('https://static.metron.cloud/**',route=>route.fulfill({body:png,contentType:'image/png'}));
    await native.goto(origin+'/#/home');await native.locator('.mobile-menu').waitFor();
    assert.equal(await native.locator('.mobile-menu a[href="#/subscriptions"]').count(),enabled?1:0);
    await native.goto(origin+'/#/?q=Preview');await native.locator('[data-result-issue="301"]').waitFor();
    assert.equal(await native.locator('[data-result-issue="301"] [data-subscription]').count(),enabled?1:0);
    if(enabled){
      await native.locator('[data-result-issue="301"] [data-subscription]').click();
      await native.waitForFunction(()=>document.querySelector('[data-result-issue="301"] [data-subscription]')?.getAttribute('aria-pressed')==='true');
      assert.equal(fixture.repo.isSubscribed(44),true,'companion PUT passes authenticated API bridge');
      await native.goto(origin+'/#/home');await native.getByRole('link',{name:'Subscriptions',exact:true}).click();
      await native.waitForFunction(()=>document.querySelector('#subscription-status')?.textContent==='');
      assert.equal(await native.locator('[data-subscription-issue]').count(),2);
      const tabs=await native.locator('.subscription-tabs a').evaluateAll(items=>items.map(a=>({top:a.getBoundingClientRect().top,width:a.getBoundingClientRect().width})));
      assert(tabs.every(a=>a.top===tabs[0].top&&Math.abs(a.width-tabs[0].width)<1));
      await native.getByRole('link',{name:'Subscription List',exact:true}).click();await native.locator('.subscription-remove').click();
      await native.waitForFunction(()=>document.querySelector('#subscription-results')?.textContent.includes('No subscribed series yet'));
      assert.equal(fixture.repo.isSubscribed(44),false);
    }
    await nativeContext.close();
  }
  assert.deepEqual(errors,[]);console.log('Subscriptions, synchronized toggles, week views, variants, list removal, quota retention, slideshow controls, narrow cards, Want List dates, and search welcome passed. Provider calls:',calls);
}finally{
  await browser?.close();await new Promise(resolve=>fixture.server.close(resolve));await rm(directory,{recursive:true,force:true});
}
