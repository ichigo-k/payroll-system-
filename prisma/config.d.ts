// Type declarations for @prisma/config (Prisma 7)
declare module '@prisma/config' {
  export function defineConfig<T>(config: T): T
  export function env(key: string): string
}
