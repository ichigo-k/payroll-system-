# Payroll System

A payroll platform for Ghanaian organisations. It covers employees, salaries, PAYE and SSNIT, payroll runs, and payslips. Every run goes through a maker-checker approval before anyone is paid.

Built with Next.js, TypeScript, PostgreSQL and Prisma.

## Features

**Payroll engine for Ghana**
- Monthly calculation of gross pay, employee and employer SSNIT, Tier 2 pension, PAYE on chargeable income, reliefs and net pay.
- PAYE bands, SSNIT rates and reliefs come from configuration rather than code. They can be set year-wide or per month, and changes need approval before they apply.
- Recurring allowances and deductions per employee, plus per-run exclusions for people who shouldn't be paid that month.

**Maker-checker workflow**
- Five roles: **Admin**, **Preparer**, **Approver**, **Auditor** and **Employee**.
- Preparers draft runs and tax changes, and approvers sign them off. Runs move through `DRAFT → SUBMITTED → APPROVED / REJECTED → PAID`, and reviewers can leave comments.
- Every sensitive action goes into an audit log, which you can filter and export.

**Documents and exports**
- Payroll summary and approval sheet, itemised payslips, a bank payment schedule with an instruction letter, PAYE and SSNIT returns, and a payroll register.
- PDF via `@react-pdf/renderer`, Excel via `exceljs`, and CSV.

**Employee self-service**
- Employees see their payslips, payment history, tax summary and annual tax certificate, and download each as a PDF.

**Operations**
- Passwordless sign-in with one-time codes sent by email (NextAuth + Nodemailer/Gmail).
- Bulk employee import from a spreadsheet template.
- In-app notifications streamed to the browser.
- CI on every push: lint (Biome), typecheck, Vitest tests and a production build against Postgres.

## Tech stack

| Layer | Tools |
| --- | --- |
| App | Next.js (App Router, server actions), React, TypeScript |
| UI | Tailwind CSS, shadcn/ui, Base UI, React Hook Form, Zod |
| Data | PostgreSQL, Prisma |
| Auth | NextAuth with email OTP |
| Documents | @react-pdf/renderer, ExcelJS |
| Quality | Biome, Vitest, GitHub Actions |

## Getting started

You need Node.js 20+, pnpm and a PostgreSQL database.

```bash
pnpm install
```

Create a `.env` file:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/payroll
AUTH_SECRET=generate-a-long-random-string
NEXTAUTH_URL=http://localhost:3000
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=your-gmail-app-password
```

Set up the database, load sample data, and start the app:

```bash
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open http://localhost:3000. The seed creates one test account per role (`admin@payroll.com`, `preparer@payroll.com`, `approver@payroll.com`, `auditor@payroll.com`). Sign-in is passwordless, so the one-time code is sent to the configured mailbox. In development you can also preview emails at `/api/dev/email-preview`.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm test` | Run the Vitest suite |
| `pnpm lint` / `pnpm lint:fix` | Check or fix with Biome |
| `pnpm db:migrate` | Apply Prisma migrations |
| `pnpm db:seed` | Load sample users, employees and tax configuration |
| `pnpm db:studio` | Open Prisma Studio |

## Project layout

```
prisma/                      schema, migrations, seed
src/app/login                OTP sign-in
src/app/portal/financial     staff portal: employees, payroll runs, tax, approvals, exports, audit, users
src/app/portal/self-service  employee portal: payslips, history, tax certificate
src/lib/payroll-engine.ts    the pay calculation (covered by tests)
src/lib/payroll-exports.ts   document and file exports
src/lib/pdf                  PDF templates
src/lib/email                email transport and templates
```

## Note on tax rates

The engine applies whatever rates and bands are in the active tax configuration. Check them against current GRA and SSNIT guidance before running a real payroll.
