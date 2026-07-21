// src/lib/auth-config.ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        otp:   { label: 'OTP',   type: 'text'  },
      },
      async authorize(credentials) {
        const { email, otp } = credentials as { email: string; otp: string }

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

        // Update lastLogin separately — failure here should not un-consume the token
        await prisma.user.update({
          where: { email },
          data: { lastLogin: new Date() },
        }).catch((err) => {
          console.error('[auth] lastLogin update failed (non-fatal):', err)
        })

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null

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
        token.userId    = user.id
        token.role      = (user as any).role
        token.firstName = (user as any).firstName
        token.lastName  = (user as any).lastName
      }
      return token
    },
    async session({ session, token }) {
      session.user.id        = token.userId as string
      session.user.role      = token.role as string
      session.user.firstName = token.firstName as string
      session.user.lastName  = token.lastName as string
      return session
    },
  },
})
