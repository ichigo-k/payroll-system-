'use server'

import { revalidatePath } from 'next/cache'
import { type ActionResult, audit, requirePermission } from '@/lib/access'
import { notify, userIdsWithRoles } from '@/lib/notifications'
import { allowanceTypeFor, cleanItemName, deductionTypeFor, formatPercentChange, payItemName, SALARY_CHANGE_REASONS, salaryChangePercent } from '@/lib/pay-items'
import { prisma } from '@/lib/prisma'

const FREQUENCIES = ['monthly', 'annual', 'one-time']

const money = (value: number) => `GHS ${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const day = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

function refresh(employeeId: string) {
  revalidatePath(`/portal/financial/employees/${employeeId}`)
  revalidatePath('/portal/financial/employees')
  revalidatePath('/portal/financial/salary')
  revalidatePath('/portal/financial')
}

function parseAmount(raw: string) {
  const amount = Number(raw)
  return Number.isFinite(amount) && amount >= 0 && amount <= 100_000_000 ? Math.round(amount * 100) / 100 : null
}

async function guard(employeeId: string) {
  const actor = await requirePermission('salary.edit')
  if (!actor) return { error: { ok: false, message: 'Only payroll preparers can change pay.' } as ActionResult }
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, firstName: true, lastName: true, employmentStatus: true } })
  if (!employee) return { error: { ok: false, message: 'That employee no longer exists.' } as ActionResult }
  return { actor, employee }
}

/**
 * Sets a new basic salary from a date, with the reason for the change. The previous salary ends the day
 * before, so history is kept. A correction on the same start date replaces the amount instead.
 */
export async function setSalaryAction(employeeId: string, input: { amount: string; effectiveFrom: string; reason: string; note?: string }): Promise<ActionResult> {
  const g = await guard(employeeId)
  if ('error' in g) return g.error as ActionResult
  if (g.employee.employmentStatus === 'TERMINATED') return { ok: false, message: 'This employee has left. Reinstate them before changing their salary.' }
  const amount = parseAmount(input.amount)
  if (amount === null || amount === 0) return { ok: false, message: 'Enter a basic salary above zero.' }
  const from = new Date(input.effectiveFrom)
  if (Number.isNaN(from.getTime())) return { ok: false, message: 'Choose the date the salary starts.' }

  const current = await prisma.salaryConfiguration.findFirst({ where: { employeeId, OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }] }, orderBy: { effectiveFrom: 'desc' } })
  const reasonLabel = (SALARY_CHANGE_REASONS as readonly string[]).includes(input.reason) ? input.reason : current ? null : 'New hire'
  if (!reasonLabel) return { ok: false, message: 'Choose why the salary is changing.' }
  const note = input.note?.trim().slice(0, 200)
  const reason = note ? `${reasonLabel}: ${note}` : reasonLabel

  const previousAmount = current ? Number(current.baseSalary) : null
  const percent = salaryChangePercent(previousAmount, amount)
  const sameDay = current && current.effectiveFrom.toISOString().slice(0, 10) === from.toISOString().slice(0, 10)
  if (current && current.effectiveFrom > from) return { ok: false, message: `The new salary must start on or after ${day(current.effectiveFrom)}, when the current one started.` }
  if (sameDay && reasonLabel !== 'Correction') return { ok: false, message: 'A salary already starts on that date. Choose a later date, or pick “Correction” to fix its amount.' }
  if (previousAmount === amount) return { ok: false, message: `The salary is already ${money(amount)}.` }

  await prisma.$transaction(async (tx) => {
    if (current && sameDay) {
      await tx.salaryConfiguration.update({ where: { id: current.id }, data: { baseSalary: amount, reason } })
    } else {
      if (current) await tx.salaryConfiguration.update({ where: { id: current.id }, data: { effectiveTo: new Date(from.getTime() - 86_400_000) } })
      await tx.salaryConfiguration.create({ data: { employeeId, baseSalary: amount, effectiveFrom: from, reason, createdBy: g.actor.id } })
    }
    await audit(
      {
        userId: g.actor.id,
        action: 'UPDATE',
        entityType: 'Employee',
        entityId: employeeId,
        changes: {
          baseSalary: { from: previousAmount === null ? null : money(previousAmount), to: money(amount) },
          effectiveFrom: input.effectiveFrom,
          reason,
          ...(percent !== null && { change: formatPercentChange(percent) }),
        },
      },
      tx,
    )
  })

  // Salary changes are a key fraud and error risk, so approvers hear about them before the next run
  if (current) {
    const name = `${g.employee.firstName} ${g.employee.lastName}`
    await notify(await userIdsWithRoles(['APPROVER'], [g.actor.id]), {
      type: 'SALARY_CHANGED',
      title: `${name}’s basic salary changed to ${money(amount)}`,
      body: `${reason}${percent !== null ? ` (${formatPercentChange(percent)})` : ''}, from ${day(from)}.`,
      href: `/portal/financial/employees/${employeeId}?tab=pay`,
    })
  }

  refresh(employeeId)
  const change = percent !== null ? ` (${formatPercentChange(percent)})` : ''
  return { ok: true, message: sameDay ? `Corrected the salary to ${money(amount)}.` : `Basic salary set to ${money(amount)}${change} from ${day(from)}.` }
}

type ItemInput = { name: string; amount: string; frequency: string }

function readItem(input: ItemInput): { error: string } | { name: string; amount: number; frequency: string } {
  const name = cleanItemName(input.name)
  if (name.length < 2) return { error: 'Give it a name, like “Fuel” or “Staff loan”. It appears on the payslip.' }
  const amount = parseAmount(input.amount)
  if (amount === null || amount === 0) return { error: 'Enter an amount above zero.' }
  if (!FREQUENCIES.includes(input.frequency)) return { error: 'Choose how often it’s paid.' }
  return { name, amount, frequency: input.frequency }
}

function readDates(input: { startDate: string; endDate: string }) {
  const startDate = input.startDate ? new Date(input.startDate) : null
  const endDate = input.endDate ? new Date(input.endDate) : null
  if ((startDate && Number.isNaN(startDate.getTime())) || (endDate && Number.isNaN(endDate.getTime()))) return { error: 'Choose valid dates.' }
  if (startDate && endDate && endDate < startDate) return { error: 'The end date must be after the start date.' }
  return { startDate, endDate }
}

export async function addAllowanceAction(employeeId: string, input: ItemInput): Promise<ActionResult> {
  const g = await guard(employeeId)
  if ('error' in g) return g.error as ActionResult
  const item = readItem(input)
  if ('error' in item) return { ok: false, message: item.error }

  const allowance = await prisma.allowance.create({ data: { employeeId, type: allowanceTypeFor(item.name), description: item.name, amount: item.amount, frequency: item.frequency } })
  await audit({ userId: g.actor.id, action: 'CREATE', entityType: 'Employee', entityId: employeeId, changes: { allowance: { id: allowance.id, name: item.name, amount: money(item.amount), frequency: item.frequency } } })
  refresh(employeeId)
  return { ok: true, message: `Added ${item.name} (${money(item.amount)}, ${item.frequency}).` }
}

export async function updateAllowanceAction(employeeId: string, allowanceId: string, input: ItemInput): Promise<ActionResult> {
  const g = await guard(employeeId)
  if ('error' in g) return g.error as ActionResult
  const item = readItem(input)
  if ('error' in item) return { ok: false, message: item.error }
  const existing = await prisma.allowance.findFirst({ where: { id: allowanceId, employeeId, isActive: true } })
  if (!existing) return { ok: false, message: 'That allowance is no longer active.' }

  await prisma.allowance.update({ where: { id: existing.id }, data: { type: allowanceTypeFor(item.name), description: item.name, amount: item.amount, frequency: item.frequency } })
  await audit({
    userId: g.actor.id,
    action: 'UPDATE',
    entityType: 'Employee',
    entityId: employeeId,
    changes: {
      allowance: existing.id,
      name: { from: payItemName(existing, 'allowance'), to: item.name },
      amount: { from: money(Number(existing.amount)), to: money(item.amount) },
      frequency: { from: existing.frequency, to: item.frequency },
    },
  })
  refresh(employeeId)
  return { ok: true, message: `Updated ${item.name}. Recalculate any draft run to use it.` }
}

export async function endAllowanceAction(employeeId: string, allowanceId: string): Promise<ActionResult> {
  const g = await guard(employeeId)
  if ('error' in g) return g.error as ActionResult
  const allowance = await prisma.allowance.findFirst({ where: { id: allowanceId, employeeId, isActive: true } })
  if (!allowance) return { ok: false, message: 'That allowance is no longer active.' }
  await prisma.allowance.update({ where: { id: allowance.id }, data: { isActive: false } })
  await audit({ userId: g.actor.id, action: 'DELETE', entityType: 'Employee', entityId: employeeId, changes: { allowance: { id: allowance.id, name: payItemName(allowance, 'allowance'), amount: money(Number(allowance.amount)) }, ended: true } })
  refresh(employeeId)
  return { ok: true, message: `${payItemName(allowance, 'allowance')} ended. It won’t be paid from the next recalculated run.` }
}

type DeductionInput = ItemInput & { startDate: string; endDate: string }

export async function addDeductionAction(employeeId: string, input: DeductionInput): Promise<ActionResult> {
  const g = await guard(employeeId)
  if ('error' in g) return g.error as ActionResult
  const item = readItem(input)
  if ('error' in item) return { ok: false, message: item.error }
  const dates = readDates(input)
  if ('error' in dates) return { ok: false, message: dates.error as string }

  const deduction = await prisma.deduction.create({ data: { employeeId, type: deductionTypeFor(item.name), description: item.name, amount: item.amount, frequency: item.frequency, ...dates } })
  await audit({
    userId: g.actor.id,
    action: 'CREATE',
    entityType: 'Employee',
    entityId: employeeId,
    changes: { deduction: { id: deduction.id, name: item.name, amount: money(item.amount), frequency: item.frequency, startDate: input.startDate || null, endDate: input.endDate || null } },
  })
  refresh(employeeId)
  return { ok: true, message: `Added ${item.name} (${money(item.amount)}, ${item.frequency}).` }
}

export async function updateDeductionAction(employeeId: string, deductionId: string, input: DeductionInput): Promise<ActionResult> {
  const g = await guard(employeeId)
  if ('error' in g) return g.error as ActionResult
  const item = readItem(input)
  if ('error' in item) return { ok: false, message: item.error }
  const dates = readDates(input)
  if ('error' in dates) return { ok: false, message: dates.error as string }
  const existing = await prisma.deduction.findFirst({ where: { id: deductionId, employeeId, isActive: true } })
  if (!existing) return { ok: false, message: 'That deduction is no longer active.' }

  await prisma.deduction.update({ where: { id: existing.id }, data: { type: deductionTypeFor(item.name), description: item.name, amount: item.amount, frequency: item.frequency, ...dates } })
  const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null
  await audit({
    userId: g.actor.id,
    action: 'UPDATE',
    entityType: 'Employee',
    entityId: employeeId,
    changes: {
      deduction: existing.id,
      name: { from: payItemName(existing, 'deduction'), to: item.name },
      amount: { from: money(Number(existing.amount)), to: money(item.amount) },
      frequency: { from: existing.frequency, to: item.frequency },
      startDate: { from: iso(existing.startDate), to: iso(dates.startDate) },
      endDate: { from: iso(existing.endDate), to: iso(dates.endDate) },
    },
  })
  refresh(employeeId)
  return { ok: true, message: `Updated ${item.name}. Recalculate any draft run to use it.` }
}

export async function endDeductionAction(employeeId: string, deductionId: string): Promise<ActionResult> {
  const g = await guard(employeeId)
  if ('error' in g) return g.error as ActionResult
  const deduction = await prisma.deduction.findFirst({ where: { id: deductionId, employeeId, isActive: true } })
  if (!deduction) return { ok: false, message: 'That deduction is no longer active.' }
  await prisma.deduction.update({ where: { id: deduction.id }, data: { isActive: false } })
  await audit({ userId: g.actor.id, action: 'DELETE', entityType: 'Employee', entityId: employeeId, changes: { deduction: { id: deduction.id, name: payItemName(deduction, 'deduction'), amount: money(Number(deduction.amount)) }, ended: true } })
  refresh(employeeId)
  return { ok: true, message: `${payItemName(deduction, 'deduction')} ended.` }
}
