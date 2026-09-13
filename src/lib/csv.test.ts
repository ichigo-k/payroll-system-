import { describe, expect, it } from 'vitest'
import { parseCsvLine, parseEmployeeCsv } from './csv'

describe('parseCsvLine', () => {
  it('keeps commas inside quoted fields and unescapes doubled quotes', () => {
    expect(parseCsvLine('Ama,"Mensah, Jr.","He said ""hi"""')).toEqual(['Ama', 'Mensah, Jr.', 'He said "hi"'])
  })
})

describe('parseEmployeeCsv', () => {
  const header = 'first_name,last_name,email,employee_id,start_date,department'

  it('reports missing required columns', () => {
    expect(parseEmployeeCsv('first_name,last_name\nAma,Mensah').error).toMatch(/email, start_date/)
  })

  it('validates rows and flags duplicates within the file', () => {
    const { rows } = parseEmployeeCsv(
      [header, 'Ama,Mensah,AMA@example.com,EMP-1,2026-01-15,Finance', 'Kofi,Asante,ama@example.com,EMP-2,15/01/2026,', ',Owusu,not-an-email,EMP-1,2026-02-01,'].join('\n'),
    )
    expect(rows[0]).toMatchObject({ line: 2, email: 'ama@example.com', department: 'Finance', errors: [] })
    expect(rows[1].errors).toEqual(expect.arrayContaining(['Start date must be YYYY-MM-DD', 'Email appears earlier in this file']))
    expect(rows[2].errors).toEqual(expect.arrayContaining(['First name is missing', 'Email is missing or invalid', 'Employee ID appears earlier in this file']))
  })

  it('ignores a UTF-8 byte order mark from Excel exports', () => {
    const { rows, error } = parseEmployeeCsv(`﻿${header}\nAma,Mensah,ama@example.com,EMP-1,2026-01-15,`)
    expect(error).toBeUndefined()
    expect(rows).toHaveLength(1)
  })

  it('allows a blank employee ID so one can be generated', () => {
    const { rows } = parseEmployeeCsv(`${header}\nAma,Mensah,ama@example.com,,2026-01-15,`)
    expect(rows[0].errors).toEqual([])
    expect(rows[0].employeeId).toBe('')
  })
})
