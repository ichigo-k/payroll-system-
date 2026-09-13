import nodemailer from 'nodemailer'
import type { EmailMessage, EmailTransport } from './transport'

export class GmailTransport implements EmailTransport {
  constructor(private readonly fromName: () => Promise<string>) {}

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

  async send(message: EmailMessage): Promise<void> {
    const transporter = this.transporter
    await transporter.sendMail({
      from: `"${await this.fromName()}" <${process.env.GMAIL_USER}>`,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments,
    })
  }
}
