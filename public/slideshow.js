import { comicTitleText } from './comic-title.js';
import { createCoverTransition } from './cover-transition.js';

function preferences() {
  const key = `dangerroom-gallery:${location.origin}`;
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(key)) || {}; } catch { /* Use defaults. */ }
  const settings = {
    seconds: Math.max(3, Math.min(600, Number(stored.settings?.seconds) || 15)),
    shuffle: stored.settings?.shuffle ?? true,
    fade: stored.settings?.fade ?? true,
    cacheLimited: stored.settings?.cacheLimited ?? true,
    cacheMB: Math.max(1, Math.min(1048576, Math.floor(Number(stored.settings?.cacheMB) || 300))),
  };
  return { key, stored, settings };
}

export function showSlideshowSettings(app) {
  const { key, stored, settings } = preferences();
  const dialog = document.createElement('dialog');
  dialog.id = 'gallery-options';
  dialog.setAttribute('aria-labelledby', 'gallery-options-title');
  dialog.innerHTML = `<h2 id="gallery-options-title">Slideshow settings</h2><form method="dialog"><label>Seconds per cover<input name="seconds" type="number" min="3" max="600" required value="${settings.seconds}"></label><label class="gallery-choice"><input type="checkbox" name="shuffle" ${settings.shuffle ? 'checked' : ''}>Random display order</label><label class="gallery-choice"><input type="checkbox" name="fade" ${settings.fade ? 'checked' : ''}>Cross-fade between covers</label><label class="gallery-choice"><input type="checkbox" name="cacheLimited" ${settings.cacheLimited ? 'checked' : ''}>Limit local cover cache</label><label>Cover cache size (MB)<input name="cacheMB" type="number" min="1" max="1048576" step="1" required value="${settings.cacheMB}"></label><p>Hardlight caches slideshow covers on this device. When full, uncached covers still download and display without being saved. Turn off the limit to use as much storage as the device allows. Covers outside the playlist are removed when the slideshow starts.</p><button type="button" id="flush-gallery-cache">Flush cache</button><p id="gallery-cache-status" role="status"></p><button value="save">Save</button><button type="button" id="cancel-gallery-options">Cancel</button></form>`;
  const flush = dialog.querySelector('#flush-gallery-cache');
  flush.disabled = !window.DangerRoomAndroid?.flushCoverCache;
  flush.onclick = () => {
    const cleared = window.DangerRoomAndroid.flushCoverCache();
    dialog.querySelector('#gallery-cache-status').textContent = cleared ? 'Cover cache cleared. Covers will download again as needed.' : 'Could not clear all cached covers. Please try again.';
  };
  dialog.querySelector('#cancel-gallery-options').onclick = () => dialog.close();
  dialog.querySelector('form').onsubmit = event => {
    event.preventDefault();
    const values = new FormData(event.target);
    const updated = { seconds: Math.max(3, Math.min(600, Number(values.get('seconds')))), shuffle: values.has('shuffle'), fade: values.has('fade'), cacheLimited: values.has('cacheLimited'), cacheMB: Math.max(1, Math.min(1048576, Math.floor(Number(values.get('cacheMB')) || 300))) };
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
  let timer = null, controlsTimer = null, retryTimer = null, generation = 0;
  let refreshing = false;
  const strikes = new Map();
  // Cover the app immediately, including while inventory or artwork is loading.
  app.innerHTML = `<div id="gallery-stage" class="gallery-fullscreen gallery-immersive gallery-playing gallery-controls-visible" tabindex="0" aria-label="Cover slideshow; tap to show playback controls"><div class="gallery-images"><img id="gallery-old" alt=""><img id="gallery-cover" alt=""></div><div class="gallery-overlay"><p id="gallery-caption" aria-live="polite">Opening owned covers…</p><div class="gallery-toolbar"><button id="previous-cover" aria-label="Previous cover" disabled>‹</button><button id="play-covers" disabled>Pause</button><button id="next-cover" aria-label="Next cover" disabled>›</button><button id="exit-gallery">Exit</button></div></div></div>`;
  const stage = app.querySelector('#gallery-stage'), caption = app.querySelector('#gallery-caption');
  const spinner = document.createElement('span');
  spinner.className = 'gallery-spinner'; spinner.hidden = true;
  spinner.setAttribute('role', 'status'); spinner.setAttribute('aria-label', 'Waiting to retry slideshow');
  stage.append(spinner);
  const image = app.querySelector('#gallery-cover'), old = app.querySelector('#gallery-old');
  const transition = createCoverTransition(image, old);
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
  function retry() {
    clearTimeout(retryTimer);
    if (current() && !disposed) retryTimer = setTimeout(refresh, 10 * 60 * 1000);
  }
  async function display() {
    clearTimeout(timer);
    const ticket = ++generation;
    if (!current() || disposed) return;
    previous.disabled = next.disabled = play.disabled = !rows.length;
    if (!rows.length) {
      loading = false;
      spinner.hidden = false;
      caption.textContent = 'Waiting for covers. Retrying the slideshow in 10 minutes…';
      revealControls(); retry(); return;
    }
    spinner.hidden = true;
    const row = rows[index]; loading = true; caption.textContent = 'Loading cover…'; revealControls();
    try {
      const alt = `${comicTitleText(row.issue, { year: true })} · ${row.edition.name}`;
      const shown = await transition.show(`/covers/${row.edition.cover_file}`, alt, settings.fade, () => ticket === generation && current() && !disposed);
      if (!shown || ticket !== generation || !current() || disposed) return;
      if (strikes.get(`${row.issue.id}:${row.edition.key}`)) strikes.clear();
      loading = false;
      caption.textContent = `${alt} · ${index + 1} / ${rows.length}`;
      revealControls(); schedule();
    } catch {
      if (ticket !== generation || !current() || disposed) return;
      const key = `${row.issue.id}:${row.edition.key}`;
      const count = (strikes.get(key) || 0) + 1;
      strikes.set(key, count);
      if (count >= 3) rows.splice(index, 1);
      else index++;
      index = rows.length ? index % rows.length : 0;
      loading = false;
      if (!rows.length) { display(); return; }
      caption.textContent = 'Cover unavailable. Trying the next cover in 3 seconds…';
      revealControls();
      if (playing) timer = setTimeout(display, 3000);
    }
  }
  function advance(direction) { if (rows.length) { index = (index + direction + rows.length) % rows.length; display(); } }
  previous.onclick = () => advance(-1); next.onclick = () => advance(1);
  play.onclick = () => {
    if (playing) pause();
    else if (rows.length) {
      playing = true; play.textContent = 'Pause'; stage.classList.add('gallery-playing');
      window.DangerRoomAndroid?.keepAwake(true); revealControls(); display();
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
    disposed = true; pause(); clearTimeout(retryTimer); generation++; transition.cancel(); leaveFullscreen();
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
  window.DangerRoomAndroid?.keepAwake(true);
  async function refresh() {
    if (refreshing || !current() || disposed) return;
    refreshing = true;
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
      window.DangerRoomAndroid?.configureCoverCache?.(JSON.stringify(rows.map(row => row.edition.cover_file)), settings.cacheLimited, settings.cacheMB);
      strikes.clear(); index = 0;
      window.DangerRoomAndroid?.keepAwake(playing);
      display();
    } catch (error) {
      if (!current() || disposed) return;
      loading = false; spinner.hidden = false;
      caption.textContent = `${error.message} Retrying the slideshow in 10 minutes…`; revealControls(); retry();
    } finally {
      refreshing = false;
    }
  }
  await refresh();
}
