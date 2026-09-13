import { createElement, type ReactElement } from 'react'
import type { Prisma } from '@prisma/client'
import { countryName } from '@/lib/countries'
import { formatMoney } from '@/lib/currency'
import { formatPercentChange, salaryChangePercent } from '@/lib/pay-items'
import { periodLabel } from '@/lib/payroll-runs'
import { ageOn, genderLabel, yearsOfService } from '@/lib/people'
import type { Permission } from '@/lib/permissions'
import type { RunInfo } from '@/lib/pdf/run-documents'
import { PayslipBundleDocument } from '@/lib/pdf/run-documents'
import type { TableColumn, TableRow } from '@/lib/pdf/table-document'
import type { Meta } from '@/lib/pdf/theme'
import { TaxCertificatesDocument } from '@/lib/pdf/year-documents'
import { prisma } from '@/lib/prisma'
import { toRunLine } from '@/lib/run-document-data'
import { type ExportFilters, employeeWhere, periodRange, runPeriodWhere } from './filters'

/**
 * Export centre report types. Table reports come out as CSV, Excel or PDF; document reports
 * (payslips, tax certificates) are PDFs with a page per person.
 */

export type ReportContext = { filters: ExportFilters; canSeePay: boolean; canSeeDob: boolean; now: Date }
export type ReportTable = { columns: TableColumn[]; rows: TableRow[]; totals?: TableRow; summary: [string, string][] }
export type ExportFormat = 'csv' | 'xlsx' | 'pdf'

type Base = {
  key: string
  label: string
  description: string
  permission: Permission
  reportType: string
  /** Uses the pay period range filter */
  usesPeriod?: boolean
  /** Uses the tax year filter */
  usesYear?: boolean
}
export type TableReport = Base & { kind: 'table'; formats: ExportFormat[]; build: (ctx: ReportContext) => Promise<ReportTable> }
export type DocumentReport = Base & {
  kind: 'document'
  formats: ['pdf']
  /** Pages the document will have, for the preview and the background threshold */
  count: (ctx: ReportContext) => Promise<number>
  preview: (ctx: ReportContext) => Promise<ReportTable>
  render: (ctx: ReportContext, meta: Meta) => Promise<ReactElement>
}
export type ReportDef = TableReport | DocumentReport

const PAID_OR_APPROVED: Prisma.PayrollRunWhereInput = { status: { in: ['APPROVED', 'PAID'] } }
const round2 = (n: number) => Math.round(n * 100) / 100
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)
const sumBy = <T>(items: T[], pick: (item: T) => number) => round2(items.reduce((t, i) => t + pick(i), 0))

function linesWhere(ctx: ReportContext, runWhere: Prisma.PayrollRunWhereInput): Prisma.PayrollDetailWhereInput {
  return { employee: employeeWhere(ctx.filters, { canSeePay: ctx.canSeePay, now: ctx.now }), payrollRun: { AND: [PAID_OR_APPROVED, runWhere] } }
}

function yearWhere(ctx: ReportContext): Prisma.PayrollRunWhereInput {
  return { year: ctx.filters.year ?? ctx.now.getUTCFullYear() }
}

// ---------------------------------------------------------------------------

