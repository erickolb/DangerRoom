import test from 'node:test';import assert from 'node:assert/strict';
import {localToday,shiftMonth} from '../public/reading-log.js';
import {validateLogDate} from '../src/reading-log.mjs';
test('reading log dates use local calendar components and month navigation crosses years',()=>{
  const date=new Date(2026,9,27,0,1);assert.equal(localToday(date),'2026-10-27');
  assert.equal(shiftMonth('2026-01',-1),'2025-12');assert.equal(shiftMonth('2026-12',1),'2027-01');
  assert.equal(shiftMonth('2026-03',-1),'2026-02');assert.equal(validateLogDate('2024-02-29'),'2024-02-29');
});
