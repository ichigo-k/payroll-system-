'use client'

import { Select as BaseSelect } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { field } from './styles'

export type SelectOption = {
  value: string
  label: string
  /** Secondary line under the label, e.g. what a reason means */
  description?: string
  disabled?: boolean
  icon?: React.ReactNode
}

/**
 * The app's dropdown. Use it instead of a native <select> so every picker looks and behaves the same.
 * Works in plain forms (pass `name`) or controlled (pass `value` and `onValueChange`). For long lists
 * people search, use a type-ahead combobox instead.
 */
export function Select({
  options,
  name,
  id,
  value,
  defaultValue,
  onValueChange,
  placeholder = 'Select',
  disabled,
  invalid,
  className,
  'aria-label': ariaLabel,
}: {
  options: SelectOption[]
  name?: string
  id?: string
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
  'aria-label'?: string
}) {
  const items = options.map((o) => ({ value: o.value, label: o.label }))
  const controlled = value !== undefined
  const selected = options.find((o) => o.value === (controlled ? value : defaultValue))

  return (
    <BaseSelect.Root
      name={name}
      id={id}
      items={items}
      disabled={disabled}
      modal={false}
      {...(controlled ? { value: selected ? value : null } : { defaultValue: selected ? defaultValue : null })}
      onValueChange={(next) => onValueChange?.((next as string | null) ?? '')}
    >
      <BaseSelect.Trigger
        aria-label={ariaLabel}
        aria-invalid={invalid}
        className={cn(
          field,
          'group flex cursor-default items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60 data-popup-open:border-primary data-popup-open:shadow-[inset_0_0_0_1px_var(--primary)]',
          invalid && 'border-danger',
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.icon}
          <BaseSelect.Value className="truncate data-placeholder:text-subtlest" placeholder={placeholder} />
        </span>
        <BaseSelect.Icon className="text-subtlest transition-transform duration-150 group-data-popup-open:rotate-180">
          <ChevronDown className="size-4" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={4} alignItemWithTrigger={false} collisionPadding={8} className="z-50 outline-none">
          <BaseSelect.Popup className="min-w-(--anchor-width) origin-(--transform-origin) rounded-lg border border-border bg-popover p-1 shadow-[0_8px_12px_rgba(9,30,66,0.15),0_0_1px_rgba(9,30,66,0.31)] transition-[opacity,transform] duration-150 ease-out outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0">
            <BaseSelect.List className="max-h-[min(18rem,var(--available-height))] overflow-y-auto">
              {options.map((option) => (
                <BaseSelect.Item
                  key={option.value || '__empty'}
                  value={option.value}
                  disabled={option.disabled}
                  className="group/item flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground outline-none select-none data-disabled:text-subtlest data-highlighted:bg-secondary"
                >
                  {option.icon}
                  <span className="min-w-0 flex-1">
                    <BaseSelect.ItemText className="block truncate group-data-selected/item:font-medium group-data-selected/item:text-primary">{option.label}</BaseSelect.ItemText>
                    {option.description && <span className="block text-xs text-muted-foreground">{option.description}</span>}
                  </span>
                  <BaseSelect.ItemIndicator className="text-primary">
                    <Check className="size-4" />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  )
}
