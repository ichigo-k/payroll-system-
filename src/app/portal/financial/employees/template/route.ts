import { NextResponse } from 'next/server'

export function GET() {
  const csv = [
    'first_name,last_name,email,employee_id,start_date,department,designation,phone,ssnit_number',
    'Ama,Mensah,ama.mensah@example.com,EMP-001,2026-01-15,Finance,Accounts officer,+233 24 555 0142,C123456789012',
    'Kwabena,Owusu,kwabena.owusu@example.com,EMP-002,2026-02-02,Operations,,,',
  ].join('\n')
  return new NextResponse(`${csv}\n`, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="employee-import-template.csv"' },
  })
}
