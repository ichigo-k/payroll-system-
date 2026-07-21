// src/types/next-auth.d.ts
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id:        string
      role:      string
      firstName: string | null
      lastName:  string | null
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId:    string
    role:      string
    firstName: string | null
    lastName:  string | null
  }
}
