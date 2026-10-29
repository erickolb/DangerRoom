import { createHash } from 'node:crypto';
import { AppError, positiveId } from './errors.mjs';

const imageHosts = new Set(['static.metron.cloud', 'metron.cloud']);
export function imageURL(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && imageHosts.has(url.hostname) && !url.username && !url.password && !url.port && url.pathname.startsWith('/media/') ? url.href : null;
  } catch { return null; }
}
export function resourceURL(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'metron.cloud' && !u.username && !u.password && !u.port ? u.href : null; } catch { return null; }
}
export function editionsFor(raw) {
  const base = { key: 'standard', name: 'Standard cover', source_image: imageURL(raw.image), upc: raw.upc || '', sku: raw.sku || '', price: raw.price ?? null, price_currency: raw.price_currency || '' };
  return [base, ...(raw.variants || []).map(v => {
    // Nested variants currently have no ID. Preserve the exact metadata and use a stable fingerprint, not array position.
    const identity = [v.name || '', v.upc || '', v.sku || '', imageURL(v.image) || ''];
    return { key: `variant-${createHash('sha256').update(JSON.stringify(identity)).digest('hex')}`, name: v.name || 'Unnamed variant', source_image: imageURL(v.image), upc: v.upc || '', sku: v.sku || '', price: v.price ?? null, price_currency: v.price_currency || '' };
  })];
}
export function seriesType(value) {
  return value && Number.isSafeInteger(value.id) && value.id>0 && typeof value.name==='string' && value.name.trim()
    ? {id:value.id,name:value.name.trim()} : null;
}
export function essentialIssue(raw) {
  return {
    id: positiveId(raw.id), series: { id: raw.series.id, name: raw.series.name, volume: raw.series.volume, year_began: raw.series.year_began, language: raw.series.language || null, series_type: seriesType(raw.series.series_type) },
    display_name: `${raw.series.name}${raw.series.year_began ? ` (${raw.series.year_began})` : ''} #${raw.number}`,
    number: String(raw.number), alt_number: raw.alt_number || '', title: raw.title || '', name: raw.name || [],
    publisher: raw.publisher || null, imprint: raw.imprint || null,
    cover_date: raw.cover_date || null, store_date: raw.store_date || null, isbn: raw.isbn || '',
    page_count: raw.page ?? raw.page_count ?? null, rating: raw.rating || null,
    resource_url: resourceURL(raw.resource_url), modified: raw.modified || null,
    attribution: Array.isArray(raw.attribution) ? raw.attribution : [],
  };
}
export function searchFilters(params) {
  const q = (params.get('q') || '').trim();
  const number = (params.get('number') || '').trim();
  const year = (params.get('year') || '').trim();
  const upc = (params.get('upc') || '').trim();
  const page = positiveId(params.get('page') || 1, 'Page');
  if ((!q && !upc) || q.length > 160 || number.length > 30 || page > 10000) throw new AppError(400, 'Enter a series name or UPC, using a shorter search if needed.');
  if (year && !/^\d{4}$/.test(year)) throw new AppError(400, 'Series year must contain four digits.');
  if (upc && !/^\d{8,18}$/.test(upc)) throw new AppError(400, 'Enter an 8–18 digit UPC.');
  const filters = new URLSearchParams();
  if (q) filters.set('series_name', q);
  if (number) filters.set('number', number);
  if (year) filters.set('series_year_began', year);
  if (upc) filters.set('upc', upc);
  filters.set('page', String(page));
  return filters;
}

