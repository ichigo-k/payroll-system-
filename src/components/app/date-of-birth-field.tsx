'use client'

import { useState } from 'react'
import { ageOn, RETIREMENT_AGE, retirementDate } from '@/lib/people'
import { cn } from '@/lib/utils'
import { field } from './styles'

/** Date input that shows the person's age as you type, and a note when they're close to retirement age. */
export function DateOfBirthField({ id, name, defaultValue = '', invalid }: { id: string; name: string; defaultValue?: string; invalid?: boolean }) {
  const [value, setValue] = useState(defaultValue)
  const dob = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null
  const valid = dob && !Number.isNaN(dob.getTime()) && dob <= new Date()
  const age = valid ? ageOn(dob) : null
  const retiresIn = valid ? retirementDate(dob).getUTCFullYear() - new Date().getUTCFullYear() : null

  return (
    <div className="grid gap-1">
      <div className="relative">
        <input
          id={id}
          name={name}
          type="date"
          value={value}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={invalid}
          aria-describedby={`${id}-age`}
          className={cn(field, age !== null && 'pr-24', invalid && 'border-danger')}
        />
        {age !== null && (
          <span id={`${id}-age`} className="num pointer-events-none absolute inset-y-0 right-9 flex items-center text-xs font-medium text-muted-foreground">
            {age} years
          </span>
        )}
      </div>
      {retiresIn !== null && age !== null && age >= RETIREMENT_AGE - 1 && (
        <p className="text-xs text-warning">
          {age >= RETIREMENT_AGE ? `Already past the SSNIT retirement age of ${RETIREMENT_AGE}.` : `Reaches the SSNIT retirement age of ${RETIREMENT_AGE} soon.`}
        </p>
      )}
    </div>
  )
}
