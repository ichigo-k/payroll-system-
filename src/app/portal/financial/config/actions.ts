'use server'

import { revalidatePath } from 'next/cache'
import { audit, diff, requirePermission } from '@/lib/access'
import { prisma } from '@/lib/prisma'

export type SettingsState = { status: 'idle' | 'success' | 'error'; message?: string }

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim()

export async function saveCompanySettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const actor = await requirePermission('settings.manage')
  if (!actor) return { status: 'error', message: 'Only administrators can change company settings.' }

  const companyName = text(formData, 'companyName')
  if (!companyName) return { status: 'error', message: 'Enter the company name.' }
  const requiredApprovals = Number(formData.get('requiredApprovals'))
  if (!Number.isInteger(requiredApprovals) || requiredApprovals < 1 || requiredApprovals > 5) return { status: 'error', message: 'Required approvals must be between 1 and 5.' }

  const approvers = await prisma.user.count({ where: { role: 'APPROVER', status: 'active' } })
  if (requiredApprovals > Math.max(1, approvers)) {
    return { status: 'error', message: `You have ${approvers} active ${approvers === 1 ? 'approver' : 'approvers'}. Add more before requiring ${requiredApprovals} approvals.` }
  }

  const next = {
    companyName,
    companyRegistration: text(formData, 'companyRegistration') || null,
    taxId: text(formData, 'taxId') || null,
    employerSsnitNumber: text(formData, 'employerSsnitNumber') || null,
    address: text(formData, 'address') || null,
    bankName: text(formData, 'bankName') || null,
    bankBranch: text(formData, 'bankBranch') || null,
    bankAccountName: text(formData, 'bankAccountName') || null,
    bankAccountNumber: text(formData, 'bankAccountNumber') || null,
    requiredApprovals,
  }

  const existing = await prisma.systemConfig.findFirst({ where: { isActive: true } })
  if (existing) {
    const changes = diff(existing as unknown as Record<string, unknown>, next)
    if (Object.keys(changes).length === 0) return { status: 'success', message: 'No changes to save.' }
    await prisma.systemConfig.update({ where: { id: existing.id }, data: next })
    await audit({ userId: actor.id, action: 'UPDATE', entityType: 'SystemConfig', entityId: existing.id, changes })
  } else {
    const created = await prisma.systemConfig.create({ data: next })
    await audit({ userId: actor.id, action: 'CREATE', entityType: 'SystemConfig', entityId: created.id, changes: { companyName } })
  }

  revalidatePath('/portal/financial/config')
  return { status: 'success', message: 'Company settings saved.' }
}

