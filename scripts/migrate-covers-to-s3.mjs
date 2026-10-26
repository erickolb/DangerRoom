import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../src/database.mjs';
import { S3Images, storageConfig, coverPattern } from '../src/s3-images.mjs';

export async function migrateCovers({ directory, db, storage, dryRun = false, log = console.log }) {
  const referenced = db.prepare('SELECT cover_file AS filename FROM editions WHERE cover_file IS NOT NULL UNION SELECT cover_file FROM wants WHERE cover_file IS NOT NULL').all().map(row => row.filename);
  let files;
  try { files = await readdir(join(directory, 'covers')); } catch (error) { if (error.code !== 'ENOENT') throw error; files = []; }
  // Include retained originals as well as currently referenced images.
  const names = [...new Set([...referenced, ...files.filter(name => coverPattern.test(name))])].sort();
  let copied = 0, skipped = 0;
  for (const filename of names) {
    if (!coverPattern.test(filename)) throw Error('Invalid cover filename in database.');
    if (db.prepare('SELECT 1 FROM cover_objects WHERE filename=?').get(filename)) { skipped++; continue; }
    const bytes = await readFile(join(directory, 'covers', filename));
    if (dryRun) { log(`Would upload ${filename}`); continue; }
    const location = await storage.upload(filename, bytes);
    db.prepare('INSERT INTO cover_objects VALUES (?,?,?)').run(filename, location.bucket, location.key);
    copied++; log(`Migrated ${filename}`);
  }
  return { total: names.length, copied, skipped, dryRun };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let db;
  try {
    if (process.argv.slice(2).some(arg => arg !== '--dry-run')) throw Error('Usage: migrate-covers-to-s3.mjs [--dry-run]');
    const config = storageConfig({ ...process.env, IMAGE_STORAGE: 's3' });
    const directory = resolve(process.env.DATA_DIR || './data');
    db = openDatabase(directory);
    console.log(await migrateCovers({ directory, db, storage: new S3Images(config), dryRun: process.argv.includes('--dry-run') }));
  } catch (error) {
    console.error(`Migration stopped (${error.name || 'Error'}). Check configuration, AWS permissions, and local files, then rerun. Previously completed images are safe.`);
    process.exitCode = 1;
  } finally { db?.close(); }
}
