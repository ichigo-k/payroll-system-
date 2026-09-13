'use client'

import { Download, Printer } from 'lucide-react'
import { button } from '@/components/app/styles'

export function PrintButton({ pdfHref }: { pdfHref: string }) {
  return (
    <>
      <button type="button" onClick={() => window.print()} className={button.subtle}>
        <Printer className="size-4" />
        Print
      </button>
      <a href={pdfHref} className={button.primary}>
        <Download className="size-4" />
        Download PDF
      </a>
    </>
  )
}
