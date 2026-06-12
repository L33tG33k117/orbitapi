import type { ConnectorManifest, ActionResult } from '@/connectors/types'
import { createAdminClient } from '@/lib/supabase/admin'

// Credentials: { connection_id } — we use the connection_id as the device namespace
// so multiple workspaces can each have their own simulated lights.

async function getDb() {
  return createAdminClient()
}

async function getDevice(connectionId: string, name: string) {
  const db = await getDb()
  const { data } = await db
    .from('simulated_devices')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('device_name', name)
    .single()
  return data
}

async function upsertDevice(connectionId: string, name: string, patch: Record<string, unknown>): Promise<ActionResult> {
  const db = await getDb()
  const { error } = await db.from('simulated_devices').upsert(
    { connection_id: connectionId, device_name: name, ...patch, updated_at: new Date().toISOString() },
    { onConflict: 'connection_id,device_name' }
  )
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { device: name, ...patch } }
}

export const simulatedLightsManifest: ConnectorManifest = {
  slug: 'simulated-lights',
  name: 'Simulated Lights',
  category: 'Smart Home',
  description: 'A virtual lighting system for demos — on/off, brightness, color, and scenes.',
  isSimulated: true,

  auth: {
    type: 'api_key',
    keyLabel: 'Device Group Name',
    keyPlaceholder: 'e.g. Vacation Rental A',
    keyHint: 'Just give this light group a name — no real API key needed.',
    setupGuide: [
      {
        title: 'Name your light group',
        description:
          'Enter any name for this set of simulated lights (e.g. "Cabin A"). ' +
          'OrbitAPI will create a virtual lighting system you can control from chat.',
      },
    ],
  },

  testConnection: async (creds) => ({
    ok: true,
    label: creds.api_key || 'Simulated Lights',
  }),

  actions: [
    {
      slug: 'list_devices',
      name: 'List devices',
      description:
        'Returns all simulated light devices for this connection. ' +
        'Each device has: device_name (string), is_on (bool), brightness (0–100), hex_color (string), scene (string|null).',
      risk: 'read',
      inputSchema: { type: 'object', properties: {} },
      execute: async (creds) => {
        const db = await getDb()
        const { data, error } = await db
          .from('simulated_devices')
          .select('device_name, is_on, brightness, color_temp, hex_color, scene, updated_at')
          .eq('connection_id', creds.connection_id)
        if (error) return { ok: false, error: error.message }
        return { ok: true, data }
      },
    },
    {
      slug: 'set_power',
      name: 'Turn on / off',
      description:
        'Turn a simulated light device on or off. ' +
        'device_name: the name of the device (from list_devices). is_on: true = on, false = off.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['device_name', 'is_on'],
        properties: {
          device_name: { type: 'string', description: 'Device to control' },
          is_on: { type: 'boolean', description: 'true = on, false = off' },
        },
      },
      execute: async (creds, params) =>
        upsertDevice(creds.connection_id, params.device_name as string, { is_on: params.is_on }),
    },
    {
      slug: 'set_brightness',
      name: 'Set brightness',
      description:
        'Set brightness of a device. brightness: integer 0–100 (0 = off, 100 = full). ' +
        'device_name: from list_devices.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['device_name', 'brightness'],
        properties: {
          device_name: { type: 'string' },
          brightness: { type: 'integer', minimum: 0, maximum: 100 },
        },
      },
      execute: async (creds, params) =>
        upsertDevice(creds.connection_id, params.device_name as string, {
          brightness: params.brightness,
          is_on: (params.brightness as number) > 0,
        }),
    },
    {
      slug: 'set_color',
      name: 'Set color',
      description:
        'Set the color of a device. hex_color: CSS hex string e.g. "#FF6600". ' +
        'color_temp: color temperature in Kelvin, 2700 = warm white, 6500 = cool white (optional).',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['device_name', 'hex_color'],
        properties: {
          device_name: { type: 'string' },
          hex_color: { type: 'string', description: 'CSS hex color e.g. "#FFFFFF"' },
          color_temp: { type: 'integer', description: 'Color temp in Kelvin (2700–6500), optional' },
        },
      },
      execute: async (creds, params) =>
        upsertDevice(creds.connection_id, params.device_name as string, {
          hex_color: params.hex_color,
          ...(params.color_temp ? { color_temp: params.color_temp } : {}),
        }),
    },
    {
      slug: 'set_scene',
      name: 'Activate scene',
      description:
        'Activate a named scene on one or all devices. ' +
        'scene: e.g. "Entry", "Relax", "Bright". device_name: specific device, or "all" to apply to all devices.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['scene', 'device_name'],
        properties: {
          device_name: { type: 'string', description: 'Device name or "all"' },
          scene: { type: 'string', description: 'Scene name e.g. "Entry", "Relax"' },
        },
      },
      execute: async (creds, params) => {
        const scenes: Record<string, Record<string, unknown>> = {
          Entry:  { is_on: true, brightness: 80, hex_color: '#FFF5E0', color_temp: 3000 },
          Relax:  { is_on: true, brightness: 40, hex_color: '#FFD580', color_temp: 2700 },
          Bright: { is_on: true, brightness: 100, hex_color: '#FFFFFF', color_temp: 5000 },
          Night:  { is_on: true, brightness: 10, hex_color: '#FF4500', color_temp: 2200 },
          Off:    { is_on: false, brightness: 0 },
        }
        const sceneSettings = scenes[params.scene as string] ?? { is_on: true, brightness: 80 }
        const db = await getDb()

        if (params.device_name === 'all') {
          const { data: devices } = await db
            .from('simulated_devices')
            .select('device_name')
            .eq('connection_id', creds.connection_id)
          if (!devices?.length) return { ok: false, error: 'No devices found. Add a device first.' }
          for (const d of devices) {
            await upsertDevice(creds.connection_id, d.device_name, { scene: params.scene, ...sceneSettings })
          }
          return { ok: true, data: { applied: params.scene, devices: devices.map(d => d.device_name) } }
        }
        return upsertDevice(creds.connection_id, params.device_name as string, { scene: params.scene, ...sceneSettings })
      },
    },
    {
      slug: 'add_device',
      name: 'Add device',
      description: 'Create a new simulated light device. device_name: unique name e.g. "Living Room", "Entry".',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['device_name'],
        properties: {
          device_name: { type: 'string', description: 'Unique name for the new device' },
        },
      },
      execute: async (creds, params) => {
        const existing = await getDevice(creds.connection_id, params.device_name as string)
        if (existing) return { ok: false, error: `Device "${params.device_name}" already exists.` }
        return upsertDevice(creds.connection_id, params.device_name as string, {
          is_on: false, brightness: 100, hex_color: '#FFFFFF', color_temp: 3000,
        })
      },
    },
  ],
}
