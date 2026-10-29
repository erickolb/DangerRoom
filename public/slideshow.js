import { comicTitleText } from './comic-title.js';

function preferences() {
  const key = `dangerroom-gallery:${location.origin}`;
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(key)) || {}; } catch { /* Use defaults. */ }
  const settings = {
    seconds: Math.max(3, Math.min(600, Number(stored.settings?.seconds) || 15)),
    shuffle: stored.settings?.shuffle ?? true,
    fade: stored.settings?.fade ?? true,
  };
  return { key, stored, settings };
}

export function showSlideshowSettings(app) {
  const { key, stored, settings } = preferences();
  const dialog = document.createElement('dialog');
  dialog.id = 'gallery-options';
  dialog.setAttribute('aria-labelledby', 'gallery-options-title');
  dialog.innerHTML = `<h2 id="gallery-options-title">Slideshow settings</h2><form method="dialog"><label>Seconds per cover<input name="seconds" type="number" min="3" max="600" required value="${settings.seconds}"></label><label class="gallery-choice"><input type="checkbox" name="shuffle" ${settings.shuffle ? 'checked' : ''}>Random display order</label><label class="gallery-choice"><input type="checkbox" name="fade" ${settings.fade ? 'checked' : ''}>Cross-fade between covers</label><button value="save">Save</button><button type="button" id="cancel-gallery-options">Cancel</button></form>`;
  dialog.querySelector('#cancel-gallery-options').onclick = () => dialog.close();
  dialog.querySelector('form').onsubmit = event => {
    event.preventDefault();
    const values = new FormData(event.target);
    const updated = { seconds: Math.max(3, Math.min(600, Number(values.get('seconds')))), shuffle: values.has('shuffle'), fade: values.has('fade') };
    try {
      // Preserve old local exclusions until opening the slideshow migrates them.
      localStorage.setItem(key, JSON.stringify({ ...stored, settings: updated }));
      dialog.close();
    } catch { dialog.querySelector('input').setCustomValidity('Could not save settings on this device.'); dialog.querySelector('input').reportValidity(); }
  };
  dialog.onclose = () => dialog.remove();
  app.append(dialog); dialog.showModal();
}

export function chooseCovers(items, settings, random = Math.random) {
  const rows = items.filter(row => !row.edition.black_bagged);
  if (settings.shuffle) for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  return rows;
}

