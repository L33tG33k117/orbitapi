import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmail, emailConfigured } from '@/lib/email'
import { logErrorEvent } from '@/lib/error-log'

// Public contact endpoint.
//
// This replaces a form that faked success: it waited 800ms client-side and
// showed "Message sent!" without sending anything. Sales enquiries — including
// "Talk to sales" from the Enterprise plan — were being thrown away while the
// sender was told they'd get a reply within 24 hours.
//
// Order matters here: PERSIST FIRST, notify second. Email is best-effort (the
// key may be unset, Resend may be down, the domain may be unverified), so the
// database row is the record of truth. A lead must never be lost because a
// notification failed.

const SUBJECTS = new Set(['general', 'enterprise', 'selfhost', 'support', 'partnership'])

const LABELS: Record<string, string> = {
  general: 'General enquiry',
  enterprise: 'Enterprise enquiry',
  selfhost: 'Self-hosted enquiry',
  support: 'Support request',
  partnership: 'Partnership enquiry',
}

function clean(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const name = clean(b.name, 200)
  const email = clean(b.email, 320)
  const message = clean(b.message, 10_000)
  const subject = SUBJECTS.has(clean(b.subject, 40)) ? clean(b.subject, 40) : 'general'

  if (!name || !email || !message) {
    return Response.json({ error: 'Name, email and message are all required.' }, { status: 400 })
  }
  // Deliberately loose: rejecting unusual-but-valid addresses loses real leads,
  // which is worse than accepting the occasional junk row.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: 'That email address doesn\'t look right.' }, { status: 400 })
  }

  // The endpoint is unauthenticated, so it needs its own throttle. Generous
  // enough that a person retrying a failed send is never blocked.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!(await rateLimit(`contact:${ip}`, 5, 3600))) {
    return Response.json(
      { error: 'Too many messages from this address. Please try again later, or email us directly.' },
      { status: 429 },
    )
  }

  // Attribute to a signed-in user when there is one; the form is public, so
  // most submissions won't have one.
  let userId: string | null = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch { /* signed out — expected */ }

  const admin = createAdminClient()
  const { data: row, error } = await admin
    .from('contact_messages')
    .insert({ name, email, message, subject, user_id: userId })
    .select('id')
    .single()

  if (error) {
    // The one case we must not swallow: if we can't store it, the sender has
    // to be told, so they can email us instead of assuming it arrived.
    await logErrorEvent({
      source: 'server',
      message: `Contact form insert failed: ${error.message}`,
      context: `subject=${subject}`,
    }).catch(() => {})
    return Response.json(
      { error: 'We couldn\'t save your message. Please email hello@orbitapi.com directly.' },
      { status: 500 },
    )
  }

  // ── Notify, best-effort ────────────────────────────────────────────────
  let notified = false
  if (emailConfigured()) {
    const to = process.env.CONTACT_NOTIFY_EMAIL
    if (to) {
      const label = LABELS[subject] ?? subject
      notified = await sendEmail({
        to,
        subject: `[${label}] ${name}`,
        html:
          `<p><strong>${label}</strong></p>` +
          `<p><strong>From:</strong> ${name} &lt;${email}&gt;</p>` +
          `<p style="white-space:pre-wrap">${message.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))}</p>`,
        text: `${label}\nFrom: ${name} <${email}>\n\n${message}`,
      }).catch(() => false)

      if (notified) {
        await admin.from('contact_messages').update({ notified: true }).eq('id', row.id)
      }
    }
  }

  // Reported back so the UI can promise a reply without overpromising —
  // the message is saved either way.
  return Response.json({ ok: true, notified })
}
