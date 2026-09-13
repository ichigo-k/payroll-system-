'use server'

import { revalidatePath } from 'next/cache'
import { type ActionResult, requirePermission } from '@/lib/access'
import * as lifecycle from '@/lib/employee-lifecycle'

const denied: ActionResult = { ok: false, message: 'Only payroll preparers can change employment records.' }

function refresh(employeeId: string) {
  revalidatePath('/portal/financial/employees')
  revalidatePath(`/portal/financial/employees/${employeeId}`)
  revalidatePath('/portal/financial/salary')
  revalidatePath('/portal/financial')
}

export async function offboardEmployeeAction(employeeId: string, input: { endDate: string; reason: string; note?: string }) {
  const actor = await requirePermission('employees.edit')
  if (!actor) return denied
  const result = await lifecycle.offboardEmployee(actor, employeeId, input)
  if (result.ok) refresh(employeeId)
  return result
}

export async function reinstateEmployeeAction(employeeId: string, input: { note?: string } = {}) {
  const actor = await requirePermission('employees.edit')
  if (!actor) return denied
  const result = await lifecycle.reinstateEmployee(actor, employeeId, input)
  if (result.ok) refresh(employeeId)
  return result
}

export async function deleteEmployeeAction(employeeId: string) {
  const actor = await requirePermission('employees.edit')
  if (!actor) return denied
  const result = await lifecycle.deleteEmployee(actor, employeeId)
  if (result.ok) refresh(employeeId)
  return result
}
