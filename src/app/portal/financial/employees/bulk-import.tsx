'use client'

import { CircleAlert, CircleCheck, Download, FileSpreadsheet, Upload, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState, useTransition } from 'react'
import { useFlags } from '@/components/app/flags'
import { button } from '@/components/app/styles'
import { EMPLOYEE_IMPORT_COLUMNS, parseEmployeeCsv } from '@/lib/csv'
import { cn } from '@/lib/utils'
import { importEmployees } from './actions'

const PREVIEW_LIMIT = 200

export function BulkImport({ existingEmails, existingIds, departments }: { existingEmails: string[]; existingIds: string[]; departments: string[] }) {
  const router = useRouter()
  const { showFlag } = useFlags()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [file, setFile] = useState<{ name: string; csv: string } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = useMemo(() => (file ? parseEmployeeCsv(file.csv) : null), [file])
  const emails = useMemo(() => new Set(existingEmails), [existingEmails])
  const ids = useMemo(() => new Set(existingIds), [existingIds])
  const knownDepartments = useMemo(() => new Set(departments.map((d) => d.toLowerCase())), [departments])

  const rows = (parsed?.rows ?? []).map((row) => {
    const duplicate = emails.has(row.email) ? 'Already on payroll (email)' : ids.has(row.employeeId) ? 'Already on payroll (employee ID)' : null
    return { ...row, duplicate }
  })
  const ready = rows.filter((r) => r.errors.length === 0 && !r.duplicate)
  const invalid = rows.filter((r) => r.errors.length > 0)
  const duplicates = rows.filter((r) => r.errors.length === 0 && r.duplicate)
  const newDepartments = [...new Set(ready.map((r) => r.department.trim()).filter((d) => d && !knownDepartments.has(d.toLowerCase())))]

  async function readFile(selected: File | undefined) {
    setError(null)
    if (!selected) return
    if (!/\.csv$/i.test(selected.name)) {
      setError('Choose a .csv file. In Excel or Google Sheets, use File > Download > CSV.')
      return
    }
    setFile({ name: selected.name, csv: await selected.text() })
  }

  function reset() {
    setFile(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function submit() {
    if (!file) return
    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append('csv', file.csv)
        const result = await importEmployees(formData)
        const extras = [result.duplicates ? `${result.duplicates} already on payroll` : '', result.invalid ? `${result.invalid} with errors` : ''].filter(Boolean)
        showFlag({
          tone: 'success',
          title: `Imported ${result.imported} ${result.imported === 1 ? 'employee' : 'employees'}${extras.length ? ` (skipped ${extras.join(', ')})` : ''}.`,
        })
        router.push('/portal/financial/employees')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Import failed. Please try again.')
      }
    })
  }

  return (
    <div className="border-t border-border">
      <section className="grid gap-4 border-b border-border py-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
        <div>
          <h2 className="text-base font-semibold">1. Prepare your file</h2>
          <p className="mt-1 text-sm text-muted-foreground">One employee per row, saved as CSV.</p>
        </div>
        <div className="grid gap-3">
          <a href="/portal/financial/employees/template" className={cn(button.default, 'w-fit')}>
            <Download className="size-4" />
            Download template
          </a>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-muted-foreground">Required columns</dt>
              <dd className="mt-1 font-mono text-xs text-foreground">{EMPLOYEE_IMPORT_COLUMNS.required.join(', ')}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground">Optional columns</dt>
              <dd className="mt-1 font-mono text-xs text-foreground">{EMPLOYEE_IMPORT_COLUMNS.optional.join(', ')}</dd>
            </div>
          </dl>
          <p className="text-xs text-subtlest">
            Dates use YYYY-MM-DD. Leave employee_id blank to generate IDs, or fill it to keep IDs from another system. New departments are created automatically.
          </p>
        </div>
      </section>

      <section className="grid gap-4 border-b border-border py-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
        <div>
          <h2 className="text-base font-semibold">2. Upload</h2>
          <p className="mt-1 text-sm text-muted-foreground">We check every row before anything is saved.</p>
        </div>
        <div>
          {file ? (
            <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
              <FileSpreadsheet className="size-5 shrink-0 text-success" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{rows.length} rows found</p>
              </div>
              <button type="button" onClick={reset} aria-label="Remove file" className={button.icon}>
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <label
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                readFile(event.dataTransfer.files[0])
              }}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors duration-150 has-focus-visible:border-ring',
                dragging ? 'border-primary bg-accent' : 'border-input hover:border-primary hover:bg-muted',
              )}
            >
              <Upload className="size-6 text-muted-foreground" />
              <span className="mt-3 text-sm font-medium text-foreground">Drop your CSV here, or click to choose a file</span>
              <span className="mt-1 text-xs text-muted-foreground">.csv files only</span>
              <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => readFile(event.target.files?.[0])} />
            </label>
          )}
          {(error || parsed?.error) && (
            <p role="alert" className="mt-3 flex items-center gap-1.5 text-sm text-danger">
              <CircleAlert className="size-4 shrink-0" />
              {error ?? parsed?.error}
            </p>
          )}
        </div>
      </section>

      {rows.length > 0 && (
        <section className="py-6">
          <h2 className="text-base font-semibold">3. Review</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-semibold text-success">{ready.length} ready</span>
            {duplicates.length > 0 && <>, {duplicates.length} already on payroll</>}
            {invalid.length > 0 && (
              <>
                , <span className="font-semibold text-danger">{invalid.length} with errors</span>
              </>
            )}
            . Only ready rows are imported.
          </p>
          {newDepartments.length > 0 && <p className="mt-1 text-sm text-muted-foreground">New departments to create: {newDepartments.join(', ')}</p>}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b-2 border-border text-left text-xs font-semibold text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Row
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Name
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Email
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Employee ID
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Department
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Start date
                  </th>
                  <th scope="col" className="py-2 pl-3 font-semibold">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, PREVIEW_LIMIT).map((row) => (
                  <tr key={row.line} className={cn('border-b border-border align-top', row.errors.length > 0 && 'bg-danger-soft/40')}>
                    <td className="num py-2 pr-3 text-muted-foreground">{row.line}</td>
                    <td className="px-3 py-2">{`${row.firstName} ${row.lastName}`.trim() || '-'}</td>
                    <td className="px-3 py-2">{row.email || '-'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.employeeId || <span className="font-sans text-subtlest">Generated</span>}</td>
                    <td className="px-3 py-2">{row.department || 'General'}</td>
                    <td className="num px-3 py-2">{row.startDate || '-'}</td>
                    <td className="py-2 pl-3">
                      {row.errors.length > 0 ? (
                        <span className="flex items-start gap-1.5 text-danger">
                          <CircleAlert className="mt-0.5 size-4 shrink-0" />
                          {row.errors.join('. ')}
                        </span>
                      ) : row.duplicate ? (
                        <span className="text-muted-foreground">Skip: {row.duplicate.toLowerCase()}</span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-success">
                          <CircleCheck className="size-4 shrink-0" />
                          Ready
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > PREVIEW_LIMIT && (
              <p className="mt-2 text-xs text-muted-foreground">
                Showing the first {PREVIEW_LIMIT} of {rows.length} rows.
              </p>
            )}
          </div>
        </section>
      )}

      <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card py-3">
        <Link href="/portal/financial/employees" className={button.subtle}>
          Cancel
        </Link>
        <button type="button" onClick={submit} disabled={isPending || ready.length === 0} className={button.primary}>
          {isPending ? 'Importing' : ready.length ? `Import ${ready.length} ${ready.length === 1 ? 'employee' : 'employees'}` : 'Import employees'}
        </button>
      </div>
    </div>
  )
}
