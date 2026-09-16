// Shared request timeout for connectors that call fetch directly.
//
// The generated REST connectors get this from connectors/factory.ts. The
// hand-written ones (OAuth flows, non-REST shapes) each call fetch themselves,
// so without this a provider that accepts the connection and then never answers
// would hang the whole function until the platform killed it: the user watches
// a spinner, and a scheduled run spends its entire budget on one call.
export const CONNECTOR_TIMEOUT_MS = 30_000

/** fetch with the shared connector timeout applied. Same signature as fetch. */
export function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = CONNECTOR_TIMEOUT_MS): Promise<Response> {
  return fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(timeoutMs) })
}

/** True when an error came from the timeout above rather than the network. */
export function isTimeout(e: unknown): boolean {
  return e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')
}

/** A plain-language message, so nobody goes hunting for a credential problem. */
export function timeoutError(name: string, timeoutMs = CONNECTOR_TIMEOUT_MS): string {
  return `${name} did not respond within ${Math.round(timeoutMs / 1000)}s. The service may be down or unreachable from here.`
}
