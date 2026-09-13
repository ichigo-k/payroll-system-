import type { Metadata } from 'next'
import { requireRole } from '@/lib/access'
import { listDepartments } from '@/lib/departments'
import { PageHeader } from '@/components/app/page-header'
import { NoPermission } from '@/components/app/no-permission'
import { EmployeeForm } from '../employee-form'

export const metadata: Metadata = { title: 'Add employee' }

export default async function NewEmployeePage() {
  const actor = await requireRole(['ADMIN', 'PREPARER'])
  if (!actor) return <NoPermission title="You can’t add employees" description="Only administrators and payroll preparers can add people to payroll." />

  const departments = await listDepartments()

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={[{ label: 'People' }, { label: 'Employees', href: '/portal/financial/employees' }, { label: 'Add employee' }]}
        title="Add employee"
        description="Fields marked with an asterisk are required. Once added, they can sign in to self-service with their work email."
      />
      <EmployeeForm departments={departments} />
    </div>
  )
}
