'use server'

import { revalidatePath } from 'next/cache'
import { type ActionResult, audit, diff, requirePermission } from '@/lib/access'
import { notify, userIdsWithRoles } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'

export type TaxActionState = { status: 'idle' | 'success' | 'error'; message?: string }

const period = (year: number, month: number) => (month === 0 ? `${year} (whole year)` : new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' }))

function isBracketList(value: unknown): value is { min: number; max: number; rate: number }[] {
  return (
    Array.isArray(value) &&
    value.every(
      (b) =>
        b && typeof b === 'object' && [b.min, b.max, b.rate].every((n) => typeof n === 'number' && Number.isFinite(n)) && b.min >= 0 && b.max > b.min && b.rate >= 0 && b.rate <= 1,
    )
  )
}

function refresh() {
  revalidatePath('/portal/financial/tax')
  revalidatePath('/portal/financial/approvals')
  revalidatePath('/portal/financial')
}

/**
 * Preparers draft tax settings. New configurations start inactive; changes to an approved
 * configuration are stored as a proposal. Either way an approver must activate them.
 */
export async function saveTaxConfiguration(_prev: TaxActionState, formData: FormData): Promise<TaxActionState> {
  const actor = await requirePermission('tax.draft')
  if (!actor) return { status: 'error', message: 'Only payroll preparers can draft tax configuration.' }

  const year = Number(formData.get('year'))
  const month = Number(formData.get('month') ?? 0)
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 0 || month > 12) {
    return { status: 'error', message: 'Enter a valid year and month.' }
  }

  const payeBrackets = String(formData.get('payeBrackets') ?? '[]').trim() || '[]'
  let parsed: unknown
  try {
    parsed = JSON.parse(payeBrackets)
  } catch {
    return { status: 'error', message: 'PAYE brackets could not be read.' }
  }
  if (!isBracketList(parsed)) {
    return { status: 'error', message: 'Each PAYE bracket needs a lower bound, an upper bound above it, and a rate between 0% and 100%.' }
  }

  const values = {
    payeBrackets,
    payeThreshold: String(formData.get('payeThreshold') || 0),
    ssnitEmployeeRate: String(formData.get('ssnitEmployeeRate') || 5.5),
    ssnitEmployerRate: String(formData.get('ssnitEmployerRate') || 13),
    personalRelief: String(formData.get('personalRelief') || 0),
    spouseExemption: String(formData.get('spouseExemption') || 0),
    childExemption: String(formData.get('childExemption') || 0),
    isActive: formData.get('isActive') === 'on',
  }

  const existing = await prisma.taxConfiguration.findUnique({ where: { year_month: { year, month } } })
  const approvers = await userIdsWithRoles(['APPROVER'], [actor.id])
  const email = { subject: `Tax configuration for ${period(year, month)} needs activation`, heading: 'Tax configuration waiting for you', actionLabel: 'Review tax configuration' }
  const href = '/portal/financial/tax'

  if (!existing) {
    const created = await prisma.taxConfiguration.create({ data: { year, month, ...values, isActive: false, updatedBy: actor.id } })
    await audit({ userId: actor.id, action: 'CREATE', entityType: 'TaxConfiguration', entityId: created.id, changes: { period: period(year, month), status: 'draft' } })
    await notify(
      approvers,
      {
        type: 'TAX_DRAFTED',
        title: `New tax configuration for ${period(year, month)} needs activation`,
        body: 'Payroll can’t use it until an approver activates it.',
        href: `${href}?id=${created.id}`,
      },
      email,
    )
    refresh()
    return { status: 'success', message: `Saved as a draft. Approvers have been asked to activate it.` }
  }

  const current = {
    payeBrackets: existing.payeBrackets,
    payeThreshold: existing.payeThreshold.toString(),
    ssnitEmployeeRate: existing.ssnitEmployeeRate.toString(),
    ssnitEmployerRate: existing.ssnitEmployerRate.toString(),
    personalRelief: existing.personalRelief.toString(),
    spouseExemption: existing.spouseExemption.toString(),
    childExemption: existing.childExemption.toString(),
    isActive: existing.isActive,
  }
  const normalised = {
    ...values,
    ...Object.fromEntries(
      Object.entries(values)
        .filter(([k]) => k !== 'payeBrackets' && k !== 'isActive')
        .map(([k, v]) => [k, String(Number(v))]),
    ),
  }
  const currentNormalised = {
    ...current,
    ...Object.fromEntries(
      Object.entries(current)
        .filter(([k]) => k !== 'payeBrackets' && k !== 'isActive')
        .map(([k, v]) => [k, String(Number(v))]),
    ),
  }
  const changes = diff(currentNormalised, normalised)
  if (JSON.stringify(JSON.parse(current.payeBrackets)) !== JSON.stringify(parsed)) changes.payeBrackets = { from: 'previous bands', to: 'new bands' }
  else delete changes.payeBrackets

  if (!existing.approvedAt) {
    // Still a draft: edit in place, it stays inactive until activated
    await prisma.taxConfiguration.update({ where: { id: existing.id }, data: { ...values, isActive: false, updatedBy: actor.id } })
    await audit({ userId: actor.id, action: 'UPDATE', entityType: 'TaxConfiguration', entityId: existing.id, changes })
    refresh()
    return { status: 'success', message: 'Draft updated. It still needs an approver to activate it.' }
  }

  if (Object.keys(changes).length === 0) return { status: 'error', message: 'Nothing has changed.' }

  await prisma.taxConfiguration.update({
    where: { id: existing.id },
    data: { pendingChanges: JSON.stringify(values), pendingById: actor.id, pendingAt: new Date() },
  })
  await audit({ userId: actor.id, action: 'UPDATE', entityType: 'TaxConfiguration', entityId: existing.id, changes: { proposed: true, ...changes } })
  await notify(
    approvers,
    {
      type: 'TAX_CHANGE_PROPOSED',
      title: `Changes proposed to the ${period(year, month)} tax configuration`,
      body: `${Object.keys(changes).length} settings would change. The current settings stay in use until approved.`,
      href: `${href}?id=${existing.id}`,
    },
    email,
  )
  refresh()
  return { status: 'success', message: 'Changes proposed. The current settings stay in use until an approver approves them.' }
}

