import type { ConnectorManifest, ActionResult } from '@/connectors/types'
import { createAdminClient } from '@/lib/supabase/admin'

async function getDb() {
  return createAdminClient()
}

export const simulatedRingManifest: ConnectorManifest = {
  slug: 'simulated-ring',
  name: 'Simulated Ring',
  category: 'Smart Home',
  description: 'Virtual Ring doorbell and motion sensors for demos — events trigger autonomous skills.',
  logoUrl: '/logos/simulated-ring.svg',
  isSimulated: true,

  auth: {
    type: 'api_key',
    keyLabel: 'Location Name',
    keyPlaceholder: 'e.g. Cabin A',
    keyHint: 'Give this Ring installation a name — no real API key needed.',
    setupGuide: [
      {
        title: 'Name your Ring installation',
        description:
          'Enter any name for this set of simulated Ring devices (e.g. "Cabin A"). ' +
          'OrbitAPI will create virtual doorbells and sensors you can trigger from chat or skills.',
      },
    ],
  },

  testConnection: async () => ({ ok: true, label: 'Simulated Ring connected' }),

  actions: [
    {
      slug: 'list_devices',
      name: 'List Ring devices',
      description:
        'Returns all simulated Ring devices for this connection. ' +
        'Each device has: device_name, device_type (doorbell | camera | motion_sensor), location.',
      risk: 'read',
      inputSchema: { type: 'object', properties: {} },
      execute: async (creds): Promise<ActionResult> => {
        const db = await getDb()
        const { data, error } = await db
          .from('simulated_ring_devices')
          .select('device_name, device_type, location, created_at')
          .eq('connection_id', creds.connection_id)
          .order('created_at')
        if (error) return { ok: false, error: error.message }
        return { ok: true, data }
      },
    },
    {
      slug: 'get_recent_events',
      name: 'Get recent events',
      description:
        'Returns recent Ring events (doorbell rings, motion, person detected). ' +
        'limit: max events to return (default 20). acknowledged: filter by acknowledged status (optional). ' +
        'Returns: id, device_name, event_type, metadata, acknowledged, occurred_at.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'integer', description: 'Max events to return, default 20' },
          acknowledged: { type: 'boolean', description: 'Filter by acknowledged status (optional)' },
          device_name: { type: 'string', description: 'Filter by device name (optional)' },
        },
      },
      execute: async (creds, params): Promise<ActionResult> => {
        const db = await getDb()
        let query = db
          .from('simulated_ring_events')
          .select('id, device_name, event_type, metadata, acknowledged, occurred_at')
          .eq('connection_id', creds.connection_id)
          .order('occurred_at', { ascending: false })
          .limit((params.limit as number) ?? 20)
        if (params.acknowledged !== undefined) {
          query = query.eq('acknowledged', params.acknowledged)
        }
        if (params.device_name) {
          query = query.eq('device_name', params.device_name as string)
        }
        const { data, error } = await query
        if (error) return { ok: false, error: error.message }
        return { ok: true, data }
      },
    },
    {
      slug: 'trigger_doorbell',
      name: 'Simulate doorbell ring',
      description:
        'Simulates a doorbell press event on a device. ' +
        'device_name: the device to trigger. note: optional context (e.g. "guest arrived").',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['device_name'],
        properties: {
          device_name: { type: 'string', description: 'Device to trigger' },
          note: { type: 'string', description: 'Optional note, e.g. "guest arrived"' },
        },
      },
      execute: async (creds, params): Promise<ActionResult> => {
        const db = await getDb()
        const { data, error } = await db
          .from('simulated_ring_events')
          .insert({
            connection_id: creds.connection_id,
            device_name: params.device_name as string,
            event_type: 'doorbell',
            metadata: params.note ? { note: params.note } : {},
          })
          .select()
          .single()
        if (error) return { ok: false, error: error.message }
        return { ok: true, data }
      },
    },
    {
      slug: 'trigger_motion',
      name: 'Simulate motion / person detected',
      description:
        'Simulates a motion or person-detected event on a device. ' +
        'device_name: the device. event_type: "motion" or "person_detected". note: optional context.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['device_name', 'event_type'],
        properties: {
          device_name: { type: 'string' },
          event_type: { type: 'string', enum: ['motion', 'person_detected'] },
          note: { type: 'string', description: 'Optional context' },
        },
      },
      execute: async (creds, params): Promise<ActionResult> => {
        const db = await getDb()
        const { data, error } = await db
          .from('simulated_ring_events')
          .insert({
            connection_id: creds.connection_id,
            device_name: params.device_name as string,
            event_type: params.event_type as string,
            metadata: params.note ? { note: params.note } : {},
          })
          .select()
          .single()
        if (error) return { ok: false, error: error.message }
        return { ok: true, data }
      },
    },
    {
      slug: 'acknowledge_event',
      name: 'Acknowledge event',
      description:
        'Marks a Ring event as acknowledged (handled). event_id: the event id from get_recent_events.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['event_id'],
        properties: {
          event_id: { type: 'string', description: 'Event UUID from get_recent_events' },
        },
      },
      execute: async (creds, params): Promise<ActionResult> => {
        const db = await getDb()
        const { error } = await db
          .from('simulated_ring_events')
          .update({ acknowledged: true })
          .eq('id', params.event_id as string)
          .eq('connection_id', creds.connection_id)
        if (error) return { ok: false, error: error.message }
        return { ok: true, data: { acknowledged: true, event_id: params.event_id } }
      },
    },
    {
      slug: 'add_device',
      name: 'Add Ring device',
      description:
        'Creates a new simulated Ring device. ' +
        'device_name: unique name e.g. "Front Door". device_type: "doorbell" | "camera" | "motion_sensor". location: optional room/area label.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['device_name', 'device_type'],
        properties: {
          device_name: { type: 'string', description: 'Unique name e.g. "Front Door"' },
          device_type: { type: 'string', enum: ['doorbell', 'camera', 'motion_sensor'] },
          location: { type: 'string', description: 'Location label e.g. "Entrance"' },
        },
      },
      execute: async (creds, params): Promise<ActionResult> => {
        const db = await getDb()
        const { data, error } = await db
          .from('simulated_ring_devices')
          .insert({
            connection_id: creds.connection_id,
            device_name: params.device_name as string,
            device_type: params.device_type as string,
            location: (params.location as string) ?? null,
          })
          .select()
          .single()
        if (error) return { ok: false, error: error.message }
        return { ok: true, data }
      },
    },
    {
      slug: 'remove_device',
      name: 'Remove Ring device',
      description: 'Permanently delete a simulated Ring device and all its associated events. This cannot be undone.',
      risk: 'destructive',
      inputSchema: {
        type: 'object',
        required: ['device_name'],
        properties: {
          device_name: { type: 'string', description: 'Device name to remove (from list_devices)' },
        },
      },
      execute: async (creds, params): Promise<ActionResult> => {
        const db = await getDb()
        await db
          .from('simulated_ring_events')
          .delete()
          .eq('connection_id', creds.connection_id)
          .eq('device_name', params.device_name as string)
        const { error } = await db
          .from('simulated_ring_devices')
          .delete()
          .eq('connection_id', creds.connection_id)
          .eq('device_name', params.device_name as string)
        if (error) return { ok: false, error: error.message }
        return { ok: true, data: { removed: params.device_name } }
      },
    },
    {
      slug: 'bulk_acknowledge',
      name: 'Bulk acknowledge events',
      description: 'Mark all pending (unacknowledged) events as acknowledged at once. Optionally filter by device or event type.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        properties: {
          device_name: { type: 'string', description: 'Only acknowledge events for this device (optional)' },
          event_type: { type: 'string', description: 'Only acknowledge this event type: doorbell, motion, person_detected (optional)' },
        },
      },
      execute: async (creds, params): Promise<ActionResult> => {
        const db = await getDb()
        let query = db
          .from('simulated_ring_events')
          .update({ acknowledged: true })
          .eq('connection_id', creds.connection_id)
          .eq('acknowledged', false)
        if (params.device_name) query = query.eq('device_name', params.device_name as string)
        if (params.event_type) query = query.eq('event_type', params.event_type as string)
        const { error, count } = await query
        if (error) return { ok: false, error: error.message }
        return { ok: true, data: { acknowledged_count: count ?? 0 } }
      },
    },
    {
      slug: 'get_event_summary',
      name: 'Get event summary',
      description: 'Get a count breakdown of events by type and device for this Ring installation. Useful for understanding activity patterns.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          start_time: { type: 'string', description: 'ISO 8601 start datetime to filter events (optional)' },
          end_time: { type: 'string', description: 'ISO 8601 end datetime to filter events (optional)' },
        },
      },
      execute: async (creds, params): Promise<ActionResult> => {
        const db = await getDb()
        let query = db
          .from('simulated_ring_events')
          .select('device_name, event_type, acknowledged')
          .eq('connection_id', creds.connection_id)
        if (params.start_time) query = query.gte('occurred_at', params.start_time as string)
        if (params.end_time) query = query.lte('occurred_at', params.end_time as string)
        const { data, error } = await query
        if (error) return { ok: false, error: error.message }
        const events = (data ?? []) as { device_name: string; event_type: string; acknowledged: boolean }[]
        const byType: Record<string, number> = {}
        const byDevice: Record<string, number> = {}
        let unacknowledged = 0
        for (const e of events) {
          byType[e.event_type] = (byType[e.event_type] ?? 0) + 1
          byDevice[e.device_name] = (byDevice[e.device_name] ?? 0) + 1
          if (!e.acknowledged) unacknowledged++
        }
        return {
          ok: true,
          data: {
            total: events.length,
            unacknowledged,
            by_type: byType,
            by_device: byDevice,
          },
        }
      },
    },
    {
      slug: 'clear_events',
      name: 'Clear all events',
      description: 'Delete all event history for this Ring installation. This cannot be undone. Optionally filter by device to clear only one device\'s history.',
      risk: 'destructive',
      inputSchema: {
        type: 'object',
        properties: {
          device_name: { type: 'string', description: 'Clear only this device\'s events (optional — omit to clear all)' },
        },
      },
      execute: async (creds, params): Promise<ActionResult> => {
        const db = await getDb()
        let query = db
          .from('simulated_ring_events')
          .delete()
          .eq('connection_id', creds.connection_id)
        if (params.device_name) query = query.eq('device_name', params.device_name as string)
        const { error } = await query
        if (error) return { ok: false, error: error.message }
        return { ok: true, data: { cleared: true, device_filter: params.device_name ?? 'all' } }
      },
    },
  ],
}
