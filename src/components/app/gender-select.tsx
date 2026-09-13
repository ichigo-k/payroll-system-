'use client'

import { GENDERS } from '@/lib/people'
import { Select } from './select'

const options = GENDERS.map((g) => ({ value: g.value as string, label: g.label as string }))

/** Gender picker: Male, Female or Other. Submits MALE, FEMALE or OTHER. */
export function GenderSelect({ name, id, defaultValue }: { name: string; id?: string; defaultValue?: string }) {
  return <Select name={name} id={id} options={options} defaultValue={defaultValue} placeholder="Select gender" />
}
