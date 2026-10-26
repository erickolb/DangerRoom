import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError } from './errors.mjs';
import { validateRating } from './ratings.mjs';

export function openDatabase(directory) {
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(join(directory, 'dangerroom.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS issues (id INTEGER PRIMARY KEY, metadata TEXT NOT NULL, saved_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS editions (issue_id INTEGER NOT NULL REFERENCES issues(id), key TEXT NOT NULL,
      metadata TEXT NOT NULL, cover_file TEXT, PRIMARY KEY(issue_id,key));
    CREATE TABLE IF NOT EXISTS copies (id TEXT PRIMARY KEY, issue_id INTEGER NOT NULL, edition_key TEXT NOT NULL,
      added_at TEXT NOT NULL, FOREIGN KEY(issue_id,edition_key) REFERENCES editions(issue_id,key));
    CREATE TABLE IF NOT EXISTS reads (issue_id INTEGER PRIMARY KEY, edition_key TEXT NOT NULL, read_at TEXT NOT NULL,
      FOREIGN KEY(issue_id,edition_key) REFERENCES editions(issue_id,key));
    CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS provider_state (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS issue_ratings (issue_id INTEGER PRIMARY KEY REFERENCES issues(id),
      half_stars INTEGER NOT NULL CHECK(typeof(half_stars)='integer' AND half_stars BETWEEN 1 AND 10), rated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS wants (issue_id INTEGER NOT NULL, edition_key TEXT NOT NULL,
      metadata TEXT NOT NULL, cover_file TEXT, added_at TEXT NOT NULL, PRIMARY KEY(issue_id,edition_key));
    CREATE TABLE IF NOT EXISTS cover_objects (filename TEXT PRIMARY KEY, bucket TEXT NOT NULL, object_key TEXT NOT NULL);
    PRAGMA user_version=4;`);
  return db;
}
export class Repository {
  constructor(db) { this.db = db; }
  cacheGet(key) {
    const row = this.db.prepare('SELECT payload FROM cache WHERE key=? AND expires_at>?').get(key, Date.now());
    return row ? JSON.parse(row.payload) : null;
  }
  cachePut(key, value, ttl) {
    this.db.prepare('DELETE FROM cache WHERE expires_at<?').run(Date.now());
    this.db.prepare('INSERT OR REPLACE INTO cache VALUES (?,?,?)').run(key, JSON.stringify(value), Date.now() + ttl);
  }
  stateGet(key) { return this.db.prepare('SELECT value FROM provider_state WHERE key=?').get(key)?.value || 0; }
  statePut(key, value) { this.db.prepare('INSERT OR REPLACE INTO provider_state VALUES (?,?)').run(key, value); }
  issue(id) {
    const row = this.db.prepare('SELECT * FROM issues WHERE id=?').get(id);
    if (!row) return null;
    return { ...JSON.parse(row.metadata), saved_at: row.saved_at,
      user_rating: (this.db.prepare('SELECT half_stars FROM issue_ratings WHERE issue_id=?').get(id)?.half_stars ?? 0) / 2 || null,
      editions: this.db.prepare('SELECT * FROM editions WHERE issue_id=?').all(id).map(e => ({ ...JSON.parse(e.metadata), cover_file: e.cover_file, ...this.coverStatus(id, e.key) })),
      copies: this.db.prepare('SELECT * FROM copies WHERE issue_id=? ORDER BY added_at DESC,id').all(id),
      read: this.db.prepare('SELECT * FROM reads WHERE issue_id=?').get(id) || null };
  }
  save(issue, edition, coverFile, { owned, read, rating }) {
    if (rating !== undefined) validateRating(rating);
    const now = new Date().toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT OR IGNORE INTO issues VALUES (?,?,?)').run(issue.id, JSON.stringify(issue), now);
      this.db.prepare(`INSERT INTO editions VALUES (?,?,?,?) ON CONFLICT(issue_id,key) DO UPDATE SET
        cover_file=COALESCE(editions.cover_file,excluded.cover_file)`).run(issue.id, edition.key, JSON.stringify(edition), coverFile);
      let copyId = null;
      if (owned) {
        copyId = randomUUID();
        this.db.prepare('INSERT INTO copies VALUES (?,?,?,?)').run(copyId, issue.id, edition.key, now);
        this.db.prepare('DELETE FROM wants WHERE issue_id=? AND edition_key=?').run(issue.id, edition.key);
      }
      if (rating !== undefined) this.writeRating(issue.id, rating, now);
      if (read || rating != null) this.db.prepare('INSERT OR IGNORE INTO reads VALUES (?,?,?)').run(issue.id, edition.key, now);
      this.db.exec('COMMIT');
      return { issue: this.issue(issue.id), copy_id: copyId };
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  ownedCover(id) {
    return this.db.prepare(`SELECT e.cover_file, e.key AS edition_key FROM copies c
      JOIN editions e ON e.issue_id=c.issue_id AND e.key=c.edition_key
      WHERE c.issue_id=? AND e.cover_file IS NOT NULL
      ORDER BY (e.key!='standard') DESC, c.added_at DESC, c.id DESC LIMIT 1`).get(id) || null;
  }
  issueStatus(id) {
    return { owned: Boolean(this.db.prepare('SELECT 1 FROM copies WHERE issue_id=? LIMIT 1').get(id)),
      wanted: Boolean(this.db.prepare('SELECT 1 FROM wants WHERE issue_id=? LIMIT 1').get(id)),
      read: Boolean(this.db.prepare('SELECT 1 FROM reads WHERE issue_id=?').get(id)) };
  }
  coverStatus(id, key) {
    return { owned: Boolean(this.db.prepare('SELECT 1 FROM copies WHERE issue_id=? AND edition_key=? LIMIT 1').get(id,key)),
      wanted: Boolean(this.db.prepare('SELECT 1 FROM wants WHERE issue_id=? AND edition_key=?').get(id,key)) };
  }
  want(id, key) {
    const row = this.db.prepare('SELECT * FROM wants WHERE issue_id=? AND edition_key=?').get(id,key);
    return row ? { ...JSON.parse(row.metadata), cover_file: row.cover_file, added_at: row.added_at } : null;
  }
  addWant(issue, edition, coverFile) {
    // Deliberate allowlist: wants never create full inventory issues or editions.
    const metadata = { issue_id: issue.id, display_name: issue.display_name,
      series: { id: issue.series.id, name: issue.series.name, year_began: issue.series.year_began, volume: issue.series.volume },
      number: issue.number, cover_date: issue.cover_date, resource_url: issue.resource_url,
      edition: { key: edition.key, name: edition.name, source_image: edition.source_image } };
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const status = this.coverStatus(issue.id, edition.key);
      let added = false;
      if (!status.owned) added = Boolean(this.db.prepare('INSERT OR IGNORE INTO wants VALUES (?,?,?,?,?)').run(issue.id, edition.key, JSON.stringify(metadata), coverFile, new Date().toISOString()).changes);
      this.db.exec('COMMIT');
      return { added, ...this.coverStatus(issue.id,edition.key) };
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  wantList(query = '') {
    const needle = query.toLocaleLowerCase();
    return this.db.prepare('SELECT * FROM wants ORDER BY added_at DESC,issue_id DESC,edition_key').all()
      .map(row => ({ ...JSON.parse(row.metadata), cover_file: row.cover_file, added_at: row.added_at }))
      .filter(row => !needle || [row.display_name,row.series.name,row.edition.name].join(' ').toLocaleLowerCase().includes(needle));
  }
  removeWant(id, key) {
    this.db.prepare('DELETE FROM wants WHERE issue_id=? AND edition_key=?').run(id,key);
  }
  writeRating(id, rating, now) {
    if (rating === null) this.db.prepare('DELETE FROM issue_ratings WHERE issue_id=?').run(id);
    else this.db.prepare('INSERT INTO issue_ratings VALUES (?,?,?) ON CONFLICT(issue_id) DO UPDATE SET half_stars=excluded.half_stars,rated_at=excluded.rated_at').run(id, rating * 2, now);
  }
  setRating(id, rating, editionKey) {
    validateRating(rating);
    const issue = this.issue(id);
    if (!issue) throw new AppError(404, 'Comic not found in your collection.');
    if (rating !== null && !issue.editions.some(e => e.key === editionKey)) throw new AppError(400, 'Choose a saved cover.');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const now = new Date().toISOString();
      this.writeRating(id, rating, now);
      if (rating !== null) this.db.prepare('INSERT OR IGNORE INTO reads VALUES (?,?,?)').run(id, editionKey, now);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.issue(id);
  }
  setRead(id, read, editionKey) {
    const issue = this.issue(id);
    if (!issue) throw new AppError(404, 'Comic not found in your collection.');
    if (read) {
      if (!issue.editions.some(e => e.key === editionKey)) throw new AppError(400, 'Choose a saved cover.');
      this.db.prepare('INSERT OR IGNORE INTO reads VALUES (?,?,?)').run(id, editionKey, new Date().toISOString());
    } else this.db.prepare('DELETE FROM reads WHERE issue_id=?').run(id);
    return this.issue(id);
  }
  removeCopy(id) {
    if (!this.db.prepare('DELETE FROM copies WHERE id=?').run(id).changes) throw new AppError(404, 'Owned copy not found.');
  }
  collection(view, query = '') {
    const rows = view === 'read'
      ? this.db.prepare('SELECT issue_id,edition_key,read_at AS date FROM reads ORDER BY read_at DESC,issue_id DESC').all()
      : this.db.prepare('SELECT id,issue_id,edition_key,added_at AS date FROM copies ORDER BY added_at DESC,id').all();
    const needle = query.toLocaleLowerCase();
    return rows.map(row => {
      const issue = this.issue(row.issue_id);
      return { id: row.id || `read-${row.issue_id}`, date: row.date, issue,
        edition: issue.editions.find(e => e.key === row.edition_key) };
    }).filter(row => !needle || [row.issue.display_name, row.issue.series.name, row.issue.publisher?.name,
      row.issue.number, row.edition.name, row.edition.upc, row.issue.isbn].filter(Boolean).join(' ').toLocaleLowerCase().includes(needle));
  }
}
