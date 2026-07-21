import { randomInt } from 'crypto'

/**
 * Generates a cryptographically random 6-digit numeric OTP string.
 * Always returns exactly 6 digits (zero-padded if necessary).
 */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}
