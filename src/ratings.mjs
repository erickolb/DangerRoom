import { AppError } from './errors.mjs';

export function validateRating(value) {
  if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0.5 || value > 5 || !Number.isInteger(value * 2))) {
    throw new AppError(400, 'Choose a rating from 0.5 to 5 stars in half-star steps, or clear it.');
  }
}