const employees: TableReport = {
  key: 'employees',
  label: 'Employee list',
  description: 'People and their details: department, job, dates, age, nationality and bank.',
  permission: 'employees.view',
  reportType: 'EMPLOYEE_LIST',
  kind: 'table',
  formats: ['xlsx', 'csv', 'pdf'],
  async build(ctx) {
    const list = await prisma.employee.findMany({
      where: employeeWhere(ctx.filters, { canSeePay: ctx.canSeePay, now: ctx.now }),
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: ctx.canSeePay ? { salaryConfigs: { where: { effectiveFrom: { lte: ctx.now }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: ctx.now } }] }, take: 1, orderBy: { effectiveFrom: 'desc' } } } : undefined,
    })
    const columns: TableColumn[] = [
      { key: 'id', label: 'Employee ID' },
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Job title' },
      { key: 'status', label: 'Status' },
      { key: 'startDate', label: 'Start date', kind: 'date' },
      { key: 'service', label: 'Years of service', kind: 'number' },
      { key: 'endDate', label: 'End date', kind: 'date' },
      ...(ctx.canSeeDob ? [{ key: 'dateOfBirth', label: 'Date of birth', kind: 'date' as const }] : []),
      { key: 'age', label: 'Age', kind: 'number' },
      { key: 'gender', label: 'Gender' },
      { key: 'nationality', label: 'Nationality' },
      { key: 'phone', label: 'Phone' },
      { key: 'bank', label: 'Bank' },
      ...(ctx.canSeePay ? [{ key: 'basic', label: 'Monthly basic', kind: 'money' as const }] : []),
    ]
    const rows = list.map((e) => ({
      id: e.employeeId,
      name: `${e.firstName} ${e.lastName}`,
      email: e.email,
      department: e.department,
      designation: e.designation,
      status: e.employmentStatus.charAt(0) + e.employmentStatus.slice(1).toLowerCase(),
      startDate: iso(e.startDate),
      service: yearsOfService(e.startDate, e.endDate, ctx.now),
      endDate: iso(e.endDate),
      dateOfBirth: iso(e.dateOfBirth),
      age: e.dateOfBirth ? ageOn(e.dateOfBirth, ctx.now) : null,
      gender: genderLabel(e.gender) || null,
      nationality: e.nationality ? countryName(e.nationality) : null,
      phone: e.phone,
      bank: e.bankName,
      basic: 'salaryConfigs' in e && Array.isArray(e.salaryConfigs) && e.salaryConfigs[0] ? Number(e.salaryConfigs[0].baseSalary) : null,
    }))
    const ages = rows.map((r) => r.age).filter((a): a is number => a !== null)
    return {
      columns,
      rows,
      summary: [
        ['Employees', String(rows.length)],
        ['Departments', String(new Set(rows.map((r) => r.department)).size)],
        ['Average age', ages.length ? `${Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)} years` : '-'],
        ['Average service', rows.length ? `${round2(rows.reduce((t, r) => t + r.service, 0) / rows.length).toFixed(1)} years` : '-'],
      ],
    }
  },
}

const headcount: TableReport = {
  key: 'headcount',
  label: 'Headcount by department',
  description: 'Staff at the end of the period, joiners, leavers, gender split and average age.',
  permission: 'employees.view',
  reportType: 'HEADCOUNT',
  kind: 'table',
  usesPeriod: true,
  formats: ['xlsx', 'csv', 'pdf'],
  async build(ctx) {
    const { from, to } = periodRange(ctx.filters, ctx.now)
    const start = new Date(Date.UTC(from.year, from.month - 1, 1))
    const end = new Date(Date.UTC(to.year, to.month, 0, 23, 59, 59))
    // Leavers have to be counted, so this report always looks at current and former staff
    const list = await prisma.employee.findMany({ where: employeeWhere({ ...ctx.filters, status: 'all' }, { canSeePay: ctx.canSeePay, now: ctx.now }) })
    const departments = [...new Set(list.map((e) => e.department))].sort()
    const rows = departments.map((department) => {
      const group = list.filter((e) => e.department === department)
      const onRoll = group.filter((e) => e.startDate <= end && (!e.endDate || e.endDate >= end))
      const ages = onRoll.filter((e) => e.dateOfBirth).map((e) => ageOn(e.dateOfBirth as Date, end))
      return {
        department,
        headcount: onRoll.length,
        joiners: group.filter((e) => e.startDate >= start && e.startDate <= end).length,
        leavers: group.filter((e) => e.endDate && e.endDate >= start && e.endDate <= end).length,
        male: onRoll.filter((e) => e.gender === 'MALE').length,
        female: onRoll.filter((e) => e.gender === 'FEMALE').length,
        other: onRoll.filter((e) => e.gender === 'OTHER').length,
        averageAge: ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null,
      }
    })
    const n = (key: 'headcount' | 'joiners' | 'leavers' | 'male' | 'female' | 'other') => rows.reduce((t, r) => t + r[key], 0)
    return {
      columns: [
        { key: 'department', label: 'Department' },
        { key: 'headcount', label: 'Headcount at end', kind: 'number' },
        { key: 'joiners', label: 'Joined', kind: 'number' },
        { key: 'leavers', label: 'Left', kind: 'number' },
        { key: 'male', label: 'Male', kind: 'number' },
        { key: 'female', label: 'Female', kind: 'number' },
        { key: 'other', label: 'Other', kind: 'number' },
        { key: 'averageAge', label: 'Average age', kind: 'number' },
      ],
      rows,
      totals: { headcount: n('headcount'), joiners: n('joiners'), leavers: n('leavers'), male: n('male'), female: n('female'), other: n('other') },
      summary: [
        ['Headcount at end', String(n('headcount'))],
        ['Joined', String(n('joiners'))],
        ['Left', String(n('leavers'))],
        ['Turnover', n('headcount') ? `${round2((n('leavers') / n('headcount')) * 100)}%` : '-'],
      ],
    }
  },
}

