'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { Check, Landmark } from 'lucide-react'
import { bankInitials, bankLogoUrl, findGhanaBank, type GhanaBank, searchGhanaBanks } from '@/lib/ghana-banks'
import { cn } from '@/lib/utils'
import { field } from './styles'

/** Bank logo from the bank's website, falling back to initials if it can't load. */
export function BankLogo({ name, size = 24, className }: { name: string | null | undefined; size?: number; className?: string }) {
  const bank = findGhanaBank(name)
  const [failed, setFailed] = useState(false)
  const box = { width: size, height: size }
  if (!name) {
    return (
      <span aria-hidden style={box} className={cn('flex shrink-0 items-center justify-center rounded-md bg-secondary text-subtlest', className)}>
        <Landmark className="size-3.5" />
      </span>
    )
  }
  if (!bank || failed) {
    return (
      <span aria-hidden style={{ ...box, fontSize: Math.max(8, size * 0.36) }} className={cn('flex shrink-0 items-center justify-center rounded-md bg-accent font-semibold text-primary-strong', className)}>
        {bankInitials(name)}
      </span>
    )
  }
  return (
    <span aria-hidden style={box} className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white', className)}>
      {/* biome-ignore lint/performance/noImgElement: tiny external favicon; next/image would need a proxy for it */}
      <img src={bankLogoUrl(bank, size > 32 ? 128 : 64)} alt="" width={size - 6} height={size - 6} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    </span>
  )
}

type Option = { kind: 'bank'; bank: GhanaBank } | { kind: 'custom'; name: string }

const MAX_RESULTS = 5

/**
 * Searchable bank picker with logos. Pick a licensed Ghanaian bank, or keep a typed name for
 * banks that aren't listed (rural and community banks). Submits the bank name.
 */
export function BankCombobox({ name, id, defaultValue = '' }: { name: string; id?: string; defaultValue?: string }) {
  const autoId = useId()
  const inputId = id ?? `${autoId}-input`
  const listId = `${autoId}-list`
  // Kept exactly as saved, so opening and saving the form never looks like a bank change
  const initial = defaultValue
  const [value, setValue] = useState(initial)
  const [query, setQuery] = useState(initial)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const valueRef = useRef(value)
  valueRef.current = value

  // Type-ahead only: nothing shows until something is typed, and only the best few matches
  const options = useMemo<Option[]>(() => {
    const q = query.trim().replace(/\s+/g, ' ')
    if (!q || q === value) return []
    const list: Option[] = searchGhanaBanks(q)
      .slice(0, MAX_RESULTS)
      .map((bank) => ({ kind: 'bank', bank }))
    // Offer a typed name only once it looks like a real name, or nothing listed matches
    if (!findGhanaBank(q) && (q.length >= 4 || list.length === 0)) list.push({ kind: 'custom', name: q })
    return list
  }, [query, value])

  function choose(option: Option) {
    const chosen = option.kind === 'bank' ? option.bank.name : option.name
    setValue(chosen)
    setQuery(chosen)
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

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center">
          <BankLogo key={value} name={query === value ? value : ''} size={22} />
        </span>
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={query}
          placeholder="Start typing a bank name"
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
            setOpen(true)
            // Clearing the field clears the bank
            if (!event.target.value.trim()) setValue('')
          }}
          onFocus={(event) => {
            // Select the current bank so typing replaces it straight away
            event.target.select()
            setOpen(true)
          }}
          onBlur={() => {
            // Leaving without choosing restores the selected bank, so half-typed text is never saved
            setTimeout(() => {
              setOpen(false)
              setQuery(valueRef.current)
            }, 120)
          }}
          onKeyDown={onKeyDown}
          className={cn(field, 'pl-9')}
        />
      </div>

      {open && options.length > 0 && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-popover p-1 shadow-[0_8px_12px_rgba(9,30,66,0.15),0_0_1px_rgba(9,30,66,0.31)]"
        >
          {options.map((option, index) => {
            const label = option.kind === 'bank' ? option.bank.name : option.name
            return (
              // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/useFocusableInteractive: keyboard selection is handled on the input via aria-activedescendant
              <div
                key={`${option.kind}-${label}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={label === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm',
                  index === active && 'bg-secondary',
                  option.kind === 'custom' && index > 0 && 'mt-1 border-t border-border pt-2',
                )}
              >
                <BankLogo name={option.kind === 'bank' ? option.bank.name : option.name} size={24} />
                <span className="min-w-0 flex-1">
                  {option.kind === 'bank' ? (
                    <span className="block truncate text-foreground">{option.bank.name}</span>
                  ) : (
                    <span className="block text-primary">
                      Use <span className="font-semibold">“{option.name}”</span>
                      <span className="block text-xs text-muted-foreground">For a bank that isn’t listed, like a rural bank</span>
                    </span>
                  )}
                </span>
                {label === value && <Check className="size-4 text-primary" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
