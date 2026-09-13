import { describe, expect, it } from 'vitest'
import { generateOtp } from './otp'

describe('generateOtp', () => {
  it('should return a 6-digit numeric string', () => {
    const otp = generateOtp()
    expect(otp).toMatch(/^\d{6}$/)
  })

  it('should pad with leading zeros when necessary', () => {
    // Generate multiple OTPs to increase chance of getting a small number
    const otps = Array.from({ length: 100 }, () => generateOtp())

    // All should be exactly 6 digits
    otps.forEach((otp) => {
      expect(otp).toHaveLength(6)
      expect(otp).toMatch(/^\d{6}$/)
    })
  })

  it('should generate different values on subsequent calls', () => {
    const otp1 = generateOtp()
    const otp2 = generateOtp()
    const otp3 = generateOtp()

    // While theoretically they could be the same, it's extremely unlikely
    const uniqueValues = new Set([otp1, otp2, otp3])
    expect(uniqueValues.size).toBeGreaterThan(1)
  })

  it('should never exceed 6 digits', () => {
    // Generate many OTPs to ensure none exceed 6 digits
    const otps = Array.from({ length: 1000 }, () => generateOtp())

    otps.forEach((otp) => {
      expect(otp.length).toBe(6)
      const numValue = Number.parseInt(otp, 10)
      expect(numValue).toBeGreaterThanOrEqual(0)
      expect(numValue).toBeLessThan(1_000_000)
    })
  })
})
