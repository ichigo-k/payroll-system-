import { currentUser } from '@/lib/access'
import { channelFor, type NotificationPayload, notificationBus, toPayload } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const HEARTBEAT_MS = 25_000
// Catches notifications created on other server instances, which the in-process bus can't see
const POLL_MS = 5_000

/**
 * Live notifications over Server-Sent Events. Events created on this server arrive instantly;
 * the poll covers multi-instance deployments. The browser reconnects automatically if dropped.
 */
export async function GET(request: Request) {
  const user = await currentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const encoder = new TextEncoder()
  const sent = new Set<string>()
  let since = new Date()

  const stream = new ReadableStream({
    start(controller) {
      let closed = false
      const write = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk))
      }
      const send = (payload: NotificationPayload) => {
        if (sent.has(payload.id)) return
        sent.add(payload.id)
        write(`event: notification\ndata: ${JSON.stringify(payload)}\n\n`)
      }

      write('retry: 5000\nevent: ready\ndata: {}\n\n')

      const channel = channelFor(user.id)
      notificationBus.on(channel, send)

      const poll = setInterval(async () => {
        try {
          const rows = await prisma.notification.findMany({ where: { userId: user.id, createdAt: { gt: since } }, orderBy: { createdAt: 'asc' }, take: 20 })
          for (const row of rows) send(toPayload(row))
          if (rows.length) since = rows[rows.length - 1].createdAt
        } catch (err) {
          console.error('[notifications/stream] poll failed:', err)
        }
      }, POLL_MS)

      const heartbeat = setInterval(() => write(': keep-alive\n\n'), HEARTBEAT_MS)

      const close = () => {
        if (closed) return
        closed = true
        notificationBus.off(channel, send)
        clearInterval(poll)
        clearInterval(heartbeat)
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
      request.signal.addEventListener('abort', close)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
