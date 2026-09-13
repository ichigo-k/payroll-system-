import { Text, View } from '@react-pdf/renderer'
import type { LineItems } from '@/lib/pay-items'
import { ssnitSplit } from '@/lib/payroll-exports'
import { amount, colors, type Column, Doc, DocPage, Facts, longDate, type Meta, money, Signatures, styles, Table } from './theme'
import { activeCurrency } from '@/lib/currency'

/** PDFs generated from a payroll run's snapshot lines. */

export type RunLine = {
  employeeCode: string
  employeeName: string
  department: string
  designation: string | null
  bankName: string | null
  accountName: string | null
  accountNumber: string | null
  ssnitNumber: string | null
  tin: string | null
  baseSalary: number
  allowancesTotal: number
  grossIncome: number
  ssnitEmployee: number
  ssnitEmployer: number
  reliefs: number
  taxableIncome: number
  paye: number
  deductionsTotal: number
  totalDeductions: number
  netPay: number
  lineItems: LineItems
}

export type RunInfo = {
  period: string
  month: number
  year: number
  status: string
  notes: string | null
  createdBy: string | null
  submittedBy: string | null
  submittedAt: Date | null
  approvals: { name: string; at: Date; comment: string | null }[]
  paidAt: Date | null
}

const sum = (lines: RunLine[], pick: (l: RunLine) => number) => Math.round(lines.reduce((t, l) => t + pick(l), 0) * 100) / 100
const maskAccount = (value: string | null) => (value ? `•••• ${value.slice(-4)}` : '-')

/** Statutory deadlines: SSNIT by the 14th and PAYE by the 15th of the following month. */
function dueDate(run: RunInfo, day: number) {
  return longDate(new Date(Date.UTC(run.month === 12 ? run.year + 1 : run.year, run.month === 12 ? 0 : run.month, day)))
}

// ---------------------------------------------------------------------------
// Payslips

function PayslipRow({ label, value, strong, negative }: { label: string; value: number; strong?: boolean; negative?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: strong ? 0 : 1, borderBottomColor: colors.border }}>
      <Text style={strong ? styles.bold : { color: colors.muted }}>{label}</Text>
      <Text style={strong ? styles.bold : {}}>{negative && value > 0 ? `- ${amount(value)}` : amount(value)}</Text>
    </View>
  )
}

export function PayslipsDocument({ meta, run, lines }: { meta: Meta; run: RunInfo; lines: RunLine[] }) {
  return <PayslipBundleDocument meta={meta} title={`Payslips ${run.period}`} entries={lines.map((line) => ({ run, line }))} />
}

