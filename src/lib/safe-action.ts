/**
 * Calls a server action from the browser without letting a dropped connection or server crash
 * blow up the page. Failures come back as a normal `{ ok: false, message }` result.
 */

export const CONNECTION_MESSAGE = 'We couldn’t reach the server just now. Check your connection and try again.'

export async function safeAction<T extends { ok: boolean; message: string }>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (err) {
    console.error('[action] request failed:', err)
    return { ok: false, message: CONNECTION_MESSAGE } as T
  }
}
