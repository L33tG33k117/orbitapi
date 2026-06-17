// connectors/eufy-security/index.ts
import type { ConnectorManifest, ActionResult } from '@/connectors/types'

const EUFY_BASE = 'https://security-app.eufylife.com/v1'

async function eufyFetch(
  token: string,
  path: string,
  options: RequestInit = {},
): Promise<ActionResult> {
  const url = `${EUFY_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'X-Auth-Token': token,
      'Content-Type': 'application/json',
      'App-Type': 'eufySecurity',
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    return {
      ok: false,
      error: `Eufy ${res.status}: ${await res.text().catch(() => res.statusText)}`,
    }
  }
  const json = await res.json().catch(() => null)
  if (json && typeof json.code === 'number' && json.code !== 0) {
    return { ok: false, error: `Eufy API error ${json.code}: ${json.msg ?? 'unknown error'}` }
  }
  return { ok: true, data: json?.data ?? json }
}

export const eufySecurityManifest: ConnectorManifest = {
  slug: 'eufy-security',
  name: 'Eufy Security',
  category: 'Smart Home',
  description: 'Eufy Security cameras — list devices, view status, control streaming, and manage alerts.',
  logoUrl: '/logos/eufy-security.svg',
  isSimulated: false,
  auth: {
    type: 'api_key',
    keyLabel: 'Auth Token',
    keyPlaceholder: 'Your Eufy Security X-Auth-Token',
    fields: [
      {
        key: 'token',
        label: 'Auth Token',
        placeholder: 'Eufy Security session token (X-Auth-Token)',
        inputType: 'password',
      },
    ],
    setupGuide: [
      {
        title: 'Log in to the Eufy Security app',
        description: 'Use a dedicated account that has been shared access to the devices you want to automate. Eufy does not support standalone API keys, so a session token is used.',
      },
      {
        title: 'Capture the auth token',
        description: 'Authenticate against **{EUFY_BASE}/passport/login** with your email and password. The response includes an **auth_token** — paste it here.',
      },
      {
        title: 'Token lifetime',
        description: 'Eufy session tokens expire periodically. Re-authenticate and update this field if connections start failing with a 401.',
      },
    ],
  },
  testConnection: async (creds) => {
    const res = await eufyFetch(creds.token, '/app/get_devs_list', {
      method: 'POST',
      body: JSON.stringify({ device_sn: '', num: 1, orderby: '', page: 0, station_sn: '' }),
    })
    if (!res.ok) return { ok: false, error: res.error }
    const list = Array.isArray(res.data) ? res.data : []
    return { ok: true, label: `Eufy Security (${list.length} device${list.length === 1 ? '' : 's'})` }
  },
  actions: [
    {
      slug: 'list_devices',
      name: 'List Devices',
      description: 'List all Eufy devices (cameras, doorbells, sensors) registered to the account. limit defaults to 50.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max results (default 50, max 100)' },
          page: { type: 'number', description: 'Page number, 0-indexed (default 0)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 50, 100)
        const page = (params.page as number | undefined) ?? 0
        return eufyFetch(creds.token, '/app/get_devs_list', {
          method: 'POST',
          body: JSON.stringify({ device_sn: '', num: limit, orderby: '', page, station_sn: '' }),
        })
      },
    },
    {
      slug: 'list_stations',
      name: 'List Stations',
      description: 'List Eufy HomeBase stations that devices connect through, including online status and firmware version.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max results (default 50, max 100)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 50, 100)
        return eufyFetch(creds.token, '/app/get_hub_list', {
          method: 'POST',
          body: JSON.stringify({ device_sn: '', num: limit, orderby: '', page: 0, station_sn: '' }),
        })
      },
    },
    {
      slug: 'get_device_status',
      name: 'Get Device Status',
      description: 'Get detailed status for a single device by serial number — battery level, signal, online state, and current mode.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          device_sn: { type: 'string', description: 'Device serial number' },
        },
        required: ['device_sn'],
      },
      execute: async (creds, params) => {
        return eufyFetch(creds.token, '/app/get_dev_info', {
          method: 'POST',
          body: JSON.stringify({ device_sn: params.device_sn as string }),
        })
      },
    },
    {
      slug: 'list_events',
      name: 'List Security Events',
      description: 'List recent security events (motion, person, doorbell rings). Filter by device_sn and time range. limit defaults to 25.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          device_sn: { type: 'string', description: 'Filter to a specific device serial number' },
          start_time: { type: 'number', description: 'Start Unix timestamp (seconds)' },
          end_time: { type: 'number', description: 'End Unix timestamp (seconds)' },
          limit: { type: 'number', description: 'Max results (default 25, max 100)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        const now = Math.floor(Date.now() / 1000)
        const end = (params.end_time as number | undefined) ?? now
        const start = (params.start_time as number | undefined) ?? now - 86400
        return eufyFetch(creds.token, '/event/app/get_all_history_record', {
          method: 'POST',
          body: JSON.stringify({
            device_sn: (params.device_sn as string | undefined) ?? '',
            end_time: end,
            start_time: start,
            num: limit,
            page: 0,
            station_sn: '',
            storage: 0,
          }),
        })
      },
    },
    {
      slug: 'set_guard_mode',
      name: 'Set Guard Mode',
      description: 'Set the security guard mode for a HomeBase station. mode: 0 = Away, 1 = Home, 2 = Disarmed, 47 = Geofencing, 63 = Schedule.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        properties: {
          station_sn: { type: 'string', description: 'HomeBase station serial number' },
          mode: { type: 'number', description: 'Guard mode (0=Away, 1=Home, 2=Disarmed, 47=Geofencing, 63=Schedule)' },
        },
        required: ['station_sn', 'mode'],
      },
      execute: async (creds, params) => {
        return eufyFetch(creds.token, '/app/equipment/set_arming', {
          method: 'POST',
          body: JSON.stringify({
            station_sn: params.station_sn as string,
            mode: params.mode as number,
          }),
        })
      },
    },
    {
      slug: 'start_stream',
      name: 'Start Live Stream',
      description: 'Request a live RTMP/HLS stream URL for a camera by serial number. Returns a temporary streaming URL.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        properties: {
          device_sn: { type: 'string', description: 'Camera serial number' },
          station_sn: { type: 'string', description: 'Parent HomeBase station serial number' },
        },
        required: ['device_sn', 'station_sn'],
      },
      execute: async (creds, params) => {
        return eufyFetch(creds.token, '/web/equipment/start_stream', {
          method: 'POST',
          body: JSON.stringify({
            device_sn: params.device_sn as string,
            station_sn: params.station_sn as string,
            proto: 2,
          }),
        })
      },
    },
    {
      slug: 'stop_stream',
      name: 'Stop Live Stream',
      description: 'Stop an active live stream for a camera to free up bandwidth and resources.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        properties: {
          device_sn: { type: 'string', description: 'Camera serial number' },
          station_sn: { type: 'string', description: 'Parent HomeBase station serial number' },
        },
        required: ['device_sn', 'station_sn'],
      },
      execute: async (creds, params) => {
        return eufyFetch(creds.token, '/web/equipment/stop_stream', {
          method: 'POST',
          body: JSON.stringify({
            device_sn: params.device_sn as string,
            station_sn: params.station_sn as string,
            proto: 2,
          }),
        })
      },
    },
    {
      slug: 'trigger_alarm',
      name: 'Trigger Alarm',
      description: 'Trigger the siren/alarm on a Eufy HomeBase station by serial number. Use to deter intruders when a threat is detected.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['station_sn'],
        properties: {
          station_sn: { type: 'string', description: 'HomeBase station serial number' },
          duration: { type: 'number', description: 'Alarm duration in seconds (default 30, max 300)' },
        },
      },
      execute: async (creds, params) => {
        return eufyFetch(creds.token, '/app/equipment/trigger_alarm', {
          method: 'POST',
          body: JSON.stringify({
            station_sn: params.station_sn as string,
            alarm_duration: Math.min((params.duration as number | undefined) ?? 30, 300),
          }),
        })
      },
    },
    {
      slug: 'stop_alarm',
      name: 'Stop Alarm',
      description: 'Stop an active siren/alarm on a Eufy HomeBase station.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['station_sn'],
        properties: {
          station_sn: { type: 'string', description: 'HomeBase station serial number' },
        },
      },
      execute: async (creds, params) => {
        return eufyFetch(creds.token, '/app/equipment/stop_alarm', {
          method: 'POST',
          body: JSON.stringify({ station_sn: params.station_sn as string }),
        })
      },
    },
    {
      slug: 'enable_motion_detection',
      name: 'Enable Motion Detection',
      description: 'Enable motion detection on a specific Eufy camera or sensor by serial number.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['device_sn', 'station_sn'],
        properties: {
          device_sn: { type: 'string', description: 'Device serial number' },
          station_sn: { type: 'string', description: 'Parent HomeBase station serial number' },
        },
      },
      execute: async (creds, params) => {
        return eufyFetch(creds.token, '/app/equipment/motion_switch', {
          method: 'POST',
          body: JSON.stringify({
            device_sn: params.device_sn as string,
            station_sn: params.station_sn as string,
            enable: true,
          }),
        })
      },
    },
    {
      slug: 'disable_motion_detection',
      name: 'Disable Motion Detection',
      description: 'Disable motion detection on a specific Eufy camera or sensor. Useful during known high-traffic periods to avoid false alerts.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['device_sn', 'station_sn'],
        properties: {
          device_sn: { type: 'string', description: 'Device serial number' },
          station_sn: { type: 'string', description: 'Parent HomeBase station serial number' },
        },
      },
      execute: async (creds, params) => {
        return eufyFetch(creds.token, '/app/equipment/motion_switch', {
          method: 'POST',
          body: JSON.stringify({
            device_sn: params.device_sn as string,
            station_sn: params.station_sn as string,
            enable: false,
          }),
        })
      },
    },
    {
      slug: 'set_motion_sensitivity',
      name: 'Set Motion Sensitivity',
      description: 'Adjust motion detection sensitivity for a Eufy camera. sensitivity: 1 (lowest) to 7 (highest). Lower values reduce false positives.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['device_sn', 'station_sn', 'sensitivity'],
        properties: {
          device_sn: { type: 'string', description: 'Device serial number' },
          station_sn: { type: 'string', description: 'Parent HomeBase station serial number' },
          sensitivity: { type: 'number', description: 'Sensitivity level 1–7 (1=lowest, 7=highest)' },
        },
      },
      execute: async (creds, params) => {
        const level = Math.min(Math.max(Math.round(params.sensitivity as number), 1), 7)
        return eufyFetch(creds.token, '/app/equipment/motion_sensitivity', {
          method: 'POST',
          body: JSON.stringify({
            device_sn: params.device_sn as string,
            station_sn: params.station_sn as string,
            sensitivity: level,
          }),
        })
      },
    },
    {
      slug: 'get_event_thumbnail',
      name: 'Get Event Thumbnail',
      description: 'Get the thumbnail image URL for a specific security event by its event ID (from list_events).',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['event_id'],
        properties: {
          event_id: { type: 'string', description: 'Event ID from list_events' },
          device_sn: { type: 'string', description: 'Device serial number the event belongs to' },
        },
      },
      execute: async (creds, params) => {
        return eufyFetch(creds.token, '/app/get_event_thumbnail', {
          method: 'POST',
          body: JSON.stringify({
            event_id: params.event_id as string,
            device_sn: (params.device_sn as string | undefined) ?? '',
          }),
        })
      },
    },
    {
      slug: 'list_clips',
      name: 'List Recorded Clips',
      description: 'List recorded video clips stored in the cloud or on a HomeBase. Filter by device and time range. Returns clip IDs, timestamps, and download URLs.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          device_sn: { type: 'string', description: 'Filter to a specific device serial number (optional)' },
          station_sn: { type: 'string', description: 'HomeBase station serial number (optional)' },
          start_time: { type: 'number', description: 'Start Unix timestamp in seconds (default: 24h ago)' },
          end_time: { type: 'number', description: 'End Unix timestamp in seconds (default: now)' },
          limit: { type: 'number', description: 'Max clips (default 25, max 100)' },
        },
      },
      execute: async (creds, params) => {
        const now = Math.floor(Date.now() / 1000)
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        return eufyFetch(creds.token, '/app/get_video_clip_list', {
          method: 'POST',
          body: JSON.stringify({
            device_sn: (params.device_sn as string | undefined) ?? '',
            station_sn: (params.station_sn as string | undefined) ?? '',
            start_time: (params.start_time as number | undefined) ?? now - 86400,
            end_time: (params.end_time as number | undefined) ?? now,
            num: limit,
            page: 0,
          }),
        })
      },
    },
    {
      slug: 'delete_events',
      name: 'Delete Events',
      description: 'Delete one or more security event records from Eufy. event_ids: JSON array of event ID strings (from list_events).',
      risk: 'destructive',
      inputSchema: {
        type: 'object',
        required: ['event_ids'],
        properties: {
          event_ids: { type: 'string', description: 'JSON array of event ID strings, e.g. ["ev_001","ev_002"]' },
          device_sn: { type: 'string', description: 'Device serial number the events belong to (optional)' },
        },
      },
      execute: async (creds, params) => {
        let ids: string[] = []
        try { ids = JSON.parse(params.event_ids as string) } catch { ids = [] }
        return eufyFetch(creds.token, '/event/app/delete_event_record', {
          method: 'POST',
          body: JSON.stringify({
            event_ids: ids,
            device_sn: (params.device_sn as string | undefined) ?? '',
          }),
        })
      },
    },
    {
      slug: 'get_home_info',
      name: 'Get Home Info',
      description: 'Get information about all Eufy Security home locations associated with the account, including station groupings and location names.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async (creds) => {
        return eufyFetch(creds.token, '/app/get_home_info', {
          method: 'POST',
          body: JSON.stringify({}),
        })
      },
    },
    {
      slug: 'list_shared_users',
      name: 'List Shared Users',
      description: 'List all users who have been granted shared access to devices in this Eufy Security account.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          device_sn: { type: 'string', description: 'Device serial number to filter by (optional — omit for all)' },
        },
      },
      execute: async (creds, params) => {
        return eufyFetch(creds.token, '/app/share/get_shared_user_list', {
          method: 'POST',
          body: JSON.stringify({
            device_sn: (params.device_sn as string | undefined) ?? '',
          }),
        })
      },
    },
    {
      slug: 'reboot_device',
      name: 'Reboot Device',
      description: 'Reboot a Eufy Security camera or HomeBase station. The device will go offline briefly and reconnect automatically.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['device_sn'],
        properties: {
          device_sn: { type: 'string', description: 'Device serial number to reboot' },
          station_sn: { type: 'string', description: 'Parent HomeBase station serial number (optional)' },
        },
      },
      execute: async (creds, params) => {
        return eufyFetch(creds.token, '/app/equipment/restart', {
          method: 'POST',
          body: JSON.stringify({
            device_sn: params.device_sn as string,
            station_sn: (params.station_sn as string | undefined) ?? params.device_sn,
          }),
        })
      },
    },
  ],
}
