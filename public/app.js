import { releases } from './releases.js';
import { actionButton, context, copyState, bindToggles } from './actions.js';
const $ = s => document.querySelector(s), app = $('#app'), notice = $('#notice'), dialog = $('#dialog');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (name, light = false) => `<img class="icon${light ? ' light-icon' : ''}" src="/${name}.png" alt="">`;
const date = value => value ? new Date(value.length > 10 ? value : `${value}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not supplied';
const cover = (src, title = '', cls = '') => src ? `<img class="cover ${cls}" src="${esc(src)}" alt="${esc(title)}" loading="lazy">` : '<div class="cover missing-cover">Cover unavailable</div>';
const localCover = edition => edition?.cover_file ? `/covers/${edition.cover_file}` : null;
const field = (label, value) => `<div><dt>${esc(label)}</dt><dd>${esc(value || 'Not supplied')}</dd></div>`;
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
function ratingChoices(value = null) {
  return `<fieldset class="rating-picker"><legend>Your rating</legend><div class="rating-scale">${Array.from({ length: 10 }, (_, i) => {
    const score = (i + 1) / 2;
    return `<label class="rating-half ${i % 2 ? 'right-half' : 'left-half'}${value !== null && score <= value ? ' filled' : ''}"><input type="radio" name="rating" value="${score}" aria-label="${score} out of 5 stars" ${score === value ? 'checked' : ''}><span aria-hidden="true">★</span></label>`;
  }).join('')}</div><output class="rating-value">${value === null ? 'Not rated' : `${value} / 5`}</output></fieldset>`;
}
function ratingDisplay(value) {
  if (value == null) return '<p class="rating-summary muted">Not rated</p>';
  return `<div class="rating-summary"><span class="display-stars" role="img" aria-label="${value} out of 5 stars">${Array.from({ length: 5 }, (_, i) => `<span aria-hidden="true" class="${value >= i + 1 ? 'full-star' : value >= i + 0.5 ? 'half-star' : 'empty-star'}">★</span>`).join('')}</span><span class="muted">${value} / 5</span></div>`;
}
function bindRatingPreview(form) {
  form.querySelectorAll('[name=rating]').forEach(input => input.addEventListener('change', () => {
    const value = Number(input.value);
    form.querySelectorAll('.rating-half').forEach((label, i) => label.classList.toggle('filled', (i + 1) / 2 <= value));
    form.querySelector('.rating-value').textContent = `${value} / 5`;
  }));
}

async function wantList(params, ticket) {
  const q = params.get('q') || '';
  app.innerHTML = `<div class="section-heading"><div><p class="eyebrow">A place for your next finds</p><h2>Want List</h2></div><a class="button secondary" href="#/">Find a comic →</a></div><p class="intro">The covers you’re looking for. Open a comic to see it on Metron.</p><form class="search-main collection-search" id="want-search"><label>Search your Want List<input type="search" name="q" value="${esc(q)}" placeholder="Find a series or cover…" maxlength="160"></label><button class="quiet">Find</button></form><div id="want-results"><p class="loading" role="status">Opening your Want List…</p></div>`;
  $('#want-search').onsubmit = e => { e.preventDefault(); const p=new URLSearchParams(); const value=new FormData(e.target).get('q').trim(); if(value)p.set('q',value); const hash=`#/wants${p.size ? `?${p}` : ''}`; if(location.hash===hash)route();else location.hash=hash; };
  const data = await api(`/wants?${new URLSearchParams({q})}`);
  if (ticket !== generation) return;
  $('#want-results').innerHTML = data.items.length ? `<p class="muted" id="want-count">${data.items.length} wanted cover${data.items.length===1?'':'s'}</p><div class="shelf">${data.items.map((row,index) => `<article class="comic-card want-card"><a class="comic-link" href="${esc(row.resource_url)}" target="_blank" rel="noopener noreferrer">${cover(localCover(row),row.display_name)}<div class="card-info"><p class="eyebrow">${esc(row.series.year_began || '')} · Volume ${esc(row.series.volume || '—')}</p><h3>${esc(row.series.name)} #${esc(row.number)}</h3><p class="muted">${esc(row.edition.name)}</p><p class="muted">View on Metron ↗</p></div></a><div class="comic-actions card-toggles" data-want-actions="${index}"></div></article>`).join('')}</div>` : `<div class="empty-state"><p class="eyebrow">${q?'No matches':'Your next finds'}</p><h3>${q?'No wanted covers match that search.':'Which cover will you find next?'}</h3><p>${q?'Try another series or cover name.':'Choose a cover in search and add it to your Want List.'}</p><a class="button" href="#/">Search comics →</a></div>`;
  const wantStates=[];
  data.items.forEach((row,index)=>{
    const ctx=context({id:row.issue_id,...row,editions:[{...row.edition,cover_file:row.cover_file,owned:false,wanted:true}],copies:[],read:null,user_rating:null,saved:false},api,text=>message(text,true));
    const state=copyState(ctx,row.edition.key);
    wantStates.push(ctx);
    const controls=document.querySelector(`[data-want-actions="${index}"]`);
    bindToggles(controls,ctx,state,{actions:['owned','wanted']});
    ctx.listeners.add(()=>{const count=wantStates.filter(c=>c.editions[0].wanted).length;$('#want-count').textContent=`${count} wanted cover${count===1?'':'s'}`;controls.closest('.comic-card').classList.toggle('inactive-copy',!ctx.editions[0].wanted);});
  });
}
function closeDialog() { dialogGeneration++; dialog.close(); }
dialog.addEventListener('close', () => { dialogGeneration++; });
async function route() {
  const ticket = ++generation;
  message(''); closeDialog();
  const { path, params } = routeData();
  document.querySelectorAll('nav a').forEach(a => { if (a.getAttribute('href') === `#${path}`) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  try {
    if (path === '/wants') return await wantList(params,ticket);
    if (path === '/changelog') return changelog();
    if (path === '/collection') { collectionView = params.get('view') === 'read' ? 'read' : 'owned'; return await collection(params, ticket); }
    const match = path.match(/^\/issues\/(\d+)$/);
    if (match) return await detail(match[1], params, ticket);
    await search(params, ticket);
  } catch (e) {
    if (ticket !== generation) return;
    app.innerHTML = `<a href="#/">← Search comics</a><div class="empty-state"><h2>Couldn’t open this page</h2><p>${esc(e.message)}</p></div>`;
  }
}

function searchForm(params) {
  return `<form id="search-form" class="search-form"><div class="search-main"><label>Series name<input name="q" value="${esc(params.get('q') || '')}" placeholder="Find a series, from Batman to Saga…" maxlength="160" autocomplete="off" type="search"></label><button type="submit">Search Metron <span aria-hidden="true">→</span></button></div><details class="search-options" ${params.get('number') || params.get('year') || params.get('upc') ? 'open' : ''}><summary>Issue, year & barcode</summary><div class="fields"><label>Issue number<input name="number" value="${esc(params.get('number') || '')}" placeholder="e.g. 1 or ½" maxlength="30"></label><label>Series start year<input name="year" value="${esc(params.get('year') || '')}" inputmode="numeric" pattern="[0-9]{4}" placeholder="e.g. 2024"></label><label>UPC<input name="upc" value="${esc(params.get('upc') || '')}" inputmode="numeric" pattern="[0-9]{8,18}" placeholder="Full comic barcode"></label></div></details><p class="search-help">Search by series name, or use a UPC on its own.</p></form>`;
}
async function search(params, ticket) {
  app.innerHTML = `<div class="hero"><span class="hero-mark" aria-hidden="true">✦</span><p class="eyebrow">Open up a whole new universe.</p><h2>Find your next addition.</h2><p class="intro">Find a comic, choose its cover, and make it yours.<br>Keep the stories you own and the ones you’ve read.</p>${searchForm(params)}</div>${!connected ? '<div class="connection">Connect Metron to start searching: add your API token to <code>METRON_API_TOKEN</code> in the local <code>.env</code> file and restart DangerRoom. <a href="https://metron.cloud" target="_blank" rel="noopener noreferrer">Open Metron ↗</a></div>' : ''}<div id="search-results"></div>`;
  $('#search-form').onsubmit = e => {
    e.preventDefault();
    const values = new URLSearchParams();
    for (const [key, value] of new FormData(e.target)) if (value.trim()) values.set(key, value.trim());
    if (!values.has('q') && !values.has('upc')) { message('Enter a series name or UPC to search.', true); return; }
    const hash = `#/?${values}`;
    if (location.hash === hash) route(); else location.hash = hash;
  };
  if (!params.get('q') && !params.get('upc')) return;
  $('#search-results').innerHTML = '<p class="loading" role="status">Searching Metron…</p>';
  const button = $('#search-form button'); button.disabled = true;
  try {
    const data = await api(`/search?${params}`);
    if (ticket !== generation) return;
    $('#search-results').innerHTML = `<div class="results"><div class="section-heading"><div><p class="eyebrow">From Metron</p><h2>Search results</h2></div><span class="count">${Number(data.count).toLocaleString()} issue${data.count === 1 ? '' : 's'}</span></div>${data.results.length ? `<div class="shelf">${data.results.map(r => `<article class="comic-card">${cover(localCover(r) || r.image, r.display_name)}<div class="card-info"><p class="eyebrow">${esc(r.series.year_began || '')} · Volume ${esc(r.series.volume || '—')}</p><h3>${esc(r.series.name)} #${esc(r.number)}</h3><p class="muted">${esc(date(r.cover_date))}</p><div class="comic-actions" data-choose="${r.id}">${actionButton('owned',r.owned)}${actionButton('wanted',r.wanted)}${actionButton('read',r.read)}</div></div></article>`).join('')}</div>` : '<div class="empty-state"><h3>No issues found</h3><p>Try another series name or adjust the issue number and year.</p></div>'}<div class="pagination">${data.previous ? '<button class="quiet" id="previous">← Previous</button>' : ''}<span class="muted">Page ${data.page}</span>${data.next ? '<button class="quiet" id="next">Next →</button>' : ''}</div></div>`;
    document.querySelectorAll('[data-choose]').forEach(group => group.querySelectorAll('button').forEach(b => b.onclick = () => choose(Number(group.dataset.choose))));
    for (const [id, delta] of [['previous', -1], ['next', 1]]) if ($(`#${id}`)) $(`#${id}`).onclick = () => { const p = new URLSearchParams(params); p.set('page', String(data.page + delta)); location.hash = `#/?${p}`; };
  } catch (e) { if (ticket === generation) { $('#search-results').innerHTML = ''; message(e.message, true); } }
  finally { if (ticket === generation) button.disabled = false; }
}
function mountRating(container,ctx,state){
  let displayed=Symbol();
  function render(){
    if(displayed!==ctx.issue.user_rating){
      displayed=ctx.issue.user_rating;
      container.innerHTML=`<form class="personal-rating-form">${ratingChoices(displayed ?? null)}<p class="hint">Rating this issue marks every copy and variant as read.</p><div class="actions"><button type="submit">Save rating</button><button type="button" class="quiet" data-clear-rating>Clear rating</button></div><p class="form-error" role="alert"></p></form>`;
      const form=container.querySelector('form');bindRatingPreview(form);
      form.onsubmit=e=>{e.preventDefault();const data=new FormData(form);if(!data.has('rating')){form.querySelector('.form-error').textContent='Choose a rating first.';return;}save(Number(data.get('rating')));};
      form.querySelector('[data-clear-rating]').onclick=()=>save(null);
    }
    container.querySelectorAll('button').forEach(b=>b.disabled=ctx.busy || !state.editionKey || b.hasAttribute('data-clear-rating') && ctx.issue.user_rating==null);
  }
  async function save(value){
    if(ctx.busy)return;ctx.busy=true;ctx.notify();
    try{
      const fresh=ctx.saved?await api(`/issues/${ctx.issue.id}/rating`,{method:'PATCH',body:JSON.stringify({rating:value,edition_key:state.editionKey})})
        :(await api('/entries',{method:'POST',body:JSON.stringify({issue_id:ctx.issue.id,edition_key:state.editionKey,owned:false,read:true,rating:value})})).issue;
      ctx.sync(fresh);
    }catch(error){container.querySelector('.form-error').textContent=error.message;}
    finally{ctx.busy=false;ctx.notify();}
  }
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
    dialog.innerHTML=`<div class="dialog-heading"><div><p class="eyebrow">Your comic</p><h2 id="dialog-title">${esc(issue.display_name)}</h2></div><button type="button" class="quiet" id="close-dialog" aria-label="Close">×</button></div><p class="hint">Choose a cover, then toggle its icons. Changes save immediately.</p><div class="variant-grid">${issue.editions.map(e=>`<label class="variant-choice"><input type="radio" name="edition" value="${esc(e.key)}" ${e.key===initial?'checked':''}>${cover(localCover(e)||e.source_image,e.name)}<span>${esc(e.name)}${e.upc?`<br><small>UPC ${esc(e.upc)}</small>`:''}</span></label>`).join('')}</div><div class="comic-actions" id="picker-actions"></div><p class="form-error toggle-error" role="alert"></p><div id="picker-rating"></div><div class="dialog-actions"><button class="quiet" id="close-picker">Done</button></div>`;
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
  app.innerHTML=`<div class="section-heading"><div><p class="eyebrow">Your personal archive</p><h2>My Collection</h2></div><a class="button secondary" href="#/">Find a comic →</a></div><nav class="tabs" aria-label="Collection view"><a href="#/collection" ${view==='owned'?'aria-current="page"':''}>Owned comics</a><a href="#/collection?view=read" ${view==='read'?'aria-current="page"':''}>Read comics</a></nav><form id="collection-search" class="search-main collection-search"><label>Search ${view==='read'?'read comics':'owned comics'}<input type="search" name="q" placeholder="Search your collection…" value="${esc(query)}" maxlength="160"></label><button class="quiet">Find</button></form><div id="collection-results"><p class="loading" role="status">Opening your collection…</p></div>`;
  $('#collection-search').onsubmit=e=>{e.preventDefault();const p=new URLSearchParams({view});const q=new FormData(e.target).get('q').trim();if(q)p.set('q',q);const hash=`#/collection?${p}`;if(location.hash===hash)route();else location.hash=hash;};
  const data=await api(`/collection?${new URLSearchParams({view,q:query})}`);if(ticket!==generation)return;
  if(!data.items.length){$('#collection-results').innerHTML=`<div class="empty-state"><h3>${query?'No comics match that search.':view==='read'?'Your next story starts here.':'Make room for your first comic.'}</h3><p>Find a comic and toggle its collection or read icon.</p><a class="button" href="#/">Search comics →</a></div>`;return;}
  $('#collection-results').innerHTML=`<p class="muted" id="collection-count"></p><div class="shelf">${data.items.map((row,i)=>`<article class="comic-card" data-card="${i}"><a class="comic-link" href="#/issues/${row.issue.id}?${new URLSearchParams({edition:row.edition.key,from:view,...(view==='owned'?{copy:row.id}:{})})}">${cover(localCover(row.edition),row.issue.display_name)}<div class="card-info"><p class="eyebrow">${esc(row.issue.publisher?.name||'Comic')} · ${esc(row.issue.series.year_began||'')}</p><h3>${esc(row.issue.series.name)} #${esc(row.issue.number)}</h3><p class="muted">${esc(row.edition.name)}</p>${view==='owned'?`<p class="muted">Copy ${esc(row.id.slice(0,8))}</p>`:''}<div data-card-status></div></div></a><div class="comic-actions card-toggles" data-card-actions></div></article>`).join('')}</div>`;
  const contexts=new Map(),states=[];
  for(const [i,row] of data.items.entries()){
    if(!contexts.has(row.issue.id))contexts.set(row.issue.id,context(row.issue,api,text=>message(text,true)));
    const ctx=contexts.get(row.issue.id),state=copyState(ctx,row.edition.key,view==='owned'?row.id:undefined);states.push({ctx,state});
    const card=document.querySelector(`[data-card="${i}"]`);
    bindToggles(card.querySelector('[data-card-actions]'),ctx,state);
    ctx.listeners.add(()=>{card.querySelector('[data-card-status]').innerHTML=`<span class="badge">${ctx.issue.read?'Read':'Unread'}</span>${ratingDisplay(ctx.issue.user_rating)}`;card.classList.toggle('inactive-copy',view==='owned'&&!state.copyId);updateCount();});
  }
  function updateCount(){const count=states.filter(({ctx,state})=>view==='owned'?state.copyId:ctx.issue.read).length;$('#collection-count').textContent=`${count} ${view==='owned'?(count===1?'owned copy':'owned copies'):(count===1?'read issue':'read issues')}`;}
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
  app.innerHTML=`<a class="back-link" href="#/collection?view=${from}">← My Collection</a><div class="detail-layout"><aside>${cover(localCover(edition),issue.display_name)}${localCover(edition)?`<p class="hint"><a href="${localCover(edition)}" target="_blank" rel="noopener noreferrer">Open original cover ↗</a></p>`:''}</aside><div><p class="eyebrow">${esc(issue.publisher?.name||'Comic')} · ${esc(issue.series.year_began||'')} · Volume ${esc(issue.series.volume||'—')}</p><h2>${esc(issue.series.name)} #${esc(issue.number)}</h2>${issue.title?`<p class="intro">${esc(issue.title)}</p>`:''}<p class="intro">${esc(edition.name)}</p><div class="comic-actions" id="detail-actions"></div><p class="hint">Toggle an icon to save its status. Use the small plus icon for another copy.</p><div id="detail-rating"></div><dl class="metadata">${field('Cover date',date(issue.cover_date))}${field('Release date',date(issue.store_date))}${field('UPC · selected cover',edition.upc)}${field('SKU · selected cover',edition.sku)}${field('ISBN',issue.isbn)}${field('Pages',issue.page_count)}${field('Cover price',edition.price!==null?`${edition.price_currency||'Currency not supplied'} ${edition.price}`:null)}${field('Content rating',issue.rating?.name)}${field('Imprint',issue.imprint?.name)}</dl>${issue.resource_url?`<p class="deep-link"><a href="${esc(issue.resource_url)}" target="_blank" rel="noopener noreferrer">Deep Search on Metron ↗</a></p>`:''}<p class="source-credit">Metadata from Metron · saved ${esc(date(issue.saved_at))}. Cover artwork belongs to its respective rights holders.</p></div></div><section class="copy-list"><h3>Owned copies</h3><div id="copy-rows"></div></section>`;
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
  ctx.listeners.add(renderCopies);renderCopies();
}

function changelog() {
  app.innerHTML = `<a class="back-link" href="#/">← Search comics</a><div class="section-heading"><h2>Changelog</h2><span class="count">${esc(releases[0].version)}</span></div>${releases.map(r => `<article class="release"><p class="eyebrow"><span class="build-version">${esc(r.version)}</span> · <time datetime="${r.date}">${esc(date(r.date))}</time></p><h3>${esc(r.title)}</h3><ul>${r.changes.map(c => `<li>${esc(c)}</li>`).join('')}</ul></article>`).join('')}`;
}
window.addEventListener('hashchange', route);
try { connected = (await api('/health')).metron_configured; } catch { /* Search and collection report actionable failures. */ }
await route();
