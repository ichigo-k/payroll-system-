'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { field } from './styles'

/**
 * Free-text input with type-ahead suggestions, for names people usually pick from a known set
 * (like "Fuel" or "Staff loan") but can also type their own.
 */
export function SuggestInput({
  value,
  onChange,
  suggestions,
  id,
  placeholder,
  maxLength,
  limit = 6,
}: {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  id?: string
  placeholder?: string
  maxLength?: number
  limit?: number
}) {
  const autoId = useId()
  const listId = `${autoId}-list`
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const typed = useRef(false)

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q || !typed.current) return []
    return suggestions
      .filter(
        (s) =>
          s.toLowerCase() !== q &&
          s
            .toLowerCase()
            .split(/\s+/)
            .some((word) => word.startsWith(q)),
      )
      .slice(0, limit)
  }, [value, suggestions, limit])

  const pick = (suggestion: string) => {
    typed.current = false
    onChange(suggestion)
    setOpen(false)
    setActive(-1)
  }

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => {
          typed.current = true
          onChange(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            setActive((i) => Math.min(i + 1, matches.length - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          } else if (event.key === 'Enter' && open && active >= 0 && matches[active]) {
            event.preventDefault()
            pick(matches[active])
          } else if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
        className={field}
      />
      {open && matches.length > 0 && (
        <div
          id={listId}
          role="listbox"
          className="panel-enter absolute z-30 mt-1 w-full rounded-lg border border-border bg-popover p-1 shadow-[0_8px_12px_rgba(9,30,66,0.15),0_0_1px_rgba(9,30,66,0.31)]"
        >
          {matches.map((suggestion, index) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/useFocusableInteractive: keyboard selection is handled on the input via aria-activedescendant
            <div
              key={suggestion}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(suggestion)}
              onMouseEnter={() => setActive(index)}
              className={cn('cursor-pointer rounded-md px-2 py-1.5 text-sm text-foreground', index === active && 'bg-secondary')}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
