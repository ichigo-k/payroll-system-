export interface EmailTransport {
  sendOtp(to: string, otp: string, expiresInMinutes: number): Promise<void>
}
