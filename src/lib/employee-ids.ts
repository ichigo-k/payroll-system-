import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type Db = Prisma.TransactionClient | typeof prisma

const PREFIX = 'EMP-'
const WIDTH = 4

export function formatEmployeeId(n: number) {
  return `${PREFIX}${String(n).padStart(WIDTH, '0')}`
}

/** Highest trailing number across existing IDs (EMP001, EMP-0042, E17 all count), plus one. */
export function nextEmployeeNumber(existingIds: string[]) {
  let max = 0
  for (const id of existingIds) {
    const match = /(\d+)\s*$/.exec(id)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return max + 1
}

/** The next `count` employee IDs, in order. Callers retry on a unique-constraint clash. */
export async function generateEmployeeIds(count: number, db: Db = prisma) {
  const rows = await db.employee.findMany({ select: { employeeId: true } })
  const start = nextEmployeeNumber(rows.map((r) => r.employeeId))
  return Array.from({ length: count }, (_, i) => formatEmployeeId(start + i))
}
