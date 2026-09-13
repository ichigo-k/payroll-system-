import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { LOGO_PNG_BASE64 } from '@/lib/email/logo'
import { formatMoney } from '@/lib/currency'

/**
 * Shared look for every PDF: Atlassian-style ink and blue, a letterhead with the company name,
 * a footer with who generated it and page numbers, and a DRAFT watermark for unapproved figures.
 */

export const colors = {
  ink: '#172B4D',
  muted: '#44546F',
  subtle: '#626F86',
  border: '#DFE1E6',
  zebra: '#F7F8F9',
  brand: '#0C66E4',
  brandSoft: '#E9F2FF',
  success: '#216E4E',
  warning: '#A54800',
  danger: '#AE2E24',
}

export const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 56, paddingHorizontal: 40, fontFamily: 'Helvetica', fontSize: 9, color: colors.ink },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 14, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 28, height: 28, borderRadius: 6 },
  company: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  companyMeta: { fontSize: 8, color: colors.subtle, marginTop: 1 },
  docTitleBlock: { alignItems: 'flex-end', maxWidth: 240 },
  eyebrow: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: colors.subtle, letterSpacing: 0.8, textTransform: 'uppercase' },
  docTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 2, textAlign: 'right' },
  docSubtitle: { fontSize: 8, color: colors.muted, marginTop: 2, textAlign: 'right' },
  footerRule: { position: 'absolute', left: 40, right: 40, bottom: 38, borderTopWidth: 1, borderTopColor: colors.border },
  footerLeft: { position: 'absolute', left: 40, bottom: 24, fontSize: 7, color: colors.subtle },
  footerPage: { position: 'absolute', right: 40, bottom: 24, fontSize: 7, color: colors.subtle },
  watermark: { position: 'absolute', top: '42%', left: 0, right: 0, textAlign: 'center', fontSize: 84, fontFamily: 'Helvetica-Bold', color: '#AE2E24', opacity: 0.08, transform: 'rotate(-30deg)' },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: colors.subtle, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 },
  section: { marginBottom: 16 },
  // Tables
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 4 },
  thead: { flexDirection: 'row', backgroundColor: colors.zebra, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { paddingVertical: 5, paddingHorizontal: 5, fontSize: 7, fontFamily: 'Helvetica-Bold', color: colors.muted },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  td: { paddingVertical: 4, paddingHorizontal: 5, fontSize: 8 },
  totalRow: { flexDirection: 'row', backgroundColor: colors.brandSoft },
  bold: { fontFamily: 'Helvetica-Bold' },
  right: { textAlign: 'right' },
  // Key facts
  facts: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: colors.border, borderRadius: 4 },
  fact: { width: '25%', padding: 8, borderRightWidth: 1, borderRightColor: colors.border },
  factLabel: { fontSize: 7, color: colors.subtle },
  factValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  note: { fontSize: 8, color: colors.muted },
  paragraph: { marginBottom: 2 },
})

export type Company = {
  companyName: string
  address: string | null
  taxId: string | null
  employerSsnitNumber: string | null
  bankName: string | null
  bankBranch: string | null
  bankAccountName: string | null
  bankAccountNumber: string | null
}

export const money = (value: number) => formatMoney(value)
export const amount = (value: number) => value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const longDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
export const dateTime = (d: Date) => d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function Letterhead({ company, eyebrow, title, subtitle }: { company: Company; eyebrow: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.header} fixed>
      <View style={styles.brandRow}>
        <Image src={`data:image/png;base64,${LOGO_PNG_BASE64}`} style={styles.logo} />
        <View>
          <Text style={styles.company}>{company.companyName}</Text>
          {company.address ? <Text style={styles.companyMeta}>{company.address}</Text> : null}
          {company.taxId ? <Text style={styles.companyMeta}>Employer TIN {company.taxId}</Text> : null}
        </View>
      </View>
      <View style={styles.docTitleBlock}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.docTitle}>{title}</Text>
        {subtitle ? <Text style={styles.docSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  )
}

