// src/proxy.ts

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth-config'

const FINANCIAL_ROLES = ['ADMIN', 'PREPARER', 'APPROVER', 'AUDITOR']
const EMPLOYEE_ROLE = 'EMPLOYEE'

export async function proxy(request: NextRequest) {
  const session = await auth()
  const { pathname } = request.nextUrl

  const isFinancialPath = pathname.startsWith('/portal/financial')
  const isSelfServicePath = pathname.startsWith('/portal/self-service')
  const isLoginPath = pathname === '/login' || pathname.startsWith('/login/')
  const isRootPath = pathname === '/'

  // Redirect root to the appropriate destination
  if (isRootPath) {
    if (session?.user) {
      const dest = FINANCIAL_ROLES.includes(session.user.role) ? '/portal/financial' : '/portal/self-service'
      return NextResponse.redirect(new URL(dest, request.url))
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users away from login
  if (isLoginPath && session?.user) {
    const dest = FINANCIAL_ROLES.includes(session.user.role) ? '/portal/financial' : '/portal/self-service'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  if (isFinancialPath || isSelfServicePath) {
    if (!session?.user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const role = session.user.role

    if (isFinancialPath && role === EMPLOYEE_ROLE) {
      return NextResponse.redirect(new URL('/portal/self-service', request.url))
    }
    // Finance staff who are also on payroll keep access to their own payslips
    if (isSelfServicePath && FINANCIAL_ROLES.includes(role) && !session.user.employeeId) {
      return NextResponse.redirect(new URL('/portal/financial', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled by NextAuth)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (public files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
