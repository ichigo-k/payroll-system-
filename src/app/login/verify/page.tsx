import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { VerifyOtpForm } from './verify-form'

export default async function VerifyPage() {
  const cookieStore = await cookies()
  const email = cookieStore.get('otp-pending-email')?.value

  if (!email) {
    redirect('/login')
  }

  return <VerifyOtpForm email={email} />
}
