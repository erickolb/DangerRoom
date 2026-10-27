import { AppError } from './errors.mjs';
export function validateLogDate(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'0001-01-01')throw new AppError(400,'Choose a valid reading date.');
  const parsed=new Date(`${value}T12:00:00Z`);
  if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)throw new AppError(400,'Choose a valid reading date.');
  return value;
}
export function validateMonth(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}$/.test(value))throw new AppError(400,'Choose a valid reading-log month.');
  validateLogDate(`${value}-01`);return value;
}
