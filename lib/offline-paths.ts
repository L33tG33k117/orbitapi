// Which parts of the cloud app are paused while a workspace is in offline mode.
// Pure module: used by the sidebar and page shell on the client, and by the
// server-side guard.
//
// Paused = anything that reads or changes live connections or runs automation,
// because in offline mode that work happens on the customer's own install and
// nothing done here reaches it.
export const OFFLINE_PAUSED_PREFIXES = [
  '/chat', '/connectors', '/groups', '/skills', '/playbooks', '/bundles',
  '/data-mapping', '/starlab', '/approvals', '/mcp', '/webhooks', '/reference',
  '/marketplace', '/playground', '/automations',
]

export function isOfflinePausedPath(pathname: string): boolean {
  return OFFLINE_PAUSED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export const OFFLINE_PAUSED_MESSAGE =
  'This workspace is in offline mode. Connections and automations run on your self-hosted install, so they are paused here.'
