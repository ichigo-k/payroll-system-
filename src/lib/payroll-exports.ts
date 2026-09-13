/**
 * Financial documents generated from a payroll run's snapshot lines, as CSV (opens in Excel).
 * Column layouts follow common Ghanaian formats; banks and GRA offices can differ, so check
 * them against the template your bank or tax office gives you.
 */

export type ExportLine = {
  employeeCode: string
  employeeName: string
  department: string
  designation: string | null
  bankName: string | null
  accountName: string | null
  accountNumber: string | null
  ssnitNumber: string | null
  tin: string | null
  baseSalary: number
  allowancesTotal: number
  grossIncome: number
  ssnitEmployee: number
  ssnitEmployer: number
  reliefs: number
  taxableIncome: number
  paye: number
  deductionsTotal: number
  totalDeductions: number
  netPay: number
}

export type ExportRun = { month: number; year: number; status: string }
export type ExportCompany = { companyName: string; taxId: string | null; employerSsnitNumber: string | null; bankName: string | null; bankAccountNumber: string | null }

export const EXPORT_TYPES = {
  bank: { label: 'Bank payment schedule', description: 'Net pay per employee with bank details, for your bank’s bulk payment upload.', requiresApproval: true, reportType: 'BANK_TRANSFER' },
  paye: { label: 'PAYE schedule (GRA)', description: 'Chargeable income and PAYE per employee for the monthly GRA return.', requiresApproval: false, reportType: 'TAX_REPORT' },
  ssnit: { label: 'SSNIT contribution report', description: 'Employee and employer contributions with Tier 1 and Tier 2 split.', requiresApproval: false, reportType: 'STATUTORY_REPORT' },
  register: { label: 'Payroll register', description: 'Every earning and deduction for every employee in this run.', requiresApproval: false, reportType: 'SALARY_DETAILS' },
} as const
export type ExportType = keyof typeof EXPORT_TYPES

// Tier 2 is the 5% of basic salary paid to a private occupational pension trustee; Tier 1 is the rest
const TIER_2_RATE = 5

const money = (value: number) => (Math.round(value * 100) / 100).toFixed(2)
const round2 = (value: number) => Math.round(value * 100) / 100

export function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value)
  // Neutralise spreadsheet formulas and quote anything with separators
  const safe = /^[=+\-@]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

function toCsv(rows: (string | number | null)[][]) {
  // BOM so Excel opens UTF-8 correctly
  return `﻿${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

function monthName(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
}

export function exportFilename(type: ExportType, run: ExportRun, company: ExportCompany) {
  const slug = company.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'paycompass'
  const period = `${run.year}-${String(run.month).padStart(2, '0')}`
  const draft = run.status === 'APPROVED' || run.status === 'PAID' ? '' : '-UNAPPROVED'
  return `${slug}-${type}-${period}${draft}.csv`
}

export function buildExport(type: ExportType, run: ExportRun, lines: ExportLine[], company: ExportCompany): string {
  const period = monthName(run.month, run.year)
  const sum = (key: keyof ExportLine) => round2(lines.reduce((total, line) => total + Number(line[key] ?? 0), 0))

  switch (type) {
    case 'bank':
      return toCsv([
        ['#', 'Employee ID', 'Beneficiary name', 'Bank', 'Account number', 'Amount (GHS)', 'Narration'],
        ...lines.map((line, i) => [i + 1, line.employeeCode, line.accountName || line.employeeName, line.bankName, line.accountNumber, money(line.netPay), `Salary ${period}`]),
        ['', '', 'TOTAL', '', '', money(sum('netPay')), `${lines.length} payments from ${company.bankName ?? 'company account'} ${company.bankAccountNumber ?? ''}`.trim()],
      ])
    case 'paye':
      return toCsv([
        [`Employer: ${company.companyName}`, `Employer TIN: ${company.taxId ?? ''}`, `Period: ${period}`],
        [],
        ['#', 'TIN / Ghana Card', 'Employee ID', 'Employee name', 'Position', 'Basic salary', 'Allowances', 'Gross income', 'SSNIT (employee)', 'Reliefs', 'Chargeable income', 'PAYE'],
        ...lines.map((line, i) => [i + 1, line.tin, line.employeeCode, line.employeeName, line.designation, money(line.baseSalary), money(line.allowancesTotal), money(line.grossIncome), money(line.ssnitEmployee), money(line.reliefs), money(line.taxableIncome), money(line.paye)]),
        ['', '', '', 'TOTAL', '', money(sum('baseSalary')), money(sum('allowancesTotal')), money(sum('grossIncome')), money(sum('ssnitEmployee')), money(sum('reliefs')), money(sum('taxableIncome')), money(sum('paye'))],
      ])
    case 'ssnit': {
      const rows = lines.map((line) => {
        const total = round2(line.ssnitEmployee + line.ssnitEmployer)
        const tier2 = round2((line.baseSalary * TIER_2_RATE) / 100)
        return { line, total, tier1: round2(total - tier2), tier2 }
      })
      return toCsv([
        [`Employer: ${company.companyName}`, `Employer SSNIT number: ${company.employerSsnitNumber ?? ''}`, `Period: ${period}`],
        [],
        ['#', 'SSNIT number', 'Employee ID', 'Employee name', 'Basic salary', 'Employee contribution', 'Employer contribution', 'Total contribution', 'Tier 1 (SSNIT)', 'Tier 2 (occupational)'],
        ...rows.map(({ line, total, tier1, tier2 }, i) => [i + 1, line.ssnitNumber, line.employeeCode, line.employeeName, money(line.baseSalary), money(line.ssnitEmployee), money(line.ssnitEmployer), money(total), money(tier1), money(tier2)]),
        [
          '',
          '',
          '',
          'TOTAL',
          money(sum('baseSalary')),
          money(sum('ssnitEmployee')),
          money(sum('ssnitEmployer')),
          money(rows.reduce((t, r) => t + r.total, 0)),
          money(rows.reduce((t, r) => t + r.tier1, 0)),
          money(rows.reduce((t, r) => t + r.tier2, 0)),
        ],
      ])
    }
    case 'register':
      return toCsv([
        ['#', 'Employee ID', 'Employee name', 'Department', 'Position', 'Basic salary', 'Allowances', 'Gross income', 'SSNIT (employee)', 'SSNIT (employer)', 'Reliefs', 'Chargeable income', 'PAYE', 'Other deductions', 'Total deductions', 'Net pay', 'Bank', 'Account number'],
        ...lines.map((line, i) => [
          i + 1,
          line.employeeCode,
          line.employeeName,
          line.department,
          line.designation,
          money(line.baseSalary),
          money(line.allowancesTotal),
          money(line.grossIncome),
          money(line.ssnitEmployee),
          money(line.ssnitEmployer),
          money(line.reliefs),
          money(line.taxableIncome),
          money(line.paye),
          money(line.deductionsTotal),
          money(line.totalDeductions),
          money(line.netPay),
          line.bankName,
          line.accountNumber,
        ]),
        [
          '',
          '',
          'TOTAL',
          '',
          '',
          money(sum('baseSalary')),
          money(sum('allowancesTotal')),
          money(sum('grossIncome')),
          money(sum('ssnitEmployee')),
          money(sum('ssnitEmployer')),
          money(sum('reliefs')),
          money(sum('taxableIncome')),
          money(sum('paye')),
          money(sum('deductionsTotal')),
          money(sum('totalDeductions')),
          money(sum('netPay')),
          '',
          '',
        ],
      ])
  }
}
