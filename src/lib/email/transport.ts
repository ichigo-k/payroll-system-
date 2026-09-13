export type EmailAttachment = {
  filename: string
  content: Buffer
  contentType: string
  /** Content-ID for inline images referenced as `cid:<cid>` in the HTML */
  cid?: string
}

export type EmailMessage = {
  to: string
  subject: string
  html: string
  text: string
  attachments?: EmailAttachment[]
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<void>
}
