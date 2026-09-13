'use client'

import { Check, ChevronDown, Plus } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { field } from './styles'

type Option = { kind: 'existing'; name: string } | { kind: 'create'; name: string }

/**
 * Department picker: choose a saved department, or type a new name and add it.
 * New departments are only saved when the form is submitted (the server creates them).
 */
export function DepartmentCombobox({
  name,
  departments,
  defaultValue = '',
  required,
  id,
}: {
  name: string
  departments: string[]
  defaultValue?: string
  required?: boolean
  id?: string
}) {
  const autoId = useId()
  const inputId = id ?? `${autoId}-input`
  const listId = `${autoId}-list`
  const [known, setKnown] = useState(departments)
  const [value, setValue] = useState(defaultValue)
  const [query, setQuery] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const valueRef = useRef(value)
  valueRef.current = value

  const options = useMemo<Option[]>(() => {
    const q = query.trim().replace(/\s+/g, ' ')
    const filtered = q && q !== value ? known.filter((d) => d.toLowerCase().includes(q.toLowerCase())) : known
    const exact = known.some((d) => d.toLowerCase() === q.toLowerCase())
    const list: Option[] = filtered.map((d) => ({ kind: 'existing', name: d }))
    if (q && !exact) list.push({ kind: 'create', name: q })
    return list
  }, [known, query, value])

  function choose(option: Option) {
    if (option.kind === 'create') setKnown((current) => [...current, option.name].sort((a, b) => a.localeCompare(b)))
    setValue(option.name)
    setQuery(option.name)
    setOpen(false)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, options.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter' && open && options[active]) {
      event.preventDefault()
      choose(options[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
      setQuery(value)
    }
  }

  const isNew = value && !departments.some((d) => d.toLowerCase() === value.toLowerCase())

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          required={required && !value}
          value={query}
          placeholder="Select or type a department"
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Leaving without choosing restores the selected department, so typed text is never mistaken for a choice
            setTimeout(() => {
              setOpen(false)
              setQuery(valueRef.current)
            }, 120)
          }}
          onKeyDown={onKeyDown}
          className={cn(field, 'pr-8')}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Show departments"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setOpen((o) => !o)
            inputRef.current?.focus()
          }}
          className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-subtlest hover:text-foreground"
        >
          <ChevronDown className="size-4" />
        </button>
      </div>

      {open && options.length > 0 && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-[0_8px_12px_rgba(9,30,66,0.15),0_0_1px_rgba(9,30,66,0.31)]"
        >
          {options.map((option, index) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/useFocusableInteractive: keyboard selection is handled on the input via aria-activedescendant
            <div
              key={`${option.kind}-${option.name}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.kind === 'existing' && option.name === value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
              onMouseEnter={() => setActive(index)}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                index === active ? 'bg-secondary' : '',
                option.kind === 'create' && 'text-primary',
                option.kind === 'create' && index > 0 && 'mt-1 border-t border-border pt-2',
              )}
            >
              {option.kind === 'create' ? (
                <>
                  <Plus className="size-4 shrink-0" />
                  <span>
                    Add <span className="font-semibold">“{option.name}”</span> as a new department
                  </span>
                </>
              ) : (
                <>
                  <span className="flex-1 text-foreground">{option.name}</span>
                  {option.name === value && <Check className="size-4 text-primary" />}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {isNew && <p className="mt-1 text-xs text-muted-foreground">“{value}” will be added to your departments when you save.</p>}
    </div>
  )
}
