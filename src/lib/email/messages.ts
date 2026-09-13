import { prisma } from '@/lib/prisma'
import { ROLE_INFO, type RoleName } from '@/lib/roles'
import { LOGO_PNG_BASE64 } from './logo'
import { type EmailBlock, type EmailContent, renderEmail } from './templates'
import type { EmailTransport } from './transport'

const LOGO_CID = 'paycompass-logo'
const DEFAULT_COMPANY = 'PayCompass'

export async function getCompanyName(): Promise<string> {
  try {
    const config = await prisma.systemConfig.findFirst({ where: { isActive: true }, select: { companyName: true } })
    return config?.companyName ?? DEFAULT_COMPANY
  } catch {
    return DEFAULT_COMPANY
  }
}

export function appUrl(path = '') {
  const base = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  return `${base}${path}`
}

type Draft = { subject: string; content: Omit<EmailContent, 'logoSrc' | 'companyName'> }

// ---------------------------------------------------------------------------
// Message builders. Pure apart from company name, so the dev preview can reuse them.
// ---------------------------------------------------------------------------

export function otpDraft({ to, otp, expiresInMinutes, companyName }: { to: string; otp: string; expiresInMinutes: number; companyName: string }): Draft {
  return {
    subject: `${otp} is your PayCompass sign-in code`,
    content: {
      preheader: `Your code expires in ${expiresInMinutes} minutes.`,
      heading: 'Your sign-in code',
      recipient: to,
      reason: 'You received this because someone tried to sign in with this address.',
      blocks: [
        { type: 'paragraph', text: `Enter this code to finish signing in to ${companyName} on PayCompass.` },
        { type: 'code', code: otp },
        { type: 'note', text: `The code expires in ${expiresInMinutes} minutes and works once.` },
        { type: 'note', text: 'Didn’t try to sign in? You can ignore this email. Your account stays safe without the code.' },
      ],
    },
  }
}

export function inviteDraft({
  to,
  firstName,
  role,
  invitedBy,
  companyName,
}: {
  to: string
  firstName: string | null
  role: RoleName
  invitedBy: string
  companyName: string
}): Draft {
  const info = ROLE_INFO[role]
  const hello = firstName ? `Hi ${firstName},` : 'Hi,'
  const isEmployee = role === 'EMPLOYEE'
  const blocks: EmailBlock[] = [
    { type: 'paragraph', text: hello },
    {
      type: 'paragraph',
      text: isEmployee
        ? `${companyName} uses PayCompass for payroll. You can view your payslips, payment history and tax certificates online whenever you like.`
        : `${invitedBy} invited you to ${companyName}’s payroll workspace on PayCompass as a ${info.label.toLowerCase()}.`,
    },
    { type: 'panel', title: 'What you can do', items: info.access },
    { type: 'button', label: 'Sign in to PayCompass', url: appUrl('/login') },
    {
      type: 'note',
      text: isEmployee
        ? `You don’t need to create an account. Enter ${to} on the sign-in page and we’ll email you a one-time code.`
        : `There’s no password to set up. Enter ${to} on the sign-in page and we’ll email you a one-time code.`,
    },
  ]
  return {
    subject: isEmployee ? `View your ${companyName} payslips online` : `You’ve been invited to ${companyName} on PayCompass`,
    content: {
      preheader: isEmployee ? 'View payslips, payment history and tax certificates online.' : `Join as ${info.label.toLowerCase()}.`,
      heading: isEmployee ? 'Your payslips are ready to view online' : `Join ${companyName} on PayCompass`,
      recipient: to,
      reason: isEmployee ? `You received this because you’re on ${companyName}’s payroll.` : `You received this because an administrator at ${companyName} gave you access.`,
      blocks,
    },
  }
}

