import {coverArtwork,coverPlaceholder} from './cover-art.js';
import {supportsSubscriptions} from './mobile.js';
import {comicTitle,comicTitleText} from './comic-title.js';
import {localToday} from './reading-log.js';
import {subscriptionWeek,subscriptionIssues,subscriptionThumbnail} from './subscription-dates.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const viewIcons={
  list:'<path d="M5 3h14v18H5z"/><path d="M10 8h6M10 12h6M10 16h6"/><path d="M8 8h.01M8 12h.01M8 16h.01"/>',
  missing:'<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5M8.5 8a2 2 0 0 1 4 0c0 1.5-2 1.5-2 3"/><path d="M10.5 14h.01"/>',
  week:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
  upcoming:'<circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="M2 16 5 5h3l2 11M14 16l2-11h3l3 11M10 13h4M8 5V3H5v2M16 5V3h3v2"/>',
};
const viewButtons=[['list','List','Subscription List'],['missing','Missing','Missing Issues'],['week','This Week','Releasing This Week'],['upcoming','Upcoming','Upcoming Releases']];
const pending=new Set();
const statuses=new Map();
export function subscriptionButton(series,subscribed,{remove=false}={}){
  if(!supportsSubscriptions||!series?.id)return '';
  return `<button type="button" class="${remove?'quiet subscription-remove':'comic-toggle subscription-toggle'}" data-subscription="${Number(series.id)}" data-remove-subscription="${remove}" aria-pressed="${Boolean(subscribed)}" aria-label="${remove?'Unsubscribe from':'Subscribe to'} ${esc(series.name)}" title="${remove?'Unsubscribe from':'Subscribe to'} ${esc(series.name)}">${remove?'×':'<img class="icon" src="/subscriptions.png" alt="">'}</button>`;
}
function updateButtons(id,subscribed){
  for(const button of document.querySelectorAll(`[data-subscription="${id}"]`)){
    button.setAttribute('aria-pressed',String(subscribed));button.disabled=pending.has(id);
    if(button.dataset.removeSubscription!=='true'){
      const label=`${subscribed?'Unsubscribe from':'Subscribe to'} ${button.dataset.seriesName}`;
      button.setAttribute('aria-label',label);button.title=label;
    }
  }
}
export function bindSubscriptionButtons(container,series,subscribed,api,onError){
  if(!supportsSubscriptions||!series?.id)return;
  const id=Number(series.id);if(!statuses.has(id))statuses.set(id,Boolean(subscribed));
  container.querySelectorAll(`[data-subscription="${id}"]`).forEach(button=>{
    button.dataset.seriesName=series.name;
    button.onclick=async()=>{
      if(pending.has(id))return;
      pending.add(id);updateButtons(id,statuses.get(id));
      try{
        const data=await api(`/subscriptions/${id}`,{method:'PUT',body:JSON.stringify({subscribed:!statuses.get(id)})});
        statuses.set(id,data.subscribed);
        document.dispatchEvent(new CustomEvent('subscriptionchange',{detail:data}));
      }catch(error){onError(error.message);}
      finally{pending.delete(id);updateButtons(id,statuses.get(id));}
    };
  });
  updateButtons(id,statuses.get(id));
}

