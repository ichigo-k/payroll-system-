import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type Db = Prisma.TransactionClient | typeof prisma

export const DEFAULT_DEPARTMENT = 'General'

/** Collapses whitespace so "  Human   Resources " and "Human Resources" are the same department. */
export function cleanDepartmentName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

/** Saved departments plus any names already used on employee records (older data), sorted. */
export async function listDepartments(): Promise<string[]> {
  const [departments, used] = await Promise.all([
    prisma.department.findMany({ select: { name: true } }),
    prisma.employee.findMany({ distinct: ['department'], select: { department: true } }),
  ])
  const byKey = new Map<string, string>()
  for (const name of [...departments.map((d) => d.name), ...used.map((e) => e.department), DEFAULT_DEPARTMENT]) {
    const clean = cleanDepartmentName(name)
    if (clean && !byKey.has(clean.toLowerCase())) byKey.set(clean.toLowerCase(), clean)
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b))
}

/**
 * Returns the saved spelling of a department, creating it if it's new.
 * Matching is case-insensitive, so "finance" reuses an existing "Finance".
 */
export async function ensureDepartment(rawName: string, db: Db = prisma): Promise<string> {
  const name = cleanDepartmentName(rawName) || DEFAULT_DEPARTMENT
  const existing = await db.department.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { name: true } })
  if (existing) return existing.name
  const created = await db.department.upsert({ where: { name }, create: { name }, update: {}, select: { name: true } })
  return created.name
}
