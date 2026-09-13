'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'

export type ActionState = { status: 'idle' | 'success' | 'error'; message?: string }

async function requireEditor() {
  const session = await auth()
  if (!session?.user?.id || !['ADMIN', 'PREPARER'].includes(session.user.role)) return null
  return session.user.id
}

export async function createEmployee(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireEditor()
  if (!userId) return { status: 'error', message: 'Only administrators and payroll preparers can add employees.' }

  const firstName = String(formData.get('firstName') ?? '').trim()
  const lastName = String(formData.get('lastName') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const employeeId = String(formData.get('employeeId') ?? '').trim()
  const department = String(formData.get('department') ?? 'General').trim() || 'General'
  const startDate = String(formData.get('startDate') ?? '')

  if (!firstName || !lastName || !email || !employeeId || !startDate) {
    return { status: 'error', message: 'Complete all required fields.' }
  }

  try {
    await prisma.employee.create({
      data: { firstName, lastName, email, employeeId, department, startDate: new Date(startDate), createdBy: userId },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { status: 'error', message: 'An employee with this email or employee ID already exists.' }
    }
    throw err
  }

  revalidatePath('/portal/financial/employees')
  revalidatePath('/portal/financial')
  return { status: 'success', message: `${firstName} ${lastName} was added.` }
}

/** Splits one CSV line, honouring double-quoted fields that contain commas. */
function parseCsvLine(line: string) {
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

export async function importEmployees(formData: FormData) {
  const userId = await requireEditor()
  if (!userId) throw new Error('Only administrators and payroll preparers can import employees.')
  const csv = String(formData.get('csv') ?? '')
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2) throw new Error('The file has no employee rows.')
  const headers = parseCsvLine(lines[0]).map((value) => value.toLowerCase())
  const required = ['first_name', 'last_name', 'email', 'employee_id', 'start_date']
  const missing = required.filter((header) => !headers.includes(header))
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}.`)
  const index = (header: string) => headers.indexOf(header)
  const rows = lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line)
    const firstName = values[index('first_name')] ?? ''
    const lastName = values[index('last_name')] ?? ''
    const email = (values[index('email')] ?? '').toLowerCase()
    const employeeId = values[index('employee_id')] ?? ''
    const startDate = values[index('start_date')] ?? ''
    if (!firstName || !lastName || !email || !employeeId || !startDate || Number.isNaN(new Date(startDate).getTime())) {
      throw new Error(`Row ${rowIndex + 2} is missing a required value or has an invalid start date.`)
    }
    return { firstName, lastName, email, employeeId, startDate: new Date(startDate), department: (index('department') >= 0 && values[index('department')]) || 'General', createdBy: userId }
  })
  const existing = await prisma.employee.findMany({ where: { OR: [{ email: { in: rows.map((row) => row.email) } }, { employeeId: { in: rows.map((row) => row.employeeId) } }] }, select: { email: true, employeeId: true } })
  const seenEmails = new Set(existing.map((employee) => employee.email))
  const seenIds = new Set(existing.map((employee) => employee.employeeId))
  const fresh = rows.filter((row) => {
    if (seenEmails.has(row.email) || seenIds.has(row.employeeId)) return false
    seenEmails.add(row.email)
    seenIds.add(row.employeeId)
    return true
  })
  if (fresh.length) await prisma.employee.createMany({ data: fresh, skipDuplicates: true })
  revalidatePath('/portal/financial/employees')
  revalidatePath('/portal/financial')
  return { imported: fresh.length, skipped: rows.length - fresh.length }
}
