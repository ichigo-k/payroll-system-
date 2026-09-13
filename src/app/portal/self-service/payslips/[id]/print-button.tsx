'use client'

import { Printer } from 'lucide-react'
import { button } from '@/components/app/styles'

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={button.default}>
      <Printer className="size-4" />
      Print or save as PDF
    </button>
  )
}
