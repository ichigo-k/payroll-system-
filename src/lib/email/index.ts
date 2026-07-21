import { GmailTransport } from './gmail'
import type { EmailTransport } from './transport'

// Swap point: replace GmailTransport with ResendTransport here
export const emailTransport: EmailTransport = new GmailTransport()
