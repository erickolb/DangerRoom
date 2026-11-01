import { createHash } from 'node:crypto';
import { AppError } from './errors.mjs';

export const MAX_CAPTURE_BYTES = 25 * 1024 * 1024;
const columns = 'id,capture_id,captured_at,cover_hash,algorithm,mode,client_version,width,height,sha256,length(image) AS bytes';

export class ScanCaptures {
  constructor(db) {
    this.db = db;
    db.exec(`CREATE TABLE IF NOT EXISTS scan_captures (
      id INTEGER PRIMARY KEY AUTOINCREMENT, capture_id TEXT NOT NULL UNIQUE,
      captured_at TEXT NOT NULL, cover_hash TEXT NOT NULL, algorithm TEXT NOT NULL,
      mode TEXT NOT NULL, client_version TEXT NOT NULL, width INTEGER NOT NULL,
      height INTEGER NOT NULL, sha256 TEXT NOT NULL, image BLOB NOT NULL)`);
  }
  list() { return this.db.prepare(`SELECT ${columns} FROM scan_captures ORDER BY id DESC`).all(); }
  image(id) {
    const row = this.db.prepare('SELECT image FROM scan_captures WHERE id=?').get(id);
    if (!row) throw new AppError(404, 'Scan capture not found; only the latest ten are retained.');
    return Buffer.from(row.image);
  }
  save({captureId,hash,mode,clientVersion}, image) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(captureId || '') || !/^[a-f0-9]{16}$/i.test(hash || '')
      || !['perspective-corrected','legacy'].includes(mode) || typeof clientVersion !== 'string'
      || !/^[\w.+-]{1,60}$/.test(clientVersion)) throw new AppError(400, 'Invalid scan capture metadata.');
    if (!image.length || image.length > MAX_CAPTURE_BYTES) throw new AppError(413, 'Scan image exceeds the 25 MB limit.');
    if (image.length < 45 || !image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      || image.readUInt32BE(8) !== 13 || image.toString('ascii',12,16) !== 'IHDR'
      || image.toString('ascii',image.length-8,image.length-4) !== 'IEND') throw new AppError(400, 'Send a lossless PNG scan image.');
    const width=image.readUInt32BE(16),height=image.readUInt32BE(20);
    if (!width || !height || width > 4096 || height > 4096) throw new AppError(400, 'Scan image dimensions must be 1–4096 pixels.');
    const sha256=createHash('sha256').update(image).digest('hex');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const existing=this.db.prepare('SELECT sha256,cover_hash,mode,client_version FROM scan_captures WHERE capture_id=?').get(captureId);
      if(existing && (existing.sha256!==sha256 || existing.cover_hash!==hash.toLowerCase() || existing.mode!==mode || existing.client_version!==clientVersion))
        throw new AppError(409,'That capture ID already belongs to a different scan.');
      if(!existing) this.db.prepare('INSERT INTO scan_captures (capture_id,captured_at,cover_hash,algorithm,mode,client_version,width,height,sha256,image) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(captureId,new Date().toISOString(),hash.toLowerCase(),'imagehash-phash-8x8',mode,clientVersion,width,height,sha256,image);
      this.db.exec('DELETE FROM scan_captures WHERE id NOT IN (SELECT id FROM scan_captures ORDER BY id DESC LIMIT 10)');
      const row=this.db.prepare(`SELECT ${columns} FROM scan_captures WHERE capture_id=?`).get(captureId);
      this.db.exec('COMMIT');
      return row;
    } catch(error) { this.db.exec('ROLLBACK');throw error; }
  }
}
