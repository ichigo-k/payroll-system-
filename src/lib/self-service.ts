import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/access'
import { prisma } from '@/lib/prisma'

/**
 * Self-service data access. Employees only ever see their own lines, and only from runs that
 * have been paid (payslips are published when a preparer marks the run as paid).
 */

export async function requireSelfServiceEmployee() {
  const user = await currentUser()
  if (!user) redirect('/login')
  if (!user.employeeId) return { user, employee: null }
  const employee = await prisma.employee.findUnique({ where: { id: user.employeeId } })
  return { user, employee }
}

export const PUBLISHED = { payrollRun: { status: 'PAID' as const } }

export function maskAccount(value: string | null) {
  return value ? `•••• ${value.slice(-4)}` : 'Not on file'
}
