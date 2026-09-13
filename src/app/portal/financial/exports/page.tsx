import type { LucideIcon } from 'lucide-react'
import { ChartPie, FileBadge, History, Landmark, Receipt, TrendingUp, Users, Wallet } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ListTabs } from '@/components/app/list-tabs'
import { NoPermission } from '@/components/app/no-permission'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { button } from '@/components/app/styles'
import { can, currentUser } from '@/lib/access'
import { formatMoney } from '@/lib/currency'
import { listDepartments } from '@/lib/departments'
import { describeFilters, type ExportFilters, filtersToQuery, parseFilters } from '@/lib/exports/filters'
import { contextFor, isLarge } from '@/lib/exports/generate'
import { REPORTS, type ReportDef } from '@/lib/exports/reports'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'
import { DeleteSavedReport, ExportActions, FiltersForm } from './export-client'

export const metadata: Metadata = { title: 'Exports' }

const ICONS: Record<string, LucideIcon> = {
  employees: Users,
  headcount: ChartPie,
  earnings: Wallet,
  'pay-history': History,
  'salary-changes': TrendingUp,
  'paye-annual': Landmark,
  payslips: Receipt,
  'tax-certificates': FileBadge,
}

const GROUPS: { label: string; keys: string[] }[] = [
  { label: 'People', keys: ['employees', 'headcount'] },
  { label: 'Pay', keys: ['earnings', 'pay-history', 'salary-changes'] },
  { label: 'Tax and year end', keys: ['paye-annual', 'tax-certificates'] },
  { label: 'Documents', keys: ['payslips'] },
]

const PREVIEW_ROWS = 25
const dateTime = (d: Date) => d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function activeFilterCount(f: ExportFilters) {
  return [
    f.departments.length > 0,
    f.status !== 'active',
    f.gender,
    f.nationality,
    f.ageMin !== null || f.ageMax !== null,
    f.serviceMin !== null || f.serviceMax !== null,
    f.joinedFrom || f.joinedTo,
    f.leftFrom || f.leftTo,
    f.salaryMin !== null || f.salaryMax !== null,
    f.missing,
  ].filter(Boolean).length
}

function formatCell(value: string | number | null | undefined, kind?: string) {
  if (value === null || value === undefined || value === '') return <span className="text-subtlest">-</span>
  if (kind === 'money' && typeof value === 'number') return formatMoney(value)
  return String(value)
}

