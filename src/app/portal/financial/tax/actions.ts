'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'

export type TaxActionState = { status: 'idle' | 'success' | 'error'; message?: string }

function isBracketList(value: unknown): value is { min: number; max: number; rate: number }[] {
  return (
    Array.isArray(value) &&
    value.every(
      (b) =>
        b &&
        typeof b === 'object' &&
        [b.min, b.max, b.rate].every((n) => typeof n === 'number' && Number.isFinite(n)) &&
        b.min >= 0 &&
        b.max > b.min &&
        b.rate >= 0 &&
        b.rate <= 1,
    )
  )
}

export async function saveTaxConfiguration(_prev: TaxActionState, formData: FormData): Promise<TaxActionState> {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return { status: 'error', message: 'Only administrators can change tax configuration.' }
  }

  const year = Number(formData.get('year'))
  const month = Number(formData.get('month') ?? 0)
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 0 || month > 12) {
    return { status: 'error', message: 'Enter a valid year and month.' }
  }

  const payeBrackets = String(formData.get('payeBrackets') ?? '[]').trim() || '[]'
  let parsed: unknown
  try {
    parsed = JSON.parse(payeBrackets)
  } catch {
    return { status: 'error', message: 'PAYE brackets could not be read.' }
  }
  if (!isBracketList(parsed)) {
    return { status: 'error', message: 'Each PAYE bracket needs a lower bound, an upper bound above it, and a rate between 0% and 100%.' }
  }

  const values = {
    payeBrackets,
    payeThreshold: String(formData.get('payeThreshold') || 0),
    ssnitEmployeeRate: String(formData.get('ssnitEmployeeRate') || 5.5),
    ssnitEmployerRate: String(formData.get('ssnitEmployerRate') || 13),
    personalRelief: String(formData.get('personalRelief') || 0),
    spouseExemption: String(formData.get('spouseExemption') || 0),
    childExemption: String(formData.get('childExemption') || 0),
    isActive: formData.get('isActive') === 'on',
    updatedBy: session.user.id,
  }

  await prisma.taxConfiguration.upsert({
    where: { year_month: { year, month } },
    create: { year, month, ...values },
    update: values,
  })

  revalidatePath('/portal/financial/tax')
  revalidatePath('/portal/financial')
  return { status: 'success', message: `Saved tax configuration for ${month === 0 ? `all of ${year}` : `${month}/${year}`}.` }
}