export async function activateTaxConfiguration(id: string): Promise<ActionResult> {
  const actor = await requirePermission('tax.activate')
  if (!actor) return { ok: false, message: 'Only payroll approvers can activate tax configuration.' }
  const config = await prisma.taxConfiguration.findUnique({ where: { id } })
  if (!config) return { ok: false, message: 'That configuration no longer exists.' }

  if (!config.approvedAt) {
    if (config.updatedBy === actor.id) return { ok: false, message: 'You drafted this configuration, so another approver must activate it.' }
    await prisma.taxConfiguration.update({ where: { id }, data: { isActive: true, approvedAt: new Date(), approvedById: actor.id } })
    await audit({ userId: actor.id, action: 'ACTIVATE', entityType: 'TaxConfiguration', entityId: id, changes: { period: period(config.year, config.month) } })
    await notify([config.updatedBy], {
      type: 'TAX_ACTIVATED',
      title: `Tax configuration for ${period(config.year, config.month)} was activated`,
      href: `/portal/financial/tax?id=${id}`,
    })
    refresh()
    return { ok: true, message: 'Activated. Payroll runs for this period will use it.' }
  }

  if (!config.pendingChanges) return { ok: false, message: 'There’s nothing waiting for approval on this configuration.' }
  if (config.pendingById === actor.id) return { ok: false, message: 'You proposed these changes, so another approver must approve them.' }
  const pending = JSON.parse(config.pendingChanges) as Record<string, string | boolean>
  await prisma.taxConfiguration.update({
    where: { id },
    data: {
      payeBrackets: String(pending.payeBrackets),
      payeThreshold: String(pending.payeThreshold),
      ssnitEmployeeRate: String(pending.ssnitEmployeeRate),
      ssnitEmployerRate: String(pending.ssnitEmployerRate),
      personalRelief: String(pending.personalRelief),
      spouseExemption: String(pending.spouseExemption),
      childExemption: String(pending.childExemption),
      isActive: Boolean(pending.isActive),
      updatedBy: config.pendingById ?? config.updatedBy,
      approvedAt: new Date(),
      approvedById: actor.id,
      pendingChanges: null,
      pendingById: null,
      pendingAt: null,
    },
  })
  await audit({ userId: actor.id, action: 'ACTIVATE', entityType: 'TaxConfiguration', entityId: id, changes: { appliedProposalFrom: config.pendingById } })
  if (config.pendingById)
    await notify([config.pendingById], {
      type: 'TAX_ACTIVATED',
      title: `Your tax changes for ${period(config.year, config.month)} were approved`,
      href: `/portal/financial/tax?id=${id}`,
    })
  refresh()
  return { ok: true, message: 'Changes approved and applied.' }
}

export async function rejectTaxConfiguration(id: string, reason: string): Promise<ActionResult> {
  const actor = await requirePermission('tax.activate')
  if (!actor) return { ok: false, message: 'Only payroll approvers can review tax configuration.' }
  if (reason.trim().length < 3) return { ok: false, message: 'Explain what needs to change.' }
  const config = await prisma.taxConfiguration.findUnique({ where: { id } })
  if (!config) return { ok: false, message: 'That configuration no longer exists.' }

  const proposer = config.pendingChanges ? config.pendingById : config.approvedAt ? null : config.updatedBy
  if (config.pendingChanges) await prisma.taxConfiguration.update({ where: { id }, data: { pendingChanges: null, pendingById: null, pendingAt: null } })
  await audit({ userId: actor.id, action: 'REJECT', entityType: 'TaxConfiguration', entityId: id, changes: { comment: reason.trim() } })
  if (proposer) {
    await notify(
      [proposer],
      {
        type: 'TAX_CHANGES_REQUESTED',
        title: `Changes requested on the ${period(config.year, config.month)} tax configuration`,
        body: reason.trim(),
        href: `/portal/financial/tax?id=${id}`,
      },
      { subject: 'Tax configuration needs changes', heading: 'An approver sent your tax configuration back', actionLabel: 'Open tax configuration' },
    )
  }
  refresh()
  return { ok: true, message: 'Sent back with your comments.' }
}
