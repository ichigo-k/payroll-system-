'use client'

import { ROLE_INFO, ROLES, type RoleName } from '@/lib/roles'
import { cn } from '@/lib/utils'

export function RolePicker({
  name,
  value,
  onChange,
  disabledRoles = [],
  hint,
  roles = ROLES,
}: {
  roles?: readonly RoleName[]
  name: string
  value: RoleName | ''
  onChange: (role: RoleName) => void
  disabledRoles?: RoleName[]
  hint?: (role: RoleName) => string | undefined
}) {
  return (
    <div role="radiogroup" className="grid gap-2">
      {roles.map((role) => {
        const checked = value === role
        const disabled = disabledRoles.includes(role)
        const note = hint?.(role)
        return (
          <label
            key={role}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-150',
              checked ? 'border-primary bg-accent' : 'border-border hover:bg-muted',
              disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
            )}
          >
            <input
              type="radio"
              name={name}
              value={role}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(role)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{ROLE_INFO[role].label}</span>
              <span className="block text-xs text-muted-foreground">{note ?? ROLE_INFO[role].summary}</span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
