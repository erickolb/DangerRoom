import { releases } from './releases.js';
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
function closeDialog() { dialogGeneration++; dialog.close(); }
dialog.addEventListener('close', () => { dialogGeneration++; });
async function route() {
  const ticket = ++generation;
  message(''); closeDialog();
  const { path, params } = routeData();
  document.querySelectorAll('nav a').forEach(a => { if (a.getAttribute('href') === `#${path}`) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  try {
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
  app.innerHTML = `<div class="hero"><span class="hero-mark" aria-hidden="true">✦</span><p class="eyebrow">One issue. A whole universe.</p><h2>Find your next addition.</h2><p class="intro">Find a comic, choose its cover, and make it yours.<br>Keep the stories you own and the ones you’ve read.</p>${searchForm(params)}</div>${!connected ? '<div class="connection">Connect Metron to start searching: add your API token to <code>METRON_API_TOKEN</code> in the local <code>.env</code> file and restart DangerRoom. <a href="https://metron.cloud" target="_blank" rel="noopener noreferrer">Open Metron ↗</a></div>' : ''}<div id="search-results"></div>`;
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
    $('#search-results').innerHTML = `<div class="results"><div class="section-heading"><div><p class="eyebrow">From Metron</p><h2>Search results</h2></div><span class="count">${Number(data.count).toLocaleString()} issue${data.count === 1 ? '' : 's'}</span></div>${data.results.length ? `<div class="shelf">${data.results.map(r => `<article class="comic-card">${cover(r.image, r.display_name)}<div class="card-info"><p class="eyebrow">${esc(r.series.year_began || '')} · Volume ${esc(r.series.volume || '—')}</p><h3>${esc(r.series.name)} #${esc(r.number)}</h3><p class="muted">${esc(date(r.cover_date))}</p><button class="button" data-choose="${r.id}">${icon('box-add')} Choose & add</button></div></article>`).join('')}</div>` : '<div class="empty-state"><h3>No issues found</h3><p>Try another series name or adjust the issue number and year.</p></div>'}<div class="pagination">${data.previous ? '<button class="quiet" id="previous">← Previous</button>' : ''}<span class="muted">Page ${data.page}</span>${data.next ? '<button class="quiet" id="next">Next →</button>' : ''}</div></div>`;
    document.querySelectorAll('[data-choose]').forEach(b => b.onclick = () => choose(Number(b.dataset.choose)));
    for (const [id, delta] of [['previous', -1], ['next', 1]]) if ($(`#${id}`)) $(`#${id}`).onclick = () => { const p = new URLSearchParams(params); p.set('page', String(data.page + delta)); location.hash = `#/?${p}`; };
  } catch (e) { if (ticket === generation) { $('#search-results').innerHTML = ''; message(e.message, true); } }
  finally { if (ticket === generation) button.disabled = false; }
}
async function choose(id, savedIssue = null, selectedKey = null) {
  const token = ++dialogGeneration;
  dialog.innerHTML = '<h2 id="dialog-title">Choose a cover</h2><p class="loading" role="status">Opening comic details…</p><button id="close-dialog" class="quiet">Cancel</button>';
  $('#close-dialog').onclick = closeDialog; dialog.showModal();
  try {
    const issue = savedIssue || await api(`/metron/issues/${id}`);
    if (token !== dialogGeneration || !dialog.open) return;
    dialog.innerHTML = `<form id="add-form"><div class="dialog-heading"><div><p class="eyebrow">Add to your collection</p><h2 id="dialog-title">${esc(issue.display_name)}</h2></div><button type="button" class="quiet" id="close-dialog" aria-label="Close">×</button></div><p class="hint">Choose the cover that matches your comic.</p><div class="variant-grid">${issue.editions.map(e => `<label class="variant-choice"><input type="radio" name="edition" value="${esc(e.key)}" required ${e.key === selectedKey || (!selectedKey && issue.editions.length === 1) ? 'checked' : ''}>${cover(localCover(e) || e.source_image, e.name)}<span>${esc(e.name)}${e.upc ? `<br><small>UPC ${esc(e.upc)}</small>` : ''}</span></label>`).join('')}</div><fieldset class="status-options"><legend>Save as either, or both</legend><label class="status-choice"><input type="checkbox" name="owned" checked>${icon('box-add', true)} I own this copy</label><label class="status-choice"><input type="checkbox" name="read" ${issue.read ? 'checked' : ''}>${icon('book-check', true)} I’ve read this</label></fieldset><p class="hint">Each owned addition creates a separate copy, even for the same cover. Read status applies to the issue and is saved once.</p><p class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="quiet" id="cancel-add">Cancel</button><button type="submit">Save to collection</button></div></form>`;
    $('#close-dialog').onclick = closeDialog; $('#cancel-add').onclick = closeDialog;
    $('#add-form').onsubmit = async e => {
      e.preventDefault();
      const form = e.target, data = new FormData(form), button = form.querySelector('[type=submit]');
      if (!data.has('owned') && !data.has('read')) { form.querySelector('.form-error').textContent = 'Choose ownership, read status, or both.'; return; }
      button.disabled = true; button.textContent = 'Saving comic & cover…'; form.querySelector('.form-error').textContent = '';
      try {
        await api('/entries', { method: 'POST', body: JSON.stringify({ issue_id: id, edition_key: data.get('edition'), owned: data.has('owned'), read: data.has('read') }) });
        closeDialog();
        if (savedIssue) await route();
        message(data.has('owned') ? 'A separate owned copy was added to your collection.' : 'Comic marked as read.');
      } catch (error) { form.querySelector('.form-error').textContent = error.message; }
      finally { button.disabled = false; button.textContent = 'Save to collection'; }
    };
  } catch (e) {
    if (token === dialogGeneration && dialog.open) { dialog.innerHTML = `<h2 id="dialog-title">Couldn’t open comic</h2><p class="form-error">${esc(e.message)}</p><button class="quiet" id="close-dialog">Close</button>`; $('#close-dialog').onclick = closeDialog; }
  }
}
async function collection(params, ticket) {
  const view = collectionView, query = params.get('q') || '';
  app.innerHTML = `<div class="section-heading"><div><p class="eyebrow">Your personal archive</p><h2>My Collection</h2></div><a class="button secondary" href="#/">Find a comic →</a></div><nav class="tabs" aria-label="Collection view"><a href="#/collection" ${view === 'owned' ? 'aria-current="page"' : ''}>Owned comics</a><a href="#/collection?view=read" ${view === 'read' ? 'aria-current="page"' : ''}>Read comics</a></nav><form id="collection-search" class="search-main collection-search"><label>Search ${view === 'read' ? 'read comics' : 'owned comics'}<input type="search" name="q" placeholder="Search your collection…" value="${esc(query)}" maxlength="160"></label><button class="quiet">Find</button></form><div id="collection-results"><p class="loading" role="status">Opening your collection…</p></div>`;
  $('#collection-search').onsubmit = e => { e.preventDefault(); const p = new URLSearchParams({ view }); const q = new FormData(e.target).get('q').trim(); if (q) p.set('q', q); const hash = `#/collection?${p}`; if (location.hash === hash) route(); else location.hash = hash; };
  const data = await api(`/collection?${new URLSearchParams({ view, q: query })}`);
  if (ticket !== generation) return;
  $('#collection-results').innerHTML = data.items.length ? `<p class="muted">${data.items.length} ${view === 'read' ? 'read issue' : 'owned copy'}${data.items.length === 1 ? '' : view === 'read' ? 's' : ' entries'}</p><div class="shelf">${data.items.map(row => `<article class="comic-card"><a class="comic-link" href="#/issues/${row.issue.id}?${new URLSearchParams({ edition: row.edition.key, from: view })}">${cover(localCover(row.edition), row.issue.display_name)}<div class="card-info"><p class="eyebrow">${esc(row.issue.publisher?.name || 'Comic')} · ${esc(row.issue.series.year_began || '')}</p><h3>${esc(row.issue.series.name)} #${esc(row.issue.number)}</h3><p class="muted">${esc(row.edition.name)}</p>${view === 'owned' ? `<p class="muted">Copy ${esc(row.id.slice(0, 8))}</p>` : ''}<span class="badge">${row.issue.read ? 'Read' : 'Unread'}</span></div></a></article>`).join('')}</div>` : `<div class="empty-state"><p class="eyebrow">${query ? 'No matches' : 'A fresh beginning'}</p><h3>${query ? 'Nothing here matches that search.' : view === 'read' ? 'Your next story starts here.' : 'Make room for your first comic.'}</h3><p>${query ? 'Try a different title, publisher, or cover name.' : view === 'read' ? 'Mark a comic as read, whether you own it or borrowed it.' : 'Find a comic and choose “I own this copy” to start your collection.'}</p><a class="button" href="#/">Search comics →</a></div>`;
}
async function detail(id, params, ticket) {
  app.innerHTML = '<p class="loading" role="status">Opening comic…</p>';
  const issue = await api(`/issues/${id}`);
  if (ticket !== generation) return;
  const edition = issue.editions.find(e => e.key === params.get('edition')) || issue.editions[0];
  const from = params.get('from') === 'read' ? 'read' : 'owned';
  app.innerHTML = `<a class="back-link" href="#/collection?view=${from}">← My Collection</a><div class="detail-layout"><aside>${cover(localCover(edition), issue.display_name)}${localCover(edition) ? `<p class="hint"><a href="${localCover(edition)}" target="_blank" rel="noopener noreferrer">Open original cover ↗</a></p>` : ''}</aside><div><p class="eyebrow">${esc(issue.publisher?.name || 'Comic')} · ${esc(issue.series.year_began || '')} · Volume ${esc(issue.series.volume || '—')}</p><h2>${esc(issue.series.name)} #${esc(issue.number)}</h2>${issue.title ? `<p class="intro">${esc(issue.title)}</p>` : ''}<p class="intro">${esc(edition.name)}</p><span class="badge">${issue.read ? 'Read' : 'Unread'}</span><dl class="metadata">${field('Cover date', date(issue.cover_date))}${field('Release date', date(issue.store_date))}${field('UPC · selected cover', edition.upc)}${field('SKU · selected cover', edition.sku)}${field('ISBN', issue.isbn)}${field('Pages', issue.page_count)}${field('Cover price', edition.price !== null ? `${edition.price_currency || 'Currency not supplied'} ${edition.price}` : null)}${field('Content rating', issue.rating?.name)}${field('Imprint', issue.imprint?.name)}${field('Read on', issue.read ? date(issue.read.read_at) : null)}</dl><div class="actions"><button id="add-copy">${icon('box-add')} Add another copy</button><button id="toggle-read" class="secondary">${icon('book-check', true)} ${issue.read ? 'Mark unread' : 'Mark as read'}</button></div>${issue.resource_url ? `<p class="deep-link"><a href="${esc(issue.resource_url)}" target="_blank" rel="noopener noreferrer">Deep Search on Metron ↗</a></p>` : ''}<p class="source-credit">Metadata from Metron · saved ${esc(date(issue.saved_at))}. Cover artwork belongs to its respective rights holders.</p></div></div><section class="copy-list"><h3>Owned copies</h3>${issue.copies.length ? issue.copies.map(c => `<div class="copy-row"><div><strong>${esc(issue.editions.find(e => e.key === c.edition_key)?.name)}</strong><p class="muted">Added ${esc(date(c.added_at))} · Copy <code>${esc(c.id.slice(0, 8))}</code></p></div><button class="quiet" data-remove="${c.id}">Remove this copy</button></div>`).join('') : '<p class="muted">You haven’t added an owned copy of this issue.</p>'}</section>`;
  $('#add-copy').onclick = () => choose(Number(id), issue, edition.key);
  $('#toggle-read').onclick = async e => {
    e.currentTarget.disabled = true;
    try { await api(`/issues/${id}/read`, { method: 'PATCH', body: JSON.stringify({ read: !issue.read, edition_key: edition.key }) }); await route(); message(issue.read ? 'Comic marked unread. Owned copies are unchanged.' : 'Comic marked as read.'); }
    catch (error) { message(error.message, true); if ($('#toggle-read')) $('#toggle-read').disabled = false; }
  };
  document.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => removeCopy(b.dataset.remove));
}
function removeCopy(id) {
  dialog.innerHTML = `<form id="remove-form"><h2 id="dialog-title">Remove this owned copy?</h2><p class="intro">This removes only copy ${esc(id.slice(0, 8))}. Your other copies and read status stay as they are.</p><p class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="quiet" id="cancel-remove">Cancel</button><button class="danger" type="submit">Remove copy</button></div></form>`;
  dialog.showModal(); $('#cancel-remove').onclick = closeDialog;
  $('#remove-form').onsubmit = async e => {
    e.preventDefault(); const button = e.target.querySelector('[type=submit]'); button.disabled = true;
    try { await api(`/copies/${id}`, { method: 'DELETE' }); closeDialog(); await route(); message('Owned copy removed.'); }
    catch (error) { e.target.querySelector('.form-error').textContent = error.message; button.disabled = false; }
  };
}
function changelog() {
  app.innerHTML = `<a class="back-link" href="#/">← Search comics</a><div class="section-heading"><h2>Changelog</h2><span class="count">${esc(releases[0].version)}</span></div>${releases.map(r => `<article class="release"><p class="eyebrow"><span class="build-version">${esc(r.version)}</span> · <time datetime="${r.date}">${esc(date(r.date))}</time></p><h3>${esc(r.title)}</h3><ul>${r.changes.map(c => `<li>${esc(c)}</li>`).join('')}</ul></article>`).join('')}`;
}
window.addEventListener('hashchange', route);
try { connected = (await api('/health')).metron_configured; } catch { /* Search and collection report actionable failures. */ }
await route();


