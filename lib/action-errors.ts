// Turn a connector error into something a person can act on.
//
// Connector errors arrive as whatever the upstream API said ("missing_scope",
// "HTTP 403: Forbidden", "invalid_auth", a fetch failure...). This maps the
// common shapes to a plain explanation and the one thing to do about it.
// Pure module: safe to import from client components.

export interface ExplainedError {
  /** Short, plain statement of what went wrong. */
  title: string
  /** What to do next, written for the user. */
  hint: string
  /** Where to go to fix it, if there's an obvious place. */
  fixHref?: string
  fixLabel?: string
  kind: 'auth' | 'permission' | 'not_found' | 'rate_limit' | 'network' | 'invalid_input' | 'unavailable' | 'unknown'
}

export function explainActionError(
  raw: unknown,
  ctx: { connectionId?: string | null; connectionLabel?: string | null } = {},
): ExplainedError {
  const text = (raw instanceof Error ? raw.message : typeof raw === 'string' ? raw : JSON.stringify(raw ?? '')).slice(0, 500)
  const t = text.toLowerCase()
  const name = ctx.connectionLabel ? `the ${ctx.connectionLabel} connection` : 'this connection'
  const settings = ctx.connectionId ? `/connectors/${ctx.connectionId}` : '/connectors'
  const has = (...words: string[]) => words.some(w => t.includes(w))

  if (has('missing_scope', 'insufficient_scope', 'not_allowed_token_type', 'scope', 'permission', 'forbidden', '403', 'not authorized to', 'access denied', 'insufficient privileges', 'not_in_channel', 'restricted_action')) {
    return {
      kind: 'permission',
      title: `${capital(name)} doesn't have permission to do this.`,
      hint: `The account or app behind ${name} is connected, but it isn't allowed to perform this action. `
        + 'Give it the missing permission (scope/role) in that app\'s admin settings, then reconnect or update the credentials in OrbitAPI and try again.'
        + (t.includes('not_in_channel') ? ' For Slack, invite the app to the channel first (/invite @YourApp).' : ''),
      fixHref: settings, fixLabel: 'Open connection settings',
    }
  }
  if (has('invalid_auth', 'unauthorized', '401', 'invalid token', 'invalid_token', 'token expired', 'token_expired', 'token_revoked', 'invalid api key', 'invalid_api_key', 'authentication', 'no credentials', 'missing credentials', 'account_inactive')) {
    return {
      kind: 'auth',
      title: `${capital(name)} couldn't sign in.`,
      hint: `The saved credentials for ${name} are missing, expired or were revoked. Update them on the connection page, use "Test connection" to confirm, then try again.`,
      fixHref: settings, fixLabel: 'Update credentials',
    }
  }
  if (has('429', 'rate limit', 'rate_limited', 'ratelimited', 'too many requests')) {
    return {
      kind: 'rate_limit',
      title: 'The app is rate-limiting requests right now.',
      hint: 'Nothing is broken. Wait a minute and try again. If this keeps happening, reduce how often schedules or playbooks call this app.',
    }
  }
  if (has('404', 'not found', 'not_found', 'channel_not_found', 'user_not_found', 'does not exist', 'no such')) {
    return {
      kind: 'not_found',
      title: 'The item this action points at wasn\'t found.',
      hint: 'Check the IDs or names in the request (channel, record, user...). It may have been deleted, renamed, or be outside what this connection can see.',
    }
  }
  if (has('400', '422', 'invalid', 'required', 'validation', 'bad request', 'malformed')) {
    return {
      kind: 'invalid_input',
      title: 'The app rejected the details sent with this action.',
      hint: 'One of the values is missing or in the wrong format. Ask the assistant to show the exact parameters, correct them, and run it again.',
    }
  }
  if (has('timeout', 'timed out', 'etimedout', 'econnrefused', 'econnreset', 'enotfound', 'fetch failed', 'network', 'socket hang up', 'getaddrinfo')) {
    return {
      kind: 'network',
      title: 'OrbitAPI couldn\'t reach the app.',
      hint: 'The app may be down, or a firewall/proxy is blocking the connection. Try again shortly; on a self-hosted install, check that outbound access to this app is allowed (Settings → Network access).',
    }
  }
  if (has('500', '502', '503', '504', 'service unavailable', 'internal server error', 'bad gateway')) {
    return {
      kind: 'unavailable',
      title: 'The app had a problem on its side.',
      hint: 'This is usually temporary. Try again in a few minutes. If it keeps failing, check the app\'s status page.',
    }
  }
  return {
    kind: 'unknown',
    title: 'The action didn\'t complete.',
    hint: `Check ${name} with "Test connection". If that passes, try the action again or run it from Manual mode to see the full response.`,
    fixHref: settings, fixLabel: 'Open connection settings',
  }
}

function capital(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }
