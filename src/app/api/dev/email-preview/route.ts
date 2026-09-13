import { type NextRequest, NextResponse } from 'next/server'
import { accessStatusDraft, getCompanyName, inviteDraft, otpDraft, render, roleChangedDraft } from '@/lib/email/messages'

/**
 * Development-only email previews: /api/dev/email-preview?template=otp
 * Templates: otp, invite, invite-employee, role, deactivated, reactivated
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse('Not found', { status: 404 })
  }

  const companyName = await getCompanyName()
  const to = 'ama.mensah@example.com'
  const template = request.nextUrl.searchParams.get('template') ?? 'index'

  const drafts = {
    otp: () => otpDraft({ to, otp: '482915', expiresInMinutes: 10, companyName }),
    invite: () => inviteDraft({ to, firstName: 'Ama', role: 'PREPARER', invitedBy: 'Kwame Boateng', companyName }),
    'invite-employee': () => inviteDraft({ to, firstName: 'Ama', role: 'EMPLOYEE', invitedBy: 'Kwame Boateng', companyName }),
    role: () => roleChangedDraft({ to, firstName: 'Ama', from: 'EMPLOYEE', toRole: 'PREPARER', changedBy: 'Kwame Boateng', companyName }),
    deactivated: () => accessStatusDraft({ to, firstName: 'Ama', active: false, changedBy: 'Kwame Boateng', companyName }),
    reactivated: () => accessStatusDraft({ to, firstName: 'Ama', active: true, changedBy: 'Kwame Boateng', companyName }),
  } as const

  if (!(template in drafts)) {
    const links = Object.keys(drafts)
      .map((key) => `<li><a href="?template=${key}">${key}</a></li>`)
      .join('')
    return new NextResponse(`<!doctype html><title>Email previews</title><body style="font-family:system-ui;padding:32px"><h1>Email previews</h1><ul>${links}</ul></body>`, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const draft = drafts[template as keyof typeof drafts]()
  const { html } = render(draft, companyName, { preview: true })
  const banner = `<div style="font-family:system-ui;font-size:12px;padding:8px 16px;background:#172B4D;color:#fff">Subject: ${draft.subject.replace(/</g, '&lt;')}</div>`
  return new NextResponse(html.replace(/(<body[^>]*>)/, `$1${banner}`), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
