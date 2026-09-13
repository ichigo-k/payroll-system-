/**
 * Feature: passwordless-auth-portal, Property 3: Generated OTPs are always 6-digit numeric strings
 *
 * Validates: Requirements 2.1
 */

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { generateOtp } from './otp'

describe('Property 3: generateOtp always returns a 6-digit numeric string', () => {
  it('should always match /^\\d{6}$/ regardless of when it is called', () => {
    // Feature: passwordless-auth-portal, Property 3: Generated OTPs are always 6-digit numeric strings
    // Validates: Requirements 2.1
    fc.assert(
      fc.property(
        // Use a nat() seed to drive multiple independent invocations
        fc.nat({ max: 99 }),
        (_seed) => {
          const otp = generateOtp()
          // Must be exactly 6 decimal digit characters
          expect(otp).toMatch(/^\d{6}$/)
          // Must be exactly 6 characters long
          expect(otp).toHaveLength(6)
          // Numeric value must be in [0, 999999]
          const numValue = Number.parseInt(otp, 10)
          expect(numValue).toBeGreaterThanOrEqual(0)
          expect(numValue).toBeLessThan(1_000_000)
        },
      ),
      { numRuns: 100 },
    )
  })
})
