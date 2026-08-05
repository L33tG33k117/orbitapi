import type { ConnectorManifest, ActionResult } from '@/connectors/types'

// Google Drive — OAuth2 (read-only). Tokens are obtained via the OAuth flow
// (/api/oauth/google-drive/start + /callback) and stored as connection
// credentials, so execute() receives creds.access_token.

async function gdrive(token: string, path: string): Promise<ActionResult> {
  if (!token) return { ok: false, error: 'Not authorized — reconnect Google Drive.' }
  const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) return { ok: false, error: `Google Drive ${res.status}: ${await res.text().catch(() => res.statusText)}` }
  return { ok: true, data: await res.json() }
}

const FILE_FIELDS = 'files(id,name,mimeType,modifiedTime,size,webViewLink,owners(displayName)),nextPageToken'

export const googleDriveManifest: ConnectorManifest = {
  slug: 'google-drive',
  name: 'Google Drive',
  category: 'Productivity',
  description: 'Browse, search, and read files and folders in Google Drive.',
  logoUrl: '/logos/google-drive.svg',
  isSimulated: false,

  auth: {
    type: 'oauth2',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    setupGuide: [
      { title: 'Authorize Google Drive', description: 'Click connect and approve **read-only** access to your Drive. No keys to copy — OrbitAPI handles the rest.' },
    ],
  },

  testConnection: async (creds) => {
    const res = await gdrive(creds.access_token, '/about?fields=user')
    if (!res.ok) return { ok: false, error: res.error }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { ok: true, label: `Google Drive (${(res.data as any)?.user?.emailAddress ?? 'connected'})` }
  },

  network: { hosts: ['www.googleapis.com', 'oauth2.googleapis.com', 'accounts.google.com'] },


  actions: [
    {
      slug: 'list_files',
      name: 'List files',
      description: 'List files in Drive, most recently modified first. limit defaults to 25 (max 100).',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: { limit: { type: 'number', description: 'Max results (default 25, max 100)' } },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        return gdrive(creds.access_token, `/files?pageSize=${limit}&orderBy=modifiedTime desc&fields=${encodeURIComponent(FILE_FIELDS)}`)
      },
    },
    {
      slug: 'search_files',
      name: 'Search files',
      description: 'Search files by name. query: text to match in the file name (e.g. "invoice").',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: { query: { type: 'string', description: 'Text to match in the file name' } },
      },
      execute: async (creds, params) => {
        const q = encodeURIComponent(`name contains '${String(params.query ?? '').replace(/'/g, "\\'")}'`)
        return gdrive(creds.access_token, `/files?q=${q}&pageSize=25&fields=${encodeURIComponent(FILE_FIELDS)}`)
      },
    },
    {
      slug: 'get_file',
      name: 'Get file',
      description: 'Get a single file\'s metadata by its id (from list_files / search_files).',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['file_id'],
        properties: { file_id: { type: 'string', description: 'Drive file id' } },
      },
      execute: async (creds, params) =>
        gdrive(creds.access_token, `/files/${params.file_id}?fields=id,name,mimeType,modifiedTime,size,webViewLink,owners(displayName),parents`),
    },
    {
      slug: 'list_folders',
      name: 'List folders',
      description: 'List folders in Drive. Useful for navigating structure.',
      risk: 'read',
      inputSchema: { type: 'object', properties: {} },
      execute: async (creds) => {
        const q = encodeURIComponent("mimeType = 'application/vnd.google-apps.folder'")
        return gdrive(creds.access_token, `/files?q=${q}&pageSize=50&fields=${encodeURIComponent(FILE_FIELDS)}`)
      },
    },
    {
      slug: 'get_storage_quota',
      name: 'Get storage usage',
      description: 'Return Drive storage quota and usage for the account.',
      risk: 'read',
      inputSchema: { type: 'object', properties: {} },
      execute: async (creds) => gdrive(creds.access_token, '/about?fields=storageQuota,user'),
    },
  ],
}
