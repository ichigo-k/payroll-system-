import type { Metadata } from 'next'
import { requirePermission } from '@/lib/access'
import { listDepartments } from '@/lib/departments'
import { prisma } from '@/lib/prisma'
import { NoPermission } from '@/components/app/no-permission'
import { PageHeader } from '@/components/app/page-header'
import { BulkImport } from '../bulk-import'

export const metadata: Metadata = { title: 'Import employees' }

export default async function ImportEmployeesPage() {
  const actor = await requirePermission('employees.edit')
  if (!actor) return <NoPermission title="You can’t import employees" description="Only administrators can import employees. Payroll preparers set up their pay afterwards." />

  const [existing, departments] = await Promise.all([prisma.employee.findMany({ select: { email: true, employeeId: true } }), listDepartments()])

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={[{ label: 'People' }, { label: 'Employees', href: '/portal/financial/employees' }, { label: 'Import' }]}
        title="Import employees"
        description="Add many people at once from a spreadsheet. People already on payroll are skipped, so it’s safe to upload the same file twice."
      />
      <BulkImport existingEmails={existing.map((e) => e.email.toLowerCase())} existingIds={existing.map((e) => e.employeeId)} departments={departments} />
    </div>
  )
}
