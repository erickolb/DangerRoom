import { S3Images, storageConfig } from './s3-images.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { AppError } from './errors.mjs';
import { imageURL } from './metron.mjs';

export class Covers {
  constructor(directory, fetchImpl = fetch, options = {}) {
    this.directory = join(directory, 'covers'); this.fetch = fetchImpl; this.inflight = new Map();
    this.db = options.db; this.config = options.config || storageConfig();
    this.s3 = new S3Images(this.config, options.s3Client);
    if (this.config.mode === 's3' && !this.db) throw Error('S3 storage requires a database.');
  }
  location(filename) { return this.db?.prepare('SELECT * FROM cover_objects WHERE filename=?').get(filename); }
  record(filename, location) {
    this.db.prepare('INSERT INTO cover_objects VALUES (?,?,?) ON CONFLICT(filename) DO UPDATE SET bucket=excluded.bucket,object_key=excluded.object_key').run(filename, location.bucket, location.key);
  }
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
    if (this.location(filename)) return filename;
    if (this.config.mode === 's3') {
      try { this.record(filename, await this.s3.upload(filename, bytes)); }
      catch { throw new AppError(502, 'The cover could not be saved to S3. Nothing was added; please try again.'); }
      return filename;
    }
    await mkdir(this.directory, { recursive: true });
    try { await writeFile(join(this.directory, filename), bytes, { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    return filename;
  }
  async read(filename) {
    if (!/^[a-f0-9]{64}\.(jpg|png|webp|gif)$/.test(filename)) throw new AppError(404, 'Cover not found.');
    const location = this.location(filename);
    if (location) {
      try {
        const bytes = await this.s3.read(location.bucket, location.object_key);
        if (createHash('sha256').update(bytes).digest('hex') !== filename.split('.')[0]) throw Error('Invalid cover checksum.');
        return bytes;
      } catch { throw new AppError(502, 'The stored S3 cover is temporarily unavailable.'); }
    }
    try { return await readFile(join(this.directory, filename)); } catch (e) { if (e.code === 'ENOENT') throw new AppError(404, 'Cover not found.'); throw e; }
  }
}