const earnings: TableReport = {
  key: 'earnings',
  label: 'Earnings summary',
  description: 'Totals per employee across a range of pay periods: gross, PAYE, SSNIT and net pay.',
  permission: 'reports.export',
  reportType: 'EARNINGS_SUMMARY',
  kind: 'table',
  usesPeriod: true,
  formats: ['xlsx', 'csv', 'pdf'],
  async build(ctx) {
    const lines = await prisma.payrollDetail.findMany({ where: linesWhere(ctx, runPeriodWhere(ctx.filters, ctx.now)), orderBy: { employeeName: 'asc' } })
    const byEmployee = new Map<string, typeof lines>()
    for (const line of lines) byEmployee.set(line.employeeId, [...(byEmployee.get(line.employeeId) ?? []), line])
    const rows = [...byEmployee.values()].map((group) => {
      const first = group[0]
      const n = (key: 'baseSalary' | 'allowancesTotal' | 'grossIncome' | 'ssnitEmployee' | 'ssnitEmployer' | 'paye' | 'deductionsTotal' | 'netPay') => sumBy(group, (l) => Number(l[key]))
      return {
        id: first.employeeCode,
        name: first.employeeName,
        department: first.department,
        months: group.length,
        basic: n('baseSalary'),
        allowances: n('allowancesTotal'),
        gross: n('grossIncome'),
        ssnitEmployee: n('ssnitEmployee'),
        ssnitEmployer: n('ssnitEmployer'),
        paye: n('paye'),
        deductions: n('deductionsTotal'),
        net: n('netPay'),
      }
    })
    const total = (key: keyof (typeof rows)[number]) => sumBy(rows, (r) => Number(r[key]))
    return {
      columns: [
        { key: 'id', label: 'Employee ID' },
        { key: 'name', label: 'Name' },
        { key: 'department', label: 'Department' },
        { key: 'months', label: 'Months paid', kind: 'number' },
        { key: 'basic', label: 'Basic', kind: 'money' },
        { key: 'allowances', label: 'Allowances', kind: 'money' },
        { key: 'gross', label: 'Gross', kind: 'money' },
        { key: 'ssnitEmployee', label: 'SSNIT (employee)', kind: 'money' },
        { key: 'ssnitEmployer', label: 'SSNIT (employer)', kind: 'money' },
        { key: 'paye', label: 'PAYE', kind: 'money' },
        { key: 'deductions', label: 'Other deductions', kind: 'money' },
        { key: 'net', label: 'Net pay', kind: 'money' },
      ],
      rows,
      totals: { basic: total('basic'), allowances: total('allowances'), gross: total('gross'), ssnitEmployee: total('ssnitEmployee'), ssnitEmployer: total('ssnitEmployer'), paye: total('paye'), deductions: total('deductions'), net: total('net') },
      summary: [
        ['Employees', String(rows.length)],
        ['Gross pay', formatMoney(total('gross'))],
        ['PAYE', formatMoney(total('paye'))],
        ['Net pay', formatMoney(total('net'))],
      ],
    }
  },
}

