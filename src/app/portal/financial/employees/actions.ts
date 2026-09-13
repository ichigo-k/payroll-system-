'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { audit, diff, requirePermission } from '@/lib/access'
import { parseEmployeeCsv } from '@/lib/csv'
import { findCountryCode } from '@/lib/countries'
import { ensureDepartment } from '@/lib/departments'
import { generateEmployeeIds } from '@/lib/employee-ids'
import { sendNotificationEmail } from '@/lib/email'
import { notify, userIdsWithRoles } from '@/lib/notifications'
import { checkDateOfBirth, parseGender } from '@/lib/people'
import { prisma } from '@/lib/prisma'

export type ActionState = {
  status: 'idle' | 'success' | 'error'
  message?: string
  fieldErrors?: Record<string, string>
  /** Submitted values, so the form keeps what was typed when there are errors */
  values?: Record<string, string>
  employeeId?: string
}

const EMPLOYMENT_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED'] as const

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function readForm(formData: FormData) {
  return {
    firstName: text(formData, 'firstName'),
    lastName: text(formData, 'lastName'),
    email: text(formData, 'email').toLowerCase(),
    phone: text(formData, 'phone'),
    dateOfBirth: text(formData, 'dateOfBirth'),
    gender: text(formData, 'gender'),
    nationality: text(formData, 'nationality'),
    address: text(formData, 'address'),
    city: text(formData, 'city'),
    department: text(formData, 'department'),
    designation: text(formData, 'designation'),
    startDate: text(formData, 'startDate'),
    employmentStatus: text(formData, 'employmentStatus') || 'ACTIVE',
    bankName: text(formData, 'bankName'),
    accountName: text(formData, 'accountName'),
    accountNumber: text(formData, 'accountNumber'),
  }
}
type FormValues = ReturnType<typeof readForm>

function validate(data: FormValues, { creating }: { creating: boolean }) {
  const fieldErrors: Record<string, string> = {}
  // Required for new people; older records can be saved without it and are flagged instead
  const dobError = checkDateOfBirth(data.dateOfBirth, { required: creating })
  if (dobError) fieldErrors.dateOfBirth = dobError
  if (data.gender && !parseGender(data.gender)) fieldErrors.gender = 'Choose a gender.'
  if (data.nationality && !findCountryCode(data.nationality)) fieldErrors.nationality = 'Choose a country from the list.'
  if (!data.firstName) fieldErrors.firstName = 'Enter a first name.'
  if (!data.lastName) fieldErrors.lastName = 'Enter a last name.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) fieldErrors.email = 'Enter a valid work email.'
  if (!data.department) fieldErrors.department = 'Choose or add a department.'
  if (!data.startDate || Number.isNaN(new Date(data.startDate).getTime())) fieldErrors.startDate = 'Choose a start date.'
  if (!(EMPLOYMENT_STATUSES as readonly string[]).includes(data.employmentStatus)) fieldErrors.employmentStatus = 'Choose a status.'
  return fieldErrors
}

function uniqueError(err: unknown, data: FormValues): ActionState | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return null
  const target = String((err.meta as { target?: unknown } | undefined)?.target ?? '')
  const fieldErrors: Record<string, string> | undefined = target.includes('email') ? { email: 'An employee with this email already exists.' } : undefined
  return { status: 'error', message: fieldErrors ? 'Fix the highlighted fields.' : 'An employee with these details already exists.', fieldErrors, values: data }
}

function toRecord(data: FormValues, department: string) {
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone || null,
    dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
    gender: parseGender(data.gender),
    nationality: findCountryCode(data.nationality),
    address: data.address.slice(0, 200) || null,
    city: data.city.slice(0, 80) || null,
    department,
    designation: data.designation || null,
    startDate: new Date(data.startDate),
    bankName: data.bankName || null,
    accountName: data.accountName || null,
    accountNumber: data.accountNumber || null,
  }
}

function refresh(id?: string) {
  revalidatePath('/portal/financial/employees')
  revalidatePath('/portal/financial/salary')
  revalidatePath('/portal/financial')
  if (id) revalidatePath(`/portal/financial/employees/${id}`)
}

