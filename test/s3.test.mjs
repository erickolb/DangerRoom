import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/database.mjs';
import { Covers } from '../src/covers.mjs';
import { digest, storageConfig, S3Images } from '../src/s3-images.mjs';
import { migrateCovers } from '../scripts/migrate-covers-to-s3.mjs';
const png = Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
const name = `${digest(png)}.png`;
const config = { mode: 's3', bucket: 'test-bucket', prefix: 'covers', region: 'us-east-1' };
function fakeS3() {
  const objects = new Map(), commands = [];
  return { objects, commands, async send(command) {
    commands.push(command); const key = `${command.input.Bucket}/${command.input.Key}`;
    if (command.constructor.name === 'PutObjectCommand') { objects.set(key, Buffer.from(command.input.Body)); return {}; }
    if (!objects.has(key)) throw Error('Missing S3 image');
    return { ContentLength: objects.get(key).length, Body: (async function* () { yield objects.get(key); })() };
  } };
}
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'dangerroom-s3-'));
  const db = openDatabase(directory);
  t.after(async () => { db.close(); await rm(directory, { recursive: true, force: true }); });
  await mkdir(join(directory, 'covers'));
  return { directory, db };
}
test('S3 writes verified private objects and preserves routing across storage-mode changes', async t => {
  const { directory, db } = await fixture(t), client = fakeS3();
  const covers = new Covers(directory, async () => new Response(png), { db, config, s3Client: client });
  assert.equal(await covers.save('https://static.metron.cloud/media/a.png'), name);
  assert.equal(client.commands[0].input.ACL, undefined);
  assert.equal(client.commands[0].input.ContentType, 'image/png');
  assert.ok(client.commands[0].input.ChecksumSHA256);
  assert.deepEqual(await covers.read(name), png);
  const local = new Covers(directory, undefined, { db, config: { mode: 'local' }, s3Client: client });
  assert.deepEqual(await local.read(name), png);
  client.objects.clear();
  await assert.rejects(local.read(name), /temporarily unavailable/);
});
test('migration is resumable, retains files, and updates shared filenames only after verification', async t => {
  const { directory, db } = await fixture(t), client = fakeS3(), storage = new S3Images(config, client);
  await writeFile(join(directory, 'covers', name), png);
  const options = { directory, db, storage, log() {} };
  assert.equal((await migrateCovers({ ...options, dryRun: true })).copied, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cover_objects').get().n, 0);
  const failing = { async upload() { throw Error('Upload failed'); } };
  await assert.rejects(migrateCovers({ ...options, storage: failing }), /Upload failed/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cover_objects').get().n, 0);
  assert.equal((await migrateCovers(options)).copied, 1);
  assert.equal((await migrateCovers(options)).skipped, 1);
  assert.deepEqual(await readFile(join(directory, 'covers', name)), png);
  const row = db.prepare('SELECT * FROM cover_objects').get();
  assert.equal(row.object_key, `covers/${name}`);
  const covers = new Covers(directory, undefined, { db, config, s3Client: client });
  assert.deepEqual(await covers.read(name), png);
});
test('empty migration succeeds; corrupt upload is never recorded; local images work in S3 mode', async t => {
  const { directory, db } = await fixture(t), client = fakeS3(), storage = new S3Images(config, client);
  assert.equal((await migrateCovers({ directory, db, storage })).total, 0);
  await writeFile(join(directory, 'covers', name), png);
  const covers = new Covers(directory, undefined, { db, config, s3Client: client });
  assert.deepEqual(await covers.read(name), png);
  await assert.rejects(storage.upload(name, Buffer.from('bad')), /checksum/);
  const broken = { async send(command) {
    if (command.constructor.name === 'PutObjectCommand') return {};
    return { Body: (async function* () { yield Buffer.from('corrupt'); })() };
  } };
  await assert.rejects(migrateCovers({ directory, db, storage: new S3Images(config, broken) }), /verification/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cover_objects').get().n, 0);
});
test('configuration rejects invalid storage mode and incomplete S3 settings', () => {
  assert.equal(storageConfig({}).mode, 'local');
  assert.throws(() => storageConfig({ IMAGE_STORAGE: 'other' }));
  assert.throws(() => storageConfig({ IMAGE_STORAGE: 's3' }));
  assert.throws(() => storageConfig({ S3_PREFIX: '../covers' }));
  assert.equal(storageConfig({ S3_PREFIX: '/covers/' }).prefix, 'covers');
});

