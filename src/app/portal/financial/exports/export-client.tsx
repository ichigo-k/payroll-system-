'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark, Download, Eye, LoaderCircle, RotateCcw, SlidersHorizontal, Trash2 } from 'lucide-react'
import { CountryCombobox } from '@/components/app/country-combobox'
import { Dialog } from '@/components/app/dialog'
import { useFlags } from '@/components/app/flags'
import { Select } from '@/components/app/select'
import { button, field } from '@/components/app/styles'
import type { ExportFilters } from '@/lib/exports/filters'
import { MISSING_OPTIONS } from '@/lib/exports/filters'
import { cn } from '@/lib/utils'
import { deleteSavedReportAction, prepareExportAction, saveReportAction } from './actions'
import { safeAction } from '@/lib/safe-action'

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold text-muted-foreground">{children}</span>
}

function Range({ label, names, values, unit, min = 0 }: { label: string; names: [string, string]; values: [number | null, number | null]; unit: string; min?: number }) {
  return (
    <div className="grid gap-1">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        {names.map((name, i) => (
          <div key={name} className="relative flex-1">
            <input
              name={name}
              type="number"
              min={min}
              inputMode="numeric"
              defaultValue={values[i] ?? ''}
              placeholder={i === 0 ? 'From' : 'To'}
              aria-label={`${label} ${i === 0 ? 'from' : 'to'}`}
              className={cn(field, 'num pr-12')}
            />
            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-subtlest">{unit}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DateRange({ label, names, values, type = 'date' }: { label: string; names: [string, string]; values: [string, string]; type?: 'date' | 'month' }) {
  return (
    <div className="grid gap-1">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        {names.map((name, i) => (
          <input key={name} name={name} type={type} defaultValue={values[i]} aria-label={`${label} ${i === 0 ? 'from' : 'to'}`} className={cn(field, 'num flex-1')} />
        ))}
      </div>
    </div>
  )
}

/** The filter panel. Submits to the URL so previews, downloads and saved reports all use the same filters. */
export function FiltersForm({
  reportKey,
  filters,
  departments,
  usesPeriod,
  usesYear,
  canSeePay,
  years,
  activeCount,
}: {
  reportKey: string
  filters: ExportFilters
  departments: string[]
  usesPeriod?: boolean
  usesYear?: boolean
  canSeePay: boolean
  years: number[]
  activeCount: number
}) {
  const router = useRouter()
  const [status, setStatus] = useState(filters.status)
  const [open, setOpen] = useState(activeCount > 0 || usesPeriod || usesYear)
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams()
    const data = new FormData(event.currentTarget)
    const chosen = data.getAll('department').map(String)
    data.delete('department')
    for (const [key, value] of data.entries()) if (String(value).trim() && !(key === 'status' && value === 'active')) params.set(key, String(value))
    if (chosen.length) params.set('department', chosen.join(','))
    startTransition(() => router.push(`/portal/financial/exports?${params.toString()}`, { scroll: false }))
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-border">
      <input type="hidden" name="report" value={reportKey} />
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          Filters
          {activeCount > 0 && <span className="num rounded-full bg-accent px-1.5 text-xs text-primary">{activeCount}</span>}
        </span>
        <span className="text-xs text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
      </button>

      <div hidden={!open} className="border-t border-border px-4 pt-4 pb-3">
        <div className="grid gap-x-5 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
          {usesPeriod && <DateRange label="Pay periods" names={['from', 'to']} values={[filters.from, filters.to]} type="month" />}
          {usesYear && (
            <div className="grid gap-1">
              <FieldLabel>Tax year</FieldLabel>
              <Select name="year" aria-label="Tax year" defaultValue={String(filters.year ?? years[0])} options={years.map((y) => ({ value: String(y), label: String(y) }))} />
            </div>
          )}

          <div className="grid gap-1">
            <FieldLabel>Employees</FieldLabel>
            <div role="radiogroup" aria-label="Employees" className="flex h-9 rounded-md border border-input p-0.5">
              {(
                [
                  ['active', 'Current'],
                  ['left', 'Left'],
                  ['all', 'Everyone'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className={cn('flex flex-1 cursor-pointer items-center justify-center rounded-[4px] text-sm transition-colors duration-150', status === value ? 'bg-accent font-medium text-primary' : 'text-muted-foreground hover:bg-secondary')}>
                  <input type="radio" name="status" value={value} checked={status === value} onChange={() => setStatus(value)} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-1">
            <FieldLabel>Gender</FieldLabel>
            <Select
              name="gender"
              aria-label="Gender"
              defaultValue={filters.gender}
              options={[
                { value: '', label: 'Any gender' },
                { value: 'MALE', label: 'Male' },
                { value: 'FEMALE', label: 'Female' },
                { value: 'OTHER', label: 'Other' },
              ]}
            />
          </div>

          <div className="grid gap-1">
            <FieldLabel>Nationality</FieldLabel>
            <CountryCombobox name="nationality" defaultValue={filters.nationality} placeholder="Any country" />
          </div>

          <Range label="Age" names={['ageMin', 'ageMax']} values={[filters.ageMin, filters.ageMax]} unit="years" />
          <Range label="Years of service" names={['serviceMin', 'serviceMax']} values={[filters.serviceMin, filters.serviceMax]} unit="years" />
          <DateRange label="Joined between" names={['joinedFrom', 'joinedTo']} values={[filters.joinedFrom, filters.joinedTo]} />
          {status !== 'active' && <DateRange label="Left between" names={['leftFrom', 'leftTo']} values={[filters.leftFrom, filters.leftTo]} />}
          {canSeePay && <Range label="Monthly basic salary" names={['salaryMin', 'salaryMax']} values={[filters.salaryMin, filters.salaryMax]} unit="" />}

          <div className="grid gap-1">
            <FieldLabel>Missing details</FieldLabel>
            <Select name="missing" aria-label="Missing details" defaultValue={filters.missing} options={[{ value: '', label: 'Don’t filter' }, ...MISSING_OPTIONS.map((m) => ({ value: m.value, label: `Missing ${m.label.toLowerCase()}` }))]} />
          </div>

          {departments.length > 0 && (
            <fieldset className="grid gap-1.5 md:col-span-2 xl:col-span-3">
              <legend className="mb-1.5 text-xs font-semibold text-muted-foreground">Departments</legend>
              <div className="flex flex-wrap gap-1.5">
                {departments.map((d) => (
                  <label key={d} className="cursor-pointer">
                    <input type="checkbox" name="department" value={d} defaultChecked={filters.departments.includes(d)} className="peer sr-only" />
                    <span className="inline-flex h-8 items-center rounded-full border border-border px-3 text-sm text-muted-foreground transition-colors duration-150 peer-checked:border-primary peer-checked:bg-accent peer-checked:font-medium peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring hover:bg-secondary">
                      {d}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-3">
          <button type="button" onClick={() => startTransition(() => router.push(`/portal/financial/exports?report=${reportKey}`, { scroll: false }))} className={button.subtle}>
            <RotateCcw className="size-4" />
            Reset
          </button>
          <button type="submit" disabled={pending} className={button.primary}>
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            Apply filters
          </button>
        </div>
      </div>
    </form>
  )
}

const FORMAT_LABELS = { xlsx: 'Excel', csv: 'CSV', pdf: 'PDF' } as const

/** Download buttons, or a background job for big exports, plus saving the filters as a named report. */
export function ExportActions({ query, formats, large, size, unit }: { query: string; formats: ('xlsx' | 'csv' | 'pdf')[]; large: boolean; size: number; unit: string }) {
  const router = useRouter()
  const { showFlag } = useFlags()
  const [pending, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')

  const prepare = (format: string) =>
    startTransition(async () => {
      const result = await safeAction(() => prepareExportAction(query, format))
      showFlag({ tone: result.ok ? 'success' : 'error', title: result.message })
      if (result.ok) router.push('/portal/financial/exports?tab=history')
    })

  const save = () =>
    startTransition(async () => {
      const result = await safeAction(() => saveReportAction(name, query))
      showFlag({ tone: result.ok ? 'success' : 'error', title: result.message })
      if (result.ok) {
        setSaving(false)
        setName('')
        router.refresh()
      }
    })

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {size === 0 ? 'Nothing to export with these filters.' : large ? `${size.toLocaleString('en-GB')} ${unit}: large exports are prepared in the background.` : `${size.toLocaleString('en-GB')} ${unit} ready to export.`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setSaving(true)} className={button.subtle}>
          <Bookmark className="size-4" />
          Save report
        </button>
        {size > 0 &&
          formats.map((format, index) =>
            large ? (
              <button key={format} type="button" disabled={pending} onClick={() => prepare(format)} className={index === 0 ? button.primary : button.default}>
                {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
                Prepare {FORMAT_LABELS[format]}
              </button>
            ) : (
              <a key={format} href={`/portal/financial/exports/download?${query}&format=${format}`} className={index === 0 ? button.primary : button.default}>
                <Download className="size-4" />
                {FORMAT_LABELS[format]}
              </a>
            ),
          )}
        {size > 0 && !large && formats.includes('pdf') && (
          <a href={`/portal/financial/exports/download?${query}&format=pdf&inline=1`} target="_blank" rel="noreferrer" className={button.subtle}>
            <Eye className="size-4" />
            View PDF
          </a>
        )}
      </div>

      <Dialog
        width="sm"
        open={saving}
        onOpenChange={setSaving}
        title="Save this report"
        description="Saves the report type and filters so you can run it again with one click. Figures are always recalculated when you run it."
        footer={
          <>
            <button type="button" onClick={() => setSaving(false)} className={button.subtle}>
              Cancel
            </button>
            <button type="button" disabled={pending || name.trim().length < 2} onClick={save} className={button.primary}>
              {pending ? 'Saving' : 'Save report'}
            </button>
          </>
        }
      >
        <label className="mt-4 grid gap-1">
          <FieldLabel>Name</FieldLabel>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="For example, Finance staff over 30" className={field} />
        </label>
      </Dialog>
    </div>
  )
}

export function DeleteSavedReport({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const { showFlag } = useFlags()
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Delete saved report ${name}`}
      onClick={() =>
        startTransition(async () => {
          const result = await safeAction(() => deleteSavedReportAction(id))
          showFlag({ tone: result.ok ? 'success' : 'error', title: result.message })
          if (result.ok) router.refresh()
        })
      }
      className={cn(button.icon, 'size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-danger-soft hover:text-danger')}
    >
      <Trash2 className="size-3.5" />
    </button>
  )
}
