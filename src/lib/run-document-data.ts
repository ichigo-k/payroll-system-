import type { PayrollDetail } from '@prisma/client'
import { actorName } from '@/lib/audit-format'
import { parseLineItems } from '@/lib/pay-items'
import type { ExportCompany, ExportLine } from '@/lib/payroll-exports'
import { periodLabel } from '@/lib/payroll-runs'
import type { RunInfo, RunLine } from '@/lib/pdf/run-documents'
import type { Company } from '@/lib/pdf/theme'
import { prisma } from '@/lib/prisma'

/** A payroll line snapshot in the shape the documents and exports use. */
export function toRunLine(d: PayrollDetail): RunLine & ExportLine {
  return {
    employeeCode: d.employeeCode,
    employeeName: d.employeeName,
    department: d.department,
    designation: d.designation,
    bankName: d.bankName,
    accountName: d.accountName,
    accountNumber: d.accountNumber,
    ssnitNumber: d.ssnitNumber,
    tin: d.tin,
    baseSalary: Number(d.baseSalary),
    allowancesTotal: Number(d.allowancesTotal),
    grossIncome: Number(d.grossIncome),
    ssnitEmployee: Number(d.ssnitEmployee),
    ssnitEmployer: Number(d.ssnitEmployer),
    reliefs: Number(d.reliefs),
    taxableIncome: Number(d.taxableIncome),
    paye: Number(d.paye),
    deductionsTotal: Number(d.deductionsTotal),
    totalDeductions: Number(d.totalDeductions),
    netPay: Number(d.netPay),
    lineItems: parseLineItems(d.lineItems),
  }
}

/** Company letterhead details from settings. */
export async function loadCompany(): Promise<Company> {
  const config = await prisma.systemConfig.findFirst({ where: { isActive: true } })
  return {
    companyName: config?.companyName || 'PayCompass',
    address: config?.address ?? null,
    taxId: config?.taxId ?? null,
    employerSsnitNumber: config?.employerSsnitNumber ?? null,
    bankName: config?.bankName ?? null,
    bankBranch: config?.bankBranch ?? null,
    bankAccountName: config?.bankAccountName ?? null,
    bankAccountNumber: config?.bankAccountNumber ?? null,
  }
}

/** Everything the run documents need: snapshot lines, company letterhead and the approval trail. */
export async function loadRunDocumentData(runId: string) {
  const run = await prisma.payrollRun.findUnique({
    where: { id: runId },
    include: {
      payrollDetails: { orderBy: { employeeName: 'asc' } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      decisions: { where: { decision: 'APPROVED' }, include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }, orderBy: { createdAt: 'asc' } },
    },
  })
  if (!run) return null

  const company = await loadCompany()
  const exportCompany: ExportCompany = {
    companyName: company.companyName,
    taxId: company.taxId,
    employerSsnitNumber: company.employerSsnitNumber,
    bankName: company.bankName,
    bankAccountNumber: company.bankAccountNumber,
  }

  const lines = run.payrollDetails.map(toRunLine)

  // Approvals from the round that was finally approved
  const approvals = run.decisions.filter((d) => d.round === run.submissionRound)
  const info: RunInfo = {
    period: periodLabel(run.month, run.year),
    month: run.month,
    year: run.year,
    status: run.status,
    notes: run.notes,
    createdBy: run.createdBy ? actorName(run.createdBy) : null,
    submittedBy: run.submittedBy ? actorName(run.submittedBy) : null,
    submittedAt: run.submittedAt,
    approvals: approvals.map((d) => ({ name: actorName(d.user), at: d.createdAt, comment: d.comment })),
    paidAt: run.paidAt,
  }

  return { run, info, lines, company, exportCompany, approved: run.status === 'APPROVED' || run.status === 'PAID' }
}
