// Recovery contains navigation and drafts only, never API responses or queued writes.
export const RECOVERY_VERSION = 1;
export const MAX_RECOVERY_BYTES = 32768;
const MAX_AGE = 7 * 86400000;
export function safeRoute(value) {
  return typeof value === 'string' && value.length <= 4096 && /^#\/(?:\?|$|home(?:\?|$)|collection(?:\?|$)|wants(?:\?|$)|subscriptions(?:\?|$)|reading-log(?:\?|$)|slideshow(?:\?|$)|image-cover-search(?:\?|$)|issues\/\d+(?:\?|$))/.test(value) && !/[\x00-\x1f]/.test(value);
}
export function decodeRecovery(raw, scope, now = Date.now()) {
  try {
    if (typeof raw !== 'string' || raw.length > MAX_RECOVERY_BYTES || new TextEncoder().encode(raw).length > MAX_RECOVERY_BYTES) return null;
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    if (value.version !== RECOVERY_VERSION || value.scope !== scope || !safeRoute(value.route) || !Number.isFinite(value.at) || value.at > now + 60000 || now - value.at > MAX_AGE) return null;
    if (!Array.isArray(value.fields) || value.fields.length > 100) return null;
    if (!value.fields.every(f => f && typeof f.key === 'string' && f.key.length <= 256 && typeof f.value === 'string' && f.value.length <= 4096 && typeof f.checked === 'boolean')) return null;
    if (!Number.isFinite(value.scroll) || value.scroll < 0 || value.scroll > 10000000) return null;
    if (value.picker && (!Number.isSafeInteger(value.picker.id) || value.picker.id <= 0 || typeof value.picker.edition !== 'string' || value.picker.edition.length > 256)) return null;
    if (value.read && (!Number.isSafeInteger(value.read.id) || value.read.id <= 0 || typeof value.read.edition !== 'string' || value.read.edition.length > 256 || typeof value.read.logOnly !== 'boolean')) return null;
    if (value.gallery && (typeof value.gallery !== 'string' || value.gallery.length > 256)) return null;
    if (value.options !== undefined && typeof value.options !== 'boolean') return null;
    return value;
  } catch { return null; }
}
const FORM_SELECTOR = '#search-form, #collection-search, #want-search, #series-type-filters, #read-log-form, #gallery-options form';
function controls(document) {
  return [...document.querySelectorAll(FORM_SELECTOR)].flatMap(form => [...form.querySelectorAll('input,select,textarea')].filter(input =>
    !['password','file','submit','button'].includes(input.type) && (input.type !== 'hidden' || input.name === 'log_date') && (input.id || input.name)).map((input, index) => ({
      input, key: `${form.id || form.parentElement.id}:${input.id || input.name}:${['checkbox','radio'].includes(input.type) ? input.value : index}`,
    })));
}
export function captureFields(document) {
  return controls(document).slice(0,100).map(({input,key}) => ({key,value:String(input.value).slice(0,4096),checked:Boolean(input.checked)}));
}
export function restoreFields(document, fields) {
  const saved = new Map(fields.map(field => [field.key,field]));
  for (const {input,key} of controls(document)) {
    const field = saved.get(key); if (!field) continue;
    if (['checkbox','radio'].includes(input.type)) input.checked = field.checked;
    else input.value = field.value;
  }
}
export function createRecovery({window, document, scope, enabled, restoreDialogs}) {
  const key = `dangerroom-recovery:${scope}`;
  let storage; try { storage = window.localStorage; } catch { /* Storage can be disabled. */ }
  if(enabled)try {
    // A changed native connection must not keep old recovery drafts in this origin.
    for(const old of Object.keys(storage || {}))if(old.startsWith('dangerroom-recovery:') && old !== key)storage.removeItem(old);
  } catch { /* Cleanup is best effort when storage is unavailable. */ }
  let pending; try { pending = enabled ? decodeRecovery(storage?.getItem(key),scope) : null; } catch { /* Start normally. */ }
  // Native shells start at home. An explicit different deep link wins over recovery.
  if (pending && (!window.location.hash || window.location.hash === '#/home' || window.location.hash === pending.route)) {
    window.history.replaceState(null,'',pending.route === '#/image-cover-search' ? '#/home' : pending.route);
  } else pending = null;
  let route = window.location.hash, ready = false, restoring = false, picker = null, read = null, gallery = null, timer;
  function save() {
    if (!enabled || !ready || restoring || !safeRoute(route)) return;
    const value = {version:RECOVERY_VERSION,scope,at:Date.now(),route,scroll:window.scrollY || 0,fields:captureFields(document),picker,read,gallery,options:Boolean(document.querySelector('#gallery-options')?.open)};
    const raw = JSON.stringify(value);
    try { if (new TextEncoder().encode(raw).length <= MAX_RECOVERY_BYTES) storage?.setItem(key,raw); } catch { /* A full disk must not interrupt scanning. */ }
  }
  function schedule() { clearTimeout(timer); timer = window.setTimeout(save,250); }
  function begin() {
    clearTimeout(timer);
    if (ready) save();
    route = window.location.hash; ready = false; picker = read = gallery = null;
    if(pending && pending.route !== route)pending=null;
    if(enabled && !pending && safeRoute(route)) {
      try { storage?.setItem(key,JSON.stringify({version:RECOVERY_VERSION,scope,at:Date.now(),route,scroll:0,fields:[]})); } catch { /* Optional recovery. */ }
    }
  }
  async function complete(current) {
    if (!current()) return;
    route = window.location.hash;
    const value = pending; pending = null;
    restoring = true;
    try {
      if (value && value.route === route) {
        restoreFields(document,value.fields);
        await restoreDialogs(value,current);
        if (!current()) return;
        restoreFields(document,value.fields);
        document.dispatchEvent(new window.Event('recoveryfields'));
        window.requestAnimationFrame(() => { if (current()) window.scrollTo(0,value.scroll); });
      }
    } finally { restoring = false; if (current()) { ready = true; save(); } }
  }
  if (enabled) {
    for (const event of ['input','change','click','toggle']) document.addEventListener(event,schedule,true);
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('pagehide',save);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
    document.addEventListener('dangerroompause',save);
    // Explicit shell checkpoint runs before Android saves its activity state.
    window.dangerroomCheckpoint = save;
  }
  return {begin,complete,save,fail(){ready=false;},get restoredGallery(){return pending?.gallery || null;},
    picker(value){picker=value;save();},read(value){read=value;save();},gallery(value){gallery=value;save();}};
}
