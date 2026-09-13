'use client'

import { formatPercentChange, salaryChangePercent } from '@/lib/pay-items'
import { Pencil } from 'lucide-react'
import { button } from '@/components/app/styles'
import { cn } from '@/lib/utils'
import { AddButton, type PayDialog, PayEditor, type PayItem, RowButtons } from './pay-editor'
import { formatMoney } from '@/lib/currency'

export type PayData = {
  statutory: { ssnitNumber: string | null; tin: string | null }
  salaries: { id: string; amount: number; from: string; to: string | null; reason: string | null }[]
  allowances: PayItem[]
  deductions: PayItem[]
}

const money = (value: number) => formatMoney(value)
const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '')
const FREQUENCY_LABELS: Record<string, string> = { monthly: 'Monthly', annual: 'Annual, spread monthly', 'one-time': 'One-time' }

function Section({ title, description, action, children }: { title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-b border-border py-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="max-w-3xl rounded-lg border border-dashed border-input px-4 py-6 text-center text-sm text-muted-foreground">{text}</p>
}

export function PayPanel({ employeeId, data, canEdit, initialDialog, terminated }: { employeeId: string; data: PayData; canEdit: boolean; initialDialog?: 'salary' | 'allowance' | 'deduction'; terminated: boolean }) {
  const now = new Date()
  const current = data.salaries.find((s) => new Date(s.from) <= now && (!s.to || new Date(s.to) >= now)) ?? data.salaries.find((s) => !s.to)
  const upcoming = data.salaries.find((s) => new Date(s.from) > now)
  const editable = canEdit && !terminated

  const content = (open?: (d: PayDialog) => void) => (
    <>
      <Section
        title="Statutory numbers"
        description="Needed for the SSNIT and GRA PAYE schedules."
        action={
          editable &&
          open && (
            <button type="button" onClick={() => open({ kind: 'statutory' })} className={button.default}>
              <Pencil className="size-4" />
              Edit
            </button>
          )
        }
      >
        <dl className="grid max-w-3xl gap-2 text-sm sm:grid-cols-2">
          {(
            [
              ['SSNIT number', data.statutory.ssnitNumber],
              ['TIN / Ghana Card', data.statutory.tin],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="grid grid-cols-[140px_minmax(0,1fr)] gap-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className={value ? 'font-mono text-foreground' : 'font-medium text-danger'}>{value ?? 'Missing'}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section
        title="Basic salary"
        description={
          current
            ? `Currently ${money(current.amount)} a month since ${date(current.from)}.${upcoming && upcoming.id !== current.id ? ` Changes to ${money(upcoming.amount)} on ${date(upcoming.from)}.` : ''}`
            : 'No salary set yet, so this person is left out of payroll runs.'
        }
        action={editable && open && <AddButton label={current ? 'Change salary' : 'Set salary'} onClick={() => open({ kind: 'salary' })} />}
      >
        {data.salaries.length === 0 ? (
          <Empty text={editable ? 'Set a basic salary to include this person in payroll.' : 'No salary history yet.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full max-w-3xl min-w-[560px] text-sm">
              <thead>
                <tr className="border-b-2 border-border text-left text-xs font-semibold text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-semibold">Monthly basic</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Change</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Reason</th>
                  <th scope="col" className="px-4 py-2 font-semibold">From</th>
                  <th scope="col" className="py-2 pl-4 font-semibold">To</th>
                </tr>
              </thead>
              <tbody>
                {data.salaries.map((s, i) => {
                  // Salaries are newest first, so the previous one is the next row
                  const percent = salaryChangePercent(data.salaries[i + 1]?.amount, s.amount)
                  return (
                    <tr key={s.id} className="border-b border-border">
                      <td className="num py-2 pr-4 font-medium">{money(s.amount)}</td>
                      <td className={cn('num px-4 py-2', percent === null ? 'text-subtlest' : percent > 0 ? 'text-success' : percent < 0 ? 'text-danger' : 'text-muted-foreground')}>
                        {percent === null ? 'First salary' : formatPercentChange(percent)}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{s.reason ?? '-'}</td>
                      <td className="num px-4 py-2">{date(s.from)}</td>
                      <td className="num py-2 pl-4 text-muted-foreground">{s.to ? date(s.to) : s.id === current?.id ? 'Current' : 'Open'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {(['allowance', 'deduction'] as const).map((kind) => {
        const items = kind === 'allowance' ? data.allowances : data.deductions
        return (
          <Section
            key={kind}
            title={kind === 'allowance' ? 'Allowances' : 'Deductions'}
            description={kind === 'allowance' ? 'Added to gross pay and taxed. Each one is listed by name on the payslip.' : 'Taken from net pay after PAYE and SSNIT, like loan repayments or union dues.'}
            action={editable && open && <AddButton label={kind === 'allowance' ? 'Add allowance' : 'Add deduction'} onClick={() => open({ kind })} />}
          >
            {items.length === 0 ? (
              <Empty text={kind === 'allowance' ? 'No active allowances.' : 'No active deductions.'} />
            ) : (
              <table className="w-full max-w-3xl text-sm">
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-border">
                      <td className="py-2 pr-4 font-medium">{item.name}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {FREQUENCY_LABELS[item.frequency] ?? item.frequency}
                        {(item.startDate || item.endDate) && (
                          <span className="block text-xs">
                            {date(item.startDate) || 'Now'} to {date(item.endDate) || 'no end date'}
                          </span>
                        )}
                      </td>
                      <td className="num px-4 py-2 text-right font-medium">{money(item.amount)}</td>
                      <td className="w-20 py-2 text-right">
                        {editable && open && (
                          <RowButtons label={item.name} onEdit={() => open({ kind, item })} onEnd={() => open({ kind: 'end', item: kind, id: item.id, label: item.name })} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        )
      })}
    </>
  )

  if (!editable) return content()
  return (
    <PayEditor employeeId={employeeId} currentSalary={current?.amount ?? null} statutory={data.statutory} initialDialog={initialDialog ? { kind: initialDialog } : null}>
      {(open) => content(open)}
    </PayEditor>
  )
}
