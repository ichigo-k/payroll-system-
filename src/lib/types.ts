import type { Role } from '@prisma/client'

// User types
export interface SessionUser {
  id: string
  email: string
  role: Role
  firstName: string | null
  lastName: string | null
}

// Payroll types
export interface PayrollCalculation {
  baseSalary: number
  allowancesTotal: number
  deductionsTotal: number
  grossIncome: number
  taxableIncome: number
  paye: number
  ssnitEmployee: number
  ssnitEmployer: number
  totalDeductions: number
  netPay: number
}

// Tax brackets for Ghana
export interface TaxBracket {
  min: number
  max: number
  rate: number
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Form types
export interface CreateEmployeeForm {
  firstName: string
  lastName: string
  email: string
  employeeId: string
  ssnit_number?: string
  department: string
  designation?: string
  startDate: Date
  bankName?: string
  accountNumber?: string
  accountName?: string
}

export interface CreatePayrollForm {
  month: number
  year: number
}
