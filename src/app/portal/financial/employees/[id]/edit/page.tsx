import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/access'
import { listDepartments } from '@/lib/departments'
import { prisma } from '@/lib/prisma'
import { NoPermission } from '@/components/app/no-permission'
import { PageHeader } from '@/components/app/page-header'
import { EmployeeForm } from '../../employee-form'

export const metadata: Metadata = { title: 'Edit employee' }

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission('employees.edit')
  if (!actor) return <NoPermission title="You can’t edit employees" description="Only administrators can change employee records. Pay is set up on the Pay tab by payroll preparers." />

  const { id } = await params
  const [employee, departments] = await Promise.all([prisma.employee.findUnique({ where: { id } }), listDepartments()])
  if (!employee) notFound()
  const name = `${employee.firstName} ${employee.lastName}`

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={[{ label: 'People' }, { label: 'Employees', href: '/portal/financial/employees' }, { label: name, href: `/portal/financial/employees/${id}` }, { label: 'Edit' }]}
        title={`Edit ${name}`}
        description="Every change is recorded in this employee’s history with who made it."
      />
      <EmployeeForm
        departments={departments}
        employeeId={employee.id}
        initial={{
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          phone: employee.phone ?? '',
          dateOfBirth: employee.dateOfBirth?.toISOString().slice(0, 10) ?? '',
          gender: employee.gender ?? '',
          nationality: employee.nationality ?? '',
          address: employee.address ?? '',
          city: employee.city ?? '',
          employeeId: employee.employeeId,
          department: employee.department,
          designation: employee.designation ?? '',
          startDate: employee.startDate.toISOString().slice(0, 10),
          employmentStatus: employee.employmentStatus,
          ssnitNumber: employee.ssnit_number ?? '',
          tin: employee.tin ?? '',
          bankName: employee.bankName ?? '',
          accountName: employee.accountName ?? '',
          accountNumber: employee.accountNumber ?? '',
        }}
      />
    </div>
  )
}