export default async function ExportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await currentUser()
  const available = actor ? REPORTS.filter((r) => can(actor.role, r.permission)) : []
  if (!actor || available.length === 0)
    return <NoPermission title="You can’t export reports" description="Exports are available to administrators, preparers, approvers and auditors." />

  const raw = await searchParams
  const tab = raw.tab === 'history' ? 'history' : 'build'
  const report = available.find((r) => r.key === raw.report) ?? available[0]
  const filters = parseFilters(raw)
  const ctx = contextFor(actor, filters)

  const [saved, historyCount] = await Promise.all([
    prisma.savedReport.findMany({ where: { createdById: actor.id }, orderBy: { createdAt: 'desc' } }),
    prisma.report.count({ where: { generatedById: actor.id, filters: { not: null } } }),
  ])
  const savedVisible = saved.filter((s) => available.some((r) => r.key === s.reportType))

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Insights' }, { label: 'Exports', href: '/portal/financial/exports' }]}
        title="Exports"
        description="Pick a report, narrow it down with filters, check the preview and download it as Excel, CSV or PDF."
      />
      <ListTabs
        label="Export sections"
        tabs={[
          { key: 'build', label: 'Build a report', href: `/portal/financial/exports?report=${report.key}`, active: tab === 'build' },
          { key: 'history', label: 'Your exports', href: '/portal/financial/exports?tab=history', count: historyCount, active: tab === 'history' },
        ]}
      />

      {tab === 'history' ? (
        <HistoryTab userId={actor.id} />
      ) : (
        <div className="grid gap-8 py-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="grid content-start gap-5">
            {GROUPS.map((group) => {
              const items = group.keys.map((key) => available.find((r) => r.key === key)).filter((r): r is ReportDef => !!r)
              if (!items.length) return null
              return (
                <nav key={group.label} aria-label={group.label}>
                  <h2 className="px-2 text-xs font-semibold text-subtlest">{group.label}</h2>
                  <ul className="mt-1 grid gap-0.5">
                    {items.map((r) => {
                      const Icon = ICONS[r.key] ?? Users
                      const active = r.key === report.key
                      return (
                        <li key={r.key}>
                          <Link
                            href={`/portal/financial/exports?report=${r.key}`}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              'flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors duration-150',
                              active ? 'bg-accent font-medium text-primary' : 'text-foreground hover:bg-secondary',
                            )}
                          >
                            <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} strokeWidth={1.75} />
                            {r.label}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </nav>
              )
            })}

            {savedVisible.length > 0 && (
              <nav aria-label="Saved reports" className="border-t border-border pt-4">
                <h2 className="px-2 text-xs font-semibold text-subtlest">Saved reports</h2>
                <ul className="mt-1 grid gap-0.5">
                  {savedVisible.map((s) => {
                    const r = available.find((x) => x.key === s.reportType)
                    return (
                      <li key={s.id} className="group flex items-center gap-1 rounded-lg pr-1 hover:bg-secondary">
                        <Link href={`/portal/financial/exports?report=${s.reportType}${s.filters ? `&${s.filters}` : ''}`} className="min-w-0 flex-1 px-2 py-1.5">
                          <span className="block truncate text-sm text-foreground">{s.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{r?.label}</span>
                        </Link>
                        <DeleteSavedReport id={s.id} name={s.name} />
                      </li>
                    )
                  })}
                </ul>
              </nav>
            )}
          </aside>

          <section className="min-w-0">
            <div className="mb-4 flex items-start gap-3">
              {(() => {
                const Icon = ICONS[report.key] ?? Users
                return (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                )
              })()}
              <div>
                <h2 className="text-xl font-semibold tracking-tight">{report.label}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{report.description}</p>
              </div>
            </div>

            <FiltersForm
              key={`${report.key}-${filtersToQuery(filters)}`}
              reportKey={report.key}
              filters={filters}
              departments={await listDepartments()}
              usesPeriod={report.usesPeriod}
              usesYear={report.usesYear}
              canSeePay={ctx.canSeePay}
              years={Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i)}
              activeCount={activeFilterCount(filters)}
            />

            <Preview report={report} ctx={ctx} />
          </section>
        </div>
      )}
    </div>
  )
}

