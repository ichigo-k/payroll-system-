'use server'

import { revalidatePath } from 'next/cache'
import { type ActionResult, requireRole } from '@/lib/access'
import * as users from '@/lib/users'

const DENIED: ActionResult = { ok: false, message: 'Only administrators can manage users.' }

function refresh() {
  revalidatePath('/portal/financial/users')
  revalidatePath('/portal/financial/employees')
}

export async function inviteUserAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await requireRole(['ADMIN'])
  if (!actor) return DENIED
  const result = await users.inviteUser(actor, Object.fromEntries(formData))
  if (result.ok) refresh()
  return result
}

export async function changeRoleAction(userId: string, role: string): Promise<ActionResult> {
  const actor = await requireRole(['ADMIN'])
  if (!actor) return DENIED
  const result = await users.changeUserRole(actor, userId, role)
  if (result.ok) refresh()
  return result
}

export async function setStatusAction(userId: string, status: 'active' | 'inactive'): Promise<ActionResult> {
  const actor = await requireRole(['ADMIN'])
  if (!actor) return DENIED
  const result = await users.setUserStatus(actor, userId, status)
  if (result.ok) refresh()
  return result
}

export async function resendInviteAction(userId: string): Promise<ActionResult> {
  const actor = await requireRole(['ADMIN'])
  if (!actor) return DENIED
  return users.resendInvite(actor, userId)
}

export async function linkEmployeeAction(userId: string, employeeId: string): Promise<ActionResult> {
  const actor = await requireRole(['ADMIN'])
  if (!actor) return DENIED
  const result = await users.linkEmployee(actor, userId, employeeId)
  if (result.ok) refresh()
  return result
}

export async function unlinkEmployeeAction(userId: string): Promise<ActionResult> {
  const actor = await requireRole(['ADMIN'])
  if (!actor) return DENIED
  const result = await users.unlinkEmployee(actor, userId)
  if (result.ok) refresh()
  return result
}

export async function sendSelfServiceWelcomeAction(employeeId: string): Promise<ActionResult> {
  const actor = await requireRole(['ADMIN'])
  if (!actor) return DENIED
  return users.sendSelfServiceWelcome(actor, employeeId)
}

export async function blockSelfServiceAction(employeeId: string): Promise<ActionResult> {
  const actor = await requireRole(['ADMIN'])
  if (!actor) return DENIED
  const result = await users.blockSelfService(actor, employeeId)
  if (result.ok) refresh()
  return result
}

export async function unblockSelfServiceAction(employeeId: string): Promise<ActionResult> {
  const actor = await requireRole(['ADMIN'])
  if (!actor) return DENIED
  const result = await users.unblockSelfService(actor, employeeId)
  if (result.ok) refresh()
  return result
}

export async function grantWorkspaceRoleAction(employeeId: string, role: string): Promise<ActionResult> {
  const actor = await requireRole(['ADMIN'])
  if (!actor) return DENIED
  const result = await users.grantWorkspaceRole(actor, employeeId, role)
  if (result.ok) refresh()
  return result
}

export async function removeWorkspaceAccessAction(employeeId: string): Promise<ActionResult> {
  const actor = await requireRole(['ADMIN'])
  if (!actor) return DENIED
  const result = await users.removeWorkspaceAccess(actor, employeeId)
  if (result.ok) refresh()
  return result
}