const payHistory: TableReport = {
  key: 'pay-history',
  label: 'Pay history',
  description: 'Every payroll line in the period, one row per employee per month.',
  permission: 'reports.export',
  reportType: 'PAY_HISTORY',
  kind: 'table',
  usesPeriod: true,
  formats: ['xlsx', 'csv', 'pdf'],
  async build(ctx) {
    const lines = await prisma.payrollDetail.findMany({
      where: linesWhere(ctx, runPeriodWhere(ctx.filters, ctx.now)),
      include: { payrollRun: { select: { month: true, year: true, status: true } } },
      orderBy: [{ payrollRun: { year: 'asc' } }, { payrollRun: { month: 'asc' } }, { employeeName: 'asc' }],
    })
    const rows = lines.map((l) => ({
      period: periodLabel(l.payrollRun.month, l.payrollRun.year),
      status: l.payrollRun.status === 'PAID' ? 'Paid' : 'Approved',
      id: l.employeeCode,
      name: l.employeeName,
      department: l.department,
      gross: Number(l.grossIncome),
      ssnit: Number(l.ssnitEmployee),
      paye: Number(l.paye),
      deductions: Number(l.deductionsTotal),
      net: Number(l.netPay),
    }))
    return {
      columns: [
        { key: 'period', label: 'Period' },
        { key: 'status', label: 'Run' },
        { key: 'id', label: 'Employee ID' },
        { key: 'name', label: 'Name' },
        { key: 'department', label: 'Department' },
        { key: 'gross', label: 'Gross', kind: 'money' },
        { key: 'ssnit', label: 'SSNIT', kind: 'money' },
        { key: 'paye', label: 'PAYE', kind: 'money' },
        { key: 'deductions', label: 'Other deductions', kind: 'money' },
        { key: 'net', label: 'Net pay', kind: 'money' },
      ],
      rows,
      totals: { gross: sumBy(rows, (r) => r.gross), ssnit: sumBy(rows, (r) => r.ssnit), paye: sumBy(rows, (r) => r.paye), deductions: sumBy(rows, (r) => r.deductions), net: sumBy(rows, (r) => r.net) },
      summary: [
        ['Payroll lines', String(rows.length)],
        ['Pay periods', String(new Set(rows.map((r) => r.period)).size)],
        ['Gross pay', formatMoney(sumBy(rows, (r) => r.gross))],
        ['Net pay', formatMoney(sumBy(rows, (r) => r.net))],
      ],
    }
  },
}

const salaryChanges: TableReport = {
  key: 'salary-changes',
  label: 'Salary changes',
  description: 'Raises, promotions and corrections in the period, with reasons and the percentage change.',
  permission: 'salary.view',
  reportType: 'SALARY_CHANGES',
  kind: 'table',
  usesPeriod: true,
  formats: ['xlsx', 'csv', 'pdf'],
  async build(ctx) {
    const { from, to } = periodRange(ctx.filters, ctx.now)
    const start = new Date(Date.UTC(from.year, from.month - 1, 1))
    const end = new Date(Date.UTC(to.year, to.month, 0, 23, 59, 59))
    const configs = await prisma.salaryConfiguration.findMany({
      where: { effectiveFrom: { gte: start, lte: end }, employee: employeeWhere(ctx.filters, { canSeePay: ctx.canSeePay, now: ctx.now }) },
      include: { employee: { select: { employeeId: true, firstName: true, lastName: true, department: true, salaryConfigs: { select: { effectiveFrom: true, baseSalary: true }, orderBy: { effectiveFrom: 'asc' } } } } },
      orderBy: { effectiveFrom: 'asc' },
    })
    const rows = configs.map((c) => {
      const history = c.employee.salaryConfigs
      const index = history.findIndex((h) => h.effectiveFrom.getTime() === c.effectiveFrom.getTime())
      const previous = index > 0 ? Number(history[index - 1].baseSalary) : null
      const next = Number(c.baseSalary)
      return {
        effective: iso(c.effectiveFrom),
        id: c.employee.employeeId,
        name: `${c.employee.firstName} ${c.employee.lastName}`,
        department: c.employee.department,
        previous,
        next,
        change: previous === null ? 'First salary' : formatPercentChange(salaryChangePercent(previous, next)),
        reason: c.reason,
      }
    })
    return {
      columns: [
        { key: 'effective', label: 'Effective', kind: 'date' },
        { key: 'id', label: 'Employee ID' },
        { key: 'name', label: 'Name' },
        { key: 'department', label: 'Department' },
        { key: 'previous', label: 'Previous basic', kind: 'money' },
        { key: 'next', label: 'New basic', kind: 'money' },
        { key: 'change', label: 'Change' },
        { key: 'reason', label: 'Reason' },
      ],
      rows,
      summary: [
        ['Changes', String(rows.length)],
        ['People affected', String(new Set(rows.map((r) => r.id)).size)],
        ['Increases', String(rows.filter((r) => r.previous !== null && r.next > r.previous).length)],
        ['Decreases', String(rows.filter((r) => r.previous !== null && r.next < r.previous).length)],
      ],
    }
  },
}

