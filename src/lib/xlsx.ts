import ExcelJS from 'exceljs'

type Cell = string | number | null

/**
 * Builds an Excel workbook from rows. The first row with several cells is treated as the header:
 * bold, frozen and filtered. Number-looking text becomes real numbers so totals and sorting work.
 */
export async function rowsToXlsx(sheets: { name: string; rows: Cell[][] }[]) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'PayCompass'
  workbook.created = new Date()

  for (const { name, rows } of sheets) {
    const sheet = workbook.addWorksheet(name.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '))
    const headerIndex = Math.max(
      0,
      rows.findIndex((row) => row.length > 3),
    )
    rows.forEach((row, index) => {
      const values = row.map((cell) => (typeof cell === 'string' && index > headerIndex && /^-?\d+(\.\d+)?$/.test(cell) ? Number(cell) : cell))
      const added = sheet.addRow(values)
      if (index === headerIndex) {
        added.font = { bold: true, color: { argb: 'FF44546F' } }
        added.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F8F9' } }
        added.border = { bottom: { style: 'thin', color: { argb: 'FFDFE1E6' } } }
      }
      if (index > headerIndex && String(row.find((c) => c === 'TOTAL' || c === 'Total') ?? '') !== '') added.font = { bold: true }
    })
    const header = rows[headerIndex] ?? []
    sheet.views = [{ state: 'frozen', ySplit: headerIndex + 1 }]
    if (header.length) sheet.autoFilter = { from: { row: headerIndex + 1, column: 1 }, to: { row: headerIndex + 1, column: header.length } }
    sheet.columns.forEach((column, i) => {
      const longest = rows.reduce((max, row) => Math.max(max, String(row[i] ?? '').length), 8)
      column.width = Math.min(40, longest + 2)
      const sample = rows.slice(headerIndex + 1).find((row) => typeof row[i] === 'number' || /^-?\d+\.\d{2}$/.test(String(row[i] ?? '')))
      if (sample) column.numFmt = '#,##0.00'
    })
  }
  return Buffer.from(await workbook.xlsx.writeBuffer())
}