export async function createEmployee(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission('employees.edit')
  if (!actor) return { status: 'error', message: 'Only administrators can add employees.' }

  const data = readForm(formData)
  const fieldErrors = validate(data, { creating: true })
  if (Object.keys(fieldErrors).length) return { status: 'error', message: 'Fix the highlighted fields.', fieldErrors, values: data }

  let created: { id: string; employeeId: string } | null = null
  // Employee IDs are generated, not typed. Retry if someone else took the same number at the same moment.
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    try {
      created = await prisma.$transaction(async (tx) => {
        const [employeeId] = await generateEmployeeIds(1, tx)
        // New departments typed into the picker are saved here, so they're available next time
        const department = await ensureDepartment(data.department, tx)
        const employee = await tx.employee.create({ data: { ...toRecord(data, department), employeeId, employmentStatus: 'ACTIVE', createdBy: actor.id }, select: { id: true, employeeId: true } })
        await audit({ userId: actor.id, action: 'CREATE', entityType: 'Employee', entityId: employee.id, changes: { name: `${data.firstName} ${data.lastName}`, employeeId, department } }, tx)
        return employee
      })
    } catch (err) {
      const clash = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && String((err.meta as { target?: unknown } | undefined)?.target ?? '').includes('employeeId')
      if (clash && attempt < 2) continue
      const handled = uniqueError(err, data)
      if (handled) return handled
      throw err
    }
  }
  if (!created) return { status: 'error', message: 'Couldn’t assign an employee ID. Please try again.', values: data }

  // Hand over to payroll: preparers set up salary, SSNIT and TIN
  await notify(await userIdsWithRoles(['PREPARER'], [actor.id]), {
    type: 'EMPLOYEE_ADDED',
    title: `${data.firstName} ${data.lastName} needs pay set up`,
    body: `Added as ${created.employeeId}, starting ${new Date(data.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}. Set their salary, SSNIT number and TIN.`,
    href: `/portal/financial/employees/${created.id}?tab=pay&edit=salary`,
  })

  refresh()
  return { status: 'success', message: `${data.firstName} ${data.lastName} was added as ${created.employeeId}. Payroll preparers have been asked to set up their pay.`, employeeId: created.id }
}

export async function updateEmployee(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission('employees.edit')
  if (!actor) return { status: 'error', message: 'Only administrators can edit employees.' }

  const id = text(formData, 'id')
  const existing = await prisma.employee.findUnique({ where: { id } })
  if (!existing) return { status: 'error', message: 'That employee no longer exists.' }

  const data = readForm(formData)
  // Leaving and returning go through Offboard and Reinstate, which record the date and reason
  if (existing.employmentStatus === 'TERMINATED') data.employmentStatus = 'TERMINATED'
  const fieldErrors = validate(data, { creating: false })
  if (data.employmentStatus === 'TERMINATED' && existing.employmentStatus !== 'TERMINATED') fieldErrors.employmentStatus = 'To record someone leaving, use Offboard on their profile.'
  if (Object.keys(fieldErrors).length) return { status: 'error', message: 'Fix the highlighted fields.', fieldErrors, values: data }
  const bankFields = ['bankName', 'accountName', 'accountNumber'] as const
  if (actor.employeeId === id && bankFields.some((key) => (existing[key] ?? '') !== data[key])) {
    return { status: 'error', message: 'You can’t change your own bank details. Ask another administrator.', values: data }
  }

  let changes: Record<string, { from: unknown; to: unknown }> = {}
  try {
    await prisma.$transaction(async (tx) => {
      const department = await ensureDepartment(data.department, tx)
      const next = { ...toRecord(data, department), employmentStatus: data.employmentStatus as (typeof EMPLOYMENT_STATUSES)[number] }
      changes = diff(existing as unknown as Record<string, unknown>, next)
      if (Object.keys(changes).length === 0) return
      await tx.employee.update({ where: { id }, data: next })
      await audit({ userId: actor.id, action: 'UPDATE', entityType: 'Employee', entityId: id, changes }, tx)
    })
  } catch (err) {
    const handled = uniqueError(err, data)
    if (handled) return handled
    throw err
  }

  if (Object.keys(changes).length === 0) return { status: 'success', message: 'No changes to save.', employeeId: id }

  // Bank detail changes are the most common payroll fraud route, so tell approvers and the employee
  const bankChanged = ['bankName', 'accountName', 'accountNumber'].some((key) => key in changes)
  if (bankChanged) {
    const name = `${data.firstName} ${data.lastName}`
    await notify(await userIdsWithRoles(['APPROVER'], [actor.id]), {
      type: 'EMPLOYEE_BANK_CHANGED',
      title: `Bank details changed for ${name}`,
      body: 'The next payroll run will flag this line for review.',
      href: `/portal/financial/employees/${id}?tab=history`,
    })
    await sendNotificationEmail({
      to: existing.email,
      firstName: existing.firstName,
      subject: 'Your salary bank details were changed',
      heading: 'Your bank details were updated',
      body: 'The account your salary is paid into was changed in PayCompass. If you didn’t ask for this, contact your payroll or HR team straight away.',
    }).catch((err) => console.error('[employees] bank change email failed:', err))
  }

  refresh(id)
  return { status: 'success', message: `Saved ${Object.keys(changes).length} ${Object.keys(changes).length === 1 ? 'change' : 'changes'}.`, employeeId: id }
}

