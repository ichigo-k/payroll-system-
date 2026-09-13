import type { RoleName } from '@/lib/roles'
import { GmailTransport } from './gmail'
import { accessStatusDraft, deliver, getCompanyName, inviteDraft, notificationDraft, otpDraft, roleChangedDraft } from './messages'
import type { EmailTransport } from './transport'

// Swap point: replace GmailTransport with ResendTransport here
export const emailTransport: EmailTransport = new GmailTransport(getCompanyName)

export async function sendOtpEmail(args: { to: string; otp: string; expiresInMinutes: number }) {
  const companyName = await getCompanyName()
  await deliver(emailTransport, otpDraft({ ...args, companyName }), companyName)
}

export async function sendInviteEmail(args: { to: string; firstName: string | null; role: RoleName; invitedBy: string }) {
  const companyName = await getCompanyName()
  await deliver(emailTransport, inviteDraft({ ...args, companyName }), companyName)
}

export async function sendRoleChangedEmail(args: { to: string; firstName: string | null; from: RoleName; toRole: RoleName; changedBy: string }) {
  const companyName = await getCompanyName()
  await deliver(emailTransport, roleChangedDraft({ ...args, companyName }), companyName)
}

export async function sendAccessStatusEmail(args: { to: string; firstName: string | null; active: boolean; changedBy: string }) {
  const companyName = await getCompanyName()
  await deliver(emailTransport, accessStatusDraft({ ...args, companyName }), companyName)
}

export async function sendNotificationEmail(args: Omit<Parameters<typeof notificationDraft>[0], 'companyName'>) {
  const companyName = await getCompanyName()
  await deliver(emailTransport, notificationDraft({ ...args, companyName }), companyName)
}
