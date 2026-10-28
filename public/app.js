import { selectedSeriesNames,seriesNameOptions,selectedSeriesTypes, filterSearchResults, seriesTypeOptions } from './search-filters.js';
import { comicTitle, comicTitleText } from './comic-title.js';
import { ratingChoices, bindRatingPreview } from './ratings.js';
import { localToday, shiftMonth, mountMonthPicker, changeRead, cancelReadDialog } from './reading-log.js';
import { seriesRatingChart } from './series-ratings.js';
import { releases } from './releases.js';
import { actionButton, context, copyState, bindToggles } from './actions.js';
const $ = s => document.querySelector(s), app = $('#app'), notice = $('#notice'), dialog = $('#dialog');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (name, light = false) => `<img class="icon${light ? ' light-icon' : ''}" src="/${name}.png" alt="">`;
const date = value => value ? new Date(value.length > 10 ? value : `${value}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not supplied';
const cover = (src, title = '', cls = '') => src ? `<img class="cover ${cls}" src="${esc(src)}" alt="${esc(title)}" loading="lazy">` : '<div class="cover missing-cover">Cover unavailable</div>';
const localCover = edition => edition?.cover_file ? `/covers/${edition.cover_file}` : null;
const field = (label, value) => `<div><dt>${esc(label)}</dt><dd>${esc(value || 'Not supplied')}</dd></div>`;
let pendingSeriesNameCheck = null;
let connected = false, generation = 0, dialogGeneration = 0, collectionView = 'owned';
$('#build-label').textContent = releases[0].version;
async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(`${data.error || 'Request failed.'}${response.headers.get('Retry-After') ? ` Try again in ${response.headers.get('Retry-After')} seconds.` : ''}`);
  return data;
}
function message(text, error = false) { notice.textContent = text; notice.className = text ? `notice${error ? ' error' : ''}` : ''; }
function routeData() { const [path, query] = (location.hash.slice(1) || '/').split('?'); return { path, params: new URLSearchParams(query || '') }; }
function ratingDisplay(value) {
  if (value == null) return '<p class="rating-summary muted">Not rated</p>';
  return `<div class="rating-summary"><span class="display-stars" role="img" aria-label="${value} out of 5 stars">${Array.from({ length: 5 }, (_, i) => `<span aria-hidden="true" class="${value >= i + 1 ? 'full-star' : value >= i + 0.5 ? 'half-star' : 'empty-star'}">★</span>`).join('')}</span><span class="muted">${value} / 5</span></div>`;
}

async function wantList(params, ticket) {
  const q = params.get('q') || '';
  app.innerHTML = `<div class="section-heading"><div><p class="eyebrow">The Shopping List For Your Next Pulls</p><h2>Want List</h2></div></div><form class="search-main collection-search" id="want-search"><label><span class="visually-hidden">Find in your Want List</span><input type="search" name="q" value="${esc(q)}" placeholder="Find a series or cover in your Want List" maxlength="160"></label><button class="quiet">Find</button></form><div id="want-results"><p class="loading" role="status">Opening your Want List…</p></div>`;
  $('#want-search').onsubmit = e => { e.preventDefault(); const p=new URLSearchParams(); const value=new FormData(e.target).get('q').trim(); if(value)p.set('q',value); const hash=`#/wants${p.size ? `?${p}` : ''}`; if(location.hash===hash)route();else location.hash=hash; };
  const data = await api(`/wants?${new URLSearchParams({q})}`);
  if (ticket !== generation) return;
  $('#want-results').innerHTML = data.items.length ? `<p class="muted" id="want-count">${data.items.length} wanted issue${data.items.length===1?'':'s'}</p><div class="shelf">${data.items.map((row,index) => `<article class="comic-card want-card"><a class="comic-link" href="${esc(row.resource_url)}" target="_blank" rel="noopener noreferrer">${cover(localCover(row),comicTitleText(row,{year:true}))}<div class="card-info"><p class="eyebrow">${esc(row.series.year_began || '')} · Volume ${esc(row.series.volume || '—')}</p><h3>${comicTitle(row)}</h3><p class="muted">${esc(row.edition.name)}</p><p class="muted">View on Metron ↗</p></div></a><div class="comic-actions card-toggles" data-want-actions="${index}"></div></article>`).join('')}</div>` : `<div class="empty-state"><p class="eyebrow">${q?'No matches':'Your Next Pulls'}</p><h3>${q?'No wanted covers match.':'Which issue will you pull next?'}</h3><p>${q?'Try another series or cover name.':'Search Metron, choose a cover, and add it to your Want List.'}</p></div>`;
  const wantStates=[];
  data.items.forEach((row,index)=>{
    const ctx=context({id:row.issue_id,...row,editions:[{...row.edition,cover_file:row.cover_file,owned:false,wanted:true}],copies:[],read:null,user_rating:null,saved:false},api,text=>message(text,true));
    const state=copyState(ctx,row.edition.key);
    wantStates.push(ctx);
    const controls=document.querySelector(`[data-want-actions="${index}"]`);
    bindToggles(controls,ctx,state,{actions:['owned','wanted']});
    ctx.listeners.add(()=>{const count=wantStates.filter(c=>c.editions[0].wanted).length;$('#want-count').textContent=`${count} wanted issue${count===1?'':'s'}`;controls.closest('.comic-card').classList.toggle('inactive-copy',!ctx.editions[0].wanted);});
  });
}
const lightbox=$('#cover-lightbox');
$('#close-lightbox').onclick=()=>lightbox.close();
lightbox.addEventListener('click',event=>{
  const bounds=lightbox.getBoundingClientRect();
  if(event.target===lightbox && (event.clientX<bounds.left || event.clientX>bounds.right || event.clientY<bounds.top || event.clientY>bounds.bottom))lightbox.close();
});
lightbox.addEventListener('close',()=>$('#lightbox-image').removeAttribute('src'));
function openCoverImage(src,issue,edition){
  $('#cover-lightbox-title').innerHTML=comicTitle(issue,{year:true})+` · ${esc(edition.name)}`;
  $('#lightbox-image').alt=comicTitleText(issue,{year:true})+` · ${edition.name}`;
  $('#lightbox-image').src=src;
  lightbox.showModal();
}
function closeDialog() { dialogGeneration++; dialog.close(); }
dialog.addEventListener('close', () => { dialogGeneration++; });
async function route() {
  const ticket = ++generation;
  message(''); cancelReadDialog(); closeDialog(); if(lightbox.open)lightbox.close();
  const { path, params } = routeData();
  document.querySelectorAll('nav a').forEach(a => { if (a.getAttribute('href') === `#${path}`) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  try {
    if(path==='/reading-log')return await readingLogPage(params,ticket);
    if (path === '/wants') return await wantList(params,ticket);
    if (path === '/changelog') return changelog();
    if (path === '/collection') { collectionView = ['read','unread'].includes(params.get('view')) ? params.get('view') : 'owned'; return await collection(params, ticket); }
    const match = path.match(/^\/issues\/(\d+)$/);
    if (match) return await detail(match[1], params, ticket);
    await search(params, ticket);
  } catch (e) {
    if (ticket !== generation) return;
    app.innerHTML = `<a href="#/">← Search Metron</a><div class="empty-state"><h2>Couldn’t open this page</h2><p>${esc(e.message)}</p></div>`;
  }
}

async function readingLogPage(params,ticket){
  const month=params.get('month')||localToday().slice(0,7);
  const data=await api(`/reading-log?${new URLSearchParams({month})}`);if(ticket!==generation)return;
  const previous=shiftMonth(month,-1),next=shiftMonth(month,1);
  const label=new Date(`${month}-15T12:00:00`).toLocaleDateString(undefined,{month:'long',year:'numeric'});
  const groups=new Map();for(const entry of data.items){if(!groups.has(entry.read_date))groups.set(entry.read_date,[]);groups.get(entry.read_date).push(entry);}
  app.innerHTML=`<div class="section-heading"><div><p class="eyebrow">Your reading microjournal</p><h2>Reading Log</h2></div><span class="count">${data.items.length} ${data.items.length===1?'entry':'entries'}</span></div><nav class="log-month-nav" aria-label="Reading log month"><a class="button quiet" href="#/reading-log?month=${previous}">← Previous month</a><div id="log-month-picker"></div>${month===localToday().slice(0,7)?'':`<a class="button quiet" href="#/reading-log?month=${next}">Next month →</a>`}</nav><h3>${esc(label)}</h3>${data.items.length?[...groups].map(([day,entries])=>`<section class="log-day"><h3 class="log-calendar-date"><time datetime="${day}" aria-label="${esc(date(day))}"><span class="log-calendar-month" aria-hidden="true">${esc(new Date(`${day}T12:00:00`).toLocaleDateString(undefined,{month:'short'}))}</span><span class="log-calendar-number" aria-hidden="true">${Number(day.slice(8))}</span></time></h3><ul class="reading-entries">${entries.map(entry=>`<li><a class="reading-entry-link" href="#/issues/${entry.issue_id}?${new URLSearchParams({edition:entry.edition_key})}">${cover(localCover(entry.edition),comicTitleText(entry.issue,{year:true}))}<span>${comicTitle(entry.issue,{year:true})}</span></a><button type="button" class="quiet log-remove" data-remove-entry="${entry.id}" aria-label="Remove reading log entry for ${esc(comicTitleText(entry.issue,{year:true}))} on ${esc(date(day))}" title="Remove log entry">×</button></li>`).join('')}</ul></section>`).join(''):'<div class="empty-state"><h3>No reading log entries this month.</h3><p>Use the read icon or Log a Reading on a comic’s details page to record a reading date.</p></div>'}`;
  mountMonthPicker($('#log-month-picker'),month,value=>{location.hash=`#/reading-log?${new URLSearchParams({month:value})}`;});
  app.querySelectorAll('[data-remove-entry]').forEach(button=>button.onclick=async()=>{
    button.disabled=true;
    try{await api(`/reading-log/${button.dataset.removeEntry}`,{method:'DELETE'});if(ticket===generation)await route();}
    catch(error){message(error.message,true);button.disabled=false;}
  });
}

function searchForm(params) {
  return `<form id="search-form" class="search-form">${[...selectedSeriesNames(params)].map(name=>`<input type="hidden" name="series_name_filter" value="${esc(name)}">`).join('')}${selectedSeriesTypes(params).size?`<input type="hidden" name="series_types" value="${[...selectedSeriesTypes(params)].join(',')}">`:''}<div class="search-main"><label>Series name<input name="q" value="${esc(params.get('q') || '')}" placeholder="Search series, from Batman to Saga…" maxlength="160" autocomplete="off" type="search"></label><button type="submit">Search Metron <span aria-hidden="true">→</span></button></div><details class="search-options" ${params.get('number') || params.get('year') || params.get('upc') ? 'open' : ''}><summary>Issue, year & barcode</summary><div class="fields"><label>Issue number<input name="number" value="${esc(params.get('number') || '')}" placeholder="e.g. 1 or ½" maxlength="30"></label><label>Series start year<input name="year" value="${esc(params.get('year') || '')}" inputmode="numeric" pattern="[0-9]{4}" placeholder="e.g. 2024"></label><label>UPC<input name="upc" value="${esc(params.get('upc') || '')}" inputmode="numeric" pattern="[0-9]{8,18}" placeholder="Full comic barcode"></label></div></details><div class="search-filter-row"><p class="search-help">Search by series name, or use a UPC on its own.</p>${params.get('hide_owned')==='1'?'<input type="hidden" name="hide_owned" value="1">':''}</div></form>`;
}
async function search(params, ticket) {
  app.innerHTML = `<div class="hero"><span class="hero-mark" aria-hidden="true">✦</span><p class="eyebrow">Open up a whole new universe.</p><h2>Pull your next issue</h2><p class="intro">Search Metron, choose a cover, and make it yours.<br>Keep the stories you own and the ones you’ve read.</p>${searchForm(params)}</div>${!connected ? '<div class="connection">Connect Metron to start searching: add your API token to <code>METRON_API_TOKEN</code> in the local <code>.env</code> file and restart DangerRoom. <a href="https://metron.cloud" target="_blank" rel="noopener noreferrer">Open Metron ↗</a></div>' : ''}<div id="search-results"></div>`;
  $('#search-form').onsubmit = e => {
    e.preventDefault();
    const values = new URLSearchParams();
    for (const [key, value] of new FormData(e.target)) if (value.trim()) values.append(key, value.trim());
    if (!values.has('q') && !values.has('upc')) { message('Enter a series name or UPC to search.', true); return; }
    pendingSeriesNameCheck=values.toString();
    const hash = `#/?${values}`;
    if (location.hash === hash) route(); else location.hash = hash;
  };
  if (!params.get('q') && !params.get('upc')) return;
  $('#search-results').innerHTML = '<p class="loading" role="status">Searching Metron…</p>';
  const button = $('#search-form button'); button.disabled = true;
  try {
    const data = await api(`/search?${params}`);
    if (ticket !== generation) return;
    if(pendingSeriesNameCheck===params.toString()){
      pendingSeriesNameCheck=null;
      const available=new Set(data.results.map(row=>row.series.name));
      const retained=[...selectedSeriesNames(params)].filter(name=>available.has(name));
      params.delete('series_name_filter');for(const name of retained)params.append('series_name_filter',name);
      history.replaceState(null,'',`#/?${params}`);
      document.querySelectorAll('#search-form input[name="series_name_filter"]').forEach(input=>{if(!available.has(input.value))input.remove();});
    }
    const hideOwned=params.get('hide_owned')==='1';
    const seriesTypes=selectedSeriesTypes(params);
    const seriesNames=selectedSeriesNames(params);
    const visible=filterSearchResults(data.results,{hideOwned,seriesTypes,seriesNames});
    const unfilteredParams=new URLSearchParams(params);unfilteredParams.delete('series_types');unfilteredParams.delete('hide_owned');unfilteredParams.delete('series_name_filter');
    $('#search-results').innerHTML = `<div class="results"><div class="section-heading"><div><p class="eyebrow">From Metron</p><h2>Search results</h2></div><div class="result-tools"><button type="button" class="quiet hide-owned-toggle" id="hide-owned" aria-label="Hide issues in My Collection" title="Hide issues in My Collection (any cover)" aria-pressed="${params.get('hide_owned')==='1'}"><span class="collection-filter-icon"><img class="icon light-icon" src="/boxes.png" alt=""><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m6 18 12-12"/></svg></span></button><details class="results-filter" id="results-filter"><summary class="button quiet">Filters${seriesTypes.size+seriesNames.size?` (${seriesTypes.size+seriesNames.size})`:''}</summary><div class="results-filter-panel"><form id="series-type-filters"><div class="filter-columns"><div><fieldset><legend>Series type</legend><div id="series-type-options"></div></fieldset><p class="hint">No selections shows all types.</p></div><div><fieldset><legend>Series Name</legend><div id="series-name-options">${seriesNameOptions(data.results,seriesNames).map(name=>`<label class="series-type-choice"><input type="checkbox" name="series_name" value="${esc(name)}" ${seriesNames.has(name)?'checked':''}><span>${esc(name)}</span></label>`).join('')}</div></fieldset><p class="hint">No selections shows all series names. Options come from this results page.</p></div></div><div class="actions"><button type="submit">Apply</button><button type="button" class="quiet" id="clear-series-types">Clear</button></div><p class="hint" id="series-type-status" role="status"></p></form></div></details><span class="count">${Number(data.count).toLocaleString()} issue${data.count === 1 ? '' : 's'} on Metron</span></div></div>${hideOwned||seriesTypes.size||seriesNames.size?`<p class="muted">${visible.length} issue${visible.length===1?'':'s'} shown on this page.${hideOwned?' Owned issues in any cover are hidden.':''}${seriesTypes.size?' Series type filters are active.':''}${seriesNames.size?' Series name filters are active.':''}</p>`:''}${visible.length ? `<div class="shelf">${visible.map(r => `<article class="comic-card">${cover(localCover(r) || r.image, comicTitleText(r,{year:true}))}<div class="card-info"><p class="eyebrow">${esc(r.series.year_began || '')} · Volume ${esc(r.series.volume || '—')}</p><h3>${comicTitle(r)}</h3><p class="muted">${esc(date(r.cover_date))}</p><div class="comic-actions" data-choose="${r.id}">${actionButton('owned',r.owned)}${actionButton('wanted',r.wanted)}${actionButton('read',r.read)}</div></div></article>`).join('')}</div>` : hideOwned||seriesTypes.size||seriesNames.size ? `<div class="empty-state"><h3>No issues on this page match these filters.</h3><p>Adjust <a href="#/?${esc(unfilteredParams.toString())}">or remove</a> the filters or continue to another results page.</p></div>` : '<div class="empty-state"><h3>No issues found</h3><p>Try another series name or adjust the issue number and year.</p></div>'}<div class="pagination">${data.previous ? '<button class="quiet" id="previous">← Previous</button>' : ''}<span class="muted">Page ${data.page}</span>${data.next ? '<button class="quiet" id="next">Next →</button>' : ''}</div></div>`;
  $('#hide-owned').onclick=()=>{const p=new URLSearchParams(params);if(p.get('hide_owned')==='1')p.delete('hide_owned');else p.set('hide_owned','1');location.hash=`#/?${p}`;};
    function renderTypeOptions(catalog=[]){
      $('#series-type-options').innerHTML=seriesTypeOptions(data.results,catalog,seriesTypes).map(type=>`<label class="series-type-choice"><input type="checkbox" name="type" value="${type.id}" ${seriesTypes.has(type.id)?'checked':''}><span>${esc(type.name)}</span></label>`).join('');
    }
    renderTypeOptions();
    const filterDropdown=$('#results-filter');let loadedTypes=false;
    filterDropdown.ontoggle=async()=>{
      if(!filterDropdown.open||loadedTypes)return;loadedTypes=true;
      $('#series-type-status').textContent='Loading series types…';
      try{
        const catalog=await api('/series-types');if(ticket!==generation)return;
        // Preserve any checkbox edits made while the catalog loads.
        const edited=new Set([...document.querySelectorAll('#series-type-options input:checked')].map(input=>Number(input.value)));
        const options=seriesTypeOptions(data.results,catalog.items,seriesTypes);
        $('#series-type-options').innerHTML=options.map(type=>`<label class="series-type-choice"><input type="checkbox" name="type" value="${type.id}" ${edited.has(type.id)?'checked':''}><span>${esc(type.name)}</span></label>`).join('');
        $('#series-type-status').textContent='';
      }catch{if(ticket===generation){$('#series-type-status').textContent='Showing types available on this page. Full type list is temporarily unavailable.';loadedTypes=false;}}
    };
    filterDropdown.onkeydown=event=>{if(event.key==='Escape'){filterDropdown.open=false;filterDropdown.querySelector('summary').focus();}};
    function applyTypes(ids,names=[]){const p=new URLSearchParams(params);if(ids.length)p.set('series_types',ids.join(','));else p.delete('series_types');p.delete('series_name_filter');for(const name of names)p.append('series_name_filter',name);const hash=`#/?${p}`;if(location.hash===hash)route();else location.hash=hash;}
    $('#series-type-filters').onsubmit=event=>{event.preventDefault();applyTypes([...new FormData(event.target).getAll('type')],[...new FormData(event.target).getAll('series_name')]);};
    $('#clear-series-types').onclick=()=>applyTypes([]);
    document.querySelectorAll('[data-choose]').forEach(group => group.querySelectorAll('button').forEach(b => b.onclick = async()=>{
      const id=Number(group.dataset.choose);
      if(b.dataset.action!=='read')return choose(id);
      b.disabled=true;
      try{
        const issue=await api(`/metron/issues/${id}`);if(ticket!==generation)return;
        const ctx=context(issue,api,text=>message(text,true));
        const key=issue.read?.edition_key||issue.editions.find(e=>e.key==='standard')?.key||issue.editions[0]?.key;
        await changeRead(ctx,copyState(ctx,key));if(ticket===generation)await route();
      }catch(error){message(error.message,true);}finally{b.disabled=false;}
    }));
    for (const [id, delta] of [['previous', -1], ['next', 1]]) if ($(`#${id}`)) $(`#${id}`).onclick = () => { const p = new URLSearchParams(params); p.set('page', String(data.page + delta)); location.hash = `#/?${p}`; };
  } catch (e) { if (ticket === generation) { $('#search-results').innerHTML = ''; message(e.message, true); } }
  finally { if (ticket === generation) button.disabled = false; }
}
function mountRating(container,ctx,state){
  let displayed=Symbol();
  function render(){
    if(displayed!==ctx.issue.user_rating){
      displayed=ctx.issue.user_rating;
      container.innerHTML=`<form class="personal-rating-form">${ratingChoices(displayed ?? null).replace('</output>','</output>'+(displayed!=null?'<button type="button" class="clear-rating-icon" data-clear-rating aria-label="Clear rating" title="Clear rating"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></svg></button>':''))}<p class="hint rating-note">Rating this issue marks every copy and variant as read.</p><p class="form-error" role="alert"></p></form>`;
      const form=container.querySelector('form');bindRatingPreview(form);
      form.onsubmit=e=>e.preventDefault();
      form.querySelectorAll('[name=rating]').forEach(input=>input.addEventListener('click',()=>save(Number(input.value))));
      const clear=form.querySelector('[data-clear-rating]');if(clear)clear.onclick=()=>save(null);
    }
    container.querySelectorAll('[name=rating]').forEach(input=>input.disabled=ctx.busy || !state.editionKey);
    container.querySelectorAll('button').forEach(b=>b.disabled=ctx.busy || !state.editionKey || b.hasAttribute('data-clear-rating') && ctx.issue.user_rating==null);
  }
  async function save(value){
    if(ctx.busy || !state.editionKey)return;
    container.querySelector('.form-error').textContent='';ctx.busy=true;ctx.notify();
    try{
      const fresh=ctx.saved?await api(`/issues/${ctx.issue.id}/rating`,{method:'PATCH',body:JSON.stringify({rating:value,edition_key:state.editionKey})})
        :(await api('/entries',{method:'POST',body:JSON.stringify({issue_id:ctx.issue.id,edition_key:state.editionKey,owned:false,read:true,rating:value})})).issue;
      ctx.sync(fresh);
     }catch(error){
      container.querySelectorAll('[name=rating]').forEach(input=>input.checked=Number(input.value)===ctx.issue.user_rating);
      container.querySelectorAll('.rating-half').forEach((label,i)=>label.classList.toggle('filled',(i+1)/2<=(ctx.issue.user_rating||0)));
      container.querySelector('.rating-value').textContent=ctx.issue.user_rating ? `${ctx.issue.user_rating} / 5` : 'Not rated';
      container.querySelector('.form-error').textContent=error.message;
    }
    finally{ctx.busy=false;ctx.notify();}
  }
  ctx.listeners.add(render);render();
}
function mountTileRating(container,ctx,state){
  function paint(value){
    container.querySelectorAll('.tile-rating-half').forEach((button,i)=>button.classList.toggle('filled',(i+1)/2<=value));
    container.classList.toggle('five-stars',value===5);
  }
  function render(){
    container.innerHTML=`<div class="tile-rating-scale" role="group" aria-label="Rate this comic">${Array.from({length:10},(_,i)=>`<button type="button" class="tile-rating-half ${i%2?'right-half':''}" data-score="${(i+1)/2}" aria-label="Rate ${(i+1)/2} out of 5 stars" aria-pressed="${ctx.issue.user_rating===(i+1)/2}" title="${(i+1)/2} out of 5 stars" ${ctx.busy?'disabled':''}><span aria-hidden="true">★</span></button>`).join('')}</div>`;
    paint(ctx.issue.user_rating||0);
    container.querySelectorAll('button').forEach(button=>{
      const value=Number(button.dataset.score);
      button.onmouseenter=button.onfocus=()=>paint(value);
      button.onclick=async()=>{
        if(ctx.busy)return;ctx.busy=true;ctx.notify();
        try{ctx.sync(await api(`/issues/${ctx.issue.id}/rating`,{method:'PATCH',body:JSON.stringify({rating:value,edition_key:state.editionKey})}));}
        catch(error){ctx.onError(error.message);}
        finally{ctx.busy=false;ctx.notify();}
      };
    });
  }
  container.onmouseleave=()=>paint(ctx.issue.user_rating||0);
  container.onfocusout=event=>{if(!container.contains(event.relatedTarget))paint(ctx.issue.user_rating||0);};
  ctx.listeners.add(render);render();
}

async function choose(id,savedIssue=null,selectedKey=null){
  const token=++dialogGeneration;
  dialog.innerHTML='<h2 id="dialog-title">Choose a cover</h2><p class="loading" role="status">Opening comic details…</p><button id="close-dialog" class="quiet">Close</button>';
  $('#close-dialog').onclick=closeDialog;dialog.showModal();
  try{
    const issue=savedIssue || await api(`/metron/issues/${id}`);
    if(token!==dialogGeneration || !dialog.open)return;
    const ctx=context(issue,api,text=>{const box=dialog.querySelector('.toggle-error');if(box)box.textContent=text;else message(text,true);});
    const initial=selectedKey || (issue.editions.length===1?issue.editions[0].key:null);
    const state=copyState(ctx,initial);
    dialog.innerHTML=`<div class="dialog-heading"><div><p class="eyebrow">Your comic</p><h2 id="dialog-title">${comicTitle(issue,{year:true})}</h2></div><button type="button" class="quiet" id="close-dialog" aria-label="Close">×</button></div><p class="hint">Choose a cover, then toggle its icons. Changes save immediately.</p><div class="variant-grid">${issue.editions.map(e=>`<label class="variant-choice"><input type="radio" name="edition" value="${esc(e.key)}" ${e.key===initial?'checked':''}>${cover(localCover(e)||e.source_image,e.name)}<span>${esc(e.name)}${e.upc?`<br><small>UPC ${esc(e.upc)}</small>`:''}</span></label>`).join('')}</div><div class="comic-actions" id="picker-actions"></div><p class="form-error toggle-error" role="alert"></p><div id="picker-rating"></div><div class="dialog-actions"><button class="quiet" id="close-picker">Done</button></div>`;
    $('#close-dialog').onclick=closeDialog;$('#close-picker').onclick=closeDialog;
    bindToggles($('#picker-actions'),ctx,state,{extra:true});mountRating($('#picker-rating'),ctx,state);
    dialog.querySelectorAll('[name=edition]').forEach(input=>input.onchange=()=>{
      if(ctx.busy)return;
      state.editionKey=input.value;state.copyId=ctx.issue.copies?.find(c=>c.edition_key===input.value)?.id || null;ctx.notify();
    });
    ctx.listeners.add(()=>dialog.querySelectorAll('[name=edition]').forEach(input=>input.disabled=ctx.busy));
    dialog.addEventListener('close',()=>route(),{once:true});
  }catch(error){if(token===dialogGeneration && dialog.open){dialog.innerHTML=`<h2 id="dialog-title">Couldn’t open comic</h2><p class="form-error">${esc(error.message)}</p><button class="quiet" id="close-dialog">Close</button>`;$('#close-dialog').onclick=closeDialog;}}
}
async function collection(params,ticket){
  const view=collectionView,query=params.get('q')||'';

  app.innerHTML=`<div class="section-heading"><div><p class="eyebrow">Your personal archive</p><h2>My Collection</h2></div></div><nav class="tabs" aria-label="Collection view"><a href="#/collection" ${view==='owned'?'aria-current="page"':''}><img class="icon light-icon" src="/boxes.png" alt="">My Collection</a><a href="#/collection?view=read" ${view==='read'?'aria-current="page"':''}><img class="icon light-icon" src="/star.png" alt="">Read and Rated Comics</a><a href="#/collection?view=unread" ${view==='unread'?'aria-current="page"':''}><img class="icon light-icon" src="/unread.png" alt="">Unread Comics</a></nav><form id="collection-search" class="search-main collection-search"><label><span class="visually-hidden">Find in ${view==='read'?'read comics':'owned comics'}</span><input type="search" name="q" placeholder="Find a comic in your collection…" value="${esc(query)}" maxlength="160"></label><button class="quiet">Find</button></form><div id="collection-results"><p class="loading" role="status">Opening your collection…</p></div>`;
  $('#collection-search').onsubmit=e=>{e.preventDefault();const p=new URLSearchParams({view});const q=new FormData(e.target).get('q').trim();if(q)p.set('q',q);const hash=`#/collection?${p}`;if(location.hash===hash)route();else location.hash=hash;};
  const data=await api(`/collection?${new URLSearchParams({view:view==='unread'?'owned':view,q:query})}`);if(view==='unread')data.items=data.items.filter(row=>!row.issue.read);if(ticket!==generation)return;
  if(!data.items.length){$('#collection-results').innerHTML=`<div class="empty-state"><h3>${query?'No comics match.':view==='read'?'Ready to launch discourse':view==='unread'?'No unread comics in your collection.':'Make room for your first comic.'}</h3><p>Search Metron for a comic and toggle its collection or read icon.</p>${view==='read'?`<p>You're just one comic rating away from having opinions about comics.</p>`:''}<a class="button" href="${esc(query ? `#/?${new URLSearchParams({q:query})}` : '#/')}"><img class="metron-logo" src="/metron.svg" alt="">Search Metron</a></div>`;return;}
  $('#collection-results').innerHTML=`<p class="muted" id="collection-count"></p><div class="shelf">${data.items.map((row,i)=>`<article class="comic-card collection-card" data-card="${i}"><a class="comic-link" href="#/issues/${row.issue.id}?${new URLSearchParams({edition:row.edition.key,from:view,...(view!=='read'?{copy:row.id}:{})})}">${cover(localCover(row.edition),comicTitleText(row.issue,{year:true}))}<div class="card-info"><p class="eyebrow">${esc(row.issue.publisher?.name||'Comic')} · ${esc(row.issue.series.year_began||'')}</p><h3>${comicTitle(row.issue)}</h3>${row.edition.key!=='standard'?`<p class="muted variant-caption">${esc(row.edition.name)}</p>`:''}${view!=='read'?`<p class="copy-identifier">Copy ${esc(row.id.slice(0,8))}</p>`:''}</div></a><div class="tile-rating" data-card-rating></div><div class="comic-actions card-toggles" data-card-actions></div></article>`).join('')}</div>`;
  const contexts=new Map(),states=[];
  for(const [i,row] of data.items.entries()){
    if(!contexts.has(row.issue.id))contexts.set(row.issue.id,context(row.issue,api,text=>message(text,true)));
    const ctx=contexts.get(row.issue.id),state=copyState(ctx,row.edition.key,view!=='read'?row.id:undefined);states.push({ctx,state});
    const card=document.querySelector(`[data-card="${i}"]`);
    bindToggles(card.querySelector('[data-card-actions]'),ctx,state);
    mountTileRating(card.querySelector('[data-card-rating]'),ctx,state);
    ctx.listeners.add(()=>{if(view==='unread')card.hidden=ctx.issue.read;card.classList.toggle('inactive-copy',view!=='read'&&!state.copyId);updateCount();});
  }
  function updateCount(){const count=states.filter(({ctx,state})=>view!=='read'?state.copyId&&(view!=='unread'||!ctx.issue.read):ctx.issue.read).length;$('#collection-count').textContent=`${count} ${view!=='read'?(count===1?'owned copy':'owned copies'):(count===1?'read issue':'read issues')}`;}
  contexts.forEach(ctx=>ctx.notify());updateCount();
}
async function detail(id,params,ticket){
  app.innerHTML='<p class="loading" role="status">Opening comic…</p>';
  const issue=await api(`/issues/${id}`);if(ticket!==generation)return;
  const edition=issue.editions.find(e=>e.key===params.get('edition'))||issue.editions[0],from=params.get('from')==='read'?'read':'owned';
  const ctx=context(issue,api,text=>message(text,true)),rows=new Map();
  for(const copy of issue.copies)rows.set(copy.id,{copy,state:copyState(ctx,copy.edition_key,copy.id)});
  const selectedCopy=params.has('copy')?params.get('copy'):issue.copies.find(c=>c.edition_key===edition.key)?.id;
  const state=rows.get(selectedCopy)?.state || copyState(ctx,edition.key,null);
  ctx.listeners.add(()=>{
    for(const row of rows.values())if(row.state.copyId&&!ctx.issue.copies.some(copy=>copy.id===row.state.copyId))row.state.copyId=null;
    if(state.copyId&&!ctx.issue.copies.some(copy=>copy.id===state.copyId))state.copyId=null;
  });
  app.innerHTML=`<a class="back-link" href="#/collection?view=${from}">← My Collection</a><div class="detail-layout"><aside>${localCover(edition)?`<button type="button" class="cover-zoom" id="open-cover-lightbox" aria-label="Open full-size cover image">${cover(localCover(edition),comicTitleText(issue,{year:true}))}</button>`:cover(null,issue.display_name)}${localCover(edition)?`<p class="hint"><a href="${localCover(edition)}" target="_blank" rel="noopener noreferrer">Open original cover ↗</a></p>`:''}</aside><div><p class="eyebrow">${esc(issue.publisher?.name||'Comic')} · ${esc(issue.series.name)} · Volume ${esc(issue.series.volume||'—')}</p><h2>${comicTitle(issue)}</h2>${issue.title?`<p class="intro">${esc(issue.title)}</p>`:''}<p class="intro">${esc(edition.name)}</p><div class="comic-actions" id="detail-actions"></div><p class="hint rating-note">Toggle an icon to save its status. Use the duplicate icon for another copy.</p><div id="detail-rating"></div><button type="button" class="quiet log-reading-button" id="add-reading-log"><img class="icon light-icon" src="/reading-log.png" alt="">Log a Reading</button><dl class="metadata">${field('Publisher',issue.publisher?.name)}${field('Volume',issue.series.volume)}${field('Format',issue.series.series_type?.name)}${field('Cover date',date(issue.cover_date))}${field('Release date',date(issue.store_date))}${field('UPC · selected cover',edition.upc)}${field('SKU · selected cover',edition.sku)}${field('ISBN',issue.isbn)}${field('Pages',issue.page_count)}${field('Cover price',edition.price!==null?`${edition.price_currency ? edition.price_currency+' ' : '$'}${edition.price}`:null)}${field('Content rating',issue.rating?.name)}${field('Imprint',issue.imprint?.name)}</dl>${issue.resource_url?`<p class="deep-link"><a href="${esc(issue.resource_url)}" target="_blank" rel="noopener noreferrer">Deep Search on Metron ↗</a></p>`:''}<p class="source-credit">Metadata from Metron · saved ${esc(date(issue.saved_at))}. Cover artwork belongs to its respective rights holders.</p></div></div><section class="copy-list"><h3>Owned Copies</h3><div id="copy-rows"></div></section><section class="series-ratings" id="series-ratings" hidden><h3>Ratings In This Series</h3><div id="series-rating-chart"></div></section><section class="issue-reading-log"><h3>Reading Log Entries</h3><div id="issue-reading-entries"></div></section><section class="owned-series"><h3>Owned Issues In Series</h3><div id="owned-series-results"><p class="muted">Opening owned issues…</p></div><a class="button quiet full-series-search" href="#/?${new URLSearchParams({q:issue.series.name})}"><img class="metron-logo" src="/metron.svg" alt="">Search Full Series on Metron</a></section>`;
  if(localCover(edition))$('#open-cover-lightbox').onclick=()=>openCoverImage(localCover(edition),issue,edition);
  bindToggles($('#detail-actions'),ctx,state,{extra:true});mountRating($('#detail-rating'),ctx,state);
  let unbind=[];
  function renderCopies(){
    if(ctx.busy)return;
    for(const copy of ctx.issue.copies){
      let row=[...rows.values()].find(r=>r.state.copyId===copy.id);
      if(!row){row={copy,state:state.copyId===copy.id?state:copyState(ctx,copy.edition_key,copy.id)};rows.set(copy.id,row);}else row.copy=copy;
    }
    unbind.forEach(fn=>fn());unbind=[];
    $('#copy-rows').innerHTML=rows.size?[...rows.values()].map((row,i)=>`<div class="copy-row ${row.state.copyId?'':'inactive-copy'}"><div><strong>${esc(ctx.editions.find(e=>e.key===row.state.editionKey)?.name)}</strong><p class="muted">Added ${esc(date(row.copy.added_at))} · Copy <code>${esc((row.state.copyId||row.copy.id).slice(0,8))}</code></p></div><div class="comic-actions" data-copy-actions="${i}"></div></div>`).join(''):'<p class="muted">No owned copies yet.</p>';
    [...rows.values()].forEach((row,i)=>unbind.push(bindToggles(document.querySelector(`[data-copy-actions="${i}"]`),ctx,row.state,{actions:['owned']})));
  }
  ctx.listeners.add(()=>{if(state.copyId){const p=new URLSearchParams(params);p.set('copy',state.copyId);history.replaceState(null,'',`#/issues/${id}?${p}`);}});
  $('#add-reading-log').onclick=()=>changeRead(ctx,state,{logOnly:true});
  ctx.listeners.add(()=>$('#add-reading-log').disabled=ctx.busy);
  let logGeneration=0;
  async function renderIssueLog(){
    if(ctx.busy)return;
    const request=++logGeneration;
    try{
      const data=await api(`/issues/${id}/reading-log`);
      if(ticket!==generation||request!==logGeneration)return;
      $('#issue-reading-entries').innerHTML=data.items.length ? `<ul class="reading-entries issue-log-list">${data.items.map(entry=>`<li><span>${esc(date(entry.read_date))}</span><button class="quiet log-remove" type="button" data-remove-issue-log="${entry.id}" aria-label="Remove reading log entry on ${esc(date(entry.read_date))}" title="Remove log entry">×</button></li>`).join('')}</ul>` : '<p class="muted">No reading log entries for this issue.</p>';
      document.querySelectorAll('[data-remove-issue-log]').forEach(button=>button.onclick=async()=>{
        if(ctx.busy)return;ctx.busy=true;ctx.notify();
        try{await api(`/reading-log/${button.dataset.removeIssueLog}`,{method:'DELETE'});ctx.sync(await api(`/issues/${id}`));}
        catch(error){ctx.onError(error.message);}finally{ctx.busy=false;ctx.notify();}
      });
    }catch(error){if(ticket===generation&&request===logGeneration)$('#issue-reading-entries').innerHTML=`<p class="form-error">${esc(error.message)}</p>`;}
  }
  ctx.listeners.add(renderIssueLog);renderIssueLog();
  let chartGeneration=0;
  async function renderSeriesRatings(){
    if(ctx.busy)return;
    const request=++chartGeneration;
    try{
      const data=await api(`/issues/${id}/series-ratings`);
      if(ticket!==generation||request!==chartGeneration)return;
      const section=$('#series-ratings');section.hidden=data.points.length<2;
      $('#series-rating-chart').innerHTML=seriesRatingChart(data);
    }catch{if(ticket===generation&&request===chartGeneration)$('#series-ratings').hidden=true;}
  }
  ctx.listeners.add(renderSeriesRatings);renderSeriesRatings();
  let seriesGeneration=0;
  let seriesUnbind=[];
  async function renderOwnedSeries(){
    if(ctx.busy)return;
    const request=++seriesGeneration;
    try{
      const data=await api(`/issues/${id}/owned-series`);
      if(ticket!==generation||request!==seriesGeneration)return;
      $('#owned-series-results').innerHTML=data.items.length ? `<div class="shelf series-shelf">${data.items.map((row,index)=>`<article class="comic-card collection-card" data-series-card="${index}"><a class="comic-link" href="#/issues/${row.issue.id}?${new URLSearchParams({edition:row.edition.key,from:'owned'})}" ${row.issue.id===issue.id?'aria-current="page"':''}>${cover(localCover(row.edition),comicTitleText(row.issue,{year:true}))}<div class="card-info"><p class="eyebrow">${esc(row.issue.series.year_began||'—')} · Volume ${esc(row.issue.series.volume??'—')}</p><h3>${comicTitle(row.issue)}</h3>${row.edition.key!=='standard'?`<p class="muted variant-caption">${esc(row.edition.name)}</p>`:''}<p class="muted" data-series-count>${row.copy_count} owned ${row.copy_count===1?'copy':'copies'}</p></div></a><div class="comic-actions card-toggles" data-series-actions></div></article>`).join('')}</div>` : '<p class="muted">No owned issues in this series.</p>';
      seriesUnbind.forEach(fn=>fn());seriesUnbind=[];
      data.items.forEach((row,index)=>{
        const tileCtx=row.issue.id===issue.id ? ctx : context(row.issue,api,text=>message(text,true));
        const tileState=row.issue.id===issue.id && row.edition.key===state.editionKey ? state : copyState(tileCtx,row.edition.key);
        const card=document.querySelector(`[data-series-card="${index}"]`);
        const reconcile=()=>{
          if(tileState.copyId&&!tileCtx.issue.copies.some(copy=>copy.id===tileState.copyId))tileState.copyId=null;
          const count=tileCtx.issue.copies.length;
          card.querySelector('[data-series-count]').textContent=`${count} owned ${count===1?'copy':'copies'}`;
          card.classList.toggle('inactive-copy',!tileState.copyId);
        };
        tileCtx.listeners.add(reconcile);reconcile();
        if(tileCtx!==ctx){tileCtx.listeners.add(renderSeriesRatings);seriesUnbind.push(()=>tileCtx.listeners.delete(renderSeriesRatings));}
        seriesUnbind.push(()=>tileCtx.listeners.delete(reconcile));
        seriesUnbind.push(bindToggles(card.querySelector('[data-series-actions]'),tileCtx,tileState));
      });
    }catch(error){if(ticket===generation&&request===seriesGeneration)$('#owned-series-results').innerHTML=`<p class="form-error">${esc(error.message)}</p>`;}
  }
  renderOwnedSeries();
  ctx.listeners.add(renderCopies);renderCopies();
}

function changelog() {
  const renderRelease=r=>`<article class="release"><p class="eyebrow"><span class="build-version">${esc(r.version)}</span> · <time datetime="${r.date}">${esc(date(r.date))}</time></p><ul>${r.changes.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></article>`;
  const alpha=releases.filter(r=>r.version.startsWith('α'));
  app.innerHTML=`<div class="section-heading"><h2>Changelog</h2><span class="count">${esc(releases[0].version)}</span></div>${releases.filter(r=>!r.version.startsWith('α')).map(renderRelease).join('')}${alpha.length?`<details class="alpha-history"><summary>Alpha releases (α)</summary>${alpha.map(renderRelease).join('')}</details>`:''}`;
}

document.addEventListener('click',event=>{
  const dropdown=$('#results-filter');if(dropdown?.open&&!dropdown.contains(event.target))dropdown.open=false;
});
window.addEventListener('hashchange', route);
try { connected = (await api('/health')).metron_configured; } catch { /* Search and collection report actionable failures. */ }
await route();