export async function importEmployees(formData: FormData) {
  const actor = await requirePermission('employees.edit')
  if (!actor) throw new Error('Only administrators can import employees.')

  const { rows, error } = parseEmployeeCsv(String(formData.get('csv') ?? ''))
  if (error) throw new Error(error)
  const valid = rows.filter((row) => row.errors.length === 0)
  if (valid.length === 0) throw new Error('No rows are ready to import. Fix the errors in the file and try again.')

  const existing = await prisma.employee.findMany({
    where: { OR: [{ email: { in: valid.map((row) => row.email) } }, { employeeId: { in: valid.map((row) => row.employeeId).filter(Boolean) } }] },
    select: { email: true, employeeId: true },
  })
  const takenEmails = new Set(existing.map((e) => e.email))
  const takenIds = new Set(existing.map((e) => e.employeeId))
  const fresh = valid.filter((row) => !takenEmails.has(row.email) && !(row.employeeId && takenIds.has(row.employeeId)))

  // Rows without an ID get the next generated ones, continuing after any IDs in the file
  const needIds = fresh.filter((row) => !row.employeeId)
  if (needIds.length) {
    const generated = await generateEmployeeIds(needIds.length + fresh.length)
    const used = new Set([...takenIds, ...fresh.map((row) => row.employeeId).filter(Boolean)])
    const available = generated.filter((id) => !used.has(id))
    needIds.forEach((row, i) => {
      row.employeeId = available[i]
    })
  }

  // Create each distinct department once, reusing existing spellings
  const departmentNames = new Map<string, string>()
  for (const row of fresh) {
    const key = (row.department || 'General').toLowerCase()
    if (!departmentNames.has(key)) departmentNames.set(key, await ensureDepartment(row.department || 'General'))
  }

  if (fresh.length) {
    const created = await prisma.employee.createManyAndReturn({
      skipDuplicates: true,
      select: { id: true, firstName: true, lastName: true, employeeId: true },
      data: fresh.map((row) => ({
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        employeeId: row.employeeId,
        startDate: new Date(row.startDate),
        department: departmentNames.get((row.department || 'General').toLowerCase()) ?? 'General',
        designation: row.designation || null,
        phone: row.phone || null,
        dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : null,
        gender: parseGender(row.gender),
        nationality: findCountryCode(row.nationality),
        address: row.address || null,
        createdBy: actor.id,
      })),
    })
    for (const employee of created) {
      await audit({ userId: actor.id, action: 'CREATE', entityType: 'Employee', entityId: employee.id, changes: { name: `${employee.firstName} ${employee.lastName}`, employeeId: employee.employeeId, source: 'CSV import' } })
    }
    if (created.length) {
      await notify(await userIdsWithRoles(['PREPARER'], [actor.id]), {
        type: 'EMPLOYEE_ADDED',
        title: `${created.length} new ${created.length === 1 ? 'employee needs' : 'employees need'} pay set up`,
        body: 'They were imported from a spreadsheet. Set their salaries, SSNIT numbers and TINs.',
        href: '/portal/financial/employees?view=nopay',
      })
    }
  }

  refresh()
  return {
    imported: fresh.length,
    duplicates: valid.length - fresh.length,
    invalid: rows.length - valid.length,
    departmentsCreated: departmentNames.size,
  }
}