export async function mountSlideshow(app, api, current) {
  const { key, stored, settings } = preferences();
  let rows = [], index = 0, playing = true, loading = true, disposed = false;
  let timer = null, controlsTimer = null, generation = 0;
  const failed = new Set();
  // Cover the app immediately, including while inventory or artwork is loading.
  app.innerHTML = `<div id="gallery-stage" class="gallery-fullscreen gallery-immersive gallery-playing gallery-controls-visible" tabindex="0" aria-label="Cover slideshow; tap to show playback controls"><div class="gallery-images"><img id="gallery-old" alt=""><img id="gallery-cover" alt=""></div><div class="gallery-overlay"><p id="gallery-caption" aria-live="polite">Opening owned covers…</p><div class="gallery-toolbar"><button id="previous-cover" aria-label="Previous cover" disabled>‹</button><button id="play-covers" disabled>Pause</button><button id="next-cover" aria-label="Next cover" disabled>›</button><button id="exit-gallery">Exit</button></div></div></div>`;
  const stage = app.querySelector('#gallery-stage'), caption = app.querySelector('#gallery-caption');
  const image = app.querySelector('#gallery-cover'), old = app.querySelector('#gallery-old');
  const play = app.querySelector('#play-covers'), previous = app.querySelector('#previous-cover'), next = app.querySelector('#next-cover');
  function leaveFullscreen() {
    window.DangerRoomAndroid?.fullscreen(false);
    if (document.fullscreenElement === stage) document.exitFullscreen().catch(() => {});
  }
  function revealControls() {
    clearTimeout(controlsTimer); stage.classList.add('gallery-controls-visible');
    if (playing && !loading) controlsTimer = setTimeout(() => stage.classList.remove('gallery-controls-visible'), 3000);
  }
  function pause() {
    playing = false; clearTimeout(timer); clearTimeout(controlsTimer);
    stage.classList.remove('gallery-playing'); stage.classList.add('gallery-controls-visible');
    play.textContent = 'Play'; window.DangerRoomAndroid?.keepAwake(false);
  }
  function schedule() {
    clearTimeout(timer);
    if (playing && !loading && current() && !disposed && !document.hidden) timer = setTimeout(() => advance(1), settings.seconds * 1000);
  }
  function display() {
    clearTimeout(timer);
    const ticket = ++generation;
    if (!current() || disposed) return;
    previous.disabled = next.disabled = play.disabled = !rows.length;
    if (!rows.length) {
      loading = false; image.removeAttribute('src'); old.removeAttribute('src');
      caption.textContent = 'No eligible owned covers. Add comics or remove a black bag using Ø in My Collection.';
      pause(); return;
    }
    const row = rows[index]; loading = true; caption.textContent = 'Loading cover…'; revealControls();
    const loaded = new Image();
    loaded.onload = () => {
      if (ticket !== generation || !current() || disposed) return;
      loading = false;
      if (image.getAttribute('src')) old.src = image.src; else old.removeAttribute('src');
      image.src = loaded.src; image.alt = `${comicTitleText(row.issue, { year: true })} · ${row.edition.name}`;
      old.animate([{ opacity: settings.fade ? 1 : 0 }, { opacity: 0 }], { duration: settings.fade ? 600 : 0, fill: 'forwards' });
      caption.textContent = `${image.alt} · ${index + 1} / ${rows.length}`;
      revealControls(); schedule();
    };
    loaded.onerror = () => {
      if (ticket !== generation || !current() || disposed) return;
      failed.add(`${row.issue.id}:${row.edition.key}`);
      rows = rows.filter(r => !failed.has(`${r.issue.id}:${r.edition.key}`));
      index = rows.length ? index % rows.length : 0; display();
    };
    loaded.src = `/covers/${row.edition.cover_file}`;
  }
  function advance(direction) { if (rows.length) { index = (index + direction + rows.length) % rows.length; display(); } }
  previous.onclick = () => advance(-1); next.onclick = () => advance(1);
  play.onclick = () => {
    if (playing) pause();
    else if (rows.length) {
      playing = true; play.textContent = 'Pause'; stage.classList.add('gallery-playing');
      window.DangerRoomAndroid?.keepAwake(true); revealControls(); schedule();
    }
  };
  function exit() { pause(); leaveFullscreen(); location.hash = window.DangerRoomAndroid ? '#/home' : '#/'; }
  app.querySelector('#exit-gallery').onclick = exit;
  stage.onclick = event => { if (!event.target.closest('button')) revealControls(); };
  stage.onkeydown = event => { if (event.key === 'Escape') exit(); else revealControls(); };
  const visibility = () => { if (document.hidden) pause(); };
  const fullscreenChange = () => { if (!window.DangerRoomAndroid && !document.fullscreenElement) pause(); };
  const cleanup = () => {
    if (current() || disposed) return;
    disposed = true; pause(); generation++; leaveFullscreen();
    window.removeEventListener('hashchange', cleanup);
    document.removeEventListener('visibilitychange', visibility);
    document.removeEventListener('dangerroompause', pause);
    document.removeEventListener('fullscreenchange', fullscreenChange);
  };
  // Register cleanup before the first request so exiting while loading also restores the menu.
  window.addEventListener('hashchange', cleanup);
  document.addEventListener('visibilitychange', visibility);
  document.addEventListener('dangerroompause', pause);
  document.addEventListener('fullscreenchange', fullscreenChange);
  window.DangerRoomAndroid?.fullscreen(true);
  if (!window.DangerRoomAndroid) stage.requestFullscreen?.().catch(() => {});
  stage.focus();
  try {
    const data = await api('/slideshow');
    if (!current() || disposed) return;
    const legacy = new Set(Array.isArray(stored.excluded) ? stored.excluded : []);
    for (const row of data.items) if (legacy.has(`${row.issue.id}:${row.edition.key}`)) {
      await api(`/issues/${row.issue.id}/black-bag`, { method: 'PATCH', body: JSON.stringify({ edition_key: row.edition.key, black_bagged: true }) });
      row.edition.black_bagged = true;
      if (!current() || disposed) return;
    }
    try { localStorage.setItem(key, JSON.stringify({ settings })); } catch { /* Playback can continue without stored preferences. */ }
    rows = chooseCovers(data.items, settings);
    window.DangerRoomAndroid?.keepAwake(playing && rows.length > 0);
    display();
  } catch (error) {
    if (!current() || disposed) return;
    loading = false; caption.textContent = error.message; pause();
  }
}
