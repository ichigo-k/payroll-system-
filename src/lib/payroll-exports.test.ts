import { describe, expect, it } from 'vitest'
import { buildExport, csvCell, type ExportLine, exportFilename } from './payroll-exports'

const line: ExportLine = {
  employeeCode: 'EMP-001',
  employeeName: 'Ama Mensah',
  department: 'Finance',
  designation: 'Accounts officer',
  bankName: 'GCB Bank',
  accountName: 'Ama Mensah',
  accountNumber: '1011130012345',
  ssnitNumber: 'C123456789012',
  tin: 'GHA-712345678-9',
  baseSalary: 4000,
  allowancesTotal: 600,
  grossIncome: 4600,
  ssnitEmployee: 220,
  ssnitEmployer: 520,
  reliefs: 0,
  taxableIncome: 4380,
  paye: 850.25,
  deductionsTotal: 100,
  totalDeductions: 1170.25,
  netPay: 3429.75,
}
const company = { companyName: 'Ghana Payroll Corp', taxId: 'P0000000000', employerSsnitNumber: 'E1234', bankName: 'GCB Bank', bankAccountNumber: '999' }
const run = { month: 9, year: 2026, status: 'APPROVED' }

describe('csvCell', () => {
  it('quotes separators and neutralises spreadsheet formulas', () => {
    expect(csvCell('Mensah, Jr.')).toBe('"Mensah, Jr."')
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('-12.50')).toBe('-12.50')
  })
})

describe('buildExport', () => {
  it('builds a bank schedule with net pay, narration and a total row', () => {
    const csv = buildExport('bank', run, [line, { ...line, employeeCode: 'EMP-002', netPay: 1000.25 }], company)
    const rows = csv.replace('﻿', '').trim().split('\r\n')
    expect(rows[0]).toBe('#,Employee ID,Beneficiary name,Bank,Account number,Amount (GHS),Narration')
    expect(rows[1]).toBe('1,EMP-001,Ama Mensah,GCB Bank,1011130012345,3429.75,Salary September 2026')
    expect(rows[3]).toContain('TOTAL,,,4430.00')
  })

  it('splits SSNIT into Tier 1 and Tier 2', () => {
    const csv = buildExport('ssnit', run, [line], company)
    // total 740 = 13.5% + 5% of 4000 -> tier 1 540, tier 2 200
    expect(csv).toContain('C123456789012,EMP-001,Ama Mensah,4000.00,220.00,520.00,740.00,540.00,200.00')
    expect(csv).toContain('Employer SSNIT number: E1234')
  })

  it('includes TIN and chargeable income on the PAYE schedule', () => {
    expect(buildExport('paye', run, [line], company)).toContain('GHA-712345678-9,EMP-001,Ama Mensah,Accounts officer,4000.00,600.00,4600.00,220.00,0.00,4380.00,850.25')
  })

  it('marks unapproved exports in the filename', () => {
    expect(exportFilename('register', run, company)).toBe('ghana-payroll-corp-register-2026-09.csv')
    expect(exportFilename('register', { ...run, status: 'DRAFT' }, company)).toBe('ghana-payroll-corp-register-2026-09-UNAPPROVED.csv')
  })
})
