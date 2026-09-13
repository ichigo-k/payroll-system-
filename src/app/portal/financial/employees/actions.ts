'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth-config'
import { parseEmployeeCsv } from '@/lib/csv'
import { ensureDepartment } from '@/lib/departments'
import { prisma } from '@/lib/prisma'

export type ActionState = {
  status: 'idle' | 'success' | 'error'
  message?: string
  fieldErrors?: Record<string, string>
  /** Submitted values, so the form keeps what was typed when there are errors */
  values?: Record<string, string>
}

async function requireEditor() {
  const session = await auth()
  if (!session?.user?.id || !['ADMIN', 'PREPARER'].includes(session.user.role)) return null
  return session.user.id
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

export async function createEmployee(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireEditor()
  if (!userId) return { status: 'error', message: 'Only administrators and payroll preparers can add employees.' }

  const data = {
    firstName: text(formData, 'firstName'),
    lastName: text(formData, 'lastName'),
    email: text(formData, 'email').toLowerCase(),
    phone: text(formData, 'phone'),
    employeeId: text(formData, 'employeeId'),
    ssnitNumber: text(formData, 'ssnitNumber'),
    department: text(formData, 'department'),
    designation: text(formData, 'designation'),
    startDate: text(formData, 'startDate'),
    bankName: text(formData, 'bankName'),
    accountName: text(formData, 'accountName'),
    accountNumber: text(formData, 'accountNumber'),
  }

  const fieldErrors: Record<string, string> = {}
  if (!data.firstName) fieldErrors.firstName = 'Enter a first name.'
  if (!data.lastName) fieldErrors.lastName = 'Enter a last name.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) fieldErrors.email = 'Enter a valid work email.'
  if (!data.employeeId) fieldErrors.employeeId = 'Enter an employee ID.'
  if (!data.department) fieldErrors.department = 'Choose or add a department.'
  if (!data.startDate || Number.isNaN(new Date(data.startDate).getTime())) fieldErrors.startDate = 'Choose a start date.'
  if (Object.keys(fieldErrors).length) return { status: 'error', message: 'Fix the highlighted fields.', fieldErrors, values: data }

  try {
    await prisma.$transaction(async (tx) => {
      // New departments typed into the picker are saved here, so they're available next time
      const department = await ensureDepartment(data.department, tx)
      await tx.employee.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone || null,
          employeeId: data.employeeId,
          ssnit_number: data.ssnitNumber || null,
          department,
          designation: data.designation || null,
          startDate: new Date(data.startDate),
          bankName: data.bankName || null,
          accountName: data.accountName || null,
          accountNumber: data.accountNumber || null,
          createdBy: userId,
        },
      })
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = String((err.meta as { target?: unknown } | undefined)?.target ?? '')
      if (target.includes('email')) return { status: 'error', message: 'Fix the highlighted fields.', fieldErrors: { email: 'An employee with this email already exists.' }, values: data }
      if (target.includes('ssnit')) return { status: 'error', message: 'Fix the highlighted fields.', fieldErrors: { ssnitNumber: 'This SSNIT number is already on another employee.' }, values: data }
      if (target.includes('employee')) return { status: 'error', message: 'Fix the highlighted fields.', fieldErrors: { employeeId: 'This employee ID is already in use.' }, values: data }
      return { status: 'error', message: 'An employee with these details already exists.', values: data }
    }
    throw err
  }

  revalidatePath('/portal/financial/employees')
  revalidatePath('/portal/financial')
  return { status: 'success', message: `${data.firstName} ${data.lastName} was added.` }
}

export async function importEmployees(formData: FormData) {
  const userId = await requireEditor()
  if (!userId) throw new Error('Only administrators and payroll preparers can import employees.')

  const { rows, error } = parseEmployeeCsv(String(formData.get('csv') ?? ''))
  if (error) throw new Error(error)
  const valid = rows.filter((row) => row.errors.length === 0)
  if (valid.length === 0) throw new Error('No rows are ready to import. Fix the errors in the file and try again.')

  const existing = await prisma.employee.findMany({
    where: { OR: [{ email: { in: valid.map((row) => row.email) } }, { employeeId: { in: valid.map((row) => row.employeeId) } }] },
    select: { email: true, employeeId: true },
  })
  const takenEmails = new Set(existing.map((e) => e.email))
  const takenIds = new Set(existing.map((e) => e.employeeId))
  const fresh = valid.filter((row) => !takenEmails.has(row.email) && !takenIds.has(row.employeeId))

  // Create each distinct department once, reusing existing spellings
  const departmentNames = new Map<string, string>()
  for (const row of fresh) {
    const key = (row.department || 'General').toLowerCase()
    if (!departmentNames.has(key)) departmentNames.set(key, await ensureDepartment(row.department || 'General'))
  }

  if (fresh.length) {
    await prisma.employee.createMany({
      skipDuplicates: true,
      data: fresh.map((row) => ({
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        employeeId: row.employeeId,
        startDate: new Date(row.startDate),
        department: departmentNames.get((row.department || 'General').toLowerCase()) ?? 'General',
        designation: row.designation || null,
        phone: row.phone || null,
        ssnit_number: row.ssnitNumber || null,
        createdBy: userId,
      })),
    })
  }

  revalidatePath('/portal/financial/employees')
  revalidatePath('/portal/financial')
  return {
    imported: fresh.length,
    duplicates: valid.length - fresh.length,
    invalid: rows.length - valid.length,
    departmentsCreated: departmentNames.size,
  }
}
