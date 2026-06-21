// Best-effort transactional email via Resend's REST API (no SDK dependency).
//
// This is intentionally a no-op when RESEND_API_KEY is not configured: the app
// must work without email set up, so callers can fire-and-forget and ignore the
// boolean result. Configure RESEND_API_KEY (and optionally EMAIL_FROM) to turn
// the email channel on.

interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

export async function sendEmail(p: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false
  const from = process.env.EMAIL_FROM ?? 'OrbitAPI <notifications@orbitapi.app>'

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(p.to) ? p.to : [p.to],
        subject: p.subject,
        html: p.html,
        ...(p.text ? { text: p.text } : {}),
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
