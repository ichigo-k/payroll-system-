'use server'

import { revalidatePath } from 'next/cache'
import { type ActionResult, requirePermission } from '@/lib/access'
import type { Permission } from '@/lib/permissions'
import * as runs from '@/lib/payroll-runs'

const denied = (what: string): ActionResult => ({ ok: false, message: `You don’t have permission to ${what}.` })

function refresh(runId?: string) {
  revalidatePath('/portal/financial/payroll')
  revalidatePath('/portal/financial/approvals')
  revalidatePath('/portal/financial')
  if (runId) revalidatePath(`/portal/financial/payroll/${runId}`)
}

async function withPermission<T extends ActionResult>(permission: Permission, what: string, fn: (actor: NonNullable<Awaited<ReturnType<typeof requirePermission>>>) => Promise<T>) {
  const actor = await requirePermission(permission)
  if (!actor) return denied(what)
  return fn(actor)
}

export async function createRunAction(input: { year: number; month: number; notes?: string }) {
  const result = await withPermission('payroll.prepare', 'prepare payroll', (actor) => runs.createRun(actor, input))
  if (result.ok) refresh()
  return result as ActionResult & { id?: string }
}

export async function recalculateRunAction(runId: string) {
  const result = await withPermission('payroll.prepare', 'prepare payroll', (actor) => runs.calculateRun(actor, runId))
  if (result.ok) refresh(runId)
  return result
}

export async function submitRunAction(runId: string, input: { reviewerId?: string; note?: string }) {
  const result = await withPermission('payroll.prepare', 'submit payroll', (actor) => runs.submitRun(actor, runId, input))
  if (result.ok) refresh(runId)
  return result
}

export async function recallRunAction(runId: string) {
  const result = await withPermission('payroll.prepare', 'recall payroll', (actor) => runs.recallRun(actor, runId))
  if (result.ok) refresh(runId)
  return result
}

export async function approveRunAction(runId: string, comment?: string) {
  const result = await withPermission('payroll.approve', 'approve payroll', (actor) => runs.decideRun(actor, runId, 'APPROVED', comment))
  if (result.ok) refresh(runId)
  return result
}

export async function requestChangesAction(runId: string, comment: string) {
  const result = await withPermission('payroll.approve', 'review payroll', (actor) => runs.decideRun(actor, runId, 'CHANGES_REQUESTED', comment))
  if (result.ok) refresh(runId)
  return result
}

export async function markPaidAction(runId: string) {
  const result = await withPermission('payroll.prepare', 'mark payroll as paid', (actor) => runs.markRunPaid(actor, runId))
  if (result.ok) refresh(runId)
  return result
}

export async function deleteDraftAction(runId: string) {
  const result = await withPermission('payroll.prepare', 'delete payroll runs', (actor) => runs.deleteDraftRun(actor, runId))
  if (result.ok) refresh()
  return result
}

export async function commentAction(runId: string, body: string) {
  const result = await withPermission('payroll.comment', 'comment on payroll', (actor) => runs.commentOnRun(actor, runId, body))
  if (result.ok) revalidatePath(`/portal/financial/payroll/${runId}`)
  return result
}

export async function excludeEmployeeAction(runId: string, employeeId: string, reason: string) {
  const result = await withPermission('payroll.prepare', 'change payroll runs', (actor) => runs.excludeFromRun(actor, runId, employeeId, reason))
  if (result.ok) refresh(runId)
  return result
}

export async function includeEmployeeAction(runId: string, employeeId: string) {
  const result = await withPermission('payroll.prepare', 'change payroll runs', (actor) => runs.includeInRun(actor, runId, employeeId))
  if (result.ok) refresh(runId)
  return result
}
