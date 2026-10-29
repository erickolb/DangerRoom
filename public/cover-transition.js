// Never change the source of the visible layer. Prepare the hidden layer first,
// then animate the two existing elements; old animation fill must not leak into
// the next transition (especially on Android WebView).
export function createCoverTransition(first, second, duration = 600) {
  let front = first, back = second, revision = 0, pending = null, active = null;
  first.style.opacity = second.style.opacity = '0';

  function finishActive() {
    if (!active) return;
    const { incoming, outgoing, animations } = active;
    incoming.style.opacity = '1'; outgoing.style.opacity = '0';
    front = incoming; back = outgoing; active = null;
    // Commit base styles before cancelling effects so no frame reverts.
    for (const animation of animations) animation.cancel();
  }
  function cancel() {
    revision++;
    pending?.();
    finishActive();
  }
  function load(image, src) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const abort = () => done(Error('Cover loading cancelled.'));
      function done(error) {
        if (settled) return;
        settled = true; image.onload = image.onerror = null;
        if (pending === abort) pending = null;
        if (error) reject(error); else resolve();
      }
      pending = abort;
      image.onload = async () => {
        try { if (image.decode) await image.decode(); done(); }
        catch { done(Error('Cover could not be decoded.')); }
      };
      image.onerror = () => done(Error('Cover could not be loaded.'));
      image.src = src;
    });
  }
  async function show(src, alt, fade, current = () => true) {
    cancel();
    const ticket = revision, incoming = back, outgoing = front;
    incoming.style.opacity = '0'; incoming.style.zIndex = '1';
    outgoing.style.zIndex = '0';
    try { await load(incoming, src); }
    catch (error) { if (ticket !== revision || !current()) return false; throw error; }
    if (ticket !== revision || !current()) return false;
    incoming.alt = alt;
    if (!fade || !outgoing.hasAttribute('src')) {
      incoming.style.opacity = '1'; outgoing.style.opacity = '0';
      front = incoming; back = outgoing;
      return true;
    }
    const animations = [
      outgoing.animate([{ opacity: 1 }, { opacity: 0 }], { duration, fill: 'forwards' }),
      incoming.animate([{ opacity: 0 }, { opacity: 1 }], { duration, fill: 'forwards' }),
    ];
    active = { incoming, outgoing, animations };
    // Events also work on WebViews that do not expose Animation.finished.
    await Promise.all(animations.map(animation => new Promise(resolve => {
      animation.onfinish = animation.oncancel = resolve;
    })));
    if (ticket !== revision || !current()) return false;
    finishActive();
    return true;
  }
  return { show, cancel, clear() { cancel(); first.removeAttribute('src'); second.removeAttribute('src'); first.style.opacity = second.style.opacity = '0'; } };
}
