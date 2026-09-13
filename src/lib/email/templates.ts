/**
 * Atlassian-style transactional email layout. Table-based with inline styles so it renders
 * consistently in Gmail, Outlook and Apple Mail. Every dynamic string is HTML-escaped.
 */

export type EmailBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'code'; code: string }
  | { type: 'button'; label: string; url: string }
  | { type: 'panel'; title: string; items: string[] }
  | { type: 'details'; rows: [label: string, value: string][] }
  | { type: 'note'; text: string }

export type EmailContent = {
  preheader: string
  heading: string
  blocks: EmailBlock[]
  recipient: string
  /** Why the recipient is getting this email, shown in the footer */
  reason: string
  companyName: string
  /** `cid:...` when sending, a data URI when previewing in a browser */
  logoSrc: string
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
const C = {
  canvas: '#F7F8F9',
  surface: '#FFFFFF',
  border: '#DFE1E6',
  text: '#172B4D',
  subtle: '#44546F',
  subtlest: '#626F86',
  brand: '#0C66E4',
  panel: '#F7F8F9',
}

export function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function blockHtml(block: EmailBlock): string {
  switch (block.type) {
    case 'paragraph':
      return `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${C.text};">${escapeHtml(block.text)}</p>`
    case 'note':
      return `<p style="margin:0 0 16px;font-size:13px;line-height:20px;color:${C.subtle};">${escapeHtml(block.text)}</p>`
    case 'code':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
  <tr><td align="center" style="background:${C.panel};border:1px solid ${C.border};border-radius:6px;padding:20px 16px;">
    <span style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:34px;line-height:40px;font-weight:700;letter-spacing:10px;color:${C.text};">${escapeHtml(block.code)}</span>
  </td></tr>
</table>`
    case 'button':
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
  <tr><td style="border-radius:4px;background:${C.brand};">
    <a href="${escapeHtml(block.url)}" target="_blank" style="display:inline-block;padding:10px 20px;font-family:${FONT};font-size:14px;line-height:20px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:4px;">${escapeHtml(block.label)}</a>
  </td></tr>
</table>
<p style="margin:-12px 0 24px;font-size:12px;line-height:18px;color:${C.subtlest};">Button not working? Copy this link into your browser:<br><a href="${escapeHtml(block.url)}" style="color:${C.brand};word-break:break-all;">${escapeHtml(block.url)}</a></p>`
    case 'panel':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 24px;">
  <tr><td style="background:${C.panel};border-radius:6px;padding:16px 20px;">
    <p style="margin:0 0 8px;font-size:12px;line-height:16px;font-weight:600;color:${C.subtle};">${escapeHtml(block.title)}</p>
    ${block.items
      .map(
        (item) =>
          `<p style="margin:6px 0 0;font-size:14px;line-height:20px;color:${C.text};"><span style="color:${C.brand};font-weight:700;">&#10003;</span>&nbsp;&nbsp;${escapeHtml(item)}</p>`,
      )
      .join('')}
  </td></tr>
</table>`
    case 'details':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 24px;border-top:1px solid ${C.border};">
  ${block.rows
    .map(
      ([label, value]) => `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${C.border};font-size:13px;line-height:20px;color:${C.subtle};width:40%;">${escapeHtml(label)}</td>
    <td style="padding:10px 0;border-bottom:1px solid ${C.border};font-size:14px;line-height:20px;font-weight:600;color:${C.text};">${escapeHtml(value)}</td>
  </tr>`,
    )
    .join('')}
</table>`
  }
}

function blockText(block: EmailBlock): string {
  switch (block.type) {
    case 'paragraph':
    case 'note':
      return block.text
    case 'code':
      return `    ${block.code}`
    case 'button':
      return `${block.label}: ${block.url}`
    case 'panel':
      return [block.title, ...block.items.map((item) => `  - ${item}`)].join('\n')
    case 'details':
      return block.rows.map(([label, value]) => `${label}: ${value}`).join('\n')
  }
}

export function renderEmail(content: EmailContent): { html: string; text: string } {
  const year = new Date().getFullYear()
  const company = escapeHtml(content.companyName)

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(content.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.canvas};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(content.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.canvas};font-family:${FONT};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

      <!-- Header -->
      <tr><td style="padding:0 4px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;"><img src="${escapeHtml(content.logoSrc)}" width="32" height="32" alt="PayCompass" style="display:block;border:0;border-radius:8px;"></td>
          <td style="vertical-align:middle;padding-left:10px;font-size:18px;line-height:24px;font-weight:600;letter-spacing:-0.2px;color:${C.text};">PayCompass</td>
        </tr></table>
      </td></tr>

      <!-- Card -->
      <tr><td style="background:${C.surface};border:1px solid ${C.border};border-radius:8px;padding:36px 36px 20px;">
        <h1 style="margin:0 0 16px;font-size:24px;line-height:32px;font-weight:600;letter-spacing:-0.3px;color:${C.text};">${escapeHtml(content.heading)}</h1>
        ${content.blocks.map(blockHtml).join('\n        ')}
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:24px 4px 0;font-size:12px;line-height:18px;color:${C.subtlest};">
        <p style="margin:0 0 8px;">This message was sent to <a href="mailto:${escapeHtml(content.recipient)}" style="color:${C.subtle};">${escapeHtml(content.recipient)}</a> by ${company}. ${escapeHtml(content.reason)}</p>
        <p style="margin:0 0 8px;">PayCompass will never ask for your sign-in code by phone, chat or email reply.</p>
        <p style="margin:16px 0 0;padding-top:16px;border-top:1px solid ${C.border};">&copy; ${year} PayCompass. Payroll for teams in Ghana.</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`

  const text = [
    'PayCompass',
    '',
    content.heading,
    '',
    ...content.blocks.map((block) => `${blockText(block)}\n`),
    '---',
    `This message was sent to ${content.recipient} by ${content.companyName}. ${content.reason}`,
    'PayCompass will never ask for your sign-in code by phone, chat or email reply.',
    `© ${year} PayCompass`,
  ].join('\n')

  return { html, text }
}
