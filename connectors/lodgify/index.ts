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
  logoUrl: '/logos/lodgify.svg',
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
    {
      slug: 'create_booking',
      name: 'Create Booking',
      description:
        'Create a new reservation/booking in Lodgify. ' +
        'property_id: integer from list_properties. room_id: integer from list_rooms. ' +
        'arrival / departure: ISO 8601 dates. guest_name, guest_email required. ' +
        'guests: number of guests. source: booking channel e.g. "direct", "airbnb".',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['property_id', 'room_id', 'arrival', 'departure', 'guest_name', 'guest_email'],
        properties: {
          property_id:  { type: 'integer', description: 'Property ID from list_properties' },
          room_id:      { type: 'integer', description: 'Room/unit ID from list_rooms' },
          arrival:      { type: 'string', description: 'Check-in date ISO 8601 e.g. "2025-07-01"' },
          departure:    { type: 'string', description: 'Check-out date ISO 8601 e.g. "2025-07-07"' },
          guest_name:   { type: 'string', description: 'Full name of the primary guest' },
          guest_email:  { type: 'string', description: 'Guest email address' },
          guest_phone:  { type: 'string', description: 'Guest phone number (optional)' },
          guests:       { type: 'integer', description: 'Number of guests (default 1)' },
          source:       { type: 'string', description: 'Booking source e.g. "direct", "airbnb" (optional)' },
          notes:        { type: 'string', description: 'Internal notes on the booking (optional)' },
        },
      },
      execute: async (creds, params) =>
        lodgifyFetch(creds.api_key, '/v2/reservations/bookings', {
          method: 'POST',
          body: JSON.stringify({
            propertyId: params.property_id,
            roomId: params.room_id,
            arrival: params.arrival,
            departure: params.departure,
            guestName: params.guest_name,
            guestEmail: params.guest_email,
            guestPhone: params.guest_phone ?? '',
            guestCount: params.guests ?? 1,
            source: params.source ?? 'direct',
            notes: params.notes ?? '',
          }),
        }),
    },
    {
      slug: 'cancel_booking',
      name: 'Cancel Booking',
      description:
        'Cancel an existing Lodgify booking by ID. ' +
        'booking_id: integer from list_bookings. reason: optional cancellation reason text.',
      risk: 'destructive',
      inputSchema: {
        type: 'object',
        required: ['booking_id'],
        properties: {
          booking_id: { type: 'integer', description: 'Booking ID to cancel' },
          reason:     { type: 'string', description: 'Cancellation reason (optional)' },
        },
      },
      execute: async (creds, params) =>
        lodgifyFetch(creds.api_key, `/v2/reservations/bookings/${params.booking_id}/cancel`, {
          method: 'PUT',
          body: JSON.stringify({ reason: params.reason ?? '' }),
        }),
    },
    {
      slug: 'update_booking',
      name: 'Update Booking',
      description:
        'Update fields on an existing Lodgify booking such as guest count, notes, or dates. ' +
        'booking_id: integer. Only provide fields you want to change.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['booking_id'],
        properties: {
          booking_id:  { type: 'integer', description: 'Booking ID to update' },
          arrival:     { type: 'string', description: 'New check-in date ISO 8601 (optional)' },
          departure:   { type: 'string', description: 'New check-out date ISO 8601 (optional)' },
          guests:      { type: 'integer', description: 'Updated guest count (optional)' },
          notes:       { type: 'string', description: 'Updated internal notes (optional)' },
          guest_name:  { type: 'string', description: 'Updated guest name (optional)' },
          guest_email: { type: 'string', description: 'Updated guest email (optional)' },
        },
      },
      execute: async (creds, params) => {
        const { booking_id, guests, guest_name, guest_email, ...rest } = params
        const body: Record<string, unknown> = { ...rest }
        if (guests !== undefined) body.guestCount = guests
        if (guest_name) body.guestName = guest_name
        if (guest_email) body.guestEmail = guest_email
        return lodgifyFetch(creds.api_key, `/v2/reservations/bookings/${booking_id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      },
    },
    {
      slug: 'list_guests',
      name: 'List Guests',
      description:
        'List guest records in Lodgify. Returns guest ID, name, email, phone, and booking count. ' +
        'search: optional name or email filter. limit defaults to 20.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Search by name or email (optional)' },
          limit:  { type: 'integer', description: 'Max results (default 20)' },
        },
      },
      execute: async (creds, params) => {
        const qs = new URLSearchParams({ size: String(params.limit ?? 20) })
        if (params.search) qs.set('search', params.search as string)
        return lodgifyFetch(creds.api_key, `/v2/guests?${qs}`)
      },
    },
    {
      slug: 'get_guest',
      name: 'Get Guest',
      description: 'Get full profile details for a single Lodgify guest by their guest ID.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['guest_id'],
        properties: {
          guest_id: { type: 'integer', description: 'Guest ID from list_guests' },
        },
      },
      execute: async (creds, params) =>
        lodgifyFetch(creds.api_key, `/v2/guests/${params.guest_id}`),
    },
    {
      slug: 'create_guest',
      name: 'Create Guest',
      description:
        'Create a new guest record in Lodgify. ' +
        'name and email are required. phone, country_code, and notes are optional.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name:         { type: 'string', description: 'Full name of the guest' },
          email:        { type: 'string', description: 'Guest email address' },
          phone:        { type: 'string', description: 'Guest phone number (optional)' },
          country_code: { type: 'string', description: 'ISO 3166-1 alpha-2 country code e.g. "US" (optional)' },
          notes:        { type: 'string', description: 'Internal notes about the guest (optional)' },
        },
      },
      execute: async (creds, params) =>
        lodgifyFetch(creds.api_key, '/v2/guests', {
          method: 'POST',
          body: JSON.stringify({
            name: params.name,
            email: params.email,
            phone: params.phone ?? '',
            countryCode: params.country_code ?? '',
            notes: params.notes ?? '',
          }),
        }),
    },
    {
      slug: 'list_rooms',
      name: 'List Rooms',
      description:
        'List rooms/units for a given property. Returns room ID, name, type, max guests, and amenities. ' +
        'property_id: integer from list_properties.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['property_id'],
        properties: {
          property_id: { type: 'integer', description: 'Property ID from list_properties' },
        },
      },
      execute: async (creds, params) =>
        lodgifyFetch(creds.api_key, `/v2/properties/${params.property_id}/rooms`),
    },
    {
      slug: 'get_room',
      name: 'Get Room',
      description: 'Get full details of a specific room/unit including amenities, capacity, and description.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['property_id', 'room_id'],
        properties: {
          property_id: { type: 'integer', description: 'Property ID' },
          room_id:     { type: 'integer', description: 'Room ID from list_rooms' },
        },
      },
      execute: async (creds, params) =>
        lodgifyFetch(creds.api_key, `/v2/properties/${params.property_id}/rooms/${params.room_id}`),
    },
    {
      slug: 'block_dates',
      name: 'Block Dates',
      description:
        'Block specific dates on a room/unit calendar (mark as unavailable). ' +
        'Useful for owner stays, maintenance, or holding periods. ' +
        'property_id, room_id, date_from, date_to required.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['property_id', 'room_id', 'date_from', 'date_to'],
        properties: {
          property_id: { type: 'integer', description: 'Property ID' },
          room_id:     { type: 'integer', description: 'Room/unit ID' },
          date_from:   { type: 'string', description: 'Block start date ISO 8601 e.g. "2025-08-01"' },
          date_to:     { type: 'string', description: 'Block end date ISO 8601 e.g. "2025-08-07"' },
          notes:       { type: 'string', description: 'Reason for the block e.g. "Owner stay" (optional)' },
        },
      },
      execute: async (creds, params) =>
        lodgifyFetch(creds.api_key, `/v2/properties/${params.property_id}/rooms/${params.room_id}/blocked-periods`, {
          method: 'POST',
          body: JSON.stringify({
            startDate: params.date_from,
            endDate: params.date_to,
            notes: params.notes ?? '',
          }),
        }),
    },
    {
      slug: 'list_rates',
      name: 'List Rate Plans',
      description:
        'List rate plans (pricing configurations) for a property. Returns rate plan ID, name, and nightly base price.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['property_id'],
        properties: {
          property_id: { type: 'integer', description: 'Property ID from list_properties' },
        },
      },
      execute: async (creds, params) =>
        lodgifyFetch(creds.api_key, `/v2/rates/${params.property_id}`),
    },
    {
      slug: 'update_rate',
      name: 'Update Nightly Rate',
      description:
        'Set the nightly rate for a property/room for a specific date range. ' +
        'property_id, room_id, date_from, date_to, and nightly_rate (number) are required.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['property_id', 'room_id', 'date_from', 'date_to', 'nightly_rate'],
        properties: {
          property_id:  { type: 'integer', description: 'Property ID' },
          room_id:      { type: 'integer', description: 'Room/unit ID' },
          date_from:    { type: 'string', description: 'Rate period start date ISO 8601' },
          date_to:      { type: 'string', description: 'Rate period end date ISO 8601' },
          nightly_rate: { type: 'number', description: 'Nightly rate in the property\'s currency' },
        },
      },
      execute: async (creds, params) =>
        lodgifyFetch(creds.api_key, `/v2/rates/${params.property_id}/rooms/${params.room_id}`, {
          method: 'POST',
          body: JSON.stringify({
            startDate: params.date_from,
            endDate: params.date_to,
            price: params.nightly_rate,
          }),
        }),
    },
    {
      slug: 'get_property',
      name: 'Get Property',
      description:
        'Get full details of a single Lodgify property including name, address, amenities, and description.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['property_id'],
        properties: {
          property_id: { type: 'integer', description: 'Property ID from list_properties' },
        },
      },
      execute: async (creds, params) =>
        lodgifyFetch(creds.api_key, `/v2/properties/${params.property_id}`),
    },
    {
      slug: 'get_revenue_report',
      name: 'Get Revenue Report',
      description:
        'Get a revenue summary report for a property over a date range. ' +
        'Returns total revenue, average daily rate, occupancy rate, and booking count.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['property_id', 'date_from', 'date_to'],
        properties: {
          property_id: { type: 'integer', description: 'Property ID from list_properties' },
          date_from:   { type: 'string', description: 'Report start date ISO 8601 e.g. "2025-01-01"' },
          date_to:     { type: 'string', description: 'Report end date ISO 8601 e.g. "2025-12-31"' },
        },
      },
      execute: async (creds, params) =>
        lodgifyFetch(
          creds.api_key,
          `/v2/reports/revenue?propertyId=${params.property_id}&startDate=${params.date_from}&endDate=${params.date_to}`
        ),
    },
    {
      slug: 'list_transactions',
      name: 'List Transactions',
      description:
        'List financial transactions (payments, refunds) for a booking or across all bookings. ' +
        'booking_id: filter to a specific booking (optional). limit defaults to 20.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          booking_id: { type: 'integer', description: 'Filter by booking ID (optional)' },
          limit:      { type: 'integer', description: 'Max results (default 20)' },
        },
      },
      execute: async (creds, params) => {
        const qs = new URLSearchParams({ size: String(params.limit ?? 20) })
        if (params.booking_id) qs.set('bookingId', String(params.booking_id))
        return lodgifyFetch(creds.api_key, `/v2/transactions?${qs}`)
      },
    },
    {
      slug: 'send_invoice',
      name: 'Send Invoice',
      description:
        'Send a payment invoice to the guest for a specific booking via email. ' +
        'booking_id: integer. The invoice is sent to the guest email on file.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['booking_id'],
        properties: {
          booking_id: { type: 'integer', description: 'Booking ID whose invoice to send' },
        },
      },
      execute: async (creds, params) =>
        lodgifyFetch(creds.api_key, `/v2/reservations/bookings/${params.booking_id}/send-invoice`, {
          method: 'POST',
          body: JSON.stringify({}),
        }),
    },
  ],
}
