import test from 'node:test';import assert from 'node:assert/strict';
import {localToday,shiftMonth} from '../public/reading-log.js';
import {validateLogDate} from '../src/reading-log.mjs';
test('reading log dates use local calendar components and month navigation crosses years',()=>{
  const date=new Date(2026,9,27,0,1);assert.equal(localToday(date),'2026-10-27');
  assert.equal(shiftMonth('2026-01',-1),'2025-12');assert.equal(shiftMonth('2026-12',1),'2027-01');
  assert.equal(shiftMonth('2026-03',-1),'2026-02');assert.equal(validateLogDate('2024-02-29'),'2024-02-29');
});

test('inline reading calendar includes all days and correct weekday padding across month boundaries',async()=>{
  const {calendarDays}=await import('../public/reading-log.js');
  const leap=calendarDays('2024-02');assert.equal(leap.filter(Boolean).length,29);assert.equal(leap[0],null);assert.equal(leap[4],'2024-02-01');assert.equal(leap.at(-1),'2024-02-29');
  const october=calendarDays('2026-10');assert.equal(october.filter(Boolean).length,31);assert.equal(october[4],'2026-10-01');
  assert.equal(calendarDays('2026-02').filter(Boolean).length,28);assert.equal(calendarDays('2026-02')[0],'2026-02-01');
});
