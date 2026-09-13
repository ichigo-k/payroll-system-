'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, CircleCheck, Download, FileSpreadsheet } from 'lucide-react'
import { button } from '@/components/app/styles'
import { importEmployees } from './actions'

type Result = { tone: 'success' | 'error'; message: string }

export function BulkImport({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [fileName, setFileName] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  function submit() {
    const file = inputRef.current?.files?.[0]
    if (!file) {
      setResult({ tone: 'error', message: 'Choose a CSV file first.' })
      return
    }
    setResult(null)
    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append('csv', await file.text())
        const { imported, skipped } = await importEmployees(formData)
        setResult({
          tone: 'success',
          message: `${imported} imported${skipped ? `, ${skipped} skipped as duplicates` : ''}.`,
        })
        if (inputRef.current) inputRef.current.value = ''
        setFileName(null)
        router.refresh()
      } catch (err) {
        setResult({ tone: 'error', message: err instanceof Error ? err.message : 'Import failed. Please try again.' })
      }
    })
  }

  if (!canEdit) {
    return <p className="text-sm text-muted-foreground">Only administrators and payroll preparers can import employees.</p>
  }

  return (
    <div className="grid gap-3">
      <ol className="grid gap-1 text-sm text-muted-foreground">
        <li>1. Download the template and fill in one employee per row.</li>
        <li>2. Save it as CSV. Required columns: first_name, last_name, email, employee_id, start_date (YYYY-MM-DD).</li>
        <li>3. Upload it below. Rows that match an existing email or employee ID are skipped.</li>
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href="/portal/financial/employees/template"
          className={button.default}
        >
          <Download className="size-4" />
          Template
        </a>

        <label className="pressable inline-flex h-8 min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-input bg-card px-3 text-sm text-foreground hover:border-primary hover:bg-accent has-focus-visible:border-ring has-focus-visible:shadow-[inset_0_0_0_1px_var(--ring)]">
          <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{fileName ?? 'Choose CSV file'}</span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => {
              setFileName(event.target.files?.[0]?.name ?? null)
              setResult(null)
            }}
          />
        </label>

        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className={button.primary}
        >
          {isPending ? 'Importing' : 'Import employees'}
        </button>
      </div>

      <div aria-live="polite" className="min-h-5 text-sm">
        {result && (
          <p className={`flex items-center gap-1.5 ${result.tone === 'error' ? 'text-danger' : 'text-success'}`}>
            {result.tone === 'error' ? <CircleAlert className="size-4 shrink-0" /> : <CircleCheck className="size-4 shrink-0" />}
            {result.message}
          </p>
        )}
      </div>
    </div>
  )
}
