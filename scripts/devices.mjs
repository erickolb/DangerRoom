import { resolve } from 'node:path';
import { openDatabase } from '../src/database.mjs';
import { Devices } from '../src/devices.mjs';
const db = openDatabase(resolve(process.env.DATA_DIR || 'data'));
try {
  const devices = new Devices(db), [command, value] = process.argv.slice(2);
  if (command === 'add') console.log(JSON.stringify(devices.add(value), null, 2));
  else if (command === 'list') console.table(devices.list());
  else if (command === 'revoke' && value) console.log(devices.revoke(value) ? 'Device revoked.' : 'Device not found.');
  else { console.error('Usage: pnpm devices add "Label" | list | revoke DEVICE_ID'); process.exitCode = 1; }
} finally { db.close(); }
