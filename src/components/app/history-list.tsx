import { ACTION_LABELS, type AuditRow, actorName, fieldChanges, parseChanges } from '@/lib/audit-format'

const dateTime = (d: Date) => d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function summary(row: AuditRow) {
  const c = parseChanges(row.changes)
  if (c.allowance && typeof c.allowance === 'object') {
    const a = c.allowance as Record<string, string>
    return c.ended ? `ended the ${a.type?.toLowerCase()} allowance (${a.amount})` : `added a ${a.frequency} ${a.type?.toLowerCase()} allowance of ${a.amount}`
  }
  if (c.deduction && typeof c.deduction === 'object') {
    const d = c.deduction as Record<string, string>
    return c.ended ? `ended the ${d.type?.toLowerCase()} deduction (${d.amount})` : `added a ${d.type?.toLowerCase()} deduction of ${d.amount}`
  }
  if (c.source === 'CSV import') return 'imported this employee from a spreadsheet'
  if (c.selfServiceWelcomeSent) return 'emailed self-service sign-in instructions'
  if (c.inviteResent) return 'resent the invite'
  if (typeof c.reason === 'string') return `${(ACTION_LABELS[row.action] ?? row.action).toLowerCase()} (${c.reason})`
  if (row.action === 'CREATE') return 'created this record'
  if (row.action === 'LOGIN') return 'signed in'
  if (row.action === 'LOGOUT') return 'signed out'
  return (ACTION_LABELS[row.action] ?? row.action).toLowerCase()
}

/** Readable, field-level history for any record. */
export function HistoryList({ rows, empty = 'No history yet.' }: { rows: AuditRow[]; empty?: string }) {
  if (rows.length === 0) return <p className="py-6 text-sm text-muted-foreground">{empty}</p>
  return (
    <ol className="divide-y divide-border">
      {rows.map((row) => {
        const fields = fieldChanges(parseChanges(row.changes))
        return (
          <li key={row.id} className="py-3">
            <p className="text-sm">
              <span className="font-semibold">{actorName(row.user)}</span> <span>{summary(row)}</span>
              <span className="ml-2 text-xs text-subtlest">{dateTime(row.timestamp)}</span>
            </p>
            {fields.length > 0 && (
              <ul className="mt-2 grid gap-1 rounded-lg bg-muted px-3 py-2 text-sm">
                {fields.map((f) => (
                  <li key={f.field} className="flex flex-wrap gap-x-2">
                    <span className="text-muted-foreground">{f.field}:</span>
                    <span className="text-muted-foreground line-through">{f.from}</span>
                    <span aria-hidden>→</span>
                    <span className="font-medium">{f.to}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ol>
  )
}
