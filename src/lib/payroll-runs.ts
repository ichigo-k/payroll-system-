import { Prisma } from '@prisma/client'
import { type ActionResult, audit, type UserAccess } from '@/lib/access'
import { notify, userIdsWithRoles } from '@/lib/notifications'
import { payItemName } from '@/lib/pay-items'
import { activeInPeriod, calculateLine, monthlyAmount, periodBounds, prorationFactor, type ReviewFlag, reviewFlags } from '@/lib/payroll-engine'
import { approvalsRemaining, checkDecision, checkEditable, checkMarkPaid, checkRecall, checkSubmit, effectiveTaxConfig, type RunStatus } from '@/lib/payroll-rules'
import { prisma } from '@/lib/prisma'
import type { TaxBracket } from '@/lib/types'

/**
 * Payroll run workflow. Callers check permissions first (requirePermission); these functions
 * enforce state and maker-checker rules, write the audit trail and send notifications.
 */

export function periodLabel(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
}

function name(user: { firstName: string | null; lastName: string | null; email: string }) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
}

const runHref = (id: string) => `/portal/financial/payroll/${id}`

/** Approved tax configuration in force for the period, carried forward from earlier periods if needed. */
export async function taxConfigFor(year: number, month: number) {
  const configs = await prisma.taxConfiguration.findMany({
    where: { isActive: true, approvedAt: { not: null }, OR: [{ year: { lt: year } }, { year, month: { lte: month } }] },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: 5,
  })
  return effectiveTaxConfig(configs, year, month)
}

function taxConfigLabel(config: { year: number; month: number }) {
  return config.month === 0 ? `${config.year} (whole year)` : periodLabel(config.month, config.year)
}

function parseBrackets(json: string): TaxBracket[] {
  try {
    const value = JSON.parse(json)
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------

export async function createRun(actor: UserAccess, input: { year: number; month: number; notes?: string }): Promise<ActionResult & { id?: string }> {
  const { year, month } = input
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false, message: 'Choose a valid pay period.' }
  }
  const existing = await prisma.payrollRun.findUnique({ where: { month_year: { month, year } }, select: { id: true } })
  if (existing) return { ok: false, message: `There’s already a payroll run for ${periodLabel(month, year)}.` }

  const run = await prisma.payrollRun.create({ data: { year, month, notes: input.notes?.trim() || null, createdById: actor.id } })
  await audit({ userId: actor.id, action: 'CREATE', entityType: 'PayrollRun', entityId: run.id, changes: { period: periodLabel(month, year) } })

  const calculated = await calculateRun(actor, run.id, { silent: true })
  const others = [...(await userIdsWithRoles(['PREPARER', 'APPROVER'], [actor.id]))]
  await notify(others, {
    type: 'PAYROLL_DRAFT_CREATED',
    title: `${name(actor)} started the ${periodLabel(month, year)} payroll`,
    body: 'It’s a draft, so it can still change before it’s submitted.',
    href: runHref(run.id),
  })
  return { ok: true, id: run.id, message: calculated.ok ? `Draft created for ${periodLabel(month, year)}. ${calculated.message}` : calculated.message }
}

