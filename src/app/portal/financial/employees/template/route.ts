import { NextResponse } from 'next/server'

export function GET() {
  const csv = [
    'first_name,last_name,email,start_date,date_of_birth,gender,nationality,address,department,designation,phone,employee_id',
    'Ama,Mensah,ama.mensah@example.com,2026-01-15,1994-03-08,Female,Ghana,"12 Oxford St, Osu, Accra",Finance,Accounts officer,+233 24 555 0142,',
    'Kwabena,Owusu,kwabena.owusu@example.com,2026-02-02,1988-11-21,Male,Ghana,,Operations,,,',
  ].join('\n')
  return new NextResponse(`${csv}\n`, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="employee-import-template.csv"' },
  })
}