export function roleChangedDraft({
  to,
  firstName,
  from,
  toRole,
  changedBy,
  companyName,
}: {
  to: string
  firstName: string | null
  from: RoleName
  toRole: RoleName
  changedBy: string
  companyName: string
}): Draft {
  return {
    subject: 'Your PayCompass access has changed',
    content: {
      preheader: `You are now ${ROLE_INFO[toRole].label.toLowerCase()}.`,
      heading: 'Your role has changed',
      recipient: to,
      reason: `You received this because your access at ${companyName} was updated.`,
      blocks: [
        { type: 'paragraph', text: `${firstName ? `Hi ${firstName}, ` : ''}${changedBy} updated your role in ${companyName}’s PayCompass workspace.` },
        {
          type: 'details',
          rows: [
            ['Previous role', ROLE_INFO[from].label],
            ['New role', ROLE_INFO[toRole].label],
            ['Changed by', changedBy],
          ],
        },
        { type: 'panel', title: 'You can now', items: ROLE_INFO[toRole].access },
        { type: 'button', label: 'Open PayCompass', url: appUrl('/login') },
        { type: 'note', text: 'Weren’t expecting this? Contact your administrator.' },
      ],
    },
  }
}

export function accessStatusDraft({
  to,
  firstName,
  active,
  changedBy,
  companyName,
}: {
  to: string
  firstName: string | null
  active: boolean
  changedBy: string
  companyName: string
}): Draft {
  const hello = firstName ? `Hi ${firstName}, ` : ''
  return active
    ? {
        subject: 'Your PayCompass access is back on',
        content: {
          preheader: 'You can sign in again.',
          heading: 'Your access has been restored',
          recipient: to,
          reason: `You received this because your access at ${companyName} was updated.`,
          blocks: [
            { type: 'paragraph', text: `${hello}${changedBy} turned your PayCompass access for ${companyName} back on.` },
            { type: 'button', label: 'Sign in to PayCompass', url: appUrl('/login') },
          ],
        },
      }
    : {
        subject: 'Your PayCompass access has been turned off',
        content: {
          preheader: `You can no longer sign in to ${companyName} on PayCompass.`,
          heading: 'Your access has been turned off',
          recipient: to,
          reason: `You received this because your access at ${companyName} was updated.`,
          blocks: [
            { type: 'paragraph', text: `${hello}${changedBy} turned off your PayCompass access for ${companyName}. You won’t be able to sign in until it is restored.` },
            { type: 'note', text: 'If you think this is a mistake, contact your administrator or HR team.' },
          ],
        },
      }
}

/** General workflow notification (payroll submitted, changes requested, payslips ready...). Never includes pay amounts. */
export function notificationDraft({
  to,
  firstName,
  subject,
  heading,
  body,
  href,
  actionLabel = 'Open in PayCompass',
  details,
  companyName,
}: {
  to: string
  firstName: string | null
  subject: string
  heading: string
  body: string
  href?: string | null
  actionLabel?: string
  details?: [string, string][]
  companyName: string
}): Draft {
  const blocks: EmailBlock[] = [
    { type: 'paragraph', text: firstName ? `Hi ${firstName},` : 'Hi,' },
    { type: 'paragraph', text: body },
  ]
  if (details?.length) blocks.push({ type: 'details', rows: details })
  if (href) blocks.push({ type: 'button', label: actionLabel, url: appUrl(href) })
  blocks.push({ type: 'note', text: 'You can turn off email notifications from the notifications page in PayCompass.' })
  return {
    subject,
    content: {
      preheader: body.slice(0, 120),
      heading,
      recipient: to,
      reason: `You received this because of your role in ${companyName}’s PayCompass workspace.`,
      blocks,
    },
  }
}

// ---------------------------------------------------------------------------
// Rendering and sending
// ---------------------------------------------------------------------------

/** Renders a draft. `preview` inlines the logo as a data URI so it shows in a browser. */
export function render(draft: Draft, companyName: string, { preview = false } = {}) {
  const logoSrc = preview ? `data:image/png;base64,${LOGO_PNG_BASE64}` : `cid:${LOGO_CID}`
  return renderEmail({ ...draft.content, companyName, logoSrc })
}

export async function deliver(transport: EmailTransport, draft: Draft, companyName: string) {
  const { html, text } = render(draft, companyName)
  await transport.send({
    to: draft.content.recipient,
    subject: draft.subject,
    html,
    text,
    attachments: [{ filename: 'paycompass.png', content: Buffer.from(LOGO_PNG_BASE64, 'base64'), contentType: 'image/png', cid: LOGO_CID }],
  })
}
