import { comicTitleText } from './comic-title.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function chooseCovers(items, settings, excluded, previous = [], random = Math.random) {
  const eligible = items.filter(r => !excluded.includes(`${r.issue.id}:${r.edition.key}`));
  const shuffle = rows => {for(let i=rows.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]];}return rows;};
  const pool = settings.randomSelection ? shuffle([...eligible]) : eligible;
  const remembered = settings.remember ? previous.map(id=>eligible.find(r=>`${r.issue.id}:${r.edition.key}`===id)).filter(Boolean) : [];
  const chosen = [...remembered,...pool.filter(r=>!remembered.includes(r))].slice(0,settings.maximum);
  return { selected: chosen.map(r=>`${r.issue.id}:${r.edition.key}`), rows: settings.shuffle ? shuffle([...chosen]) : chosen };
}
export async function mountSlideshow(app, api, current) {
  app.innerHTML='<h2>Cover Slideshow</h2><p role="status">Opening owned covers…</p>';
  const data=await api('/slideshow');if(!current())return;
  const key=`dangerroom-gallery:${location.origin}`, read=()=>{try{return JSON.parse(localStorage.getItem(key))||{};}catch{return {};}};
  const stored=read(), settings={maximum:1000,seconds:15,randomSelection:true,remember:false,shuffle:true,fade:true,...stored.settings};
  let excluded=stored.excluded||[], selection=chooseCovers(data.items,settings,excluded,stored.selected), rows=selection.rows,index=0,playing=false,timer=null,generation=0,failed=new Set();
  const save=()=>localStorage.setItem(key,JSON.stringify({settings,excluded,selected:selection.selected}));
  const controls=`<div class="gallery-toolbar"><button id="previous-cover" aria-label="Previous cover">‹</button><button id="play-covers">Play</button><button id="next-cover" aria-label="Next cover">›</button><button id="exclude-cover">Exclude cover</button><button id="fullscreen-gallery">Full screen</button><button id="gallery-settings">Settings</button></div>`;
  app.innerHTML=`<h2>Cover Slideshow</h2><div id="gallery-stage"><div class="gallery-images"><img id="gallery-old" alt=""><img id="gallery-cover" alt=""></div><p id="gallery-caption" aria-live="polite"></p>${controls}</div><dialog id="gallery-options"><h2>Slideshow settings</h2><form method="dialog"><label>Maximum covers<input name="maximum" type="number" min="1" max="100000" required value="${Number(settings.maximum)}"></label><label>Seconds per cover<input name="seconds" type="number" min="3" max="600" required value="${Number(settings.seconds)}"></label>${[['randomSelection','Choose covers at random'],['remember','Keep the same selection between sessions'],['shuffle','Random display order'],['fade','Cross-fade between covers']].map(([name,label])=>`<label class="gallery-choice"><input type="checkbox" name="${name}" ${settings[name]?'checked':''}>${label}</label>`).join('')}<details><summary>Manage eligible covers</summary><div class="gallery-manage">${data.items.map((r,i)=>`<label class="gallery-choice"><input type="checkbox" data-eligible="${i}" ${excluded.includes(`${r.issue.id}:${r.edition.key}`)?'':'checked'}>${esc(comicTitleText(r.issue,{year:true}))} · ${esc(r.edition.name)}</label>`).join('')}</div></details><button value="save">Save</button><button type="button" id="cancel-gallery-options">Cancel</button></form></dialog>`;
  const $=s=>app.querySelector(s), caption=$('#gallery-caption'), image=$('#gallery-cover'), old=$('#gallery-old'), dialog=$('#gallery-options');
  const stop=()=>{playing=false;clearTimeout(timer);const button=$('#play-covers');if(button)button.textContent='Play';window.DangerRoomAndroid?.keepAwake(false);};
  const schedule=()=>{clearTimeout(timer);if(playing&&current()&&!document.hidden)timer=setTimeout(()=>advance(1),settings.seconds*1000);};
  function display(){
    clearTimeout(timer);const ticket=++generation;
    if(!current())return stop();
    if(!rows.length){image.removeAttribute('src');old.removeAttribute('src');caption.textContent='No eligible owned covers. Add comics or enable covers in Settings.';stop();return;}
    const row=rows[index];caption.textContent='Loading cover…';
    const loaded=new Image();loaded.onload=()=>{if(ticket!==generation||!current())return;if(image.getAttribute('src'))old.src=image.src;else old.removeAttribute('src');old.style.opacity=settings.fade?'1':'0';image.src=loaded.src;image.alt=`${comicTitleText(row.issue,{year:true})} · ${row.edition.name}`;old.animate([{opacity:settings.fade?1:0},{opacity:0}],{duration:settings.fade?600:0,fill:'forwards'});caption.textContent=`${image.alt} · ${index+1} / ${rows.length}`;schedule();};
    loaded.onerror=()=>{if(ticket!==generation||!current())return;failed.add(`${row.issue.id}:${row.edition.key}`);rows=rows.filter(r=>!failed.has(`${r.issue.id}:${r.edition.key}`));index=rows.length?index%rows.length:0;display();};
    loaded.src=`/covers/${row.edition.cover_file}`;
  }
  function advance(direction){if(rows.length){index=(index+direction+rows.length)%rows.length;display();}}
  $('#previous-cover').onclick=()=>advance(-1);$('#next-cover').onclick=()=>advance(1);
  $('#play-covers').onclick=()=>{if(playing)stop();else if(rows.length){playing=true;$('#play-covers').textContent='Pause';window.DangerRoomAndroid?.keepAwake(true);schedule();}};
  $('#exclude-cover').onclick=()=>{if(!rows.length)return;excluded.push(`${rows[index].issue.id}:${rows[index].edition.key}`);rows.splice(index,1);index=rows.length?index%rows.length:0;save();display();};
  $('#fullscreen-gallery').onclick=()=>{if(window.DangerRoomAndroid){const enabled=$('#gallery-stage').classList.toggle('gallery-fullscreen');window.DangerRoomAndroid.fullscreen(enabled);}else if(document.fullscreenElement)document.exitFullscreen();else $('#gallery-stage').requestFullscreen?.();};
  $('#gallery-settings').onclick=()=>{stop();dialog.querySelectorAll('[data-eligible]').forEach(input=>{const row=data.items[Number(input.dataset.eligible)];input.checked=!excluded.includes(`${row.issue.id}:${row.edition.key}`);});dialog.showModal();};
  $('#cancel-gallery-options').onclick=()=>dialog.close();
  dialog.querySelector('form').onsubmit=()=>{const values=new FormData(dialog.querySelector('form'));settings.maximum=Math.max(1,Math.min(100000,Number(values.get('maximum'))));settings.seconds=Math.max(3,Math.min(600,Number(values.get('seconds'))));for(const name of ['randomSelection','remember','shuffle','fade'])settings[name]=values.has(name);excluded=[...dialog.querySelectorAll('[data-eligible]')].filter(input=>!input.checked).map(input=>{const r=data.items[Number(input.dataset.eligible)];return `${r.issue.id}:${r.edition.key}`;});selection=chooseCovers(data.items,settings,excluded,selection.selected);rows=selection.rows;failed.clear();index=0;save();display();};
  const cleanup=()=>{if(!current()){stop();generation++;window.DangerRoomAndroid?.fullscreen(false);dialog.remove();window.removeEventListener('hashchange',cleanup);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('dangerroompause',stop);}};
  const visibility=()=>{if(document.hidden){stop();}else {window.DangerRoomAndroid?.keepAwake(playing);schedule();}};
  document.addEventListener('dangerroompause',stop,{once:true});
  window.addEventListener('hashchange',cleanup);document.addEventListener('visibilitychange',visibility);save();display();
}
