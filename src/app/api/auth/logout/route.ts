// src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server'
import { auth, signOut } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/auth/logout
 *
 * Writes a LOGOUT AuditLog entry for the current session user,
 * then calls NextAuth signOut to clear the session cookie.
 *
 * Requirements: 6.6, 6.8
 */
export async function POST() {
  try {
    const session = await auth()

    if (session?.user?.id) {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'LOGOUT',
          entityType: 'User',
          entityId: session.user.id,
        },
      })
    }

    await signOut()

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[logout] Error:', (err as Error).message)
    return NextResponse.json({ message: 'Logout failed. Please try again.' }, { status: 500 })
  }
}
