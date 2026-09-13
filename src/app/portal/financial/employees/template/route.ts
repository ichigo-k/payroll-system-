import { NextResponse } from 'next/server'

export function GET() {
  const csv = 'first_name,last_name,email,employee_id,department,start_date\nAma,Mensah,ama.mensah@example.com,EMP-001,Finance,2026-01-15\n'
  return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="employee-import-template.csv"' } })
}