export async function calculateRun(actor: UserAccess, runId: string, { silent = false } = {}): Promise<ActionResult> {
  const run = await prisma.payrollRun.findUnique({ where: { id: runId } })
  if (!run) return { ok: false, message: 'That payroll run no longer exists.' }
  const locked = checkEditable({ status: run.status as RunStatus })
  if (locked) return { ok: false, message: locked }

  const tax = await taxConfigFor(run.year, run.month)
  if (!tax) return { ok: false, message: `No approved tax configuration starts on or before ${periodLabel(run.month, run.year)}. Ask an approver to activate one, then recalculate.` }
  // Tell the preparer when older rules are being carried forward, so they can check they're still current
  const carriedForward = tax.year !== run.year ? ` Using the ${taxConfigLabel(tax)} tax configuration, the latest approved one.` : ''
  const brackets = parseBrackets(tax.payeBrackets)

  const { start, end } = periodBounds(run.year, run.month)
  const round2 = (value: number) => Math.round(value * 100) / 100
  const exclusions = await prisma.payrollExclusion.findMany({ where: { payrollRunId: run.id }, select: { employeeId: true } })
  const excluded = new Set(exclusions.map((e) => e.employeeId))
  // Active staff, plus leavers whose last day falls in this period so they get their final pay
  const employees = await prisma.employee.findMany({
    where: { startDate: { lte: end }, OR: [{ employmentStatus: 'ACTIVE' }, { employmentStatus: 'TERMINATED', endDate: { gte: start } }] },
    include: {
      salaryConfigs: { where: { effectiveFrom: { lte: end } }, orderBy: { effectiveFrom: 'desc' } },
      allowances: { where: { isActive: true } },
      deductions: { where: { isActive: true } },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  // Previous approved or paid run, to flag what changed
  const previousRun = await prisma.payrollRun.findFirst({
    where: { status: { in: ['APPROVED', 'PAID'] }, OR: [{ year: { lt: run.year } }, { year: run.year, month: { lt: run.month } }] },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: { payrollDetails: { select: { employeeId: true, baseSalary: true, netPay: true, bankName: true, accountNumber: true } } },
  })
  const previousByEmployee = new Map((previousRun?.payrollDetails ?? []).map((d) => [d.employeeId, d]))

  let skipped = 0
  const details: Prisma.PayrollDetailCreateManyInput[] = []
  for (const employee of employees) {
    if (excluded.has(employee.id)) continue
    const salary = employee.salaryConfigs.find((s) => activeInPeriod({ from: s.effectiveFrom, to: s.effectiveTo }, start, end))
    if (!salary) {
      skipped++
      continue
    }
    // Joiners and leavers are paid for the calendar days they worked. One-time amounts and deductions aren't prorated.
    const factor = prorationFactor({ startDate: employee.startDate, endDate: employee.employmentStatus === 'TERMINATED' ? employee.endDate : null }, start, end)
    if (factor === 0) continue
    const allowanceItems = employee.allowances.map((a) => ({
      name: payItemName(a, 'allowance'),
      amount: round2(a.frequency === 'one-time' ? Number(a.amount) : monthlyAmount({ amount: Number(a.amount), frequency: a.frequency }) * factor),
    }))
    const deductionItems = employee.deductions
      .filter((d) => activeInPeriod({ from: d.startDate, to: d.endDate }, start, end))
      .map((d) => ({ name: payItemName(d, 'deduction'), amount: round2(d.frequency === 'annual' ? Number(d.amount) / 12 : Number(d.amount)) }))
    const line = calculateLine({
      baseSalary: Number(salary.baseSalary) * factor,
      // Already monthly and prorated above
      allowances: allowanceItems.map((a) => ({ amount: a.amount, frequency: 'monthly' })),
      deductions: deductionItems.map((d) => d.amount),
      brackets,
      ssnitEmployeeRate: Number(tax.ssnitEmployeeRate),
      ssnitEmployerRate: Number(tax.ssnitEmployerRate),
      reliefs: Number(tax.personalRelief),
    })
    const previous = previousByEmployee.get(employee.id)
    const flags: ReviewFlag[] = reviewFlags(
      { baseSalary: line.baseSalary, netPay: line.netPay, bankName: employee.bankName, accountNumber: employee.accountNumber, ssnitNumber: employee.ssnit_number, tin: employee.tin },
      previous ? { baseSalary: Number(previous.baseSalary), netPay: Number(previous.netPay), bankName: previous.bankName, accountNumber: previous.accountNumber } : null,
    )
    if (factor < 1) flags.push('PART_MONTH')
    if (employee.employmentStatus === 'TERMINATED') flags.push('LEAVER')
    details.push({
      payrollRunId: run.id,
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeCode: employee.employeeId,
      department: employee.department,
      designation: employee.designation,
      bankName: employee.bankName,
      accountName: employee.accountName,
      accountNumber: employee.accountNumber,
      ssnitNumber: employee.ssnit_number,
      tin: employee.tin,
      flags: JSON.stringify(flags),
      lineItems: JSON.stringify({ allowances: allowanceItems, deductions: deductionItems }),
      baseSalary: line.baseSalary,
      allowancesTotal: line.allowancesTotal,
      deductionsTotal: line.deductionsTotal,
      grossIncome: line.grossIncome,
      reliefs: line.reliefs,
      taxableIncome: line.taxableIncome,
      paye: line.paye,
      ssnitEmployee: line.ssnitEmployee,
      ssnitEmployer: line.ssnitEmployer,
      totalDeductions: line.totalDeductions,
      netPay: line.netPay,
    })
  }

  const sum = (key: keyof Prisma.PayrollDetailCreateManyInput) => Math.round(details.reduce((total, d) => total + Number(d[key] ?? 0), 0) * 100) / 100
  const totals = {
    headcount: details.length,
    totalBaseSalary: sum('baseSalary'),
    totalAllowances: sum('allowancesTotal'),
    totalDeductions: sum('deductionsTotal'),
    totalGross: sum('grossIncome'),
    totalTax: sum('paye'),
    totalSsnit: sum('ssnitEmployee'),
    totalEmployerSsnit: sum('ssnitEmployer'),
    totalNetPay: sum('netPay'),
  }

  await prisma.$transaction([
    prisma.payrollDetail.deleteMany({ where: { payrollRunId: run.id } }),
    prisma.payrollDetail.createMany({ data: details }),
    prisma.payrollRun.update({ where: { id: run.id }, data: totals }),
  ])
  if (!silent) {
    await audit({
      userId: actor.id,
      action: 'UPDATE',
      entityType: 'PayrollRun',
      entityId: run.id,
      changes: { recalculated: true, headcount: { from: run.headcount, to: totals.headcount }, totalNetPay: { from: Number(run.totalNetPay), to: totals.totalNetPay } },
    })
  }
  const excludedNote = excluded.size ? ` ${excluded.size} excluded from this run.` : ''
  const skippedNote = skipped ? ` ${skipped} active ${skipped === 1 ? 'employee has' : 'employees have'} no salary for this period and ${skipped === 1 ? 'was' : 'were'} left out.` : ''
  return { ok: true, message: `Calculated pay for ${totals.headcount} ${totals.headcount === 1 ? 'employee' : 'employees'}.${skippedNote}${excludedNote}${carriedForward}` }
}

export async function submitRun(actor: UserAccess, runId: string, input: { reviewerId?: string; note?: string }): Promise<ActionResult> {
  const run = await prisma.payrollRun.findUnique({ where: { id: runId } })
  if (!run) return { ok: false, message: 'That payroll run no longer exists.' }
  const hasActiveTax = !!(await taxConfigFor(run.year, run.month))
  const error = checkSubmit({ status: run.status as RunStatus, headcount: run.headcount, hasActiveTax })
  if (error) return { ok: false, message: error }

  let reviewerId: string | null = null
  if (input.reviewerId) {
    const reviewer = await prisma.user.findFirst({ where: { id: input.reviewerId, role: 'APPROVER', status: 'active' }, select: { id: true } })
    reviewerId = reviewer?.id ?? null
  }

  const round = run.submissionRound + 1
  await prisma.payrollRun.update({
    where: { id: run.id },
    data: { status: 'SUBMITTED', submittedById: actor.id, submittedAt: new Date(), submissionRound: round, requestedReviewerId: reviewerId, rejectionReason: null },
  })
  const note = input.note?.trim()
  if (note) await prisma.payrollComment.create({ data: { payrollRunId: run.id, userId: actor.id, body: note } })
  await audit({ userId: actor.id, action: 'SUBMIT', entityType: 'PayrollRun', entityId: run.id, changes: { round, requestedReviewerId: reviewerId, note: note || undefined } })

  const period = periodLabel(run.month, run.year)
  const approvers = await userIdsWithRoles(['APPROVER'], [actor.id])
  const email = {
    subject: `${period} payroll is waiting for your approval`,
    heading: 'A payroll run needs your review',
    actionLabel: 'Review payroll',
    details: [
      ['Period', period],
      ['Employees', String(run.headcount)],
      ['Submitted by', name(actor)],
    ] as [string, string][],
  }
  if (reviewerId) {
    await notify([reviewerId], { type: 'PAYROLL_REVIEW_REQUESTED', title: `${name(actor)} asked you to review the ${period} payroll`, body: note || 'It’s ready for approval.', href: runHref(run.id) }, email)
  }
  await notify(
    approvers.filter((id) => id !== reviewerId),
    { type: 'PAYROLL_SUBMITTED', title: `${period} payroll submitted for approval`, body: `${name(actor)} submitted it${note ? `: “${note}”` : '.'}`, href: runHref(run.id) },
    email,
  )
  await notify(await userIdsWithRoles(['PREPARER'], [actor.id]), { type: 'PAYROLL_SUBMITTED', title: `${name(actor)} submitted the ${period} payroll`, href: runHref(run.id) })
  return { ok: true, message: `Submitted for approval. Approvers have been notified.` }
}

export async function recallRun(actor: UserAccess, runId: string): Promise<ActionResult> {
  const run = await prisma.payrollRun.findUnique({ where: { id: runId } })
  if (!run) return { ok: false, message: 'That payroll run no longer exists.' }
  const approvalsThisRound = await prisma.payrollDecision.count({ where: { payrollRunId: run.id, round: run.submissionRound, decision: 'APPROVED' } })
  const error = checkRecall({ status: run.status as RunStatus, approvalsThisRound })
  if (error) return { ok: false, message: error }

  await prisma.payrollRun.update({ where: { id: run.id }, data: { status: 'DRAFT' } })
  await audit({ userId: actor.id, action: 'RECALL', entityType: 'PayrollRun', entityId: run.id, changes: { round: run.submissionRound } })
  const period = periodLabel(run.month, run.year)
  await notify(await userIdsWithRoles(['APPROVER', 'PREPARER'], [actor.id]), {
    type: 'PAYROLL_RECALLED',
    title: `${name(actor)} recalled the ${period} payroll`,
    body: 'It’s back in draft, so there’s nothing to approve right now.',
    href: runHref(run.id),
  })
  return { ok: true, message: 'Recalled to draft. You can edit and resubmit it.' }
}

export async function decideRun(actor: UserAccess, runId: string, decision: 'APPROVED' | 'CHANGES_REQUESTED', rawComment?: string): Promise<ActionResult> {
  const comment = rawComment?.trim() ?? ''
  if (decision === 'CHANGES_REQUESTED' && comment.length < 3) return { ok: false, message: 'Explain what needs to change so the preparer can fix it.' }

  const run = await prisma.payrollRun.findUnique({ where: { id: runId } })
  if (!run) return { ok: false, message: 'That payroll run no longer exists.' }

  const [alreadyDecided, ownLine, config] = await Promise.all([
    prisma.payrollDecision.findUnique({ where: { payrollRunId_userId_round: { payrollRunId: run.id, userId: actor.id, round: run.submissionRound } } }),
    actor.employeeId ? prisma.payrollDetail.findUnique({ where: { payrollRunId_employeeId: { payrollRunId: run.id, employeeId: actor.employeeId } }, select: { flags: true } }) : null,
    prisma.systemConfig.findFirst({ where: { isActive: true }, select: { requiredApprovals: true } }),
  ])
  const ownFlags: string[] = ownLine ? JSON.parse(ownLine.flags) : []
  const ownPayChanged = ownFlags.some((f) => ['NEW_EMPLOYEE', 'SALARY_CHANGED', 'BANK_CHANGED', 'NET_PAY_JUMP'].includes(f))

  const error = checkDecision({ status: run.status as RunStatus, approverId: actor.id, submittedById: run.submittedById, alreadyDecided: !!alreadyDecided, ownPayChanged })
  if (error) return { ok: false, message: error }

  const period = periodLabel(run.month, run.year)
  const submitter = run.submittedById ? await prisma.user.findUnique({ where: { id: run.submittedById }, select: { id: true } }) : null
  const preparers = await userIdsWithRoles(['PREPARER'], [actor.id, submitter?.id ?? ''])

  try {
    await prisma.payrollDecision.create({ data: { payrollRunId: run.id, userId: actor.id, decision, comment: comment || null, round: run.submissionRound } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { ok: false, message: 'You’ve already reviewed this version.' }
    throw err
  }

  if (decision === 'CHANGES_REQUESTED') {
    await prisma.payrollRun.update({ where: { id: run.id }, data: { status: 'DRAFT', rejectionReason: comment } })
    await audit({ userId: actor.id, action: 'REJECT', entityType: 'PayrollRun', entityId: run.id, changes: { changesRequested: true, round: run.submissionRound, comment } })
    const title = `${name(actor)} sent the ${period} payroll back for changes`
    if (submitter) {
      await notify([submitter.id], { type: 'PAYROLL_CHANGES_REQUESTED', title, body: comment, href: runHref(run.id) }, {
        subject: `Changes requested on the ${period} payroll`,
        heading: 'Your payroll run needs changes',
        actionLabel: 'See what to change',
        details: [
          ['Period', period],
          ['Reviewed by', name(actor)],
        ],
      })
    }
    await notify(preparers, { type: 'PAYROLL_CHANGES_REQUESTED', title, body: comment, href: runHref(run.id) })
    return { ok: true, message: 'Sent back to the preparer with your comments.' }
  }

  const approvals = await prisma.payrollDecision.count({ where: { payrollRunId: run.id, round: run.submissionRound, decision: 'APPROVED' } })
  const remaining = approvalsRemaining(config?.requiredApprovals ?? 1, approvals)

  if (remaining > 0) {
    await audit({ userId: actor.id, action: 'APPROVE', entityType: 'PayrollRun', entityId: run.id, changes: { round: run.submissionRound, approvalsRemaining: remaining, comment: comment || undefined } })
    await notify(await userIdsWithRoles(['APPROVER'], [actor.id]), {
      type: 'PAYROLL_PARTIALLY_APPROVED',
      title: `${name(actor)} approved the ${period} payroll`,
      body: `${remaining} more ${remaining === 1 ? 'approval is' : 'approvals are'} needed.`,
      href: runHref(run.id),
    })
    return { ok: true, message: `Approved. ${remaining} more ${remaining === 1 ? 'approval is' : 'approvals are'} needed.` }
  }

  await prisma.payrollRun.update({ where: { id: run.id }, data: { status: 'APPROVED', approvedById: actor.id, approvedAt: new Date() } })
  await audit({ userId: actor.id, action: 'APPROVE', entityType: 'PayrollRun', entityId: run.id, changes: { round: run.submissionRound, final: true, comment: comment || undefined } })
  const title = `The ${period} payroll was approved`
  if (submitter) {
    await notify([submitter.id], { type: 'PAYROLL_APPROVED', title, body: `${name(actor)} approved it. You can export the bank payment file.`, href: runHref(run.id) }, {
      subject: `${period} payroll approved`,
      heading: 'Your payroll run was approved',
      actionLabel: 'Open payroll run',
      details: [
        ['Period', period],
        ['Approved by', name(actor)],
      ],
    })
  }
  await notify([...preparers, ...(await userIdsWithRoles(['APPROVER'], [actor.id]))], { type: 'PAYROLL_APPROVED', title, body: `Approved by ${name(actor)}.`, href: runHref(run.id) })
  return { ok: true, message: 'Payroll approved. Preparers can now export the bank payment file.' }
}

export async function markRunPaid(actor: UserAccess, runId: string): Promise<ActionResult> {
  const run = await prisma.payrollRun.findUnique({ where: { id: runId }, include: { payrollDetails: { select: { employeeId: true, employee: { select: { userId: true } } } } } })
  if (!run) return { ok: false, message: 'That payroll run no longer exists.' }
  const error = checkMarkPaid({ status: run.status as RunStatus })
  if (error) return { ok: false, message: error }

  const paidEmployeeIds = run.payrollDetails.map((d) => d.employeeId)
  const [, endedAllowances, endedDeductions] = await prisma.$transaction([
    prisma.payrollRun.update({ where: { id: run.id }, data: { status: 'PAID', paidAt: new Date(), paidById: actor.id } }),
    // One-time allowances and deductions have now been paid, so they don't carry into next month
    prisma.allowance.updateMany({ where: { employeeId: { in: paidEmployeeIds }, frequency: 'one-time', isActive: true }, data: { isActive: false } }),
    prisma.deduction.updateMany({ where: { employeeId: { in: paidEmployeeIds }, frequency: 'one-time', isActive: true }, data: { isActive: false } }),
  ])
  const oneTimeItemsEnded = endedAllowances.count + endedDeductions.count
  await audit({ userId: actor.id, action: 'MARK_PAID', entityType: 'PayrollRun', entityId: run.id, changes: oneTimeItemsEnded ? { oneTimeItemsEnded } : undefined })

  const period = periodLabel(run.month, run.year)
  const employeeUsers = run.payrollDetails.map((d) => d.employee.userId).filter((id): id is string => !!id)
  await notify(
    employeeUsers,
    { type: 'PAYSLIP_READY', title: `Your ${period} payslip is ready`, body: 'View or download it in self-service.', href: '/portal/self-service/payslips' },
    { subject: `Your ${period} payslip is ready`, heading: 'Your payslip is ready', actionLabel: 'View payslip' },
  )
  await notify(await userIdsWithRoles(['PREPARER', 'APPROVER'], [actor.id]), { type: 'PAYROLL_PAID', title: `The ${period} payroll was marked as paid`, body: `Payslips are now visible to employees.`, href: runHref(run.id) })
  return { ok: true, message: `Marked as paid. ${employeeUsers.length} ${employeeUsers.length === 1 ? 'employee was' : 'employees were'} notified that payslips are ready.` }
}

export async function deleteDraftRun(actor: UserAccess, runId: string): Promise<ActionResult> {
  const run = await prisma.payrollRun.findUnique({ where: { id: runId } })
  if (!run) return { ok: false, message: 'That payroll run no longer exists.' }
  if (run.status !== 'DRAFT') return { ok: false, message: 'Only draft runs can be deleted.' }
  await prisma.payrollRun.delete({ where: { id: run.id } })
  await audit({ userId: actor.id, action: 'DELETE', entityType: 'PayrollRun', entityId: run.id, changes: { period: periodLabel(run.month, run.year), round: run.submissionRound } })
  return { ok: true, message: `Deleted the ${periodLabel(run.month, run.year)} draft.` }
}

export async function commentOnRun(actor: UserAccess, runId: string, rawBody: string): Promise<ActionResult> {
  const body = rawBody.trim()
  if (body.length === 0) return { ok: false, message: 'Write a comment first.' }
  if (body.length > 2000) return { ok: false, message: 'Comments can be up to 2,000 characters.' }
  const run = await prisma.payrollRun.findUnique({ where: { id: runId }, include: { comments: { select: { userId: true } } } })
  if (!run) return { ok: false, message: 'That payroll run no longer exists.' }

  const comment = await prisma.payrollComment.create({ data: { payrollRunId: run.id, userId: actor.id, body } })
  await audit({ userId: actor.id, action: 'COMMENT', entityType: 'PayrollRun', entityId: run.id, changes: { commentId: comment.id } })

  // Everyone involved: creator, submitter, earlier commenters, and approvers while it's waiting on them
  const involved = new Set([run.createdById, run.submittedById, ...run.comments.map((c) => c.userId)].filter((id): id is string => !!id))
  if (run.status === 'SUBMITTED') for (const id of await userIdsWithRoles(['APPROVER'])) involved.add(id)
  involved.delete(actor.id)

  const period = periodLabel(run.month, run.year)
  const recipients = [...involved]
  const direct = [run.submittedById, run.createdById].filter((id): id is string => !!id && id !== actor.id)
  await notify(
    recipients.filter((id) => direct.includes(id)),
    { type: 'PAYROLL_COMMENT', title: `${name(actor)} commented on the ${period} payroll`, body: body.slice(0, 200), href: `${runHref(run.id)}?tab=activity` },
    { subject: `New comment on the ${period} payroll`, heading: `${name(actor)} left a comment`, actionLabel: 'Reply' },
  )
  await notify(
    recipients.filter((id) => !direct.includes(id)),
    { type: 'PAYROLL_COMMENT', title: `${name(actor)} commented on the ${period} payroll`, body: body.slice(0, 200), href: `${runHref(run.id)}?tab=activity` },
  )
  return { ok: true, message: 'Comment added.' }
}

// ---------------------------------------------------------------------------
// Exclusions: leave someone out of one run (unpaid leave, pay dispute, paid separately) with a reason.
// They're remembered across recalculation and shown to approvers.

export async function excludeFromRun(actor: UserAccess, runId: string, employeeId: string, rawReason: string): Promise<ActionResult> {
  const reason = rawReason.trim().slice(0, 300)
  if (reason.length < 3) return { ok: false, message: 'Say why they’re being left out. Approvers will see it.' }
  const run = await prisma.payrollRun.findUnique({ where: { id: runId } })
  if (!run) return { ok: false, message: 'That payroll run no longer exists.' }
  if (run.status !== 'DRAFT') return { ok: false, message: 'Only draft runs can be changed. Recall it to draft first.' }
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, firstName: true, lastName: true, employeeId: true } })
  if (!employee) return { ok: false, message: 'That employee no longer exists.' }

  try {
    await prisma.payrollExclusion.create({ data: { payrollRunId: run.id, employeeId: employee.id, reason, createdById: actor.id } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { ok: false, message: 'They’re already excluded from this run.' }
    throw err
  }
  const employeeName = `${employee.firstName} ${employee.lastName}`
  await audit({ userId: actor.id, action: 'UPDATE', entityType: 'PayrollRun', entityId: run.id, changes: { excluded: { employee: employeeName, employeeId: employee.employeeId }, reason } })
  const recalculated = await calculateRun(actor, run.id, { silent: true })
  return { ok: true, message: `${employeeName} was left out of the ${periodLabel(run.month, run.year)} run.${recalculated.ok ? '' : ` ${recalculated.message}`}` }
}

export async function includeInRun(actor: UserAccess, runId: string, employeeId: string): Promise<ActionResult> {
  const run = await prisma.payrollRun.findUnique({ where: { id: runId } })
  if (!run) return { ok: false, message: 'That payroll run no longer exists.' }
  if (run.status !== 'DRAFT') return { ok: false, message: 'Only draft runs can be changed. Recall it to draft first.' }
  const exclusion = await prisma.payrollExclusion.findUnique({
    where: { payrollRunId_employeeId: { payrollRunId: run.id, employeeId } },
    include: { employee: { select: { firstName: true, lastName: true, employeeId: true } } },
  })
  if (!exclusion) return { ok: false, message: 'They aren’t excluded from this run.' }

  await prisma.payrollExclusion.delete({ where: { id: exclusion.id } })
  const employeeName = `${exclusion.employee.firstName} ${exclusion.employee.lastName}`
  await audit({ userId: actor.id, action: 'UPDATE', entityType: 'PayrollRun', entityId: run.id, changes: { included: { employee: employeeName, employeeId: exclusion.employee.employeeId }, previousReason: exclusion.reason } })
  const recalculated = await calculateRun(actor, run.id, { silent: true })
  return { ok: true, message: recalculated.ok ? `${employeeName} is back in the run. ${recalculated.message}` : recalculated.message }
}
