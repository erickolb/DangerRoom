const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function coverPlaceholder(state = 'missing', cls = '') {
  const label = state === 'loading' ? 'Cover loading' : state === 'paused' ? 'Cover loading paused' : 'Cover unavailable';
  return `<div class="cover cover-placeholder ${state}-cover ${esc(cls)}" role="img" aria-label="${label}"></div>`;
}

export function coverArtwork(src, title = '', cls = '') {
  return src ? `<img class="cover cover-loading ${esc(cls)}" src="${esc(src)}" alt="${esc(title)}" loading="lazy">` : coverPlaceholder('missing', cls);
}

// Capture image events because load/error do not bubble. The observer also handles
// cached images that completed before their markup was inserted into the document.
export function installCoverStates(doc = document, Observer = MutationObserver) {
  const settle = img => {
    if (!img.matches?.('img.cover-loading') || !img.complete) return;
    if (img.naturalWidth) img.classList.remove('cover-loading');
    else img.outerHTML = coverPlaceholder('missing', [...img.classList].filter(c => c !== 'cover' && c !== 'cover-loading').join(' '));
  };
  const onImage = event => settle(event.target);
  doc.addEventListener('load', onImage, true);
  doc.addEventListener('error', onImage, true);
  const scan = node => {
    settle(node);
    node.querySelectorAll?.('img.cover-loading').forEach(settle);
  };
  const observer = new Observer(records => {
    for (const record of records) for (const node of record.addedNodes) scan(node);
  });
  observer.observe(doc.documentElement, {childList:true, subtree:true});
  scan(doc);
  return () => {
    observer.disconnect();
    doc.removeEventListener('load', onImage, true);
    doc.removeEventListener('error', onImage, true);
  };
}
