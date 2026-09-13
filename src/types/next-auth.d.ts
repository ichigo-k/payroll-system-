// src/types/next-auth.d.ts
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      firstName: string | null
      lastName: string | null
      /** Linked employee record, if this login also belongs to someone on payroll */
      employeeId: string | null
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string
    role: string
    firstName: string | null
    lastName: string | null
    employeeId?: string | null
    accessCheckedAt?: number
  }
}
