import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { AppError } from './errors.mjs';

export const hashSecret = value => createHash('sha256').update(value).digest('hex');
export function equalSecret(a, b) {
  return typeof a === 'string' && typeof b === 'string' && timingSafeEqual(Buffer.from(hashSecret(a)), Buffer.from(hashSecret(b)));
}
export class Devices {
  constructor(db) {
    this.db = db;
    db.exec(`CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, label TEXT NOT NULL, token_hash TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1);`);
  }
  add(label) {
    if (typeof label !== 'string' || !label.trim() || label.length > 100) throw new AppError(400, 'Choose a device label of 1–100 characters.');
    const deviceId = randomUUID(), token = randomBytes(32).toString('hex');
    this.db.prepare('INSERT INTO devices VALUES (?,?,?,1)').run(deviceId, label.trim(), hashSecret(token));
    return { deviceId, token, note: 'Save the secret securely. It is shown only once.' };
  }
  list() { return this.db.prepare('SELECT id,label,enabled FROM devices ORDER BY label,id').all(); }
  revoke(id) { return this.db.prepare('UPDATE devices SET enabled=0 WHERE id=?').run(id).changes > 0; }
  authenticate(req) {
    const authorization = req.headers.authorization;
    if (authorization || req.headers['x-device-id']) {
      const id = req.headers['x-device-id'];
      const row = typeof id === 'string' ? this.db.prepare('SELECT token_hash FROM devices WHERE id=? AND enabled=1').get(id) : null;
      if (!row || typeof authorization !== 'string' || !authorization.startsWith('Bearer ') || !equalSecret(hashSecret(authorization.slice(7)), row.token_hash)) throw new AppError(401, 'Device credentials are invalid or revoked.');
      return true;
    }
    return false;
  }
}
