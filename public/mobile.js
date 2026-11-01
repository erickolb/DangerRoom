import { context, copyState, bindToggles } from './actions.js';
import { comicTitleText } from './comic-title.js';
import { mountSlideshow, showSlideshowSettings } from './slideshow.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function captureNotice(app, params) {
  const id=params.get('capture_id');
  if (/^[1-9][0-9]*$/.test(id || '')) app.insertAdjacentHTML('afterbegin',`<p class="hint">Retained scan #${id} on DangerRoom for comparison. Only the latest ten scans are kept.</p>`);
}
export const isAndroid = Boolean(window.DangerRoomAndroid);
export function mobileHome(app) {
  app.innerHTML = `<div class="mobile-menu">${[['/wants','shopping-list','Want List'],['/collection','boxes','My Collection'],['/','metron','Search Metron'],['/camera','camera','Scan Cover'],['/slideshow','slideshow','Cover Slideshow'],['/reading-log','reading-log','Reading Log']].map(([path, icon, label])=>`<a class="mobile-menu-item" href="#${path}"><img src="/${icon}.${['metron','camera'].includes(icon)?'svg':'png'}" alt="">${label}<span aria-hidden="true">›</span></a>`).join('')}</div><div class="mobile-settings-actions"><button id="mobile-settings" class="secondary">Instance and device settings</button><button id="slideshow-settings" class="secondary">Slideshow settings</button></div>`;
  document.querySelector('#mobile-settings').onclick = () => window.DangerRoomAndroid.settings();
  document.querySelector('#slideshow-settings').onclick = () => showSlideshowSettings(app);
}
export async function mobilePage(path, params, app, api, openEdition, current) {
  if (path === '/slideshow') { await mountSlideshow(app, api, current); return true; }
  if (path !== '/camera') return false;
  if (isAndroid && window.DangerRoomAndroid.scanOcrEnabled?.()) {
  app.innerHTML = `<h2>Scan Cover</h2><p>Photograph the cover straight on, filling the frame. A visible barcode helps identify the issue. Review the text, then choose the matching cover.</p>${isAndroid?'<button id="capture">Take a photo</button><button id="scan-settings" class="secondary">Scan settings</button>':''}<form id="camera-query" class="search-main"><label>Series name<input name="q" maxlength="160" value="${esc(params.get('q'))}"></label><label>Issue number<input name="number" maxlength="30" value="${esc(params.get('number'))}"></label><label>UPC<input name="upc" inputmode="numeric" maxlength="18" value="${esc(params.get('upc'))}"></label><button>Find matching covers</button></form><p class="hint">Camera text is a search suggestion. Stylized logos, glare, and text-free variants may need a corrected title. Barcode matches are labeled; confirm the artwork before saving.</p><div id="camera-results" role="status"></div>`;
  captureNotice(app,params);
  document.querySelector('#scan-settings')?.addEventListener('click', () => window.DangerRoomAndroid.scanSettings());
  document.querySelector('#capture')?.addEventListener('click', () => window.DangerRoomAndroid.camera());
  let searchGeneration=0, nextPage=false;
  document.querySelector('#camera-query').onsubmit = async event => {
    event.preventDefault();
    const request=++searchGeneration;
    if(!nextPage){event.target.querySelector('[name=page]')?.remove();event.target.querySelector('[name=cover_page]')?.remove();}nextPage=false;
    const values = new URLSearchParams();
    for (const [key, value] of new FormData(event.target)) if (value.trim()) values.set(key, value.trim());
    const results = document.querySelector('#camera-results'), button = event.target.querySelector('button');
    button.disabled = true; results.innerHTML = '<p class="loading metron-progress" role="status"><img src="/metron.svg" alt="" class="metron-spinner">Finding issues and their covers…</p>';
    try {
      const data = await api(`/camera-search?${values}&legacy=1`);
      if (!current()||request!==searchGeneration) return;
      results.innerHTML = data.items.length ? `<p>${data.count} issue candidates. Use the icons to add, want, or mark the exact cover as read. Tap a cover to open its details.</p><div class="shelf">${data.items.map((row,i)=>`<article class="comic-card scan-card"><button class="camera-result" data-cover="${i}">${row.edition.source_image?`<img class="cover" src="${esc(row.edition.source_image)}" alt="${esc(row.edition.name)}">`:'<div class="cover missing-cover">Cover unavailable</div>'}<div class="card-info"><h3>${esc(comicTitleText(row.issue,{year:true}))}</h3><p>${esc(row.edition.name)}</p>${row.barcode_match?'<p class="barcode-match">Exact barcode match</p>':''}</div></button><div class="comic-actions card-toggles" data-scan-actions="${i}"></div></article>`).join('')}</div>` : '<p>No matches. Try the series title without the barcode, or retake the photo.</p>';
      if(data.items.length){
        results.insertAdjacentHTML('afterbegin','<p class="form-error" data-scan-error role="alert"></p>');
        const contexts=new Map();
        data.items.forEach((row,i)=>{
          let ctx=contexts.get(row.issue.id);
          if(!ctx){ctx=context(row.issue,api,text=>{if(current()&&request===searchGeneration&&results.isConnected)results.querySelector('[data-scan-error]').textContent=text;});contexts.set(row.issue.id,ctx);}
          const state=copyState(ctx,row.edition.key);
          ctx.listeners.add(()=>{state.copyId=ctx.issue.copies?.find(copy=>copy.edition_key===state.editionKey)?.id || null;});
          bindToggles(results.querySelector(`[data-scan-actions="${i}"]`),ctx,state);
        });
      }
      if (data.limited) results.insertAdjacentHTML('beforeend','<p>More candidate issues are available. Add the issue number to narrow the results, or continue to the next results.</p>');
      results.querySelectorAll('[data-cover]').forEach(b=>b.onclick=()=>{const row=data.items[Number(b.dataset.cover)];openEdition(row.issue.id,row.edition.key);});
      if(isAndroid&&params.has('captured')&&data.items.length){
        const id=crypto.randomUUID();window.dangerroomResponses??={};
        window.dangerroomResponses[id]=scores=>{
          delete window.dangerroomResponses[id];if(!current()||!results.isConnected||request!==searchGeneration)return;
          const cards=[...results.querySelectorAll('[data-cover]')];
          cards.sort((a,b)=>{const x=data.items[Number(a.dataset.cover)],y=data.items[Number(b.dataset.cover)];return Number(y.barcode_match)-Number(x.barcode_match)||(scores[x.edition.source_image]??Infinity)-(scores[y.edition.source_image]??Infinity);});
          cards.forEach(card=>results.querySelector('.shelf').append(card.closest('article')));
          if(Object.keys(scores).length){const hint=document.createElement('p');hint.className='hint';hint.textContent='Covers ordered by barcode and approximate artwork similarity. Check the issue and variant before saving.';results.prepend(hint);}
        };
        window.DangerRoomAndroid.rank(JSON.stringify(data.items.map(r=>r.edition.source_image).filter(Boolean)),id);
      }
      if(data.next){const next=document.createElement('button');next.textContent='Next results page';next.onclick=()=>{for(const [name,value] of [['page',data.next_page],['cover_page',data.next_cover_page]]){let input=event.target.querySelector(`[name=${name}]`);if(!input){input=document.createElement('input');input.type='hidden';input.name=name;event.target.append(input);}input.value=String(value);}nextPage=true;event.target.requestSubmit();};results.append(next);}
    } catch (error) { if(current()) results.textContent = error.message; }
    finally { button.disabled = false; }
  };
  if(params.get('captured')==='1')document.querySelector('#camera-query').requestSubmit();

    return true;
  }
  const hash = params.get('cover_hash') || '';
  app.innerHTML = `<h2>Scan Cover</h2><p>Use the scanner’s four corner posts and magnified view to mark the cover’s edges, then review its perspective-corrected artwork. Your instance retains the last ten submitted images and fingerprints for comparison. Metron receives only the fingerprint; OCR and barcodes are off by default.</p>${isAndroid?'<button id="capture">Take a photo</button><button id="scan-settings" class="secondary">Scan settings</button>':'<p>Open Hardlight to photograph a cover.</p>'}<form id="camera-query"><input type="hidden" name="cover_hash" value="${esc(hash)}"><button ${/^[a-f0-9]{16}$/i.test(hash)?'':'disabled'}>Find matching covers</button></form><p class="hint">Metron requires an exact fingerprint match against its main cover. Glare, perspective, and variant artwork may prevent a match. Confirm the issue and exact cover before saving.</p><div id="camera-results" role="status"></div>`;
  captureNotice(app,params);
  document.querySelector('#scan-settings')?.addEventListener('click', () => window.DangerRoomAndroid.scanSettings());
  document.querySelector('#capture')?.addEventListener('click', () => window.DangerRoomAndroid.camera());
  let searchGeneration=0, nextPage=false;
  document.querySelector('#camera-query').onsubmit = async event => {
    event.preventDefault();
    const request=++searchGeneration;
    if(!nextPage){event.target.querySelector('[name=page]')?.remove();event.target.querySelector('[name=cover_page]')?.remove();}nextPage=false;
    const values = new URLSearchParams();
    for (const [key, value] of new FormData(event.target)) if (value.trim()) values.set(key, value.trim());
    const results = document.querySelector('#camera-results'), button = event.target.querySelector('button');
    button.disabled = true; results.innerHTML = '<p class="loading metron-progress" role="status"><img src="/metron.svg" alt="" class="metron-spinner">Finding issues and their covers…</p>';
    try {
      const data = await api(`/camera-search?${values}`);
      if (!current()||request!==searchGeneration) return;
      results.innerHTML = data.items.length ? `<p>${data.count} issue candidates. Use the icons to add, want, or mark the exact cover as read. Tap a cover to open its details.</p><div class="shelf">${data.items.map((row,i)=>`<article class="comic-card scan-card"><button class="camera-result" data-cover="${i}">${row.edition.source_image?`<img class="cover" src="${esc(row.edition.source_image)}" alt="${esc(row.edition.name)}">`:'<div class="cover missing-cover">Cover unavailable</div>'}<div class="card-info"><h3>${esc(comicTitleText(row.issue,{year:true}))}</h3><p>${esc(row.edition.name)}</p></div></button><div class="comic-actions card-toggles" data-scan-actions="${i}"></div></article>`).join('')}</div>` : '<p>No exact cover fingerprint matched. Retake a straight-on photo and crop closely to the cover, or use Search Metron from the menu.</p>';
      if(data.items.length){
        results.insertAdjacentHTML('afterbegin','<p class="form-error" data-scan-error role="alert"></p>');
        const contexts=new Map();
        data.items.forEach((row,i)=>{
          let ctx=contexts.get(row.issue.id);
          if(!ctx){ctx=context(row.issue,api,text=>{if(current()&&request===searchGeneration&&results.isConnected)results.querySelector('[data-scan-error]').textContent=text;});contexts.set(row.issue.id,ctx);}
          const state=copyState(ctx,row.edition.key);
          ctx.listeners.add(()=>{state.copyId=ctx.issue.copies?.find(copy=>copy.edition_key===state.editionKey)?.id || null;});
          bindToggles(results.querySelector(`[data-scan-actions="${i}"]`),ctx,state);
        });
      }
      if (data.limited) results.insertAdjacentHTML('beforeend','<p>More matching issues are available. Continue to the next results.</p>');
      results.querySelectorAll('[data-cover]').forEach(b=>b.onclick=()=>{const row=data.items[Number(b.dataset.cover)];openEdition(row.issue.id,row.edition.key);});
      if(data.next){const next=document.createElement('button');next.textContent='Next results page';next.onclick=()=>{for(const [name,value] of [['page',data.next_page],['cover_page',data.next_cover_page]]){let input=event.target.querySelector(`[name=${name}]`);if(!input){input=document.createElement('input');input.type='hidden';input.name=name;event.target.append(input);}input.value=String(value);}nextPage=true;event.target.requestSubmit();};results.append(next);}
    } catch (error) { if(current()) results.textContent = error.message; }
    finally { button.disabled = false; }
  };
  if(params.get('captured')==='1')document.querySelector('#camera-query').requestSubmit();
  return true;
}
