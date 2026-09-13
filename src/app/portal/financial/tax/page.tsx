import { Clock, Info, Plus, TriangleAlert } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { NoPermission } from '@/components/app/no-permission'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { button } from '@/components/app/styles'
import { can, requirePermission } from '@/lib/access'
import { actorName } from '@/lib/audit-format'
import { getGhanaTaxBrackets } from '@/lib/payroll'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'
import { TaxForm, type TaxFormValues } from './tax-form'
import { TaxReview } from './tax-review'

export const metadata: Metadata = { title: 'Tax configuration' }

function periodName(year: number, month: number) {
  return month === 0 ? `${year}, whole year` : new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
}

function parseBrackets(json: string) {
  try {
    const value = JSON.parse(json)
    return Array.isArray(value) && value.length ? value : getGhanaTaxBrackets()
  } catch {
    return getGhanaTaxBrackets()
  }
}

const dateTime = (d: Date) => d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function stateOf(config: { approvedAt: Date | null; isActive: boolean; pendingChanges: string | null }) {
  if (!config.approvedAt) return 'DRAFT'
  if (config.pendingChanges) return 'PENDING'
  return config.isActive ? 'ACTIVE' : 'INACTIVE'
}

export default async function TaxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePermission('tax.view')
  if (!actor) return <NoPermission title="You can’t view tax configuration" description="Tax settings are available to preparers, approvers and auditors." />

  const raw = await searchParams
  const canDraft = can(actor.role, 'tax.draft')
  const canActivate = can(actor.role, 'tax.activate')
  const isNew = raw.new === '1' && canDraft

  const configs = await prisma.taxConfiguration.findMany({ orderBy: [{ year: 'desc' }, { month: 'desc' }] })
  const requested = typeof raw.id === 'string' ? configs.find((c) => c.id === raw.id) : undefined
  const selected = isNew ? undefined : (requested ?? configs.find((c) => c.isActive && c.approvedAt) ?? configs[0])

  const peopleIds = [selected?.updatedBy, selected?.approvedById, selected?.pendingById].filter((v): v is string => !!v)
  const people = new Map(
    (await prisma.user.findMany({ where: { id: { in: peopleIds } }, select: { id: true, firstName: true, lastName: true, email: true } })).map((u) => [u.id, actorName(u)]),
  )

  const pending = selected?.pendingChanges ? (JSON.parse(selected.pendingChanges) as Record<string, string | boolean>) : null
  // Preparers edit the proposal if there is one, otherwise the current values
  const source = selected && pending && canDraft ? { ...selected, ...pending } : selected
  const values: TaxFormValues = source
    ? {
        year: source.year,
        month: source.month,
        isActive: Boolean(source.isActive),
        payeThreshold: String(source.payeThreshold),
        personalRelief: String(source.personalRelief),
        spouseExemption: String(source.spouseExemption),
        childExemption: String(source.childExemption),
        ssnitEmployeeRate: String(source.ssnitEmployeeRate),
        ssnitEmployerRate: String(source.ssnitEmployerRate),
        brackets: parseBrackets(String(source.payeBrackets)),
      }
    : {
        year: new Date().getFullYear(),
        month: 0,
        isActive: true,
        payeThreshold: '0',
        personalRelief: '0',
        spouseExemption: '0',
        childExemption: '0',
        ssnitEmployeeRate: '5.5',
        ssnitEmployerRate: '13',
        brackets: getGhanaTaxBrackets(),
      }

  const state = selected ? stateOf(selected) : null
  const pendingDiff =
    selected && pending
      ? (
          [
            ['PAYE threshold', 'payeThreshold'],
            ['Personal relief', 'personalRelief'],
            ['Spouse exemption', 'spouseExemption'],
            ['Child exemption', 'childExemption'],
            ['SSNIT employee rate', 'ssnitEmployeeRate'],
            ['SSNIT employer rate', 'ssnitEmployerRate'],
          ] as const
        )
          .map(([label, key]): { label: string; from: string; to: string } => ({ label, from: Number(selected[key]).toString(), to: Number(pending[key]).toString() }))
          .filter((row) => row.from !== row.to)
          .concat(
            JSON.stringify(JSON.parse(selected.payeBrackets)) !== JSON.stringify(JSON.parse(String(pending.payeBrackets)))
              ? [{ label: 'PAYE bands', from: 'current bands', to: 'new bands' }]
              : [],
          )
          .concat(Boolean(pending.isActive) !== selected.isActive ? [{ label: 'Active', from: selected.isActive ? 'Yes' : 'No', to: pending.isActive ? 'Yes' : 'No' }] : [])
      : []

  const reviewBlocked = selected
    ? state === 'DRAFT' && selected.updatedBy === actor.id
      ? 'You drafted this configuration, so another approver must activate it.'
      : state === 'PENDING' && selected.pendingById === actor.id
        ? 'You proposed these changes, so another approver must approve them.'
        : null
    : null

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Configuration' }, { label: 'Tax configuration', href: '/portal/financial/tax' }]}
        title={selected ? periodName(selected.year, selected.month) : 'New tax configuration'}
        description={
          selected ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <StatusBadge status={state === 'PENDING' ? 'PENDING_APPROVAL' : state === 'DRAFT' ? 'AWAITING_ACTIVATION' : (state ?? 'INACTIVE')} />
              <span>Drafted by {people.get(selected.updatedBy) ?? 'a preparer'}</span>
              {selected.approvedAt && (
                <span>
                  Approved by {selected.approvedById ? (people.get(selected.approvedById) ?? 'an approver') : 'an approver'} on {dateTime(selected.approvedAt)}
                </span>
              )}
            </span>
          ) : (
            'Preparers draft PAYE bands, reliefs and SSNIT rates. An approver activates them before payroll uses them.'
          )
        }
        actions={
          canDraft &&
          configs.length > 0 &&
          !isNew && (
            <Link href="/portal/financial/tax?new=1" className={button.default}>
              <Plus className="size-4" />
              New configuration
            </Link>
          )
        }
      />

      {selected && state === 'DRAFT' && (
        <div role="note" className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-lg bg-accent px-4 py-3 text-sm">
          <div className="flex items-start gap-2.5">
            <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>
              <span className="font-semibold">Waiting for an approver to activate this configuration.</span> Payroll can’t use it until then.
              {canActivate && reviewBlocked && <span className="mt-1 block text-muted-foreground">{reviewBlocked}</span>}
            </p>
          </div>
          {canActivate && <TaxReview id={selected.id} mode="activate" blockedReason={reviewBlocked} />}
        </div>
      )}

      {selected && state === 'PENDING' && (
        <div role="note" className="mb-5 rounded-lg bg-warning-soft px-4 py-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <p>
                <span className="font-semibold">
                  {people.get(selected.pendingById ?? '') ?? 'A preparer'} proposed changes{selected.pendingAt && ` on ${dateTime(selected.pendingAt)}`}.
                </span>{' '}
                The current settings stay in use until an approver approves them.
                {canActivate && reviewBlocked && <span className="mt-1 block text-muted-foreground">{reviewBlocked}</span>}
              </p>
            </div>
            {canActivate && <TaxReview id={selected.id} mode="approve-changes" blockedReason={reviewBlocked} />}
          </div>
          {pendingDiff.length > 0 && (
            <table className="mt-3 w-full max-w-lg text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-1 pr-4 font-semibold">
                    Setting
                  </th>
                  <th scope="col" className="px-4 py-1 font-semibold">
                    Current
                  </th>
                  <th scope="col" className="py-1 pl-4 font-semibold">
                    Proposed
                  </th>
                </tr>
              </thead>
              <tbody>
                {pendingDiff.map((row) => (
                  <tr key={row.label} className="border-t border-warning/20">
                    <td className="py-1.5 pr-4">{row.label}</td>
                    <td className="num px-4 py-1.5 text-muted-foreground line-through">{row.from}</td>
                    <td className="num py-1.5 pl-4 font-semibold">{row.to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!canDraft && (
        <div role="note" className="mb-5 flex items-start gap-2.5 rounded-lg bg-secondary px-4 py-3 text-sm text-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p>
            {canActivate
              ? 'You review and activate tax settings. Payroll preparers draft them.'
              : 'You can view tax settings. Payroll preparers draft them and approvers activate them.'}
          </p>
        </div>
      )}

      {!selected && canDraft && (
        <div role="note" className="mb-5 flex items-start gap-2.5 rounded-lg bg-warning-soft px-4 py-3 text-sm text-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            {configs.length === 0 ? 'No tax configuration has been saved yet. ' : ''}
            The brackets below are suggested starting values. Confirm them against current GRA guidance before saving.
          </p>
        </div>
      )}

      <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_260px]">
        <TaxForm
          key={`${selected?.id ?? 'new'}-${selected?.pendingAt?.getTime() ?? ''}`}
          values={values}
          canEdit={canDraft}
          submitLabel={selected?.approvedAt ? 'Propose changes' : 'Save draft'}
        />

        {configs.length > 0 && (
          <aside aria-labelledby="saved-configs" className="xl:sticky xl:top-20">
            <h2 id="saved-configs" className="px-2 text-xs font-semibold text-subtlest">
              Saved configurations
            </h2>
            <ul className="mt-2 grid gap-0.5">
              {configs.map((config) => {
                const current = config.id === selected?.id
                const s = stateOf(config)
                return (
                  <li key={config.id}>
                    <Link
                      href={`/portal/financial/tax?id=${config.id}`}
                      aria-current={current ? 'page' : undefined}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm transition-colors duration-150',
                        current ? 'bg-accent font-medium text-primary' : 'text-foreground hover:bg-secondary',
                      )}
                    >
                      <span className="num">{periodName(config.year, config.month)}</span>
                      {s !== 'INACTIVE' && <StatusBadge status={s === 'PENDING' ? 'PENDING_APPROVAL' : s === 'DRAFT' ? 'DRAFT' : 'ACTIVE'} />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </aside>
        )}
      </div>
    </div>
  )
}
