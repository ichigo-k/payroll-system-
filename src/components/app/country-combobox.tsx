'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { Check, Globe, X } from 'lucide-react'
import { type Country, countryName, flagUrl, searchCountries } from '@/lib/countries'
import { cn } from '@/lib/utils'
import { field } from './styles'

/** Country flag with a 3:2 frame, falling back to the country code if the image can't load. */
export function CountryFlag({ code, width = 24, className }: { code: string | null | undefined; width?: number; className?: string }) {
  const [failed, setFailed] = useState(false)
  const height = Math.round((width * 2) / 3)
  if (!code) {
    return (
      <span aria-hidden style={{ width, height }} className={cn('flex shrink-0 items-center justify-center rounded-[3px] bg-secondary text-subtlest', className)}>
        <Globe className="size-3" />
      </span>
    )
  }
  if (failed) {
    return (
      <span aria-hidden style={{ width, height, fontSize: Math.max(8, width * 0.36) }} className={cn('flex shrink-0 items-center justify-center rounded-[3px] bg-accent font-semibold text-primary-strong', className)}>
        {code}
      </span>
    )
  }
  return (
    // biome-ignore lint/performance/noImgElement: small external SVG flag; next/image adds nothing here
    <img
      src={flagUrl(code)}
      alt=""
      width={width}
      height={height}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{ width, height }}
      className={cn('shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(9,30,66,0.14)]', className)}
    />
  )
}

/**
 * Type-ahead country picker. Nothing is listed until you type; the best matches show with their flags.
 * Submits the ISO country code.
 */
export function CountryCombobox({ name, id, defaultValue = '', placeholder = 'Start typing a country' }: { name: string; id?: string; defaultValue?: string; placeholder?: string }) {
  const autoId = useId()
  const inputId = id ?? `${autoId}-input`
  const listId = `${autoId}-list`
  const [code, setCode] = useState(defaultValue.toUpperCase())
  const [query, setQuery] = useState(countryName(defaultValue))
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const codeRef = useRef(code)
  codeRef.current = code

  const selectedName = countryName(code)
  const options = useMemo<Country[]>(() => (query.trim() && query !== selectedName ? searchCountries(query) : []), [query, selectedName])

  function choose(country: Country) {
    setCode(country.code)
    setQuery(country.name)
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
      setQuery(selectedName)
    }
  }

  const showingSelection = !!code && query === selectedName

  return (
    <div className="relative">
      <input type="hidden" name={name} value={code} />
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
          <CountryFlag code={showingSelection ? code : null} width={21} />
        </span>
        <input
          id={inputId}
          role="combobox"
          aria-expanded={open && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={(event) => {
            event.target.select()
            setOpen(true)
          }}
          onBlur={() => {
            // Leaving without choosing restores the selected country, so half-typed text is never saved
            setTimeout(() => {
              setOpen(false)
              setQuery(countryName(codeRef.current))
            }, 120)
          }}
          onKeyDown={onKeyDown}
          className={cn(field, 'pl-10', code && 'pr-8')}
        />
        {code && (
          <button
            type="button"
            aria-label="Clear nationality"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setCode('')
              setQuery('')
            }}
            className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-subtlest hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {open && options.length > 0 && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 w-full origin-top rounded-lg border border-border bg-popover p-1 shadow-[0_8px_12px_rgba(9,30,66,0.15),0_0_1px_rgba(9,30,66,0.31)] panel-enter"
        >
          {options.map((country, index) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/useFocusableInteractive: keyboard selection is handled on the input via aria-activedescendant
            <div
              key={country.code}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={country.code === code}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(country)}
              onMouseEnter={() => setActive(index)}
              className={cn('flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm', index === active && 'bg-secondary')}
            >
              <CountryFlag code={country.code} width={24} />
              <span className="min-w-0 flex-1 truncate text-foreground">{country.name}</span>
              <span className="font-mono text-[11px] text-subtlest">{country.code}</span>
              {country.code === code && <Check className="size-4 text-primary" />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
