import {mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openDatabase} from '../src/database.mjs';
import {seriesType} from '../src/metron.mjs';

// Offline backfill: use retained detail responses, even when their lookup TTL expired.
export function planSeriesTypeBackfill(db) {
  const types=new Map();
  for(const row of db.prepare("SELECT payload FROM cache WHERE key LIKE 'issue/%'").all()){
    try{const raw=JSON.parse(row.payload),type=seriesType(raw.series?.series_type);if(type)types.set(raw.series.id,type);}catch{}
  }
  const issues=db.prepare('SELECT id,metadata FROM issues').all();
  const wants=db.prepare('SELECT issue_id,edition_key,metadata FROM wants').all();
  for(const row of [...issues,...wants]){const metadata=JSON.parse(row.metadata),type=seriesType(metadata.series?.series_type);if(type&&!types.has(metadata.series.id))types.set(metadata.series.id,type);}
  const missing=new Set();
  function changes(rows){return rows.flatMap(row=>{
    const metadata=JSON.parse(row.metadata);
    if(seriesType(metadata.series?.series_type))return [];
    const type=types.get(metadata.series?.id);
    if(!type){missing.add(metadata.series?.id);return [];}
    return [{...row,originalMetadata:row.metadata,metadata:JSON.stringify({...metadata,series:{...metadata.series,series_type:type}})}];
  });}
  const issueUpdates=changes(issues),wantUpdates=changes(wants);
  return {issueUpdates,wantUpdates,missingSeries:[...missing]};
}
export function applySeriesTypeBackfill(db,plan) {
  if(plan.missingSeries.length)throw Error('Series types are missing from the retained cache. No records were changed.');
  db.exec('BEGIN IMMEDIATE');
  try{
    const issue=db.prepare('UPDATE issues SET metadata=? WHERE id=? AND metadata=?');
    const want=db.prepare('UPDATE wants SET metadata=? WHERE issue_id=? AND edition_key=? AND metadata=?');
    for(const row of plan.issueUpdates)if(issue.run(row.metadata,row.id,row.originalMetadata).changes!==1)throw Error('A saved issue changed during backfill; no updates committed.');
    for(const row of plan.wantUpdates)if(want.run(row.metadata,row.issue_id,row.edition_key,row.originalMetadata).changes!==1)throw Error('A want changed during backfill; no updates committed.');
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let db;
  try{
    if(process.argv.slice(2).some(arg=>arg!=='--dry-run'))throw Error('Usage: backfill-series-types.mjs [--dry-run]');
    const directory=resolve(process.env.DATA_DIR||'./data');db=openDatabase(directory);
    const plan=planSeriesTypeBackfill(db);
    console.log(JSON.stringify({issues:plan.issueUpdates.length,wanted_covers:plan.wantUpdates.length,missing_series:plan.missingSeries}));
    if(!process.argv.includes('--dry-run')){
      if(plan.missingSeries.length)throw Error('Missing cached types; no data changed.');
      if(plan.issueUpdates.length||plan.wantUpdates.length){
        const backups=join(directory,'backups');mkdirSync(backups,{recursive:true});
        const backup=join(backups,`before-series-types-${Date.now()}.sqlite`);
        db.exec(`VACUUM INTO '${backup.replaceAll("'","''")}'`);
        console.log('Saved database backup.');applySeriesTypeBackfill(db,plan);console.log('Series type backfill complete.');
      }else console.log('No backfill needed.');
    }
  }catch(error){console.error(error.message);process.exitCode=1;}finally{db?.close();}
}