export class Metron {
  constructor(repo, { token = '', username = '', password = '', fetchImpl = fetch, interval = 3100 } = {}) {
    this.repo = repo; this.fetch = fetchImpl; this.interval = interval;
    this.authorization = token ? `Bearer ${token}` : username && password ? `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` : '';
    this.inflight = new Map(); this.queue = Promise.resolve();
  }
  get configured() { return Boolean(this.authorization); }
  async get(path, ttl) {
    const cached = this.repo.cacheGet(path);
    if (cached) return cached;
    if (this.inflight.has(path)) return this.inflight.get(path);
    const task = this.queue.then(async () => {
      const existing = this.repo.cacheGet(path);
      if (existing) return existing;
      if (!this.configured) throw new AppError(503, 'Metron is not connected yet. Add METRON_API_TOKEN to .env and restart DangerRoom. Your saved collection remains available.');
      const now = Date.now();
      const blocked = this.repo.stateGet('blocked_until');
      if (blocked > now) {
        const daily = this.repo.stateGet('sustained_until') > now;
        const burst = this.repo.stateGet('burst_until') > now;
        throw new AppError(429, daily ? 'Metron’s daily request limit has been reached.' : burst ? 'Metron’s per-minute request limit has been reached. Daily quota may still be available.' : 'Metron has asked DangerRoom to pause requests; this does not necessarily mean your daily quota is exhausted.', Math.ceil((blocked - now) / 1000));
      }
      const delay = this.repo.stateGet('next_request') - now;
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, Math.min(delay, this.interval)));
      this.repo.statePut('next_request', Date.now() + this.interval);
      let response;
      try { response = await this.fetch(`https://metron.cloud/api/${path}`, { headers: { Authorization: this.authorization, Accept: 'application/json', 'User-Agent': 'DangerRoom/0.1.0-alpha.1 (personal comic inventory)' }, signal: AbortSignal.timeout(20000), redirect: 'error' }); }
      catch { throw new AppError(502, 'Could not reach Metron. Try again shortly; saved comics remain available.'); }
      let until = 0;
      for (const window of ['Burst', 'Sustained']) {
        if (response.headers.get(`X-RateLimit-${window}-Remaining`) === '0') {
          const reset = Number(response.headers.get(`X-RateLimit-${window}-Reset`)) * 1000;
          if (Number.isFinite(reset) && reset > Date.now()) {
            this.repo.statePut(window === 'Burst' ? 'burst_until' : 'sustained_until', reset);
            until = Math.max(until, reset);
          }
        }
      }
      if (response.status === 429) {
        const retry = response.headers.get('Retry-After');
        const seconds = /^\d+$/.test(retry || '') ? Number(retry) : Math.max(0, (Date.parse(retry) - Date.now()) / 1000);
        until = Math.max(until, Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 60) * 1000);
      }
      if (until > Date.now()) this.repo.statePut('blocked_until', until);
      if (response.status === 429) throw new AppError(429, 'Metron has asked us to pause. Please try again after the waiting period.', Math.max(1, Math.ceil((until - Date.now()) / 1000)));
      if ([401, 403].includes(response.status)) throw new AppError(502, 'Metron rejected the configured credentials. Check your API token and restart DangerRoom.');
      if (response.status === 404) throw new AppError(404, 'No matching Metron comic or results page was found.');
      if (!response.ok) throw new AppError(502, 'Metron is temporarily unavailable. Please try again later.');
      let payload;
      try { payload = await response.json(); } catch { throw new AppError(502, 'Metron returned an unexpected response.'); }
      this.repo.cachePut(path, payload, ttl);
      return payload;
    });
    this.queue = task.catch(() => {});
    this.inflight.set(path, task);
    try { return await task; } finally { this.inflight.delete(path); }
  }
  async search(params) {
    const filters = searchFilters(params);
    const data = await this.get(`issue/?${filters}`, 6 * 60 * 60 * 1000);
    const pending=new Map();
    const results=await Promise.all(data.results.map(async r=>{
      let type=seriesType(r.series.series_type)||seriesType(r.series_type)||seriesType(this.repo.knownSeriesType?.(r.series.id));
      if(!type){
        if(!pending.has(r.series.id))pending.set(r.series.id,this.get(`series/${positiveId(r.series.id)}/`,24*60*60*1000).then(series=>{
          if(series.id!==r.series.id)throw new AppError(502,'Metron returned unexpected series data.');
          return seriesType(series.series_type);
        }));
        type=await pending.get(r.series.id);
      }
      return {id:r.id,display_name:r.issue||`${r.series.name} #${r.number}`,series:{...r.series,series_type:type},
        number:r.number,cover_date:r.cover_date,image:imageURL(r.image)};
    }));
    return {count:data.count,page:Number(filters.get('page')),next:Boolean(data.next),previous:Boolean(data.previous),results};
  }

  async seriesTypes() {
    const types=new Map();
    for(let page=1;page<=10;page++){
      const data=await this.get(`series_type/?page=${page}`,24*60*60*1000);
      const rows=Array.isArray(data)?data:data.results;
      if(!Array.isArray(rows))throw new AppError(502,'Metron returned an unexpected series-type list.');
      for(const row of rows){const type=seriesType(row);if(type)types.set(type.id,type);}
      if(!data.next)return [...types.values()].sort((a,b)=>a.name.localeCompare(b.name));
    }
    throw new AppError(502,'Metron returned too many series-type pages.');
  }
  async issue(id) {
    const raw = await this.get(`issue/${positiveId(id)}/`, 24 * 60 * 60 * 1000);
    if (raw.id !== Number(id) || !raw.series?.name) throw new AppError(502, 'Metron returned incomplete comic data.');
    return { ...essentialIssue(raw), editions: editionsFor(raw) };
  }
}
