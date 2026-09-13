import type { Metadata } from 'next'
import Link from 'next/link'
import { Download, FileSpreadsheet } from 'lucide-react'
import { requirePermission } from '@/lib/access'
import { actorName } from '@/lib/audit-format'
import { parsePage } from '@/lib/pagination'
import { EXPORT_TYPES, type ExportType } from '@/lib/payroll-exports'
import { periodLabel } from '@/lib/payroll-runs'
import { prisma } from '@/lib/prisma'
import { queryHref } from '@/components/app/list-tabs'
import { NoPermission } from '@/components/app/no-permission'
import { PageHeader } from '@/components/app/page-header'
import { Pagination } from '@/components/app/pagination'
import { StatusBadge } from '@/components/app/status-badge'
import { button } from '@/components/app/styles'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Reports' }

const dateTime = (d: Date) => d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePermission('reports.export')
  if (!actor) return <NoPermission title="You can’t export reports" description="Reports are available to preparers, approvers and auditors." />

  const raw = await searchParams
  const { page, pageSize, skip, take } = parsePage(raw, 10)
  const selectedId = typeof raw.run === 'string' ? raw.run : undefined

  const [runs, history, historyTotal] = await Promise.all([
    prisma.payrollRun.findMany({ where: { headcount: { gt: 0 } }, orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 24, select: { id: true, month: true, year: true, status: true, headcount: true } }),
    prisma.report.findMany({ include: { generatedBy: { select: { id: true, firstName: true, lastName: true, email: true } }, payrollRun: { select: { id: true } } }, orderBy: { generatedAt: 'desc' }, skip, take }),
    prisma.report.count(),
  ])
  const selected = runs.find((r) => r.id === selectedId) ?? runs.find((r) => r.status === 'APPROVED' || r.status === 'PAID') ?? runs[0]
  const approved = selected && (selected.status === 'APPROVED' || selected.status === 'PAID')

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Insights' }, { label: 'Reports', href: '/portal/financial/reports' }]}
        title="Reports"
        description="Download the bank payment schedule, GRA PAYE schedule, SSNIT contribution report and payroll register for any run. Every export is logged."
      />

      {runs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-input px-6 py-14 text-center">
          <p className="text-base font-semibold">No payroll runs to report on yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Documents become available once a run has been calculated.</p>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav aria-label="Pay periods" className="lg:border-r lg:border-border lg:pr-4">
            <p className="px-2 text-xs font-semibold text-subtlest">Pay period</p>
            <ul className="mt-2 grid gap-0.5">
              {runs.map((run) => (
                <li key={run.id}>
                  <Link
                    href={`/portal/financial/reports?run=${run.id}`}
                    aria-current={run.id === selected?.id ? 'page' : undefined}
                    className={cn('flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm', run.id === selected?.id ? 'bg-accent font-medium text-primary' : 'hover:bg-secondary')}
                  >
                    {periodLabel(run.month, run.year)}
                    <StatusBadge status={run.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {selected && (
            <section aria-labelledby="docs-heading">
              <h2 id="docs-heading" className="text-base font-semibold">
                {periodLabel(selected.month, selected.year)}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {selected.headcount} employees.{' '}
                {approved ? 'Approved, so every document is final.' : 'Not approved yet: statutory files are marked UNAPPROVED and the bank schedule is locked.'}
              </p>
              <ul className="mt-4 grid gap-3 xl:grid-cols-2">
                {(Object.keys(EXPORT_TYPES) as ExportType[]).map((type) => {
                  const meta = EXPORT_TYPES[type]
                  const locked = meta.requiresApproval && !approved
                  return (
                    <li key={type} className="flex items-start gap-3 rounded-lg border border-border p-4">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                        <FileSpreadsheet className="size-5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{meta.label}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{meta.description}</p>
                        <div className="mt-3">
                          {locked ? (
                            <span className={cn(button.default, 'pointer-events-none opacity-50')}>Available after approval</span>
                          ) : (
                            <a href={`/portal/financial/payroll/${selected.id}/export/${type}`} className={button.default}>
                              <Download className="size-4" />
                              Download CSV
                            </a>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>
      )}

      <section className="mt-10" aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-base font-semibold">
          Export history
        </h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing exported yet.</p>
        ) : (
          <>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b-2 border-border text-left text-xs font-semibold text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-semibold">Document</th>
                    <th scope="col" className="px-4 py-2 font-semibold">Exported by</th>
                    <th scope="col" className="py-2 pl-4 font-semibold">When</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r) => (
                    <tr key={r.id} className="border-b border-border">
                      <td className="py-2 pr-4">
                        {r.payrollRun ? (
                          <Link href={`/portal/financial/payroll/${r.payrollRun.id}?tab=documents`} className="text-primary hover:underline">
                            {r.title}
                          </Link>
                        ) : (
                          r.title
                        )}
                        {r.description && <span className="ml-2 text-xs text-warning">{r.description}</span>}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{actorName(r.generatedBy)}</td>
                      <td className="num py-2 pl-4 text-muted-foreground">{dateTime(r.generatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={pageSize} total={historyTotal} noun="exports" hrefFor={(p, size) => queryHref('/portal/financial/reports', { run: selectedId }, { page: p, size })} />
          </>
        )}
      </section>
    </div>
  )
}
