// src/app/api/auth/cleanup-otp/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/auth/cleanup-otp
 *
 * Deletes OtpToken records where expiresAt is more than 24 hours in the past.
 * Only removes stale (expired or consumed) records — never touches active tokens.
 * Intended to be called by a scheduled job or cron trigger.
 *
 * Requirements: 10.1, 10.2, 10.3
 */
export async function POST() {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const { count } = await prisma.otpToken.deleteMany({
      where: {
        expiresAt: { lt: cutoff },
      },
    })

    return NextResponse.json({ deleted: count })
  } catch (err) {
    console.error('[cleanup-otp] Error:', (err as Error).message)
    return NextResponse.json({ message: 'Cleanup failed. Please try again.' }, { status: 500 })
  }
}
