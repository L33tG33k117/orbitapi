// "Was this connection ever actually set up?" — bundle installs (and abandoned
// setup wizards) create real-mode connections with NO credentials. Running a
// skill/playbook against those just produces a wall of auth errors, which reads
// like the product is broken. Runners throw UnreadyConnectionsError before a
// run record is created; the run routes turn it into a structured 409 that the
// run buttons resolve with "finish setup" or one-click "switch to Simulation".

export interface UnreadyConnection {
  id: string
  label: string
  connector: string
}

const PREFIX = 'UNREADY_CONNECTIONS:'

export function isUnready(conn: { is_simulated: boolean; vault_secret_id: string | null }): boolean {
  return !conn.is_simulated && !conn.vault_secret_id
}

export class UnreadyConnectionsError extends Error {
  readonly unready: UnreadyConnection[]
  constructor(unready: UnreadyConnection[]) {
    super(PREFIX + JSON.stringify(unready))
    this.unready = unready
  }
}

// Recover the connection list from any thrown value — errors get stringified
// on their way through route catch blocks, so parse from the message.
export function parseUnreadyConnections(err: unknown): UnreadyConnection[] | null {
  const msg = err instanceof Error ? err.message : String(err)
  const i = msg.indexOf(PREFIX)
  if (i === -1) return null
  try {
    return JSON.parse(msg.slice(i + PREFIX.length)) as UnreadyConnection[]
  } catch {
    return null
  }
}
