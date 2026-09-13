import { describe, expect, it } from 'vitest'
import { escapeHtml, renderEmail } from './templates'

const base = {
  preheader: 'Preview text',
  heading: 'Your sign-in code',
  recipient: 'ama@example.com',
  reason: 'You received this because someone tried to sign in.',
  companyName: 'Ghana Payroll Corp',
  logoSrc: 'cid:paycompass-logo',
}

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml(`<b>"Kofi" & 'Ama'</b>`)).toBe('&lt;b&gt;&quot;Kofi&quot; &amp; &#39;Ama&#39;&lt;/b&gt;')
  })
})

describe('renderEmail', () => {
  it('includes logo, heading, footer and every block in HTML and text', () => {
    const { html, text } = renderEmail({
      ...base,
      blocks: [
        { type: 'paragraph', text: 'Enter this code.' },
        { type: 'code', code: '482915' },
        { type: 'button', label: 'Sign in', url: 'https://app.example.com/login' },
        { type: 'panel', title: 'What you can do', items: ['View payslips'] },
        { type: 'details', rows: [['New role', 'Payroll preparer']] },
      ],
    })

    expect(html).toContain('src="cid:paycompass-logo"')
    expect(html).toContain('Your sign-in code')
    expect(html).toContain('482915')
    expect(html).toContain('href="https://app.example.com/login"')
    expect(html).toContain('This message was sent to')
    expect(text).toContain('Sign in: https://app.example.com/login')
    expect(text).toContain('  - View payslips')
    expect(text).toContain('New role: Payroll preparer')
  })

  it('escapes user-supplied values so names can’t inject markup', () => {
    const { html } = renderEmail({ ...base, companyName: '<script>x</script>', blocks: [{ type: 'paragraph', text: 'Hi <img src=x>' }] })
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img src=x>')
    expect(html).toContain('Hi &lt;img src=x&gt;')
  })
})
