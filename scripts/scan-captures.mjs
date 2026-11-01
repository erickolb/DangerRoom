import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../src/database.mjs';
import { ScanCaptures } from '../src/scan-captures.mjs';

export function exportCaptures(captures, directory) {
  // One SQLite snapshot keeps image/metadata pairs consistent while new scans arrive.
  captures.db.exec('BEGIN');
  let snapshot=true;
  try {
    const rows=captures.list();
    mkdirSync(directory,{mode:0o700});
    const manifest=rows.map(row=>{
      const filename=`scan-${row.id}-${row.cover_hash}.png`;
      writeFileSync(join(directory,filename),captures.image(row.id),{flag:'wx',mode:0o600});
      return {...row,filename};
    });
    writeFileSync(join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});
    captures.db.exec('COMMIT');
    snapshot=false;
    return manifest;
  } catch(error) { if(snapshot)captures.db.exec('ROLLBACK');throw error; }
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  let db;
  try {
    const command=process.argv[2] || 'list';
    if (!['list','export'].includes(command) || (command==='export' && !process.argv[3])) throw Error('Usage: node scripts/scan-captures.mjs list | export NEW_DIRECTORY');
    const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
    db=openDatabase(resolve(process.env.DATA_DIR || join(root,'data')));
    const captures=new ScanCaptures(db);
    const rows=command==='export'?exportCaptures(captures,resolve(process.argv[3])):captures.list();
    console.log(JSON.stringify(rows,null,2));
  } catch(error) { console.error(error.message);process.exitCode=1; }
  finally { db?.close(); }
}