export async function subscriptionsPage(app,params,api,current,choose,onError,actionButton){
  const view=['week','upcoming','missing','list'].includes(params.get('view'))?params.get('view'):'week';
  const today=localToday(),week=subscriptionWeek(today);
  const format=value=>new Date(`${value}T12:00:00`).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
  const artwork=(row,edition,state='missing')=>{
    const src=edition?.cover_file?`/covers/${edition.cover_file}`:edition?.source_image||row?.image;
    return src?coverArtwork(src,row?comicTitleText(row,{year:true}):'Series cover'):coverPlaceholder(state);
  };
  app.innerHTML=`<div class="section-heading"><div><p class="eyebrow">Your regular pulls</p><h2>Subscriptions</h2></div></div><nav class="tabs subscription-tabs" aria-label="Subscription views">${viewButtons.map(([key,label,title])=>`<a href="#/subscriptions?view=${key}" aria-label="${title}" title="${title}" ${view===key?'aria-current="page"':''}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${viewIcons[key]}</svg><span>${label}</span></a>`).join('')}</nav><p class="muted">${view==='week'?`${format(week.start)} – ${format(week.end)}`:view==='upcoming'?`After ${format(week.end)}`:view==='missing'?`Before ${format(week.start)} · Issues outside your collection`:'Series you follow · Next release or most recent issue'}</p><p class="hint" id="subscription-status" role="status">Opening subscriptions…</p><div id="subscription-results"></div>`;
  const data=await api('/subscriptions');if(!current())return;
  app.querySelector('#subscription-status').textContent=data.items.length?'Loading releases…':'';
  let series=data.items;const catalogs=new Map(series.map(s=>[s.id,new Map()]));
  const completed=new Set();
  let phase=series.length?'loading':'complete';
  function render(){
    if(!current())return;
    const target=app.querySelector('#subscription-results');
    const rows=series.flatMap(s=>[...catalogs.get(s.id).values()]);
    if(!series.length){target.innerHTML='<div class="empty-state"><h3>No subscribed series yet.</h3><p>Use the subscription button on any comic to follow its series.</p><a href="#/">Search Metron</a></div>';return;}
    if(view==='list'){
      target.innerHTML=`<ul class="subscription-list">${series.map(s=>{
        const row=subscriptionThumbnail([...catalogs.get(s.id).values()],today);
        return `<li data-subscription-row="${s.id}"><a class="subscription-series" href="#/?${new URLSearchParams({q:s.name,year:s.year_began||''})}">${artwork(row,row?.thumbnail_edition,!row&&!completed.has(s.id)?(phase==='stopped'?'paused':'loading'):'missing')}<span><strong>${esc(s.name)}</strong><span class="muted">${esc(s.year_began||'')} · Volume ${esc(s.volume??'—')}</span>${row?`<span>${esc(comicTitleText(row))} · ${esc(format(row.store_date))}</span>`:'<span class="muted">No dated release loaded</span>'}</span></a>${subscriptionButton(s,true,{remove:true})}</li>`;
      }).join('')}</ul>`;
    }else{
      const visible=subscriptionIssues(rows,view,today);
      target.innerHTML=visible.length?`<p class="muted">${visible.length} issue${visible.length===1?'':'s'}${phase==='loading'?' loaded':''}</p><div class="shelf">${visible.map(row=>`<article class="comic-card" data-subscription-issue="${row.id}"><a class="comic-link" href="#/issues/${row.id}" data-open-subscription="${row.id}">${artwork(row,row.edition)}<div class="card-info"><p class="eyebrow">${esc(row.series.year_began||'')} · Volume ${esc(row.series.volume??'—')}</p><h3>${comicTitle(row)}</h3><p class="muted">${esc(row.edition.name)}</p><p class="muted">In stores ${esc(format(row.store_date))}</p></div></a><div class="comic-actions card-toggles" data-subscription-actions="${row.id}">${actionButton('owned',row.owned)}${actionButton('wanted',row.wanted)}${actionButton('read',row.read)}${subscriptionButton(row.series,true)}</div></article>`).join('')}</div>`:`<div class="empty-state"><h3>${phase==='loading'?'Looking for releases…':phase==='stopped'?'No matching issues loaded.':'No matching issues.'}</h3><p>${phase==='complete'?'Comics without a store release date are not included in these views.':'Loaded results will appear here as they become available.'}</p></div>`;
      target.querySelectorAll('[data-open-subscription]').forEach(link=>link.onclick=event=>{
        event.preventDefault();const row=rows.find(r=>r.id===Number(link.dataset.openSubscription));choose(row.id,null,row.edition.key);
      });
      target.querySelectorAll('[data-subscription-actions]').forEach(group=>{
        const row=rows.find(r=>r.id===Number(group.dataset.subscriptionActions));
        group.querySelectorAll('[data-action]').forEach(button=>button.onclick=()=>choose(row.id,null,row.edition.key));
      });
    }
    for(const s of series)bindSubscriptionButtons(target,s,true,api,onError);
  }
  const change=event=>{
    if(!current()){document.removeEventListener('subscriptionchange',change);return;}
    if(!event.detail.subscribed){series=series.filter(s=>s.id!==event.detail.series_id);render();}
  };
  document.addEventListener('subscriptionchange',change);
  window.addEventListener('hashchange',()=>document.removeEventListener('subscriptionchange',change),{once:true});render();
  try{
    // Show each completed page before asking for another; stop at the first error/quota pause.
    for(const s of [...series]){
      for(let page=1;page<=10000;page++){
        if(!current())return;
        if(!series.some(row=>row.id===s.id))break;
        const result=await api(`/subscriptions/${s.id}/issues?${new URLSearchParams({page:String(page),view,today})}`);if(!current())return;
        for(const row of result.results)catalogs.get(s.id).set(row.id,row);
        if(!result.next)completed.add(s.id);
        render();if(!result.next)break;
        if(page===10000)throw Error('More results are available than can be loaded. Narrow your subscriptions and try again.');
      }
    }
    phase='complete';app.querySelector('#subscription-status').textContent='';render();
  }catch(error){if(current()){phase='stopped';app.querySelector('#subscription-status').textContent=`${error.message} Loaded results remain available. Reopen this view to try again.`;render();}}
}