const payeAnnual: TableReport = {
  key: 'paye-annual',
  label: 'Annual PAYE reconciliation',
  description: 'PAYE per employee for each month of the tax year, with yearly totals for the GRA annual return.',
  permission: 'reports.export',
  reportType: 'PAYE_RECONCILIATION',
  kind: 'table',
  usesYear: true,
  formats: ['xlsx', 'csv', 'pdf'],
  async build(ctx) {
    const lines = await prisma.payrollDetail.findMany({ where: linesWhere(ctx, yearWhere(ctx)), include: { payrollRun: { select: { month: true } } }, orderBy: { employeeName: 'asc' } })
    const byEmployee = new Map<string, typeof lines>()
    for (const line of lines) byEmployee.set(line.employeeId, [...(byEmployee.get(line.employeeId) ?? []), line])
    const months = Array.from({ length: 12 }, (_, i) => i + 1)
    const monthKey = (m: number) => `m${m}`
    const rows = [...byEmployee.values()].map((group) => {
      const first = group[0]
      const row: TableRow = {
        tin: first.tin,
        id: first.employeeCode,
        name: first.employeeName,
        gross: sumBy(group, (l) => Number(l.grossIncome)),
        ssnit: sumBy(group, (l) => Number(l.ssnitEmployee)),
        chargeable: sumBy(group, (l) => Number(l.taxableIncome)),
        paye: sumBy(group, (l) => Number(l.paye)),
      }
      for (const m of months) row[monthKey(m)] = sumBy(group.filter((l) => l.payrollRun.month === m), (l) => Number(l.paye))
      return row
    })
    const totals: TableRow = {}
    for (const key of ['gross', 'ssnit', 'chargeable', 'paye', ...months.map(monthKey)]) totals[key] = sumBy(rows, (r) => Number(r[key] ?? 0))
    const monthName = (m: number) => new Date(Date.UTC(2000, m - 1, 1)).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })
    return {
      columns: [
        { key: 'tin', label: 'TIN' },
        { key: 'id', label: 'Employee ID' },
        { key: 'name', label: 'Name' },
        ...months.map((m) => ({ key: monthKey(m), label: monthName(m), kind: 'money' as const })),
        { key: 'gross', label: 'Gross income', kind: 'money' },
        { key: 'ssnit', label: 'SSNIT', kind: 'money' },
        { key: 'chargeable', label: 'Chargeable', kind: 'money' },
        { key: 'paye', label: 'PAYE total', kind: 'money' },
      ],
      rows,
      totals,
      summary: [
        ['Employees', String(rows.length)],
        ['Gross income', formatMoney(Number(totals.gross))],
        ['Chargeable income', formatMoney(Number(totals.chargeable))],
        ['PAYE for the year', formatMoney(Number(totals.paye))],
      ],
    }
  },
}

// ---------------------------------------------------------------------------
// Documents

