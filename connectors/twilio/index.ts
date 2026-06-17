import type { ConnectorManifest, ActionResult } from '@/connectors/types'

function twilioAuthHeader(accountSid: string, authToken: string): string {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`
}

async function twilioPost(accountSid: string, authToken: string, path: string, body: Record<string, string>): Promise<ActionResult> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': twilioAuthHeader(accountSid, authToken),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return { ok: false, error: `Twilio API ${res.status}: ${text}` }
  }
  return { ok: true, data: await res.json() }
}

async function twilioGet(accountSid: string, authToken: string, path: string): Promise<ActionResult> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}${path}`
  const res = await fetch(url, {
    headers: { 'Authorization': twilioAuthHeader(accountSid, authToken) },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return { ok: false, error: `Twilio API ${res.status}: ${text}` }
  }
  return { ok: true, data: await res.json() }
}

async function twilioDelete(accountSid: string, authToken: string, path: string): Promise<ActionResult> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}${path}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': twilioAuthHeader(accountSid, authToken) },
  })
  if (res.status === 204) return { ok: true, data: { status: 'deleted' } }
  const text = await res.text().catch(() => res.statusText)
  return { ok: false, error: `Twilio API ${res.status}: ${text}` }
}

export const twilioManifest: ConnectorManifest = {
  slug: 'twilio',
  name: 'Twilio',
  category: 'Communication',
  description: 'Send SMS, WhatsApp, and MMS messages; make and track voice calls; look up phone numbers; and manage conversations via the Twilio API.',
  logoUrl: '/logos/twilio.svg',
  isSimulated: false,

  auth: {
    type: 'api_key',
    keyLabel: 'Account SID',
    keyPlaceholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    fields: [
      { key: 'account_sid', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', inputType: 'text' },
      { key: 'auth_token', label: 'Auth Token', placeholder: 'Your Twilio auth token', inputType: 'password' },
      { key: 'from_number', label: 'From Phone Number', placeholder: '+15551234567 (Twilio number)', inputType: 'text' },
    ],
    setupGuide: [
      {
        title: 'Find your credentials',
        description:
          'Log into **console.twilio.com**. On the dashboard you\'ll find your **Account SID** and **Auth Token**.',
      },
      {
        title: 'Get a Twilio phone number',
        description:
          'Go to **Phone Numbers → Manage → Buy a number** to get an SMS-capable number. ' +
          'This is the number your messages will be sent from.',
      },
    ],
  },

  testConnection: async (creds) => {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.account_sid}.json`
    const res = await fetch(url, {
      headers: { 'Authorization': twilioAuthHeader(creds.account_sid, creds.auth_token) },
    })
    if (!res.ok) return { ok: false, error: 'Invalid Account SID or Auth Token' }
    const data = await res.json()
    return { ok: true, label: `Twilio: ${data.friendly_name ?? creds.account_sid}` }
  },

  actions: [
    {
      slug: 'send_sms',
      name: 'Send SMS',
      description:
        'Send an SMS text message. to must be in E.164 format (+15551234567). ' +
        'Example: to="+15559876543", body="Alert: Front door motion at 11:32pm".',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['to', 'body'],
        properties: {
          to: { type: 'string', description: 'Recipient phone in E.164 format (+15551234567)' },
          body: { type: 'string', description: 'SMS text (max 1600 characters)' },
          from: { type: 'string', description: 'Override from number (optional, defaults to account from_number)' },
        },
      },
      execute: async (creds, params) => {
        return twilioPost(creds.account_sid, creds.auth_token, '/Messages.json', {
          To: params.to as string,
          From: (params.from as string | undefined) ?? creds.from_number,
          Body: params.body as string,
        })
      },
    },
    {
      slug: 'send_whatsapp',
      name: 'Send WhatsApp Message',
      description:
        'Send a WhatsApp message via Twilio. to and the from number must be WhatsApp-enabled. ' +
        'Example: to="whatsapp:+15559876543", body="Your booking is confirmed."',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['to', 'body'],
        properties: {
          to: { type: 'string', description: 'WhatsApp number: whatsapp:+15551234567' },
          body: { type: 'string', description: 'Message text' },
        },
      },
      execute: async (creds, params) => {
        return twilioPost(creds.account_sid, creds.auth_token, '/Messages.json', {
          To: params.to as string,
          From: `whatsapp:${creds.from_number}`,
          Body: params.body as string,
        })
      },
    },
    {
      slug: 'send_mms',
      name: 'Send MMS with Media',
      description:
        'Send an MMS message with an image or media attachment. ' +
        'media_url must be a publicly accessible URL to an image (JPEG, PNG, GIF) or other media file.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['to', 'media_url'],
        properties: {
          to: { type: 'string', description: 'Recipient phone in E.164 format' },
          media_url: { type: 'string', description: 'Publicly accessible URL to media (e.g. https://example.com/image.jpg)' },
          body: { type: 'string', description: 'Optional text body to accompany the media' },
        },
      },
      execute: async (creds, params) => {
        const body: Record<string, string> = {
          To: params.to as string,
          From: creds.from_number,
          MediaUrl: params.media_url as string,
        }
        if (params.body) body.Body = params.body as string
        return twilioPost(creds.account_sid, creds.auth_token, '/Messages.json', body)
      },
    },
    {
      slug: 'list_messages',
      name: 'List Recent Messages',
      description: 'List recent SMS/MMS messages from this Twilio number. Returns to, from, body, status, and date sent.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max messages (default 20, max 100)' },
          to: { type: 'string', description: 'Filter by recipient number (optional)' },
          from: { type: 'string', description: 'Filter by sender number (optional)' },
          date_sent: { type: 'string', description: 'Filter messages sent on this date YYYY-MM-DD (optional)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 100)
        const qs: string[] = [`PageSize=${limit}`]
        if (params.to) qs.push(`To=${encodeURIComponent(params.to as string)}`)
        if (params.from) qs.push(`From=${encodeURIComponent(params.from as string)}`)
        if (params.date_sent) qs.push(`DateSent=${params.date_sent}`)
        return twilioGet(creds.account_sid, creds.auth_token, `/Messages.json?${qs.join('&')}`)
      },
    },
    {
      slug: 'get_message',
      name: 'Get Message Status',
      description: 'Get the delivery status and details of a specific Twilio message by its SID.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['message_sid'],
        properties: {
          message_sid: { type: 'string', description: 'Twilio message SID (starts with SM...)' },
        },
      },
      execute: async (creds, params) => {
        return twilioGet(creds.account_sid, creds.auth_token, `/Messages/${params.message_sid as string}.json`)
      },
    },
    {
      slug: 'delete_message',
      name: 'Delete Message',
      description: 'Delete a Twilio message record by its SID. This removes it from your account logs.',
      risk: 'destructive',
      inputSchema: {
        type: 'object',
        required: ['message_sid'],
        properties: {
          message_sid: { type: 'string', description: 'Twilio message SID to delete (starts with SM...)' },
        },
      },
      execute: async (creds, params) => {
        return twilioDelete(creds.account_sid, creds.auth_token, `/Messages/${params.message_sid as string}.json`)
      },
    },
    {
      slug: 'make_call',
      name: 'Make Voice Call',
      description:
        'Initiate an outbound voice call from your Twilio number. ' +
        'twiml is a TwiML string defining the call behavior, ' +
        'e.g. "<Response><Say>Hello, this is an automated alert from OrbitAPI.</Say></Response>".',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['to', 'twiml'],
        properties: {
          to: { type: 'string', description: 'Phone number to call in E.164 format' },
          twiml: { type: 'string', description: 'TwiML instructions for the call (e.g. <Response><Say>Hello</Say></Response>)' },
          from: { type: 'string', description: 'Override from number (optional)' },
        },
      },
      execute: async (creds, params) => {
        return twilioPost(creds.account_sid, creds.auth_token, '/Calls.json', {
          To: params.to as string,
          From: (params.from as string | undefined) ?? creds.from_number,
          Twiml: params.twiml as string,
        })
      },
    },
    {
      slug: 'list_calls',
      name: 'List Recent Calls',
      description: 'List recent outbound and inbound calls on this Twilio account. Returns call status, duration, and timestamps.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max calls (default 20, max 100)' },
          status: { type: 'string', description: 'Filter by status: queued, ringing, in-progress, completed, failed, busy, no-answer' },
          direction: { type: 'string', description: 'Filter by direction: inbound or outbound-api' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 100)
        const qs: string[] = [`PageSize=${limit}`]
        if (params.status) qs.push(`Status=${params.status}`)
        if (params.direction) qs.push(`Direction=${params.direction}`)
        return twilioGet(creds.account_sid, creds.auth_token, `/Calls.json?${qs.join('&')}`)
      },
    },
    {
      slug: 'get_call',
      name: 'Get Call Details',
      description: 'Get status and details of a specific Twilio call by its SID.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['call_sid'],
        properties: {
          call_sid: { type: 'string', description: 'Twilio call SID (starts with CA...)' },
        },
      },
      execute: async (creds, params) => {
        return twilioGet(creds.account_sid, creds.auth_token, `/Calls/${params.call_sid as string}.json`)
      },
    },
    {
      slug: 'lookup_number',
      name: 'Lookup Phone Number',
      description:
        'Use Twilio Lookup to validate and get carrier/type info for a phone number. ' +
        'Returns number type (mobile/landline/voip), carrier, and country code.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['phone_number'],
        properties: {
          phone_number: { type: 'string', description: 'Phone number to look up in E.164 format (+15551234567)' },
          type: { type: 'string', description: 'Lookup type: carrier, caller-name (optional, may incur cost)' },
        },
      },
      execute: async (creds, params) => {
        const num = encodeURIComponent(params.phone_number as string)
        const qs = params.type ? `?Type=${params.type}` : ''
        const url = `https://lookups.twilio.com/v1/PhoneNumbers/${num}${qs}`
        const res = await fetch(url, {
          headers: { 'Authorization': twilioAuthHeader(creds.account_sid, creds.auth_token) },
        })
        if (!res.ok) {
          const text = await res.text().catch(() => res.statusText)
          return { ok: false, error: `Twilio Lookup ${res.status}: ${text}` }
        }
        return { ok: true, data: await res.json() }
      },
    },
    {
      slug: 'list_phone_numbers',
      name: 'List Phone Numbers',
      description: 'List all Twilio phone numbers in your account with their capabilities (SMS, voice, MMS).',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max numbers (default 20)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 100)
        return twilioGet(creds.account_sid, creds.auth_token, `/IncomingPhoneNumbers.json?PageSize=${limit}`)
      },
    },
    {
      slug: 'send_verification',
      name: 'Send Verification Code',
      description:
        'Send a one-time verification code via SMS or call using Twilio Verify. ' +
        'Requires a Twilio Verify service SID (from console.twilio.com → Verify).',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['to', 'verify_service_sid'],
        properties: {
          to: { type: 'string', description: 'Phone number to verify in E.164 format' },
          verify_service_sid: { type: 'string', description: 'Twilio Verify Service SID (starts with VA...)' },
          channel: { type: 'string', description: 'Delivery channel: sms (default) or call' },
        },
      },
      execute: async (creds, params) => {
        const url = `https://verify.twilio.com/v2/Services/${params.verify_service_sid as string}/Verifications`
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': twilioAuthHeader(creds.account_sid, creds.auth_token),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: params.to as string,
            Channel: (params.channel as string | undefined) ?? 'sms',
          }).toString(),
        })
        if (!res.ok) {
          const text = await res.text().catch(() => res.statusText)
          return { ok: false, error: `Twilio Verify ${res.status}: ${text}` }
        }
        return { ok: true, data: await res.json() }
      },
    },
    {
      slug: 'check_verification',
      name: 'Check Verification Code',
      description: 'Check a verification code submitted by a user against a Twilio Verify service.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['to', 'code', 'verify_service_sid'],
        properties: {
          to: { type: 'string', description: 'Phone number being verified (E.164 format)' },
          code: { type: 'string', description: 'The verification code entered by the user' },
          verify_service_sid: { type: 'string', description: 'Twilio Verify Service SID (starts with VA...)' },
        },
      },
      execute: async (creds, params) => {
        const url = `https://verify.twilio.com/v2/Services/${params.verify_service_sid as string}/VerificationCheck`
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': twilioAuthHeader(creds.account_sid, creds.auth_token),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: params.to as string,
            Code: params.code as string,
          }).toString(),
        })
        if (!res.ok) {
          const text = await res.text().catch(() => res.statusText)
          return { ok: false, error: `Twilio Verify ${res.status}: ${text}` }
        }
        return { ok: true, data: await res.json() }
      },
    },
    {
      slug: 'list_recordings',
      name: 'List Call Recordings',
      description: 'List voice call recordings in your Twilio account. Returns recording SID, duration, and call SID.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          call_sid: { type: 'string', description: 'Filter recordings by call SID (optional)' },
          limit: { type: 'number', description: 'Max recordings (default 20)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 100)
        if (params.call_sid) {
          return twilioGet(creds.account_sid, creds.auth_token, `/Calls/${params.call_sid as string}/Recordings.json?PageSize=${limit}`)
        }
        return twilioGet(creds.account_sid, creds.auth_token, `/Recordings.json?PageSize=${limit}`)
      },
    },
    {
      slug: 'get_account_usage',
      name: 'Get Account Usage',
      description: 'Get Twilio account usage summary including message and call counts and costs for a billing period.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'Start date YYYY-MM-DD (optional)' },
          end_date: { type: 'string', description: 'End date YYYY-MM-DD (optional)' },
          category: { type: 'string', description: 'Usage category: sms, calls, recordings (optional)' },
        },
      },
      execute: async (creds, params) => {
        const qs: string[] = []
        if (params.start_date) qs.push(`StartDate=${params.start_date}`)
        if (params.end_date) qs.push(`EndDate=${params.end_date}`)
        if (params.category) qs.push(`Category=${params.category}`)
        return twilioGet(creds.account_sid, creds.auth_token, `/Usage/Records.json${qs.length ? `?${qs.join('&')}` : ''}`)
      },
    },
  ],
}
