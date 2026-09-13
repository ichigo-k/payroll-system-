import { Text, View } from '@react-pdf/renderer'
import { activeCurrency } from '@/lib/currency'
import { amount, type Column, colors, Doc, DocPage, Facts, longDate, type Meta, money, Signatures, styles, Table } from './theme'

/** Year-end and on-request documents: annual tax certificates and employment confirmation letters. */

export type CertificateMonth = { month: number; grossIncome: number; ssnitEmployee: number; taxableIncome: number; paye: number }
export type CertificateEmployee = {
  employeeCode: string
  employeeName: string
  designation: string | null
  tin: string | null
  ssnitNumber: string | null
  months: CertificateMonth[]
}

const monthName = (month: number) => new Date(Date.UTC(2000, month - 1, 1)).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })
const total = (months: CertificateMonth[], pick: (m: CertificateMonth) => number) => Math.round(months.reduce((t, m) => t + pick(m), 0) * 100) / 100

export function TaxCertificatesDocument({ meta, year, employees, signatory }: { meta: Meta; year: number; employees: CertificateEmployee[]; signatory: string }) {
  return (
    <Doc title={`Tax certificates ${year}`}>
      {employees.map((e) => {
        const columns: Column<CertificateMonth>[] = [
          { label: 'Month', width: 24, value: (m) => monthName(m.month) },
          { label: `Gross income (${activeCurrency()})`, width: 19, align: 'right', value: (m) => amount(m.grossIncome) },
          { label: 'SSNIT (employee)', width: 19, align: 'right', value: (m) => amount(m.ssnitEmployee) },
          { label: 'Chargeable income', width: 19, align: 'right', value: (m) => amount(m.taxableIncome) },
          { label: 'PAYE deducted', width: 19, align: 'right', value: (m) => amount(m.paye) },
        ]
        return (
          <DocPage key={e.employeeCode} meta={meta} eyebrow="Annual tax certificate" title={`Year ended 31 December ${year}`}>
            <View style={[styles.section, { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: colors.border, borderRadius: 4, padding: 10 }]}>
              {(
                [
                  ['Employee', e.employeeName],
                  ['Employee ID', e.employeeCode],
                  ['Position', e.designation ?? '-'],
                  ['TIN / Ghana Card', e.tin ?? 'Not recorded'],
                  ['SSNIT number', e.ssnitNumber ?? 'Not recorded'],
                  ['Employer TIN', meta.company.taxId ?? 'Not recorded'],
                ] as const
              ).map(([label, value]) => (
                <View key={label} style={{ width: '50%', flexDirection: 'row', paddingVertical: 2 }}>
                  <Text style={{ width: 90, color: colors.subtle }}>{label}</Text>
                  <Text style={styles.bold}>{value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Facts
                items={[
                  ['Months paid', String(e.months.length)],
                  ['Gross income', money(total(e.months, (m) => m.grossIncome))],
                  ['SSNIT (employee)', money(total(e.months, (m) => m.ssnitEmployee))],
                  ['PAYE deducted', money(total(e.months, (m) => m.paye))],
                ]}
              />
            </View>

            <Table
              columns={columns}
              rows={e.months}
              total={[
                'Total',
                amount(total(e.months, (m) => m.grossIncome)),
                amount(total(e.months, (m) => m.ssnitEmployee)),
                amount(total(e.months, (m) => m.taxableIncome)),
                amount(total(e.months, (m) => m.paye)),
              ]}
            />

            <Text style={[styles.note, { marginTop: 14 }]}>
              This certifies that {meta.company.companyName} paid the income above to {e.employeeName} in {year} and deducted PAYE and employee SSNIT contributions as shown, based
              on approved payroll records. Keep it with your tax records.
            </Text>
            <Signatures people={[{ role: 'Authorised signatory', name: signatory }, { role: 'Company stamp' }]} />
          </DocPage>
        )
      })}
    </Doc>
  )
}

export type LetterDetails = {
  employeeName: string
  firstName: string
  employeeCode: string
  designation: string | null
  department: string
  startDate: Date
  endDate: Date | null
  current: boolean
  addressee: string
  purpose: string
  salary: { basic: number; allowances: number } | null
  signatory: { name: string; title: string }
}

export function ConfirmationLetterDocument({ meta, letter }: { meta: Meta; letter: LetterDetails }) {
  const role = letter.designation ? `${letter.designation} in the ${letter.department} department` : `a member of the ${letter.department} department`
  return (
    <Doc title={`Employment confirmation for ${letter.employeeName}`}>
      <DocPage meta={meta} eyebrow="Letter" title="Confirmation of employment">
        <Text style={{ marginBottom: 16 }}>{longDate(meta.generatedAt)}</Text>
        <Text style={[styles.bold, { marginBottom: 14 }]}>{letter.addressee || 'To whom it may concern'}</Text>
        <Text style={[styles.bold, { marginBottom: 12, textDecoration: 'underline' }]}>
          CONFIRMATION OF EMPLOYMENT: {letter.employeeName.toUpperCase()} ({letter.employeeCode})
        </Text>
        <Text style={{ marginBottom: 10 }}>
          This is to confirm that {letter.employeeName} {letter.current ? 'is' : 'was'} employed by {meta.company.companyName} as {role}.{' '}
          {letter.current
            ? `They have worked with us since ${longDate(letter.startDate)}.`
            : `They worked with us from ${longDate(letter.startDate)} to ${letter.endDate ? longDate(letter.endDate) : 'their last working day'}.`}
        </Text>
        {letter.salary ? (
          <View style={{ marginBottom: 10 }}>
            <Text style={{ marginBottom: 8 }}>
              {letter.firstName}’s current monthly pay before tax and deductions is {money(letter.salary.basic + letter.salary.allowances)}, made up of:
            </Text>
            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 4, padding: 10, width: 280 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                <Text style={{ color: colors.muted }}>Basic salary</Text>
                <Text>{money(letter.salary.basic)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                <Text style={{ color: colors.muted }}>Allowances</Text>
                <Text>{money(letter.salary.allowances)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4, marginTop: 2, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={styles.bold}>Gross monthly pay</Text>
                <Text style={styles.bold}>{money(letter.salary.basic + letter.salary.allowances)}</Text>
              </View>
            </View>
          </View>
        ) : null}
        {letter.purpose ? (
          <Text style={{ marginBottom: 10 }}>
            This letter is issued at {letter.firstName}’s request for {letter.purpose}.
          </Text>
        ) : null}
        <Text style={{ marginBottom: 10 }}>Please contact us if you need to verify these details.</Text>
        <Text>Yours faithfully,</Text>
        <Signatures people={[{ role: letter.signatory.title, name: letter.signatory.name }]} />
        <Text style={[styles.note, { marginTop: 8 }]}>For and on behalf of {meta.company.companyName}</Text>
      </DocPage>
    </Doc>
  )
}
