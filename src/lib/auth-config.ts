// src/lib/auth-config.ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { getUserAccess } from '@/lib/user-access'
import { normalizeEmail } from '@/lib/user-rules'
import { resolveAccountAfterCode } from '@/lib/sign-in'

// How often a session re-reads role and status from the database.
const ACCESS_REFRESH_MS = 60_000

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        otp:   { label: 'OTP',   type: 'text'  },
      },
      async authorize(credentials) {
        const { otp } = credentials as { email: string; otp: string }
        const email = normalizeEmail(String((credentials as { email?: string }).email ?? ''))
        if (!email || !otp) return null

        const token = await prisma.otpToken.findFirst({
          where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
        })
        if (!token) return null

        const valid = await bcrypt.compare(otp, token.tokenHash)
        if (!valid) {
          await prisma.otpToken.update({
            where: { id: token.id },
            data: {
              attempts: { increment: 1 },
              consumedAt: token.attempts + 1 >= 5 ? new Date() : undefined,
            },
          })
          return null
        }

        // Mark token consumed first — outside transaction so it always commits
        await prisma.otpToken.update({
          where: { id: token.id },
          data: { consumedAt: new Date() },
        })

        // Existing active user, or someone on payroll signing in for the first time (login created here).
        // Deactivated accounts are refused, even with a code issued before deactivation.
        const user = await resolveAccountAfterCode(email)
        if (!user) return null

        // Update lastLogin separately — failure here should not un-consume the token
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        }).catch((err) => {
          console.error('[auth] lastLogin update failed (non-fatal):', err)
        })

        // Write LOGIN audit log
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'LOGIN',
            entityType: 'User',
            entityId: user.id,
          },
        })

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        }
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId    = user.id as string
        token.role      = (user as { role: string }).role
        token.firstName = (user as { firstName: string | null }).firstName
        token.lastName  = (user as { lastName: string | null }).lastName
        token.accessCheckedAt = 0
      }

      // Re-read role and status so role changes and deactivation apply without signing out
      const checkedAt = typeof token.accessCheckedAt === 'number' ? token.accessCheckedAt : 0
      if (typeof token.userId === 'string' && Date.now() - checkedAt > ACCESS_REFRESH_MS) {
        const access = await getUserAccess(token.userId)
        if (!access || access.status !== 'active') return null
        token.role = access.role
        token.firstName = access.firstName
        token.lastName = access.lastName
        token.employeeId = access.employeeId
        token.accessCheckedAt = Date.now()
      }
      return token
    },
    async session({ session, token }) {
      session.user.id         = token.userId as string
      session.user.role       = token.role as string
      session.user.firstName  = token.firstName as string
      session.user.lastName   = token.lastName as string
      session.user.employeeId = (token.employeeId as string | null | undefined) ?? null
      return session
    },
  },
})
