import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, Repository } from './database.mjs';
import { Metron } from './metron.mjs';
import { Covers } from './covers.mjs';
import { AppError, positiveId } from './errors.mjs';
import { releases } from '../public/releases.js';
import { validateRating } from './ratings.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const staticFiles = new Map([
  ['/actions.js', ['actions.js','text/javascript; charset=utf-8']],
  ['/', ['index.html', 'text/html; charset=utf-8']], ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']], ['/releases.js', ['releases.js', 'text/javascript; charset=utf-8']],
  ['/shopping-list.png', ['shopping-list.png', 'image/png']],
  ['/mask.png', ['mask.png', 'image/png']], ['/box-add.png', ['box-add.png', 'image/png']], ['/book-check.png', ['book-check.png', 'image/png']],
]);
async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new AppError(415, 'Send JSON data.');
  let text = '';
  for await (const chunk of req) { text += chunk; if (text.length > 8192) throw new AppError(413, 'Request is too large.'); }
  try { const data = JSON.parse(text); if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error(); return data; }
  catch { throw new AppError(400, 'Invalid JSON data.'); }
}
function flags(data) {
  if (Object.hasOwn(data, 'rating')) validateRating(data.rating);
  if (typeof data.owned !== 'boolean' || typeof data.read !== 'boolean' || (!data.owned && !data.read && data.rating == null)) throw new AppError(400, 'Choose ownership, read status, or both.');
  if (typeof data.edition_key !== 'string' || data.edition_key.length > 100) throw new AppError(400, 'Choose the exact cover before saving.');
}
export function createApp(options = {}) {
  const dataDir = resolve(options.dataDir || process.env.DATA_DIR || join(root, 'data'));
  const db = openDatabase(dataDir), repo = new Repository(db);
  const metron = options.metron || new Metron(repo, { token: process.env.METRON_API_TOKEN, username: process.env.METRON_USERNAME, password: process.env.METRON_PASSWORD, ...options.metronOptions });
  const covers = options.covers || new Covers(dataDir, options.imageFetch, { db, ...options.coverOptions });
  const hosts = new Set(['127.0.0.1', 'localhost', '[::1]', ...(process.env.ALLOWED_HOSTS || '').split(',').map(h => h.trim()).filter(Boolean)]);
  const server = createServer(async (req, res) => {
    const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https://static.metron.cloud https://metron.cloud; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try {
      const host = new URL(`http://${req.headers.host || 'invalid'}`);
      if (!hosts.has(host.hostname)) throw new AppError(403, 'This host is not allowed.');
      const url = new URL(req.url, host);
      if (req.headers['sec-fetch-site'] === 'cross-site' && !['GET', 'HEAD'].includes(req.method)) throw new AppError(403, 'Cross-site changes are not allowed.');
      if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin && new URL(req.headers.origin).host !== host.host) throw new AppError(403, 'Cross-site changes are not allowed.');
      if (req.method === 'GET' && url.pathname === '/api/health') return send(200, { status: 'ok', version: releases[0].version, metron_configured: metron.configured });
      if (req.method === 'GET' && url.pathname === '/api/search') {
        const result=await metron.search(url.searchParams);
        result.results=result.results.map(row=>({...row,...repo.issueStatus(row.id)}));
        return send(200,result);
      }
      let match = url.pathname.match(/^\/api\/metron\/issues\/(\d+)$/);
      if (req.method === 'GET' && match) {
        const issue = await metron.issue(positiveId(match[1]));
        issue.editions = issue.editions.map(e => ({ ...e, ...repo.coverStatus(issue.id,e.key) }));
        const local=repo.issue(issue.id);
        Object.assign(issue,{saved:Boolean(local),copies:local?.copies || [],read:local?.read || null,user_rating:local?.user_rating ?? null});
        return send(200, issue);
      }
      if (req.method === 'GET' && url.pathname === '/api/wants') return send(200, { items: repo.wantList((url.searchParams.get('q') || '').slice(0,160)) });
      if (req.method === 'POST' && url.pathname === '/api/wants') {
        const data = await body(req), id = positiveId(data.issue_id);
        if (typeof data.edition_key !== 'string' || !/^(standard|variant-[a-f0-9]{64})$/.test(data.edition_key)) throw new AppError(400, 'Choose the exact cover first.');
        const status = repo.coverStatus(id,data.edition_key);
        if (status.owned || status.wanted) return send(200, { added: false, ...status });
        const saved = repo.issue(id);
        const issue = saved?.editions.some(e => e.key === data.edition_key) ? saved : await metron.issue(id);
        const edition = issue.editions.find(e => e.key === data.edition_key);
        if (!edition) throw new AppError(400, 'That cover is no longer in the Metron result. Choose a cover again.');
        if (!issue.resource_url) throw new AppError(502, 'Metron did not provide a comic page link. Please try this comic again later.');
        const coverFile = edition.cover_file || await covers.save(edition.source_image);
        return send(200, repo.addWant(issue,edition,coverFile));
      }
      match = url.pathname.match(/^\/api\/wants\/(\d+)\/(standard|variant-[a-f0-9]{64})$/);
      if (req.method === 'DELETE' && match) { repo.removeWant(positiveId(match[1]),match[2]); return send(200, { removed:true }); }
      if (req.method === 'GET' && url.pathname === '/api/collection') {
        const view = url.searchParams.get('view') || 'owned';
        if (!['owned', 'read'].includes(view)) throw new AppError(400, 'Choose owned comics or read comics.');
        return send(200, { view, items: repo.collection(view, (url.searchParams.get('q') || '').slice(0, 160)) });
      }
      match = url.pathname.match(/^\/api\/issues\/(\d+)$/);
      if (req.method === 'GET' && match) {
        const issue = repo.issue(positiveId(match[1]));
        if (!issue) throw new AppError(404, 'Comic not found in your collection.');
        return send(200, issue);
      }
      if (req.method === 'POST' && url.pathname === '/api/entries') {
        const data = await body(req); flags(data);
        const id = positiveId(data.issue_id);
        let issue = repo.issue(id);
        let edition = issue?.editions.find(e => e.key === data.edition_key);
        if (!edition) { issue = await metron.issue(id); edition = issue.editions.find(e => e.key === data.edition_key); }
        if (!edition) throw new AppError(400, 'That cover is no longer in the Metron result. Choose a cover again.');
        const wanted = repo.want(id,edition.key);
        const coverFile = edition.cover_file || (wanted?.edition.source_image === edition.source_image ? wanted.cover_file : null) || await covers.save(edition.source_image);
        const { editions, copies, read, saved_at, user_rating, ...metadata } = issue;
        return send(201, repo.save(metadata, edition, coverFile, data));
      }
      match = url.pathname.match(/^\/api\/issues\/(\d+)\/read$/);
      if (req.method === 'PATCH' && match) {
        const data = await body(req);
        if (typeof data.read !== 'boolean') throw new AppError(400, 'Read status must be true or false.');
        return send(200, repo.setRead(positiveId(match[1]), data.read, data.edition_key));
      }
      match = url.pathname.match(/^\/api\/issues\/(\d+)\/rating$/);
      if (req.method === 'PATCH' && match) {
        const data = await body(req);
        return send(200, repo.setRating(positiveId(match[1]), data.rating, data.edition_key));
      }
      match = url.pathname.match(/^\/api\/copies\/([a-f0-9-]{36})$/);
      if (req.method === 'DELETE' && match) { repo.removeCopy(match[1]); return send(200, { removed: true }); }
      if (req.method === 'GET' && url.pathname.startsWith('/covers/')) {
        const filename = url.pathname.slice(8), bytes = await covers.read(filename);
        const type = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[filename.split('.').at(-1)];
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'private, max-age=31536000, immutable' }); return res.end(bytes);
      }
      const file = staticFiles.get(url.pathname);
      if (req.method === 'GET' && file) {
        const bytes = await readFile(join(root, 'public', file[0]));
        res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-cache' }); return res.end(bytes);
      }
      throw new AppError(404, 'Page not found.');
    } catch (error) {
      if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
      if (!res.headersSent) send(error.status || 500, { error: error.status ? error.message : 'Something went wrong. Please try again.' });
      else res.end();
    }
  });
  server.requestTimeout = 60000;
  server.on('close', () => db.close());
  return { server, repo, metron, covers };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server } = createApp();
  const port = Number(process.env.PORT || 4340), host = process.env.HOST || '127.0.0.1';
  server.listen(port, host, () => console.log(`DangerRoom ${releases[0].version} · http://${host}:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}
