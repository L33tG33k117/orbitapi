import type { ConnectorManifest, ActionResult } from '@/connectors/types'

const BASE = 'https://api.lodgify.com'

async function lodgifyFetch(
  apiKey: string,
  path: string,
  options: RequestInit = {}
): Promise<ActionResult> {
  const url = `${BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'X-ApiKey': apiKey,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return { ok: false, error: `Lodgify API error ${res.status}: ${text}` }
  }
  const data = await res.json().catch(() => null)
  return { ok: true, data }
}

export const lodgifyManifest: ConnectorManifest = {
  slug: 'lodgify',
  name: 'Lodgify',
  category: 'Short-Term Rental',
  description: 'Bookings, properties, availability, quotes, and guest messaging via the Lodgify REST API.',
  isSimulated: false,

  auth: {
    type: 'api_key',
    keyLabel: 'API Key',
    keyPlaceholder: 'Your Lodgify API key',
    keyHint: 'Found in Lodgify → Settings → Account → API.',
    setupGuide: [
      {
        title: 'Open your Lodgify account settings',
        description: 'Log in to Lodgify, then click your name in the top-right corner and select **Account Settings**.',
      },
      {
        title: 'Go to the API section',
        description: 'In Account Settings, click the **API** tab in the left sidebar.',
      },
      {
        title: 'Copy your API key',
        description:
          'Your API key is shown on this page. Click **Copy** and paste it into the field below. ' +
          'If you don\'t see one, click **Generate** to create a new key.',
      },
    ],
  },

  testConnection: async (creds) => {
    const result = await lodgifyFetch(creds.api_key, '/v2/properties?limit=1')
    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true, label: 'Lodgify account connected' }
  },

  actions: [
    {
      slug: 'list_properties',
      name: 'List properties',
      description:
        'Returns all properties in the Lodgify account. Each property has: id (integer), name, address, ' +
        'type. Use property id values in other actions. Always call this first if you don\'t know the property id.',
      risk: 'read',
      inputSchema: { type: 'object', properties: {} },
      execute: async (creds) => lodgifyFetch(creds.api_key, '/v2/properties?includeCount=false&limit=50'),
    },
    {
      slug: 'list_bookings',
      name: 'List bookings',
      description:
        'Returns bookings filtered by date range and/or property. ' +
        'date_from / date_to: ISO 8601 dates e.g. "2025-06-01". ' +
        'property_id: integer from list_properties (optional, omit to get all properties). ' +
        'status: "confirmed" | "pending" | "cancelled" (optional). ' +
        'Returns: id, arrival, departure, guest name, total price, status, property_id.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          date_from:   { type: 'string', description: 'ISO 8601 start date e.g. "2025-06-01"' },
          date_to:     { type: 'string', description: 'ISO 8601 end date e.g. "2025-06-30"' },
          property_id: { type: 'integer', description: 'Filter by property (optional)' },
          status:      { type: 'string', enum: ['confirmed', 'pending', 'cancelled'], description: 'Booking status filter (optional)' },
        },
      },
      execute: async (creds, params) => {
        const qs = new URLSearchParams()
        if (params.date_from)   qs.set('periodStartDate', params.date_from as string)
        if (params.date_to)     qs.set('periodEndDate', params.date_to as string)
        if (params.property_id) qs.set('propertyId', String(params.property_id))
        if (params.status)      qs.set('status', params.status as string)
        qs.set('size', '50')
        return lodgifyFetch(creds.api_key, `/v2/reservations/bookings?${qs}`)
      },
    },
    {
      slug: 'get_booking',
      name: 'Get booking details',
      description:
        'Returns full details of a single booking by id, including guest contact info, ' +
        'notes, payment status, and room/unit breakdown. booking_id: integer from list_bookings.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['booking_id'],
        properties: {
          booking_id: { type: 'integer', description: 'Booking ID from list_bookings' },
        },
      },
      execute: async (creds, params) =>
        lodgifyFetch(creds.api_key, `/v2/reservations/bookings/${params.booking_id}`),
    },
    {
      slug: 'get_availability',
      name: 'Get availability',
      description:
        'Returns availability calendar for a property between two dates. ' +
        'property_id: integer. date_from / date_to: ISO 8601. ' +
        'Returns per-day availability and minimum stay requirements.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['property_id', 'date_from', 'date_to'],
        properties: {
          property_id: { type: 'integer' },
          date_from:   { type: 'string', description: 'ISO 8601 e.g. "2025-06-01"' },
          date_to:     { type: 'string', description: 'ISO 8601 e.g. "2025-06-30"' },
        },
      },
      execute: async (creds, params) =>
        lodgifyFetch(
          creds.api_key,
          `/v2/availability/${params.property_id}?startDate=${params.date_from}&endDate=${params.date_to}`
        ),
    },
    {
      slug: 'get_quote',
      name: 'Get price quote',
      description:
        'Returns a price quote for a potential booking. ' +
        'property_id: integer. date_from / date_to: ISO 8601. guests: number of guests. ' +
        'Returns total price, nightly rate, fees, and taxes.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['property_id', 'date_from', 'date_to', 'guests'],
        properties: {
          property_id: { type: 'integer' },
          date_from:   { type: 'string' },
          date_to:     { type: 'string' },
          guests:      { type: 'integer', description: 'Number of guests' },
        },
      },
      execute: async (creds, params) =>
        lodgifyFetch(
          creds.api_key,
          `/v2/rates/quote/${params.property_id}?startDate=${params.date_from}&endDate=${params.date_to}&guestCount=${params.guests}`
        ),
    },
    {
      slug: 'list_messages',
      name: 'List guest messages',
      description:
        'Returns guest messages/conversations. ' +
        'booking_id: filter by booking (optional). limit: max results (default 20).',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          booking_id: { type: 'integer', description: 'Filter by booking (optional)' },
          limit:      { type: 'integer', description: 'Max results, default 20' },
        },
      },
      execute: async (creds, params) => {
        const qs = new URLSearchParams({ limit: String(params.limit ?? 20) })
        if (params.booking_id) qs.set('bookingId', String(params.booking_id))
        return lodgifyFetch(creds.api_key, `/v1/communication/messages?${qs}`)
      },
    },
    {
      slug: 'send_message',
      name: 'Send guest message',
      description:
        'Sends a message to a guest on an existing booking. ' +
        'booking_id: integer. message: the text to send. ' +
        'Confirm with the user before sending — this contacts a real guest.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['booking_id', 'message'],
        properties: {
          booking_id: { type: 'integer' },
          message:    { type: 'string', description: 'Message text to send to the guest' },
        },
      },
      execute: async (creds, params) =>
        lodgifyFetch(creds.api_key, '/v1/communication/messages', {
          method: 'POST',
          body: JSON.stringify({ bookingId: params.booking_id, message: params.message }),
        }),
    },
  ],
}
