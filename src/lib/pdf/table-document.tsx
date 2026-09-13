import { Text, View } from '@react-pdf/renderer'
import { amount, type Column, Doc, DocPage, Facts, type Meta, styles, Table } from './theme'

export type TableColumn = { key: string; label: string; kind?: 'text' | 'money' | 'number' | 'date' }
export type TableRow = Record<string, string | number | null>

const cell = (value: string | number | null | undefined, kind: TableColumn['kind']) => {
  if (value === null || value === undefined || value === '') return '-'
  if (kind === 'money' && typeof value === 'number') return amount(value)
  return String(value)
}

/** Any export centre report as a PDF: title, the filters used, key totals and the table. */
export function TableDocument({
  meta,
  title,
  eyebrow = 'Report',
  filtersText,
  summary,
  columns,
  rows,
  totals,
}: {
  meta: Meta
  title: string
  eyebrow?: string
  filtersText: string
  summary: [string, string][]
  columns: TableColumn[]
  rows: TableRow[]
  totals?: TableRow
}) {
  // Size columns by their longest content so names get room and numbers stay tight
  const weights = columns.map((c) => Math.min(28, Math.max(c.label.length, ...rows.slice(0, 200).map((r) => cell(r[c.key], c.kind).length)) + 2))
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  const pdfColumns: Column<TableRow>[] = columns.map((c, i) => ({
    label: c.label,
    width: (weights[i] / totalWeight) * 100,
    align: c.kind === 'money' || c.kind === 'number' ? 'right' : 'left',
    value: (row) => cell(row[c.key], c.kind),
  }))
  // "Total" goes in the widest text column so it never wraps in a narrow one like TIN
  const labelIndex = columns.reduce(
    (best, c, i) => (c.kind !== 'money' && c.kind !== 'number' && weights[i] > (weights[best] ?? -1) && totals?.[c.key] === undefined ? i : best),
    0,
  )
  const orientation = columns.length > 7 || totalWeight > 120 ? 'landscape' : 'portrait'

  return (
    <Doc title={title}>
      <DocPage meta={meta} orientation={orientation} eyebrow={eyebrow} title={title}>
        <View style={styles.section}>
          <Text style={styles.note}>{filtersText}</Text>
        </View>
        {summary.length > 0 && (
          <View style={styles.section}>
            <Facts items={summary.slice(0, 4)} />
          </View>
        )}
        {rows.length === 0 ? (
          <Text style={styles.note}>No records match these filters.</Text>
        ) : (
          <Table
            columns={pdfColumns}
            rows={rows}
            total={totals ? columns.map((c, i) => (i === labelIndex ? 'Total' : totals[c.key] === undefined ? '' : cell(totals[c.key], c.kind))) : undefined}
          />
        )}
      </DocPage>
    </Doc>
  )
}
