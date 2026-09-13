import type { UserAccess } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import type { RoleName } from '@/lib/roles'

/**
 * Role onboarding checklists. Each step links to where the work is done. A step completes when the
 * work is detected in the data (or, for review steps, when the page is visited), and completion is
 * saved in `checklist_progress` so it stays checked afterwards.
 */

type Scope = 'workspace' | 'user'

type Step = {
  key: string
  label: string
  description: string
  href: string
  cta: string
  scope: Scope
  /** Detects completion from real data. Omit for steps completed by visiting a page (see markChecklistVisit). */
  detect?: (user: UserAccess) => Promise<boolean>
}

const CHECKLISTS: Partial<Record<RoleName, { title: string; steps: Step[] }>> = {
  ADMIN: {
    title: 'Set up your workspace',
    steps: [
      {
        key: 'admin.company-details',
        label: 'Add company details',
        description: 'Your company name and address appear on payslips and emails.',
        href: '/portal/financial/config#company',
        cta: 'Open company settings',
        scope: 'workspace',
        detect: async () => !!(await prisma.systemConfig.findFirst({ where: { isActive: true, companyName: { not: '' } }, select: { id: true } })),
      },
      {
        key: 'admin.statutory-numbers',
        label: 'Add employer TIN and SSNIT number',
        description: 'Printed on the PAYE schedule and SSNIT contribution report.',
        href: '/portal/financial/config#statutory',
        cta: 'Add statutory numbers',
        scope: 'workspace',
        detect: async () => !!(await prisma.systemConfig.findFirst({ where: { isActive: true, taxId: { not: null }, employerSsnitNumber: { not: null } }, select: { id: true } })),
      },
      {
        key: 'admin.bank-account',
        label: 'Add the salary bank account',
        description: 'The account salaries are paid from, shown on the bank payment schedule.',
        href: '/portal/financial/config#bank',
        cta: 'Add bank account',
        scope: 'workspace',
        detect: async () => !!(await prisma.systemConfig.findFirst({ where: { isActive: true, bankName: { not: null }, bankAccountNumber: { not: null } }, select: { id: true } })),
      },
      {
        key: 'admin.invite-preparer',
        label: 'Invite a payroll preparer',
        description: 'They set up pay and prepare payroll runs.',
        href: '/portal/financial/users/invite?role=PREPARER',
        cta: 'Invite a preparer',
        scope: 'workspace',
        detect: async () => (await prisma.user.count({ where: { role: 'PREPARER', status: 'active' } })) > 0,
      },
      {
        key: 'admin.invite-approver',
        label: 'Invite a payroll approver',
        description: 'They check and approve payroll. It must be a different person from the preparer.',
        href: '/portal/financial/users/invite?role=APPROVER',
        cta: 'Invite an approver',
        scope: 'workspace',
        detect: async () => (await prisma.user.count({ where: { role: 'APPROVER', status: 'active' } })) > 0,
      },
      {
        key: 'admin.add-employees',
        label: 'Add employees',
        description: 'Add people one at a time or import your staff list. Preparers are asked to set up their pay.',
        href: '/portal/financial/employees/new',
        cta: 'Add employees',
        scope: 'workspace',
        detect: async () => (await prisma.employee.count()) > 0,
      },
      {
        key: 'admin.review-audit-log',
        label: 'Look through the audit log',
        description: 'See how every change, approval and sign-in is recorded.',
        href: '/portal/financial/audit',
        cta: 'Open audit log',
        scope: 'user',
      },
    ],
  },
  PREPARER: {
    title: 'Get payroll ready',
    steps: [
      {
        key: 'preparer.set-salaries',
        label: 'Set salaries',
        description: 'Everyone active needs a basic salary to be included in payroll. Administrators add the people.',
        href: '/portal/financial/salary?view=missing',
        cta: 'Set salaries',
        scope: 'workspace',
        detect: async () => {
          const active = await prisma.employee.count({ where: { employmentStatus: 'ACTIVE' } })
          const missing = await prisma.employee.count({ where: { employmentStatus: 'ACTIVE', salaryConfigs: { none: {} } } })
          return active > 0 && missing === 0
        },
      },
      {
        key: 'preparer.draft-tax',
        label: 'Draft the tax configuration',
        description: 'Set PAYE bands, reliefs and SSNIT rates for an approver to activate.',
        href: '/portal/financial/tax',
        cta: 'Open tax configuration',
        scope: 'workspace',
        detect: async () => (await prisma.taxConfiguration.count()) > 0,
      },
      {
        key: 'preparer.first-run',
        label: 'Prepare your first payroll run',
        description: 'We calculate PAYE, SSNIT and net pay for everyone with a salary.',
        href: '/portal/financial/payroll/new',
        cta: 'Start a payroll run',
        scope: 'user',
        detect: async (user) => (await prisma.payrollRun.count({ where: { createdById: user.id } })) > 0,
      },
      {
        key: 'preparer.submit-run',
        label: 'Submit a run for approval',
        description: 'Check the flagged lines, then send it to an approver.',
        href: '/portal/financial/payroll?view=draft',
        cta: 'Open drafts',
        scope: 'user',
        detect: async (user) => (await prisma.payrollRun.count({ where: { submittedById: user.id } })) > 0,
      },
      {
        key: 'preparer.export-bank',
        label: 'Export the bank payment schedule',
        description: 'Once a run is approved, download the file for your bank.',
        href: '/portal/financial/reports',
        cta: 'Open reports',
        scope: 'user',
        detect: async (user) => (await prisma.report.count({ where: { generatedById: user.id, type: 'BANK_TRANSFER' } })) > 0,
      },
    ],
  },
  APPROVER: {
    title: 'Get ready to approve payroll',
    steps: [
      {
        key: 'approver.activate-tax',
        label: 'Activate the tax configuration',
        description: 'Check the PAYE bands and SSNIT rates a preparer drafted, then activate them.',
        href: '/portal/financial/tax',
        cta: 'Review tax configuration',
        scope: 'workspace',
        detect: async () => (await prisma.taxConfiguration.count({ where: { approvedAt: { not: null } } })) > 0,
      },
      {
        key: 'approver.review-queue',
        label: 'Open the approval queue',
        description: 'Submitted payroll runs wait here for you, oldest first.',
        href: '/portal/financial/approvals',
        cta: 'Open approval queue',
        scope: 'user',
      },
      {
        key: 'approver.first-decision',
        label: 'Review your first payroll run',
        description: 'Approve it, or send it back with comments for the preparer.',
        href: '/portal/financial/approvals',
        cta: 'Review a run',
        scope: 'user',
        detect: async (user) => (await prisma.payrollDecision.count({ where: { userId: user.id } })) > 0,
      },
      {
        key: 'approver.notifications',
        label: 'Check your notification settings',
        description: 'Choose whether you also get emails when payroll needs you.',
        href: '/portal/financial/notifications',
        cta: 'Open notifications',
        scope: 'user',
      },
      {
        key: 'approver.review-audit-log',
        label: 'Look through the audit log',
        description: 'Every change and approval is recorded with who did it.',
        href: '/portal/financial/audit',
        cta: 'Open audit log',
        scope: 'user',
      },
    ],
  },
  AUDITOR: {
    title: 'Start your review',
    steps: [
      {
        key: 'auditor.review-run',
        label: 'Open a payroll run',
        description: 'See its employees, history, approvals and exported documents.',
        href: '/portal/financial/payroll',
        cta: 'Open payroll runs',
        scope: 'user',
      },
      {
        key: 'auditor.review-audit-log',
        label: 'Review the audit log',
        description: 'Filter by person, action or date, and see before and after values.',
        href: '/portal/financial/audit',
        cta: 'Open audit log',
        scope: 'user',
      },
      {
        key: 'auditor.export-report',
        label: 'Export a report',
        description: 'Download the payroll register or a statutory schedule for your records.',
        href: '/portal/financial/reports',
        cta: 'Open reports',
        scope: 'user',
        detect: async (user) => (await prisma.report.count({ where: { generatedById: user.id } })) > 0,
      },
    ],
  },
}