async function Preview({ report, ctx }: { report: ReportDef; ctx: ReturnType<typeof contextFor> }) {
  const table = report.kind === 'document' ? await report.preview(ctx) : await report.build(ctx)
  const size = report.kind === 'document' ? await report.count(ctx) : table.rows.length
  const query = filtersToQuery(ctx.filters, { report: report.key })
  const shown = table.rows.slice(0, PREVIEW_ROWS)

  return (
    <div className="mt-6">
      <p className="text-sm text-muted-foreground">{describeFilters(ctx.filters, { usesPeriod: report.usesPeriod, usesYear: report.usesYear, canSeePay: ctx.canSeePay })}</p>

      {table.summary.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-y-4 rounded-lg border border-border py-4 md:grid-cols-4">
          {table.summary.slice(0, 4).map(([label, value], i) => (
            <div key={label} className={cn('px-4', i > 0 && 'md:border-l md:border-border')}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="num mt-0.5 text-lg font-semibold tracking-tight">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="sticky top-14 z-10 mt-4 border-y border-border bg-background py-3">
        <ExportActions
          query={query}
          formats={report.formats}
          large={isLarge(report, size)}
          size={size}
          unit={report.kind === 'document' ? (size === 1 ? 'page' : 'pages') : size === 1 ? 'row' : 'rows'}
        />
      </div>

      {shown.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-input px-6 py-12 text-center">
          <p className="text-base font-semibold">No records match</p>
          <p className="mt-1 text-sm text-muted-foreground">Try widening the filters or the pay period.</p>
        </div>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border text-left text-xs font-semibold text-muted-foreground">
                  {table.columns.map((c) => (
                    <th key={c.key} scope="col" className={cn('px-3 py-2 font-semibold whitespace-nowrap first:pl-0', (c.kind === 'money' || c.kind === 'number') && 'text-right')}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((row, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: preview rows have no stable id
                  <tr key={i} className="border-b border-border hover:bg-muted">
                    {table.columns.map((c) => (
                      <td key={c.key} className={cn('px-3 py-2 whitespace-nowrap first:pl-0', (c.kind === 'money' || c.kind === 'number') && 'num text-right')}>
                        {formatCell(row[c.key], c.kind)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {table.totals && shown.length === table.rows.length && (
                <tfoot>
                  <tr className="border-b-2 border-border font-semibold">
                    {table.columns.map((c, i) => (
                      <td key={c.key} className={cn('px-3 py-2 whitespace-nowrap first:pl-0', (c.kind === 'money' || c.kind === 'number') && 'num text-right')}>
                        {i === 0 ? 'Total' : table.totals?.[c.key] === undefined ? '' : formatCell(table.totals[c.key], c.kind)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {table.rows.length > shown.length && (
            <p className="mt-3 text-xs text-muted-foreground">
              Showing the first {shown.length} of {table.rows.length.toLocaleString('en-GB')} rows. The download includes all of them{table.totals ? ', with totals' : ''}.
            </p>
          )}
        </>
      )}
    </div>
  )
}

async function HistoryTab({ userId }: { userId: string }) {
  const exports = await prisma.report.findMany({
    where: { generatedById: userId, filters: { not: null } },
    select: { id: true, title: true, description: true, fileFormat: true, rowCount: true, status: true, generatedAt: true, expiresAt: true, filters: true, content: false },
    orderBy: { generatedAt: 'desc' },
    take: 50,
  })
  const now = new Date()

  if (exports.length === 0) {
    return (
      <div className="my-6 rounded-lg border border-dashed border-input px-6 py-12 text-center">
        <p className="text-base font-semibold">No exports yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Reports you download or prepare appear here, so you can find them again.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto py-4">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b-2 border-border text-left text-xs font-semibold text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-semibold">
              Report
            </th>
            <th scope="col" className="px-4 py-2 font-semibold">
              Format
            </th>
            <th scope="col" className="px-4 py-2 text-right font-semibold">
              Rows
            </th>
            <th scope="col" className="px-4 py-2 font-semibold">
              Status
            </th>
            <th scope="col" className="px-4 py-2 font-semibold">
              When
            </th>
            <th scope="col" className="py-2 pl-4">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {exports.map((e) => {
            const expired = e.expiresAt && e.expiresAt < now
            const status =
              e.status === 'PENDING' ? 'EXPORT_PENDING' : e.status === 'FAILED' ? 'EXPORT_FAILED' : expired ? 'EXPORT_EXPIRED' : e.expiresAt ? 'EXPORT_READY' : 'EXPORT_DOWNLOADED'
            return (
              <tr key={e.id} className="border-b border-border align-top hover:bg-muted">
                <td className="max-w-[420px] py-2.5 pr-4">
                  <p className="font-medium">{e.title}</p>
                  {e.description && <p className="mt-0.5 text-xs text-muted-foreground">{e.description}</p>}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{e.fileFormat === 'XLSX' ? 'Excel' : e.fileFormat}</td>
                <td className="num px-4 py-2.5 text-right">{e.rowCount?.toLocaleString('en-GB') ?? '-'}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={status} />
                </td>
                <td className="num px-4 py-2.5 whitespace-nowrap text-muted-foreground">{dateTime(e.generatedAt)}</td>
                <td className="py-2 pl-4 text-right whitespace-nowrap">
                  {e.status === 'READY' && e.expiresAt && !expired && (
                    <a href={`/portal/financial/exports/files/${e.id}`} className={button.default}>
                      Download
                    </a>
                  )}
                  <Link href={`/portal/financial/exports?${e.filters}`} className={cn(button.subtle, 'ml-1')}>
                    Run again
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
