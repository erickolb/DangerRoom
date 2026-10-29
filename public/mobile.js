import { comicTitleText } from './comic-title.js';
import { mountSlideshow, showSlideshowSettings } from './slideshow.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const isAndroid = Boolean(window.DangerRoomAndroid);
export function mobileHome(app) {
  app.innerHTML = `<div class="mobile-menu">${[['/wants','shopping-list','Want List'],['/collection','boxes','My Collection'],['/','metron','Search Metron'],['/camera','camera','Scan Comic'],['/slideshow','slideshow','Cover Slideshow'],['/reading-log','reading-log','Reading Log']].map(([path, icon, label])=>`<a class="mobile-menu-item" href="#${path}"><img src="/${icon}.${['metron','camera'].includes(icon)?'svg':'png'}" alt="">${label}<span aria-hidden="true">›</span></a>`).join('')}</div><div class="mobile-settings-actions"><button id="mobile-settings" class="secondary">Instance and device settings</button><button id="slideshow-settings" class="secondary">Slideshow settings</button></div>`;
  document.querySelector('#mobile-settings').onclick = () => window.DangerRoomAndroid.settings();
  document.querySelector('#slideshow-settings').onclick = () => showSlideshowSettings(app);
}
export async function mobilePage(path, params, app, api, openEdition, current) {
  if (path === '/slideshow') { await mountSlideshow(app, api, current); return true; }
  if (path !== '/camera') return false;
  app.innerHTML = `<h2>Scan Comic</h2><p>Photograph the cover straight on, filling the frame. A visible barcode helps identify the issue. Review the text, then choose the matching cover.</p>${isAndroid?'<button id="capture">Take a photo</button>':''}<form id="camera-query" class="search-main"><label>Series name<input name="q" maxlength="160" value="${esc(params.get('q'))}"></label><label>Issue number<input name="number" maxlength="30" value="${esc(params.get('number'))}"></label><label>UPC<input name="upc" inputmode="numeric" maxlength="18" value="${esc(params.get('upc'))}"></label><button>Find matching covers</button></form><p class="hint">Camera text is a search suggestion. Stylized logos, glare, and text-free variants may need a corrected title. Barcode matches are labeled; confirm the artwork before saving.</p><div id="camera-results" role="status"></div>`;
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
      results.innerHTML = data.items.length ? `<p>${data.count} issue candidates. Select the exact cover to open its collection, Want List, and reading controls.</p><div class="shelf">${data.items.map((row,i)=>`<article class="comic-card"><button class="camera-result" data-cover="${i}">${row.edition.source_image?`<img class="cover" src="${esc(row.edition.source_image)}" alt="${esc(row.edition.name)}">`:'<div class="cover missing-cover">Cover unavailable</div>'}<div class="card-info"><h3>${esc(comicTitleText(row.issue,{year:true}))}</h3><p>${esc(row.edition.name)}</p>${row.barcode_match?'<p class="barcode-match">Exact barcode match</p>':''}</div></button></article>`).join('')}</div>` : '<p>No matches. Try the series title without the barcode, or retake the photo.</p>';
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
