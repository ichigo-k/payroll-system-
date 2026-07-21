import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { emailTransport } from '@/lib/email'
import { generateOtp } from '@/lib/otp'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const OTP_EXPIRY_MINUTES = 10
const PENDING_EMAIL_COOKIE = 'otp-pending-email'
const GENERIC_MSG = 'If that email is registered, you will receive a code shortly.'

const schema = z.object({ email: z.string().email() })

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid email format.' }, { status: 400 })
  }

  const { email } = parsed.data

  try {
    // Always set the cookie to the submitted email so the verify page
    // reflects what the user just typed, not a stale previous session.
    const cookieStore = await cookies()
    cookieStore.set(PENDING_EMAIL_COOKIE, email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: OTP_EXPIRY_MINUTES * 60,
      path: '/',
    })

    // Look up user — always return generic message regardless of outcome
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || user.status !== 'active') {
      return NextResponse.json({ message: GENERIC_MSG })
    }

    // Invalidate ALL existing unconsumed tokens for this email
    const invalidated = await prisma.otpToken.updateMany({
      where: { email, consumedAt: null },
      data: { consumedAt: new Date() },
    })
    if (invalidated.count > 0) {
      console.log(`[request-otp] Invalidated ${invalidated.count} existing token(s) for ${email}`)
    }

    // Generate 6-digit OTP
    const otp = generateOtp()
    const tokenHash = await bcrypt.hash(otp, 10)
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

    await prisma.otpToken.create({
      data: { email, tokenHash, expiresAt },
    })

    try {
      await emailTransport.sendOtp(email, otp, OTP_EXPIRY_MINUTES)
    } catch (err) {
      console.error('[request-otp] Email delivery failed:', err)
      return NextResponse.json(
        { message: 'Failed to send code. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: GENERIC_MSG })
  } catch (err) {
    console.error('[request-otp] Database error:', (err as Error).message)
    return NextResponse.json(
      { message: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
