import type { Metadata } from 'next'
import Link from 'next/link'
import { Info, Plus, TriangleAlert } from 'lucide-react'
import { auth } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'
import { getGhanaTaxBrackets } from '@/lib/payroll'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { button } from '@/components/app/styles'
import { cn } from '@/lib/utils'
import { TaxForm, type TaxFormValues } from './tax-form'

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

export default async function TaxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams
  const session = await auth()
  const canEdit = session?.user?.role === 'ADMIN'
  const isNew = raw.new === '1'

  const configs = await prisma.taxConfiguration.findMany({ orderBy: [{ year: 'desc' }, { month: 'desc' }] })
  const requested = typeof raw.id === 'string' ? configs.find((c) => c.id === raw.id) : undefined
  const selected = isNew ? undefined : (requested ?? configs.find((c) => c.isActive) ?? configs[0])

  const values: TaxFormValues = selected
    ? {
        year: selected.year,
        month: selected.month,
        isActive: selected.isActive,
        payeThreshold: selected.payeThreshold.toString(),
        personalRelief: selected.personalRelief.toString(),
        spouseExemption: selected.spouseExemption.toString(),
        childExemption: selected.childExemption.toString(),
        ssnitEmployeeRate: selected.ssnitEmployeeRate.toString(),
        ssnitEmployerRate: selected.ssnitEmployerRate.toString(),
        brackets: parseBrackets(selected.payeBrackets),
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

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Configuration' }, { label: 'Tax configuration', href: '/portal/financial/tax' }]}
        title={selected ? periodName(selected.year, selected.month) : 'New tax configuration'}
        description={
          selected ? (
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selected.isActive ? 'ACTIVE' : 'INACTIVE'} />
              Last updated {selected.updatedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          ) : (
            'PAYE brackets, reliefs and SSNIT rates used when payroll is calculated.'
          )
        }
        actions={
          canEdit &&
          configs.length > 0 &&
          !isNew && (
            <Link href="/portal/financial/tax?new=1" className={button.default}>
              <Plus className="size-4" />
              New configuration
            </Link>
          )
        }
      />

      {!canEdit && (
        <div role="note" className="mb-5 flex items-start gap-2.5 rounded-lg bg-accent px-4 py-3 text-sm text-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>You can view tax settings. Only administrators can change them.</p>
        </div>
      )}

      {!selected && (
        <div role="note" className="mb-5 flex items-start gap-2.5 rounded-lg bg-warning-soft px-4 py-3 text-sm text-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            {configs.length === 0 ? 'No tax configuration has been saved yet. ' : ''}
            The brackets below are suggested starting values. Confirm them against current GRA guidance before saving.
          </p>
        </div>
      )}

      <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_260px]">
        <TaxForm key={selected?.id ?? 'new'} values={values} canEdit={canEdit} />

        {configs.length > 0 && (
          <aside aria-labelledby="saved-configs" className="xl:sticky xl:top-20">
            <h2 id="saved-configs" className="px-2 text-xs font-semibold text-subtlest">
              Saved configurations
            </h2>
            <ul className="mt-2 grid gap-0.5">
              {configs.map((config) => {
                const current = config.id === selected?.id
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
                      {config.isActive && <StatusBadge status="ACTIVE" />}
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