export type ChecklistView = {
  title: string
  steps: (Omit<Step, 'detect' | 'scope'> & { done: boolean; completedAt: string | null })[]
  doneCount: number
}

const scopeFor = (step: Step, user: UserAccess) => (step.scope === 'workspace' ? 'workspace' : user.id)

/** Loads the user's checklist, recording any steps that have just been completed. */
export async function getChecklist(user: UserAccess): Promise<ChecklistView | null> {
  const checklist = CHECKLISTS[user.role]
  if (!checklist) return null

  const saved = await prisma.checklistProgress.findMany({
    where: { scope: { in: ['workspace', user.id] }, stepKey: { in: checklist.steps.map((s) => s.key) } },
  })
  const completed = new Map(saved.map((row) => [`${row.scope}:${row.stepKey}`, row.completedAt]))

  // Detect newly finished work and persist it
  const newlyDone = (
    await Promise.all(
      checklist.steps.map(async (step) => {
        if (completed.has(`${scopeFor(step, user)}:${step.key}`) || !step.detect) return null
        return (await step.detect(user)) ? step : null
      }),
    )
  ).filter((s): s is Step => !!s)

  if (newlyDone.length) {
    const now = new Date()
    await prisma.checklistProgress.createMany({
      data: newlyDone.map((step) => ({ scope: scopeFor(step, user), stepKey: step.key, completedById: user.id, completedAt: now })),
      skipDuplicates: true,
    })
    for (const step of newlyDone) completed.set(`${scopeFor(step, user)}:${step.key}`, now)
  }

  const steps = checklist.steps.map((step) => {
    const at = completed.get(`${scopeFor(step, user)}:${step.key}`)
    return { key: step.key, label: step.label, description: step.description, href: step.href, cta: step.cta, done: !!at, completedAt: at ? at.toISOString() : null }
  })
  return { title: checklist.title, steps, doneCount: steps.filter((s) => s.done).length }
}

/** Marks visit-based steps complete when someone opens the page they point to. Safe to call on every render. */
export async function markChecklistVisit(user: UserAccess | null, stepKeys: string[]) {
  if (!user) return
  const checklist = CHECKLISTS[user.role]
  if (!checklist) return
  const steps = checklist.steps.filter((s) => stepKeys.includes(s.key) && !s.detect)
  if (!steps.length) return
  await prisma.checklistProgress.createMany({
    data: steps.map((step) => ({ scope: scopeFor(step, user), stepKey: step.key, completedById: user.id })),
    skipDuplicates: true,
  })
}
