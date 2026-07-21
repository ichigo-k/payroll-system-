import nodemailer from 'nodemailer'
import type { EmailTransport } from './transport'
import { prisma } from '@/lib/prisma'

async function getCompanyName(): Promise<string> {
  try {
    const config = await prisma.systemConfig.findFirst({
      where: { isActive: true },
      select: { companyName: true },
    })
    return config?.companyName ?? 'PayCompass'
  } catch {
    return 'PayCompass'
  }
}

export class GmailTransport implements EmailTransport {
  // Lazy — created on first use so env vars are guaranteed to be loaded
  private get transporter() {
    const user = process.env.GMAIL_USER
    const pass = process.env.GMAIL_APP_PASSWORD

    if (!user || !pass) {
      throw new Error(
        `Gmail credentials missing. GMAIL_USER=${user ?? 'undefined'}, GMAIL_APP_PASSWORD=${pass ? '***' : 'undefined'}`
      )
    }

    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    })
  }

  async sendOtp(to: string, otp: string, expiresInMinutes: number): Promise<void> {
    const companyName = await getCompanyName()
    const transporter = this.transporter

    await transporter.sendMail({
      from: `"${companyName}" <${process.env.GMAIL_USER}>`,
      to,
      subject: `${otp} is your ${companyName} login code`,
      text: `Your login code is: ${otp}\n\nThis code expires in ${expiresInMinutes} minutes.\n\nIf you did not request this, you can ignore this email.`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <p style="font-size:13px;color:#6b7280;margin:0 0 24px">
            ${companyName}
          </p>
          <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px">
            Your login code
          </h1>
          <p style="font-size:14px;color:#6b7280;margin:0 0 24px">
            Use the code below to sign in. It expires in ${expiresInMinutes} minutes.
          </p>
          <div style="background:#f3f4f6;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px">
            <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#111827">
              ${otp}
            </span>
          </div>
          <p style="font-size:12px;color:#9ca3af;margin:0">
            If you did not request this code, you can safely ignore this email.
          </p>
        </div>
      `,
    })
  }
}