export function Footer({ generatedBy, generatedAt }: { generatedBy: string; generatedAt: Date }) {
  return (
    <>
      <View style={styles.footerRule} fixed />
      <Text style={styles.footerLeft} fixed>{`Generated by ${generatedBy} on ${dateTime(generatedAt)} with PayCompass`}</Text>
      {/* Page numbers are drawn after layout; react-pdf drops them if a line height is set on the page, so none is */}
      <Text style={styles.footerPage} fixed render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </>
  )
}

export function Watermark({ show, label = 'DRAFT' }: { show: boolean; label?: string }) {
  if (!show) return null
  return (
    <Text style={styles.watermark} fixed>
      {label}
    </Text>
  )
}

export type Meta = { company: Company; generatedBy: string; generatedAt: Date; draft: boolean }

/** A standard page: letterhead, content, footer and optional watermark. */
export function DocPage({ meta, eyebrow, title, subtitle, orientation = 'portrait', children }: { meta: Meta; eyebrow: string; title: string; subtitle?: string; orientation?: 'portrait' | 'landscape'; children: React.ReactNode }) {
  return (
    <Page size="A4" orientation={orientation} style={styles.page}>
      <Watermark show={meta.draft} />
      <Letterhead company={meta.company} eyebrow={eyebrow} title={title} subtitle={subtitle} />
      {children}
      <Footer generatedBy={meta.generatedBy} generatedAt={meta.generatedAt} />
    </Page>
  )
}

export function Doc({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Document title={title} author="PayCompass" creator="PayCompass" producer="PayCompass">
      {children}
    </Document>
  )
}

export type Column<T> = { label: string; width: number; align?: 'left' | 'right'; value: (row: T, index: number) => string }

/** A table that repeats its header on every page and never splits a row. */
export function Table<T>({ columns, rows, total }: { columns: Column<T>[]; rows: T[]; total?: (string | null)[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.thead} fixed>
        {columns.map((c) => (
          <Text key={c.label} style={[styles.th, { width: `${c.width}%` }, c.align === 'right' ? styles.right : {}]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((row, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static document rows
        <View key={i} style={[styles.tr, i % 2 === 1 ? { backgroundColor: colors.zebra } : {}]} wrap={false}>
          {columns.map((c) => (
            <Text key={c.label} style={[styles.td, { width: `${c.width}%` }, c.align === 'right' ? styles.right : {}]}>
              {c.value(row, i)}
            </Text>
          ))}
        </View>
      ))}
      {total && (
        <View style={styles.totalRow} wrap={false}>
          {columns.map((c, i) => (
            <Text key={c.label} style={[styles.td, styles.bold, { width: `${c.width}%` }, c.align === 'right' ? styles.right : {}]}>
              {total[i] ?? ''}
            </Text>
          ))}
        </View>
      )}
    </View>
  )
}

export function Facts({ items }: { items: [string, string][] }) {
  return (
    <View style={styles.facts}>
      {items.map(([label, value], i) => (
        <View key={label} style={[styles.fact, (i + 1) % 4 === 0 ? { borderRightWidth: 0 } : {}, { width: `${100 / Math.min(4, items.length)}%` }]}>
          <Text style={styles.factLabel}>{label}</Text>
          <Text style={styles.factValue}>{value}</Text>
        </View>
      ))}
    </View>
  )
}

export function Signatures({ people }: { people: { role: string; name?: string | null; date?: Date | null }[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 16, marginTop: 24 }} wrap={false}>
      {people.map((p) => (
        <View key={p.role} style={{ flex: 1, maxWidth: people.length === 1 ? '50%' : undefined }}>
          <View style={{ height: 32, borderBottomWidth: 1, borderBottomColor: colors.ink }} />
          <Text style={[styles.bold, { marginTop: 4 }]}>{p.name ?? ' '}</Text>
          <Text style={styles.note}>{p.role}</Text>
          {p.date ? <Text style={styles.note}>{dateTime(p.date)}</Text> : <Text style={styles.note}>Date: ____________</Text>}
        </View>
      ))}
    </View>
  )
}
