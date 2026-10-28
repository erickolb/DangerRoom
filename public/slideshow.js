import { comicTitleText } from './comic-title.js';

export function chooseCovers(items, settings, random = Math.random) {
  const rows = items.filter(row => !row.edition.black_bagged);
  if (settings.shuffle) for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  return rows;
}

export async function mountSlideshow(app, api, current) {
  app.innerHTML = '<h2>Cover Slideshow</h2><p role="status">Opening owned covers…</p>';
  const data = await api('/slideshow');
  if (!current()) return;
  const key = `dangerroom-gallery:${location.origin}`;
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(key)) || {}; } catch { /* Use defaults. */ }
  const settings = {
    seconds: Math.max(3, Math.min(600, Number(stored.settings?.seconds) || 15)),
    shuffle: stored.settings?.shuffle ?? true,
    fade: stored.settings?.fade ?? true,
  };
  // Preserve exclusions from earlier versions by moving them to the shared inventory.
  const legacy = new Set(Array.isArray(stored.excluded) ? stored.excluded : []);
  if (legacy.size) {
    for (const row of data.items) if (legacy.has(`${row.issue.id}:${row.edition.key}`)) {
      await api(`/issues/${row.issue.id}/black-bag`, { method: 'PATCH', body: JSON.stringify({ edition_key: row.edition.key, black_bagged: true }) });
      row.edition.black_bagged = true;
    }
    if (!current()) return;
  }
  const save = () => localStorage.setItem(key, JSON.stringify({ settings }));
  let rows = chooseCovers(data.items, settings), index = 0, playing = false, loading = false;
  let timer = null, controlsTimer = null, generation = 0;
  const failed = new Set();
  app.innerHTML = `<h2>Cover Slideshow</h2><div id="gallery-stage" tabindex="0" aria-label="Cover slideshow; tap to show playback controls"><div class="gallery-images"><img id="gallery-old" alt=""><img id="gallery-cover" alt=""></div><div class="gallery-overlay"><p id="gallery-caption" aria-live="polite"></p><div class="gallery-toolbar"><button id="previous-cover" aria-label="Previous cover">‹</button><button id="play-covers">Play</button><button id="next-cover" aria-label="Next cover">›</button><button id="black-bag-cover">Black bag</button><button id="gallery-settings">Settings</button></div></div></div><p class="hint">Uses every owned cover except black-bagged covers. During playback, tap the screen to show controls. Toggle Ø in My Collection to remove a black bag.</p><dialog id="gallery-options"><h2>Slideshow settings</h2><form method="dialog"><label>Seconds per cover<input name="seconds" type="number" min="3" max="600" required value="${settings.seconds}"></label><label class="gallery-choice"><input type="checkbox" name="shuffle" ${settings.shuffle ? 'checked' : ''}>Random display order</label><label class="gallery-choice"><input type="checkbox" name="fade" ${settings.fade ? 'checked' : ''}>Cross-fade between covers</label><button value="save">Save</button><button type="button" id="cancel-gallery-options">Cancel</button></form></dialog>`;
  const $ = selector => app.querySelector(selector);
  const stage = $('#gallery-stage'), caption = $('#gallery-caption');
  const image = $('#gallery-cover'), old = $('#gallery-old'), dialog = $('#gallery-options');
  function fullscreen(enabled) {
    stage.classList.toggle('gallery-fullscreen', enabled);
    if (window.DangerRoomAndroid) window.DangerRoomAndroid.fullscreen(enabled);
    else if (enabled && !document.fullscreenElement) stage.requestFullscreen?.().catch(() => {});
    else if (!enabled && document.fullscreenElement === stage) document.exitFullscreen().catch(() => {});
  }
  function revealControls() {
    clearTimeout(controlsTimer);
    stage.classList.add('gallery-controls-visible');
    if (playing) controlsTimer = setTimeout(() => stage.classList.remove('gallery-controls-visible'), 3000);
  }
  function stop() {
    playing = false;
    clearTimeout(timer); clearTimeout(controlsTimer);
    stage.classList.remove('gallery-playing', 'gallery-controls-visible');
    const button = $('#play-covers'); if (button) button.textContent = 'Play';
    window.DangerRoomAndroid?.keepAwake(false);
    fullscreen(false);
  }
  function schedule() {
    clearTimeout(timer);
    if (playing && !loading && current() && !document.hidden) timer = setTimeout(() => advance(1), settings.seconds * 1000);
  }
  function display() {
    clearTimeout(timer);
    const ticket = ++generation;
    if (!current()) return stop();
    if (!rows.length) {
      loading = false; image.removeAttribute('src'); old.removeAttribute('src');
      caption.textContent = 'No eligible owned covers. Add comics or remove a black bag using Ø in My Collection.';
      $('#black-bag-cover').disabled = true; stop(); return;
    }
    const row = rows[index]; loading = true;
    caption.textContent = 'Loading cover…'; $('#black-bag-cover').disabled = true;
    const loaded = new Image();
    loaded.onload = () => {
      if (ticket !== generation || !current()) return;
      loading = false;
      if (image.getAttribute('src')) old.src = image.src; else old.removeAttribute('src');
      image.src = loaded.src; image.alt = `${comicTitleText(row.issue, { year: true })} · ${row.edition.name}`;
      old.animate([{ opacity: settings.fade ? 1 : 0 }, { opacity: 0 }], { duration: settings.fade ? 600 : 0, fill: 'forwards' });
      caption.textContent = `${image.alt} · ${index + 1} / ${rows.length}`;
      $('#black-bag-cover').disabled = false; schedule();
    };
    loaded.onerror = () => {
      if (ticket !== generation || !current()) return;
      failed.add(`${row.issue.id}:${row.edition.key}`);
      rows = rows.filter(r => !failed.has(`${r.issue.id}:${r.edition.key}`));
      index = rows.length ? index % rows.length : 0; display();
    };
    loaded.src = `/covers/${row.edition.cover_file}`;
  }
  function advance(direction) { if (rows.length) { index = (index + direction + rows.length) % rows.length; display(); } }
  $('#previous-cover').onclick = () => { advance(-1); revealControls(); };
  $('#next-cover').onclick = () => { advance(1); revealControls(); };
  $('#play-covers').onclick = () => {
    if (playing) stop();
    else if (rows.length) {
      playing = true; $('#play-covers').textContent = 'Pause'; stage.classList.add('gallery-playing');
      fullscreen(true); window.DangerRoomAndroid?.keepAwake(true); revealControls(); schedule(); stage.focus();
    }
  };
  $('#black-bag-cover').onclick = async () => {
    if (!rows.length) return;
    const row = rows[index], button = $('#black-bag-cover');
    button.disabled = true; clearTimeout(timer);
    try {
      await api(`/issues/${row.issue.id}/black-bag`, { method: 'PATCH', body: JSON.stringify({ edition_key: row.edition.key, black_bagged: true }) });
      if (!current()) return;
      row.edition.black_bagged = true;
      rows = rows.filter(r => r !== row); index = rows.length ? index % rows.length : 0; display(); revealControls();
    } catch (error) { if (current()) { caption.textContent = error.message; stop(); button.disabled = false; } }
  };
  $('#gallery-settings').onclick = () => { stop(); dialog.showModal(); };
  $('#cancel-gallery-options').onclick = () => dialog.close();
  dialog.querySelector('form').onsubmit = () => {
    const values = new FormData(dialog.querySelector('form'));
    settings.seconds = Math.max(3, Math.min(600, Number(values.get('seconds'))));
    settings.shuffle = values.has('shuffle'); settings.fade = values.has('fade');
    rows = chooseCovers(data.items, settings); failed.clear(); index = 0; save(); display();
  };
  stage.onclick = event => { if (!event.target.closest('button')) revealControls(); };
  stage.onkeydown = event => { if (event.key === 'Escape') stop(); else revealControls(); };
  const visibility = () => { if (document.hidden) stop(); };
  const fullscreenChange = () => { if (!window.DangerRoomAndroid && playing && !document.fullscreenElement) stop(); };
  const cleanup = () => {
    if (current()) return;
    stop(); generation++; dialog.remove();
    window.removeEventListener('hashchange', cleanup);
    document.removeEventListener('visibilitychange', visibility);
    document.removeEventListener('dangerroompause', stop);
    document.removeEventListener('fullscreenchange', fullscreenChange);
  };
  document.addEventListener('dangerroompause', stop);
  document.addEventListener('fullscreenchange', fullscreenChange);
  window.addEventListener('hashchange', cleanup);
  document.addEventListener('visibilitychange', visibility);
  save(); display();
}
