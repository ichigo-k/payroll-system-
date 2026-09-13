import type { ReactElement } from 'react'

/** Renders a react-pdf document to a buffer. Loaded lazily so pages that never make PDFs don't pay for it. */
export async function renderPdf(document: ReactElement) {
  const { renderToBuffer } = await import('@react-pdf/renderer')
  // biome-ignore lint/suspicious/noExplicitAny: react-pdf's typings only accept its own Document element type
  return renderToBuffer(document as any)
}

export const CONTENT_TYPES = {
  csv: 'text/csv; charset=utf-8',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const
