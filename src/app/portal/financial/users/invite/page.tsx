import type { Metadata } from 'next'
import { requireRole } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { NoPermission } from '@/components/app/no-permission'
import { PageHeader } from '@/components/app/page-header'
import { InviteUserForm } from '../invite-user-form'

export const metadata: Metadata = { title: 'Invite user' }

export default async function InviteUserPage() {
  const actor = await requireRole(['ADMIN'])
  if (!actor) return <NoPermission title="You can’t invite users" description="Only administrators can invite people and choose their roles." />

  const unlinked = await prisma.employee.findMany({
    where: { userId: null },
    select: { id: true, firstName: true, lastName: true, employeeId: true, email: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: 1000,
  })

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={[{ label: 'Configuration' }, { label: 'User management', href: '/portal/financial/users' }, { label: 'Invite user' }]}
        title="Invite user"
        description="For people who aren’t on payroll, like an external accountant. To give someone on payroll a role, open their ⋯ menu on the Employees page and choose Give workspace access."
      />
      <InviteUserForm employees={unlinked.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, employeeId: e.employeeId, email: e.email }))} />
    </div>
  )
}
