import type { Metadata } from 'next'
import { NoPermission } from '@/components/app/no-permission'
import { PageHeader } from '@/components/app/page-header'
import { can, requirePermission } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { SettingsForm } from './settings-form'

export const metadata: Metadata = { title: 'Company settings' }

export default async function CompanySettingsPage() {
  const actor = await requirePermission('settings.view')
  if (!actor) return <NoPermission title="You can’t view company settings" description="Company settings are managed by administrators." />

  const [config, approvers] = await Promise.all([
    prisma.systemConfig.findFirst({ where: { isActive: true } }),
    prisma.user.count({ where: { role: 'APPROVER', status: 'active' } }),
  ])
  const canEdit = can(actor.role, 'settings.manage')

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={[{ label: 'Configuration' }, { label: 'Company settings', href: '/portal/financial/config' }]}
        title="Company settings"
        description={canEdit ? 'Changes are recorded in the audit log.' : 'You can view these settings. Administrators can change them.'}
      />
      <SettingsForm
        canEdit={canEdit}
        approvers={approvers}
        values={{
          companyName: config?.companyName ?? '',
          companyRegistration: config?.companyRegistration ?? '',
          address: config?.address ?? '',
          taxId: config?.taxId ?? '',
          employerSsnitNumber: config?.employerSsnitNumber ?? '',
          bankName: config?.bankName ?? '',
          bankBranch: config?.bankBranch ?? '',
          bankAccountName: config?.bankAccountName ?? '',
          bankAccountNumber: config?.bankAccountNumber ?? '',
          requiredApprovals: String(config?.requiredApprovals ?? 1),
          currency: config?.currency ?? 'GHS',
        }}
      />
    </div>
  )
}
