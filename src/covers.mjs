import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { AppError } from './errors.mjs';
import { imageURL } from './metron.mjs';

export class Covers {
  constructor(directory, fetchImpl = fetch) { this.directory = join(directory, 'covers'); this.fetch = fetchImpl; this.inflight = new Map(); }
  async save(source) {
    if (!source) return null;
    if (!imageURL(source)) throw new AppError(400, 'This cover URL is not from Metron.');
    if (this.inflight.has(source)) return this.inflight.get(source);
    const task = this.download(source);
    this.inflight.set(source, task);
    try { return await task; } finally { this.inflight.delete(source); }
  }
  async download(source) {
    let response;
    try { response = await this.fetch(source, { signal: AbortSignal.timeout(30000), redirect: 'error' }); }
    catch { throw new AppError(502, 'The cover could not be downloaded. Nothing was added; please try again.'); }
    if (!response.ok || Number(response.headers.get('content-length')) > 25 * 1024 * 1024) throw new AppError(502, 'The original cover is unavailable or exceeds the 25 MB limit. Nothing was added.');
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 25 * 1024 * 1024) throw new AppError(502, 'The cover exceeds the 25 MB limit. Nothing was added.');
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    const ext = bytes.subarray(0, 3).equals(Buffer.from([255,216,255])) ? 'jpg'
      : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png'
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'webp'
      : /^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6)) ? 'gif' : null;
    if (!ext) throw new AppError(502, 'Metron did not return a supported cover image. Nothing was added.');
    const filename = `${createHash('sha256').update(bytes).digest('hex')}.${ext}`;
    await mkdir(this.directory, { recursive: true });
    try { await writeFile(join(this.directory, filename), bytes, { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    return filename;
  }
  async read(filename) {
    if (!/^[a-f0-9]{64}\.(jpg|png|webp|gif)$/.test(filename)) throw new AppError(404, 'Cover not found.');
    try { return await readFile(join(this.directory, filename)); } catch (e) { if (e.code === 'ENOENT') throw new AppError(404, 'Cover not found.'); throw e; }
  }
}
