import { NextResponse } from 'next/server'

export function GET() {
  const csv = [
    'first_name,last_name,email,start_date,department,designation,phone,employee_id',
    'Ama,Mensah,ama.mensah@example.com,2026-01-15,Finance,Accounts officer,+233 24 555 0142,',
    'Kwabena,Owusu,kwabena.owusu@example.com,2026-02-02,Operations,,,',
  ].join('\n')
  return new NextResponse(`${csv}\n`, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="employee-import-template.csv"' },
  })
}
