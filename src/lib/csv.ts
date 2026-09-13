/** Splits one CSV line, honouring double-quoted fields that contain commas or escaped quotes. */
export function parseCsvLine(line: string) {
  const values: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        quoted = !quoted
      }
    } else if (char === ',' && !quoted) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim())
  return values
}

export const EMPLOYEE_IMPORT_COLUMNS = {
  required: ['first_name', 'last_name', 'email', 'employee_id', 'start_date'],
  optional: ['department', 'designation', 'phone', 'ssnit_number'],
} as const

export type EmployeeImportRow = {
  line: number
  firstName: string
  lastName: string
  email: string
  employeeId: string
  startDate: string
  department: string
  designation: string
  phone: string
  ssnitNumber: string
  errors: string[]
}

/** Parses an employee import CSV into rows with per-row validation messages. Shared by the preview and the server. */
export function parseEmployeeCsv(csv: string): { rows: EmployeeImportRow[]; error?: string } {
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2) return { rows: [], error: 'The file has no employee rows.' }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'))
  const missing = EMPLOYEE_IMPORT_COLUMNS.required.filter((h) => !headers.includes(h))
  if (missing.length) return { rows: [], error: `Missing required columns: ${missing.join(', ')}.` }

  const col = (values: string[], header: string) => {
    const index = headers.indexOf(header)
    return index >= 0 ? (values[index] ?? '').trim() : ''
  }

  const seenEmails = new Set<string>()
  const seenIds = new Set<string>()
  const rows = lines.slice(1).map((line, i) => {
    const values = parseCsvLine(line)
    const row: EmployeeImportRow = {
      line: i + 2,
      firstName: col(values, 'first_name'),
      lastName: col(values, 'last_name'),
      email: col(values, 'email').toLowerCase(),
      employeeId: col(values, 'employee_id'),
      startDate: col(values, 'start_date'),
      department: col(values, 'department'),
      designation: col(values, 'designation'),
      phone: col(values, 'phone'),
      ssnitNumber: col(values, 'ssnit_number'),
      errors: [],
    }
    if (!row.firstName) row.errors.push('First name is missing')
    if (!row.lastName) row.errors.push('Last name is missing')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) row.errors.push('Email is missing or invalid')
    if (!row.employeeId) row.errors.push('Employee ID is missing')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.startDate) || Number.isNaN(new Date(row.startDate).getTime())) row.errors.push('Start date must be YYYY-MM-DD')
    if (row.email && seenEmails.has(row.email)) row.errors.push('Email appears earlier in this file')
    if (row.employeeId && seenIds.has(row.employeeId)) row.errors.push('Employee ID appears earlier in this file')
    seenEmails.add(row.email)
    seenIds.add(row.employeeId)
    return row
  })
  return { rows }
}