/** Payslips from any mix of runs, one page each. Used by run documents and the export centre. */
export function PayslipBundleDocument({ meta, title, entries }: { meta: Meta; title: string; entries: { run: RunInfo; line: RunLine }[] }) {
  return (
    <Doc title={title}>
      {entries.map(({ run, line }) => {
        const allowances = line.lineItems.allowances.length || line.allowancesTotal === 0 ? line.lineItems.allowances : [{ name: 'Allowances', amount: line.allowancesTotal }]
        const deductions = line.lineItems.deductions.length || line.deductionsTotal === 0 ? line.lineItems.deductions : [{ name: 'Other deductions', amount: line.deductionsTotal }]
        return (
          <DocPage key={`${run.year}-${run.month}-${line.employeeCode}`} meta={meta} eyebrow="Payslip" title={run.period} subtitle={run.paidAt ? `Paid ${longDate(run.paidAt)}` : undefined}>
            <View style={[styles.section, { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: colors.border, borderRadius: 4, padding: 10 }]}>
              {(
                [
                  ['Employee', line.employeeName],
                  ['Employee ID', line.employeeCode],
                  ['Department', line.department],
                  ['Position', line.designation ?? '-'],
                  ['SSNIT number', line.ssnitNumber ?? '-'],
                  ['TIN', line.tin ?? '-'],
                  ['Bank', line.bankName ?? '-'],
                  ['Account', maskAccount(line.accountNumber)],
                ] as const
              ).map(([label, value]) => (
                <View key={label} style={{ width: '50%', flexDirection: 'row', paddingVertical: 2 }}>
                  <Text style={{ width: 80, color: colors.subtle }}>{label}</Text>
                  <Text style={styles.bold}>{value}</Text>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 20 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Earnings ({activeCurrency()})</Text>
                <PayslipRow label="Basic salary" value={line.baseSalary} />
                {allowances.map((a, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: names can repeat in a fixed snapshot
                  <PayslipRow key={`${a.name}-${i}`} label={a.name} value={a.amount} />
                ))}
                <View style={{ borderTopWidth: 1.5, borderTopColor: colors.ink, marginTop: 2 }}>
                  <PayslipRow label="Gross pay" value={line.grossIncome} strong />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Deductions ({activeCurrency()})</Text>
                <PayslipRow label="SSNIT (employee 5.5%)" value={line.ssnitEmployee} negative />
                <PayslipRow label="PAYE income tax" value={line.paye} negative />
                {deductions.map((d, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: names can repeat in a fixed snapshot
                  <PayslipRow key={`${d.name}-${i}`} label={d.name} value={d.amount} negative />
                ))}
                <View style={{ borderTopWidth: 1.5, borderTopColor: colors.ink, marginTop: 2 }}>
                  <PayslipRow label="Total deductions" value={line.totalDeductions} strong negative />
                </View>
              </View>
            </View>

            <View style={{ marginTop: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.brandSoft, borderRadius: 4, paddingVertical: 12, paddingHorizontal: 14 }}>
              <Text style={[styles.bold, { fontSize: 11 }]}>Net pay</Text>
              <Text style={[styles.bold, { fontSize: 18, color: colors.brand }]}>{money(line.netPay)}</Text>
            </View>

            <View style={{ marginTop: 14, gap: 3 }}>
              <Text style={styles.note}>
                Chargeable income for PAYE: {money(line.taxableIncome)} (after SSNIT{line.reliefs ? ` and reliefs of ${money(line.reliefs)}` : ''}).
              </Text>
              <Text style={styles.note}>Your employer also paid {money(line.ssnitEmployer)} in SSNIT contributions on your behalf.</Text>
              <Text style={styles.note}>This is a computer-generated payslip. Questions? Contact your payroll or HR team.</Text>
            </View>
          </DocPage>
        )
      })}
    </Doc>
  )
}

// ---------------------------------------------------------------------------
// Payroll summary and approval sheet

export function RunSummaryDocument({ meta, run, lines }: { meta: Meta; run: RunInfo; lines: RunLine[] }) {
  const gross = sum(lines, (l) => l.grossIncome)
  const employerSsnit = sum(lines, (l) => l.ssnitEmployer)
  const departments = [...new Set(lines.map((l) => l.department))].sort().map((name) => {
    const group = lines.filter((l) => l.department === name)
    return { name, count: group.length, gross: sum(group, (l) => l.grossIncome), paye: sum(group, (l) => l.paye), ssnit: sum(group, (l) => l.ssnitEmployee + l.ssnitEmployer), net: sum(group, (l) => l.netPay) }
  })
  const split = lines.map(ssnitSplit)
  const tier1 = Math.round(split.reduce((t, s) => t + s.tier1, 0) * 100) / 100
  const tier2 = Math.round(split.reduce((t, s) => t + s.tier2, 0) * 100) / 100
  type Dept = (typeof departments)[number]
  const deptColumns: Column<Dept>[] = [
    { label: 'Department', width: 30, value: (d) => d.name },
    { label: 'Employees', width: 10, align: 'right', value: (d) => String(d.count) },
    { label: 'Gross pay', width: 15, align: 'right', value: (d) => amount(d.gross) },
    { label: 'PAYE', width: 15, align: 'right', value: (d) => amount(d.paye) },
    { label: 'SSNIT (total)', width: 15, align: 'right', value: (d) => amount(d.ssnit) },
    { label: 'Net pay', width: 15, align: 'right', value: (d) => amount(d.net) },
  ]
  const remittances: [string, string, string, number][] = [
    ['PAYE income tax', 'Ghana Revenue Authority', dueDate(run, 15), sum(lines, (l) => l.paye)],
    ['SSNIT Tier 1', 'Social Security and National Insurance Trust', dueDate(run, 14), tier1],
    ['Tier 2 pension', 'Your occupational pension trustee', dueDate(run, 14), tier2],
    ['Net salaries', meta.company.bankName ? `Paid from ${meta.company.bankName}` : 'Employees’ bank accounts', 'Pay date', sum(lines, (l) => l.netPay)],
  ]

  return (
    <Doc title={`Payroll summary ${run.period}`}>
      <DocPage meta={meta} eyebrow="Payroll summary and approval" title={run.period} subtitle={`Status: ${run.status.charAt(0) + run.status.slice(1).toLowerCase()}`}>
        <View style={styles.section}>
          <Facts
            items={[
              ['Employees paid', String(lines.length)],
              ['Gross pay', money(gross)],
              ['Net pay', money(sum(lines, (l) => l.netPay))],
              ['Total employer cost', money(gross + employerSsnit)],
            ]}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>By department ({activeCurrency()})</Text>
          <Table
            columns={deptColumns}
            rows={departments}
            total={['Total', String(lines.length), amount(gross), amount(sum(lines, (l) => l.paye)), amount(sum(lines, (l) => l.ssnitEmployee + l.ssnitEmployer)), amount(sum(lines, (l) => l.netPay))]}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payments and remittances</Text>
          <Table
            columns={[
              { label: 'Payment', width: 22, value: (r) => r[0] },
              { label: 'Paid to', width: 38, value: (r) => r[1] },
              { label: 'Due by', width: 20, value: (r) => r[2] },
              { label: `Amount (${activeCurrency()})`, width: 20, align: 'right', value: (r) => amount(r[3]) },
            ]}
            rows={remittances}
          />
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Approval trail</Text>
          {(
            [
              { label: 'Prepared by', name: run.createdBy, at: null },
              { label: 'Submitted by', name: run.submittedBy, at: run.submittedAt },
              ...run.approvals.map((a) => ({ label: 'Approved by', name: a.name, at: a.at })),
              ...(run.paidAt ? [{ label: 'Marked as paid', name: null, at: run.paidAt }] : []),
            ] as { label: string; name: string | null; at: Date | null }[]
          ).map(({ label, name, at }, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed trail order
            <View key={i} style={{ flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ width: 100, color: colors.subtle }}>{label}</Text>
              <Text style={[styles.bold, { flex: 1 }]}>{name ?? '-'}</Text>
              <Text style={{ color: colors.muted }}>{at ? longDate(at) : ''}</Text>
            </View>
          ))}
          {run.notes ? <Text style={[styles.note, { marginTop: 6 }]}>Notes: {run.notes}</Text> : null}
        </View>

        <Signatures
          people={[
            { role: 'Prepared by', name: run.submittedBy ?? run.createdBy, date: run.submittedAt },
            { role: 'Approved by', name: run.approvals.map((a) => a.name).join(', ') || null, date: run.approvals.at(-1)?.at ?? null },
            { role: 'Finance / authorised signatory' },
          ]}
        />
      </DocPage>
    </Doc>
  )
}

// ---------------------------------------------------------------------------
// Bank payment instruction letter with schedule

export function BankInstructionDocument({ meta, run, lines }: { meta: Meta; run: RunInfo; lines: RunLine[] }) {
  const total = sum(lines, (l) => l.netPay)
  const c = meta.company
  const columns: Column<RunLine>[] = [
    { label: '#', width: 5, value: (_l, i) => String(i + 1) },
    { label: 'Beneficiary', width: 27, value: (l) => l.accountName || l.employeeName },
    { label: 'Employee ID', width: 12, value: (l) => l.employeeCode },
    { label: 'Bank', width: 22, value: (l) => l.bankName ?? 'MISSING' },
    { label: 'Account number', width: 18, value: (l) => l.accountNumber ?? 'MISSING' },
    { label: `Amount (${activeCurrency()})`, width: 16, align: 'right', value: (l) => amount(l.netPay) },
  ]

  return (
    <Doc title={`Salary payment instruction ${run.period}`}>
      <DocPage meta={meta} eyebrow="Payment instruction" title={`Salaries for ${run.period}`}>
        <Text style={{ marginBottom: 14 }}>{longDate(meta.generatedAt)}</Text>
        <View style={{ marginBottom: 14 }}>
          <Text style={styles.bold}>The Branch Manager</Text>
          <Text>{c.bankName ?? '[Bank name]'}</Text>
          {c.bankBranch ? <Text>{c.bankBranch}</Text> : null}
        </View>
        <Text style={{ marginBottom: 10 }}>Dear Sir or Madam,</Text>
        <Text style={[styles.bold, { marginBottom: 10, textDecoration: 'underline' }]}>SALARY PAYMENT INSTRUCTION: {run.period.toUpperCase()}</Text>
        <Text style={[styles.paragraph, { marginBottom: 8 }]}>
          Please debit our account {c.bankAccountName ? `${c.bankAccountName}, ` : ''}number {c.bankAccountNumber ?? '[account number]'}, with the sum of {money(total)} and credit the {lines.length}{' '}
          {lines.length === 1 ? 'account' : 'accounts'} listed in the attached schedule with the amounts shown against each beneficiary.
        </Text>
        <Text style={[styles.paragraph, { marginBottom: 14 }]}>The schedule has been prepared from our approved payroll for {run.period}. Please contact us before processing if any account details cannot be validated.</Text>

        <View style={styles.section}>
          <Facts
            items={[
              ['Debit account', c.bankAccountNumber ?? '-'],
              ['Number of payments', String(lines.length)],
              ['Total amount', money(total)],
              ['Payroll approved', run.approvals.length ? longDate(run.approvals[run.approvals.length - 1].at) : 'Not yet'],
            ]}
          />
        </View>

        <Text>Yours faithfully,</Text>
        <Signatures people={[{ role: 'Authorised signatory' }, { role: 'Authorised signatory' }]} />
        <Text style={[styles.note, { marginTop: 10 }]}>For and on behalf of {c.companyName}</Text>

        <View break>
          <Text style={[styles.sectionTitle, { marginTop: 4 }]}>Payment schedule, {run.period}</Text>
          <Table columns={columns} rows={lines} total={['', 'Total', '', '', `${lines.length} payments`, amount(total)]} />
        </View>
      </DocPage>
    </Doc>
  )
}

// ---------------------------------------------------------------------------
// Statutory schedules

export function PayeScheduleDocument({ meta, run, lines }: { meta: Meta; run: RunInfo; lines: RunLine[] }) {
  const columns: Column<RunLine>[] = [
    { label: '#', width: 4, value: (_l, i) => String(i + 1) },
    { label: 'TIN / Ghana Card', width: 13, value: (l) => l.tin ?? 'MISSING' },
    { label: 'Employee', width: 17, value: (l) => l.employeeName },
    { label: 'Position', width: 12, value: (l) => l.designation ?? '-' },
    { label: 'Basic', width: 9, align: 'right', value: (l) => amount(l.baseSalary) },
    { label: 'Allowances', width: 9, align: 'right', value: (l) => amount(l.allowancesTotal) },
    { label: 'Gross', width: 9, align: 'right', value: (l) => amount(l.grossIncome) },
    { label: 'SSNIT', width: 8, align: 'right', value: (l) => amount(l.ssnitEmployee) },
    { label: 'Chargeable', width: 10, align: 'right', value: (l) => amount(l.taxableIncome) },
    { label: 'PAYE', width: 9, align: 'right', value: (l) => amount(l.paye) },
  ]
  return (
    <Doc title={`PAYE schedule ${run.period}`}>
      <DocPage meta={meta} orientation="landscape" eyebrow="GRA PAYE schedule" title={run.period} subtitle={`Employer TIN ${meta.company.taxId ?? 'not set'} · Due by ${dueDate(run, 15)}`}>
        <View style={styles.section}>
          <Facts items={[['Employees', String(lines.length)], ['Gross income', money(sum(lines, (l) => l.grossIncome))], ['Chargeable income', money(sum(lines, (l) => l.taxableIncome))], ['PAYE payable', money(sum(lines, (l) => l.paye))]]} />
        </View>
        <Table
          columns={columns}
          rows={lines}
          total={['', '', 'Total', '', amount(sum(lines, (l) => l.baseSalary)), amount(sum(lines, (l) => l.allowancesTotal)), amount(sum(lines, (l) => l.grossIncome)), amount(sum(lines, (l) => l.ssnitEmployee)), amount(sum(lines, (l) => l.taxableIncome)), amount(sum(lines, (l) => l.paye))]}
        />
        <Signatures people={[{ role: 'Prepared by', name: meta.generatedBy }, { role: 'Authorised signatory' }]} />
      </DocPage>
    </Doc>
  )
}

export function SsnitScheduleDocument({ meta, run, lines }: { meta: Meta; run: RunInfo; lines: RunLine[] }) {
  const rows = lines.map((line) => ({ line, ...ssnitSplit(line) }))
  type Row = (typeof rows)[number]
  const columns: Column<Row>[] = [
    { label: '#', width: 4, value: (_r, i) => String(i + 1) },
    { label: 'SSNIT number', width: 13, value: (r) => r.line.ssnitNumber ?? 'MISSING' },
    { label: 'Employee', width: 19, value: (r) => r.line.employeeName },
    { label: 'Basic salary', width: 10, align: 'right', value: (r) => amount(r.line.baseSalary) },
    { label: 'Employee 5.5%', width: 10, align: 'right', value: (r) => amount(r.line.ssnitEmployee) },
    { label: 'Employer 13%', width: 10, align: 'right', value: (r) => amount(r.line.ssnitEmployer) },
    { label: 'Total 18.5%', width: 10, align: 'right', value: (r) => amount(r.total) },
    { label: 'Tier 1', width: 12, align: 'right', value: (r) => amount(r.tier1) },
    { label: 'Tier 2', width: 12, align: 'right', value: (r) => amount(r.tier2) },
  ]
  const t = (pick: (r: Row) => number) => amount(Math.round(rows.reduce((s, r) => s + pick(r), 0) * 100) / 100)
  return (
    <Doc title={`SSNIT contributions ${run.period}`}>
      <DocPage meta={meta} orientation="landscape" eyebrow="SSNIT contribution schedule" title={run.period} subtitle={`Employer SSNIT number ${meta.company.employerSsnitNumber ?? 'not set'} · Due by ${dueDate(run, 14)}`}>
        <View style={styles.section}>
          <Facts items={[['Employees', String(rows.length)], ['Total contributions', `${activeCurrency()} ${t((r) => r.total)}`], ['Tier 1 to SSNIT', `${activeCurrency()} ${t((r) => r.tier1)}`], ['Tier 2 to trustee', `${activeCurrency()} ${t((r) => r.tier2)}`]]} />
        </View>
        <Table columns={columns} rows={rows} total={['', '', 'Total', t((r) => r.line.baseSalary), t((r) => r.line.ssnitEmployee), t((r) => r.line.ssnitEmployer), t((r) => r.total), t((r) => r.tier1), t((r) => r.tier2)]} />
        <Signatures people={[{ role: 'Prepared by', name: meta.generatedBy }, { role: 'Authorised signatory' }]} />
      </DocPage>
    </Doc>
  )
}
