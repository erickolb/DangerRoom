export class AppError extends Error {
  constructor(status, message, retryAfter) { super(message); this.status = status; this.retryAfter = retryAfter; }
}
export function positiveId(value, label = 'Issue ID') {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new AppError(400, `${label} must be a positive integer.`);
  return Number(value);
}