const payslips: DocumentReport = {
  key: 'payslips',
  label: 'Payslips',
  description: 'Payslips for the people and periods you choose, one page each, in a single PDF.',
  permission: 'reports.export',
  reportType: 'PAYSLIP',
  kind: 'document',
  usesPeriod: true,
  formats: ['pdf'],
  count: (ctx) => prisma.payrollDetail.count({ where: linesWhere(ctx, runPeriodWhere(ctx.filters, ctx.now)) }),
  async preview(ctx) {
    const lines = await prisma.payrollDetail.findMany({
      where: linesWhere(ctx, runPeriodWhere(ctx.filters, ctx.now)),
      include: { payrollRun: { select: { month: true, year: true } } },
      orderBy: [{ payrollRun: { year: 'asc' } }, { payrollRun: { month: 'asc' } }, { employeeName: 'asc' }],
    })
    return {
      columns: [
        { key: 'period', label: 'Period' },
        { key: 'id', label: 'Employee ID' },
        { key: 'name', label: 'Name' },
        { key: 'net', label: 'Net pay', kind: 'money' },
      ],
      rows: lines.map((l) => ({ period: periodLabel(l.payrollRun.month, l.payrollRun.year), id: l.employeeCode, name: l.employeeName, net: Number(l.netPay) })),
      summary: [
        ['Payslips', String(lines.length)],
        ['Employees', String(new Set(lines.map((l) => l.employeeId)).size)],
      ],
    }
  },
  async render(ctx, meta) {
    const lines = await prisma.payrollDetail.findMany({
      where: linesWhere(ctx, runPeriodWhere(ctx.filters, ctx.now)),
      include: { payrollRun: { select: { month: true, year: true, status: true, paidAt: true } } },
      orderBy: [{ employeeName: 'asc' }, { payrollRun: { year: 'asc' } }, { payrollRun: { month: 'asc' } }],
    })
    const entries = lines.map((l) => {
      const run: RunInfo = { period: periodLabel(l.payrollRun.month, l.payrollRun.year), month: l.payrollRun.month, year: l.payrollRun.year, status: l.payrollRun.status, notes: null, createdBy: null, submittedBy: null, submittedAt: null, approvals: [], paidAt: l.payrollRun.paidAt }
      return { run, line: toRunLine(l) }
    })
    return createElement(PayslipBundleDocument, { meta, title: 'Payslips', entries })
  },
}

async function certificateData(ctx: ReportContext) {
  const lines = await prisma.payrollDetail.findMany({ where: linesWhere(ctx, yearWhere(ctx)), include: { payrollRun: { select: { month: true } } }, orderBy: [{ employeeName: 'asc' }] })
  const byEmployee = new Map<string, typeof lines>()
  for (const line of lines) byEmployee.set(line.employeeId, [...(byEmployee.get(line.employeeId) ?? []), line])
  return [...byEmployee.values()].map((group) => {
    const latest = group[group.length - 1]
    return {
      employeeCode: latest.employeeCode,
      employeeName: latest.employeeName,
      designation: latest.designation,
      tin: latest.tin,
      ssnitNumber: latest.ssnitNumber,
      months: group
        .map((l) => ({ month: l.payrollRun.month, grossIncome: Number(l.grossIncome), ssnitEmployee: Number(l.ssnitEmployee), taxableIncome: Number(l.taxableIncome), paye: Number(l.paye) }))
        .sort((a, b) => a.month - b.month),
    }
  })
}

const taxCertificates: DocumentReport = {
  key: 'tax-certificates',
  label: 'Annual tax certificates',
  description: 'A certificate per employee showing income, SSNIT and PAYE for each month of the tax year.',
  permission: 'reports.export',
  reportType: 'TAX_CERTIFICATE',
  kind: 'document',
  usesYear: true,
  formats: ['pdf'],
  count: async (ctx) => (await prisma.payrollDetail.groupBy({ by: ['employeeId'], where: linesWhere(ctx, yearWhere(ctx)) })).length,
  async preview(ctx) {
    const data = await certificateData(ctx)
    return {
      columns: [
        { key: 'id', label: 'Employee ID' },
        { key: 'name', label: 'Name' },
        { key: 'months', label: 'Months paid', kind: 'number' },
        { key: 'gross', label: 'Gross income', kind: 'money' },
        { key: 'paye', label: 'PAYE', kind: 'money' },
      ],
      rows: data.map((e) => ({ id: e.employeeCode, name: e.employeeName, months: e.months.length, gross: sumBy(e.months, (m) => m.grossIncome), paye: sumBy(e.months, (m) => m.paye) })),
      summary: [['Certificates', String(data.length)]],
    }
  },
  async render(ctx, meta) {
    return createElement(TaxCertificatesDocument, { meta, year: ctx.filters.year ?? ctx.now.getUTCFullYear(), employees: await certificateData(ctx), signatory: meta.generatedBy })
  },
}

export const REPORTS: ReportDef[] = [employees, headcount, earnings, payHistory, salaryChanges, payeAnnual, payslips, taxCertificates]

export function findReport(key: string | null | undefined) {
  return REPORTS.find((r) => r.key === key) ?? null
}
